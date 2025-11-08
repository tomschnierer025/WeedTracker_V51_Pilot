/* === WeedTracker V60 Pilot — settings.js ===
 * Handles user account preferences, data export, import, and clearing.
 * Integrates with WeedStorage module for full persistence management.
 */

window.WeedSettings = (() => {
  const S = {};

  S.init = (DB, saveDB, renderAll) => {
    const emailInput = document.getElementById("accountEmail");
    const saveBtn = document.getElementById("saveAccount");
    const exportBtn = document.getElementById("exportBtn");
    const restoreBtn = document.getElementById("restoreBtn");
    const clearBtn = document.getElementById("clearBtn");

    // Load stored email
    emailInput.value = DB.accountEmail || "";

    saveBtn.onclick = () => {
      DB.accountEmail = emailInput.value.trim();
      saveDB();
      alert("Email saved.");
    };

    exportBtn.onclick = () => {
      WeedStorage.export(DB);
    };

    restoreBtn.onclick = () => {
      WeedStorage.import((newDB) => {
        Object.assign(DB, newDB);
        saveDB();
        renderAll();
      });
    };

    clearBtn.onclick = () => {
      if (!confirm("Are you sure you want to clear ALL local data?")) return;
      localStorage.removeItem("weedtracker_data_v60");
      alert("All data cleared.");
      location.reload();
    };
  };

  return S;
})();
