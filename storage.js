// storage.js — WeedTracker V60 Pilot
// Handles saving and loading of Jobs, Batches, and Chemicals using localStorage

const Storage = {
  save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      console.error("Save error:", key, err);
    }
  },

  load(key, fallback = []) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (err) {
      console.error("Load error:", key, err);
      return fallback;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.error("Remove error:", key, err);
    }
  },

  clearAll() {
    if (confirm("Are you sure you want to clear ALL data?")) {
      localStorage.clear();
      alert("All data cleared.");
      location.reload();
    }
  }
};

// KEYS
const JOBS_KEY = "weedtracker_jobs";
const BATCHES_KEY = "weedtracker_batches";
const CHEMS_KEY = "weedtracker_chemicals";
const SETTINGS_KEY = "weedtracker_settings";
const DRAFTS_KEY = "weedtracker_drafts";

// JOBS
function loadJobs() {
  return Storage.load(JOBS_KEY, []);
}
function saveJobs(jobs) {
  Storage.save(JOBS_KEY, jobs);
}

// DRAFTS
function loadDrafts() {
  return Storage.load(DRAFTS_KEY, []);
}
function saveDrafts(drafts) {
  Storage.save(DRAFTS_KEY, drafts);
}

// BATCHES
function loadBatches() {
  return Storage.load(BATCHES_KEY, []);
}
function saveBatches(batches) {
  Storage.save(BATCHES_KEY, batches);
}

// CHEMICALS
function loadChemicals() {
  return Storage.load(CHEMS_KEY, []);
}
function saveChemicals(chems) {
  Storage.save(CHEMS_KEY, chems);
}

// SETTINGS
function loadSettings() {
  return Storage.load(SETTINGS_KEY, {});
}
function saveSettings(obj) {
  Storage.save(SETTINGS_KEY, obj);
}

// UTILITIES
function generateId(prefix) {
  const id = prefix + "_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  return id.toUpperCase();
}

function backupAllData() {
  const backup = {
    jobs: loadJobs(),
    batches: loadBatches(),
    chemicals: loadChemicals(),
    drafts: loadDrafts(),
    settings: loadSettings(),
    timestamp: new Date().toISOString()
  };
  Storage.save("weedtracker_backup", backup);
  return backup;
}

function restoreBackup() {
  const b = Storage.load("weedtracker_backup", null);
  if (!b) {
    alert("No backup found.");
    return;
  }
  if (!confirm("Restore latest backup? This will overwrite existing data.")) return;
  Storage.save(JOBS_KEY, b.jobs);
  Storage.save(BATCHES_KEY, b.batches);
  Storage.save(CHEMS_KEY, b.chemicals);
  Storage.save(DRAFTS_KEY, b.drafts);
  Storage.save(SETTINGS_KEY, b.settings);
  alert("Backup restored successfully.");
  location.reload();
}

// EXPOSE
window.Storage = Storage;
window.loadJobs = loadJobs;
window.saveJobs = saveJobs;
window.loadBatches = loadBatches;
window.saveBatches = saveBatches;
window.loadChemicals = loadChemicals;
window.saveChemicals = saveChemicals;
window.loadSettings = loadSettings;
window.saveSettings = saveSettings;
window.generateId = generateId;
window.backupAllData = backupAllData;
window.restoreBackup = restoreBackup;
window.loadDrafts = loadDrafts;
window.saveDrafts = saveDrafts;
