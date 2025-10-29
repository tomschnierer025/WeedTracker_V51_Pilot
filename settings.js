/* === WeedTracker V60.4 Pilot - settings.js === */
/* Handles backup, export/import, clear, and email persistence */

window.WeedSettings = (() => {
  const ST = {};
  const KEY = "weedtracker_v60_4";

  ST.init = (DB, saveDB, renderAll) => {
    const emailInput = document.getElementById("accountEmail");
    const saveBtn = document.getElementById("saveAccount");
    const exportBtn = document.getElementById("exportBtn");
    const restoreBtn = document.getElementById("restoreBtn");
    const clearBtn = document.getElementById("clearBtn");

    if (emailInput) emailInput.value = DB.accountEmail || "";

    if (saveBtn) {
      saveBtn.onclick = () => {
        DB.accountEmail = emailInput.value.trim();
        saveDB();
        alert("✅ Account email saved.");
      };
    }

    if (exportBtn) {
      exportBtn.onclick = () => {
        try {
          const blob = new Blob([JSON.stringify(DB, null, 2)], { type: "application/json" });
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
    }

    if (restoreBtn) {
      restoreBtn.onclick = () => {
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
              renderAll();
            } catch (err) {
              alert("Restore failed: " + err.message);
            }
          };
          reader.readAsText(file);
        };
        inp.click();
      };
    }

    if (clearBtn) {
      clearBtn.onclick = () => {
        if (!confirm("⚠️ Are you sure you want to clear all WeedTracker data?")) return;
        localStorage.removeItem(KEY);
        alert("🧹 Data cleared.");
        location.reload();
      };
    }
  };

  return ST;
})();
