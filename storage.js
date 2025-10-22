// ---------- WeedTracker V63 - storage.js ---------- //
// Local data management for tasks, chemicals, and batches

// Save data
function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error("Save error:", err);
  }
}

// Load data
function loadFromStorage(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error("Load error:", err);
    return [];
  }
}

// ---------- TASKS ----------
function saveTaskToStorage(task) {
  const tasks = loadFromStorage("tasks");
  const idx = tasks.findIndex(t => t.id === task.id);
  if (idx > -1) tasks[idx] = task; else tasks.push(task);
  saveToStorage("tasks", tasks);
}

function getAllTasks() {
  return loadFromStorage("tasks");
}

function deleteTask(id) {
  let tasks = loadFromStorage("tasks");
  tasks = tasks.filter(t => t.id !== id);
  saveToStorage("tasks", tasks);
}

function markTaskComplete(id, status) {
  const tasks = loadFromStorage("tasks");
  const target = tasks.find(t => t.id === id);
  if (target) {
    target.status = status;
    target.edited = new Date().toLocaleString();
  }
  saveToStorage("tasks", tasks);
}

// ---------- CHEMICALS ----------
function getChemicals() {
  return loadFromStorage("chemicals");
}

function saveChemical(chemical) {
  const chemicals = loadFromStorage("chemicals");
  const idx = chemicals.findIndex(c => c.name === chemical.name);
  if (idx > -1) chemicals[idx] = chemical; else chemicals.push(chemical);
  saveToStorage("chemicals", chemicals);
}

function deductChemicalUsage(name, amountUsed, unit) {
  const chemicals = loadFromStorage("chemicals");
  const chem = chemicals.find(c => c.name === name);
  if (chem) {
    chem.quantity = Math.max(0, chem.quantity - amountUsed);
    chem.lastUsed = new Date().toLocaleString();
    chem.unit = unit || chem.unit;
  }
  saveToStorage("chemicals", chemicals);
}

// ---------- BATCHES ----------
function saveBatch(batch) {
  const batches = loadFromStorage("batches");
  const idx = batches.findIndex(b => b.id === batch.id);
  if (idx > -1) batches[idx] = batch; else batches.push(batch);
  saveToStorage("batches", batches);
}

function getBatches() {
  return loadFromStorage("batches");
}

function deleteBatch(id) {
  let batches = loadFromStorage("batches");
  batches = batches.filter(b => b.id !== id);
  saveToStorage("batches", batches);
}

function markBatchDumped(id, reason) {
  const batches = loadFromStorage("batches");
  const batch = batches.find(b => b.id === id);
  if (batch) {
    batch.dumped = true;
    batch.dumpReason = reason;
    batch.remainingMix = 0;
  }
  saveToStorage("batches", batches);
}

// ---------- WEATHER ----------
function saveWeatherSnapshot(snapshot) {
  const weather = loadFromStorage("weatherHistory");
  weather.push(snapshot);
  saveToStorage("weatherHistory", weather);
}

function getWeatherHistory() {
  return loadFromStorage("weatherHistory");
}

// ---------- CLEAR ----------
function clearAllData() {
  if (confirm("⚠️ This will permanently delete all local data. Continue?")) {
    localStorage.clear();
    alert("All data cleared.");
    location.reload();
  }
}
