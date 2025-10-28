/* === WeedTracker V60 Pilot — FULL apps.js ===
   Core controller wiring every screen together

   ✅ AU dates (DD-MM-YYYY) + compact DDMMYYYY for job names
   ✅ Unified search/filter bar pattern across Records / Batches / Mapping / Inventory
   ✅ Task types: Inspection / Spot Spray / Road Shoulder Spray
   ✅ Road tracking controls only for Road Shoulder Spray
   ✅ “Noxious Weeds” pinned category at top + ⚠ markers; extra "Other" choice at bottom
   ✅ Apple Maps navigation from Records & Map pins
   ✅ Weather via open-meteo (offline Apple Weather not available to browsers)
   ✅ Records/Batches “Open” popups + Edit hooks
   ✅ Spinner + splash fade
*/

(function () {
  // ---------- Shortcuts ----------
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const todayISO = ()=> new Date().toISOString().split("T")[0];
  const nowTime  = ()=> new Date().toTimeString().slice(0,5);
  const fmtN     = (n,d=0)=> (n==null||n==="")?"–":Number(n).toFixed(d);

  // -------- AU dates ----------
  function au(d){
    const dt = (d instanceof Date)? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2,"0");
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const yyyy = dt.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  function auCompact(d){
    const dt = (d instanceof Date)? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2,"0");
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const yyyy = dt.getFullYear();
    return `${dd}${mm}${yyyy}`;
  }

  // ---------- DB ----------
  const DB = window.WeedStorage.load();
  DB.tasks       ||= [];
  DB.batches     ||= [];
  DB.chems       ||= [];
  DB.procurement ||= [];
  DB.weeds       ||= [];

  // Seed weeds if empty (noxious tagged; Cape Broom included)
  if (!DB.weeds.length){
    DB.weeds = [
      "African Boxthorn (noxious)","African Lovegrass (noxious)","Bathurst Burr (noxious)","Blackberry (noxious)",
      "Cape Broom (noxious)","Chilean Needle Grass (noxious)","Coolatai Grass (noxious)","Fireweed (noxious)",
      "Gorse (noxious)","Lantana (noxious)","Patterson’s Curse (noxious)","Serrated Tussock (noxious)",
      "St John’s Wort (noxious)","Sweet Briar (noxious)","Willow spp. (noxious)",
      "African Feathergrass","Artichoke Thistle","Balloon Vine","Blue Heliotrope","Bridal Creeper",
      "Caltrop","Coltsfoot","Fleabane","Flax-leaf Broom","Fountain Grass","Galvanised Burr",
      "Giant Parramatta Grass","Glycine","Green Cestrum","Horehound","Khaki Weed","Noogoora Burr",
      "Parthenium Weed","Prickly Pear (common)","Saffron Thistle","Silverleaf Nightshade",
      "Spear Thistle","Sweet Vernal Grass","Three-cornered Jack","Wild Radish"
    ];
  }
  window.WeedStorage.save(DB); // persist seeds if added

  // ---------- Splash + Spinner ----------
  function spinner(on, msg){
    const sp = $("#spinner");
    if (!sp) return;
    if (on){ sp.classList.add("active"); sp.setAttribute("aria-label", msg||"Working…"); }
    else   { sp.classList.remove("active"); sp.removeAttribute("aria-label"); }
  }
  function splashFade(){
    const s = $("#splash");
    if (!s) return;
    setTimeout(()=> s.classList.add("fade"), 900);
    setTimeout(()=> s.remove(), 1800);
  }

  // ---------- Toast ----------
  function toast(msg, ms=1600){
    const d=document.createElement("div");
    d.textContent=msg;
    Object.assign(d.style,{
      position:"fixed",bottom:"1.2rem",left:"50%",transform:"translateX(-50%)",
      background:"#2b8a3e",color:"#fff",padding:".6rem 1rem",borderRadius:"20px",
      boxShadow:"0 2px 8px rgba(0,0,0,.25)",zIndex:9999,fontWeight:800
    });
    document.body.appendChild(d); setTimeout(()=>d.remove(),ms);
  }

  // ---------- Navigation ----------
  function switchScreen(id){
    $$(".screen").forEach(s=> s.classList.remove("active"));
    $("#"+id)?.classList.add("active");
    if (id==="records")   renderRecords();
    if (id==="batches")   renderBatches(); // from batches.js
    if (id==="inventory") renderInventory();
    if (id==="mapping")   ensureMapAndRender(true);
  }
  function bindNav(){
    $$("[data-target]").forEach(b=> b.addEventListener("click", ()=> switchScreen(b.dataset.target)));
    $$(".home-btn").forEach(b=> b.addEventListener("click", ()=> switchScreen("home")));
  }

  // ========== CREATE TASK ==========
  const typeSel   = $("#taskType");
  const jobDateEl = $("#jobDate");
  const locateBtn = $("#locateBtn");
  const locRoad   = $("#locRoad");
  const roadUI    = $("#roadTrackBlock");
  const weedSel   = $("#weedSelect");
  const batchSel  = $("#batchSelect");
  const reminder  = $("#reminderWeeks");

  // Step order: 1=Type 2=Location 3=AutoName 4=Weather 5=Weed 6=Batch 7=Times 8=Notes/Reminder 9=Save
  function bindCreateTask(){
    // Set job date default
    if (jobDateEl && !jobDateEl.value) jobDateEl.value = todayISO();

    // 0–52 weeks
    if (reminder && !reminder.options.length){
      const none = document.createElement("option"); none.value=""; none.textContent="None";
      reminder.appendChild(none);
      for (let i=1;i<=52;i++){ const o=document.createElement("option"); o.value=String(i); o.textContent=String(i); reminder.appendChild(o); }
    }

    // Populate weeds — pin noxious first, then rest, add “Other”
    populateWeeds();

    // Populate batches select
    populateBatchSelect();

    // Road tracking controls visibility
    typeSel?.addEventListener("change", ()=>{
      const v = typeSel.value;
      const isRoad = /road shoulder/i.test(v) || v === "Road Spray";
      if (roadUI) roadUI.style.display = isRoad ? "block" : "none";
    });
    typeSel.dispatchEvent(new Event("change"));

    // Locate Me → road name (reverse geocode via OSM)
    locateBtn?.addEventListener("click", ()=>{
      if (!navigator.geolocation) return alert("Enable Location Services");
      spinner(true, "Getting GPS…");
      navigator.geolocation.getCurrentPosition(async pos=>{
        try{
          const {latitude, longitude} = pos.coords;
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const j = await r.json();
          const road = j.address?.road || j.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          locRoad.textContent = road;
          localStorage.setItem("lastLat", latitude);
          localStorage.setItem("lastLon", longitude);
          spinner(false);
          toast("📍 " + road);
        }catch(e){ spinner(false); alert("Location lookup failed."); }
      }, e=>{ spinner(false); alert("GPS error: "+e.message); }, {enableHighAccuracy:true});
    });

    // Auto Name — Road + DDMMYYYY + _I/SS/RS (AU preserved, no dashes)
    $("#autoNameBtn")?.addEventListener("click", ()=>{
      const road = (locRoad?.textContent||"").replace(/\s+/g,"");
      const compact = auCompact(jobDateEl?.value || new Date());
      const t = typeSel?.value || "Inspection";
      const code = /spot/i.test(t) ? "SS" : (/road/i.test(t) ? "RS" : "I");
      $("#jobName").value = `${road||"Unknown"}${compact}_${code}`;
    });

    // Weather (open-meteo)
    $("#autoWeatherBtn")?.addEventListener("click", ()=>{
      if (!navigator.geolocation) return alert("Enable Location Services");
      spinner(true, "Fetching weather…");
      navigator.geolocation.getCurrentPosition(async pos=>{
        try{
          const {latitude, longitude} = pos.coords;
          const url=`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;
          const r=await fetch(url); const j=await r.json(); const c=j.current||{};
          $("#temp").value     = c.temperature_2m ?? "";
          $("#wind").value     = c.wind_speed_10m ?? "";
          $("#windDir").value  = (c.wind_direction_10m!=null ? c.wind_direction_10m+"°" : "");
          $("#humidity").value = c.relative_humidity_2m ?? "";
          $("#wxUpdated").textContent = "Updated @ " + nowTime();
          spinner(false);
        }catch(e){ spinner(false); alert("Weather unavailable"); }
      }, e=>{ spinner(false); alert("GPS error: "+e.message); });
    });

    // Tracking (Road Shoulder only)
    let trackTimer=null, coords=[];
    $("#startTrack")?.addEventListener("click", ()=>{
      coords=[]; $("#trackStatus").textContent="Tracking…";
      if (!navigator.geolocation) return alert("Enable Location Services");
      trackTimer = setInterval(()=> {
        navigator.geolocation.getCurrentPosition(p=> coords.push([p.coords.latitude, p.coords.longitude]));
      }, 5000);
    });
    $("#stopTrack")?.addEventListener("click", ()=>{
      if (trackTimer) clearInterval(trackTimer);
      $("#trackStatus").textContent=`Stopped (${coords.length} pts)`;
      localStorage.setItem("lastTrack", JSON.stringify(coords));
    });

    // Photo
    let photoData="";
    $("#photoInput")?.addEventListener("change", e=>{
      const f=e.target.files?.[0]; if(!f) return;
      const reader = new FileReader();
      reader.onload = ()=>{ photoData = String(reader.result||""); const img=$("#photoPreview"); img.src=photoData; img.style.display="block"; };
      reader.readAsDataURL(f);
    });

    // Save / Draft
    $("#saveTask")?.addEventListener("click", ()=> saveTask(false));
    $("#saveDraft")?.addEventListener("click", ()=> saveTask(true));

    function saveTask(isDraft){
      spinner(true, "Saving…");
      const tVal = typeSel.value;
      const normType = /road/i.test(tVal) ? "Road Shoulder Spray" : tVal;
      const obj = {
        id: Date.now(),
        name: ($("#jobName").value||"").trim() || ("Task_"+Date.now()),
        council: ($("#councilNum").value||"").trim(),
        linkedInspectionId: ($("#linkInspectionId").value||"").trim(),
        type: normType,
        weed: $("#weedSelect").value || "",
        batch: $("#batchSelect").value || "",
        date: $("#jobDate").value || todayISO(),
        start: $("#startTime").value || "",
        end:   $("#endTime").value   || "",
        temp: $("#temp").value, wind: $("#wind").value, windDir: $("#windDir").value, humidity: $("#humidity").value,
        reminder: $("#reminderWeeks").value || "",
        status: isDraft ? "Draft" : "Incomplete",
        notes: $("#notes").value || "",
        coords: JSON.parse(localStorage.getItem("lastTrack")||"[]"),
        photo: photoData || "",
        createdAt: new Date().toISOString(),
        archived: false
      };

      // Save (merge if name duplicates)
      const existing = DB.tasks.find(x=> x.name===obj.name);
      if (existing) Object.assign(existing, obj); else DB.tasks.push(obj);

      // Link inspection if provided (archive it)
      if (obj.linkedInspectionId){
        const insp = DB.tasks.find(tt=> tt.type==="Inspection" && (String(tt.id)===obj.linkedInspectionId || tt.name===obj.linkedInspectionId));
        if (insp){ insp.archived=true; insp.status="Archived"; obj.linkedInspectionResolved=true; }
      }

      // Consume batch (simple heuristic: if coords exist and Road Shoulder, assume 100 L used)
      if (obj.batch){
        const b = DB.batches.find(bb=> bb.id===obj.batch);
        if (b){
          const used = (/road/i.test(obj.type) && obj.coords?.length>1) ? 100 : 0;
          b.used = (b.used||0)+used;
          b.remaining = Math.max(0, (Number(b.mix)||0) - (b.used||0));
          // attach job link
          b.linkedJobs ||= [];
          if (!b.linkedJobs.includes(obj.name)) b.linkedJobs.push(obj.name);
        }
      }

      window.WeedStorage.save(DB);
      populateBatchSelect();
      renderRecords();
      spinner(false);
      toast("Saved");
    }
  }

  function populateWeeds(){
    const sel = weedSel; if (!sel) return;
    sel.innerHTML = "";

    const nox = DB.weeds.filter(w=>/noxious/i.test(w)).sort((a,b)=> a.localeCompare(b));
    const rest = DB.weeds.filter(w=>! /noxious/i.test(w)).sort((a,b)=> a.localeCompare(b));

    // Noxious category (pinned)
    const ogN = document.createElement("optgroup");
    ogN.label = "🔺 Noxious Weeds";
    nox.forEach(w=> {
      const o=document.createElement("option");
      o.value=w; o.textContent = "⚠ " + w;
      ogN.appendChild(o);
    });

    // Normal category
    const ogR = document.createElement("optgroup");
    ogR.label = "All Weeds";
    rest.forEach(w=>{
      const o=document.createElement("option");
      o.value=w; o.textContent = w;
      ogR.appendChild(o);
    });

    // Other (manual — user will type exact name in Notes)
    const ogO = document.createElement("optgroup");
    ogO.label = "Other";
    const oOther = document.createElement("option");
    oOther.value = "Other";
    oOther.textContent = "Other (type exact weed in Notes)";
    ogO.appendChild(oOther);

    sel.appendChild(ogN);
    sel.appendChild(ogR);
    sel.appendChild(ogO);
  }

  function populateBatchSelect(){
    const sel = batchSel; if (!sel) return;
    sel.innerHTML = "";
    const def = document.createElement("option");
    def.value=""; def.textContent="— Select Batch —"; sel.appendChild(def);
    DB.batches.slice().sort((a,b)=> (b.date||"").localeCompare(a.date||"") || (b.time||"").localeCompare(a.time||""))
      .forEach(b=>{
        const o=document.createElement("option");
        o.value=b.id; o.textContent=`${b.id} • ${au(b.date)} • remain ${fmtN(b.remaining||b.mix)} L`;
        sel.appendChild(o);
      });
  }

  // ========== RECORDS (Unified filter UI) ==========
  function recordMatches(t, q, from, to, types, statuses){
    if (t.archived) return false;
    if (from && (t.date||"") < from) return false;
    if (to   && (t.date||"") > to)   return false;

    if (q){
      const hay = `${t.name} ${t.weed} ${t.council} ${t.batch}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }

    // types
    const typeOK = (
      (!types.ins && !types.spot && !types.road) ||
      (t.type==="Inspection" && types.ins) ||
      (/spot/i.test(t.type) && types.spot) ||
      (/road/i.test(t.type) && types.road)
    );
    if (!typeOK) return false;

    // statuses
    const s = t.status || "Incomplete";
    const statEmpty = !statuses.comp && !statuses.incomp && !statuses.draft;
    const statOK = statEmpty ||
                   (s==="Complete"  && statuses.comp) ||
                   (s==="Incomplete"&& statuses.incomp) ||
                   (s==="Draft"     && statuses.draft);
    return statOK;
  }

  function renderRecords(){
    const list=$("#recordsList"); if(!list) return; list.innerHTML="";
    const q = ($("#recSearch")?.value||"").trim();
    const from = $("#recFrom")?.value || "";
    const to   = $("#recTo")?.value   || "";
    const types = {
      ins:  $("#fInspection")?.checked || false,
      spot: $("#fSpot")?.checked       || false,
      road: $("#fRoad")?.checked       || false
    };
    const statuses = {
      comp:   $("#fComplete")?.checked   || false,
      incomp: $("#fIncomplete")?.checked || false,
      draft:  $("#fDraft")?.checked      || false
    };

    DB.tasks.filter(t=> recordMatches(t,q,from,to,types,statuses))
      .sort((a,b)=> (b.date||"").localeCompare(a.date||"") || (b.createdAt||"").localeCompare(a.createdAt||""))
      .forEach(t=>{
        const card=document.createElement("div");
        card.className="item";
        const dateAU = au(t.date);
        card.innerHTML = `
          <b>${t.name}</b><br>
          <small>${t.type} • ${dateAU} • ${t.status}</small>
          <div class="row end" style="margin-top:.35rem;">
            ${t.coords?.length? `<button class="pill" data-nav>Navigate</button>`:""}
            <button class="pill" data-open>Open</button>
          </div>
        `;
        card.querySelector("[data-open]")?.addEventListener("click", ()=> openJobPopup(t));
        card.querySelector("[data-nav]")?.addEventListener("click", ()=>{
          const pt = t.coords?.[0]; if(!pt) return alert("No coordinates saved");
          openAppleMaps(pt[0], pt[1]);
        });
        list.appendChild(card);
      });
  }

  // ========== INVENTORY (Unified filter UI present; road/weed/date inputs ignored) ==========
  function renderInventory(){
    const list=$("#chemList"); if (!list) return; list.innerHTML="";

    // Ensure unified search inputs exist (we reuse records’ ids if you placed them above the list in the HTML)
    const q = ($("#recSearch")?.value||"").trim().toLowerCase(); // same "Search…" box
    // from/to/type/status checkboxes are visually present but not used for inventory filtering.

    // Add Chemical
    $("#addChem")?.addEventListener("click", ()=>{
      const name=prompt("Chemical name:"); if(!name) return;
      const active=prompt("Active ingredient:","")||"";
      const size=Number(prompt("Container size (number):","20"))||0;
      const unit=prompt("Unit (L, mL, g, kg):","L")||"L";
      const count=Number(prompt("How many containers:","0"))||0;
      const thr=Number(prompt("Reorder threshold (containers):","0"))||0;
      DB.chems.push({name,active,containerSize:size,containerUnit:unit,containers:count,threshold:thr});
      window.WeedStorage.save(DB);
      renderInventory();
      renderProcurement();
    });

    DB.chems.slice()
      .filter(c=> !q || `${c.name} ${c.active}`.toLowerCase().includes(q))
      .sort((a,b)=> (a.name||"").localeCompare(b.name||""))
      .forEach(c=>{
        const total = (c.containers||0)*(Number(c.containerSize)||0);
        const line  = `${c.containers||0} × ${fmtN(c.containerSize)} ${c.containerUnit} • total ${fmtN(total)} ${c.containerUnit}`;
        const card=document.createElement("div"); card.className="item";
        card.innerHTML = `
          <b>${c.name}</b><br>
          <small>${line}</small><br>
          <small>Active: ${c.active||"—"}</small>
          <div class="row end" style="margin-top:.35rem;">
            <button class="pill" data-edit>Edit</button>
            <button class="pill warn" data-del>Delete</button>
          </div>
        `;
        card.querySelector("[data-edit]")?.addEventListener("click", ()=> openChemEditor(c));
        card.querySelector("[data-del]")?.addEventListener("click", ()=>{
          if (!confirm("Delete chemical?")) return;
          DB.chems = DB.chems.filter(x=>x!==c);
          window.WeedStorage.save(DB);
          renderInventory(); renderProcurement();
        });
        list.appendChild(card);
      });
  }

  // Chem editor sheet (uses elements declared in index.html)
  let _chemEditing=null;
  function openChemEditor(c){
    _chemEditing=c;
    $("#ce_name").value = c.name || "";
    $("#ce_active").value = c.active || "";
    $("#ce_size").value = c.containerSize || 0;
    $("#ce_unit").value = c.containerUnit || "L";
    $("#ce_count").value = c.containers || 0;
    $("#ce_threshold").value = c.threshold || 0;
    $("#chemEditSheet").style.display="block";
  }
  $("#ce_cancel")?.addEventListener("click", ()=> { $("#chemEditSheet").style.display="none"; _chemEditing=null; });
  $("#ce_save")?.addEventListener("click", ()=>{
    if (!_chemEditing) return;
    _chemEditing.name = $("#ce_name").value.trim();
    _chemEditing.active = $("#ce_active").value.trim();
    _chemEditing.containerSize = Number($("#ce_size").value)||0;
    _chemEditing.containerUnit = $("#ce_unit").value||"L";
    _chemEditing.containers = Number($("#ce_count").value)||0;
    _chemEditing.threshold  = Number($("#ce_threshold").value)||0;
    window.WeedStorage.save(DB);
    $("#chemEditSheet").style.display="none";
    renderInventory(); renderProcurement();
    toast("Chemical updated");
  });

  function renderProcurement(){
    const ul=$("#procList"); if(!ul) return; ul.innerHTML="";
    DB.chems.forEach(c=>{
      if (c.threshold && (c.containers||0) < c.threshold){
        const li=document.createElement("li");
        li.textContent=`Low stock: ${c.name} (${c.containers||0} < ${c.threshold})`;
        ul.appendChild(li);
      }
    });
  }

  // ========== BATCHES list re-render hook ==========
  // (Actual builder / popup / edit / dump are in batches.js; we just expose a wrapper here so
  //  our navigation refresh works regardless of load order.)
  function renderBatches(){
    // If batches.js already attached the real renderer, call it by firing a click on Search
    // or by dispatching a custom event:
    if (typeof window._forceRenderBatches === "function"){
      window._forceRenderBatches();
      return;
    }
    // Fallback: trigger the same function name used inside batches.js if exported to global
    const list = $("#batchList");
    if (list) list.innerHTML = ""; // batches.js will refill on its own bindings
    // no-op; batches.js render will run on navigation in most cases
  }

  // ========== Mapping (Leaflet) ==========
  let _map;
  function ensureMapAndRender(fit){
    if (!_map){
      _map = L.map("map").setView([-34.75,148.65], 10);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(_map);

      // Locate Me (top-right as requested)
      const ctrl = L.control({position:"topright"});
      ctrl.onAdd = function(){
        const d=L.DomUtil.create("div","leaflet-bar");
        d.style.background="#228b22"; d.style.color="#fff";
        d.style.borderRadius="6px"; d.style.padding="6px 10px"; d.style.cursor="pointer";
        d.innerText="Locate Me";
        d.onclick=()=>{
          if (!navigator.geolocation) return alert("Enable Location Services");
          navigator.geolocation.getCurrentPosition(p=>{
            const pt=[p.coords.latitude,p.coords.longitude];
            _map.setView(pt, 14);
            L.circleMarker(pt,{radius:7,opacity:.9}).addTo(_map).bindPopup("You are here").openPopup();
          });
        };
        return d;
      };
      ctrl.addTo(_map);
    }
    renderMapLayer(fit);
  }

  function openAppleMaps(lat, lon){
    const mapsURL = `maps://?daddr=${lat},${lon}&dirflg=d`;
    const webURL  = `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
    const a=document.createElement("a"); a.href = mapsURL; document.body.appendChild(a); a.click();
    setTimeout(()=>{ window.open(webURL, "_blank"); a.remove(); }, 250);
  }

  function renderMapLayer(fit){
    // clear non-tile layers
    _map.eachLayer(l=>{ if (!(l instanceof L.TileLayer)) _map.removeLayer(l); });

    const from = $("#mapFrom")?.value||"";
    const to   = $("#mapTo")?.value||"";
    const weedQ = ($("#mapWeed")?.value||"").trim().toLowerCase();
    const typ = $("#mapType")?.value || "All";

    const tasks = DB.tasks
      .filter(t=>!t.archived)
      .filter(t=> (!from || t.date>=from) && (!to || t.date<=to))
      .filter(t=> typ==="All" ? true : (t.type===typ || (typ==="Road Spray" && /road/i.test(t.type))))
      .filter(t=> weedQ ? String(t.weed||"").toLowerCase().includes(weedQ) : true);

    const group = L.featureGroup();
    tasks.forEach(t=>{
      if (t.coords?.length>1){
        group.addLayer(L.polyline(t.coords,{color:"yellow",weight:4,opacity:.9}));
      }
      const pt = t.coords?.[0] || [-34.75 + Math.random()*0.08, 148.65 + Math.random()*0.08];
      const openId=`open_${t.id}`, navId=`nav_${t.id}`;
      const thumb = t.photo ? `<br><img src="${t.photo}" style="max-width:180px;border-radius:6px;margin-top:.3rem">` : "";
      const popup = `<b>${t.name}</b><br>${t.type} • ${au(t.date)}${thumb}
        <br><button id="${openId}" class="pill" style="margin-top:.35rem">Open</button>
        <button id="${navId}" class="pill" style="margin-top:.35rem;margin-left:.4rem">Navigate</button>`;
      const m = L.marker(pt).bindPopup(popup);
      m.on("popupopen", ()=>{
        setTimeout(()=>{
          const ob=document.getElementById(openId);
          const nb=document.getElementById(navId);
          ob && (ob.onclick = ()=> openJobPopup(t));
          nb && (nb.onclick = ()=> openAppleMaps(pt[0], pt[1]));
        },0);
      });
      group.addLayer(m);
    });
    group.addTo(_map);
    if (fit && tasks.length){
      try{ _map.fitBounds(group.getBounds().pad(0.2)); }catch{}
    }

    // Show last quick polyline
    try {
      const last = JSON.parse(localStorage.getItem("lastTrack")||"[]");
      if (Array.isArray(last) && last.length>1) L.polyline(last,{color:"#ffda44",weight:3,opacity:.8}).addTo(_map);
    } catch {}
  }

  $("#mapSearchBtn")?.addEventListener("click", ()=> ensureMapAndRender(true));
  $("#mapResetBtn")?.addEventListener("click", ()=>{
    $("#mapFrom").value=""; $("#mapTo").value=""; $("#mapWeed").value=""; $("#mapType").value="All";
    ensureMapAndRender(true);
  });

  // ========== Job Popup ==========
  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape"){ const m=$(".modal"); if(m) m.remove(); } });

  function openJobPopup(t){
    const batchLink = t.batch ? `<a href="#" data-open-batch="${t.batch}">${t.batch}</a>` : "—";
    const linkedInsp = t.linkedInspectionId ? `<a href="#" data-open-insp="${t.linkedInspectionId}">${t.linkedInspectionId}</a>` : "—";
    const photoHtml = t.photo ? `<div style="margin:.4rem 0"><img src="${t.photo}" alt="photo" style="max-width:100%;border-radius:8px"/></div>` : "";
    const hasPt = t.coords && t.coords.length;

    const html=`
      <div class="modal" id="jobDetailModal">
        <div class="card p">
          <h3 style="margin-top:0">${t.name}</h3>
          <div class="grid two">
            <div><b>Type:</b> ${t.type}</div><div><b>Status:</b> ${t.status}</div>
            <div><b>Date:</b> ${au(t.date)}</div>
            <div><b>Start:</b> ${t.start||"–"} · <b>Finish:</b> ${t.end||"–"}</div>
            <div><b>Council #:</b> ${t.council||"—"}</div><div><b>Weed:</b> ${t.weed||"—"}</div>
            <div><b>Batch:</b> ${batchLink}</div><div><b>Linked Inspection:</b> ${linkedInsp}</div>
            <div class="span2"><b>Weather:</b> ${fmtN(t.temp)}°C, ${fmtN(t.wind)} km/h, ${t.windDir||"–"}, ${fmtN(t.humidity)}%</div>
            <div class="span2"><b>Reminder:</b> ${t.reminder||"—"} wk</div>
            <div class="span2"><b>Notes:</b> ${t.notes||"—"}</div>
          </div>
          ${photoHtml}
          <div class="row gap end" style="margin-top:.8rem;">
            ${hasPt? `<button class="pill" data-nav>Navigate</button>`:""}
            <button class="pill" data-edit>Edit</button>
            <button class="pill warn" data-close>Close</button>
          </div>
        </div>
      </div>`;

    const wrap=document.createElement("div"); wrap.innerHTML=html; document.body.appendChild(wrap.firstChild);
    const modal=$(".modal");
    modal?.addEventListener("click",(e)=>{ if(e.target===modal || e.target.dataset.close!=null) modal.remove(); });

    // open linked batch
    $("[data-open-batch]",modal)?.addEventListener("click",(e)=>{
      e.preventDefault();
      const b = DB.batches.find(x=> x.id===t.batch);
      if (b && typeof window.openBatchDetails === "function"){ window.openBatchDetails(b); }
      else if (b && window.batchesOpenBatchDetails) window.batchesOpenBatchDetails(b);
    });

    // open linked inspection
    $("[data-open-insp]",modal)?.addEventListener("click",(e)=>{
      e.preventDefault();
      const insp = DB.tasks.find(x=> x.type==="Inspection" && (String(x.id)===t.linkedInspectionId || x.name===t.linkedInspectionId));
      if (insp) { modal.remove(); openJobPopup(insp); }
    });

    // edit (prefill form)
    $("[data-edit]",modal)?.addEventListener("click", ()=>{
      modal.remove();
      switchScreen("createTask");
      $("#jobName").value=t.name; $("#councilNum").value=t.council||""; $("#linkInspectionId").value=t.linkedInspectionId||"";
      $("#taskType").value=t.type; $("#taskType").dispatchEvent(new Event("change"));
      $("#weedSelect").value=t.weed||""; $("#batchSelect").value=t.batch||"";
      $("#jobDate").value=t.date||todayISO(); $("#startTime").value=t.start||""; $("#endTime").value=t.end||"";
      $("#temp").value=t.temp||""; $("#wind").value=t.wind||""; $("#windDir").value=t.windDir||""; $("#humidity").value=t.humidity||"";
      $("#notes").value=t.notes||"";
      if (t.photo){ $("#photoPreview").src=t.photo; $("#photoPreview").style.display="block"; }
    });

    // navigate
    $("[data-nav]",modal)?.addEventListener("click", ()=>{
      const pt = t.coords?.[0]; if(!pt) return alert("No coordinates saved");
      openAppleMaps(pt[0], pt[1]);
    });
  }

  // ---------- Bind unified search bars (Records/Inventory share the same pattern) ----------
  $("#recSearchBtn")?.addEventListener("click", ()=> { renderRecords(); renderInventory(); });
  $("#recResetBtn")?.addEventListener("click", ()=>{
    $("#recSearch").value=""; $("#recFrom").value=""; $("#recTo").value="";
    ["fInspection","fSpot","fRoad","fComplete","fIncomplete","fDraft"].forEach(id=>{ const el=$("#"+id); if (el) el.checked=false; });
    renderRecords(); renderInventory();
  });

  // ---------- Boot ----------
  document.addEventListener("DOMContentLoaded", ()=>{
    splashFade();
    bindNav();
    bindCreateTask();
    renderProcurement();
    // Initial renders for home navigations
    // Records will show when opened; we can pre-render silently once:
    renderRecords();
  });

  // Expose a couple for batches.js compatibility
  window.openAppleMaps = openAppleMaps;
  window.renderRecords  = renderRecords;
  window.renderInventory= renderInventory;
  window.renderProcurement = renderProcurement;
})();
