// background.js — service worker MV3
// Initialise les réglages par défaut à l'installation et sert de relais
// de messages entre le popup et les content scripts si besoin.

const DEFAULT_SETTINGS = {
  enabled: true,
  watchedThreshold: 0.9, // % de la vidéo vue pour être considérée "vue"
  showProgressBar: true,
  hideWatched: false
};

browser.runtime.onInstalled.addListener(async (details) => {
  const state = await browser.storage.local.get([
    "settings",
    "watchedItems",
    "seriesWatched",
    CPWMStorage.KEYS.aliases,
    CPWMStorage.KEYS.backups
  ]);

  if (!state.settings) {
    await browser.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  if (!state.watchedItems) {
    await browser.storage.local.set({ watchedItems: {} });
  }
  if (!state.seriesWatched) {
    await browser.storage.local.set({ seriesWatched: {} });
  }
  if (!state[CPWMStorage.KEYS.aliases]) {
    await CPWMStorage.repairAliases();
  }
  if (!Array.isArray(state[CPWMStorage.KEYS.backups])) {
    await browser.storage.local.set({ [CPWMStorage.KEYS.backups]: [] });
  }
});

// Relais simple pour permettre au popup de demander un rafraîchissement
// immédiat des badges dans l'onglet actif après un changement de réglages.
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "REFRESH_ACTIVE_TAB") {
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.id) {
        browser.tabs.sendMessage(tab.id, { type: "REFRESH_MARKERS" }).catch(() => {});
      }
    });
  }
  return false;
});
