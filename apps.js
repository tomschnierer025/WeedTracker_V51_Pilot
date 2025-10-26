/* ===========================================
   WeedTracker V60 Pilot Final — APPS.JS (Part 1/2)
   =========================================== */

document.addEventListener("DOMContentLoaded", () => {
  const $  = (id) => document.getElementById(id);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

  // ---------- Initial Data ----------
  const NOX_TAG = " (noxious)";
  const BASE_WEEDS = [
    "African Boxthorn" + NOX_TAG, "African Lovegrass" + NOX_TAG, "Bathurst Burr" + NOX_TAG,
    "Blackberry" + NOX_TAG, "Cape Broom" + NOX_TAG, "Chilean Needle Grass" + NOX_TAG,
    "Coolatai Grass" + NOX_TAG, "Fireweed" + NOX_TAG, "Gorse" + NOX_TAG, "Lantana" + NOX_TAG,
    "Patterson’s Curse" + NOX_TAG, "Serrated Tussock" + NOX_TAG, "St John’s Wort" + NOX_TAG,
    "Sweet Briar" + NOX_TAG, "Willow spp." + NOX_TAG,
    "African Feathergrass","Artichoke Thistle","Balloon Vine","Blue Heliotrope","Bridal Creeper",
    "Caltrop","Coltsfoot","Fleabane","Flax-leaf Broom","Fountain Grass","Galvanised Burr",
    "Giant Parramatta Grass","Glycine","Green Cestrum","Horehound","Khaki Weed","Noogoora Burr",
    "Parthenium Weed","Prickly Pear (common)","Saffron Thistle","Silverleaf Nightshade",
    "Spear Thistle","Sweet Vernal Grass","Three-cornered Jack","Wild Radish"
  ];

  if (!getChemicals().length) {
    setChemicals([
      { name:"Crucial", amount:80, unit:"L" },
      { name:"SuperWet", amount:20, unit:"L" },
      { name:"Bosol", amount:1000, unit:"g" },
      { name:"Grazon", amount:40, unit:"L" }
    ]);
  }

  // ---------- Splash & Theme ----------
  try { applyTheme(); } catch {}
  setTimeout(()=>{ const s=$("splash"); if(s) s.style.display="none"; },900);

  let currentRoadText = "";
  let trackingWatchId = null;
  let trackingCoords = [];

  // ---------- Helpers ----------
  function ddmmyyyy(dateISO){ const d=new Date(dateISO||Date.now()); return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;}
  function ddmmyyyyCompact(dateISO){ const d=new Date(dateISO||Date.now()); return `${String(d.getDate()).padStart(2,"0")}${String(d.getMonth()+1).padStart(2,"0")}${d.getFullYear()}`;}
  function windDegToCardinal(deg){ if(deg==null||isNaN(deg))return""; const dirs=["N","NE","E","SE","S","SW","W","NW"]; return dirs[Math.round(deg/45)%8]; }
  function appleMapsNav(lat,lon){ const a=document.createElement("a"); a.href=`maps://?daddr=${lat},${lon}&dirflg=d`; document.body.appendChild(a); a.click(); setTimeout(()=>{window.open(`https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`,"_blank");a.remove();},250);}
  
  // ---------- Populate Weeds ----------
  function ensureWeedsSelect(){
    const sel=$("weedSelect"); if(!sel)return; sel.innerHTML="";
    const def=document.createElement("option"); def.value=""; def.textContent="— Select Weed —"; sel.appendChild(def);
    const all=BASE_WEEDS.slice(); const nox=all.filter(w=>w.includes(NOX_TAG)).sort(); const rest=all.filter(w=>!w.includes(NOX_TAG)).sort();
    const cat=document.createElement("option"); cat.value="NOXIOUS_WEEDS"; cat.textContent="⚠ NOXIOUS WEEDS (category)"; sel.appendChild(cat);
    nox.forEach(w=>{ const o=document.createElement("option"); o.value=w.replace(NOX_TAG,""); o.textContent=`▲ ${w.replace(NOX_TAG,"").trim()} (noxious)`; sel.appendChild(o);});
    rest.forEach(w=>{ const o=document.createElement("option"); o.value=w; o.textContent=w; sel.appendChild(o);});
  }

  // ---------- Navigation ----------
  $$("[data-target]").forEach(b=>b.addEventListener("click",e=>{
    e.preventDefault(); switchScreen(b.dataset.target);
    if(b.dataset.target==="recordsScreen")renderRecords();
    if(b.dataset.target==="batchesScreen")renderBatches();
    if(b.dataset.target==="inventoryScreen")renderInventory();
    if(b.dataset.target==="mappingScreen")ensureMapAndDraw(true);
  }));
  $$(".home-btn").forEach(b=>b.addEventListener("click",e=>{e.preventDefault();switchScreen("homeScreen");}));

  // ---------- Create Task Setup ----------
  ensureWeedsSelect(); fillBatchPicker();

  const jobType=$("jobType");
  const locateBtn=$("locateBtn"); const locRoadEl=$("locRoad");
  const autoNameBtn=$("autoNameBtn"); const jobNameEl=$("jobName");
  const councilEl=$("councilNum"); const dateEl=$("jobDate");
  const startEl=$("startTime"); const endEl=$("endTime");
  const wxBtn=$("autoWeatherBtn"); const tempEl=$("wTemp");
  const windEl=$("wWind"); const windDirDeg=$("wDir");
  const humEl=$("wHum"); const windDirCard=$("wCard");
  const weedSel=$("weedSelect"); const batchSel=$("batchSelect");
  const notesEl=$("notes"); const remSel=$("reminderWeeks");

  if(remSel&&!remSel.options.length){for(let i=1;i<=52;i++){const o=document.createElement("option");o.value=i;o.textContent=i;remSel.appendChild(o);}}
  if(dateEl&&!dateEl.value)dateEl.value=new Date().toISOString().slice(0,10);

  locateBtn?.addEventListener("click",()=>{
    showSpinner("Getting location…");
    if(!navigator.geolocation){hideSpinner();toast("Enable location");return;}
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{
        const{latitude,longitude}=pos.coords;
        const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
        const j=await r.json(); currentRoadText=j.address?.road||j.display_name||`${latitude.toFixed(5)},${longitude.toFixed(5)}`;
        locRoadEl.textContent=currentRoadText;
      }catch{const{latitude,longitude}=pos.coords;currentRoadText=`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;locRoadEl.textContent=currentRoadText;}
      hideSpinner();
    },()=>{hideSpinner();toast("GPS failed");});
  });

  autoNameBtn?.addEventListener("click",()=>{
    const type=jobType.value||"Inspection";
    const letter=(type==="Inspection")?"I":(type==="Road Spray")?"R":"S";
    const name=(currentRoadText||"Unknown").replace(/\s+/g,"");
    jobNameEl.value=`${name}${ddmmyyyyCompact(dateEl.value)}${letter}`;
  });

  wxBtn?.addEventListener("click",async()=>{
    if(!navigator.geolocation){toast("Enable location services");return;}
    showSpinner("Fetching weather…");
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{
        const{latitude,longitude}=pos.coords;
        const url=`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;
        const r=await fetch(url); const j=await r.json(); const c=j.current||{};
        tempEl.value=c.temperature_2m||""; windEl.value=c.wind_speed_10m||"";
        windDirDeg.value=c.wind_direction_10m||""; windDirCard.value=windDegToCardinal(c.wind_direction_10m); humEl.value=c.relative_humidity_2m||"";
        toast("Weather updated 🌦️");
      }catch{toast("Weather unavailable");} hideSpinner();
    },()=>{hideSpinner();toast("Location not available");});
  });

  function syncRoadBlock(){const b=$("roadTrackBlock");if(!b)return;b.style.display=(jobType.value==="Road Spray")?"block":"none";}
  jobType?.addEventListener("change",syncRoadBlock); syncRoadBlock();

  const startTrackBtn=$("startTrack"),stopTrackBtn=$("stopTrack"),trackStatus=$("trackStatus");
  startTrackBtn?.addEventListener("click",()=>{
    if(!navigator.geolocation){toast("Enable location");return;}
    try{navigator.geolocation.clearWatch(trackingWatchId);}catch{} trackingCoords=[];
    trackingWatchId=navigator.geolocation.watchPosition(pos=>{
      trackingCoords.push([pos.coords.latitude,pos.coords.longitude]);
      trackStatus.textContent=`Tracking… ${trackingCoords.length} pts`;
    },()=>toast("Tracking error"),{enableHighAccuracy:true,timeout:10000});
  });
  stopTrackBtn?.addEventListener("click",()=>{
    try{navigator.geolocation.clearWatch(trackingWatchId);}catch{}
    trackStatus.textContent=`Stopped (${trackingCoords.length} pts)`;
    localStorage.setItem("lastTrack",JSON.stringify(trackingCoords));
  });

  $("saveTask")?.addEventListener("click",()=>saveTask(false));
  $("saveDraft")?.addEventListener("click",()=>saveTask(true));

  function saveTask(isDraft){
    showSpinner(isDraft?"Saving draft…":"Saving task…");
    const id=Date.now().toString();
    const obj={id,
      jobName:jobNameEl.value.trim()||("Task_"+id),
      councilNo:(councilEl.value||"").trim(),
      type:jobType.value||"Inspection",
      date:dateEl.value||new Date().toISOString().slice(0,10),
      start:startEl.value||"", end:endEl.value||"",
      temp:tempEl.value||"", wind:windEl.value||"",
      windDeg:windDirDeg.value||"", windCard:windDirCard.value||"", hum:humEl.value||"",
      weed:(weedSel.value==="NOXIOUS_WEEDS"?"Noxious Weeds (category)":(weedSel.value||"")),
      batchId:batchSel.value||"", notes:notesEl.value||"", status:isDraft?"Draft":"Incomplete",
      coords:trackingCoords.slice(),
      reminderWeeks:remSel.value||"", reminderDate:remSel.value?new Date(Date.now()+Number(remSel.value)*7*864e5).toISOString():"",
      createdAt:new Date().toISOString(), archived:false
    };
    const jobs=getJobs(); const i=jobs.findIndex(j=>j.jobName===obj.jobName);
    if(i>=0)jobs[i]=obj;else jobs.push(obj); setJobs(jobs);
    spinnerDone(isDraft?"Draft saved ✅":"Task saved ✅"); setTimeout(hideSpinner,700);
    try{renderRecords();}catch{} try{ensureMapAndDraw(false);}catch{}
  }
/* ===========================================
   WeedTracker V60 Pilot Final — APPS.JS (Part 2/2)
   =========================================== */

  // ---------- Records ----------
  function renderRecords(){
    const cont=$("recordsContainer"); if(!cont)return;
    const jobs=getJobs(); cont.innerHTML="";
    if(!jobs.length){cont.innerHTML="<p>No records yet.</p>";return;}

    jobs.sort((a,b)=>new Date(b.date)-new Date(a.date));
    for(const j of jobs){
      const div=document.createElement("div"); div.className="record-card";
      div.innerHTML=`
        <h3>${j.jobName}</h3>
        <p><b>Type:</b> ${j.type} • <b>${ddmmyyyy(j.date)}</b> • ${j.status}</p>
        <p><b>Weed:</b> ${j.weed||"—"} | <b>Batch:</b> ${j.batchId||"—"}</p>
        <p><b>Weather:</b> ${j.temp}°C, ${j.wind} km/h ${j.windCard||""}, ${j.hum}%</p>
        <p><b>Reminder:</b> ${j.reminderWeeks?`${j.reminderWeeks} wk`:"—"}</p>
        <button class="btn green" data-open="${j.id}">Open</button>
        <button class="btn grey" data-edit="${j.id}">Edit</button>
        <button class="btn red" data-del="${j.id}">Delete</button>
      `;
      cont.appendChild(div);
    }
    $$("[data-open]").forEach(b=>b.addEventListener("click",()=>openRecord(b.dataset.open)));
    $$("[data-edit]").forEach(b=>b.addEventListener("click",()=>editRecord(b.dataset.edit)));
    $$("[data-del]").forEach(b=>b.addEventListener("click",()=>deleteRecord(b.dataset.del)));
  }

  function openRecord(id){
    const j=getJobs().find(x=>x.id===id); if(!j)return;
    alert(`${j.jobName}\n${j.type}\n${j.date}\n${j.notes||"No notes"}`);
  }
  function editRecord(id){const j=getJobs().find(x=>x.id===id); if(!j)return; loadJobToForm(j);}
  function deleteRecord(id){if(confirm("Delete this record?")){setJobs(getJobs().filter(x=>x.id!==id));renderRecords();}}

  // ---------- Mapping ----------
  let map=null; let mapInit=false;
  function ensureMapAndDraw(centerSelf){
    const div=$("mapContainer"); if(!div)return;
    if(!mapInit){ map=L.map("mapContainer").setView([-34.45,148.7],11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map); mapInit=true;}
    map.eachLayer(l=>{if(l instanceof L.Marker||l instanceof L.Polyline)map.removeLayer(l);});
    const jobs=getJobs();
    for(const j of jobs){
      if(!j.coords||!j.coords.length)continue;
      const c=j.coords; const clr=j.type==="Road Spray"?"yellow":j.type==="Spot Spray"?"red":"blue";
      if(j.type==="Road Spray"){L.polyline(c,{color:clr}).addTo(map);}else{
        const m=L.marker(c[0]); m.bindPopup(`<b>${j.jobName}</b><br>${j.type}<br>${ddmmyyyy(j.date)}`); m.addTo(map);}
    }
    if(centerSelf&&navigator.geolocation){navigator.geolocation.getCurrentPosition(p=>map.setView([p.coords.latitude,p.coords.longitude],12));}
  }

  // ---------- Batches ----------
  function renderBatches(){
    const cont=$("batchesContainer"); if(!cont)return;
    const batches=getBatches(); cont.innerHTML="";
    if(!batches.length){cont.innerHTML="<p>No batches yet.</p>";return;}
    for(const b of batches){
      const div=document.createElement("div"); div.className="batch-card";
      div.innerHTML=`
        <h3>${b.name}</h3>
        <p>${ddmmyyyy(b.date)} • remaining ${b.remaining||0} L • used ${b.used||0} L</p>
        <p>Total chemicals: ${b.total||"—"}</p>
        <button class="btn green" data-open="${b.id}">Open</button>
        <button class="btn red" data-dump="${b.id}">Dump</button>
      `;
      cont.appendChild(div);
    }
    $$("[data-open]").forEach(b=>b.addEventListener("click",()=>openBatch(b.dataset.open)));
    $$("[data-dump]").forEach(b=>b.addEventListener("click",()=>dumpBatch(b.dataset.dump)));
  }

  function openBatch(id){
    const b=getBatches().find(x=>x.id===id); if(!b)return;
    alert(`${b.name}\n${b.total||"—"} chemicals\nUsed ${b.used||0}L`);
  }
  function dumpBatch(id){
    const arr=getBatches(); const b=arr.find(x=>x.id===id); if(!b)return;
    if(confirm("Mark this batch as dumped?")){b.dumped=true;setBatches(arr);renderBatches();}
  }

  // ---------- Inventory ----------
  function renderInventory(){
    const cont=$("inventoryContainer"); if(!cont)return;
    const chems=getChemicals(); cont.innerHTML="";
    for(const c of chems){
      const div=document.createElement("div"); div.className="chem-item";
      div.innerHTML=`<b>${c.name}</b>: ${c.amount}${c.unit}`;
      cont.appendChild(div);
    }
  }

  // ---------- Reminders ----------
  setInterval(()=>{
    const jobs=getJobs(); const now=Date.now();
    for(const j of jobs){
      if(j.reminderDate && !j.archived){
        const diff=new Date(j.reminderDate).getTime()-now;
        if(diff<0){toast(`Reminder due: ${j.jobName}`); j.archived=true;}
      }
    }
    setJobs(jobs);
  },60000); // check every 60s

  // ---------- Utils ----------
  function switchScreen(id){$$(".screen").forEach(s=>s.classList.remove("active")); $(id)?.classList.add("active");}
  function toast(msg){const t=$("toastHost"); if(!t)return; const n=document.createElement("div"); n.className="toast"; n.textContent=msg; t.appendChild(n); setTimeout(()=>n.remove(),3000);}
  function showSpinner(msg){$("spinnerText").textContent=msg; $("spinner").style.display="flex";}
  function spinnerDone(msg){$("spinnerText").textContent=msg;}
  function hideSpinner(){$("spinner").style.display="none";}
});

/* ===== STORAGE HELPERS (for context) ===== */
function getJobs(){return JSON.parse(localStorage.getItem("jobs")||"[]");}
function setJobs(v){localStorage.setItem("jobs",JSON.stringify(v));}
function getBatches(){return JSON.parse(localStorage.getItem("batches")||"[]");}
function setBatches(v){localStorage.setItem("batches",JSON.stringify(v));}
function getChemicals(){return JSON.parse(localStorage.getItem("chemicals")||"[]");}
function setChemicals(v){localStorage.setItem("chemicals",JSON.stringify(v));}
