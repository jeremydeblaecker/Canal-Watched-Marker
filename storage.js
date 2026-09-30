(function (root, factory) {
  const api = factory(root?.CPWMCore);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CPWMStorage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core) {
  "use strict";

  const KEYS = {
    items: "watchedItems",
    series: "seriesWatched",
    aliases: "contentAliases",
    backups: "storageBackups",
    notion: "notionWatched"
  };

  function getBrowser() {
    if (typeof browser === "undefined" || !browser?.storage?.local) {
      throw new Error("browser.storage.local indisponible");
    }
    return browser;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value ?? null));
  }

  function aliasList(meta) {
    if (!Core?.buildContentAliases) return [];
    return Core.buildContentAliases(meta || {});
  }

  function indexAliases(aliasIndex, canonicalId, meta) {
    const next = { ...(aliasIndex || {}) };
    for (const alias of aliasList({ ...(meta || {}), id: canonicalId })) {
      const values = new Set(Array.isArray(next[alias]) ? next[alias] : []);
      values.add(canonicalId);
      next[alias] = [...values];
    }
    return next;
  }

  async function snapshot(reason = "manual") {
    const b = getBrowser();
    const state = await b.storage.local.get([KEYS.items, KEYS.series, KEYS.aliases, KEYS.backups, KEYS.notion]);
    const backups = Array.isArray(state[KEYS.backups]) ? state[KEYS.backups] : [];
    const entry = {
      createdAt: Date.now(),
      reason,
      watchedItems: clone(state[KEYS.items] || {}),
      seriesWatched: clone(state[KEYS.series] || {}),
      contentAliases: clone(state[KEYS.aliases] || {}),
      notionWatched: clone(state[KEYS.notion] || { movies: [], importedAt: "", sourceName: "" })
    };
    backups.push(entry);
    const trimmed = backups.slice(-5);
    await b.storage.local.set({ [KEYS.backups]: trimmed });
    return entry;
  }

  async function upsertItem(id, patch = {}, meta = {}) {
    const b = getBrowser();
    const canonicalId = Core?.normalizeCanalContentKey ? Core.normalizeCanalContentKey(id) : id;
    const state = await b.storage.local.get([KEYS.items, KEYS.aliases]);
    const items = { ...(state[KEYS.items] || {}) };
    const current = items[canonicalId] || {};
    const merged = {
      ...current,
      ...patch,
      title: patch.title ?? current.title ?? meta.title ?? "",
      originalTitle: patch.originalTitle ?? current.originalTitle ?? meta.originalTitle ?? "",
      year: patch.year ?? current.year ?? meta.year ?? "",
      updatedAt: Date.now()
    };
    items[canonicalId] = merged;
    const aliases = indexAliases(state[KEYS.aliases] || {}, canonicalId, merged);
    await b.storage.local.set({ [KEYS.items]: items, [KEYS.aliases]: aliases });
    return merged;
  }

  async function upsertSeries(seriesId, patch = {}) {
    const b = getBrowser();
    const state = await b.storage.local.get(KEYS.series);
    const series = { ...(state[KEYS.series] || {}) };
    series[seriesId] = { ...(series[seriesId] || {}), ...patch, updatedAt: Date.now() };
    await b.storage.local.set({ [KEYS.series]: series });
    return series[seriesId];
  }

  async function resolveItem(id, meta = {}) {
    const b = getBrowser();
    const canonicalId = Core?.normalizeCanalContentKey ? Core.normalizeCanalContentKey(id) : id;
    const state = await b.storage.local.get([KEYS.items, KEYS.aliases]);
    const items = state[KEYS.items] || {};
    if (items[canonicalId] !== undefined) {
      return { id: canonicalId, item: items[canonicalId], via: "id" };
    }

    const aliases = state[KEYS.aliases] || {};
    for (const alias of aliasList(meta)) {
      const ids = (aliases[alias] || []).filter(candidate => items[candidate] !== undefined);
      if (ids.length === 1) {
        return { id: ids[0], item: items[ids[0]], via: alias };
      }
    }
    return null;
  }

  async function mergeImportedRecords(records = [], { backupReason = "before-import" } = {}) {
    const b = getBrowser();
    await snapshot(backupReason);

    const state = await b.storage.local.get([KEYS.items, KEYS.series, KEYS.aliases]);
    const items = { ...(state[KEYS.items] || {}) };
    const series = { ...(state[KEYS.series] || {}) };
    let aliases = { ...(state[KEYS.aliases] || {}) };
    let added = 0;
    let updated = 0;

    for (const record of records) {
      if (record.type === "series") {
        const existing = series[record.key];
        if (!existing) {
          series[record.key] = record.value;
          added++;
        } else if ((Number(record.value?.updatedAt) || 0) >= (Number(existing?.updatedAt) || 0)) {
          series[record.key] = { ...existing, ...record.value };
          updated++;
        }
        continue;
      }

      const key = Core?.normalizeCanalContentKey ? Core.normalizeCanalContentKey(record.key) : record.key;
      const existing = items[key];
      if (!existing) {
        items[key] = record.value;
        added++;
      } else if ((Number(record.value?.updatedAt) || 0) >= (Number(existing?.updatedAt) || 0)) {
        items[key] = { ...existing, ...record.value };
        updated++;
      }
      aliases = indexAliases(aliases, key, items[key]);
    }

    await b.storage.local.set({
      [KEYS.items]: items,
      [KEYS.series]: series,
      [KEYS.aliases]: aliases
    });

    return {
      added,
      updated,
      stored: Object.keys(items).length + Object.keys(series).length
    };
  }

  async function repairAliases() {
    const b = getBrowser();
    const state = await b.storage.local.get(KEYS.items);
    const items = state[KEYS.items] || {};
    let aliases = {};
    for (const [id, item] of Object.entries(items)) {
      aliases = indexAliases(aliases, id, item);
    }
    await b.storage.local.set({ [KEYS.aliases]: aliases });
    return { items: Object.keys(items).length, aliases: Object.keys(aliases).length };
  }

  return {
    KEYS,
    aliasList,
    indexAliases,
    snapshot,
    upsertItem,
    upsertSeries,
    resolveItem,
    mergeImportedRecords,
    repairAliases
  };
});
