/* === WeedTracker V61 Final Pilot — storage.js ===
   Handles: LocalStorage, backups, imports/exports, reminders, timestamps
   Safe for mobile offline use
*/

const WT_KEYS = {
  JOBS: "weedtracker_jobs",
  DRAFTS: "weedtracker_drafts",
  BATCHES: "weedtracker_batches",
  CHEMS: "weedtracker_chems",
  ACCOUNT: "weedtracker_account",
  SETTINGS: "weedtracker_settings",
  BACKUPS: "weedtracker_backups"
};

// ---- Utility Save / Load ----
function saveData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    alert("Storage full or corrupted: " + err.message);
  }
}
function loadData(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}
function clearData() {
  if (confirm("Clear ALL local WeedTracker data?")) {
    localStorage.clear();
    alert("All local data cleared.");
    location.reload();
  }
}

// ---- Job Management ----
function saveJob(job) {
  const jobs = loadData(WT_KEYS.JOBS);
  const existing = jobs.findIndex(j => j.id === job.id);
  if (existing >= 0) jobs[existing] = job;
  else jobs.push(job);
  saveData(WT_KEYS.JOBS, jobs);
}

function getJobs(filter = {}) {
  const jobs = loadData(WT_KEYS.JOBS);
  if (!Object.keys(filter).length) return jobs;
  return jobs.filter(j => {
    return Object.entries(filter).every(([k,v]) => (j[k] || "").includes(v));
  });
}

// ---- Draft Jobs ----
function saveDraft(job) {
  const drafts = loadData(WT_KEYS.DRAFTS);
  const existing = drafts.findIndex(j => j.id === job.id);
  if (existing >= 0) drafts[existing] = job;
  else drafts.push(job);
  saveData(WT_KEYS.DRAFTS, drafts);
}
function getDrafts() { return loadData(WT_KEYS.DRAFTS); }

// ---- Chemical Inventory ----
function saveChemical(chem) {
  const chems = loadData(WT_KEYS.CHEMS);
  const idx = chems.findIndex(c => c.name === chem.name);
  if (idx >= 0) chems[idx] = chem;
  else chems.push(chem);
  saveData(WT_KEYS.CHEMS, chems);
}
function getChemicals() { return loadData(WT_KEYS.CHEMS); }

// ---- Batch Management ----
function saveBatch(batch) {
  const batches = loadData(WT_KEYS.BATCHES);
  const existing = batches.findIndex(b => b.id === batch.id);
  if (existing >= 0) batches[existing] = batch;
  else batches.push(batch);
  saveData(WT_KEYS.BATCHES, batches);
}
function getBatches() { return loadData(WT_KEYS.BATCHES); }

// ---- Account / Settings ----
function saveAccount(email) {
  localStorage.setItem(WT_KEYS.ACCOUNT, email);
}
function getAccount() {
  return localStorage.getItem(WT_KEYS.ACCOUNT) || "";
}

// ---- Backups ----
function exportBackup() {
  const payload = {};
  for (const [k,v] of Object.entries(WT_KEYS)) {
    payload[k] = localStorage.getItem(v);
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `WeedTracker_Backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}
function restoreBackup(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      Object.entries(data).forEach(([key,val]) => {
        if (WT_KEYS[key]) localStorage.setItem(WT_KEYS[key], val);
      });
      alert("Backup restored!");
      location.reload();
    } catch(err) {
      alert("Restore failed: " + err.message);
    }
  };
  reader.readAsText(file);
}

// ---- Timestamp Helper ----
function nowStamp() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()} ${d.toLocaleTimeString()}`;
}

// ---- Low Stock Monitor ----
function checkLowStock() {
  const chems = getChemicals();
  const low = chems.filter(c => Number(c.count) <= Number(c.threshold || 0));
  if (low.length) {
    return low.map(c => `${c.name} below threshold`).join("\n");
  }
  return "";
}

// ---- Link Jobs ⇄ Batches ----
function linkBatchToJob(jobId, batchId) {
  const jobs = getJobs();
  const batches = getBatches();
  const job = jobs.find(j => j.id === jobId);
  const batch = batches.find(b => b.id === batchId);
  if (job && batch) {
    job.batchId = batch.id;
    batch.jobs = batch.jobs || [];
    if (!batch.jobs.includes(job.id)) batch.jobs.push(job.id);
    saveData(WT_KEYS.JOBS, jobs);
    saveData(WT_KEYS.BATCHES, batches);
  }
}
