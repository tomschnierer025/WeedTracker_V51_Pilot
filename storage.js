/* V55 — persistence & libraries */

const STORAGE_KEYS = {
  jobs: "wt_jobs",
  batches: "wt_batches",
  chems: "wt_chems",
  weeds: "wt_weeds",
  reminders: "wt_reminders",
  tracks: "wt_tracks"
};

const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const load=(k)=>JSON.parse(localStorage.getItem(k)||"[]");
const genID=(p)=>`${p}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;

function clearAllData(leaveLibs=true){
  if(!confirm("Clear ALL jobs, batches, reminders and tracks?"))return;
  [STORAGE_KEYS.jobs,STORAGE_KEYS.batches,STORAGE_KEYS.reminders,STORAGE_KEYS.tracks].forEach(k=>localStorage.removeItem(k));
  if(!leaveLibs){ [STORAGE_KEYS.chems,STORAGE_KEYS.weeds].forEach(k=>localStorage.removeItem(k)); }
  alert("Cleared.");
}

/* Seed libraries once */
(function seed(){
  if(!localStorage.getItem(STORAGE_KEYS.chems)){
    const chems=[
      {name:"Glyphosate 540",active:"Glyphosate 540 g/L",quantity:100,unit:"L",low:20},
      {name:"Metsulfuron",active:"Metsulfuron-methyl 600 g/kg",quantity:5,unit:"kg",low:1},
      {name:"2,4-D Amine 625",active:"2,4-D 625 g/L",quantity:40,unit:"L",low:8},
      {name:"Triclopyr/Picloram",active:"Triclopyr 300 + Picloram 100 g/L",quantity:25,unit:"L",low:5},
      {name:"Clopyralid",active:"Clopyralid 300 g/L",quantity:15,unit:"L",low:3},
      {name:"Fluroxypyr",active:"Fluroxypyr 200 g/L",quantity:10,unit:"L",low:2},
      {name:"Penetrant",active:"Non-ionic surfactant",quantity:30,unit:"L",low:6}
    ]; save(STORAGE_KEYS.chems,chems);
  }
  if(!localStorage.getItem(STORAGE_KEYS.weeds)){
    const weeds=[
      {name:"Noxious — Cape Broom"},
      {name:"Noxious — African Lovegrass"},
      {name:"Noxious — Serrated Tussock"},
      {name:"Noxious — Paterson’s Curse"},
      {name:"Noxious — Blackberry"},
      {name:"Noxious — Horehound"},
      {name:"Marshmallow"},
      {name:"St John’s Wort"},
      {name:"Thistles"},
      {name:"Sweet Briar"},
      {name:"Fleabane"}
    ]; save(STORAGE_KEYS.weeds,weeds);
  }
})();
