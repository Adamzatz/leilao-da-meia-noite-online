import { useEffect, useRef, useState } from "react";

type Tag = "Realeza" | "Desejo" | "Guerra" | "Morte" | "Oculto" | "Fé" | "Traição" | "Riqueza";
type Branch = "Fortuna" | "Visão" | "Glória" | "Intriga" | "Maldição";
type GameStatus = "intrigue" | "announcement" | "bidding" | "awarded" | "actBreak" | "legendVote" | "voteResult" | "intrigueReveal";
type TargetKind = true | "player" | "rivalRelic" | "ownRelic" | "deckRelic";
type ActionType = "tax" | "discount" | "stealGold" | "silence" | "gainGold" | "convert" | "ward" | "reflect" | "stealPrestige" | "mission" | "giftCurse" | "exalt" | "grandDiscount" | "shield" | "royalDecree" | "tradeMark" | "siphon" | "coinFlip" | "judgment" | "oracle" | "riskBoost" | "recharge" | "purify" | "tradeBoost" | "creation" | "fusion";

type Character = { id: string; name: string; title: string; sigil: string; };
export type Talent = { id: string; name: string; icon: string; branch: Branch; tier: number; cost: number; parent?: string; description: string; activeType?: "blackVault" | "prioritySeal" | "exhibit" | "bribe" | "purify"; };
export type Intrigue = { id: string; name: string; icon: string; description: string; reward: number; target: number; metric: "royalRelics" | "sales" | "hostileActions" | "legendaryRelics" | "curses" | "lowGold" | "collection" | "tradePartners"; };
type ActivePower = { name: string; description: string; type: ActionType; once: "act" | "game"; target?: TargetKind; value?: number; chance?: number; };
type Curse = { name: string; description: string; penalty?: number; incomePenalty?: number; };
type Relic = { id: string; name: string; epithet: string; icon: string; art?: string; prestige: number; start: number; tags: Tag[]; cursed?: boolean; curse?: Curse; legendary?: boolean; fusionTier?: 2 | 3; lore: string; power: ActivePower; };
type OwnedRelic = Relic & { curseSuppressed?: boolean; bonusPrestige?: number; usedAct?: boolean; usedGame?: boolean; exhaustedLots?: number; awakenings?: number; };
type FusionRecipe = { id: string; components: string[]; result: Relic; tier: 2 | 3; cost: number; upgradeFrom?: string; upgradeWith?: string; };

export type Player = {
  id: string;
  userId: string;
  username: string;
  character: Character;
  isHuman: boolean;
  skills: string[];
  gold: number;
  inventory: OwnedRelic[];
  prestigeBonus: number;
  ward: number;
  itemsWonAct: number;
  tradesAct: number;
  bidDiscount: number;
  blockedAuctions: number;
  artifactsUsedAct: number;
  activeTalentsUsed: string[];
  activeTalentsUsedGame: string[];
  shield: number;
  tradeCharm: number;
  salePrestigeBoost: number;
  riskBonus: number;
  extraArtifactsAct: number;
  infusionsAct: number;
  tradeTributeTo: string | null;
  decreeStake: number;
  discordPatron: string | null;
  discordPenalty: number;
  intrigueOptions: string[];
  intrigueId: string | null;
  intrigueChosen: boolean;
  relicsSold: number;
  hostileActions: number;
  tradePartners: string[];
};

type Auction = { relic: Relic; currentBid: number; highBidder: string | null; activeIds: string[]; order: string[]; turnId: string | null; bidders: string[]; };
type Award = { winnerId: string | null; price: number; message: string; };
type Score = { playerId: string; relics: number; talents: number; infusions: number; gold: number; curses: number; intrigue: number; intrigueId: string | null; total: number; fusionNames: string[]; };
type VoteOutcome = { winnerId: string; counts: Record<string, number>; };
type Profile = { id: string; username: string; lumens: number; unlockedTalents: string[]; wins: number; };
type TradeOffer = {
  buyerId: string;
  sellerId: string;
  relicId: string;
  amount: number;
  message: string;
  kind?: "buy-request" | "sale-offer";
  proposerId?: string;
  responderId?: string;
  status?: "offer" | "counter";
};
type NegotiationDraft = { buyerId: string; sellerId: string; relicId: string; amount: number; kind: "buy-request" | "sale-offer"; message: string; };
type LobbyRoom = { id: string; code: string; name: string; hostName: string; maxPlayers: 3 | 4; playerCount: number; status: "waiting" | "playing"; createdAt: number; };
type RoomMember = { userId: string; username: string; skills: string[]; wins: number; ready: boolean; seat: number; online: boolean; isHost: boolean; };
type OnlineRoom = { id: string; code: string; name: string; hostUserId: string; maxPlayers: 3 | 4; status: "waiting" | "playing" | "finished"; version: number; viewerId: string; gameState: GameState | null; members: RoomMember[]; };

export type GameState = {
  phase: "intro" | "library" | "talents" | "lobby" | "room" | "playing" | "results";
  players: Player[];
  deck: Relic[];
  lotIndex: number;
  act: number;
  status: GameStatus;
  auction: Auction | null;
  lastAward: Award | null;
  log: string[];
  scores: Score[];
  voteOutcome: VoteOutcome | null;
  legendVotes: Record<string, string>;
  pendingOffer: TradeOffer | null;
  rewardGranted: boolean;
};

const PLAYER_SIGILS = ["♠", "♛", "◈", "♜"];
export const LORE_FIGURES = ["Zat", "Eichiro Oda", "Laia", "Julia Briolet", "Toriyama", "José", "Barthor", "Olivia", "Sasha Cortex", "Anjo Caído", "Veronica", "Ferndinand", "Luna", "Duvan", "Bélico", "Asma Armas", "Ximbinha", "Sabine", "Cajango", "Dialgo", "Feliciano", "Dimas", "Roman", "Galthak", "Daniel Ramos", "Haika Kimira", "Giovana", "Ana Clara", "FABIANA"] as const;

function namedSignatures(text: string): string[] {
  const normalized = text.toLocaleLowerCase("pt-BR");
  return LORE_FIGURES.filter((figure) => normalized.includes(figure.toLocaleLowerCase("pt-BR")));
}

function loreSignatures(item: Pick<Relic, "name" | "epithet" | "lore" | "power"> & { curse?: Curse }): string[] {
  const text = [item.name, item.epithet, item.lore, item.power.name, item.curse?.name].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
  return namedSignatures(text);
}

type RelicArtworkVariant = "auction" | "library" | "museum" | "detail";

function RelicArtwork({ relic, variant }: { relic: Pick<Relic, "name" | "icon" | "art">; variant: RelicArtworkVariant; }) {
  return <span className={`relic-artwork relic-artwork-${variant} ${relic.art ? "has-image" : "is-placeholder"}`}>
    {relic.art ? <img src={relic.art} alt={`Arte de ${relic.name}`} loading={variant === "auction" ? "eager" : "lazy"} draggable={false} /> : <span aria-hidden="true">{relic.icon}</span>}
  </span>;
}

function playerIdentity(userId: string, username: string, seat: number): Character {
  return { id: userId, name: username, title: "Convidado da Meia-Noite", sigil: PLAYER_SIGILS[seat % PLAYER_SIGILS.length] };
}

const ROOT_TALENTS = ["patron-purse", "veiled-glimpse", "radiant-seal", "silver-tongue", "salt-seal"];

export const INTRIGUES: Intrigue[] = [
  { id: "blue-blood", name: "Linhagem Protegida de Zat, Julia Briolet e Galthak", icon: "♛", description: "Honre a linhagem terminando a partida com 3 relíquias de Realeza.", reward: 4, target: 3, metric: "royalRelics" },
  { id: "dead-merchant", name: "Mercado dos Mortos de José e Ferndinand", icon: "♜", description: "Conclua os contratos proibidos vendendo 2 relíquias durante a partida.", reward: 4, target: 2, metric: "sales" },
  { id: "bloodied-hands", name: "Arsenal de Cajango, Bélico, Asma Armas e Daniel Ramos", icon: "†", description: "Realize 3 ataques com poderes direcionados contra rivais.", reward: 5, target: 3, metric: "hostileActions" },
  { id: "forbidden-devotee", name: "Devoção Elemental de Luna, Toriyama, Haika Kimira e Anjo Caído", icon: "◆", description: "Termine com pelo menos 1 Item Proibido no Museu.", reward: 5, target: 1, metric: "legendaryRelics" },
  { id: "cursed-museum", name: "Museu Impossível de Dialgo, Sasha Cortex, Giovana e Sabine", icon: "☠", description: "Termine com 3 maldições ainda ativas.", reward: 5, target: 3, metric: "curses" },
  { id: "last-bettor", name: "Última Sinfonia e Aposta de Roman, Feliciano, Dimas e Ximbinha", icon: "◑", description: "Termine a partida com no máximo 1 moeda.", reward: 4, target: 1, metric: "lowGold" },
  { id: "obsessive-collector", name: "Coleção de Olivia, Laia, Veronica e Ana Clara", icon: "▤", description: "Termine com pelo menos 5 relíquias no Museu.", reward: 5, target: 5, metric: "collection" },
  { id: "court-conspirator", name: "Conspiração de Eichiro Oda, Duvan e Barthor", icon: "❦", description: "Negocie com 2 jogadores diferentes durante a partida.", reward: 4, target: 2, metric: "tradePartners" },
];

export const TALENTS: Talent[] = [
  { id: "patron-purse", name: "Bolsa do Patrono", icon: "●", branch: "Fortuna", tier: 1, cost: 2, description: "Comece cada baile com 3 moedas adicionais." },
  { id: "court-tithe", name: "Dízimo de Veludo", icon: "♢", branch: "Fortuna", tier: 2, cost: 3, parent: "patron-purse", description: "Receba 2 moedas adicionais ao final de cada ato." },
  { id: "golden-touch", name: "Mão Dourada", icon: "✦", branch: "Fortuna", tier: 3, cost: 5, parent: "court-tithe", description: "Poderes de relíquias que geram ouro produzem +1 moeda." },
  { id: "black-vault", name: "Cofre Negro", icon: "▣", branch: "Fortuna", tier: 3, cost: 5, parent: "court-tithe", description: "Ativa: troque 1 Prestígio por 5 moedas, uma vez por ato.", activeType: "blackVault" },
  { id: "endless-patron", name: "Patrono Inesgotável", icon: "♚", branch: "Fortuna", tier: 4, cost: 8, parent: "golden-touch", description: "Depois de vencer um lote, recupere 1 moeda." },

  { id: "veiled-glimpse", name: "Vislumbre Velado", icon: "◈", branch: "Visão", tier: 1, cost: 2, description: "Veja secretamente qual será a próxima relíquia." },
  { id: "appraiser-eye", name: "Olho do Avaliador", icon: "◇", branch: "Visão", tier: 2, cost: 3, parent: "veiled-glimpse", description: "A simulação revela combos, bônus e maldições separadamente." },
  { id: "marked-catalogue", name: "Catálogo Marcado", icon: "▤", branch: "Visão", tier: 3, cost: 5, parent: "appraiser-eye", description: "Revele quais rivais possuem ouro para subir 3 moedas acima do lance inicial." },
  { id: "swap-lot", name: "Selo da Primazia", icon: "⚜", branch: "Visão", tier: 3, cost: 5, parent: "appraiser-eye", description: "Ativa: prepare 3 moedas de desconto para o próximo lote que você vencer, uma vez por partida.", activeType: "prioritySeal" },
  { id: "forbidden-oracle", name: "Oráculo Proibido", icon: "☿", branch: "Visão", tier: 4, cost: 8, parent: "marked-catalogue", description: "Seu voto na escolha do Item Proibido vale 2 votos." },

  { id: "radiant-seal", name: "Selo de Renome", icon: "♛", branch: "Glória", tier: 1, cost: 2, description: "A primeira relíquia conquistada em cada ato vale +1 Prestígio." },
  { id: "crown-curator", name: "Curador da Coroa", icon: "✥", branch: "Glória", tier: 2, cost: 3, parent: "radiant-seal", description: "Toda relíquia criada por infusão recebe +2 Prestígios." },
  { id: "immortal-gallery", name: "Galeria Imortal", icon: "☼", branch: "Glória", tier: 3, cost: 5, parent: "crown-curator", description: "Cada terceira relíquia do Museu recebe +2 Prestígio." },
  { id: "triumphal-exhibit", name: "Exposição Triunfal", icon: "☉", branch: "Glória", tier: 3, cost: 5, parent: "crown-curator", description: "Ativa: pague 2 moedas para gerar 1 Prestígio, uma vez por ato.", activeType: "exhibit" },
  { id: "eternal-name", name: "Nome Eterno", icon: "♜", branch: "Glória", tier: 4, cost: 8, parent: "immortal-gallery", description: "Terminar com seis relíquias concede +4 Prestígio." },
  { id: "third-gallery-key", name: "Terceira Chave", icon: "⚿", branch: "Glória", tier: 4, cost: 8, parent: "triumphal-exhibit", description: "Você pode ativar 3 artefatos por ato em vez de 2." },
  { id: "master-gallery-key", name: "Chave Mestra do Museu", icon: "✧", branch: "Glória", tier: 5, cost: 12, parent: "third-gallery-key", description: "Você pode ativar 4 artefatos por ato em vez de 3." },

  { id: "silver-tongue", name: "Língua de Prata", icon: "❦", branch: "Intriga", tier: 1, cost: 2, description: "Depois de cada compra feita de um rival, recupere 1 moeda da corte." },
  { id: "smuggler", name: "Contrabandista da Corte", icon: "⚿", branch: "Intriga", tier: 2, cost: 3, parent: "silver-tongue", description: "Você pode concluir duas compras por ato em vez de uma." },
  { id: "loaded-dice", name: "Dados Marcados", icon: "⚄", branch: "Intriga", tier: 3, cost: 5, parent: "smuggler", description: "Missões arriscadas recebem +15% de sucesso." },
  { id: "silent-bribe", name: "Suborno Silencioso", icon: "☗", branch: "Intriga", tier: 3, cost: 5, parent: "smuggler", description: "Ativa: pague 3 moedas para retirar um rival do próximo leilão.", activeType: "bribe" },
  { id: "shadow-merchant", name: "Mercador Sombrio", icon: "♠", branch: "Intriga", tier: 4, cost: 8, parent: "loaded-dice", description: "Cada relíquia vendida rende +1 Prestígio adicional." },

  { id: "salt-seal", name: "Selo de Sal", icon: "☩", branch: "Maldição", tier: 1, cost: 2, description: "A primeira maldição adquirida em cada partida é anulada." },
  { id: "ivory-skin", name: "Pele de Marfim", icon: "☽", branch: "Maldição", tier: 2, cost: 3, parent: "salt-seal", description: "Reduza em 1 a penalidade total de maldições no fim da partida." },
  { id: "abyss-embrace", name: "Abraço do Abismo", icon: "◆", branch: "Maldição", tier: 3, cost: 5, parent: "ivory-skin", description: "Cada relíquia amaldiçoada ativa também concede +1 Prestígio." },
  { id: "purification", name: "Ritual de Purificação", icon: "✣", branch: "Maldição", tier: 3, cost: 5, parent: "ivory-skin", description: "Ativa: pague 3 moedas para anular uma maldição, uma vez por ato.", activeType: "purify" },
  { id: "damned-collector", name: "Colecionador dos Condenados", icon: "☠", branch: "Maldição", tier: 4, cost: 8, parent: "abyss-embrace", description: "Três maldições ativas concedem +5 Prestígio adicional." },
];

export const RELICS: Relic[] = [
  { id: "fallen-crown", name: "Coroa Fraturada de Zat", epithet: "A última insígnia da ambição de Zat", icon: "♛", art: "/artifacts/coroa-fraturada-de-zat.png", prestige: 4, start: 2, tags: ["Realeza", "Morte"], cursed: true, curse: { name: "Peso da Ambição de Zat", description: "Vale −2 Prestígio enquanto você não possuir outra relíquia de Guerra.", penalty: 2 }, lore: "Zat perdeu um reino, mas a coroa se recusou a esquecê-lo.", power: { name: "Decreto de Zat", description: "Cada rival paga 1 moeda a você.", type: "tax", once: "act" } },
  { id: "usurper-cloak", name: "Manto de Conquista de Eichiro Oda", epithet: "Veludo militar tecido com estratégias impossíveis", icon: "♜", art: "/artifacts/manto-de-conquista-de-eichiro-oda.png", prestige: 2, start: 2, tags: ["Realeza", "Traição"], lore: "Eichiro Oda venceu a corte antes mesmo de atravessar suas portas.", power: { name: "Estratégia de Oda", description: "Seu próximo lote vencido custa 2 moedas a menos.", type: "discount", once: "act", value: 2 } },
  { id: "lust-sword", name: "Lâmina Sedenta de Asma Armas", epithet: "A peça central de um arsenal que deseja crescer", icon: "†", prestige: 4, start: 3, tags: ["Desejo", "Guerra"], cursed: true, curse: { name: "Arsenal Insaciável", description: "Vale −2 Prestígio se você terminar com menos de 3 moedas.", penalty: 2 }, lore: "Asma Armas ensinou a lâmina a desejar aquilo que ainda não cortou.", power: { name: "Duelo do Arsenal", description: "65% de chance de roubar 3 moedas; na falha, pague 2.", type: "stealGold", once: "act", target: true, value: 3, chance: .65 } },
  { id: "crimson-perfume", name: "Perfume Carmesim de Laia", epithet: "A vontade de Laia transformada em obsessão", icon: "❦", prestige: 2, start: 1, tags: ["Desejo", "Oculto"], lore: "Uma gota de Laia convence. Duas gotas condenam.", power: { name: "Encanto de Laia", description: "Um rival fica fora do próximo leilão.", type: "silence", once: "game", target: true } },
  { id: "widow-ring", name: "Anel Viúvo de Julia Briolet", epithet: "A joia de sete funerais luxuosos", icon: "◉", art: "/artifacts/anel-viuvo-de-julia-briolet-v2.png", prestige: 3, start: 2, tags: ["Morte", "Traição"], lore: "Julia Briolet guardou no aro o nome de cada dono desaparecido.", power: { name: "Herança de Briolet", description: "Receba 2 moedas do espólio da viúva.", type: "gainGold", once: "act", value: 2 } },
  { id: "last-goblet", name: "Cálice da Última Canção de Ximbinha", epithet: "Ainda vibra com uma melodia que ninguém terminou", icon: "♨", art: "/artifacts/calice-da-ultima-cancao-de-ximbinha-v2.png", prestige: 2, start: 2, tags: ["Fé", "Morte"], cursed: true, curse: { name: "Ritmo dos Mortos", description: "Sua renda é reduzida em 1 moeda a cada ato.", incomePenalty: 1 }, lore: "Ximbinha tocou a última nota; o cálice continuou cantando sozinho.", power: { name: "Brinde Dissonante", description: "Pague 3 moedas e receba 3 Prestígio.", type: "convert", once: "game", value: 3 } },
  { id: "heretic-grimoire", name: "Grimório de Tinta de Toriyama", epithet: "Criaturas de tinta dormem entre as páginas", icon: "▤", prestige: 3, start: 3, tags: ["Fé", "Oculto"], lore: "Toriyama desenhou um dragão na margem; na manhã seguinte faltava uma página.", power: { name: "Traço Absolutório", description: "Anule a maldição da próxima relíquia amaldiçoada.", type: "ward", once: "game" } },
  { id: "faceless-mirror", name: "Espelho Cortical de Sasha Cortex", epithet: "Ele reflete a mente antes de refletir o rosto", icon: "◇", art: "/artifacts/espelho-cortical-de-sasha-cortex.png", prestige: 3, start: 2, tags: ["Oculto", "Desejo"], cursed: true, curse: { name: "Reflexo Fragmentado", description: "Enquanto ativa, esta relíquia sofre −1 Prestígio.", penalty: 1 }, lore: "Sasha Cortex encontrou pensamentos no reflexo que nunca havia pensado.", power: { name: "Reflexo Cortical", description: "Ganhe 2 Prestígio se não estiver liderando; caso contrário, ganhe 1.", type: "reflect", once: "act" } },
  { id: "ivory-mask", name: "Máscara de Porcelana de Sabine", epithet: "O rosto reservado por Sabine para identidades impossíveis", icon: "☽", art: "/artifacts/mascara-de-porcelana-de-sabine.png", prestige: 2, start: 1, tags: ["Oculto", "Realeza"], lore: "Sabine jamais confirmou se existia alguém atrás da porcelana.", power: { name: "Identidade de Sabine", description: "Seu próximo lote vencido custa 2 moedas a menos.", type: "discount", once: "act", value: 2 } },
  { id: "saint-spear", name: "Lança Penitente de Bélico", epithet: "Consagrada para uma guerra que nunca termina", icon: "‡", prestige: 4, start: 4, tags: ["Fé", "Guerra"], cursed: true, curse: { name: "Fé em Guerra", description: "Enquanto ativa, custa −1 Prestígio.", penalty: 1 }, lore: "Bélico fincou a lança entre a vitória e o pecado.", power: { name: "Acusação de Bélico", description: "55% de chance de roubar 2 Prestígio de um rival.", type: "stealPrestige", once: "game", target: true, value: 2, chance: .55 } },
  { id: "crypt-key", name: "Chave Mestra de José", epithet: "Nenhuma fechadura admite conhecê-la", icon: "⚿", prestige: 1, start: 1, tags: ["Morte", "Realeza"], lore: "José catalogou todas as portas, inclusive aquelas que ainda não existem.", power: { name: "Arquivo de José", description: "Encontre entre 1 e 4 moedas.", type: "gainGold", once: "act", value: 4 } },
  { id: "oath-dagger", name: "Adaga dos Sete Acordos de Duvan", epithet: "Um fio para cada trato quebrado", icon: "⌁", prestige: 3, start: 2, tags: ["Guerra", "Traição"], lore: "Duvan nunca assinou um contrato sem deixar a adaga sobre a mesa.", power: { name: "Cobrança de Duvan", description: "Roube 2 moedas de um rival.", type: "stealGold", once: "act", target: true, value: 2, chance: 1 } },
  { id: "weeping-idol", name: "Ídolo Dourado de Olivia", epithet: "Uma divindade afogada em sua própria fortuna", icon: "♢", art: "/artifacts/idolo-dourado-de-olivia.png", prestige: 3, start: 3, tags: ["Riqueza", "Fé"], cursed: true, curse: { name: "Memórias de Ouro", description: "Vale −1 Prestígio enquanto ativa; cada uso também remove 1 Prestígio.", penalty: 1 }, lore: "Cada lágrima de Olivia compra uma lembrança e apaga outra.", power: { name: "Lágrimas de Olivia", description: "Perca 1 Prestígio e receba 4 moedas.", type: "gainGold", once: "act", value: 4 } },
  { id: "black-ledger", name: "Livro-Caixa de Ferndinand", epithet: "Toda dívida encontra seu nome nas páginas", icon: "▥", prestige: 3, start: 3, tags: ["Riqueza", "Oculto"], cursed: true, curse: { name: "Juros de Ferndinand", description: "Sua renda é reduzida em 1 moeda a cada ato.", incomePenalty: 1 }, lore: "Ferndinand registrou até as moedas que os convidados ainda pretendem ganhar.", power: { name: "Auditoria de Ferndinand", description: "Cada rival paga 1 moeda a você.", type: "tax", once: "act" } },
  { id: "hollow-armor", name: "Couraça Oca de Barthor", epithet: "A forja de Barthor ainda marcha sem corpo", icon: "♞", prestige: 4, start: 4, tags: ["Guerra", "Morte"], cursed: true, curse: { name: "Fome de Batalha", description: "Vale −1 Prestígio até completar uma missão com sucesso.", penalty: 1 }, lore: "Barthor construiu uma armadura tão leal que ela recusou a morte do cavaleiro.", power: { name: "Missão de Barthor", description: "50% de roubar uma relíquia. Na falha, perca a Armadura e pague 3 de imposto.", type: "mission", once: "act", target: true, chance: .5 } },
  { id: "golden-apple", name: "Maçã Solar de Luna, Deusa do Sol", epithet: "Um pequeno sol com sementes envenenadas", icon: "●", prestige: 3, start: 2, tags: ["Riqueza", "Desejo"], cursed: true, curse: { name: "Clarão Envenenado", description: "Enquanto estiver no Museu, sua renda é reduzida em 2 moedas por ato.", incomePenalty: 2 }, lore: "Luna criou luz suficiente para alimentar o mundo — e queimá-lo.", power: { name: "Presente Solar", description: "Entregue a Maçã e sua maldição econômica a um rival; receba 3 moedas.", type: "giftCurse", once: "game", target: true, value: 3 } },
  { id: "fallen-king-armor", name: "Armadura Fraturada de Zat", epithet: "A couraça que permaneceu de pé quando Zat caiu", icon: "♝", prestige: 3, start: 3, tags: ["Realeza", "Guerra"], cursed: true, curse: { name: "Ferrugem da Coroa", description: "Vale −1 Prestígio sem outra relíquia de Realeza.", penalty: 1 }, lore: "O metal ainda se curva diante da Coroa Fraturada de Zat.", power: { name: "Última Guarda de Zat", description: "Anule o próximo poder direcionado contra seu Museu.", type: "shield", once: "act" } },
  { id: "last-decree-scepter", name: "Cetro da Última Palavra de Dimas", epithet: "A ordem final de Dimas não admite recurso", icon: "⚜", prestige: 3, start: 3, tags: ["Realeza", "Fé"], lore: "O salão fica em silêncio quando Dimas ergue o cetro.", power: { name: "Tributo de Dimas", description: "O próximo lote começa 2 moedas mais caro; se um rival vencer, você recebe 2 moedas.", type: "royalDecree", once: "act" } },
  { id: "duchess-black-rose", name: "Rosa Negra de Veronica", epithet: "Suas pétalas escutam promessas comerciais", icon: "✾", prestige: 2, start: 2, tags: ["Desejo", "Traição"], lore: "A rosa de Veronica floresce apenas quando alguém mente sobre o preço.", power: { name: "Marca de Veronica", description: "Marque um rival; a próxima negociação dele paga 2 moedas a você.", type: "tradeMark", once: "act", target: true } },
  { id: "queen-mourning-veil", name: "Véu de Luto de Olivia", epithet: "Bordado para o funeral das profundezas", icon: "⌇", prestige: 3, start: 2, tags: ["Morte", "Desejo"], cursed: true, curse: { name: "Luto de Olivia", description: "Vale −1 Prestígio enquanto você não possuir outra peça de Morte.", penalty: 1 }, lore: "Olivia chora por reinos que afundaram antes de receberem um nome.", power: { name: "Lágrima de Olivia", description: "Roube 1 Prestígio de um rival.", type: "siphon", once: "act", target: true, value: 1 } },
  { id: "two-faced-coin", name: "Moeda Viciada de Feliciano", epithet: "Uma aposta cunhada com duas vitórias", icon: "◑", prestige: 3, start: 1, tags: ["Riqueza", "Traição"], cursed: true, curse: { name: "Fortuna de Feliciano", description: "Enquanto estiver no Museu, vale −1 Prestígio.", penalty: 1 }, lore: "Feliciano garante que existe um lado perdedor; ninguém conseguiu encontrá-lo.", power: { name: "Aposta de Feliciano", description: "50% de receber 5 moedas; na falha, perca 3.", type: "coinFlip", once: "act" } },
  { id: "nameless-bell", name: "Sino do Veredito de Dimas", epithet: "A badalada pronuncia sentenças sem apelação", icon: "♧", prestige: 3, start: 3, tags: ["Morte", "Guerra"], lore: "Dimas toca o sino uma vez. Uma segunda badalada jamais foi necessária.", power: { name: "Sentença de Dimas", description: "Se o rival tiver 4 ou mais moedas, roube 2; caso contrário, roube 1 Prestígio.", type: "judgment", once: "act", target: true } },
  { id: "oracle-glass-eye", name: "Olho de Vidro de Dialgo", epithet: "Arrancado depois de prever a noite errada", icon: "◉", prestige: 2, start: 2, tags: ["Oculto", "Fé"], lore: "Dentro da pupila de Dialgo, o próximo martelo já caiu.", power: { name: "Catálogo de Dialgo", description: "Veja os próximos três lotes e escolha qual aparecerá primeiro.", type: "oracle", once: "game", target: "deckRelic" } },
  { id: "hollow-legion-banner", name: "Estandarte da Fúria de Cajango", epithet: "Marcha mesmo quando não há vento", icon: "⚑", prestige: 3, start: 3, tags: ["Guerra", "Morte"], lore: "Mil passos acompanham Cajango quando o estandarte se ergue.", power: { name: "Marcha de Cajango", description: "Seu próximo roubo arriscado recebe +25% de chance.", type: "riskBoost", once: "act", value: 25 } },
  { id: "moon-blood-vial", name: "Frasco do Sol Negro de Luna", epithet: "Um eclipse inteiro preservado em cristal", icon: "◒", prestige: 2, start: 2, tags: ["Oculto", "Desejo"], cursed: true, curse: { name: "Eclipse Interior", description: "Sua renda é reduzida em 1 moeda.", incomePenalty: 1 }, lore: "Luna, Deusa do Sol, engarrafou a única luz que tinha medo de criar.", power: { name: "Reacender o Sol Negro", description: "Recarregue um artefato utilizado neste ato.", type: "recharge", once: "game", target: "ownRelic" } },
  { id: "golden-thief-glove", name: "Luva Contrabandista de Duvan", epithet: "Feita para atravessar qualquer fronteira", icon: "☞", prestige: 2, start: 2, tags: ["Riqueza", "Traição"], lore: "Os dedos de Duvan apontam sozinhos para a bolsa mais cheia.", power: { name: "Mão de Duvan", description: "70% de roubar até 2 moedas; na falha, nenhuma moeda é transferida e o alvo ganha 1 Prestígio.", type: "stealGold", once: "act", target: true, value: 2, chance: .7 } },
  { id: "broken-chain-rosary", name: "Rosário Partido do Anjo Caído", epithet: "Cada conta absolve um pecado impossível", icon: "☩", prestige: 3, start: 2, tags: ["Fé", "Traição"], lore: "O Anjo Caído quebrou a última corrente e guardou os elos como oração.", power: { name: "Absolvição do Anjo Caído", description: "Purifique permanentemente uma maldição do seu Museu.", type: "purify", once: "game", target: "ownRelic" } },
  { id: "duke-sealed-letter", name: "Carta Selada de Ferndinand", epithet: "Um contrato que oferece duas verdades", icon: "✉", prestige: 2, start: 1, tags: ["Realeza", "Traição"], lore: "Ferndinand muda o destinatário toda vez que o lacre se rompe.", power: { name: "Cláusula de Ferndinand", description: "Prepare dois favores: recupere até 4 moedas na próxima compra e ganhe +2 Prestígios na próxima venda.", type: "tradeBoost", once: "act" } },
  { id: "dialgo-coated-bone", name: "Osso Revestido de Dialgo", epithet: "Marfim negro banhado no verniz de um sonho ruim", icon: "⌁", prestige: 3, start: 2, tags: ["Morte", "Oculto"], cursed: true, curse: { name: "Sussurro de Dialgo", description: "As vozes do osso reduzem sua renda em 1 moeda a cada ato.", incomePenalty: 1 }, lore: "Dialgo jurava que o osso respondia. O salão descobriu tarde demais que era verdade.", power: { name: "Ritual do Segundo Pulso", description: "Recarregue um artefato utilizado neste ato.", type: "recharge", once: "game", target: "ownRelic" } },
  { id: "dialgo-sealed-eye", name: "Olho Lacrado de Dialgo", epithet: "Uma pupila de vidro que antecipa o próximo martelo", icon: "◉", prestige: 3, start: 2, tags: ["Oculto", "Fé"], cursed: true, curse: { name: "Visão que Cobra", description: "Enquanto a visão estiver ativa, esta peça vale −1 Prestígio.", penalty: 1 }, lore: "Dialgo cobriu o olho para esquecer o futuro; alguém removeu o lacre.", power: { name: "Presságio de Dialgo", description: "Veja os próximos lotes e escolha qual aparecerá primeiro.", type: "oracle", once: "game", target: "deckRelic" } },
  { id: "feliciano-marked-deck", name: "Baralho Marcado de Feliciano", epithet: "Quatro ases, nenhum inocente", icon: "⚄", prestige: 3, start: 1, tags: ["Riqueza", "Traição"], cursed: true, curse: { name: "Sorte de Feliciano", description: "A sorte cobra sua parte: esta peça vale −1 Prestígio enquanto ativa.", penalty: 1 }, lore: "Feliciano dizia jogar limpo. As cartas nunca tiveram coragem de desmenti-lo.", power: { name: "Tudo ou Nada", description: "50% de receber 5 moedas; na falha, perca 3.", type: "coinFlip", once: "act" } },
  { id: "feliciano-favor-cloak", name: "Manto do Favor de Feliciano", epithet: "Veludo que sempre encontra a cadeira vencedora", icon: "❦", prestige: 3, start: 3, tags: ["Realeza", "Riqueza"], lore: "Quando Feliciano entrava no salão, até o azar fingia não reconhecê-lo.", power: { name: "Favor Improvável", description: "Anule a maldição da próxima relíquia amaldiçoada que você adquirir.", type: "ward", once: "game" } },
  { id: "cajango-destroyer-gauntlet", name: "Manopla Destruidora de Cajango", epithet: "Ferro de cerco moldado para uma única mão", icon: "☞", prestige: 4, start: 4, tags: ["Guerra", "Traição"], cursed: true, curse: { name: "Fúria de Cajango", description: "A manopla exige violência e vale −2 Prestígios enquanto ativa.", penalty: 2 }, lore: "Cajango nunca bateu duas vezes na mesma porta. Depois da primeira, não restava porta.", power: { name: "Golpe de Cobrança", description: "65% de roubar 4 moedas de um rival; na falha, pague 2.", type: "stealGold", once: "act", target: true, value: 4, chance: .65 } },
  { id: "cajango-ash-breastplate", name: "Peitoral de Cinzas de Cajango", epithet: "Uma couraça temperada no incêndio da ala leste", icon: "♝", prestige: 3, start: 3, tags: ["Guerra", "Morte"], cursed: true, curse: { name: "Peso das Cinzas", description: "A couraça reduz sua renda em 1 moeda a cada ato.", incomePenalty: 1 }, lore: "Cajango saiu do fogo sorrindo. A armadura guardou o resto daquele sorriso.", power: { name: "Postura Inquebrável", description: "Anule o próximo poder direcionado contra seu Museu.", type: "shield", once: "act" } },
  { id: "dimas-last-word-hammer", name: "Martelo da Última Palavra de Dimas", epithet: "Depois da batida, toda discussão parece encerrada", icon: "♜", prestige: 3, start: 3, tags: ["Guerra", "Realeza"], cursed: true, curse: { name: "Silêncio de Dimas", description: "O veredito pesa sobre o dono e custa −1 Prestígio.", penalty: 1 }, lore: "Dimas não levantava a voz. Levantava o martelo.", power: { name: "Veredito de Dimas", description: "Se o rival tiver 4 ou mais moedas, roube 2; caso contrário, roube 1 Prestígio.", type: "judgment", once: "act", target: true } },
  { id: "dimas-verdict-signet", name: "Sinete do Veredito de Dimas", epithet: "Cera negra para ordens que ninguém ousa devolver", icon: "⚜", prestige: 3, start: 2, tags: ["Realeza", "Fé"], lore: "O nome de Dimas no lacre valia mais que a assinatura de qualquer rei.", power: { name: "Ordem Irrecorrível", description: "O próximo lote começa 2 moedas mais caro; se um rival vencer, você recebe 2 moedas.", type: "royalDecree", once: "act" } },
  { id: "roman-divine-lyre", name: "Lira Divina de Roman, Deus da Música", epithet: "Sete cordas afinadas com as órbitas das estrelas", icon: "♫", prestige: 3, start: 3, tags: ["Fé", "Desejo"], lore: "Roman tocou um acorde tão perfeito que um rival esqueceu por que desejava o próximo lote.", power: { name: "Silêncio de Roman", description: "Um rival fica fora do próximo leilão.", type: "silence", once: "game", target: true } },
  { id: "galthak-allied-shield", name: "Escudo das Raças Amigas de Galthak", epithet: "Cada brasão representa um povo protegido", icon: "◫", prestige: 4, start: 4, tags: ["Fé", "Guerra"], lore: "Galthak jurou que nenhuma raça amiga enfrentaria a noite sozinha.", power: { name: "Juramento de Galthak", description: "Anule o próximo poder direcionado contra seu Museu.", type: "shield", once: "act" } },
  { id: "daniel-dragon-lance", name: "Lança Dracônica de Daniel Ramos", epithet: "A arma do campeão reconhecido pelos próprios dragões", icon: "⚔", prestige: 4, start: 4, tags: ["Guerra", "Realeza"], lore: "Daniel Ramos não derrotou os dragões; conquistou o direito de lutar ao lado deles.", power: { name: "Desafio do Campeão", description: "65% de chance de roubar 2 Prestígios de um rival.", type: "stealPrestige", once: "game", target: true, value: 2, chance: .65 } },
  { id: "haika-elemental-prism", name: "Prisma Elemental de Haika Kimira", epithet: "O foco da Alrakayz dos Elementos", icon: "✧", prestige: 3, start: 3, tags: ["Oculto", "Fé"], lore: "Haika Kimira aprisionou fogo, mar, pedra e vento sem permitir que parassem de lutar.", power: { name: "Convergência de Haika", description: "Recarregue um artefato utilizado neste ato.", type: "recharge", once: "game", target: "ownRelic" } },
  { id: "giovana-madness-tiara", name: "Diadema da Loucura de Giovana", epithet: "Uma coroa que ri de quem tenta compreendê-la", icon: "☿", prestige: 4, start: 2, tags: ["Oculto", "Desejo"], cursed: true, curse: { name: "Riso da Deusa", description: "Enquanto estiver no Museu, vale −2 Prestígios.", penalty: 2 }, lore: "Giovana, Deusa da Loucura, chama de lucidez tudo aquilo que o salão teme.", power: { name: "Capricho de Giovana", description: "50% de receber 5 moedas; na falha, perca 3.", type: "coinFlip", once: "act" } },
  { id: "ana-clara-crystal-reliquary", name: "Relicário de Cristal de Ana Clara", epithet: "Uma luz calma preservada no centro do salão", icon: "✣", prestige: 3, start: 2, tags: ["Fé", "Realeza"], lore: "Ana Clara descobriu que algumas maldições se desfazem quando finalmente são vistas.", power: { name: "Clareza de Ana", description: "Purifique permanentemente uma maldição do seu Museu.", type: "purify", once: "game", target: "ownRelic" } },
];

export const LEGENDARY_RELICS: Relic[] = [
  { id: "dragon-heart", name: "Coração do Dragão de Toriyama", epithet: "Uma criatura de tinta que aprendeu a pulsar", icon: "◆", prestige: 6, start: 5, tags: ["Guerra", "Riqueza"], legendary: true, lore: "Toriyama desenhou o coração; Daniel Ramos ensinou o dragão a sobreviver.", power: { name: "Dízimo do Dragão de Toriyama", description: "Roube 2 moedas de cada rival.", type: "tax", once: "game", value: 2 } },
  { id: "nameless-throne", name: "Trono Abandonado de Zat", epithet: "Um assento vazio desde a queda da coroa", icon: "♚", prestige: 5, start: 5, tags: ["Realeza", "Fé"], legendary: true, lore: "Quem ocupa o antigo lugar de Zat esquece o próprio nome.", power: { name: "Ascensão de Zat", description: "Ganhe pelo menos 2 Prestígios, ou metade das relíquias do seu Museu se esse valor for maior.", type: "exalt", once: "game" } },
  { id: "first-hourglass", name: "Ampulheta Cortical de Sasha Cortex", epithet: "Areia feita de pensamentos que ainda não aconteceram", icon: "⌛", prestige: 4, start: 4, tags: ["Oculto", "Morte"], legendary: true, lore: "Sasha Cortex vira a ampulheta e o salão esquece o último segundo.", power: { name: "Recuo Cortical", description: "Seu próximo lote vencido custa 4 moedas a menos.", type: "grandDiscount", once: "game", value: 4 } },
  { id: "eclipsed-moon-mask", name: "Máscara do Eclipse de Sabine", epithet: "O rosto usado por Sabine quando a luz desaparece", icon: "◐", prestige: 5, start: 4, tags: ["Oculto", "Desejo"], legendary: true, lore: "Quando Sabine sorri atrás dela, uma cadeira amanhece vazia.", power: { name: "Banimento de Sabine", description: "Um rival fica fora do próximo leilão.", type: "silence", once: "game", target: true } },
  { id: "first-phoenix-ashes", name: "Cinzas Solares de Luna, Deusa do Sol", epithet: "O primeiro renascimento aceso pela própria deusa", icon: "♨", prestige: 5, start: 4, tags: ["Fé", "Morte"], legendary: true, lore: "As cinzas de Luna recusam a noite e procuram uma nova aurora.", power: { name: "Renascimento Solar", description: "Anule a maldição da próxima relíquia amaldiçoada.", type: "ward", once: "game" } },
  { id: "crowned-leviathan-pearl", name: "Pérola Abissal de Olivia", epithet: "Tributo arrancado do reino afogado de Olivia", icon: "◉", prestige: 6, start: 5, tags: ["Riqueza", "Realeza"], legendary: true, lore: "Toda fortuna parece pequena diante da última lágrima de Olivia.", power: { name: "Muralha de Olivia", description: "Anule o próximo poder direcionado contra seu Museu.", type: "shield", once: "game" } },
  { id: "book-final-names", name: "Livro dos Últimos Nomes de José", epithet: "O registro de José encerra destinos antes de escrevê-los", icon: "▥", prestige: 5, start: 4, tags: ["Oculto", "Traição"], legendary: true, lore: "José mantém uma página em branco para cada pessoa presente.", power: { name: "Registro Final de José", description: "Roube 2 Prestígios de um rival.", type: "siphon", once: "game", target: true, value: 2 } },
  { id: "fabiana-creator", name: "FABIANA, A Criadora", epithet: "O Item Proibido primordial · acima de toda obra", icon: "✹", prestige: 9, start: 7, tags: ["Realeza", "Fé", "Oculto"], legendary: true, lore: "Antes do ouro, das máscaras e da primeira badalada, FABIANA imaginou o salão.", power: { name: "Reescrever a Criação", description: "Receba 5 moedas e 5 Prestígios, ganhe proteção contra uma maldição e uma ativação extra neste ato.", type: "creation", once: "game" } },
];

function makeFusion(id: string, name: string, icon: string, prestige: number, tags: Tag[], powerName: string, description: string, once: "act" | "game", target?: TargetKind, options?: { curse?: Curse; legendary?: boolean; tier?: 2 | 3 }): Relic {
  return { id, name, epithet: "Uma infusão impossível nascida dentro do Museu", icon, prestige, start: 0, tags, fusionTier: options?.tier ?? 2, legendary: options?.legendary, cursed: Boolean(options?.curse), curse: options?.curse, lore: "As peças originais já não podem ser separadas.", power: { name: powerName, description, type: "fusion", once, target } };
}

export const FUSION_RECIPES: FusionRecipe[] = [
  { id: "recipe-buried-monarch", components: ["fallen-crown", "fallen-king-armor"], tier: 2, cost: 2, result: makeFusion("fusion-buried-monarch", "Regalia Sepultada de Zat", "♚", 7, ["Realeza", "Guerra", "Morte"], "Levante de Zat", "Cada rival paga 1 moeda e o próximo poder contra seu Museu é anulado.", "act", undefined, { curse: { name: "Corte Morta de Zat", description: "Sua renda é reduzida em 1 moeda enquanto esta maldição estiver ativa.", incomePenalty: 1 } }) },
  { id: "recipe-usurper-regalia", components: ["fallen-crown", "usurper-cloak"], tier: 2, cost: 2, result: makeFusion("fusion-usurper-regalia", "Pacto de Conquista de Zat e Eichiro Oda", "♛", 6, ["Realeza", "Traição", "Morte"], "Estratégia do Trono", "Seu próximo lote custa 3 moedas a menos; receba também 1 Prestígio.", "act") },
  { id: "recipe-crimson-obsession", components: ["lust-sword", "crimson-perfume"], tier: 2, cost: 2, result: makeFusion("fusion-crimson-obsession", "Duelo Carmesim de Laia e Asma Armas", "⚔", 6, ["Desejo", "Guerra", "Oculto"], "Desejo do Arsenal", "70% de roubar 4 moedas e retirar o alvo do próximo leilão; na falha, pague 3 e ele ganha 1 Prestígio.", "game", "player") },
  { id: "recipe-seventh-bride", components: ["widow-ring", "queen-mourning-veil"], tier: 2, cost: 2, result: makeFusion("fusion-seventh-bride", "Sétimo Funeral de Julia Briolet e Olivia", "♢", 6, ["Morte", "Desejo", "Traição"], "Beijo do Cortejo", "Roube 2 Prestígios; roube 3 se o alvo possuir uma relíquia de Morte.", "game", "player") },
  { id: "recipe-profane-communion", components: ["last-goblet", "heretic-grimoire"], tier: 2, cost: 2, result: makeFusion("fusion-profane-communion", "Comunhão Dissonante de Ximbinha e Toriyama", "♨", 6, ["Fé", "Morte", "Oculto"], "Absolvição pela Tinta", "Pague 3 moedas, ganhe 3 Prestígios e purifique uma maldição.", "game", "ownRelic") },
  { id: "recipe-nonexistent-face", components: ["faceless-mirror", "ivory-mask"], tier: 2, cost: 2, result: makeFusion("fusion-nonexistent-face", "Rosto Cortical de Sasha Cortex e Sabine", "◈", 5, ["Oculto", "Desejo", "Realeza"], "Reflexo sem Identidade", "Roube 1 Prestígio do dono e silencie a relíquia rival escolhida até o próximo lote.", "game", "rivalRelic") },
  { id: "recipe-sepulchral-paladin", components: ["saint-spear", "hollow-armor"], tier: 2, cost: 2, result: makeFusion("fusion-sepulchral-paladin", "Paladino Oco de Bélico e Barthor", "♞", 9, ["Fé", "Guerra", "Morte"], "Cruzada dos Dois", "70% de roubar a relíquia escolhida; na falha, pague 3 moedas e perca 3 Prestígios.", "game", "rivalRelic") },
  { id: "recipe-crypt-judgment", components: ["crypt-key", "nameless-bell"], tier: 2, cost: 2, result: makeFusion("fusion-crypt-judgment", "Julgamento da Cripta de José e Dimas", "⚿", 5, ["Morte", "Realeza", "Guerra"], "Abrir o Veredito", "Se o alvo tiver 4 moedas, roube 2; caso contrário, roube 1 Prestígio.", "act", "player") },
  { id: "recipe-seven-finger-hand", components: ["oath-dagger", "golden-thief-glove"], tier: 2, cost: 2, result: makeFusion("fusion-seven-finger-hand", "Mão dos Sete Acordos de Duvan", "☞", 6, ["Guerra", "Traição", "Riqueza"], "Golpe de Duvan", "75% de roubar 3 moedas. Dois sucessos despertam +2 Prestígios permanentes.", "act", "player") },
  { id: "recipe-weeping-treasure", components: ["weeping-idol", "black-ledger"], tier: 2, cost: 2, result: makeFusion("fusion-weeping-treasure", "Tesouro Choroso de Olivia e Ferndinand", "♢", 6, ["Riqueza", "Fé", "Oculto"], "Cobrança das Lágrimas", "Cada rival paga 1 moeda; para cada rival incapaz, receba 1 Prestígio.", "act", undefined, { curse: { name: "Cofre Faminto de Olivia", description: "Sua renda é reduzida em 2 moedas.", incomePenalty: 2 } }) },
  { id: "recipe-discord-garden", components: ["golden-apple", "duchess-black-rose"], tier: 2, cost: 2, result: makeFusion("fusion-discord-garden", "Jardim Solar de Luna e Veronica", "✾", 6, ["Riqueza", "Desejo", "Traição"], "Plantar o Eclipse", "O alvo perde 3 Prestígios até vender uma relíquia; quando vender, recupera os 3 e você recebe 2 moedas.", "game", "player") },
  { id: "recipe-two-faced-pact", components: ["two-faced-coin", "duke-sealed-letter"], tier: 2, cost: 2, result: makeFusion("fusion-two-faced-pact", "Pacto Marcado de Feliciano e Ferndinand", "◑", 5, ["Riqueza", "Traição", "Realeza"], "Contrato Apostado", "Aposte 3 moedas contra um rival: 50% de ganhar 6; na falha, ele recebe as 3. Sua próxima compra recebe até 2 moedas de volta.", "act", "player") },
  { id: "recipe-draconic-banner", components: ["dragon-heart", "hollow-legion-banner"], tier: 2, cost: 2, result: makeFusion("fusion-draconic-banner", "Estandarte Dracônico de Toriyama e Cajango", "⚑", 10, ["Guerra", "Riqueza", "Morte"], "Marcha do Dragão", "Cada rival paga 2 moedas; moedas não pagas viram Prestígio.", "game", undefined, { legendary: true, curse: { name: "Terra Queimada", description: "Sua próxima renda é reduzida em 3 moedas.", incomePenalty: 3 } }) },
  { id: "recipe-unpronounceable-reign", components: ["nameless-throne", "last-decree-scepter"], tier: 2, cost: 2, result: makeFusion("fusion-unpronounceable-reign", "Reinado Impronunciável de Zat e Dimas", "♚", 9, ["Realeza", "Fé", "Oculto"], "Direito dos Dois", "Depois que um rival vencer, tome o lote pagando uma moeda acima do preço final.", "game", undefined, { legendary: true }) },
  { id: "recipe-first-dawn-eye", components: ["first-hourglass", "oracle-glass-eye"], tier: 2, cost: 2, result: makeFusion("fusion-first-dawn-eye", "Primeiro Presságio de Sasha Cortex e Dialgo", "⌛", 7, ["Oculto", "Morte", "Fé"], "Alterar o Pensamento", "Escolha um dos próximos três lotes e ganhe uma ativação extra neste ato.", "game", "deckRelic", { legendary: true }) },
  { id: "recipe-red-moon-baptism", components: ["moon-blood-vial", "broken-chain-rosary"], tier: 2, cost: 2, result: makeFusion("fusion-red-moon-baptism", "Batismo do Sol Negro de Luna e do Anjo Caído", "◒", 6, ["Oculto", "Desejo", "Fé"], "Renascimento do Eclipse", "Purifique e recarregue um artefato; você recebe uma ativação extra neste ato.", "game", "ownRelic") },

  { id: "recipe-death-refusing-king", components: ["fallen-crown", "fallen-king-armor", "last-decree-scepter"], tier: 3, cost: 4, upgradeFrom: "fusion-buried-monarch", upgradeWith: "last-decree-scepter", result: makeFusion("fusion-death-refusing-king", "Último Reinado de Zat e Dimas", "♚", 12, ["Realeza", "Guerra", "Morte"], "Último Decreto dos Dois", "Durante a apresentação, tome o lote pagando o lance inicial +3; cada rival recebe 2 moedas e seu Museu fica protegido no ato.", "game", undefined, { tier: 3 }) },
  { id: "recipe-armed-lust-garden", components: ["lust-sword", "crimson-perfume", "duchess-black-rose"], tier: 3, cost: 4, upgradeFrom: "fusion-crimson-obsession", upgradeWith: "duchess-black-rose", result: makeFusion("fusion-armed-lust-garden", "Jardim Devastador de Laia, Veronica e Asma Armas", "✾", 10, ["Desejo", "Guerra", "Traição"], "Desejo Devastador", "Roube metade do ouro do alvo e retire-o do próximo leilão; ele recebe 2 Prestígios.", "game", "player", { tier: 3 }) },
  { id: "recipe-hollow-saints-procession", components: ["saint-spear", "hollow-armor", "hollow-legion-banner"], tier: 3, cost: 4, upgradeFrom: "fusion-sepulchral-paladin", upgradeWith: "hollow-legion-banner", result: makeFusion("fusion-hollow-saints-procession", "Cruzada de Bélico, Barthor e Cajango", "♞", 14, ["Fé", "Guerra", "Morte"], "Marcha dos Três", "85% de roubar a relíquia escolhida e ganhar 2 Prestígios; na falha, perca 4.", "game", "rivalRelic", { tier: 3 }) },
  { id: "recipe-last-heretic-mass", components: ["last-goblet", "heretic-grimoire", "broken-chain-rosary"], tier: 3, cost: 4, upgradeFrom: "fusion-profane-communion", upgradeWith: "broken-chain-rosary", result: makeFusion("fusion-last-heretic-mass", "Missa Final de Ximbinha, Toriyama e Anjo Caído", "☩", 11, ["Fé", "Morte", "Oculto"], "Missa de Tinta e Som", "Purifique todas as suas maldições, ganhe 1 Prestígio por purificação e retire 1 de cada rival amaldiçoado.", "game", undefined, { tier: 3 }) },
  { id: "recipe-infernal-weeping-treasure", components: ["weeping-idol", "black-ledger", "two-faced-coin"], tier: 3, cost: 4, upgradeFrom: "fusion-weeping-treasure", upgradeWith: "two-faced-coin", result: makeFusion("fusion-infernal-weeping-treasure", "Auditoria Infernal de Olivia, Ferndinand e Feliciano", "▥", 10, ["Riqueza", "Fé", "Oculto"], "Auditoria dos Três", "Cada rival paga 2 moedas ou concede 1 Prestígio a você.", "act", undefined, { tier: 3, curse: { name: "Auditor Condenado", description: "Sua renda é reduzida em 1 moeda.", incomePenalty: 1 } }) },
  { id: "recipe-face-beyond-veil", components: ["faceless-mirror", "ivory-mask", "oracle-glass-eye"], tier: 3, cost: 4, upgradeFrom: "fusion-nonexistent-face", upgradeWith: "oracle-glass-eye", result: makeFusion("fusion-face-beyond-veil", "Identidade Impossível de Sasha Cortex, Sabine e Dialgo", "◈", 9, ["Oculto", "Desejo", "Fé"], "Mente sem Rosto", "Roube 2 Prestígios do dono e silencie a relíquia rival escolhida pelos próximos três lotes.", "game", "rivalRelic", { tier: 3 }) },
  { id: "recipe-seventh-funeral-queen", components: ["widow-ring", "queen-mourning-veil", "nameless-bell"], tier: 3, cost: 4, upgradeFrom: "fusion-seventh-bride", upgradeWith: "nameless-bell", result: makeFusion("fusion-seventh-funeral-queen", "Cortejo Final de Julia Briolet, Olivia e Dimas", "♛", 11, ["Morte", "Desejo", "Guerra"], "Ordenar o Oitavo Funeral", "Roube 2 moedas e 2 Prestígios; roube 3 de cada se o alvo possuir Morte.", "game", "player", { tier: 3 }) },
  { id: "recipe-seven-oaths-syndicate", components: ["oath-dagger", "golden-thief-glove", "duke-sealed-letter"], tier: 3, cost: 4, upgradeFrom: "fusion-seven-finger-hand", upgradeWith: "duke-sealed-letter", result: makeFusion("fusion-seven-oaths-syndicate", "Sindicato de Duvan e Ferndinand", "⚿", 10, ["Guerra", "Traição", "Riqueza"], "Oferta dos Contrabandistas", "Roube a relíquia escolhida pagando ao dono ouro igual ao Prestígio dela; se não puder, roube 2 moedas.", "act", "rivalRelic", { tier: 3 }) },
  { id: "recipe-nameless-sovereign", components: ["fallen-crown", "last-decree-scepter", "nameless-throne"], tier: 3, cost: 4, upgradeFrom: "fusion-unpronounceable-reign", upgradeWith: "fallen-crown", result: makeFusion("fusion-nameless-sovereign", "Soberano de Zat e Dimas", "♚", 14, ["Realeza", "Fé", "Morte"], "Usurpar o Martelo", "Depois que um rival vencer, tome o lote pagando o preço final +2; ele recebe o ouro de volta e 2 de indenização.", "game", undefined, { tier: 3, legendary: true }) },
  { id: "recipe-scarlet-war-god", components: ["lust-sword", "saint-spear", "dragon-heart"], tier: 3, cost: 4, result: makeFusion("fusion-scarlet-war-god", "Apocalipse de Asma Armas, Bélico e Toriyama", "◆", 16, ["Desejo", "Guerra", "Fé"], "Apocalipse dos Três", "Cada rival perde 3 moedas; rivais incapazes também perdem 2 Prestígios.", "game", undefined, { tier: 3, legendary: true, curse: { name: "Fome de Guerra", description: "Depois de ativar, esta relíquia perde 3 Prestígios." } }) },
  { id: "recipe-first-dawn-witness", components: ["faceless-mirror", "oracle-glass-eye", "first-hourglass"], tier: 3, cost: 4, upgradeFrom: "fusion-first-dawn-eye", upgradeWith: "faceless-mirror", result: makeFusion("fusion-first-dawn-witness", "Testemunha do Amanhecer de Sasha Cortex e Dialgo", "⌛", 11, ["Oculto", "Morte", "Fé"], "Reabrir o Pensamento", "Anule o resultado do último leilão, devolva a relíquia e prepare 2 moedas de desconto para a nova disputa.", "game", undefined, { tier: 3, legendary: true }) },
  { id: "recipe-roman-ximbinha-symphony", components: ["roman-divine-lyre", "last-goblet"], tier: 2, cost: 2, result: { ...makeFusion("fusion-roman-ximbinha-symphony", "Sinfonia Divina de Roman e Ximbinha", "♫", 7, ["Fé", "Desejo", "Morte"], "Concerto dos Dois Mundos", "Cada rival paga 1 moeda a você.", "act"), power: { name: "Concerto dos Dois Mundos", description: "Cada rival paga 1 moeda a você.", type: "tax", once: "act", value: 1 } } },
  { id: "recipe-galthak-barthor-bastion", components: ["galthak-allied-shield", "hollow-armor"], tier: 2, cost: 2, result: { ...makeFusion("fusion-galthak-barthor-bastion", "Bastião de Galthak e Barthor", "◫", 8, ["Fé", "Guerra", "Morte"], "Muralha das Raças Amigas", "Anule o próximo poder direcionado contra seu Museu.", "act"), power: { name: "Muralha das Raças Amigas", description: "Anule o próximo poder direcionado contra seu Museu.", type: "shield", once: "act" } } },
  { id: "recipe-daniel-dragon-champion", components: ["daniel-dragon-lance", "dragon-heart"], tier: 2, cost: 2, result: { ...makeFusion("fusion-daniel-dragon-champion", "Campeão dos Dragões Daniel Ramos", "⚔", 11, ["Guerra", "Realeza", "Riqueza"], "Pacto do Campeão", "75% de chance de roubar 3 Prestígios de um rival.", "game", "player", { legendary: true }), power: { name: "Pacto do Campeão", description: "75% de chance de roubar 3 Prestígios de um rival.", type: "stealPrestige", once: "game", target: true, value: 3, chance: .75 } } },
  { id: "recipe-haika-solar-elements", components: ["haika-elemental-prism", "moon-blood-vial"], tier: 2, cost: 2, result: { ...makeFusion("fusion-haika-solar-elements", "Alrakayz Solar de Haika Kimira e Luna", "✧", 7, ["Oculto", "Fé", "Desejo"], "Ciclo dos Elementos", "Recarregue um artefato utilizado neste ato.", "act", "ownRelic"), power: { name: "Ciclo dos Elementos", description: "Recarregue um artefato utilizado neste ato.", type: "recharge", once: "act", target: "ownRelic" } } },
  { id: "recipe-giovana-cortex-madness", components: ["giovana-madness-tiara", "faceless-mirror"], tier: 2, cost: 2, result: { ...makeFusion("fusion-giovana-cortex-madness", "Mente da Deusa Giovana e Sasha Cortex", "☿", 7, ["Oculto", "Desejo"], "Loucura Refletida", "Ganhe 2 Prestígios se não estiver liderando; caso contrário, ganhe 1.", "act"), power: { name: "Loucura Refletida", description: "Ganhe 2 Prestígios se não estiver liderando; caso contrário, ganhe 1.", type: "reflect", once: "act" } } },
  { id: "recipe-ana-laya-crystal-garden", components: ["ana-clara-crystal-reliquary", "crimson-perfume"], tier: 2, cost: 2, result: { ...makeFusion("fusion-ana-laya-crystal-garden", "Jardim de Cristal de Ana Clara e Laia", "✣", 6, ["Fé", "Realeza", "Desejo"], "Clareza Perfumada", "Anule a maldição da próxima relíquia amaldiçoada.", "act"), power: { name: "Clareza Perfumada", description: "Anule a maldição da próxima relíquia amaldiçoada.", type: "ward", once: "act" } } },
  { id: "recipe-fabiana-first-creation", components: ["fabiana-creator", "roman-divine-lyre", "haika-elemental-prism"], tier: 3, cost: 4, result: { ...makeFusion("fusion-fabiana-first-creation", "A Primeira Criação de FABIANA", "✹", 18, ["Realeza", "Fé", "Oculto"], "Obra Primordial", "Receba 5 moedas e 5 Prestígios, ganhe proteção contra uma maldição e uma ativação extra neste ato.", "game", undefined, { tier: 3, legendary: true }), power: { name: "Obra Primordial", description: "Receba 5 moedas e 5 Prestígios, ganhe proteção contra uma maldição e uma ativação extra neste ato.", type: "creation", once: "game" } } },
];

const COMBOS: { name: string; ids: string[]; points: number }[] = [];

const ACT_TEXTS = [
  "Roman rege a abertura enquanto Dialgo escuta os ossos, Feliciano embaralha o destino, Cajango fecha o punho e Dimas observa em silêncio.",
  "Galthak protege os convidados. Haika Kimira convoca os elementos e Giovana ri das estratégias que ainda parecem sensatas.",
  "Os Itens Proibidos foram escolhidos. Daniel Ramos encara o dragão; todos temem que FABIANA reescreva a própria noite.",
  "Soa a última badalada. As crônicas dos vinte e nove nomes agora pertencem aos Museus da corte.",
];

const EMPTY_GAME: GameState = { phase: "intro", players: [], deck: [], lotIndex: 0, act: 1, status: "announcement", auction: null, lastAward: null, log: [], scores: [], voteOutcome: null, legendVotes: {}, pendingOffer: null, rewardGranted: false };

function personalizeGame(game: GameState, userId: string): GameState {
  return { ...game, players: game.players.map((player) => ({ ...player, isHuman: player.userId === userId })) };
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

let previousRotationSignature = "";

function rotationSignature(relics: readonly Pick<Relic, "id">[]): string {
  return relics.map((relic) => relic.id).sort().join("|");
}

function createDeckDraft(): { deck: Relic[]; protectedIds: Set<string> } {
  const regularIds = new Set(RELICS.map((relic) => relic.id));
  const regularTriples = FUSION_RECIPES.filter((recipe) => recipe.tier === 3 && !recipe.result.legendary && recipe.components.every((id) => regularIds.has(id)));
  const regularDuos = FUSION_RECIPES.filter((recipe) => recipe.tier === 2 && !recipe.result.legendary && recipe.components.every((id) => regularIds.has(id)));
  const recipes = [...shuffle(regularTriples).slice(0, 1), ...shuffle(regularDuos).slice(0, 2)];
  const protectedIds = new Set(recipes.flatMap((recipe) => recipe.components));
  const guaranteed = RELICS.filter((relic) => protectedIds.has(relic.id));
  const fillers = shuffle(RELICS.filter((relic) => !protectedIds.has(relic.id))).slice(0, 12 - guaranteed.length);
  const deck = shuffle([...guaranteed, ...fillers]);
  const disposable = deck.findIndex((relic) => !protectedIds.has(relic.id));
  if (disposable >= 0 && disposable !== 6) [deck[6], deck[disposable]] = [deck[disposable], deck[6]];
  return { deck, protectedIds };
}

export function createDeck(previousRelics: readonly Pick<Relic, "id">[] = []): Relic[] {
  const avoidedSignature = previousRelics.length > 0 ? rotationSignature(previousRelics) : previousRotationSignature;
  let draft = createDeckDraft();
  for (let attempt = 0; attempt < 12 && rotationSignature(draft.deck) === avoidedSignature; attempt += 1) draft = createDeckDraft();

  if (rotationSignature(draft.deck) === avoidedSignature) {
    const previousIds = new Set(avoidedSignature.split("|"));
    const replaceIndex = draft.deck.findIndex((relic) => !draft.protectedIds.has(relic.id));
    const replacement = RELICS.find((relic) => !draft.deck.some((current) => current.id === relic.id) && !previousIds.has(relic.id))
      ?? RELICS.find((relic) => !draft.deck.some((current) => current.id === relic.id));
    if (replaceIndex >= 0 && replacement) draft.deck[replaceIndex] = replacement;
  }

  previousRotationSignature = rotationSignature(draft.deck);
  return draft.deck;
}

function createPersistentDeck(userId: string): Relic[] {
  const storageKey = `midnight-last-rotation:${userId}`;
  let previousRelics: Array<Pick<Relic, "id">> = [];
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    if (Array.isArray(stored)) previousRelics = stored.filter((id): id is string => typeof id === "string").map((id) => ({ id }));
  } catch {
    previousRelics = [];
  }
  const deck = createDeck(previousRelics);
  try {
    localStorage.setItem(storageKey, JSON.stringify(deck.map((relic) => relic.id)));
  } catch {
    // A rotação continua aleatória mesmo quando o navegador bloqueia armazenamento local.
  }
  return deck;
}

function hasSkill(player: Player, id: string): boolean { return player.skills.includes(id); }
export function artifactLimit(player: Player): number {
  const patronageBonus = hasSkill(player, "master-gallery-key") ? 2 : hasSkill(player, "third-gallery-key") ? 1 : 0;
  return 2 + patronageBonus + player.extraArtifactsAct;
}
function appendLog(game: GameState, message: string): string[] { return [message, ...game.log].slice(0, 10); }

function completedCombos(player: Player): typeof COMBOS {
  return COMBOS.filter((combo) => combo.ids.every((id) => player.inventory.some((item) => item.id === id)));
}

function relicCursePenalty(player: Player, relic: OwnedRelic): number {
  if (!relic.cursed || relic.curseSuppressed || !relic.curse) return 0;
  if (relic.id === "fallen-crown" && player.inventory.some((item) => item.id !== relic.id && item.tags.includes("Guerra"))) return 0;
  if (relic.id === "fallen-king-armor" && player.inventory.some((item) => item.id !== relic.id && item.tags.includes("Realeza"))) return 0;
  if (relic.id === "queen-mourning-veil" && player.inventory.some((item) => item.id !== relic.id && item.tags.includes("Morte"))) return 0;
  if (relic.id === "lust-sword" && player.gold >= 3) return 0;
  return relic.curse.penalty ?? 0;
}

function activeCurseCount(player: Player): number {
  return player.inventory.filter((relic) => relic.cursed && !relic.curseSuppressed).length;
}

function totalCursePenalty(player: Player): number {
  const raw = player.inventory.reduce((sum, relic) => sum + relicCursePenalty(player, relic), 0);
  return Math.max(0, raw - (hasSkill(player, "ivory-skin") ? 1 : 0));
}

function curseTalentBonus(player: Player): number {
  const count = activeCurseCount(player);
  return (hasSkill(player, "abyss-embrace") ? count : 0) + (hasSkill(player, "damned-collector") && count >= 3 ? 5 : 0);
}

function visiblePrestige(player: Player): number {
  const relics = player.inventory.reduce((sum, relic) => sum + relic.prestige + (relic.bonusPrestige ?? 0), 0);
  const combos = completedCombos(player).reduce((sum, combo) => sum + combo.points + (hasSkill(player, "crown-curator") ? 2 : 0), 0);
  const curseBonus = curseTalentBonus(player);
  const collectionBonus = hasSkill(player, "eternal-name") && player.inventory.length >= 6 ? 4 : 0;
  return Math.max(0, relics + combos + player.prestigeBonus + curseBonus + collectionBonus - totalCursePenalty(player));
}

export function intrigueProgress(player: Player, intrigueId = player.intrigueId): { current: number; target: number; complete: boolean; label: string } {
  const intrigue = INTRIGUES.find((item) => item.id === intrigueId);
  if (!intrigue) return { current: 0, target: 1, complete: false, label: "Intriga ainda não escolhida" };
  let current = 0;
  let label = "";
  if (intrigue.metric === "royalRelics") { current = player.inventory.filter((item) => item.tags.includes("Realeza")).length; label = `${current}/${intrigue.target} relíquias de Realeza`; }
  if (intrigue.metric === "sales") { current = player.relicsSold ?? 0; label = `${current}/${intrigue.target} relíquias vendidas`; }
  if (intrigue.metric === "hostileActions") { current = player.hostileActions ?? 0; label = `${current}/${intrigue.target} ataques realizados`; }
  if (intrigue.metric === "legendaryRelics") { current = player.inventory.filter((item) => item.legendary).length; label = `${current}/${intrigue.target} Itens Proibidos`; }
  if (intrigue.metric === "curses") { current = activeCurseCount(player); label = `${current}/${intrigue.target} maldições ativas`; }
  if (intrigue.metric === "lowGold") { current = player.gold <= 1 ? 1 : 0; label = `${player.gold} moeda${player.gold === 1 ? "" : "s"} restante${player.gold === 1 ? "" : "s"}`; }
  if (intrigue.metric === "collection") { current = player.inventory.length; label = `${current}/${intrigue.target} relíquias no Museu`; }
  if (intrigue.metric === "tradePartners") { current = new Set(player.tradePartners ?? []).size; label = `${current}/${intrigue.target} parceiros de negociação`; }
  return { current, target: intrigue.target, complete: current >= intrigue.target, label };
}

export function intrigueBonus(player: Player): number {
  const intrigue = INTRIGUES.find((item) => item.id === player.intrigueId);
  return intrigue && intrigueProgress(player, intrigue.id).complete ? intrigue.reward : 0;
}

export function calculateScore(player: Player): Score {
  const relics = player.inventory.reduce((sum, relic) => sum + relic.prestige, 0);
  const talents = player.prestigeBonus + player.inventory.reduce((sum, relic) => sum + (relic.bonusPrestige ?? 0), 0) + curseTalentBonus(player) + (hasSkill(player, "eternal-name") && player.inventory.length >= 6 ? 4 : 0);
  const fused = player.inventory.filter((relic) => relic.fusionTier);
  const curses = totalCursePenalty(player);
  const gold = Math.min(3, Math.floor(player.gold / 4));
  const intrigue = intrigueBonus(player);
  return { playerId: player.id, relics, talents, infusions: fused.length, gold, curses, intrigue, intrigueId: player.intrigueId, total: relics + talents + gold + intrigue - curses, fusionNames: fused.map((relic) => relic.name) };
}

function simulateRelic(player: Player, relic: Relic) {
  const base = relic.prestige;
  let talents = 0;
  if (hasSkill(player, "radiant-seal") && player.itemsWonAct === 0) talents += 1;
  if (hasSkill(player, "immortal-gallery") && (player.inventory.length + 1) % 3 === 0) talents += 2;
  const newCombos = COMBOS.filter((combo) => combo.ids.includes(relic.id) && combo.ids.filter((id) => id !== relic.id).every((id) => player.inventory.some((item) => item.id === id)));
  const combos = newCombos.reduce((sum, combo) => sum + combo.points + (hasSkill(player, "crown-curator") ? 2 : 0), 0);
  const curse = relic.cursed && player.ward === 0 ? relic.curse?.penalty ?? 0 : 0;
  return { base, talents, combos, curse, total: base + talents + combos - curse };
}

function nextTurn(auction: Auction, afterId: string): string | null {
  const start = auction.order.indexOf(afterId);
  for (let offset = 1; offset <= auction.order.length; offset += 1) {
    const candidate = auction.order[(start + offset) % auction.order.length];
    if (auction.activeIds.includes(candidate) && candidate !== auction.highBidder) return candidate;
  }
  return null;
}

function finishAward(game: GameState, auction: Auction, playersInput: Player[]): GameState {
  if (!auction.highBidder) {
    const players = playersInput.map((player) => ({ ...player, decreeStake: 0 }));
    return { ...game, players, auction: { ...auction, turnId: null }, status: "awarded", lastAward: { winnerId: null, price: 0, message: "Nenhum convidado reivindicou a relíquia." }, log: appendLog(game, `${auction.relic.name} permaneceu com o Anfitrião.`) };
  }
  const winnerId = auction.highBidder;
  const players = playersInput.map((player) => ({ ...player, inventory: player.inventory.map((item) => ({ ...item })) }));
  const winner = players.find((player) => player.id === winnerId)!;
  const price = Math.max(0, auction.currentBid - winner.bidDiscount);
  const owned: OwnedRelic = { ...auction.relic, usedAct: false, usedGame: false };
  winner.gold = Math.max(0, winner.gold - price);
  winner.bidDiscount = 0;
  if (owned.cursed && winner.ward > 0) { owned.curseSuppressed = true; winner.ward -= 1; }
  let talentBonus = 0;
  if (hasSkill(winner, "radiant-seal") && winner.itemsWonAct === 0) talentBonus += 1;
  if (hasSkill(winner, "immortal-gallery") && (winner.inventory.length + 1) % 3 === 0) talentBonus += 2;
  if (talentBonus > 0) owned.bonusPrestige = talentBonus;
  winner.itemsWonAct += 1;
  winner.inventory.push(owned);
  if (hasSkill(winner, "endless-patron")) winner.gold += 1;
  players.forEach((player) => { if (player.decreeStake > 0 && player.id !== winner.id) player.gold += 2; player.decreeStake = 0; });
  return { ...game, players, auction: { ...auction, turnId: null }, status: "awarded", lastAward: { winnerId, price, message: talentBonus > 0 ? `Os talentos acrescentaram +${talentBonus} Prestígio.` : owned.cursed && !owned.curseSuppressed ? `${owned.curse?.name ?? "A maldição"} está ativa.` : "A relíquia foi levada ao Museu." }, log: appendLog(game, `${winner.character.name} conquistou ${auction.relic.name} por ${price} moedas.`) };
}

function advanceOrResolve(game: GameState, auction: Auction, players: Player[], afterId: string): GameState {
  const following = nextTurn(auction, afterId);
  return following ? { ...game, players, auction: { ...auction, turnId: following } } : finishAward(game, auction, players);
}

function placeBid(game: GameState, playerId: string, amount: number): GameState {
  const auction = game.auction;
  if (!auction || game.status !== "bidding" || auction.turnId !== playerId) return game;
  const player = game.players.find((candidate) => candidate.id === playerId);
  if (!player || amount <= auction.currentBid || amount < auction.relic.start || amount - player.bidDiscount > player.gold) return game;
  const updated: Auction = { ...auction, currentBid: amount, highBidder: playerId, bidders: auction.bidders.includes(playerId) ? auction.bidders : [...auction.bidders, playerId] };
  const nextGame = { ...game, auction: updated, log: appendLog(game, `${player.character.name} ofereceu ${amount}.`) };
  return advanceOrResolve(nextGame, updated, game.players, playerId);
}

export function passTurn(game: GameState, playerId: string, forced = false): GameState {
  const auction = game.auction;
  if (!auction || game.status !== "bidding" || auction.turnId !== playerId) return game;
  const player = game.players.find((candidate) => candidate.id === playerId);
  if (!player) return game;
  const players = forced ? game.players.map((candidate) => candidate.id === playerId ? { ...candidate, blockedAuctions: Math.max(0, candidate.blockedAuctions - 1) } : candidate) : game.players;
  const updated: Auction = { ...auction, activeIds: auction.activeIds.filter((id) => id !== playerId) };
  const text = forced ? `${player.character.name} foi enfeitiçado e perdeu este leilão.` : `${player.character.name} abandonou o lote.`;
  return advanceOrResolve({ ...game, players, auction: updated, log: appendLog(game, text) }, updated, players, playerId);
}

export function beginAuction(game: GameState): GameState {
  if (game.status !== "announcement") return game;
  const relic = game.deck[game.lotIndex];
  if (!relic) return game;
  const blockedIds = new Set(game.players.filter((player) => player.blockedAuctions > 0).map((player) => player.id));
  const players = game.players.map((player) => blockedIds.has(player.id) ? { ...player, blockedAuctions: Math.max(0, player.blockedAuctions - 1) } : player);
  const allIds = players.map((player) => player.id);
  const rotation = allIds.length > 0 ? game.lotIndex % allIds.length : 0;
  const order = [...allIds.slice(rotation), ...allIds.slice(0, rotation)].filter((id) => !blockedIds.has(id));
  const surcharge = Math.max(0, ...players.map((player) => player.decreeStake));
  const auction: Auction = { relic, currentBid: relic.start + surcharge - 1, highBidder: null, activeIds: [...order], order, turnId: order[0] ?? null, bidders: [] };
  const blockedNames = players.filter((player) => blockedIds.has(player.id)).map((player) => player.character.name);
  const openingMessage = blockedNames.length > 0
    ? `O Anfitrião apresentou ${relic.name}. ${blockedNames.join(" e ")} ${blockedNames.length === 1 ? "foi retirado" : "foram retirados"} deste leilão.`
    : `O Anfitrião apresentou ${relic.name}.`;
  const prepared = { ...game, players, auction, status: "bidding" as const, lastAward: null, log: appendLog(game, openingMessage) };
  return order.length === 0 ? finishAward(prepared, auction, players) : prepared;
}

function actionAvailable(relic: OwnedRelic): boolean { return (relic.exhaustedLots ?? 0) === 0 && (relic.power.once === "game" ? !relic.usedGame : !relic.usedAct); }

function actionTimingAvailable(relic: OwnedRelic, status: GameStatus): boolean {
  if (relic.id === "fusion-death-refusing-king") return status === "announcement";
  if (["fusion-unpronounceable-reign", "fusion-nameless-sovereign", "fusion-first-dawn-witness"].includes(relic.id)) return status === "awarded";
  return status === "announcement" || status === "awarded";
}

function fusionConsumption(player: Player, recipe: FusionRecipe): string[] | null {
  if (recipe.components.every((id) => player.inventory.some((item) => item.id === id))) return recipe.components;
  if (recipe.upgradeFrom && recipe.upgradeWith && player.inventory.some((item) => item.id === recipe.upgradeFrom) && player.inventory.some((item) => item.id === recipe.upgradeWith)) return [recipe.upgradeFrom, recipe.upgradeWith];
  return null;
}

function availableFusionRecipes(player: Player): FusionRecipe[] {
  return FUSION_RECIPES.filter((recipe) => fusionConsumption(player, recipe));
}

function performFusion(game: GameState, actorId: string, recipeId: string): GameState {
  if (!["announcement", "awarded"].includes(game.status)) return game;
  const players = game.players.map((player) => ({ ...player, inventory: player.inventory.map((item) => ({ ...item })) }));
  const actor = players.find((player) => player.id === actorId);
  const recipe = FUSION_RECIPES.find((item) => item.id === recipeId);
  if (!actor || !recipe || actor.infusionsAct >= 1 || actor.gold < recipe.cost) return game;
  const consumed = fusionConsumption(actor, recipe);
  if (!consumed) return game;
  for (const id of consumed) {
    const index = actor.inventory.findIndex((item) => item.id === id);
    if (index < 0) return game;
    actor.inventory.splice(index, 1);
  }
  actor.gold -= recipe.cost;
  actor.infusionsAct += 1;
  const result: OwnedRelic = { ...recipe.result, usedAct: false, usedGame: false, exhaustedLots: 1, bonusPrestige: hasSkill(actor, "crown-curator") ? 2 : 0 };
  if (result.cursed && actor.ward > 0) { result.curseSuppressed = true; actor.ward -= 1; }
  actor.inventory.push(result);
  const pendingOffer = game.pendingOffer && game.pendingOffer.sellerId === actorId && consumed.includes(game.pendingOffer.relicId) ? null : game.pendingOffer;
  return { ...game, players, pendingOffer, log: appendLog(game, `${actor.character.name} infundiu ${consumed.length} peças e criou ${result.name}.`) };
}

function validTargets(players: Player[], actorId: string, relic: OwnedRelic): Player[] {
  return players.filter((player) => player.id !== actorId && (relic.power.type !== "mission" || player.inventory.length > 0));
}

export function executeRelicAction(game: GameState, actorId: string, relicId: string, targetId?: string): GameState {
  const players = game.players.map((player) => ({ ...player, inventory: player.inventory.map((item) => ({ ...item })) }));
  const actor = players.find((player) => player.id === actorId);
  if (!actor) return game;
  const relic = actor.inventory.find((item) => item.id === relicId);
  if (!relic) return game;
  const targetKind = relic.power.target === true ? "player" : relic.power.target;
  const target = targetKind === "player" && targetId ? players.find((player) => player.id === targetId) : undefined;
  const targetRelicOwner = targetKind === "rivalRelic" && targetId ? players.find((player) => player.id !== actorId && player.inventory.some((item) => item.id === targetId)) : undefined;
  const targetRelic = targetRelicOwner?.inventory.find((item) => item.id === targetId);
  const ownTargetRelic = targetKind === "ownRelic" && targetId ? actor.inventory.find((item) => item.id === targetId && item.id !== relic.id) : undefined;
  const deckTarget = targetKind === "deckRelic" && targetId ? game.deck.find((item) => item.id === targetId) : undefined;
  const targetReady = !targetKind || (targetKind === "player" && target) || (targetKind === "rivalRelic" && targetRelic) || (targetKind === "ownRelic" && ownTargetRelic) || (targetKind === "deckRelic" && deckTarget);
  if (!actionAvailable(relic) || !actionTimingAvailable(relic, game.status) || actor.artifactsUsedAct >= artifactLimit(actor) || !targetReady) return game;
  if (relic.power.type === "convert" && actor.gold < 3) return game;
  actor.artifactsUsedAct += 1;
  if (relic.power.once === "game") relic.usedGame = true; else relic.usedAct = true;
  const goldenBonus = hasSkill(actor, "golden-touch") ? 1 : 0;
  const markedChance = (hasSkill(actor, "loaded-dice") ? .15 : 0) + actor.riskBonus;
  const hostileTarget = target ?? targetRelicOwner;
  if (hostileTarget) actor.hostileActions = (actor.hostileActions ?? 0) + 1;
  if (hostileTarget && hostileTarget.shield > 0) {
    hostileTarget.shield -= 1;
    return { ...game, players, log: appendLog(game, `${hostileTarget.character.name} anulou ${relic.power.name} com uma proteção do Museu.`) };
  }
  let message = `${actor.character.name} usou ${relic.power.name}.`;
  let deck = game.deck;

  if (relic.power.type === "tax") {
    const tax = relic.power.value ?? 1;
    let collected = 0;
    players.forEach((player) => { if (player.id !== actor.id) { const paid = Math.min(tax, player.gold); player.gold -= paid; collected += paid; } });
    actor.gold += collected + (collected > 0 ? goldenBonus : 0);
    message = `${actor.character.name} recolheu ${collected} moedas da corte.`;
  } else if (relic.power.type === "discount" || relic.power.type === "grandDiscount") {
    actor.bidDiscount += relic.power.value ?? 2;
    message = `${actor.character.name} preparou um desconto de ${relic.power.value ?? 2} moedas.`;
  } else if (relic.power.type === "stealGold" && target) {
    actor.riskBonus = 0;
    if (Math.random() <= Math.min(1, (relic.power.chance ?? 1) + markedChance)) {
      const stolen = Math.min(relic.power.value ?? 2, target.gold);
      target.gold -= stolen; actor.gold += stolen;
      message = `${actor.character.name} roubou ${stolen} moedas de ${target.character.name}.`;
    } else if (relic.id === "golden-thief-glove") {
      target.prestigeBonus += 1;
      message = `A Luva Contrabandista de Duvan falhou: nenhuma moeda foi transferida e ${target.character.name} ganhou 1 Prestígio.`;
    } else {
      const fine = Math.min(2, actor.gold); actor.gold -= fine; target.gold += fine;
      message = `${actor.character.name} falhou e pagou ${fine} moedas a ${target.character.name}.`;
    }
  } else if (relic.power.type === "silence" && target) {
    target.blockedAuctions += 1;
    message = `${target.character.name} foi enfeitiçado e perderá o próximo leilão.`;
  } else if (relic.power.type === "gainGold") {
    const amount = relic.id === "crypt-key" ? 1 + Math.floor(Math.random() * (relic.power.value ?? 4)) : relic.power.value ?? 2;
    actor.gold += amount + goldenBonus;
    if (relic.id === "weeping-idol") actor.prestigeBonus -= 1;
    message = `${relic.power.name} rendeu ${amount + goldenBonus} moedas a ${actor.character.name}.`;
  } else if (relic.power.type === "convert") {
    actor.gold -= 3; actor.prestigeBonus += relic.power.value ?? 3;
    message = `${actor.character.name} converteu 3 moedas em ${relic.power.value ?? 3} Prestígio.`;
  } else if (relic.power.type === "ward") {
    actor.ward += 1; message = `${actor.character.name} está protegido da próxima maldição.`;
  } else if (relic.power.type === "reflect") {
    const leader = Math.max(...players.map(visiblePrestige));
    const amount = visiblePrestige(actor) < leader ? 2 : 1;
    actor.prestigeBonus += amount; message = `O Espelho Cortical de Sasha Cortex concedeu ${amount} Prestígio a ${actor.character.name}.`;
  } else if (relic.power.type === "stealPrestige" && target) {
    actor.riskBonus = 0;
    if (Math.random() <= Math.min(.95, (relic.power.chance ?? .55) + markedChance)) {
      const amount = relic.power.value ?? 2; target.prestigeBonus -= amount; actor.prestigeBonus += amount;
      message = `${actor.character.name} roubou ${amount} Prestígio de ${target.character.name}.`;
    } else { actor.gold = Math.max(0, actor.gold - 2); message = `${actor.character.name} foi desmascarado e pagou 2 moedas.`; }
  } else if (relic.power.type === "mission" && target) {
    actor.riskBonus = 0;
    const success = Math.random() <= Math.min(.9, (relic.power.chance ?? .5) + markedChance);
    if (success && target.inventory.length > 0) {
      const stolenIndex = Math.floor(Math.random() * target.inventory.length);
      const [stolen] = target.inventory.splice(stolenIndex, 1);
      actor.inventory.push(stolen);
      relic.curseSuppressed = true;
      message = `A Couraça Oca de Barthor roubou ${stolen.name} de ${target.character.name} e retornou ao Museu.`;
    } else {
      actor.inventory = actor.inventory.filter((item) => item.id !== relic.id);
      const fine = Math.min(3, actor.gold); actor.gold -= fine;
      message = `A missão falhou. ${actor.character.name} perdeu a Armadura e pagou ${fine} moedas de imposto.`;
    }
  } else if (relic.power.type === "giftCurse" && target) {
    actor.inventory = actor.inventory.filter((item) => item.id !== relic.id);
    target.inventory.push({ ...relic, usedGame: true });
    actor.gold += (relic.power.value ?? 3) + goldenBonus;
    message = `${actor.character.name} presenteou ${target.character.name} com a Maçã Solar de Luna.`;
  } else if (relic.power.type === "exalt") {
    const amount = Math.max(2, Math.floor(actor.inventory.length / 2)); actor.prestigeBonus += amount;
    message = `O Trono de Zat elevou ${actor.character.name} em ${amount} Prestígio.`;
  } else if (relic.power.type === "shield") {
    actor.shield += 1;
    message = `${actor.character.name} protegeu o Museu contra o próximo poder rival.`;
  } else if (relic.power.type === "royalDecree") {
    actor.decreeStake = Math.max(actor.decreeStake, 2);
    message = `O Cetro de Dimas aumentará em 2 moedas o início do próximo lote.`;
  } else if (relic.power.type === "tradeMark" && target) {
    target.tradeTributeTo = actor.id;
    message = `${target.character.name} foi marcado pela Rosa Negra de Veronica e pagará tributo na próxima negociação.`;
  } else if (relic.power.type === "siphon" && target) {
    const amount = relic.power.value ?? 1; target.prestigeBonus -= amount; actor.prestigeBonus += amount;
    message = `${actor.character.name} roubou ${amount} Prestígio de ${target.character.name}.`;
  } else if (relic.power.type === "coinFlip") {
    if (Math.random() < .5) { actor.gold += 5 + goldenBonus; message = `A aposta de Feliciano sorriu: ${actor.character.name} recebeu ${5 + goldenBonus} moedas.`; }
    else { const lost = Math.min(3, actor.gold); actor.gold -= lost; message = `A loucura de Giovana traiu ${actor.character.name}, que perdeu ${lost} moedas.`; }
  } else if (relic.power.type === "judgment" && target) {
    if (target.gold >= 4) { const stolen = Math.min(2, target.gold); target.gold -= stolen; actor.gold += stolen; message = `${target.character.name} pagou ${stolen} moedas ao veredito de Dimas.`; }
    else { target.prestigeBonus -= 1; actor.prestigeBonus += 1; message = `O veredito de Dimas tomou 1 Prestígio de ${target.character.name}.`; }
  } else if (relic.power.type === "oracle" && deckTarget) {
    const index = deck.findIndex((item) => item.id === deckTarget.id);
    const destination = Math.min(game.lotIndex + 1, deck.length - 1);
    if (index > destination) { deck = [...deck]; const [chosen] = deck.splice(index, 1); deck.splice(destination, 0, chosen); }
    message = `${actor.character.name} escolheu ${deckTarget.name} para ser o próximo lote.`;
  } else if (relic.power.type === "riskBoost") {
    actor.riskBonus = Math.max(actor.riskBonus, (relic.power.value ?? 25) / 100);
    message = `O Estandarte de Cajango aumentou em ${relic.power.value ?? 25}% o próximo ritual arriscado.`;
  } else if (relic.power.type === "recharge" && ownTargetRelic) {
    ownTargetRelic.usedAct = false;
    message = `${actor.character.name} recarregou ${ownTargetRelic.name}.`;
  } else if (relic.power.type === "purify" && ownTargetRelic) {
    ownTargetRelic.curseSuppressed = true;
    message = `${actor.character.name} purificou ${ownTargetRelic.name}.`;
  } else if (relic.power.type === "tradeBoost") {
    actor.tradeCharm += 4; actor.salePrestigeBoost += 2;
    message = `${actor.character.name} preparou uma cláusula para a próxima negociação.`;
  } else if (relic.power.type === "creation") {
    actor.gold += 5;
    actor.prestigeBonus += 5;
    actor.ward += 1;
    actor.extraArtifactsAct += 1;
    message = `${actor.character.name} reescreveu a Criação de FABIANA: +5 moedas, +5 Prestígios, uma proteção e uma ativação extra.`;
  } else if (relic.power.type === "fusion") {
    const usurpLastAward = (extra: number, title: string): GameState | null => {
      if (game.status !== "awarded" || !game.lastAward?.winnerId || game.lastAward.winnerId === actor.id) return null;
      const winner = players.find((player) => player.id === game.lastAward?.winnerId);
      const awarded = winner?.inventory.find((item) => item.id === deck[game.lotIndex].id);
      const price = game.lastAward.price + extra;
      if (!winner || !awarded || actor.gold < price) return null;
      winner.inventory = winner.inventory.filter((item) => item !== awarded);
      winner.itemsWonAct = Math.max(0, winner.itemsWonAct - 1);
      winner.gold += game.lastAward.price + extra;
      actor.gold -= price;
      actor.itemsWonAct += 1;
      actor.inventory.push(awarded);
      const message = `${title}: ${actor.character.name} tomou ${awarded.name} de ${winner.character.name} por ${price} moedas.`;
      return { ...game, players, deck, lastAward: { winnerId: actor.id, price, message }, log: appendLog(game, message) };
    };
    if (relic.id === "fusion-buried-monarch") {
      let collected = 0; players.forEach((player) => { if (player.id !== actor.id) { const paid = Math.min(1, player.gold); player.gold -= paid; collected += paid; } }); actor.gold += collected; actor.shield += 1;
      message = `O Monarca recolheu ${collected} moedas e protegeu o Museu.`;
    } else if (relic.id === "fusion-usurper-regalia") { actor.bidDiscount += 3; actor.prestigeBonus += 1; message = `A Regalia preparou 3 moedas de desconto e 1 Prestígio.`;
    } else if (relic.id === "fusion-crimson-obsession" && target) {
      actor.riskBonus = 0;
      if (Math.random() <= Math.min(.95, .7 + markedChance)) { const stolen = Math.min(4, target.gold); target.gold -= stolen; actor.gold += stolen; target.blockedAuctions += 1; message = `A Obsessão roubou ${stolen} moedas e expulsou ${target.character.name} do próximo leilão.`; }
      else { const fine = Math.min(3, actor.gold); actor.gold -= fine; target.gold += fine; target.prestigeBonus += 1; message = `O duelo falhou: ${actor.character.name} pagou ${fine} moedas e concedeu 1 Prestígio.`; }
    } else if (relic.id === "fusion-seventh-bride" && target) { const amount = target.inventory.some((item) => item.tags.includes("Morte")) ? 3 : 2; target.prestigeBonus -= amount; actor.prestigeBonus += amount; message = `A Noiva roubou ${amount} Prestígios de ${target.character.name}.`;
    } else if (relic.id === "fusion-profane-communion" && ownTargetRelic) { if (actor.gold < 3) return game; actor.gold -= 3; actor.prestigeBonus += 3; ownTargetRelic.curseSuppressed = true; message = `A Comunhão converteu 3 moedas em 3 Prestígios e purificou ${ownTargetRelic.name}.`;
    } else if (relic.id === "fusion-nonexistent-face" && targetRelic && targetRelicOwner) { targetRelicOwner.prestigeBonus -= 1; actor.prestigeBonus += 1; targetRelic.exhaustedLots = Math.max(targetRelic.exhaustedLots ?? 0, 1); message = `${actor.character.name} roubou 1 Prestígio de ${targetRelicOwner.character.name} e silenciou ${targetRelic.name} até o próximo lote.`;
    } else if (relic.id === "fusion-sepulchral-paladin" && targetRelic && targetRelicOwner) {
      actor.riskBonus = 0;
      if (Math.random() <= Math.min(.95, .7 + markedChance)) { targetRelicOwner.inventory = targetRelicOwner.inventory.filter((item) => item.id !== targetRelic.id); actor.inventory.push(targetRelic); message = `O Paladino de Bélico e Barthor roubou ${targetRelic.name}.`; }
      else { const fine = Math.min(3, actor.gold); actor.gold -= fine; actor.prestigeBonus -= 3; message = `A Cruzada falhou: ${actor.character.name} perdeu ${fine} moedas e 3 Prestígios.`; }
    } else if (relic.id === "fusion-crypt-judgment" && target) { if (target.gold >= 4) { target.gold -= 2; actor.gold += 2; message = `A Cripta de José e Dimas tomou 2 moedas de ${target.character.name}.`; } else { target.prestigeBonus -= 1; actor.prestigeBonus += 1; message = `A Cripta de José e Dimas tomou 1 Prestígio de ${target.character.name}.`; }
    } else if (relic.id === "fusion-seven-finger-hand" && target) {
      actor.riskBonus = 0;
      if (Math.random() <= Math.min(.95, .75 + markedChance)) { const stolen = Math.min(3, target.gold); target.gold -= stolen; actor.gold += stolen; relic.awakenings = (relic.awakenings ?? 0) + 1; if (relic.awakenings === 2) relic.bonusPrestige = (relic.bonusPrestige ?? 0) + 2; message = `A Mão de Duvan roubou ${stolen} moedas${relic.awakenings === 2 ? " e despertou +2 Prestígios" : ""}.`; } else message = `A Mão dos Sete Acordos de Duvan falhou.`;
    } else if (relic.id === "fusion-weeping-treasure") { let collected = 0; let unpaid = 0; players.forEach((player) => { if (player.id !== actor.id) { if (player.gold > 0) { player.gold -= 1; collected += 1; } else { unpaid += 1; } } }); actor.gold += collected; actor.prestigeBonus += unpaid; message = `O Tesouro recebeu ${collected} moedas e ${unpaid} Prestígios.`;
    } else if (relic.id === "fusion-discord-garden" && target) { if (target.discordPenalty > 0) target.prestigeBonus += target.discordPenalty; target.prestigeBonus -= 3; target.discordPenalty = 3; target.discordPatron = actor.id; message = `${target.character.name} recebeu a Rosa: −3 Prestígios até vender uma relíquia.`;
    } else if (relic.id === "fusion-two-faced-pact" && target) { if (actor.gold < 3) return game; actor.gold -= 3; if (Math.random() < .5) { actor.gold += 6; message = `${actor.character.name} venceu o Pacto e recebeu 6 moedas.`; } else { target.gold += 3; message = `${target.character.name} recebeu as 3 moedas apostadas.`; } actor.tradeCharm += 2;
    } else if (relic.id === "fusion-draconic-banner") { let collected = 0; let unpaid = 0; players.forEach((player) => { if (player.id !== actor.id) { const paid = Math.min(2, player.gold); player.gold -= paid; collected += paid; unpaid += 2 - paid; } }); actor.gold += collected; actor.prestigeBonus += unpaid; message = `A Marcha recolheu ${collected} moedas e converteu ${unpaid} não pagas em Prestígio.`;
    } else if (relic.id === "fusion-unpronounceable-reign") { const usurped = usurpLastAward(1, "Direito Divino"); if (!usurped) return game; return usurped;
    } else if (relic.id === "fusion-first-dawn-eye" && deckTarget) { const index = deck.findIndex((item) => item.id === deckTarget.id); const destination = Math.min(game.lotIndex + 1, deck.length - 1); if (index > destination) { deck = [...deck]; const [chosen] = deck.splice(index, 1); deck.splice(destination, 0, chosen); } actor.extraArtifactsAct += 1; message = `${deckTarget.name} será o próximo lote e ${actor.character.name} ganhou uma ativação extra.`;
    } else if (relic.id === "fusion-red-moon-baptism" && ownTargetRelic) { ownTargetRelic.curseSuppressed = true; ownTargetRelic.usedAct = false; actor.extraArtifactsAct += 1; message = `${ownTargetRelic.name} foi purificada e recarregada; ${actor.character.name} ganhou uma ativação extra.`;
    } else if (relic.id === "fusion-death-refusing-king") { const lot = deck[game.lotIndex]; const price = lot.start + 3; if (actor.gold < price) return game; players.forEach((player) => { if (player.id !== actor.id) player.gold += 2; }); actor.shield = Math.max(actor.shield, 99); const order = players.map((player) => player.id); const forcedAuction: Auction = { relic: lot, currentBid: price + actor.bidDiscount, highBidder: actor.id, activeIds: order, order, turnId: null, bidders: [actor.id] }; const awarded = finishAward({ ...game, players, deck }, forcedAuction, players); return { ...awarded, log: appendLog(awarded, `${actor.character.name} pronunciou o Último Decreto e tomou ${lot.name}.`) };
    } else if (relic.id === "fusion-armed-lust-garden" && target) { const stolen = Math.ceil(target.gold / 2); target.gold -= stolen; actor.gold += stolen; target.blockedAuctions += 1; target.prestigeBonus += 2; message = `O Jardim roubou ${stolen} moedas e expulsou ${target.character.name}, que recebeu 2 Prestígios.`;
    } else if (relic.id === "fusion-hollow-saints-procession" && targetRelic && targetRelicOwner) { actor.riskBonus = 0; if (Math.random() <= Math.min(.97, .85 + markedChance)) { targetRelicOwner.inventory = targetRelicOwner.inventory.filter((item) => item.id !== targetRelic.id); actor.inventory.push(targetRelic); actor.prestigeBonus += 2; message = `A Procissão roubou ${targetRelic.name} e ganhou 2 Prestígios.`; } else { actor.prestigeBonus -= 4; message = `A Procissão falhou e perdeu 4 Prestígios.`; }
    } else if (relic.id === "fusion-last-heretic-mass") { let purged = 0; actor.inventory.forEach((item) => { if (item.cursed && !item.curseSuppressed) { item.curseSuppressed = true; purged += 1; } }); actor.prestigeBonus += purged; players.forEach((player) => { if (player.id !== actor.id && activeCurseCount(player) > 0) player.prestigeBonus -= 1; }); message = `A Missa purificou ${purged} maldições e puniu os Museus condenados.`;
    } else if (relic.id === "fusion-infernal-weeping-treasure") { let coins = 0; let prestige = 0; players.forEach((player) => { if (player.id !== actor.id) { if (player.gold >= 2) { player.gold -= 2; coins += 2; } else { player.prestigeBonus -= 1; prestige += 1; } } }); actor.gold += coins; actor.prestigeBonus += prestige; message = `A Auditoria recebeu ${coins} moedas e ${prestige} Prestígios.`;
    } else if (relic.id === "fusion-face-beyond-veil" && targetRelic && targetRelicOwner) { targetRelicOwner.prestigeBonus -= 2; actor.prestigeBonus += 2; targetRelic.exhaustedLots = Math.max(targetRelic.exhaustedLots ?? 0, 3); message = `${actor.character.name} roubou 2 Prestígios de ${targetRelicOwner.character.name} e silenciou ${targetRelic.name} por três lotes.`;
    } else if (relic.id === "fusion-seventh-funeral-queen" && target) { const amount = target.inventory.some((item) => item.tags.includes("Morte")) ? 3 : 2; const stolen = Math.min(amount, target.gold); target.gold -= stolen; actor.gold += stolen; target.prestigeBonus -= amount; actor.prestigeBonus += amount; message = `A Rainha roubou ${stolen} moedas e ${amount} Prestígios de ${target.character.name}.`;
    } else if (relic.id === "fusion-seven-oaths-syndicate" && targetRelic && targetRelicOwner) { const price = targetRelic.prestige; if (actor.gold >= price) { actor.gold -= price; targetRelicOwner.gold += price; targetRelicOwner.prestigeBonus += salePrestige(targetRelic, targetRelicOwner); targetRelicOwner.inventory = targetRelicOwner.inventory.filter((item) => item.id !== targetRelic.id); actor.inventory.push(targetRelic); message = `O Sindicato tomou ${targetRelic.name} por ${price} moedas.`; } else { const stolen = Math.min(2, targetRelicOwner.gold); targetRelicOwner.gold -= stolen; actor.gold += stolen; message = `Sem ouro para o contrato, o Sindicato roubou ${stolen} moedas.`; }
    } else if (relic.id === "fusion-nameless-sovereign") { const usurped = usurpLastAward(2, "Usurpação do Martelo"); if (!usurped) return game; return usurped;
    } else if (relic.id === "fusion-scarlet-war-god") { let broken = 0; players.forEach((player) => { if (player.id !== actor.id) { const paid = Math.min(3, player.gold); player.gold -= paid; actor.gold += paid; if (paid < 3) { player.prestigeBonus -= 2; actor.prestigeBonus += 2; broken += 1; } } }); relic.bonusPrestige = (relic.bonusPrestige ?? 0) - 3; message = `O Apocalipse devastou a corte e quebrou ${broken} rivais sem ouro.`;
    } else if (relic.id === "fusion-first-dawn-witness" && game.status === "awarded" && game.lastAward?.winnerId) { const winner = players.find((player) => player.id === game.lastAward?.winnerId); const awarded = winner?.inventory.find((item) => item.id === game.deck[game.lotIndex].id); if (winner && awarded) { winner.inventory = winner.inventory.filter((item) => item !== awarded); winner.gold += game.lastAward.price; winner.itemsWonAct = Math.max(0, winner.itemsWonAct - 1); actor.bidDiscount += 2; message = `A Testemunha desfez a conquista de ${awarded.name}; o leilão será reaberto.`; return { ...game, players, deck, status: "announcement", auction: null, lastAward: null, log: appendLog(game, message) }; } }
  }
  const pendingOffer = game.pendingOffer && players.find((player) => player.id === game.pendingOffer?.sellerId)?.inventory.some((item) => item.id === game.pendingOffer?.relicId) ? game.pendingOffer : null;
  return { ...game, players, deck, pendingOffer, log: appendLog(game, message) };
}

export function executeTalentAction(game: GameState, actorId: string, talentId: string, targetId?: string): GameState {
  const players = game.players.map((player) => ({ ...player, inventory: player.inventory.map((item) => ({ ...item })) }));
  const actor = players.find((player) => player.id === actorId);
  const talent = TALENTS.find((item) => item.id === talentId);
  if (!actor || !talent?.activeType || !actor.skills.includes(talentId)) return game;
  const onceGame = talent.activeType === "prioritySeal";
  if (actor.activeTalentsUsed.includes(talentId) || actor.activeTalentsUsedGame.includes(talentId)) return game;
  let deck = game.deck;
  let message = `${actor.character.name} usou ${talent.name}.`;

  if (talent.activeType === "blackVault") {
    if (visiblePrestige(actor) < 1) return game;
    actor.prestigeBonus -= 1; actor.gold += 5;
    message = `${actor.character.name} trocou 1 Prestígio por 5 moedas no Cofre Negro.`;
  } else if (talent.activeType === "prioritySeal") {
    actor.bidDiscount += 3;
    message = `${actor.character.name} selou um favor de 3 moedas para o próximo lote conquistado.`;
  } else if (talent.activeType === "exhibit") {
    if (actor.gold < 2) return game;
    actor.gold -= 2; actor.prestigeBonus += 1;
    message = `${actor.character.name} pagou 2 moedas e ganhou 1 Prestígio com a Exposição Triunfal.`;
  } else if (talent.activeType === "bribe") {
    const target = players.find((player) => player.id === targetId && player.id !== actor.id);
    if (!target || actor.gold < 3) return game;
    actor.gold -= 3; target.blockedAuctions += 1; actor.hostileActions = (actor.hostileActions ?? 0) + 1;
    message = `${actor.character.name} subornou a corte contra ${target.character.name}.`;
  } else if (talent.activeType === "purify") {
    const relic = actor.inventory.find((item) => item.id === targetId && item.cursed && !item.curseSuppressed);
    if (!relic || actor.gold < 3) return game;
    actor.gold -= 3; relic.curseSuppressed = true;
    message = `${actor.character.name} purificou ${relic.name} por 3 moedas.`;
  }

  if (onceGame) actor.activeTalentsUsedGame.push(talentId); else actor.activeTalentsUsed.push(talentId);
  return { ...game, players, deck, log: appendLog(game, message) };
}

function askingPrice(relic: OwnedRelic, buyer: Player): number {
  return Math.max(2, relic.prestige * 3 + (relic.legendary ? 4 : 1) - Math.min(2, buyer.tradeCharm));
}

function salePrestige(relic: OwnedRelic, seller: Player): number {
  return Math.max(1, relic.prestige - 1) + (hasSkill(seller, "shadow-merchant") ? 1 : 0) + seller.salePrestigeBoost;
}

function tradeLimit(player: Player): number {
  return hasSkill(player, "smuggler") ? 2 : 1;
}

function tradeResponderId(offer: TradeOffer): string {
  if (offer.responderId) return offer.responderId;
  return offer.message.toLocaleLowerCase("pt-BR").includes("contraproposta") ? offer.buyerId : offer.sellerId;
}

function tradeProposerId(offer: TradeOffer): string {
  if (offer.proposerId) return offer.proposerId;
  return tradeResponderId(offer) === offer.buyerId ? offer.sellerId : offer.buyerId;
}

export function proposeTrade(game: GameState, proposerId: string, buyerId: string, sellerId: string, relicId: string, amount: number, kind: "buy-request" | "sale-offer"): GameState {
  if (game.pendingOffer || !["announcement", "awarded"].includes(game.status)) return game;
  const buyer = game.players.find((player) => player.id === buyerId);
  const seller = game.players.find((player) => player.id === sellerId);
  const relic = seller?.inventory.find((item) => item.id === relicId);
  const expectedProposer = kind === "buy-request" ? buyerId : sellerId;
  const normalizedAmount = Math.floor(amount);
  if (!buyer || !seller || !relic || buyer.id === seller.id || proposerId !== expectedProposer || normalizedAmount < 1 || normalizedAmount > buyer.gold || buyer.tradesAct >= tradeLimit(buyer)) return game;
  const responderId = proposerId === buyerId ? sellerId : buyerId;
  const message = kind === "buy-request"
    ? `${buyer.character.name} oferece ${normalizedAmount} moedas por ${relic.name}.`
    : `${seller.character.name} oferece ${relic.name} por ${normalizedAmount} moedas.`;
  const pendingOffer: TradeOffer = { buyerId, sellerId, relicId, amount: normalizedAmount, kind, proposerId, responderId, status: "offer", message };
  return { ...game, pendingOffer, log: appendLog(game, `${game.players.find((player) => player.id === proposerId)?.character.name ?? "Um convidado"} abriu uma negociação com ${game.players.find((player) => player.id === responderId)?.character.name ?? "a corte"}.`) };
}

export function counterTradeOffer(game: GameState, actorId: string, amount: number): GameState {
  const offer = game.pendingOffer;
  if (!offer || tradeResponderId(offer) !== actorId) return game;
  const buyer = game.players.find((player) => player.id === offer.buyerId);
  const seller = game.players.find((player) => player.id === offer.sellerId);
  const relic = seller?.inventory.find((item) => item.id === offer.relicId);
  const normalizedAmount = Math.floor(amount);
  if (!buyer || !seller || !relic || normalizedAmount < 1 || normalizedAmount > buyer.gold || buyer.tradesAct >= tradeLimit(buyer)) return game;
  const nextResponder = tradeProposerId(offer);
  const actor = game.players.find((player) => player.id === actorId)!;
  return { ...game, pendingOffer: { ...offer, amount: normalizedAmount, proposerId: actorId, responderId: nextResponder, status: "counter", message: `${actor.character.name} contrapropôs ${normalizedAmount} moedas por ${relic.name}.` }, log: appendLog(game, `${actor.character.name} devolveu uma contraproposta.`) };
}

export function acceptTradeOffer(game: GameState, actorId: string): GameState {
  const offer = game.pendingOffer;
  if (!offer || tradeResponderId(offer) !== actorId) return game;
  return completeTrade(game, offer.buyerId, offer.sellerId, offer.relicId, offer.amount);
}

export function cancelTradeOffer(game: GameState, actorId: string): GameState {
  const offer = game.pendingOffer;
  if (!offer || ![tradeProposerId(offer), tradeResponderId(offer)].includes(actorId)) return game;
  const actor = game.players.find((player) => player.id === actorId);
  const withdrew = tradeProposerId(offer) === actorId;
  return { ...game, pendingOffer: null, log: appendLog(game, `${actor?.character.name ?? "Um convidado"} ${withdrew ? "retirou" : "recusou"} a proposta de negociação.`) };
}

export function completeTrade(game: GameState, buyerId: string, sellerId: string, relicId: string, amount: number): GameState {
  const players = game.players.map((player) => ({ ...player, inventory: player.inventory.map((item) => ({ ...item })), tradePartners: [...(player.tradePartners ?? [])] }));
  const buyer = players.find((player) => player.id === buyerId);
  const seller = players.find((player) => player.id === sellerId);
  const relic = seller?.inventory.find((item) => item.id === relicId);
  if (!buyer || !seller || !relic || amount < 1 || buyer.gold < amount || buyer.tradesAct >= tradeLimit(buyer)) return game;
  buyer.gold -= amount; seller.gold += amount;
  const rebate = Math.min(amount, buyer.tradeCharm + (hasSkill(buyer, "silver-tongue") ? 1 : 0));
  buyer.gold += rebate;
  const prestige = salePrestige(relic, seller);
  seller.prestigeBonus += prestige;
  seller.salePrestigeBoost = 0;
  buyer.tradeCharm = 0;
  seller.inventory = seller.inventory.filter((item) => item.id !== relicId);
  buyer.inventory.push(relic);
  buyer.tradesAct += 1;
  seller.relicsSold = (seller.relicsSold ?? 0) + 1;
  if (!buyer.tradePartners.includes(seller.id)) buyer.tradePartners.push(seller.id);
  if (!seller.tradePartners.includes(buyer.id)) seller.tradePartners.push(buyer.id);
  const marked = [buyer, seller].find((player) => player.tradeTributeTo);
  if (marked?.tradeTributeTo) {
    const patron = players.find((player) => player.id === marked.tradeTributeTo);
    if (patron) { const tribute = Math.min(2, marked.gold); marked.gold -= tribute; patron.gold += tribute; }
    marked.tradeTributeTo = null;
  }
  if (seller.discordPatron && seller.discordPenalty > 0) {
    const patron = players.find((player) => player.id === seller.discordPatron);
    seller.prestigeBonus += seller.discordPenalty;
    if (patron) patron.gold += 2;
    seller.discordPatron = null;
    seller.discordPenalty = 0;
  }
  return { ...game, players, pendingOffer: null, log: appendLog(game, `${buyer.username} comprou ${relic.name} de ${seller.username} por ${amount} moedas${rebate > 0 ? ` e recuperou ${rebate} da corte` : ""}. ${seller.username} ganhou ${prestige} Prestígio pela venda.`) };
}

export function distributeIncome(game: GameState, nextIndex: number): GameState {
  const poorest = Math.min(...game.players.map((player) => player.gold));
  const players = game.players.map((player) => {
    const curseTax = player.inventory.reduce((sum, item) => sum + (!item.curseSuppressed ? item.curse?.incomePenalty ?? 0 : 0), 0);
    const income = Math.max(0, 5 + (hasSkill(player, "court-tithe") ? 2 : 0) + (player.gold === poorest ? 2 : 0) - curseTax);
    return { ...player, gold: player.gold + income, itemsWonAct: 0, tradesAct: 0, artifactsUsedAct: 0, activeTalentsUsed: [], shield: 0, riskBonus: 0, extraArtifactsAct: 0, infusionsAct: 0, decreeStake: 0, inventory: player.inventory.map((item) => ({ ...item, usedAct: false, exhaustedLots: 0 })) };
  });
  return { ...game, players, lotIndex: nextIndex, act: game.act + 1, status: "actBreak", auction: null, lastAward: null, log: appendLog(game, "A corte distribuiu a renda do novo ato. Os mais pobres receberam a Esmola do Anfitrião.") };
}

export default function Home() {
  const [game, setGame] = useState<GameState>(EMPTY_GAME);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [lobbyRooms, setLobbyRooms] = useState<LobbyRoom[]>([]);
  const [onlineRoom, setOnlineRoom] = useState<OnlineRoom | null>(null);
  const [connectionState, setConnectionState] = useState<"connecting" | "online" | "offline">("connecting");
  const [onlineMessage, setOnlineMessage] = useState("");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [musicVolume, setMusicVolume] = useState(22);
  const [detailRelicId, setDetailRelicId] = useState<string | null>(null);
  const [actionRelicId, setActionRelicId] = useState<string | null>(null);
  const [fusionOpen, setFusionOpen] = useState(false);
  const [rivalId, setRivalId] = useState<string | null>(null);
  const [negotiation, setNegotiation] = useState<NegotiationDraft | null>(null);
  const [activeTalentId, setActiveTalentId] = useState<string | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const soundPreferencesReady = useRef(false);
  const socketRef = useRef<WebSocket | null>(null);
  const gameRef = useRef<GameState>(EMPTY_GAME);
  const roomVersionRef = useRef(0);

  const sendSocket = (message: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) {
      setOnlineMessage("Reconectando ao salão…");
      return false;
    }
    socket.send(JSON.stringify(message));
    return true;
  };

  useEffect(() => {
    fetch("/api/account").then(async (response) => {
      if (response.ok) setProfile((await response.json() as { account: Profile }).account);
    }).finally(() => setAuthReady(true));
  }, []);

  useEffect(() => { gameRef.current = game; }, [game]);

  useEffect(() => {
    if (!profile?.id) return;
    let disposed = false;
    let reconnectTimer = 0;

    const connect = () => {
      if (disposed) return;
      setConnectionState("connecting");
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
      socketRef.current = socket;
      socket.onopen = () => {
        setConnectionState("online");
        setOnlineMessage("");
        socket.send(JSON.stringify({ type: "lobby:refresh" }));
      };
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data) as { type: string; [key: string]: unknown };
        if (message.type === "hello" || message.type === "profile:update") {
          if (message.profile) setProfile(message.profile as Profile);
          if (message.message) setOnlineMessage(String(message.message));
          return;
        }
        if (message.type === "lobby") {
          setLobbyRooms((message.rooms ?? []) as LobbyRoom[]);
          return;
        }
        if (message.type === "room:snapshot" || message.type === "game:conflict") {
          const room = message.room as OnlineRoom;
          setOnlineRoom(room);
          roomVersionRef.current = room.version;
          if (room.gameState && (room.status === "playing" || room.status === "finished")) {
            const personalized = personalizeGame(room.gameState, profile.id);
            gameRef.current = personalized;
            setGame(personalized);
          } else if (room.status === "waiting") {
            setGame((current) => ({ ...current, phase: "room" }));
          }
          if (message.type === "game:conflict") setOnlineMessage("Outra ação chegou primeiro. O salão foi sincronizado.");
          return;
        }
        if (message.type === "room:left") {
          setOnlineRoom(null);
          setGame((current) => ({ ...EMPTY_GAME, phase: "lobby" }));
          return;
        }
        if (message.type === "room:cancelled") {
          setOnlineRoom(null);
          setCancelConfirmOpen(false);
          gameRef.current = EMPTY_GAME;
          setGame(EMPTY_GAME);
          setOnlineMessage(String(message.message ?? "A partida foi cancelada."));
          return;
        }
        if (message.type === "error") setOnlineMessage(String(message.message ?? "O Anfitrião recusou a ação."));
      };
      socket.onclose = () => {
        if (socketRef.current === socket) socketRef.current = null;
        if (disposed) return;
        setConnectionState("offline");
        reconnectTimer = window.setTimeout(connect, 1400);
      };
    };

    connect();
    return () => {
      disposed = true;
      window.clearTimeout(reconnectTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [profile?.id]);

  useEffect(() => {
    const storedVolume = Number(window.localStorage.getItem("leilao-music-volume"));
    const storedMuted = window.localStorage.getItem("leilao-music-muted");
    if (Number.isFinite(storedVolume) && storedVolume >= 0 && storedVolume <= 100) setMusicVolume(storedVolume);
    if (storedMuted !== null) setSoundOn(storedMuted !== "true");
    soundPreferencesReady.current = true;
  }, []);

  useEffect(() => {
    const soundtrack = new Audio("/audio/apparitions-ball.mp3");
    soundtrack.loop = true;
    soundtrack.preload = "auto";
    soundtrack.volume = musicVolume / 100;
    musicRef.current = soundtrack;

    const beginSoundtrack = () => {
      if (!soundtrack.muted) void soundtrack.play().catch(() => undefined);
    };

    window.addEventListener("pointerdown", beginSoundtrack, { once: true });
    window.addEventListener("keydown", beginSoundtrack, { once: true });
    return () => {
      window.removeEventListener("pointerdown", beginSoundtrack);
      window.removeEventListener("keydown", beginSoundtrack);
      soundtrack.pause();
      musicRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (musicRef.current) {
      musicRef.current.muted = !soundOn;
      musicRef.current.volume = musicVolume / 100;
    }
    if (soundPreferencesReady.current) {
      window.localStorage.setItem("leilao-music-volume", String(musicVolume));
      window.localStorage.setItem("leilao-music-muted", String(!soundOn));
    }
  }, [soundOn, musicVolume]);

  const persistProfile = (next: Profile) => {
    setProfile(next);
    void fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }).then(async (response) => {
      if (response.ok) setProfile((await response.json() as { account: Profile }).account);
    });
  };

  const logout = async () => {
    if (onlineRoom?.status === "waiting") sendSocket({ type: "room:leave" });
    await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    socketRef.current?.close();
    setProfile(null);
    setOnlineRoom(null);
    setLobbyRooms([]);
    setGame(EMPTY_GAME);
  };

  const commitGame = (updater: GameState | ((current: GameState) => GameState)) => {
    const next = typeof updater === "function" ? updater(gameRef.current) : updater;
    gameRef.current = next;
    setGame(next);
    if (onlineRoom) sendSocket({ type: "game:update", expectedVersion: roomVersionRef.current, gameState: next });
    return next;
  };

  useEffect(() => {
    const turnId = game.auction?.turnId;
    if (!turnId || game.status !== "bidding" || !profile || onlineRoom?.hostUserId !== profile.id) return;
    const blockedTurn = game.players.find((player) => player.id === turnId && player.blockedAuctions > 0);
    if (!blockedTurn) return;
    const timer = window.setTimeout(() => {
      commitGame((current) => {
        const currentTurnId = current.auction?.turnId;
        const currentBlocked = current.players.find((player) => player.id === currentTurnId && player.blockedAuctions > 0);
        return current.status === "bidding" && currentTurnId && currentBlocked ? passTurn(current, currentTurnId, true) : current;
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [game.status, game.auction?.turnId, game.players, onlineRoom?.hostUserId, profile?.id]);

  const playTone = (kind: "click" | "bid" | "win") => {
    if (!soundOn || typeof window === "undefined") return;
    const context = audioRef.current ?? new AudioContext(); audioRef.current = context;
    const oscillator = context.createOscillator(); const gain = context.createGain();
    oscillator.type = kind === "win" ? "triangle" : "sine"; oscillator.frequency.value = kind === "bid" ? 280 : kind === "win" ? 520 : 190;
    gain.gain.setValueAtTime(.04, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + (kind === "win" ? .34 : .12));
    oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + (kind === "win" ? .34 : .12));
  };

  const toggleSound = () => {
    const next = !soundOn;
    const nextVolume = next && musicVolume === 0 ? 22 : musicVolume;
    if (nextVolume !== musicVolume) setMusicVolume(nextVolume);
    setSoundOn(next);
    const soundtrack = musicRef.current;
    if (soundtrack) {
      soundtrack.volume = nextVolume / 100;
      soundtrack.muted = !next;
      if (next) void soundtrack.play().catch(() => undefined);
    }
  };

  const changeMusicVolume = (value: number) => {
    const next = Math.max(0, Math.min(100, value));
    const enabled = next > 0;
    setMusicVolume(next);
    setSoundOn(enabled);
    const soundtrack = musicRef.current;
    if (soundtrack) {
      soundtrack.volume = next / 100;
      soundtrack.muted = !enabled;
      if (enabled) void soundtrack.play().catch(() => undefined);
    }
  };

  const toggleTalent = (talent: Talent) => {
    if (!profile || profile.unlockedTalents.includes(talent.id)) return;
    const firstTalent = profile.unlockedTalents.length === 0;
    if (firstTalent && !ROOT_TALENTS.includes(talent.id)) return;
    const parentReady = !talent.parent || profile.unlockedTalents.includes(talent.parent);
    const cost = firstTalent ? 0 : talent.cost;
    if (!parentReady || profile.lumens < cost) return;
    persistProfile({ ...profile, lumens: profile.lumens - cost, unlockedTalents: [...profile.unlockedTalents, talent.id] });
    playTone("win");
  };

  const startOnlineGame = () => {
    if (!profile || !onlineRoom || onlineRoom.hostUserId !== profile.id) return;
    const players = onlineRoom.members.map((member, index): Player => {
      const character = playerIdentity(member.userId, member.username, index);
      const skills = member.skills;
      return { id: member.userId, userId: member.userId, username: member.username, character, isHuman: member.userId === profile.id, skills, gold: 15 + (skills.includes("patron-purse") ? 3 : 0), inventory: [], prestigeBonus: 0, ward: skills.includes("salt-seal") ? 1 : 0, itemsWonAct: 0, tradesAct: 0, bidDiscount: 0, blockedAuctions: 0, artifactsUsedAct: 0, activeTalentsUsed: [], activeTalentsUsedGame: [], shield: 0, tradeCharm: 0, salePrestigeBoost: 0, riskBonus: 0, extraArtifactsAct: 0, infusionsAct: 0, tradeTributeTo: null, decreeStake: 0, discordPatron: null, discordPenalty: 0, intrigueOptions: shuffle(INTRIGUES).slice(0, 3).map((intrigue) => intrigue.id), intrigueId: null, intrigueChosen: false, relicsSold: 0, hostileActions: 0, tradePartners: [] };
    });
    const initialGame: GameState = { ...EMPTY_GAME, phase: "playing", players, deck: createPersistentDeck(profile.id), status: "intrigue", log: ["Uma nova rotação sorteou 12 relíquias entre as 42 peças da Crônica. FABIANA observa enquanto as Intrigas Secretas são entregues."] };
    sendSocket({ type: "room:start", gameState: initialGame });
    playTone("click");
  };

  const chooseIntrigue = (intrigueId: string) => {
    commitGame((current) => {
      const players = current.players.map((player) => player.isHuman && !player.intrigueChosen && player.intrigueOptions.includes(intrigueId) ? { ...player, intrigueId, intrigueChosen: true } : player);
      return { ...current, players, log: appendLog(current, "Uma intriga foi selada sob uma máscara.") };
    });
    playTone("win");
  };

  const openAuction = () => {
    commitGame((current) => beginAuction(current));
    playTone("click");
  };

  const continueGame = () => {
    if (game.lotIndex === game.deck.length - 1) {
      commitGame({ ...game, status: "intrigueReveal", auction: null, lastAward: null, log: appendLog(game, "As máscaras caíram. A corte revelará suas Intrigas Secretas.") });
      playTone("click");
      return;
    }
    commitGame((current) => {
      const nextIndex = current.lotIndex + 1;
      if (nextIndex === 6) return { ...current, status: "legendVote", auction: null, lastAward: null };
      if (nextIndex % 3 === 0) return distributeIncome(current, nextIndex);
      const players = current.players.map((player) => ({ ...player, inventory: player.inventory.map((item) => ({ ...item, exhaustedLots: Math.max(0, (item.exhaustedLots ?? 0) - 1) })) }));
      return { ...current, players, lotIndex: nextIndex, status: "announcement", auction: null, lastAward: null };
    });
    playTone("click");
  };

  const finalizeGame = () => {
    const scores = game.players.map(calculateScore).sort((a, b) => b.total - a.total || b.relics - a.relics);
    commitGame({ ...game, phase: "results", scores, rewardGranted: true });
    playTone("win");
  };

  const castLegendVote = (humanVote: string) => {
    commitGame((current) => {
      const human = current.players.find((player) => player.isHuman);
      if (!human || current.legendVotes[human.id]) return current;
      const legendVotes = { ...current.legendVotes, [human.id]: humanVote };
      if (Object.keys(legendVotes).length < current.players.length) return { ...current, legendVotes, log: appendLog(current, `${human.character.name} depositou seu voto na urna proibida.`) };
      const counts: Record<string, number> = Object.fromEntries(LEGENDARY_RELICS.map((relic) => [relic.id, 0]));
      Object.entries(legendVotes).forEach(([playerId, relicId]) => {
        counts[relicId] += 1;
        const voter = current.players.find((player) => player.id === playerId);
        if (voter && hasSkill(voter, "forbidden-oracle")) counts[relicId] += 1;
      });
      const highest = Math.max(...Object.values(counts));
      const tied = Object.keys(counts).filter((id) => counts[id] === highest);
      const winnerId = tied[Math.floor(Math.random() * tied.length)];
      const winner = LEGENDARY_RELICS.find((relic) => relic.id === winnerId)!;
      return { ...current, legendVotes, status: "voteResult", voteOutcome: { winnerId, counts }, log: appendLog(current, `${winner.name} venceu a votação dos Itens Proibidos.`) };
    });
    playTone("win");
  };

  const confirmLegend = () => {
    commitGame((current) => {
      if (!current.voteOutcome) return current;
      const winner = LEGENDARY_RELICS.find((relic) => relic.id === current.voteOutcome?.winnerId)!;
      const deck = [...current.deck]; deck[6] = winner;
      return distributeIncome({ ...current, deck }, 6);
    });
    playTone("click");
  };

  const openBuyRequest = (sellerId: string, relicId: string) => {
    const buyer = game.players.find((player) => player.isHuman);
    const seller = game.players.find((player) => player.id === sellerId);
    const relic = seller?.inventory.find((item) => item.id === relicId);
    if (!buyer || !relic) return;
    setNegotiation({ buyerId: buyer.id, sellerId, relicId, amount: Math.min(buyer.gold, askingPrice(relic, buyer)), kind: "buy-request", message: "Diga quanto você oferece para levar esta relíquia." });
    setRivalId(null);
  };

  const openSaleOffer = (buyerId: string, relicId: string) => {
    const seller = game.players.find((player) => player.isHuman);
    const buyer = game.players.find((player) => player.id === buyerId);
    const relic = seller?.inventory.find((item) => item.id === relicId);
    if (!seller || !buyer || !relic) return;
    setNegotiation({ buyerId, sellerId: seller.id, relicId, amount: Math.min(buyer.gold, askingPrice(relic, buyer)), kind: "sale-offer", message: "Defina o preço que você deseja receber por esta relíquia." });
    setRivalId(null);
  };

  const submitTradeProposal = (amount: number) => {
    if (!negotiation) return;
    const proposer = game.players.find((player) => player.isHuman);
    const buyer = game.players.find((player) => player.id === negotiation.buyerId);
    const seller = game.players.find((player) => player.id === negotiation.sellerId);
    const relic = seller?.inventory.find((item) => item.id === negotiation.relicId);
    if (!proposer || !buyer || !seller || !relic || amount > buyer.gold || amount < 1) return;
    commitGame((current) => proposeTrade(current, proposer.id, buyer.id, seller.id, relic.id, amount, negotiation.kind));
    setNegotiation(null);
    playTone("click");
  };

  const acceptPendingTrade = () => {
    const actor = game.players.find((player) => player.isHuman);
    if (!actor) return;
    commitGame((current) => acceptTradeOffer(current, actor.id));
    playTone("win");
  };

  const counterPendingTrade = (amount: number) => {
    const actor = game.players.find((player) => player.isHuman);
    if (!actor) return;
    commitGame((current) => counterTradeOffer(current, actor.id, amount));
    playTone("click");
  };

  const cancelPendingTrade = () => {
    const actor = game.players.find((player) => player.isHuman);
    if (!actor) return;
    commitGame((current) => cancelTradeOffer(current, actor.id));
  };

  const enterLobby = () => {
    setOnlineMessage("");
    setGame((current) => ({ ...current, phase: "lobby" }));
    sendSocket({ type: "lobby:refresh" });
  };

  const leaveRoom = () => sendSocket({ type: "room:leave" });
  const returnFromResults = () => sendSocket({ type: "room:return-to-lobby" });
  const cancelMatch = () => {
    if (!profile || onlineRoom?.hostUserId !== profile.id) return;
    sendSocket({ type: "room:cancel" });
  };
  const isRoomHost = Boolean(profile && onlineRoom?.hostUserId === profile.id);

  const human = game.players.find((player) => player.isHuman);
  const currentRelic = game.deck[game.lotIndex];
  const auction = game.auction;
  const turnPlayer = game.players.find((player) => player.id === auction?.turnId);
  const minimumBid = auction ? Math.max(auction.relic.start, auction.currentBid + 1) : 0;
  const humanCanBid = Boolean(human && auction && game.status === "bidding" && auction.turnId === human.id && human.blockedAuctions === 0 && minimumBid - human.bidDiscount <= human.gold);
  const simulation = human && currentRelic ? simulateRelic(human, currentRelic) : null;
  const actionRelic = human?.inventory.find((item) => item.id === actionRelicId);
  const detailRelic = human?.inventory.find((item) => item.id === detailRelicId);
  const rival = game.players.find((player) => player.id === rivalId);
  const activeTalent = TALENTS.find((talent) => talent.id === activeTalentId);
  const negotiationBuyer = game.players.find((player) => player.id === negotiation?.buyerId);
  const negotiationSeller = game.players.find((player) => player.id === negotiation?.sellerId);
  const negotiationRelic = negotiationSeller?.inventory.find((item) => item.id === negotiation?.relicId);
  const pendingBuyer = game.players.find((player) => player.id === game.pendingOffer?.buyerId);
  const pendingSeller = game.players.find((player) => player.id === game.pendingOffer?.sellerId);
  const pendingRelic = pendingSeller?.inventory.find((item) => item.id === game.pendingOffer?.relicId);
  const pendingForHuman = Boolean(game.pendingOffer && human?.id === tradeResponderId(game.pendingOffer));
  const waitingOnHuman = Boolean(game.pendingOffer && human?.id === tradeProposerId(game.pendingOffer));
  const fusionRecipes = human ? availableFusionRecipes(human) : [];

  if (!authReady) return <main className="auth-screen"><div className="auth-loading"><span>♛</span><p>Abrindo o registro do baile…</p></div></main>;

  if (!profile) return <AuthScreen onAuthenticated={(account) => { setProfile(account); setGame(EMPTY_GAME); }} />;

  if (game.phase === "intro") return <Intro profile={profile} onEnter={() => setGame((current) => ({ ...current, phase: profile.unlockedTalents.length === 0 ? "talents" : "lobby" }))} onLibrary={() => setGame((current) => ({ ...current, phase: "library" }))} onTalents={() => setGame((current) => ({ ...current, phase: "talents" }))} onRules={() => setRulesOpen(true)} onLogout={logout} rulesOpen={rulesOpen} closeRules={() => setRulesOpen(false)} />;

  if (game.phase === "library") return <LibraryScreen onBack={() => setGame((current) => ({ ...current, phase: "intro" }))} />;

  if (game.phase === "lobby") return <LobbyScreen profile={profile} rooms={lobbyRooms} connectionState={connectionState} message={onlineMessage} onBack={() => setGame((current) => ({ ...current, phase: "intro" }))} onTalents={() => setGame((current) => ({ ...current, phase: "talents" }))} onCreate={(name, maxPlayers) => { setOnlineMessage(""); sendSocket({ type: "room:create", name, maxPlayers }); }} onJoin={(roomId) => { setOnlineMessage(""); sendSocket({ type: "room:join", roomId }); }} onJoinCode={(code) => { setOnlineMessage(""); sendSocket({ type: "room:join", code }); }} />;

  if (game.phase === "room" && onlineRoom) return <WaitingRoom room={onlineRoom} profile={profile} connectionState={connectionState} message={onlineMessage} onLeave={leaveRoom} onReady={(ready) => sendSocket({ type: "room:ready", ready })} onStart={startOnlineGame} />;

  if (game.phase === "talents") return (
    <main className="talent-screen">
      <SimpleHeader onBack={() => setGame((current) => ({ ...current, phase: "intro" }))} right={<span className="lumen-pill bright">✦ {profile.lumens} Lúmens</span>} />
      <section className="talent-content"><div className="talent-heading"><div><p className="eyebrow">Árvore do Patronato</p><h1>Construa seu leiloeiro</h1><p>Todo talento comprado fica ativo para sempre. Alguns liberam ações que você usa durante o baile.</p></div><div className="loadout-counter"><strong>{profile.unlockedTalents.length}</strong><span>talentos dominados</span></div></div>
        <div className="talent-tree">{(["Fortuna", "Visão", "Glória", "Intriga", "Maldição"] as Branch[]).map((branch) => <section className={`talent-branch branch-${branch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`} key={branch}><header><span>{branch === "Fortuna" ? "●" : branch === "Visão" ? "◈" : branch === "Glória" ? "♛" : branch === "Intriga" ? "❦" : "☠"}</span><h2>{branch}</h2></header><div className="branch-line" />{TALENTS.filter((talent) => talent.branch === branch).map((talent) => { const owned = profile.unlockedTalents.includes(talent.id); const parentReady = !talent.parent || profile.unlockedTalents.includes(talent.parent); const firstFree = profile.unlockedTalents.length === 0 && ROOT_TALENTS.includes(talent.id); const cost = firstFree ? 0 : talent.cost; const purchasable = firstFree || (parentReady && profile.lumens >= cost); return <button className={`talent-node tier-${talent.tier} ${owned ? "owned" : purchasable ? "available" : "locked"} ${talent.activeType ? "active-talent" : ""}`} key={talent.id} onClick={() => toggleTalent(talent)} disabled={owned || (!firstFree && (!parentReady || profile.lumens < cost))}><span className="talent-icon">{talent.icon}</span><span className="talent-info"><strong>{talent.name}{talent.activeType ? " · ATIVA" : ""}</strong><small>{talent.description}</small></span><span className="talent-cost">{owned ? "Dominado" : firstFree ? "Primeiro talento · grátis" : parentReady ? `${cost} ✦` : "Exige o anterior"}</span></button>; })}</section>)}</div>
        <div className="talent-footer"><div><strong>Lúmens</strong><span>Você começa com um talento grátis. Cada vitória rende 3 Lúmens para expandir esta build permanente.</span></div><button className="primary-button" disabled={profile.unlockedTalents.length === 0} onClick={enterLobby}>Ver salas online</button></div>
      </section>
    </main>
  );

  if (game.phase === "results") {
    const ranking = game.scores.map((score) => ({ score, player: game.players.find((player) => player.id === score.playerId)! }));
    const humanWon = ranking[0]?.player.isHuman;
    return <main className="results-screen"><section className="results-content"><p className="eyebrow">A última badalada soou</p><h1>{humanWon ? "Você governa o baile" : `${ranking[0].player.character.name} governa o baile`}</h1><p className="selection-copy">{humanWon ? "Sua vitória rendeu 3 Lúmens." : "A corte guardou os Lúmens para o verdadeiro Soberano."}</p><div className="reward-banner"><span>✦</span><strong>{humanWon ? "+3 Lúmens" : "Nenhum Lúmen conquistado"}</strong><small>Saldo atual: {profile.lumens}</small></div><div className="podium">{ranking.map(({ score, player }, index) => { const intrigue = INTRIGUES.find((item) => item.id === score.intrigueId); return <article className={`result-card place-${index + 1}`} key={player.id}><div className="place-number">{index + 1}º</div><div className="result-sigil">{player.character.sigil}</div><h2>{player.character.name}</h2><p>{player.skills.map((id) => TALENTS.find((talent) => talent.id === id)?.name).join(" · ")}</p><strong>{score.total} Prestígio</strong>{intrigue && <div className={`result-intrigue ${score.intrigue > 0 ? "complete" : "failed"}`}><span>{intrigue.icon}</span><div><small>Intriga {score.intrigue > 0 ? "cumprida" : "fracassada"}</small><b>{intrigue.name} · {score.intrigue > 0 ? `+${score.intrigue} ✦` : "+0 ✦"}</b></div></div>}<div className="score-breakdown"><span>Relíquias <b>{score.relics}</b></span><span>Talentos e efeitos <b>{score.talents}</b></span><span>Infusões no Museu <b>{score.infusions}</b></span><span>Intriga secreta <b>+{score.intrigue}</b></span><span>Ouro <b>{score.gold}</b></span><span>Maldições <b>−{score.curses}</b></span></div>{score.fusionNames.length > 0 && <p className="combo-list">{score.fusionNames.join(" • ")}</p>}<div className="result-inventory">{player.inventory.map((item, i) => <span title={item.name} key={`${item.id}-${i}`}>{item.icon}</span>)}</div></article>; })}</div><div className="results-actions"><button className="primary-button" onClick={returnFromResults}>Voltar às salas</button></div></section></main>;
  }

  const canManageMuseum = game.status === "announcement" || game.status === "awarded";
  return (
    <main className="game-screen">
      <header className="game-header"><div><span className="mini-brand">Leilão da Meia-Noite</span><span className="act-label">Sala {onlineRoom?.code} · Ato {game.act} · Lote {(game.lotIndex % 3) + 1} de 3</span></div><div className="header-progress">{[1,2,3,4].map((act) => <span className={act <= game.act ? "filled" : ""} key={act} />)}</div><div className="header-actions"><span className={`live-dot ${connectionState}`}>{connectionState === "online" ? "Ao vivo" : "Reconectando"}</span><div className={`soundtrack-control ${soundOn ? "playing" : "muted"}`}><button className="soundtrack-button" onClick={toggleSound} aria-label={soundOn ? "Mutar trilha sonora" : "Desmutar trilha sonora"} title={soundOn ? "Mutar Apparitions Ball" : "Desmutar trilha sonora"}><span>{soundOn ? "♪" : "×"}</span><small>{soundOn ? "Trilha" : "Mudo"}</small></button><label className="volume-slider"><input type="range" min="0" max="100" step="1" value={soundOn ? musicVolume : 0} onChange={(event) => changeMusicVolume(Number(event.target.value))} aria-label="Volume da trilha sonora" /><output>{soundOn ? musicVolume : 0}%</output></label></div><button className="text-button" onClick={() => setRulesOpen(true)}>Regras</button>{isRoomHost && <button className="cancel-match-button" onClick={() => setCancelConfirmOpen(true)}>Cancelar partida</button>}</div></header>
      <section className="players-rail">{game.players.map((player) => <PlayerSeat key={player.id} player={player} isTurn={auction?.turnId === player.id} isLeader={auction?.highBidder === player.id} onClick={() => !player.isHuman && setRivalId(player.id)} />)}</section>

      <section className="auction-table redesigned">
        <MuseumPanel player={human!} fusionCount={fusionRecipes.length} enabled={canManageMuseum} onInspect={(relic) => setDetailRelicId(relic.id)} onOpenFusion={() => setFusionOpen(true)} />

        <section className="relic-stage new-stage" aria-live="polite">
          {game.status === "intrigue" && <IntrigueSelection player={human!} players={game.players} onChoose={chooseIntrigue} />}
          {game.status === "legendVote" && <LegendVote onVote={castLegendVote} voted={Boolean(human && game.legendVotes[human.id])} votes={Object.keys(game.legendVotes).length} total={game.players.length} />}
          {game.status === "voteResult" && game.voteOutcome && <VoteResult outcome={game.voteOutcome} onConfirm={confirmLegend} canConfirm={isRoomHost} />}
          {game.status === "actBreak" && <div className="act-interlude"><span className="interlude-number">Ato {game.act}</span><h2>{game.act === 4 ? "A Última Badalada" : game.act === 3 ? "A Galeria Proibida" : "O Salão dos Sussurros"}</h2><p>{ACT_TEXTS[game.act - 1]}</p><div className="income-note">Renda distribuída. Talentos de Fortuna e a Esmola do Anfitrião já foram aplicados.</div><button className="primary-button" disabled={!isRoomHost} onClick={() => commitGame((current) => ({ ...current, status: "announcement" }))}>{isRoomHost ? "Prosseguir" : "Aguardando o anfitrião"}</button></div>}
          {game.status === "intrigueReveal" && <IntrigueReveal players={game.players} canConfirm={isRoomHost && game.players.every((player) => Boolean(player.intrigueId))} onConfirm={finalizeGame} />}
          {!(["intrigue", "legendVote", "voteResult", "actBreak", "intrigueReveal"] as GameStatus[]).includes(game.status) && currentRelic && <><div className={`relic-frame ${currentRelic.art ? "has-art" : ""} ${currentRelic.cursed ? "cursed" : ""} ${currentRelic.legendary ? "legendary" : ""}`}><RelicArtwork relic={currentRelic} variant="auction" /><span className="relic-number">{currentRelic.legendary ? "ITEM PROIBIDO" : `LOTE ${String(game.lotIndex + 1).padStart(2, "0")}`}</span></div><p className="relic-epithet">{currentRelic.epithet}</p><h2 className="relic-name">{currentRelic.name}</h2><div className="tag-row">{currentRelic.tags.map((tag) => <span key={tag}>{tag}</span>)}{currentRelic.cursed && <span className="curse-tag">Amaldiçoada</span>}{currentRelic.legendary && <span className="legend-tag">Lendária</span>}</div><p className="relic-lore">“{currentRelic.lore}”</p><div className="relic-stats"><div><small>Prestígio</small><strong>{currentRelic.prestige}</strong></div><div><small>Lance inicial</small><strong>{currentRelic.start}</strong></div></div>{currentRelic.curse && <div className="auction-curse-preview"><span>☠ {currentRelic.curse.name}</span><p>{currentRelic.curse.description}</p><small>{currentRelic.curse.penalty ? `Penalidade máxima: −${currentRelic.curse.penalty} Prestígio · valor mínimo ${Math.max(0, currentRelic.prestige - currentRelic.curse.penalty)}` : currentRelic.curse.incomePenalty ? `Custo econômico: −${currentRelic.curse.incomePenalty} moedas de renda por ato` : "A maldição pode ser anulada por talentos ou efeitos."}</small></div>}<div className="effect-box active-preview"><span>{currentRelic.power.name}</span><p>{currentRelic.power.description}</p><small>Uso: uma vez por {currentRelic.power.once === "act" ? "ato" : "partida"}</small></div><AuctionControls game={game} human={human!} minimumBid={minimumBid} canBid={humanCanBid} canControl={isRoomHost} turnPlayer={turnPlayer} openAuction={openAuction} bid={(amount) => { commitGame((current) => placeBid(current, human!.id, amount)); playTone("bid"); }} pass={() => commitGame((current) => passTurn(current, human!.id))} next={continueGame} /></>}
        </section>

        <Dossier player={human!} relic={currentRelic} simulation={simulation} game={game} enabled={canManageMuseum} onUseTalent={(talent) => { if (talent.activeType === "bribe" || talent.activeType === "purify") setActiveTalentId(talent.id); else { commitGame((current) => executeTalentAction(current, human!.id, talent.id)); playTone("win"); } }} />
      </section>

      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
      {cancelConfirmOpen && <CancelGameModal onClose={() => setCancelConfirmOpen(false)} onConfirm={cancelMatch} />}
      {detailRelic && <RelicDetailModal relic={detailRelic} player={human!} status={game.status} enabled={canManageMuseum} onClose={() => setDetailRelicId(null)} onUse={() => { setDetailRelicId(null); if (detailRelic.power.target) setActionRelicId(detailRelic.id); else { commitGame((current) => executeRelicAction(current, human!.id, detailRelic.id)); playTone("win"); } }} />}
      {actionRelic && <ActionTargetModal relic={actionRelic} actor={human!} game={game} onClose={() => setActionRelicId(null)} onTarget={(targetId) => { commitGame((current) => executeRelicAction(current, human!.id, actionRelic.id, targetId)); setActionRelicId(null); playTone("win"); }} />}
      {fusionOpen && <FusionModal player={human!} recipes={fusionRecipes} enabled={canManageMuseum} onClose={() => setFusionOpen(false)} onFuse={(recipeId) => { commitGame((current) => performFusion(current, human!.id, recipeId)); setFusionOpen(false); playTone("win"); }} />}
      {activeTalent && <TalentActionModal talent={activeTalent} player={human!} players={game.players} onClose={() => setActiveTalentId(null)} onTarget={(targetId) => { commitGame((current) => executeTalentAction(current, human!.id, activeTalent.id, targetId)); setActiveTalentId(null); playTone("win"); }} />}
      {rival && <RivalModal rival={rival} player={human!} enabled={canManageMuseum && !game.pendingOffer} busy={Boolean(game.pendingOffer)} onClose={() => setRivalId(null)} onRequest={(relicId) => openBuyRequest(rival.id, relicId)} onOffer={(relicId) => openSaleOffer(rival.id, relicId)} />}
      {negotiation && negotiationBuyer && negotiationSeller && negotiationRelic && <NegotiationModal key={`${negotiation.kind}-${negotiation.sellerId}-${negotiation.relicId}-${negotiation.amount}`} offer={negotiation} buyer={negotiationBuyer} seller={negotiationSeller} relic={negotiationRelic} onClose={() => setNegotiation(null)} onSubmit={submitTradeProposal} />}
      {pendingForHuman && game.pendingOffer && pendingBuyer && pendingSeller && pendingRelic && <TradeResponseModal key={`${game.pendingOffer.proposerId}-${game.pendingOffer.responderId}-${game.pendingOffer.amount}`} offer={game.pendingOffer} buyer={pendingBuyer} seller={pendingSeller} relic={pendingRelic} humanId={human!.id} onAccept={acceptPendingTrade} onCounter={counterPendingTrade} onDecline={cancelPendingTrade} />}
      {waitingOnHuman && game.pendingOffer && pendingBuyer && pendingSeller && pendingRelic && <TradeWaitingToast offer={game.pendingOffer} buyer={pendingBuyer} seller={pendingSeller} relic={pendingRelic} onWithdraw={cancelPendingTrade} />}
    </main>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (profile: Profile) => void; }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: mode, username, password }) });
      const data = await response.json() as { account?: Profile; error?: string };
      if (!response.ok || !data.account) { setError(data.error ?? "O escrivão recusou o registro."); return; }
      onAuthenticated(data.account);
    } catch { setError("Não foi possível falar com o escrivão do baile."); }
    finally { setBusy(false); }
  };

  return <main className="auth-screen"><div className="ambient-glow" /><section className="auth-card"><div className="auth-sigil">♛</div><p className="eyebrow">Registro do baile online</p><h1>Leilão da Meia-Noite</h1><p className="auth-copy">Seu nome de jogador, seus Lúmens e sua árvore ficam guardados para jogar de qualquer computador.</p><div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Entrar</button><button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Cadastrar</button></div><form onSubmit={submit}><label>Nome do jogador<input autoComplete="username" minLength={3} maxLength={20} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Como seus amigos verão você" required /></label><label>Senha<input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={4} maxLength={80} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua palavra secreta" required /></label>{error && <p className="auth-error">{error}</p>}<button className="primary-button full" disabled={busy}>{busy ? "Selando…" : mode === "login" ? "Entrar no registro" : "Criar minha conta"}</button></form><small className="local-note">Este nome será sua identidade nas salas e partidas.</small></section></main>;
}

function Intro({ profile, onEnter, onLibrary, onTalents, onRules, onLogout, rulesOpen, closeRules }: { profile: Profile; onEnter: () => void; onLibrary: () => void; onTalents: () => void; onRules: () => void; onLogout: () => void; rulesOpen: boolean; closeRules: () => void; }) {
  const playLabel = profile.unlockedTalents.length > 0 ? "Entrar no salão online" : "Escolher primeiro talento";
  return <main className="opening-screen"><div className="ambient-glow" /><button className="account-logout" onClick={onLogout}>Sair de {profile.username}</button><section className="main-menu-shell"><div className="menu-hero"><span className="menu-crest">♛</span><p className="eyebrow">O Baile das Máscaras Online apresenta</p><h1>Leilão da<br />Meia-Noite</h1><div className="gold-rule"><span>✦</span></div><p className="opening-copy">Relíquias, acordos e traições para três ou quatro convidados. O ouro conquista as peças; o Prestígio conquista a noite.</p><div className="menu-census"><span><b>{RELICS.length}</b> relíquias</span><span><b>{FUSION_RECIPES.length}</b> infusões</span><span><b>{LEGENDARY_RELICS.length}</b> proibidos</span><span><b>{INTRIGUES.length}</b> intrigas</span></div></div><div className="menu-panel"><header><div><p className="panel-kicker">Convite nominal</p><h2>Boa noite, {profile.username}</h2></div><span className="menu-lumens">✦ {profile.lumens}</span></header><div className="menu-character"><span>{profile.username.slice(0, 1).toLocaleUpperCase("pt-BR")}</span><div><small>Sua identidade de jogador</small><strong>{profile.username}</strong><p>Os talentos definem seu estilo; os nomes da lore vivem nas relíquias.</p></div></div><button className="menu-play" onClick={onEnter}><span>♜</span><div><small>Multiplayer · 3 ou 4 pessoas</small><strong>{playLabel}</strong></div><b>→</b></button><nav className="menu-nav-grid" aria-label="Menu principal"><button onClick={onLibrary}><span>▤</span><strong>Biblioteca</strong><small>Itens, combos e intrigas</small></button><button onClick={onTalents}><span>✦</span><strong>Patronato</strong><small>{profile.unlockedTalents.length} talentos dominados</small></button><button onClick={onRules}><span>?</span><strong>Como jogar</strong><small>Regras do baile</small></button><button onClick={onEnter}><span>♟</span><strong>Salas online</strong><small>Criar ou entrar numa mesa</small></button></nav><footer><span>{profile.wins} vitória{profile.wins === 1 ? "" : "s"}</span><span>✦ {profile.lumens} Lúmens disponíveis</span></footer></div></section>{rulesOpen && <RulesModal onClose={closeRules} />}</main>;
}

function LibraryScreen({ onBack }: { onBack: () => void; }) {
  const [section, setSection] = useState<"relics" | "fusions" | "forbidden" | "intrigues">("relics");
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const catalogue = [...RELICS, ...LEGENDARY_RELICS, ...FUSION_RECIPES.map((recipe) => recipe.result)];
  const catalogueItem = (id: string) => catalogue.find((item) => item.id === id);
  const matchesRelic = (relic: Relic) => !query || [relic.name, relic.epithet, relic.power.name, relic.power.description, relic.lore, ...relic.tags].join(" ").toLocaleLowerCase("pt-BR").includes(query);
  const regular = RELICS.filter(matchesRelic);
  const forbidden = LEGENDARY_RELICS.filter(matchesRelic);
  const intrigues = INTRIGUES.filter((intrigue) => !query || [intrigue.name, intrigue.description].join(" ").toLocaleLowerCase("pt-BR").includes(query));
  const fusions = FUSION_RECIPES.filter((recipe) => {
    const componentNames = recipe.components.map((id) => catalogueItem(id)?.name ?? id);
    return !query || [recipe.result.name, recipe.result.power.name, recipe.result.power.description, ...componentNames, ...recipe.result.tags].join(" ").toLocaleLowerCase("pt-BR").includes(query);
  });
  const resultCount = section === "relics" ? regular.length : section === "fusions" ? fusions.length : section === "forbidden" ? forbidden.length : intrigues.length;
  return <main className="library-screen"><SimpleHeader onBack={onBack} right={<span className="library-total">{RELICS.length + LEGENDARY_RELICS.length} peças · {FUSION_RECIPES.length} receitas · {INTRIGUES.length} intrigas</span>} /><section className="library-shell"><header className="library-heading"><div><p className="eyebrow">Acervo da corte</p><h1>Biblioteca da Meia-Noite</h1><p>Consulte todas as peças antes de entrar numa sala. Descubra poderes, maldições, receitas de infusão, Itens Proibidos e as possíveis Intrigas Secretas.</p></div><div className="library-seal"><span>▤</span><small>Catálogo<br />completo</small></div></header><div className="library-toolbar"><nav className="library-tabs"><button className={section === "relics" ? "active" : ""} onClick={() => setSection("relics")}><strong>Relíquias</strong><span>{RELICS.length}</span></button><button className={section === "fusions" ? "active" : ""} onClick={() => setSection("fusions")}><strong>Infusões</strong><span>{FUSION_RECIPES.length}</span></button><button className={section === "forbidden" ? "active" : ""} onClick={() => setSection("forbidden")}><strong>Itens Proibidos</strong><span>{LEGENDARY_RELICS.length}</span></button><button className={section === "intrigues" ? "active" : ""} onClick={() => setSection("intrigues")}><strong>Intrigas</strong><span>{INTRIGUES.length}</span></button></nav><label className="library-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome, poder ou objetivo…" /></label></div><div className="library-results-note"><span>{resultCount} registro{resultCount === 1 ? " encontrado" : "s encontrados"}</span><small>{section === "relics" ? "12 destas peças são sorteadas em uma nova rotação a cada partida" : section === "fusions" ? "Combinações irreversíveis realizadas no Museu" : section === "forbidden" ? "Candidatos que a corte escolhe durante a partida" : "Possíveis objetivos; cada jogador recebe três opções aleatórias"}</small></div><div className={`library-grid section-${section}`}>{section === "relics" && regular.map((relic) => <RelicLibraryCard relic={relic} key={relic.id} />)}{section === "forbidden" && forbidden.map((relic) => <RelicLibraryCard relic={relic} forbidden key={relic.id} />)}{section === "intrigues" && intrigues.map((intrigue) => <article className="library-card intrigue-library-card" key={intrigue.id}><header><span className="library-icon">{intrigue.icon}</span><div><small>Possível objetivo secreto</small><h2>{intrigue.name}</h2><p>Escolhida antes do primeiro lote</p></div><b>+{intrigue.reward} ✦</b></header><div className="library-power"><small>Condição da intriga</small><p>{intrigue.description}</p></div><footer><span>Revelada no final</span><span>Escolha definitiva</span></footer></article>)}{section === "fusions" && fusions.map((recipe) => <article className={`library-card fusion-library-card tier-${recipe.tier}`} key={recipe.id}><header><span className="library-icon">{recipe.result.icon}</span><div><small>Infusão {recipe.tier === 3 ? "tripla" : "dupla"} · custo {recipe.cost} ●</small><h2>{recipe.result.name}</h2><p>{recipe.result.epithet}</p></div><b>✦ {recipe.result.prestige}</b></header><div className="library-components">{recipe.components.map((id, index) => { const component = catalogueItem(id); return <span key={`${recipe.id}-${id}`}><i>{component?.icon ?? "◇"}</i><strong>{component?.name ?? id}</strong>{index < recipe.components.length - 1 && <b>+</b>}</span>; })}</div><div className="library-power"><small>{recipe.result.power.name} · uma vez por {recipe.result.power.once === "act" ? "ato" : "partida"}</small><p>{recipe.result.power.description}</p></div>{recipe.result.curse && <div className="library-curse">☠ <strong>{recipe.result.curse.name}</strong> · {recipe.result.curse.description}</div>}<footer>{recipe.result.tags.map((tag) => <span key={tag}>{tag}</span>)}</footer></article>)}</div>{resultCount === 0 && <div className="library-empty"><span>◇</span><strong>Nenhum registro encontrado</strong><p>Tente outro nome, poder ou categoria.</p></div>}</section></main>;
}

function RelicLibraryCard({ relic, forbidden = false }: { relic: Relic; forbidden?: boolean }) {
  const signatures = loreSignatures(relic);
  return <article className={`library-card relic-library-card ${relic.cursed ? "cursed" : ""} ${forbidden ? "forbidden" : ""} ${relic.id === "fabiana-creator" ? "creator" : ""}`}>
    <div className="library-relic-layout">
      <RelicArtwork relic={relic} variant="library" />
      <div className="library-relic-content">
        <header><div><small>{forbidden ? "ITEM PROIBIDO · candidato à votação" : relic.epithet}</small><h2>{relic.name}</h2><p>{forbidden ? relic.epithet : `“${relic.lore}”`}</p></div><b>✦ {relic.prestige}</b></header>
        {signatures.length > 0 && <div className="lore-signature"><span>✦</span><small>Assinatura da Crônica</small><strong>{signatures.join(" · ")}</strong></div>}
        <div className="library-statline"><span>Lance inicial <b>{relic.start} ●</b></span><span>Uso <b>1× por {relic.power.once === "act" ? "ato" : "partida"}</b></span></div>
        <div className="library-power"><small>{relic.power.name}</small><p>{relic.power.description}</p></div>
        {relic.curse && <div className="library-curse">☠ <strong>{relic.curse.name}</strong> · {relic.curse.description}</div>}
        <footer>{relic.tags.map((tag) => <span key={tag}>{tag}</span>)}{relic.cursed && <span className="danger">Amaldiçoada</span>}{relic.id === "fabiana-creator" && <span className="creator-tag">Ultra poderoso</span>}</footer>
      </div>
    </div>
  </article>;
}

function LobbyScreen({ profile, rooms, connectionState, message, onBack, onTalents, onCreate, onJoin, onJoinCode }: { profile: Profile; rooms: LobbyRoom[]; connectionState: "connecting" | "online" | "offline"; message: string; onBack: () => void; onTalents: () => void; onCreate: (name: string, maxPlayers: 3 | 4) => void; onJoin: (roomId: string) => void; onJoinCode: (code: string) => void; }) {
  const [name, setName] = useState(`Mesa de ${profile.username}`);
  const [maxPlayers, setMaxPlayers] = useState<3 | 4>(4);
  const [code, setCode] = useState("");
  const waiting = rooms.filter((room) => room.status === "waiting");
  const playing = rooms.filter((room) => room.status === "playing");
  return <main className="lobby-screen"><SimpleHeader onBack={onBack} right={<span className={`connection-pill ${connectionState}`}>{connectionState === "online" ? "● Salão online" : "○ Reconectando"}</span>} /><section className="lobby-shell"><header className="lobby-heading"><div><p className="eyebrow">Galeria pública</p><h1>Salas do baile</h1><p>Entre em uma mesa aberta ou convoque seus próprios convidados. A partida começa quando todos os lugares estiverem ocupados e prontos.</p></div><button className="text-button" onClick={onTalents}>Árvore do Patronato · {profile.unlockedTalents.length}</button></header>{message && <div className="online-notice">{message}</div>}<div className="lobby-layout"><aside className="create-room-card"><span className="room-crest">♛</span><p className="panel-kicker">Nova convocação</p><h2>Criar uma sala</h2><label>Nome da mesa<input maxLength={32} value={name} onChange={(event) => setName(event.target.value)} /></label><div className="capacity-picker"><button className={maxPlayers === 3 ? "selected" : ""} onClick={() => setMaxPlayers(3)}><strong>3</strong><span>convidados</span></button><button className={maxPlayers === 4 ? "selected" : ""} onClick={() => setMaxPlayers(4)}><strong>4</strong><span>convidados</span></button></div><button className="primary-button full" disabled={connectionState !== "online"} onClick={() => onCreate(name, maxPlayers)}>Criar mesa para {maxPlayers}</button><div className="join-code"><span>Ou entrar por código</span><div><input maxLength={6} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ABC123" /><button disabled={code.trim().length < 6} onClick={() => onJoinCode(code.trim())}>Entrar</button></div></div></aside><section className="rooms-board"><div className="rooms-board-title"><div><p className="panel-kicker">Mesas aguardando</p><h2>{waiting.length} sala{waiting.length === 1 ? " aberta" : "s abertas"}</h2></div><span>{playing.length} em partida</span></div><div className="room-list">{waiting.length === 0 ? <div className="empty-rooms"><span>◇</span><strong>Nenhuma mesa aguarda convidados</strong><p>Crie a primeira convocação desta noite.</p></div> : waiting.map((room) => <article className="room-card" key={room.id}><div className="room-card-icon">♜</div><div><small>Código {room.code}</small><h3>{room.name}</h3><p>Anfitrião: {room.hostName}</p></div><div className="room-capacity"><strong>{room.playerCount}/{room.maxPlayers}</strong><span>lugares</span></div><button disabled={room.playerCount >= room.maxPlayers || connectionState !== "online"} onClick={() => onJoin(room.id)}>Entrar</button></article>)}</div>{playing.length > 0 && <div className="playing-rooms"><p className="panel-kicker">Bailes em andamento</p>{playing.map((room) => <span key={room.id}>{room.name} · {room.playerCount}/{room.maxPlayers}</span>)}</div>}</section></div></section></main>;
}

function WaitingRoom({ room, profile, connectionState, message, onLeave, onReady, onStart }: { room: OnlineRoom; profile: Profile; connectionState: "connecting" | "online" | "offline"; message: string; onLeave: () => void; onReady: (ready: boolean) => void; onStart: () => void; }) {
  const me = room.members.find((member) => member.userId === profile.id);
  const full = room.members.length === room.maxPlayers;
  const allReady = full && room.members.every((member) => member.ready);
  const isHost = room.hostUserId === profile.id;
  return <main className="waiting-screen"><div className="ambient-glow" /><SimpleHeader onBack={onLeave} right={<span className={`connection-pill ${connectionState}`}>{connectionState === "online" ? "● Conectado" : "○ Reconectando"}</span>} /><section className="waiting-card"><p className="eyebrow">Antessala privada</p><h1>{room.name}</h1><div className="room-code-display"><span>Código para os amigos</span><strong>{room.code}</strong><button onClick={() => void navigator.clipboard?.writeText(room.code)}>Copiar</button></div>{message && <div className="online-notice">{message}</div>}<div className={`waiting-seats seats-${room.maxPlayers}`}>{Array.from({ length: room.maxPlayers }, (_, seat) => { const member = room.members[seat]; return member ? <article className={`waiting-seat ${member.ready ? "ready" : ""} ${member.online ? "online" : "offline"}`} key={member.userId}><span className="seat-number">0{seat + 1}</span><div className="waiting-sigil">{PLAYER_SIGILS[seat % PLAYER_SIGILS.length]}</div><h2>{member.username}{member.userId === profile.id ? " · você" : ""}</h2><p>Convidado da Meia-Noite</p><div className="seat-badges">{member.isHost && <b>ANFITRIÃO</b>}<b>{member.online ? "ONLINE" : "RECONECTANDO"}</b></div><strong className="ready-state">{member.ready ? "✓ PRONTO" : "AGUARDANDO"}</strong></article> : <article className="waiting-seat empty" key={seat}><span className="seat-number">0{seat + 1}</span><div className="waiting-sigil">◇</div><h2>Lugar vazio</h2><p>Aguardando convidado</p></article>; })}</div><div className="waiting-actions"><div><strong>{room.members.length}/{room.maxPlayers} convidados</strong><span>{!full ? `Faltam ${room.maxPlayers - room.members.length} para completar a mesa` : allReady ? "Todos aceitaram a convocação" : "Aguardando todos marcarem pronto"}</span></div><button className={me?.ready ? "ready-toggle active" : "ready-toggle"} disabled={connectionState !== "online"} onClick={() => onReady(!me?.ready)}>{me?.ready ? "✓ Estou pronto" : "Marcar como pronto"}</button>{isHost && <button className="primary-button" disabled={!allReady || connectionState !== "online"} onClick={onStart}>{allReady ? "Abrir o baile" : `Aguardar mesa de ${room.maxPlayers}`}</button>}</div></section></main>;
}

function SimpleHeader({ onBack, right }: { onBack: () => void; right: React.ReactNode }) {
  return <header className="simple-header"><button className="text-button" onClick={onBack}>← Voltar</button><span className="mini-brand">Leilão da Meia-Noite</span>{right}</header>;
}

function PlayerSeat({ player, isTurn, isLeader, onClick }: { player: Player; isTurn: boolean; isLeader: boolean; onClick: () => void; }) {
  return <button className={`player-seat ${player.isHuman ? "human" : "rival"} ${isTurn ? "turn" : ""} ${isLeader ? "leader" : ""}`} onClick={onClick}><div className="seat-portrait">{player.character.sigil}{isLeader && <span className="leader-crown">♛</span>}</div><div className="seat-identity"><strong>{player.username}{player.isHuman && <small> você</small>}</strong><span>{player.isHuman ? "Seu Museu" : "Clique para negociar"}</span></div><div className="seat-resources"><span>● {player.gold}</span><span>✦ {visiblePrestige(player)}</span></div><div className="mini-inventory">{player.inventory.length === 0 ? <span>Sem relíquias</span> : player.inventory.slice(-6).map((item, index) => <b title={item.name} key={`${item.id}-${index}`}>{item.icon}</b>)}</div></button>;
}

function MuseumPanel({ player, fusionCount, enabled, onInspect, onOpenFusion }: { player: Player; fusionCount: number; enabled: boolean; onInspect: (relic: OwnedRelic) => void; onOpenFusion: () => void; }) {
  return <aside className="museum-panel"><header><div><p className="panel-kicker">Seu Museu</p><h2>{player.inventory.length} relíquias</h2></div><span className="museum-prestige">✦ {visiblePrestige(player)}</span></header>{fusionCount > 0 && <button className="fusion-alert" disabled={!enabled || player.infusionsAct >= 1} onClick={onOpenFusion}><span>✧</span><div><strong>{fusionCount} infusão{fusionCount === 1 ? " disponível" : "ões disponíveis"}</strong><small>{player.infusionsAct >= 1 ? "Infusão do ato já realizada" : "Combine relíquias do Museu"}</small></div></button>}<div className="museum-grid">{player.inventory.length === 0 ? <div className="empty-museum"><span>◇</span><strong>As vitrines estão vazias</strong><p>Suas relíquias aparecerão aqui.</p></div> : player.inventory.map((relic, index) => { const cursed = relic.cursed && !relic.curseSuppressed; const available = actionAvailable(relic); return <button className={`museum-tile ${relic.art ? "has-art" : ""} ${cursed ? "cursed" : ""} ${relic.fusionTier ? "fused" : ""}`} key={`${relic.id}-${index}`} onClick={() => onInspect(relic)}><RelicArtwork relic={relic} variant="museum" /><span className="tile-copy"><strong>{relic.name}</strong><small>✦ {relic.prestige + (relic.bonusPrestige ?? 0)} · {(relic.exhaustedLots ?? 0) > 0 ? "infusão estabilizando" : available ? "poder pronto" : "poder usado"}</small></span>{relic.fusionTier && <b className="tile-fusion">{relic.fusionTier === 3 ? "III" : "II"}</b>}{cursed && <b className="tile-curse">☠</b>}</button>; })}</div><footer><span>Artefatos ativados neste ato</span><strong>{player.artifactsUsedAct}/{artifactLimit(player)}</strong></footer></aside>;
}

function AuctionControls({ game, human, minimumBid, canBid, canControl, turnPlayer, openAuction, bid, pass, next }: { game: GameState; human: Player; minimumBid: number; canBid: boolean; canControl: boolean; turnPlayer?: Player; openAuction: () => void; bid: (amount: number) => void; pass: () => void; next: () => void; }) {
  if (game.status === "announcement") return <div className="hammer-controls"><div><span>O Anfitrião aguarda</span><strong>O lote começa em {game.deck[game.lotIndex].start} moedas</strong></div><button className="primary-button" disabled={!canControl} onClick={openAuction}>{canControl ? "Abrir leilão" : "Aguardando o anfitrião"}</button></div>;
  if (game.status === "bidding") return <div className="hammer-controls bidding"><div className="current-offer"><span>Lance atual</span><strong>{game.auction?.highBidder ? game.auction.currentBid : "—"}</strong><small>{game.auction?.highBidder ? game.players.find((player) => player.id === game.auction?.highBidder)?.character.name : "Nenhuma oferta"}</small></div>{turnPlayer?.isHuman && human.blockedAuctions === 0 ? <div className="bid-actions"><button disabled={!canBid} onClick={() => bid(minimumBid)}>Oferecer {minimumBid}</button><button disabled={!canBid || minimumBid + 2 - human.bidDiscount > human.gold} onClick={() => bid(minimumBid + 2)}>Subir para {minimumBid + 2}</button><button className="pass-button" onClick={pass}>Abandonar</button></div> : <div className="thinking-wrap"><span>{human.blockedAuctions > 0 && turnPlayer?.isHuman ? "Você foi enfeitiçado…" : `${turnPlayer?.character.name ?? "A corte"} está decidindo…`}</span><div className="thinking"><i /><i /><i /></div></div>}</div>;
  if (game.status === "awarded" && game.lastAward) return <div className="hammer-controls awarded"><div><span>{game.lastAward.winnerId ? "Martelo batido" : "Lote recusado"}</span><strong>{game.lastAward.winnerId ? `${game.players.find((player) => player.id === game.lastAward?.winnerId)?.username} pagou ${game.lastAward.price}` : game.lastAward.message}</strong><small>{game.lastAward.message}</small></div><button className="primary-button" disabled={!canControl} onClick={next}>{canControl ? game.lotIndex === game.deck.length - 1 ? "Revelar as intrigas" : game.lotIndex === 5 ? "Votação proibida" : (game.lotIndex + 1) % 3 === 0 ? "Encerrar ato" : "Próximo lote" : "Aguardando o anfitrião"}</button></div>;
  return null;
}

function Dossier({ player, relic, simulation, game, enabled, onUseTalent }: { player: Player; relic?: Relic; simulation: ReturnType<typeof simulateRelic> | null; game: GameState; enabled: boolean; onUseTalent: (talent: Talent) => void; }) {
  const activeTalents = player.skills.map((id) => TALENTS.find((talent) => talent.id === id)).filter((talent): talent is Talent => Boolean(talent?.activeType));
  const incomeTax = player.inventory.reduce((sum, item) => sum + (!item.curseSuppressed ? item.curse?.incomePenalty ?? 0 : 0), 0);
  const interest = hasSkill(player, "marked-catalogue") && relic ? game.players.filter((candidate) => candidate.id !== player.id && candidate.gold >= relic.start + 3).map((candidate) => candidate.username) : [];
  const intrigue = INTRIGUES.find((item) => item.id === player.intrigueId);
  const intrigueState = intrigue ? intrigueProgress(player, intrigue.id) : null;
  const canUseTalent = (talent: Talent) => {
    if (!enabled || !talent.activeType) return false;
    if (player.activeTalentsUsed.includes(talent.id) || player.activeTalentsUsedGame.includes(talent.id)) return false;
    if (talent.activeType === "blackVault") return visiblePrestige(player) >= 1;
    if (talent.activeType === "exhibit") return player.gold >= 2;
    if (talent.activeType === "bribe" || talent.activeType === "purify") return player.gold >= 3;
    if (talent.activeType === "prioritySeal") return true;
    return true;
  };
  return <aside className="dossier-panel compact"><div className="dossier-identity"><span>{player.character.sigil}</span><div><p className="panel-kicker">{player.character.title}</p><h2>{player.character.name}</h2></div></div><div className="resource-cards"><div><span>Ouro</span><strong>● {player.gold}</strong></div><div><span>Prestígio</span><strong>✦ {visiblePrestige(player)}</strong></div></div>{relic && simulation && !["intrigue","legendVote","voteResult","actBreak","intrigueReveal"].includes(game.status) && <div className="purchase-simulation compact"><span>Se conquistar o lote</span><strong>✦ {visiblePrestige(player)} → {Math.max(0, visiblePrestige(player) + simulation.total)}</strong><p>{simulation.total >= 0 ? "+" : ""}{simulation.total} Prestígio estimado</p>{hasSkill(player,"appraiser-eye") && <div className="simulation-detail"><small>Peça +{simulation.base}</small><small>Build +{simulation.talents}</small><small>Infusões futuras</small><small>Maldição −{simulation.curse}</small></div>}</div>}<section className="quick-status"><span>Próxima renda <b>+{Math.max(0, 5 + (hasSkill(player,"court-tithe") ? 2 : 0) - incomeTax)} ●</b></span><span>Maldições <b>{activeCurseCount(player)}</b></span><span>Artefatos <b>{player.artifactsUsedAct}/{artifactLimit(player)}</b></span></section>{intrigue && intrigueState && <section className={`secret-intrigue ${intrigueState.complete ? "complete" : ""}`}><header><span>{intrigue.icon}</span><div><small>Sua Intriga Secreta</small><strong>{intrigue.name}</strong></div><b>+{intrigue.reward} ✦</b></header><p>{intrigue.description}</p><div><i style={{ width: `${Math.min(100, (intrigueState.current / intrigueState.target) * 100)}%` }} /></div><small>{intrigueState.label}</small></section>}{activeTalents.length > 0 && <section className="active-build"><p className="panel-kicker">Ações da build</p>{activeTalents.map((talent) => { const used = player.activeTalentsUsed.includes(talent.id) || player.activeTalentsUsedGame.includes(talent.id); return <button key={talent.id} disabled={!canUseTalent(talent)} onClick={() => onUseTalent(talent)}><span>{talent.icon}</span><div><strong>{talent.name}</strong><small>{used ? "Já usada" : talent.description}</small></div></button>; })}</section>}{hasSkill(player,"veiled-glimpse") && game.deck[game.lotIndex + 1] && <div className="vision-box"><span>◈ Próxima relíquia</span><strong>{game.deck[game.lotIndex + 1].name}</strong></div>}{interest.length > 0 && <div className="interest-note">▤ Podem subir 3 moedas: {interest.join(" e ")}</div>}<section className="event-log compact-log"><p className="panel-kicker">Sussurros</p>{game.log.slice(0,3).map((entry,index) => <p className={index === 0 ? "latest" : ""} key={`${entry}-${index}`}>{entry}</p>)}</section></aside>;
}

function IntrigueSelection({ player, players, onChoose }: { player: Player; players: Player[]; onChoose: (id: string) => void; }) {
  const chosen = INTRIGUES.find((item) => item.id === player.intrigueId);
  const chosenCount = players.filter((candidate) => candidate.intrigueChosen || candidate.intrigueId).length;
  const options = player.intrigueOptions.map((id) => INTRIGUES.find((item) => item.id === id)).filter((item): item is Intrigue => Boolean(item));
  if (chosen) return <div className="intrigue-wait"><span className="intrigue-main-icon">{chosen.icon}</span><p className="eyebrow">Intriga selada · {chosenCount}/{players.length}</p><h2>{chosen.name}</h2><p>{chosen.description}</p><div className="intrigue-reward">Recompensa secreta <b>+{chosen.reward} Prestígio</b></div><small>Seu objetivo permanece invisível aos rivais. O primeiro lote será apresentado quando todos fizerem suas escolhas.</small><div className="sealed-players">{players.map((candidate) => <span className={candidate.intrigueChosen || candidate.intrigueId ? "sealed" : ""} key={candidate.id}>{candidate.character.sigil} {candidate.username} {candidate.intrigueChosen || candidate.intrigueId ? "✓" : "…"}</span>)}</div></div>;
  return <div className="intrigue-selection"><p className="eyebrow">Antes do primeiro martelo · {chosenCount}/{players.length} escolhas</p><h2>Escolha sua Intriga Secreta</h2><p>Somente você verá este objetivo. Cumpra-o até a última badalada para receber Prestígio adicional.</p><div className="intrigue-options">{options.map((intrigue) => <button key={intrigue.id} onClick={() => onChoose(intrigue.id)}><span>{intrigue.icon}</span><small>Recompensa · +{intrigue.reward} ✦</small><strong>{intrigue.name}</strong><p>{intrigue.description}</p><b>Selar esta intriga</b></button>)}</div><small className="intrigue-warning">A escolha é definitiva para esta partida e será revelada a todos no final.</small></div>;
}

function IntrigueReveal({ players, canConfirm, onConfirm }: { players: Player[]; canConfirm: boolean; onConfirm: () => void; }) {
  return <div className="intrigue-reveal"><p className="eyebrow">A última badalada · máscaras ao chão</p><h2>As Intrigas são reveladas</h2><p>Objetivos cumpridos acrescentam Prestígio antes da coroação do Soberano.</p><div className="intrigue-reveal-grid">{players.map((player) => { const intrigue = INTRIGUES.find((item) => item.id === player.intrigueId); const progress = intrigueProgress(player); return <article className={progress.complete ? "complete" : "failed"} key={player.id}><span>{intrigue?.icon ?? "◇"}</span><div><small>{player.username} · {player.character.name}</small><strong>{intrigue?.name ?? "Intriga perdida"}</strong><p>{intrigue?.description}</p><b>{progress.label}</b></div><em>{progress.complete ? `+${intrigue?.reward ?? 0} ✦` : "Fracassou"}</em></article>; })}</div><button className="primary-button" disabled={!canConfirm} onClick={onConfirm}>{canConfirm ? "Coroar o Soberano" : "Aguardando o anfitrião"}</button></div>;
}

function LegendVote({ onVote, voted, votes, total }: { onVote: (id: string) => void; voted: boolean; votes: number; total: number; }) {
  return <div className="legend-vote"><p className="eyebrow">Evento do baile · {votes}/{total} votos</p><h2>Votação dos Itens Proibidos</h2><p>{voted ? "Seu voto está selado. Aguarde os outros convidados." : "A corte decidirá qual relíquia lendária substituirá o primeiro lote do próximo ato. Em caso de empate, o destino escolhe."}</p><div className="legend-options">{LEGENDARY_RELICS.map((relic) => <button key={relic.id} disabled={voted} onClick={() => onVote(relic.id)}><span>{relic.icon}</span><strong>{relic.name}</strong><small>✦ {relic.prestige} · início {relic.start}</small><p>{relic.power.description}</p><b>{voted ? "Voto depositado" : "Votar neste item"}</b></button>)}</div></div>;
}

function VoteResult({ outcome, onConfirm, canConfirm }: { outcome: VoteOutcome; onConfirm: () => void; canConfirm: boolean; }) {
  const winner = LEGENDARY_RELICS.find((relic) => relic.id === outcome.winnerId)!;
  return <div className="vote-result"><span className="forbidden-mark">{winner.icon}</span><p className="eyebrow">A corte decidiu</p><h2>{winner.name}</h2><p>{winner.power.description}</p><div className="vote-tally">{LEGENDARY_RELICS.map((relic) => <span key={relic.id}>{relic.icon} {outcome.counts[relic.id]} voto{outcome.counts[relic.id] === 1 ? "" : "s"}</span>)}</div><button className="primary-button" disabled={!canConfirm} onClick={onConfirm}>{canConfirm ? "Levar ao próximo leilão" : "Aguardando o anfitrião"}</button></div>;
}

function ActionTargetModal({ relic, actor, game, onClose, onTarget }: { relic: OwnedRelic; actor: Player; game: GameState; onClose: () => void; onTarget: (id: string) => void; }) {
  const kind = relic.power.target === true ? "player" : relic.power.target;
  const players = validTargets(game.players, actor.id, relic);
  const rivalRelics = game.players.filter((player) => player.id !== actor.id).flatMap((player) => player.inventory.map((item) => ({ item, player }))).filter(({ item }) => !["fusion-nonexistent-face", "fusion-face-beyond-veil"].includes(relic.id) || actionAvailable(item));
  const ownRelics = actor.inventory.filter((item) => item.id !== relic.id).filter((item) => relic.power.type === "recharge" ? Boolean(item.usedAct) : relic.id === "fusion-red-moon-baptism" ? Boolean(item.usedAct || (item.cursed && !item.curseSuppressed)) : Boolean(item.cursed && !item.curseSuppressed));
  const deckRelics = game.deck.slice(game.lotIndex + 1, game.lotIndex + 4);
  const empty = kind === "player" ? players.length === 0 : kind === "rivalRelic" ? rivalRelics.length === 0 : kind === "ownRelic" ? ownRelics.length === 0 : deckRelics.length === 0;
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><section className="target-modal"><button className="modal-close" onClick={onClose}>×</button><span className="modal-relic-icon">{relic.icon}</span><p className="eyebrow">{relic.power.name}</p><h2>{kind === "deckRelic" ? "Escolha o próximo lote" : kind === "ownRelic" ? "Escolha uma peça do Museu" : kind === "rivalRelic" ? "Escolha a relíquia rival" : "Escolha o alvo"}</h2><p>{relic.power.description}</p><div className="target-list">{empty ? <div className="no-target">Nenhum alvo válido para este ritual.</div> : kind === "player" ? players.map((target) => <button key={target.id} onClick={() => onTarget(target.id)}><span>{target.character.sigil}</span><div><strong>{target.character.name}</strong><small>● {target.gold} · ✦ {visiblePrestige(target)} · {target.inventory.length} relíquias</small></div></button>) : kind === "rivalRelic" ? rivalRelics.map(({ item, player }) => <button key={`${player.id}-${item.id}`} onClick={() => onTarget(item.id)}><span>{item.icon}</span><div><strong>{item.name}</strong><small>{player.character.name} · ✦ {item.prestige} · {item.power.name}</small></div></button>) : kind === "ownRelic" ? ownRelics.map((item) => <button key={item.id} onClick={() => onTarget(item.id)}><span>{item.icon}</span><div><strong>{item.name}</strong><small>{item.curse && !item.curseSuppressed ? item.curse.name : "Artefato utilizado neste ato"}</small></div></button>) : deckRelics.map((item) => <button key={item.id} onClick={() => onTarget(item.id)}><span>{item.icon}</span><div><strong>{item.name}</strong><small>✦ {item.prestige} · lance inicial {item.start}</small></div></button>)}</div></section></div>;
}

function FusionModal({ player, recipes, enabled, onClose, onFuse }: { player: Player; recipes: FusionRecipe[]; enabled: boolean; onClose: () => void; onFuse: (id: string) => void; }) {
  const catalogue = [...RELICS, ...LEGENDARY_RELICS, ...FUSION_RECIPES.map((recipe) => recipe.result)];
  return <div className="modal-backdrop fusion-backdrop" role="dialog" aria-modal="true"><section className="fusion-modal"><button className="modal-close" onClick={onClose}>×</button><p className="eyebrow">Câmara de Infusão</p><h2>Fundir o impossível</h2><p className="fusion-intro">A infusão é irreversível. As peças originais desaparecem e a criação ficará estabilizando até o próximo lote.</p><div className="fusion-recipes">{recipes.length === 0 ? <div className="no-target">Nenhuma receita completa no Museu.</div> : recipes.map((recipe) => { const consumed = fusionConsumption(player, recipe) ?? recipe.components; const components = consumed.map((id) => catalogue.find((item) => item.id === id)).filter((item): item is Relic => Boolean(item)); const prestige = recipe.result.prestige + (hasSkill(player, "crown-curator") ? 2 : 0); return <article className={`fusion-recipe tier-${recipe.tier}`} key={recipe.id}><div className="fusion-components">{components.map((item, index) => <span key={item.id}>{item.icon}<small>{item.name}</small>{index < components.length - 1 && <b>+</b>}</span>)}</div><div className="fusion-arrow">↓</div><div className="fusion-result"><span>{recipe.result.icon}</span><div><small>Infusão {recipe.tier === 3 ? "tripla" : "dupla"}</small><strong>{recipe.result.name}</strong><p>✦ {prestige} · {recipe.result.power.name}</p></div></div><p className="fusion-power">{recipe.result.power.description}</p>{recipe.result.curse && <p className="fusion-curse">☠ {recipe.result.curse.name}: {recipe.result.curse.description}</p>}<button disabled={!enabled || player.infusionsAct >= 1 || player.gold < recipe.cost} onClick={() => onFuse(recipe.id)}>{player.infusionsAct >= 1 ? "Limite do ato atingido" : player.gold < recipe.cost ? `Faltam ${recipe.cost - player.gold} moedas` : `Infundir · ${recipe.cost} ●`}</button></article>; })}</div></section></div>;
}

function RelicDetailModal({ relic, player, status, enabled, onClose, onUse }: { relic: OwnedRelic; player: Player; status: GameStatus; enabled: boolean; onClose: () => void; onUse: () => void; }) {
  const limit = artifactLimit(player);
  const timingReady = actionTimingAvailable(relic, status);
  const ready = actionAvailable(relic) && timingReady && player.artifactsUsedAct < limit && !(relic.power.type === "convert" && player.gold < 3);
  const detailContent = <><p className="eyebrow">{relic.fusionTier ? `Infusão ${relic.fusionTier === 3 ? "tripla" : "dupla"}` : "Peça do seu Museu"}</p><h2>{relic.name}</h2><div className="detail-tags">{relic.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><div className="detail-power"><strong>{relic.power.name}</strong><p>{relic.power.description}</p><small>Uma vez por {relic.power.once === "act" ? "ato" : "partida"}</small></div>{relic.curse && <div className={`detail-curse ${relic.curseSuppressed ? "suppressed" : ""}`}><strong>☠ {relic.curse.name}</strong><p>{relic.curseSuppressed ? "Esta maldição foi anulada." : relic.curse.description}</p></div>}<button className="primary-button full" disabled={!enabled || !ready} onClick={onUse}>{(relic.exhaustedLots ?? 0) > 0 ? "Infusão estabilizando" : !timingReady ? relic.id === "fusion-death-refusing-king" ? "Use durante a apresentação" : "Use depois da batida do martelo" : player.artifactsUsedAct >= limit ? `Limite de ${limit} artefatos atingido` : !actionAvailable(relic) ? "Poder já usado" : enabled ? "Ativar artefato" : "Disponível entre leilões"}</button></>;
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><section className={`relic-detail-modal ${relic.art ? "has-art" : ""} ${relic.fusionTier ? "fused-detail" : ""}`}><button className="modal-close" onClick={onClose}>×</button>{relic.art ? <div className="detail-art-layout"><RelicArtwork relic={relic} variant="detail" /><div className="detail-copy">{detailContent}</div></div> : <><span className="modal-relic-icon">{relic.icon}</span>{detailContent}</>}</section></div>;
}

function TalentActionModal({ talent, player, players, onClose, onTarget }: { talent: Talent; player: Player; players: Player[]; onClose: () => void; onTarget: (id: string) => void; }) {
  const cursedRelics = player.inventory.filter((relic) => relic.cursed && !relic.curseSuppressed);
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><section className="target-modal"><button className="modal-close" onClick={onClose}>×</button><span className="modal-relic-icon">{talent.icon}</span><p className="eyebrow">Talento ativo</p><h2>{talent.name}</h2><p>{talent.description}</p><div className="target-list">{talent.activeType === "bribe" ? players.filter((target) => target.id !== player.id).map((target) => <button key={target.id} onClick={() => onTarget(target.id)}><span>{target.character.sigil}</span><div><strong>{target.character.name}</strong><small>Retirar do próximo leilão · custo 3 ●</small></div></button>) : cursedRelics.length === 0 ? <div className="no-target">Você não possui uma maldição ativa.</div> : cursedRelics.map((relic, index) => <button key={`${relic.id}-${index}`} onClick={() => onTarget(relic.id)}><span>{relic.icon}</span><div><strong>{relic.name}</strong><small>{relic.curse?.name} · custo 3 ●</small></div></button>)}</div></section></div>;
}

function RivalModal({ rival, player, enabled, busy, onClose, onRequest, onOffer }: { rival: Player; player: Player; enabled: boolean; busy: boolean; onClose: () => void; onRequest: (id: string) => void; onOffer: (id: string) => void; }) {
  const [direction, setDirection] = useState<"request" | "offer">("request");
  const buyer = direction === "request" ? player : rival;
  const purchaseLimit = tradeLimit(buyer);
  const catalogue = direction === "request" ? rival.inventory : player.inventory;
  const canTrade = enabled && buyer.tradesAct < purchaseLimit && buyer.gold > 0;
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><section className="rival-modal"><button className="modal-close" onClick={onClose}>×</button><div className="rival-modal-head"><span>{rival.character.sigil}</span><div><p className="eyebrow">Mercado entre Museus</p><h2>Negociar com {rival.character.name}</h2><small>Peça uma relíquia do rival ou ofereça uma peça sua. Toda proposta aceita contraproposta.</small></div></div><nav className="trade-direction-tabs"><button className={direction === "request" ? "active" : ""} onClick={() => setDirection("request")}><span>⇠</span><strong>Pedir do rival</strong><small>Você oferece ouro</small></button><button className={direction === "offer" ? "active" : ""} onClick={() => setDirection("offer")}><span>⇢</span><strong>Oferecer ao rival</strong><small>Você define o preço</small></button></nav><div className="trade-status"><span>{direction === "request" ? "Suas moedas" : `Moedas de ${rival.username}`}: <b>● {buyer.gold}</b></span><span>Compras de {buyer.isHuman ? "você" : rival.username} no ato: <b>{buyer.tradesAct}/{purchaseLimit}</b></span></div>{busy && <div className="trade-busy-note">Existe outra proposta aguardando resposta. Conclua ou retire aquela negociação primeiro.</div>}<div className="rival-relics trade-catalogue">{catalogue.length === 0 ? <div className="no-target">{direction === "request" ? "Este Museu ainda está vazio." : "Você ainda não possui uma relíquia para oferecer."}</div> : catalogue.map((relic,index) => { const estimate = Math.min(buyer.gold, askingPrice(relic,buyer)); return <article key={`${direction}-${relic.id}-${index}`}><span>{relic.icon}</span><div><strong>{relic.name}</strong><small>✦ {relic.prestige} · referência de preço {estimate} ●</small><p>{direction === "request" ? relic.power.description : `A venda rende +${salePrestige(relic, player)} Prestígio para você.`}</p></div><button disabled={!canTrade} onClick={() => direction === "request" ? onRequest(relic.id) : onOffer(relic.id)}>{busy ? "Proposta em curso" : !enabled ? "Aguarde o leilão" : buyer.tradesAct >= purchaseLimit ? "Limite atingido" : buyer.gold <= 0 ? "Sem ouro disponível" : direction === "request" ? "Pedir este item" : "Oferecer este item"}</button></article>; })}</div></section></div>;
}

function NegotiationModal({ offer, buyer, seller, relic, onClose, onSubmit }: { offer: NegotiationDraft; buyer: Player; seller: Player; relic: OwnedRelic; onClose: () => void; onSubmit: (amount: number) => void; }) {
  const [amount, setAmount] = useState(offer.amount);
  const selling = offer.kind === "sale-offer";
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><section className="negotiation-modal"><button className="modal-close" onClick={onClose}>×</button><span className="modal-relic-icon">{relic.icon}</span><p className="eyebrow">{selling ? `Oferecer a ${buyer.character.name}` : `Pedir de ${seller.character.name}`}</p><h2>{relic.name}</h2><p className="negotiation-message">{offer.message}</p><div className="offer-summary"><span>{selling ? `${buyer.username} possui` : "Você pode gastar"}<b>{buyer.gold} ●</b></span><span>Prestígio da venda <b>+{salePrestige(relic, seller)} ✦</b></span></div><label className="gold-input">{selling ? "Preço pedido" : "Quanto oferecer"}<input type="number" min={1} max={buyer.gold} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /><span>●</span></label><button className="primary-button full" disabled={amount < 1 || amount > buyer.gold} onClick={() => onSubmit(amount)}>{selling ? `Oferecer por ${amount} moedas` : `Pedir por ${amount} moedas`}</button><button className="text-button full" onClick={onClose}>Desistir</button></section></div>;
}

function TradeResponseModal({ offer, buyer, seller, relic, humanId, onAccept, onCounter, onDecline }: { offer: TradeOffer; buyer: Player; seller: Player; relic: OwnedRelic; humanId: string; onAccept: () => void; onCounter: (amount: number) => void; onDecline: () => void; }) {
  const humanIsBuyer = humanId === buyer.id;
  const suggestedCounter = humanIsBuyer ? Math.max(1, Math.min(buyer.gold, offer.amount - 1)) : Math.max(1, Math.min(buyer.gold, offer.amount + 2));
  const [amount, setAmount] = useState(suggestedCounter);
  const canBuy = buyer.gold >= offer.amount && buyer.tradesAct < tradeLimit(buyer);
  const heading = offer.status === "counter" ? "Contraproposta recebida" : humanIsBuyer ? "Relíquia oferecida a você" : "Pedido pela sua relíquia";
  return <div className="modal-backdrop priority" role="dialog" aria-modal="true"><section className="negotiation-modal incoming"><span className="modal-relic-icon">{relic.icon}</span><p className="eyebrow">{heading}</p><h2>{humanIsBuyer ? `${seller.character.name} oferece ${relic.name}` : `${buyer.character.name} quer ${relic.name}`}</h2><p className="negotiation-message">{offer.message}</p><div className="sale-preview">{humanIsBuyer ? <><div><span>Você paga</span><strong>−{offer.amount} ●</strong></div><div><span>Você recebe</span><strong>{relic.name}</strong></div></> : <><div><span>Você recebe</span><strong>+{offer.amount} ●</strong></div><div><span>Prestígio da venda</span><strong>+{salePrestige(relic, seller)} ✦</strong></div></>}</div><button className="primary-button full" disabled={!canBuy} onClick={onAccept}>{canBuy ? `Aceitar por ${offer.amount} moedas` : buyer.tradesAct >= tradeLimit(buyer) ? "Limite de compras atingido" : "O comprador não possui esse ouro"}</button><label className="gold-input">Contraproposta<input type="number" min={1} max={buyer.gold} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /><span>●</span></label><button className="counter-button" disabled={amount < 1 || amount > buyer.gold || buyer.tradesAct >= tradeLimit(buyer)} onClick={() => onCounter(amount)}>Enviar contraproposta</button><button className="text-button full" onClick={onDecline}>Recusar e encerrar</button></section></div>;
}

function TradeWaitingToast({ offer, buyer, seller, relic, onWithdraw }: { offer: TradeOffer; buyer: Player; seller: Player; relic: OwnedRelic; onWithdraw: () => void; }) {
  const recipient = tradeResponderId(offer) === buyer.id ? buyer : seller;
  return <aside className="trade-waiting-toast" aria-live="polite"><span className="trade-toast-icon">⌛</span><div><small>{offer.status === "counter" ? "Contraproposta enviada" : "Proposta enviada"}</small><strong>Aguardando {recipient.username}</strong><p>{relic.name} · {offer.amount} moedas</p></div><button onClick={onWithdraw}>Retirar</button></aside>;
}

function CancelGameModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void; }) {
  return <div className="modal-backdrop priority" role="dialog" aria-modal="true" aria-labelledby="cancel-game-title"><section className="cancel-game-modal"><button className="modal-close" onClick={onClose}>×</button><span className="cancel-game-icon">♜</span><p className="eyebrow">Encerrar o baile</p><h2 id="cancel-game-title">Cancelar esta partida?</h2><p>Todos os convidados serão retirados da sala e voltarão ao menu principal. O andamento desta partida será perdido.</p><div className="cancel-game-actions"><button className="text-button" onClick={onClose}>Continuar jogando</button><button className="danger-button" onClick={onConfirm}>Sim, cancelar para todos</button></div></section></div>;
}

function RulesModal({ onClose }: { onClose: () => void; }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><section className="rules-modal"><button className="modal-close" onClick={onClose}>×</button><p className="eyebrow">Regras do Anfitrião</p><h2>Como vencer o baile</h2><div className="rule-steps"><article><span>01</span><div><strong>Sele sua intriga</strong><p>Antes do primeiro lote, escolha um de três objetivos secretos. Se cumprir a condição, ganhe de 4 a 5 Prestígios na revelação final.</p></div></article><article><span>02</span><div><strong>Expanda seu patronato</strong><p>Seu primeiro talento é grátis. Vitórias rendem Lúmens e todos os talentos comprados ficam ativos na conta.</p></div></article><article><span>03</span><div><strong>Descubra a rotação</strong><p>Cada partida sorteia 12 das {RELICS.length} relíquias. A seleção muda a cada baile, mas é idêntica e sincronizada para todos na mesma sala.</p></div></article><article><span>04</span><div><strong>Crie infusões</strong><p>Receitas completas aparecem no Museu. Duplas custam 2 moedas, triplas custam 4 e a transformação é irreversível.</p></div></article><article><span>05</span><div><strong>Administre o Museu</strong><p>O limite inicial é de dois artefatos por ato. Talentos da Glória elevam esse limite para três e depois quatro; certas infusões ainda concedem ativações extras.</p></div></article><article><span>06</span><div><strong>Venda com estratégia</strong><p>Quem vende recebe o ouro combinado e também Prestígio. Negociações também podem avançar sua Intriga Secreta.</p></div></article><article><span>07</span><div><strong>Vote no proibido</strong><p>A corte escolhe entre {LEGENDARY_RELICS.length} Itens Proibidos. O vencedor substitui o primeiro lote do ato seguinte e alguns deles completam infusões lendárias.</p></div></article></div><div className="rules-note"><strong>Vitória e progressão</strong><span>Relíquias, efeitos, ouro e Intrigas cumpridas formam o Prestígio final. Cada vitória concede 3 Lúmens ao vencedor.</span></div><button className="primary-button full" onClick={onClose}>Compreendi</button></section></div>;
}
