import { createServer } from "node:http";
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";

const scrypt = promisify(scryptCallback);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const production = process.argv.includes("--production") || process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 3000);
const dataDirectory = path.resolve(root, process.env.DATA_DIR || "data");
const storePath = path.join(dataDirectory, "store.json");
const temporaryStorePath = path.join(dataDirectory, "store.tmp");
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const SESSION_COOKIE = "midnight_session";
const ROOM_TTL = 1000 * 60 * 60 * 8;
const INTRIGUE_IDS = new Set(["blue-blood", "dead-merchant", "bloodied-hands", "forbidden-devotee", "cursed-museum", "last-bettor", "obsessive-collector", "court-conspirator"]);

class JsonStore {
  constructor() {
    this.data = { users: [], sessions: [], rooms: [] };
    this.writeQueue = Promise.resolve();
  }

  async load() {
    await mkdir(dataDirectory, { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(storePath, "utf8"));
      this.data = {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
      };
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await this.save();
    }
    await this.prune();
  }

  async save() {
    const snapshot = JSON.stringify(this.data, null, 2);
    this.writeQueue = this.writeQueue.then(async () => {
      await writeFile(temporaryStorePath, snapshot, "utf8");
      await rename(temporaryStorePath, storePath);
    });
    return this.writeQueue;
  }

  async prune() {
    const now = Date.now();
    this.data.sessions = this.data.sessions.filter((session) => session.expiresAt > now);
    this.data.rooms = this.data.rooms.filter((room) => room.members.length > 0 && now - room.updatedAt < ROOM_TTL);
    await this.save();
  }
}

const store = new JsonStore();
await store.load();

function normalizeUsername(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 20);
}

function normalizeRoomName(value, fallback) {
  const name = String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 32);
  return name || `Mesa de ${fallback}`;
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const derived = await scrypt(password, salt, 64);
  return { salt, hash: Buffer.from(derived).toString("hex") };
}

async function passwordMatches(password, user) {
  const candidate = await hashPassword(password, user.passwordSalt);
  const expected = Buffer.from(user.passwordHash, "hex");
  const received = Buffer.from(candidate.hash, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((item) => item.trim()).filter(Boolean).map((item) => {
    const separator = item.indexOf("=");
    if (separator < 0) return [item, ""];
    return [decodeURIComponent(item.slice(0, separator)), decodeURIComponent(item.slice(separator + 1))];
  }));
}

function userFromToken(token) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = store.data.sessions.find((item) => item.tokenHash === tokenHash && item.expiresAt > Date.now());
  return session ? store.data.users.find((user) => user.id === session.userId) ?? null : null;
}

function requestUser(request) {
  return userFromToken(parseCookies(request.headers.cookie)[SESSION_COOKIE]);
}

function publicProfile(user) {
  return {
    id: user.id,
    username: user.username,
    lumens: user.lumens ?? 0,
    unlockedTalents: user.unlockedTalents ?? [],
    wins: user.wins ?? 0,
  };
}

function sessionCookie(token, request) {
  const forwardedProtocol = request.headers["x-forwarded-proto"];
  const secure = production || forwardedProtocol === "https";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure ? "; Secure" : ""}`;
}

function clearSessionCookie(request) {
  const forwardedProtocol = request.headers["x-forwarded-proto"];
  const secure = production || forwardedProtocol === "https";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = Array.from(randomBytes(6), (byte) => alphabet[byte % alphabet.length]).join("");
    if (!store.data.rooms.some((room) => room.code === code)) return code;
  }
  return randomUUID().slice(0, 6).toUpperCase();
}

function activeConnections(userId) {
  let count = 0;
  for (const client of clients.values()) if (client.userId === userId && client.socket.readyState === WebSocket.OPEN) count += 1;
  return count;
}

function publicRooms() {
  return store.data.rooms
    .filter((room) => room.status !== "finished")
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((room) => {
      const host = store.data.users.find((user) => user.id === room.hostUserId);
      return {
        id: room.id,
        code: room.code,
        name: room.name,
        hostName: host?.username ?? "Anfitrião",
        maxPlayers: room.maxPlayers,
        playerCount: room.members.length,
        status: room.status,
        createdAt: room.createdAt,
      };
    });
}

function roomSnapshot(room, viewerId) {
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    hostUserId: room.hostUserId,
    maxPlayers: room.maxPlayers,
    status: room.status,
    version: room.version,
    viewerId,
    gameState: gameStateForViewer(room.gameState, viewerId),
    members: room.members.map((member, seat) => {
      const user = store.data.users.find((candidate) => candidate.id === member.userId);
      return {
        userId: member.userId,
        username: user?.username ?? "Convidado",
        skills: user?.unlockedTalents ?? [],
        wins: user?.wins ?? 0,
        ready: member.ready,
        seat,
        online: activeConnections(member.userId) > 0,
        isHost: member.userId === room.hostUserId,
      };
    }),
  };
}

function gameStateForViewer(gameState, viewerId) {
  if (!gameState || !Array.isArray(gameState.players)) return gameState ?? null;
  const revealIntrigues = gameState.phase === "results" || gameState.status === "intrigueReveal";
  return {
    ...gameState,
    players: gameState.players.map((player) => ({
      ...player,
      intrigueOptions: player.id === viewerId ? [...(player.intrigueOptions ?? [])] : [],
      intrigueId: revealIntrigues || player.id === viewerId ? player.intrigueId ?? null : null,
      intrigueChosen: Boolean(player.intrigueId),
    })),
  };
}

function currentRoom(userId) {
  return store.data.rooms.find((room) => room.members.some((member) => member.userId === userId)) ?? null;
}

function send(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

function sendError(socket, message, code = "INVALID_ACTION") {
  send(socket, { type: "error", code, message });
}

function broadcastLobby() {
  const payload = { type: "lobby", rooms: publicRooms() };
  for (const client of clients.values()) send(client.socket, payload);
}

function broadcastRoom(room) {
  for (const client of clients.values()) {
    if (room.members.some((member) => member.userId === client.userId)) {
      send(client.socket, { type: "room:snapshot", room: roomSnapshot(room, client.userId) });
    }
  }
}

function validateGameState(room, gameState) {
  if (!gameState || typeof gameState !== "object" || !Array.isArray(gameState.players)) return false;
  if (JSON.stringify(gameState).length > 600_000) return false;
  const memberIds = [...room.members.map((member) => member.userId)].sort();
  const playerIds = [...gameState.players.map((player) => player.id)].sort();
  return memberIds.length === playerIds.length && memberIds.every((id, index) => id === playerIds[index]);
}

function validateInitialIntrigues(gameState) {
  return gameState?.status === "intrigue" && gameState.players.every((player) => {
    const options = Array.isArray(player.intrigueOptions) ? player.intrigueOptions : [];
    return options.length === 3 && new Set(options).size === 3 && options.every((id) => INTRIGUE_IDS.has(id)) && !player.intrigueId && !player.intrigueChosen;
  });
}

function mergeIntrigueSecrets(room, incomingState, actorId) {
  const previousState = room.gameState;
  if (!previousState?.players) return incomingState;
  const players = incomingState.players.map((incomingPlayer) => {
    const previousPlayer = previousState.players.find((player) => player.id === incomingPlayer.id);
    if (!previousPlayer) return incomingPlayer;
    const options = [...(previousPlayer.intrigueOptions ?? [])];
    let intrigueId = previousPlayer.intrigueId ?? null;
    if (!intrigueId && previousState.status === "intrigue" && incomingPlayer.id === actorId && options.includes(incomingPlayer.intrigueId)) intrigueId = incomingPlayer.intrigueId;
    return { ...incomingPlayer, intrigueOptions: options, intrigueId, intrigueChosen: Boolean(intrigueId) };
  });
  let status = incomingState.status;
  let log = incomingState.log;
  if (previousState.status === "intrigue") {
    const allChosen = players.every((player) => Boolean(player.intrigueId));
    status = allChosen ? "announcement" : "intrigue";
    if (allChosen) log = ["Todas as intrigas foram seladas. O primeiro lote será apresentado.", ...(Array.isArray(log) ? log : [])].slice(0, 10);
  } else if (incomingState.status === "intrigue") {
    status = previousState.status;
  }
  return { ...incomingState, players, status, log };
}

function validateIntrigueTransition(room, previousState, incomingState, actorId) {
  if (incomingState.status === "intrigueReveal" && previousState?.status !== "intrigueReveal") {
    const finalLot = Array.isArray(previousState?.deck) && previousState.deck.length > 0 && previousState.lotIndex === previousState.deck.length - 1;
    if (actorId !== room.hostUserId || previousState?.status !== "awarded" || !finalLot) return false;
  }
  if (incomingState.phase === "results" && previousState?.phase !== "results") {
    if (actorId !== room.hostUserId || previousState?.status !== "intrigueReveal" || !previousState.players.every((player) => Boolean(player.intrigueId))) return false;
  }
  return true;
}

async function awardWinner(room, previousState, nextState) {
  if (previousState?.phase === "results" || nextState?.phase !== "results") return;
  const winnerId = nextState.scores?.[0]?.playerId;
  const winner = store.data.users.find((user) => user.id === winnerId);
  if (!winner || !room.members.some((member) => member.userId === winner.id)) return;
  winner.lumens = (winner.lumens ?? 0) + 3;
  winner.wins = (winner.wins ?? 0) + 1;
  for (const client of clients.values()) {
    if (client.userId === winner.id) send(client.socket, { type: "profile:update", profile: publicProfile(winner), message: "Vitória registrada: +3 Lúmens." });
  }
}

const app = express();
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "700kb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, rooms: store.data.rooms.length, uptime: Math.floor(process.uptime()) });
});

app.get("/api/account", (request, response) => {
  const user = requestUser(request);
  if (!user) return response.status(401).json({ error: "Sessão não encontrada." });
  return response.json({ account: publicProfile(user) });
});

app.post("/api/account", async (request, response) => {
  const action = request.body?.action;
  if (action === "logout") {
    const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
    const user = token ? userFromToken(token) : null;
    if (token) store.data.sessions = store.data.sessions.filter((session) => session.tokenHash !== hashToken(token));
    if (user) {
      const room = currentRoom(user.id);
      if (room?.status !== "playing") {
        room.members = room.members.filter((member) => member.userId !== user.id);
        if (room.hostUserId === user.id) room.hostUserId = room.members[0]?.userId ?? "";
        if (room.members.length === 0) store.data.rooms = store.data.rooms.filter((candidate) => candidate.id !== room.id);
      }
    }
    await store.save();
    response.setHeader("Set-Cookie", clearSessionCookie(request));
    return response.json({ ok: true });
  }

  const username = normalizeUsername(request.body?.username);
  const password = String(request.body?.password ?? "");
  if (username.length < 3 || password.length < 4 || password.length > 80) {
    return response.status(400).json({ error: "Use um nome de 3 a 20 letras e uma senha de 4 a 80 caracteres." });
  }

  const usernameKey = username.toLocaleLowerCase("pt-BR");
  let user = store.data.users.find((candidate) => candidate.usernameKey === usernameKey);
  if (action === "register") {
    if (user) return response.status(409).json({ error: "Este nome já pertence a outro convidado." });
    const passwordRecord = await hashPassword(password);
    user = {
      id: randomUUID(),
      username,
      usernameKey,
      passwordHash: passwordRecord.hash,
      passwordSalt: passwordRecord.salt,
      lumens: 0,
      unlockedTalents: [],
      wins: 0,
      createdAt: Date.now(),
    };
    store.data.users.push(user);
  } else if (action === "login") {
    if (!user || !(await passwordMatches(password, user))) return response.status(401).json({ error: "Nome ou senha incorretos." });
  } else {
    return response.status(400).json({ error: "Ação de conta inválida." });
  }

  const token = randomBytes(32).toString("base64url");
  store.data.sessions.push({ tokenHash: hashToken(token), userId: user.id, expiresAt: Date.now() + SESSION_MAX_AGE * 1000 });
  await store.save();
  response.setHeader("Set-Cookie", sessionCookie(token, request));
  return response.json({ account: publicProfile(user) });
});

app.patch("/api/account", async (request, response) => {
  const user = requestUser(request);
  if (!user) return response.status(401).json({ error: "Entre novamente no registro." });
  const talents = Array.isArray(request.body?.unlockedTalents) ? request.body.unlockedTalents.filter((item) => typeof item === "string").slice(0, 30) : user.unlockedTalents;
  const newlyUnlocked = talents.filter((talent) => !user.unlockedTalents.includes(talent));
  const requestedLumens = Number(request.body?.lumens);
  if (newlyUnlocked.length <= 1 && Number.isInteger(requestedLumens) && requestedLumens >= 0 && requestedLumens <= user.lumens) {
    user.unlockedTalents = talents;
    user.lumens = requestedLumens;
  }
  await store.save();
  return response.json({ account: publicProfile(user) });
});

const httpServer = createServer(app);
const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 700_000 });
const clients = new Map();

httpServer.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (url.pathname !== "/ws") return socket.destroy();
  const user = userFromToken(parseCookies(request.headers.cookie)[SESSION_COOKIE]);
  if (!user) {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    return socket.destroy();
  }
  webSocketServer.handleUpgrade(request, socket, head, (ws) => webSocketServer.emit("connection", ws, request, user));
});

webSocketServer.on("connection", (socket, _request, user) => {
  const connectionId = randomUUID();
  clients.set(connectionId, { socket, userId: user.id });
  send(socket, { type: "hello", profile: publicProfile(user) });
  send(socket, { type: "lobby", rooms: publicRooms() });
  const existingRoom = currentRoom(user.id);
  if (existingRoom) broadcastRoom(existingRoom);
  broadcastLobby();

  socket.on("message", async (rawMessage) => {
    let message;
    try { message = JSON.parse(rawMessage.toString()); } catch { return sendError(socket, "Mensagem inválida."); }
    try {
      if (message.type === "ping") return send(socket, { type: "pong", at: Date.now() });
      if (message.type === "lobby:refresh") return send(socket, { type: "lobby", rooms: publicRooms() });

      if (message.type === "room:create") {
        const oldRoom = currentRoom(user.id);
        if (oldRoom?.status === "playing") return sendError(socket, "Você já participa de uma partida em andamento.");
        if (oldRoom) {
          oldRoom.members = oldRoom.members.filter((member) => member.userId !== user.id);
          if (oldRoom.hostUserId === user.id) oldRoom.hostUserId = oldRoom.members[0]?.userId ?? "";
          if (oldRoom.members.length === 0) store.data.rooms = store.data.rooms.filter((room) => room.id !== oldRoom.id);
          else broadcastRoom(oldRoom);
        }
        if (user.unlockedTalents.length === 0) return sendError(socket, "Escolha seu primeiro talento antes de criar uma sala.");
        const maxPlayers = Number(message.maxPlayers) === 3 ? 3 : 4;
        const room = {
          id: randomUUID(), code: roomCode(), name: normalizeRoomName(message.name, user.username), hostUserId: user.id,
          maxPlayers, status: "waiting", version: 0, gameState: null, createdAt: Date.now(), updatedAt: Date.now(),
          members: [{ userId: user.id, ready: false, joinedAt: Date.now() }],
        };
        store.data.rooms.push(room);
        await store.save();
        broadcastRoom(room); broadcastLobby();
        return;
      }

      if (message.type === "room:join") {
        if (user.unlockedTalents.length === 0) return sendError(socket, "Escolha seu primeiro talento antes de entrar.");
        const room = store.data.rooms.find((candidate) => candidate.id === message.roomId || candidate.code === String(message.code ?? "").toUpperCase());
        if (!room || room.status !== "waiting") return sendError(socket, "Esta sala não está mais aceitando convidados.", "ROOM_UNAVAILABLE");
        if (room.members.length >= room.maxPlayers) return sendError(socket, "A mesa já está completa.", "ROOM_FULL");
        const oldRoom = currentRoom(user.id);
        if (oldRoom && oldRoom.id !== room.id) return sendError(socket, "Saia da sua sala atual antes de entrar em outra.");
        if (!room.members.some((member) => member.userId === user.id)) room.members.push({ userId: user.id, ready: false, joinedAt: Date.now() });
        room.updatedAt = Date.now();
        await store.save();
        broadcastRoom(room); broadcastLobby();
        return;
      }

      const room = currentRoom(user.id);
      if (!room) return sendError(socket, "Você não está em uma sala.", "NO_ROOM");
      const member = room.members.find((candidate) => candidate.userId === user.id);

      if (message.type === "room:leave") {
        if (room.status === "playing") return sendError(socket, "Reconecte-se à partida; não é possível abandonar uma mesa em andamento.");
        room.members = room.members.filter((candidate) => candidate.userId !== user.id);
        if (room.hostUserId === user.id) room.hostUserId = room.members[0]?.userId ?? "";
        room.updatedAt = Date.now();
        if (room.members.length === 0) store.data.rooms = store.data.rooms.filter((candidate) => candidate.id !== room.id);
        await store.save();
        send(socket, { type: "room:left" });
        if (room.members.length > 0) broadcastRoom(room);
        broadcastLobby();
        return;
      }

      if (message.type === "room:ready") {
        if (room.status !== "waiting" || !member) return sendError(socket, "A preparação desta mesa já terminou.");
        member.ready = Boolean(message.ready);
        room.updatedAt = Date.now();
        await store.save();
        broadcastRoom(room); broadcastLobby();
        return;
      }

      if (message.type === "room:start") {
        if (room.hostUserId !== user.id) return sendError(socket, "Somente o anfitrião pode abrir o baile.");
        if (room.status !== "waiting" || room.members.length !== room.maxPlayers || room.members.some((candidate) => !candidate.ready)) return sendError(socket, `A mesa precisa de ${room.maxPlayers} convidados prontos.`);
        if (!validateGameState(room, message.gameState) || message.gameState.phase !== "playing" || !validateInitialIntrigues(message.gameState)) return sendError(socket, "O estado inicial da partida é inválido.");
        room.gameState = message.gameState;
        room.status = "playing";
        room.version += 1;
        room.updatedAt = Date.now();
        await store.save();
        broadcastRoom(room); broadcastLobby();
        return;
      }

      if (message.type === "game:update") {
        if (room.status !== "playing" || !member) return sendError(socket, "A partida não está ativa.");
        if (Number(message.expectedVersion) !== room.version) {
          send(socket, { type: "game:conflict", room: roomSnapshot(room, user.id) });
          return;
        }
        if (!validateGameState(room, message.gameState)) return sendError(socket, "Atualização de partida recusada.");
        const previousState = room.gameState;
        if (!validateIntrigueTransition(room, previousState, message.gameState, user.id)) return sendError(socket, "A revelação das intrigas ainda não foi autorizada.");
        const nextState = mergeIntrigueSecrets(room, message.gameState, user.id);
        await awardWinner(room, previousState, nextState);
        room.gameState = nextState;
        room.version += 1;
        room.updatedAt = Date.now();
        if (nextState.phase === "results") room.status = "finished";
        await store.save();
        broadcastRoom(room); broadcastLobby();
        return;
      }

      if (message.type === "room:return-to-lobby") {
        if (room.status !== "finished") return sendError(socket, "A partida ainda não terminou.");
        room.members = room.members.filter((candidate) => candidate.userId !== user.id);
        if (room.hostUserId === user.id) room.hostUserId = room.members[0]?.userId ?? "";
        if (room.members.length === 0) store.data.rooms = store.data.rooms.filter((candidate) => candidate.id !== room.id);
        await store.save();
        send(socket, { type: "room:left" });
        broadcastLobby();
        return;
      }

      sendError(socket, "Ação desconhecida.");
    } catch (error) {
      console.error("WebSocket action failed", error);
      sendError(socket, "O Anfitrião perdeu o fio da conversa. Tente novamente.", "SERVER_ERROR");
    }
  });

  socket.on("close", () => {
    clients.delete(connectionId);
    const room = currentRoom(user.id);
    if (room) broadcastRoom(room);
    broadcastLobby();
  });
});

if (production) {
  const dist = path.join(root, "dist");
  app.use(express.static(dist, { maxAge: "1h", index: false }));
  app.use((request, response, next) => {
    if (request.method !== "GET" || request.path.startsWith("/api/") || request.path === "/ws") return next();
    response.sendFile(path.join(dist, "index.html"));
  });
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({ root, server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
}

setInterval(() => void store.prune().then(broadcastLobby).catch(console.error), 60_000).unref();

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Leilão da Meia-Noite Online em http://localhost:${port}`);
});

async function shutdown() {
  await store.save();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 3000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
