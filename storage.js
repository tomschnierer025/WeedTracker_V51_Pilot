/* === WeedTracker V60 Pilot — storage.js === */
window.WTStorage = (() => {
  const KEY = "weedtracker_data_v60";
  const BACKUP_KEY = "weedtracker_backup_v60";
  const MAX_BACKUPS = 3;

  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
    catch { return {}; }
  };
  const save = (db, backup = true) => {
    localStorage.setItem(KEY, JSON.stringify(db));
    if (backup) {
      try {
        const arr = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
        arr.unshift({ ts: new Date().toISOString(), db });
        while (arr.length > MAX_BACKUPS) arr.pop();
        localStorage.setItem(BACKUP_KEY, JSON.stringify(arr));
      } catch {}
    }
  };
  const clearAll = () => {
    if (!confirm("Clear all data?")) return;
    localStorage.removeItem(KEY);
    alert("All data cleared.");
    location.reload();
  };
  const exportJSON = (db) => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "weedtracker_v60_backup.json"; a.click();
    URL.revokeObjectURL(url);
  };
  const latestBackup = () => {
    try {
      const arr = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
      return arr[0]?.db || null;
    } catch { return null; }
  };
  const restoreLatest = () => {
    const db = latestBackup();
    if (!db) return null;
    localStorage.setItem(KEY, JSON.stringify(db));
    return db;
  };
  const importJSON = (cb) => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "application/json";
    inp.onchange = (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = (ev) => {
        try {
          const json = JSON.parse(ev.target.result);
          localStorage.setItem(KEY, JSON.stringify(json));
          alert("Data restored.");
          cb && cb(json);
        } catch (err) { alert("Invalid file: " + err); }
      };
      rd.readAsText(f);
    };
    inp.click();
  };

  return { load, save, clearAll, exportJSON, restoreLatest, importJSON };
})();
