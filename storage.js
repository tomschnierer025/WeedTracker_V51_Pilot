START storage.js
/* === WeedTracker V60 Pilot - storage.js === */
/* Local storage handling, saving, restoring, export/import logic */

window.WeedStorage = (() => {
  const ST = {};
  const KEY = "weedtracker_data_v60";

  // Load data safely
  ST.load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { tasks: [], batches: [], chems: [], procurement: [] };
      const parsed = JSON.parse(raw);
      if (!parsed.tasks) parsed.tasks = [];
      if (!parsed.batches) parsed.batches = [];
      if (!parsed.chems) parsed.chems = [];
      if (!parsed.procurement) parsed.procurement = [];
      return parsed;
    } catch (err) {
      console.warn("Storage load error", err);
      return { tasks: [], batches: [], chems: [], procurement: [] };
    }
  };

  // Save data safely
  ST.save = (data) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      console.log("✅ WeedTracker data saved");
    } catch (err) {
      alert("Save error: " + err.message);
    }
  };

  // Clear all
  ST.clear = () => {
    if (!confirm("Are you sure you want to clear ALL WeedTracker data?")) return;
    localStorage.removeItem(KEY);
    alert("All WeedTracker data cleared.");
    location.reload();
  };

  // Export JSON backup
  ST.export = (data) => {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `weedtracker_backup_${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert("Backup exported successfully.");
    } catch (err) {
      alert("Export failed: " + err.message);
    }
  };

  // Import JSON backup
  ST.import = (callback) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (r) => {
        try {
          const json = JSON.parse(r.target.result);
          localStorage.setItem(KEY, JSON.stringify(json));
          alert("Data restored successfully. App will now reload.");
          if (callback) callback(json);
          setTimeout(() => location.reload(), 500);
        } catch (err) {
          alert("Import failed: " + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Auto-backup once daily
  ST.autoBackup = (data) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const backupKey = `${KEY}_backup_${today}`;
      if (!localStorage.getItem(backupKey)) {
        localStorage.setItem(backupKey, JSON.stringify(data));
        console.log("📦 Auto-backup created:", backupKey);
      }
    } catch (err) {
      console.warn("Auto-backup failed", err);
    }
  };

  return ST;
})();
END storage.js
