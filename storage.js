/* === WeedTracker V56 Light – Storage Helpers === */

const STORAGE_KEY = "weedtracker_data";

/** Reset local database (used by clear button) */
function resetDatabase() {
  const blank = {
    version: 56,
    accountEmail: "",
    tasks: [],
    batches: [],
    chems: [],
    procurement: [],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(blank));
  return blank;
}

/** Load existing DB */
function loadDatabase() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return resetDatabase();
  try { return JSON.parse(data); }
  catch { return resetDatabase(); }
}

/** Save changes */
function saveDatabase(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

/** Export DB as JSON blob */
function exportDatabase(db) {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "weedtracker_data.json"; a.click();
}
