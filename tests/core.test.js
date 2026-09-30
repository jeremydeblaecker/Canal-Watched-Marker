const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../core.js");

test("normalizeTitle retire accents et ponctuation", () => {
  assert.equal(Core.normalizeTitle("L'Étrange Noël de M. Jack"), "l etrange noel de m jack");
});

test("extractContentId reconnait les identifiants /h/", () => {
  assert.equal(
    Core.extractContentId("https://www.canalplus.com/cinema/test/h/43019292_50889"),
    "h:43019292_50889"
  );
});

test("normalizeCanalContentKey convertit les IDs de migration", () => {
  assert.equal(Core.normalizeCanalContentKey("43019292_50889"), "h:43019292_50889");
  assert.equal(Core.normalizeCanalContentKey("12345678"), "id:12345678");
});

test("buildContentAliases produit des alias titre et titre+annee", () => {
  const aliases = Core.buildContentAliases({
    id: "43019292_50889",
    title: "Le Voyage de Chihiro",
    originalTitle: "Sen to Chihiro no Kamikakushi",
    year: "2001"
  });
  assert.ok(aliases.includes("content:h:43019292_50889"));
  assert.ok(aliases.includes("title-year:le voyage de chihiro:2001"));
  assert.ok(aliases.includes("title:sen to chihiro no kamikakushi"));
});

test("normalizeProgress accepte les exports en pourcentage", () => {
  assert.equal(Core.normalizeProgress(90, false, ""), 0.9);
  assert.equal(Core.normalizeProgress(0.42, false, ""), 0.42);
  assert.equal(Core.normalizeProgress(20, true, ""), 1);
});
