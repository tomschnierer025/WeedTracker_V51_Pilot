/* === WeedTracker V60 Pilot — storage.js ===
   Handles: Local Storage, Backups, Restore, DB Structure
*/

(function() {
  const STORAGE_KEY = "weedtracker_data";
  const BACKUP_KEY  = "weedtracker_backup";
  const MAX_BACKUPS = 3;

  // Initialize database structure
  function ensureDB() {
    let db;
    try {
      db = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      db = {};
    }
    db.version ??= 60;
    db.accountEmail ??= "";
    db.tasks ??= [];
    db.batches ??= [];
    db.chems ??= [];
    db.procurement ??= [];
    db.weeds ??= [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return db;
  }

  // Backup rotation
  function backupDB(db) {
    try {
      const arr = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
      arr.unshift({ ts: new Date().toISOString(), db });
      while (arr.length > MAX_BACKUPS) arr.pop();
      localStorage.setItem(BACKUP_KEY, JSON.stringify(arr));
    } catch (e) {
      console.warn("Backup failed", e);
    }
  }

  // Restore latest backup
  function restoreLatest() {
    const arr = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
    if (!arr.length) return null;
    const latest = arr[0].db;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(latest));
    return latest;
  }

  // Export / Import helpers
  function exportDB() {
    const db = localStorage.getItem(STORAGE_KEY) || "{}";
    const blob = new Blob([db], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "weedtracker_data.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importDB(json) {
    try {
      const db = JSON.parse(json);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      return true;
    } catch {
      return false;
    }
  }

  // Expose globally
  window.WeedDB = {
    STORAGE_KEY,
    BACKUP_KEY,
    ensureDB,
    backupDB,
    restoreLatest,
    exportDB,
    importDB
  };
})();
