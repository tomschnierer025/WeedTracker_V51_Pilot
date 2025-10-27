/* === WeedTracker V60 Pilot — apps.js (Part A) ===
 * Charcoal theme, iPhone-first
 * Home button (top-right)
 * Roadside tracking only for Road Spray
 * Auto-naming: RoadNameDDMMYYLetter  (I=Inspection, S=Spot Spray, R=Road Spray)
 * Weather auto-fill button (uses extras.js)
 * Noxious weeds pinned at top with ⚠; category “Noxious Weeds” highlighted
 * Records & Batches popups: Open/Edit/Delete/Close work
 * Map: Leaflet, Locate Me button, clickable pins with Open / Navigate (Apple Maps)
 * Search by road/name/weed/council; de-cluttered filters (details)
 * Spinners & toasts for saves/creates
 * Create Batch will be a single-page modal with add/remove chemicals (in PART B)
 */

/* ---------------------------
   UTILITIES & CONSTANTS
--------------------------- */
const NSW_WEEDS = [
  // Pinned noxious first (these display with ⚠)
  "Noxious Weeds (category)", // visible at top, acts like label
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
  // Other weeds (incl. your add: Cape Broom already above as noxious)
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

const TYPE_LETTER = { "Inspection": "I", "Spot Spray": "S", "Road Spray": "R" };

// Cardinal wind from degrees
function degToNESW(deg) {
  if (deg == null || deg === "") return "";
  const dirs = ["N","NE","E","SE","S","SW","W","NW","N"];
  const i = Math.round(((deg % 360)+360)%360 / 45);
  return dirs[i];
}
function fmt(n, d=0) { return (n==null || n==="") ? "—" : Number(n).toFixed(d); }
function ddmmyyyy(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  const dd = String(dt.getDate()).padStart(2,"0");
  const mm = String(dt.getMonth()+1).padStart(2,"0");
  const yyyy = dt.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}
function ddmmyy_compact(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  const dd = String(dt.getDate()).padStart(2,"0");
  const mm = String(dt.getMonth()+1).padStart(2,"0");
  const yy = String(dt.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
}
function todayISO() { return new Date().toISOString().split("T")[0]; }
function nowTime() { return new Date().toTimeString().slice(0,5); }

// Apple Maps
function openAppleMaps(lat, lon) {
  const mapsURL = `maps://?daddr=${lat},${lon}&dirflg=d`;
  const webURL = `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
  const a = document.createElement("a");
  a.href = mapsURL;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ window.open(webURL, "_blank"); a.remove(); }, 300);
}

// Quick DOM helpers
const $ = (s, r=document)=> r.querySelector(s);
const $$ = (s, r=document)=> [...r.querySelectorAll(s)];

/* ---------------------------
   GLOBAL STATE
--------------------------- */
let JOBS = [];      // { id, name, council, linkedInspectionId, type, weed, batch, date, start, end, temp, wind, windDir, humidity, reminder, status, notes, road, coords[], photo, createdAt, archived }
let BATCHES = [];   // { id, date, time, mixL, remainingL, usedL, chemicals[], dumped[], linkedJobs[] }
let CHEMS = [];     // { name, active, containerSize, containerUnit, containers, threshold }
let SETTINGS = {};  // { accountEmail, ... }

let MAP = null;
let MAP_GROUP = null;

/* ---------------------------
   INIT
--------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  // Load storage (storage.js helpers)
  JOBS = loadJobs();
  BATCHES = loadBatches();
  CHEMS = loadChemicals();
  SETTINGS = loadSettings();

  // Seed initial CHEMS if empty (light seed)
  if (!CHEMS || CHEMS.length === 0) {
    CHEMS = [
      {name:"Crucial", active:"Glyphosate 540 g/L", containerSize:20, containerUnit:"L", containers:4, threshold:2},
      {name:"SuperWet", active:"Non-ionic surfactant", containerSize:20, containerUnit:"L", containers:1, threshold:1},
      {name:"Bow Saw 600", active:"Triclopyr 600 g/L", containerSize:1, containerUnit:"L", containers:2, threshold:1},
      {name:"Bosol", active:"Metsulfuron-methyl", containerSize:500, containerUnit:"g", containers:2, threshold:1}
    ];
    saveChemicals(CHEMS);
  }

  // Top Home button
  $$(".home-btn").forEach(btn => btn.addEventListener("click", () => switchScreen("home")));

  // Home nav cards
  $$("[data-target]").forEach(btn => btn.addEventListener("click", () => {
    switchScreen(btn.dataset.target);
    if (btn.dataset.target === "records") renderRecords();
    if (btn.dataset.target === "batches") renderBatches();
    if (btn.dataset.target === "inventory") renderInventory();
    if (btn.dataset.target === "mapping") ensureMap(true);
  }));

  // Settings load
  if ($("#accountEmail")) $("#accountEmail").value = SETTINGS.accountEmail || "";
  $("#saveAccount")?.addEventListener("click", () => {
    SETTINGS.accountEmail = ($("#accountEmail").value || "").trim();
    saveSettings(SETTINGS);
    showToast("Account saved");
  });
  $("#exportBtn")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({
      jobs:JOBS, batches:BATCHES, chemicals:CHEMS, settings:SETTINGS
    }, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "weedtracker_data.json"; a.click();
  });
  $("#restoreBtn")?.addEventListener("click", () => restoreBackup());
  $("#clearBtn")?.addEventListener("click", () => Storage.clearAll());

  // Create Task setup
  setupCreateTask();

  // Records filters
  $("#recSearchBtn")?.addEventListener("click", renderRecords);
  $("#recResetBtn")?.addEventListener("click", () => {
    $("#recSearch").value = "";
    $("#recFrom").value = "";
    $("#recTo").value = "";
    ["fInspection","fSpot","fRoad","fComplete","fIncomplete","fDraft"].forEach(id=> { const el=$("#"+id); if (el) el.checked=false; });
    renderRecords();
  });

  // Batches list filters and New Batch button (full-page modal in PART B)
  $("#batSearchBtn")?.addEventListener("click", renderBatches);
  $("#batResetBtn")?.addEventListener("click", () => { $("#batFrom").value=""; $("#batTo").value=""; renderBatches(); });
  $("#newBatch")?.addEventListener("click", openBatchCreateSheet); // in PART B

  // Inventory editor (PART B binds)
  $("#addChem")?.addEventListener("click", () => openChemEditor(null)); // create
  $("#ce_cancel")?.addEventListener("click", closeChemEditor);
  $("#ce_save")?.addEventListener("click", saveChemEditor);

  // SDS pinned action
  $("#openSDS")?.addEventListener("click", (e)=>{ /* link already has href */ });

  // Mapping filters
  $("#mapSearchBtn")?.addEventListener("click", ()=> ensureMap(true));
  $("#mapResetBtn")?.addEventListener("click", ()=>{
    $("#mapWeed").value="";
    $("#mapType").value="All";
    $("#mapFrom").value="";
    $("#mapTo").value="";
    ensureMap(true);
  });

  // Initial renders
  populateWeeds();
  populateBatchSelect();
  renderRecords();
  renderBatches();
  renderInventory();
});

/* ---------------------------
   CREATE TASK
--------------------------- */
function setupCreateTask() {
  // Ensure date default
  if ($("#jobDate") && !$("#jobDate").value) $("#jobDate").value = todayISO();

  // Task type controls roadside tracking visibility
  const sel = $("#taskType");
  const trackBlock = $("#roadTrackBlock");
  const syncTrack = () => {
    const v = sel.value;
    trackBlock.style.display = (v === "Road Spray") ? "block" : "none";
  };
  sel?.addEventListener("change", syncTrack);
  syncTrack();

  // Auto Weather handled by extras.js via #autoWeatherBtn

  // Photo preview
  $("#photoInput")?.addEventListener("change", (e)=>{
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      const img = $("#photoPreview");
      img.src = url;
      img.style.display = "block";
      img.dataset.photo = url; // store for save
    };
    reader.readAsDataURL(f);
  });

  // Roadside tracking
  let tracking = false, timer = null, coords = [];
  $("#startTrack")?.addEventListener("click", ()=>{
    coords = [];
    tracking = true;
    $("#trackStatus").textContent = "Tracking…";
    if (!navigator.geolocation) { showToast("Enable location"); return; }
    timer && clearInterval(timer);
    timer = setInterval(()=> navigator.geolocation.getCurrentPosition(p => {
      coords.push([p.coords.latitude, p.coords.longitude]);
    }), 5000);
    // Store handle for save
    $("#startTrack").dataset.active = "1";
    $("#startTrack").dataset.coordsKey = "track_coords_tmp";
    localStorage.setItem("track_coords_tmp", JSON.stringify(coords));
  });
  $("#stopTrack")?.addEventListener("click", ()=>{
    tracking = false;
    timer && clearInterval(timer);
    $("#trackStatus").textContent = `Stopped (${coords.length} pts)`;
    localStorage.setItem("track_coords_tmp", JSON.stringify(coords));
  });

  // Save Draft / Save Task
  $("#saveDraft")?.addEventListener("click", ()=> saveTask(true));
  $("#saveTask")?.addEventListener("click", ()=> saveTask(false));
}

function populateWeeds() {
  const sel = $("#weedSelect"); if (!sel) return;
  sel.innerHTML = "";

  const nox = NSW_WEEDS.filter(w => /noxious/i.test(w) || /Noxious Weeds/.test(w));
  const rest = NSW_WEEDS.filter(w => !( /noxious/i.test(w) || /Noxious Weeds/.test(w) ));

  // Default placeholder
  const d = document.createElement("option"); d.value = ""; d.textContent = "— Select Weed —";
  sel.appendChild(d);

  // Noxious pinned with ⚠ (category shown in red)
  nox.forEach(w => {
    const o = document.createElement("option");
    if (w === "Noxious Weeds (category)") {
      o.value = "Noxious Weeds";
      o.textContent = "⚠ NOXIOUS WEEDS (category)";
    } else {
      o.value = w;
      o.textContent = "⚠ " + w;
    }
    o.dataset.noxious = "1";
    sel.appendChild(o);
  });

  // The rest
  rest.forEach(w => {
    const o = document.createElement("option");
    o.value = w;
    o.textContent = w;
    sel.appendChild(o);
  });
}

function populateBatchSelect() {
  const sel = $("#batchSelect"); if (!sel) return;
  sel.innerHTML = "";
  const d = document.createElement("option"); d.value = ""; d.textContent = "— Select Batch —";
  sel.appendChild(d);

  const byDate = BATCHES.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  byDate.forEach(b => {
    const o = document.createElement("option");
    const remain = (b.remainingL ?? b.mixL ?? 0);
    o.value = b.id;
    o.textContent = `${b.id} • ${ddmmyyyy(b.date)} • remain ${fmt(remain)} L`;
    sel.appendChild(o);
  });
}

// Save Task
function saveTask(isDraft) {
  showSpinner(isDraft ? "Saving draft…" : "Saving task…");

  // Road from Locate
  const roadText = ($("#locRoad")?.textContent || "Unknown") === "Unknown" ? "" : $("#locRoad").textContent;
  const t = {
    id: generateId("JOB"),
    name: ($("#jobName").value || "").trim(),
    council: ($("#councilNum").value || "").trim(),
    linkedInspectionId: ($("#linkInspectionId").value || "").trim(),
    type: $("#taskType").value,
    weed: $("#weedSelect").value,
    batch: $("#batchSelect").value,
    date: $("#jobDate").value || todayISO(), // store ISO
    start: $("#startTime").value || "",
    end: $("#endTime").value || "",
    temp: $("#temp").value || "",
    wind: $("#wind").value || "",
    windDir: $("#windDir").value || "",
    humidity: $("#humidity").value || "",
    reminder: $("#reminderWeeks").value || "",
    status: isDraft ? "Draft" : ($("input[name='status']:checked")?.value || "Incomplete"),
    notes: $("#notes").value || "",
    road: roadText || "",
    coords: (() => {
      try { return JSON.parse(localStorage.getItem("track_coords_tmp") || "[]"); } catch { return []; }
    })(),
    photo: $("#photoPreview")?.dataset?.photo || "",
    createdAt: new Date().toISOString(),
    archived: false
  };

  // If no custom name, build from road/date/type
  if (!t.name) {
    const letter = TYPE_LETTER[t.type] || "I";
    const compact = ddmmyy_compact(t.date);
    const roadClean = (t.road || "Road").replace(/\s+/g,"");
    t.name = `${roadClean}${compact}${letter}`;
  }

  // Merge if same name exists (update)
  const idx = JOBS.findIndex(j => j.name === t.name);
  if (idx >= 0) {
    t.id = JOBS[idx].id; // preserve ID
    JOBS[idx] = t;
  } else {
    JOBS.push(t);
  }
  saveJobs(JOBS);

  // Link + archive inspection if supplied
  if (t.linkedInspectionId) {
    const insp = JOBS.find(j => j.type==="Inspection" && (String(j.id)===t.linkedInspectionId || j.name===t.linkedInspectionId));
    if (insp) { insp.archived = true; insp.status = "Archived"; saveJobs(JOBS); }
  }

  // Consume batch (basic heuristic): if Road Spray with coords, estimate use
  if (t.batch) {
    const b = BATCHES.find(x => x.id === t.batch);
    if (b) {
      const usedL = (t.type==="Road Spray" && (t.coords?.length||0)>1) ? 100 : 0; // simple placeholder estimate
      b.usedL = (b.usedL||0) + usedL;
      b.remainingL = Math.max(0, (Number(b.mixL)||0) - (b.usedL||0));
      b.linkedJobs = b.linkedJobs || [];
      if (!b.linkedJobs.includes(t.id)) b.linkedJobs.push(t.id);
      saveBatches(BATCHES);
    }
  }

  // UI feedback
  setTimeout(()=>{
    hideSpinner();
    showToast(isDraft ? "Draft saved" : "Task saved");
    // Clear temp tracking
    localStorage.removeItem("track_coords_tmp");
    // Refresh lists
    renderRecords();
    populateBatchSelect();
    // Keep user on screen; button itself should NOT stick onscreen
  }, 400);
}

/* ---------------------------
   RECORDS
--------------------------- */
function renderRecords() {
  const list = $("#recordsList"); if (!list) return;
  list.innerHTML = "";

  const q = ($("#recSearch").value || "").trim().toLowerCase();
  const from = $("#recFrom").value || "";
  const to = $("#recTo").value || "";

  const types = {
    inspection: $("#fInspection").checked,
    spot: $("#fSpot").checked,
    road: $("#fRoad").checked
  };
  const statuses = {
    complete: $("#fComplete").checked,
    incomplete: $("#fIncomplete").checked,
    draft: $("#fDraft").checked
  };
  const typesEmpty = !types.inspection && !types.spot && !types.road;
  const statusEmpty = !statuses.complete && !statuses.incomplete && !statuses.draft;

  const matches = JOBS.filter(t => {
    if (t.archived) return false;
    if (from && (t.date||"") < from) return false;
    if (to && (t.date||"") > to) return false;
    if (!typesEmpty) {
      if (t.type==="Inspection" && !types.inspection) return false;
      if (t.type==="Spot Spray" && !types.spot) return false;
      if (t.type==="Road Spray" && !types.road) return false;
    }
    if (!statusEmpty) {
      const s = t.status||"Incomplete";
      if (s==="Complete" && !statuses.complete) return false;
      if (s==="Incomplete" && !statuses.incomplete) return false;
      if (s==="Draft" && !statuses.draft) return false;
    }
    if (q) {
      const hay = `${t.name} ${t.weed} ${t.council} ${t.road}`.toLowerCase();
      if (!hay.includes(q)) return false; // search by road/name/weed/council
    }
    return true;
  }).sort((a,b)=>(b.date||"").localeCompare(a.date||""));

  matches.forEach(t => {
    const card = document.createElement("div");
    card.className = "item";
    const dateA = ddmmyyyy(t.date);
    const btnEdit = `edit_${t.id}`;
    const btnOpen = `open_${t.id}`;
    const btnDel  = `del_${t.id}`;
    const btnNav  = `nav_${t.id}`;

    card.innerHTML = `
      <b>${t.name}</b><br>
      <small>${t.type} • ${dateA} • ${t.status}</small>
      <div class="row gap end mt">
        <button id="${btnOpen}" class="pill">Open</button>
        <button id="${btnEdit}" class="pill">Edit</button>
        <button id="${btnDel}"  class="pill warn">Delete</button>
        ${t.coords && t.coords.length ? `<button id="${btnNav}" class="pill">Navigate</button>` : ""}
      </div>
    `;
    list.appendChild(card);

    // Bind
    document.getElementById(btnOpen).addEventListener("click", ()=> openJobModal(t.id));
    document.getElementById(btnEdit).addEventListener("click", ()=> editJob(t.id));
    document.getElementById(btnDel).addEventListener("click", ()=> deleteJob(t.id));
    if (t.coords && t.coords.length) {
      document.getElementById(btnNav).addEventListener("click", ()=>{
        const pt = t.coords[0]; openAppleMaps(pt[0], pt[1]);
      });
    }
  });
}

function openJobModal(jobId) {
  const t = JOBS.find(j => j.id === jobId);
  if (!t) return;

  const batchLink = t.batch ? `<a href="#" data-open-batch="${t.batch}">${t.batch}</a>` : "—";
  const linkedInsp = t.linkedInspectionId ? `<a href="#" data-open-insp="${t.linkedInspectionId}">${t.linkedInspectionId}</a>` : "—";
  const photoHtml = t.photo ? `<div class="mt"><img src="${t.photo}" style="max-width:100%;border-radius:8px"/></div>` : "";
  const hasPt = t.coords && t.coords.length;

  const html = `
    <div class="modal" id="jobModal">
      <div class="card p">
        <div class="row spread">
          <h3 style="margin:0">${t.name}</h3>
          <button class="pill warn" data-close>Close</button>
        </div>
        <div class="grid two mt">
          <div><b>Type:</b> ${t.type}</div><div><b>Status:</b> ${t.status}</div>
          <div><b>Date:</b> ${ddmmyyyy(t.date)}</div>
          <div><b>Time:</b> ${t.start||"–"} — ${t.end||"–"}</div>
          <div><b>Weed:</b> ${t.weed||"—"}</div>
          <div><b>Batch:</b> ${batchLink}</div>
          <div><b>Linked Inspection:</b> ${linkedInsp}</div>
          <div><b>Reminder:</b> ${t.reminder||"—"} weeks</div>
          <div class="span2"><b>Road:</b> ${t.road||"—"}</div>
          <div class="span2"><b>Weather:</b> ${fmt(t.temp)}°C, ${fmt(t.wind)} km/h, ${t.windDir||"–"}, ${fmt(t.humidity)}%</div>
          <div class="span2"><b>Notes:</b> ${t.notes||"—"}</div>
        </div>
        ${photoHtml}
        <div class="row gap end mt">
          ${hasPt ? `<button class="pill" data-nav>Navigate</button>` : ""}
          <button class="pill" data-edit>Edit</button>
          <button class="pill warn" data-del>Delete</button>
        </div>
      </div>
    </div>
  `;
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  document.body.appendChild(wrap.firstChild);

  const modal = $("#jobModal");
  modal?.addEventListener("click", (e) => {
    if (e.target === modal || e.target.dataset.close != null) modal.remove();
  });
  document.addEventListener("keydown", escCloseOnce);

  $("[data-edit]", modal)?.addEventListener("click", ()=>{ modal.remove(); editJob(t.id); });
  $("[data-del]", modal)?.addEventListener("click", ()=>{ modal.remove(); deleteJob(t.id); });
  $("[data-nav]", modal)?.addEventListener("click", ()=>{
    const pt = t.coords?.[0]; if (!pt) { showToast("No coordinates"); return; }
    openAppleMaps(pt[0], pt[1]);
  });
  $("[data-open-batch]", modal)?.addEventListener("click", (e)=>{
    e.preventDefault();
    const b = BATCHES.find(x => x.id === t.batch);
    b && openBatchModal(b.id);
  });
  $("[data-open-insp]", modal)?.addEventListener("click", (e)=>{
    e.preventDefault();
    const insp = JOBS.find(x => x.type==="Inspection" && (String(x.id)===t.linkedInspectionId || x.name===t.linkedInspectionId));
    insp && openJobModal(insp.id);
  });
  function escCloseOnce(ev){ if (ev.key === "Escape"){ modal?.remove(); document.removeEventListener("keydown", escCloseOnce); } }
}

function editJob(jobId) {
  const t = JOBS.find(j => j.id === jobId);
  if (!t) return;
  switchScreen("createTask");
  $("#jobName").value = t.name || "";
  $("#councilNum").value = t.council || "";
  $("#linkInspectionId").value = t.linkedInspectionId || "";
  $("#taskType").value = t.type || "Inspection";
  $("#taskType").dispatchEvent(new Event("change"));
  $("#weedSelect").value = t.weed || "";
  $("#batchSelect").value = t.batch || "";
  $("#jobDate").value = t.date || todayISO();
  $("#startTime").value = t.start || "";
  $("#endTime").value = t.end || "";
  $("#temp").value = t.temp || "";
  $("#wind").value = t.wind || "";
  $("#windDir").value = t.windDir || "";
  $("#humidity").value = t.humidity || "";
  $("#notes").value = t.notes || "";
  $("#locRoad").textContent = t.road || ($("#locRoad").textContent || "Unknown");
  if (t.photo) {
    $("#photoPreview").src = t.photo;
    $("#photoPreview").style.display = "block";
    $("#photoPreview").dataset.photo = t.photo;
  }
}

function deleteJob(jobId) {
  if (!confirm("Delete this job?")) return;
  JOBS = JOBS.filter(j => j.id !== jobId);
  saveJobs(JOBS);
  renderRecords();
  showToast("Job deleted");
}

/* ---------------------------
   BATCHES (list + modal open)
   (Create/Edit UI in PART B)
--------------------------- */
function renderBatches() {
  const list = $("#batchList"); if (!list) return;
  list.innerHTML = "";

  const from = $("#batFrom").value || "";
  const to = $("#batTo").value || "";

  const matches = BATCHES
    .filter(b => (!from || b.date >= from) && (!to || b.date <= to))
    .sort((a,b)=>(b.date||"").localeCompare(a.date||""));

  matches.forEach(b => {
    const div = document.createElement("div");
    div.className = "item";
    const remain = fmt(b.remainingL ?? b.mixL ?? 0);
    const mix = fmt(b.mixL ?? 0);
    const btnOpen = `batch_open_${b.id}`;
    const btnEdit = `batch_edit_${b.id}`;
    const btnDel  = `batch_del_${b.id}`;

    div.innerHTML = `
      <b>${b.id}</b><br>
      <small>${ddmmyyyy(b.date)} • Total ${mix} L • Remaining ${remain} L</small>
      <div class="row gap end mt">
        <button id="${btnOpen}" class="pill">Open</button>
        <button id="${btnEdit}" class="pill">Edit</button>
        <button id="${btnDel}"  class="pill warn">Delete</button>
      </div>
    `;
    list.appendChild(div);

    document.getElementById(btnOpen).addEventListener("click", ()=> openBatchModal(b.id));
    document.getElementById(btnEdit).addEventListener("click", ()=> openBatchEditModal(b.id)); // PART B
    document.getElementById(btnDel).addEventListener("click", ()=> deleteBatch(b.id));
  });
}

function openBatchModal(batchId) {
  const b = BATCHES.find(x => x.id === batchId);
  if (!b) return;

  const jobs = (b.linkedJobs || []).map(id => JOBS.find(j=>j.id===id)).filter(Boolean);
  const jobsHtml = jobs.length ? `<ul>${jobs.map(j=>`<li><a href="#" data-open-job="${j.id}">${j.name}</a></li>`).join("")}</ul>` : "—";
  const ring = (b.remainingL||0) <= 0 ? 'style="outline:2px solid #ff5252; outline-offset:4px; border-radius:8px;"' : "";

  const chemsHtml = (b.chemicals||[]).length
    ? `<ul>${b.chemicals.map(c=>`<li>${c.name}: ${c.per100.value}${c.per100.unit}/100L → total ${fmt(c.total.value)} ${c.total.unit}</li>`).join("")}</ul>`
    : "—";

  const dumpedHtml = (b.dumped||[]).length
    ? `<ul>${b.dumped.map(d=>`<li>${ddmmyyyy(d.date)} ${d.time}: ${fmt(d.amount)} L — ${d.reason || "no reason"}</li>`).join("")}</ul>`
    : "—";

  const html = `
    <div class="modal" id="batchModal">
      <div class="card p" ${ring}>
        <div class="row spread">
          <h3 style="margin:0">${b.id}</h3>
          <button class="pill warn" data-close>Close</button>
        </div>
        <div class="grid two mt">
          <div><b>Date:</b> ${ddmmyyyy(b.date)} · <b>Time:</b> ${b.time||"—"}</div>
          <div><b>Total Mix:</b> ${fmt(b.mixL)} L · <b>Remaining:</b> ${fmt(b.remainingL)} L</div>
        </div>
        <div class="mt"><b>Made of (chemicals):</b><br>${chemsHtml}</div>
        <div class="mt"><b>Linked Jobs:</b><br>${jobsHtml}</div>
        <div class="mt"><b>Dumped:</b><br>${dumpedHtml}</div>
        <div class="row gap end mt">
          <button class="pill" data-edit>Edit</button>
          <button class="pill warn" data-del>Delete</button>
        </div>
      </div>
    </div>
  `;
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  document.body.appendChild(wrap.firstChild);

  const modal = $("#batchModal");
  modal?.addEventListener("click", (e)=>{ if (e.target===modal || e.target.dataset.close!=null) modal.remove(); });
  document.addEventListener("keydown", escCloseOnce);

  $("[data-edit]", modal)?.addEventListener("click", ()=>{ modal.remove(); openBatchEditModal(b.id); });
  $("[data-del]", modal)?.addEventListener("click", ()=>{ modal.remove(); deleteBatch(b.id); });
  $$("[data-open-job]", modal).forEach(a => a.addEventListener("click",(e)=>{
    e.preventDefault();
    const id = a.getAttribute("data-open-job");
    openJobModal(id);
  }));

  function escCloseOnce(ev){ if (ev.key==="Escape"){ modal?.remove(); document.removeEventListener("keydown", escCloseOnce); } }
}

function deleteBatch(batchId) {
  if (!confirm("Delete this batch?")) return;
  BATCHES = BATCHES.filter(b => b.id !== batchId);
  saveBatches(BATCHES);
  renderBatches();
  populateBatchSelect();
  showToast("Batch deleted");
}

/* ---------------------------
   INVENTORY (list only here)
   (Editor handlers in PART B)
--------------------------- */
function renderInventory() {
  const list = $("#chemList"); if (!list) return;
  list.innerHTML = "";

  const sorted = CHEMS.slice().sort((a,b)=> a.name.localeCompare(b.name));
  sorted.forEach(c => {
    const total = (c.containers||0) * (c.containerSize||0);
    const line = `${c.containers||0} × ${fmt(c.containerSize)} ${c.containerUnit} • total ${fmt(total)} ${c.containerUnit}`;
    const li = document.createElement("div");
    li.className = "item";
    const btnEdit = `chem_edit_${c.name.replace(/\W+/g,"_")}`;
    const btnDel  = `chem_del_${c.name.replace(/\W+/g,"_")}`;

    li.innerHTML = `
      <b>${c.name}</b><br>
      <small>${line}</small><br>
      <small>Active: ${c.active||"—"}</small>
      <div class="row gap end mt">
        <button id="${btnEdit}" class="pill">Edit</button>
        <button id="${btnDel}" class="pill warn">Delete</button>
      </div>
    `;
    list.appendChild(li);

    document.getElementById(btnEdit).addEventListener("click", ()=> openChemEditor(c));
    document.getElementById(btnDel).addEventListener("click", ()=>{
      if (!confirm("Delete chemical?")) return;
      CHEMS = CHEMS.filter(x => x !== c);
      saveChemicals(CHEMS);
      renderInventory();
      renderProcureFromChem();
    });
  });

  renderProcureFromChem();
}

// Derive procurement list (low stock)
function renderProcureFromChem() {
  const ul = $("#procList"); if (!ul) return;
  ul.innerHTML = "";
  CHEMS.forEach(c => {
    if (c.threshold && (c.containers||0) < c.threshold) {
      const li = document.createElement("li");
      li.textContent = `Low stock: ${c.name} (${c.containers||0} < ${c.threshold})`;
      ul.appendChild(li);
    }
  });
}

/* ---------------------------
   MAPPING
--------------------------- */
function ensureMap(fit) {
  if (!MAP) {
    MAP = L.map("map", { zoomControl: true }).setView([-34.75, 148.65], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap"
    }).addTo(MAP);
    MAP_GROUP = L.featureGroup().addTo(MAP);

    // Locate Me control (bottom-right)
    const Locate = L.Control.extend({
      onAdd: function() {
        const d = L.DomUtil.create("div","leaflet-bar");
        d.style.background="#2e7d32"; d.style.color="#fff"; d.style.padding="6px 10px"; d.style.cursor="pointer"; d.style.borderRadius="6px";
        d.innerText="Locate Me";
        d.onclick = () => {
          if (!navigator.geolocation) { showToast("Enable location"); return; }
          navigator.geolocation.getCurrentPosition(p=>{
            const pt = [p.coords.latitude, p.coords.longitude];
            MAP.setView(pt, 14);
            L.circleMarker(pt, {radius:6, opacity:.9}).addTo(MAP).bindPopup("You are here").openPopup();
          });
        };
        return d;
      },
      onRemove: function(){ }
    });
    MAP.addControl(new Locate({ position: "bottomright" }));
  }

  // Rebuild pins
  MAP_GROUP.clearLayers();

  const weedQ = ($("#mapWeed").value || "").trim().toLowerCase();
  const typ = $("#mapType").value || "All";
  const from = $("#mapFrom").value || "";
  const to = $("#mapTo").value || "";

  const tasks = JOBS.filter(t => {
    if (t.archived) return false;
    if (from && (t.date||"")<from) return false;
    if (to && (t.date||"")>to) return false;
    if (typ !== "All" && t.type !== typ) return false;
    if (weedQ && !(String(t.weed||"").toLowerCase().includes(weedQ))) return false;
    return true;
  });

  const group = L.featureGroup();

  tasks.forEach(t=>{
    // Polyline if multiple coords
    if (t.coords && t.coords.length>1) {
      group.addLayer(L.polyline(t.coords, { color:"yellow", weight:4, opacity:.85 }));
    }
    // Marker at first coord or random near center if none
    const pt = (t.coords && t.coords[0]) ? t.coords[0] : [-34.75 + Math.random()*0.05, 148.65 + Math.random()*0.05];
    const openId = `m_open_${t.id}`;
    const navId = `m_nav_${t.id}`;
    const popup = `
      <b>${t.name}</b><br>${t.type} • ${ddmmyyyy(t.date)}<br>
      <button id="${openId}" class="pill" style="margin-top:6px;">Open</button>
      <button id="${navId}" class="pill" style="margin-top:6px;margin-left:6px;">Navigate</button>
    `;
    const m = L.marker(pt);
    m.bindPopup(popup);
    m.on("popupopen", ()=>{
      setTimeout(()=>{
        const ob = document.getElementById(openId);
        const nb = document.getElementById(navId);
        ob && (ob.onclick = ()=> openJobModal(t.id));
        nb && (nb.onclick = ()=> openAppleMaps(pt[0], pt[1]));
      },0);
    });
    group.addLayer(m);
  });

  group.addTo(MAP);

  if (fit && tasks.length) {
    try { MAP.fitBounds(group.getBounds().pad(0.2)); } catch {}
  }

  // Also draw lastTrack if exists
  try {
    const last = JSON.parse(localStorage.getItem("track_coords_tmp") || "[]");
    if (Array.isArray(last) && last.length>1) {
      L.polyline(last, { color:"#ffda44", weight:3, opacity:.8 }).addTo(MAP);
    }
  } catch {}
}

/* ---------------------------
   CHEMICAL EDITOR (open/save)
   (UI + logic continued in PART B)
--------------------------- */
let _chemEditing = null;
function openChemEditor(c) {
  _chemEditing = c ? {...c} : {name:"",active:"",containerSize:0,containerUnit:"L",containers:0,threshold:0};
  $("#ce_name").value = _chemEditing.name;
  $("#ce_active").value = _chemEditing.active || "";
  $("#ce_size").value = _chemEditing.containerSize || 0;
  $("#ce_unit").value = _chemEditing.containerUnit || "L";
  $("#ce_count").value = _chemEditing.containers || 0;
  $("#ce_threshold").value = _chemEditing.threshold || 0;
  $("#chemEditSheet").style.display = "block";
}
function closeChemEditor() { $("#chemEditSheet").style.display = "none"; _chemEditing = null; }
function saveChemEditor() {
  if (!_chemEditing) return;
  const updated = {
    name: ($("#ce_name").value||"").trim(),
    active: ($("#ce_active").value||"").trim(),
    containerSize: Number($("#ce_size").value)||0,
    containerUnit: $("#ce_unit").value||"L",
    containers: Number($("#ce_count").value)||0,
    threshold: Number($("#ce_threshold").value)||0
  };
  if (!updated.name) { alert("Name required"); return; }

  const idx = CHEMS.findIndex(x => x.name.toLowerCase() === (_chemEditing.name||"").toLowerCase());
  if (idx>=0) CHEMS[idx] = updated; else CHEMS.push(updated);
  saveChemicals(CHEMS);
  closeChemEditor();
  renderInventory();
  renderProcureFromChem();
  showToast("Chemical saved");
}

/* ---------------------------
   PLACEHOLDERS to be completed in PART B:
   - openBatchEditModal (full-page single modal editor)
   - openBatchCreateSheet (single-page creator)
   - validate & consume inventory on batch create
   - dumpRemaining, link jobs, and summary flash on save
--------------------------- */
/* === WeedTracker V60 Pilot — apps.js (Part B) ===
 * Completes:
 *  - openBatchCreateSheet (single-page batch form, scrollable)
 *  - openBatchEditModal
 *  - dumpRemaining (with reason)
 *  - summary flash popup on save
 *  - working save spinner
 *  - clean end-to-end behaviour
 */

/* ---------------------------
   BATCH CREATOR / EDITOR
--------------------------- */
function openBatchCreateSheet() {
  const id = generateId("BATCH");
  const html = `
    <div class="modal" id="batchCreate">
      <div class="card p scrollable" style="max-height:90vh;overflow-y:auto;">
        <div class="row spread">
          <h3>Create Batch ${id}</h3>
          <button class="pill warn" data-close>Close</button>
        </div>
        <label>Date <input type="date" id="bc_date" value="${todayISO()}"></label>
        <label>Time <input type="time" id="bc_time" value="${nowTime()}"></label>
        <label>Total Mix (L) <input type="number" id="bc_mixL" min="0" value="0"></label>
        <div id="chemListArea"></div>
        <div class="row gap mt">
          <button id="addChemBtn" class="pill">Add Chemical</button>
        </div>
        <div class="row gap end mt">
          <button id="createBatchBtn" class="pill">Create Batch</button>
          <button id="deleteBatchBtn" class="pill warn">Delete Batch</button>
        </div>
      </div>
    </div>`;
  const wrap=document.createElement("div");wrap.innerHTML=html;
  document.body.appendChild(wrap.firstChild);
  const modal=$("#batchCreate");
  modal.addEventListener("click",e=>{if(e.target===modal||e.target.dataset.close!=null)modal.remove();});
  document.addEventListener("keydown",escCloseOnce);
  $("#addChemBtn").onclick=()=>addChemRow();
  $("#createBatchBtn").onclick=()=>saveBatch(id);
  $("#deleteBatchBtn").onclick=()=>{if(confirm("Delete this batch?"))modal.remove();};
  function escCloseOnce(ev){if(ev.key==="Escape"){modal.remove();document.removeEventListener("keydown",escCloseOnce);}}
  addChemRow();addChemRow();
}
function addChemRow(){
  const area=$("#chemListArea");
  const idx=area.children.length+1;
  const row=document.createElement("div");
  row.className="card mt";
  row.innerHTML=`
    <label>Chemical <select class="bc_name">${CHEMS.map(c=>`<option value="${c.name}">${c.name}</option>`).join("")}</select></label>
    <label>Per 100 L <input type="number" class="bc_val" min="0" value="0"></label>
    <select class="bc_unit">
      <option value="L">L</option>
      <option value="mL">mL</option>
      <option value="g">g</option>
      <option value="kg">kg</option>
    </select>
    <button class="pill warn removeChem">Remove</button>`;
  area.appendChild(row);
  row.querySelector(".removeChem").onclick=()=>row.remove();
}
function saveBatch(id){
  showSpinner("Creating batch…");
  const mixL=Number($("#bc_mixL").value)||0;
  const chems=[...$$("#chemListArea .card")].map(div=>{
    const name=div.querySelector(".bc_name").value;
    const val=Number(div.querySelector(".bc_val").value)||0;
    const unit=div.querySelector(".bc_unit").value;
    const total=val*mixL/100;
    return {name, per100:{value:val,unit}, total:{value:total,unit}};
  });
  const b={id,date:$("#bc_date").value,time:$("#bc_time").value,mixL,remainingL:mixL,usedL:0,chemicals:chems,linkedJobs:[],dumped:[]};
  BATCHES.push(b);saveBatches(BATCHES);populateBatchSelect();renderBatches();
  hideSpinner();showSummaryFlash(b);$("#batchCreate").remove();
}
function openBatchEditModal(id){
  const b=BATCHES.find(x=>x.id===id);if(!b)return;
  const html=`
    <div class="modal" id="batchEdit">
      <div class="card p scrollable" style="max-height:90vh;overflow-y:auto;">
        <div class="row spread">
          <h3>Edit ${b.id}</h3><button class="pill warn" data-close>Close</button>
        </div>
        <label>Total Mix (L) <input type="number" id="be_mixL" value="${b.mixL||0}"></label>
        <label>Remaining (L) <input type="number" id="be_rem" value="${b.remainingL||0}" readonly></label>
        <div class="mt"><b>Chemicals:</b><ul>${b.chemicals.map(c=>`<li>${c.name} ${c.per100.value}${c.per100.unit}/100L</li>`).join("")}</ul></div>
        <div class="row gap mt"><button id="dumpBtn" class="pill">Dump Remaining</button></div>
        <div class="row gap end mt"><button id="saveEdit" class="pill">Save</button></div>
      </div>
    </div>`;
  const wrap=document.createElement("div");wrap.innerHTML=html;document.body.appendChild(wrap.firstChild);
  const modal=$("#batchEdit");
  modal.onclick=e=>{if(e.target===modal||e.target.dataset.close!=null)modal.remove();};
  $("#dumpBtn").onclick=()=>dumpRemaining(b.id);
  $("#saveEdit").onclick=()=>{
    b.mixL=Number($("#be_mixL").value)||b.mixL;
    b.remainingL=Number($("#be_rem").value)||b.remainingL;
    saveBatches(BATCHES);renderBatches();modal.remove();showToast("Batch updated");
  };
}
function dumpRemaining(id){
  const b=BATCHES.find(x=>x.id===id);if(!b)return;
  const amt=prompt("Dump how many litres?","0");
  const n=Number(amt)||0;
  if(n<=0||n>(b.remainingL||0)){alert("Invalid amount");return;}
  const reason=prompt("Reason for dump?","Expired or spillage");
  b.remainingL=Math.max(0,(b.remainingL||0)-n);
  b.dumped=b.dumped||[];
  b.dumped.push({date:todayISO(),time:nowTime(),amount:n,reason});
  saveBatches(BATCHES);renderBatches();
  showToast("Batch dumped");
}

/* ---------------------------
   SPINNER + SUMMARY FLASH
--------------------------- */
function showSpinner(msg){
  let s=$("#spinnerOverlay");
  if(!s){
    s=document.createElement("div");
    s.id="spinnerOverlay";
    s.style=`position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,.6);color:#fff;display:flex;align-items:center;
      justify-content:center;font-size:22px;z-index:9999;`;
    document.body.appendChild(s);
  }
  s.textContent=msg||"Saving…";
  s.style.display="flex";
}
function hideSpinner(){const s=$("#spinnerOverlay");if(s)s.style.display="none";}
function showSummaryFlash(batch){
  const div=document.createElement("div");
  div.className="toastSummary";
  div.style=`position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
    background:#2e7d32;color:#fff;padding:10px 18px;border-radius:8px;
    font-size:15px;z-index:9999;opacity:0.95;`;
  div.innerHTML=`✅ Batch <b>${batch.id}</b> created (${fmt(batch.mixL)} L)`;
  document.body.appendChild(div);
  setTimeout(()=>div.remove(),2500);
}
function showToast(msg){
  const t=document.createElement("div");
  t.className="toast";
  t.style=`position:fixed;bottom:10px;left:50%;transform:translateX(-50%);
    background:#333;color:#fff;padding:8px 16px;border-radius:6px;
    font-size:14px;z-index:9999;opacity:0.9;`;
  t.textContent=msg;document.body.appendChild(t);
  setTimeout(()=>t.remove(),2000);
}
function generateId(prefix){
  return `${prefix}-${Math.random().toString(36).substring(2,8).toUpperCase()}`;
}

/* ---------------------------
   END OF APPS.JS
--------------------------- */
console.log("✅ WeedTracker V60 Pilot (complete) loaded");
