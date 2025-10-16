/* === WeedTracker V59 — Storage Wrapper (optional but included) === */
(function(){
  const STORAGE_KEY = "weedtracker_data";
  const BACKUP_KEY  = "weedtracker_backup";
  const MAX_BACKUPS = 3;

  window.WTStorage = {
    get() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
      catch { return {}; }
    },
    save(db) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      // backup
      try{
        const backups = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
        backups.unshift({ ts: new Date().toISOString(), db });
        while (backups.length > MAX_BACKUPS) backups.pop();
        localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
      }catch(e){ console.warn("Backup failed", e); }
    },
    restoreLatest(){
      const stacks = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
      if (!stacks.length) return null;
      const latest = stacks[0].db;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(latest));
      return latest;
    },
    clear(){
      localStorage.removeItem(STORAGE_KEY);
    }
  };
})();
