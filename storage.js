/* === WeedTracker V56 Pilot — storage.js ===
   Centralised persistence + helpers (localStorage “database”)
*/

(function () {
  const KEY = "weedtracker_data";

  // ----- Default seed -----
  const seed = {
    version: 6,
    accountEmail: "",
    tasks: [],
    batches: [],
    chems: [],             // {name, qty, unit, lowStock, activeIngredients?:string}
    procurement: [],       // {id, name, reason, created}
    weeds: [               // kept small; apps.js can extend at runtime
      "African Lovegrass (noxious)",
      "Cape Broom (noxious)",
      "St John’s Wort (noxious)",
      "Blackberry (noxious)",
      "Patterson’s Curse",
      "Bathurst Burr",
      "Thistles (var.)",
      "Fleabane",
      "Chilean Needle Grass",
      "Sweet Briar"
    ]
  };

  // ----- load / save / merge -----
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        localStorage.setItem(KEY, JSON.stringify(seed));
        return structuredClone(seed);
      }
      const data = JSON.parse(raw);
      // basic migration guard
      if (!data.version || data.version < seed.version) {
        const merged = Object.assign({}, seed, data);
        merged.version = seed.version;
        localStorage.setItem(KEY, JSON.stringify(merged));
        return merged;
      }
      return data;
    } catch (e) {
      console.error("Load failed, resetting store", e);
      localStorage.setItem(KEY, JSON.stringify(seed));
      return structuredClone(seed);
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  // ----- API: tasks -----
  function upsertTask(task) {
    const db = load();
    const idx = db.tasks.findIndex(t => t.id === task.id || t.name === task.name);
    if (idx >= 0) db.tasks[idx] = Object.assign({}, db.tasks[idx], task);
    else db.tasks.push(task);
    save(db);
    return task;
  }

  function listTasks(filterFn) {
    const db = load();
    return filterFn ? db.tasks.filter(filterFn) : db.tasks;
  }

  // ----- API: batches -----
  function upsertBatch(batch) {
    const db = load();
    const idx = db.batches.findIndex(b => b.id === batch.id);
    if (idx >= 0) db.batches[idx] = Object.assign({}, db.batches[idx], batch);
    else db.batches.push(batch);
    save(db);
    return batch;
  }

  function listBatches(filterFn) {
    const db = load();
    return filterFn ? db.batches.filter(filterFn) : db.batches;
  }

  // ----- API: chems / inventory -----
  function upsertChem(chem) {
    // chem: {name, qty, unit, lowStock?, activeIngredients?}
    const db = load();
    const idx = db.chems.findIndex(c => c.name.toLowerCase() === chem.name.toLowerCase());
    if (idx >= 0) db.chems[idx] = Object.assign({}, db.chems[idx], chem);
    else db.chems.push(chem);

    // low-stock procurement trigger
    const c = db.chems.find(c => c.name.toLowerCase() === chem.name.toLowerCase());
    if (c && c.lowStock != null && Number(c.qty) <= Number(c.lowStock)) {
      const already = db.procurement.some(p => p.name === c.name && p.reason === "Low stock");
      if (!already) {
        db.procurement.push({
          id: "P" + Date.now(),
          name: c.name,
          reason: "Low stock",
          created: new Date().toISOString()
        });
      }
    }
    save(db);
    return chem;
  }

  function adjustChem(name, delta) {
    const db = load();
    const c = db.chems.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (!c) return null;
    c.qty = Math.max(0, Number(c.qty) + Number(delta));
    save(db);
    return c;
  }

  function listChems() {
    return load().chems;
  }

  function removeChem(name) {
    const db = load();
    db.chems = db.chems.filter(c => c.name.toLowerCase() !== name.toLowerCase());
    save(db);
  }

  // ----- API: procurement -----
  function listProc() { return load().procurement; }
  function clearProcItem(id) {
    const db = load();
    db.procurement = db.procurement.filter(p => p.id !== id);
    save(db);
  }

  // ----- API: weeds -----
  function listWeeds() { return load().weeds; }
  function addWeeds(arr) {
    const db = load();
    const set = new Set(db.weeds.map(w => w.toLowerCase()));
    arr.forEach(w => { if (!set.has(w.toLowerCase())) db.weeds.push(w); });
    save(db);
  }

  // ----- expose -----
  window.Store = {
    load, save,
    upsertTask, listTasks,
    upsertBatch, listBatches,
    upsertChem, adjustChem, listChems, removeChem,
    listProc, clearProcItem,
    listWeeds, addWeeds
  };
})();
