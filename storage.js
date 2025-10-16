/* === WeedTracker V57 Local Storage Manager === */

(function(){
  const STORAGE_KEY = "weedtracker_data";
  const BACKUP_KEY  = "weedtracker_backup";
  const MAX_BACKUPS = 3;

  window.WTStorage = {
    get() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      } catch {
        return {};
      }
    },
    save(data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      this.backup(data);
    },
    backup(data) {
      try {
        const backups = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
        backups.unshift({ ts: new Date().toISOString(), data });
        while (backups.length > MAX_BACKUPS) backups.pop();
        localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
      } catch(e){ console.warn("Backup failed", e); }
    },
    restoreLatest() {
      const stacks = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
      if (!stacks.length) return null;
      const latest = stacks[0].data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(latest));
      return latest;
    },
    clear() {
      localStorage.removeItem(STORAGE_KEY);
    },
    export() {
      const db = this.get();
      const blob = new Blob([JSON.stringify(db,null,2)], {type: "application/json"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "weedtracker_data.json";
      a.click();
    },
    import(jsonStr) {
      try {
        const data = JSON.parse(jsonStr);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
      } catch { return false; }
    }
  };
})();
