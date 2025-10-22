/* ===== WeedTrackerV60Pilot — storage.js ===== */
(function(){
  const STORAGE_KEY = "weedtracker_data_v60";
  const BACKUP_KEY  = "weedtracker_backup_v60";
  const MAX_BACKUPS = 5;

  // 40 weeds with noxious tagged; Cape Broom included & pinned logic handled in apps.js
  const NSW_WEEDS_40 = [
    "African Boxthorn (noxious)","African Lovegrass (noxious)","Bathurst Burr (noxious)","Blackberry (noxious)",
    "Cape Broom (noxious)","Chilean Needle Grass (noxious)","Coolatai Grass (noxious)","Fireweed (noxious)",
    "Gorse (noxious)","Lantana (noxious)","Patterson’s Curse (noxious)","Serrated Tussock (noxious)",
    "St John’s Wort (noxious)","Sweet Briar (noxious)","Willow spp. (noxious)",
    "African Feathergrass","Artichoke Thistle","Balloon Vine","Blue Heliotrope","Bridal Creeper","Caltrop",
    "Coltsfoot","Fleabane","Flax-leaf Broom","Fountain Grass","Galvanised Burr","Giant Parramatta Grass",
    "Glycine","Green Cestrum","Horehound","Khaki Weed","Noogoora Burr","Parthenium Weed","Prickly Pear (common)",
    "Saffron Thistle","Silverleaf Nightshade","Spear Thistle","Sweet Vernal Grass","Three-cornered Jack","Wild Radish"
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

  function saveDB(db, withBackup=true){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    if (withBackup){
      const arr = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
      arr.unshift({ts:new Date().toISOString(), db});
      while (arr.length>MAX_BACKUPS) arr.pop();
      localStorage.setItem(BACKUP_KEY, JSON.stringify(arr));
    }
  }

  function loadDB(){
    let db = {};
    try{ db = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }catch{ db={}; }
    db.version ??= 60;
    db.accountEmail ??= "";
    db.tasks ??= [];
    db.batches ??= [];
    db.chems ??= [];
    db.procurement ??= [];
    db.weeds ??= NSW_WEEDS_40.slice();
    if (!db.chems.length) db.chems = DEFAULT_CHEMS.slice();
    return db;
  }

  function restoreLatest(){
    const arr = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
    if (!arr.length) return null;
    const latest = arr[0].db;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(latest));
    return latest;
  }

  // expose
  window.DB = loadDB();
  window.DB_save = (withBackup=true)=> saveDB(window.DB, withBackup);
  window.DB_restoreLatest = restoreLatest;
  window.DB_clear = ()=>{
    localStorage.removeItem(STORAGE_KEY);
    window.DB = loadDB();
  };
})();
