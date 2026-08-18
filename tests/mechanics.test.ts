import assert from "node:assert/strict";
import test from "node:test";

import {
  FUSION_RECIPES,
  LEGENDARY_RELICS,
  RELICS,
  TALENTS,
  artifactLimit,
  beginAuction,
  calculateScore,
  completeTrade,
  executeRelicAction,
  executeTalentAction,
  intrigueProgress,
  passTurn,
  type GameState,
  type Player,
} from "../src/App.tsx";

const character = { id: "test-player", name: "Jogador de Teste", title: "Convidado da Meia-Noite", sigil: "♠" } as const;

function player(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    userId: id,
    username: id,
    character,
    isHuman: id === "buyer",
    skills: [],
    gold: 10,
    inventory: [],
    prestigeBonus: 0,
    ward: 0,
    itemsWonAct: 0,
    tradesAct: 0,
    bidDiscount: 0,
    blockedAuctions: 0,
    artifactsUsedAct: 0,
    activeTalentsUsed: [],
    activeTalentsUsedGame: [],
    shield: 0,
    tradeCharm: 0,
    salePrestigeBoost: 0,
    riskBonus: 0,
    extraArtifactsAct: 0,
    infusionsAct: 0,
    tradeTributeTo: null,
    decreeStake: 0,
    discordPatron: null,
    discordPenalty: 0,
    intrigueOptions: [],
    intrigueId: null,
    intrigueChosen: false,
    relicsSold: 0,
    hostileActions: 0,
    tradePartners: [],
    ...overrides,
  };
}

function game(players: Player[]): GameState {
  return {
    phase: "playing",
    players,
    deck: [structuredClone(RELICS[0]), structuredClone(RELICS[1])],
    lotIndex: 0,
    act: 1,
    status: "announcement",
    auction: null,
    lastAward: null,
    log: [],
    scores: [],
    voteOutcome: null,
    legendVotes: {},
    pendingOffer: null,
    rewardGranted: false,
  };
}

test("Selo da Primazia concede desconto compartilhável sem trocar o baralho", () => {
  const actor = player("buyer", { skills: ["swap-lot"] });
  const initial = game([actor, player("rival")]);
  const result = executeTalentAction(initial, actor.id, "swap-lot");

  assert.deepEqual(result.deck.map((item) => item.id), initial.deck.map((item) => item.id));
  assert.equal(result.players[0].bidDiscount, 3);
  assert.deepEqual(result.players[0].activeTalentsUsedGame, ["swap-lot"]);
});

test("jogadores expulsos são removidos automaticamente da ordem do leilão", () => {
  const blocked = player("blocked", { blockedAuctions: 1 });
  const initial = game([player("buyer"), blocked, player("third")]);
  const result = beginAuction(initial);

  assert.equal(result.status, "bidding");
  assert.equal(result.players.find((candidate) => candidate.id === blocked.id)?.blockedAuctions, 0);
  assert.ok(!result.auction?.activeIds.includes(blocked.id));
  assert.ok(!result.auction?.order.includes(blocked.id));
  assert.notEqual(result.auction?.turnId, blocked.id);
});

test("um leilão legado preso em jogador expulso avança por passe forçado", () => {
  const relic = structuredClone(RELICS[0]);
  const stuck = {
    ...game([player("buyer"), player("blocked", { blockedAuctions: 1 }), player("third")]),
    status: "bidding" as const,
    auction: { relic, currentBid: relic.start - 1, highBidder: null, activeIds: ["buyer", "blocked", "third"], order: ["buyer", "blocked", "third"], turnId: "blocked", bidders: [] },
  };
  const result = passTurn(stuck, "blocked", true);

  assert.equal(result.players.find((candidate) => candidate.id === "blocked")?.blockedAuctions, 0);
  assert.ok(!result.auction?.activeIds.includes("blocked"));
  assert.equal(result.auction?.turnId, "third");
});

test("Língua de Prata e Carta do Duque devolvem moedas numa compra real", () => {
  const relic = structuredClone(RELICS.find((item) => item.id === "ivory-mask")!);
  const buyer = player("buyer", { skills: ["silver-tongue"], gold: 10, tradeCharm: 4 });
  const seller = player("seller", { gold: 0, inventory: [relic] });
  const result = completeTrade(game([buyer, seller]), buyer.id, seller.id, relic.id, 6);

  assert.equal(result.players[0].gold, 9, "paga 6 e recebe 5 de volta da corte");
  assert.equal(result.players[1].gold, 6, "o vendedor recebe o valor integral combinado");
  assert.equal(result.players[0].tradeCharm, 0);
  assert.equal(result.players[0].inventory[0].id, relic.id);
  assert.equal(result.players[1].relicsSold, 1);
  assert.deepEqual(result.players[0].tradePartners, [seller.id]);
  assert.deepEqual(result.players[1].tradePartners, [buyer.id]);
});

test("Rosto que Nunca Existiu afeta o Museu rival no estado multiplayer", () => {
  const fusion = structuredClone(FUSION_RECIPES.find((recipe) => recipe.result.id === "fusion-nonexistent-face")!.result);
  const rivalRelic = structuredClone(RELICS.find((item) => item.id === "ivory-mask")!);
  const actor = player("buyer", { inventory: [fusion] });
  const rival = player("rival", { inventory: [rivalRelic] });
  const result = executeRelicAction(game([actor, rival]), actor.id, fusion.id, rivalRelic.id);

  assert.equal(result.players[0].prestigeBonus, 1);
  assert.equal(result.players[1].prestigeBonus, -1);
  assert.equal(result.players[1].inventory[0].exhaustedLots, 1);
  assert.equal(result.players[0].inventory[0].usedGame, true);
  assert.equal(result.players[0].hostileActions, 1);
});

test("descrições revisadas correspondem a efeitos implementados", () => {
  assert.equal(TALENTS.find((item) => item.id === "swap-lot")?.activeType, "prioritySeal");
  assert.match(TALENTS.find((item) => item.id === "silver-tongue")!.description, /recupere 1 moeda/i);
  assert.equal(FUSION_RECIPES.find((item) => item.id === "recipe-buried-monarch")!.result.curse?.incomePenalty, 1);
  assert.match(FUSION_RECIPES.find((item) => item.id === "recipe-discord-garden")!.result.power.description, /até vender uma relíquia/i);
});

test("talentos da Glória ampliam o limite real de artefatos", () => {
  assert.equal(artifactLimit(player("buyer")), 2);
  assert.equal(artifactLimit(player("buyer", { skills: ["third-gallery-key"] })), 3);
  assert.equal(artifactLimit(player("buyer", { skills: ["third-gallery-key", "master-gallery-key"] })), 4);
  assert.equal(artifactLimit(player("buyer", { skills: ["master-gallery-key"], extraArtifactsAct: 1 })), 5);
});

test("Terceira Chave permite a terceira ativação sincronizada", () => {
  const relic = structuredClone(RELICS.find((item) => item.id === "widow-ring")!);
  const actor = player("buyer", { skills: ["third-gallery-key"], artifactsUsedAct: 2, inventory: [relic] });
  const result = executeRelicAction(game([actor, player("rival")]), actor.id, relic.id);

  assert.equal(result.players[0].artifactsUsedAct, 3);
  assert.equal(result.players[0].gold, 12);
  assert.equal(result.players[0].inventory[0].usedAct, true);
});

test("catálogo proibido possui oito candidatos únicos e utilizáveis", () => {
  assert.equal(LEGENDARY_RELICS.length, 8);
  assert.equal(new Set(LEGENDARY_RELICS.map((item) => item.id)).size, LEGENDARY_RELICS.length);
  assert.ok(LEGENDARY_RELICS.every((item) => item.legendary && item.power.description.length > 0));
});

test("Livro dos Últimos Nomes rouba Prestígio sem sorte local", () => {
  const book = structuredClone(LEGENDARY_RELICS.find((item) => item.id === "book-final-names")!);
  const actor = player("buyer", { inventory: [book] });
  const rival = player("rival", { prestigeBonus: 4 });
  const result = executeRelicAction(game([actor, rival]), actor.id, book.id, rival.id);

  assert.equal(result.players[0].prestigeBonus, 2);
  assert.equal(result.players[1].prestigeBonus, 2);
  assert.equal(result.players[0].inventory[0].usedGame, true);
});

test("FABIANA reescreve recursos e o limite de ativações no estado compartilhado", () => {
  const fabiana = structuredClone(LEGENDARY_RELICS.find((item) => item.id === "fabiana-creator")!);
  const actor = player("buyer", { gold: 4, inventory: [fabiana] });
  const result = executeRelicAction(game([actor, player("rival")]), actor.id, fabiana.id);

  assert.equal(result.players[0].gold, 9);
  assert.equal(result.players[0].prestigeBonus, 5);
  assert.equal(result.players[0].ward, 1);
  assert.equal(result.players[0].extraArtifactsAct, 1);
  assert.equal(result.players[0].inventory[0].usedGame, true);
});

test("as oito Intrigas Secretas possuem progresso calculável", () => {
  const royal = RELICS.filter((item) => item.tags.includes("Realeza")).slice(0, 3).map((item) => structuredClone(item));
  const cursed = RELICS.filter((item) => item.cursed).slice(0, 3).map((item) => structuredClone(item));
  const legendary = structuredClone(LEGENDARY_RELICS[0]);
  const collection = RELICS.slice(0, 5).map((item) => structuredClone(item));
  const cases: Array<[string, Partial<Player>]> = [
    ["blue-blood", { inventory: royal }],
    ["dead-merchant", { relicsSold: 2 }],
    ["bloodied-hands", { hostileActions: 3 }],
    ["forbidden-devotee", { inventory: [legendary] }],
    ["cursed-museum", { inventory: cursed }],
    ["last-bettor", { gold: 1 }],
    ["obsessive-collector", { inventory: collection }],
    ["court-conspirator", { tradePartners: ["rival-a", "rival-b"] }],
  ];

  for (const [intrigueId, overrides] of cases) assert.equal(intrigueProgress(player("buyer", { ...overrides, intrigueId })).complete, true, intrigueId);
});

test("Intriga cumprida entra no Prestígio final", () => {
  const inventory = RELICS.filter((item) => item.tags.includes("Realeza")).slice(0, 3).map((item) => structuredClone(item));
  const contender = player("buyer", { gold: 0, inventory, intrigueId: "blue-blood", intrigueChosen: true });
  const score = calculateScore(contender);

  assert.equal(score.intrigue, 4);
  assert.equal(score.intrigueId, "blue-blood");
  assert.equal(score.total, score.relics + score.talents + score.gold + 4 - score.curses);
});
