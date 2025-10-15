//// StartStorage
/* === storage.js — WeedTracker V57 Light Final === */

const Storage = {
  KEY: "weedtracker_data_v57",

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return { tasks: [], batches: [], chems: [], procurement: [], settings: {} };
      return JSON.parse(raw);
    } catch (e) {
      console.error("Load failed", e);
      return { tasks: [], batches: [], chems: [], procurement: [], settings: {} };
    }
  },

  save(data) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Save failed", e);
    }
  },

  clear() {
    localStorage.removeItem(this.KEY);
  },

  export(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "weedtracker_backup.json";
    a.click();
    URL.revokeObjectURL(url);
  },

  async import(file, callback) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      this.save(parsed);
      if (callback) callback(parsed);
      alert("Backup restored successfully.");
    } catch (err) {
      alert("Failed to restore backup: " + err.message);
    }
  },
};

// === Hooks ===
document.addEventListener("DOMContentLoaded", () => {
  const restoreBtn = document.getElementById("restoreBtn");
  if (restoreBtn) {
    restoreBtn.onclick = () => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = ".json";
      inp.onchange = () => {
        const file = inp.files[0];
        if (file) Storage.import(file, data => {
          localStorage.setItem(Storage.KEY, JSON.stringify(data));
          location.reload();
        });
      };
      inp.click();
    };
  }
});
//// EndStorage
