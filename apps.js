/* =========================================================
   WeedTracker V60 Pilot — apps.js (FULL)
   - iPhone-first, charcoal theme (styles.css)
   - Home nav, screen switching
   - Create Task: location -> auto-name (RoadNameDDMMYYYY + type letter AT END)
   - Weather auto-fill (°C, %, km/h, compass + degrees)
   - Roadside tracking controls only for "Road Spray"
   - Save / Draft save with spinner + toast
   - Records: search (road/job name, weed, council, batch), date range, type/status filters
   - Open / Edit / Delete modals working
   - Apple Maps navigation from record popup
   - Noxious weeds pinned to top + ⚠ indicator, “Noxious Weeds” category in red
   - Links: inspections -> job, job -> batch (openable)
   - Map pins wired through WTExtras (coords from job form)
   - Spinners for long actions
   - AU date display DD-MM-YYYY, job auto-name format: <RoadName><DDMMYYYY><Letter>
   ========================================================= */

(function () {
  // ------------- Shortcuts -------------
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  // ------------- Dates -------------
  const todayISO = () => new Date().toISOString().slice(0,10);
  const formatAU = (iso) => {
    if (!iso) return "—";
    const [y,m,d] = iso.split("-");
    return `${d}-${m}-${y}`;
  };
  const compactAU = (dateLike) => {
    const d = (dateLike ? new Date(dateLike) : new Date());
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const yy = String(d.getFullYear());
    return `${dd}${mm}${yy}`;
  };

  // ------------- Type letter mapping -------------
  const TYPE_LETTER = { "Inspection":"I", "Spot Spray":"S", "Road Spray":"R" };

  // ------------- Weeds (40 incl. noxious) -------------
  const NSW_WEEDS = [
    "Noxious Weeds (category)", // virtual header line (rendered red)
    "African Boxthorn (noxious)","African Lovegrass (noxious)","Bathurst Burr (noxious)","Blackberry (noxious)",
    "Cape Broom (noxious)","Chilean Needle Grass (noxious)","Coolatai Grass (noxious)","Fireweed (noxious)",
    "Gorse (noxious)","Lantana (noxious)","Patterson’s Curse (noxious)","Serrated Tussock (noxious)",
    "St John’s Wort (noxious)","Sweet Briar (noxious)","Willow spp. (noxious)",
    "African Feathergrass","Artichoke Thistle","Balloon Vine","Blue Heliotrope","Bridal Creeper","Caltrop",
    "Coltsfoot","Fleabane","Flax-leaf Broom","Fountain Grass","Galvanised Burr","Giant Parramatta Grass",
    "Glycine","Green Cestrum","Horehound","Khaki Weed","Noogoora Burr","Parthenium Weed","Prickly Pear (common)",
    "Saffron Thistle","Silverleaf Nightshade","Spear Thistle","Sweet Vernal Grass","Three-cornered Jack","Wild Radish",
    "Cape Broom" // (added per request; duplicate allowed but not tagged noxious)
  ];

  // ------------- State -------------
  let currentRoad = "";
  let lastCoords = null; // {lat,lng}
  let editingId = null;  // when editing a record
  let trackingTimer = null;
  let trackingOn = false;
  let trackedCoords = [];

  // ------------- Screen switching -------------
  function switchScreen(id) {
    $$(".screen").forEach(s => s.classList.remove("active"));
    const view = $("#"+id);
    if (view) view.classList.add("active");

    // lazy renders
    if (id==="records") renderRecordList();
    if (id==="batches") window.WTBatches?.renderBatchList();
    if (id==="inventory") renderChemSeedOnce();
    if (id==="mapping") WTExtras?.renderMapPins();
  }

  function wireNav() {
    $$("[data-target]").forEach(btn => {
      on(btn, "click", () => switchScreen(btn.dataset.target));
    });
    $$(".home-btn").forEach(h => on(h, "click", () => switchScreen("home")));
  }

  // ------------- Spinners / Toast -------------
  const spin = (show, text="Working…") => WTStorage.showSpinner(show, text);
  const toast = (m, t=1600) => WTStorage.showToast(m, t);

  // ------------- Populate weeds (noxious pinned) -------------
  function populateWeeds() {
    const sel = $("#weedName");
    if (!sel) return;

    sel.innerHTML = "";

    const nox = NSW_WEEDS.filter(w=>/noxious/i.test(w));
    const rest = NSW_WEEDS.filter(w=>! /noxious/i.test(w) && !/category/i.test(w));

    // Header category first
    const cat = document.createElement("option");
    cat.value = "Noxious Weeds";
    cat.textContent = "⚠ Noxious Weeds";
    cat.dataset.category = "header";
    sel.appendChild(cat);

    // Noxious (yellow triangle)
    nox.sort().forEach(w=>{
      const o = document.createElement("option");
      o.value = w;
      o.textContent = `⚠ ${w}`;
      o.dataset.nox = "1";
      sel.appendChild(o);
    });

    // Divider
    const divider = document.createElement("option");
    divider.disabled = true;
    divider.textContent = "──────────";
    divider.value = "";
    sel.appendChild(divider);

    // Rest
    rest.sort().forEach(w=>{
      const o = document.createElement("option");
      o.value = w;
      o.textContent = w;
      sel.appendChild(o);
    });

    // Make the category red via CSS hook
    sel.dataset.hasNoxHeader = "1";
  }

  // ------------- Roadside tracking visibility -------------
  function syncRoadTrackingVisibility() {
    const type = $("#jobType")?.value || "";
    const block = $("#roadTrackBlock");
    if (!block) return;
    block.style.display = (type === "Road Spray") ? "block" : "none";
  }

  // ------------- Auto-name -------------
  async function handleLocateThenAutoname() {
    spin(true, "Getting location…");
    const type = $("#jobType").value || "Inspection";
    const res = await WTExtras.getLocationAndAutoName(type);
    spin(false);

    if (!res) return;
    // Reverse geocode name inside WTExtras returns "AutoRoadDDMMYYX"
    // We recompute to strict format: <RoadName><DDMMYYYY><Letter at END>
    lastCoords = { lat: res.latitude, lng: res.longitude };

    // Try reverse geocode to fetch road string again (best-effort):
    // If WTExtras saved coords only, use "Road" fallback
    let road = "Road";
    try {
      const q = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${res.latitude}&lon=${res.longitude}&format=json`);
      const j = await q.json();
      road = (j.address?.road || j.display_name || "Road").replace(/\s+/g,"");
    } catch {}

    currentRoad = road;
    const letter = TYPE_LETTER[type] || "I";
    const ddmmyyyy = compactAU(new Date());
    $("#autoName").value = `${road}${ddmmyyyy}${letter}`; // WombatRd01122025R

    $("#latitude").value = String(res.latitude);
    $("#longitude").value = String(res.longitude);
    toast("📍 Location set & name generated");
  }

  // ------------- Auto weather -------------
  async function handleAutoWeather() {
    spin(true, "Fetching weather…");
    const w = await WTExtras.getWeatherAuto();
    spin(false);

    if (!w) return;
    $("#temperature").value = w.temp || "";
    $("#humidity").value = w.humidity || "";
    $("#windSpeed").value = w.windSpeed || "";
    $("#windDirection").value = w.windDir || ""; // e.g. "NW (312°)"
    toast("🌦 Weather updated");
  }

  // ------------- Photo -------------
  let photoDataURL = "";
  function wirePhoto() {
    on($("#photoInput"), "change", (e)=>{
      const f = e.target.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = ()=> {
        photoDataURL = String(reader.result||"");
        const prev = $("#photoPreview");
        if (prev){ prev.src = photoDataURL; prev.style.display="block"; }
      };
      reader.readAsDataURL(f);
    });
  }

  // ------------- Tracking -------------
  function startTrack() {
    trackedCoords = [];
    trackingOn = true;
    $("#trackStatus").textContent = "Tracking…";
    if (trackingTimer) clearInterval(trackingTimer);
    if (!navigator.geolocation) return toast("Enable location");

    trackingTimer = setInterval(()=>{
      navigator.geolocation.getCurrentPosition(p=>{
        trackedCoords.push([p.coords.latitude, p.coords.longitude]);
      });
    }, 5000);
  }

  function stopTrack() {
    trackingOn = false;
    if (trackingTimer) clearInterval(trackingTimer);
    $("#trackStatus").textContent = `Stopped (${trackedCoords.length} pts)`;
    localStorage.setItem("lastTrack", JSON.stringify(trackedCoords));
  }

  // ------------- Save Task -------------
  function saveJob(isDraft=false) {
    spin(true, isDraft ? "Saving draft…" : "Saving task…");

    const type = $("#jobType").value || "Inspection";
    const name = ($("#autoName").value || "").trim();
    const councilJobNo = ($("#councilJobNo").value || "").trim();
    const weed = $("#weedName").value || "";
    const batch = $("#batchSelect")?.value || "";
    const dateIso = $("#jobDate")?.value || todayISO();
    const start = $("#startTime")?.value || "";
    const end   = $("#endTime")?.value || "";
    const temp = $("#temperature")?.value || "";
    const humidity = $("#humidity")?.value || "";
    const wind = $("#windSpeed")?.value || "";
    const windDir = $("#windDirection")?.value || "";
    const lat = parseFloat($("#latitude")?.value || "") || (lastCoords?.lat || null);
    const lng = parseFloat($("#longitude")?.value || "") || (lastCoords?.lng || null);
    const notes = $("#notes")?.value || "";
    const linkInspection = ($("#linkInspectionId")?.value || "").trim();
    const status = isDraft ? "Draft" : ($("input[name='status']:checked")?.value || "Incomplete");

    const records = WTStorage.loadData("records", []);
    const id = editingId || WTStorage.generateId("JOB");

    const obj = {
      id,
      jobName: name || ("Task_" + id),
      councilJobNo,
      jobType: type,
      weed,
      batch,
      date: dateIso,
      startTime: start,
      endTime: end,
      temp, humidity, windSpeed: wind, windDir,
      lat, lng,
      notes,
      status,
      photo: photoDataURL || "",
      createdAt: new Date().toISOString(),
      archived: false,
      coords: trackedCoords.slice()
    };

    const existing = records.find(r=>r.id===id) || records.find(r=>r.jobName===obj.jobName);
    if (existing) Object.assign(existing, obj);
    else records.push(obj);

    // link & archive inspection
    if (linkInspection) {
      const insp = records.find(r => r.jobType==="Inspection" && (String(r.id)===linkInspection || r.jobName===linkInspection));
      if (insp) { insp.archived = true; insp.status = "Archived"; obj.linkedInspectionId = insp.id; }
    }

    // consume batch a tiny heuristic (kept light)
    if (obj.batch) {
      const batches = WTStorage.loadData("batches", []);
      const b = batches.find(x=>x.id===obj.batch || x.batchName===obj.batch);
      if (b) {
        const used = (obj.jobType==="Road Spray" && obj.coords?.length>1) ? 100 : 0;
        b.used = (b.used||0) + used;
        b.remaining = Math.max(0, (Number(b.totalMix)||0) - (b.used||0));
        WTStorage.saveData("batches", batches);
      }
    }

    WTStorage.saveData("records", records);
    editingId = null;

    // spinner-confirm overlay (big)
    setTimeout(()=>{
      spin(false);
      toast(isDraft ? "💾 Draft saved" : "✅ Task saved", 1600);
      closeSheet("taskSheet");
      renderRecordList();
      WTExtras?.renderMapPins();
    }, 600);
  }

  // ------------- Open / Edit / Delete Record -------------
  function openRecord(id) {
    const r = (WTStorage.loadData("records", [])).find(x=>x.id===id);
    if (!r) return;

    const batchLink = r.batch
      ? `<a href="#" data-open-batch="${r.batch}">${r.batch}</a>`
      : "—";

    const linkedInsp = r.linkedInspectionId
      ? `<a href="#" data-open-insp="${r.linkedInspectionId}">${r.linkedInspectionId}</a>`
      : "—";

    const photo = r.photo
      ? `<div style="margin:.4rem 0"><img src="${r.photo}" style="max-width:100%;border-radius:8px"/></div>`
      : "";

    const hasCoord = (r.lat!=null && r.lng!=null);

    const wrap = document.createElement("div");
    wrap.className = "sheet";
    wrap.innerHTML = `
      <div class="sheet-content">
        <div class="row end"><button class="pill warn" data-close>✖ Close</button></div>
        <h3>${r.jobName}</h3>
        <div class="card">
          <div><b>Type:</b> ${r.jobType}</div>
          <div><b>Status:</b> ${r.status || "—"}</div>
          <div><b>Date:</b> ${formatAU(r.date)}</div>
          <div><b>Start:</b> ${r.startTime || "—"} · <b>Finish:</b> ${r.endTime || "—"}</div>
          <div><b>Weed:</b> ${r.weed || "—"}</div>
          <div><b>Batch:</b> ${batchLink}</div>
          <div><b>Linked Inspection:</b> ${linkedInsp}</div>
          <div><b>Weather:</b> ${r.temp||"—"} | ${r.humidity||"—"} | ${r.windSpeed||"—"} ${r.windDir||""}</div>
          <div><b>Notes:</b> ${r.notes || "—"}</div>
        </div>
        ${photo}
        <div class="row end gap" style="margin-top:.6rem;">
          ${hasCoord ? `<button class="pill emph" data-nav>Navigate</button>`:""}
          <button class="pill" data-edit>Edit</button>
        </div>
      </div>`;

    document.body.appendChild(wrap);

    on(wrap, "click", (e)=>{
      if (e.target.dataset.close!=null || e.target===wrap) wrap.remove();
    });

    const inspA = wrap.querySelector("[data-open-insp]");
    if (inspA) on(inspA, "click", (e)=>{
      e.preventDefault();
      const id = inspA.getAttribute("data-open-insp");
      openRecord(id);
    });

    const batA = wrap.querySelector("[data-open-batch]");
    if (batA) on(batA, "click", (e)=>{
      e.preventDefault();
      const bid = batA.getAttribute("data-open-batch");
      if (window.WTBatches?.openBatch) window.WTBatches.openBatch(bid);
    });

    const navBtn = wrap.querySelector("[data-nav]");
    if (navBtn) on(navBtn, "click", ()=>{
      if (hasCoord) WTExtras.navigateTo(r.lat, r.lng);
    });

    const editBtn = wrap.querySelector("[data-edit]");
    if (editBtn) on(editBtn, "click", ()=>{
      wrap.remove();
      // load values to form
      openCreateTask();
      editingId = r.id;
      $("#autoName").value = r.jobName || "";
      $("#councilJobNo").value = r.councilJobNo || "";
      $("#jobType").value = r.jobType || "Inspection";
      $("#weedName").value = r.weed || "";
      $("#batchSelect").value = r.batch || "";
      $("#jobDate").value = r.date || todayISO();
      $("#startTime").value = r.startTime || "";
      $("#endTime").value = r.endTime || "";
      $("#temperature").value = r.temp || "";
      $("#humidity").value = r.humidity || "";
      $("#windSpeed").value = r.windSpeed || "";
      $("#windDirection").value = r.windDir || "";
      $("#latitude").value = (r.lat!=null) ? r.lat : "";
      $("#longitude").value = (r.lng!=null) ? r.lng : "";
      $("#notes").value = r.notes || "";
      syncRoadTrackingVisibility();
    });
  }

  function deleteRecord(id) {
    if (!confirm("Delete this record?")) return;
    let records = WTStorage.loadData("records", []);
    records = records.filter(r=>r.id!==id);
    WTStorage.saveData("records", records);
    toast("🗑️ Record deleted");
    renderRecordList();
  }

  // ------------- Records list + searching -------------
  function matchesFilters(rec, q, weed, type, status, from, to) {
    if (rec.archived) return false;

    // Date range (ISO compare)
    if (from && (rec.date||"") < from) return false;
    if (to   && (rec.date||"") > to)   return false;

    // Text query across job name (road), council, batch, weed
    if (q) {
      const hay = `${rec.jobName||""} ${rec.councilJobNo||""} ${rec.batch||""} ${rec.weed||""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }

    // Weed
    if (weed && rec.weed !== weed) return false;

    // Type
    if (type && type!=="All" && rec.jobType!==type) return false;

    // Status
    if (status && status!=="All" && (rec.status||"Incomplete")!==status) return false;

    return true;
  }

  function renderRecordList() {
    const list = $("#recordList");
    if (!list) return;
    list.innerHTML = "";

    const q = ($("#recSearch")?.value || "").trim();
    const weed = $("#recWeed")?.value || "";
    const type = $("#recType")?.value || "All";
    const status = $("#recStatus")?.value || "All";
    const from = $("#recFrom")?.value || "";
    const to   = $("#recTo")?.value || "";

    const data = (WTStorage.loadData("records", []) || [])
      .filter(r=>matchesFilters(r,q,weed,type,status,from,to))
      .sort((a,b)=>(b.date||"").localeCompare(a.date||""));

    if (!data.length) {
      list.innerHTML = `<p class="muted">No records</p>`;
      return;
    }

    data.forEach(r=>{
      const item = document.createElement("div");
      item.className = "card";
      item.innerHTML = `
        <b>${r.jobName}</b><br>
        <small>${r.jobType} • ${formatAU(r.date)} • ${r.status || "Incomplete"}</small><br>
        <div class="row end gap" style="margin-top:.4rem;">
          <button class="pill" data-open="${r.id}">Open</button>
          <button class="pill emph" data-edit="${r.id}">Edit</button>
          <button class="pill warn" data-del="${r.id}">Delete</button>
        </div>`;
      list.appendChild(item);

      on(item.querySelector(`[data-open="${r.id}"]`), "click", ()=> openRecord(r.id));
      on(item.querySelector(`[data-edit="${r.id}"]`), "click", ()=> {
        editingId = r.id;
        openCreateTask();
        $("#autoName").value = r.jobName || "";
        $("#councilJobNo").value = r.councilJobNo || "";
        $("#jobType").value = r.jobType || "Inspection";
        $("#weedName").value = r.weed || "";
        $("#batchSelect").value = r.batch || "";
        $("#jobDate").value = r.date || todayISO();
        $("#startTime").value = r.startTime || "";
        $("#endTime").value = r.endTime || "";
        $("#temperature").value = r.temp || "";
        $("#humidity").value = r.humidity || "";
        $("#windSpeed").value = r.windSpeed || "";
        $("#windDirection").value = r.windDir || "";
        $("#latitude").value = (r.lat!=null) ? r.lat : "";
        $("#longitude").value = (r.lng!=null) ? r.lng : "";
        $("#notes").value = r.notes || "";
        syncRoadTrackingVisibility();
      });
      on(item.querySelector(`[data-del="${r.id}"]`), "click", ()=> deleteRecord(r.id));
    });
  }

  // ------------- Chemical inventory seed (if empty) -------------
  function renderChemSeedOnce() {
    const chems = WTStorage.loadData("chemicals", []);
    if (chems && chems.length) return; // already present
    // seed a few, you can add more in UI
    WTStorage.saveData("chemicals", [
      {name:"Crucial", active:"Glyphosate 540 g/L", containerSize:20, containerUnit:"L", containers:4, threshold:2},
      {name:"Bosol", active:"Metsulfuron-methyl", containerSize:500, containerUnit:"g", containers:2, threshold:1}
    ]);
  }

  // ------------- Wire up UI once DOM loaded -------------
  function init() {
    wireNav();
    populateWeeds();

    // Task sheet controls
    on($("#openTaskBtn"), "click", openCreateTask);
    on($("#locateBtn"), "click", handleLocateThenAutoname);
    on($("#autoWeatherBtn"), "click", handleAutoWeather);
    on($("#jobType"), "change", syncRoadTrackingVisibility);
    on($("#startTrack"), "click", startTrack);
    on($("#stopTrack"), "click", stopTrack);
    on($("#saveTaskBtn"), "click", ()=> saveJob(false));
    on($("#saveDraftBtn"), "click", ()=> saveJob(true));
    on($("#recSearchBtn"), "click", renderRecordList);
    on($("#recResetBtn"), "click", ()=>{
      if ($("#recSearch")) $("#recSearch").value="";
      if ($("#recWeed")) $("#recWeed").value="";
      if ($("#recType")) $("#recType").value="All";
      if ($("#recStatus")) $("#recStatus").value="All";
      if ($("#recFrom")) $("#recFrom").value="";
      if ($("#recTo")) $("#recTo").value="";
      renderRecordList();
    });

    // default values
    if ($("#jobDate") && !$("#jobDate").value) $("#jobDate").value = todayISO();
    syncRoadTrackingVisibility();
    wirePhoto();

    // home screen first
    switchScreen("home");

    // map lazy init (extras binds on DOMContentLoaded as well)
    try { WTExtras?.renderMapPins(); } catch {}
  }

  document.addEventListener("keydown", (e)=>{
    if (e.key==="Escape"){
      const s = document.querySelector(".sheet");
      if (s) s.remove();
    }
  });

  window.WTApp = {
    switchScreen,
    saveJob,
    openRecord,
    deleteRecord,
    renderRecordList
  };

  // init after DOM
  window.addEventListener("DOMContentLoaded", init);
})();

---

# START apps.js — PART 2/2
```javascript
/* =========================================================
   WeedTracker V60 Pilot — apps.js (tail helpers)
   Everything below is kept minimal to stay under message limits
   ========================================================= */

/* Optional: expose small helpers to index.html inline handlers (if used) */
window.WTUI = {
  openTask: () => document.getElementById("taskSheet")?.style.setProperty("display","flex"),
  closeTask: () => document.getElementById("taskSheet")?.style.setProperty("display","none"),
  searchRecords: () => (window.WTApp?.renderRecordList && WTApp.renderRecordList()),
  resetRecords: () => {
    const ids = ["recSearch","recWeed","recType","recStatus","recFrom","recTo"];
    ids.forEach(id=>{
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName==="SELECT") {
        if (id==="recType" || id==="recStatus") el.value="All";
        else el.value="";
      } else el.value="";
    });
    window.WTApp?.renderRecordList();
  }
};

/* Safety: ensure weeds select exists with header styling */
(function ensureWeedHeaderStyling(){
  const sel = document.getElementById("weedName");
  if (!sel) return;
  // Give header (first option) a visual hook via dataset -> styled in CSS
  sel.dataset.hasNoxHeader = "1";
})();
