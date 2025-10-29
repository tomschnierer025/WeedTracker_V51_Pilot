/* === WeedTracker V60 Pilot - settings.js === */
/* Handles settings, data management, export/import, email save, etc. */

window.WeedSettings = (() => {
  const STG = {};

  const $ = (s) => document.querySelector(s);

  STG.init = (DB, saveDB) => {
    const emailInput = $("#accountEmail");
    const saveBtn = $("#saveAccount");
    const exportBtn = $("#exportBtn");
    const restoreBtn = $("#restoreBtn");
    const clearBtn = $("#clearBtn");

    // Load saved email
    const savedEmail = localStorage.getItem("weedtracker_user_email");
    if (savedEmail) emailInput.value = savedEmail;

    // Save email
    saveBtn.onclick = () => {
      const email = emailInput.value.trim();
      if (!email) return alert("Please enter an email first.");
      localStorage.setItem("weedtracker_user_email", email);
      alert("Email saved for backup reference.");
    };

    // Export data
    exportBtn.onclick = () => {
      const data = DB;
      WeedStorage.export(data);
    };

    // Restore from backup (local)
    restoreBtn.onclick = () => {
      const restored = WeedStorage.restore();
      if (restored) {
        Object.assign(DB, restored);
        saveDB();
        alert("Backup restored.");
        location.reload();
      }
    };

    // Clear data
    clearBtn.onclick = () => {
      WeedStorage.clear();
    };
  };

  return STG;
})();
