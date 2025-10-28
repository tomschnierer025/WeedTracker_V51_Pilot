/* === WeedTracker V60 Pilot - storage.js === */
/* Handles localStorage operations and backup/export/import */

window.WeedStorage = (() => {
  const ST = {};
  const KEY = "weedtracker_v60_data";

  ST.load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { tasks: [], batches: [], chems: [], procurement: [] };
      return JSON.parse(raw);
    } catch (e) {
      console.warn("Load error", e);
      return { tasks: [], batches: [], chems: [], procurement: [] };
    }
  };

  ST.save = (data) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      console.log("✅ Data saved");
    } catch (e) {
      alert("Save error: " + e);
    }
  };

  ST.export = (data) => {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "weedtracker_v60_backup.json";
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
          alert("✅ Data restored successfully.");
          if (callback) callback(json);
        } catch (err) {
          alert("Import failed: " + err);
        }
      };
      reader.readAsText(file);
    };
    inp.click();
  };

  ST.clear = () => {
    if (!confirm("Clear ALL data? This cannot be undone.")) return;
    localStorage.removeItem(KEY);
    alert("All WeedTracker data cleared.");
    location.reload();
  };

  return ST;
})();
