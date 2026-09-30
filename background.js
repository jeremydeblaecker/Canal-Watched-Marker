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
  const { settings } = await browser.storage.local.get("settings");
  if (!settings) {
    await browser.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  if (!("watchedItems" in (await browser.storage.local.get("watchedItems")))) {
    await browser.storage.local.set({ watchedItems: {} });
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
