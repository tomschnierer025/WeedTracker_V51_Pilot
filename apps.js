/* === WeedTracker V60 Final Pilot — FULL apps.js ===
   ✅ AU date format (DD-MM-YYYY) + compact code for job names
   ✅ “Locate Me” (first) → “Auto Name” (second)
   ✅ Weather auto-fill (temp, humidity, wind, wind dir ° + N/NE/E/SE/S/SW/W/NW)
   ✅ “⚠ Noxious Weeds” pinned to top of list (scroll-only)
   ✅ Records & Batches: Open pop-ups work (close on overlay / Close / Esc)
   ✅ Map: visible, “Locate Me” control, clickable pins, Apple Maps navigation
   ✅ SDS (Chemwatch) link pinned at top of Inventory
   ✅ One home button per row (handled by CSS), darker theme (CSS)
   ✅ Spinners & toasts
   ✅ LocalStorage DB with rolling backups (3)
*/

document.addEventListener("DOMContentLoaded", () => {
  /* -------------------- Tiny helpers -------------------- */
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const fmt = (n,d=0)=> (n==null||n==="")?"–":Number(n).toFixed(d);
  const todayISO = () => new Date().toISOString().split("T")[0];
  const nowTime  = () => new Date().toTimeString().slice(0,5);
  const toCompass = (deg)=>{
    if (deg==null||deg==="") return "";
    const dirs=["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
    return dirs[Math.round(((+deg%360)+360)%360/22.5)%16];
  };
  const formatDateAU = (d)=>{
    const dt = (d instanceof Date) ? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2,"0");
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const yyyy = dt.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };
  const formatDateAUCompact = (d)=>{
    const dt = (d instanceof Date) ? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2,"0");
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const yyyy = dt.getFullYear();
    return `${dd}${mm}${yyyy}`;
  };
  const toast=(msg,ms=1500)=>{
    const d=document.createElement("div");
    d.className="toast";
    d.textContent=msg;
    document.body.appendChild(d);
    setTimeout(()=>d.remove(), ms);
  };
  const spin=(on,msg="Working…")=>{
    const s=$("#spinner"); if (!s) return;
    s.textContent = msg;
    s.classList[on?"add":"remove"]("active");
  };

  /* -------------------- DB & seeds -------------------- */
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
    {name:"Crucial", active:"Glyphosate 540 g/L", containerSize:20, containerUnit:"L", containers:4, threshold:2},
    {name:"SuperWet", active:"Non-ionic surfactant", containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Bow Saw 600", active:"Triclopyr 600 g/L", containerSize:1, containerUnit:"L", containers:2, threshold:1},
    {name:"Clethodim", active:"Clethodim 240 g/L", containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Grazon", active:"Triclopyr + Picloram", containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Bosol", active:"Metsulfuron-methyl", containerSize:500, containerUnit:"g", containers:2, threshold:1},
    {name:"Hastings", active:"MCPA", containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Outright", active:"Fluroxypyr", containerSize:20, containerUnit:"L", containers:1, threshold:1}
  ];

  const ensureDB=()=>{
    let db;
    try{ db=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}"); }catch{ db={}; }
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
  };
  let DB = ensureDB();
  const saveDB = (withBackup=true)=>{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
    if (withBackup){
      try{
        const arr = JSON.parse(localStorage.getItem(BACKUP_KEY)||"[]");
        arr.unshift({ts:new Date().toISOString(), db:DB});
        while(arr.length>MAX_BACKUPS) arr.pop();
        localStorage.setItem(BACKUP_KEY, JSON.stringify(arr));
      }catch{}
    }
  };
  const restoreLatest=()=>{
    const arr = JSON.parse(localStorage.getItem(BACKUP_KEY)||"[]");
    if (!arr.length) return null;
    const latest=arr[0].db;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(latest));
    return latest;
  };

  // Offer restore if empty
  if ((!DB.tasks.length && !DB.batches.length && !DB.chems.length) && localStorage.getItem(BACKUP_KEY)){
    if (confirm("Backup found. Restore data now?")){
      const r=restoreLatest(); if (r) DB=r;
    }
  }

  /* -------------------- Splash fade -------------------- */
  const splash=$("#splash");
  setTimeout(()=> splash?.classList.add("hide"), 1200);
  splash?.addEventListener("transitionend", ()=> splash.remove(), {once:true});

  /* -------------------- Navigation -------------------- */
  const screens = $$(".screen");
  function switchScreen(id){
    screens.forEach(s=>s.classList.remove("active"));
    $("#"+id)?.classList.add("active");
    if (id==="records")  renderRecords();
    if (id==="batches")  renderBatches();
    if (id==="inventory") renderChems(), renderProcurement();
    if (id==="mapping")  renderMap(true);
  }
  $$("[data-target]").forEach(b=> b.addEventListener("click", ()=> switchScreen(b.dataset.target)));
  $$(".home-btn").forEach(b=> b.addEventListener("click", (e)=>{e.preventDefault(); switchScreen("home");}));

  /* -------------------- Settings -------------------- */
  const accountInput=$("#accountEmail");
  accountInput && (accountInput.value = DB.accountEmail || "");
  $("#saveAccount")?.addEventListener("click", ()=>{ DB.accountEmail=(accountInput.value||"").trim(); saveDB(); toast("Saved"); });
  $("#exportBtn")?.addEventListener("click", ()=>{
    const blob=new Blob([JSON.stringify(DB,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a");
    a.href=url; a.download="weedtracker_data.json"; a.click();
  });
  $("#restoreBtn")?.addEventListener("click", ()=>{
    const r=restoreLatest(); if (r){ DB=r; renderRecords(); renderBatches(); renderChems(); toast("Restored"); } else toast("No backup");
  });
  $("#clearBtn")?.addEventListener("click", ()=>{
    if (!confirm("Clear ALL local data?")) return;
    localStorage.removeItem(STORAGE_KEY);
    DB = ensureDB();
    renderRecords(); renderBatches(); renderChems(); renderProcurement(); renderMap();
    toast("Cleared");
  });

  /* -------------------- Create Task -------------------- */
  // Reminder 1–52 weeks
  const remSel=$("#reminderWeeks");
  if (remSel && !remSel.options.length) for (let i=1;i<=52;i++){ const o=document.createElement("option"); o.value=o.textContent=i; remSel.appendChild(o); }
  // Default date
  const jobDate=$("#jobDate"); if (jobDate && !jobDate.value) jobDate.value = todayISO();
  // Task type toggles tracking UI
  const taskTypeSel=$("#taskType");
  const roadTrackBlock=$("#roadTrackBlock");
  const syncTrack=()=> roadTrackBlock && (roadTrackBlock.style.display = (taskTypeSel.value==="Road Spray")?"block":"none");
  taskTypeSel?.addEventListener("change", syncTrack); syncTrack();

  // Locate then AutoName
  let currentRoad="";
  $("#locateBtn")?.addEventListener("click", ()=>{
    if (!navigator.geolocation){ toast("Enable Location"); return; }
    spin(true,"Locating…");
    navigator.geolocation.getCurrentPosition(async pos=>{
      const {latitude:lat, longitude:lon}=pos.coords;
      try{
        const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const j=await r.json();
        currentRoad = j.address?.road || j.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      }catch{ currentRoad=`${lat.toFixed(5)}, ${lon.toFixed(5)}`; }
      $("#locRoad").textContent=currentRoad||"Unknown";
      spin(false);
    }, ()=>{ spin(false); toast("GPS failed"); });
  });

  const TYPE_PREFIX = { "Inspection":"I", "Spot Spray":"SS", "Road Spray":"RS" };
  $("#autoNameBtn")?.addEventListener("click", ()=>{
    const t = $("#taskType").value || "Inspection";
    const prefix = TYPE_PREFIX[t] || "I";
    const dt = jobDate && jobDate.value ? new Date(jobDate.value) : new Date();
    const compact = formatDateAUCompact(dt); // DDMMYYYY
    const base = (currentRoad || "Unknown").replace(/\s+/g,"");
    $("#jobName").value = `${prefix}${compact}_${base}`;
  });

  // Weather (temp, humidity, wind, dir° + compass)
  $("#autoWeatherBtn")?.addEventListener("click", ()=>{
    if (!navigator.geolocation){ toast("Enable Location"); return; }
    spin(true,"Fetching weather…");
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
      spin(false);
    }, ()=>{ spin(false); toast("Location not available"); });
  });

  // Weeds: noxious pinned to top
  function populateWeeds(){
    const sel=$("#weedSelect"); if(!sel) return;
    sel.innerHTML="";
    const def=document.createElement("option"); def.value=""; def.textContent="— Select Weed —"; sel.appendChild(def);
    const nox = DB.weeds.filter(w=>/noxious/i.test(w)).sort((a,b)=>a.localeCompare(b));
    const rest= DB.weeds.filter(w=>! /noxious/i.test(w)).sort((a,b)=>a.localeCompare(b));
    [...nox, ...rest].forEach(w=>{
      const o=document.createElement("option");
      o.value=w; o.textContent = /noxious/i.test(w) ? `⚠ ${w}` : w;
      sel.appendChild(o);
    });
  }
  populateWeeds();

  // Batch select
  function populateBatchSelect(){
    const sel=$("#batchSelect"); if(!sel) return;
    sel.innerHTML="";
    const def=document.createElement("option"); def.value=""; def.textContent="— Select Batch —"; sel.appendChild(def);
    DB.batches.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).forEach(b=>{
      const o=document.createElement("option");
      o.value=b.id; o.textContent=`${b.id} • ${formatDateAU(b.date)} • remain ${fmt(b.remaining)} L`;
      sel.appendChild(o);
    });
  }
  populateBatchSelect();

  // Roadside tracking
  let trackTimer=null;
  $("#startTrack")?.addEventListener("click", ()=>{
    if (!navigator.geolocation){ toast("Enable Location"); return; }
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

  // Photo attach
  let photoDataURL="";
  $("#photoInput")?.addEventListener("change",(e)=>{
    const f=e.target.files?.[0]; if(!f) return;
    const rd=new FileReader();
    rd.onload=()=>{ photoDataURL=String(rd.result||""); const img=$("#photoPreview"); img.src=photoDataURL; img.style.display="block"; };
    rd.readAsDataURL(f);
  });

  // Save Task / Draft
  $("#saveTask")?.addEventListener("click", ()=> saveTask(false));
  $("#saveDraft")?.addEventListener("click", ()=> saveTask(true));

  function saveTask(isDraft){
    spin(true,"Saving task…");
    const id=Date.now();
    const status=isDraft?"Draft":($("input[name='status']:checked")?.value||"Incomplete");
    const track=JSON.parse(localStorage.getItem("lastTrack")||"[]");
    const obj={
      id,
      name: $("#jobName").value.trim() || ("Task_"+id),
      council: $("#councilNum").value.trim(),
      linkedInspectionId: $("#linkInspectionId").value.trim(),
      type: $("#taskType").value,
      weed: $("#weedSelect").value,
      batch: $("#batchSelect").value,
      date: $("#jobDate").value || todayISO(),
      start: $("#startTime").value || "",
      end:   $("#endTime").value   || "",
      temp: $("#temp").value, wind: $("#wind").value, windDir: $("#windDir").value, humidity: $("#humidity").value,
      reminder: $("#reminderWeeks").value || "",
      status, notes: $("#notes").value || "",
      coords: track,
      photo: photoDataURL || "",
      createdAt:new Date().toISOString(), archived:false,
      road: currentRoad || ""
    };
    const existing = DB.tasks.find(t=> t.name===obj.name);
    if (existing) Object.assign(existing,obj); else DB.tasks.push(obj);

    // link & archive inspection if provided
    if (obj.linkedInspectionId){
      const insp=DB.tasks.find(t=> t.type==="Inspection" && (String(t.id)===obj.linkedInspectionId || t.name===obj.linkedInspectionId));
      if (insp){ insp.archived=true; insp.status="Archived"; }
    }

    // simple batch consumption heuristic
    if (obj.batch){
      const b=DB.batches.find(x=>x.id===obj.batch);
      if (b){ const used=(obj.type==="Road Spray" && obj.coords?.length>1)?100:0;
        b.used=(b.used||0)+used; b.remaining=Math.max(0,(Number(b.mix)||0)-(b.used||0));
      }
    }

    saveDB(); populateBatchSelect(); renderRecords();
    spin(false); toast("Saved");
  }

  /* -------------------- Records -------------------- */
  $("#recSearchBtn")?.addEventListener("click", renderRecords);
  $("#recResetBtn")?.addEventListener("click", ()=>{
    $("#recSearch").value=""; $("#recFrom").value=""; $("#recTo").value=""; $("#recType").value="All";
    renderRecords();
  });

  function recordMatches(t,q,from,to,typ){
    if (t.archived) return false;
    if (from && (t.date||"")<from) return false;
    if (to && (t.date||"")>to) return false;
    if (typ!=="All" && t.type!==typ) return false;
    if (q){
      const hay=`${t.name} ${t.road||""} ${t.weed||""} ${t.council||""}`.toLowerCase();
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
        d.innerHTML=`<b>${t.name}</b><br><small>${t.type} • ${formatDateAU(t.date)} • ${t.status}</small>
          <div class="row end">
            <button class="pill" data-open="${t.id}">Open</button>
            ${t.coords?.length?`<button class="pill" data-nav="${t.id}">Navigate</button>`:""}
          </div>`;
        d.querySelector("[data-open]").addEventListener("click", ()=> showJobPopup(t));
        const nb=d.querySelector("[data-nav]");
        nb && nb.addEventListener("click", ()=>{
          const pt=t.coords?.[0]; if(!pt){ toast("No coords"); return; }
          openAppleMaps(pt[0],pt[1]);
        });
        list.appendChild(d);
      });
  }
  renderRecords();

  /* -------------------- Batches -------------------- */
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
    DB.batches.filter(b=>(!from||b.date>=from)&&(!to||b.date<=to))
      .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
      .forEach(b=>{
        const item=document.createElement("div"); item.className="item";
        item.innerHTML=`<b>${b.id}</b><br><small>${formatDateAU(b.date)} • Total ${fmt(b.mix)} L • Remaining ${fmt(b.remaining)} L</small>
          <div class="row end"><button class="pill" data-open="${b.id}">Open</button></div>`;
        item.querySelector("[data-open]").addEventListener("click", ()=> showBatchPopup(b));
        list.appendChild(item);
      });
  }
  renderBatches();

  /* -------------------- Inventory -------------------- */
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
  $("#ce_cancel")?.addEventListener("click", ()=> $("#chemEditSheet").style.display="none");
  $("#ce_save")?.addEventListener("click", ()=>{
    if (!_chemEditing) return;
    _chemEditing.name=$("#ce_name").value.trim();
    _chemEditing.active=$("#ce_active").value.trim();
    _chemEditing.containerSize=Number($("#ce_size").value)||0;
    _chemEditing.containerUnit=$("#ce_unit").value||"L";
    _chemEditing.containers=Number($("#ce_count").value)||0;
    _chemEditing.threshold=Number($("#ce_threshold").value)||0;
    saveDB(); $("#chemEditSheet").style.display="none"; renderChems(); renderProcurement(); toast("Chemical updated");
  });

  function renderChems(){
    const list=$("#chemList"); if(!list) return; list.innerHTML="";
    // SDS pinned card
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
      card.querySelector("[data-edit]").addEventListener("click", ()=>{
        _chemEditing=c;
        $("#ce_name").value=c.name; $("#ce_active").value=c.active||"";
        $("#ce_size").value=c.containerSize||0; $("#ce_unit").value=c.containerUnit||"L";
        $("#ce_count").value=c.containers||0; $("#ce_threshold").value=c.threshold||0;
        $("#chemEditSheet").style.display="block";
      });
      card.querySelector("[data-del]").addEventListener("click", ()=>{
        if(!confirm("Delete chemical?")) return;
        DB.chems=DB.chems.filter(x=>x!==c); saveDB(); renderChems(); renderProcurement();
      });
      list.appendChild(card);
    });
  }
  function upsertProc(title){
    DB.procurement ??= [];
    if (!DB.procurement.find(p=>p.title===title)){
      DB.procurement.push({id:"P"+Date.now(),title,createdAt:new Date().toISOString(),done:false});
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

  /* -------------------- Mapping -------------------- */
  let map, locateCtrl;
  function ensureMap(){
    if (map) return map;
    map = L.map("map").setView([-34.75,148.65], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);
    // Locate Me control
    locateCtrl = L.control({position:"bottomright"});
    locateCtrl.onAdd = function(){
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
    $("#mapFrom").value=""; $("#mapTo").value=""; $("#mapWeed").value=""; $("#mapType").value="All"; renderMap(true);
  });

  function openAppleMaps(lat, lon){
    const mapsURL = `maps://?daddr=${lat},${lon}&dirflg=d`;
    const webURL  = `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
    const a=document.createElement("a");
    a.href = mapsURL; document.body.appendChild(a); a.click();
    setTimeout(()=>{ window.open(webURL, "_blank"); a.remove(); }, 300);
  }

  function renderMap(fit=false){
    const m=ensureMap();
    m.eachLayer(l=>{ if (!(l instanceof L.TileLayer)) m.removeLayer(l); });

    const from=$("#mapFrom").value||""; const to=$("#mapTo").value||"";
    const typ=$("#mapType").value||"All";
    const weedQ=($("#mapWeed")?.value || "").trim().toLowerCase();

    const tasks=DB.tasks
      .filter(t=>!t.archived)
      .filter(t=>(!from||t.date>=from)&&(!to||t.date<=to))
      .filter(t=> typ==="All"?true:t.type===typ)
      .filter(t=> weedQ ? (String(t.weed||"").toLowerCase().includes(weedQ)) : true);

    const group = L.featureGroup();

    tasks.forEach(t=>{
      if (t.coords?.length>1) group.addLayer(L.polyline(t.coords,{color:"yellow",weight:4,opacity:.9}));
      const pt = t.coords?.[0] || [-34.75 + Math.random()*0.08, 148.65 + Math.random()*0.08];
      const thumb = t.photo ? `<br><img src="${t.photo}" style="max-width:180px;border-radius:6px;margin-top:.3rem">` : "";
      const openId = `open_${t.id}`;
      const navId  = `nav_${t.id}`;
      const popup = `<b>${t.name}</b><br>${t.type} • ${formatDateAU(t.date)}${thumb}
                     <br><button id="${openId}" class="pill" style="margin-top:.35rem">Open</button>
                     <button id="${navId}" class="pill" style="margin-top:.35rem;margin-left:.4rem">Navigate</button>`;
      const marker = L.marker(pt); marker.bindPopup(popup);
      marker.on("popupopen", ()=>{
        setTimeout(()=>{
          const ob=document.getElementById(openId);
          const nb=document.getElementById(navId);
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
    // also draw lastTrack if present
    try{
      const last = JSON.parse(localStorage.getItem("lastTrack")||"[]");
      if (Array.isArray(last) && last.length>1) L.polyline(last,{color:"#ffda44",weight:3,opacity:.8}).addTo(m);
    }catch{}
  }

  /* -------------------- Popups -------------------- */
  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape"){ const m=$(".modal"); if(m) m.remove(); } });

  function showBatchPopup(b){
    const jobs=DB.tasks.filter(t=>t.batch===b.id);
    const jobsHtml= jobs.length ? `<ul>${jobs.map(t=>`<li><a href="#" data-open-job="${t.id}">${t.name}</a></li>`).join("")}</ul>` : "—";
    const html=`
      <div class="modal">
        <div class="card p">
          <h3 style="margin-top:0">${b.id}</h3>
          <div><b>Date:</b> ${formatDateAU(b.date) || "–"} · <b>Time:</b> ${b.time || "–"}</div>
          <div><b>Total Mix Made:</b> ${fmt(b.mix)} L</div>
          <div><b>Total Mix Remaining:</b> ${fmt(b.remaining)} L</div>
          <div style="margin-top:.4rem;"><b>Chemicals (made of):</b><br>${b.chemicals || "—"}</div>
          <div style="margin-top:.4rem;"><b>Linked Jobs:</b><br>${jobsHtml}</div>
          <div class="row gap end" style="margin-top:.8rem;">
            <button class="pill" data-edit-batch>Edit</button>
            <button class="pill warn" data-close>Close</button>
          </div>
        </div>
      </div>`;
    const wrap=document.createElement("div"); wrap.innerHTML=html; document.body.appendChild(wrap.firstChild);
    const modal=$(".modal");
    modal?.addEventListener("click",(e)=>{ if(e.target===modal || e.target.dataset.close!=null) modal.remove(); });
    $$("[data-open-job]",modal).forEach(a=> a.addEventListener("click",(e)=>{ e.preventDefault(); const t=DB.tasks.find(x=> String(x.id)===a.dataset.openJob); t && showJobPopup(t); }));
    $("[data-edit-batch]",modal)?.addEventListener("click",()=>{
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
            <div><b>Date:</b> ${formatDateAU(t.date)}</div>
            <div><b>Start:</b> ${t.start || "–"} · <b>Finish:</b> ${t.end || "–"}</div>
            <div><b>Weed:</b> ${t.weed || "—"}</div><div><b>Batch:</b> ${batchLink}</div>
            <div class="span2"><b>Weather:</b> ${fmt(t.temp)}°C, ${fmt(t.wind)} km/h, ${t.windDir||"–"}, ${fmt(t.humidity)}%</div>
            <div class="span2"><b>Notes:</b> ${t.notes || "—"}</div>
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

    $("[data-open-batch]",modal)?.addEventListener("click",(e)=>{ e.preventDefault(); const b=DB.batches.find(x=>x.id===t.batch); b && showBatchPopup(b); });
    $("[data-edit]",modal)?.addEventListener("click",()=>{
      switchScreen("createTask");
      $("#jobName").value=t.name; $("#councilNum").value=t.council||""; $("#linkInspectionId").value=t.linkedInspectionId||"";
      $("#taskType").value=t.type; $("#taskType").dispatchEvent(new Event("change"));
      $("#weedSelect").value=t.weed||""; $("#batchSelect").value=t.batch||"";
      $("#jobDate").value=t.date||todayISO(); $("#startTime").value=t.start||""; $("#endTime").value=t.end||"";
      $("#temp").value=t.temp||""; $("#wind").value=t.wind||""; $("#windDir").value=t.windDir||""; $("#humidity").value=t.humidity||"";
      $("#notes").value=t.notes||"";
      if (t.photo){ $("#photoPreview").src=t.photo; $("#photoPreview").style.display="block"; }
      modal.remove();
    });
    $("[data-nav]",modal)?.addEventListener("click", ()=>{
      const pt = t.coords?.[0]; if(!pt){ toast("No coords saved"); return; }
      openAppleMaps(pt[0], pt[1]);
    });
  }

});
