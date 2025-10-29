/* === WeedTracker V60.4 Pilot - storage.js === */
/* Handles saving, loading, exporting, importing all app data */

window.WeedStorage = (() => {
  const ST = {};
  const KEY = "weedtracker_v60_4";

  /* ===== Load data ===== */
  ST.load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        return {
          tasks: [],
          batches: [],
          chems: [],
          procurement: [],
          accountEmail: ""
        };
      }
      return JSON.parse(raw);
    } catch (e) {
      console.warn("Load error", e);
      return {
        tasks: [],
        batches: [],
        chems: [],
        procurement: [],
        accountEmail: ""
      };
    }
  };

  /* ===== Save data ===== */
  ST.save = (data) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      console.log("✅ Data saved");
    } catch (e) {
      alert("Save error: " + e.message);
    }
  };

  /* ===== Export backup ===== */
  ST.export = (data) => {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "WeedTracker_Backup_V60.4.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Export failed: " + e.message);
    }
  };

  /* ===== Import backup ===== */
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
          alert("Import failed: " + err.message);
        }
      };
      reader.readAsText(file);
    };
    inp.click();
  };

  /* ===== Clear data ===== */
  ST.clear = () => {
    if (!confirm("⚠️ Are you sure you want to clear ALL data? This cannot be undone.")) return;
    localStorage.removeItem(KEY);
    alert("🧹 All data cleared.");
    location.reload();
  };

  return ST;
})();
