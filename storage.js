/* === WeedTracker V60 Patch 1 — storage.js ===
   Handles localStorage database, backup + restore.
*/

const STORAGE_KEY = "weedtracker_data";
const BACKUP_KEY  = "weedtracker_backup";
const MAX_BACKUPS = 3;

function backupDB(db) {
  try {
    const arr = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
    arr.unshift({ ts: new Date().toISOString(), db });
    while (arr.length > MAX_BACKUPS) arr.pop();
    localStorage.setItem(BACKUP_KEY, JSON.stringify(arr));
  } catch (e) {
    console.warn("Backup failed", e);
  }
}

function restoreLatest() {
  const arr = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
  if (!arr.length) return null;
  const latest = arr[0].db;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(latest));
  return latest;
}

function ensureDB() {
  let db;
  try {
    db = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    db = {};
  }

  db.version ??= 60;
  db.accountEmail ??= "";
  db.tasks ??= [];
  db.batches ??= [];
  db.chems ??= [];
  db.procurement ??= [];
  db.weeds ??= [];

  // --- Seed weeds + chems if empty ---
  if (!db.weeds.length) {
    db.weeds = [
      "African Boxthorn (noxious)",
      "African Lovegrass (noxious)",
      "Bathurst Burr (noxious)",
      "Blackberry (noxious)",
      "Cape Broom (noxious)",
      "Chilean Needle Grass (noxious)",
      "Coolatai Grass (noxious)",
      "Fireweed (noxious)",
      "Gorse (noxious)",
      "Lantana (noxious)",
      "Patterson’s Curse (noxious)",
      "Serrated Tussock (noxious)",
      "St John’s Wort (noxious)",
      "Sweet Briar (noxious)",
      "Willow spp. (noxious)",
      "African Feathergrass",
      "Artichoke Thistle",
      "Balloon Vine",
      "Blue Heliotrope",
      "Bridal Creeper",
      "Caltrop",
      "Coltsfoot",
      "Fleabane",
      "Flax-leaf Broom",
      "Fountain Grass",
      "Galvanised Burr",
      "Giant Parramatta Grass",
      "Glycine",
      "Green Cestrum",
      "Horehound",
      "Khaki Weed",
      "Noogoora Burr",
      "Parthenium Weed",
      "Prickly Pear (common)",
      "Saffron Thistle",
      "Silverleaf Nightshade",
      "Spear Thistle",
      "Sweet Vernal Grass",
      "Three-cornered Jack",
      "Wild Radish"
    ];
  }

  if (!db.chems.length) {
    db.chems = [
      { name: "Crucial", active: "Glyphosate 540 g/L", containerSize: 20, containerUnit: "L", containers: 4, threshold: 2 },
      { name: "SuperWet", active: "Non-ionic surfactant", containerSize: 20, containerUnit: "L", containers: 1, threshold: 1 },
      { name: "Bow Saw 600", active: "Triclopyr 600 g/L", containerSize: 1, containerUnit: "L", containers: 2, threshold: 1 },
      { name: "Clethodim", active: "Clethodim 240 g/L", containerSize: 20, containerUnit: "L", containers: 1, threshold: 1 },
      { name: "Grazon", active: "Triclopyr + Picloram", containerSize: 20, containerUnit: "L", containers: 1, threshold: 1 },
      { name: "Bosol", active: "Metsulfuron-methyl", containerSize: 500, containerUnit: "g", containers: 2, threshold: 1 },
      { name: "Hastings", active: "MCPA", containerSize: 20, containerUnit: "L", containers: 1, threshold: 1 },
      { name: "Outright", active: "Fluroxypyr", containerSize: 20, containerUnit: "L", containers: 1, threshold: 1 }
    ];
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  return db;
}

let DB = ensureDB();
const saveDB = (withBackup = true) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
  if (withBackup) backupDB(DB);
};

// Auto-offer restore if empty
if (
  (!DB.tasks.length && !DB.batches.length && !DB.chems.length) &&
  localStorage.getItem(BACKUP_KEY)
) {
  if (confirm("Backup found. Restore data now?")) {
    const r = restoreLatest();
    if (r) DB = r;
  }
}
