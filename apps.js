/* WeedTracker V62 Final Pilot — apps.js (Part A/2)
   Full core logic:
   - AU date format (DD-MM-YYYY) + compact for job names
   - Locate Me first, then Auto-Name
   - Weather auto-fill incl. humidity, wind (km/h), wind ° + compass (N/E/S/W)
   - Noxious weeds pinned to top with triangle markers (▲ yellow), category "Noxious Weeds" shown with red triangle
   - Records: free text search (road/name/weed/council/batch), date range, type
   - Records & Batches: Open (popup), Edit, Delete, Navigate (Apple Maps)
   - Batches: total made/remaining, what it’s made of, time/date, linked jobs; edit updates in place (no duplicate)
   - Link Existing Job + Link Inspection (archive inspection from reminders)
   - Road tracking (start/stop); track saved and drawn on map
   - Mapping: light OSM, Locate Me button, clickable pins & polylines, navigate
   - Spinners on long ops (+ toasts)
   - Inventory supports L, mL, g, kg; procurement thresholds
   - SDS Chemwatch link pinned at top of inventory
   - LocalStorage rolling backup (via storage.js backup call)
*/

// ---------- Safe DOM helpers ----------
const $  = (sel, r=document)=> r.querySelector(sel);
const $$ = (sel, r=document)=> Array.from(r.querySelectorAll(sel));

// ---------- Spinner / Toast wrappers (from extras.css host) ----------
function spin(on){ const s=$("#spinner"); if(!s) return; s.classList[on?"add":"remove"]("active"); }
function toast(msg, dur=2200){
  const host=$("#toastHost")||document.body;
  const d=document.createElement("div"); d.className="toast"; d.textContent=msg;
  host.appendChild(d); setTimeout(()=>d.remove(), dur);
}

// ---------- Date helpers (AU) ----------
function toDateAUString(d){
  const dt = (d instanceof Date)? d : new Date(d);
  const dd=String(dt.getDate()).padStart(2,"0");
  const mm=String(dt.getMonth()+1).padStart(2,"0");
  const yyyy=dt.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}
function toDateAUCompact(d){
  const dt = (d instanceof Date)? d : new Date(d);
  const dd=String(dt.getDate()).padStart(2,"0");
  const mm=String(dt.getMonth()+1).padStart(2,"0");
  const yyyy=dt.getFullYear();
  return `${dd}${mm}${yyyy}`;
}
function todayISO(){ return new Date().toISOString().split("T")[0]; }
function nowTime(){ return new Date().toTimeString().slice(0,5); }

// ---------- Wind compass ----------
function degToCompass(deg){
  if (deg==null || deg==="") return "";
  const dirs=["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW","N"];
  const idx=Math.round(((Number(deg)%360)/22.5));
  return dirs[idx];
}

// ---------- Seed data (40 weeds, with "noxious" tagging) ----------
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

// ---------- App state (pulled from storage.js helpers) ----------
let JOBS    = getAllJobs();      // [{...}]
let BATCHES = getAllBatches();   // [{...}]
let CHEMS   = getAllChemicals(); // [{...}]

// ---------- Navigation wiring ----------
function switchScreen(id){
  $$(".screen").forEach(s=> s.classList.remove("active"));
  $("#"+id)?.classList.add("active");
  // lazy refresh per screen
  if (id==="records")  renderRecords();
  if (id==="batches")  renderBatches();
  if (id==="chemicals") renderChems();
  if (id==="procure")  renderProcurement();
  if (id==="mapping")  renderMap(true);
}
$$("[data-target]").forEach(b=> b.addEventListener("click", ()=> switchScreen(b.dataset.target)));
$$(".home-btn").forEach(b=> b.addEventListener("click", ()=> switchScreen("home")));
$("#homeBtn")?.addEventListener("click", ()=> switchScreen("home")); // support alternate index

// ---------- Initial setup ----------
document.addEventListener("DOMContentLoaded", () => {
  // default date
  const jd=$("#jobDate"); if (jd && !jd.value) jd.value=todayISO();

  // Reminder options (1..52)
  const rem=$("#reminderWeeks");
  if (rem && !rem.options.length){
    for (let i=1;i<=52;i++){ const o=document.createElement("option"); o.value=o.textContent=i; rem.appendChild(o); }
  }

  // Task type toggles roadside block
  const typeSel=$("#taskType");
  const rtBlock=$("#roadTrackBlock");
  const syncTrack=()=> rtBlock && (rtBlock.style.display = (typeSel?.value==="Road Spray" ? "block" : "none"));
  typeSel?.addEventListener("change", syncTrack); syncTrack();

  // Populate weeds, batches, chems/procurement
  populateWeeds();
  populateBatchSelect();
  renderChems();
  renderProcurement();

  // Mapping init on first open
  // (renderMap called in switchScreen)

  // SDS button (safety data sheets)
  $("#openSDS")?.addEventListener("click", ()=> window.open("https://jr.chemwatch.net/chemwatch.web/home","_blank"));

  // Locate Me then AutoName wiring
  $("#locateBtn")?.addEventListener("click", onLocate);
  $("#autoNameBtn")?.addEventListener("click", onAutoName);

  // Weather
  $("#autoWeatherBtn")?.addEventListener("click", onAutoWeather);

  // Save task
  $("#saveTask")?.addEventListener("click", ()=> saveTask(false));
  $("#saveDraft")?.addEventListener("click", ()=> saveTask(true));

  // Records filters
  $("#recSearchBtn")?.addEventListener("click", renderRecords);
  $("#recResetBtn")?.addEventListener("click", resetRecordFilters);

  // Batches filters & new
  $("#batSearchBtn")?.addEventListener("click", renderBatches);
  $("#batResetBtn")?.addEventListener("click", ()=>{ $("#batFrom").value=""; $("#batTo").value=""; renderBatches(); });
  $("#newBatch")?.addEventListener("click", createNewBatch);

  // Map filters
  $("#mapSearchBtn")?.addEventListener("click", ()=> renderMap(true));
  $("#mapResetBtn")?.addEventListener("click", ()=>{
    $("#mapFrom").value=""; $("#mapTo").value=""; $("#mapType").value="All"; $("#mapWeed").value="";
    renderMap(true);
  });

  // Inventory add
  $("#addChem")?.addEventListener("click", addChemical);

  // Account + export/restore/clear
  const acct=$("#accountEmail"); if (acct) acct.value = getAccountEmail() || "";
  $("#saveAccount")?.addEventListener("click", ()=>{ saveAccountEmail($("#accountEmail").value.trim()); toast("Saved email"); });
  $("#exportBtn")?.addEventListener("click", exportData);
  $("#restoreBtn")?.addEventListener("click", ()=>{
    if (restoreBackup()){
      JOBS=getAllJobs(); BATCHES=getAllBatches(); CHEMS=getAllChemicals();
      renderRecords(); renderBatches(); renderChems(); renderProcurement(); renderMap();
      toast("Restored latest backup");
    } else { toast("No backup found"); }
  });
  $("#clearBtn")?.addEventListener("click", ()=>{
    if (!confirm("Clear ALL local data?")) return;
    clearAllData();
    JOBS=[]; BATCHES=[]; CHEMS=[];
    renderRecords(); renderBatches(); renderChems(); renderProcurement(); renderMap();
    toast("All data cleared");
  });

  // Photo preview
  $("#photoInput")?.addEventListener("change", e=>{
    const f=e.target.files?.[0]; if(!f) return;
    const url=URL.createObjectURL(f);
    const img=$("#photoPreview"); if (img){ img.src=url; img.style.display="block"; }
  });
});

// ---------- Location / AutoName ----------
let lastRoadLabel = "Unknown";
let lastCoords = null; // for map & navigation

async function onLocate(){
  spin(true);
  if (!navigator.geolocation){ spin(false); toast("Enable location"); return; }
  navigator.geolocation.getCurrentPosition(async pos=>{
    const {latitude:lat, longitude:lon} = pos.coords;
    lastCoords = [lat, lon];
    try{
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
      const j = await r.json();
      lastRoadLabel = j.address?.road || j.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    }catch{
      lastRoadLabel = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    }
    $("#locRoad").textContent = lastRoadLabel;
    spin(false);
  }, ()=>{ spin(false); toast("GPS failed"); });
}

function onAutoName(){
  const t = $("#taskType")?.value || "Inspection";
  const prefix = ({Inspection:"I", "Spot Spray":"SS","Road Spray":"RS"})[t] || "I";
  const dInput=$("#jobDate"); const dt=dInput?.value ? new Date(dInput.value) : new Date();
  const compact = toDateAUCompact(dt); // DDMMYYYY
  const base = (lastRoadLabel || "Unknown").replace(/\s+/g,"");
  const out = `${prefix}${compact}_${base}`;
  $("#jobName").value = out;
}

// ---------- Weather ----------
async function onAutoWeather(){
  if (!navigator.geolocation){ toast("Enable location services"); return; }
  spin(true);
  navigator.geolocation.getCurrentPosition(async pos=>{
    try{
      const {latitude, longitude} = pos.coords;
      const url=`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;
      const r=await fetch(url); const j=await r.json(); const c=j.current||{};
      $("#temp").value     = c.temperature_2m ?? "";
      $("#wind").value     = c.wind_speed_10m ?? "";
      const deg = c.wind_direction_10m ?? "";
      const comp = deg===""? "" : degToCompass(deg);
      $("#windDir").value  = deg===""? "" : `${deg}° ${comp}`;
      $("#humidity").value = c.relative_humidity_2m ?? "";
      $("#wxUpdated").textContent = "Updated @ " + nowTime();
      toast("Weather updated");
    }catch{ toast("Weather unavailable"); }
    finally{ spin(false); }
  }, ()=>{ spin(false); toast("Location not available"); });
}

// ---------- Weeds (noxious pinned with triangles) ----------
function populateWeeds(){
  const sel=$("#weedSelect"); if (!sel) return;
  sel.innerHTML="";

  // Build: Category first (red triangle), then all noxious (yellow triangle), then others (plain)
  const cat = document.createElement("option");
  cat.value = "NOXIOUS_WEEDS";
  cat.textContent = "▲ NOXIOUS WEEDS (category)";
  cat.dataset.level = "cat"; // red styling to be handled via CSS if desired
  sel.appendChild(cat);

  const nox = NSW_WEEDS_40.filter(w=>/noxious/i.test(w)).sort((a,b)=>a.localeCompare(b));
  const rest= NSW_WEEDS_40.filter(w=>! /noxious/i.test(w)).sort((a,b)=>a.localeCompare(b));

  nox.forEach(w=>{
    const o=document.createElement("option");
    o.value = w;
    // yellow triangle indicator
    o.textContent = `▲ ${w}`;
    o.dataset.level = "noxious";
    sel.appendChild(o);
  });
  rest.forEach(w=>{
    const o=document.createElement("option");
    o.value=w; o.textContent=w;
    sel.appendChild(o);
  });
}

// ---------- Batches select ----------
function populateBatchSelect(){
  const sel=$("#batchSelect"); if(!sel) return;
  sel.innerHTML="";
  const def=document.createElement("option"); def.value=""; def.textContent="— Select Batch —";
  sel.appendChild(def);
  BATCHES = getAllBatches();
  BATCHES
    .slice()
    .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
    .forEach(b=>{
      const remain = (Number(b.remaining)||0);
      const o=document.createElement("option");
      o.value=b.id;
      o.textContent = `${b.id} • ${toDateAUString(b.date||new Date())} • remain ${remain.toFixed(0)} L`;
      sel.appendChild(o);
    });
}

// ---------- Road tracking ----------
let tracking=false, trackTimer=null, trackCoords=[];
$("#startTrack")?.addEventListener("click", ()=>{
  tracking=true; trackCoords=[]; $("#trackStatus").textContent="Tracking…";
  if (trackTimer) clearInterval(trackTimer);
  if (!navigator.geolocation){ toast("Enable location"); return; }
  trackTimer=setInterval(()=> navigator.geolocation.getCurrentPosition(p=>{
    trackCoords.push([p.coords.latitude,p.coords.longitude]);
    lastCoords=[p.coords.latitude,p.coords.longitude];
  }), 5000);
});
$("#stopTrack")?.addEventListener("click", ()=>{
  tracking=false; if (trackTimer) clearInterval(trackTimer);
  $("#trackStatus").textContent=`Stopped (${trackCoords.length} pts)`;
  localStorage.setItem("lastTrack", JSON.stringify(trackCoords));
});

// ---------- Save Task (and Draft) ----------
function saveTask(isDraft){
  spin(true);
  const id = Date.now();

  const obj = {
    id,
    name: $("#jobName").value.trim() || ("Task_"+id),
    council: $("#councilNum").value.trim(),
    linkJobId: $("#linkJobId")?.value.trim() || "",
    linkedInspectionId: $("#linkInspectionId")?.value.trim() || "",
    type: $("#taskType").value,
    weed: $("#weedSelect").value,
    batch: $("#batchSelect").value,
    date: $("#jobDate").value || todayISO(),
    start: $("#startTime").value || "",
    end:   $("#endTime").value || "",
    temp: $("#temp").value, wind: $("#wind").value, windDir: $("#windDir").value, humidity: $("#humidity").value,
    reminder: $("#reminderWeeks").value || "",
    status: isDraft ? "Draft" : ($("input[name='status']:checked")?.value || "Incomplete"),
    notes: $("#notes").value || "",
    coords: trackCoords.slice(),
    photo: ($("#photoPreview")?.src && $("#photoPreview").style.display!=="none") ? $("#photoPreview").src : "",
    createdAt: new Date().toISOString(),
    archived:false
  };

  // Merge if same name exists
  JOBS = getAllJobs();
  const existing = JOBS.find(t=> t.name===obj.name);
  if (existing){ obj.id=existing.id; } // keep stable id

  // Link existing job if provided (soft link, leaves both)
  if (obj.linkJobId){
    const target = JOBS.find(t=> String(t.id)===obj.linkJobId || t.name===obj.linkJobId);
    if (target){ obj.linkedJob = target.id; }
  }

  // Link & archive inspection if provided
  if (obj.linkedInspectionId){
    const insp = JOBS.find(t=> t.type==="Inspection" && (String(t.id)===obj.linkedInspectionId || t.name===obj.linkedInspectionId));
    if (insp){ insp.archived=true; insp.status="Archived"; saveJob(insp); obj.linkedInspectionResolved=true; }
  }

  // Batch consumption heuristic if Road Spray + coords
  if (obj.batch){
    const b = getAllBatches().find(x=> x.id===obj.batch);
    if (b){
      const used = (obj.type==="Road Spray" && obj.coords.length>1) ? 100 : 0; // simple default
      b.used      = (Number(b.used)||0) + used;
      b.remaining = Math.max(0, (Number(b.mix)||0) - (Number(b.used)||0));
      saveBatch(b);
    }
  }

  // Persist job
  saveJob(obj);
  JOBS = getAllJobs();

  // refresh selectors & lists
  populateBatchSelect();
  renderRecords();
  renderMap();

  // spinner close + toast + ensure overlay disappears
  spin(false);
  toast(isDraft? "Draft saved" : "Task saved");
}

// ---------- Records ----------
function resetRecordFilters(){
  $("#recSearch").value=""; $("#recFrom").value=""; $("#recTo").value="";
  $("#recType").value="All";
  renderRecords();
}
function recordMatches(t, q, from, to, type){
  if (t.archived) return false;
  if (from && (t.date||"") < from) return false;
  if (to   && (t.date||"") > to)   return false;
  if (type && type!=="All" && t.type!==type) return false;
  if (q){
    const hay = `${t.name} ${t.weed} ${t.council} ${t.batch} ${t.notes} ${t.linkedInspectionId}`.toLowerCase();
    if (!hay.includes(q.toLowerCase())) return false;
  }
  return true;
}
function renderRecords(){
  const list=$("#recordsList"); if(!list) return; list.innerHTML="";
  JOBS = getAllJobs();

  // filters
  const q = $("#recSearch").value.trim();
  const from=$("#recFrom").value||"";
  const to  =$("#recTo").value||"";
  const type=$("#recType")?.value||"All";

  JOBS.filter(t=>recordMatches(t,q,from,to,type))
    .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
    .forEach(t=>{
      const item=document.createElement("div"); item.className="item";
      item.innerHTML = `
        <b>${t.name}</b>
        <small>${t.type} • ${toDateAUString(t.date)} • ${t.status}</small>
        <div class="row gap end" style="margin-top:.35rem;">
          <button class="pill" data-open="${t.id}">Open</button>
          <button class="pill" data-edit="${t.id}">Edit</button>
          <button class="pill danger" data-del="${t.id}">Delete</button>
          ${t.coords && t.coords.length ? `<button class="pill" data-nav="${t.id}">Navigate</button>` : ""}
        </div>
      `;
      // Wire buttons
      item.querySelector(`[data-open="${t.id}"]`)?.addEventListener("click", ()=> showJobPopup(t));
      item.querySelector(`[data-edit="${t.id}"]`)?.addEventListener("click", ()=> editJobInline(t));
      item.querySelector(`[data-del="${t.id}"]`)?.addEventListener("click", ()=>{
        if (!confirm("Delete this job?")) return;
        deleteJob(t.id);
        renderRecords(); renderMap();
      });
      const n=item.querySelector(`[data-nav="${t.id}"]`);
      if (n){ n.addEventListener("click", ()=>{
        const pt = t.coords?.[0];
        if(!pt){ toast("No coords saved"); return; }
        openAppleMaps(pt[0], pt[1]);
      }); }
      list.appendChild(item);
    });

  if (!list.children.length){
    const p=document.createElement("p"); p.className="muted"; p.textContent="No matching records.";
    list.appendChild(p);
  }
}

// ---------- Edit Job (in-place via Create Task form) ----------
function editJobInline(t){
  switchScreen("createTask");
  $("#jobName").value=t.name||"";
  $("#councilNum").value=t.council||"";
  $("#linkJobId").value=t.linkJobId||"";
  $("#linkInspectionId").value=t.linkedInspectionId||"";
  $("#taskType").value=t.type||"Inspection"; $("#taskType").dispatchEvent(new Event("change"));
  $("#weedSelect").value=t.weed||"";
  $("#batchSelect").value=t.batch||"";
  $("#jobDate").value=t.date||todayISO();
  $("#startTime").value=t.start||"";
  $("#endTime").value=t.end||"";
  $("#temp").value=t.temp||"";
  $("#wind").value=t.wind||"";
  $("#windDir").value=t.windDir||"";
  $("#humidity").value=t.humidity||"";
  $("#notes").value=t.notes||"";
  // keep photo preview if exists
  if (t.photo){ const img=$("#photoPreview"); img.src=t.photo; img.style.display="block"; }
}

// ---------- Job popup ----------
document.addEventListener("keydown", e=>{ if(e.key==="Escape"){ const m=$(".modal"); if(m) m.remove(); } });

function showJobPopup(t){
  const batchLink = t.batch ? `<a href="#" data-open-batch="${t.batch}">${t.batch}</a>` : "—";
  const linkedInsp = t.linkedInspectionId ? `<a href="#" data-open-insp="${t.linkedInspectionId}">${t.linkedInspectionId}</a>` : "—";
  const photoHtml = t.photo ? `<div style="margin:.4rem 0"><img src="${t.photo}" alt="photo" style="max-width:100%;border-radius:8px"/></div>` : "";
  const hasPt = t.coords && t.coords.length;

  const html=`
    <div class="modal">
      <div class="card p">
        <h3 style="margin-top:0">${t.name}</h3>
        <div class="grid two tight">
          <div><b>Type:</b> ${t.type}</div><div><b>Status:</b> ${t.status||"—"}</div>
          <div><b>Date:</b> ${toDateAUString(t.date)}</div>
          <div><b>Times:</b> ${t.start||"–"} → ${t.end||"–"}</div>
          <div><b>Weed:</b> ${t.weed||"—"}</div><div><b>Batch:</b> ${batchLink}</div>
          <div><b>Linked Insp:</b> ${linkedInsp}</div><div><b>Reminder:</b> ${t.reminder||"—"} wk</div>
          <div class="span2"><b>Weather:</b> ${t.temp||"–"}°C, ${t.wind||"–"} km/h, ${t.windDir||"–"}, ${t.humidity||"–"}%</div>
          <div class="span2"><b>Notes:</b> ${t.notes||"—"}</div>
        </div>
        ${photoHtml}
        <div class="row gap end" style="margin-top:.8rem;">
          ${hasPt? `<button class="pill" data-nav>Navigate</button>`:""}
          <button class="pill" data-edit>Edit</button>
          <button class="pill danger" data-close>Close</button>
        </div>
      </div>
    </div>`;
  const wrap=document.createElement("div"); wrap.innerHTML=html; document.body.appendChild(wrap.firstChild);
  const modal=$(".modal");
  modal?.addEventListener("click",(e)=>{ if(e.target===modal || e.target.dataset.close!=null) modal.remove(); });

  $("[data-open-batch]",modal)?.addEventListener("click",(e)=>{
    e.preventDefault();
    const id=e.target.dataset.openBatch;
    const b=BATCHES.find(x=>x.id===id);
    if (b) showBatchPopup(b);
  });
  $("[data-open-insp]",modal)?.addEventListener("click",(e)=>{
    e.preventDefault();
    const id=e.target.dataset.openInsp;
    const insp=JOBS.find(x=> x.type==="Inspection" && (String(x.id)===id || x.name===id));
    if (insp) showJobPopup(insp);
  });
  $("[data-edit]",modal)?.addEventListener("click",()=>{ editJobInline(t); modal.remove(); });
  $("[data-nav]",modal)?.addEventListener("click", ()=>{
    const pt = t.coords?.[0]; if (!pt){ toast("No coords"); return; }
    openAppleMaps(pt[0], pt[1]);
  });
}
/* WeedTracker V62 Final Pilot — apps.js (Part B/2)
   (continues from Part A) */

// ---------- Apple Maps navigation ----------
function openAppleMaps(lat, lon){
  const mapsURL = `maps://?daddr=${lat},${lon}&dirflg=d`;
  const webURL  = `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
  const a=document.createElement("a");
  a.href=mapsURL; document.body.appendChild(a); a.click();
  setTimeout(()=>{ window.open(webURL,"_blank"); a.remove(); }, 250);
}

// ---------- Batches ----------
function createNewBatch(){
  const id = "B"+Date.now();
  const mix = Number(prompt("Total mix (L):","600"))||0;
  const chems= prompt("Chemicals (e.g. 'Crucial 1.5L/100L, Wetter 300mL/100L')","")||"";
  const obj = { id, date: todayISO(), time: nowTime(), mix, remaining: mix, used:0, chemicals: chems };
  saveBatch(obj);
  BATCHES=getAllBatches();
  populateBatchSelect(); renderBatches();
  toast("Batch created");
}

function renderBatches(){
  const list=$("#batchList"); if(!list) return; list.innerHTML="";
  BATCHES=getAllBatches();
  const from=$("#batFrom").value||""; const to=$("#batTo").value||"";
  BATCHES
    .filter(b=>(!from||b.date>=from)&&(!to||b.date<=to))
    .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
    .forEach(b=>{
      const item=document.createElement("div"); item.className="item";
      item.innerHTML=`
        <b>${b.id}</b>
        <small>${toDateAUString(b.date)} • Total ${Number(b.mix||0).toFixed(0)} L • Remaining ${Number(b.remaining||0).toFixed(0)} L</small>
        <div class="row gap end" style="margin-top:.35rem;">
          <button class="pill" data-open="${b.id}">Open</button>
          <button class="pill" data-edit="${b.id}">Edit</button>
          <button class="pill danger" data-del="${b.id}">Delete</button>
        </div>
      `;
      item.querySelector(`[data-open="${b.id}"]`)?.addEventListener("click", ()=> showBatchPopup(b));
      item.querySelector(`[data-edit="${b.id}"]`)?.addEventListener("click", ()=> editBatchInline(b));
      item.querySelector(`[data-del="${b.id}"]`)?.addEventListener("click", ()=>{
        if(!confirm("Delete this batch?")) return;
        deleteBatch(b.id); populateBatchSelect(); renderBatches();
      });
      list.appendChild(item);
    });

  if (!list.children.length){
    const p=document.createElement("p"); p.className="muted"; p.textContent="No matching batches.";
    list.appendChild(p);
  }
}

function showBatchPopup(b){
  const jobs = getAllJobs().filter(t=> t.batch===b.id);
  const jobsHtml = jobs.length ? `<ul>${jobs.map(t=>`<li><a href="#" data-open-job="${t.id}">${t.name}</a></li>`).join("")}</ul>` : "—";
  const html=`
    <div class="modal">
      <div class="card p">
        <h3 style="margin-top:0">${b.id}</h3>
        <div><b>Date:</b> ${toDateAUString(b.date)||"–"} · <b>Time:</b> ${b.time || "–"}</div>
        <div><b>Total Mix Made:</b> ${Number(b.mix||0).toFixed(0)} L</div>
        <div><b>Total Mix Remaining:</b> ${Number(b.remaining||0).toFixed(0)} L</div>
        <div style="margin-top:.4rem;"><b>Chemicals (made of):</b><br>${b.chemicals || "—"}</div>
        <div style="margin-top:.4rem;"><b>Linked Jobs:</b><br>${jobsHtml}</div>
        <div class="row gap end" style="margin-top:.8rem;">
          <button class="pill" data-edit>Edit</button>
          <button class="pill danger" data-close>Close</button>
        </div>
      </div>
    </div>`;
  const wrap=document.createElement("div"); wrap.innerHTML=html; document.body.appendChild(wrap.firstChild);
  const modal=$(".modal");
  modal?.addEventListener("click",(e)=>{ if(e.target===modal || e.target.dataset.close!=null) modal.remove(); });
  $$("[data-open-job]",modal).forEach(a=> a.addEventListener("click",(e)=>{ e.preventDefault(); const t=JOBS.find(x=> String(x.id)===a.dataset.openJob); if (t) showJobPopup(t); }));
  $("[data-edit]",modal)?.addEventListener("click",()=>{ editBatchInline(b); modal.remove(); });
}

function editBatchInline(b){
  const mix = Number(prompt("Total mix (L):", b.mix))||b.mix;
  const rem = Number(prompt("Remaining (L):", b.remaining))||b.remaining;
  const chems= prompt("Chemicals:", b.chemicals||"") || (b.chemicals||"");
  b.mix=mix; b.remaining=rem; b.chemicals=chems; b.time ||= nowTime();
  saveBatch(b); populateBatchSelect(); renderBatches();
  toast("Batch updated");
}

// ---------- Chemical Inventory ----------
let _chemEditing=null;
function addChemical(){
  const name=prompt("Chemical name:"); if(!name) return;
  const active=prompt("Active ingredient:","")||"";
  const size=Number(prompt("Container size (number):","20"))||0;
  const unit=prompt("Unit (L, mL, g, kg):","L")||"L";
  const count=Number(prompt("How many containers:","0"))||0;
  const thr=Number(prompt("Reorder threshold (containers):","0"))||0;

  const obj={ name, active, containerSize:size, containerUnit:unit, containers:count, threshold:thr };
  saveChemical(obj); CHEMS=getAllChemicals();
  renderChems(); renderProcurement();
  toast("Chemical added");
}

function openChemEditor(c){
  _chemEditing=c;
  $("#ce_name").value=c.name||"";
  $("#ce_active").value=c.active||"";
  $("#ce_size").value=c.containerSize||0;
  $("#ce_unit").value=c.containerUnit||"L";
  $("#ce_count").value=c.containers||0;
  $("#ce_threshold").value=c.threshold||0;
  $("#chemEditSheet").style.display="flex";
}
function closeChemEditor(){ $("#chemEditSheet").style.display="none"; _chemEditing=null; }

$("#ce_cancel")?.addEventListener("click", closeChemEditor);
$("#ce_save")?.addEventListener("click", ()=>{
  if(!_chemEditing) return;
  _chemEditing.name = $("#ce_name").value.trim();
  _chemEditing.active = $("#ce_active").value.trim();
  _chemEditing.containerSize = Number($("#ce_size").value)||0;
  _chemEditing.containerUnit = $("#ce_unit").value||"L";
  _chemEditing.containers = Number($("#ce_count").value)||0;
  _chemEditing.threshold  = Number($("#ce_threshold").value)||0;
  saveChemical(_chemEditing);
  CHEMS=getAllChemicals();
  renderChems(); renderProcurement(); closeChemEditor(); toast("Chemical updated");
});

function renderChems(){
  const list=$("#chemList"); if(!list) return; list.innerHTML="";

  CHEMS = getAllChemicals();
  if (!CHEMS.length){
    // example seed in case empty
    const seed = [
      {name:"Crucial", active:"Glyphosate 540 g/L", containerSize:20, containerUnit:"L", containers:4, threshold:2},
      {name:"Bosol", active:"Metsulfuron-methyl", containerSize:500, containerUnit:"g", containers:2, threshold:1},
    ];
    seed.forEach(saveChemical);
    CHEMS=getAllChemicals();
  }

  CHEMS.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach(c=>{
    const total = (Number(c.containers)||0) * (Number(c.containerSize)||0);
    const line = `${c.containers||0} × ${Number(c.containerSize||0).toFixed(0)} ${c.containerUnit} • total ${Number(total).toFixed(0)} ${c.containerUnit}`;
    const card=document.createElement("div"); card.className="item";
    card.innerHTML=`
      <b>${c.name}</b><br>
      <small>${line}</small><br>
      <small>Active: ${c.active||"—"}</small>
      <div class="row gap end" style="margin-top:.4rem;">
        <button class="pill" data-edit>Edit</button>
        <button class="pill danger" data-del>Delete</button>
      </div>
    `;
    card.querySelector("[data-edit]")?.addEventListener("click", ()=> openChemEditor(c));
    card.querySelector("[data-del]")?.addEventListener("click", ()=>{
      if(!confirm("Delete chemical?")) return;
      deleteChemical(c.name);
      CHEMS=getAllChemicals();
      renderChems(); renderProcurement();
    });
    list.appendChild(card);
  });
}

function renderProcurement(){
  const ul=$("#procList"); if(!ul) return; ul.innerHTML="";
  CHEMS = getAllChemicals();
  CHEMS.forEach(c=>{
    if (c.threshold && (c.containers||0) < c.threshold){
      const li=document.createElement("li");
      li.textContent=`Low stock: ${c.name} (${c.containers||0} < ${c.threshold})`;
      ul.appendChild(li);
    }
  });
}

// ---------- Mapping (Leaflet) ----------
let map, locateCtrl;
function ensureMap(){
  if (map) return map;
  map = L.map("map").setView([-34.75,148.65], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);

  // Locate Me control
  locateCtrl = L.control({position:"bottomright"});
  locateCtrl.onAdd = function(){
    const d=L.DomUtil.create("div","leaflet-bar");
    d.style.background="#2f6930"; d.style.color="#fff"; d.style.borderRadius="6px"; d.style.padding="6px 10px"; d.style.cursor="pointer";
    d.innerText="Locate Me";
    d.onclick=()=>{
      if (!navigator.geolocation){ toast("Enable location"); return; }
      navigator.geolocation.getCurrentPosition(p=>{
        const pt=[p.coords.latitude,p.coords.longitude];
        map.setView(pt, 14);
        L.circleMarker(pt,{radius:7,opacity:.95}).addTo(map).bindPopup("You are here").openPopup();
      });
    };
    return d;
  };
  locateCtrl.addTo(map);
  return map;
}

function renderMap(fit=false){
  const m=ensureMap();
  // Clear all non-tiles
  m.eachLayer(l=>{ if (!(l instanceof L.TileLayer)) m.removeLayer(l); });

  // Filters
  const from=$("#mapFrom").value||"";
  const to  =$("#mapTo").value||"";
  const typ =$("#mapType").value||"All";
  const q   =($("#mapWeed")?.value||"").trim().toLowerCase();

  const tasks = getAllJobs()
    .filter(t=>!t.archived)
    .filter(t=>(!from||t.date>=from)&&(!to||t.date<=to))
    .filter(t=> typ==="All" ? true : t.type===typ)
    .filter(t=>{
      if (!q) return true;
      const hay = `${t.name} ${t.weed} ${t.council} ${t.batch} ${t.notes}`.toLowerCase();
      return hay.includes(q);
    });

  const group = L.featureGroup();

  tasks.forEach(t=>{
    if (t.coords?.length>1){
      group.addLayer(L.polyline(t.coords,{color:"yellow",weight:4,opacity:.9}));
    }
    // first point
    const pt = t.coords?.[0] || null;
    const lat = pt? pt[0] : (lastCoords? lastCoords[0] : -34.75);
    const lon = pt? pt[1] : (lastCoords? lastCoords[1] : 148.65);
    const openId = `open_${t.id}`;
    const navId  = `nav_${t.id}`;
    const thumb = t.photo ? `<br><img src="${t.photo}" style="max-width:180px;border-radius:6px;margin-top:.3rem">` : "";
    const popup=`
      <b>${t.name}</b><br>${t.type} • ${toDateAUString(t.date)}${thumb}
      <br><button class="pill" id="${openId}" style="margin-top:.35rem">Open</button>
      <button class="pill" id="${navId}" style="margin-top:.35rem;margin-left:.4rem">Navigate</button>
    `;
    const marker=L.marker([lat,lon]); marker.bindPopup(popup);
    marker.on("popupopen", ()=>{
      setTimeout(()=>{
        const ob=document.getElementById(openId);
        const nb=document.getElementById(navId);
        ob && (ob.onclick=()=> showJobPopup(t));
        nb && (nb.onclick=()=> openAppleMaps(lat,lon));
      },0);
    });
    group.addLayer(marker);
  });

  group.addTo(m);
  if (fit && tasks.length){
    try{ m.fitBounds(group.getBounds().pad(0.2)); }catch{}
  }

  // Show last tracked polyline for quick reference
  try{
    const last = JSON.parse(localStorage.getItem("lastTrack")||"[]");
    if (Array.isArray(last) && last.length>1) L.polyline(last,{color:"#ffda44",weight:3,opacity:.8}).addTo(m);
  }catch{}
}

// ---------- END ----------
console.log("WeedTracker V62 Final Pilot — apps.js loaded");
