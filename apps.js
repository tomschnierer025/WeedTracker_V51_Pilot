/* === START apps.js A ===
   WeedTracker V60 Pilot — Core logic (Part A)
   - AU date format DD-MM-YYYY
   - Noxious weeds pinned to top
   - Apple Maps navigation hooks
   - Locate Me + road tracking + weather
*/

document.addEventListener("DOMContentLoaded", () => {

  // ---------------------------
  // Quick DOM helpers
  // ---------------------------
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const fmt = (n,d=0)=> (n==null||n==="")?"–":Number(n).toFixed(d);

  // ---------------------------
  // Date helpers
  // ---------------------------
  function formatDateAU(d) {
    const dt = (d instanceof Date) ? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2,"0");
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const yyyy = dt.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  function formatDateAUCompact(d) {
    const dt = (d instanceof Date) ? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2,"0");
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const yyyy = dt.getFullYear();
    return `${dd}${mm}${yyyy}`;
  }
  const todayISO = () => new Date().toISOString().split("T")[0];
  const nowTime  = () => new Date().toTimeString().slice(0,5);

  // ---------------------------
  // Toast helper
  // ---------------------------
  function toast(msg, ms=1600){
    const d=document.createElement("div");
    d.textContent=msg;
    Object.assign(d.style,{
      position:"fixed",bottom:"1.2rem",left:"50%",transform:"translateX(-50%)",
      background:"#d9f7d9",color:"#063",padding:".6rem 1rem",borderRadius:"20px",
      boxShadow:"0 2px 8px rgba(0,0,0,.25)",zIndex:9999,fontWeight:800
    });
    document.body.appendChild(d);
    setTimeout(()=>d.remove(),ms);
  }

  // ---------------------------
  // Storage setup
  // ---------------------------
  const STORAGE_KEY="weedtracker_data_v60";
  const BACKUP_KEY="weedtracker_backup_v60";
  const MAX_BACKUPS=3;

  const NSW_WEEDS=[
    "⚠ African Boxthorn (noxious)","⚠ African Lovegrass (noxious)","⚠ Bathurst Burr (noxious)","⚠ Blackberry (noxious)",
    "⚠ Cape Broom (noxious)","⚠ Chilean Needle Grass (noxious)","⚠ Coolatai Grass (noxious)","⚠ Fireweed (noxious)",
    "⚠ Gorse (noxious)","⚠ Lantana (noxious)","⚠ Patterson’s Curse (noxious)","⚠ Serrated Tussock (noxious)",
    "⚠ St John’s Wort (noxious)","⚠ Sweet Briar (noxious)","⚠ Willow spp. (noxious)",
    "African Feathergrass","Artichoke Thistle","Balloon Vine","Blue Heliotrope","Bridal Creeper","Caltrop",
    "Coltsfoot","Fleabane","Flax-leaf Broom","Fountain Grass","Galvanised Burr","Giant Parramatta Grass",
    "Glycine","Green Cestrum","Horehound","Khaki Weed","Noogoora Burr","Parthenium Weed",
    "Prickly Pear (common)","Saffron Thistle","Silverleaf Nightshade","Spear Thistle","Sweet Vernal Grass",
    "Three-cornered Jack","Wild Radish"
  ];

  const DEFAULT_CHEMS=[
    {name:"Crucial",active:"Glyphosate 540 g/L",containerSize:20,containerUnit:"L",containers:4,threshold:2},
    {name:"SuperWet",active:"Non-ionic surfactant",containerSize:20,containerUnit:"L",containers:1,threshold:1},
    {name:"Bow Saw 600",active:"Triclopyr 600 g/L",containerSize:1,containerUnit:"L",containers:2,threshold:1},
    {name:"Grazon",active:"Triclopyr + Picloram",containerSize:20,containerUnit:"L",containers:1,threshold:1},
    {name:"Bosol",active:"Metsulfuron-methyl",containerSize:500,containerUnit:"g",containers:2,threshold:1}
  ];

  function backupDB(db){
    try{
      const arr=JSON.parse(localStorage.getItem(BACKUP_KEY)||"[]");
      arr.unshift({ts:new Date().toISOString(),db});
      while(arr.length>MAX_BACKUPS)arr.pop();
      localStorage.setItem(BACKUP_KEY,JSON.stringify(arr));
    }catch(e){console.warn("Backup failed",e);}
  }

  function ensureDB(){
    let db;
    try{db=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");}catch{db={};}
    db.version??=60;
    db.tasks??=[];
    db.batches??=[];
    db.chems??=[];
    db.weeds??=NSW_WEEDS.slice();
    if(!db.chems.length)db.chems=DEFAULT_CHEMS.slice();
    localStorage.setItem(STORAGE_KEY,JSON.stringify(db));
    return db;
  }
  let DB=ensureDB();
  const saveDB=(backup=true)=>{localStorage.setItem(STORAGE_KEY,JSON.stringify(DB));if(backup)backupDB(DB);};

  // ---------------------------
  // Navigation & Splash
  // ---------------------------
  const screens=$$(".screen");
  function switchScreen(id){
    screens.forEach(s=>s.classList.remove("active"));
    $("#"+id)?.classList.add("active");
    if(id==="records")renderRecords();
    if(id==="batches")renderBatches();
    if(id==="inventory")renderChems();
    if(id==="mapping")renderMap(true);
  }
  $$("[data-target]").forEach(b=>b.addEventListener("click",()=>switchScreen(b.dataset.target)));
  $$(".home-btn").forEach(b=>b.addEventListener("click",e=>{e.preventDefault();switchScreen("home");}));

  const splash=$("#splash");
  setTimeout(()=>splash?.classList.add("hide"),1200);
  splash?.addEventListener("transitionend",()=>splash.remove(),{once:true});

  // ---------------------------
  // Create Task setup
  // ---------------------------
  const remSel=$("#reminderWeeks");
  if(remSel&&!remSel.options.length)for(let i=1;i<=52;i++){const o=document.createElement("option");o.value=o.textContent=i;remSel.appendChild(o);}

  const taskTypeSel=$("#taskType");
  const roadTrackBlock=$("#roadTrackBlock");
  const syncTrackVis=()=>roadTrackBlock.style.display=(taskTypeSel.value==="Road Spray")?"block":"none";
  taskTypeSel?.addEventListener("change",syncTrackVis);
  syncTrackVis();

  const locateBtn=$("#locateBtn");
  const locRoad=$("#locRoad");
  let currentRoad="";
  locateBtn?.addEventListener("click",()=>{
    if(!navigator.geolocation){toast("Enable location");return;}
    navigator.geolocation.getCurrentPosition(async pos=>{
      const {latitude:lat,longitude:lon}=pos.coords;
      try{
        const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const j=await r.json();
        currentRoad=j.address?.road||j.display_name||`${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      }catch{currentRoad=`${lat.toFixed(5)}, ${lon.toFixed(5)}`;}
      locRoad.textContent=currentRoad||"Unknown";
    },()=>toast("GPS failed"));
  });

  const TYPE_PREFIX={Inspection:"I", "Spot Spray":"SS", "Road Spray":"RS"};
  $("#autoNameBtn")?.addEventListener("click",()=>{
    const t=$("#taskType").value||"Inspection";
    const prefix=TYPE_PREFIX[t]||"I";
    const dInput=$("#jobDate");
    const dt=dInput&&dInput.value?new Date(dInput.value):new Date();
    const dateCompact=formatDateAUCompact(dt);
    const base=(currentRoad||"Unknown").replace(/\s+/g,"");
    $("#jobName").value=`${prefix}${dateCompact}_${base}`;
  });

  const jobDateEl=$("#jobDate");
  if(jobDateEl&&!jobDateEl.value)jobDateEl.value=todayISO();

  // ---------------------------
  // Weather Auto-Fill
  // ---------------------------
  $("#autoWeatherBtn")?.addEventListener("click",()=>{
    if(!navigator.geolocation){toast("Enable location services");return;}
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{
        const {latitude,longitude}=pos.coords;
        const url=`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;
        const r=await fetch(url);
        const j=await r.json();
        const c=j.current||{};
        $("#temp").value=c.temperature_2m??"";
        $("#wind").value=c.wind_speed_10m??"";
        $("#windDir").value=(c.wind_direction_10m??"")+"°";
        $("#humidity").value=c.relative_humidity_2m??"";
        $("#wxUpdated").textContent="Updated @ "+nowTime();
      }catch{toast("Weather unavailable");}
    },()=>toast("Location not available"));
  });

  // ---------------------------
  // Weeds / Batch dropdowns
  // ---------------------------
  function populateWeeds(){
    const sel=$("#weedSelect");if(!sel)return;
    sel.innerHTML="";
    const nox=DB.weeds.filter(w=>/noxious/i.test(w)).sort();
    const rest=DB.weeds.filter(w=>! /noxious/i.test(w)).sort();
    ["— Select Weed —",...nox,...rest].forEach(w=>{
      const o=document.createElement("option");
      o.value=w==="— Select Weed —"?"":w;
      o.textContent=w;
      sel.appendChild(o);
    });
  }
  populateWeeds();

  function populateBatchSelect(){
    const sel=$("#batchSelect");if(!sel)return;
    sel.innerHTML="";
    const def=document.createElement("option");
    def.value="";def.textContent="— Select Batch —";
    sel.appendChild(def);
    DB.batches.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).forEach(b=>{
      const o=document.createElement("option");
      const remain=b.remaining??b.mix??0;
      o.value=b.id;
      o.textContent=`${b.id} • ${formatDateAU(b.date)} • remain ${fmt(remain)} L`;
      sel.appendChild(o);
    });
  }
  populateBatchSelect();

  // (continues in Part B)
});
/* === END apps.js A === */
/* === START apps.js B ===
   WeedTracker V60 Pilot — Core logic (Part B)
   (continuation from Part A)
*/

// -------------------------------------------------
// Save Task & Draft
// -------------------------------------------------
$("#saveTask")?.addEventListener("click",()=>saveTask(false));
$("#saveDraft")?.addEventListener("click",()=>saveTask(true));

function saveTask(isDraft){
  const id=Date.now();
  const status=isDraft?"Draft":($("input[name='status']:checked")?.value||"Incomplete");
  const obj={
    id,
    name:$("#jobName").value.trim()||("Task_"+id),
    type:$("#taskType").value,
    weed:$("#weedSelect").value,
    batch:$("#batchSelect").value,
    date:$("#jobDate").value||todayISO(),
    start:$("#startTime").value||"",
    end:$("#endTime").value||"",
    temp:$("#temp").value||"",
    wind:$("#wind").value||"",
    windDir:$("#windDir").value||"",
    humidity:$("#humidity").value||"",
    reminder:$("#reminderWeeks").value||"",
    status,
    notes:$("#notes").value||"",
    createdAt:new Date().toISOString(),
    coords:JSON.parse(localStorage.getItem("lastTrack")||"[]"),
    photo:$("#photoPreview")?.src||""
  };
  const existing=DB.tasks.find(t=>t.name===obj.name);
  if(existing)Object.assign(existing,obj);else DB.tasks.push(obj);
  saveDB();populateBatchSelect();renderRecords();renderMap();
  toast("Task Saved");
}

// -------------------------------------------------
// Records Search & Pop-ups
// -------------------------------------------------
$("#recSearchBtn")?.addEventListener("click",renderRecords);
$("#recResetBtn")?.addEventListener("click",()=>{$("#recSearch").value="";renderRecords();});

function renderRecords(){
  const list=$("#recordsList");if(!list)return;list.innerHTML="";
  const q=$("#recSearch").value.trim().toLowerCase();
  DB.tasks.filter(t=>!t.archived && (!q||t.name.toLowerCase().includes(q)||t.weed.toLowerCase().includes(q)))
    .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
    .forEach(t=>{
      const d=document.createElement("div");d.className="item";
      d.innerHTML=`<b>${t.name}</b><br><small>${t.type} • ${formatDateAU(t.date)} • ${t.status}</small>
        <div class="row end"><button class="pill" data-open="${t.id}">Open</button></div>`;
      d.querySelector("[data-open]").addEventListener("click",()=>showJobPopup(t));
      list.appendChild(d);
    });
}

// -------------------------------------------------
// Batches List & Pop-ups
// -------------------------------------------------
$("#newBatch")?.addEventListener("click",()=>{
  const id="B"+Date.now();
  const mix=Number(prompt("Total mix (L):","600"))||0;
  const chems=prompt("Chemicals:","")||"";
  const obj={id,date:todayISO(),time:nowTime(),mix,remaining:mix,used:0,chemicals:chems};
  DB.batches.push(obj);saveDB();populateBatchSelect();renderBatches();
  toast("Batch Created "+id);
});

function renderBatches(){
  const list=$("#batchList");if(!list)return;list.innerHTML="";
  DB.batches.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""))
    .forEach(b=>{
      const d=document.createElement("div");d.className="item";
      d.innerHTML=`<b>${b.id}</b><br><small>${formatDateAU(b.date)} • Mix ${b.mix} L • Remain ${b.remaining||b.mix} L</small>
      <div class="row end"><button class="pill" data-open="${b.id}">Open</button></div>`;
      d.querySelector("[data-open]").addEventListener("click",()=>showBatchPopup(b));
      list.appendChild(d);
    });
}

function showBatchPopup(b){
  const jobs=DB.tasks.filter(t=>t.batch===b.id);
  const jobsHtml=jobs.length?`<ul>${jobs.map(t=>`<li><a href="#" data-open-job="${t.id}">${t.name}</a></li>`).join("")}</ul>`:"—";
  const html=`<div class="modal"><div class="card p">
      <h3>${b.id}</h3>
      <div><b>Date:</b> ${formatDateAU(b.date)} <b>Time:</b> ${b.time}</div>
      <div><b>Total Mix:</b> ${b.mix} L  <b>Remaining:</b> ${b.remaining} L</div>
      <div><b>Chemicals:</b><br>${b.chemicals}</div>
      <div><b>Linked Jobs:</b><br>${jobsHtml}</div>
      <div class="row gap end"><button class="pill" data-close>Close</button></div>
    </div></div>`;
  const wrap=document.createElement("div");wrap.innerHTML=html;document.body.appendChild(wrap.firstChild);
  const modal=$(".modal");
  modal.addEventListener("click",e=>{if(e.target===modal||e.target.dataset.close!=null)modal.remove();});
  $$("[data-open-job]",modal).forEach(a=>a.addEventListener("click",e=>{
    e.preventDefault();
    const t=DB.tasks.find(x=>String(x.id)===a.dataset.openJob);
    if(t)showJobPopup(t);
  }));
}

// -------------------------------------------------
// Job Pop-up
// -------------------------------------------------
function showJobPopup(t){
  const html=`<div class="modal"><div class="card p">
      <h3>${t.name}</h3>
      <div><b>Type:</b> ${t.type} | <b>Status:</b> ${t.status}</div>
      <div><b>Date:</b> ${formatDateAU(t.date)} | <b>Weed:</b> ${t.weed}</div>
      <div><b>Batch:</b> ${t.batch||"—"}</div>
      <div><b>Weather:</b> ${t.temp}°C, ${t.wind} km/h, ${t.windDir}, ${t.humidity}%</div>
      <div><b>Notes:</b> ${t.notes||"—"}</div>
      ${t.photo?`<img src="${t.photo}" style="max-width:100%;margin-top:.5rem;border-radius:6px">`:""}
      <div class="row gap end"><button class="pill" data-close>Close</button></div>
    </div></div>`;
  const wrap=document.createElement("div");wrap.innerHTML=html;document.body.appendChild(wrap.firstChild);
  const modal=$(".modal");
  modal.addEventListener("click",e=>{if(e.target===modal||e.target.dataset.close!=null)modal.remove();});
}

// -------------------------------------------------
// Inventory & Procurement
// -------------------------------------------------
function renderChems(){
  const list=$("#chemList");if(!list)return;list.innerHTML="";
  DB.chems.sort((a,b)=>a.name.localeCompare(b.name)).forEach(c=>{
    const total=(c.containers||0)*(c.containerSize||0);
    const d=document.createElement("div");d.className="item";
    d.innerHTML=`<b>${c.name}</b><br><small>${c.active}</small><br>
      <small>${c.containers}×${c.containerSize}${c.containerUnit}= ${total}${c.containerUnit}</small>`;
    list.appendChild(d);
  });
}

// -------------------------------------------------
// Mapping (Leaflet + Locate Me)
// -------------------------------------------------
let map;
function ensureMap(){
  if(map)return map;
  map=L.map("map").setView([-34.75,148.65],10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);
  const locateCtrl=L.control({position:"bottomright"});
  locateCtrl.onAdd=function(){
    const d=L.DomUtil.create("div","leaflet-bar");
    d.style.background="#0c7d2b";d.style.color="#fff";d.style.borderRadius="6px";d.style.padding="6px 10px";d.style.cursor="pointer";
    d.innerText="Locate Me";
    d.onclick=()=>{
      if(!navigator.geolocation){toast("Enable location");return;}
      navigator.geolocation.getCurrentPosition(p=>{
        const pt=[p.coords.latitude,p.coords.longitude];
        map.setView(pt,14);
        L.circleMarker(pt,{radius:7,opacity:.9}).addTo(map).bindPopup("You are here").openPopup();
      });
    };
    return d;
  };
  locateCtrl.addTo(map);
  return map;
}

function renderMap(fit=false){
  const m=ensureMap();
  m.eachLayer(l=>{if(!(l instanceof L.TileLayer))m.removeLayer(l);});
  DB.tasks.filter(t=>!t.archived).forEach(t=>{
    if(t.coords?.length>1)L.polyline(t.coords,{color:"yellow",weight:4}).addTo(m);
    const pt=t.coords?.[0];if(!pt)return;
    const popup=`<b>${t.name}</b><br>${t.type} • ${formatDateAU(t.date)}<br>
      <button class="pill" onclick="alert('Navigation via Apple Maps soon')">Navigate</button>`;
    L.marker(pt).addTo(m).bindPopup(popup);
  });
  if(fit){
    const g=L.featureGroup();
    m.eachLayer(l=>{if(!(l instanceof L.TileLayer))g.addLayer(l);});
    try{m.fitBounds(g.getBounds().pad(0.2));}catch{}
  }
}

/* === END apps.js B === */
