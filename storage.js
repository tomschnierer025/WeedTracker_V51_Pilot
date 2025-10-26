// WeedTracker V60 Pilot — storage.js
// Handles data persistence, reminders, and clean-up logic.

function getData(key) {
  return JSON.parse(localStorage.getItem(key) || "[]");
}
function saveData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

//
// =============== CHEMICALS ===============
function addChemical(name, active, amount, unit) {
  const chemicals = getData("chemicals");
  chemicals.push({ name, active, amount, unit });
  saveData("chemicals", chemicals);
}

function getChemical(name) {
  const chemicals = getData("chemicals");
  return chemicals.find(c => c.name === name);
}

function updateChemicalAmount(name, newAmount) {
  const chemicals = getData("chemicals");
  const c = chemicals.find(x => x.name === name);
  if (c) c.amount = newAmount;
  saveData("chemicals", chemicals);
}

//
// =============== BATCHES ===============
function addBatch(batch) {
  const batches = getData("batches");
  batches.push(batch);
  saveData("batches", batches);
}

function getBatch(name) {
  const batches = getData("batches");
  return batches.find(b => b.name === name);
}

//
// =============== RECORDS / TASKS ===============
function addRecord(record) {
  const records = getData("records");
  records.push(record);
  saveData("records", records);
}

function getRecords() {
  return getData("records");
}

//
// =============== REMINDERS ===============
function setReminder(jobName, weeks) {
  if (!weeks || weeks <= 0) return;
  const reminders = getData("reminders");
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + weeks * 7);
  reminders.push({
    jobName,
    due: dueDate.toLocaleDateString(),
    created: new Date().toLocaleString(),
  });
  saveData("reminders", reminders);
}

function checkReminders() {
  const reminders = getData("reminders");
  const today = new Date().toLocaleDateString();
  reminders.forEach(r => {
    if (r.due === today) showToast(`Reminder due: ${r.jobName}`);
  });
}

//
// =============== EXPORT / IMPORT ===============
function exportAll() {
  const data = {
    chemicals: getData("chemicals"),
    batches: getData("batches"),
    records: getData("records"),
    reminders: getData("reminders"),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "weedtracker_full_backup.json";
  a.click();
  URL.revokeObjectURL(a.href);
  showToast("Full backup exported");
}

async function importAll() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = async () => {
    const file = input.files[0];
    const text = await file.text();
    const data = JSON.parse(text);
    for (const [k, v] of Object.entries(data)) saveData(k, v);
    showToast("Backup restored");
    location.reload();
  };
  input.click();
}

//
// =============== DATA CLEAR ===============
function clearAllData() {
  if (confirm("This will erase ALL data. Proceed?")) {
    localStorage.clear();
    showToast("All data cleared");
  }
}
