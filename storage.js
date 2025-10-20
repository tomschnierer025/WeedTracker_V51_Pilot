/* === WeedTracker V60 Final Pilot — storage.js === */

// 🌿 Data Keys
const STORE_KEYS = {
  JOBS: "weed_jobs",
  DRAFTS: "weed_drafts",
  BATCHES: "weed_batches",
  CHEMS: "weed_chems"
};

// 🌿 Save & Load helpers
function saveData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}
function loadData(key) {
  return JSON.parse(localStorage.getItem(key) || "[]");
}

// 🌿 Add Item (auto ID)
function addItem(key, obj) {
  const list = loadData(key);
  obj.id = Date.now();
  list.push(obj);
  saveData(key, list);
  return obj.id;
}

// 🌿 Update Item
function updateItem(key, id, updates) {
  const list = loadData(key);
  const i = list.findIndex(x => x.id === id);
  if (i >= 0) {
    list[i] = { ...list[i], ...updates };
    saveData(key, list);
  }
}

// 🌿 Remove Item
function removeItem(key, id) {
  let list = loadData(key);
  list = list.filter(x => x.id !== id);
  saveData(key, list);
}

// 🌿 Job persistence
function saveJob(job) {
  const id = addItem(STORE_KEYS.JOBS, job);
  showToast("✅ Job saved");
  return id;
}
function listJobs() {
  return loadData(STORE_KEYS.JOBS);
}

// 🌿 Draft persistence
function saveDraft(job) {
  const id = addItem(STORE_KEYS.DRAFTS, job);
  showToast("💾 Draft saved");
  return id;
}
function listDrafts() {
  return loadData(STORE_KEYS.DRAFTS);
}

// 🌿 Batch persistence
function saveBatch(batch) {
  batch.timestamp = new Date().toLocaleString();
  const id = addItem(STORE_KEYS.BATCHES, batch);
  showToast("🧴 Batch created");
  return id;
}
function listBatches() {
  return loadData(STORE_KEYS.BATCHES);
}

// 🌿 Chemical persistence
function saveChemical(chem) {
  const id = addItem(STORE_KEYS.CHEMS, chem);
  showToast("🧪 Chemical added");
  return id;
}
function listChems() {
  return loadData(STORE_KEYS.CHEMS);
}

// 🌿 Threshold check
function checkChemThresholds() {
  const chems = listChems();
  chems.forEach(c => {
    if (c.count <= c.threshold) {
      showToast(`⚠️ Low stock: ${c.name}`);
    }
  });
}

// 🌿 Link Batches ↔ Jobs
function linkBatchToJob(batchId, jobId) {
  const jobs = loadData(STORE_KEYS.JOBS);
  const batches = loadData(STORE_KEYS.BATCHES);
  const job = jobs.find(j => j.id === jobId);
  const batch = batches.find(b => b.id === batchId);
  if (job && batch) {
    job.batchId = batchId;
    batch.jobIds = batch.jobIds || [];
    batch.jobIds.push(jobId);
    saveData(STORE_KEYS.JOBS, jobs);
    saveData(STORE_KEYS.BATCHES, batches);
  }
}

// 🌿 Export & Import
function exportAllData() {
  const data = {
    jobs: loadData(STORE_KEYS.JOBS),
    drafts: loadData(STORE_KEYS.DRAFTS),
    batches: loadData(STORE_KEYS.BATCHES),
    chems: loadData(STORE_KEYS.CHEMS)
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "weedtracker_backup.json";
  a.click();
  showToast("⬇️ Data exported");
}
function importAllData(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const obj = JSON.parse(e.target.result);
    if (obj.jobs) saveData(STORE_KEYS.JOBS, obj.jobs);
    if (obj.drafts) saveData(STORE_KEYS.DRAFTS, obj.drafts);
    if (obj.batches) saveData(STORE_KEYS.BATCHES, obj.batches);
    if (obj.chems) saveData(STORE_KEYS.CHEMS, obj.chems);
    showToast("♻️ Data restored");
  };
  reader.readAsText(file);
}

// 🌿 Clear All
function clearAll() {
  Object.values(STORE_KEYS).forEach(k => localStorage.removeItem(k));
  showToast("🗑️ All data cleared");
}

// 🌿 Reminder intervals
function populateReminderWeeks(sel) {
  const options = [0,1,2,3,4,6,8,12,16,20,24];
  sel.innerHTML = "";
  options.forEach(w=>{
    const o=document.createElement("option");
    o.value=w; o.text=`${w===0?"None":w+" weeks"}`;
    sel.appendChild(o);
  });
}

// 🌿 Exports
window.saveData=saveData;
window.loadData=loadData;
window.addItem=addItem;
window.updateItem=updateItem;
window.removeItem=removeItem;
window.saveJob=saveJob;
window.listJobs=listJobs;
window.saveDraft=saveDraft;
window.listDrafts=listDrafts;
window.saveBatch=saveBatch;
window.listBatches=listBatches;
window.saveChemical=saveChemical;
window.listChems=listChems;
window.checkChemThresholds=checkChemThresholds;
window.linkBatchToJob=linkBatchToJob;
window.exportAllData=exportAllData;
window.importAllData=importAllData;
window.clearAll=clearAll;
window.populateReminderWeeks=populateReminderWeeks;
