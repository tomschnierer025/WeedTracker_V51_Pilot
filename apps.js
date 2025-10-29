/* =========================================================
   WeedTracker V60 Pilot — apps.js (FULL)
   ---------------------------------------------------------
   • AU date format everywhere (DD-MM-YYYY for display)
   • Task flow: Task Type → Location → Auto-Name → Date/Weather → Weed → Batch → Times → Notes → Reminder → Save
   • Task types: Inspection / Spot Spray / Road Shoulder Spray
   • Roadside tracking Start/Stop only for Road Shoulder Spray
   • “Noxious Weeds (category)” pinned to top + ⚠ markers; “Other (Manual Entry)” at bottom
   • Apple Maps deep-link from records list + map pins
   • Records / Batches / Mapping / Inventory share the same search-filter pattern
   • Batches: single big modal to create/edit, select chems from Inventory, per-100L rates (L, mL, g, kg), totals auto
   • Batch popup shows date/time, chemicals, linked jobs, remaining; supports Dump w/ reason; red border if empty
   • Inventory + Procurement integration (threshold alerts)
   • Spinner + toast; home button routes correctly
   • LocalStorage via WeedStorage (storage.js)
   • Helpers via WeedExtras (extras.js)
   ========================================================= */

(function () {
  // ----------------------------
  // Shortcuts & Helpers
  // ----------------------------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const pad = (n) => String(n).padStart(2, "0");
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const nowTime = () => {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const fmt = (n, d = 0) => (n == null || n === "" || isNaN(n) ? "–" : Number(n).toFixed(d));

  const AU = {
    format(d) {
      const dt = d instanceof Date ? d : new Date(d);
      return `${pad(dt.getDate())}-${pad(dt.getMonth() + 1)}-${dt.getFullYear()}`;
    },
    compact(d) {
      const dt = d instanceof Date ? d : new Date(d);
      return `${pad(dt.getDate())}${pad(dt.getMonth() + 1)}${dt.getFullYear()}`;
    },
  };

  // ----------------------------
  // Global state
  // ----------------------------
  let DB = WeedStorage.load();
  // Ensure keys
  DB.tasks ??= [];
  DB.batches ??= [];
  DB.chems ??= [];
  DB.procurement ??= [];
  DB.weeds ??= [];

  // Seed chemicals minimal if empty (user can edit later)
  if (!DB.chems.length) {
    DB.chems = [
      { name: "Crucial", active: "Glyphosate 540 g/L", containerSize: 20, containerUnit: "L", containers: 4, threshold: 2 },
      { name: "SuperWet", active: "Non-ionic surfactant", containerSize: 20, containerUnit: "L", containers: 1, threshold: 1 },
      { name: "Bow Saw 600", active: "Triclopyr 600 g/L", containerSize: 1, containerUnit: "L", containers: 2, threshold: 1 },
      { name: "Hastings", active: "MCPA", containerSize: 20, containerUnit: "L", containers: 1, threshold: 1 },
      { name: "Outright", active: "Fluroxypyr", containerSize: 20, containerUnit: "L", containers: 1, threshold: 1 },
      { name: "Bosol", active: "Metsulfuron-methyl", containerSize: 0.5, containerUnit: "kg", containers: 1, threshold: 1 },
    ];
  }

  // Seed weeds including "Cape Broom" + category pins
  const DEFAULT_WEEDS = [
    "African Lovegrass (noxious)",
    "Blackberry (noxious)",
    "Serrated Tussock (noxious)",
    "Cape Broom (noxious)",
    "Chilean Needle Grass (noxious)",
    "St John’s Wort (noxious)",
    "Sweet Briar (noxious)",
    "Gorse (noxious)",
    "Fleabane",
    "Horehound",
    "Saffron Thistle",
    "Wild Radish",
    "Fountain Grass",
  ];
  if (!DB.weeds.length) DB.weeds = DEFAULT_WEEDS.slice();

  const saveDB = () => WeedStorage.save(DB);

  // ----------------------------
  // UI Pieces: spinner & toast
  // ----------------------------
  const spinner = $("#spinner");
  const spin = (msg = "Working…") => {
    if (spinner) {
      spinner.setAttribute("data-msg", msg);
      spinner.classList.add("active");
    }
  };
  const stopSpin = () => spinner && spinner.classList.remove("active");

  function toast(msg, ms = 1800) {
    const d = document.createElement("div");
    d.className = "toastSummary";
    d.textContent = msg;
    Object.assign(d.style, {
      position: "fixed",
      bottom: "18px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#d9f7d9",
      color: "#063",
      padding: ".6rem 1rem",
      borderRadius: "20px",
      boxShadow: "0 2px 8px rgba(0,0,0,.25)",
      fontWeight: 800,
      zIndex: 99999,
    });
    document.body.appendChild(d);
    setTimeout(() => d.remove(), ms);
  }

  // ----------------------------
  // Navigation
  // ----------------------------
  const screens = $$(".screen");
  function showScreen(id) {
    screens.forEach((s) => s.classList.remove("active"));
    const el = document.getElementById(id);
    if (el) el.classList.add("active");
    if (id === "records") renderRecords();
    if (id === "batches") renderBatches();
    if (id === "inventory") renderChems();
    if (id === "procurement") renderProcurement();
    if (id === "mapping") renderMap(true);
  }
  $$("[data-target]").forEach((b) => b.addEventListener("click", () => showScreen(b.dataset.target)));
  $$(".home-btn").forEach((b) => b.addEventListener("click", () => showScreen("home")));

  // ----------------------------
  // Create Task: controls & population
  // ----------------------------
  const TYPE_PREFIX = { "Inspection": "I", "Spot Spray": "SS", "Road Shoulder Spray": "RS" };

  const taskType = $("#taskType");
  if (taskType) {
    // Patch the select to ensure correct names
    taskType.innerHTML = `<option>Inspection</option><option>Spot Spray</option><option>Road Shoulder Spray</option>`;
  }

  // Date & times, labels
  const jobDate = $("#jobDate");
  const startTime = $("#startTime");
  const endTime = $("#endTime");
  if (jobDate) jobDate.value = todayISO();
  const hhmm = nowTime();
  if (startTime) startTime.value = hhmm;
  if (endTime) endTime.value = hhmm;

  // Reminder weeks 0..52
  const reminderSel = $("#reminderWeeks");
  if (reminderSel && !reminderSel.options.length) {
    for (let i = 0; i <= 52; i++) {
      const o = document.createElement("option");
      o.value = i;
      o.textContent = `${i} week${i !== 1 ? "s" : ""}`;
      reminderSel.appendChild(o);
    }
  }

  // Weed dropdown with Noxious grouping and Other
  const weedSelect = $("#weedSelect");
  function populateWeeds() {
    if (!weedSelect) return;

    // Prepare lists
    const nox = DB.weeds.filter((w) => /noxious/i.test(w)).sort((a, b) => a.localeCompare(b));
    const rest = DB.weeds.filter((w) => !/noxious/i.test(w)).sort((a, b) => a.localeCompare(b));

    weedSelect.innerHTML = "";
    // Prompt
    const o0 = document.createElement("option");
    o0.value = "";
    o0.textContent = "— Select Weed —";
    weedSelect.appendChild(o0);

    // Category header
    const cat = document.createElement("option");
    cat.value = "Noxious Weeds (category)";
    cat.textContent = "🔺 Noxious Weeds (category)";
    weedSelect.appendChild(cat);

    // Noxious with ⚠
    nox.forEach((w) => {
      const o = document.createElement("option");
      o.value = w;
      o.textContent = `⚠ ${w}`;
      weedSelect.appendChild(o);
    });

    // Others
    rest.forEach((w) => {
      const o = document.createElement("option");
      o.value = w;
      o.textContent = w;
      weedSelect.appendChild(o);
    });

    // Manual
    const oX = document.createElement("option");
    oX.value = "Other (Manual Entry)";
    oX.textContent = "Other (Manual Entry)";
    weedSelect.appendChild(oX);
  }
  populateWeeds();

  // Batch dropdown
  const batchSelect = $("#batchSelect");
  function populateBatchSelect() {
    if (!batchSelect) return;
    batchSelect.innerHTML = "";
    const def = document.createElement("option");
    def.value = "";
    def.textContent = "— Select Batch —";
    batchSelect.appendChild(def);
    DB.batches
      .slice()
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .forEach((b) => {
        const o = document.createElement("option");
        o.value = b.id;
        const remain = b.remaining ?? b.mix ?? 0;
        o.textContent = `${b.id} • ${AU.format(b.date || todayISO())} • remain ${fmt(remain)} L`;
        batchSelect.appendChild(o);
      });
  }
  populateBatchSelect();

  // Roadside tracking visibility
  const roadTrackBlock = $("#roadTrackBlock");
  function syncTrackVis() {
    if (!roadTrackBlock || !taskType) return;
    roadTrackBlock.style.display = taskType.value === "Road Shoulder Spray" ? "block" : "none";
  }
  taskType?.addEventListener("change", syncTrackVis);
  syncTrackVis();

  // Locate Me (records location in #locRoad)
  const locateBtn = $("#locateBtn");
  const locRoad = $("#locRoad");
  let lastCoords = null;
  locateBtn?.addEventListener("click", async () => {
    spin("Getting GPS…");
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true }));
      lastCoords = [pos.coords.latitude, pos.coords.longitude];
      // Derive road via reverse geocode (best-effort)
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`
        );
        const j = await r.json();
        const road = j.address?.road || j.display_name || `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
        locRoad.textContent = road;
      } catch {
        locRoad.textContent = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
      }
      toast("📍 Location set");
    } catch (e) {
      alert("Location failed. Enable permissions.");
    } finally {
      stopSpin();
    }
  });

  // Auto Name (Road + DDMMYYYY + _I/SS/RS)
  const autoNameBtn = $("#autoNameBtn");
  const jobName = $("#jobName");
  autoNameBtn?.addEventListener("click", () => {
    const t = taskType?.value || "Inspection";
    const prefix = TYPE_PREFIX[t] || "I";
    const dt = jobDate?.value ? new Date(jobDate.value) : new Date();
    const dcompact = AU.compact(dt); // DDMMYYYY
    const road = (locRoad?.textContent || "Unknown").replace(/\s+/g, "");
    jobName.value = `${road}${dcompact}_${prefix}`;
  });

  // Weather (Open-Meteo) via extras
  $("#autoWeatherBtn")?.addEventListener("click", () => WeedExtras.getWeather());

  // Photo
  let photoDataURL = "";
  $("#photoInput")?.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      photoDataURL = String(fr.result || "");
      const img = $("#photoPreview");
      img.src = photoDataURL;
      img.style.display = "block";
    };
    fr.readAsDataURL(f);
  });

  // Roadside tracking (coords sampling)
  let tracking = false;
  let trackTimer = null;
  let trackCoords = [];
  $("#startTrack")?.addEventListener("click", () => {
    if (!navigator.geolocation) return alert("Location unavailable.");
    trackCoords = [];
    tracking = true;
    $("#trackStatus").textContent = "Tracking…";
    trackTimer && clearInterval(trackTimer);
    trackTimer = setInterval(() => {
      navigator.geolocation.getCurrentPosition((p) => {
        trackCoords.push([p.coords.latitude, p.coords.longitude]);
      });
    }, 5000);
  });
  $("#stopTrack")?.addEventListener("click", () => {
    tracking = false;
    trackTimer && clearInterval(trackTimer);
    $("#trackStatus").textContent = `Stopped (${trackCoords.length} pts)`;
    try {
      localStorage.setItem("lastTrack", JSON.stringify(trackCoords));
    } catch {}
  });

  // Save Task & Draft
  function collectTask(status) {
    return {
      id: Date.now(),
      name: (jobName?.value || "").trim() || `Task_${Date.now()}`,
      council: ($("#councilNum")?.value || "").trim(),
      linkedInspectionId: ($("#linkInspectionId")?.value || "").trim(),
      type: taskType?.value || "Inspection",
      weed: weedSelect?.value || "",
      batch: batchSelect?.value || "",
      date: jobDate?.value || todayISO(), // store ISO
      start: startTime?.value || "",
      end: endTime?.value || "",
      temp: $("#temp")?.value || "",
      wind: $("#wind")?.value || "",
      windDir: $("#windDir")?.value || "",
      humidity: $("#humidity")?.value || "",
      reminder: reminderSel?.value || "",
      status: status || "Incomplete",
      notes: $("#notes")?.value || "",
      coords: trackCoords.length ? trackCoords.slice() : lastCoords ? [lastCoords] : [],
      photo: photoDataURL || "",
      createdAt: new Date().toISOString(),
      archived: false,
    };
  }

  function linkAndArchiveInspectionIfNeeded(task) {
    if (!task.linkedInspectionId) return;
    const insp = DB.tasks.find(
      (t) => t.type === "Inspection" && (String(t.id) === task.linkedInspectionId || t.name === task.linkedInspectionId)
    );
    if (insp) {
      insp.archived = true;
      insp.status = "Archived";
    }
  }

  function consumeBatchIfAny(task) {
    if (!task.batch) return;
    const batch = DB.batches.find((b) => b.id === task.batch);
    if (!batch) return;
    // Simple heuristic for consumption: if roadside w/ coords, assume 100 L used; else 0
    const used = task.type === "Road Shoulder Spray" && (task.coords?.length || 0) > 1 ? 100 : 0;
    batch.used = (batch.used || 0) + used;
    const mix = Number(batch.mix || 0);
    batch.remaining = Math.max(0, mix - (batch.used || 0));
  }

  $("#saveTask")?.addEventListener("click", () => {
    spin("Saving task…");
    const obj = collectTask("Complete");
    const existing = DB.tasks.find((t) => t.name === obj.name);
    if (existing) Object.assign(existing, obj);
    else DB.tasks.push(obj);
    linkAndArchiveInspectionIfNeeded(obj);
    consumeBatchIfAny(obj);
    saveDB();
    populateBatchSelect();
    renderRecords();
    renderMap();
    stopSpin();
    toast("✅ Task saved");
  });

  $("#saveDraft")?.addEventListener("click", () => {
    spin("Saving draft…");
    const obj = collectTask("Draft");
    const existing = DB.tasks.find((t) => t.name === obj.name);
    if (existing) Object.assign(existing, obj);
    else DB.tasks.push(obj);
    saveDB();
    stopSpin();
    toast("🕓 Draft saved");
  });

  // ----------------------------
  // Unified Filters (builder)
  // ----------------------------
  // We normalise the filtering pattern used in Records/Batches/Inventory/Mapping.
  function readFilterGroup(root) {
    return {
      q: $(`#${root} input[data-f=q]`)?.value.trim().toLowerCase() || "",
      from: $(`#${root} input[data-f=from]`)?.value || "",
      to: $(`#${root} input[data-f=to]`)?.value || "",
      tInspection: $(`#${root} input[data-f=tInspection]`)?.checked || false,
      tSpot: $(`#${root} input[data-f=tSpot]`)?.checked || false,
      tRoad: $(`#${root} input[data-f=tRoad]`)?.checked || false,
      sComplete: $(`#${root} input[data-f=sComplete]`)?.checked || false,
      sIncomplete: $(`#${root} input[data-f=sIncomplete]`)?.checked || false,
      sDraft: $(`#${root} input[data-f=sDraft]`)?.checked || false,
    };
  }
  // Inject same pattern above lists if not present (Records already has one in index; mirror on other sections)
  function ensureFilterBar(sectionId, options = {}) {
    const host = document.getElementById(sectionId);
    if (!host) return;
    // If a .filters block already exists, we harmonize its inputs to data-f attributes. Else inject new one.
    let filters = host.querySelector(".filters");
    if (!filters) {
      filters = document.createElement("div");
      filters.className = "filters";
      filters.innerHTML = `
        <input placeholder="Search (job/road/weed/council/chem)" data-f="q"/>
        <div class="row gap mt">
          <label>Date From</label><input type="date" data-f="from"/>
          <label>Date To</label><input type="date" data-f="to"/>
        </div>
        <div class="row gap mt">
          <label><input type="checkbox" data-f="tInspection"/>Inspection</label>
          <label><input type="checkbox" data-f="tSpot"/>Spot</label>
          <label><input type="checkbox" data-f="tRoad"/>Road</label>
        </div>
        <div class="row gap mt">
          <label><input type="checkbox" data-f="sComplete"/>Complete</label>
          <label><input type="checkbox" data-f="sIncomplete"/>Incomplete</label>
          <label><input type="checkbox" data-f="sDraft"/>Draft</label>
        </div>
        <div class="row gap end mt">
          <button data-f="search">Search</button>
          <button data-f="reset">Reset</button>
        </div>
      `;
      // place at top of section
      const h2 = host.querySelector("h2");
      if (h2) h2.insertAdjacentElement("afterend", filters);
      else host.prepend(filters);
    } else {
      // Harmonize existing inputs by adding data-f attributes when found by id in index
      const map = {
        recSearch: "q",
        recFrom: "from",
        recTo: "to",
        fInspection: "tInspection",
        fSpot: "tSpot",
        fRoad: "tRoad",
        fComplete: "sComplete",
        fIncomplete: "sIncomplete",
        fDraft: "sDraft",
        batFrom: "from",
        batTo: "to",
        mapFrom: "from",
        mapTo: "to",
        mapWeed: "q",
      };
      Object.entries(map).forEach(([id, df]) => {
        const el = host.querySelector(`#${id}`);
        if (el) el.setAttribute("data-f", df);
      });
      // Add generic Search/Reset bindings if they exist
      const sBtn = host.querySelector("#recSearchBtn,#batSearchBtn,#mapSearchBtn");
      const rBtn = host.querySelector("#recResetBtn,#batResetBtn,#mapResetBtn");
      if (sBtn && !sBtn.dataset.f) sBtn.setAttribute("data-f", "search");
      if (rBtn && !rBtn.dataset.f) rBtn.setAttribute("data-f", "reset");
    }
    return filters;
  }

  // Ensure filter bars
  ensureFilterBar("records");
  ensureFilterBar("batches");
  ensureFilterBar("inventory"); // inventory doesn't use dates/types, but we keep layout for uniformity
  ensureFilterBar("mapping");

  // ----------------------------
  // Records
  // ----------------------------
  function matchesRecord(t, F) {
    if (t.archived) return false;
    if (F.from && (t.date || "") < F.from) return false;
    if (F.to && (t.date || "") > F.to) return false;

    // Type filter
    const typeEmpty = !F.tInspection && !F.tSpot && !F.tRoad;
    const typeOK =
      typeEmpty ||
      (t.type === "Inspection" && F.tInspection) ||
      (t.type === "Spot Spray" && F.tSpot) ||
      (t.type === "Road Shoulder Spray" && F.tRoad);
    if (!typeOK) return false;

    // Status filter
    const s = t.status || "Incomplete";
    const sEmpty = !F.sComplete && !F.sIncomplete && !F.sDraft;
    const sOK =
      sEmpty || (s === "Complete" && F.sComplete) || (s === "Incomplete" && F.sIncomplete) || (s === "Draft" && F.sDraft);
    if (!sOK) return false;

    // Query
    if (F.q) {
      const hay = `${t.name} ${t.weed} ${t.council}`.toLowerCase();
      if (!hay.includes(F.q)) return false;
    }
    return true;
  }

  function showJobPopup(t) {
    const modal = document.createElement("div");
    modal.className = "modal";
    const hasPt = t.coords && t.coords.length;
    const batchLink = t.batch ? `<a href="#" data-open-batch="${t.batch}">${t.batch}</a>` : "—";
    const linkedInsp = t.linkedInspectionId ? `<a href="#" data-open-insp="${t.linkedInspectionId}">${t.linkedInspectionId}</a>` : "—";
    const photoHtml = t.photo
      ? `<div style="margin:.4rem 0"><img src="${t.photo}" alt="photo" style="max-width:100%;border-radius:8px"/></div>`
      : "";
    const html = `
      <div class="card p">
        <h3 style="margin-top:0">${t.name}</h3>
        <div class="grid two">
          <div><b>Type:</b> ${t.type}</div>
          <div><b>Status:</b> ${t.status}</div>
          <div><b>Date:</b> ${AU.format(t.date)}</div>
          <div><b>Start/Finish:</b> ${t.start || "–"} / ${t.end || "–"}</div>
          <div><b>Weed:</b> ${t.weed || "—"}</div>
          <div><b>Batch:</b> ${batchLink}</div>
          <div><b>Linked Inspection:</b> ${linkedInsp}</div>
          <div><b>Reminder:</b> ${t.reminder || "—"} wk</div>
          <div class="grid two" style="grid-column:1/-1">
            <div><b>Weather:</b> ${fmt(t.temp)}°C, ${fmt(t.wind)} km/h, ${t.windDir || "–"}, ${fmt(t.humidity)}%</div>
            <div><b>Council #:</b> ${t.council || "—"}</div>
          </div>
          <div style="grid-column:1/-1"><b>Notes:</b> ${t.notes || "—"}</div>
        </div>
        ${photoHtml}
        <div class="row gap end" style="margin-top:.8rem;">
          ${hasPt ? `<button class="pill" data-nav>Navigate</button>` : ""}
          <button class="pill" data-edit>Edit</button>
          <button class="pill warn" data-close>Close</button>
        </div>
      </div>`;
    modal.innerHTML = html;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal || e.target.dataset.close != null) modal.remove();
    });
    modal.querySelector("[data-edit]")?.addEventListener("click", () => {
      // load task back into form
      showScreen("createTask");
      $("#jobName").value = t.name;
      $("#councilNum").value = t.council || "";
      $("#linkInspectionId").value = t.linkedInspectionId || "";
      $("#taskType").value = t.type;
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
      if (t.photo) {
        $("#photoPreview").src = t.photo;
        $("#photoPreview").style.display = "block";
      }
      modal.remove();
    });
    modal.querySelector("[data-nav]")?.addEventListener("click", () => {
      const pt = t.coords?.[0];
      if (!pt) return toast("No coords saved");
      WeedExtras.navigateAppleMaps(pt[0], pt[1]);
    });
    modal.querySelector("[data-open-batch]")?.addEventListener("click", (e) => {
      e.preventDefault();
      const id = e.currentTarget.getAttribute("data-open-batch");
      const b = DB.batches.find((x) => x.id === id);
      b && showBatchPopup(b);
    });
    modal.querySelector("[data-open-insp]")?.addEventListener("click", (e) => {
      e.preventDefault();
      const id = e.currentTarget.getAttribute("data-open-insp");
      const insp = DB.tasks.find((x) => x.type === "Inspection" && (String(x.id) === id || x.name === id));
      insp && showJobPopup(insp);
    });

    document.addEventListener(
      "keydown",
      (ev) => {
        if (ev.key === "Escape") modal.remove();
      },
      { once: true }
    );
  }

  function renderRecords() {
    const list = $("#recordsList");
    if (!list) return;
    list.innerHTML = "";
    const F = readFilterGroup("records");

    DB.tasks
      .filter((t) => matchesRecord(t, F))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .forEach((t) => {
        const d = document.createElement("div");
        d.className = "item";
        const dateAU = AU.format(t.date);
        d.innerHTML = `<b>${t.name}</b><br><small>${t.type} • ${dateAU} • ${t.status}</small>
          <div class="row end" style="margin-top:.35rem">
            <button class="pill" data-open>Open</button>
            ${t.coords && t.coords.length ? `<button class="pill" data-nav>Navigate</button>` : ""}
          </div>`;
        d.querySelector("[data-open]").onclick = () => showJobPopup(t);
        d.querySelector("[data-nav]")?.addEventListener("click", () => {
          const pt = t.coords?.[0];
          if (!pt) return toast("No coords saved");
          WeedExtras.navigateAppleMaps(pt[0], pt[1]);
        });
        list.appendChild(d);
      });

    // Search/reset hooks (works for injected or native buttons)
    $("#records")?.querySelector("[data-f=search]")?.addEventListener("click", renderRecords, { once: true });
    $("#records")?.querySelector("[data-f=reset]")?.addEventListener(
      "click",
      () => {
        $$(`#records [data-f=q],[data-f=from],[data-f=to]`).forEach((el) => (el.value = ""));
        $$(
          `#records [data-f=tInspection],[data-f=tSpot],[data-f=tRoad],[data-f=sComplete],[data-f=sIncomplete],[data-f=sDraft]`
        ).forEach((el) => (el.checked = false));
        renderRecords();
      },
      { once: true }
    );
  }

  // ----------------------------
  // Batches
  // ----------------------------
  function showBatchCreateModal(existing = null) {
    // Single big modal: Date (auto stamp), Time (auto), Mix (L), Chemicals (from inventory), add rows
    const modal = document.createElement("div");
    modal.className = "modal";

    const stampDate = todayISO();
    const stampTime = nowTime();

    const chemicals = DB.chems.slice().sort((a, b) => a.name.localeCompare(b.name));
    const rowsHTML = (existing?.chemicals || [])
      .map(
        (c, idx) => `
      <div class="row wrap gap" data-row="${idx}">
        <select class="in chemName" style="min-width:180px">
          ${chemicals
            .map((ch) => `<option ${ch.name === c.name ? "selected" : ""}>${ch.name}</option>`)
            .join("")}
        </select>
        <input class="in per100" type="number" step="0.01" placeholder="Amt / 100L" value="${c.per100?.value ?? ""}"/>
        <select class="in unit">
          ${["L", "mL", "g", "kg"]
            .map((u) => `<option ${c.per100?.unit === u ? "selected" : ""}>${u}</option>`)
            .join("")}
        </select>
        <span class="chip totalOut">= ${c.total?.value ?? 0} ${c.total?.unit ?? ""}</span>
        <button class="pill warn removeChem" type="button">Remove</button>
      </div>`
      )
      .join("");

    const html = `
      <div class="card p" style="max-width:760px;width:95%">
        <h3 style="margin-top:0">${existing ? "Edit Batch" : "Create Batch"}</h3>
        <div class="grid two">
          <div><b>Date:</b> <span id="bc_date">${existing?.date || stampDate}</span></div>
          <div><b>Time:</b> <span id="bc_time">${existing?.time || stampTime}</span></div>
        </div>
        <div class="mt">
          <label>Total mix (L)</label>
          <input id="bc_mix" type="number" step="0.1" value="${existing?.mix ?? ""}" placeholder="e.g. 600"/>
        </div>
        <div class="mt">
          <div class="row spread">
            <b>Chemicals</b>
            <button id="bc_addChem" class="pill" type="button">+ Add Chemical</button>
          </div>
          <div id="bc_rows" class="mt">
            ${rowsHTML || ""}
          </div>
        </div>
        <div class="row gap end mt">
          <button class="pill" id="bc_save" type="button">${existing ? "Save" : "Create"}</button>
          <button class="pill warn" data-close type="button">Close</button>
        </div>
      </div>
    `;
    modal.innerHTML = html;
    document.body.appendChild(modal);

    function rowTotal(per100, unit, mixL) {
      const m = Number(mixL || 0);
      const dose = Number(per100 || 0);
      const total = (dose * m) / 100; // per 100L
      // units unchanged, except if kg/g conversions are desired we keep user unit
      return { value: +total.toFixed(3), unit };
    }

    function recalcAll() {
      const mixL = $("#bc_mix")?.value || 0;
      $("#bc_rows")
        ?.querySelectorAll(".row[data-row]")
        .forEach((row) => {
          const per100 = row.querySelector(".per100")?.value || 0;
          const unit = row.querySelector(".unit")?.value || "L";
          const out = row.querySelector(".totalOut");
          const tot = rowTotal(per100, unit, mixL);
          out.textContent = `= ${fmt(tot.value)} ${tot.unit}`;
        });
    }

    function addChemRow(prefill) {
      const idx = $("#bc_rows")?.querySelectorAll(".row[data-row]").length || 0;
      const row = document.createElement("div");
      row.className = "row wrap gap";
      row.setAttribute("data-row", String(idx));
      row.innerHTML = `
        <select class="in chemName" style="min-width:180px">
          ${chemicals.map((c) => `<option>${c.name}</option>`).join("")}
        </select>
        <input class="in per100" type="number" step="0.01" placeholder="Amt / 100L" value="${prefill?.per100?.value ?? ""}"/>
        <select class="in unit">
          ${["L", "mL", "g", "kg"]
            .map((u) => `<option ${prefill?.per100?.unit === u ? "selected" : ""}>${u}</option>`)
            .join("")}
        </select>
        <span class="chip totalOut">= 0</span>
        <button class="pill warn removeChem" type="button">Remove</button>
      `;
      $("#bc_rows").appendChild(row);
      row.querySelector(".per100").addEventListener("input", recalcAll);
      row.querySelector(".unit").addEventListener("change", recalcAll);
      row.querySelector(".removeChem").addEventListener("click", () => {
        row.remove();
        recalcAll();
      });
      recalcAll();
    }

    $("#bc_addChem").addEventListener("click", () => addChemRow());
    $("#bc_mix").addEventListener("input", recalcAll);
    $("#bc_rows")?.querySelectorAll(".row[data-row]").forEach((r) => {
      r.querySelector(".per100")?.addEventListener("input", recalcAll);
      r.querySelector(".unit")?.addEventListener("change", recalcAll);
      r.querySelector(".removeChem")?.addEventListener("click", () => {
        r.remove();
        recalcAll();
      });
    });
    recalcAll();

    $("#bc_save").addEventListener("click", () => {
      const id = existing?.id || `B${Date.now()}`;
      const mix = Number($("#bc_mix")?.value || 0);
      const date = $("#bc_date").textContent || todayISO();
      const time = $("#bc_time").textContent || nowTime();

      const chems = [];
      $("#bc_rows")
        ?.querySelectorAll(".row[data-row]")
        .forEach((r) => {
          const name = r.querySelector(".chemName")?.value || "";
          const v = Number(r.querySelector(".per100")?.value || 0);
          const unit = r.querySelector(".unit")?.value || "L";
          const tot = rowTotal(v, unit, mix);
          chems.push({
            name,
            per100: { value: v, unit },
            total: { value: tot.value, unit: tot.unit },
          });
        });

      const obj = existing || {};
      obj.id = id;
      obj.date = date;
      obj.time = time;
      obj.mix = mix;
      obj.remaining = existing?.remaining ?? mix;
      obj.used = existing?.used ?? 0;
      obj.chemicals = chems;

      if (!existing) DB.batches.push(obj);
      saveDB();
      populateBatchSelect();
      renderBatches();
      modal.remove();
      toast(existing ? "Batch updated" : "Batch created");
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal || e.target.dataset.close != null) modal.remove();
    });
  }

  function showBatchPopup(b) {
    const jobs = DB.tasks.filter((t) => t.batch === b.id);
    const jobsHtml = jobs.length ? `<ul>${jobs.map((t) => `<li><a href="#" data-open-job="${t.id}">${t.name}</a></li>`).join("")}</ul>` : "—";
    const empty = Number(b.remaining || 0) <= 0;
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="card p" style="max-width:720px;width:95%;${empty ? "border: 2px solid #b30000" : ""}">
        <h3 style="margin-top:0">${b.id}</h3>
        <div><b>Date:</b> ${AU.format(b.date || todayISO())} · <b>Time:</b> ${b.time || "–"}</div>
        <div class="mt"><b>Total Mix:</b> ${fmt(b.mix)} L</div>
        <div class="mt"><b>Remaining:</b> ${fmt(b.remaining)} L</div>
        <div class="mt"><b>Chemicals:</b>
          ${Array.isArray(b.chemicals) && b.chemicals.length
            ? `<ul>${b.chemicals
                .map((c) => `<li>${c.name} — ${fmt(c.per100?.value)} ${c.per100?.unit}/100 L = ${fmt(c.total?.value)} ${c.total?.unit}</li>`)
                .join("")}</ul>`
            : "—"}
        </div>
        <div class="mt"><b>Linked Jobs:</b> ${jobsHtml}</div>
        ${
          b.dumped?.length
            ? `<div class="mt"><b>Dumped:</b><ul>${b.dumped
                .map((d) => `<li>${AU.format(d.date)} ${d.time} — ${d.amount} L (${d.reason || "No reason"})</li>`)
                .join("")}</ul></div>`
            : `<div class="mt"><b>Dumped:</b> None</div>`
        }
        <div class="row gap end mt">
          <button class="pill" data-edit>Edit</button>
          <button class="pill" data-dump>Dump Remaining</button>
          <button class="pill warn" data-close>Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal || e.target.dataset.close != null) modal.remove();
    });
    $$("[data-open-job]", modal).forEach((a) =>
      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        const t = DB.tasks.find((x) => String(x.id) === a.getAttribute("data-open-job"));
        t && showJobPopup(t);
      })
    );
    modal.querySelector("[data-edit]")?.addEventListener("click", () => {
      modal.remove();
      showBatchCreateModal(b);
    });
    modal.querySelector("[data-dump]")?.addEventListener("click", () => {
      const amt = Number(prompt("Dump how many litres?", "0")) || 0;
      if (amt <= 0) return;
      if (amt > (b.remaining || 0)) return alert("Amount exceeds remaining.");
      const reason = prompt("Reason for dump?", "Expired / leftover") || "";
      b.remaining = (b.remaining || 0) - amt;
      b.dumped ??= [];
      b.dumped.push({ date: todayISO(), time: nowTime(), amount: amt, reason });
      saveDB();
      modal.remove();
      renderBatches();
      toast("Batch updated");
    });
  }

  function renderBatches() {
    const list = $("#batchList");
    if (!list) return;
    list.innerHTML = "";

    // Ensure control buttons exist
    $("#batches")?.querySelector("#newBatch")?.addEventListener("click", () => showBatchCreateModal());

    // Harmonise Search/Reset (injected ones handled by ensureFilterBar)
    $("#batches")?.querySelector("[data-f=search]")?.addEventListener("click", renderBatches, { once: true });
    $("#batches")?.querySelector("[data-f=reset]")?.addEventListener(
      "click",
      () => {
        $$(`#batches [data-f=q],[data-f=from],[data-f=to]`).forEach((el) => (el.value = ""));
        $$(
          `#batches [data-f=tInspection],[data-f=tSpot],[data-f=tRoad],[data-f=sComplete],[data-f=sIncomplete],[data-f=sDraft]`
        ).forEach((el) => (el.checked = false));
        renderBatches();
      },
      { once: true }
    );

    const F = readFilterGroup("batches");
    DB.batches
      .filter((b) => (!F.from || (b.date || "") >= F.from) && (!F.to || (b.date || "") <= F.to))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .forEach((b) => {
        // Simple text hay: id + chemicals + linked job names
        const jobs = DB.tasks.filter((t) => t.batch === b.id);
        const hay = `${b.id} ${(b.chemicals || []).map((c) => c.name).join(" ")} ${jobs.map((j) => j.name).join(" ")}`.toLowerCase();
        if (F.q && !hay.includes(F.q)) return;

        const d = document.createElement("div");
        d.className = "item";
        d.style.border = Number(b.remaining || 0) <= 0 ? "2px solid #b30000" : "";
        d.innerHTML = `<b>${b.id}</b><br>
          <small>${AU.format(b.date || todayISO())} • Total ${fmt(b.mix)} L • Remaining ${fmt(b.remaining ?? b.mix)} L</small>
          <div class="row end" style="margin-top:.35rem">
            <button class="pill" data-open>Open</button>
          </div>`;
        d.querySelector("[data-open]").onclick = () => showBatchPopup(b);
        list.appendChild(d);
      });
  }

  // ----------------------------
  // Inventory & Procurement
  // ----------------------------
  $("#addChem")?.addEventListener("click", () => {
    const name = prompt("Chemical name:");
    if (!name) return;
    const active = prompt("Active ingredient:", "") || "";
    const size = Number(prompt("Container size (number):", "20")) || 0;
    const unit = prompt("Unit (L, mL, g, kg):", "L") || "L";
    const count = Number(prompt("How many containers:", "0")) || 0;
    const thr = Number(prompt("Reorder threshold (containers):", "0")) || 0;
    DB.chems.push({ name, active, containerSize: size, containerUnit: unit, containers: count, threshold: thr });
    saveDB();
    renderChems();
    renderProcurement();
  });

  function openChemEditor(c) {
    const sheet = $("#chemEditSheet");
    if (!sheet) return;
    $("#ce_name").value = c.name || "";
    $("#ce_active").value = c.active || "";
    $("#ce_size").value = c.containerSize || 0;
    $("#ce_unit").value = c.containerUnit || "L";
    $("#ce_count").value = c.containers || 0;
    $("#ce_threshold").value = c.threshold || 0;
    sheet.style.display = "block";

    const save = () => {
      c.name = $("#ce_name").value.trim();
      c.active = $("#ce_active").value.trim();
      c.containerSize = Number($("#ce_size").value) || 0;
      c.containerUnit = $("#ce_unit").value || "L";
      c.containers = Number($("#ce_count").value) || 0;
      c.threshold = Number($("#ce_threshold").value) || 0;
      saveDB();
      renderChems();
      renderProcurement();
      sheet.style.display = "none";
      toast("Chemical updated");
      $("#ce_save").removeEventListener("click", save);
    };
    $("#ce_save").addEventListener("click", save);
    $("#ce_cancel").addEventListener(
      "click",
      () => {
        sheet.style.display = "none";
      },
      { once: true }
    );
  }

  function renderChems() {
    const list = $("#chemList");
    if (!list) return;
    list.innerHTML = "";

    // Inject uniform filters for inventory if not present (we ignore type/status internally)
    $("#inventory")?.querySelector("[data-f=search]")?.addEventListener("click", renderChems, { once: true });
    $("#inventory")?.querySelector("[data-f=reset]")?.addEventListener(
      "click",
      () => {
        $$(`#inventory [data-f=q],[data-f=from],[data-f=to]`).forEach((el) => (el.value = ""));
        $$(
          `#inventory [data-f=tInspection],[data-f=tSpot],[data-f=tRoad],[data-f=sComplete],[data-f=sIncomplete],[data-f=sDraft]`
        ).forEach((el) => (el.checked = false));
        renderChems();
      },
      { once: true }
    );

    const F = readFilterGroup("inventory");

    DB.chems
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((c) => {
        // Basic search by name/active
        const hay = `${c.name} ${c.active}`.toLowerCase();
        if (F.q && !hay.includes(F.q)) return;

        const total = (c.containers || 0) * (c.containerSize || 0);
        const card = document.createElement("div");
        card.className = "item";
        const low = c.threshold && (c.containers || 0) < c.threshold;
        card.style.border = low ? "2px solid #b30000" : "";
        card.innerHTML = `
          <b>${c.name}</b><br>
          <small>Active: ${c.active || "—"}</small><br>
          <small>${c.containers || 0} × ${fmt(c.containerSize)} ${c.containerUnit} • Total ${fmt(total)} ${c.containerUnit}</small>
          <div class="row gap end" style="margin-top:.4rem;">
            <button class="pill" data-edit>Edit</button>
            <button class="pill warn" data-del>Delete</button>
          </div>
        `;
        card.querySelector("[data-edit]").addEventListener("click", () => openChemEditor(c));
        card.querySelector("[data-del]").addEventListener("click", () => {
          if (!confirm("Delete chemical?")) return;
          DB.chems = DB.chems.filter((x) => x !== c);
          saveDB();
          renderChems();
          renderProcurement();
        });
        list.appendChild(card);
      });
  }

  function renderProcurement() {
    const ul = $("#procList");
    if (!ul) return;
    ul.innerHTML = "";
    DB.chems.forEach((c) => {
      if (c.threshold && (c.containers || 0) < c.threshold) {
        const li = document.createElement("li");
        li.textContent = `Low stock: ${c.name} (${c.containers || 0} < ${c.threshold})`;
        ul.appendChild(li);
      }
    });
  }

  // ----------------------------
  // Mapping (Leaflet + filters)
  // ----------------------------
  let map;
  function ensureMap() {
    if (map) return map;
    map = L.map("map").setView([-34.75, 148.65], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

    // Add Locate control top-right (slightly higher)
    const btn = L.control({ position: "topright" });
    btn.onAdd = function () {
      const d = L.DomUtil.create("div", "leaflet-bar");
      d.style.background = "#146c2e";
      d.style.color = "#fff";
      d.style.borderRadius = "6px";
      d.style.padding = "6px 10px";
      d.style.cursor = "pointer";
      d.innerText = "Locate Me";
      d.onclick = () => {
        if (!navigator.geolocation) return toast("Enable location");
        navigator.geolocation.getCurrentPosition((p) => {
          const pt = [p.coords.latitude, p.coords.longitude];
          map.setView(pt, 14);
          L.circleMarker(pt, { radius: 7, opacity: 0.9 }).addTo(map).bindPopup("You are here").openPopup();
        });
      };
      return d;
    };
    btn.addTo(map);
    return map;
  }

  function renderMap(fit = false) {
    const m = ensureMap();
    // Remove non tiles
    m.eachLayer((l) => {
      if (!(l instanceof L.TileLayer)) m.removeLayer(l);
    });

    // Read mapping filters (use harmonized bar)
    const F = readFilterGroup("mapping");
    const weedQ = $("#mapWeed")?.value?.trim()?.toLowerCase() || "";

    const tasks = DB.tasks
      .filter((t) => !t.archived)
      .filter((t) => (!F.from || (t.date || "") >= F.from) && (!F.to || (t.date || "") <= F.to))
      .filter((t) => {
        const typeEmpty = !F.tInspection && !F.tSpot && !F.tRoad;
        return (
          typeEmpty ||
          (t.type === "Inspection" && F.tInspection) ||
          (t.type === "Spot Spray" && F.tSpot) ||
          (t.type === "Road Shoulder Spray" && F.tRoad)
        );
      })
      .filter((t) => (weedQ ? String(t.weed || "").toLowerCase().includes(weedQ) : true));

    const group = L.featureGroup();
    tasks.forEach((t) => {
      if (t.coords?.length > 1) group.addLayer(L.polyline(t.coords, { color: "yellow", weight: 4, opacity: 0.9 }));
      const pt = t.coords?.[0];
      if (!pt) return;
      const openId = `open_${t.id}`;
      const navId = `nav_${t.id}`;
      const popup =
        `<b>${t.name}</b><br>${t.type} • ${AU.format(t.date)}` +
        `<br><button id="${openId}" class="pill" style="margin-top:.35rem">Open</button>` +
        `<button id="${navId}" class="pill" style="margin-top:.35rem;margin-left:.4rem">Navigate</button>`;
      const marker = L.marker(pt);
      marker.bindPopup(popup);
      marker.on("popupopen", () => {
        setTimeout(() => {
          const ob = document.getElementById(openId);
          const nb = document.getElementById(navId);
          ob && (ob.onclick = () => showJobPopup(t));
          nb && (nb.onclick = () => WeedExtras.navigateAppleMaps(pt[0], pt[1]));
        }, 0);
      });
      group.addLayer(marker);
    });
    group.addTo(m);
    if (fit && tasks.length) {
      try {
        m.fitBounds(group.getBounds().pad(0.2));
      } catch {}
    }

    // Draw last tracked polyline (quick visual)
    try {
      const last = JSON.parse(localStorage.getItem("lastTrack") || "[]");
      if (Array.isArray(last) && last.length > 1) L.polyline(last, { color: "#ffda44", weight: 3, opacity: 0.8 }).addTo(m);
    } catch {}
  }

  // Map search/reset binding (native or injected)
  $("#mapping")?.querySelector("[data-f=search]")?.addEventListener("click", () => renderMap(true), { once: true });
  $("#mapping")?.querySelector("[data-f=reset]")?.addEventListener(
    "click",
    () => {
      $$(`#mapping [data-f=q],[data-f=from],[data-f=to]`).forEach((el) => (el.value = ""));
      $$(
        `#mapping [data-f=tInspection],[data-f=tSpot],[data-f=tRoad],[data-f=sComplete],[data-f=sIncomplete],[data-f=sDraft]`
      ).forEach((el) => (el.checked = false));
      $("#mapWeed") && ($("#mapWeed").value = "");
      renderMap(true);
    },
    { once: true }
  );

  // ----------------------------
  // Initial paints
  // ----------------------------
  renderRecords();
  renderBatches();
  renderChems();
  renderProcurement();

  // ----------------------------
  // Home splash fade (if present)
  // ----------------------------
  const splash = $("#splash");
  if (splash) {
    // make sure it fades & removes
    setTimeout(() => splash.classList.add("fade"), 600);
    setTimeout(() => {
      try {
        splash.remove();
      } catch {}
    }, 1400);
  }

  console.log("✅ WeedTracker V60 Pilot — apps.js FULL loaded");
})();
