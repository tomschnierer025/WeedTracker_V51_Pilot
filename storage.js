/* === WeedTracker V60 Pilot - storage.js === */
/* Local storage, saving, restoring, export/import logic */

window.WeedStorage = (() => {
  const ST = {};
  const KEY = "weedtracker_data_v60";
  const BACKUP_KEY = "weedtracker_backup_v60";

  /* ===== LOAD ===== */
  ST.load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { tasks: [], batches: [], chems: [], procurement: [], weeds: [] };
      return JSON.parse(raw);
    } catch (e) {
      console.warn("Load error", e);
      return { tasks: [], batches: [], chems: [], procurement: [], weeds: [] };
    }
  };

  /* ===== SAVE ===== */
  ST.save = (data) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      ST.backup(data);
      console.log("Data saved to localStorage");
    } catch (e) {
      alert("Save error: " + e);
    }
  };

  /* ===== BACKUP ===== */
  ST.backup = (data) => {
    try {
      const arr = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
      arr.unshift({ ts: new Date().toISOString(), data });
      while (arr.length > 3) arr.pop();
      localStorage.setItem(BACKUP_KEY, JSON.stringify(arr));
    } catch (e) {
      console.warn("Backup failed", e);
    }
  };

  /* ===== RESTORE ===== */
  ST.restore = () => {
    try {
      const arr = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
      if (!arr.length) {
        alert("No backup found");
        return null;
      }
      const latest = arr[0].data;
      localStorage.setItem(KEY, JSON.stringify(latest));
      alert("Backup restored successfully.");
      return latest;
    } catch (e) {
      alert("Restore failed: " + e);
      return null;
    }
  };

  /* ===== EXPORT ===== */
  ST.export = (data) => {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "weedtracker_backup.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Export failed: " + e);
    }
  };

  /* ===== IMPORT ===== */
  ST.import = (callback) => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "application/json";
    inp.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (r) => {
        try {
          const json = JSON.parse(r.target.result);
          localStorage.setItem(KEY, JSON.stringify(json));
          alert("Data restored successfully.");
          if (callback) callback(json);
        } catch (err) {
          alert("Import failed: " + err);
        }
      };
      reader.readAsText(file);
    };
    inp.click();
  };

  /* ===== CLEAR ===== */
  ST.clear = () => {
    if (!confirm("Clear ALL local WeedTracker data?")) return;
    localStorage.removeItem(KEY);
    alert("All data cleared. App will reload.");
    location.reload();
  };

  return ST;
})();
