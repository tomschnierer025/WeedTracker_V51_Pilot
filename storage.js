/* WeedTracker V60 Final Pilot — storage.js
   Handles all data persistence, localStorage management, backups, and versioning
*/

const STORAGE_KEY = "weedtracker_data_v60";
const BACKUP_KEY = "weedtracker_backups_v60";
const MAX_BACKUPS = 3;

// Save current database state
function saveDB(db, withBackup = true) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    if (withBackup) backupDB(db);
  } catch (e) {
    console.error("Save failed:", e);
  }
}

// Load DB or create if missing
function loadDB() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return ensureDB();
    const parsed = JSON.parse(data);
    if (typeof parsed !== "object" || Array.isArray(parsed)) return ensureDB();
    parsed.version = 60;
    return parsed;
  } catch (e) {
    console.warn("DB corrupted, restoring blank:", e);
    return ensureDB();
  }
}

// Create base DB if empty
function ensureDB() {
  const base = {
    version: 60,
    accountEmail: "",
    tasks: [],
    batches: [],
    chems: [],
    procurement: [],
    weeds: [],
  };
  saveDB(base, false);
  return base;
}

// Backup logic
function backupDB(db) {
  try {
    let arr = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
    arr.unshift({ ts: new Date().toISOString(), db });
    if (arr.length > MAX_BACKUPS) arr = arr.slice(0, MAX_BACKUPS);
    localStorage.setItem(BACKUP_KEY, JSON.stringify(arr));
  } catch (e) {
    console.warn("Backup failed:", e);
  }
}

// Restore latest backup
function restoreLatestBackup() {
  try {
    const arr = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
    if (!arr.length) {
      alert("No backup found");
      return null;
    }
    const latest = arr[0].db;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(latest));
    alert("Backup restored successfully");
    return latest;
  } catch (e) {
    console.error("Restore failed:", e);
    alert("Restore failed");
    return null;
  }
}

// Offer restore if empty
function autoRestoreIfEmpty() {
  try {
    const db = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if ((!db.tasks || !db.tasks.length) && localStorage.getItem(BACKUP_KEY)) {
      const proceed = confirm("A backup was found. Restore it now?");
      if (proceed) return restoreLatestBackup();
    }
  } catch (e) {
    console.warn("Auto-restore check failed:", e);
  }
  return null;
}

// Clear database
function clearDB() {
  if (!confirm("This will clear ALL WeedTracker data. Continue?")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(BACKUP_KEY);
  const fresh = ensureDB();
  alert("All data cleared");
  return fresh;
}

// Export current DB
function exportDB() {
  try {
    const db = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "weedtracker_data_v60.json";
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("Export failed:", e);
  }
}

// Import DB from user file
function importDB(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported || typeof imported !== "object") throw new Error("Invalid file");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
      alert("Database imported successfully");
      location.reload();
    } catch (err) {
      alert("Import failed: " + err.message);
    }
  };
  reader.readAsText(file);
}
