const test = require("node:test");
const assert = require("node:assert/strict");

global.CPWMCore = require("../core.js");

function createBrowser(initial = {}) {
  let state = structuredClone(initial);
  return {
    storage: {
      local: {
        async get(keys) {
          if (typeof keys === "string") return { [keys]: structuredClone(state[keys]) };
          const list = Array.isArray(keys) ? keys : Object.keys(keys || {});
          return Object.fromEntries(list.map(key => [key, structuredClone(state[key])]));
        },
        async set(patch) {
          state = { ...state, ...structuredClone(patch) };
        }
      }
    },
    dump() {
      return structuredClone(state);
    }
  };
}

test("upsertItem relit le stockage avant chaque écriture", async () => {
  global.browser = createBrowser({
    watchedItems: {
      "h:existing_1": { watched: true, progress: 1, title: "Existing" }
    }
  });
  delete require.cache[require.resolve("../storage.js")];
  const Storage = require("../storage.js");

  await Storage.upsertItem("new_2", { watched: true, progress: 1, title: "New" });
  const state = global.browser.dump();

  assert.ok(state.watchedItems["h:existing_1"]);
  assert.ok(state.watchedItems["h:new_2"]);
});

test("resolveItem utilise un alias uniquement lorsqu'il est non ambigu", async () => {
  global.browser = createBrowser({ watchedItems: {}, contentAliases: {} });
  delete require.cache[require.resolve("../storage.js")];
  const Storage = require("../storage.js");

  await Storage.upsertItem("a_1", {
    watched: true,
    progress: 1,
    title: "Same Movie",
    year: "2020"
  });

  const found = await Storage.resolveItem("unknown", { title: "Same Movie" });
  assert.equal(found.id, "h:a_1");

  await Storage.upsertItem("b_2", {
    watched: true,
    progress: 1,
    title: "Same Movie",
    year: "2021"
  });

  const ambiguous = await Storage.resolveItem("unknown", { title: "Same Movie" });
  assert.equal(ambiguous, null);
});

test("mergeImportedRecords cree une sauvegarde avant fusion", async () => {
  global.browser = createBrowser({
    watchedItems: { "h:a_1": { watched: true, progress: 1 } },
    seriesWatched: {}
  });
  delete require.cache[require.resolve("../storage.js")];
  const Storage = require("../storage.js");

  const result = await Storage.mergeImportedRecords([
    {
      type: "content",
      key: "b_2",
      value: { watched: true, progress: 1, title: "Film B", updatedAt: Date.now() }
    }
  ]);

  const state = global.browser.dump();
  assert.equal(result.added, 1);
  assert.ok(state.watchedItems["h:b_2"]);
  assert.equal(state.storageBackups.length, 1);
  assert.ok(state.storageBackups[0].watchedItems["h:a_1"]);
});
