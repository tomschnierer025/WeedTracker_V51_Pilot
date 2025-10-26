/* ===== WeedTracker V60 Pilot — storage.js ===== */
(() => {
  const KEY = 'weedtracker_v60';

  const seed = {
    version: 'v60',
    tasks: [],
    batches: [],
    chemicals: [
      { id: 'chem1', name: 'Bow Saw 600', unit: 'L', containerSize: 1, containers: 2, reorder: 1, active: 'Triclopyr 600 g/L' },
      { id: 'chem2', name: 'Clethodim', unit: 'L', containerSize: 20, containers: 1, reorder: 1, active: 'Clethodim 240 g/L' },
      { id: 'chem3', name: 'Crucial', unit: 'L', containerSize: 20, containers: 4, reorder: 1, active: 'Glyphosate 540 g/L' }
    ],
    procurement: [],
    settings: { theme: 'dark' }
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : structuredClone(seed);
    } catch {
      return structuredClone(seed);
    }
  }

  function save(db) {
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  // public api
  window.DB = {
    get: () => load(),
    set: (db) => save(db),
    reset: () => { localStorage.removeItem(KEY); return load(); },
    export: () => new Blob([JSON.stringify(load(), null, 2)], { type: 'application/json' }),
    import: async (file) => {
      const txt = await file.text();
      localStorage.setItem(KEY, txt);
      return load();
    }
  };
})();
