(() => {
  const STORAGE_KEY = "notionWatched";
  let current = { movies: [], importedAt: "", sourceName: "" };
  let index = new Map();

  const stripDiacritics = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normalizeTitle = value => stripDiacritics(value)
    .toLocaleLowerCase("fr")
    .replace(/&/g, " et ")
    .replace(/[’'`´]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:film|movie)\b$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const cleanupPlatformTitle = value => String(value || "")
    .replace(/\s*[|–—-]\s*(?:Netflix|Disney\+|Prime Video|Amazon Prime Video|CANAL\+|myCANAL).*$/i, "")
    .replace(/^(?:Prime Video|Netflix|Disney\+|CANAL\+|myCANAL)\s*[:|-]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const extractYear = value => String(value || "").match(/(?:19|20)\d{2}/)?.[0] || "";

  function rebuild() {
    index = new Map();
    for (const movie of current.movies || []) {
      for (const alias of new Set([movie.title, movie.originalTitle].map(normalizeTitle).filter(Boolean))) {
        if (!index.has(alias)) index.set(alias, []);
        index.get(alias).push(movie);
      }
    }
  }

  async function load() {
    const data = await browser.storage.local.get(STORAGE_KEY);
    current = data[STORAGE_KEY] || { movies: [], importedAt: "", sourceName: "" };
    rebuild();
    return current;
  }

  function match(title, year = "") {
    const cleaned = cleanupPlatformTitle(title);
    const normalized = normalizeTitle(cleaned);
    if (!normalized) return null;
    const candidates = index.get(normalized) || [];
    if (!candidates.length) return null;
    const detectedYear = extractYear(year || cleaned);
    if (detectedYear) {
      const exact = candidates.find(movie => !movie.year || movie.year === detectedYear);
      if (exact) return exact;
    }
    return candidates[0] || null;
  }

  function parseDelimited(text) {
    const input = String(text || "").replace(/^\uFEFF/, "");
    const firstLine = input.split(/\r?\n/, 1)[0] || "";
    const countOutsideQuotes = (line, separator) => {
      let count = 0, quoted = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (quoted && line[i + 1] === '"') i++;
          else quoted = !quoted;
        } else if (!quoted && c === separator) count++;
      }
      return count;
    };
    const separator = countOutsideQuotes(firstLine, ";") > countOutsideQuotes(firstLine, ",") ? ";" : ",";
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i <= input.length; i++) {
      const c = input[i] ?? "\n";
      if (quoted) {
        if (c === '"' && input[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') quoted = false;
        else field += c;
      } else if (c === '"') quoted = true;
      else if (c === separator) { row.push(field); field = ""; }
      else if (c === "\n") {
        row.push(field.replace(/\r$/, "")); field = "";
        if (row.some(value => value.trim())) rows.push(row);
        row = [];
      } else field += c;
    }
    return rows;
  }

  const truthySeen = value => {
    const normalized = normalizeTitle(value);
    return ["yes", "oui", "true", "vrai", "1", "x", "checked", "check", "vu", "__yes__"].includes(normalized)
      || ["✓", "✔", "☑"].some(symbol => String(value || "").includes(symbol));
  };

  function fromCsv(text, sourceName) {
    const rows = parseDelimited(text);
    if (rows.length < 2) throw new Error("Le CSV ne contient aucune ligne de film.");
    const headers = rows[0].map(normalizeTitle);
    const indexOf = (...names) => headers.findIndex(header => names.map(normalizeTitle).includes(header));
    const titleIndex = indexOf("Titre", "Name", "Nom");
    const originalIndex = indexOf("Titre originel", "Titre original", "Original title");
    const yearIndex = indexOf("Année", "Annee", "Year");
    const watchedIndex = indexOf("Vu", "Watched", "Seen");
    if (titleIndex < 0 && originalIndex < 0) throw new Error("Colonnes « Titre » / « Titre originel » introuvables.");
    const movies = [];
    for (const row of rows.slice(1)) {
      if (watchedIndex >= 0 && !truthySeen(row[watchedIndex])) continue;
      const title = String(row[titleIndex] || "").trim();
      const originalTitle = String(row[originalIndex] || "").trim();
      const year = extractYear(row[yearIndex]);
      if (title || originalTitle) movies.push({ title, originalTitle, year });
    }
    return { movies, sourceName, importedAt: new Date().toISOString() };
  }

  function fromJson(text, sourceName) {
    const data = JSON.parse(text);
    const rows = Array.isArray(data) ? data : Array.isArray(data.movies) ? data.movies : Array.isArray(data.results) ? data.results : null;
    if (!rows) throw new Error("Format JSON Notion non reconnu.");
    const movies = [];
    for (const row of rows) {
      const watchedRaw = row.Vu ?? row.watched ?? row.seen;
      if (watchedRaw != null && watchedRaw !== true && !truthySeen(watchedRaw)) continue;
      const title = String(row.title ?? row.Titre ?? row.Name ?? row.name ?? "").trim();
      const originalTitle = String(row.originalTitle ?? row["Titre originel"] ?? row.original_title ?? "").trim();
      const year = extractYear(row.year ?? row["Année"] ?? row.annee ?? "");
      if (title || originalTitle) movies.push({ title, originalTitle, year });
    }
    return { movies, sourceName, importedAt: new Date().toISOString() };
  }

  async function parseFile(file) {
    if (!file) throw new Error("Aucun fichier sélectionné.");
    const text = await file.text();
    return file.name.toLowerCase().endsWith(".json") ? fromJson(text, file.name) : fromCsv(text, file.name);
  }

  async function replace(payload) {
    const unique = new Map();
    for (const movie of payload.movies || []) {
      const key = `${normalizeTitle(movie.title)}|${normalizeTitle(movie.originalTitle)}|${movie.year || ""}`;
      if (key !== "||") unique.set(key, movie);
    }
    current = { movies: [...unique.values()], importedAt: payload.importedAt || new Date().toISOString(), sourceName: payload.sourceName || "Export Notion" };
    await browser.storage.local.set({ [STORAGE_KEY]: current });
    rebuild();
    return current;
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
    current = changes[STORAGE_KEY].newValue || { movies: [], importedAt: "", sourceName: "" };
    rebuild();
  });

  globalThis.NotionWatched = { STORAGE_KEY, normalizeTitle, cleanupPlatformTitle, extractYear, load, match, parseFile, replace, get state() { return current; } };
})();
