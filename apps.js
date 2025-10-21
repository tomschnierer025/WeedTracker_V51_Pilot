/* WeedTracker V61 Final Pilot — apps.js
   - Core app logic (records, tasks, weather, map, popups)
   - AU dates, Apple Maps nav, noxious weeds + Cape Broom
   - Big spinner overlay for Save/Create
*/
(function(){
  const $  = (s, r=document)=> r.querySelector(s);
  const $$ = (s, r=document)=> [...r.querySelectorAll(s)];

  let DB = DBStore.ensureDB();

  // ---------- Nav ----------
  function switchScreen(id){
    $$(".screen").forEach(s=>s.classList.remove("active"));
    $("#"+id)?.classList.add("active");
    if (id==="records") renderRecords();
    if (id==="batches") renderBatchesMini();
    if (id==="inventory") renderChems();
    if (id==="mapping") renderMap(true);
  }
  $$("[data-target]").forEach(btn=> btn.addEventListener("click", ()=> switchScreen(btn.dataset.target)));
  $$(".home-btn").forEach(b=> b.addEventListener("click", ()=> switchScreen("home")));

  // ---------- Weather ----------
  function setNESW(deg){
    if (deg==null || deg==="") return "";
    const dirs = ["N","NE","E","SE","S","SW","W","NW"];
    const ix = Math.round(((Number(deg)%360)/45))%8;
    return dirs[ix];
  }
  $("#autoWeatherBtn")?.addEventListener("click", ()=>{
    if (!navigator.geolocation){ _WTToast("Enable location services"); return; }
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{
        const {latitude, longitude} = pos.coords;
        const url=`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;
        const r=await fetch(url); const j=await r.json(); const c=j.current||{};
        $("#temp").value     = c.temperature_2m ?? "";
        $("#wind").value     = c.wind_speed_10m ?? "";
        $("#windDir").value  = (c.wind_direction_10m ?? "") + (c.wind_direction_10m!=null?`° ${setNESW(c.wind_direction_10m)}`:"");
        $("#humidity").value = c.relative_humidity_2m ?? "";
        $("#wxUpdated").textContent = "Updated @ " + new Date().toTimeString().slice(0,5);
      }catch{ _WTToast("Weather unavailable"); }
    }, ()=> _WTToast("Location not available"));
  });

  // ---------- Locate + Auto name ----------
  let currentRoad = "";
  $("#locateBtn")?.addEventListener("click", ()=>{
    _WTOverlay.show("Locating…");
    if (!navigator.geolocation){ _WTOverlay.hide(); _WTToast("Enable location"); return; }
    navigator.geolocation.getCurrentPosition(async pos=>{
      const {latitude:lat, longitude:lon} = pos.coords;
      try{
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const j = await r.json();
        currentRoad = j.address?.road || j.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      }catch{ currentRoad = `${lat.toFixed(5)}, ${lon.toFixed(5)}`; }
      $("#locRoad").textContent = currentRoad || "Unknown";
      _WTOverlay.hide();
    }, ()=>{ _WTOverlay.hide(); _WTToast("GPS failed"); });
  });

  const TYPE_PREFIX = { "Inspection":"I", "Spot Spray":"SS", "Road Spray":"RS" };
  $("#autoNameBtn")?.addEventListener("click", ()=>{
    const t = $("#taskType").value || "Inspection";
    const prefix = TYPE_PREFIX[t] || "I";
    const dInput = $("#jobDate");
    const dt = dInput && dInput.value ? new Date(dInput.value) : new Date();
    const dd = String(dt.getDate()).padStart(2,"0");
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const yyyy = dt.getFullYear();
    const dateCompact = `${dd}${mm}${yyyy}`; // AU
    const base = (currentRoad || "Unknown").replace(/\s+/g,"");
    $("#jobName").value = `${prefix}${dateCompact}_${base}`;
  });
  if ($("#jobDate") && !$("#jobDate").value) $("#jobDate").value = DBStore.auDateISO();

  // ---------- Weeds (pin noxious + Cape Broom) ----------
  function populateWeeds(){
    const sel=$("#weedSelect"); if (!sel) return;
    sel.innerHTML="";
    const list = DB.weeds.slice();
    const noxCat = list.filter(w=>/Noxious Weeds \(category\)/i.test(w));
    const noxInd = list.filter(w=>/noxious\)/i.test(w) && !/category/i.test(w)).sort();
    const others = list.filter(w=>!(/noxious\)/i.test(w)) && !/category/i.test(w)).sort();
    const top = ["— Select Weed —",
      ...noxCat.map(w=>"🔺 "+w),       // red (semantic, via text badge)
      ...noxInd.map(w=>"🔶 "+w),       // yellow triangle
      ...others
    ];
    top.forEach(w=>{
      const o=document.createElement("option");
      o.value = (w==="— Select Weed —")? "" : w.replace(/^🔺 |^🔶 /,"");
      o.textContent = w;
      sel.appendChild(o);
    });
  }
  populateWeeds();

  // ---------- Photo ----------
  let photoDataURL="";
  $("#photoInput")?.addEventListener("change", (e)=>{
    const f=e.target.files?.[0]; if(!f) return;
    const reader=new FileReader();
    reader.onload=()=>{ photoDataURL=String(reader.result||""); const img=$("#photoPreview"); img.src=photoDataURL; img.style.display="block"; };
    reader.readAsDataURL(f);
  });

  // ---------- Road tracking ----------
  let tracking=false, trackTimer=null, trackCoords=[];
  $("#startTrack")?.addEventListener("click", ()=>{
    trackCoords=[]; tracking=true; $("#trackStatus").textContent="Tracking…";
    if (trackTimer) clearInterval(trackTimer);
    if (!navigator.geolocation){ _WTToast("Enable location"); return; }
    trackTimer = setInterval(()=> navigator.geolocation.getCurrentPosition(p=> trackCoords.push([p.coords.latitude,p.coords.longitude])), 5000);
  });
  $("#stopTrack")?.addEventListener("click", ()=>{
    tracking=false; if (trackTimer) clearInterval(trackTimer);
    $("#trackStatus").textContent=`Stopped (${trackCoords.length} pts)`;
    localStorage.setItem("lastTrack", JSON.stringify(trackCoords));
  });

  // ---------- Save Task ----------
  $("#saveTask")?.addEventListener("click", ()=> saveTask(false));
  $("#saveDraft")?.addEventListener("click", ()=> saveTask(true));

  function saveTask(isDraft){
    _WTOverlay.show("💾 Saving Job…");
    const id=Date.now();
    const status=isDraft?"Draft":($("input[name='status']:checked")?.value||"Incomplete");
    const obj={
      id,
      name: $("#jobName").value.trim() || ("Task_"+id),
      council: $("#councilNum").value.trim(),
      linkedJobId: $("#linkJobId").value.trim(),
      linkedInspectionId: $("#linkInspectionId").value.trim(),
      type: $("#taskType").value,
      weed: $("#weedSelect").value,
      batch: $("#batchSelect").value,
      date: $("#jobDate").value || DBStore.auDateISO(),
      start: $("#startTime").value || "",
      end:   $("#endTime").value   || "",
      temp: $("#temp").value, wind: $("#wind").value, windDir: $("#windDir").value, humidity: $("#humidity").value,
      reminder: $("#reminderWeeks").value || "",
      status, notes: $("#notes").value || "",
      coords: trackCoords.slice(),
      photo: photoDataURL || "",
      createdAt:new Date().toISOString(), archived:false
    };

    const existing = DB.tasks.find(t=> t.name===obj.name);
    if (existing) Object.assign(existing, obj); else DB.tasks.push(obj);

    // Link inspection (archive)
    if (obj.linkedInspectionId){
      const insp = DB.tasks.find(t=> t.type==="Inspection" && (String(t.id)===obj.linkedInspectionId || t.name===obj.linkedInspectionId));
      if (insp){ insp.archived=true; insp.status="Archived"; obj.linkedInspectionResolved=true; }
    }

    // Batch consume heuristic for road
    if (obj.batch){
      const b=DB.batches.find(x=>x.id===obj.batch);
      if (b){
        const used = (obj.type==="Road Spray" && obj.coords?.length>1) ? 100 : 0;
        b.used = (b.used||0)+used;
        b.remaining = Math.max(0, (Number(b.mix)||0) - (b.used||0));
        b.lastEdited = new Date().toISOString();
      }
    }

    DBStore.saveDB(DB);
    populateBatchSelect();
    renderRecords();
    setTimeout(()=>{
      _WTOverlay.show("✅ Job Saved");
      setTimeout(()=> _WTOverlay.hide(), 1200);
    }, 200);
  }

  // ---------- Records ----------
  $("#recSearchBtn")?.addEventListener("click", renderRecords);
  $("#recResetBtn")?.addEventListener("click", ()=>{
    $("#recSearch").value=""; $("#recFrom").value=""; $("#recTo").value="";
    ["fInspection","fSpot","fRoad","fComplete","fIncomplete","fDraft"].forEach(id=>{$("#"+id).checked=false;});
    renderRecords();
  });

  function recordMatches(t,q,from,to,types,statuses){
    if (t.archived) return false;
    if (from && (t.date||"")<from) return false;
    if (to && (t.date||"")>to) return false;
    if (q){
      const hay=`${t.name} ${t.weed} ${t.council} ${t.batch} ${t.notes}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    const typeOK=( (!types.inspection && !types.spot && !types.road)
                   || (t.type==="Inspection"&&types.inspection)
                   || (t.type==="Spot Spray"&&types.spot)
                   || (t.type==="Road Spray"&&types.road) );
    if (!typeOK) return false;

    const s=t.status||"Incomplete";
    const statusesEmpty = !statuses.complete && !statuses.incomplete && !statuses.draft;
    const statusOK = statusesEmpty || (s==="Complete"&&statuses.complete) || (s==="Incomplete"&&statuses.incomplete) || (s==="Draft"&&statuses.draft);
    return statusOK;
  }

  function renderRecords(){
    const list=$("#recordsList"); if(!list) return; list.innerHTML="";
    const q=$("#recSearch").value.trim();
    const from=$("#recFrom").value; const to=$("#recTo").value;
    const types={inspection:$("#fInspection").checked, spot:$("#fSpot").checked, road:$("#fRoad").checked};
    const statuses={complete:$("#fComplete").checked, incomplete:$("#fIncomplete").checked, draft:$("#fDraft").checked};

    DB.tasks.filter(t=>recordMatches(t,q,from,to,types,statuses))
      .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
      .forEach(t=>{
        const d=document.createElement("div"); d.className="item";
        const dateAU = DBStore.fmtAU(t.date);
        d.innerHTML=`<b>${t.name}</b><br><small>${t.type} • ${dateAU} • ${t.status}</small>
          <div class="row end">
            <button class="pill" data-open="${t.id}">Open</button>
            <button class="pill" data-edit="${t.id}">Edit</button>
            ${t.coords && t.coords.length ? `<button class="pill" data-nav="${t.id}">Navigate</button>` : ""}
          </div>`;
        d.querySelector("[data-open]")?.addEventListener("click", ()=> showJobPopup(t));
        d.querySelector("[data-edit]")?.addEventListener("click", ()=>{
          switchScreen("createTask");
          $("#jobName").value=t.name; $("#councilNum").value=t.council||""; $("#linkJobId").value=t.linkedJobId||""; $("#linkInspectionId").value=t.linkedInspectionId||"";
          $("#taskType").value=t.type; $("#taskType").dispatchEvent(new Event("change"));
          $("#weedSelect").value=t.weed||""; $("#batchSelect").value=t.batch||"";
          $("#jobDate").value=t.date||DBStore.auDateISO(); $("#startTime").value=t.start||""; $("#endTime").value=t.end||"";
          $("#temp").value=t.temp||""; $("#wind").value=t.wind||""; $("#windDir").value=t.windDir||""; $("#humidity").value=t.humidity||"";
          $("#notes").value=t.notes||"";
          if (t.photo){ $("#photoPreview").src=t.photo; $("#photoPreview").style.display="block"; }
        });
        const navBtn = d.querySelector("[data-nav]");
        if (navBtn){
          navBtn.addEventListener("click", ()=>{
            const pt = t.coords?.[0];
            if (!pt){ _WTToast("No coords saved"); return; }
            openAppleMaps(pt[0], pt[1]);
          });
        }
        list.appendChild(d);
      });
  }
  renderRecords();

  // Expose popup for batches.js
  window.showJobPopup = function(t){
    const batchLink = t.batch ? `<a href="#" data-open-batch="${t.batch}">${t.batch}</a>` : "—";
    const linkedInsp = t.linkedInspectionId ? `<a href="#" data-open-insp="${t.linkedInspectionId}">${t.linkedInspectionId}</a>` : "—";
    const photoHtml = t.photo ? `<div style="margin:.4rem 0"><img src="${t.photo}" alt="photo" style="max-width:100%;border-radius:8px"/></div>` : "";
    const hasPt = t.coords && t.coords.length;
    const m=document.createElement("div");
    m.className="modal";
    m.innerHTML=`
      <div class="card p" style="position:fixed;left:12px;right:12px;top:12%;z-index:1300">
        <div class="row" style="justify-content:space-between;align-items:center">
          <h3 style="margin:0">${t.name}</h3>
          <button class="pill warn" data-close-modal>❌ Close</button>
        </div>
        <div class="grid two tight" style="margin-top:.4rem">
          <div><b>Type:</b> ${t.type}</div><div><b>Status:</b> ${t.status}</div>
          <div><b>Date:</b> ${DBStore.fmtAU(t.date)}</div>
          <div><b>Start:</b> ${t.start || "–"} · <b>Finish:</b> ${t.end || "–"}</div>
          <div><b>Weed:</b> ${t.weed || "—"}</div><div><b>Batch:</b> ${batchLink}</div>
          <div><b>Linked Inspection:</b> ${linkedInsp}</div><div><b>Reminder:</b> ${t.reminder || "—"} wk</div>
          <div class="span2"><b>Weather:</b> ${t.temp||"–"}°C, ${t.wind||"–"} km/h, ${t.windDir||"–"}, ${t.humidity||"–"}%</div>
          <div class="span2"><b>Notes:</b> ${t.notes || "—"}</div>
        </div>
        ${photoHtml}
        <div class="row gap end" style="margin-top:.8rem;">
          ${hasPt? `<button class="pill" data-nav>Navigate</button>`:""}
          <button class="pill" data-edit>Edit</button>
        </div>
      </div>`;
    document.body.appendChild(m);
    m.addEventListener("click",(e)=>{
      if (e.target.dataset.closeModal!=null) m.remove();
      if (e.target?.dataset?.nav!=null){
        const pt = t.coords?.[0]; if(!pt){ _WTToast("No coords saved"); return; }
        openAppleMaps(pt[0], pt[1]);
      }
      if (e.target?.dataset?.edit!=null){
        m.remove();
        switchScreen("createTask");
        $("#jobName").value=t.name; $("#councilNum").value=t.council||""; $("#linkJobId").value=t.linkedJobId||""; $("#linkInspectionId").value=t.linkedInspectionId||"";
        $("#taskType").value=t.type; $("#taskType").dispatchEvent(new Event("change"));
        $("#weedSelect").value=t.weed||""; $("#batchSelect").value=t.batch||"";
        $("#jobDate").value=t.date||DBStore.auDateISO(); $("#startTime").value=t.start||""; $("#endTime").value=t.end||"";
        $("#temp").value=t.temp||""; $("#wind").value=t.wind||""; $("#windDir").value=t.windDir||""; $("#humidity").value=t.humidity||"";
        $("#notes").value=t.notes||"";
        if (t.photo){ $("#photoPreview").src=t.photo; $("#photoPreview").style.display="block"; }
      }
      const b = e.target.closest("[data-open-batch]");
      if (b){
        const bb = DB.batches.find(x=>x.id===t.batch);
        if (bb && window.openBatch) window.openBatch(bb);
      }
      const i = e.target.closest("[data-open-insp]");
      if (i){
        const insp=DB.tasks.find(x=>x.type==="Inspection"&&(String(x.id)===t.linkedInspectionId||x.name===t.linkedInspectionId));
        if (insp){ m.remove(); window.showJobPopup(insp); }
      }
    });
  }

  // ---------- Batches mini (selector) ----------
  function populateBatchSelect(){
    const sel=$("#batchSelect"); if (!sel) return;
    sel.innerHTML=""; const def=document.createElement("option");
    def.value=""; def.textContent="— Select Batch —"; sel.appendChild(def);
    DB.batches.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).forEach(b=>{
      const o=document.createElement("option");
      const remain = (b.remaining ?? b.mix ?? 0);
      o.value=b.id; o.textContent=`${b.id} • ${DBStore.fmtAU(b.date)} • remain ${remain} L`;
      sel.appendChild(o);
    });
  }
  populateBatchSelect();

  // ---------- Inventory ----------
  $("#sdsLink")?.addEventListener("click", ()=>{}); // pinned SDS link in HTML
  $("#addChem")?.addEventListener("click", ()=>{
    const name = prompt("Chemical name:"); if(!name) return;
    const active= prompt("Active ingredient:","")||"";
    const size  = Number(prompt("Container size (number):","20"))||0;
    const unit  = prompt("Unit (L, mL, g, kg):","L")||"L";
    const count = Number(prompt("How many containers:","0"))||0;
    const thr   = Number(prompt("Reorder threshold (containers):","0"))||0;
    DB.chems.push({name,active,containerSize:size,containerUnit:unit,containers:count,threshold:thr});
    DBStore.saveDB(DB); renderChems();
  });

  function renderChems(){
    const list=$("#chemList"); if(!list) return; list.innerHTML="";
    DB.chems.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach(c=>{
      const total = (c.containers||0) * (c.containerSize||0);
      const line = `${c.containers} × ${total ? c.containerSize : 0} ${c.containerUnit} • total ${total} ${c.containerUnit}`;
      const card=document.createElement("div"); card.className="item";
      card.innerHTML=`<b>${c.name}</b><br><small>${line}</small><br><small>Active: ${c.active || "—"}</small>
        <div class="row gap end" style="margin-top:.4rem;">
          <button class="pill" data-edit>Edit</button>
          <button class="pill warn" data-del>Delete</button>
        </div>`;
      card.querySelector("[data-edit]")?.addEventListener("click", ()=> openChemEditor(c));
      card.querySelector("[data-del]")?.addEventListener("click", ()=>{ if(!confirm("Delete chemical?")) return; DB.chems = DB.chems.filter(x=>x!==c); DBStore.saveDB(DB); renderChems(); });
      list.appendChild(card);
    });
  }
  renderChems();

  function openChemEditor(c){
    $("#ce_name").value = c.name || "";
    $("#ce_active").value = c.active || "";
    $("#ce_size").value = c.containerSize || 0;
    $("#ce_unit").value = c.containerUnit || "L";
    $("#ce_count").value = c.containers || 0;
    $("#ce_threshold").value = c.threshold || 0;
    $("#chemEditSheet").hidden = false;
    $("#ce_save").onclick = ()=>{
      c.name = $("#ce_name").value.trim();
      c.active = $("#ce_active").value.trim();
      c.containerSize = Number($("#ce_size").value)||0;
      c.containerUnit = $("#ce_unit").value||"L";
      c.containers = Number($("#ce_count").value)||0;
      c.threshold  = Number($("#ce_threshold").value)||0;
      DBStore.saveDB(DB); renderChems(); $("#chemEditSheet").hidden = true; _WTToast("Saved");
    };
    $("#ce_cancel").onclick = ()=> $("#chemEditSheet").hidden = true;
  }

  // ---------- Map ----------
  let map, locateCtrl;
  function ensureMap(){
    if (map) return map;
    map = L.map("map").setView([-34.75,148.65], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19, detectRetina:true}).addTo(map);

    locateCtrl = L.control({position:"bottomright"});
    locateCtrl.onAdd = function(){
      const d=L.DomUtil.create("div","leaflet-bar");
      d.style.background="#0c7d2b"; d.style.color="#fff"; d.style.borderRadius="6px"; d.style.padding="6px 10px"; d.style.cursor="pointer";
      d.innerText="Locate Me";
      d.onclick=()=>{
        if (!navigator.geolocation){ _WTToast("Enable location"); return; }
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
    const a=document.createElement("a"); a.href = mapsURL; document.body.appendChild(a); a.click();
    setTimeout(()=>{ window.open(webURL, "_blank"); a.remove(); }, 300);
  }
  window.openAppleMaps = openAppleMaps;

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
      .filter(t=> weedQ ? (`${t.weed} ${t.name}`.toLowerCase().includes(weedQ)) : true);

    const group = L.featureGroup();

    tasks.forEach(t=>{
      if (t.coords?.length>1) group.addLayer(L.polyline(t.coords,{color:"yellow",weight:4,opacity:.9}));
      const pt = t.coords?.[0] || [-34.75 + Math.random()*0.08, 148.65 + Math.random()*0.08];
      const openId = `open_${t.id}`;
      const navId  = `nav_${t.id}`;
      const popup = `<b>${t.name}</b><br>${t.type} • ${DBStore.fmtAU(t.date)}
                     <br><button id="${openId}" class="pill" style="margin-top:.35rem">Open</button>
                     <button id="${navId}" class="pill" style="margin-top:.35rem;margin-left:.4rem">Navigate</button>`;
      const marker = L.marker(pt); marker.bindPopup(popup);
      marker.on("popupopen", ()=>{
        setTimeout(()=>{
          document.getElementById(openId)?.addEventListener("click", ()=> showJobPopup(t));
          document.getElementById(navId)?.addEventListener("click", ()=> openAppleMaps(pt[0], pt[1]));
        },0);
      });
      group.addLayer(marker);
    });

    group.addTo(m);
    if (fit && tasks.length){
      try { m.fitBounds(group.getBounds().pad(0.2)); } catch {}
    }
    try{
      const last = JSON.parse(localStorage.getItem("lastTrack")||"[]");
      if (Array.isArray(last) && last.length>1) L.polyline(last,{color:"#ffda44",weight:3,opacity:.8}).addTo(m);
    }catch{}
  }

  // ---------- Mini batch list refresh from batches.js saves ----------
  function renderBatchesMini(){
    // just repopulate select; main list handled in batches.js
    DB = DBStore.ensureDB();
    populateBatchSelect();
  }

})();
