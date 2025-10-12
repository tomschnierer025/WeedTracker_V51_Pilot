/* Weed Tracker V50 Pilot — storage: persistence + seed */

const STORAGE_KEYS = {
  jobs: "wt_jobs",
  batches: "wt_batches",
  chems: "wt_chems",
  weeds: "wt_weeds",
  reminders: "wt_reminders"
};

const save = (k,v)=>localStorage.setItem(k,JSON.stringify(v));
const load = (k)=>JSON.parse(localStorage.getItem(k)||"[]");
const generateID = (p)=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

function clearAllData(leaveLibraries=true){
  if(!confirm("Clear ALL local data (jobs, batches, pins, reminders)?")) return;
  localStorage.removeItem(STORAGE_KEYS.jobs);
  localStorage.removeItem(STORAGE_KEYS.batches);
  localStorage.removeItem(STORAGE_KEYS.reminders);
  if(!leaveLibraries){
    localStorage.removeItem(STORAGE_KEYS.chems);
    localStorage.removeItem(STORAGE_KEYS.weeds);
  }
  alert("All data cleared (libraries kept).");
}

/* Seed libraries once */
(function seedLibraries(){
  if(!localStorage.getItem(STORAGE_KEYS.chems)){
    const chems = [
      {name:"Glyphosate 540", active:"Glyphosate 540g/L", quantity:100, unit:"L", low:20},
      {name:"Metsulfuron", active:"Metsulfuron-methyl 600g/kg", quantity:5, unit:"kg", low:1},
      {name:"2,4-D Amine 625", active:"2,4-D 625g/L", quantity:40, unit:"L", low:8},
      {name:"Triclopyr/Picloram", active:"Triclopyr 300 + Picloram 100 g/L", quantity:25, unit:"L", low:5},
      {name:"Clopyralid", active:"Clopyralid 300 g/L", quantity:15, unit:"L", low:3},
      {name:"Fluroxypyr", active:"Fluroxypyr 200 g/L", quantity:10, unit:"L", low:2},
      {name:"Penetrant", active:"Non-ionic surfactant", quantity:30, unit:"L", low:6}
      // (You can add the rest of your handwritten list here later if needed)
    ];
    save(STORAGE_KEYS.chems, chems);
  }
  if(!localStorage.getItem(STORAGE_KEYS.weeds)){
    const weeds = [
      {name:"Noxious — Cape Broom"},
      {name:"Noxious — African Lovegrass"},
      {name:"Noxious — Serrated Tussock"},
      {name:"Noxious — Paterson’s Curse"},
      {name:"Noxious — Blackberry"},
      {name:"Noxious — Horehound"},
      {name:"Marshmallow"},
      {name:"St John’s Wort"},
      {name:"Thistles"},
      {name:"Ryegrass volunteers"},
      {name:"Sweet Briar"},
      {name:"Fleabane"}
      // (NSW Handbook full list can be appended similarly)
    ];
    save(STORAGE_KEYS.weeds, weeds);
  }
})();
