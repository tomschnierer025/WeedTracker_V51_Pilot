// ===============================
// WeedTracker V60 Pilot Final
// STORAGE.JS
// ===============================

const STORAGE_KEYS = {
  JOBS: "wt_jobs",
  DRAFTS: "wt_drafts",
  CHEMS: "wt_chems",
  BATCHES: "wt_batches",
  SETTINGS: "wt_settings"
};

// Generic save/load wrappers
function saveData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}
function loadData(key, fallback = []) {
  try {
    const d = JSON.parse(localStorage.getItem(key));
    return Array.isArray(d) || typeof d === "object" ? d : fallback;
  } catch {
    return fallback;
  }
}

// JOBS
function getJobs() { return loadData(STORAGE_KEYS.JOBS); }
function setJobs(data) { saveData(STORAGE_KEYS.JOBS, data); }

// DRAFTS
function getDrafts() { return loadData(STORAGE_KEYS.DRAFTS); }
function setDrafts(data) { saveData(STORAGE_KEYS.DRAFTS, data); }

// CHEMICALS
function getChemicals() { return loadData(STORAGE_KEYS.CHEMS); }
function setChemicals(data) { saveData(STORAGE_KEYS.CHEMS, data); }

// BATCHES
function getBatches() { return loadData(STORAGE_KEYS.BATCHES); }
function setBatches(data) { saveData(STORAGE_KEYS.BATCHES, data); }

// SETTINGS
function getSettings() { return loadData(STORAGE_KEYS.SETTINGS, {
  darkMode: true,
  notifyReminders: true
}); }
function setSettings(d) { saveData(STORAGE_KEYS.SETTINGS, d); }

// UTILITIES
function clearAll() {
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  toast("All data cleared 🧹");
}

function exportAll() {
  const data = {};
  for (const k of Object.keys(STORAGE_KEYS)) data[k] = loadData(k);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "weedtracker_backup.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast("Export ready ⬇️");
}

// Reminder utility
function checkReminders() {
  const jobs = getJobs();
  const now = new Date();
  jobs.forEach(j => {
    if (j.reminderDate && new Date(j.reminderDate) <= now && !j.reminderShown) {
      j.reminderShown = true;
      toast(`🔔 Reminder due: ${j.jobName}`);
    }
  });
  setJobs(jobs);
}
setInterval(checkReminders, 1000 * 60 * 60); // hourly
