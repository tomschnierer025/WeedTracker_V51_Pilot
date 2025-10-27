/* WeedTracker V60 Pilot — apps.js (full)
   Fixes:
   - Task Type as STEP 1
   - Create Batch opens (single-page, scrollable)
   - Batch search by name/road/linked job
   - Mapping search = Records search (plus Locate Me FAB lifted)
   - Home buttons coloured, icons corrected (Batches = flask)
   - All popups & buttons wired; big green spinner + success flash
*/

document.addEventListener("DOMContentLoaded", () => {
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const todayISO = ()=> new Date().toISOString().split("T")[0];
  const nowTime  = ()=> new Date().toTimeString().slice(0,5);
  const fmt = (n,d=0)=> (n==null||n==="")?"–":Number(n).toFixed(d);

  /* ---------- navigation ---------- */
  const screens=$$(".screen");
  function go(id){ screens.forEach(s=>s.classList.remove("active")); $("#"+id)?.classList.add("active"); }
  $$("[data-target]").forEach(b=> b.addEventListener("click",()=> go(b.dataset.target)));
  $("#homeBtn")?.addEventListener("click",()=>go("home"));

  /* ---------- spinner + toasts ---------- */
  function showSpinner(msg="Saving…"){ let s=$("#spinnerOverlay"); if(!s){s=document.createElement("div"); s.id="spinnerOverlay"; s.style.display="flex"; s.textContent=msg; document.body.appendChild(s);} s.textContent=msg; s.style.display="flex";}
  function hideSpinner(){ const s=$("#spinnerOverlay"); if(s) s.style.display="none"; }
  function flashOK(msg){
    const d=document.createElement("div");
    d.className="toastSummary"; d.style=`position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#1d9a5f;color:#fff;border-radius:10px;padding:10px 16px;font-weight:800;z-index:9999`;
    d.textContent=msg; document.body.appendChild(d); setTimeout(()=>d.remove(),2000);
  }

  /* ---------- minimal in-memory store wiring to localStorage ---------- */
  const KEY="weedtracker_v60";
  function loadDB(){
    try{ return JSON.parse(localStorage.getItem(KEY)||"{}"); }catch{ return {}; }
  }
  function saveDB(){ localStorage.setItem(KEY, JSON.stringify(DB)); }
  let DB=loadDB();
  DB.tasks ??= []; DB.batches ??= []; DB.weeds ??= seedWeeds(); DB.settings ??= {dark:true};

  /* ---------- seeds ---------- */
  function seedWeeds(){
    const list = [
      "⚠ NOXIOUS WEEDS (category)",
      "⚠ African Boxthorn (noxious)",
      "⚠ African Lovegrass (noxious)",
      "⚠ Bathurst Burr (noxious)",
      "⚠ Blackberry (noxious)",
      "⚠ Cape Broom (noxious)",
      "⚠ Chilean Needle Grass (noxious)",
      "⚠ Coolatai Grass (noxious)",
      "⚠ Fireweed (noxious)",
      "⚠ Gorse (noxious)",
      "⚠ Lantana (noxious)",
      "⚠ Patterson’s Curse (noxious)",
      "⚠ Serrated Tussock (noxious)",
      "⚠ St John’s Wort (noxious)",
      "⚠ Sweet Briar (noxious)",
      "⚠ Willow spp. (noxious)",
      "African Feathergrass","Artichoke Thistle","Balloon Vine","Blue Heliotrope","Bridal Creeper","Caltrop",
      "Coltsfoot","Fleabane","Flax-leaf Broom","Fountain Grass","Galvanised Burr","Giant Parramatta Grass",
      "Glycine","Green Cestrum","Horehound","Khaki Weed","Noogoora Burr","Parthenium Weed","Prickly Pear (common)",
      "Saffron Thistle","Silverleaf Nightshade","Spear Thistle","Sweet Vernal Grass","Three-cornered Jack","Wild Radish"
    ];
    return list;
  }

  /* ---------- HOME: ensure coloured buttons exist ---------- */
  // Expect index.html to have .home-list with .home-btn + per-section classes already

  /* ---------- CREATE TASK (STEP 1 = Task Type) ---------- */
  const jobDate=$("#jobDate"); if (jobDate && !jobDate.value) jobDate.value=todayISO();
  const taskType=$("#taskType");
  const roadBlock=$("#roadTrackBlock");
  const locateBtn=$("#locateBtn"); const locRoad=$("#locRoad");
  const autoNameBtn=$("#autoNameBtn");
  const TYPE_PREFIX={"Inspection":"I","Spot Spray":"SS","Road Spray":"RS"};
  let currentRoad = "";

  function syncRoadBlock(){ roadBlock.style.display = (taskType.value==="Road Spray") ? "block" : "none"; }
  taskType?.addEventListener("change",syncRoadBlock); syncRoadBlock(); // locks step-1 behaviour

  locateBtn?.addEventListener("click",()=>{
    showSpinner("Getting location…");
    if (!navigator.geolocation){ hideSpinner(); alert("Location disabled"); return; }
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{
        const {latitude,longitude}=pos.coords;
        const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
        const j=await r.json();
        currentRoad = j.address?.road || j.display_name || `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
        locRoad.textContent=currentRoad;
      }catch{ locRoad.textContent="Unknown"; }
      hideSpinner();
    },()=>{ hideSpinner(); alert("Cannot get GPS"); });
  });

  autoNameBtn?.addEventListener("click",()=>{
    const prefix = TYPE_PREFIX[taskType.value] || "I";
    // AU ddmmyyyy no dashes; requirement: Road + ddmmyyyy + job type at end
    const dt = jobDate?.value ? new Date(jobDate.value) : new Date();
    const dd = String(dt.getDate()).padStart(2,"0");
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const yy = String(dt.getFullYear());
    const compact = `${dd}${mm}${yy}`;
    const roadSlug = (currentRoad||"UnknownRoad").replace(/\s+/g,"");
    $("#jobName").value = `${roadSlug}${compact}${prefix}`;
  });

  // Weather (inc humidity + cardinal wind)
  $("#autoWeatherBtn")?.addEventListener("click",()=>{
    if (!navigator.geolocation){ alert("Enable location"); return; }
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{
        const {latitude,longitude}=pos.coords;
        const url=`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;
        const r=await fetch(url); const j=await r.json(); const c=j.current||{};
        $("#temp").value=c.temperature_2m ?? "";
        $("#wind").value=c.wind_speed_10m ?? "";
        const deg=c.wind_direction_10m ?? "";
        $("#windDir").value = deg==="" ? "" : `${deg}° ${degToCardinal(deg)}`;
        $("#humidity").value=c.relative_humidity_2m ?? "";
        $("#wxUpdated").textContent="Updated @ "+nowTime();
      }catch{ alert("Weather unavailable"); }
    });
  });
  function degToCardinal(d){
    const dirs=["N","NE","E","SE","S","SW","W","NW","N"];
    return dirs[Math.round(d/45)];
  }

  // Photo
  let photoDataURL=""; $("#photoInput")?.addEventListener("change",(e)=>{
    const f=e.target.files?.[0]; if(!f) return; const rd=new FileReader();
    rd.onload=()=>{ photoDataURL=String(rd.result||""); const img=$("#photoPreview"); img.src=photoDataURL; img.style.display="block"; };
    rd.readAsDataURL(f);
  });

  // Start/Stop Road tracking
  let tracking=false, trackTimer=null, trackCoords=[];
  $("#startTrack")?.addEventListener("click",()=>{
    trackCoords=[]; tracking=true; $("#trackStatus").textContent="Tracking…";
    if (trackTimer) clearInterval(trackTimer);
    if (!navigator.geolocation){ alert("Location disabled"); return;}
    trackTimer=setInterval(()=> navigator.geolocation.getCurrentPosition(p=> trackCoords.push([p.coords.latitude,p.coords.longitude])), 4500);
  });
  $("#stopTrack")?.addEventListener("click",()=>{
    tracking=false; if(trackTimer) clearInterval(trackTimer);
    $("#trackStatus").textContent=`Stopped (${trackCoords.length} pts)`;
    localStorage.setItem("lastTrack", JSON.stringify(trackCoords));
  });

  // Save Task (Complete/Incomplete radio is in HTML)
  $("#saveTask")?.addEventListener("click",()=> saveTask(false));
  $("#saveDraft")?.addEventListener("click",()=> saveTask(true));

  function saveTask(isDraft){
    showSpinner("Saving task…");
    const status=isDraft?"Draft":($("input[name='status']:checked")?.value||"Incomplete");
    const obj={
      id: Date.now(),
      name: $("#jobName").value.trim() || ("Task_"+Date.now()),
      council: $("#councilNum").value.trim(),
      linkedInspectionId: $("#linkInspectionId").value.trim(),
      type: taskType.value,
      weed: $("#weedSelect").value,
      batch: $("#batchSelect").value,
      date: jobDate.value || todayISO(),
      start: $("#startTime").value || "",
      end:   $("#endTime").value   || "",
      temp: $("#temp").value, wind: $("#wind").value, windDir: $("#windDir").value, humidity: $("#humidity").value,
      reminder: $("#reminderWeeks").value || "",
      status, notes: $("#notes").value || "",
      coords: trackCoords.slice(),
      photo: photoDataURL || "",
      createdAt: new Date().toISOString(), archived:false, road: currentRoad||""
    };
    const exist = DB.tasks.find(t=> t.name===obj.name);
    if (exist) Object.assign(exist,obj); else DB.tasks.push(obj);

    // link inspection (archive)
    if (obj.linkedInspectionId){
      const insp = DB.tasks.find(t=> t.type==="Inspection" && (String(t.id)===obj.linkedInspectionId || t.name===obj.linkedInspectionId));
      if (insp){ insp.archived=true; insp.status="Archived"; }
    }
    saveDB(); hideSpinner(); flashOK("Task saved ✅");
    renderRecords(); populateBatchSelect(); // refresh lists
  }

  /* ---------- weed + batch selects ---------- */
  function populateWeeds(){
    const sel=$("#weedSelect"); if(!sel) return; sel.innerHTML="";
    DB.weeds.forEach(w=>{
      const o=document.createElement("option");
      o.value = w.includes("category") ? "NOXIOUS" : w;
      o.textContent = w.startsWith("⚠") ? w : w;
      sel.appendChild(o);
    });
  } populateWeeds();

  function populateBatchSelect(){
    const sel=$("#batchSelect"); if(!sel) return;
    sel.innerHTML=""; const def=document.createElement("option");
    def.value=""; def.textContent="— Select Batch —"; sel.appendChild(def);
    DB.batches.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).forEach(b=>{
      const o=document.createElement("option");
      const remain = b.remainingL ?? b.mixL ?? 0;
      o.value=b.id; o.textContent=`${b.id} • ${fmtDateAU(b.date)} • remain ${fmt(remain)} L`;
      sel.appendChild(o);
    });
  } populateBatchSelect();

  function fmtDateAU(d){ const dt=new Date(d); const dd=String(dt.getDate()).padStart(2,"0"); const mm=String(dt.getMonth()+1).padStart(2,"0"); const yy=dt.getFullYear(); return `${dd}-${mm}-${yy}`;}

  /* ---------- Records (search like Mapping) ---------- */
  $("#recSearchBtn")?.addEventListener("click",renderRecords);
  $("#recResetBtn")?.addEventListener("click",()=>{ $("#recSearch").value=""; $("#recFrom").value=""; $("#recTo").value=""; ["fInspection","fSpot","fRoad","fComplete","fIncomplete","fDraft"].forEach(id=>{$("#"+id).checked=false;}); renderRecords(); });

  function recordMatches(t,q,from,to,types,statuses){
    if (t.archived) return false;
    if (from && (t.date||"")<from) return false;
    if (to   && (t.date||"")>to)   return false;
    if (q){
      const hay=`${t.name} ${t.weed} ${t.council} ${t.road}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    const typOK = (!types.inspection && !types.spot && !types.road) ||
                  (t.type==="Inspection" && types.inspection) ||
                  (t.type==="Spot Spray" && types.spot) ||
                  (t.type==="Road Spray" && types.road);
    if (!typOK) return false;
    const s=t.status||"Incomplete";
    const stEmpty = !statuses.complete && !statuses.incomplete && !statuses.draft;
    const stOK = stEmpty || (s==="Complete"&&statuses.complete) || (s==="Incomplete"&&statuses.incomplete) || (s==="Draft"&&statuses.draft);
    return stOK;
  }

  function renderRecords(){
    const list=$("#recordsList"); if(!list) return; list.innerHTML="";
    const q=$("#recSearch").value.trim(); const from=$("#recFrom").value; const to=$("#recTo").value;
    const types={inspection:$("#fInspection").checked, spot:$("#fSpot").checked, road:$("#fRoad").checked};
    const statuses={complete:$("#fComplete").checked, incomplete:$("#fIncomplete").checked, draft:$("#fDraft").checked};
    DB.tasks.filter(t=>recordMatches(t,q,from,to,types,statuses))
      .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
      .forEach(t=>{
        const d=document.createElement("div"); d.className="item";
        d.innerHTML=`<b>${t.name}</b><br><small>${t.type} • ${fmtDateAU(t.date)} • ${t.status}</small>
          <div class="row end mt">
            <button class="pill" data-open="${t.id}">Open</button>
            <button class="pill" data-edit="${t.id}">Edit</button>
            ${t.coords?.length? `<button class="pill" data-nav="${t.id}">Navigate</button>`:""}
          </div>`;
        d.querySelector(`[data-open="${t.id}"]`).onclick=()=> showJobPopup(t);
        d.querySelector(`[data-edit="${t.id}"]`).onclick=()=> editJob(t);
        const nb=d.querySelector(`[data-nav="${t.id}"]`); if (nb) nb.onclick=()=> openAppleMaps(t.coords[0][0], t.coords[0][1]);
        list.appendChild(d);
      });
  } renderRecords();

  function editJob(t){
    go("createTask");
    $("#jobName").value=t.name; $("#councilNum").value=t.council||""; $("#linkInspectionId").value=t.linkedInspectionId||"";
    taskType.value=t.type; taskType.dispatchEvent(new Event("change"));
    $("#weedSelect").value=t.weed||""; $("#batchSelect").value=t.batch||"";
    $("#jobDate").value=t.date||todayISO(); $("#startTime").value=t.start||""; $("#endTime").value=t.end||"";
    $("#temp").value=t.temp||""; $("#wind").value=t.wind||""; $("#windDir").value=t.windDir||""; $("#humidity").value=t.humidity||"";
    $("#notes").value=t.notes||"";
  }

  function showJobPopup(t){
    const batchLink = t.batch ? `<a href="#" data-open-batch="${t.batch}">${t.batch}</a>` : "—";
    const linkedInsp = t.linkedInspectionId ? `<a href="#" data-open-insp="${t.linkedInspectionId}">${t.linkedInspectionId}</a>` : "—";
    const photoHtml = t.photo ? `<div class="mt"><img src="${t.photo}" style="max-width:100%;border-radius:8px"/></div>` : "";
    const hasPt = t.coords && t.coords.length;
    const html=`
      <div class="modal" id="jobView">
        <div class="card p">
          <div class="row spread"><h3>${t.name}</h3><button class="pill warn" data-close>Close</button></div>
          <div class="grid two tight">
            <div><b>Type:</b> ${t.type}</div><div><b>Status:</b> ${t.status}</div>
            <div><b>Date:</b> ${fmtDateAU(t.date)}</div>
            <div><b>Time:</b> ${t.start||"–"} – ${t.end||"–"}</div>
            <div><b>Weed:</b> ${t.weed||"—"}</div><div><b>Batch:</b> ${batchLink}</div>
            <div><b>Linked Insp:</b> ${linkedInsp}</div><div><b>Reminder:</b> ${t.reminder||"—"} wk</div>
            <div class="span2"><b>Weather:</b> ${fmt(t.temp)}°C, ${fmt(t.wind)} km/h, ${t.windDir||"–"}, ${fmt(t.humidity)}%</div>
            <div class="span2"><b>Notes:</b> ${t.notes||"—"}</div>
          </div>
          ${photoHtml}
          <div class="row end mt">
            ${hasPt? `<button class="pill" data-nav>Navigate</button>`:""}
            <button class="pill" data-edit>Edit</button>
          </div>
        </div>
      </div>`;
    const wrap=document.createElement("div"); wrap.innerHTML=html; document.body.appendChild(wrap.firstChild);
    const modal=$("#jobView"); modal.onclick=e=>{ if(e.target===modal||e.target.dataset.close!=null) modal.remove(); };
    $("[data-open-batch]",modal)?.addEventListener("click",(e)=>{ e.preventDefault(); const b=DB.batches.find(x=>x.id===t.batch); b && showBatchPopup(b); });
    $("[data-open-insp]",modal)?.addEventListener("click",(e)=>{ e.preventDefault(); const insp=DB.tasks.find(x=>x.type==="Inspection"&&(String(x.id)===t.linkedInspectionId||x.name===t.linkedInspectionId)); insp && showJobPopup(insp); });
    $("[data-edit]",modal)?.addEventListener("click",()=>{ modal.remove(); editJob(t); });
    $("[data-nav]",modal)?.addEventListener("click",()=>{ const pt=t.coords?.[0]; if(!pt){alert("No coords");return;} openAppleMaps(pt[0],pt[1]); });
  }

  /* ---------- Batches ---------- */
  $("#newBatch")?.addEventListener("click",()=> openBatchCreateSheet());
  $("#batSearchBtn")?.addEventListener("click",renderBatches);
  $("#batResetBtn")?.addEventListener("click",()=>{ $("#batFrom").value=""; $("#batTo").value=""; $("#batQuery").value=""; renderBatches(); });

  function batchMatches(b, q, from, to){
    if (from && (b.date||"")<from) return false;
    if (to   && (b.date||"")>to)   return false;
    if (q){
      const hay = `${b.id} ${b.road||""} ${(b.chemicals||[]).map(c=>c.name).join(" ")}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }

  function renderBatches(){
    const list=$("#batchList"); if(!list) return; list.innerHTML="";
    const from=$("#batFrom").value||""; const to=$("#batTo").value||""; const q=$("#batQuery").value.trim();
    DB.batches.filter(b=>batchMatches(b,q,from,to))
      .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
      .forEach(b=>{
        const item=document.createElement("div"); item.className="item";
        item.innerHTML=`<b>${b.id}</b><br><small>${fmtDateAU(b.date)} • Total ${fmt(b.mixL)} L • Remaining ${fmt(b.remainingL)} L</small>
          <div class="row end mt"><button class="pill" data-open="${b.id}">Open</button></div>`;
        item.querySelector(`[data-open="${b.id}"]`).onclick=()=> showBatchPopup(b);
        list.appendChild(item);
      });
  } renderBatches();

  function showBatchPopup(b){
    const jobs=DB.tasks.filter(t=>t.batch===b.id);
    const jobsHtml= jobs.length ? `<ul>${jobs.map(t=>`<li><a href="#" data-open-job="${t.id}">${t.name}</a></li>`).join("")}</ul>` : "—";
    const html=`
      <div class="modal" id="batchView">
        <div class="card p">
          <div class="row spread"><h3>${b.id}</h3><button class="pill warn" data-close>Close</button></div>
          <div><b>Date:</b> ${fmtDateAU(b.date)} · <b>Time:</b> ${b.time||"–"}</div>
          <div><b>Total Mix Made:</b> ${fmt(b.mixL)} L</div>
          <div><b>Total Mix Remaining:</b> ${fmt(b.remainingL)} L</div>
          <div class="mt"><b>Chemicals (made of):</b>
            <ul>${(b.chemicals||[]).map(c=>`<li>${c.name} — ${c.per100.value}${c.per100.unit}/100L = ${fmt(c.total.value)} ${c.total.unit}</li>`).join("")||"—"}</ul>
          </div>
          <div class="mt"><b>Linked Jobs:</b><br>${jobsHtml}</div>
          <div class="row end mt">
            <button class="pill" data-edit-batch>Edit</button>
          </div>
        </div>
      </div>`;
    const wrap=document.createElement("div"); wrap.innerHTML=html; document.body.appendChild(wrap.firstChild);
    const modal=$("#batchView"); modal.onclick=e=>{ if(e.target===modal||e.target.dataset.close!=null) modal.remove(); };
    $$("[data-open-job]",modal).forEach(a=> a.addEventListener("click",(e)=>{ e.preventDefault(); const t=DB.tasks.find(x=> String(x.id)===a.dataset.openJob); t && showJobPopup(t); }));
    $("[data-edit-batch]",modal)?.addEventListener("click",()=>{ modal.remove(); openBatchEditModal(b.id); });
  }

  // Create/Edit batch sheet (single-page) — from previous message’s design
  function openBatchCreateSheet(){
    const id="B"+Date.now();
    const html=`
      <div class="modal" id="batchCreate">
        <div class="card p scrollable">
          <div class="row spread">
            <h3>Create Batch ${id}</h3>
            <button class="pill warn" data-close>Close</button>
          </div>
          <div class="grid two">
            <div>
              <label>Date</label><input type="date" id="bc_date" value="${todayISO()}">
            </div>
            <div>
              <label>Time</label><input type="time" id="bc_time" value="${nowTime()}">
            </div>
          </div>
          <div class="form-section">
            <div class="form-title">Total</div>
            <label>Total Mix (L)</label><input type="number" id="bc_mixL" min="0" value="0">
          </div>
          <div class="form-section" id="chemListArea">
            <div class="form-title">Chemicals</div>
          </div>
          <div class="row gap">
            <button id="addChemBtn" class="pill">Add Chemical</button>
          </div>
          <div class="row end mt">
            <button id="createBatchBtn" class="pill">Create Batch</button>
          </div>
        </div>
      </div>`;
    const wrap=document.createElement("div"); wrap.innerHTML=html; document.body.appendChild(wrap.firstChild);
    const modal=$("#batchCreate"); modal.onclick=e=>{ if(e.target===modal||e.target.dataset.close!=null) modal.remove(); };
    $("#addChemBtn").onclick=()=>addChemRow();
    $("#createBatchBtn").onclick=()=>saveNewBatch(id);
    addChemRow(); addChemRow();
    function addChemRow(){
      const row=document.createElement("div"); row.className="card mt";
      row.innerHTML=`
        <label>Chemical</label>
        <select class="bc_name">${(DB.chems||defaultChems()).map(c=>`<option value="${c.name}">${c.name}</option>`).join("")}</select>
        <div class="grid two">
          <div><label>Per 100 L</label><input type="number" class="bc_val" min="0" value="0"></div>
          <div>
            <label>Unit</label>
            <select class="bc_unit"><option>L</option><option>mL</option><option>g</option><option>kg</option></select>
          </div>
        </div>
        <button class="pill warn mt removeChem">Remove</button>`;
      $("#chemListArea").appendChild(row);
      row.querySelector(".removeChem").onclick=()=>row.remove();
    }
    function defaultChems(){
      return [
        {name:"Crucial"},{name:"SuperWet"},{name:"Bow Saw 600"},{name:"Clethodim"},
        {name:"Grazon"},{name:"Bosol"},{name:"Hastings"},{name:"Outright"}
      ];
    }
    function saveNewBatch(id){
      showSpinner("Creating batch…");
      const mixL=Number($("#bc_mixL").value)||0;
      const chems=[...$$("#chemListArea .card")].map(div=>{
        const name=div.querySelector(".bc_name").value;
        const val=Number(div.querySelector(".bc_val").value)||0;
        const unit=div.querySelector(".bc_unit").value;
        const total=val*mixL/100;
        return {name, per100:{value:val,unit}, total:{value:total,unit}};
      });
      const b={id,date:$("#bc_date").value,time:$("#bc_time").value,mixL,remainingL:mixL,usedL:0,chemicals:chems,linkedJobs:[],dumped:[]};
      DB.batches.push(b); saveDB(); hideSpinner(); flashOK("Batch created ✅");
      modal.remove(); renderBatches(); populateBatchSelect();
    }
  }

  function openBatchEditModal(id){
    const b=DB.batches.find(x=>x.id===id); if(!b) return;
    const html=`
      <div class="modal" id="batchEdit">
        <div class="card p scrollable">
          <div class="row spread"><h3>Edit ${b.id}</h3><button class="pill warn" data-close>Close</button></div>
          <label>Total Mix (L)</label><input type="number" id="be_mixL" value="${b.mixL||0}">
          <label>Remaining (L)</label><input type="number" id="be_rem" value="${b.remainingL||0}">
          <div class="mt"><b>Chemicals</b><ul>${b.chemicals.map(c=>`<li>${c.name} — ${c.per100.value}${c.per100.unit}/100L</li>`).join("")}</ul></div>
          <div class="row gap mt">
            <button id="dumpBtn" class="pill">Dump Remaining</button>
            <button id="saveEdit" class="pill">Save</button>
          </div>
        </div>
      </div>`;
    const wrap=document.createElement("div"); wrap.innerHTML=html; document.body.appendChild(wrap.firstChild);
    const modal=$("#batchEdit"); modal.onclick=e=>{ if(e.target===modal||e.target.dataset.close!=null) modal.remove(); };
    $("#dumpBtn").onclick=()=>{
      const amt=Number(prompt("Dump how many litres?","0"))||0;
      if(amt<=0 || amt>(b.remainingL||0)) return alert("Invalid amount");
      const reason=prompt("Reason for dump?","Leftover");
      b.remainingL-=amt; b.dumped=b.dumped||[]; b.dumped.push({date:todayISO(),time:nowTime(),amount:amt,reason});
      saveDB(); renderBatches(); flashOK("Batch updated");
    };
    $("#saveEdit").onclick=()=>{ b.mixL=Number($("#be_mixL").value)||b.mixL; b.remainingL=Number($("#be_rem").value)||b.remainingL; saveDB(); renderBatches(); modal.remove(); };
  }

  /* ---------- Mapping ---------- */
  // same filters as records
  $("#mapSearchBtn")?.addEventListener("click",()=>renderMap(true));
  $("#mapResetBtn")?.addEventListener("click",()=>{
    $("#mapFrom").value=""; $("#mapTo").value=""; $("#mapWeed").value=""; $("#mapType").value="All"; $("#mapQuery").value=""; renderMap(true);
  });

  let map, tile; function ensureMap(){
    if (map) return map;
    map = L.map("map").setView([-34.75,148.65], 10);
    tile=L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19});
    tile.addTo(map);
    // locate FAB (easier to tap, lifted)
    const fab=document.createElement("button");
    fab.className="locate-fab"; fab.textContent="Locate Me";
    $("#mapWrap").appendChild(fab);
    fab.onclick=()=>{
      if (!navigator.geolocation) return alert("Enable location");
      navigator.geolocation.getCurrentPosition(p=>{
        const pt=[p.coords.latitude,p.coords.longitude];
        map.setView(pt,14);
        L.circleMarker(pt,{radius:7,opacity:.9}).addTo(map).bindPopup("You are here").openPopup();
      });
    };
    return map;
  }

  function renderMap(fit=false){
    const m=ensureMap();
    // clear all vector layers
    m.eachLayer(l=>{ if (l!==tile) m.removeLayer(l); });

    const from=$("#mapFrom").value||""; const to=$("#mapTo").value||"";
    const typ=$("#mapType").value||"All";
    const weedQ=($("#mapWeed")?.value||"").trim().toLowerCase();
    const q=($("#mapQuery")?.value||"").trim().toLowerCase();

    const tasks=DB.tasks
      .filter(t=>!t.archived)
      .filter(t=>(!from||t.date>=from)&&(!to||t.date<=to))
      .filter(t=> typ==="All"?true:t.type===typ)
      .filter(t=> weedQ ? (String(t.weed||"").toLowerCase().includes(weedQ)) : true)
      .filter(t=> q ? (`${t.name} ${t.road||""} ${t.council||""}`.toLowerCase().includes(q)) : true);

    const group=L.featureGroup();

    tasks.forEach(t=>{
      if (t.coords?.length>1) group.addLayer(L.polyline(t.coords,{color:"#ffda44",weight:4,opacity:.9}));
      const pt=t.coords?.[0] || [-34.75 + Math.random()*0.08, 148.65 + Math.random()*0.08];
      const openId=`open_${t.id}`; const navId=`nav_${t.id}`;
      const popup = `<b>${t.name}</b><br>${t.type} • ${fmtDateAU(t.date)}
                     <br><button id="${openId}" class="pill mt">Open</button>
                     <button id="${navId}" class="pill mt">Navigate</button>`;
      const marker=L.marker(pt); marker.bindPopup(popup);
      marker.on("popupopen",()=>{
        setTimeout(()=>{
          const ob=document.getElementById(openId); const nb=document.getElementById(navId);
          ob && (ob.onclick=()=> showJobPopup(t));
          nb && (nb.onclick=()=> openAppleMaps(pt[0],pt[1]));
        },0);
      });
      group.addLayer(marker);
    });

    group.addTo(m);
    if (fit && tasks.length){ try{ m.fitBounds(group.getBounds().pad(0.2)); }catch{} }
    // show last track
    try{
      const last=JSON.parse(localStorage.getItem("lastTrack")||"[]");
      if (Array.isArray(last)&&last.length>1) L.polyline(last,{color:"#7bd389",weight:3,opacity:.8}).addTo(m);
    }catch{}
  }
  renderMap();

  function openAppleMaps(lat,lon){
    const mapsURL=`maps://?daddr=${lat},${lon}&dirflg=d`;
    const webURL =`https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
    const a=document.createElement("a"); a.href=mapsURL; document.body.appendChild(a); a.click();
    setTimeout(()=>{ window.open(webURL,"_blank"); a.remove(); },300);
  }

  /* ---------- Done ---------- */
  console.log("✅ WeedTracker V60 Pilot loaded");
});
