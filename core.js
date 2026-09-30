(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CPWMCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function stripDiacritics(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function normalizeTitle(value) {
    return stripDiacritics(value)
      .toLocaleLowerCase("fr")
      .replace(/&/g, " et ")
      .replace(/[’'\x60´]/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\b(?:film|movie)\b$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanupPlatformTitle(value) {
    return String(value || "")
      .replace(/\s*[|–—-]\s*(?:Netflix|Disney\+|Prime Video|Amazon Prime Video|CANAL\+|myCANAL).*$/i, "")
      .replace(/^(?:Prime Video|Netflix|Disney\+|CANAL\+|myCANAL)\s*[:|-]\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractYear(value) {
    return String(value || "").match(/(?:19|20)\d{2}/)?.[0] || "";
  }

  function extractContentId(rawUrl, baseUrl = "https://www.canalplus.com/") {
    try {
      const u = new URL(rawUrl, baseUrl);
      const path = u.pathname.replace(/\/+$/, "");
      const hMatch = path.match(/\/h\/([a-zA-Z0-9_-]+)/);
      if (hMatch) return `h:${hMatch[1]}`;

      const idMatch = path.match(/\/(\d{4,})(?:[/?]|$)/);
      if (idMatch) return `id:${idMatch[1]}`;

      return `path:${path}`;
    } catch {
      return `raw:${rawUrl}`;
    }
  }

  function normalizeCanalContentKey(value) {
    const id = String(value || "").trim();
    if (!id) return "";
    if (/^(?:path|raw|h|id):/i.test(id)) {
      const prefix = id.slice(0, id.indexOf(":")).toLowerCase();
      return `${prefix}:${id.slice(id.indexOf(":") + 1)}`;
    }
    if (/^[a-zA-Z0-9_-]+_[a-zA-Z0-9_-]+$/.test(id)) return `h:${id}`;
    if (/^\d{4,}$/.test(id)) return `id:${id}`;
    return id;
  }

  function extractSeriesId(rawUrl, baseUrl = "https://www.canalplus.com/") {
    try {
      const u = new URL(rawUrl, baseUrl);
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) return `series:${parts[0]}:${parts[1]}`;
      return null;
    } catch {
      return null;
    }
  }

  function isEpisodeUrl(rawUrl) {
    return /saison|season|episode|\/s\d+\/e\d+|\/s\d+e\d+/i.test(String(rawUrl || ""));
  }

  function normalizeProgress(value, watched, status) {
    if (watched === true || status === "watched") return 1;
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n > 1 ? n / 100 : n));
  }

  function contentIdAlias(id) {
    const normalized = normalizeCanalContentKey(id);
    return normalized ? `content:${normalized}` : "";
  }

  function buildContentAliases({ id = "", title = "", originalTitle = "", year = "" } = {}) {
    const aliases = [];
    const idAlias = contentIdAlias(id);
    if (idAlias) aliases.push(idAlias);

    const detectedYear = extractYear(year || title || originalTitle);
    const names = new Set(
      [cleanupPlatformTitle(title), cleanupPlatformTitle(originalTitle)]
        .map(normalizeTitle)
        .filter(Boolean)
    );

    for (const normalized of names) {
      if (detectedYear) aliases.push(`title-year:${normalized}:${detectedYear}`);
      aliases.push(`title:${normalized}`);
    }

    return [...new Set(aliases)];
  }

  return {
    stripDiacritics,
    normalizeTitle,
    cleanupPlatformTitle,
    extractYear,
    extractContentId,
    normalizeCanalContentKey,
    extractSeriesId,
    isEpisodeUrl,
    normalizeProgress,
    contentIdAlias,
    buildContentAliases
  };
});
