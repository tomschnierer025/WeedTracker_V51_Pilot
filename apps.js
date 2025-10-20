/* === WeedTracker V60 Final Pilot — apps.js (Repair + Color Edition) ===
   What’s in here (all completed):
   - Buttons fixed (no dead clicks). Pop-ups for Records & Batches working.
   - AU date format display (DD-MM-YYYY) + compact code for job names (DDMMYYYY).
   - Locate Me (first) → Auto Name (second).
   - Weather auto-fill (temp, humidity, wind, direction in ° + N/NE/E/…).
   - Noxious weeds pinned to top of list (⚠) — scroll only.
   - Apple Maps navigation from map pins and record pop-ups.
   - “Locate Me” control on the map.
   - SDS (Chemwatch) link is injected in Inventory by apps (pinned to top).
   - One button per row on Home (colors are in styles.css).
   - Spinners & toasts during save/create actions.
   - LocalStorage DB + small rotating backups.
*/

document.addEventListener("DOMContentLoaded", () => {
  /* ----------------- helpers ----------------- */
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const todayISO = () => new Date().toISOString().split("T")[0];
  const nowTime  = () => new Date().toTimeString().slice(0,5);
  const fmt = (n,d=0)=> (n==null||n==="")?"–":Number(n).toFixed(d);
  const toCompass = deg => {
    if (deg==null || deg==="") return "";
    const dirs=["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
    return dirs[Math.round((((+deg)%360)+360)%360/22.5)%16];
  };
  const auDate = (d)=>{
    const dt = (d instanceof Date) ? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2,"0");
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const yyyy = dt.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };
  const auDateCompact = (d)=>{
    const dt = (d instanceof Date) ? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2,"0");
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const yyyy = dt.getFullYear();
    return `${dd}${mm}${yyyy}`;
  };
  const toast = (msg, ms=1600)=>{
    const old=document.querySelector(".toast"); if(old) old.remove();
    const d=document.createElement("div"); d.className="toast"; d.textContent=msg; document.body.appendChild(d);
    setTimeout(()=>d.remove(),ms);
  };
  const spinner = {
    on(msg="Working…"){ const s=$("#spinner"); if(!s) return; s.textContent=msg; s.classList.add("active"); },
    off(){ $("#spinner")?.classList.remove("active"); }
  };

  /* ----------------- DB + seeds ----------------- */
  const STORAGE_KEY="weedtracker_data";
  const BACKUP_KEY ="weedtracker_backup";
  const MAX_BACKUPS=3;

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

  const DEFAULT_CHEMS = [
    {name:"Crucial",   active:"Glyphosate 540 g/L",   containerSize:20, containerUnit:"L", containers:4, threshold:2},
    {name:"SuperWet",  active:"Non-ionic surfactant", containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Bow Saw 600",active:"Triclopyr 600 g/L",    containerSize:1,  containerUnit:"L", containers:2, threshold:1},
    {name:"Clethodim", active:"Clethodim 240 g/L",    containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Grazon",    active:"Triclopyr + Picloram", containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Bosol",     active:"Metsulfuron-methyl",   containerSize:500,containerUnit:"g", containers:2, threshold:1},
    {name:"Hastings",  active:"MCPA",                 containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Outright",  active:"Fluroxypyr",           containerSize:20, containerUnit:"L", containers:1, threshold:1}
  ];

  function saveDB(withBackup=true){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
    if (!withBackup) return;
    try{
      const arr = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
      arr.unshift({ts:new Date().toISOString(), db:DB});
      while (arr.length>MAX_BACKUPS) arr.pop();
      localStorage.setItem(BACKUP_KEY, JSON.stringify(arr));
    }catch{}
  }
  function ensureDB(){
    let db;
    try{ db = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }catch{ db = {}; }
    db.version ??= 60;
    db.accountEmail ??= "";
    db.tasks ??= [];
    db.batches ??= [];
    db.chems ??= [];
    db.procurement ??= [];
    db.weeds ??= NSW_WEEDS_40.slice();
    if (!db.chems.length) db.chems = DEFAULT_CHEMS.slice();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return db;
  }
  function restoreLatest(){
    const arr = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
    if (!arr.length) return null;
    const latest = arr[0].db;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(latest));
    return latest;
  }
  let DB = ensureDB();

  // Offer restore if everything empty but backups exist
  if ((!DB.tasks.length && !DB.batches.length && !DB.chems.length) && localStorage.getItem(BACKUP_KEY)){
    if (confirm("Backup found. Restore data now?")){
      const r=restoreLatest();
      if (r){ DB=r; }
    }
  }

  /* ----------------- splash fade ----------------- */
  const splash=$("#splash");
  if (splash){
    setTimeout(()=> splash.classList.add("hide"), 900);
    splash.addEventListener("transitionend", ()=> splash.remove(), {once:true});
  }

  /* ----------------- navigation ----------------- */
  const screens = $$(".screen");
  function switchScreen(id){
    screens.forEach(s=>s.classList.remove("active"));
    $("#"+id)?.classList.add("active");

    // lazy renders
    if (id==="records")   renderRecords();
    if (id==="batches")   renderBatches();
    if (id==="inventory") { renderChems(); renderProcurement(); }
    if (id==="mapping")   renderMap(true);
  }
  // Primary nav buttons
  $$("[data-target]").forEach(b=>{
    b.addEventListener("click", ()=> switchScreen(b.dataset.target));
  });
  // Back to home
  $$(".back").forEach(b=> b.addEventListener("click", ()=> switchScreen("home")));

  // Failsafe: if any nav button was missed by the browser cache, rebind on body
  document.body.addEventListener("click",(e)=>{
    const el=e.target.closest("[data-target]");
    if (el){ e.preventDefault(); switchScreen(el.dataset.target); }
  });

  /* ----------------- settings ----------------- */
  const accountInput=$("#accountEmail");
  if (accountInput) accountInput.value = DB.accountEmail || "";
  $("#saveAccount")?.addEventListener("click", ()=>{
    DB.accountEmail = (accountInput.value||"").trim();
    saveDB(false); toast("Saved");
  });
  $("#exportBtn")?.addEventListener("click", ()=>{
    const blob=new Blob([JSON.stringify(DB,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download="weedtracker_data.json"; a.click();
  });
  $("#restoreBtn")?.addEventListener("click", ()=>{
    const r=restoreLatest();
    if (r){ DB=r; renderRecords(); renderBatches(); renderChems(); renderProcurement(); toast("Restored"); }
    else toast("No backup found");
  });
  $("#clearBtn")?.addEventListener("click", ()=>{
    if (!confirm("Clear ALL local data?")) return;
    localStorage.removeItem(STORAGE_KEY);
    DB = ensureDB();
    renderRecords(); renderBatches(); renderChems(); renderProcurement(); renderMap();
    toast("Cleared");
  });

  /* ----------------- create task ----------------- */
  // Reminder (1–52 weeks)
  const remSel=$("#reminderWeeks");
  if (remSel && !remSel.options.length) for (let i=1;i<=52;i++){ const o=document.createElement("option"); o.value=o.textContent=i; remSel.appendChild(o); }

  // Ensure date control set (ISO for input)
  const jobDate=$("#jobDate"); if (jobDate && !jobDate.value) jobDate.value = todayISO();

  // Show roadside tracking only for Road Spray
  const taskTypeSel=$("#taskType");
  const roadTrackBlock=$("#roadTrackBlock");
  const trackVis = ()=>{ if (roadTrackBlock) roadTrackBlock.style.display = (taskTypeSel.value==="Road Spray")?"block":"none"; };
  taskTypeSel?.addEventListener("change", trackVis); trackVis();

  // Locate Me then Auto Name
  const locateBtn=$("#locateBtn");
  const locRoad=$("#locRoad");
  let currentRoad="";

  locateBtn?.addEventListener("click", ()=>{
    if (!navigator.geolocation){ toast("Enable location services"); return; }
    spinner.on("Locating…");
    navigator.geolocation.getCurrentPosition(async pos=>{
      const {latitude:lat, longitude:lon}=pos.coords;
      try{
        const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const j=await r.json();
        currentRoad = j.address?.road || j.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      }catch{
        currentRoad = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      }
      if (locRoad) locRoad.textContent = currentRoad || "Unknown";
      spinner.off();
    }, ()=>{ spinner.off(); toast("GPS failed"); });
  });

  const TYPE_PREFIX={Inspection:"I","Spot Spray":"SS","Road Spray":"RS"};
  $("#autoNameBtn")?.addEventListener("click", ()=>{
    const t = $("#taskType").value || "Inspection";
    const prefix = TYPE_PREFIX[t] || "I";
    const dt = jobDate && jobDate.value ? new Date(jobDate.value) : new Date();
    const code = auDateCompact(dt);
    const base = (currentRoad||"Unknown").replace(/\s+/g,"");
    $("#jobName").value = `${prefix}${code}_${base}`;
  });

  // Weather auto-fill
  $("#autoWeatherBtn")?.addEventListener("click", ()=>{
    if (!navigator.geolocation){ toast("Enable location services"); return; }
    spinner.on("Fetching weather…");
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{
        const {latitude, longitude}=pos.coords;
        const url=`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;
        const r=await fetch(url); const j=await r.json(); const c=j.current||{};
        $("#temp").value     = c.temperature_2m ?? "";
        $("#wind").value     = c.wind_speed_10m ?? "";
        const wdir = c.wind_direction_10m;
        $("#windDir").value  = (wdir!=null ? `${wdir}° (${toCompass(wdir)})` : "");
        $("#humidity").value = c.relative_humidity_2m ?? "";
        $("#wxUpdated").textContent = "Updated @ " + nowTime();
      }catch{ toast("Weather unavailable"); }
      spinner.off();
    }, ()=>{ spinner.off(); toast("Location not available"); });
  });

  // Populate weeds (noxious first)
  function populateWeeds(){
    const sel=$("#weedSelect"); if (!sel) return;
    sel.innerHTML="";
    const def=document.createElement("option"); def.value=""; def.textContent="— Select Weed —"; sel.appendChild(def);
    const nox=DB.weeds.filter(w=>/noxious/i.test(w)).sort((a,b)=>a.localeCompare(b));
    const rest=DB.weeds.filter(w=>! /noxious/i.test(w)).sort((a,b)=>a.localeCompare(b));
    [...nox, ...rest].forEach(w=>{
      const o=document.createElement("option");
      o.value=w; o.textContent = /noxious/i.test(w) ? `⚠ ${w}` : w;
      sel.appendChild(o);
    });
  }
  populateWeeds();

  // Populate batches select
  function populateBatchSelect(){
    const sel=$("#batchSelect"); if (!sel) return;
    sel.innerHTML="";
    const def=document.createElement("option"); def.value=""; def.textContent="— Select Batch —"; sel.appendChild(def);
    DB.batches.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).forEach(b=>{
      const o=document.createElement("option");
      o.value=b.id; o.textContent=`${b.id} • ${auDate(b.date)} • remain ${fmt(b.remaining)} L`;
      sel.appendChild(o);
    });
  }
  populateBatchSelect();

  // Roadside tracking
  let trackTimer=null;
  $("#startTrack")?.addEventListener("click", ()=>{
    if (!navigator.geolocation){ toast("Enable location services"); return; }
    $("#trackStatus").textContent="Tracking…";
    const coords=[];
    if (trackTimer) clearInterval(trackTimer);
    trackTimer=setInterval(()=>{
      navigator.geolocation.getCurrentPosition(p=>{
        coords.push([p.coords.latitude,p.coords.longitude]);
        localStorage.setItem("lastTrack", JSON.stringify(coords));
      });
    }, 5000);
  });
  $("#stopTrack")?.addEventListener("click", ()=>{
    if (trackTimer) clearInterval(trackTimer);
    $("#trackStatus").textContent="Stopped";
  });

  // Photo upload
  let photoDataURL="";
  $("#photoInput")?.addEventListener("change",(e)=>{
    const f=e.target.files?.[0]; if(!f) return;
    const rd=new FileReader();
    rd.onload=()=>{ photoDataURL=String(rd.result||""); const img=$("#photoPreview"); img.src=photoDataURL; img.style.display="block"; };
    rd.readAsDataURL(f);
  });

  // Save task / draft
  $("#saveTask")?.addEventListener("click", ()=> saveTask(false));
  $("#saveDraft")?.addEventListener("click", ()=> saveTask(true));

  function saveTask(isDraft){
    spinner.on("Saving task…");
    const id=Date.now();
    const status=isDraft?"Draft":"Incomplete";
    const track=JSON.parse(localStorage.getItem("lastTrack")||"[]");
    const obj={
      id,
      name: $("#jobName").value.trim() || ("Task_"+id),
      council: "",
      linkedInspectionId: "",
      type: $("#taskType").value,
      weed: $("#weedSelect").value,
      batch: $("#batchSelect").value,
      date: $("#jobDate").value || todayISO(), // stored ISO
      start: $("#startTime").value || "",
      end:   $("#endTime").value   || "",
      temp: $("#temp").value, wind: $("#wind").value, windDir: $("#windDir").value, humidity: $("#humidity").value,
      reminder: $("#reminderWeeks").value || "",
      status, notes: $("#notes").value || "",
      coords: track,
      photo: photoDataURL || "",
      createdAt:new Date().toISOString(), archived:false,
      road: $("#locRoad")?.textContent || ""
    };
    const existing = DB.tasks.find(t=> t.name===obj.name);
    if (existing) Object.assign(existing,obj); else DB.tasks.push(obj);

    // consume batch a little on Road Spray as heuristic
    if (obj.batch){
      const b=DB.batches.find(x=>x.id===obj.batch);
      if (b){ const used=(obj.type==="Road Spray" && obj.coords?.length>1)?100:0;
        b.used=(b.used||0)+used; b.remaining=Math.max(0,(Number(b.mix)||0)-(b.used||0));
      }
    }

    saveDB(); populateBatchSelect(); renderRecords();
    spinner.off(); toast("Saved");
  }

  /* ----------------- records ----------------- */
  $("#recSearchBtn")?.addEventListener("click", renderRecords);
  $("#recResetBtn")?.addEventListener("click", ()=>{
    $("#recSearch").value=""; $("#recFrom").value=""; $("#recTo").value="";
    $("#recType").value="All";
    renderRecords();
  });

  function recordMatches(t,q,from,to,typ){
    if (t.archived) return false;
    if (from && (t.date||"")<from) return false;
    if (to && (t.date||"")>to) return false;
    if (typ!=="All" && t.type!==typ) return false;
    if (q){
      const hay=`${t.name} ${t.road||""} ${t.weed||""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }

  function renderRecords(){
    const list=$("#recordsList"); if(!list) return; list.innerHTML="";
    const q=$("#recSearch").value.trim();
    const from=$("#recFrom").value||""; const to=$("#recTo").value||"";
    const typ=$("#recType")?.value||"All";

    DB.tasks.filter(t=>recordMatches(t,q,from,to,typ))
      .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
      .forEach(t=>{
        const d=document.createElement("div"); d.className="item";
        d.innerHTML=`<b>${t.name}</b><br><small>${t.type} • ${auDate(t.date)} • ${t.status}</small>
          <div class="row end">
            <button class="pill" data-open="${t.id}">Open</button>
            ${t.coords?.length?`<button class="pill" data-nav="${t.id}">Navigate</button>`:""}
          </div>`;
        d.querySelector("[data-open]")?.addEventListener("click", ()=> showJobPopup(t));
        const nb=d.querySelector("[data-nav]");
        nb && nb.addEventListener("click", ()=>{
          const pt=t.coords?.[0]; if(!pt){ toast("No coords"); return; }
          openAppleMaps(pt[0],pt[1]);
        });
        list.appendChild(d);
      });
  }
  renderRecords();

  /* ----------------- batches ----------------- */
  $("#batSearchBtn")?.addEventListener("click", renderBatches);
  $("#batResetBtn")?.addEventListener("click", ()=>{ $("#batFrom").value=""; $("#batTo").value=""; renderBatches(); });
  $("#newBatch")?.addEventListener("click", ()=>{
    const id="B"+Date.now();
    const mix=Number(prompt("Total mix (L):","600"))||0;
    const chems=prompt("Chemicals (e.g. Crucial 1.5L/100L, Wetter 300mL/100L)","")||"";
    const obj={id,date:todayISO(),time:nowTime(),mix,remaining:mix,used:0,chemicals:chems};
    DB.batches.push(obj); saveDB(); populateBatchSelect(); renderBatches(); toast("Batch created");
  });

  function renderBatches(){
    const list=$("#batchList"); if(!list) return; list.innerHTML="";
    const from=$("#batFrom").value||""; const to=$("#batTo").value||"";
    DB.batches
      .filter(b=>(!from||b.date>=from)&&(!to||b.date<=to))
      .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
      .forEach(b=>{
        const item=document.createElement("div"); item.className="item";
        item.innerHTML=`<b>${b.id}</b><br><small>${auDate(b.date)} • Total ${fmt(b.mix)} L • Remaining ${fmt(b.remaining)} L</small>
          <div class="row end"><button class="pill" data-open="${b.id}">Open</button></div>`;
        item.querySelector("[data-open]")?.addEventListener("click", ()=> showBatchPopup(b));
        list.appendChild(item);
      });
  }
  renderBatches();

  /* ----------------- inventory (with SDS pinned link) ----------------- */
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

  let _chemEditing=null;
  $("#ce_cancel")?.addEventListener("click", ()=>{ $("#chemEditSheet").style.display="none"; _chemEditing=null; });
  $("#ce_save")?.addEventListener("click", ()=>{
    if (!_chemEditing) return;
    _chemEditing.name=$("#ce_name").value.trim();
    _chemEditing.active=$("#ce_active").value.trim();
    _chemEditing.containerSize=Number($("#ce_size").value)||0;
    _chemEditing.containerUnit=$("#ce_unit").value||"L";
    _chemEditing.containers=Number($("#ce_count").value)||0;
    _chemEditing.threshold=Number($("#ce_threshold").value)||0;
    saveDB(); renderChems(); renderProcurement();
    $("#chemEditSheet").style.display="none"; _chemEditing=null; toast("Chemical updated");
  });

  function renderChems(){
    const list=$("#chemList"); if(!list) return; list.innerHTML="";
    // SDS link pinned at top
    const sds=document.createElement("div");
    sds.className="item sds";
    sds.innerHTML=`<b>Safety Data Sheets (SDS)</b><br>
      <a class="pill" target="_blank" rel="noopener" href="https://online.chemwatch.net/">Open Chemwatch</a>`;
    list.appendChild(sds);

    DB.chems.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach(c=>{
      const total=(c.containers||0)*(c.containerSize||0);
      const card=document.createElement("div"); card.className="item";
      card.innerHTML=`<b>${c.name}</b><br>
        <small>${c.containers} × ${fmt(c.containerSize)} ${c.containerUnit} • total ${fmt(total)} ${c.containerUnit}</small><br>
        <small>Active: ${c.active||"—"}</small>
        <div class="row end" style="margin-top:.35rem">
          <button class="pill" data-edit>Edit</button>
          <button class="pill warn" data-del>Delete</button>
        </div>`;
      if (c.threshold && (c.containers||0)<c.threshold) upsertProc(`Low stock: ${c.name}`);
      card.querySelector("[data-edit]")?.addEventListener("click", ()=>{
        _chemEditing=c;
        $("#ce_name").value=c.name; $("#ce_active").value=c.active||"";
        $("#ce_size").value=c.containerSize||0; $("#ce_unit").value=c.containerUnit||"L";
        $("#ce_count").value=c.containers||0; $("#ce_threshold").value=c.threshold||0;
        $("#chemEditSheet").style.display="block";
      });
      card.querySelector("[data-del]")?.addEventListener("click", ()=>{
        if(!confirm("Delete chemical?")) return;
        DB.chems=DB.chems.filter(x=>x!==c); saveDB(); renderChems(); renderProcurement();
      });
      list.appendChild(card);
    });
  }
  function upsertProc(title){
    DB.procurement ??= [];
    if (!DB.procurement.find(p=>p.title===title)){
      DB.procurement.push({id:"P"+Date.now(), title, createdAt:new Date().toISOString(), done:false});
      saveDB();
    }
  }
  function renderProcurement(){
    const ul=$("#procList"); if(!ul) return; ul.innerHTML="";
    DB.chems.forEach(c=>{
      if (c.threshold && (c.containers||0)<c.threshold){
        const li=document.createElement("li");
        li.textContent=`Low stock: ${c.name} (${c.containers||0} < ${c.threshold})`;
        ul.appendChild(li);
      }
    });
  }
  renderChems(); renderProcurement();

  /* ----------------- mapping ----------------- */
  let map, locateCtrl;
  function ensureMap(){
    if (map) return map;
    map = L.map("map").setView([-34.75,148.65], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);

    // Locate Me control
    locateCtrl = L.control({position:"bottomright"});
    locateCtrl.onAdd=function(){
      const d=L.DomUtil.create("div","leaflet-bar");
      Object.assign(d.style,{background:"#0c7d2b",color:"#fff",borderRadius:"6px",padding:"6px 10px",cursor:"pointer"});
      d.innerText="Locate Me";
      d.onclick=()=>{
        if (!navigator.geolocation){ toast("Enable location"); return; }
        navigator.geolocation.getCurrentPosition(p=>{
          const pt=[p.coords.latitude,p.coords.longitude];
          map.setView(pt, 14);
          L.circleMarker(pt,{radius:7,opacity:.9}).addTo(map).bindPopup("You are here").openPopup();
        });
      };
      return d;
    };
    locateCtrl.addTo(map);
    return map;
  }

  $("#mapSearchBtn")?.addEventListener("click", ()=>renderMap(true));
  $("#mapResetBtn")?.addEventListener("click", ()=>{
    $("#mapFrom").value=""; $("#mapTo").value=""; $("#mapWeed").value=""; $("#mapType").value="All";
    renderMap(true);
  });

  function openAppleMaps(lat, lon){
    const mapsURL=`maps://?daddr=${lat},${lon}&dirflg=d`;
    const webURL =`https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
    const a=document.createElement("a"); a.href=mapsURL; document.body.appendChild(a); a.click();
    setTimeout(()=>{ window.open(webURL,"_blank"); a.remove(); },300);
  }

  function renderMap(fit=false){
    const m=ensureMap();
    // clear non-tile layers
    m.eachLayer(l=>{ if (!(l instanceof L.TileLayer)) m.removeLayer(l); });

    const from=$("#mapFrom").value||""; const to=$("#mapTo").value||"";
    const typ=$("#mapType").value||"All";
    const weedQ=($("#mapWeed")?.value||"").trim().toLowerCase();

    const tasks=DB.tasks
      .filter(t=>!t.archived)
      .filter(t=>(!from||t.date>=from)&&(!to||t.date<=to))
      .filter(t=> typ==="All"?true:t.type===typ)
      .filter(t=> weedQ ? (String(t.weed||"").toLowerCase().includes(weedQ)) : true);

    const group=L.featureGroup();

    tasks.forEach(t=>{
      if (t.coords?.length>1) group.addLayer(L.polyline(t.coords,{color:"yellow",weight:4,opacity:.9}));
      const pt=t.coords?.[0] || [-34.75 + Math.random()*0.08, 148.65 + Math.random()*0.08];
      const thumb=t.photo ? `<br><img src="${t.photo}" style="max-width:180px;border-radius:6px;margin-top:.3rem">` : "";
      const openId=`open_${t.id}`; const navId=`nav_${t.id}`;
      const popup=`<b>${t.name}</b><br>${t.type} • ${auDate(t.date)}${thumb}
                   <br><button id="${openId}" class="pill" style="margin-top:.35rem">Open</button>
                   <button id="${navId}" class="pill" style="margin-top:.35rem;margin-left:.4rem">Navigate</button>`;
      const marker=L.marker(pt); marker.bindPopup(popup);
      marker.on("popupopen", ()=>{
        setTimeout(()=>{
          const ob=document.getElementById(openId);
          const nb=document.getElementById(navId);
          if (ob) ob.onclick = ()=> showJobPopup(t);
          if (nb) nb.onclick = ()=> openAppleMaps(pt[0], pt[1]);
        },0);
      });
      group.addLayer(marker);
    });

    group.addTo(m);
    if (fit && tasks.length){
      try{ m.fitBounds(group.getBounds().pad(0.2)); }catch{}
    }
    // show last tracked line (quick visual)
    try{
      const last=JSON.parse(localStorage.getItem("lastTrack")||"[]");
      if (Array.isArray(last) && last.length>1){
        L.polyline(last,{color:"#ffda44",weight:3,opacity:.85}).addTo(m);
      }
    }catch{}
  }

  /* ----------------- popups ----------------- */
  document.addEventListener("keydown",(e)=>{
    if (e.key==="Escape"){ const m=document.querySelector(".modal"); if(m) m.remove(); }
  });

  function showBatchPopup(b){
    const jobs=DB.tasks.filter(t=>t.batch===b.id);
    const jobsHtml= jobs.length ? `<ul>${jobs.map(t=>`<li><a href="#" data-open-job="${t.id}">${t.name}</a></li>`).join("")}</ul>` : "—";
    const html=`
      <div class="modal">
        <div class="card p">
          <h3 style="margin-top:0">${b.id}</h3>
          <div><b>Date:</b> ${auDate(b.date)||"–"} · <b>Time:</b> ${b.time||"–"}</div>
          <div><b>Total Mix Made:</b> ${fmt(b.mix)} L</div>
          <div><b>Total Mix Remaining:</b> ${fmt(b.remaining)} L</div>
          <div style="margin-top:.4rem;"><b>Chemicals (made of):</b><br>${b.chemicals||"—"}</div>
          <div style="margin-top:.4rem;"><b>Linked Jobs:</b><br>${jobsHtml}</div>
          <div class="row gap end" style="margin-top:.8rem;">
            <button class="pill" data-edit-batch>Edit</button>
            <button class="pill warn" data-close>Close</button>
          </div>
        </div>
      </div>`;
    const wrap=document.createElement("div"); wrap.innerHTML=html; document.body.appendChild(wrap.firstChild);
    const modal=document.querySelector(".modal");
    modal?.addEventListener("click",(e)=>{ if(e.target===modal || e.target.dataset.close!=null) modal.remove(); });

    // open job from list
    document.querySelectorAll("[data-open-job]").forEach(a=>{
      a.addEventListener("click",(e)=>{
        e.preventDefault();
        const t=DB.tasks.find(x=> String(x.id)===a.dataset.openJob);
        if (t) showJobPopup(t);
      });
    });
    // edit batch quick
    document.querySelector("[data-edit-batch]")?.addEventListener("click", ()=>{
      const mix=Number(prompt("Total mix (L):",b.mix))||b.mix;
      const rem=Number(prompt("Remaining (L):",b.remaining))||b.remaining;
      const chems=prompt("Chemicals:",b.chemicals||"")||b.chemicals||"";
      b.mix=mix; b.remaining=rem; b.chemicals=chems; b.time ||= nowTime();
      saveDB(); modal.remove(); renderBatches(); populateBatchSelect();
    });
  }

  function showJobPopup(t){
    const batchLink = t.batch ? `<a href="#" data-open-batch="${t.batch}">${t.batch}</a>` : "—";
    const photoHtml = t.photo ? `<div style="margin:.4rem 0"><img src="${t.photo}" alt="photo" style="max-width:100%;border-radius:8px"/></div>` : "";
    const hasPt = t.coords && t.coords.length;
    const html=`
      <div class="modal">
        <div class="card p">
          <h3 style="margin-top:0">${t.name}</h3>
          <div class="grid two tight">
            <div><b>Type:</b> ${t.type}</div><div><b>Status:</b> ${t.status}</div>
            <div><b>Date:</b> ${auDate(t.date)}</div>
            <div><b>Start:</b> ${t.start||"–"} · <b>Finish:</b> ${t.end||"–"}</div>
            <div><b>Weed:</b> ${t.weed||"—"}</div><div><b>Batch:</b> ${batchLink}</div>
            <div class="span2"><b>Weather:</b> ${fmt(t.temp)}°C, ${fmt(t.wind)} km/h, ${t.windDir||"–"}, ${fmt(t.humidity)}%</div>
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
    const modal=document.querySelector(".modal");
    modal?.addEventListener("click",(e)=>{ if(e.target===modal || e.target.dataset.close!=null) modal.remove(); });

    document.querySelector("[data-open-batch]")?.addEventListener("click",(e)=>{
      e.preventDefault();
      const b=DB.batches.find(x=>x.id===t.batch);
      if (b) showBatchPopup(b);
    });
    document.querySelector("[data-edit]")?.addEventListener("click",()=>{
      switchScreen("createTask");
      $("#jobName").value=t.name; $("#taskType").value=t.type; $("#taskType").dispatchEvent(new Event("change"));
      $("#weedSelect").value=t.weed||""; $("#batchSelect").value=t.batch||"";
      $("#jobDate").value=t.date||todayISO(); $("#startTime").value=t.start||""; $("#endTime").value=t.end||"";
      $("#temp").value=t.temp||""; $("#wind").value=t.wind||""; $("#windDir").value=t.windDir||""; $("#humidity").value=t.humidity||"";
      $("#notes").value=t.notes||"";
      if (t.photo){ $("#photoPreview").src=t.photo; $("#photoPreview").style.display="block"; }
      modal.remove();
    });
    document.querySelector("[data-nav]")?.addEventListener("click", ()=>{
      const pt = t.coords?.[0]; if(!pt){ toast("No coords saved"); return; }
      openAppleMaps(pt[0], pt[1]);
    });
  }

}); // DOMContentLoaded
