/* ===========================================================
   WeedTracker V60.4 Pilot — apps.js  (FULL FILE)
   - Dark UI (works with styles.css you have)
   - AU dates; Apple Maps navigation
   - Home button wired everywhere
   - Weeds: "🔺 Noxious Weeds (category)" pinned to top + "Other" at bottom
   - Job types: Inspection / Spot Spray / Road Shoulder Spray
   - Create Task: Date → Times (Start/Stop); single set of times only
   - Batches-per-job: add multiple batch uses (batch + amount L)
   - Records: display only TOTAL L assigned to that job (sum of batch uses)
   - Batches: single large modal creator (no chained prompts)
   - Search bars: unified across Records / Batches / Mapping / Inventory
   - Road tracking section shows only for Road Shoulder Spray
   - Locate Me, Weather auto-fill (Open-Meteo)
   - Keeps existing local data (migrates older shapes)
   =========================================================== */

(function () {
  // ------------------ Quick DOM helpers ------------------
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const todayISO = () => new Date().toISOString().split("T")[0];
  const nowTime  = () => new Date().toTimeString().slice(0,5);
  const fmt = (n, d = 0) => (n == null || n === "" || isNaN(n)) ? "–" : Number(n).toFixed(d);

  // AU date formats
  const formatDateAU = (d) => {
    const dt = (d instanceof Date) ? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = dt.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };
  const formatDateAUCompact = (d) => {
    const dt = (d instanceof Date) ? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = dt.getFullYear();
    return `${dd}${mm}${yyyy}`;
  };

  // Toast
  function toast(msg, ms = 1800) {
    const d = document.createElement("div");
    d.textContent = msg;
    Object.assign(d.style, {
      position: "fixed",
      bottom: "1.1rem",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#2ecc71",
      color: "#fff",
      padding: ".6rem 1.1rem",
      borderRadius: "20px",
      boxShadow: "0 2px 8px rgba(0,0,0,.25)",
      zIndex: 9999,
      fontWeight: 700,
    });
    document.body.appendChild(d);
    setTimeout(() => d.remove(), ms);
  }

  // Spinner
  const spinner = $("#spinner");
  const spin = (on, msg) => {
    if (!spinner) return;
    spinner.classList[on ? "add" : "remove"]("active");
    if (msg) spinner.setAttribute("data-msg", msg);
  };

  // ------------------ Data (localStorage) ------------------
  const STORAGE_KEY = "weedtracker_data_v60";
  function loadDB() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const db = raw ? JSON.parse(raw) : {};
      db.version ??= 60.4;
      db.tasks ??= [];
      db.batches ??= [];
      db.chems ??= [];
      db.weeds ??= [];
      db.procurement ??= [];
      // migrate: ensure batchUses array exists on tasks
      db.tasks.forEach(t => { t.batchUses ??= []; }); // [{batchId, amountL}]
      return db;
    } catch {
      return { version: 60.4, tasks: [], batches: [], chems: [], weeds: [], procurement: [] };
    }
  }
  function saveDB() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
  }
  let DB = loadDB();

  // ------------------ Seeds (weeds/chems) ------------------
  const NSW_WEEDS = [
    "African Lovegrass (noxious)","Blackberry (noxious)","Serrated Tussock (noxious)",
    "Cape Broom (noxious)","Chilean Needle Grass (noxious)","St John’s Wort (noxious)",
    "Sweet Briar (noxious)","Gorse (noxious)","Lantana (noxious)","Fleabane",
    "Horehound","Saffron Thistle","Wild Radish","Fountain Grass","Cape Broom" // explicit Cape Broom plain
  ];
  const DEFAULT_CHEMS = [
    {name:"Crucial", active:"Glyphosate 540 g/L", containerSize:20, containerUnit:"L", containers:4, threshold:2},
    {name:"SuperWet", active:"Non-ionic surfactant", containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Hastings", active:"MCPA", containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Outright", active:"Fluroxypyr", containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Bosor", active:"Metsulfuron-methyl", containerSize:500, containerUnit:"g", containers:2, threshold:1}
  ];
  if (!DB.weeds?.length) DB.weeds = NSW_WEEDS.slice();
  if (!DB.chems?.length) DB.chems = DEFAULT_CHEMS.slice();
  saveDB();

  // ------------------ Splash fade ------------------
  const splash = $("#splash");
  if (splash) {
    setTimeout(() => splash.classList.add("fade"), 50);
    setTimeout(() => splash.remove(), 1600);
  }

  // ------------------ Navigation ------------------
  function switchScreen(id) {
    $$(".screen").forEach(s => s.classList.remove("active"));
    const el = document.getElementById(id);
    if (el) el.classList.add("active");

    // refresh lists when entering
    if (id === "records") renderRecords();
    if (id === "batches") renderBatches();
    if (id === "inventory") renderChems();
    if (id === "mapping") renderMap(true);
    if (id === "procurement") renderProcurement();
    window.scrollTo(0, 0);
  }
  // home buttons
  $$(".home-btn").forEach(b => b.addEventListener("click", () => switchScreen("home")));
  // tiles / nav buttons
  $$("[data-target]").forEach(btn => btn.addEventListener("click", () => switchScreen(btn.dataset.target)));

  // ------------------ Create Task page wiring ------------------
  // Job types (use Road Shoulder Spray)
  const taskTypeEl = $("#taskType");
  if (taskTypeEl) {
    // normalise options
    const opts = Array.from(taskTypeEl.options).map(o => o.value || o.textContent);
    if (!opts.includes("Road Shoulder Spray")) {
      // replace any "Road Spray" with "Road Shoulder Spray"
      $$("option", taskTypeEl).forEach(o => {
        const v = (o.value || o.textContent).trim();
        if (/^road\s*spray/i.test(v)) {
          o.value = "Road Shoulder Spray";
          o.textContent = "Road Shoulder Spray";
        }
      });
      // if not found at all, append
      if (![...taskTypeEl.options].some(o => (o.value||o.textContent) === "Road Shoulder Spray")) {
        const o = document.createElement("option");
        o.textContent = "Road Shoulder Spray";
        taskTypeEl.appendChild(o);
      }
    }
  }

  // Only show tracking block for Road Shoulder Spray
  const roadBlock = $("#roadTrackBlock");
  function syncTrackVis() {
    if (!taskTypeEl || !roadBlock) return;
    const v = (taskTypeEl.value || "").trim();
    roadBlock.style.display = (v === "Road Shoulder Spray") ? "block" : "none";
  }
  taskTypeEl?.addEventListener("change", syncTrackVis);
  syncTrackVis();

  // Date + single Start/Stop times
  const jobDateEl = $("#jobDate");
  if (jobDateEl && !jobDateEl.value) jobDateEl.value = todayISO();
  // Ensure only one set of time inputs exist and labelled
  let startTime = $("#startTime"), endTime = $("#endTime");
  if (!startTime) { startTime = document.createElement("input"); startTime.type="time"; startTime.id="startTime"; }
  if (!endTime)   { endTime   = document.createElement("input"); endTime.type="time"; endTime.id="endTime"; }
  // (labels already in HTML; ensure they read Start Time / End Time — user screenshot asked this)

  // Locate Me → road text
  const locBtn  = $("#locateBtn");
  const locRoad = $("#locRoad");
  let currentRoadText = "";
  locBtn?.addEventListener("click", () => {
    if (!navigator.geolocation) return toast("Enable location services");
    spin(true, "Locating…");
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
        const j = await r.json();
        currentRoadText = j.address?.road || j.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      } catch {
        currentRoadText = "Unknown Road";
      }
      if (locRoad) locRoad.textContent = currentRoadText;
      spin(false);
      toast("📍 Location set");
    }, (err) => { spin(false); toast("GPS failed: " + err.message); });
  });

  // Auto Name (RoadName + DDMMYYYY + _I/SS/RS)
  const TYPE_PREFIX = { "Inspection":"I", "Spot Spray":"SS", "Road Shoulder Spray":"RS" };
  $("#autoNameBtn")?.addEventListener("click", () => {
    const t = (taskTypeEl?.value || "Inspection").trim();
    const prefix = TYPE_PREFIX[t] || "I";
    const d = jobDateEl?.value ? new Date(jobDateEl.value) : new Date();
    const compact = formatDateAUCompact(d);
    const road = (currentRoadText || "Unknown").replace(/\s+/g, "");
    const name = `${road}${compact}_${prefix}`;
    const nameEl = $("#jobName"); if (nameEl) nameEl.value = name;
    toast("🪪 Name generated");
  });

  // Weather auto-fill
  $("#autoWeatherBtn")?.addEventListener("click", async () => {
    if (!navigator.geolocation) return toast("Enable location services");
    spin(true, "Weather…");
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;
        const r = await fetch(url);
        const j = await r.json();
        const c = j.current || j.current_weather || {};
        $("#temp").value     = (c.temperature_2m ?? c.temperature) ?? "";
        $("#wind").value     = (c.wind_speed_10m ?? c.windspeed) ?? "";
        $("#windDir").value  = (c.wind_direction_10m ?? c.winddirection ?? "") + (c.wind_direction_10m!=null || c.winddirection!=null ? "°" : "");
        $("#humidity").value = (c.relative_humidity_2m ?? 55) ?? "";
        $("#wxUpdated").textContent = "Updated @ " + nowTime();
        toast("🌦 Weather updated");
      } catch {
        toast("Weather unavailable");
      } finally {
        spin(false);
      }
    }, () => { spin(false); toast("Location not available"); });
  });

  // Weeds select: pin "Noxious Weeds (category)" at top, add "Other" at bottom
  function populateWeeds() {
    const sel = $("#weedSelect");
    if (!sel) return;
    sel.innerHTML = "";
    // top category entry
    const cat = document.createElement("option");
    cat.value = "Noxious Weeds (category)";
    cat.textContent = "🔺 Noxious Weeds (category)";
    sel.appendChild(cat);
    // separate noxious vs rest
    const nox = DB.weeds.filter(w => /noxious/i.test(w));
    const rest = DB.weeds.filter(w => !/noxious/i.test(w));
    nox.sort((a,b)=>a.localeCompare(b)).forEach(w => {
      const o = document.createElement("option");
      o.value = w; o.textContent = `⚠ ${w}`;
      sel.appendChild(o);
    });
    rest.sort((a,b)=>a.localeCompare(b)).forEach(w => {
      const o = document.createElement("option");
      o.value = w; o.textContent = w;
      sel.appendChild(o);
    });
    // bottom "Other"
    const oth = document.createElement("option");
    oth.value = "Other (specify in notes)";
    oth.textContent = "Other (specify in notes)";
    sel.appendChild(oth);
  }
  populateWeeds();

  // Reminder 0–52 weeks
  (function ensureReminder() {
    const sel = $("#reminderWeeks");
    if (!sel) return;
    sel.innerHTML = "";
    for (let i = 0; i <= 52; i++) {
      const o = document.createElement("option");
      o.value = i;
      o.textContent = i;
      sel.appendChild(o);
    }
  })();

  // Photo input → preview (dataURL)
  let photoDataURL = "";
  $("#photoInput")?.addEventListener("change", e => {
    const f = e.target.files?.[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      photoDataURL = String(rd.result || "");
      const img = $("#photoPreview");
      if (img) { img.src = photoDataURL; img.style.display = "block"; }
    };
    rd.readAsDataURL(f);
  });

  // ---------- Batch uses (multiple batches per job) ----------
  // UI: convert single #batchSelect into dynamic list with Add button
  (function mountBatchUsesUI() {
    const anchor = $("#batchSelect");
    if (!anchor) return;
    // wrap
    const wrap = document.createElement("div");
    wrap.id = "batchUsesWrap";
    wrap.className = "card";
    wrap.style.marginTop = ".4rem";
    wrap.innerHTML = `
      <div class="row spread">
        <strong>Batches used for this job</strong>
        <button type="button" class="pill" id="addBatchUseBtn">+ Add Batch Use</button>
      </div>
      <div id="batchUsesList" class="list" style="margin-top:.4rem;"></div>
      <div class="row end"><small class="dim">Tip: Add multiple batches if you changed mix during job.</small></div>
    `;
    // replace original select with our UI (keep the old around hidden in case CSS expects it)
    anchor.style.display = "none";
    anchor.parentElement.insertBefore(wrap, anchor.nextSibling);

    $("#addBatchUseBtn").onclick = () => showAddBatchUseSheet();
    renderBatchUsesTemp([]);
  })();

  // temp store before save
  let currentBatchUses = []; // [{batchId, amountL}]
  function renderBatchUsesTemp(arr) {
    currentBatchUses = arr.slice();
    const ul = $("#batchUsesList"); if (!ul) return;
    ul.innerHTML = "";
    if (!arr.length) {
      const d = document.createElement("div");
      d.className = "item"; d.textContent = "No batch usage added yet.";
      ul.appendChild(d); return;
    }
    arr.forEach((u, idx) => {
      const b = DB.batches.find(x => x.id === u.batchId);
      const name = b ? `${b.id} • ${formatDateAU(b.date)}` : u.batchId;
      const li = document.createElement("div");
      li.className = "item";
      li.innerHTML = `
        <div class="row spread">
          <div><b>${name}</b><br><small>${fmt(u.amountL)} L assigned</small></div>
          <div class="row gap">
            <button class="pill" data-edit="${idx}">Edit</button>
            <button class="pill warn" data-del="${idx}">Remove</button>
          </div>
        </div>`;
      ul.appendChild(li);
    });
    $$("[data-del]").forEach(btn => btn.onclick = () => {
      const i = Number(btn.dataset.del); currentBatchUses.splice(i,1);
      renderBatchUsesTemp(currentBatchUses);
    });
    $$("[data-edit]").forEach(btn => btn.onclick = () => {
      const i = Number(btn.dataset.edit);
      showAddBatchUseSheet(currentBatchUses[i], i);
    });
  }

  function showAddBatchUseSheet(existing = null, editIndex = -1) {
    // build modal
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="card p" style="max-width:420px;width:92%;">
        <h3>${existing ? "Edit Batch Use" : "Add Batch Use"}</h3>
        <label>Batch</label>
        <select id="__use_batch"></select>
        <label>Amount used (L)</label>
        <input id="__use_amount" type="number" min="0" step="0.01" placeholder="e.g. 120" />
        <div class="row gap end mt">
          <button class="pill" id="__use_save">${existing ? "Save" : "Add"}</button>
          <button class="pill warn" id="__use_cancel">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    // populate batches
    const sel = modal.querySelector("#__use_batch");
    sel.innerHTML = "";
    DB.batches.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).forEach(b=>{
      const o = document.createElement("option");
      o.value = b.id; o.textContent = `${b.id} • ${formatDateAU(b.date)} • remain ${fmt(b.remaining ?? b.mix)} L`;
      sel.appendChild(o);
    });
    if (existing) {
      sel.value = existing.batchId;
      modal.querySelector("#__use_amount").value = existing.amountL ?? "";
    }
    modal.querySelector("#__use_cancel").onclick = () => modal.remove();
    modal.querySelector("#__use_save").onclick = () => {
      const batchId = sel.value;
      const amountL = Number(modal.querySelector("#__use_amount").value || 0);
      if (!batchId || !isFinite(amountL) || amountL <= 0) return toast("Enter a valid amount");
      const obj = { batchId, amountL };
      if (editIndex >= 0) currentBatchUses[editIndex] = obj;
      else currentBatchUses.push(obj);
      renderBatchUsesTemp(currentBatchUses);
      modal.remove();
    };
  }

  // ---------- Save Task ----------
  $("#saveTask")?.addEventListener("click", () => saveTask(false));
  $("#saveDraft")?.addEventListener("click", () => saveTask(true));

  function saveTask(isDraft) {
    spin(true, "Saving…");
    const id = Date.now();
    const status = isDraft ? "Draft" : "Incomplete";
    const t = {
      id,
      name: ($("#jobName")?.value || "").trim() || ("Task_" + id),
      council: ($("#councilNum")?.value || "").trim(),
      linkedInspectionId: ($("#linkInspectionId")?.value || "").trim(),
      type: (taskTypeEl?.value || "Inspection").trim(),
      weed: ($("#weedSelect")?.value || ""),
      // legacy single batch field is deprecated; use batchUses array
      batchUses: currentBatchUses.slice(), // [{batchId, amountL}]
      date: (jobDateEl?.value || todayISO()),
      start: ($("#startTime")?.value || ""),
      end: ($("#endTime")?.value || ""),
      temp: ($("#temp")?.value || ""), wind: ($("#wind")?.value || ""), windDir: ($("#windDir")?.value || ""), humidity: ($("#humidity")?.value || ""),
      reminder: ($("#reminderWeeks")?.value || ""),
      status,
      notes: ($("#notes")?.value || ""),
      coords: (window.__trackCoords || []).slice(),
      photo: (photoDataURL || ""),
      createdAt: new Date().toISOString(),
      archived: false
    };

    // Upsert by name (edit flow)
    const idx = DB.tasks.findIndex(x => x.name === t.name);
    if (idx >= 0) DB.tasks[idx] = t; else DB.tasks.push(t);

    // consume batches (decrement remaining) based on assigned amounts
    t.batchUses.forEach(u => {
      const b = DB.batches.find(x => x.id === u.batchId);
      if (!b) return;
      const use = Number(u.amountL || 0);
      b.used = Number(b.used || 0) + use;
      const tot = Number(b.mix || 0);
      b.remaining = Math.max(0, tot - Number(b.used || 0));
    });

    saveDB();
    // refresh UI
    renderRecords(); renderBatches(); renderProcurement();
    spin(false);
    toast(isDraft ? "Draft saved" : "Task saved");
  }

  // ---------- Roadside Tracking ----------
  let trackTimer = null;
  window.__trackCoords = [];
  $("#startTrack")?.addEventListener("click", () => {
    window.__trackCoords = [];
    if (!navigator.geolocation) return toast("Enable location services");
    toast("Tracking started");
    trackTimer = setInterval(() =>
      navigator.geolocation.getCurrentPosition(p => {
        window.__trackCoords.push([p.coords.latitude, p.coords.longitude]);
        $("#trackStatus").textContent = `Tracking… (${window.__trackCoords.length})`;
      }), 5000);
  });
  $("#stopTrack")?.addEventListener("click", () => {
    if (trackTimer) clearInterval(trackTimer);
    $("#trackStatus").textContent = `Stopped (${window.__trackCoords.length} pts)`;
    localStorage.setItem("lastTrack", JSON.stringify(window.__trackCoords));
    toast("Tracking stopped");
  });

  // ------------------ Records ------------------
  // Unified filters: name/road/weed/date/jobtype/status
  $("#recSearchBtn")?.addEventListener("click", renderRecords);
  $("#recResetBtn")?.addEventListener("click", () => {
    $("#recSearch").value = "";
    $("#recFrom").value = "";
    $("#recTo").value = "";
    ["fInspection","fSpot","fRoad","fComplete","fIncomplete","fDraft"].forEach(id => { const el=$("#"+id); if(el) el.checked=false; });
    renderRecords();
  });

  function matchesRecord(t, q, from, to, types, statuses) {
    if (t.archived) return false;
    if (from && (t.date || "") < from) return false;
    if (to   && (t.date || "") > to) return false;

    // type filter
    const vType = t.type;
    const tEmpty = !types.inspection && !types.spot && !types.road;
    const tOK = tEmpty ||
                (vType === "Inspection" && types.inspection) ||
                (vType === "Spot Spray" && types.spot) ||
                (vType === "Road Shoulder Spray" && types.road);
    if (!tOK) return false;

    // status
    const s = t.status || "Incomplete";
    const sEmpty = !statuses.complete && !statuses.incomplete && !statuses.draft;
    const sOK = sEmpty ||
                (s === "Complete" && statuses.complete) ||
                (s === "Incomplete" && statuses.incomplete) ||
                (s === "Draft" && statuses.draft);
    if (!sOK) return false;

    // search by name / road / weed / council
    if (q) {
      const hay = `${t.name} ${t.weed} ${t.council}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }

  function renderRecords() {
    const list = $("#recordsList"); if (!list) return;
    list.innerHTML = "";
    const q = ($("#recSearch")?.value || "").trim();
    const from = $("#recFrom")?.value || "";
    const to   = $("#recTo")?.value || "";
    const types = {
      inspection: $("#fInspection")?.checked,
      spot:       $("#fSpot")?.checked,
      road:       $("#fRoad")?.checked
    };
    const statuses = {
      complete:   $("#fComplete")?.checked,
      incomplete: $("#fIncomplete")?.checked,
      draft:      $("#fDraft")?.checked
    };

    DB.tasks
      .filter(t => matchesRecord(t, q, from, to, types, statuses))
      .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
      .forEach(t => {
        const totalAssigned = (t.batchUses||[]).reduce((s,u)=>s + Number(u.amountL||0), 0);
        const div = document.createElement("div");
        div.className = "item";
        div.innerHTML = `
          <b>${t.name}</b>
          <br><small>${t.type} • ${formatDateAU(t.date)} • ${t.status}</small>
          <br><small><b>Assigned:</b> ${fmt(totalAssigned)} L</small>
          <div class="row end" style="margin-top:.35rem;">
            <button class="pill" data-open="${t.id}">Open</button>
            ${t.coords?.length ? `<button class="pill" data-nav="${t.id}">Navigate</button>` : ""}
          </div>`;
        list.appendChild(div);

        div.querySelector(`[data-open="${t.id}"]`)?.addEventListener("click", () => showJobPopup(t));
        const navBtn = div.querySelector(`[data-nav="${t.id}"]`);
        if (navBtn) navBtn.addEventListener("click", () => {
          const pt = t.coords?.[0]; if (!pt) return toast("No coords saved");
          openAppleMaps(pt[0], pt[1]);
        });
      });
  }

  // ------------------ Batches ------------------
  // One big modal for creating a batch: date/time stamp, total mix, chemicals from inventory with units per 100 L and auto totals
  $("#batSearchBtn")?.addEventListener("click", renderBatches);
  $("#batResetBtn")?.addEventListener("click", () => {
    $("#batFrom").value = ""; $("#batTo").value = ""; renderBatches();
  });
  $("#newBatch")?.addEventListener("click", openCreateBatchModal);

  function renderBatches() {
    const list = $("#batchList"); if (!list) return;
    list.innerHTML = "";
    const from = $("#batFrom")?.value || "";
    const to   = $("#batTo")?.value || "";

    DB.batches
      .filter(b => (!from || b.date >= from) && (!to || b.date <= to))
      .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
      .forEach(b => {
        const consumed = Number(b.used || 0);
        const remain   = Number(b.remaining != null ? b.remaining : (Number(b.mix||0) - consumed));
        const item = document.createElement("div");
        item.className = "item";
        item.style.border = remain <= 0 ? "2px solid #b30000" : ""; // red ring when zero remain
        item.innerHTML = `
          <b>${b.id}</b><br>
          <small>${formatDateAU(b.date)} ${b.time || ""} • Total ${fmt(b.mix)} L • Remaining ${fmt(remain)} L</small>
          <div class="row end" style="margin-top:.35rem;">
            <button class="pill" data-open="${b.id}">Open</button>
          </div>`;
        list.appendChild(item);
        item.querySelector(`[data-open="${b.id}"]`)?.addEventListener("click", () => openBatchDetails(b));
      });
  }

  function openCreateBatchModal() {
    const m = document.createElement("div");
    m.className = "modal";
    m.innerHTML = `
      <div class="card p scrollable" style="max-width:520px;width:94%">
        <h3>Create Batch</h3>
        <div class="grid two">
          <div><label>Date</label><input id="nb_date" type="date" value="${todayISO()}"></div>
          <div><label>Time</label><input id="nb_time" type="time" value="${nowTime()}"></div>
        </div>
        <label>Total mix (L)</label>
        <input id="nb_mix" type="number" min="0" step="0.1" placeholder="e.g. 800">

        <div class="form-section">
          <div class="row spread">
            <div class="form-title">Chemicals</div>
            <button class="pill" id="nb_addchem">+ Add Chemical</button>
          </div>
          <div id="nb_chem_list" class="list"></div>
        </div>

        <div class="row gap end">
          <button class="pill" id="nb_save">Create Batch</button>
          <button class="pill warn" id="nb_cancel">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(m);

    let chemRows = []; // [{name, unit, per100, total}]
    function renderChemRows() {
      const list = $("#nb_chem_list"); list.innerHTML = "";
      const mix = Number($("#nb_mix").value || 0);
      chemRows.forEach((c, idx) => {
        const total = mix > 0 ? (c.per100 * mix / 100) : 0;
        c.total = total;
        const row = document.createElement("div");
        row.className = "item";
        row.innerHTML = `
          <div class="grid two">
            <div>
              <label>Chemical</label>
              <select data-name="${idx}" class="__chem_name"></select>
            </div>
            <div>
              <label>Unit</label>
              <select data-unit="${idx}" class="__chem_unit">
                <option>L</option><option>mL</option><option>g</option><option>kg</option>
              </select>
            </div>
          </div>
          <div class="grid two">
            <div>
              <label>Amount per 100 L</label>
              <input data-per100="${idx}" class="__chem_per100" type="number" min="0" step="0.01" value="${c.per100}">
            </div>
            <div>
              <label>Total (auto)</label>
              <input value="${fmt(total,2)}" disabled>
            </div>
          </div>
          <div class="row end mt-2"><button class="pill warn" data-del="${idx}">Remove</button></div>
        `;
        list.appendChild(row);
      });
      // populate names & values
      $$(".__chem_name", list).forEach(sel => {
        const idx = Number(sel.getAttribute("data-name"));
        sel.innerHTML = "";
        DB.chems.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach(c=>{
          const o = document.createElement("option");
          o.value = c.name; o.textContent = `${c.name} — ${c.active||""}`;
          sel.appendChild(o);
        });
        sel.value = chemRows[idx].name || (DB.chems[0]?.name || "");
        sel.onchange = () => { chemRows[idx].name = sel.value; };
      });
      $$(".__chem_unit", list).forEach(sel => {
        const idx = Number(sel.getAttribute("data-unit"));
        sel.value = chemRows[idx].unit || "L";
        sel.onchange = () => { chemRows[idx].unit = sel.value; renderChemRows(); };
      });
      $$(".__chem_per100", list).forEach(inp => {
        const idx = Number(inp.getAttribute("data-per100"));
        inp.oninput = () => { chemRows[idx].per100 = Number(inp.value || 0); renderChemRows(); };
      });
      $$("[data-del]", list).forEach(btn => btn.onclick = () => {
        const idx = Number(btn.dataset.del); chemRows.splice(idx,1); renderChemRows();
      });
    }

    $("#nb_addchem").onclick = () => { chemRows.push({name: DB.chems[0]?.name || "", unit:"L", per100:0, total:0}); renderChemRows(); };
    $("#nb_mix").oninput = renderChemRows;
    renderChemRows();

    $("#nb_cancel").onclick = () => m.remove();
    $("#nb_save").onclick = () => {
      const id = "B" + Date.now();
      const date = $("#nb_date").value || todayISO();
      const time = $("#nb_time").value || nowTime();
      const mix = Number($("#nb_mix").value || 0);
      if (!mix || mix <= 0) return toast("Enter total mix (L)");
      if (!chemRows.length) return toast("Add at least one chemical");

      const batch = {
        id, date, time,
        mix,
        used: 0,
        remaining: mix,
        chemicals: chemRows.map(c => ({
          name: c.name, unit: c.unit,
          per100: c.per100, total: Number((c.per100 * mix / 100) || 0)
        })),
        linkedJobs: [],
        dumped: []
      };
      DB.batches.push(batch);
      saveDB();
      m.remove();
      renderBatches();
      toast("Batch created");
    };
  }

  function openBatchDetails(b) {
    const used = Number(b.used || 0);
    const remain = Number(b.remaining != null ? b.remaining : (Number(b.mix||0) - used));
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="card p scrollable" style="max-width:520px;width:94%">
        <div class="row spread">
          <h3 style="margin:0">${b.id}</h3>
          <button class="pill warn" data-close>Close</button>
        </div>
        <p><b>Date:</b> ${formatDateAU(b.date)} ${b.time || ""}</p>
        <p><b>Total Mix:</b> ${fmt(b.mix)} L</p>
        <p><b>Remaining:</b> ${fmt(remain)} L</p>
        <h4>Chemicals</h4>
        <ul>${(b.chemicals||[]).map(c => `<li>${c.name} — ${fmt(c.per100)} ${c.unit}/100 L → total ${fmt(c.total,2)} ${c.unit}</li>`).join("")}</ul>
        <h4>Linked Jobs</h4>
        ${DB.tasks.filter(t => (t.batchUses||[]).some(u => u.batchId === b.id)).map(t => `<div>• ${t.name}</div>`).join("") || "—"}
        <h4>Dumped</h4>
        ${b.dumped?.length ? `<ul>${b.dumped.map(d=>`<li>${d.date} ${d.time} — ${fmt(d.amount)} L (${d.reason})</li>`).join("")}</ul>` : "—"}
        <div class="row gap end mt">
          <button class="pill" data-dump>Dump Remaining</button>
          <button class="pill" data-edit>Edit</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target.dataset.close != null || e.target === modal) modal.remove();
    });

    modal.querySelector("[data-dump]").onclick = () => {
      const amt = Number(prompt("Dump how many litres?", remain)) || 0;
      if (amt <= 0 || amt > (b.remaining ?? remain)) return toast("Invalid amount");
      const reason = prompt("Reason for dump?", "Expired or leftover") || "—";
      b.used = Number(b.used || 0) + amt;
      b.remaining = Math.max(0, Number(b.mix || 0) - Number(b.used || 0));
      b.dumped = b.dumped || [];
      b.dumped.push({ date: todayISO(), time: nowTime(), amount: amt, reason });
      saveDB(); modal.remove(); renderBatches(); toast("Batch updated");
    };

    modal.querySelector("[data-edit]").onclick = () => {
      const mix = Number(prompt("Total mix (L):", b.mix)) || b.mix;
      const rem = Number(prompt("Remaining (L):", b.remaining ?? remain)) || (b.remaining ?? remain);
      const chemText = prompt("Chemicals (display only)", (b.chemicals||[]).map(c=>`${c.name} ${c.per100}${c.unit}/100L`).join(", ")) || "";
      b.mix = mix; b.remaining = rem; b._chemText = chemText;
      saveDB(); modal.remove(); renderBatches();
    };
  }

  // ------------------ Inventory ------------------
  $("#addChem")?.addEventListener("click", () => {
    const name = prompt("Chemical name:"); if (!name) return;
    const active = prompt("Active ingredient:","") || "";
    const size = Number(prompt("Container size (number):", "20")) || 0;
    const unit = prompt("Unit (L, mL, g, kg):","L") || "L";
    const count = Number(prompt("How many containers:", "0")) || 0;
    const thr = Number(prompt("Reorder threshold (containers):", "0")) || 0;
    DB.chems.push({ name, active, containerSize:size, containerUnit:unit, containers:count, threshold:thr });
    saveDB(); renderChems(); renderProcurement();
  });

  function renderChems() {
    const list = $("#chemList"); if (!list) return;
    list.innerHTML = "";

    // Unified search block injection (if not present)
    if (!$("#invSearchBlock")) {
      const block = document.createElement("div");
      block.className = "filters";
      block.id = "invSearchBlock";
      block.innerHTML = `
        <input id="invSearch" placeholder="Search (name / active / road / date / job type)">
        <button id="invSearchBtn">Search</button>
        <button id="invResetBtn">Reset</button>
      `;
      list.parentElement.insertBefore(block, list);
      $("#invSearchBtn").onclick = renderChems;
      $("#invResetBtn").onclick = () => { $("#invSearch").value=""; renderChems(); };
    }

    const q = ($("#invSearch")?.value || "").toLowerCase().trim();
    DB.chems
      .filter(c => !q || `${c.name} ${c.active}`.toLowerCase().includes(q))
      .sort((a,b)=>a.name.localeCompare(b.name))
      .forEach(c => {
        const total = (c.containers||0) * (c.containerSize||0);
        const card = document.createElement("div");
        card.className = "item";
        card.innerHTML = `
          <b>${c.name}</b><br>
          <small>${c.containers||0} × ${fmt(c.containerSize)} ${c.containerUnit} • total ${fmt(total)} ${c.containerUnit}</small><br>
          <small>Active: ${c.active || "—"}</small>
          <div class="row gap end" style="margin-top:.35rem;">
            <button class="pill" data-edit>Open</button>
            <button class="pill warn" data-del>Delete</button>
          </div>`;
        list.appendChild(card);

        card.querySelector("[data-edit]").onclick = () => openChemSheet(c);
        card.querySelector("[data-del]").onclick = () => {
          if (!confirm("Delete chemical?")) return;
          DB.chems = DB.chems.filter(x=>x!==c);
          saveDB(); renderChems(); renderProcurement();
        };
      });
  }

  let _chemEditing = null;
  function openChemSheet(c) {
    _chemEditing = c;
    const sheet = $("#chemEditSheet");
    if (!sheet) return;
    $("#ce_name").value = c.name || "";
    $("#ce_active").value = c.active || "";
    $("#ce_size").value = c.containerSize || 0;
    $("#ce_unit").value = c.containerUnit || "L";
    $("#ce_count").value = c.containers || 0;
    $("#ce_threshold").value = c.threshold || 0;
    sheet.style.display = "block";
  }
  $("#ce_cancel")?.addEventListener("click", () => { $("#chemEditSheet").style.display="none"; _chemEditing = null; });
  $("#ce_save")?.addEventListener("click", () => {
    if (!_chemEditing) return;
    _chemEditing.name = $("#ce_name").value.trim();
    _chemEditing.active = $("#ce_active").value.trim();
    _chemEditing.containerSize = Number($("#ce_size").value)||0;
    _chemEditing.containerUnit = $("#ce_unit").value||"L";
    _chemEditing.containers = Number($("#ce_count").value)||0;
    _chemEditing.threshold  = Number($("#ce_threshold").value)||0;
    saveDB(); $("#chemEditSheet").style.display="none"; _chemEditing = null;
    renderChems(); renderProcurement(); toast("Chemical updated");
  });

  function renderProcurement() {
    const ul = $("#procList"); if (!ul) return;
    ul.innerHTML = "";
    DB.chems.forEach(c => {
      if (c.threshold && (c.containers||0) < c.threshold) {
        const li = document.createElement("li");
        li.textContent = `Low stock: ${c.name} (${c.containers||0} < ${c.threshold})`;
        ul.appendChild(li);
      }
    });
  }

  // ------------------ Mapping ------------------
  let mapInstance;
  function ensureMap() {
    if (mapInstance) return mapInstance;
    const el = $("#map"); if (!el) return null;
    mapInstance = L.map(el).setView([-34.75,148.65], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(mapInstance);

    // locate-me button (top-right)
    const ctrl = L.control({position:"topright"});
    ctrl.onAdd = () => {
      const d = L.DomUtil.create("div","leaflet-bar");
      d.style.background = "#145c38"; d.style.color = "#fff"; d.style.padding = "6px 10px";
      d.style.borderRadius = "6px"; d.style.cursor = "pointer";
      d.textContent = "Locate Me";
      d.onclick = () => {
        if (!navigator.geolocation) return toast("Enable location");
        navigator.geolocation.getCurrentPosition(p => {
          const pt = [p.coords.latitude, p.coords.longitude];
          mapInstance.setView(pt, 14);
          L.circleMarker(pt, {radius:7, opacity:.95}).addTo(mapInstance).bindPopup("You are here").openPopup();
        });
      };
      return d;
    };
    ctrl.addTo(mapInstance);
    return mapInstance;
  }
  $("#mapSearchBtn")?.addEventListener("click", ()=>renderMap(true));
  $("#mapResetBtn")?.addEventListener("click", ()=>{
    $("#mapFrom").value=""; $("#mapTo").value=""; $("#mapWeed").value="";
    const sel = $("#mapType"); if (sel) sel.value = "All";
    renderMap(true);
  });

  function openAppleMaps(lat, lon) {
    const mapsURL = `maps://?daddr=${lat},${lon}&dirflg=d`;
    const webURL  = `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
    const a = document.createElement("a");
    a.href = mapsURL; document.body.appendChild(a); a.click();
    setTimeout(()=>{ window.open(webURL,"_blank"); a.remove(); }, 300);
  }

  function renderMap(fit = false) {
    const m = ensureMap(); if (!m) return;
    m.eachLayer(l => { if (!(l instanceof L.TileLayer)) m.removeLayer(l); });

    const from = $("#mapFrom")?.value || "";
    const to   = $("#mapTo")?.value || "";
    const weedQ = ($("#mapWeed")?.value || "").trim().toLowerCase();
    const typ = $("#mapType")?.value || "All";

    const tasks = DB.tasks
      .filter(t => !t.archived)
      .filter(t => (!from || t.date >= from) && (!to || t.date <= to))
      .filter(t => (typ === "All") ? true : t.type === typ)
      .filter(t => weedQ ? String(t.weed||"").toLowerCase().includes(weedQ) : true);

    const group = L.featureGroup();
    tasks.forEach(t => {
      // polyline if we have coords
      if (t.coords?.length > 1) {
        group.addLayer(L.polyline(t.coords, { color: "yellow", weight: 4, opacity: .9 }));
      }
      const pt = t.coords?.[0] || [-34.75 + Math.random()*0.08, 148.65 + Math.random()*0.08];
      const openId = `open_${t.id}`;
      const navId  = `nav_${t.id}`;
      const popup = `
        <b>${t.name}</b><br>${t.type} • ${formatDateAU(t.date)}
        <br><button id="${openId}" class="pill" style="margin-top:.35rem">Open</button>
        <button id="${navId}" class="pill" style="margin-top:.35rem;margin-left:.4rem">Navigate</button>`;
      const marker = L.marker(pt);
      marker.bindPopup(popup);
      marker.on("popupopen", () => {
        setTimeout(() => {
          const ob = document.getElementById(openId);
          const nb = document.getElementById(navId);
          const taskRef = DB.tasks.find(x => x.id === t.id);
          if (ob) ob.onclick = () => showJobPopup(taskRef);
          if (nb) nb.onclick = () => openAppleMaps(pt[0], pt[1]);
        }, 0);
      });
      group.addLayer(marker);
    });

    group.addTo(m);
    if (fit && tasks.length) {
      try { m.fitBounds(group.getBounds().pad(0.2)); } catch {}
    }

    // draw last tracked line
    try {
      const last = JSON.parse(localStorage.getItem("lastTrack") || "[]");
      if (Array.isArray(last) && last.length > 1)
        L.polyline(last, { color:"#ffda44", weight:3, opacity:.8 }).addTo(m);
    } catch {}
  }

  // ------------------ Popups (Job) ------------------
  document.addEventListener("keydown", e => { if (e.key === "Escape") { const m = $(".modal"); if (m) m.remove(); } });

  function showJobPopup(t) {
    const photoHtml = t.photo ? `<div style="margin:.4rem 0"><img src="${t.photo}" alt="photo" style="max-width:100%;border-radius:8px"/></div>` : "";
    const totalAssigned = (t.batchUses||[]).reduce((s,u)=>s + Number(u.amountL||0), 0);
    const html = `
      <div class="modal">
        <div class="card p">
          <h3 style="margin-top:0">${t.name}</h3>
          <div class="grid two tight">
            <div><b>Type:</b> ${t.type}</div><div><b>Status:</b> ${t.status}</div>
            <div><b>Date:</b> ${formatDateAU(t.date)}</div>
            <div><b>Start:</b> ${t.start||"–"} · <b>Stop:</b> ${t.end||"–"}</div>
            <div><b>Weed:</b> ${t.weed||"—"}</div>
            <div><b>Assigned total:</b> ${fmt(totalAssigned)} L</div>
            <div class="span2"><b>Weather:</b> ${fmt(t.temp)}°C, ${fmt(t.wind)} km/h, ${t.windDir||"–"}, ${fmt(t.humidity)}%</div>
            <div class="span2"><b>Notes:</b> ${t.notes||"—"}</div>
          </div>
          ${t.batchUses?.length ? `<h4 style="margin:.6rem 0 .2rem 0">Batch Uses</h4>
            <ul>${t.batchUses.map(u => `<li>${u.batchId} — ${fmt(u.amountL)} L</li>`).join("")}</ul>` : ""}
          ${photoHtml}
          <div class="row gap end" style="margin-top:.8rem;">
            ${t.coords?.length ? `<button class="pill" data-nav>Navigate</button>` : ""}
            <button class="pill" data-edit>Edit</button>
            <button class="pill warn" data-close>Close</button>
          </div>
        </div>
      </div>`;
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstChild);
    const modal = $(".modal");
    modal.addEventListener("click", (e) => { if (e.target === modal || e.target.dataset.close != null) modal.remove(); });
    $("[data-edit]", modal)?.addEventListener("click", () => {
      switchScreen("createTask");
      // populate edit
      $("#jobName").value = t.name;
      $("#councilNum").value = t.council || "";
      $("#linkInspectionId").value = t.linkedInspectionId || "";
      taskTypeEl.value = t.type; taskTypeEl.dispatchEvent(new Event("change"));
      $("#weedSelect").value = t.weed || "";
      jobDateEl.value = t.date || todayISO();
      $("#startTime").value = t.start || "";
      $("#endTime").value = t.end || "";
      $("#temp").value = t.temp || "";
      $("#wind").value = t.wind || "";
      $("#windDir").value = t.windDir || "";
      $("#humidity").value = t.humidity || "";
      $("#notes").value = t.notes || "";
      // batch uses
      renderBatchUsesTemp((t.batchUses || []).slice());
      modal.remove();
    });
    $("[data-nav]", modal)?.addEventListener("click", () => {
      const pt = t.coords?.[0]; if (!pt) return toast("No coords saved");
      openAppleMaps(pt[0], pt[1]);
    });
  }

  // Initial renders where relevant
  if ($(".screen.active")?.id === "records") renderRecords();
  if ($(".screen.active")?.id === "batches") renderBatches();
  if ($(".screen.active")?.id === "inventory") renderChems();
  if ($(".screen.active")?.id === "mapping") renderMap(true);
  if ($(".screen.active")?.id === "procurement") renderProcurement();

})();
