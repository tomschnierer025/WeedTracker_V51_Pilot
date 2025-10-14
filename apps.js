/* === WeedTracker V56 Pilot (Light) === */
/* Main App Logic – complete, no placeholders */

(function () {
  // ---------- Utilities ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const fmt = (n, d = 0) => (n === undefined || n === null || n === "") ? "–" : Number(n).toFixed(d);
  const today = () => new Date().toISOString().slice(0, 10);
  const nowTime = () => new Date().toTimeString().slice(0, 5);

  // ---------- Storage ----------
  const STORAGE_KEY = "weedtracker_data";

  const NSW_WEEDS_40 = [
    // --- Noxious (pinned first, alphabetical inside group) ---
    "African Boxthorn (noxious)","African Lovegrass (noxious)","Bathurst Burr (noxious)","Blackberry (noxious)",
    "Cape Broom (noxious)","Chilean Needle Grass (noxious)","Coolatai Grass (noxious)","Fireweed (noxious)",
    "Gorse (noxious)","Lantana (noxious)","Patterson’s Curse (noxious)","Serrated Tussock (noxious)",
    "St John’s Wort (noxious)","Sweet Briar (noxious)","Willow spp. (noxious)",
    // --- Common roadside (A→Z) ---
    "African Feathergrass","Artichoke Thistle","Balloon Vine","Blue Heliotrope","Bridal Creeper","Caltrop",
    "Coltsfoot","Fleabane","Flax-leaf Broom","Fountain Grass","Galvanised Burr","Giant Parramatta Grass",
    "Glycine","Green Cestrum","Horehound","Khaki Weed","Noogoora Burr","Parthenium Weed","Prickly Pear (common)",
    "Saffron Thistle","Silverleaf Nightshade","Spear Thistle","Sweet Vernal Grass","Three-cornered Jack","Wild Radish"
  ];

  function ensureDB() {
    let db = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    db.version ??= 56;
    db.accountEmail ??= "";
    db.tasks ??= [];
    db.batches ??= [];
    db.chems ??= [];
    db.procurement ??= [];
    db.weeds ??= NSW_WEEDS_40.slice(); // allow override later; default to 40
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return db;
  }
  let DB = ensureDB();
  const saveDB = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));

  // ---------- Screens / Nav ----------
  document.addEventListener("DOMContentLoaded", () => {
    const screens = $$(".screen");
    const homeBtn = $("#homeBtn");

    // nav from tiles
    $$( "[data-target]" ).forEach(btn => btn.addEventListener("click", () => switchScreen(btn.dataset.target)));
    homeBtn?.addEventListener("click", () => switchScreen("home"));
    function switchScreen(id) {
      screens.forEach(s => s.classList.remove("active"));
      $("#" + id)?.classList.add("active");
      if (id === "records") renderRecords();
      if (id === "batches") renderBatches();
      if (id === "inventory") renderChems();
      if (id === "mapping") renderMap();
    }

    // splash
    setTimeout(() => { $("#splash")?.remove(); }, 800);

    // spinner
    const spinner = $("#spinner");
    const spin = (on) => on ? spinner.classList.add("active") : spinner.classList.remove("active");

    // account
    const accountInput = $("#accountEmail");
    accountInput && (accountInput.value = DB.accountEmail || "");
    $("#saveAccount")?.addEventListener("click", () => {
      DB.accountEmail = accountInput.value.trim();
      saveDB();
      alert("Saved.");
    });

    // reminder options
    const remSel = $("#reminderWeeks");
    if (remSel && !remSel.options.length) {
      for (let i = 1; i <= 52; i++) {
        const o = document.createElement("option");
        o.value = String(i); o.textContent = i;
        remSel.appendChild(o);
      }
    }

    // --------- Create Task wiring ---------
    const locateBtn = $("#locateBtn");
    const locRoad = $("#locRoad");
    let currentRoad = "";

    locateBtn?.addEventListener("click", async () => {
      spin(true);
      if (!navigator.geolocation) {
        alert("Geolocation not supported.");
        spin(false); return;
      }
      navigator.geolocation.getCurrentPosition(async pos => {
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
          const j = await res.json();
          currentRoad = j.address?.road || j.display_name || `${fmt(lat,5)}, ${fmt(lon,5)}`;
          locRoad.textContent = currentRoad;
        } catch {
          locRoad.textContent = `${fmt(lat,5)}, ${fmt(lon,5)}`;
        }
        spin(false);
      }, () => { spin(false); alert("Could not get GPS."); });
    });

    $("#autoNameBtn")?.addEventListener("click", () => {
      const t = $("#taskType").value;
      const prefix = (t || "Task").split(" ").map(w=>w[0]).join("").toUpperCase(); // I / S / RS
      const date = today().replaceAll("-", "");
      const base = currentRoad || "UnnamedRoad";
      $("#jobName").value = `${prefix}${date}_${base.replace(/\s+/g, "")}`;
    });

    // Show/hide Roadside tracking controls
    const roadTrackBlock = $("#roadTrackBlock");
    const taskTypeSel = $("#taskType");
    const syncTrackVis = () => roadTrackBlock.style.display = (taskTypeSel.value === "Road Spray") ? "block" : "none";
    taskTypeSel?.addEventListener("change", syncTrackVis);
    syncTrackVis();

    // Weather (on-demand via button)
    $("#autoWeatherBtn")?.addEventListener("click", async () => {
      if (!navigator.geolocation) { alert("Enable location services."); return; }
      navigator.geolocation.getCurrentPosition(async pos => {
        const { latitude, longitude } = pos.coords;
        try {
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;
          const r = await fetch(url); const j = await r.json(); const c = j.current || {};
          $("#temp").value = c.temperature_2m ?? "";
          $("#wind").value = c.wind_speed_10m ?? "";
          $("#windDir").value = (c.wind_direction_10m ?? "") + (c.wind_direction_10m != null ? "°" : "");
          $("#humidity").value = c.relative_humidity_2m ?? "";
          $("#wxUpdated").textContent = "Updated @ " + nowTime();
        } catch { alert("Weather lookup failed."); }
      }, ()=> alert("Location not available."));
    });

    // Populate weeds (noxious pinned)
    function populateWeeds() {
      const sel = $("#weedSelect");
      if (!sel) return;
      sel.innerHTML = "";
      const nox = DB.weeds.filter(w => /noxious/i.test(w)).sort((a,b)=>a.localeCompare(b));
      const rest = DB.weeds.filter(w => !/noxious/i.test(w)).sort((a,b)=>a.localeCompare(b));
      const options = ["— Select Weed —", ...nox, ...rest];
      options.forEach(w => {
        const o = document.createElement("option");
        o.value = w === "— Select Weed —" ? "" : w;
        o.textContent = w;
        sel.appendChild(o);
      });
    }
    populateWeeds();

    // Populate batch select
    function populateBatchSelect() {
      const sel = $("#batchSelect");
      if (!sel) return;
      sel.innerHTML = "";
      const def = document.createElement("option"); def.value = ""; def.textContent = "— Select Batch —";
      sel.appendChild(def);
      DB.batches
        .slice()
        .sort((a,b)=> (b.date||"").localeCompare(a.date||""))
        .forEach(b=>{
          const o = document.createElement("option");
          o.value = b.id; o.textContent = `${b.id} • ${b.date} • remain ${fmt(b.remaining,0)} L`;
          sel.appendChild(o);
        });
    }
    populateBatchSelect();

    // Tracking (coords every 5s)
    let tracking = false, trackTimer = null, trackCoords = [];
    $("#startTrack")?.addEventListener("click", () => {
      trackCoords = []; tracking = true;
      $("#trackStatus").textContent = "Tracking…";
      if (trackTimer) clearInterval(trackTimer);
      if (!navigator.geolocation) { alert("Enable location services."); return; }
      trackTimer = setInterval(() => {
        navigator.geolocation.getCurrentPosition(pos => {
          trackCoords.push([pos.coords.latitude, pos.coords.longitude]);
        }, ()=>{});
      }, 5000);
    });
    $("#stopTrack")?.addEventListener("click", () => {
      tracking = false;
      if (trackTimer) clearInterval(trackTimer);
      $("#trackStatus").textContent = "Stopped (" + trackCoords.length + " pts)";
    });

    // Save / Draft
    $("#saveTask")?.addEventListener("click", ()=> saveTask(false));
    $("#saveDraft")?.addEventListener("click", ()=> saveTask(true));

    function saveTask(isDraft) {
      spin(true);
      const id = Date.now(); // simple unique
      const status = isDraft ? "Draft" : ($("input[name='status']:checked")?.value || "Incomplete");
      const obj = {
        id,
        name: $("#jobName").value.trim() || ("Task_" + id),
        council: $("#councilNum").value.trim(),
        linkedInspectionId: $("#linkInspectionId").value.trim(),
        type: $("#taskType").value,
        weed: $("#weedSelect").value,
        batch: $("#batchSelect").value,
        date: $("#jobDate").value || today(),
        start: $("#startTime").value || "",
        end: $("#endTime").value || "",
        temp: $("#temp").value, wind: $("#wind").value,
        windDir: $("#windDir").value, humidity: $("#humidity").value,
        reminder: $("#reminderWeeks").value || "",
        status,
        notes: $("#notes").value || "",
        coords: trackCoords.slice(),
        createdAt: new Date().toISOString(),
        archived: false
      };

      // Upsert by name (edit without duplicate)
      const existing = DB.tasks.find(t => t.name === obj.name);
      if (existing) Object.assign(existing, obj);
      else DB.tasks.push(obj);

      // If linking an inspection, archive it and attach reference
      if (obj.linkedInspectionId) {
        const target = DB.tasks.find(t =>
          t.type === "Inspection" && (String(t.id) === obj.linkedInspectionId || t.name === obj.linkedInspectionId)
        );
        if (target) {
          target.archived = true;
          target.status = "Archived";
          obj.linkedInspectionResolved = true;
        }
      }

      // consume batch remaining if selected
      if (obj.batch) {
        const b = DB.batches.find(x => x.id === obj.batch);
        if (b) {
          const used = estimateUsedFromCoords(obj); // simple heuristic: 100 L if road spray + coords
          b.used = (b.used || 0) + used;
          b.remaining = Math.max(0, (Number(b.mix)||0) - (b.used||0));
        }
      }

      saveDB();
      populateBatchSelect();
      renderRecords();
      renderMap();
      spin(false);
      alert("Saved.");
    }

    function estimateUsedFromCoords(task) {
      if (!task.coords || task.coords.length < 2) return 0;
      // simple: road spray defaults to 100 L, otherwise 0
      return task.type === "Road Spray" ? 100 : 0;
    }

    // ---------- Records (Search / Reset + pop-ups) ----------
    $("#recSearchBtn")?.addEventListener("click", renderRecords);
    $("#recResetBtn")?.addEventListener("click", () => {
      $("#recSearch").value = ""; $("#recFrom").value = ""; $("#recTo").value = "";
      ["fInspection","fSpot","fRoad","fComplete","fIncomplete","fDraft"].forEach(id=>{ const el=$("#"+id); if (el) el.checked = true; });
      renderRecords();
    });

    function recordMatches(t, q, from, to, typeFlags, statusFlags) {
      if (t.archived) return false;
      if (from && (t.date||"") < from) return false;
      if (to && (t.date||"") > to) return false;

      if (q) {
        const hay = `${t.name} ${t.weed} ${t.council}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }

      const typeOK =
        (t.type==="Inspection" && typeFlags.inspection) ||
        (t.type==="Spot Spray" && typeFlags.spot) ||
        (t.type==="Road Spray" && typeFlags.road);
      if (!typeOK) return false;

      const s = t.status || (t.draft ? "Draft" : "Incomplete");
      const statusOK =
        (s==="Complete" && statusFlags.complete) ||
        (s==="Incomplete" && statusFlags.incomplete) ||
        (s==="Draft" && statusFlags.draft);
      return statusOK;
    }

    function renderRecords() {
      const list = $("#recordsList"); if (!list) return; list.innerHTML = "";
      const q = $("#recSearch")?.value?.trim() || "";
      const from = $("#recFrom")?.value || "";
      const to = $("#recTo")?.value || "";
      const typeFlags = {
        inspection: $("#fInspection")?.checked,
        spot: $("#fSpot")?.checked,
        road: $("#fRoad")?.checked
      };
      const statusFlags = {
        complete: $("#fComplete")?.checked,
        incomplete: $("#fIncomplete")?.checked,
        draft: $("#fDraft")?.checked
      };

      const rows = DB.tasks
        .filter(t => recordMatches(t, q, from, to, typeFlags, statusFlags))
        .sort((a,b)=> (b.date||"").localeCompare(a.date||""));

      rows.forEach(t => {
        const div = document.createElement("div");
        div.className = "item";
        div.innerHTML =
          `<b>${t.name}</b><br><small>${t.type} • ${t.date} • ${t.status}</small>
           <div class="row end"><button class="pill" data-open="${t.id}">Open</button></div>`;
        div.querySelector("[data-open]")?.addEventListener("click", ()=> showJobPopup(t));
        list.appendChild(div);
      });
    }
    renderRecords();
    function showJobPopup(t) {
      const batchLink = t.batch ? `<a href="#" data-open-batch="${t.batch}">${t.batch}</a>` : "–";
      const linkedInsp = t.linkedInspectionId ? `<a href="#" data-open-insp="${t.linkedInspectionId}">${t.linkedInspectionId}</a>` : "—";
      const html = `
        <div class="modal">
          <div class="card p">
            <h3 style="margin-top:0">${t.name}</h3>
            <div class="grid two tight">
              <div><b>Type:</b> ${t.type}</div><div><b>Status:</b> ${t.status}</div>
              <div><b>Date:</b> ${t.date || "–"}</div><div><b>Start:</b> ${t.start || "–"} &nbsp; <b>Finish:</b> ${t.end || "–"}</div>
              <div><b>GPS:</b> ${t.coords?.length ? `${fmt(t.coords[0][0],5)}, ${fmt(t.coords[0][1],5)}` : "—"}</div>
              <div><b>Weed:</b> ${t.weed || "—"}</div>
              <div><b>Batch:</b> ${batchLink}</div>
              <div><b>Linked Inspection:</b> ${linkedInsp}</div>
              <div class="span2"><b>Weather:</b> ${fmt(t.temp)}°C, ${fmt(t.wind)} km/h, ${t.windDir||"–"}, ${fmt(t.humidity)}%</div>
              <div class="span2"><b>Notes:</b> ${t.notes || "—"}</div>
            </div>
            <div class="row gap end" style="margin-top:.8rem;">
              <button class="pill" data-complete>Mark Complete</button>
              <button class="pill" data-edit>Edit</button>
              <button class="pill warn" data-close>Close</button>
            </div>
          </div>
        </div>`;
      const wrap = document.createElement("div"); wrap.innerHTML = html; document.body.appendChild(wrap.firstChild);
      const modal = $(".modal");
      modal?.addEventListener("click", (e)=>{ if (e.target === modal || e.target.dataset.close!=null) modal.remove(); });

      // link to batch/inspection
      $("[data-open-batch]", modal)?.addEventListener("click", (e)=>{ e.preventDefault(); const b = DB.batches.find(x=>x.id===t.batch); b && showBatchPopup(b); });
      $("[data-open-insp]", modal)?.addEventListener("click", (e)=>{ e.preventDefault();
        const insp = DB.tasks.find(x => x.type==="Inspection" && (String(x.id)===t.linkedInspectionId || x.name===t.linkedInspectionId));
        insp && showJobPopup(insp);
      });

      $("[data-complete]", modal)?.addEventListener("click", ()=>{
        t.status = "Complete"; saveDB(); modal.remove(); renderRecords();
      });
      $("[data-edit]", modal)?.addEventListener("click", ()=>{
        // basic edit -> loads into form
        switchScreen("createTask");
        $("#jobName").value = t.name;
        $("#councilNum").value = t.council || "";
        $("#linkInspectionId").value = t.linkedInspectionId || "";
        $("#taskType").value = t.type; const evt = new Event("change"); $("#taskType").dispatchEvent(evt);
        $("#weedSelect").value = t.weed || "";
        $("#batchSelect").value = t.batch || "";
        $("#jobDate").value = t.date || today();
        $("#startTime").value = t.start || "";
        $("#endTime").value = t.end || "";
        $("#temp").value = t.temp || "";
        $("#wind").value = t.wind || "";
        $("#windDir").value = t.windDir || "";
        $("#humidity").value = t.humidity || "";
        $("#notes").value = t.notes || "";
        modal.remove();
      });
    }

    // ---------- Batches ----------
    $("#batSearchBtn")?.addEventListener("click", renderBatches);
    $("#batResetBtn")?.addEventListener("click", ()=>{ $("#batFrom").value=""; $("#batTo").value=""; renderBatches(); });

    $("#newBatch")?.addEventListener("click", ()=>{
      const id = "B" + Date.now();
      const mix = Number(prompt("Total mix (L):", "600")) || 0;
      const chemicals = prompt("Chemicals (e.g. 'Crucial 1.5L/100L, Wetter 300mL/100L'):", "") || "";
      const obj = { id, date: today(), time: nowTime(), mix, remaining: mix, used: 0, chemicals };
      DB.batches.push(obj); saveDB(); populateBatchSelect(); renderBatches();
    });

    function renderBatches() {
      const list = $("#batchList"); if (!list) return; list.innerHTML = "";
      const from = $("#batFrom")?.value || ""; const to = $("#batTo")?.value || "";
      DB.batches
        .filter(b => (!from || b.date >= from) && (!to || b.date <= to))
        .sort((a,b)=> (b.date||"").localeCompare(a.date||""))
        .forEach(b=>{
          const item = document.createElement("div");
          item.className = "item";
          item.innerHTML =
            `<b>${b.id}</b><br><small>${b.date} • Total ${fmt(b.mix)} L • Remaining ${fmt(b.remaining)} L</small>
             <div class="row end"><button class="pill" data-open="${b.id}">Open</button></div>`;
          item.querySelector("[data-open]")?.addEventListener("click", ()=> showBatchPopup(b));
          list.appendChild(item);
        });
    }
    renderBatches();

    function estimateUsedFromCoords(task) {
      if (!task.coords || task.coords.length < 2) return 0;
      // simple: road spray defaults to 100 L, otherwise 0
      return task.type === "Road Spray" ? 100 : 0;
    }

    function showBatchPopup(b) {
      // collect linked jobs
      const jobs = DB.tasks.filter(t => t.batch === b.id);
      const jobsHtml = jobs.length
        ? `<ul>${jobs.map(t=>`<li><a href="#" data-open-job="${t.id}">${t.name}</a> · used ${estimateUsedFromCoords(t)} L</li>`).join("")}</ul>`
        : "—";

      const html = `
        <div class="modal">
          <div class="card p">
            <h3 style="margin-top:0">${b.id}</h3>
            <div><b>Date:</b> ${b.date || "–"} &nbsp; <b>Time:</b> ${b.time || "–"}</div>
            <div><b>Total Mix Made:</b> ${fmt(b.mix)} L</div>
            <div><b>Total Mix Remaining:</b> ${fmt(b.remaining)} L</div>
            <div style="margin-top:.5rem;"><b>Chemicals (made of):</b><br>${b.chemicals || "—"}</div>
            <div style="margin-top:.5rem;"><b>Linked Jobs:</b><br>${jobsHtml}</div>
            <div class="row gap end" style="margin-top:.8rem;">
              <button class="pill" data-edit-batch>Edit</button>
              <button class="pill warn" data-close>Close</button>
            </div>
          </div>
        </div>`;
      const wrap = document.createElement("div"); wrap.innerHTML = html; document.body.appendChild(wrap.firstChild);
      const modal = $(".modal");
      modal?.addEventListener("click", (e)=>{ if (e.target === modal || e.target.dataset.close!=null) modal.remove(); });

      // open job links
      $$("[data-open-job]", modal).forEach(a=>{
        a.addEventListener("click", (e)=>{ e.preventDefault(); const t = DB.tasks.find(x=> String(x.id)===a.dataset.openJob); t && showJobPopup(t); });
      });

      // edit (no duplicate: update in place)
      $("[data-edit-batch]", modal)?.addEventListener("click", ()=>{
        const mix = Number(prompt("Total mix (L):", b.mix)) || b.mix;
        const rem = Number(prompt("Remaining (L):", b.remaining)) || b.remaining;
        const chems = prompt("Chemicals:", b.chemicals || "") || b.chemicals || "";
        b.mix = mix; b.remaining = rem; b.chemicals = chems; b.time ||= nowTime();
        saveDB(); modal.remove(); renderBatches(); populateBatchSelect();
      });
    }

    // ---------- Procurement ----------
    function upsertProcurement(title) {
      if (!DB.procurement.find(p => p.title === title)) {
        DB.procurement.push({ id: "P"+Date.now()+Math.random().toString(16).slice(2), title, createdAt: new Date().toISOString(), done:false });
        saveDB();
      }
    }

    // ---------- Inventory ----------
    $("#addChem")?.addEventListener("click", ()=>{
      const name = prompt("Chemical name:"); if (!name) return;
      const active = prompt("Active ingredient (e.g., Glyphosate):") || "";
      const containerSize = Number(prompt("Container size (numeric, e.g., 20):", "20")) || 0;
      const containerUnit = prompt("Container unit (L, mL, g):", "L") || "L";
      const containers = Number(prompt("How many containers:", "0")) || 0;
      const threshold = Number(prompt("Reorder threshold (containers):", "0")) || 0;
      DB.chems.push({ name, active, containerSize, containerUnit, containers, threshold });
      saveDB(); renderChems();
    });

    function renderChems() {
      const list = $("#chemList"); if (!list) return; list.innerHTML = "";
      DB.chems.slice().sort((a,b)=> a.name.localeCompare(b.name)).forEach(c=>{
        const total = c.containers * (c.containerSize||0);
        const line = `${c.containers} × ${fmt(c.containerSize)} ${c.containerUnit} • total ${fmt(total)} ${c.containerUnit}`;
        const card = document.createElement("div");
        card.className = "item";
        card.innerHTML =
          `<b>${c.name}</b><br><small>${line}</small><br><small>Active: ${c.active || "—"}</small>
           <div class="row gap end" style="margin-top:.4rem;">
             <button class="pill" data-edit>Edit</button>
             <button class="pill warn" data-del>Delete</button>
           </div>`;
        // low-stock reminder -> procurement
        if (c.threshold && c.containers < c.threshold) {
          upsertProcurement(`Low stock: ${c.name}`);
        }

        card.querySelector("[data-edit]")?.addEventListener("click", ()=>{
          const active = prompt("Active ingredient:", c.active || "") || c.active || "";
          const size = Number(prompt("Container size:", c.containerSize)) || c.containerSize || 0;
          const unit = prompt("Unit (L, mL, g):", c.containerUnit || "L") || c.containerUnit || "L";
          const count = Number(prompt("How many containers:", c.containers)) || c.containers || 0;
          const thr = Number(prompt("Reorder threshold (containers):", c.threshold||0)) || (c.threshold||0);
          c.active = active; c.containerSize = size; c.containerUnit = unit; c.containers = count; c.threshold = thr;
          saveDB(); renderChems();
        });
        card.querySelector("[data-del]")?.addEventListener("click", ()=>{
          if (!confirm("Delete chemical?")) return;
          DB.chems = DB.chems.filter(x=> x!==c); saveDB(); renderChems();
        });
        list.appendChild(card);
      });
    }
    renderChems();
    // ---------- Mapping ----------
    let map;
    function ensureMap() {
      if (map) return map;
      map = L.map("map").setView([-34.75, 148.65], 9);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      return map;
    }

    $("#mapSearchBtn")?.addEventListener("click", renderMap);
    $("#mapResetBtn")?.addEventListener("click", ()=>{
      $("#mapFrom").value=""; $("#mapTo").value=""; $("#mapType").value="All"; renderMap();
    });

    function renderMap() {
      const m = ensureMap();
      // wipe existing layers except tiles
      m.eachLayer(l => { if (!(l instanceof L.TileLayer)) m.removeLayer(l); });

      const from = $("#mapFrom")?.value || ""; const to = $("#mapTo")?.value || ""; const typ = $("#mapType")?.value || "All";
      const tasks = DB.tasks.filter(t => !t.archived)
        .filter(t => (!from || t.date >= from) && (!to || t.date <= to))
        .filter(t => typ==="All" ? true : t.type === typ);

      tasks.forEach(t=>{
        // line for road spray track
        if (t.coords?.length > 1) {
          L.polyline(t.coords, { color: "yellow", weight: 4, opacity: 0.9 }).addTo(m);
        }
        // pin at first coord or a dummy centroid if none
        const pt = t.coords?.[0] || [-34.75 + Math.random()*0.1, 148.65 + Math.random()*0.1];
        const popup = `<b>${t.name}</b><br>${t.type} • ${t.date}<br><button id="open_${t.id}" class="pill">Open</button>`;
        const marker = L.marker(pt).addTo(m).bindPopup(popup);
        marker.on("popupopen", ()=>{
          setTimeout(()=>{ const btn = document.getElementById(`open_${t.id}`); btn && (btn.onclick = ()=> showJobPopup(t)); }, 0);
        });
      });

      if (tasks.length && tasks[0].coords?.length) m.setView(tasks[0].coords[0], 11);
    }

    // ---------- Export / Clear ----------
    $("#exportBtn")?.addEventListener("click", ()=>{
      const blob = new Blob([JSON.stringify(DB, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = "weedtracker_data.json"; a.click();
    });
    $("#clearBtn")?.addEventListener("click", ()=>{
      if (!confirm("Clear ALL local data?")) return;
      localStorage.removeItem(STORAGE_KEY); DB = ensureDB();
      renderRecords(); renderBatches(); renderChems(); renderMap();
    });

    // initial renders
    renderRecords(); renderBatches(); renderChems();

  }); // DOMContentLoaded end
})();
