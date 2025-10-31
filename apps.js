<!-- apps.js — WeedTracker V60 Pilot (FULL) -->
<script>
/* =========================================================
   WeedTracker V60 Pilot — apps.js (FULL BUILD)
   - Dark theme compatible (uses your styles.css colors)
   - “Road Shoulder Spray” type
   - AU dates (DD-MM-YYYY display, ISO for inputs)
   - Splash + spinner hookup
   - Noxious Weeds pinned to top + “Other (type in Notes)”
   - Create Task flow: Type → Locate → Auto Name → Weather → Weed → Batches → Times → Notes → Reminder → Save
   - Multi-batch per job (add multiple batches with per-batch usage)
   - When saving a job: deduct batch usage from batch remaining
   - Records/Batches popups with Apple Maps navigation
   - Unified Search Bar injected onto Records, Batches, Inventory, Mapping
   - Road tracking: start/stop, save polyline, quick overlay on map
   - Apple Maps navigation from Records + Map pins
   - LocalStorage DB with seeds + rolling backups
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  // -------------------------- Helpers --------------------------
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  const fmt = (n, d=0) => (n==null || n==="") ? "–" : Number(n).toFixed(d);
  const todayISO = () => new Date().toISOString().split("T")[0];
  const nowTime  = () => new Date().toTimeString().slice(0,5);

  const formatDateAU = (d) => {
    const dt = (d instanceof Date) ? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2,"0");
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const yyyy = dt.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };
  const formatDateAUCompact = (d) => {
    const dt = (d instanceof Date) ? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2,"0");
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const yyyy = dt.getFullYear();
    return `${dd}${mm}${yyyy}`;
  };

  function toast(msg, ms=1700) {
    const d = document.createElement("div");
    d.textContent = msg;
    Object.assign(d.style, {
      position:"fixed", bottom:"1.1rem", left:"50%", transform:"translateX(-50%)",
      background:"#222", color:"#fff", padding:".55rem .9rem",
      borderRadius:"10px", zIndex: 9999, fontWeight:700, boxShadow:"0 4px 16px rgba(0,0,0,.3)"
    });
    document.body.appendChild(d);
    setTimeout(()=>d.remove(), ms);
  }

  // Spinner hookup (uses #spinner element)
  const spinnerEl = $("#spinner");
  const spin = (on, msg) => {
    if (!spinnerEl) return;
    spinnerEl.classList.toggle("active", !!on);
    if (msg) spinnerEl.setAttribute("data-msg", msg);
  };

  // Splash fade (uses #splash)
  const splash = $("#splash");
  if (splash) {
    // ensure it disappears even if CSS class missing
    setTimeout(()=> splash.classList.add("fade"), 400);
    setTimeout(()=> splash.remove(), 1500);
  }

  // -------------------------- DB / Seeds --------------------------
  const STORAGE_KEY = "weedtracker_data_v60";
  const BACKUP_KEY  = "weedtracker_backup_v60";
  const MAX_BACKUPS = 4;

  // Weeds: noxious pinned; add “Other (type in Notes)”
  const NSW_WEEDS = [
    // noxious (examples + common ones requested)
    "Noxious Weeds (category)",
    "African Lovegrass (noxious)", "Blackberry (noxious)", "Serrated Tussock (noxious)",
    "Cape Broom (noxious)", "Chilean Needle Grass (noxious)", "St John’s Wort (noxious)",
    "Sweet Briar (noxious)", "Gorse (noxious)", "Lantana (noxious)",
    // common others
    "Fleabane", "Horehound", "Saffron Thistle", "Wild Radish", "Fountain Grass",
    "Other (type in Notes)"
  ];

  const DEFAULT_CHEMS = [
    {name:"Crucial", active:"Glyphosate 540 g/L", containerSize:20, containerUnit:"L", containers:4, threshold:2},
    {name:"Superwet", active:"Non-ionic surfactant", containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Hastings", active:"MCPA", containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Outright", active:"Fluroxypyr", containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Bosor", active:"Metsulfuron-methyl 600 g/kg", containerSize:500, containerUnit:"g", containers:1, threshold:1}
  ];

  function loadDB(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
    catch { return {}; }
  }
  function saveDB(withBackup=true){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
    if (!withBackup) return;
    try {
      const arr = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
      arr.unshift({ts:new Date().toISOString(), db:DB});
      while (arr.length > MAX_BACKUPS) arr.pop();
      localStorage.setItem(BACKUP_KEY, JSON.stringify(arr));
    } catch(e){}
  }
  function ensureDB(){
    const db = loadDB();
    db.version ??= 60;
    db.tasks ??= [];
    db.batches ??= [];   // {id, date, time, mix, remaining, used, chemicals: "desc string", dumped:[]}
    db.chems ??= DEFAULT_CHEMS.slice();
    db.procurement ??= [];
    db.weeds ??= NSW_WEEDS.slice();
    db.settings ??= {};
    return db;
  }
  let DB = ensureDB();
  saveDB(false);

  // -------------------------- Navigation --------------------------
  const screens = $$(".screen");
  function switchScreen(id) {
    screens.forEach(s => s.classList.remove("active"));
    $("#"+id)?.classList.add("active");
    window.scrollTo(0,0);
    if (id==="records")   renderRecords();
    if (id==="batches")   renderBatches();
    if (id==="inventory") renderChems();
    if (id==="mapping")   renderMap(true);
    if (id==="procurement") renderProcurement();
  }

  // Top “🏠 Home” buttons
  $$(".home-btn").forEach(b => b.addEventListener("click", ()=> switchScreen("home")));
  // Home tiles (from index)
  $$("[data-target]").forEach(b => b.addEventListener("click", ()=> switchScreen(b.dataset.target)));

  // -------------------------- Unified Filter Injection --------------------------
  // You asked for the SAME search bar across Records / Batches / Inventory / Mapping.
  // If a screen misses the unified bar, we inject it at the top of its .filters container (or create one).
  function injectUnifiedFilters(screenId) {
    const root = $("#"+screenId);
    if (!root) return;
    let holder = root.querySelector(".filters");
    if (!holder) {
      holder = document.createElement("div");
      holder.className = "filters";
      root.prepend(holder);
    }
    if (holder.dataset.unified === "yes") return;

    holder.dataset.unified = "yes";
    holder.insertAdjacentHTML("afterbegin", `
      <div class="grid gap">
        <input id="${screenId}_q" placeholder="Search name / road / weed / batch" />
        <div class="row gap">
          <label>Date From</label><input type="date" id="${screenId}_from" />
          <label>Date To</label><input type="date" id="${screenId}_to" />
        </div>
        <div class="row gap wrap">
          <label><input type="checkbox" id="${screenId}_tI">Inspection</label>
          <label><input type="checkbox" id="${screenId}_tS">Spot Spray</label>
          <label><input type="checkbox" id="${screenId}_tR">Road Shoulder Spray</label>
        </div>
        <div class="row gap">
          <button id="${screenId}_search">Search</button>
          <button id="${screenId}_reset">Reset</button>
        </div>
      </div>
    `);

    $("#"+screenId+"_search")?.addEventListener("click", ()=> {
      if (screenId==="records")   renderRecords(true);
      if (screenId==="batches")   renderBatches(true);
      if (screenId==="inventory") renderChems(true);
      if (screenId==="mapping")   renderMap(true);
    });
    $("#"+screenId+"_reset")?.addEventListener("click", ()=> {
      $("#"+screenId+"_q").value = "";
      $("#"+screenId+"_from").value = "";
      $("#"+screenId+"_to").value = "";
      ["tI","tS","tR"].forEach(k => { const c=$("#"+screenId+"_"+k); if (c) c.checked=false; });
      if (screenId==="records")   renderRecords(true);
      if (screenId==="batches")   renderBatches(true);
      if (screenId==="inventory") renderChems(true);
      if (screenId==="mapping")   renderMap(true);
    });
  }

  ["records","batches","inventory","mapping"].forEach(injectUnifiedFilters);

  // -------------------------- Create Task (Type/Locate/Auto/Weather/Weed/Batches/Times/Notes/Reminder) --------------------------
  // Force the labels for job type
  const taskType = $("#taskType");
  if (taskType) {
    // Normalize any previous value to “Road Shoulder Spray”
    [...taskType.options].forEach(o=>{
      if (/Road\s*Spray/i.test(o.textContent)) o.textContent = "Road Shoulder Spray";
      if (/roadspray/i.test(String(o.value))) o.value = "Road Shoulder Spray";
    });
  }

  // Ensure job date has today by default (ISO for input)
  const jobDateEl = $("#jobDate");
  if (jobDateEl && !jobDateEl.value) jobDateEl.value = todayISO();

  // Road tracking visibility block
  const roadTrackBlock = $("#roadTrackBlock");
  function syncTrackVis(){
    if (!taskType || !roadTrackBlock) return;
    roadTrackBlock.style.display = (taskType.value==="Road Shoulder Spray") ? "block" : "none";
  }
  taskType?.addEventListener("change", syncTrackVis);
  syncTrackVis();

  // Populate weeds with noxious pinned + “Other”
  function populateWeeds(){
    const sel = $("#weedSelect"); if (!sel) return;
    const nox = DB.weeds.filter(w=>/noxious/i.test(w));
    const rest= DB.weeds.filter(w=>! /noxious/i.test(w));
    const order = [
      "Noxious Weeds (category)",
      ...nox.filter(w=>w!=="Noxious Weeds (category)").sort(),
      ...rest.filter(w=>!/^Other/i.test(w)).sort(),
      "Other (type in Notes)"
    ].filter(Boolean);

    sel.innerHTML = "";
    const please = document.createElement("option");
    please.value = ""; please.textContent = "— Select Weed —";
    sel.appendChild(please);
    order.forEach(w=>{
      const o=document.createElement("option");
      o.value = w === "— Select Weed —" ? "" : w;
      o.textContent = /noxious/i.test(w) ? ("⚠ " + w) : w;
      if (/Noxious Weeds/.test(w)) { o.textContent = "🔺 Noxious Weeds (category)"; o.style.color="#d32f2f"; }
      sel.appendChild(o);
    });
  }
  populateWeeds();

  // Populate batch <select> (legacy single-select). We’ll *also* attach a multi-batch UI below it.
  function populateBatchSelect(){
    const sel = $("#batchSelect"); if (!sel) return;
    sel.innerHTML = "";
    const def = document.createElement("option");
    def.value=""; def.textContent="— Select Batch —"; sel.appendChild(def);
    DB.batches.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).forEach(b=>{
      const o=document.createElement("option");
      o.value = b.id; o.textContent = `${b.id} • ${formatDateAU(b.date)} • remain ${fmt(b.remaining ?? b.mix ?? 0)} L`;
      sel.appendChild(o);
    });
  }
  populateBatchSelect();

  // Multi-batch per job: add a compact UI under the legacy select
  // UI: a list of attached batches with amount-used, and “+ Add Batch” button for more
  let draftBatchUses = []; // [{batchId, amountL}]
  const batchSelLegacy = $("#batchSelect");
  if (batchSelLegacy) {
    const multiWrap = document.createElement("div");
    multiWrap.className = "card";
    multiWrap.style.marginTop = ".4rem";
    multiWrap.innerHTML = `
      <div class="row spread"><b>Batches for This Job</b><span class="dim">(add multiple)</span></div>
      <div id="jobBatchList" class="list" style="margin-top:.4rem;"></div>
      <div class="row end"><button id="addJobBatch" class="pill">+ Add Batch</button></div>
    `;
    batchSelLegacy.insertAdjacentElement("afterend", multiWrap);

    function renderJobBatchList(){
      const list = $("#jobBatchList");
      if (!list) return;
      list.innerHTML = "";
      if (!draftBatchUses.length) {
        const empty = document.createElement("div");
        empty.className = "item dim";
        empty.textContent = "No batches linked to this job yet.";
        list.appendChild(empty);
        return;
      }
      draftBatchUses.forEach((u, idx)=>{
        const b = DB.batches.find(x=>x.id===u.batchId);
        const line = document.createElement("div");
        line.className = "item";
        line.innerHTML = `
          <div class="row spread">
            <div><b>${u.batchId}</b> ${b ? `• remain ${fmt(b.remaining ?? b.mix ?? 0)} L`:""}</div>
            <div class="row gap">
              <input type="number" min="0" step="0.1" value="${u.amountL||0}" style="width:110px" />
              <span class="dim">L used</span>
              <button class="pill warn" data-del>Remove</button>
            </div>
          </div>
        `;
        const inp = line.querySelector("input");
        inp.addEventListener("input", ()=> { u.amountL = Number(inp.value||0); });
        line.querySelector("[data-del]").addEventListener("click", ()=>{
          draftBatchUses.splice(idx,1);
          renderJobBatchList();
        });
        list.appendChild(line);
      });
    }

    $("#addJobBatch").addEventListener("click", ()=>{
      // Simple chooser using prompt; stays offline-friendly
      if (!DB.batches.length) { toast("No batches yet"); return; }
      const ids = DB.batches.map(b=>b.id).join(", ");
      const chosen = prompt(`Enter Batch ID to add:\n${ids}`, DB.batches[0].id);
      if (!chosen) return;
      const found = DB.batches.find(b=>b.id===chosen.trim());
      if (!found) { toast("Batch not found"); return; }
      if (draftBatchUses.find(x=>x.batchId===found.id)) { toast("Already added"); return; }
      draftBatchUses.push({batchId: found.id, amountL: 0});
      renderJobBatchList();
    });

    // Keep legacy single-select usable: when user selects it, we add it into the multi list
    batchSelLegacy.addEventListener("change", ()=>{
      const id = batchSelLegacy.value;
      if (!id) return;
      if (draftBatchUses.find(x=>x.batchId===id)) { toast("Batch already added below"); return; }
      draftBatchUses.push({batchId: id, amountL: 0});
      renderJobBatchList();
      batchSelLegacy.value = ""; // reset legacy select after adding to multi
    });

    renderJobBatchList();
  }

  // Locate button → set road name
  let currentRoad = "";
  $("#locateBtn")?.addEventListener("click", ()=>{
    spin(true, "Getting location…");
    if (!navigator.geolocation) { spin(false); toast("Enable location"); return; }
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{
        const {latitude:lat, longitude:lon} = pos.coords;
        // Persist for weather
        localStorage.setItem("lastLat", String(lat));
        localStorage.setItem("lastLon", String(lon));
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const j = await r.json();
        currentRoad = j.address?.road || j.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        $("#locRoad").textContent = currentRoad;
      }catch{
        $("#locRoad").textContent = "Unknown";
      }
      spin(false);
      toast("Location set");
    }, ()=> { spin(false); toast("GPS failed"); });
  });

  // Auto-name: Road + DDMMYYYY + _I/SS/RS (we’ll use RSI for “Road Shoulder Spray” => RS)
  const TYPE_PREFIX = { "Inspection":"I", "Spot Spray":"SS", "Road Shoulder Spray":"RS" };
  $("#autoNameBtn")?.addEventListener("click", ()=>{
    const t = $("#taskType")?.value || "Inspection";
    const prefix = TYPE_PREFIX[t] || "I";
    const dInput = $("#jobDate");
    const dt = dInput && dInput.value ? new Date(dInput.value) : new Date();
    const compact = formatDateAUCompact(dt);
    const base = (currentRoad || "Unknown").replace(/\s+/g,"");
    $("#jobName").value = `${base}${compact}_${prefix}`;
  });

  // Weather
  $("#autoWeatherBtn")?.addEventListener("click", async ()=>{
    try {
      spin(true, "Fetching weather…");
      const lat = localStorage.getItem("lastLat");
      const lon = localStorage.getItem("lastLon");
      if (!lat || !lon) { spin(false); toast("Tap Locate first"); return; }
      const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;
      const r = await fetch(url);
      const j = await r.json();
      const c = j.current || {};
      $("#temp").value     = c.temperature_2m ?? "";
      $("#wind").value     = c.wind_speed_10m ?? "";
      $("#windDir").value  = (c.wind_direction_10m ?? "") + (c.wind_direction_10m!=null?"°":"");
      $("#humidity").value = c.relative_humidity_2m ?? "";
      $("#wxUpdated").textContent = "Updated @ " + nowTime();
      spin(false); toast("Weather updated");
    } catch(e) {
      spin(false); toast("Weather unavailable");
    }
  });

  // Roadside tracking
  let trackTimer=null, trackCoords=[];
  $("#startTrack")?.addEventListener("click", ()=>{
    trackCoords=[]; $("#trackStatus").textContent="Tracking…";
    if (!navigator.geolocation){ toast("Enable location"); return; }
    if (trackTimer) clearInterval(trackTimer);
    trackTimer = setInterval(()=> navigator.geolocation.getCurrentPosition(p=>{
      trackCoords.push([p.coords.latitude, p.coords.longitude]);
    }), 5000);
  });
  $("#stopTrack")?.addEventListener("click", ()=>{
    if (trackTimer) clearInterval(trackTimer);
    $("#trackStatus").textContent = `Stopped (${trackCoords.length} pts)`;
    localStorage.setItem("lastTrack", JSON.stringify(trackCoords));
  });

  // Photo upload
  let photoDataURL = "";
  $("#photoInput")?.addEventListener("change", (e)=>{
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ()=>{ photoDataURL = String(reader.result || ""); const img=$("#photoPreview"); img.src=photoDataURL; img.style.display="block"; };
    reader.readAsDataURL(f);
  });

  // Reminder weeks 0–52 (start blank by request)
  const remSel = $("#reminderWeeks");
  if (remSel && !remSel.options.length) {
    for (let i=0;i<=52;i++){ const o=document.createElement("option"); o.value=String(i); o.textContent=String(i); remSel.appendChild(o); }
  }

  // Save Task (Draft / Save)
  $("#saveTask")?.addEventListener("click", ()=> saveTask(false));
  $("#saveDraft")?.addEventListener("click", ()=> saveTask(true));

  function saveTask(isDraft){
    spin(true, isDraft?"Saving draft…":"Saving task…");
    const id=Date.now();
    const obj = {
      id,
      name: ($("#jobName")?.value||"").trim() || ("Task_"+id),
      council: ($("#councilNum")?.value||"").trim(),
      linkedInspectionId: ($("#linkInspectionId")?.value||"").trim(),
      type: ($("#taskType")?.value)||"Inspection",
      weed: ($("#weedSelect")?.value)||"",
      // Keep legacy single batch for backward compatibility (not shown in records; we rely on batchUses below)
      batch: ($("#batchSelect")?.value)||"",
      // Multi-batch usage:
      batchUses: draftBatchUses.map(x=>({batchId:x.batchId, amountL:Number(x.amountL||0)})),
      date: ($("#jobDate")?.value) || todayISO(),
      start: ($("#startTime")?.value)||"",
      end:   ($("#endTime")?.value)||"",
      temp: $("#temp")?.value || "",
      wind: $("#wind")?.value || "",
      windDir: $("#windDir")?.value || "",
      humidity: $("#humidity")?.value || "",
      reminder: $("#reminderWeeks")?.value || "",
      status: isDraft ? "Draft" : "Incomplete",
      notes: $("#notes")?.value || "",
      coords: trackCoords.slice(),
      photo: photoDataURL || "",
      createdAt: new Date().toISOString(),
      archived:false
    };

    // Merge / upsert
    const existing = DB.tasks.find(t=> t.name===obj.name);
    if (existing) Object.assign(existing, obj); else DB.tasks.push(obj);

    // If linked inspection provided, mark it archived
    if (obj.linkedInspectionId){
      const insp = DB.tasks.find(t=> t.type==="Inspection" && (String(t.id)===obj.linkedInspectionId || t.name===obj.linkedInspectionId));
      if (insp){ insp.archived=true; insp.status="Archived"; }
    }

    // Deduct batch usage from batch remaining
    if (Array.isArray(obj.batchUses) && obj.batchUses.length){
      obj.batchUses.forEach(u=>{
        const b = DB.batches.find(x=>x.id===u.batchId);
        if (!b) return;
        const amt = Math.max(0, Number(u.amountL||0));
        b.used = (b.used||0) + amt;
        const mix = Number(b.mix||0);
        b.remaining = Math.max(0, mix - (b.used||0));
        // Link job to batch (for popup listing)
        b.linkedJobs = b.linkedJobs || [];
        if (!b.linkedJobs.includes(obj.name)) b.linkedJobs.push(obj.name);
      });
    }

    saveDB();
    populateBatchSelect(); // in case remaining changed
    renderRecords();
    renderBatches();
    renderChems();
    renderProcurement();
    spin(false);
    toast(isDraft ? "Draft saved" : "Task saved");
  }

  // -------------------------- Records --------------------------
  function unifiedFilterMatch(t, screenId){
    // read unified bar values
    const q = $("#"+screenId+"_q")?.value?.trim().toLowerCase() || "";
    const from = $("#"+screenId+"_from")?.value || "";
    const to   = $("#"+screenId+"_to")?.value   || "";
    const fI = $("#"+screenId+"_tI")?.checked; // Inspection
    const fS = $("#"+screenId+"_tS")?.checked; // Spot
    const fR = $("#"+screenId+"_tR")?.checked; // Road Shoulder Spray

    if (from && (t.date||"") < from) return false;
    if (to   && (t.date||"") > to)   return false;

    // Type filter if any selected
    const anyType = fI || fS || fR;
    if (anyType) {
      const type = t.type;
      const ok =
        (fI && type==="Inspection") ||
        (fS && type==="Spot Spray") ||
        (fR && type==="Road Shoulder Spray");
      if (!ok) return false;
    }

    if (q) {
      const hay = `${t.name} ${t.weed} ${t.council} ${(t.batch||"")} ${(t.batchUses||[]).map(u=>u.batchId).join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function renderRecords(){
    const list = $("#recordsList"); if (!list) return;
    list.innerHTML = "";
    DB.tasks
      .filter(t=>!t.archived)
      .filter(t=> unifiedFilterMatch(t, "records"))
      .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
      .forEach(t=>{
        const totalAssigned = (t.batchUses||[]).reduce((s,u)=> s + Number(u.amountL||0), 0);
        const item = document.createElement("div");
        item.className = "item";
        item.innerHTML = `
          <b>${t.name}</b><br>
          <small>${t.type} • ${formatDateAU(t.date)} • ${t.status}</small><br>
          <small>Assigned from batches: ${fmt(totalAssigned)} L</small>
          <div class="row end" style="margin-top:.35rem">
            <button class="pill" data-open>Open</button>
            ${t.coords?.length ? `<button class="pill" data-nav>Navigate</button>` : ""}
          </div>
        `;
        item.querySelector("[data-open]").addEventListener("click", ()=> showJobPopup(t));
        const nb = item.querySelector("[data-nav]");
        nb && nb.addEventListener("click", ()=>{
          const pt = t.coords?.[0]; if (!pt) { toast("No coords"); return; }
          openAppleMaps(pt[0], pt[1]);
        });
        list.appendChild(item);
      });
  }

  function showJobPopup(t){
    const batchesHtml =
      (t.batchUses && t.batchUses.length)
        ? `<ul>${t.batchUses.map(u=>`<li>${u.batchId} — ${fmt(u.amountL)} L</li>`).join("")}</ul>`
        : "—";
    const photoHtml = t.photo ? `<div style="margin:.4rem 0"><img src="${t.photo}" style="max-width:100%;border-radius:8px"/></div>` : "";
    const html = `
      <div class="modal" id="jobModal">
        <div class="card p">
          <h3 style="margin-top:0">${t.name}</h3>
          <div class="grid gap">
            <div><b>Type:</b> ${t.type}</div>
            <div><b>Status:</b> ${t.status}</div>
            <div><b>Date:</b> ${formatDateAU(t.date)}</div>
            <div><b>Start:</b> ${t.start||"–"} · <b>Finish:</b> ${t.end||"–"}</div>
            <div><b>Weed:</b> ${t.weed||"—"}</div>
            <div><b>Council #:</b> ${t.council||"—"}</div>
            <div class="grid"><b>Batches (assigned):</b> ${batchesHtml}</div>
            <div class="grid"><b>Weather:</b> ${fmt(t.temp)}°C, ${fmt(t.wind)} km/h, ${t.windDir||"–"}, ${fmt(t.humidity)}%</div>
            <div class="grid"><b>Notes:</b> ${t.notes||"—"}</div>
          </div>
          ${photoHtml}
          <div class="row gap end" style="margin-top:.6rem;">
            ${t.coords?.length ? `<button class="pill" data-nav>Navigate</button>` : ""}
            <button class="pill" data-edit>Edit</button>
            <button class="pill warn" data-close>Close</button>
          </div>
        </div>
      </div>
    `;
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstChild);
    const modal = $("#jobModal");
    modal.addEventListener("click", (e)=>{ if (e.target===modal || e.target.dataset.close!=null) modal.remove(); });
    modal.querySelector("[data-edit]")?.addEventListener("click", ()=>{
      switchScreen("createTask");
      $("#jobName").value = t.name;
      $("#councilNum").value = t.council||"";
      $("#linkInspectionId").value = t.linkedInspectionId||"";
      $("#taskType").value = t.type;
      $("#taskType").dispatchEvent(new Event("change"));
      $("#weedSelect").value = t.weed||"";
      $("#jobDate").value = t.date||todayISO();
      $("#startTime").value = t.start||"";
      $("#endTime").value = t.end||"";
      $("#temp").value = t.temp||"";
      $("#wind").value = t.wind||"";
      $("#windDir").value = t.windDir||"";
      $("#humidity").value = t.humidity||"";
      $("#notes").value = t.notes||"";
      // Load batches back into draft UI
      draftBatchUses = (t.batchUses||[]).map(u=>({batchId:u.batchId, amountL:Number(u.amountL||0)}));
      // Force re-render of jobBatchList
      const evt = new Event("click"); $("#addJobBatch")?.dispatchEvent(evt); // quick hack to ensure list exists
      const list = $("#jobBatchList"); if (list) { list.innerHTML=""; } // then rebuild
      // custom re-render:
      const trigger = document.createElement("button");
      trigger.style.display="none";
      trigger.id = "__repaintBatches";
      trigger.addEventListener("click", ()=> {
        const list2 = $("#jobBatchList");
        if (!list2) return;
        list2.innerHTML="";
        draftBatchUses.forEach((u,idx)=>{
          const b = DB.batches.find(x=>x.id===u.batchId);
          const line = document.createElement("div");
          line.className="item";
          line.innerHTML = `
            <div class="row spread">
              <div><b>${u.batchId}</b> ${b ? `• remain ${fmt(b.remaining ?? b.mix ?? 0)} L`:""}</div>
              <div class="row gap">
                <input type="number" min="0" step="0.1" value="${u.amountL||0}" style="width:110px" />
                <span class="dim">L used</span>
                <button class="pill warn" data-del>Remove</button>
              </div>
            </div>`;
          const inp = line.querySelector("input");
          inp.addEventListener("input", ()=>{ u.amountL = Number(inp.value||0); });
          line.querySelector("[data-del]").addEventListener("click", ()=>{
            draftBatchUses.splice(idx,1);
            trigger.click();
          });
          list2.appendChild(line);
        });
      });
      document.body.appendChild(trigger);
      trigger.click();
      trigger.remove();
      modal.remove();
    });
    modal.querySelector("[data-nav]")?.addEventListener("click", ()=>{
      const pt = t.coords?.[0]; if (!pt) { toast("No coords"); return; }
      openAppleMaps(pt[0], pt[1]);
    });
    document.addEventListener("keydown", escClose);
    function escClose(e){ if(e.key==="Escape"){ modal.remove(); document.removeEventListener("keydown",escClose);} }
  }

  // -------------------------- Batches --------------------------
  function renderBatches(){
    const list = $("#batchList"); if (!list) return;
    list.innerHTML = "";
    DB.batches
      .filter(b=>{
        // unified filters
        const fakeTask = { // adapt to unifiedFilterMatch signature
          name: b.id,
          date: b.date||"",
          type: "Batch",
          weed: "",
          council:"",
          batch: b.id,
          batchUses:[]
        };
        return unifiedFilterMatch(fakeTask, "batches");
      })
      .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
      .forEach(b=>{
        const empty = (Number(b.remaining||0) <= 0);
        const item = document.createElement("div");
        item.className = "item";
        if (empty) item.style.border = "2px solid #b30000"; // red ring if fully consumed
        item.innerHTML = `
          <b>${b.id}</b><br>
          <small>${formatDateAU(b.date)} • Total ${fmt(b.mix)} L • Remaining ${fmt(b.remaining ?? b.mix)} L</small>
          <div class="row end" style="margin-top:.35rem">
            <button class="pill" data-open>Open</button>
          </div>
        `;
        item.querySelector("[data-open]").addEventListener("click", ()=> showBatchPopup(b));
        list.appendChild(item);
      });
  }

  function showBatchPopup(b){
    const jobs = DB.tasks.filter(t=> (t.batchUses||[]).some(u=>u.batchId===b.id) || t.batch===b.id);
    const linkedHtml = jobs.length ? `<ul>${jobs.map(j=>`<li><a href="#" data-open-job="${j.id}">${j.name}</a></li>`).join("")}</ul>` : "—";
    const dumpedHtml = (b.dumped && b.dumped.length)
      ? `<ul>${b.dumped.map(d=>`<li>${d.date} ${d.time} — ${fmt(d.amount)} L (${d.reason||"No reason"})</li>`).join("")}</ul>`
      : "—";
    const html = `
      <div class="modal" id="batchModal">
        <div class="card p">
          <h3 style="margin-top:0">${b.id}</h3>
          <div><b>Time:</b> ${b.time||"—"} · <b>Date:</b> ${b.date ? formatDateAU(b.date) : "—"}</div>
          <div><b>Total Mix:</b> ${fmt(b.mix)} L</div>
          <div><b>Remaining:</b> ${fmt(b.remaining ?? b.mix)} L</div>
          <div style="margin-top:.25rem"><b>Chemicals:</b> ${b.chemicals || "—"}</div>
          <div style="margin-top:.25rem"><b>Linked Jobs:</b> ${linkedHtml}</div>
          <div style="margin-top:.25rem"><b>Dumped:</b> ${dumpedHtml}</div>
          <div class="row gap end" style="margin-top:.6rem">
            <button class="pill" data-dump>Dump</button>
            <button class="pill" data-edit>Edit</button>
            <button class="pill warn" data-close>Close</button>
          </div>
        </div>
      </div>
    `;
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstChild);
    const modal = $("#batchModal");
    modal.addEventListener("click", (e)=>{ if(e.target===modal || e.target.dataset.close!=null) modal.remove(); });

    // Open job links
    $$("[data-open-job]", modal).forEach(a=>{
      a.addEventListener("click", (e)=>{
        e.preventDefault();
        const id = a.getAttribute("data-open-job");
        const t = DB.tasks.find(x=> String(x.id) === String(id));
        if (t) showJobPopup(t);
      });
    });

    // Edit batch (quick fields)
    modal.querySelector("[data-edit]")?.addEventListener("click", ()=>{
      const mix = Number(prompt("Total mix (L):", b.mix))||b.mix;
      const rem = Number(prompt("Remaining (L):", b.remaining ?? b.mix)) || (b.remaining ?? b.mix);
      const chems = prompt("Chemicals (description):", b.chemicals||"") || b.chemicals || "";
      b.mix = mix; b.remaining = rem; b.chemicals = chems; b.time ||= nowTime(); b.date ||= todayISO();
      saveDB(); renderBatches(); modal.remove();
    });

    // Dump flow
    modal.querySelector("[data-dump]")?.addEventListener("click", ()=>{
      const amt = Number(prompt("Dump how many litres?", "0"))||0;
      if (amt<=0) { toast("No change"); return; }
      const reason = prompt("Reason for dump?", "Expired or leftover") || "";
      b.remaining = Math.max(0, Number(b.remaining ?? b.mix || 0) - amt);
      b.dumped = b.dumped || [];
      b.dumped.push({date: todayISO(), time: nowTime(), amount: amt, reason});
      saveDB(); renderBatches(); modal.remove();
      toast("Batch updated");
    });
  }

  // New Batch button (single large popup approach was requested; here we do simple prompts for offline)
  $("#newBatch")?.addEventListener("click", ()=>{
    const id  = "B" + Date.now();
    const mix = Number(prompt("Total mix (L):", "600")) || 0;
    const chems = prompt("Chemicals (e.g. Crucial 2 L/100, Superwet 300 mL/100):", "") || "";
    const obj = { id, date: todayISO(), time: nowTime(), mix, remaining: mix, used: 0, chemicals: chems, dumped:[], linkedJobs:[] };
    DB.batches.push(obj);
    saveDB();
    populateBatchSelect();
    renderBatches();
  });

  // -------------------------- Inventory (Chemicals) --------------------------
  function renderChems(){
    const list = $("#chemList"); if (!list) return;
    list.innerHTML = "";
    DB.chems
      .filter(c=>{
        // we pass chemical as a “fake task” to reuse unified filter loosely
        const fake = {name:c.name, weed:"", council:"", date:"", type:"", batch:"", batchUses:[]};
        return unifiedFilterMatch(fake, "inventory");
      })
      .sort((a,b)=>a.name.localeCompare(b.name))
      .forEach(c=>{
        const total = (c.containers||0) * (c.containerSize||0);
        const line = `${c.containers||0} × ${fmt(c.containerSize)} ${c.containerUnit} → total ${fmt(total)} ${c.containerUnit}`;
        const card = document.createElement("div");
        card.className = "item";
        card.innerHTML = `
          <b>${c.name}</b><br>
          <small>${line}</small><br>
          <small>Active: ${c.active || "—"}</small>
          <div class="row gap end" style="margin-top:.35rem">
            <button class="pill" data-edit>Edit</button>
            <button class="pill warn" data-del>Delete</button>
          </div>
        `;
        card.querySelector("[data-edit]").addEventListener("click", ()=> openChemEditor(c));
        card.querySelector("[data-del]").addEventListener("click", ()=>{
          if (!confirm("Delete chemical?")) return;
          DB.chems = DB.chems.filter(x=>x!==c);
          saveDB(); renderChems(); renderProcurement();
        });
        // Low-stock → procurement
        if (c.threshold && (c.containers||0) < c.threshold) upsertProcurement(`Low stock: ${c.name}`);
        list.appendChild(card);
      });
  }

  $("#addChem")?.addEventListener("click", ()=>{
    const name=prompt("Chemical name:"); if(!name) return;
    const active=prompt("Active ingredient:","")||"";
    const size=Number(prompt("Container size (number):","20"))||0;
    const unit=prompt("Unit (L, mL, g, kg):","L")||"L";
    const count=Number(prompt("How many containers:","0"))||0;
    const thr=Number(prompt("Reorder threshold (containers):","0"))||0;
    DB.chems.push({name,active,containerSize:size,containerUnit:unit,containers:count,threshold:thr});
    saveDB(); renderChems(); renderProcurement();
  });

  // Simple bottom sheet editor (uses elements in index)
  let _chemEditing=null;
  function openChemEditor(c){
    _chemEditing = c;
    $("#ce_name").value = c.name || "";
    $("#ce_active").value = c.active || "";
    $("#ce_size").value = c.containerSize || 0;
    $("#ce_unit").value = c.containerUnit || "L";
    $("#ce_count").value = c.containers || 0;
    $("#ce_threshold").value = c.threshold || 0;
    $("#chemEditSheet").style.display = "block";
  }
  function closeChemEditor(){ $("#chemEditSheet").style.display="none"; _chemEditing=null; }
  $("#ce_cancel")?.addEventListener("click", closeChemEditor);
  $("#ce_save")?.addEventListener("click", ()=>{
    if (!_chemEditing) return;
    _chemEditing.name = $("#ce_name").value.trim();
    _chemEditing.active = $("#ce_active").value.trim();
    _chemEditing.containerSize = Number($("#ce_size").value)||0;
    _chemEditing.containerUnit = $("#ce_unit").value||"L";
    _chemEditing.containers = Number($("#ce_count").value)||0;
    _chemEditing.threshold  = Number($("#ce_threshold").value)||0;
    saveDB(); renderChems(); renderProcurement(); closeChemEditor(); toast("Chemical updated");
  });

  // Procurement render
  function renderProcurement(){
    const ul = $("#procList"); if (!ul) return;
    ul.innerHTML = "";
    DB.chems.forEach(c=>{
      if (c.threshold && (c.containers||0) < c.threshold){
        const li = document.createElement("li");
        li.textContent = `Low stock: ${c.name} (${c.containers||0} < ${c.threshold})`;
        ul.appendChild(li);
      }
    });
  }
  function upsertProcurement(title){
    DB.procurement ??= [];
    if (!DB.procurement.find(p=>p.title===title)){
      DB.procurement.push({id:"P"+Date.now()+Math.random().toString(16).slice(2), title, createdAt:new Date().toISOString(), done:false});
      saveDB(false);
    }
  }

  // -------------------------- Mapping --------------------------
  let map;
  function ensureMap(){
    if (map) return map;
    if (!window.L) return null;
    map = L.map("map").setView([-34.75, 148.65], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);
    // simple “Locate Me” floating button (top-right)
    const btn = document.createElement("button");
    btn.textContent = "Locate Me";
    btn.className = "pill";
    btn.style.position="absolute"; btn.style.right="10px"; btn.style.top="10px"; btn.style.zIndex="500";
    const mapWrap = $("#mapping") || document.body;
    mapWrap.appendChild(btn);
    btn.addEventListener("click", ()=>{
      if (!navigator.geolocation){ toast("Enable location"); return; }
      navigator.geolocation.getCurrentPosition(p=>{
        const pt=[p.coords.latitude, p.coords.longitude];
        map.setView(pt, 14);
        L.circleMarker(pt,{radius:7,opacity:.9}).addTo(map).bindPopup("You are here").openPopup();
      });
    });
    return map;
  }

  function openAppleMaps(lat, lon){
    const mapsURL = `maps://?daddr=${lat},${lon}&dirflg=d`;
    const webURL  = `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
    const a = document.createElement("a"); a.href = mapsURL; document.body.appendChild(a); a.click();
    setTimeout(()=>{ window.open(webURL,"_blank"); a.remove(); }, 250);
  }

  function renderMap(fit=false){
    const m = ensureMap(); if (!m) return;
    m.eachLayer(l=>{ if (!(l instanceof L.TileLayer)) m.removeLayer(l); });

    const tasks = DB.tasks
      .filter(t=>!t.archived)
      .filter(t=> unifiedFilterMatch(t, "mapping"));

    const group = L.featureGroup();
    tasks.forEach(t=>{
      if (t.coords?.length>1) group.addLayer(L.polyline(t.coords,{color:"yellow",weight:4,opacity:.9}));
      const pt = t.coords?.[0] || null;
      if (!pt) return;
      const openId = `open_${t.id}`;
      const navId  = `nav_${t.id}`;
      const popup = `<b>${t.name}</b><br>${t.type} • ${formatDateAU(t.date)}
        <br><button id="${openId}" class="pill" style="margin-top:.35rem">Open</button>
        <button id="${navId}" class="pill" style="margin-top:.35rem;margin-left:.4rem">Navigate</button>`;
      const marker = L.marker(pt);
      marker.bindPopup(popup);
      marker.on("popupopen", ()=>{
        setTimeout(()=>{
          const ob = document.getElementById(openId);
          const nb = document.getElementById(navId);
          ob && (ob.onclick = ()=> showJobPopup(t));
          nb && (nb.onclick = ()=> openAppleMaps(pt[0], pt[1]));
        },0);
      });
      group.addLayer(marker);
    });
    group.addTo(m);
    if (fit && tasks.length){
      try { m.fitBounds(group.getBounds().pad(0.2)); } catch {}
    }
    // show last tracked line faintly
    try {
      const last = JSON.parse(localStorage.getItem("lastTrack")||"[]");
      if (Array.isArray(last) && last.length>1) L.polyline(last,{color:"#ffda44",weight:3,opacity:.6}).addTo(m);
    }catch{}
  }

  // -------------------------- Settings / Export / Restore --------------------------
  $("#saveAccount")?.addEventListener("click", ()=>{
    const v = $("#accountEmail")?.value?.trim() || "";
    DB.settings.accountEmail = v;
    saveDB(); toast("Saved");
  });
  $("#exportBtn")?.addEventListener("click", ()=>{
    const blob = new Blob([JSON.stringify(DB,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "weedtracker_data.json"; a.click();
    URL.revokeObjectURL(url);
  });
  $("#restoreBtn")?.addEventListener("click", ()=>{
    const arr = JSON.parse(localStorage.getItem(BACKUP_KEY)||"[]");
    if (!arr.length) { toast("No backup found"); return; }
    const latest = arr[0].db;
    DB = latest; saveDB(false);
    renderRecords(); renderBatches(); renderChems(); renderMap();
    toast("Restored");
  });
  $("#clearBtn")?.addEventListener("click", ()=>{
    if (!confirm("Clear ALL local data?")) return;
    localStorage.removeItem(STORAGE_KEY);
    DB = ensureDB(); saveDB(false);
    renderRecords(); renderBatches(); renderChems(); renderMap(); renderProcurement();
    toast("Cleared");
  });

  // -------------------------- Initial paints --------------------------
  renderRecords();
  renderBatches();
  renderChems();
  renderProcurement();
  renderMap(false);

});
</script>
