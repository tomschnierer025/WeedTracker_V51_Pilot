// WeedTracker V62 Final Pilot — storage.js
// Handles saving, loading, backup, and restore of local data

const WT_STORAGE_KEYS = {
  JOBS: "weedtracker_jobs",
  BATCHES: "weedtracker_batches",
  CHEMS: "weedtracker_chems",
  BACKUP: "weedtracker_backup",
  ACCOUNT: "weedtracker_account"
};

// ---------- Basic localStorage Helpers ----------
function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadData(key) {
  const val = localStorage.getItem(key);
  return val ? JSON.parse(val) : [];
}

function saveAccountEmail(email) {
  localStorage.setItem(WT_STORAGE_KEYS.ACCOUNT, email);
}

function getAccountEmail() {
  return localStorage.getItem(WT_STORAGE_KEYS.ACCOUNT) || "";
}

// ---------- Job Functions ----------
function saveJob(job) {
  const jobs = loadData(WT_STORAGE_KEYS.JOBS);
  const existingIndex = jobs.findIndex(j => j.id === job.id);
  if (existingIndex >= 0) jobs[existingIndex] = job;
  else jobs.push(job);
  saveData(WT_STORAGE_KEYS.JOBS, jobs);
  createBackup();
}

function deleteJob(id) {
  const jobs = loadData(WT_STORAGE_KEYS.JOBS).filter(j => j.id !== id);
  saveData(WT_STORAGE_KEYS.JOBS, jobs);
  createBackup();
}

function getAllJobs() {
  return loadData(WT_STORAGE_KEYS.JOBS);
}

// ---------- Batch Functions ----------
function saveBatch(batch) {
  const batches = loadData(WT_STORAGE_KEYS.BATCHES);
  const existingIndex = batches.findIndex(b => b.id === batch.id);
  if (existingIndex >= 0) batches[existingIndex] = batch;
  else batches.push(batch);
  saveData(WT_STORAGE_KEYS.BATCHES, batches);
  createBackup();
}

function deleteBatch(id) {
  const batches = loadData(WT_STORAGE_KEYS.BATCHES).filter(b => b.id !== id);
  saveData(WT_STORAGE_KEYS.BATCHES, batches);
  createBackup();
}

function getAllBatches() {
  return loadData(WT_STORAGE_KEYS.BATCHES);
}

// ---------- Chemical Inventory ----------
function saveChemical(chem) {
  const chems = loadData(WT_STORAGE_KEYS.CHEMS);
  const index = chems.findIndex(c => c.name.toLowerCase() === chem.name.toLowerCase());
  if (index >= 0) chems[index] = chem;
  else chems.push(chem);
  saveData(WT_STORAGE_KEYS.CHEMS, chems);
  createBackup();
}

function deleteChemical(name) {
  const chems = loadData(WT_STORAGE_KEYS.CHEMS).filter(c => c.name.toLowerCase() !== name.toLowerCase());
  saveData(WT_STORAGE_KEYS.CHEMS, chems);
  createBackup();
}

function getAllChemicals() {
  return loadData(WT_STORAGE_KEYS.CHEMS);
}

// ---------- Backup & Restore ----------
function createBackup() {
  const data = {
    jobs: getAllJobs(),
    batches: getAllBatches(),
    chems: getAllChemicals(),
    account: getAccountEmail(),
    timestamp: new Date().toISOString()
  };
  saveData(WT_STORAGE_KEYS.BACKUP, data);
}

function restoreBackup() {
  const backup = JSON.parse(localStorage.getItem(WT_STORAGE_KEYS.BACKUP));
  if (!backup) return false;
  if (backup.jobs) saveData(WT_STORAGE_KEYS.JOBS, backup.jobs);
  if (backup.batches) saveData(WT_STORAGE_KEYS.BATCHES, backup.batches);
  if (backup.chems) saveData(WT_STORAGE_KEYS.CHEMS, backup.chems);
  if (backup.account) saveAccountEmail(backup.account);
  return true;
}

// ---------- Export / Clear ----------
function exportData() {
  const data = {
    jobs: getAllJobs(),
    batches: getAllBatches(),
    chems: getAllChemicals(),
    backup: JSON.parse(localStorage.getItem(WT_STORAGE_KEYS.BACKUP))
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const email = getAccountEmail() || "user";
  const date = new Date().toISOString().split("T")[0];
  a.href = url;
  a.download = `WeedTrackerBackup_${email}_${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function clearAllData() {
  Object.values(WT_STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
}
