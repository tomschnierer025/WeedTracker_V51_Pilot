/* === WeedTracker V60 Pilot — storage.js ===
 * Handles saving, loading, exporting, importing, and clearing local data.
 * Matches with full apps.js build.
 */

window.WeedStorage = (() => {
  const ST = {};
  const KEY = "weedtracker_data_v60_full";
  const BACKUP_KEY = "weedtracker_backups_v60";
  const MAX_BACKUPS = 5;

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

  ST.save = (data, withBackup = true) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      if (withBackup) {
        const backups = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
        backups.unshift({ ts: new Date().toISOString(), data });
        while (backups.length > MAX_BACKUPS) backups.pop();
        localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
      }
      console.log("Data saved successfully.");
    } catch (e) {
      alert("Save error: " + e);
    }
  };

  ST.backups = () => {
    try {
      return JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
    } catch {
      return [];
    }
  };

  ST.restore = (index = 0) => {
    try {
      const backups = ST.backups();
      if (!backups[index]) return null;
      const data = backups[index].data;
      localStorage.setItem(KEY, JSON.stringify(data));
      alert("Backup restored.");
      return data;
    } catch (e) {
      alert("Restore failed: " + e);
      return null;
    }
  };

  ST.clear = () => {
    if (!confirm("Clear all WeedTracker data?")) return;
    localStorage.removeItem(KEY);
    alert("All data cleared.");
    location.reload();
  };

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

  return ST;
})();
