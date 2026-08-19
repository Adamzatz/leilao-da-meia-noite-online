import test from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";

const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:3000";

async function register(username, talent) {
  const response = await fetch(`${origin}/api/account`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "register", username, password: "teste-seguro" }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  const created = await response.json();
  const patched = await fetch(`${origin}/api/account`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ ...created.account, unlockedTalents: [talent], lumens: 0 }),
  });
  assert.equal(patched.status, 200);
  return { cookie, profile: (await patched.json()).account };
}

function connect(cookie) {
  const socket = new WebSocket(origin.replace(/^http/, "ws") + "/ws", { headers: { Cookie: cookie } });
  const queue = [];
  const waiters = [];
  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    queue.push(message);
    for (const waiter of [...waiters]) {
      const match = queue.findIndex(waiter.predicate);
      if (match >= 0) {
        const [value] = queue.splice(match, 1);
        clearTimeout(waiter.timer);
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve(value);
      }
    }
  });
  const waitFor = (predicate, timeout = 5000) => {
    const existing = queue.findIndex(predicate);
    if (existing >= 0) return Promise.resolve(queue.splice(existing, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, reject, timer: null };
      waiter.timer = setTimeout(() => {
        waiters.splice(waiters.indexOf(waiter), 1);
        reject(new Error("Timed out waiting for WebSocket message"));
      }, timeout);
      waiters.push(waiter);
    });
  };
  return { socket, waitFor };
}

test("three real players can create, fill, ready and synchronize a room", async () => {
  const suffix = Date.now().toString(36).slice(-6);
  const accounts = await Promise.all([
    register(`Host${suffix}`, "patron-purse"),
    register(`GuestA${suffix}`, "veiled-glimpse"),
    register(`GuestB${suffix}`, "radiant-seal"),
  ]);
  const clients = accounts.map((account) => connect(account.cookie));
  await Promise.all(clients.map((client) => client.waitFor((message) => message.type === "hello")));

  clients[0].socket.send(JSON.stringify({ type: "room:create", name: `Teste ${suffix}`, mode: "multiplayer" }));
  const created = await clients[0].waitFor((message) => message.type === "room:snapshot" && message.room.name === `Teste ${suffix}`);
  const roomId = created.room.id;
  clients[1].socket.send(JSON.stringify({ type: "room:join", roomId }));
  clients[2].socket.send(JSON.stringify({ type: "room:join", roomId }));
  await clients[0].waitFor((message) => message.type === "room:snapshot" && message.room.members.length === 3);

  for (const client of clients) client.socket.send(JSON.stringify({ type: "room:ready", ready: true }));
  const ready = await clients[0].waitFor((message) => message.type === "room:snapshot" && message.room.members.length === 3 && message.room.members.every((member) => member.ready));
  const players = ready.room.members.map((member) => ({ id: member.userId, userId: member.userId, username: member.username, isHuman: false, intrigueOptions: ["blue-blood", "dead-merchant", "bloodied-hands"], intrigueId: null, intrigueChosen: false }));
  const initialGame = { phase: "playing", players, deck: [], lotIndex: 0, act: 1, status: "intrigue", auction: null, lastAward: null, log: [], scores: [], voteOutcome: null, legendVotes: {}, pendingOffer: null, rewardGranted: false };
  clients[0].socket.send(JSON.stringify({ type: "room:start", gameState: initialGame }));
  const started = await clients[1].waitFor((message) => message.type === "room:snapshot" && message.room.status === "playing");
  assert.equal(started.room.version, 1);
  assert.equal(started.room.gameState.players.find((player) => player.id === accounts[1].profile.id).intrigueOptions.length, 3);
  assert.equal(started.room.gameState.players.find((player) => player.id === accounts[0].profile.id).intrigueOptions.length, 0);

  const nextGame = { ...initialGame, players: initialGame.players.map((player) => player.id === accounts[1].profile.id ? { ...player, intrigueId: "blue-blood", intrigueChosen: true } : player), log: ["lance sincronizado"] };
  clients[1].socket.send(JSON.stringify({ type: "game:update", expectedVersion: 1, gameState: nextGame }));
  const synchronized = await clients[2].waitFor((message) => message.type === "room:snapshot" && message.room.version === 2);
  assert.deepEqual(synchronized.room.gameState.log, ["lance sincronizado"]);
  const hiddenChoice = synchronized.room.gameState.players.find((player) => player.id === accounts[1].profile.id);
  assert.equal(hiddenChoice.intrigueId, null);
  assert.equal(hiddenChoice.intrigueChosen, true);

  const hostChoice = { ...initialGame, players: initialGame.players.map((player) => player.id === accounts[0].profile.id ? { ...player, intrigueId: "dead-merchant", intrigueChosen: true } : player) };
  clients[0].socket.send(JSON.stringify({ type: "game:update", expectedVersion: 2, gameState: hostChoice }));
  await clients[1].waitFor((message) => message.type === "room:snapshot" && message.room.version === 3);

  const finalChoice = { ...initialGame, players: initialGame.players.map((player) => player.id === accounts[2].profile.id ? { ...player, intrigueId: "bloodied-hands", intrigueChosen: true } : player) };
  clients[2].socket.send(JSON.stringify({ type: "game:update", expectedVersion: 3, gameState: finalChoice }));
  const allSealed = await clients[0].waitFor((message) => message.type === "room:snapshot" && message.room.version === 4);
  assert.equal(allSealed.room.gameState.status, "announcement");
  assert.ok(allSealed.room.gameState.players.every((player) => player.intrigueChosen));
  assert.equal(allSealed.room.gameState.players.filter((player) => player.intrigueId).length, 1, "antes do final, o anfitrião só conhece a própria intriga");

  clients[1].socket.send(JSON.stringify({ type: "game:update", expectedVersion: 4, gameState: { ...allSealed.room.gameState, status: "intrigueReveal" } }));
  const earlyReveal = await clients[1].waitFor((message) => message.type === "error" && /revelação/i.test(message.message));
  assert.ok(earlyReveal);

  const finalAward = { ...allSealed.room.gameState, deck: [{ id: "final-lot" }], lotIndex: 0, status: "awarded", lastAward: { winnerId: accounts[0].profile.id, price: 1, message: "Último lote" } };
  clients[0].socket.send(JSON.stringify({ type: "game:update", expectedVersion: 4, gameState: finalAward }));
  const awarded = await clients[0].waitFor((message) => message.type === "room:snapshot" && message.room.version === 5);
  clients[0].socket.send(JSON.stringify({ type: "game:update", expectedVersion: 5, gameState: { ...awarded.room.gameState, status: "intrigueReveal" } }));
  const revealed = await clients[1].waitFor((message) => message.type === "room:snapshot" && message.room.version === 6);
  assert.ok(revealed.room.gameState.players.every((player) => player.intrigueId), "a revelação final abre todas as intrigas");

  clients[1].socket.send(JSON.stringify({ type: "room:cancel" }));
  const unauthorizedCancel = await clients[1].waitFor((message) => message.type === "error" && /anfitrião/i.test(message.message));
  assert.equal(unauthorizedCancel.code, "HOST_ONLY");
  clients[0].socket.send(JSON.stringify({ type: "room:cancel" }));
  const cancelled = await Promise.all(clients.map((client) => client.waitFor((message) => message.type === "room:cancelled")));
  assert.ok(cancelled.every((message) => /menu principal/i.test(message.message)));
  clients.forEach((client) => client.socket.close());
});

test("a multiplayer room starts with two ready players without filling eight seats", async () => {
  const suffix = `q${Date.now().toString(36).slice(-6)}`;
  const talents = ["patron-purse", "silver-tongue"];
  const accounts = await Promise.all(Array.from({ length: 2 }, (_, index) => register(`Duo${index}${suffix}`, talents[index])));
  const clients = accounts.map((account) => connect(account.cookie));
  await Promise.all(clients.map((client) => client.waitFor((message) => message.type === "hello")));
  clients[0].socket.send(JSON.stringify({ type: "room:create", name: `Dupla ${suffix}`, mode: "multiplayer" }));
  const created = await clients[0].waitFor((message) => message.type === "room:snapshot" && message.room.name === `Dupla ${suffix}`);
  for (const client of clients.slice(1)) client.socket.send(JSON.stringify({ type: "room:join", roomId: created.room.id }));
  await clients[0].waitFor((message) => message.type === "room:snapshot" && message.room.members.length === 2);
  for (const client of clients) client.socket.send(JSON.stringify({ type: "room:ready", ready: true }));
  const ready = await clients[0].waitFor((message) => message.type === "room:snapshot" && message.room.members.length === 2 && message.room.members.every((member) => member.ready));
  const players = ready.room.members.map((member) => ({ id: member.userId, userId: member.userId, username: member.username, isHuman: false, intrigueOptions: ["forbidden-devotee", "cursed-museum", "last-bettor"], intrigueId: null, intrigueChosen: false }));
  const initialGame = { phase: "playing", players, deck: [], lotIndex: 0, act: 1, status: "intrigue", auction: null, lastAward: null, log: [], scores: [], voteOutcome: null, legendVotes: {}, pendingOffer: null, rewardGranted: false };
  clients[0].socket.send(JSON.stringify({ type: "room:start", gameState: initialGame }));
  const started = await clients[1].waitFor((message) => message.type === "room:snapshot" && message.room.status === "playing");
  assert.equal(started.room.members.length, 2);
  assert.equal(started.room.maxPlayers, 8);
  clients.forEach((client) => client.socket.close());
});

test("solo room adds lore bots in order and never awards Lumens", async () => {
  const suffix = `s${Date.now().toString(36).slice(-6)}`;
  const account = await register(`Solo${suffix}`, "patron-purse");
  const client = connect(account.cookie);
  await client.waitFor((message) => message.type === "hello");
  client.socket.send(JSON.stringify({ type: "room:create", name: `Treino ${suffix}`, mode: "solo" }));
  const created = await client.waitFor((message) => message.type === "room:snapshot" && message.room.name === `Treino ${suffix}`);
  assert.equal(created.room.mode, "solo");

  client.socket.send(JSON.stringify({ type: "room:add-bot" }));
  const luna = await client.waitFor((message) => message.type === "room:snapshot" && message.room.bots.length === 1);
  assert.equal(luna.room.bots[0].name, "Luna");
  client.socket.send(JSON.stringify({ type: "room:add-bot" }));
  const roman = await client.waitFor((message) => message.type === "room:snapshot" && message.room.bots.length === 2);
  assert.deepEqual(roman.room.bots.map((bot) => bot.name), ["Luna", "Roman"]);

  client.socket.send(JSON.stringify({ type: "room:ready", ready: true }));
  const ready = await client.waitFor((message) => message.type === "room:snapshot" && message.room.members[0].ready && message.room.bots.length === 2);
  const human = ready.room.members[0];
  const players = [
    { id: human.userId, userId: human.userId, username: human.username, isHuman: true, intrigueOptions: ["blue-blood", "dead-merchant", "bloodied-hands"], intrigueId: null, intrigueChosen: false },
    ...ready.room.bots.map((bot, index) => ({ id: bot.id, userId: bot.id, username: bot.name, isHuman: false, isBot: true, intrigueOptions: ["forbidden-devotee", "cursed-museum", "last-bettor"], intrigueId: ["forbidden-devotee", "cursed-museum"][index], intrigueChosen: true })),
  ];
  const initialGame = { phase: "playing", players, deck: [], lotIndex: 0, act: 1, status: "intrigue", auction: null, lastAward: null, log: [], scores: [], voteOutcome: null, legendVotes: {}, pendingOffer: null, rewardGranted: false };
  client.socket.send(JSON.stringify({ type: "room:start", gameState: initialGame }));
  const started = await client.waitFor((message) => message.type === "room:snapshot" && message.room.status === "playing");
  assert.equal(started.room.gameState.players.filter((player) => player.isBot).length, 2);

  const humanChoice = { ...started.room.gameState, players: started.room.gameState.players.map((player) => player.id === human.userId ? { ...player, intrigueId: "blue-blood", intrigueChosen: true } : player) };
  client.socket.send(JSON.stringify({ type: "game:update", expectedVersion: 1, gameState: humanChoice }));
  const announced = await client.waitFor((message) => message.type === "room:snapshot" && message.room.version === 2);
  const awardedState = { ...announced.room.gameState, deck: [{ id: "final-lot" }], lotIndex: 0, status: "awarded", lastAward: { winnerId: human.userId, price: 1, message: "Último lote" } };
  client.socket.send(JSON.stringify({ type: "game:update", expectedVersion: 2, gameState: awardedState }));
  const awarded = await client.waitFor((message) => message.type === "room:snapshot" && message.room.version === 3);
  client.socket.send(JSON.stringify({ type: "game:update", expectedVersion: 3, gameState: { ...awarded.room.gameState, status: "intrigueReveal" } }));
  const revealed = await client.waitFor((message) => message.type === "room:snapshot" && message.room.version === 4);
  const scores = revealed.room.gameState.players.map((player, index) => ({ playerId: player.id, total: 10 - index }));
  client.socket.send(JSON.stringify({ type: "game:update", expectedVersion: 4, gameState: { ...revealed.room.gameState, phase: "results", scores } }));
  await client.waitFor((message) => message.type === "room:snapshot" && message.room.status === "finished");
  const profileResponse = await fetch(`${origin}/api/account`, { headers: { Cookie: account.cookie } });
  const profile = (await profileResponse.json()).account;
  assert.equal(profile.lumens, 0);
  assert.equal(profile.wins, 0);
  client.socket.close();
});
