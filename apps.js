/* === WeedTracker V60 Pilot — apps.js (FULL) ===============================
 * - Fixes: home buttons not working, unified navigation, splash fade
 * - Task type order + renamed "Road Shoulder Spray"
 * - AU date format in display + job-name (DDMMYYYY)
 * - Weed selector: 🔺 Noxious Weeds category pinned to the top + "Other"
 * - Road tracking only for Road Shoulder Spray
 * - Single-sheet Batch Creator (no chained prompts), links to inventory
 * - Apple Maps navigation from Records + Map pins
 * - Unified search handlers for Records / Batches / Mapping / Inventory
 * - Popups (Jobs/Batches) close reliably; edit + dump with reason
 * - Works with your existing index.html + styles.css + storage/extras/settings/batches files
 * ======================================================================== */

(function () {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fmt = (n, d = 0) => (n === null || n === undefined || n === "") ? "—" : Number(n).toFixed(d);

  // ===== Dates (AU) =====
  const todayISO = () => new Date().toISOString().split("T")[0];
  const nowTime  = () => new Date().toTimeString().slice(0, 5);
  function formatDateAU(d) {
    const dt = (d instanceof Date) ? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = dt.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  function formatDateAUCompact(d) {
    const dt = (d instanceof Date) ? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = dt.getFullYear();
    return `${dd}${mm}${yyyy}`;
  }

  // ===== Toast / Spinner =====
  function toast(msg, ms = 1800) {
    const d = document.createElement("div");
    d.textContent = msg;
    Object.assign(d.style, {
      position: "fixed", bottom: "28px", left: "50%", transform: "translateX(-50%)",
      background: "#0a6a3d", color: "#fff", padding: "10px 14px", borderRadius: "10px",
      boxShadow: "0 2px 10px rgba(0,0,0,.3)", fontWeight: 700, zIndex: 9999
    });
    document.body.appendChild(d);
    setTimeout(() => d.remove(), ms);
  }
  const spinnerEl = $("#spinner");
  const spin = (on, msg = "Working…") => {
    if (!spinnerEl) return;
    spinnerEl.classList.toggle("active", !!on);
    spinnerEl.setAttribute("aria-label", msg);
  };

  // ===== Storage (via storage.js if present) =====
  const ST = (window.WeedStorage?.load && window.WeedStorage) || {
    load: () => JSON.parse(localStorage.getItem("weedtracker_data_v60") || '{"tasks":[],"batches":[],"chems":[],"procurement":[]}'),
    save: (d) => localStorage.setItem("weedtracker_data_v60", JSON.stringify(d))
  };
  let DB = ST.load();
  DB.tasks      ||= [];
  DB.batches    ||= [];
  DB.chems      ||= [];
  DB.procurement||= [];

  function saveDB() { ST.save(DB); }

  // ===== SPLASH FADE =====
  (function splashFade() {
    const splash = $("#splash");
    if (!splash) return;
    // ensure it's visible, then fade
    setTimeout(() => splash.classList.add("fade"), 200);
    setTimeout(() => splash.remove(), 1500);
  })();

  // ===== NAVIGATION =====
  const screens = $$(".screen");
  function switchScreen(id) {
    screens.forEach(s => s.classList.remove("active"));
    const el = $("#" + id);
    if (el) el.classList.add("active");
    window.scrollTo(0, 0);

    // lazy renders
    if (id === "records") renderRecords();
    if (id === "batches") renderBatches();
    if (id === "inventory") renderChems();
    if (id === "procurement") renderProcurement();
    if (id === "mapping") renderMap(true);
  }
  // Home "round" button
  $$(".home-btn").forEach(btn => btn.addEventListener("click", () => switchScreen("home")));

  // Home tiles (bind by order to avoid changing your HTML)
  (function bindHomeButtons() {
    const btns = $$("#home .grid.seven button");
    const targets = ["createTask", "records", "batches", "inventory", "procurement", "mapping", "settings"];
    btns.forEach((b, i) => b.addEventListener("click", () => switchScreen(targets[i])));
  })();

  // ===== TASK TYPE (rename + order) =====
  (function fixTaskType() {
    const sel = $("#taskType");
    if (!sel) return;
    // Ensure options and rename "Road Spray" to "Road Shoulder Spray"
    $$("option", sel).forEach(o => {
      if (o.text.trim().toLowerCase() === "road spray") {
        o.text = "Road Shoulder Spray";
        o.value = "Road Shoulder Spray";
      }
    });
  })();

  // ===== REMINDER WEEKS 0–52 =====
  (function ensureReminders() {
    const sel = $("#reminderWeeks");
    if (!sel) return;
    if (!sel.options.length) {
      for (let i = 0; i <= 52; i++) {
        const o = document.createElement("option");
        o.value = i;
        o.textContent = i;
        sel.appendChild(o);
      }
    }
  })();

  // ===== WEED SELECTOR (noxious pinned + Other) =====
  const NOXIOUS = [
    "African Boxthorn (noxious)","African Lovegrass (noxious)","Bathurst Burr (noxious)","Blackberry (noxious)",
    "Cape Broom (noxious)","Chilean Needle Grass (noxious)","Coolatai Grass (noxious)","Fireweed (noxious)",
    "Gorse (noxious)","Lantana (noxious)","Patterson’s Curse (noxious)","Serrated Tussock (noxious)",
    "St John’s Wort (noxious)","Sweet Briar (noxious)","Willow spp. (noxious)"
  ];
  const COMMON = [
    "African Feathergrass","Artichoke Thistle","Balloon Vine","Blue Heliotrope","Bridal Creeper","Caltrop",
    "Coltsfoot","Fleabane","Flax-leaf Broom","Fountain Grass","Galvanised Burr","Giant Parramatta Grass",
    "Glycine","Green Cestrum","Horehound","Khaki Weed","Noogoora Burr","Parthenium Weed","Prickly Pear (common)",
    "Saffron Thistle","Silverleaf Nightshade","Spear Thistle","Sweet Vernal Grass","Three-cornered Jack",
    "Wild Radish","Cape Broom" // ensure Cape Broom is definitely in list
  ];
  function populateWeeds() {
    const sel = $("#weedSelect");
    if (!sel) return;
    sel.innerHTML = "";

    // Category stub "🔺 Noxious Weeds (category)"
    const head = document.createElement("option");
    head.value = "🔺 Noxious Weeds (category)";
    head.textContent = "🔺 Noxious Weeds (category)";
    sel.appendChild(head);

    // Sorted noxious weeds with ⚠ marker
    NOXIOUS.slice().sort((a, b) => a.localeCompare(b)).forEach(w => {
      const o = document.createElement("option");
      o.value = w;
      o.textContent = "⚠ " + w;
      sel.appendChild(o);
    });

    // Divider
    const div = document.createElement("option");
    div.disabled = true;
    div.textContent = "— Other Weeds —";
    sel.appendChild(div);

    // Common weeds
    COMMON.slice().sort((a, b) => a.localeCompare(b)).forEach(w => {
      const o = document.createElement("option");
      o.value = w;
      o.textContent = w;
      sel.appendChild(o);
    });

    // "Other" (so you can type details in Notes)
    const other = document.createElement("option");
    other.value = "Other";
    other.textContent = "Other (describe in Notes)";
    sel.appendChild(other);

    // Top placeholder
    sel.insertBefore(new Option("— Select Weed —", ""), sel.firstChild);
  }
  populateWeeds();

  // ===== LOCATION + AUTO-NAME =====
  let currentRoad = "";
  $("#locateBtn")?.addEventListener("click", () => {
    if (!navigator.geolocation) { toast("Enable Location Services"); return; }
    spin(true, "Getting GPS…");
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const { latitude: lat, longitude: lon } = pos.coords;
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const j = await r.json();
        currentRoad = (j.address?.road || j.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`).trim();
        $("#locRoad").textContent = currentRoad;
      } catch {
        $("#locRoad").textContent = "Unknown";
      } finally {
        spin(false);
      }
    }, () => { spin(false); toast("GPS failed"); }, { enableHighAccuracy: true, timeout: 12000 });
  });

  const TYPE_PREFIX = { "Inspection": "I", "Spot Spray": "SS", "Road Shoulder Spray": "RS" };
  // Ensure date default & show time labels clearly under date (the inputs already exist)
  const jobDateEl = $("#jobDate"); if (jobDateEl && !jobDateEl.value) jobDateEl.value = todayISO();

  $("#autoNameBtn")?.addEventListener("click", () => {
    const t = $("#taskType").value || "Inspection";
    const ddmmyyyy = formatDateAUCompact(jobDateEl?.value || new Date());
    const roadPart = (currentRoad || "Unknown").replace(/\s+/g, "");
    $("#jobName").value = `${roadPart}${ddmmyyyy}_${TYPE_PREFIX[t] || "I"}`;
  });

  // ===== ROAD TRACKING (only for Road Shoulder Spray) =====
  const trackBlock = $("#roadTrackBlock");
  function syncTrackVis() {
    const val = $("#taskType").value;
    if (trackBlock) trackBlock.style.display = (val === "Road Shoulder Spray") ? "block" : "none";
  }
  $("#taskType")?.addEventListener("change", syncTrackVis); syncTrackVis();

  let tracking = false, trackTimer = null, trackCoords = [];
  $("#startTrack")?.addEventListener("click", () => {
    if (!navigator.geolocation) { toast("Enable Location Services"); return; }
    trackCoords = [];
    tracking = true;
    $("#trackStatus").textContent = "Tracking…";
    trackTimer = setInterval(() => {
      navigator.geolocation.getCurrentPosition(p => {
        trackCoords.push([p.coords.latitude, p.coords.longitude]);
      });
    }, 5000);
  });
  $("#stopTrack")?.addEventListener("click", () => {
    tracking = false;
    if (trackTimer) clearInterval(trackTimer);
    $("#trackStatus").textContent = `Stopped (${trackCoords.length} pts)`;
    localStorage.setItem("lastTrack", JSON.stringify(trackCoords));
  });

  // ===== WEATHER (Open-Meteo, with humidity filled) =====
  $("#autoWeatherBtn")?.addEventListener("click", () => {
    if (!navigator.geolocation) { toast("Enable Location Services"); return; }
    spin(true, "Getting Weather…");
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const { latitude, longitude } = pos.coords;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;
        const r = await fetch(url); const j = await r.json(); const c = j.current || {};
        $("#temp").value     = c.temperature_2m ?? "";
        $("#wind").value     = c.wind_speed_10m ?? "";
        $("#windDir").value  = (c.wind_direction_10m ?? "") + (c.wind_direction_10m != null ? "°" : "");
        $("#humidity").value = c.relative_humidity_2m ?? "";
        $("#wxUpdated").textContent = "Updated: " + nowTime();
      } catch {
        toast("Weather unavailable");
      } finally { spin(false); }
    }, () => { spin(false); toast("Location unavailable"); });
  });

  // ===== PHOTO PREVIEW =====
  let photoDataURL = "";
  $("#photoInput")?.addEventListener("change", (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      photoDataURL = String(reader.result || "");
      const img = $("#photoPreview");
      img.src = photoDataURL;
      img.style.display = "block";
    };
    reader.readAsDataURL(f);
  });

  // ===== SAVE TASK / DRAFT =====
  $("#saveTask")?.addEventListener("click", () => saveTask(false));
  $("#saveDraft")?.addEventListener("click", () => saveTask(true));

  function saveTask(isDraft) {
    spin(true, "Saving…");
    const id = Date.now();
    const status = isDraft ? "Draft" : ($("#status")?.value || "Complete"); // if you add a dedicated status select
    const obj = {
      id,
      name: $("#jobName").value.trim() || ("Task_" + id),
      council: $("#councilNum").value.trim(),
      linkedInspectionId: $("#linkInspectionId").value.trim(),
      type: $("#taskType").value,
      weed: $("#weedSelect").value,
      batch: $("#batchSelect").value,
      date: $("#jobDate").value || todayISO(),
      start: $("#startTime").value || "",
      end: $("#endTime").value || "",
      temp: $("#temp").value, wind: $("#wind").value, windDir: $("#windDir").value, humidity: $("#humidity").value,
      reminder: $("#reminderWeeks").value || "",
      status,
      notes: $("#notes").value || "",
      coords: trackCoords.slice(),
      photo: photoDataURL || "",
      createdAt: new Date().toISOString(),
      archived: false
    };

    const existing = DB.tasks.find(t => t.name === obj.name);
    if (existing) Object.assign(existing, obj); else DB.tasks.push(obj);

    // consume batch simply (if tracking, deduct nominal 100 L)
    if (obj.batch) {
      const b = DB.batches.find(x => x.id === obj.batch);
      if (b) {
        const used = (obj.type === "Road Shoulder Spray" && obj.coords?.length > 1) ? 100 : 0;
        b.used = (b.used || 0) + used;
        b.remaining = Math.max(0, (Number(b.mix) || 0) - (b.used || 0));
      }
    }

    saveDB();
    populateBatchSelect();
    renderRecords();
    renderMap();
    spin(false);
    toast("Saved");
  }

  // ====== RECORDS (Unified filters) ======
  $("#recSearchBtn")?.addEventListener("click", renderRecords);
  $("#recResetBtn")?.addEventListener("click", () => {
    $("#recSearch").value = "";
    $("#recFrom").value = "";
    $("#recTo").value = "";
    ["fInspection", "fSpot", "fRoad", "fComplete", "fIncomplete", "fDraft"].forEach(id => { $("#" + id).checked = false; });
    renderRecords();
  });

  function recordMatches(t, q, from, to, types, statuses) {
    if (t.archived) return false;
    if (from && (t.date || "") < from) return false;
    if (to && (t.date || "") > to) return false;
    if (q) {
      const hay = `${t.name} ${t.weed} ${t.council}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    const typeOK = ((!types.inspection && !types.spot && !types.road) ||
      (t.type === "Inspection" && types.inspection) ||
      (t.type === "Spot Spray" && types.spot) ||
      (t.type === "Road Shoulder Spray" && types.road));
    if (!typeOK) return false;

    const s = t.status || "Incomplete";
    const statusesEmpty = !statuses.complete && !statuses.incomplete && !statuses.draft;
    const statusOK = statusesEmpty || (s === "Complete" && statuses.complete) || (s === "Incomplete" && statuses.incomplete) || (s === "Draft" && statuses.draft);
    return statusOK;
  }

  function renderRecords() {
    const list = $("#recordsList"); if (!list) return; list.innerHTML = "";
    const q = $("#recSearch").value.trim();
    const from = $("#recFrom").value, to = $("#recTo").value;
    const types = { inspection: $("#fInspection").checked, spot: $("#fSpot").checked, road: $("#fRoad").checked };
    const statuses = { complete: $("#fComplete").checked, incomplete: $("#fIncomplete").checked, draft: $("#fDraft").checked };

    DB.tasks
      .filter(t => recordMatches(t, q, from, to, types, statuses))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .forEach(t => {
        const item = document.createElement("div"); item.className = "item";
        const dAU = formatDateAU(t.date);
        item.innerHTML = `<b>${t.name}</b><br><small>${t.type} • ${dAU} • ${t.status || "Complete"}</small>
          <div class="row end">
            <button class="pill" data-open="${t.id}">Open</button>
            ${t.coords && t.coords.length ? `<button class="pill" data-nav="${t.id}">Navigate</button>` : ""}
          </div>`;
        item.querySelector("[data-open]")?.addEventListener("click", () => showJobPopup(t));
        item.querySelector("[data-nav]")?.addEventListener("click", () => {
          const pt = t.coords?.[0]; if (!pt) { toast("No coords saved"); return; }
          openAppleMaps(pt[0], pt[1]);
        });
        list.appendChild(item);
      });
  }

  // ====== BATCHES (Single-sheet Creator + Search) ======
  $("#batSearchBtn")?.addEventListener("click", renderBatches);
  $("#batResetBtn")?.addEventListener("click", () => { $("#batFrom").value = ""; $("#batTo").value = ""; renderBatches(); });
  $("#newBatch")?.addEventListener("click", openBatchCreator);

  function renderBatches() {
    const list = $("#batchList"); if (!list) return; list.innerHTML = "";
    const from = $("#batFrom").value || "", to = $("#batTo").value || "";

    DB.batches
      .filter(b => (!from || b.date >= from) && (!to || b.date <= to))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .forEach(b => {
        const item = document.createElement("div"); item.className = "item";
        const empty = Number(b.remaining || 0) <= 0;
        item.style.border = empty ? "2px solid #b30000" : "";
        item.innerHTML = `<b>${b.id}</b><br><small>${formatDateAU(b.date)} • Total ${fmt(b.mix)} L • Remaining ${fmt(b.remaining ?? b.mix)} L</small>
          <div class="row end"><button class="pill" data-open="${b.id}">Open</button></div>`;
        item.querySelector("[data-open]")?.addEventListener("click", () => showBatchPopup(b));
        list.appendChild(item);
      });
  }

  function openBatchCreator() {
    // One big sheet — timestamped, add chemicals from inventory with per-100 + unit
    const stampDate = todayISO();
    const stampTime = nowTime();
    const modal = document.createElement("div");
    modal.className = "modal";
    const card = document.createElement("div");
    card.className = "card p";
    card.style.maxWidth = "520px";
    card.innerHTML = `
      <h3 style="margin-top:0">Create Batch</h3>
      <div class="dim">Stamped ${formatDateAU(stampDate)} • ${stampTime}</div>
      <label>Total mix (L)</label>
      <input id="cb_mix" type="number" min="0" step="0.1" value="200"/>
      <div id="cb_chemRows" class="grid gap" style="margin-top:.6rem;"></div>
      <div class="row gap" style="margin:.6rem 0;">
        <button class="pill" id="cb_addChem">+ Add chemical</button>
        <div class="dim" id="cb_totalPreview"></div>
      </div>
      <div class="row gap end">
        <button class="pill" id="cb_create">Create Batch</button>
        <button class="pill warn" id="cb_cancel">Cancel</button>
      </div>
    `;
    modal.appendChild(card);
    document.body.appendChild(modal);
    modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
    $("#cb_cancel", card).onclick = () => modal.remove();

    const rows = $("#cb_chemRows", card);
    function chemRowTemplate() {
      // build select from inventory
      const sel = document.createElement("select");
      sel.className = "in";
      DB.chems.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(c => {
        const o = document.createElement("option");
        o.value = c.name;
        o.textContent = c.name;
        sel.appendChild(o);
      });
      const wrap = document.createElement("div");
      wrap.className = "row gap wrap";
      wrap.style.alignItems = "flex-end";
      wrap.innerHTML = `
        <div style="flex:1;min-width:140px">
          <label>Chemical</label>
        </div>
        <div style="width:110px">
          <label>Per 100</label>
          <input type="number" step="0.01" class="cb_per100" placeholder="e.g. 2">
        </div>
        <div style="width:110px">
          <label>Unit</label>
          <select class="cb_unit">
            <option>mL</option><option>L</option><option>g</option><option>kg</option>
          </select>
        </div>
        <div style="width:140px">
          <label>Total</label>
          <input class="cb_total" readonly placeholder="auto">
        </div>
        <button class="pill warn cb_remove" title="Remove">Remove</button>
      `;
      wrap.children[0].appendChild(sel);
      rows.appendChild(wrap);

      function recalc() {
        const mix = Number($("#cb_mix", card).value || 0);
        const per100 = Number($(".cb_per100", wrap).value || 0);
        const unit = $(".cb_unit", wrap).value;
        const total = (per100 * (mix / 100));
        $(".cb_total", wrap).value = `${total.toFixed(2)} ${unit}`;
        // preview grand total line for liquids (just a helper text)
        $("#cb_totalPreview", card).textContent = `Preview: totals auto-calculated per chemical for ${mix} L mix`;
      }
      $(".cb_per100", wrap).addEventListener("input", recalc);
      $(".cb_unit", wrap).addEventListener("change", recalc);
      $("#cb_mix", card).addEventListener("input", recalc);
      $(".cb_remove", wrap).addEventListener("click", () => wrap.remove());
      recalc();
    }

    $("#cb_addChem", card).onclick = chemRowTemplate;
    // start with one row
    chemRowTemplate();

    $("#cb_create", card).onclick = () => {
      const mix = Number($("#cb_mix", card).value || 0);
      if (!mix) { toast("Enter total mix"); return; }
      const chems = [];
      $$(".row.wrap", rows).forEach(w => {
        const name = $("select", w)?.value || "";
        const per100 = Number($(".cb_per100", w)?.value || 0);
        const unit = $(".cb_unit", w)?.value || "L";
        const totalTxt = $(".cb_total", w)?.value || "";
        chems.push({ name, per100, unit, totalTxt });
      });

      const id = "B" + Date.now();
      const batch = {
        id, date: stampDate, time: stampTime,
        mix, remaining: mix, used: 0,
        chemicals: chems,
        linkedJobs: [],
        dumped: []
      };
      DB.batches.push(batch);
      saveDB();
      populateBatchSelect();
      renderBatches();
      modal.remove();
      toast("Batch created");
    };
  }

  function populateBatchSelect() {
    const sel = $("#batchSelect"); if (!sel) return;
    sel.innerHTML = "";
    sel.appendChild(new Option("— Select Batch —", ""));
    DB.batches.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).forEach(b => {
      const remain = b.remaining ?? b.mix ?? 0;
      const o = new Option(`${b.id} • ${formatDateAU(b.date)} • remain ${fmt(remain)} L`, b.id);
      sel.appendChild(o);
    });
  }
  populateBatchSelect();

  function showBatchPopup(b) {
    const jobs = DB.tasks.filter(t => t.batch === b.id);
    const jobHtml = jobs.length ? `<ul>${jobs.map(t => `<li><a href="#" data-open-job="${t.id}">${t.name}</a></li>`).join("")}</ul>` : "—";
    const chemHtml = Array.isArray(b.chemicals)
      ? `<ul>${b.chemicals.map(c => `<li>${c.name} — ${c.per100}${c.unit}/100L → ${c.totalTxt || ""}</li>`).join("")}</ul>`
      : (b.chemicals || "—");

    const modal = document.createElement("div"); modal.className = "modal";
    const card = document.createElement("div"); card.className = "card p";
    const empty = Number(b.remaining || 0) <= 0;
    card.style.border = empty ? "2px solid #b30000" : "";
    card.innerHTML = `
      <h3 style="margin-top:0">${b.id}</h3>
      <div><b>Date:</b> ${formatDateAU(b.date)} • <b>Time:</b> ${b.time || "—"}</div>
      <div><b>Total Mix:</b> ${fmt(b.mix)} L • <b>Remaining:</b> ${fmt(b.remaining ?? b.mix)} L</div>
      <div style="margin-top:.5rem;"><b>Chemicals:</b><br>${chemHtml}</div>
      <div style="margin-top:.5rem;"><b>Linked Jobs:</b><br>${jobHtml}</div>
      <div style="margin-top:.5rem;"><b>Dumped:</b><br>${
        (b.dumped && b.dumped.length)
          ? `<ul>${b.dumped.map(d => `<li>${d.date} ${d.time} – ${d.amount} L (${d.reason})</li>`).join("")}</ul>`
          : "—"
      }</div>
      <div class="row gap end" style="margin-top:.8rem;">
        <button class="pill" id="bp_edit">Edit</button>
        <button class="pill" id="bp_dump">Dump</button>
        <button class="pill warn" id="bp_close">Close</button>
      </div>
    `;
    modal.appendChild(card);
    document.body.appendChild(modal);
    modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
    $("#bp_close", card).onclick = () => modal.remove();

    $$("[data-open-job]", card).forEach(a => a.addEventListener("click", (e) => {
      e.preventDefault();
      const t = DB.tasks.find(x => String(x.id) === a.dataset.openJob);
      if (t) { modal.remove(); showJobPopup(t); }
    }));

    $("#bp_edit", card).onclick = () => {
      // quick edit of mix/remaining only
      const newMix = Number(prompt("Total mix (L):", b.mix)) || b.mix;
      const newRem = Number(prompt("Remaining (L):", b.remaining ?? b.mix)) || (b.remaining ?? b.mix);
      b.mix = newMix; b.remaining = newRem;
      saveDB(); modal.remove(); renderBatches(); toast("Batch updated");
    };
    $("#bp_dump", card).onclick = () => {
      const dumpAmt = Number(prompt("Dump how many litres?", "0")) || 0;
      if (!(dumpAmt > 0) || dumpAmt > (b.remaining ?? 0)) { alert("Invalid amount"); return; }
      const reason = prompt("Reason for dump?", "Expired/leftover") || "Reason not specified";
      b.remaining = (b.remaining ?? b.mix) - dumpAmt;
      b.dumped ||= [];
      b.dumped.push({ date: todayISO(), time: nowTime(), amount: dumpAmt, reason });
      saveDB(); modal.remove(); renderBatches(); toast("Batch dumped");
    };
  }

  // ====== INVENTORY ======
  $("#addChem")?.addEventListener("click", () => {
    const name = prompt("Chemical name:"); if (!name) return;
    const active = prompt("Active ingredient:", "") || "";
    const size = Number(prompt("Container size (number):", "20")) || 0;
    const unit = prompt("Unit (L, mL, g, kg):", "L") || "L";
    const count = Number(prompt("How many containers:", "0")) || 0;
    const thr = Number(prompt("Reorder threshold (containers):", "0")) || 0;
    DB.chems.push({ name, active, containerSize: size, containerUnit: unit, containers: count, threshold: thr });
    saveDB(); renderChems(); renderProcurement();
  });

  function renderChems() {
    const list = $("#chemList"); if (!list) return; list.innerHTML = "";
    DB.chems.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(c => {
      const total = (c.containers || 0) * (c.containerSize || 0);
      const low = c.threshold && c.containers < c.threshold;
      const card = document.createElement("div"); card.className = "item";
      if (low) card.style.border = "2px dashed #b30000";
      card.innerHTML = `<b>${c.name}</b><br>
        <small>${c.containers || 0} × ${fmt(c.containerSize)} ${c.containerUnit} • total ${fmt(total)} ${c.containerUnit}</small><br>
        <small>Active: ${c.active || "—"}</small>
        <div class="row gap end" style="margin-top:.4rem;">
          <button class="pill" data-edit>Edit</button>
          <button class="pill warn" data-del>Delete</button>
        </div>`;
      card.querySelector("[data-edit]").addEventListener("click", () => openChemEditor(c));
      card.querySelector("[data-del]").addEventListener("click", () => {
        if (!confirm("Delete chemical?")) return;
        DB.chems = DB.chems.filter(x => x !== c);
        saveDB(); renderChems(); renderProcurement();
      });
      list.appendChild(card);
    });
  }
  function openChemEditor(c) {
    const sheet = $("#chemEditSheet"); if (!sheet) return;
    $("#ce_name").value = c.name || "";
    $("#ce_active").value = c.active || "";
    $("#ce_size").value = c.containerSize || 0;
    $("#ce_unit").value = c.containerUnit || "L";
    $("#ce_count").value = c.containers || 0;
    $("#ce_threshold").value = c.threshold || 0;
    sheet.style.display = "flex";
    $("#ce_cancel").onclick = () => sheet.style.display = "none";
    $("#ce_save").onclick = () => {
      c.name = $("#ce_name").value.trim();
      c.active = $("#ce_active").value.trim();
      c.containerSize = Number($("#ce_size").value) || 0;
      c.containerUnit = $("#ce_unit").value || "L";
      c.containers = Number($("#ce_count").value) || 0;
      c.threshold = Number($("#ce_threshold").value) || 0;
      saveDB(); sheet.style.display = "none"; renderChems(); renderProcurement(); toast("Chemical updated");
    };
  }

  function renderProcurement() {
    const ul = $("#procList"); if (!ul) return; ul.innerHTML = "";
    DB.chems.forEach(c => {
      if (c.threshold && (c.containers || 0) < c.threshold) {
        const li = document.createElement("li");
        li.textContent = `Low stock: ${c.name} (${c.containers || 0} < ${c.threshold})`;
        ul.appendChild(li);
      }
    });
  }

  // ====== MAPPING (Leaflet + Locate Me) ======
  let map, locateCtrl;
  function ensureMap() {
    if (map) return map;
    map = L.map("map").setView([-34.75, 148.65], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

    // Locate Me (top-right-ish)
    locateCtrl = L.control({ position: "topright" });
    locateCtrl.onAdd = function () {
      const d = L.DomUtil.create("div", "leaflet-bar");
      d.style.background = "#16834c"; d.style.color = "#fff"; d.style.borderRadius = "6px";
      d.style.padding = "6px 10px"; d.style.cursor = "pointer"; d.innerText = "Locate Me";
      d.onclick = () => {
        if (!navigator.geolocation) { toast("Enable Location"); return; }
        navigator.geolocation.getCurrentPosition(p => {
          const pt = [p.coords.latitude, p.coords.longitude];
          map.setView(pt, 14);
          L.circleMarker(pt, { radius: 7, opacity: .9 }).addTo(map).bindPopup("You are here").openPopup();
        });
      };
      return d;
    };
    locateCtrl.addTo(map);
    return map;
  }

  $("#mapSearchBtn")?.addEventListener("click", () => renderMap(true));
  $("#mapResetBtn")?.addEventListener("click", () => { $("#mapFrom").value = ""; $("#mapTo").value = ""; $("#mapWeed").value = ""; $("#mapType").value = "All"; renderMap(true); });

  function openAppleMaps(lat, lon) {
    const mapsURL = `maps://?daddr=${lat},${lon}&dirflg=d`;
    const webURL = `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
    const a = document.createElement("a");
    a.href = mapsURL; document.body.appendChild(a); a.click();
    setTimeout(() => { window.open(webURL, "_blank"); a.remove(); }, 250);
  }

  function renderMap(fit = false) {
    const m = ensureMap();
    // remove all non-tile layers
    m.eachLayer(l => { if (!(l instanceof L.TileLayer)) m.removeLayer(l); });

    const from = $("#mapFrom").value || "", to = $("#mapTo").value || "";
    const typ = $("#mapType").value || "All";
    const weedQ = ($("#mapWeed")?.value || "").trim().toLowerCase();

    const tasks = DB.tasks
      .filter(t => !t.archived)
      .filter(t => (!from || t.date >= from) && (!to || t.date <= to))
      .filter(t => typ === "All" ? true : t.type === typ || (typ === "Road Spray" && t.type === "Road Shoulder Spray")) // allow legacy filter name
      .filter(t => weedQ ? (String(t.weed || "").toLowerCase().includes(weedQ)) : true);

    const group = L.featureGroup();

    tasks.forEach(t => {
      if (t.coords?.length > 1) group.addLayer(L.polyline(t.coords, { color: "yellow", weight: 4, opacity: .9 }));
      const pt = t.coords?.[0] || null;
      if (pt) {
        const openId = `open_${t.id}`;
        const navId = `nav_${t.id}`;
        const popup = `<b>${t.name}</b><br>${t.type} • ${formatDateAU(t.date)}
                       <br><button id="${openId}" class="pill" style="margin-top:.35rem">Open</button>
                       <button id="${navId}" class="pill" style="margin-top:.35rem;margin-left:.4rem">Navigate</button>`;
        const marker = L.marker(pt);
        marker.bindPopup(popup);
        marker.on("popupopen", () => {
          setTimeout(() => {
            const ob = document.getElementById(openId);
            const nb = document.getElementById(navId);
            ob && (ob.onclick = () => showJobPopup(t));
            nb && (nb.onclick = () => openAppleMaps(pt[0], pt[1]));
          }, 0);
        });
        group.addLayer(marker);
      }
    });

    group.addTo(m);
    if (fit && tasks.length) {
      try { m.fitBounds(group.getBounds().pad(0.2)); } catch { /* ignore */ }
    }
    // draw last tracked for quick visual
    try {
      const last = JSON.parse(localStorage.getItem("lastTrack") || "[]");
      if (Array.isArray(last) && last.length > 1) L.polyline(last, { color: "#ffda44", weight: 3, opacity: .8 }).addTo(m);
    } catch { /* ignore */ }
  }

  // ====== JOB POPUP ======
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { const m = $(".modal"); if (m) m.remove(); } });

  function showJobPopup(t) {
    const modal = document.createElement("div"); modal.className = "modal";
    const card = document.createElement("div"); card.className = "card p";
    const batchLink = t.batch ? `<a href="#" data-open-batch="${t.batch}">${t.batch}</a>` : "—";
    const linkedInsp = t.linkedInspectionId ? `<a href="#" data-open-insp="${t.linkedInspectionId}">${t.linkedInspectionId}</a>` : "—";
    const photoHtml = t.photo ? `<div style="margin:.4rem 0"><img src="${t.photo}" alt="photo" style="max-width:100%;border-radius:8px"/></div>` : "";
    const hasPt = t.coords && t.coords.length;

    card.innerHTML = `
      <h3 style="margin-top:0">${t.name}</h3>
      <div class="grid two tight">
        <div><b>Type:</b> ${t.type}</div><div><b>Status:</b> ${t.status || "Complete"}</div>
        <div><b>Date:</b> ${formatDateAU(t.date)}</div>
        <div><b>Start:</b> ${t.start || "–"} · <b>Finish:</b> ${t.end || "–"}</div>
        <div><b>Weed:</b> ${t.weed || "—"}</div><div><b>Batch:</b> ${batchLink}</div>
        <div><b>Linked Inspection:</b> ${linkedInsp}</div><div><b>Reminder:</b> ${t.reminder || "—"} wk</div>
        <div class="span2"><b>Weather:</b> ${fmt(t.temp)}°C, ${fmt(t.wind)} km/h, ${t.windDir || "–"}, ${fmt(t.humidity)}%</div>
        <div class="span2"><b>Notes:</b> ${t.notes || "—"}</div>
      </div>
      ${photoHtml}
      <div class="row gap end" style="margin-top:.8rem;">
        ${hasPt ? `<button class="pill" data-nav>Navigate</button>` : ""}
        <button class="pill" data-edit>Edit</button>
        <button class="pill warn" data-close>Close</button>
      </div>
    `;
    modal.appendChild(card);
    document.body.appendChild(modal);
    modal.addEventListener("click", e => { if (e.target === modal || e.target.dataset.close != null) modal.remove(); });

    $("[data-open-batch]", card)?.addEventListener("click", (e) => { e.preventDefault(); const b = DB.batches.find(x => x.id === t.batch); if (b) { modal.remove(); showBatchPopup(b); } });
    $("[data-open-insp]", card)?.addEventListener("click", (e) => { e.preventDefault(); const insp = DB.tasks.find(x => x.type === "Inspection" && (String(x.id) === t.linkedInspectionId || x.name === t.linkedInspectionId)); insp && (modal.remove(), showJobPopup(insp)); });
    $("[data-edit]", card)?.addEventListener("click", () => {
      switchScreen("createTask");
      $("#jobName").value = t.name; $("#councilNum").value = t.council || ""; $("#linkInspectionId").value = t.linkedInspectionId || "";
      $("#taskType").value = t.type; $("#taskType").dispatchEvent(new Event("change"));
      $("#weedSelect").value = t.weed || ""; $("#batchSelect").value = t.batch || "";
      $("#jobDate").value = t.date || todayISO(); $("#startTime").value = t.start || ""; $("#endTime").value = t.end || "";
      $("#temp").value = t.temp || ""; $("#wind").value = t.wind || ""; $("#windDir").value = t.windDir || ""; $("#humidity").value = t.humidity || "";
      $("#notes").value = t.notes || "";
      if (t.photo) { $("#photoPreview").src = t.photo; $("#photoPreview").style.display = "block"; }
      modal.remove();
    });
    $("[data-nav]", card)?.addEventListener("click", () => {
      const pt = t.coords?.[0]; if (!pt) { toast("No coords saved"); return; }
      openAppleMaps(pt[0], pt[1]);
    });
  }

})();
