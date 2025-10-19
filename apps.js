/* === WeedTracker V61 Pilot — FULL apps.js ===
   ✅ Map + Locate Me
   ✅ Delegated pop-ups (Records & Batches)
   ✅ Wind direction = Compass + Degrees (e.g. NE (45°))
   ✅ "⚠ Noxious Weeds" header pinned to top of list
   ✅ 40 NSW weeds (noxious highlighted)
   ✅ Chemicals seeded, inventory editor
   ✅ Start/Stop road tracking
   ✅ Apple Maps navigation
   ✅ Spinners + toasts
   ✅ Backups/restore/export
   ✅ AU date display (DD-MM-YYYY)
*/

document.addEventListener("DOMContentLoaded", () => {
  // -------------------------------------------------
  // UTIL SHORTCUTS (from extras.js)
  // -------------------------------------------------
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const fmt = (n, d=0) => (n==null || n==="") ? "–" : Number(n).toFixed(d);
  const todayISO = () => new Date().toISOString().split("T")[0];
  const nowTime  = () => new Date().toTimeString().slice(0,5);

  function formatDateAU(d) {
    const dt = (d instanceof Date) ? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2,"0");
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const yy = dt.getFullYear();
    return `${dd}-${mm}-${yy}`;
  }
  function formatDateAUCompact(d) {
    const dt = (d instanceof Date) ? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2,"0");
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const yy = dt.getFullYear();
    return `${dd}${mm}${yy}`;
  }

  // Degrees → Compass (8-point)
  function degToCompass(deg) {
    if (deg==="" || deg==null || isNaN(Number(deg))) return "";
    const dirs = ["N","NE","E","SE","S","SW","W","NW"];
    const i = Math.round(((Number(deg) % 360) / 45)) % 8;
    return dirs[i];
  }

  // Spinner & toasts (from extras.js)
  const setSpinner = (on,text="Working…") => {
    let sp = $("#spinner");
    if (!sp) {
      sp = document.createElement("div");
      sp.id = "spinner";
      sp.className = "spinner";
      sp.textContent = text;
      document.body.appendChild(sp);
    }
    sp.textContent = text;
    sp.classList[on ? "add" : "remove"]("active");
  };
  function toast(msg, ms=1600){
    const d=document.createElement("div");
    d.textContent=msg;
    Object.assign(d.style,{
      position:"fixed",bottom:"1.2rem",left:"50%",transform:"translateX(-50%)",
      background:"#d9f7d9",color:"#063",padding:".6rem 1rem",borderRadius:"20px",
      boxShadow:"0 2px 8px rgba(0,0,0,.25)",zIndex:9999,fontWeight:800
    });
    document.body.appendChild(d); setTimeout(()=>d.remove(),ms);
  }
  function openAppleMaps(lat, lon){
    const mapsURL=`maps://?daddr=${lat},${lon}&dirflg=d`;
    const webURL =`https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
    const a=document.createElement("a"); a.href=mapsURL; document.body.appendChild(a); a.click();
    setTimeout(()=>{ window.open(webURL,"_blank"); a.remove(); },300);
  }

  // -------------------------------------------------
  // STORAGE / DB (from storage.js)
  // -------------------------------------------------
  // ensureDB(), saveDB(), restoreLatest() are loaded via storage.js
  let DB = ensureDB();
  const saveNow = () => saveDB(true);

  // Seed special header + make sure weeds include header at index 0
  function ensureNoxiousHeader() {
    if (!DB.weeds || !Array.isArray(DB.weeds)) DB.weeds = [];
    const hasHeader = DB.weeds.some(w => /^⚠\s*Noxious Weeds$/i.test(w));
    if (!hasHeader) {
      // Put header at top
      DB.weeds = ["⚠ Noxious Weeds", ...DB.weeds];
      saveNow();
    }
  }
  ensureNoxiousHeader();

  // -------------------------------------------------
  // SPLASH
  // -------------------------------------------------
  const splash=$("#splash");
  setTimeout(()=> splash?.classList.add("hide"), 900);
  splash?.addEventListener("transitionend", ()=> splash.remove(), {once:true});

  // -------------------------------------------------
  // NAV
  // -------------------------------------------------
  const screens = $$(".screen");
  function switchScreen(id){
    screens.forEach(s=> s.classList.remove("active"));
    $("#"+id)?.classList.add("active");
    if (id==="records")  renderRecords();
    if (id==="batches")  renderBatches();
    if (id==="inventory") renderChems();
    if (id==="mapping")  { setTimeout(()=>renderMap(true), 25); } // ensure mount
  }
  $$("[data-target]").forEach(b=> b.addEventListener("click", ()=> switchScreen(b.dataset.target)));
  $$(".home-btn").forEach(b=> b.addEventListener("click", (e)=>{ e.preventDefault(); switchScreen("home"); }));

  // -------------------------------------------------
  // SETTINGS / DATA
  // -------------------------------------------------
  const account=$("#accountEmail");
  if (account) account.value = DB.accountEmail || "";
  $("#saveAccount")?.addEventListener("click", ()=>{ DB.accountEmail=(account.value||"").trim(); saveNow(); toast("Saved"); });
  $("#exportBtn")?.addEventListener("click", ()=>{
    const blob=new Blob([JSON.stringify(DB,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a");
    a.href=url; a.download="weedtracker_data.json"; a.click();
  });
  $("#restoreBtn")?.addEventListener("click", ()=>{
    const r=restoreLatest();
    if (r){ DB=r; renderRecords(); renderBatches(); renderChems(); renderMap(); toast("Restored"); }
    else toast("No backup found");
  });
  $("#clearBtn")?.addEventListener("click", ()=>{
    if (!confirm("Clear ALL local data?")) return;
    localStorage.removeItem("weedtracker_data");
    DB = ensureDB(); ensureNoxiousHeader();
    renderRecords(); renderBatches(); renderChems(); renderMap();
  });

  // -------------------------------------------------
  // CREATE TASK
  // -------------------------------------------------
  const remSel = $("#reminderWeeks");
  if (remSel && !remSel.options.length) for (let i=1;i<=52;i++){ const o=document.createElement("option"); o.value=o.textContent=i; remSel.appendChild(o); }

  const taskTypeSel=$("#taskType");
  const roadTrackBlock=$("#roadTrackBlock");
  const syncTrackVis=()=> roadTrackBlock.style.display = (taskTypeSel.value==="Road Spray")?"block":"none";
  taskTypeSel?.addEventListener("change", syncTrackVis); syncTrackVis();

  // Location & auto-name
  const locateBtn=$("#locateBtn");
  const locRoad=$("#locRoad");
  let currentRoad="";
  locateBtn?.addEventListener("click", ()=>{
    setSpinner(true,"Locating…");
    if (!navigator.geolocation){ setSpinner(false); return toast("Enable location"); }
    navigator.geolocation.getCurrentPosition(async pos=>{
      const {latitude:lat, longitude:lon} = pos.coords;
      try {
        const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const j=await r.json();
        currentRoad = j.address?.road || j.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      } catch {
        currentRoad = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      }
      locRoad.textContent=currentRoad || "Unknown";
      setSpinner(false);
    }, ()=>{ setSpinner(false); toast("GPS failed"); });
  });

  const TYPE_PREFIX={"Inspection":"I","Spot Spray":"SS","Road Spray":"RS"};
  $("#autoNameBtn")?.addEventListener("click", ()=>{
    const t=$("#taskType").value || "Inspection";
    const prefix=TYPE_PREFIX[t] || "I";
    const dEl=$("#jobDate");
    const dt=dEl && dEl.value ? new Date(dEl.value) : new Date();
    const dateCompact=formatDateAUCompact(dt);
    const base=(currentRoad || "Unknown").replace(/\s+/g,"");
    $("#jobName").value = `${prefix}${dateCompact}_${base}`;
  });

  // Ensure job date has default
  const jobDateEl=$("#jobDate");
  if (jobDateEl && !jobDateEl.value) jobDateEl.value = todayISO();

  // Weather autofill
  $("#autoWeatherBtn")?.addEventListener("click", ()=>{
    if (!navigator.geolocation){ return toast("Enable location services"); }
    setSpinner(true,"Fetching weather…");
    navigator.geolocation.getCurrentPosition(async pos=>{
      try {
        const {latitude, longitude} = pos.coords;
        const url=`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;
        const r=await fetch(url); const j=await r.json(); const c=j.current||{};
        const deg = c.wind_direction_10m ?? "";
        const compass = degToCompass(deg);
        $("#temp").value     = c.temperature_2m ?? "";
        $("#wind").value     = c.wind_speed_10m ?? "";
        $("#windDir").value  = compass ? `${compass} (${deg}°)` : (deg!==""? `${deg}°` : "");
        $("#humidity").value = c.relative_humidity_2m ?? "";
        $("#wxUpdated").textContent="Updated @ "+nowTime();
      } catch(e){ console.warn(e); toast("Weather unavailable"); }
      setSpinner(false);
    }, ()=>{ setSpinner(false); toast("Location not available"); });
  });

  // Weeds (header + pinned noxious)
  function populateWeeds(){
    const sel=$("#weedSelect"); if(!sel) return; sel.innerHTML="";
    const header=["⚠ Noxious Weeds"];
    const nox = DB.weeds.filter(w=>/noxious/i.test(w) && !/^⚠\s*Noxious Weeds$/i.test(w)).sort((a,b)=>a.localeCompare(b));
    const rest= DB.weeds.filter(w=>! /noxious/i.test(w)).sort((a,b)=>a.localeCompare(b));
    const all = ["— Select Weed —", ...header, ...nox, ...rest];
    all.forEach(w=>{
      const o=document.createElement("option");
      o.value = (w==="— Select Weed —") ? "" : w;
      let label = w;
      if (/^⚠\s*Noxious Weeds$/i.test(w)) { label = "⚠ Noxious Weeds"; o.style.color="red"; o.style.fontWeight="700"; }
      else if (/noxious/i.test(w)) { label = "⚠ " + w; }
      o.textContent = label;
      sel.appendChild(o);
    });
  }
  populateWeeds();

  // Batch select
  function populateBatchSelect(){
    const sel=$("#batchSelect"); if(!sel) return;
    sel.innerHTML=""; const def=document.createElement("option");
    def.value=""; def.textContent="— Select Batch —"; sel.appendChild(def);
    DB.batches.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).forEach(b=>{
      const o=document.createElement("option");
      const remain = (b.remaining ?? b.mix ?? 0);
      o.value=b.id; o.textContent=`${b.id} • ${formatDateAU(b.date)} • remain ${fmt(remain)} L`;
      sel.appendChild(o);
    });
  }
  populateBatchSelect();

  // Roadside tracking
  let tracking=false, trackTimer=null, trackCoords=[];
  $("#startTrack")?.addEventListener("click", ()=>{
    trackCoords=[]; tracking=true; $("#trackStatus").textContent="Tracking…";
    if (trackTimer) clearInterval(trackTimer);
    if (!navigator.geolocation){ return toast("Enable location"); }
    trackTimer=setInterval(()=> navigator.geolocation.getCurrentPosition(p=> trackCoords.push([p.coords.latitude,p.coords.longitude])), 5000);
  });
  $("#stopTrack")?.addEventListener("click", ()=>{
    tracking=false; if (trackTimer) clearInterval(trackTimer);
    $("#trackStatus").textContent=`Stopped (${trackCoords.length} pts)`;
    localStorage.setItem("lastTrack", JSON.stringify(trackCoords));
  });

  // Photo
  let photoDataURL="";
  $("#photoInput")?.addEventListener("change",(e)=>{
    const f=e.target.files?.[0]; if(!f) return;
    const reader=new FileReader();
    reader.onload=()=>{ photoDataURL=String(reader.result||""); const img=$("#photoPreview"); img.src=photoDataURL; img.style.display="block"; };
    reader.readAsDataURL(f);
  });

  // Save job
  $("#saveTask")?.addEventListener("click", ()=> saveTask(false));
  $("#saveDraft")?.addEventListener("click", ()=> saveTask(true));

  function saveTask(isDraft){
    setSpinner(true,"Saving task…");
    const id=Date.now();
    const selStatus = document.querySelector("input[name='status']:checked")?.value || "Incomplete";
    const status = isDraft ? "Draft" : selStatus;
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
      temp: $("#temp").value,
      wind: $("#wind").value,
      windDir: $("#windDir").value,
      humidity: $("#humidity").value,
      reminder: $("#reminderWeeks").value || "",
      status,
      notes: $("#notes").value || "",
      coords: trackCoords.slice(),
      photo: photoDataURL || "",
      createdAt:new Date().toISOString(),
      archived:false
    };

    const existing = DB.tasks.find(t=> t.name===obj.name);
    if (existing) Object.assign(existing, obj);
    else DB.tasks.push(obj);

    // auto-link + archive inspection if provided
    if (obj.linkedInspectionId){
      const insp = DB.tasks.find(t=> t.type==="Inspection" && (String(t.id)===obj.linkedInspectionId || t.name===obj.linkedInspectionId));
      if (insp){ insp.archived=true; insp.status="Archived"; obj.linkedInspectionResolved=true; }
    }

    // batch consumption (simple heuristic)
    if (obj.batch){
      const b=DB.batches.find(x=>x.id===obj.batch);
      if (b){
        const used = (obj.type==="Road Spray" && obj.coords?.length>1) ? 100 : 0;
        b.used = (b.used||0) + used;
        b.remaining = Math.max(0, (Number(b.mix)||0) - (b.used||0));
      }
    }

    saveNow(); populateBatchSelect(); renderRecords(); renderMap();
    setSpinner(false,"Saved");
    toast("Task saved ✅");
  }

  // -------------------------------------------------
  // BATCHES
  // -------------------------------------------------
  $("#newBatch")?.addEventListener("click", ()=>{
    const id = "B"+Date.now();
    const mix = Number(prompt("Total mix (L):","600"))||0;
    const chems = prompt("Chemicals (e.g. 'Crucial 1.5L/100L, Wetter 300mL/100L')","")||"";
    const obj={ id, date: todayISO(), time: nowTime(), mix, remaining: mix, used:0, chemicals: chems };
    DB.batches.push(obj);
    saveNow(); populateBatchSelect(); renderBatches();
    toast("Batch created ✅");
  });

  function renderBatches(){
    const list=$("#batchList"); if(!list) return; list.innerHTML="";
    const from=$("#batFrom")?.value||""; const to=$("#batTo")?.value||"";
    DB.batches
      .filter(b=>(!from||b.date>=from)&&(!to||b.date<=to))
      .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
      .forEach(b=>{
        const el=document.createElement("div"); el.className="item";
        el.innerHTML=`<b>${b.id}</b><br><small>${formatDateAU(b.date)} ${b.time?("• "+b.time):""} • Total ${fmt(b.mix)} L • Remaining ${fmt(b.remaining)} L</small>
          <div class="row end"><button class="pill" data-batch-open="${b.id}">Open</button></div>`;
        list.appendChild(el);
      });
  }

  // Delegated clicks for batches (so they keep working after re-render)
  $("#batches")?.addEventListener("click",(e)=>{
    const btn = e.target.closest("[data-batch-open]");
    if (!btn) return;
    const id = btn.getAttribute("data-batch-open");
    const b = DB.batches.find(x=> x.id===id);
    if (b) showBatchPopup(b);
  });

  function showBatchPopup(b){
    const jobs=DB.tasks.filter(t=>t.batch===b.id);
    const jobsHtml= jobs.length ? `<ul>${jobs.map(t=>`<li><a href="#" data-open-job="${t.id}">${t.name}</a></li>`).join("")}</ul>` : "—";
    const html=`
      <div class="modal">
        <div class="card p">
          <h3 style="margin-top:0">${b.id}</h3>
          <div><b>Date:</b> ${formatDateAU(b.date)} · <b>Time:</b> ${b.time||"–"}</div>
          <div><b>Total Mix:</b> ${fmt(b.mix)} L</div>
          <div><b>Remaining:</b> ${fmt(b.remaining)} L</div>
          <div style="margin-top:.4rem;"><b>Chemicals (made of):</b><br>${b.chemicals||"—"}</div>
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
      saveNow(); modal.remove(); renderBatches(); toast("Batch updated ✅");
    });
  }

  // -------------------------------------------------
  // RECORDS (delegated open + navigate)
  // -------------------------------------------------
  function recordMatches(t,q,from,to){
    if (t.archived) return false;
    if (from && (t.date||"")<from) return false;
    if (to && (t.date||"")>to) return false;
    if (q){
      const hay=`${t.name} ${t.weed} ${t.council}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }
  function renderRecords(){
    const list=$("#recordsList"); if(!list) return; list.innerHTML="";
    const q=$("#recSearch")?.value?.trim() || "";
    const from=$("#recFrom")?.value||""; const to=$("#recTo")?.value||"";
    DB.tasks
      .filter(t=>recordMatches(t,q,from,to))
      .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
      .forEach(t=>{
        const d=document.createElement("div"); d.className="item";
        const dateAU=formatDateAU(t.date);
        d.innerHTML=`<b>${t.name}</b><br><small>${t.type} • ${dateAU} • ${t.status}</small>
          <div class="row end">
            <button class="pill" data-record-open="${t.id}">Open</button>
            ${t.coords && t.coords.length ? `<button class="pill" data-record-nav="${t.id}">Navigate</button>` : ""}
          </div>`;
        list.appendChild(d);
      });
  }
  // Delegation for records actions
  $("#records")?.addEventListener("click",(e)=>{
    const openBtn = e.target.closest("[data-record-open]");
    const navBtn  = e.target.closest("[data-record-nav]");
    if (openBtn){
      const id = openBtn.getAttribute("data-record-open");
      const t = DB.tasks.find(x=> String(x.id)===id);
      if (t) showJobPopup(t);
    } else if (navBtn){
      const id = navBtn.getAttribute("data-record-nav");
      const t = DB.tasks.find(x=> String(x.id)===id);
      const pt=t?.coords?.[0];
      if (!pt) return toast("No coords saved");
      openAppleMaps(pt[0], pt[1]);
    }
  });

  $("#recSearchBtn")?.addEventListener("click", renderRecords);
  $("#recResetBtn")?.addEventListener("click", ()=>{
    $("#recSearch").value=""; $("#recFrom").value=""; $("#recTo").value="";
    renderRecords();
  });
  renderRecords();

  // -------------------------------------------------
  // INVENTORY (editor)
  // -------------------------------------------------
  $("#addChem")?.addEventListener("click", ()=>{
    const name=prompt("Chemical name:"); if(!name) return;
    const active=prompt("Active ingredient:","")||"";
    const size=Number(prompt("Container size (number):","20"))||0;
    const unit=prompt("Unit (L, mL, g, kg):","L")||"L";
    const count=Number(prompt("How many containers:","0"))||0;
    const thr=Number(prompt("Reorder threshold (containers):","0"))||0;
    DB.chems.push({name,active,containerSize:size,containerUnit:unit,containers:count,threshold:thr});
    saveNow(); renderChems();
  });

  function renderChems(){
    const list=$("#chemList"); if(!list) return; list.innerHTML="";
    DB.chems.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach(c=>{
      const total=(c.containers||0)*(c.containerSize||0);
      const line=`${c.containers} × ${fmt(c.containerSize)} ${c.containerUnit} • total ${fmt(total)} ${c.containerUnit}`;
      const card=document.createElement("div"); card.className="item";
      card.innerHTML=`<b>${c.name}</b><br><small>${line}</small><br><small>Active: ${c.active||"—"}</small>
        <div class="row gap end" style="margin-top:.4rem;">
          <button class="pill" data-chem-edit="${c.name}">Edit</button>
          <button class="pill warn" data-chem-del="${c.name}">Delete</button>
        </div>`;
      list.appendChild(card);
    });
  }
  // Inventory delegated clicks
  $("#inventory")?.addEventListener("click",(e)=>{
    const editBtn = e.target.closest("[data-chem-edit]");
    const delBtn  = e.target.closest("[data-chem-del]");
    if (editBtn){
      const name = editBtn.getAttribute("data-chem-edit");
      const c = DB.chems.find(x=>x.name===name);
      if (!c) return;
      // open bottom sheet editor
      $("#ce_name").value=c.name||"";
      $("#ce_active").value=c.active||"";
      $("#ce_size").value=c.containerSize||0;
      $("#ce_unit").value=c.containerUnit||"L";
      $("#ce_count").value=c.containers||0;
      $("#ce_threshold").value=c.threshold||0;
      $("#chemEditSheet").style.display="block";
      $("#ce_save").onclick=()=>{
        c.name=$("#ce_name").value.trim();
        c.active=$("#ce_active").value.trim();
        c.containerSize=Number($("#ce_size").value)||0;
        c.containerUnit=$("#ce_unit").value||"L";
        c.containers=Number($("#ce_count").value)||0;
        c.threshold=Number($("#ce_threshold").value)||0;
        saveNow(); renderChems(); $("#chemEditSheet").style.display="none"; toast("Chemical updated ✅");
      };
      $("#ce_cancel").onclick=()=> $("#chemEditSheet").style.display="none";
    } else if (delBtn){
      const name = delBtn.getAttribute("data-chem-del");
      if (!confirm("Delete chemical?")) return;
      DB.chems = DB.chems.filter(x=>x.name!==name);
      saveNow(); renderChems();
    }
  });
  renderChems();

  // -------------------------------------------------
  // MAPPING (Leaflet + Locate Me + clickable pins)
  // -------------------------------------------------
  let map, locateCtrl;
  function ensureMap(){
    if (map) return map;
    map = L.map("map").setView([-34.75,148.65],10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);

    // Locate Me control
    locateCtrl = L.control({position:"bottomright"});
    locateCtrl.onAdd=function(){
      const d=L.DomUtil.create("div","leaflet-bar");
      d.style.background="#0c7d2b";d.style.color="#fff";d.style.borderRadius="6px";d.style.padding="6px 10px";d.style.cursor="pointer";
      d.innerText="Locate Me";
      d.onclick=()=>{
        if (!navigator.geolocation) return toast("Enable location");
        navigator.geolocation.getCurrentPosition(p=>{
          const pt=[p.coords.latitude,p.coords.longitude];
          map.setView(pt,14);
          L.circleMarker(pt,{radius:7,opacity:.9}).addTo(map).bindPopup("You are here").openPopup();
        });
      };
      return d;
    };
    locateCtrl.addTo(map);
    return map;
  }

  $("#mapSearchBtn")?.addEventListener("click", ()=> renderMap(true));
  $("#mapResetBtn")?.addEventListener("click", ()=>{
    $("#mapFrom").value=""; $("#mapTo").value=""; $("#mapWeed").value=""; $("#mapType").value="All";
    renderMap(true);
  });

  function renderMap(fit=false){
    const m=ensureMap();
    // clear overlays
    m.eachLayer(l=>{ if(!(l instanceof L.TileLayer)) m.removeLayer(l); });

    const from=$("#mapFrom")?.value||"";
    const to=$("#mapTo")?.value||"";
    const typ=$("#mapType")?.value||"All";
    const weedQ=($("#mapWeed")?.value||"").trim().toLowerCase();

    const tasks=DB.tasks
      .filter(t=>!t.archived)
      .filter(t=>(!from||t.date>=from)&&(!to||t.date<=to))
      .filter(t=> typ==="All" ? true : t.type===typ)
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
      const marker=L.marker(pt); marker.bindPopup(popup);
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
    if (fit && tasks.length) { try{ m.fitBounds(group.getBounds().pad(0.2)); }catch{} }

    // Draw last tracked polyline (quick visual)
    try{
      const last = JSON.parse(localStorage.getItem("lastTrack")||"[]");
      if (Array.isArray(last) && last.length>1) L.polyline(last,{color:"#ffda44",weight:3,opacity:.8}).addTo(m);
    }catch{}
  }
  // initial
  renderMap(true);

  // -------------------------------------------------
  // JOB POPUP (with Navigate + Edit)
  // -------------------------------------------------
  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape"){ const m=$(".modal"); if(m) m.remove(); } });

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
      $("#notes").value=t.notes||""; if (t.photo){ $("#photoPreview").src=t.photo; $("#photoPreview").style.display="block"; }
      modal.remove();
    });
    $("[data-nav]",modal)?.addEventListener("click", ()=>{
      const pt=t.coords?.[0]; if(!pt){ toast("No coords saved"); return; }
      openAppleMaps(pt[0], pt[1]);
    });
  }

});
