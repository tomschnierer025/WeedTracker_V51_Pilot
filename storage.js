/* WeedTracker V60 Pilot — storage.js */
/* LocalStorage handling for tasks, batches, chemicals, weeds, and exports */

const DB_KEY = "weedtracker_data_v60";

/* ---------- Load & Save ---------- */
function loadDB() {
  try {
    const data = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
    data.tasks ??= [];
    data.batches ??= [];
    data.chems ??= [];
    data.weeds ??= [];
    data.version = 60;
    return data;
  } catch {
    return { tasks: [], batches: [], chems: [], weeds: [], version: 60 };
  }
}

function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db || {}));
}

/* ---------- Helpers ---------- */
function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ---------- Task Handling ---------- */
function getTasks() {
  const db = loadDB();
  return db.tasks || [];
}

function addOrUpdateTask(task) {
  const db = loadDB();
  const idx = db.tasks.findIndex(t => t.id === task.id);
  if (idx >= 0) db.tasks[idx] = task;
  else db.tasks.push(task);
  saveDB(db);
}

function deleteTask(id) {
  const db = loadDB();
  db.tasks = db.tasks.filter(t => t.id !== id);
  saveDB(db);
}

function clearTasks() {
  const db = loadDB();
  db.tasks = [];
  saveDB(db);
}

/* ---------- Batch Handling ---------- */
function getBatches() {
  return loadDB().batches || [];
}

function addBatch(batch) {
  const db = loadDB();
  db.batches.push(batch);
  saveDB(db);
}

function updateBatch(id, data) {
  const db = loadDB();
  const b = db.batches.find(x => x.id === id);
  if (b) Object.assign(b, data);
  saveDB(db);
}

function deleteBatch(id) {
  const db = loadDB();
  db.batches = db.batches.filter(b => b.id !== id);
  saveDB(db);
}

/* ---------- Chemical Handling ---------- */
function getChemicals() {
  return loadDB().chems || [];
}

function addChemical(name, ingredient) {
  const db = loadDB();
  db.chems.push({ name, ingredient });
  saveDB(db);
}

function clearChemicals() {
  const db = loadDB();
  db.chems = [];
  saveDB(db);
}

/* ---------- Weed Handling ---------- */
function getWeeds() {
  const db = loadDB();
  if (!Array.isArray(db.weeds) || db.weeds.length < 5) {
    db.weeds = [
      "Noxious Weeds (category)",
      "African Lovegrass (noxious)",
      "Blackberry (noxious)",
      "Serrated Tussock (noxious)",
      "Cape Broom (noxious)",
      "Chilean Needle Grass (noxious)",
      "St John’s Wort (noxious)",
      "Sweet Briar (noxious)",
      "Gorse (noxious)",
      "Lantana (noxious)",
      "Fleabane",
      "Horehound",
      "Saffron Thistle",
      "Wild Radish",
      "Fountain Grass"
    ];
    saveDB(db);
  }
  return db.weeds;
}

/* ---------- Export / Import ---------- */
function exportData() {
  const data = loadDB();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "WeedTracker_V60_Export.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.tasks && data.batches) {
        saveDB(data);
        showToast("Data imported successfully");
        location.reload();
      } else {
        alert("Invalid data file");
      }
    } catch {
      alert("Error reading file");
    }
  };
  reader.readAsText(file);
}

/* ---------- Clear All ---------- */
function clearAllData() {
  if (!confirm("Clear all stored data?")) return;
  localStorage.removeItem(DB_KEY);
  showToast("All data cleared");
  setTimeout(() => location.reload(), 1000);
}

console.log("✅ storage.js loaded");
