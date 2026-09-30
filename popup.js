const DEFAULT_SETTINGS = {
  enabled: true,
  watchedThreshold: 0.9,
  showProgressBar: true,
  hideWatched: false
};

const els = {
  watchedCount: document.getElementById("watchedCount"),
  inProgressCount: document.getElementById("inProgressCount"),
  toggleEnabled: document.getElementById("toggleEnabled"),
  toggleProgressBar: document.getElementById("toggleProgressBar"),
  toggleHideWatched: document.getElementById("toggleHideWatched"),
  thresholdRange: document.getElementById("thresholdRange"),
  thresholdValue: document.getElementById("thresholdValue"),
  clearHistory: document.getElementById("clearHistory")
};

async function refreshStats() {
  const { watchedItems = {} } = await browser.storage.local.get("watchedItems");
  const items = Object.values(watchedItems);
  els.watchedCount.textContent = items.filter((i) => i.watched).length;
  els.inProgressCount.textContent = items.filter((i) => !i.watched && i.progress > 0.03).length;
}

async function loadSettings() {
  const { settings = {} } = await browser.storage.local.get("settings");
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  els.toggleEnabled.checked = merged.enabled;
  els.toggleProgressBar.checked = merged.showProgressBar;
  els.toggleHideWatched.checked = merged.hideWatched;
  els.thresholdRange.value = Math.round(merged.watchedThreshold * 100);
  els.thresholdValue.textContent = `${Math.round(merged.watchedThreshold * 100)}%`;
}

async function saveSettings(patch) {
  const { settings = {} } = await browser.storage.local.get("settings");
  const merged = { ...DEFAULT_SETTINGS, ...settings, ...patch };
  await browser.storage.local.set({ settings: merged });
  browser.runtime.sendMessage({ type: "REFRESH_ACTIVE_TAB" });
}

els.toggleEnabled.addEventListener("change", () => {
  saveSettings({ enabled: els.toggleEnabled.checked });
});

els.toggleProgressBar.addEventListener("change", () => {
  saveSettings({ showProgressBar: els.toggleProgressBar.checked });
});

els.toggleHideWatched.addEventListener("change", () => {
  saveSettings({ hideWatched: els.toggleHideWatched.checked });
});

els.thresholdRange.addEventListener("input", () => {
  els.thresholdValue.textContent = `${els.thresholdRange.value}%`;
});

els.thresholdRange.addEventListener("change", () => {
  saveSettings({ watchedThreshold: Number(els.thresholdRange.value) / 100 });
});

els.clearHistory.addEventListener("click", async () => {
  if (!confirm("Effacer tout l'historique des programmes vus/en cours ?")) return;
  await CPWMStorage.snapshot("before-clear-history");
  await browser.storage.local.set({
    watchedItems: {},
    contentAliases: {}
  });
  await refreshStats();
  browser.runtime.sendMessage({ type: "REFRESH_ACTIVE_TAB" });
});

function extractContentId(rawUrl) {
  return CPWMCore.extractContentId(rawUrl);
}

const markBtn = document.getElementById("markCurrentWatched");
markBtn.addEventListener("click", async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !/canalplus\.com|mycanal\.fr/.test(tab.url)) {
    alert("Ouvrez d'abord une page canalplus.com ou mycanal.fr dans cet onglet.");
    return;
  }
  const id = extractContentId(tab.url);
  await CPWMStorage.upsertItem(id, {
    watched: true,
    progress: 1,
    title: tab.title || "",
    url: tab.url
  });
  await refreshStats();
  browser.runtime.sendMessage({ type: "REFRESH_ACTIVE_TAB" });
  markBtn.textContent = "Marqué ✓ — rechargez la page catalogue";
  setTimeout(() => (markBtn.textContent = "Marquer l'onglet actif comme \"vu\""), 2500);
});

loadSettings();
refreshStats();

const openSiteImportButton = document.getElementById("openSiteImport");
if (openSiteImportButton) openSiteImportButton.addEventListener("click", () => {
  browser.tabs.create({ url: browser.runtime.getURL("import.html") });
});

// Import séparé de la filmothèque Notion.
const importNotionButton = document.getElementById("importNotion");
const notionFileInput = document.getElementById("notionFile");
const notionStatus = document.getElementById("notionStatus");
async function refreshNotionStatus() {
  const state = await NotionWatched.load();
  if (notionStatus) notionStatus.textContent = state.movies?.length
    ? `${state.movies.length} film(s) vu(s) importé(s) depuis Notion.`
    : "Aucune liste Notion importée.";
}
if (importNotionButton && notionFileInput) {
  importNotionButton.addEventListener("click", () => notionFileInput.click());
  notionFileInput.addEventListener("change", async () => {
    try {
      const payload = await NotionWatched.parseFile(notionFileInput.files?.[0]);
      if (!payload.movies.length) throw new Error("Aucun film marqué comme vu trouvé dans cet export.");
      const saved = await NotionWatched.replace(payload);
      if (notionStatus) notionStatus.textContent = `${saved.movies.length} film(s) Notion importé(s).`;
      try { await browser.runtime.sendMessage({ type: "REFRESH_ACTIVE_TAB" }); } catch {}
    } catch (error) {
      console.error("Import Notion impossible", error);
      if (notionStatus) notionStatus.textContent = error?.message || "Export Notion invalide.";
    } finally {
      notionFileInput.value = "";
    }
  });
}
refreshNotionStatus();
