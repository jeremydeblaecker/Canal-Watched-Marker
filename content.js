/**
 * Canal+ Watched Marker — content.js
 *
 * Principe (identique à Netflix/Disney+ Watched Marker) :
 *  1. Sur une page de lecture, on surveille la balise <video> pour calculer
 *     la progression et déterminer quand un programme est "vu".
 *  2. Sur les pages de catalogue/accueil/recherche, on scanne les liens vers
 *     des contenus et on superpose un badge (✓ vu / barre de progression)
 *     sur la vignette correspondante.
 *
 * ⚠️ Le site Canal+ (canalplus.com / mycanal.fr) est une SPA React dont les
 * classes CSS sont générées dynamiquement et peuvent changer. La détection
 * des "cartes" de vignette utilise donc une heuristique tolérante (recherche
 * du plus proche conteneur contenant une image) plutôt que des sélecteurs
 * figés. Si Canal+ modifie sa structure, ajustez la fonction
 * `findCardElement()` ci-dessous en vous aidant de l'inspecteur DOM (F12).
 */

(() => {
  const DEBUG = true; // Passez à false une fois que tout fonctionne
  const log = (...args) => DEBUG && console.log("[CPWM]", ...args);

  const STORAGE_KEY = "watchedItems";
  const SERIES_KEY = "seriesWatched";
  const SETTINGS_KEY = "settings";
  const SCAN_DEBOUNCE_MS = 500;
  const VIDEO_POLL_MS = 3000;
  const SAVE_MIN_INTERVAL_MS = 4000;

  let settings = { enabled: true, watchedThreshold: 0.9, showProgressBar: true, hideWatched: false };
  let watchedCache = {};
  let seriesWatched = {};
  let contentAliases = {};
  let lastSaveAt = 0;
  let currentVideoId = null;
  let videoPollTimer = null;
  let observedVideos = new WeakSet();

  // ---------------------------------------------------------------------
  // Utilitaires
  // ---------------------------------------------------------------------

  function debounce(fn, wait) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  /**
   * Extrait un identifiant "stable" de contenu depuis une URL Canal+.
   * Gère les schémas connus :
   *  - .../h/XXXXXXXXXX               (identifiant technique fréquent)
   *  - .../s1/e4/... (émissions/séries) -> on garde l'URL normalisée entière
   *  - fallback : chemin complet nettoyé des query params
   */
  function extractContentId(rawUrl) {
    return CPWMCore.extractContentId(rawUrl, location.origin);
  }

  function isContentLink(href) {
    if (!href) return false;
    try {
      const u = new URL(href, location.origin);
      if (!/canalplus\.com$|mycanal\.fr$/.test(u.hostname.replace(/^www\./, ""))) return false;
      // Pages "fiches" / lecture typiques sur Canal+
      return /\/(h|video|programme|serie|series|film|emission)s?\//i.test(u.pathname) ||
             /\/h\//.test(u.pathname);
    } catch {
      return false;
    }
  }

  /**
   * Regroupe les contenus par "émission/série" en se basant sur les deux
   * premiers segments du chemin (ex: /series/game-of-thrones/... -> même
   * clé pour tous les épisodes). Fonctionne aussi pour les films (clé
   * équivalente à l'ID unique), sans effet indésirable.
   */
  function extractSeriesId(rawUrl) {
    return CPWMCore.extractSeriesId(rawUrl, location.origin);
  }

  /** Détecte si une URL ressemble à un épisode (saison/épisode) plutôt qu'à un film unique. */
  function isEpisodeUrl(rawUrl) {
    return CPWMCore.isEpisodeUrl(rawUrl);
  }

  // ---------------------------------------------------------------------
  // Stockage
  // ---------------------------------------------------------------------

  async function loadState() {
    const data = await browser.storage.local.get([STORAGE_KEY, SERIES_KEY, SETTINGS_KEY, CPWMStorage.KEYS.aliases]);
    watchedCache = data[STORAGE_KEY] || {};
    seriesWatched = data[SERIES_KEY] || {};
    contentAliases = data[CPWMStorage.KEYS.aliases] || {};
    settings = { ...settings, ...(data[SETTINGS_KEY] || {}) };
    applyHideWatchedClass();
  }

  async function saveWatchedItem(id, patch) {
    const canonicalId = CPWMCore.normalizeCanalContentKey(id);
    const saved = await CPWMStorage.upsertItem(canonicalId, patch, patch);
    watchedCache[canonicalId] = saved;
    return saved;
  }

  async function saveSeriesWatched(seriesId, watched) {
    const saved = await CPWMStorage.upsertSeries(seriesId, { watched });
    seriesWatched[seriesId] = saved;
    return saved;
  }

  function resolveCachedEntry(id, meta = {}) {
    const canonicalId = CPWMCore.normalizeCanalContentKey(id);
    if (watchedCache[canonicalId] !== undefined) return watchedCache[canonicalId];

    for (const alias of CPWMCore.buildContentAliases(meta)) {
      const ids = (contentAliases[alias] || []).filter(candidate => watchedCache[candidate] !== undefined);
      if (ids.length === 1) return watchedCache[ids[0]];
    }
    return undefined;
  }

  function applyHideWatchedClass() {
    document.documentElement.classList.toggle("cpwm-hide-watched", !!settings.hideWatched);
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[STORAGE_KEY]) {
      watchedCache = changes[STORAGE_KEY].newValue || {};
      scheduleScan();
    }
    if (changes[SERIES_KEY]) {
      seriesWatched = changes[SERIES_KEY].newValue || {};
      scheduleScan();
    }
    if (changes[CPWMStorage.KEYS.aliases]) {
      contentAliases = changes[CPWMStorage.KEYS.aliases].newValue || {};
      scheduleScan();
    }
    if (changes[SETTINGS_KEY]) {
      settings = { ...settings, ...(changes[SETTINGS_KEY].newValue || {}) };
      applyHideWatchedClass();
      scheduleScan();
    }
  });

  // ---------------------------------------------------------------------
  // Suivi de la lecture vidéo
  // ---------------------------------------------------------------------

  function attachVideoWatcher(videoEl) {
    if (observedVideos.has(videoEl)) return;
    observedVideos.add(videoEl);

    const onTick = () => {
      if (!settings.enabled) return;
      const id = currentVideoId || extractContentId(location.href);
      if (!videoEl.duration || Number.isNaN(videoEl.duration) || videoEl.duration <= 0) return;

      const progress = Math.min(1, videoEl.currentTime / videoEl.duration);
      const now = Date.now();
      const watched = progress >= settings.watchedThreshold;

      if (now - lastSaveAt > SAVE_MIN_INTERVAL_MS || watched) {
        lastSaveAt = now;
        saveWatchedItem(id, {
          progress,
          watched: watched || !!(watchedCache[id] && watchedCache[id].watched),
          title: document.title.replace(/\s*\|\s*CANAL\+.*/i, "").trim(),
          url: location.href
        });
      }
    };

    videoEl.addEventListener("timeupdate", debounce(onTick, 1000));
    videoEl.addEventListener("ended", () => {
      const id = currentVideoId || extractContentId(location.href);
      saveWatchedItem(id, {
        progress: 1,
        watched: true,
        title: document.title.replace(/\s*\|\s*CANAL\+.*/i, "").trim(),
        url: location.href
      });
    });
    videoEl.addEventListener("pause", onTick);
  }

  function pollForVideoElement() {
    if (videoPollTimer) clearInterval(videoPollTimer);
    videoPollTimer = setInterval(() => {
      const videos = document.querySelectorAll("video");
      videos.forEach(attachVideoWatcher);
    }, VIDEO_POLL_MS);
  }

  // ---------------------------------------------------------------------
  // Marquage visuel des vignettes
  // ---------------------------------------------------------------------

  /**
   * Retourne l'image principale réellement affichée dans une carte.
   *
   * Sur certaines pages CANAL+ (notamment "Tous les films"), le premier
   * <img> du lien peut être un petit logo / badge (Box Office, chaîne, etc.)
   * et non l'affiche. Utiliser querySelector("img") dimensionnait alors
   * l'overlay sur quelques dizaines de pixels, ce qui coupait "DÉJÀ VU".
   *
   * On choisit donc l'image visible ayant la plus grande surface rendue.
   */
  function findMainVisual(anchor) {
    const images = Array.from(anchor.querySelectorAll("img"));
    let best = null;
    let bestArea = 0;

    for (const image of images) {
      const rect = image.getBoundingClientRect();
      if (rect.width < 60 || rect.height < 40) continue;

      const style = getComputedStyle(image);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) <= 0) continue;

      // Une image totalement hors écran / non rendue ne doit pas devenir la référence.
      if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= window.innerHeight + 200 || rect.left >= window.innerWidth + 200) continue;

      const area = rect.width * rect.height;
      if (area > bestArea) {
        best = image;
        bestArea = area;
      }
    }

    return best;
  }

  /**
   * Retourne le conteneur VISUEL de la vignette.
   *
   * CANAL+ utilise plusieurs structures de cartes et certains <a> sont des
   * wrappers sans boîte de rendu fiable (display: contents, conteneurs de
   * carrousel transformés, etc.). Positionner l'overlay sur ces éléments
   * décale alors le badge vers le bord de la page.
   *
   * On part donc de l'image réellement affichée puis on choisit le premier
   * parent dont le rectangle recouvre presque exactement cette image.
   */
  function findCardElement(anchor, preferredVisual = null) {
    const image = preferredVisual || findMainVisual(anchor);
    if (image) {
      const imageRect = image.getBoundingClientRect();
      if (imageRect.width > 60 && imageRect.height > 40) {
        let best = image.parentElement || image;
        let el = image.parentElement;

        for (let i = 0; i < 5 && el; i++, el = el.parentElement) {
          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;

          const sameLeft = Math.abs(rect.left - imageRect.left) <= 8;
          const sameTop = Math.abs(rect.top - imageRect.top) <= 8;
          const widthRatio = rect.width / imageRect.width;
          const heightRatio = rect.height / imageRect.height;
          const sameVisualBox = sameLeft && sameTop &&
            widthRatio >= 0.92 && widthRatio <= 1.12 &&
            heightRatio >= 0.92 && heightRatio <= 1.18;

          if (sameVisualBox) best = el;
          else if (best !== image.parentElement) break;

          if (el === anchor) break;
        }

        return best;
      }
    }

    // Repli pour les rares cartes utilisant uniquement une image de fond.
    let el = anchor;
    for (let i = 0; i < 5 && el; i++, el = el.parentElement) {
      const rect = el.getBoundingClientRect();
      const hasBackground = getComputedStyle(el).backgroundImage !== "none";
      if (hasBackground && rect.width > 60 && rect.height > 40) return el;
    }

    return anchor;
  }

  /**
   * Crée l'overlay dans un hôte stable, mais le dimensionne toujours sur le
   * rectangle EXACT de l'image. C'est nécessaire sur la page "Tous les films"
   * où le lien/conteneur peut dépasser largement de l'affiche elle-même.
   */
  function ensureBadgeContainer(card, visual) {
    const target = visual || card;
    let host = target?.parentElement || card;

    // Cherche un parent réellement rendu et contenant l'image.
    for (let i = 0; i < 4 && host; i++) {
      const hostRect = host.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const containsTarget = hostRect.width > 0 && hostRect.height > 0 &&
        targetRect.width > 0 && targetRect.height > 0 &&
        hostRect.left <= targetRect.left + 2 && hostRect.top <= targetRect.top + 2 &&
        hostRect.right >= targetRect.right - 2 && hostRect.bottom >= targetRect.bottom - 2;
      if (containsTarget) break;
      host = host.parentElement;
    }

    host = host || card;

    // Toujours identifier l'hôte de l'overlay. Auparavant cette classe
    // n'était ajoutée que lorsque position === static, ce qui empêchait
    // l'affichage du bouton ✓ au survol des cartes déjà positionnées par CANAL+.
    host.classList.add("cpwm-overlay-host");
    if (getComputedStyle(host).position === "static") {
      host.classList.add("cpwm-relative");
    }

    // Une ancienne détection ou plusieurs liens vers la même carte peuvent avoir
    // créé plusieurs couches. On n'en conserve strictement qu'une par hôte.
    const existingBadges = Array.from(
      host.querySelectorAll(":scope > .cpwm-badge-layer[data-cpwm-overlay='1']")
    );
    let badge = existingBadges.shift() || null;
    existingBadges.forEach((extra) => extra.remove());

    if (!badge) {
      badge = document.createElement("div");
      badge.className = "cpwm-badge-layer";
      badge.dataset.cpwmOverlay = "1";
      host.appendChild(badge);
    }

    const hostRect = host.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const left = targetRect.left - hostRect.left;
    const top = targetRect.top - hostRect.top;

    badge.style.inset = "auto";
    badge.style.left = `${left}px`;
    badge.style.top = `${top}px`;
    badge.style.width = `${targetRect.width}px`;
    badge.style.height = `${targetRect.height}px`;

    return badge;
  }

  function createToggleButton(id, isWatched) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cpwm-toggle-btn";
    btn.title = isWatched ? "Marquer comme non vu" : "Marquer comme vu";
    btn.textContent = "✓";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleWatched(id);
    });
    // Empêche aussi le déclenchement de la navigation sur mousedown/mouseup
    btn.addEventListener("mousedown", (e) => e.stopPropagation());
    return btn;
  }

  function createSeriesToggleButton(seriesId, isSeriesWatched) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cpwm-series-btn" + (isSeriesWatched ? " cpwm-series-btn-active" : "");
    btn.title = isSeriesWatched
      ? "Ne plus marquer toute la série comme vue"
      : "Marquer toute la série comme vue";
    btn.textContent = isSeriesWatched ? "✓ Série" : "Série";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSeriesWatched(seriesId);
    });
    btn.addEventListener("mousedown", (e) => e.stopPropagation());
    return btn;
  }

  async function toggleWatched(id) {
    const current = watchedCache[id];
    const newWatched = !(current && current.watched);
    await saveWatchedItem(id, {
      watched: newWatched,
      progress: newWatched ? 1 : Math.min(current?.progress || 0, 0.02),
      title: current?.title || document.title,
      url: current?.url || location.href
    });
    log(`Toggle manuel pour ${id} → ${newWatched ? "vu" : "non vu"}`);
    scanAndMark();
  }

  async function toggleSeriesWatched(seriesId) {
    const current = seriesWatched[seriesId];
    const newWatched = !(current && current.watched);
    await saveSeriesWatched(seriesId, newWatched);
    log(`Toggle série ${seriesId} → ${newWatched ? "vue" : "non vue"}`);
    scanAndMark();
  }

  function applyMarker(card, visual, entry, id, meta) {
    const layer = ensureBadgeContainer(card, visual);
    layer.innerHTML = "";
    card.classList.remove("cpwm-watched", "cpwm-in-progress");
    visual?.classList.remove("cpwm-watched-visual");

    const isWatched = !!(entry && entry.watched);

    if (isWatched) {
      card.classList.add("cpwm-watched");
      visual?.classList.add("cpwm-watched-visual");

      const watchedLabel = document.createElement("div");
      watchedLabel.className = "cpwm-watched-label";
      watchedLabel.textContent = "Déjà vu";
      layer.appendChild(watchedLabel);
    } else if (settings.showProgressBar && entry && entry.progress > 0.03) {
      card.classList.add("cpwm-in-progress");
      const bar = document.createElement("div");
      bar.className = "cpwm-progress-bar";
      const fill = document.createElement("div");
      fill.className = "cpwm-progress-fill";
      fill.style.width = `${Math.round(entry.progress * 100)}%`;
      bar.appendChild(fill);
      layer.appendChild(bar);
    }

    layer.appendChild(createToggleButton(id, isWatched));

    if (meta && meta.episodeLike && meta.seriesId) {
      layer.appendChild(createSeriesToggleButton(meta.seriesId, !!(meta.seriesEntry && meta.seriesEntry.watched)));
    }
  }


  function getCardTitle(anchor, card) {
    const values = [
      anchor.getAttribute("aria-label"), anchor.getAttribute("title"), anchor.getAttribute("data-title"),
      card?.getAttribute?.("aria-label"), card?.getAttribute?.("title"),
      anchor.querySelector("img")?.alt, card?.querySelector?.("img")?.alt,
      card?.querySelector?.("[data-testid*=title], [class*=title], [class*=Title]")?.textContent
    ];
    for (const value of values) {
      const cleaned = String(value || "").replace(/\s+/g, " ").trim();
      if (cleaned.length >= 2 && cleaned.length <= 180) return cleaned;
    }
    return "";
  }

  function scanAndMark() {
    if (!settings.enabled) {
      log("Marquage désactivé dans les réglages, scan ignoré.");
      return;
    }
    const anchors = document.querySelectorAll("a[href]");
    const processedVisuals = new Set();
    let matchedLinks = 0;
    let markedCount = 0;
    anchors.forEach((a) => {
      const href = a.getAttribute("href");
      if (!isContentLink(href)) return;
      matchedLinks++;

      // CANAL+ place souvent plusieurs <a> vers le même contenu dans une carte
      // (un autour de l'image, un autour du titre, parfois d'autres éléments).
      // Seul le lien possédant réellement l'affiche doit créer un overlay.
      // Cela évite deux labels « DÉJÀ VU » sur la même vignette.
      const visual = findMainVisual(a);
      if (!visual) return;
      if (processedVisuals.has(visual)) return;
      processedVisuals.add(visual);

      const absHref = new URL(href, location.origin).href;
      const id = extractContentId(absHref);
      const seriesId = extractSeriesId(absHref);
      const episodeLike = isEpisodeUrl(absHref);
      const seriesEntry = seriesId ? seriesWatched[seriesId] : null;
      const card = findCardElement(a, visual);
      if (!card) return;
      const cardTitle = getCardTitle(a, card);
      const directEntry = resolveCachedEntry(id, { id, title: cardTitle });
      const notionMatch = NotionWatched.match(cardTitle);
      const notionEntry = notionMatch ? { watched: true, progress: 1, source: "notion" } : null;
      // Un marquage explicite sur l'épisode prime toujours sur le repli "série entière".
      const effectiveEntry = directEntry !== undefined
        ? directEntry
        : (episodeLike && seriesEntry && seriesEntry.watched ? { watched: true, progress: 1, fromSeries: true } : notionEntry);

      applyMarker(card, visual, effectiveEntry, id, { seriesId, episodeLike, seriesEntry });
      if (effectiveEntry && effectiveEntry.watched) markedCount++;
    });
    log(`Scan terminé : ${anchors.length} liens sur la page, ${matchedLinks} reconnus comme contenu, ${markedCount} marqués (vus/en cours dans le stockage).`);
  }

  const scheduleScan = debounce(scanAndMark, SCAN_DEBOUNCE_MS);

  // ---------------------------------------------------------------------
  // Observation des changements de page (SPA) et du DOM
  // ---------------------------------------------------------------------

  function trackUrlChanges() {
    let lastUrl = location.href;
    currentVideoId = extractContentId(lastUrl);

    const check = () => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        currentVideoId = extractContentId(lastUrl);
        scheduleScan();
      }
    };

    const pushState = history.pushState;
    history.pushState = function (...args) {
      pushState.apply(this, args);
      check();
    };
    const replaceState = history.replaceState;
    history.replaceState = function (...args) {
      replaceState.apply(this, args);
      check();
    };
    window.addEventListener("popstate", check);
    setInterval(check, 1500); // filet de sécurité
  }

  function observeDom() {
    const observer = new MutationObserver(() => {
      scheduleScan();
      const videos = document.querySelectorAll("video");
      videos.forEach(attachVideoWatcher);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === "REFRESH_MARKERS") {
      loadState().then(scanAndMark);
    }
  });

  // ---------------------------------------------------------------------
  // Démarrage
  // ---------------------------------------------------------------------

  (async function init() {
    log("Content script v1.6.0 chargé sur", location.href);
    await loadState();
    await NotionWatched.load();
    log("Réglages :", settings, "| Contenus déjà en mémoire :", Object.keys(watchedCache).length);
    scanAndMark();
    pollForVideoElement();
    trackUrlChanges();
    observeDom();
    window.addEventListener("pagehide", () => {
      const videoEl = document.querySelector("video");
      if (!videoEl || !videoEl.duration) return;
      const id = currentVideoId || extractContentId(location.href);
      const progress = Math.min(1, videoEl.currentTime / videoEl.duration);
      // Best effort uniquement : surtout, ne réécrit plus un cache complet potentiellement périmé.
      CPWMStorage.upsertItem(id, {
        progress,
        watched: progress >= settings.watchedThreshold || !!(watchedCache[id] && watchedCache[id].watched),
        title: document.title.replace(/\s*\|\s*CANAL\+.*/i, "").trim(),
        url: location.href
      }).catch(() => {});
    });
  })();
})();
