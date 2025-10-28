/* WeedTracker V60 Pilot — settings.js */
/* Manages preferences, export/import, and data clearing */

const SETTINGS_KEY = "weedtracker_settings_v60";

/* ---------- Load / Save ---------- */
function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveSettings(obj) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(obj || {}));
}

/* ---------- Dark Mode Toggle ---------- */
function toggleDarkMode(enable) {
  document.body.classList.toggle("dark", enable);
  const s = loadSettings();
  s.darkMode = enable;
  saveSettings(s);
}

/* Restore saved theme on load */
document.addEventListener("DOMContentLoaded", () => {
  const s = loadSettings();
  if (s.darkMode) document.body.classList.add("dark");
  const chk = document.getElementById("darkModeToggle");
  if (chk) {
    chk.checked = !!s.darkMode;
    chk.onchange = e => toggleDarkMode(e.target.checked);
  }

  // Bind export + clear
  document.getElementById("exportDataBtn")?.addEventListener("click", exportData);
  document.getElementById("clearDataBtn")?.addEventListener("click", clearAllData);
});

/* ---------- Restore Backup ---------- */
function restoreBackup() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.tasks && data.batches) {
          saveDB(data);
          showToast("Backup restored");
          setTimeout(() => location.reload(), 800);
        } else {
          alert("Invalid file");
        }
      } catch {
        alert("Error reading file");
      }
    };
    reader.readAsText(f);
  };
  input.click();
}

/* ---------- Clear All ---------- */
function clearAllData() {
  if (!confirm("Clear all data?")) return;
  localStorage.clear();
  showToast("All data cleared");
  setTimeout(() => location.reload(), 1000);
}

console.log("✅ settings.js loaded");
