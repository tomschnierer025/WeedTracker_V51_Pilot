/* === WeedTracker V60 Pilot — apps.js (FULL) === */
(() => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const fmt = (n,d=0)=> (n==null||n==="")?"–":Number(n).toFixed(d);

  const { load, save, restoreLatest } = window.WTStorage;
  const EX = window.WTExtras;
  const BATS = window.WTBatches;
  const SETS = window.WTSettings;

  // Seeds
  const NSW_WEEDS_40 = [
    "Noxious Weeds (category)",
    "African Lovegrass (noxious)","Blackberry (noxious)","Serrated Tussock (noxious)","Cape Broom (noxious)","Chilean Needle Grass (noxious)",
    "St John’s Wort (noxious)","Sweet Briar (noxious)","Gorse (noxious)","Lantana (noxious)","Fireweed (noxious)","Bathurst Burr (noxious)",
    "Patterson’s Curse (noxious)","Willow spp. (noxious)","Coolatai Grass (noxious)","African Boxthorn (noxious)",
    "African Feathergrass","Artichoke Thistle","Balloon Vine","Blue Heliotrope","Bridal Creeper","Caltrop",
    "Coltsfoot","Fleabane","Flax-leaf Broom","Fountain Grass","Galvanised Burr","Giant Parramatta Grass",
    "Glycine","Green Cestrum","Horehound","Khaki Weed","Noogoora Burr","Parthenium Weed","Prickly Pear (common)",
    "Saffron Thistle","Silverleaf Nightshade","Spear Thistle","Sweet Vernal Grass","Three-cornered Jack","Wild Radish"
  ];
  const DEFAULT_CHEMS = [
    {name:"Crucial", active:"Glyphosate 540 g/L", containerSize:20, containerUnit:"L", containers:4, threshold:2},
    {name:"SuperWet", active:"Non-ionic surfactant", containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Bow Saw 600", active:"Triclopyr 600 g/L", containerSize:1, containerUnit:"L", containers:2, threshold:1},
    {name:"Clethodim", active:"Clethodim 240 g/L", containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Grazon", active:"Triclopyr + Picloram", containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Bosol", active:"Metsulfuron-methyl", containerSize:500, containerUnit:"g", containers:2, threshold:1},
    {name:"Hastings", active:"MCPA", containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Outright", active:"Fluroxypyr", containerSize:20, containerUnit:"L", containers:1, threshold:1}
  ];
  const TYPE_PREFIX = { "Inspection":"I", "Spot Spray":"SS", "Road Spray":"RS" };

  // DB
  let DB = load();
  if (!DB || typeof DB !== "object") DB = {};
  DB.version ??= 60;
  DB.tasks ??= [];
  DB.batches ??= [];
  DB.chems ??= [];
  DB.procurement ??= [];
  DB.weeds ??= DB.weeds?.length ? DB.weeds : NSW_WEEDS_40.slice();
  if (!DB.chems.length) DB.chems = DEFAULT_CHEMS.slice();
  save(DB, false);

  const saveDB = (withBackup = true) => save(DB, withBackup);

  // Splash fade
  window.addEventListener("load", () => {
    setTimeout(() => { $("#splash")?.remove(); }, 1200);
  });

  // Navigation
  function switchScreen(id){
    $$(".screen").forEach(s => s.classList.remove("active"));
    $("#"+id)?.classList.add("active");
    if (id === "records") renderRecords();
    if (id === "batches") BATS.renderBatches(DB, { save: saveDB, populateBatchSelect });
    if (id === "inventory") renderChems();
    if (id === "mapping") renderMap(true);
    if (id === "procurement") renderProcurement();
  }
  window.switchScreen = switchScreen;
  $$("[data-target]").forEach(b => b.addEventListener("click", () => switchScreen(b.dataset.target)));
  $$(".home-fab").forEach(b => b.addEventListener("click", () => switchScreen("home")));

  // Spinner alias
  const spin = (on, msg) => EX.spin(on, msg);

  // ====== CREATE TASK ======
  // status radios ensure
  (function ensureStatusRadios(){
    const wrap = $("#statusRadios");
    if (!wrap) return;
    if (!wrap.children.length){
      const html = `
        <label class="chip"><input type="radio" name="status" value="Complete"> Complete</label>
        <label class="chip"><input type="radio" name="status" value="Incomplete" checked> Incomplete</label>`;
      wrap.innerHTML = html;
    }
  })();

  // date default
  const jobDateEl = $("#jobDate");
  if (jobDateEl && !jobDateEl.value) jobDateEl.value = EX.todayISO();

  // reminders 0–52
  (function fillReminders(){
    const sel = $("#reminderWeeks"); if (!sel || sel.options.length) return;
    for (let i=0;i<=52;i++){
      const o = document.createElement("option");
      o.value = i; o.textContent = i;
      sel.appendChild(o);
    }
  })();

  // weeds select (noxious pinned)
  function populateWeeds(){
    const sel = $("#weedSelect"); if (!sel) return;
    const nox = DB.weeds.filter(w=>/noxious/i.test(w));
    const rest = DB.weeds.filter(w=>! /noxious/i.test(w));
    const all = ["— Select Weed —", ...nox.sort(), ...rest.sort()];
    sel.innerHTML = "";
    all.forEach(w=>{
      const o = document.createElement("option");
      o.value = w === "— Select Weed —" ? "" : w;
      o.textContent = /noxious/i.test(w) ? `⚠ ${w}` : w;
      sel.appendChild(o);
    });
  }
  populateWeeds();

  // batches select
  function populateBatchSelect(){
    const sel = $("#batchSelect"); if (!sel) return;
    sel.innerHTML = "";
    const def = document.createElement("option");
    def.value = ""; def.textContent = "— Select Batch —";
    sel.appendChild(def);
    DB.batches.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).forEach(b=>{
      const o = document.createElement("option");
      const remain = (b.remaining ?? b.mix ?? 0);
      o.value = b.id; o.textContent = `${b.id} • ${EX.formatDateAU(b.date)} • remain ${fmt(remain)} L`;
      sel.appendChild(o);
    });
  }
  window.populateBatchSelect = populateBatchSelect;
  populateBatchSelect();

  // roadside tracking toggle by type
  const typeSel = $("#taskType");
  const trackBlock = $("#roadTrackBlock");
  function syncTrack(){ if (trackBlock) trackBlock.style.display = (typeSel.value === "Road Spray") ? "block" : "none"; }
  typeSel?.addEventListener("change", syncTrack); syncTrack();

  // locate + auto name
  let currentRoad = "Unknown";
  $("#locateBtn")?.addEventListener("click", ()=>{
    spin(true,"Getting GPS…");
    if (!navigator.geolocation){ spin(false); EX.toast("Enable location"); return; }
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{
        const {latitude: lat, longitude: lon} = pos.coords;
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const j = await r.json();
        currentRoad = j.address?.road || j.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      }catch{ /* fallback below */ }
      $("#locRoad").textContent = currentRoad || "Unknown";
      spin(false); EX.toast("Location set");
    }, ()=>{ spin(false); EX.toast("GPS failed"); });
  });

  $("#autoNameBtn")?.addEventListener("click", ()=>{
    const t = $("#taskType").value || "Inspection";
    const prefix = TYPE_PREFIX[t] || "I";
    const d = jobDateEl && jobDateEl.value ? new Date(jobDateEl.value) : new Date();
    const compact = EX.formatDateAUCompact(d);
    const road = (currentRoad || "Unknown").replace(/\s+/g,"");
    $("#jobName").value = `${road}${compact}_${prefix}`;
  });

  // weather
  $("#autoWeatherBtn")?.addEventListener("click", EX.fillWeather);

  // photo input
  let photoDataURL = "";
  $("#photoInput")?.addEventListener("change", (e)=>{
    const f = e.target.files?.[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = ()=>{ photoDataURL = String(rd.result || ""); const img=$("#photoPreview"); img.src=photoDataURL; img.style.display="block"; };
    rd.readAsDataURL(f);
  });

  // tracking
  let trackTimer = null, trackCoords = [];
  $("#startTrack")?.addEventListener("click", ()=>{
    if (!navigator.geolocation){ EX.toast("Enable location"); return; }
    trackCoords = [];
    $("#trackStatus").textContent = "Tracking…";
    trackTimer && clearInterval(trackTimer);
    trackTimer = setInterval(()=> navigator.geolocation.getCurrentPosition(p=>{
      trackCoords.push([p.coords.latitude, p.coords.longitude]);
    }), 5000);
  });
  $("#stopTrack")?.addEventListener("click", ()=>{
    trackTimer && clearInterval(trackTimer); trackTimer = null;
    $("#trackStatus").textContent = `Stopped (${trackCoords.length} pts)`;
    try{ localStorage.setItem("lastTrack", JSON.stringify(trackCoords)); }catch{}
  });

  // save task
  $("#saveTask")?.addEventListener("click", ()=> saveTask(false));
  $("#saveDraft")?.addEventListener("click", ()=> saveTask(true));

  function saveTask(isDraft){
    spin(true,"Saving…");
    const id = Date.now();
    const status = isDraft ? "Draft" : ($("input[name='status']:checked")?.value || "Incomplete");
    const obj = {
      id,
      name: ($("#jobName").value || "").trim() || ("Task_"+id),
      council: ($("#councilNum").value || "").trim(),
      linkedInspectionId: ($("#linkInspectionId").value || "").trim(),
      type: $("#taskType").value,
      weed: $("#weedSelect").value,
      batch: $("#batchSelect").value,
      date: $("#jobDate").value || EX.todayISO(),
      start: $("#startTime").value || "", end: $("#endTime").value || "",
      temp: $("#temp").value || "", wind: $("#wind").value || "", windDir: $("#windDir").value || "", humidity: $("#humidity").value || "",
      reminder: $("#reminderWeeks").value || "",
      status, notes: $("#notes").value || "",
      coords: trackCoords.slice(), photo: photoDataURL || "",
      createdAt: new Date().toISOString(), archived: false
    };

    const existing = DB.tasks.find(t => t.name === obj.name);
    if (existing) Object.assign(existing, obj); else DB.tasks.push(obj);

    // link/ archive inspection
    if (obj.linkedInspectionId){
      const insp = DB.tasks.find(x => x.type==="Inspection" && (String(x.id)===obj.linkedInspectionId || x.name===obj.linkedInspectionId));
      if (insp){ insp.archived = true; insp.status = "Archived"; }
    }

    // simple batch consumption hint
    if (obj.batch){
      const b = DB.batches.find(x => x.id === obj.batch);
      if (b){
        const used = (obj.type === "Road Spray" && obj.coords?.length > 1) ? 100 : 0;
        b.used = (b.used || 0) + used;
        b.remaining = Math.max(0, (Number(b.mix)||0) - (b.used||0));
      }
    }

    saveDB();
    populateBatchSelect();
    renderRecords();
    renderMap();
    spin(false); EX.toast(isDraft ? "Draft saved" : "Task saved");
  }

  // ====== RECORDS ======
  $("#recSearchBtn")?.addEventListener("click", renderRecords);
  $("#recResetBtn")?.addEventListener("click", ()=>{
    $("#recSearch").value=""; $("#recFrom").value=""; $("#recTo").value="";
    ["fInspection","fSpot","fRoad","fComplete","fIncomplete","fDraft"].forEach(id=>{ const el=$("#"+id); if(el) el.checked=false; });
    renderRecords();
  });

  function recordMatches(t, q, from, to, types, statuses){
    if (t.archived) return false;
    if (from && (t.date||"") < from) return false;
    if (to && (t.date||"") > to) return false;

    // type
    const tOK = (!types.inspection && !types.spot && !types.road)
      || (t.type==="Inspection" && types.inspection)
      || (t.type==="Spot Spray" && types.spot)
      || (t.type==="Road Spray" && types.road);
    if (!tOK) return false;

    // status
    const s = t.status || "Incomplete";
    const sOK = (!statuses.complete && !statuses.incomplete && !statuses.draft)
      || (s==="Complete" && statuses.complete)
      || (s==="Incomplete" && statuses.incomplete)
      || (s==="Draft" && statuses.draft);
    if (!sOK) return false;

    if (q){
      const hay = `${t.name} ${t.weed} ${t.council}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }

  function renderRecords(){
    const list = $("#recordsList"); if (!list) return;
    list.innerHTML = "";
    const q = $("#recSearch").value.trim();
    const from = $("#recFrom").value || "";
    const to = $("#recTo").value || "";
    const types = { inspection:$("#fInspection").checked, spot:$("#fSpot").checked, road:$("#fRoad").checked };
    const statuses = { complete:$("#fComplete").checked, incomplete:$("#fIncomplete").checked, draft:$("#fDraft").checked };

    DB.tasks.filter(t=>recordMatches(t,q,from,to,types,statuses))
      .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
      .forEach(t=>{
        const d = document.createElement("div");
        d.className = "item";
        d.innerHTML = `<b>${t.name}</b><br><small>${t.type} • ${EX.formatDateAU(t.date)} • ${t.status}</small>
          <div class="row gap end" style="margin-top:.35rem">
            ${t.coords && t.coords.length ? `<button class="pill" data-nav="${t.id}">Navigate</button>` : ""}
            <button class="pill" data-open="${t.id}">Open</button>
          </div>`;
        const nav = d.querySelector("[data-nav]");
        if (nav){
          nav.onclick = ()=> {
            const pt = t.coords?.[0]; if (!pt) { EX.toast("No coords saved"); return; }
            EX.openAppleMaps(pt[0], pt[1]);
          };
        }
        d.querySelector("[data-open]").onclick = ()=> showJobPopup(DB, t, false);
        list.appendChild(d);
      });
  }
  renderRecords();

  // ====== BATCHES ======
  $("#batSearchBtn")?.addEventListener("click", ()=> BATS.renderBatches(DB, { save: saveDB, populateBatchSelect }));
  $("#batResetBtn")?.addEventListener("click", ()=>{ $("#batFrom").value=""; $("#batTo").value=""; BATS.renderBatches(DB, { save: saveDB, populateBatchSelect }); });
  $("#newBatch")?.addEventListener("click", ()=>{
    const b = BATS.newBatch(DB);
    saveDB();
    populateBatchSelect();
    BATS.renderBatches(DB, { save: saveDB, populateBatchSelect });
  });

  // ====== INVENTORY ======
  $("#addChem")?.addEventListener("click", ()=>{
    const name = prompt("Chemical name:"); if(!name) return;
    const active = prompt("Active ingredient:","") || "";
    const size = Number(prompt("Container size (number):","20")) || 0;
    const unit = prompt("Unit (L, mL, g, kg):","L") || "L";
    const count = Number(prompt("How many containers:","0")) || 0;
    const thr = Number(prompt("Reorder threshold (containers):","0")) || 0;
    DB.chems.push({ name, active, containerSize:size, containerUnit:unit, containers:count, threshold:thr });
    saveDB(); renderChems(); renderProcurement();
  });

  function renderChems(){
    const list = $("#chemList"); if (!list) return; list.innerHTML = "";
    DB.chems.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach(c=>{
      const total = (c.containers||0)*(c.containerSize||0);
      const line = `${c.containers||0} × ${fmt(c.containerSize)} ${c.containerUnit} • total ${fmt(total)} ${c.containerUnit}`;
      const d = document.createElement("div"); d.className="item";
      d.innerHTML = `<b>${c.name}</b><br><small>${line}</small><br><small>Active: ${c.active||"—"}</small>
        <div class="row gap end" style="margin-top:.4rem">
          <button class="pill" data-edit>Edit</button>
          <button class="pill warn" data-del>Delete</button>
        </div>`;
      d.querySelector("[data-edit]").onclick = ()=> openChemEditor(c);
      d.querySelector("[data-del]").onclick = ()=> {
        if (!confirm("Delete chemical?")) return;
        DB.chems = DB.chems.filter(x => x !== c);
        saveDB(); renderChems(); renderProcurement();
      };
      list.appendChild(d);
    });
  }
  renderChems();

  // Procurement (low stock)
  function renderProcurement(){
    const ul = $("#procList"); if (!ul) return; ul.innerHTML = "";
    DB.chems.forEach(c=>{
      if (c.threshold && (c.containers||0) < c.threshold){
        const li = document.createElement("li");
        li.textContent = `Low stock: ${c.name} (${c.containers||0} < ${c.threshold})`;
        ul.appendChild(li);
      }
    });
  }
  renderProcurement();

  // Chem editor sheet
  let _chemEditing = null;
  function openChemEditor(c){
    _chemEditing = c;
    $("#ce_name").value = c.name || "";
    $("#ce_active").value = c.active || "";
    $("#ce_size").value = c.containerSize || 0;
    $("#ce_unit").value = c.containerUnit || "L";
    $("#ce_count").value = c.containers || 0;
    $("#ce_threshold").value = c.threshold || 0;
    $("#chemEditSheet").style.display = "flex";
  }
  $("#ce_cancel")?.addEventListener("click", ()=> { $("#chemEditSheet").style.display="none"; _chemEditing=null; });
  $("#ce_save")?.addEventListener("click", ()=>{
    if (!_chemEditing) return;
    _chemEditing.name = $("#ce_name").value.trim();
    _chemEditing.active = $("#ce_active").value.trim();
    _chemEditing.containerSize = Number($("#ce_size").value)||0;
    _chemEditing.containerUnit = $("#ce_unit").value||"L";
    _chemEditing.containers = Number($("#ce_count").value)||0;
    _chemEditing.threshold = Number($("#ce_threshold").value)||0;
    saveDB(); renderChems(); renderProcurement(); $("#chemEditSheet").style.display="none"; _chemEditing=null; EX.toast("Chemical updated");
  });

  // ====== MAPPING ======
  let map;
  function ensureMap(){
    if (map) return map;
    map = L.map("map").setView([-34.75,148.65], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);

    // Locate Me (custom control)
    const locate = L.control({ position:"topright" });
    locate.onAdd = function(){
      const d = L.DomUtil.create("div","leaflet-bar");
      d.style.background="#146c2e"; d.style.color="#fff"; d.style.borderRadius="6px";
      d.style.padding="6px 10px"; d.style.cursor="pointer"; d.innerText="Locate Me";
      d.onclick = () => {
        if (!navigator.geolocation){ EX.toast("Enable location"); return; }
        navigator.geolocation.getCurrentPosition(p=>{
          const pt=[p.coords.latitude,p.coords.longitude];
          map.setView(pt, 14);
          L.circleMarker(pt,{radius:7,opacity:.9}).addTo(map).bindPopup("You are here").openPopup();
        });
      };
      return d;
    };
    locate.addTo(map);
    return map;
  }

  $("#mapSearchBtn")?.addEventListener("click", ()=> renderMap(true));
  $("#mapResetBtn")?.addEventListener("click", ()=>{
    $("#mapFrom").value=""; $("#mapTo").value=""; $("#mapWeed").value=""; $("#mapType").value="All";
    renderMap(true);
  });

  function renderMap(fit=false){
    const m = ensureMap();
    // remove non-tile layers
    m.eachLayer(l => { if (!(l instanceof L.TileLayer)) m.removeLayer(l); });

    const from = $("#mapFrom").value || "";
    const to = $("#mapTo").value || "";
    const typ = $("#mapType").value || "All";
    const weedQ = ($("#mapWeed").value || "").trim().toLowerCase();

    const tasks = DB.tasks
      .filter(t=>!t.archived)
      .filter(t=>(!from||t.date>=from)&&(!to||t.date<=to))
      .filter(t=> typ==="All" ? true : t.type===typ)
      .filter(t=> weedQ ? (String(t.weed||"").toLowerCase().includes(weedQ)) : true);

    const group = L.featureGroup();

    tasks.forEach(t=>{
      if (t.coords?.length > 1 && t.type === "Road Spray"){
        group.addLayer(L.polyline(t.coords,{weight:4,opacity:.9}));
      }
      const pt = t.coords?.[0] || [-34.75 + Math.random()*0.08, 148.65 + Math.random()*0.08];
      const openId = `open_${t.id}`;
      const navId  = `nav_${t.id}`;
      const thumb  = t.photo ? `<br><img src="${t.photo}" style="max-width:180px;border-radius:6px;margin-top:.3rem">` : "";
      const popup  = `<b>${t.name}</b><br>${t.type} • ${EX.formatDateAU(t.date)}${thumb}
        <br><button id="${openId}" class="pill" style="margin-top:.35rem">Open</button>
        <button id="${navId}" class="pill" style="margin-top:.35rem;margin-left:.4rem">Navigate</button>`;
      const marker = L.marker(pt); marker.bindPopup(popup);
      marker.on("popupopen", ()=>{
        setTimeout(()=>{
          const ob = document.getElementById(openId);
          const nb = document.getElementById(navId);
          ob && (ob.onclick = ()=> showJobPopup(DB, t, true));
          nb && (nb.onclick = ()=> EX.openAppleMaps(pt[0], pt[1]));
        },0);
      });
      group.addLayer(marker);
    });

    group.addTo(m);
    if (fit && tasks.length){
      try { m.fitBounds(group.getBounds().pad(0.2)); } catch {}
    }
    // draw last track
    try{
      const last = JSON.parse(localStorage.getItem("lastTrack")||"[]");
      if (Array.isArray(last) && last.length>1) L.polyline(last,{weight:3,opacity:.8}).addTo(m);
    }catch{}
  }

  // ====== JOB POPUP (shared) ======
  function showJobPopup(DB, t, closeOnOpen=false){
    if (!t) return;
    const batchLink = t.batch ? `<a href="#" data-open-batch="${t.batch}">${t.batch}</a>` : "—";
    const linkedInsp = t.linkedInspectionId ? `<a href="#" data-open-insp="${t.linkedInspectionId}">${t.linkedInspectionId}</a>` : "—";
    const photoHtml = t.photo ? `<div style="margin:.4rem 0"><img src="${t.photo}" alt="photo" style="max-width:100%;border-radius:8px"/></div>` : "";
    const hasPt = t.coords && t.coords.length;

    const html = `
      <h3 style="margin-top:0">${t.name}</h3>
      <div class="grid two">
        <div><b>Type:</b> ${t.type}</div><div><b>Status:</b> ${t.status}</div>
        <div><b>Date:</b> ${EX.formatDateAU(t.date)}</div>
        <div><b>Start:</b> ${t.start||"–"} · <b>Finish:</b> ${t.end||"–"}</div>
        <div><b>Weed:</b> ${t.weed||"—"}</div><div><b>Batch:</b> ${batchLink}</div>
        <div><b>Linked Inspection:</b> ${linkedInsp}</div><div><b>Reminder:</b> ${t.reminder||"—"} wk</div>
      </div>
      <div><b>Weather:</b> ${fmt(t.temp)}°C, ${fmt(t.wind)} km/h, ${t.windDir||"–"}, ${fmt(t.humidity)}%</div>
      <div><b>Notes:</b> ${t.notes || "—"}</div>
      ${photoHtml}
      <div class="row gap end" style="margin-top:.8rem;">
        ${hasPt? `<button class="pill" data-nav>Navigate</button>` : ""}
        <button class="pill" data-edit>Edit</button>
        <button class="pill warn" data-close>Close</button>
      </div>`;
    const m = EX.popup(html);
    m.querySelector("[data-close]").onclick = ()=> m.remove();
    const nav = m.querySelector("[data-nav]");
    if (nav) nav.onclick = ()=> { const pt = t.coords?.[0]; if(!pt){ EX.toast("No coords saved"); return; } EX.openAppleMaps(pt[0], pt[1]); };

    m.querySelector("[data-edit]").onclick = ()=>{
      switchScreen("createTask");
      $("#jobName").value = t.name; $("#councilNum").value = t.council||"";
      $("#linkInspectionId").value = t.linkedInspectionId||"";
      $("#taskType").value = t.type; $("#taskType").dispatchEvent(new Event("change"));
      $("#weedSelect").value = t.weed||""; $("#batchSelect").value = t.batch||"";
      $("#jobDate").value = t.date || EX.todayISO();
      $("#startTime").value = t.start||""; $("#endTime").value = t.end||"";
      $("#temp").value = t.temp||""; $("#wind").value = t.wind||""; $("#windDir").value = t.windDir||""; $("#humidity").value = t.humidity||"";
      $("#notes").value = t.notes||"";
      if (t.photo){ $("#photoPreview").src = t.photo; $("#photoPreview").style.display = "block"; }
      m.remove();
    };

    const batchA = m.querySelector("[data-open-batch]");
    if (batchA){
      batchA.onclick = (e)=>{ e.preventDefault(); const b = DB.batches.find(x=>x.id===t.batch); b && BATS.showBatchPopup(DB, b); };
    }
    const inspA = m.querySelector("[data-open-insp]");
    if (inspA){
      inspA.onclick = (e)=>{ e.preventDefault(); const insp = DB.tasks.find(x=>x.type==="Inspection" && (String(x.id)===t.linkedInspectionId || x.name===t.linkedInspectionId)); insp && showJobPopup(DB, insp, true); };
    }

    if (closeOnOpen){ /* noop, kept for API parity */ }
  }
  window.WTApp = { showJobPopup };

  // ====== SETTINGS BIND ======
  SETS.bind(DB, saveDB, ()=>{
    populateBatchSelect();
    renderChems();
    renderProcurement();
    renderRecords();
    renderMap(true);
  });

  // ====== FIRST RUN BACKUP OFFER ======
  if ((!DB.tasks.length && !DB.batches.length && !DB.chems.length) && window.WTStorage){
    // If backups exist, user can restore via Settings -> Restore
    // Keep silent here to avoid extra prompts on first run.
  }
})();
