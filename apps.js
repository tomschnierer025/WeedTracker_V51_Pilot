/* === WeedTracker V60 Pilot — FULL apps.js (expanded) ===
 * What’s included (per your requests):
 * 1) AU date format (DD-MM-YYYY) everywhere + auto-name = RoadNameDDMMYYYY_<I/SS/RS>
 * 2) Noxious Weeds category pinned to top + “Other (type in Notes)”, includes Cape Broom
 * 3) Create Task order & fields; Start/Stop time only (no duplicates)
 * 4) Roadside tracking controls (only for Road Spray)
 * 5) Weather auto-fill (Open-Meteo) with “Updated @” time
 * 6) Batches:
 *    - Single modal (no chained mini-popups)
 *    - Total mix (L), timestamp auto set
 *    - Add chemicals from Inventory (name, per-100 value + unit L/mL/g/kg)
 *    - Auto compute “total chemical needed” for the batch
 *    - Deduct inventory on batch creation
 *    - Batch pop-up shows linked jobs, dump remaining with reason
 *    - Red border when remaining ≤ 0
 * 7) Jobs can use MULTIPLE batches with per-job used amount per batch
 *    - Records show the total L assigned to that job (not batch chem details)
 * 8) Apple Maps navigation from Records & Map pins
 * 9) Unified search bars across Records, Batches, Mapping, and Inventory:
 *    - Free-text “q” (name / road / weed / batch / chemical), Date From/To, Type (where relevant)
 *    - For Inventory: q filters by chemical name/active (dates ignored)
 * 10) Dark theme preserved (no pink/purple), emojis unchanged
 * 11) Home button wired and safe; splash/overlay won’t block taps
 */

document.addEventListener("DOMContentLoaded", () => {
  // ------------------------------------------
  // Mini helpers
  // ------------------------------------------
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const fmt = (n,d=0)=> (n==null||n==="")?"–":Number(n).toFixed(d);
  const todayISO = ()=> new Date().toISOString().split("T")[0];
  const nowTime  = ()=> new Date().toTimeString().slice(0,5);

  function formatDateAU(d){
    const dt = (d instanceof Date)? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2,"0");
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const yy = dt.getFullYear();
    return `${dd}-${mm}-${yy}`;
  }
  function formatDateAUCompact(d){
    const dt = (d instanceof Date)? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2,"0");
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const yy = dt.getFullYear();
    return `${dd}${mm}${yy}`;
  }

  // toast
  function toast(msg, ms=1600){
    const d=document.createElement("div");
    d.textContent=msg;
    Object.assign(d.style,{
      position:"fixed",bottom:"1.1rem",left:"50%",transform:"translateX(-50%)",
      background:"#d9f7d9",color:"#063",padding:".6rem 1rem",borderRadius:"20px",
      boxShadow:"0 2px 8px rgba(0,0,0,.25)",zIndex:9999,fontWeight:800
    });
    document.body.appendChild(d); setTimeout(()=>d.remove(),ms);
  }

  // spinner overlay from index
  const spinner = $("#spinner");
  const spin = (on,msg)=> {
    if (!spinner) return;
    if (on){ spinner.classList.add("active"); }
    else   { spinner.classList.remove("active"); }
  };

  // ------------------------------------------
  // Storage
  // ------------------------------------------
  const STORAGE_KEY = "weedtracker_data_v60_full";
  const BACKUP_KEY  = "weedtracker_backups_v60";
  const MAX_BACKUPS = 5;

  const NSW_WEEDS = [
    "🔺 Noxious Weeds (category)",
    "African Lovegrass (noxious)","Blackberry (noxious)","Serrated Tussock (noxious)",
    "Cape Broom (noxious)","Chilean Needle Grass (noxious)","St John’s Wort (noxious)",
    "Sweet Briar (noxious)","Gorse (noxious)","Lantana (noxious)",
    "Fleabane","Horehound","Saffron Thistle","Wild Radish","Fountain Grass",
    "Other (type in Notes)"
  ];

  const DEFAULT_CHEMS = [
    {name:"Crucial", active:"Glyphosate 540 g/L", containerSize:20, containerUnit:"L", containers:4, threshold:2},
    {name:"Superwet", active:"Non-ionic surfactant", containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Hastings", active:"MCPA", containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Outright", active:"Fluroxypyr", containerSize:20, containerUnit:"L", containers:1, threshold:1},
    {name:"Bosor", active:"Metsulfuron-methyl 600 g/kg", containerSize:500, containerUnit:"g", containers:2, threshold:1}
  ];

  function loadDB(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw){
        const seed = {version:60,tasks:[],batches:[],chems:DEFAULT_CHEMS.slice(),weeds:NSW_WEEDS.slice(),procurement:[],accountEmail:""};
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        return seed;
      }
      return JSON.parse(raw);
    }catch{ return {version:60,tasks:[],batches:[],chems:DEFAULT_CHEMS.slice(),weeds:NSW_WEEDS.slice(),procurement:[],accountEmail:""}; }
  }
  function saveDB(withBackup=true){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
    if (!withBackup) return;
    try{
      const arr = JSON.parse(localStorage.getItem(BACKUP_KEY)||"[]");
      arr.unshift({ts:new Date().toISOString(), db:DB});
      while (arr.length>MAX_BACKUPS) arr.pop();
      localStorage.setItem(BACKUP_KEY, JSON.stringify(arr));
    }catch{}
  }
  let DB = loadDB();

  // ------------------------------------------
  // Splash fade (avoid blocking)
  // ------------------------------------------
  const splash = $("#splash");
  if (splash){
    setTimeout(()=> splash.classList.add("fade"), 800);
    setTimeout(()=> splash.remove(), 1800);
  }

  // ------------------------------------------
  // Navigation
  // ------------------------------------------
  const screens = $$(".screen");
  function switchScreen(id){
    screens.forEach(s=> s.classList.remove("active"));
    $("#"+id)?.classList.add("active");
    if (id==="records")  renderRecords();
    if (id==="batches")  renderBatches();
    if (id==="inventory") renderChems();
    if (id==="mapping")  renderMap(true);
    if (id==="procurement") renderProcurement();
  }
  $$("[data-target]").forEach(b=> b.addEventListener("click", ()=> switchScreen(b.dataset.target)));
  $$(".home-btn").forEach(b=> b.addEventListener("click", ()=> switchScreen("home")));

  // ------------------------------------------
  // Unified search bar injector
  // (adds a consistent quick-search group if not present)
  // ------------------------------------------
  function ensureUnifiedSearch(whereId, opts={}){
    const wrap = $("#"+whereId+" .filters");
    if (!wrap) return;
    if (wrap.dataset.unified === "1") return;
    wrap.dataset.unified = "1";

    // Standard fields
    const html = document.createElement("div");
    html.className = "grid gap";
    html.innerHTML = `
      <label>Search (name / road / weed / batch / chemical)</label>
      <input id="${whereId}_q" placeholder="Type to search…" />
      <div class="grid two">
        <div>
          <label>Date From</label>
          <input type="date" id="${whereId}_from"/>
        </div>
        <div>
          <label>Date To</label>
          <input type="date" id="${whereId}_to"/>
        </div>
      </div>
      ${opts.includeType?`
        <div>
          <label>Type</label>
          <select id="${whereId}_type">
            <option value="All">All</option>
            <option value="Inspection">Inspection</option>
            <option value="Spot Spray">Spot Spray</option>
            <option value="Road Spray">Road Spray</option>
          </select>
        </div>
      `:""}
    `;
    wrap.prepend(html);

    // For Inventory, we ignore dates/type but keep the same look
    if (whereId==="inventory"){
      $("#inventory_from")?.parentElement?.style?.setProperty("display","none");
      $("#inventory_to")?.parentElement?.style?.setProperty("display","none");
    }
  }

  ensureUnifiedSearch("records",  {includeType:true});
  ensureUnifiedSearch("batches",  {includeType:false});
  ensureUnifiedSearch("mapping",  {includeType:true});
  ensureUnifiedSearch("inventory",{includeType:false});

  // ------------------------------------------
  // Settings
  // ------------------------------------------
  $("#saveAccount")?.addEventListener("click", ()=>{
    DB.accountEmail = ($("#accountEmail")?.value||"").trim();
    saveDB();
    toast("Saved");
  });

  $("#exportBtn")?.addEventListener("click", ()=>{
    const blob=new Blob([JSON.stringify(DB,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download="weedtracker_backup.json"; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 500);
  });

  $("#restoreBtn")?.addEventListener("click", ()=>{
    const backups = JSON.parse(localStorage.getItem(BACKUP_KEY)||"[]");
    if (!backups.length) { toast("No backup found"); return; }
    DB = backups[0].db;
    saveDB(false);
    renderRecords(); renderBatches(); renderChems(); renderMap(); renderProcurement();
    toast("Restored");
  });

  $("#clearBtn")?.addEventListener("click", ()=>{
    if (!confirm("Clear ALL local data?")) return;
    localStorage.removeItem(STORAGE_KEY);
    DB = loadDB();
    renderRecords(); renderBatches(); renderChems(); renderMap(); renderProcurement();
    toast("Cleared");
  });

  // ------------------------------------------
  // Create Task
  // ------------------------------------------
  // reminder 1..52
  const remSel=$("#reminderWeeks");
  if (remSel && !remSel.options.length){
    for (let i=1;i<=52;i++){ const o=document.createElement("option"); o.value=o.textContent=i; remSel.appendChild(o); }
  }

  // ensure date control has today
  const jobDateEl = $("#jobDate");
  if (jobDateEl && !jobDateEl.value) jobDateEl.value = todayISO();

  // weeds
  function populateWeeds(){
    const sel=$("#weedSelect"); if (!sel) return;
    sel.innerHTML="";
    DB.weeds = Array.isArray(DB.weeds)&&DB.weeds.length ? DB.weeds : NSW_WEEDS.slice();

    DB.weeds.forEach(w=>{
      const o=document.createElement("option");
      o.value = w;
      // mark noxious with ⚠
      o.textContent = /noxious/i.test(w) && !/Noxious Weeds \(category\)/i.test(w) ? ("⚠ "+w) : w;
      sel.appendChild(o);
    });

    // Ensure “🔺 Noxious Weeds (category)” pinned at top
    const first = sel.querySelector("option");
    if (first && first.value!=="🔺 Noxious Weeds (category)"){
      const cat = document.createElement("option");
      cat.value="🔺 Noxious Weeds (category)";
      cat.textContent="🔺 Noxious Weeds (category)";
      sel.insertBefore(cat, sel.firstChild);
    }
    // Ensure Cape Broom exists
    if (![...sel.options].some(o=>/Cape Broom/i.test(o.value))){
      const o=document.createElement("option"); o.value="Cape Broom (noxious)"; o.textContent="⚠ Cape Broom (noxious)";
      sel.appendChild(o);
    }
    // Ensure “Other (type in Notes)”
    if (![...sel.options].some(o=>/Other \(type in Notes\)/i.test(o.value))){
      const o=document.createElement("option"); o.value="Other (type in Notes)"; o.textContent="Other (type in Notes)";
      sel.appendChild(o);
    }
  }
  populateWeeds();

  // task type show/hide road tracking
  const taskTypeSel=$("#taskType");
  const roadTrackBlock=$("#roadTrackBlock");
  const syncTrackVis = ()=> roadTrackBlock.style.display = (taskTypeSel.value==="Road Spray")?"block":"none";
  taskTypeSel?.addEventListener("change", syncTrackVis);
  syncTrackVis();

  // locate + road name
  const locRoad=$("#locRoad");
  let currentRoadText = "";
  $("#locateBtn")?.addEventListener("click", ()=>{
    spin(true);
    if (!navigator.geolocation){ spin(false); toast("Enable location"); return; }
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{
        const {latitude, longitude} = pos.coords;
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
        const j = await r.json();
        currentRoadText = j.address?.road || j.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        localStorage.setItem("lastLat", latitude); localStorage.setItem("lastLon", longitude);
        locRoad.textContent = currentRoadText;
      }catch{
        locRoad.textContent = "Unknown";
      }
      spin(false);
    }, ()=>{ spin(false); toast("GPS failed"); });
  });

  // auto-name (RoadNameDDMMYYYY_<I/SS/RS>)
  const TYPE_PREFIX = { "Inspection":"I", "Spot Spray":"SS", "Road Spray":"RS" };
  $("#autoNameBtn")?.addEventListener("click", ()=>{
    const t = $("#taskType").value || "Inspection";
    const prefix = TYPE_PREFIX[t] || "I";
    const d = $("#jobDate").value ? new Date($("#jobDate").value) : new Date();
    const compact = formatDateAUCompact(d);
    const road = (currentRoadText||"Unknown").replace(/\s+/g,"");
    $("#jobName").value = `${road}${compact}_${prefix}`;
  });

  // weather
  $("#autoWeatherBtn")?.addEventListener("click", async ()=>{
    try{
      const lat = localStorage.getItem("lastLat");
      const lon = localStorage.getItem("lastLon");
      if (!lat || !lon){ toast("Get Location first"); return; }
      spin(true);
      const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;
      const r=await fetch(url); const j=await r.json(); const c=j.current||{};
      $("#temp").value     = c.temperature_2m ?? "";
      $("#wind").value     = c.wind_speed_10m ?? "";
      $("#windDir").value  = (c.wind_direction_10m ?? "") + (c.wind_direction_10m!=null?"°":"");
      $("#humidity").value = c.relative_humidity_2m ?? "";
      $("#wxUpdated").textContent = "Updated @ " + nowTime();
      spin(false);
      toast("Weather updated");
    }catch(e){
      spin(false);
      toast("Weather unavailable");
    }
  });

  // roadside tracking
  let trackTimer=null, trackCoords=[];
  $("#startTrack")?.addEventListener("click", ()=>{
    trackCoords=[]; $("#trackStatus").textContent="Tracking…";
    if (!navigator.geolocation){ toast("Enable location"); return; }
    trackTimer = setInterval(()=> {
      navigator.geolocation.getCurrentPosition(p=>{
        trackCoords.push([p.coords.latitude, p.coords.longitude]);
      });
    }, 5000);
  });
  $("#stopTrack")?.addEventListener("click", ()=>{
    if (trackTimer) clearInterval(trackTimer);
    $("#trackStatus").textContent = `Stopped (${trackCoords.length} pts)`;
    localStorage.setItem("lastTrack", JSON.stringify(trackCoords));
  });

  // photo
  let photoDataURL="";
  $("#photoInput")?.addEventListener("change",(e)=>{
    const f=e.target.files?.[0]; if(!f) return;
    const rd=new FileReader();
    rd.onload=()=>{ photoDataURL=String(rd.result||""); const img=$("#photoPreview"); img.src=photoDataURL; img.style.display="block"; };
    rd.readAsDataURL(f);
  });

  // MULTIPLE BATCHES PER JOB
  // We add a small “Add Batch Use” control alongside the existing batchSelect
  (function addMultiBatchControls(){
    const sel = $("#batchSelect"); if (!sel) return;
    // Wrap
    const wrap = document.createElement("div");
    wrap.className="row gap";
    sel.parentElement.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    const addBtn = document.createElement("button");
    addBtn.textContent = "+ Add Batch Use";
    addBtn.type="button";
    wrap.appendChild(addBtn);

    // visual list
    const ul = document.createElement("ul");
    ul.id="jobBatchUses";
    ul.style.listStyle="none"; ul.style.padding="0"; ul.style.margin=".4rem 0 0 0";
    sel.parentElement.appendChild(ul);

    // data holder for current form (not yet saved)
    let tempBatchUses = []; // [{id, amount}]
    addBtn.onclick = ()=>{
      const id = sel.value;
      if (!id){ toast("Select a batch first"); return; }
      const amt = Number(prompt("Amount used from this batch (L):", "0"))||0;
      if (amt<=0) { toast("Invalid amount"); return; }
      tempBatchUses.push({id, amount:amt});
      drawUses();
    };
    function drawUses(){
      ul.innerHTML="";
      tempBatchUses.forEach((u,idx)=>{
        const li=document.createElement("li");
        li.innerHTML = `<div class="row spread"><div>• ${u.id} — ${fmt(u.amount)} L</div>
                         <div class="row gap"><button data-e="${idx}">Edit</button><button class="warn" data-x="${idx}">Remove</button></div></div>`;
        ul.appendChild(li);
      });
      // bind
      $$("[data-x]", ul).forEach(b=> b.onclick = ()=>{ const i=Number(b.dataset.x); tempBatchUses.splice(i,1); drawUses(); });
      $$("[data-e]", ul).forEach(b=> b.onclick = ()=>{ const i=Number(b.dataset.e); const na=Number(prompt("New amount (L):", tempBatchUses[i].amount))||tempBatchUses[i].amount; tempBatchUses[i].amount=na; drawUses(); });
    }

    // Expose getter for saveTask
    sel.closest(".screen").__getTempBatchUses = ()=> tempBatchUses.slice();
    sel.closest(".screen").__clearTempBatchUses = ()=> { tempBatchUses = []; drawUses(); };
  })();

  // Save / Draft
  $("#saveTask")?.addEventListener("click", ()=> saveTask(false));
  $("#saveDraft")?.addEventListener("click", ()=> saveTask(true));

  function saveTask(isDraft){
    spin(true);
    const id=Date.now();
    const tType = $("#taskType").value || "Inspection";
    const obj={
      id,
      name: ($("#jobName").value||"").trim() || ("Task_"+id),
      council: ($("#councilNum").value||"").trim(),
      linkedInspectionId: ($("#linkInspectionId").value||"").trim(),
      type: tType,
      weed: $("#weedSelect").value || "",
      // MULTI batches: read from temp collector
      batches: $("#createTask").__getTempBatchUses ? $("#createTask").__getTempBatchUses() : [],
      date: $("#jobDate").value || todayISO(),
      start: $("#startTime").value || "",
      end:   $("#endTime").value   || "",
      temp: $("#temp").value||"", wind: $("#wind").value||"", windDir: $("#windDir").value||"", humidity: $("#humidity").value||"",
      reminder: $("#reminderWeeks").value || "",
      status: isDraft ? "Draft" : "Incomplete",
      notes: $("#notes").value||"",
      coords: trackCoords.slice(),
      photo: photoDataURL || "",
      createdAt:new Date().toISOString(), archived:false
    };

    // Upsert by name
    const existing = DB.tasks.find(x=> x.name===obj.name);
    if (existing) Object.assign(existing, obj); else DB.tasks.push(obj);

    // link + archive linked inspection if present
    if (obj.linkedInspectionId){
      const insp = DB.tasks.find(x=> x.type==="Inspection" && (String(x.id)===obj.linkedInspectionId || x.name===obj.linkedInspectionId));
      if (insp){ insp.archived=true; insp.status="Archived"; }
    }

    // deduct batch remaining per Job batch uses
    obj.batches.forEach(u=>{
      const b=DB.batches.find(x=>x.id===u.id);
      if (b){
        b.used   = (b.used||0) + Number(u.amount||0);
        b.remaining = Math.max(0, (Number(b.mix)||0) - (b.used||0));
      }
    });

    saveDB();
    $("#createTask").__clearTempBatchUses && $("#createTask").__clearTempBatchUses();
    renderRecords(); renderBatches(); renderMap(); toast(isDraft?"Draft saved":"Saved");
    spin(false);
  }

  // ------------------------------------------
  // Batches
  // ------------------------------------------
  $("#batSearchBtn")?.addEventListener("click", renderBatches);
  $("#batResetBtn")?.addEventListener("click", ()=>{
    $("#batches_q") && ($("#batches_q").value="");
    $("#batFrom").value=""; $("#batTo").value="";
    renderBatches();
  });

  // Single modal to create a batch
  $("#newBatch")?.addEventListener("click", openCreateBatchModal);

  function openCreateBatchModal(){
    const modal = document.createElement("div");
    modal.className="modal";
    // chemical rows will be appended here
    modal.innerHTML = `
      <div class="card p" style="max-width:680px;width:96%">
        <h3 style="margin-top:0">Create Batch</h3>
        <div class="grid two">
          <div><b>Date:</b> ${formatDateAU(new Date())}</div>
          <div><b>Time:</b> ${nowTime()}</div>
        </div>
        <div class="grid two" style="margin-top:.5rem">
          <div>
            <label>Total Mix (L)</label>
            <input id="cb_mix" type="number" min="0" step="1" value="200"/>
          </div>
          <div>
            <label>Batch ID</label>
            <input id="cb_id" placeholder="auto e.g. B1700000000000" />
          </div>
        </div>

        <div class="form-section" id="cb_chems">
          <div class="row spread">
            <div class="form-title">Chemicals in Batch</div>
            <button id="cb_addChem" class="pill">+ Add Chemical</button>
          </div>
          <div id="cb_rows"></div>
        </div>

        <div id="cb_totals" class="small dim"></div>

        <div class="row gap end">
          <button id="cb_save" class="pill">Create Batch</button>
          <button id="cb_cancel" class="pill warn">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const rows = $("#cb_rows", modal);
    const mixEl= $("#cb_mix", modal);
    const addChemBtn = $("#cb_addChem", modal);
    const totalsEl = $("#cb_totals", modal);

    const units = ["L","mL","g","kg"];

    function addRow(initial={}){
      const row = document.createElement("div");
      row.className="card";
      row.style.marginTop=".5rem";
      const chemOptions = DB.chems.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(c=>`<option value="${c.name}">${c.name}</option>`).join("");
      row.innerHTML = `
        <div class="grid four">
          <div>
            <label>Chemical (from Inventory)</label>
            <select class="cb_name">
              <option value="">— Select —</option>
              ${chemOptions}
            </select>
          </div>
          <div>
            <label>Per 100 L (value)</label>
            <input class="cb_per100" type="number" min="0" step="0.01" value="${initial.per100?.value??""}"/>
          </div>
          <div>
            <label>Unit</label>
            <select class="cb_unit">
              ${units.map(u=>`<option ${u===(initial.per100?.unit||"L")?"selected":""}>${u}</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Computed Total</label>
            <input class="cb_total" readonly placeholder="—"/>
          </div>
        </div>
        <div class="row end" style="margin-top:.3rem">
          <button class="pill warn cb_del">Remove</button>
        </div>
      `;
      rows.appendChild(row);
      // bindings
      row.querySelector(".cb_del").onclick = ()=>{ row.remove(); computeTotals(); };
      row.querySelector(".cb_name").value = initial.name||"";
      const onChange = ()=> computeTotals();
      row.querySelector(".cb_per100").oninput = onChange;
      row.querySelector(".cb_unit").onchange = onChange;
      computeTotals();
    }

    function computeTotals(){
      const totalMix = Number(mixEl.value)||0;
      let lines = [];
      rows.querySelectorAll(".card").forEach(card=>{
        const name = card.querySelector(".cb_name").value;
        const per  = Number(card.querySelector(".cb_per100").value)||0;
        const unit = card.querySelector(".cb_unit").value;
        if (!name || !per || !unit || !totalMix){
          card.querySelector(".cb_total").value = "";
          return;
        }
        // per-100 → total for "totalMix"
        // total_needed = per * (totalMix / 100)
        const total = per * (totalMix/100);
        card.querySelector(".cb_total").value = `${fmt(total,2)} ${unit}`;
        lines.push(`${name}: ${fmt(total,2)} ${unit}`);
      });
      totalsEl.textContent = lines.length ? ("Totals → "+ lines.join("   |   ")) : "";
    }

    addChemBtn.onclick = ()=> addRow();
    mixEl.oninput = ()=> computeTotals();

    $("#cb_cancel", modal).onclick = ()=> modal.remove();
    $("#cb_save", modal).onclick = ()=>{
      const id = ($("#cb_id", modal).value||"").trim() || ("B"+Date.now());
      const mix = Number(mixEl.value)||0;
      if (mix<=0){ toast("Enter total mix"); return; }

      // build chemicals array + deduct inventory
      const chems = [];
      rows.querySelectorAll(".card").forEach(card=>{
        const nm   = card.querySelector(".cb_name").value;
        const per  = Number(card.querySelector(".cb_per100").value)||0;
        const unit = card.querySelector(".cb_unit").value;
        const totalTxt = card.querySelector(".cb_total").value||"";
        if (!nm || !per || !unit || !totalTxt) return;

        // parse total number
        const totalVal = Number(totalTxt.split(" ")[0])||0;

        chems.push({
          name: nm,
          per100: {value:per, unit},
          total: {value: totalVal, unit}
        });

        // Deduct inventory in containers when possible
        const inv = DB.chems.find(c=>c.name===nm);
        if (inv && inv.containerSize>0){
          // convert totalVal into container units:
          // L stays L; mL → L (/1000); g stays g; kg → g (*1000)
          let neededInUnit = totalVal;
          if (unit==="mL") neededInUnit = totalVal/1000;   // to L
          if (unit==="kg") neededInUnit = totalVal*1000;   // to g

          // match by containerUnit
          let containersNeeded = 0;
          if (inv.containerUnit==="L"){
            // If in L, but total expressed in g → cannot convert (skip)
            if (unit==="L" || unit==="mL"){
              containersNeeded = neededInUnit / (inv.containerSize||1);
            }
          }else if (inv.containerUnit==="g"){
            if (unit==="g" || unit==="kg"){
              containersNeeded = neededInUnit / (inv.containerSize||1);
            }
          }else if (inv.containerUnit==="kg"){
            // normalize to kg
            let needKg = totalVal;
            if (unit==="g") needKg = totalVal/1000;
            else if (unit==="kg") needKg = totalVal;
            containersNeeded = needKg / (inv.containerSize||1);
          }else if (inv.containerUnit==="mL"){
            let needmL = totalVal;
            if (unit==="L") needmL = totalVal*1000;
            containersNeeded = needmL / (inv.containerSize||1);
          }

          if (containersNeeded>0){
            inv.containers = Math.max(0, (inv.containers||0) - containersNeeded);
          }
        }
      });

      DB.batches.push({
        id,
        date: todayISO(),
        time: nowTime(),
        mix,
        used: 0,
        remaining: mix,
        chemicals: chems,
        linkedJobs: [],
        dumped: []
      });
      saveDB();
      renderBatches(); renderChems(); renderProcurement();
      modal.remove();
      toast("Batch created");
    };
  }

  function renderBatches(){
    const list=$("#batchList"); if(!list) return;
    const q   = ($("#batches_q")?.value||"").trim().toLowerCase();
    const from= $("#batFrom")?.value||"";
    const to  = $("#batTo")?.value||"";
    list.innerHTML="";
    DB.batches
      .filter(b=> (!from||b.date>=from) && (!to||b.date<=to))
      .filter(b=>{
        if (!q) return true;
        const jobs = DB.tasks.filter(t=>Array.isArray(t.batches) && t.batches.some(x=>x.id===b.id));
        const hay = `${b.id} ${b.chemicals?.map(c=>c.name).join(" ")} ${jobs.map(j=>j.name).join(" ")}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
      .forEach(b=>{
        const item=document.createElement("div");
        item.className="item";
        if ((b.remaining||0)<=0){ item.style.border="2px solid #b00020"; } // red ring for consumed
        item.innerHTML=`<b>${b.id}</b><br>
          <small>${formatDateAU(b.date)} ${b.time||""} • Total ${fmt(b.mix)} L • Remaining ${fmt(b.remaining)} L</small>
          <div class="row end" style="margin-top:.35rem">
            <button class="pill" data-open>Open</button>
          </div>`;
        item.querySelector("[data-open]").onclick = ()=> showBatchPopup(b);
        list.appendChild(item);
      });
  }
  renderBatches();

  function showBatchPopup(b){
    const jobs = DB.tasks.filter(t=> Array.isArray(t.batches) && t.batches.some(x=>x.id===b.id));
    const jobsHtml = jobs.length ? `<ul>${jobs.map(j=>{
      const used = (j.batches.find(x=>x.id===b.id)?.amount)||0;
      return `<li><a href="#" data-open-job="${j.id}">${j.name}</a> — ${fmt(used)} L</li>`;
    }).join("")}</ul>` : "—";

    const chemsHtml = b.chemicals?.length
      ? `<ul>${b.chemicals.map(c=>`<li>${c.name} — ${c.per100.value}${c.per100.unit}/100L → total ${c.total.value}${c.total.unit}</li>`).join("")}</ul>`
      : "—";

    const dumpedHtml = b.dumped?.length
      ? `<ul>${b.dumped.map(d=>`<li>${formatDateAU(d.date)} ${d.time} — ${d.amount} L (${d.reason||"—"})</li>`).join("")}</ul>`
      : "—";

    const wrap=document.createElement("div");
    wrap.className="modal";
    wrap.innerHTML=`
      <div class="card p" style="max-width:720px;width:96%;${(b.remaining||0)<=0?'border:2px solid #b00020':''}">
        <div class="row spread">
          <h3 style="margin-top:0">${b.id}</h3>
          <button class="pill warn" data-close>Close</button>
        </div>
        <div class="grid two">
          <div><b>Date:</b> ${formatDateAU(b.date)} ${b.time||""}</div>
          <div><b>Total Mix:</b> ${fmt(b.mix)} L • <b>Remaining:</b> ${fmt(b.remaining)} L</div>
        </div>
        <div style="margin-top:.4rem"><b>Chemicals:</b><br>${chemsHtml}</div>
        <div style="margin-top:.4rem"><b>Linked Jobs:</b><br>${jobsHtml}</div>
        <div style="margin-top:.4rem"><b>Dumped:</b><br>${dumpedHtml}</div>
        <div class="row gap end" style="margin-top:.8rem;">
          <button class="pill" data-dump>Dump Remaining</button>
          <button class="pill" data-edit>Edit</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    // Close
    wrap.addEventListener("click",(e)=>{ if (e.target===wrap || e.target.dataset.close!=null) wrap.remove(); });
    document.addEventListener("keydown", escClose);
    function escClose(ev){ if(ev.key==="Escape"){ wrap.remove(); document.removeEventListener("keydown", escClose); } }

    // Open linked job
    $$("[data-open-job]", wrap).forEach(a=>{
      a.onclick = (ev)=> { ev.preventDefault(); const t=DB.tasks.find(x=> String(x.id)===a.dataset.openJob); t && showJobPopup(t); };
    });

    // Dump remaining
    $("[data-dump]", wrap).onclick = ()=>{
      const amt = Number(prompt("Dump how many litres?", b.remaining||0))||0;
      if (amt<=0 || amt>(b.remaining||0)){ toast("Invalid amount"); return; }
      const reason = prompt("Reason for dump?", "Expired / leftover")||"";
      b.remaining = Math.max(0, (b.remaining||0)-amt);
      b.dumped = b.dumped||[];
      b.dumped.push({date: todayISO(), time: nowTime(), amount: amt, reason});
      saveDB(); renderBatches();
      wrap.remove();
      toast("Batch updated");
    };

    // Edit basic numbers
    $("[data-edit]", wrap).onclick = ()=>{
      const mix=Number(prompt("Total mix (L):", b.mix))||b.mix;
      const rem=Number(prompt("Remaining (L):", b.remaining))||b.remaining;
      b.mix=mix; b.remaining=rem;
      saveDB(); renderBatches();
      wrap.remove();
    };
  }

  // ------------------------------------------
  // Inventory (with unified search)
  // ------------------------------------------
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
  $("#ce_cancel")?.addEventListener("click", ()=> { $("#chemEditSheet").style.display="none"; _chemEditing=null; });
  $("#ce_save")?.addEventListener("click", ()=>{
    if (!_chemEditing) return;
    _chemEditing.name = $("#ce_name").value.trim();
    _chemEditing.active = $("#ce_active").value.trim();
    _chemEditing.containerSize = Number($("#ce_size").value)||0;
    _chemEditing.containerUnit = $("#ce_unit").value||"L";
    _chemEditing.containers = Number($("#ce_count").value)||0;
    _chemEditing.threshold  = Number($("#ce_threshold").value)||0;
    saveDB(); renderChems(); renderProcurement(); $("#chemEditSheet").style.display="none"; _chemEditing=null;
    toast("Chemical updated");
  });

  function openChemEditor(c){
    _chemEditing=c;
    $("#ce_name").value=c.name||"";
    $("#ce_active").value=c.active||"";
    $("#ce_size").value=c.containerSize||0;
    $("#ce_unit").value=c.containerUnit||"L";
    $("#ce_count").value=c.containers||0;
    $("#ce_threshold").value=c.threshold||0;
    $("#chemEditSheet").style.display="block";
  }

  function renderChems(){
    const list=$("#chemList"); if(!list) return; list.innerHTML="";
    const q = ($("#inventory_q")?.value||"").trim().toLowerCase();
    DB.chems.slice()
      .filter(c=> !q ? true : (`${c.name} ${c.active}`.toLowerCase().includes(q)))
      .sort((a,b)=>a.name.localeCompare(b.name))
      .forEach(c=>{
        const total = (c.containers||0) * (c.containerSize||0);
        const line = `${fmt(c.containers,2)} × ${fmt(c.containerSize)} ${c.containerUnit} • total ${fmt(total)} ${c.containerUnit}`;
        const card=document.createElement("div"); card.className="item";
        card.innerHTML=`<b>${c.name}</b><br><small>${line}</small><br><small>Active: ${c.active || "—"}</small>
          <div class="row gap end" style="margin-top:.4rem;">
            <button class="pill" data-edit>Edit</button>
            <button class="pill warn" data-del>Delete</button>
          </div>`;
        if (c.threshold && c.containers < c.threshold){ card.style.border="2px dashed #b00020"; }
        card.querySelector("[data-edit]").onclick = ()=> openChemEditor(c);
        card.querySelector("[data-del]").onclick = ()=>{ if(!confirm("Delete chemical?")) return; DB.chems = DB.chems.filter(x=>x!==c); saveDB(); renderChems(); renderProcurement(); };
        list.appendChild(card);
      });
  }
  renderChems();

  function renderProcurement(){
    const ul=$("#procList"); if(!ul) return; ul.innerHTML="";
    DB.chems.forEach(c=>{
      if (c.threshold && (c.containers||0) < c.threshold){
        const li=document.createElement("li");
        li.textContent=`Low stock: ${c.name} (${fmt(c.containers)} < ${fmt(c.threshold)})`;
        ul.appendChild(li);
      }
    });
  }
  renderProcurement();

  // ------------------------------------------
  // Records
  // ------------------------------------------
  $("#recSearchBtn")?.addEventListener("click", renderRecords);
  $("#recResetBtn")?.addEventListener("click", ()=>{
    $("#records_q") && ($("#records_q").value="");
    $("#recFrom").value=""; $("#recTo").value="";
    ["fInspection","fSpot","fRoad","fComplete","fIncomplete","fDraft"].forEach(id=>{ const el=$("#"+id); if(el) el.checked=false;});
    renderRecords();
  });

  function recordMatches(t, q, from, to, types, statuses){
    if (t.archived) return false;
    if (from && (t.date||"")<from) return false;
    if (to   && (t.date||"")>to)   return false;

    // type
    const typeOK = (!types || (!types.inspection && !types.spot && !types.road))
      || (t.type==="Inspection" && types.inspection)
      || (t.type==="Spot Spray" && types.spot)
      || (t.type==="Road Spray" && types.road);
    if (!typeOK) return false;

    // status
    const s=t.status||"Incomplete";
    const statusesEmpty = !statuses || (!statuses.complete && !statuses.incomplete && !statuses.draft);
    const statusOK = statusesEmpty || (s==="Complete"&&statuses.complete) || (s==="Incomplete"&&statuses.incomplete) || (s==="Draft"&&statuses.draft);
    if (!statusOK) return false;

    // query
    if (q){
      const hay = `${t.name} ${t.weed} ${t.council} ${(t.batches||[]).map(b=>b.id).join(" ")}`
        .toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }

  function renderRecords(){
    const list=$("#recordsList"); if(!list) return; list.innerHTML="";
    const q   = ($("#records_q")?.value||$("#recSearch")?.value||"").trim();
    const from= $("#recFrom")?.value||"";
    const to  = $("#recTo")?.value||"";
    const types={inspection:$("#fInspection")?.checked, spot:$("#fSpot")?.checked, road:$("#fRoad")?.checked};
    const statuses={complete:$("#fComplete")?.checked, incomplete:$("#fIncomplete")?.checked, draft:$("#fDraft")?.checked};

    DB.tasks.filter(t=>recordMatches(t,q,from,to,types,statuses))
      .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
      .forEach(t=>{
        const item=document.createElement("div"); item.className="item";
        const dateAU = formatDateAU(t.date);
        const totalAssigned = (t.batches||[]).reduce((s,u)=> s + Number(u.amount||0), 0);
        item.innerHTML = `<b>${t.name}</b><br>
          <small>${t.type} • ${dateAU} • ${t.status} • Assigned: ${fmt(totalAssigned)} L</small>
          <div class="row end" style="margin-top:.35rem">
            <button class="pill" data-open>Open</button>
            ${t.coords && t.coords.length ? `<button class="pill" data-nav>Navigate</button>` : ""}
          </div>`;
        item.querySelector("[data-open]").onclick = ()=> showJobPopup(t);
        const nb = item.querySelector("[data-nav]");
        nb && (nb.onclick = ()=>{
          const pt=t.coords?.[0]; if(!pt){ toast("No coords"); return; }
          openAppleMaps(pt[0], pt[1]);
        });
        list.appendChild(item);
      });
  }
  renderRecords();

  function showJobPopup(t){
    const batchesHTML = (t.batches?.length)
      ? `<ul>${t.batches.map(u=>`<li>${u.id} — ${fmt(u.amount)} L</li>`).join("")}</ul>`
      : "—";
    const photoHtml = t.photo ? `<div style="margin:.4rem 0"><img src="${t.photo}" style="max-width:100%;border-radius:8px"/></div>` : "";

    const wrap=document.createElement("div");
    wrap.className="modal";
    wrap.innerHTML=`
      <div class="card p" style="max-width:720px;width:96%">
        <h3 style="margin-top:0">${t.name}</h3>
        <div class="grid two">
          <div><b>Type:</b> ${t.type}</div><div><b>Status:</b> ${t.status}</div>
          <div><b>Date:</b> ${formatDateAU(t.date)}</div>
          <div><b>Time:</b> ${t.start||"–"} — ${t.end||"–"}</div>
          <div><b>Weed:</b> ${t.weed||"—"}</div><div><b>Council #:</b> ${t.council||"—"}</div>
        </div>
        <div style="margin-top:.4rem"><b>Batches (L used):</b><br>${batchesHTML}</div>
        <div class="small dim" style="margin-top:.3rem"><b>Weather:</b> ${fmt(t.temp)}°C, ${fmt(t.wind)} km/h, ${t.windDir||"–"}, ${fmt(t.humidity)}%</div>
        <div style="margin-top:.3rem"><b>Notes:</b> ${t.notes||"—"}</div>
        ${photoHtml}
        <div class="row gap end" style="margin-top:.8rem;">
          ${t.coords?.length?`<button class="pill" data-nav>Navigate</button>`:""}
          <button class="pill" data-edit>Edit</button>
          <button class="pill warn" data-close>Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    const modal=wrap;

    modal.addEventListener("click",(e)=>{ if (e.target===modal || e.target.dataset.close!=null) modal.remove(); });
    document.addEventListener("keydown", escClose);
    function escClose(ev){ if(ev.key==="Escape"){ modal.remove(); document.removeEventListener("keydown", escClose); } }

    // edit -> load into Create Task
    $("[data-edit]", modal).onclick = ()=>{
      switchScreen("createTask");
      $("#jobName").value=t.name; $("#councilNum").value=t.council||""; $("#linkInspectionId").value=t.linkedInspectionId||"";
      $("#taskType").value=t.type; $("#taskType").dispatchEvent(new Event("change"));
      $("#weedSelect").value=t.weed||"";
      $("#jobDate").value=t.date||todayISO();
      $("#startTime").value=t.start||""; $("#endTime").value=t.end||"";
      $("#temp").value=t.temp||""; $("#wind").value=t.wind||""; $("#windDir").value=t.windDir||""; $("#humidity").value=t.humidity||"";
      $("#notes").value=t.notes||"";
      if (t.photo){ $("#photoPreview").src=t.photo; $("#photoPreview").style.display="block"; }

      // re-inject batches into the temp collector
      const sel = $("#batchSelect");
      const tempSetter = $("#createTask").__clearTempBatchUses && $("#createTask").__getTempBatchUses;
      if (tempSetter){
        $("#createTask").__clearTempBatchUses();
        (t.batches||[]).forEach(u=>{
          sel.value = u.id;
          // simulate “add” click programmatically
          const addBtn = sel.parentElement.nextElementSibling?.tagName==="UL"
            ? sel.parentElement.querySelector("button") : null;
          if (addBtn){
            // temporarily push directly (no prompt)
            const tempArrGetter = $("#createTask").__getTempBatchUses;
            const arr = tempArrGetter(); arr.push({id:u.id, amount:u.amount});
            $("#createTask").__clearTempBatchUses();
            // redraw
            const ul = $("#jobBatchUses");
            ul.innerHTML="";
            arr.forEach((x,idx)=>{
              const li=document.createElement("li");
              li.innerHTML=`<div class="row spread"><div>• ${x.id} — ${fmt(x.amount)} L</div>
                           <div class="row gap"><button data-e="${idx}">Edit</button>
                           <button class="warn" data-x="${idx}">Remove</button></div></div>`;
              ul.appendChild(li);
            });
            // rebind edit/remove live
            $$("[data-x]", ul).forEach(b=> b.onclick = ()=>{ const i=Number(b.dataset.x); arr.splice(i,1); // redraw
              ul.innerHTML="";
              arr.forEach((x2,ii)=>{
                const li2=document.createElement("li");
                li2.innerHTML=`<div class="row spread"><div>• ${x2.id} — ${fmt(x2.amount)} L</div>
                <div class="row gap"><button data-e="${ii}">Edit</button><button class="warn" data-x="${ii}">Remove</button></div></div>`;
                ul.appendChild(li2);
              });
            });
            $$("[data-e]", ul).forEach(b=> b.onclick = ()=>{ const i=Number(b.dataset.e);
              const na=Number(prompt("New amount (L):", arr[i].amount))||arr[i].amount; arr[i].amount=na;
              ul.innerHTML="";
              arr.forEach((x2,ii)=>{
                const li2=document.createElement("li");
                li2.innerHTML=`<div class="row spread"><div>• ${x2.id} — ${fmt(x2.amount)} L</div>
                <div class="row gap"><button data-e="${ii}">Edit</button><button class="warn" data-x="${ii}">Remove</button></div></div>`;
                ul.appendChild(li2);
              });
            });
            // override temp getters to use arr reference
            $("#createTask").__getTempBatchUses = ()=> arr.slice();
            $("#createTask").__clearTempBatchUses = ()=>{ arr.splice(0,arr.length); ul.innerHTML=""; };
          }
        });
      }
      modal.remove();
    };

    // navigate
    $("[data-nav]", modal)?.addEventListener("click", ()=>{
      const pt = t.coords?.[0]; if (!pt){ toast("No coords"); return; }
      openAppleMaps(pt[0], pt[1]);
    });
  }

  // ------------------------------------------
  // Mapping (Leaflet)
  // ------------------------------------------
  let map;
  function ensureMap(){
    if (map) return map;
    map = L.map("map").setView([-34.75,148.65], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);

    // simple locate control (top-right)
    const btn = L.control({position:"topright"});
    btn.onAdd = function(){
      const d=L.DomUtil.create("div","leaflet-bar");
      d.style.background="#146c2e"; d.style.color="#fff"; d.style.borderRadius="6px"; d.style.padding="6px 10px"; d.style.cursor="pointer";
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
    btn.addTo(map);

    return map;
  }

  $("#mapSearchBtn")?.addEventListener("click", ()=> renderMap(true));
  $("#mapResetBtn")?.addEventListener("click", ()=>{
    $("#mapping_q") && ($("#mapping_q").value="");
    $("#mapFrom").value=""; $("#mapTo").value=""; $("#mapWeed").value="";
    $("#mapType").value="All"; renderMap(true);
  });

  function openAppleMaps(lat, lon){
    const mapsURL = `maps://?daddr=${lat},${lon}&dirflg=d`;
    const webURL  = `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
    const a=document.createElement("a"); a.href=mapsURL; document.body.appendChild(a); a.click();
    setTimeout(()=>{ window.open(webURL,"_blank"); a.remove(); }, 300);
  }

  function renderMap(fit=false){
    const m=ensureMap();
    // remove overlays
    m.eachLayer(l=>{ if (!(l instanceof L.TileLayer)) m.removeLayer(l); });

    const q   = ($("#mapping_q")?.value||"").trim().toLowerCase();
    const from= $("#mapFrom")?.value||"";
    const to  = $("#mapTo")?.value||"";
    const typ = $("#mapType")?.value||"All";
    const weedQ= ($("#mapWeed")?.value||"").trim().toLowerCase();

    const tasks = DB.tasks
      .filter(t=>!t.archived)
      .filter(t=> (!from||t.date>=from) && (!to||t.date<=to))
      .filter(t=> typ==="All" ? true : (t.type===typ))
      .filter(t=>{
        if (weedQ && !(String(t.weed||"").toLowerCase().includes(weedQ))) return false;
        if (q){
          const hay = `${t.name} ${t.weed} ${t.council} ${(t.batches||[]).map(b=>b.id).join(" ")}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

    const group = L.featureGroup();
    tasks.forEach(t=>{
      if (t.coords?.length>1) group.addLayer(L.polyline(t.coords,{color:"#ffd54f",weight:4,opacity:.9}));
      const pt = t.coords?.[0] || [-34.75 + Math.random()*0.08, 148.65 + Math.random()*0.08];
      const openId = `open_${t.id}`;
      const navId  = `nav_${t.id}`;
      const popup = `<b>${t.name}</b><br>${t.type} • ${formatDateAU(t.date)}
                     <br><button id="${openId}" class="pill" style="margin-top:.35rem">Open</button>
                     <button id="${navId}" class="pill" style="margin-top:.35rem;margin-left:.4rem">Navigate</button>`;
      const mk = L.marker(pt); mk.bindPopup(popup);
      mk.on("popupopen", ()=>{
        setTimeout(()=>{
          $("#"+openId) && ($("#"+openId).onclick = ()=> showJobPopup(t));
          $("#"+navId)  && ($("#"+navId).onclick  = ()=> openAppleMaps(pt[0], pt[1]));
        },0);
      });
      group.addLayer(mk);
    });

    group.addTo(m);
    if (fit && tasks.length){
      try { m.fitBounds(group.getBounds().pad(0.2)); } catch {}
    }
    // show last tracked polyline if present
    try{
      const last = JSON.parse(localStorage.getItem("lastTrack")||"[]");
      if (Array.isArray(last) && last.length>1) L.polyline(last,{color:"#ffda44",weight:3,opacity:.8}).addTo(m);
    }catch{}
  }

  // initial renders
  renderMap();
});
