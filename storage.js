/* =========================================================
   WeedTracker V60 Pilot - storage.js
   Handles localStorage read/write and simple JSON backups
   ========================================================= */

const WT_PREFIX = "weedtracker_v60_";

/* ---------- Core save/load wrappers ---------- */
function saveData(key, value) {
  try {
    localStorage.setItem(WT_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error("Save error:", e);
    showToast("⚠️ Save failed");
  }
}

function loadData(key, def = null) {
  try {
    const val = localStorage.getItem(WT_PREFIX + key);
    return val ? JSON.parse(val) : def;
  } catch (e) {
    console.error("Load error:", e);
    return def;
  }
}

/* ---------- Backup / restore ---------- */
function exportAllData() {
  const exportObj = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(WT_PREFIX)) {
      exportObj[key] = localStorage.getItem(key);
    }
  }

  const blob = new Blob([JSON.stringify(exportObj, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.download = `weedtracker_backup_${stamp}.json`;
  a.click();
  showToast("💾 Backup exported");
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      Object.entries(data).forEach(([k, v]) => {
        localStorage.setItem(k, v);
      });
      showToast("♻️ Backup restored");
      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      console.error("Import failed:", err);
      showToast("❌ Restore failed");
    }
  };
  reader.readAsText(file);
}

/* ---------- Clear All ---------- */
function clearAllData() {
  if (confirm("Clear all WeedTracker data?")) {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(WT_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
    showToast("🗑️ Data cleared");
    setTimeout(() => location.reload(), 800);
  }
}

/* ---------- Generic Toast ---------- */
function showToast(msg, duration = 2000) {
  const el = document.getElementById("toast");
  if (!el) return alert(msg);
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => {
    el.style.display = "none";
  }, duration);
}

/* ---------- Spinner Overlay ---------- */
function showSpinner(show = true, text = "Working…") {
  const el = document.getElementById("spinner");
  if (!el) return;
  el.style.display = show ? "flex" : "none";
  if (show) {
    el.querySelector("span").textContent = text;
  }
}

/* ---------- Date Utilities ---------- */
function todayDate() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function nowTime() {
  const d = new Date();
  return d.toTimeString().slice(0, 5);
}

/* ---------- ID Generator ---------- */
function generateId(prefix = "WT") {
  const now = new Date();
  const stamp = `${now.getFullYear()}${(now.getMonth()+1)
    .toString().padStart(2,"0")}${now.getDate()
    .toString().padStart(2,"0")}${now.getHours()
    .toString().padStart(2,"0")}${now.getMinutes()
    .toString().padStart(2,"0")}`;
  return `${prefix}-${stamp}`;
}

/* ---------- Defaults ---------- */
function initDefaults() {
  if (!loadData("chemicals")) saveData("chemicals", []);
  if (!loadData("batches")) saveData("batches", []);
  if (!loadData("records")) saveData("records", []);
}

/* ---------- Export API ---------- */
window.WTStorage = {
  saveData,
  loadData,
  exportAllData,
  importBackup,
  clearAllData,
  showToast,
  showSpinner,
  todayDate,
  nowTime,
  generateId,
  initDefaults
};
