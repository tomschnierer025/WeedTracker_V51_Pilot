/* === WeedTracker V60 Pilot — settings.js ===
 * Handles: user preferences, account info, data export/restore, dark mode, etc.
 * Fully integrated with storage.js helpers.
 */

function loadSettings() {
  try { return JSON.parse(localStorage.getItem("weedtracker_settings") || "{}"); }
  catch { return {}; }
}
function saveSettings(obj) {
  localStorage.setItem("weedtracker_settings", JSON.stringify(obj || {}));
}

function toggleDarkMode(enable) {
  document.body.classList.toggle("dark", enable);
  const s = loadSettings();
  s.darkMode = enable;
  saveSettings(s);
}

// Restore saved theme on load
document.addEventListener("DOMContentLoaded", () => {
  const s = loadSettings();
  if (s.darkMode) document.body.classList.add("dark");
  const chk = document.getElementById("darkModeToggle");
  if (chk) {
    chk.checked = !!s.darkMode;
    chk.onchange = e => toggleDarkMode(e.target.checked);
  }
});

// Export & Restore JSON backup (hooked from settings screen)
function restoreBackup() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.jobs) saveJobs(data.jobs);
        if (data.batches) saveBatches(data.batches);
        if (data.chemicals) saveChemicals(data.chemicals);
        if (data.settings) saveSettings(data.settings);
        showToast("Backup restored");
      } catch(err) {
        alert("Invalid file");
      }
    };
    reader.readAsText(f);
  };
  input.click();
}

// Clear All Storage (with confirmation)
const Storage = {
  clearAll() {
    if (!confirm("Clear all data?")) return;
    localStorage.clear();
    showToast("All data cleared");
    setTimeout(()=>location.reload(),1000);
  }
};

console.log("✅ settings.js loaded");
