/* === WeedTracker V60 Final Pilot — storage.js === */

const STORE_KEYS = {
  JOBS: "weed_jobs",
  DRAFTS: "weed_drafts",
  BATCHES: "weed_batches",
  CHEMS: "weed_chems"
};

function saveData(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function loadData(key) { return JSON.parse(localStorage.getItem(key) || "[]"); }

function addItem(key, obj) { const list=loadData(key); obj.id=Date.now(); list.push(obj); saveData(key,list); return obj.id; }
function updateItem(key, id, updates) {
  const list = loadData(key); const i = list.findIndex(x => x.id === id);
  if (i >= 0) { list[i] = { ...list[i], ...updates }; saveData(key, list); }
}
function removeItem(key, id) { saveData(key, loadData(key).filter(x => x.id !== id)); }

function saveJob(job) { const id=addItem(STORE_KEYS.JOBS, job); showToast("✅ Job saved"); return id; }
function listJobs() { return loadData(STORE_KEYS.JOBS); }

function saveDraft(job) { const id=addItem(STORE_KEYS.DRAFTS, job); showToast("💾 Draft saved"); return id; }
function listDrafts() { return loadData(STORE_KEYS.DRAFTS); }

function saveBatch(batch) { batch.timestamp=new Date().toLocaleString(); const id=addItem(STORE_KEYS.BATCHES, batch); showToast("🧬 Batch created"); return id; }
function listBatches() { return loadData(STORE_KEYS.BATCHES); }

function saveChemical(chem) { const id=addItem(STORE_KEYS.CHEMS, chem); showToast("🧪 Chemical added"); return id; }
function listChems() { return loadData(STORE_KEYS.CHEMS); }

function checkChemThresholds() {
  listChems().forEach(c => { if (c.count <= c.threshold) showToast(`⚠️ Low stock: ${c.name}`); });
}

function linkBatchToJob(batchId, jobId) {
  const jobs=listJobs(), batches=listBatches();
  const job=jobs.find(j=>j.id===jobId), batch=batches.find(b=>b.id===batchId);
  if (job && batch) {
    job.batchId = batchId;
    batch.jobIds = batch.jobIds || [];
    if (!batch.jobIds.includes(jobId)) batch.jobIds.push(jobId);
    saveData(STORE_KEYS.JOBS, jobs); saveData(STORE_KEYS.BATCHES, batches);
  }
}

function exportAllData() {
  const data={ jobs:listJobs(), drafts:listDrafts(), batches:listBatches(), chems:listChems() };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url; a.download="weedtracker_backup.json"; a.click(); showToast("⬇️ Data exported");
}
function importAllData(file) {
  const reader=new FileReader();
  reader.onload=e=>{
    const obj=JSON.parse(e.target.result);
    if (obj.jobs) saveData(STORE_KEYS.JOBS,obj.jobs);
    if (obj.drafts) saveData(STORE_KEYS.DRAFTS,obj.drafts);
    if (obj.batches) saveData(STORE_KEYS.BATCHES,obj.batches);
    if (obj.chems) saveData(STORE_KEYS.CHEMS,obj.chems);
    showToast("♻️ Data restored");
  };
  reader.readAsText(file);
}

function clearAll() { Object.values(STORE_KEYS).forEach(k => localStorage.removeItem(k)); showToast("🗑️ All data cleared"); }

function populateReminderWeeks(sel) {
  const options = [0,1,2,3,4,6,8,12,16,20,24];
  sel.innerHTML = "";
  options.forEach(w=>{ const o=document.createElement("option"); o.value=w; o.text=`${w===0?"None":w+" weeks"}`; sel.appendChild(o); });
}

window.saveData=saveData; window.loadData=loadData; window.addItem=addItem; window.updateItem=updateItem; window.removeItem=removeItem;
window.saveJob=saveJob; window.listJobs=listJobs; window.saveDraft=saveDraft; window.listDrafts=listDrafts;
window.saveBatch=saveBatch; window.listBatches=listBatches; window.saveChemical=saveChemical; window.listChems=listChems;
window.checkChemThresholds=checkChemThresholds; window.linkBatchToJob=linkBatchToJob;
window.exportAllData=exportAllData; window.importAllData=importAllData; window.clearAll=clearAll; window.populateReminderWeeks=populateReminderWeeks;
