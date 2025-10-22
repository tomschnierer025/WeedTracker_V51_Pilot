/* ===== WeedTrackerV60Pilot — apps.js (FULL) ===== */
document.addEventListener("DOMContentLoaded", () => {

  // ---------- Utilities ----------
  const $  = (s, r=document)=> r.querySelector(s);
  const $$ = (s, r=document)=> [...r.querySelectorAll(s)];
  const todayISO = ()=> new Date().toISOString().split("T")[0];
  const nowTime  = ()=> new Date().toTimeString().slice(0,5);
  const TYPE_SUFFIX = { "Inspection":"I", "Spot Spray":"S", "Road Spray":"R" };

  // Splash
  setTimeout(()=> { const sp=$("#splash"); sp?.classList.add("hide"); setTimeout(()=> sp?.remove(), 350); }, 500);

  // Nav
  const screens = $$(".screen");
  function switchScreen(id){
    screens.forEach(s=> s.classList.remove("active"));
    const tgt = $("#"+id); tgt?.classList.add("active");
    if (id==="records")  renderRecords();
    if (id==="batches")  { initBatchFormOnce(); renderBatches(); }
    if (id==="inventory") renderChems();
    if (id==="procurement") renderProcurement();
    if (id==="mapping")  renderMap(true);
  }
  $$("[data-target]").forEach(b=> b.addEventListener("click", ()=> switchScreen(b.dataset.target)));
  $("#globalHomeBtn").addEventListener("click", ()=> switchScreen("home"));

  // Tabs mimic
  $$(".tab").forEach(t=> t.addEventListener("click", ()=> switchScreen(t.dataset.target||t.textContent.trim().toLowerCase())));

  // Account
  const accountInput=$("#accountEmail"); if (accountInput) accountInput.value = DB.accountEmail || "";
  $("#saveAccount")?.addEventListener("click", ()=>{ DB.accountEmail = accountInput.value.trim(); DB_save(); toast("Account saved"); });

  // Restore/Export/Clear
  $("#exportBtn")?.addEventListener("click", ()=>{
    const blob=new Blob([JSON.stringify(DB,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a");
    a.href=url; a.download="weedtracker_data.json"; a.click();
  });
  $("#restoreBtn")?.addEventListener("click", ()=>{
    const r=DB_restoreLatest(); if (r){ window.DB=r; DB_save(false); renderChems(); renderRecords(); renderBatches(); renderProcurement(); renderMap(true); toast("Restored"); }
    else toast("No backup found");
  });
  $("#clearBtn")?.addEventListener("click", ()=>{
    if (!confirm("Clear ALL local data?")) return;
    DB_clear(); DB_save(false); renderChems(); renderRecords(); renderBatches(); renderProcurement(); renderMap(true);
    toast("Cleared");
  });

  // ---------- Create Task ----------
  // Reminder weeks 1..52
  const remSel=$("#reminderWeeks"); if (remSel && !remSel.options.length){ for(let i=1;i<=52;i++){ const o=document.createElement("option"); o.value=o.textContent=i; remSel.appendChild(o); } }

  // Task type → show/hide roadside tracking block
  const taskTypeSel=$("#taskType");
  const roadTrackBlock=$("#roadTrackBlock");
  function syncTrackBlock(){ if (taskTypeSel && roadTrackBlock){ roadTrackBlock.style.display = (taskTypeSel.value==="Road Spray")?"block":"none"; } }
  taskTypeSel?.addEventListener("change", syncTrackBlock); syncTrackBlock();

  // Date default
  const jobDateEl=$("#jobDate"); if (jobDateEl && !jobDateEl.value) jobDateEl.value = todayISO();

  // Get Location (keeps road for name)
  window.__currentRoadName = window.__currentRoadName || "";
  $("#locateBtn")?.addEventListener("click", ()=>{
    if (!navigator.geolocation) { toast("Enable location"); return; }
    showSpinner("Getting location…");
    navigator.geolocation.getCurrentPosition(async pos=>{
      const {latitude, longitude} = pos.coords;
      try{
        const res=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
        const j=await res.json();
        const road=j.address?.road || j.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        window.__currentRoadName = road;
        $("#locRoad").textContent = road;
      }catch{
        const road=`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        window.__currentRoadName = road; $("#locRoad").textContent = road;
      }
      showSpinnerDone("Location set ✅");
      $("#councilNum")?.focus();
    }, ()=> showSpinnerDone("Location unavailable", 1200));
  });

  // Auto-Name (RoadName DDMMYY + type letter)
  function ddmmyy(d){
    const dt = (d instanceof Date)? d : new Date(d);
    const dd=String(dt.getDate()).padStart(2,"0");
    const mm=String(dt.getMonth()+1).padStart(2,"0");
    const yy=String(dt.getFullYear()).slice(-2);
    return `${dd}${mm}${yy}`;
  }
  $("#autoNameBtn")?.addEventListener("click", ()=>{
    const t = $("#taskType").value || "Inspection";
    const suffix = TYPE_SUFFIX[t] || "I";
    const dInput = $("#jobDate");
    const dt = dInput && dInput.value ? new Date(dInput.value) : new Date();
    const datePart = ddmmyy(dt);
    const label = (window.__currentRoadName || $("#locRoad")?.textContent || "Unknown Road").replace(/\W+/g, "") || "UnknownRoad";
    $("#jobName").value = `${label} ${datePart}${suffix}`;
  });

  // Auto Weather (with humidity + cardinal + degrees)
  $("#autoWeatherBtn")?.addEventListener("click", ()=>{
    if (!navigator.geolocation) { toast("Enable location"); return; }
    showSpinner("Fetching weather…");
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{
        const {latitude, longitude} = pos.coords;
        const url=`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;
        const r=await fetch(url); const j=await r.json(); const c=j.current||{};
        const deg=Number(c.wind_direction_10m);
        const card=window.cardinalFromDeg(deg);
        $("#temp").value = c.temperature_2m ?? "";
        $("#humidity").value = c.relative_humidity_2m ?? "";
        $("#wind").value = c.wind_speed_10m ?? "";
        $("#windDir").value = [card, isFinite(deg)?`${deg}°`:""].filter(Boolean).join(" ");
        $("#wxUpdated").textContent = "Updated @ " + nowTime();
        showSpinnerDone("Weather updated ✅");
      }catch(e){ console.warn(e); showSpinnerDone("Weather unavailable", 1200); }
    }, ()=> showSpinnerDone("Location not available", 1200));
  });

  // Weeds (noxious pinned)
  function populateWeeds(){
    const sel=$("#weedSelect"); if (!sel) return;
    sel.innerHTML="";
    const nox = (DB.weeds||[]).filter(w=>/noxious/i.test(w)).sort((a,b)=>a.localeCompare(b));
    const rest = (DB.weeds||[]).filter(w=>! /noxious/i.test(w)).sort((a,b)=>a.localeCompare(b));
    const all = ["— Select Weed —", "⚠ Noxious Weeds", ...nox, ...rest];
    all.forEach(w=>{
      const o=document.createElement("option");
      if (w==="⚠ Noxious Weeds"){ o.disabled=true; o.textContent=w; }
      else{
        o.value = w==="— Select Weed —" ? "" : w;
        o.textContent = /noxious/i.test(w) ? ("⚠ " + w) : w;
      }
      sel.appendChild(o);
    });
  }
  populateWeeds();

  // Batch select
  function populateBatchSelect(){
    const sel=$("#batchSelect"); if (!sel) return;
    sel.innerHTML=""; const def=document.createElement("option");
    def.value=""; def.textContent="— Select Batch —"; sel.appendChild(def);
    (DB.batches||[]).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).forEach(b=>{
      const o=document.createElement("option");
      const remain = (b.remaining ?? b.mix ?? 0);
      o.value=b.id; o.textContent=`${b.id} • ${formatDateAU(b.date)} • remain ${(remain||0).toFixed(0)} L`;
      sel.appendChild(o);
    });
  }
  populateBatchSelect();

  // Roadside tracking
  let tracking=false, trackTimer=null, trackCoords=[];
  $("#startTrack")?.addEventListener("click", ()=>{
    tracking=true; trackCoords=[]; $("#trackStatus").textContent="Tracking…";
    if (trackTimer) clearInterval(trackTimer);
    if (!navigator.geolocation){ toast("Enable location"); return; }
    trackTimer = setInterval(()=> navigator.geolocation.getCurrentPosition(p=> trackCoords.push([p.coords.latitude,p.coords.longitude])), 5000);
  });
  $("#stopTrack")?.addEventListener("click", ()=>{
    tracking=false; if (trackTimer) clearInterval(trackTimer);
    $("#trackStatus").textContent=`Stopped (${trackCoords.length} pts)`;
    try{ localStorage.setItem("lastTrack", JSON.stringify(trackCoords)); }catch{}
  });

  // Photo
  let photoDataURL="";
  $("#photoInput")?.addEventListener("change", (e)=>{
    const f=e.target.files?.[0]; if(!f) return;
    const reader=new FileReader();
    reader.onload=()=>{ photoDataURL=String(reader.result||""); const img=$("#photoPreview"); img.src=photoDataURL; img.style.display="block"; };
    reader.readAsDataURL(f);
  });

  // Save Task
  $("#saveTask")?.addEventListener("click", ()=> saveTask(false));
  $("#saveDraft")?.addEventListener("click", ()=> saveTask(true));

  function saveTask(isDraft){
    showSpinner("Saving Task…");
    const id=Date.now();
    const status=isDraft?"Draft":($("input[name='status']:checked")?.value||"Incomplete");
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
      coords: trackCoords.slice(),
      photo: photoDataURL || "",
      createdAt:new Date().toISOString(), archived:false
    };
    const ex = (DB.tasks||[]).find(t=> t.name===obj.name);
    if (ex) Object.assign(ex, obj); else (DB.tasks||DB.tasks=[]).push(obj);

    // link & archive inspection if provided
    if (obj.linkedInspectionId){
      const insp = DB.tasks.find(t=> t.type==="Inspection" && (String(t.id)===obj.linkedInspectionId || t.name===obj.linkedInspectionId));
      if (insp){ insp.archived=true; insp.status="Archived"; obj.linkedInspectionResolved=true; }
    }

    // consume batch quick heuristic
    if (obj.batch){
      const b=DB.batches.find(x=>x.id===obj.batch);
      if (b){
        const used = (obj.type==="Road Spray" && obj.coords?.length>1) ? 100 : 0;
        b.used = (b.used||0)+used;
        b.remaining = Math.max(0, (Number(b.mix)||0) - (b.used||0));
      }
    }

    DB_save(); populateBatchSelect(); renderRecords(); renderMap();
    setTimeout(()=> showSpinnerDone("Task Saved ✅"), 500);
  }

  // ---------- Records ----------
  $("#recFilterToggle")?.addEventListener("click", ()=>{
    const box=$("#recFilters"); box.style.display = (box.style.display==="none"||!box.style.display)?"block":"none";
  });
  $("#recSearchBtn")?.addEventListener("click", renderRecords);
  $("#recResetBtn")?.addEventListener("click", ()=>{
    $("#recSearch").value=""; $("#recFrom").value=""; $("#recTo").value="";
    ["fInspection","fSpot","fRoad","fComplete","fIncomplete","fDraft"].forEach(id=> { const n=$("#"+id); if(n) n.checked=false; });
    renderRecords();
  });

  function recordMatches(t,q,from,to,types,statuses){
    if (t.archived) return false;
    if (from && (t.date||"")<from) return false;
    if (to && (t.date||"")>to) return false;
    if (q){
      const hay=`${t.name} ${t.weed} ${t.council} ${t.batch}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    const typeOK = ((!types.inspection && !types.spot && !types.road)
      || (t.type==="Inspection"&&types.inspection)
      || (t.type==="Spot Spray"&&types.spot)
      || (t.type==="Road Spray"&&types.road));
    if (!typeOK) return false;

    const s=t.status||"Incomplete";
    const statusesEmpty = !statuses.complete && !statuses.incomplete && !statuses.draft;
    const statusOK = statusesEmpty || (s==="Complete"&&statuses.complete) || (s==="Incomplete"&&statuses.incomplete) || (s==="Draft"&&statuses.draft);
    return statusOK;
  }

  function renderRecords(){
    const list=$("#recordsList"); if(!list) return; list.innerHTML="";
    const q=($("#recSearch").value||"").trim().toLowerCase();
    const from=$("#recFrom").value||""; const to=$("#recTo").value||"";
    const types={inspection:$("#fInspection").checked, spot:$("#fSpot").checked, road:$("#fRoad").checked};
    const statuses={complete:$("#fComplete").checked, incomplete:$("#fIncomplete").checked, draft:$("#fDraft").checked};

    (DB.tasks||[]).filter(t=>recordMatches(t,q,from,to,types,statuses))
      .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
      .forEach(t=>{
        const d=document.createElement("div"); d.className="item";
        const dateAU = formatDateAU(t.date);
        d.innerHTML=`<b>${t.name}</b><br><small>${t.type} • ${dateAU} • ${t.status}</small>
          <div class="row end" style="gap:.4rem;margin-top:.4rem">
            <button class="pill open-record" data-id="${t.id}">Open</button>
            <button class="pill ghost edit-record" data-id="${t.id}">Edit</button>
            ${t.coords && t.coords.length ? `<button class="pill" data-nav="${t.id}">Navigate</button>` : ""}
          </div>`;
        list.appendChild(d);
      });
  }
  // Delegated buttons
  $("#recordsList")?.addEventListener("click", (e)=>{
    const openBtn = e.target.closest(".open-record");
    if (openBtn){ const t=DB.tasks.find(x=>String(x.id)===openBtn.dataset.id); if(t) showJobPopup(t); return; }
    const editBtn = e.target.closest(".edit-record");
    if (editBtn){ const t=DB.tasks.find(x=>String(x.id)===editBtn.dataset.id); if(t) startEditTask(t); return; }
    const navBtn = e.target.closest("[data-nav]");
    if (navBtn){
      const t=DB.tasks.find(x=>String(x.id)===navBtn.dataset.nav);
      const pt=t?.coords?.[0]; if(!pt){ toast("No coords saved"); return; }
      openAppleMaps(pt[0],pt[1]);
    }
  });

  function startEditTask(t){
    switchScreen("createTask");
    $("#jobName").value=t.name; $("#councilNum").value=t.council||""; $("#linkInspectionId").value=t.linkedInspectionId||"";
    $("#taskType").value=t.type; $("#taskType").dispatchEvent(new Event("change"));
    $("#weedSelect").value=t.weed||""; $("#batchSelect").value=t.batch||"";
    $("#jobDate").value=t.date||todayISO(); $("#startTime").value=t.start||""; $("#endTime").value=t.end||"";
    $("#temp").value=t.temp||""; $("#wind").value=t.wind||""; $("#windDir").value=t.windDir||""; $("#humidity").value=t.humidity||"";
    $("#notes").value=t.notes||"";
    if (t.photo){ $("#photoPreview").src=t.photo; $("#photoPreview").style.display="block"; }
    toast("Editing task");
  }

  function showJobPopup(t){
    const batchLink = t.batch ? `<a href="#" data-open-batch="${t.batch}">${t.batch}</a>` : "—";
    const linkedInsp = t.linkedInspectionId ? `<a href="#" data-open-insp="${t.linkedInspectionId}">${t.linkedInspectionId}</a>` : "—";
    const photoHtml = t.photo ? `<div style="margin:.4rem 0"><img src="${t.photo}" alt="photo" style="max-width:100%;border-radius:8px"/></div>` : "";
    const hasPt = t.coords && t.coords.length;
    const html=`
      <div class="grid two" style="gap:.6rem">
        <div><b>Type:</b> ${t.type}</div><div><b>Status:</b> ${t.status}</div>
        <div><b>Date:</b> ${formatDateAU(t.date)}</div>
        <div><b>Start/End:</b> ${t.start||"–"} / ${t.end||"–"}</div>
        <div><b>Weed:</b> ${t.weed||"—"}</div><div><b>Batch:</b> ${batchLink}</div>
        <div><b>Linked Inspection:</b> ${linkedInsp}</div><div><b>Reminder:</b> ${t.reminder||"—"} wk</div>
        <div class="span2"><b>Weather:</b> ${t.temp??"–"}°C, ${t.wind??"–"} km/h, ${t.windDir||"–"}, ${t.humidity??"–"}%</div>
        <div class="span2"><b>Notes:</b> ${t.notes||"—"}</div>
      </div>
      ${photoHtml}
      <div class="row end" style="gap:.5rem;margin-top:.6rem">
        ${hasPt? `<button class="pill" id="jp_nav">Navigate</button>`:""}
        <button class="pill" id="jp_edit">Edit</button>
      </div>`;
    showPopup(t.name, html);
    $("#popup")?.addEventListener("click",(e)=>{
      if (e.target.id==="jp_edit"){ startEditTask(t); $("#popup")?.remove(); }
      if (e.target.id==="jp_nav"){ const pt=t.coords?.[0]; if(!pt){ toast("No coords"); return; } openAppleMaps(pt[0],pt[1]); }
      const batchA = e.target.closest("[data-open-batch]");
      if (batchA){ e.preventDefault(); const b=DB.batches.find(x=>x.id===t.batch); if(b) showBatchPopup(b); }
      const inspA = e.target.closest("[data-open-insp]");
      if (inspA){ e.preventDefault(); const i=DB.tasks.find(x=>x.type==="Inspection"&&(String(x.id)===t.linkedInspectionId||x.name===t.linkedInspectionId)); if(i) showJobPopup(i); }
    });
  }

  // ---------- Batches ----------
  let batchFormInited=false;
  function initBatchFormOnce(){
    if (batchFormInited) return; batchFormInited=true;
    $("#bf_date").value = todayISO();
    $("#bf_time").value = nowTime();
    $("#bf_addRow").addEventListener("click", addBatchRow);
    $("#bf_create").addEventListener("click", createBatch);
    $("#bf_deleteDraft").addEventListener("click", ()=>{ $("#bf_name").value=""; $("#bf_totalMix").value=""; $("#bf_rows").innerHTML=""; $("#bf_summary").textContent="Totals: –"; toast("Draft cleared"); });
    addBatchRow();
  }

  function addBatchRow(){
    const cont = $("#bf_rows");
    const idx = cont.children.length;
    const names = (DB.chems||[]).map(c=>c.name).sort((a,b)=>a.localeCompare(b));
    const row = BF_buildRow(cont, idx, names);
    // listeners
    row.addEventListener("input", ()=> updateBatchSummary());
    row.querySelector(".br_del").addEventListener("click", ()=>{ row.remove(); updateBatchSummary(); setTimeout(()=> cont.scrollTo({top:cont.scrollHeight, behavior:"smooth"}), 50); });
    // scroll to bottom so it's easy on iPhone
    setTimeout(()=> cont.scrollTo({top:cont.scrollHeight, behavior:"smooth"}), 50);
  }

  function updateBatchSummary(){
    const total = Number($("#bf_totalMix").value)||0;
    const lines = BF_recalc($("#bf_rows"), total);
    const txt = lines.length ? lines.map(x=>`${x.name}: ${x.calc.toFixed(2)} ${x.unit}`).join(" • ") : "–";
    $("#bf_summary").textContent = `Totals: ${txt}`;
  }
  $("#bf_totalMix")?.addEventListener("input", updateBatchSummary);

  function hasStock(name, need, unit){
    const c = (DB.chems||[]).find(x=>x.name===name);
    if (!c) return false;
    // Rough check: compare by unit; L/mL and g/kg basic conversion
    let available = (c.containers||0) * (c.containerSize||0);
    if (c.containerUnit==="mL") available /= 1000;
    if (c.containerUnit==="kg") available *= 1000; // compare in g/L rough
    let want = need;
    if (unit==="mL") want/=1000;
    if (unit==="kg") want*=1000;
    return available >= want;
  }

  function consumeStock(name, used, unit){
    const c = (DB.chems||[]).find(x=>x.name===name);
    if (!c) return;
    // Deduct from total; simple container calc
    let total = (c.containers||0) * (c.containerSize||0); // base unit
    // convert to L or g baseline depending on c.containerUnit (rough heuristic)
    let usedBase = used;
    if (c.containerUnit==="mL") { total/=1000; }
    if (c.containerUnit==="kg") { total*=1000; } // to grams baseline
    if (unit==="mL") usedBase/=1000;
    if (unit==="kg") usedBase*=1000;
    const remainBase = Math.max(0, total - usedBase);
    // write back to containers count as approximate
    const unitSize = c.containerSize||1;
    let newContainers = remainBase / unitSize;
    c.containers = Math.max(0, Math.floor(newContainers*100)/100);
  }

  function createBatch(){
    showSpinner("Creating Batch…");
    const id = $("#bf_name").value.trim() || ("B"+Date.now());
    const date = $("#bf_date").value || todayISO();
    const time = $("#bf_time").value || nowTime();
    const mixL = Number($("#bf_totalMix").value)||0;
    // compile rows
    const lines = [];
    [...$("#bf_rows").querySelectorAll(".chem-row")].forEach(row=>{
      const name=row.querySelector(".br_name").value.trim();
      const rate=Number(row.querySelector(".br_rate").value)||0;
      const unit=row.querySelector(".br_unit").value;
      if (name && rate>0){ lines.push({name, rate, unit}); }
    });
    if (!mixL || !lines.length){ showSpinnerDone("Enter mix & chemicals", 1200); return; }

    // validate stock
    for (const ln of lines){
      const need = (ln.rate/100) * mixL; // amount to add
      if (!hasStock(ln.name, need, ln.unit)){
        showSpinnerDone(`Not enough stock: ${ln.name}`, 1600); return;
      }
    }
    // consume stock
    for (const ln of lines){
      const need = (ln.rate/100) * mixL;
      consumeStock(ln.name, need, ln.unit);
    }

    const obj={ id, date, time, mix:mixL, remaining:mixL, used:0,
      chemicals: lines.map(l=>`${l.name} ${l.rate}${l.unit}/100L`).join(", ") };

    (DB.batches||DB.batches=[]).push(obj); DB_save(); populateBatchSelect(); renderBatches(); renderChems(); renderProcurement();

    setTimeout(()=>{
      showSpinnerDone("Batch Created ✅", 1000);
      // Summary flash
      toast(`Batch ${id} • ${mixL}L`);
      // reset draft form lightly
      // keep rows for convenience
    }, 500);
  }

  function renderBatches(){
    const list=$("#batchList"); if(!list) return; list.innerHTML="";
    const from=$("#batFrom").value||""; const to=$("#batTo").value||"";
    (DB.batches||[]).filter(b=>(!from||b.date>=from)&&(!to||b.date<=to))
      .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
      .forEach(b=>{
        const ring = (Number(b.remaining)||0)===0 ? "style='box-shadow:0 0 0 3px #b23b3b inset;border-color:#b23b3b'" : "";
        const item=document.createElement("div"); item.className="item";
        item.innerHTML=`<div ${ring}><b>${b.id}</b><br><small>${formatDateAU(b.date)} • Total ${b.mix} L • Remaining ${(b.remaining??b.mix)||0} L</small></div>
          <div class="row end" style="gap:.4rem;margin-top:.4rem">
            <button class="pill open-batch" data-id="${b.id}">Open</button>
            <button class="pill ghost dump-batch" data-id="${b.id}">Dump</button>
          </div>`;
        list.appendChild(item);
      });
  }
  $("#batchList")?.addEventListener("click",(e)=>{
    const ob=e.target.closest(".open-batch");
    if (ob){ const b=DB.batches.find(x=>x.id===ob.dataset.id); if(b) showBatchPopup(b); return; }
    const dbt=e.target.closest(".dump-batch");
    if (dbt){ const b=DB.batches.find(x=>x.id===dbt.dataset.id); if(!b) return; const reason=prompt("Reason for dumping:",""); if(reason!==null){ b.used=b.mix; b.remaining=0; b.dumpReason=reason; DB_save(); renderBatches(); toast("Batch dumped"); } }
  });

  function showBatchPopup(b){
    const jobs=DB.tasks.filter(t=>t.batch===b.id);
    const jobsHtml= jobs.length ? `<ul>${jobs.map(t=>`<li><a href="#" data-open-job="${t.id}">${t.name}</a></li>`).join("")}</ul>` : "—";
    const html=`
      <div><b>Date:</b> ${formatDateAU(b.date)||"–"} · <b>Time:</b> ${b.time||"–"}</div>
      <div><b>Total Mix:</b> ${b.mix} L</div>
      <div><b>Remaining:</b> ${(b.remaining??b.mix)||0} L</div>
      <div style="margin-top:.4rem"><b>Chemicals:</b><br>${b.chemicals||"—"}</div>
      <div style="margin-top:.4rem"><b>Linked Jobs:</b><br>${jobsHtml}</div>
      <div class="row end" style="gap:.5rem;margin-top:.6rem">
        <button class="pill" id="be_edit">Edit</button>
      </div>`;
    showPopup(b.id, html);
    $("#popup")?.addEventListener("click",(e)=>{
      const a=e.target.closest("[data-open-job]"); if (a){ e.preventDefault(); const t=DB.tasks.find(x=>String(x.id)===a.dataset.openJob); if(t) showJobPopup(t); }
      if (e.target.id==="be_edit"){
        const mix=Number(prompt("Total mix (L):",b.mix))||b.mix;
        const rem=Number(prompt("Remaining (L):",b.remaining))||b.remaining;
        const chems=prompt("Chemicals:",b.chemicals||"")||b.chemicals||"";
        b.mix=mix; b.remaining=rem; b.chemicals=chems; b.time ||= nowTime();
        DB_save(); $("#popup")?.remove(); renderBatches(); populateBatchSelect();
      }
    });
  }

  // ---------- Inventory ----------
  $("#addChem")?.addEventListener("click", ()=>{
    const name=prompt("Chemical name:"); if(!name) return;
    const active=prompt("Active ingredient:","")||"";
    const size=Number(prompt("Container size (number):","20"))||0;
    const unit=prompt("Unit (L, mL, g, kg):","L")||"L";
    const count=Number(prompt("How many containers:","0"))||0;
    const thr=Number(prompt("Reorder threshold (containers):","0"))||0;
    DB.chems.push({name,active,containerSize:size,containerUnit:unit,containers:count,threshold:thr});
    DB_save(); renderChems(); renderProcurement();
  });

  let _chemEditing=null;
  function openChemEditor(c){
    _chemEditing = c;
    $("#ce_name").value = c.name || "";
    $("#ce_active").value = c.active || "";
    $("#ce_size").value = c.containerSize || 0;
    $("#ce_unit").value = c.containerUnit || "L";
    $("#ce_count").value = c.containers || 0;
    $("#ce_threshold").value = c.threshold || 0;
    $("#chemEditSheet").style.display="block";
  }
  function closeChemEditor(){ $("#chemEditSheet").style.display="none"; _chemEditing=null; }
  $("#ce_cancel")?.addEventListener("click", closeChemEditor);
  $("#ce_save")?.addEventListener("click", ()=>{
    if (!_chemEditing) return;
    _chemEditing.name = $("#ce_name").value.trim();
    _chemEditing.active = $("#ce_active").value.trim();
    _chemEditing.containerSize = Number($("#ce_size").value)||0;
    _chemEditing.containerUnit = $("#ce_unit").value||"L";
    _chemEditing.containers = Number($("#ce_count").value)||0;
    _chemEditing.threshold  = Number($("#ce_threshold").value)||0;
    DB_save(); renderChems(); renderProcurement(); closeChemEditor(); toast("Chemical updated");
  });

  function renderChems(){
    const list=$("#chemList"); if(!list) return; list.innerHTML="";
    const q = ($("#chemSearch")?.value||"").trim().toLowerCase();
    DB.chems.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach(c=>{
      const hay = `${c.name} ${c.active}`.toLowerCase();
      if (q && !hay.includes(q)) return;
      const total = (c.containers||0) * (c.containerSize||0);
      const line = `${c.containers} × ${c.containerSize} ${c.containerUnit} • total ${total.toFixed(2)} ${c.containerUnit}`;
      const card=document.createElement("div"); card.className="item";
      card.innerHTML=`<b>${c.name}</b><br><small>${line}</small><br><small>Active: ${c.active || "—"}</small>
        <div class="row gap end" style="margin-top:.4rem">
          <button class="pill" data-edit>Edit</button>
          <button class="pill warn" data-del>Delete</button>
        </div>`;
      if (c.threshold && c.containers < c.threshold) upsertProcurement(`Low stock: ${c.name}`);
      card.querySelector("[data-edit]")?.addEventListener("click", ()=> openChemEditor(c));
      card.querySelector("[data-del]")?.addEventListener("click", ()=>{ if(!confirm("Delete chemical?")) return; DB.chems = DB.chems.filter(x=>x!==c); DB_save(); renderChems(); renderProcurement(); });
      list.appendChild(card);
    });
  }
  $("#chemSearchBtn")?.addEventListener("click", renderChems);
  $("#chemResetBtn")?.addEventListener("click", ()=>{ $("#chemSearch").value=""; renderChems(); });
  renderChems();

  function upsertProcurement(title){
    DB.procurement ??= [];
    if (!DB.procurement.find(p=>p.title===title)){
      DB.procurement.push({id:"P"+Date.now()+Math.random().toString(16).slice(2), title, createdAt:new Date().toISOString(), done:false});
      DB_save(false);
    }
  }
  function renderProcurement(){
    const ul=$("#procList"); const ul2=$("#procList2");
    const render = (host)=>{
      if (!host) return;
      host.innerHTML="";
      DB.chems.forEach(c=>{
        if (c.threshold && (c.containers||0) < c.threshold){
          const li=document.createElement("li");
          li.textContent=`Low stock: ${c.name} (${c.containers||0} < ${c.threshold})`; host.appendChild(li);
        }
      });
    };
    render(ul); render(ul2);
  }
  renderProcurement();

  // ---------- Mapping ----------
  let map, group, locateCtrl;
  function ensureMap(){
    if (map) return map;
    map = L.map("map").setView([-34.75,148.65], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);

    // locate-me
    locateCtrl = L.control({position:"bottomright"});
    locateCtrl.onAdd = function(){
      const d=L.DomUtil.create("div","leaflet-bar");
      d.style.background="#0c7d2b"; d.style.color="#fff"; d.style.borderRadius="6px"; d.style.padding="6px 10px"; d.style.cursor="pointer";
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
    $("#mapWeed").value=""; $("#mapType").value="All"; renderMap(true);
  });

  function openAppleMaps(lat, lon){
    const mapsURL = `maps://?daddr=${lat},${lon}&dirflg=d`;
    const webURL  = `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
    const a=document.createElement("a");
    a.href = mapsURL; document.body.appendChild(a); a.click();
    setTimeout(()=>{ window.open(webURL, "_blank"); a.remove(); }, 250);
  }

  function renderMap(fit=false){
    const m=ensureMap();
    if (group){ try{ m.removeLayer(group); }catch{} }
    group = L.featureGroup();

    const typ=$("#mapType").value||"All";
    const weedQ=($("#mapWeed")?.value || "").trim().toLowerCase();

    const tasks=(DB.tasks||[])
      .filter(t=>!t.archived)
      .filter(t=> typ==="All"?true:t.type===typ)
      .filter(t=> weedQ ? (`${t.weed} ${t.name}`.toLowerCase().includes(weedQ)) : true);

    tasks.forEach(t=>{
      if (t.coords?.length>1) group.addLayer(L.polyline(t.coords,{color:"yellow",weight:4,opacity:.9}));
      const pt = t.coords?.[0] || [-34.75 + Math.random()*0.08, 148.65 + Math.random()*0.08];
      const thumb = t.photo ? `<br><img src="${t.photo}" style="max-width:180px;border-radius:6px;margin-top:.3rem">` : "";
      const popup = `<b>${t.name}</b><br>${t.type} • ${formatDateAU(t.date)}${thumb}
                     <br><button class="pill" data-open="${t.id}">Open</button>
                     <button class="pill" data-nav="${pt[0]},${pt[1]}" style="margin-left:.4rem">Navigate</button>`;
      const marker = L.marker(pt); marker.bindPopup(popup);
      marker.on("popupopen", ()=>{
        setTimeout(()=>{
          const pop=document.querySelector(".leaflet-popup");
          pop?.addEventListener("click",(e)=>{
            const ob=e.target.closest("[data-open]"); if (ob){ const t=DB.tasks.find(x=>String(x.id)===ob.dataset.open); if(t) showJobPopup(t); }
            const nb=e.target.closest("[data-nav]"); if (nb){ const [la,lo]=nb.dataset.nav.split(",").map(Number); openAppleMaps(la,lo); }
          });
        },0);
      });
      group.addLayer(marker);
    });

    group.addTo(m);
    if (fit && tasks.length){
      try{ m.fitBounds(group.getBounds().pad(0.2)); }catch{}
    }
    // last tracked polyline
    try{
      const last = JSON.parse(localStorage.getItem("lastTrack")||"[]");
      if (Array.isArray(last) && last.length>1) L.polyline(last,{color:"#ffda44",weight:3,opacity:.8}).addTo(m);
    }catch{}
  }

  // Initial loads
  renderRecords(); renderChems(); renderProcurement(); renderBatches();

});
