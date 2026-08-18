import test from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";

const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:3000";

async function register(username, characterId, talent) {
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
    body: JSON.stringify({ ...created.account, characterId, unlockedTalents: [talent], lumens: 0 }),
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
    register(`Host${suffix}`, "cajango", "patron-purse"),
    register(`GuestA${suffix}`, "dialgo", "veiled-glimpse"),
    register(`GuestB${suffix}`, "dimas", "radiant-seal"),
  ]);
  const clients = accounts.map((account) => connect(account.cookie));
  await Promise.all(clients.map((client) => client.waitFor((message) => message.type === "hello")));

  clients[0].socket.send(JSON.stringify({ type: "room:create", name: `Teste ${suffix}`, maxPlayers: 3 }));
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
  clients.forEach((client) => client.socket.close());
});

test("a four-player room only starts after all four guests are ready", async () => {
  const suffix = `q${Date.now().toString(36).slice(-6)}`;
  const characters = ["cajango", "feliciano", "dialgo", "dimas"];
  const talents = ["patron-purse", "silver-tongue", "veiled-glimpse", "radiant-seal"];
  const accounts = await Promise.all(Array.from({ length: 4 }, (_, index) => register(`Four${index}${suffix}`, characters[index], talents[index])));
  const clients = accounts.map((account) => connect(account.cookie));
  await Promise.all(clients.map((client) => client.waitFor((message) => message.type === "hello")));
  clients[0].socket.send(JSON.stringify({ type: "room:create", name: `Quarteto ${suffix}`, maxPlayers: 4 }));
  const created = await clients[0].waitFor((message) => message.type === "room:snapshot" && message.room.name === `Quarteto ${suffix}`);
  for (const client of clients.slice(1)) client.socket.send(JSON.stringify({ type: "room:join", roomId: created.room.id }));
  await clients[0].waitFor((message) => message.type === "room:snapshot" && message.room.members.length === 4);
  for (const client of clients) client.socket.send(JSON.stringify({ type: "room:ready", ready: true }));
  const ready = await clients[0].waitFor((message) => message.type === "room:snapshot" && message.room.members.length === 4 && message.room.members.every((member) => member.ready));
  const players = ready.room.members.map((member) => ({ id: member.userId, userId: member.userId, username: member.username, isHuman: false, intrigueOptions: ["forbidden-devotee", "cursed-museum", "last-bettor"], intrigueId: null, intrigueChosen: false }));
  const initialGame = { phase: "playing", players, deck: [], lotIndex: 0, act: 1, status: "intrigue", auction: null, lastAward: null, log: [], scores: [], voteOutcome: null, legendVotes: {}, pendingOffer: null, rewardGranted: false };
  clients[0].socket.send(JSON.stringify({ type: "room:start", gameState: initialGame }));
  const started = await clients[3].waitFor((message) => message.type === "room:snapshot" && message.room.status === "playing");
  assert.equal(started.room.members.length, 4);
  clients.forEach((client) => client.socket.close());
});
