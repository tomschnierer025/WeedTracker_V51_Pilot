/* WeedTracker V61 Final Pilot — storage.js
   DB helpers: load/save/backup, AU date helpers. */

(function(){
  const STORAGE_KEY = "weedtracker_data";
  const BACKUP_KEY  = "weedtracker_backup";
  const MAX_BACKUPS = 3;

  const NSW_WEEDS_40 = [
    "Noxious Weeds (category)",
    "African Boxthorn (noxious)","African Lovegrass (noxious)","Bathurst Burr (noxious)","Blackberry (noxious)",
    "Cape Broom (noxious)","Chilean Needle Grass (noxious)","Coolatai Grass (noxious)","Fireweed (noxious)",
    "Gorse (noxious)","Lantana (noxious)","Patterson’s Curse (noxious)","Serrated Tussock (noxious)",
    "St John’s Wort (noxious)","Sweet Briar (noxious)","Willow spp. (noxious)",
    "African Feathergrass","Artichoke Thistle","Balloon Vine","Blue Heliotrope","Bridal Creeper","Caltrop",
    "Coltsfoot","Fleabane","Flax-leaf Broom","Fountain Grass","Galvanised Burr","Giant Parramatta Grass",
    "Glycine","Green Cestrum","Horehound","Khaki Weed","Noogoora Burr","Parthenium Weed","Prickly Pear (common)",
    "Saffron Thistle","Silverleaf Nightshade","Spear Thistle","Sweet Vernal Grass","Three-cornered Jack","Wild Radish",
    "Cape Broom" /* explicit add */
  ];

  const DEFAULT_CHEMS = [
    {name:"Crucial", active:"Glyphosate 540 g/L", containerSize:20, containerUnit:"L", containers:4, threshold:2},
    {name:"SuperWet", active:"Non-ionic surfactant", containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Bow Saw 600", active:"Triclopyr 600 g/L", containerSize:1, containerUnit:"L", containers:2, threshold:1},
    {name:"Clethodim", active:"Clethodim 240 g/L", containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Grazon", active:"Triclopyr + Picloram", containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Bosol", active:"Metsulfuron-methyl", containerSize:500, containerUnit:"g", containers:2, threshold:1},
    {name:"Hastings", active:"MCPA", containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Outright", active:"Fluroxypyr", containerSize:20, containerUnit:"L", containers:1, threshold:1}
  ];

  function auDateISO(){
    return new Date().toISOString().split("T")[0];
  }
  function fmtAU(d){
    const dt = (d instanceof Date)? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2,"0");
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    return `${dd}-${mm}-${dt.getFullYear()}`;
  }

  function backup(db){
    try{
      const arr = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
      arr.unshift({ts:new Date().toISOString(), db});
      while(arr.length>MAX_BACKUPS) arr.pop();
      localStorage.setItem(BACKUP_KEY, JSON.stringify(arr));
    }catch(e){ console.warn("Backup failed", e); }
  }

  function ensureDB(){
    let db;
    try{ db = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }catch{ db = {}; }
    db.version ??= 61;
    db.tasks ??= [];
    db.batches ??= [];
    db.chems ??= [];
    db.procurement ??= [];
    db.weeds ??= NSW_WEEDS_40.slice();
    if (!db.chems.length) db.chems = DEFAULT_CHEMS.slice();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return db;
  }

  function saveDB(db, withBackup=true){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    if (withBackup) backup(db);
  }

  window.DBStore = { ensureDB, saveDB, backup, auDateISO, fmtAU, NSW_WEEDS_40 };
})();
