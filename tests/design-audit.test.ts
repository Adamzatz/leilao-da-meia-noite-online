import assert from "node:assert/strict";
import test from "node:test";

import { FUSION_RECIPES, INTRIGUES, LEGENDARY_RELICS, RELICS, TALENTS, createDeck } from "../src/App.tsx";

test("o mapa de conteúdo não possui IDs duplicados", () => {
  const groups = [RELICS, LEGENDARY_RELICS, FUSION_RECIPES.map((recipe) => recipe.result), TALENTS, INTRIGUES];
  for (const group of groups) assert.equal(new Set(group.map((item) => item.id)).size, group.length);
});

test("todas as receitas apontam para componentes existentes", () => {
  const componentIds = new Set([...RELICS, ...LEGENDARY_RELICS].map((item) => item.id));
  for (const recipe of FUSION_RECIPES) {
    assert.equal(recipe.components.length, recipe.tier);
    assert.ok(recipe.components.every((id) => componentIds.has(id)), recipe.id);
    assert.equal(recipe.cost, recipe.tier === 2 ? 2 : 4);
  }
});

test("a Árvore do Patronato tem dependências válidas", () => {
  for (const talent of TALENTS) {
    if (!talent.parent) continue;
    const parent = TALENTS.find((candidate) => candidate.id === talent.parent);
    assert.ok(parent, `${talent.id} possui pai inexistente`);
    assert.equal(parent.branch, talent.branch, `${talent.id} atravessa ramos`);
    assert.ok(parent.tier < talent.tier, `${talent.id} não avança de nível`);
  }
});

test("todos os poderes do catálogo pertencem ao motor implementado", () => {
  const supported = new Set(["tax", "discount", "stealGold", "silence", "gainGold", "convert", "ward", "reflect", "stealPrestige", "mission", "giftCurse", "exalt", "grandDiscount", "shield", "royalDecree", "tradeMark", "siphon", "coinFlip", "judgment", "oracle", "riskBoost", "recharge", "purify", "tradeBoost", "fusion"]);
  const catalogue = [...RELICS, ...LEGENDARY_RELICS, ...FUSION_RECIPES.map((recipe) => recipe.result)];
  for (const relic of catalogue) {
    assert.ok(supported.has(relic.power.type), `${relic.name} usa poder desconhecido`);
    assert.ok(relic.power.description.length >= 12, `${relic.name} não explica seu poder`);
  }
});

test("cada partida recebe doze lotes comuns antes da votação", () => {
  for (let run = 0; run < 20; run += 1) {
    const deck = createDeck();
    assert.equal(deck.length, 12);
    assert.equal(new Set(deck.map((item) => item.id)).size, 12);
    assert.ok(deck.every((item) => RELICS.some((relic) => relic.id === item.id)));
  }
});

test("as Intrigas Secretas cobrem oito estratégias e recompensas controladas", () => {
  assert.equal(INTRIGUES.length, 8);
  assert.equal(new Set(INTRIGUES.map((intrigue) => intrigue.metric)).size, 8);
  assert.ok(INTRIGUES.every((intrigue) => intrigue.reward >= 4 && intrigue.reward <= 5));
  assert.ok(INTRIGUES.every((intrigue) => intrigue.target >= 1));
});
