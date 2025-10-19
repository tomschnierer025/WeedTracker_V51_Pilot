/* === WeedTracker V60 Patch 1 — apps.js (Part A) ===
   Core logic: init, navigation, job creation, weather, weeds, batches.
*/

document.addEventListener("DOMContentLoaded", () => {

  // -------------------------------------------------
  // INITIAL SETUP
  // -------------------------------------------------
  hideSplash();
  let DB = ensureDB();
  const saveNow = () => saveDB(true);

  const screens = $$(".screen");
  function switchScreen(id) {
    screens.forEach(s => s.classList.remove("active"));
    $("#" + id)?.classList.add("active");
    if (id === "records") renderRecords();
    if (id === "batches") renderBatches();
    if (id === "inventory") renderChems();
    if (id === "mapping") renderMap(true);
  }
  $$("[data-target]").forEach(btn => btn.addEventListener("click", () => switchScreen(btn.dataset.target)));
  $$(".home-btn").forEach(b => b.addEventListener("click", e => { e.preventDefault(); switchScreen("home"); }));

  // -------------------------------------------------
  // SETTINGS
  // -------------------------------------------------
  const account = $("#accountEmail");
  if (account) account.value = DB.accountEmail || "";
  $("#saveAccount")?.addEventListener("click", () => {
    DB.accountEmail = account.value.trim();
    saveNow(); toast("Saved");
  });
  $("#exportBtn")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(DB, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "weedtracker_data.json"; a.click();
  });
  $("#restoreBtn")?.addEventListener("click", () => {
    const r = restoreLatest();
    if (r) { DB = r; renderRecords(); renderBatches(); renderChems(); renderMap(); toast("Restored"); }
    else toast("No backup found");
  });
  $("#clearBtn")?.addEventListener("click", () => {
    if (!confirm("Clear ALL data?")) return;
    localStorage.removeItem("weedtracker_data");
    DB = ensureDB(); renderRecords(); renderBatches(); renderChems(); renderMap();
  });

  // -------------------------------------------------
  // CREATE TASK
  // -------------------------------------------------
  const remSel = $("#reminderWeeks");
  if (remSel && !remSel.options.length) for (let i=1;i<=52;i++){
    const o=document.createElement("option"); o.value=o.textContent=i; remSel.appendChild(o);
  }

  const taskTypeSel = $("#taskType");
  const roadTrackBlock = $("#roadTrackBlock");
  const syncTrackVis = ()=> roadTrackBlock.style.display = (taskTypeSel.value==="Road Spray") ? "block" : "none";
  taskTypeSel?.addEventListener("change", syncTrackVis); syncTrackVis();

  // --- Location & Auto Name ---
  const locateBtn = $("#locateBtn");
  const locRoad = $("#locRoad");
  let currentRoad = "";
  locateBtn?.addEventListener("click", () => {
    setSpinner(true, "Locating…");
    if (!navigator.geolocation) { setSpinner(false); toast("Enable location"); return; }
    navigator.geolocation.getCurrentPosition(async pos => {
      const {latitude:lat, longitude:lon} = pos.coords;
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const j = await r.json();
        currentRoad = j.address?.road || j.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      } catch {
        currentRoad = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      }
      locRoad.textContent = currentRoad || "Unknown";
      setSpinner(false);
    }, () => { setSpinner(false); toast("GPS failed"); });
  });

  const TYPE_PREFIX = { "Inspection":"I", "Spot Spray":"SS", "Road Spray":"RS" };
  $("#autoNameBtn")?.addEventListener("click", () => {
    const t = $("#taskType").value || "Inspection";
    const prefix = TYPE_PREFIX[t] || "I";
    const dInput = $("#jobDate");
    const dt = dInput && dInput.value ? new Date(dInput.value) : new Date();
    const dateCompact = formatDateAUCompact(dt);
    const base = (currentRoad || "Unknown").replace(/\s+/g, "");
    $("#jobName").value = `${prefix}${dateCompact}_${base}`;
  });

  // --- Job Date default ---
  const jobDateEl = $("#jobDate");
  if (jobDateEl && !jobDateEl.value) jobDateEl.value = todayISO();

  // --- Weather auto fill ---
  $("#autoWeatherBtn")?.addEventListener("click", () => {
    if (!navigator.geolocation) { toast("Enable location"); return; }
    setSpinner(true, "Fetching weather…");
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const {latitude, longitude} = pos.coords;
        const url=`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;
        const r=await fetch(url); const j=await r.json(); const c=j.current||{};
        $("#temp").value     = c.temperature_2m ?? "";
        $("#wind").value     = c.wind_speed_10m ?? "";
        $("#windDir").value  = (c.wind_direction_10m ?? "") + (c.wind_direction_10m!=null?"°":"");
        $("#humidity").value = c.relative_humidity_2m ?? "";
        $("#wxUpdated").textContent = "Updated @ " + nowTime();
      } catch {
        toast("Weather unavailable");
      }
      setSpinner(false);
    }, ()=> { setSpinner(false); toast("Location not available"); });
  });

  // --- Weed selector (noxious pinned) ---
  function populateWeeds() {
    const sel = $("#weedSelect"); if (!sel) return;
    sel.innerHTML = "";
    const nox = DB.weeds.filter(w => /noxious/i.test(w)).sort((a,b)=>a.localeCompare(b));
    const rest = DB.weeds.filter(w => !/noxious/i.test(w)).sort((a,b)=>a.localeCompare(b));
    const all = ["— Select Weed —", ...nox, ...rest];
    all.forEach(w => {
      const o=document.createElement("option");
      o.value = (w==="— Select Weed —") ? "" : w;
      o.textContent = /noxious/i.test(w) ? ("⚠️ " + w) : w;
      if (/noxious/i.test(w) && w==="Noxious Weeds") o.style.color="red";
      sel.appendChild(o);
    });
  }
  populateWeeds();

  // --- Batch select dropdown ---
  function populateBatchSelect() {
    const sel=$("#batchSelect"); if (!sel) return;
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

  // --- Road tracking ---
  let tracking=false, trackTimer=null, trackCoords=[];
  $("#startTrack")?.addEventListener("click", () => {
    trackCoords=[]; tracking=true;
    $("#trackStatus").textContent="Tracking…";
    if (trackTimer) clearInterval(trackTimer);
    if (!navigator.geolocation) { toast("Enable location"); return; }
    trackTimer = setInterval(()=> navigator.geolocation.getCurrentPosition(p=> trackCoords.push([p.coords.latitude,p.coords.longitude])), 5000);
  });
  $("#stopTrack")?.addEventListener("click", () => {
    tracking=false; if (trackTimer) clearInterval(trackTimer);
    $("#trackStatus").textContent=`Stopped (${trackCoords.length} pts)`;
    localStorage.setItem("lastTrack", JSON.stringify(trackCoords));
  });

  // --- Photo Upload ---
  let photoDataURL="";
  $("#photoInput")?.addEventListener("change", (e)=>{
    const f=e.target.files?.[0]; if(!f) return;
    const reader=new FileReader();
    reader.onload=()=>{ photoDataURL=String(reader.result||""); const img=$("#photoPreview"); img.src=photoDataURL; img.style.display="block"; };
    reader.readAsDataURL(f);
  });

  // --- Save Task ---
  $("#saveTask")?.addEventListener("click", ()=> saveTask(false));
  $("#saveDraft")?.addEventListener("click", ()=> saveTask(true));

  function saveTask(isDraft){
    setSpinner(true, "Saving task…");
    const id = Date.now();
    const status = isDraft ? "Draft" : ($("#completeBtn")?.checked ? "Complete" : "Incomplete");
    const obj = {
      id,
      name: $("#jobName").value.trim() || ("Task_"+id),
      council: $("#councilNum").value.trim(),
      linkedInspectionId: $("#linkInspectionId").value.trim(),
      type: $("#taskType").value,
      weed: $("#weedSelect").value,
      batch: $("#batchSelect").value,
      date: $("#jobDate").value || todayISO(),
      start: $("#startTime").value || "",
      end: $("#endTime").value || "",
      temp: $("#temp").value, wind: $("#wind").value,
      windDir: $("#windDir").value, humidity: $("#humidity").value,
      reminder: $("#reminderWeeks").value || "",
      status, notes: $("#notes").value || "",
      coords: trackCoords.slice(), photo: photoDataURL || "",
      createdAt: new Date().toISOString(), archived: false
    };

    const existing = DB.tasks.find(t=>t.name===obj.name);
    if (existing) Object.assign(existing, obj); else DB.tasks.push(obj);

    if (obj.batch) {
      const b = DB.batches.find(x=>x.id===obj.batch);
      if (b) {
        const used = (obj.type==="Road Spray" && obj.coords?.length>1) ? 100 : 0;
        b.used = (b.used||0) + used;
        b.remaining = Math.max(0, (Number(b.mix)||0) - (b.used||0));
      }
    }

    saveNow(); populateBatchSelect(); renderRecords(); renderMap();
    setSpinner(false, "Saved");
    toast("Task saved ✅");
  }

  // --- New Batch creation ---
  $("#newBatch")?.addEventListener("click", ()=>{
    const id = "B" + Date.now();
    const mix = Number(prompt("Total mix (L):","600")) || 0;
    const chems = prompt("Chemicals (e.g. 'Crucial 1.5L/100L, Wetter 300mL/100L')","") || "";
    const obj = { id, date: todayISO(), time: nowTime(), mix, remaining: mix, used: 0, chemicals: chems };
    DB.batches.push(obj);
    saveNow(); populateBatchSelect(); renderBatches();
    toast("Batch created ✅");
  });

/* === WeedTracker V60 Patch 1 — apps.js (Part B) ===
   Records + Batches popups | Inventory | Map | Apple Maps navigation
*/

// -------------------------------------------------
// RECORDS FILTER & RENDER
// -------------------------------------------------
function recordMatches(t,q,from,to,types,statuses){
  if(t.archived)return false;
  if(from&&(t.date||"")<from)return false;
  if(to&&(t.date||"")>to)return false;
  if(q){
    const hay=`${t.name} ${t.weed} ${t.council}`.toLowerCase();
    if(!hay.includes(q.toLowerCase()))return false;
  }
  const typeOK = (!types.inspection&&!types.spot&&!types.road)||
    (t.type==="Inspection"&&types.inspection)||
    (t.type==="Spot Spray"&&types.spot)||
    (t.type==="Road Spray"&&types.road);
  if(!typeOK)return false;

  const s=t.status||"Incomplete";
  const statusesEmpty=!statuses.complete&&!statuses.incomplete&&!statuses.draft;
  const statusOK=statusesEmpty||
    (s==="Complete"&&statuses.complete)||
    (s==="Incomplete"&&statuses.incomplete)||
    (s==="Draft"&&statuses.draft);
  return statusOK;
}

function renderRecords(){
  const list=$("#recordsList");if(!list)return;list.innerHTML="";
  const q=$("#recSearch").value.trim();
  const from=$("#recFrom").value;const to=$("#recTo").value;
  const types={inspection:$("#fInspection").checked,spot:$("#fSpot").checked,road:$("#fRoad").checked};
  const statuses={complete:$("#fComplete").checked,incomplete:$("#fIncomplete").checked,draft:$("#fDraft").checked};

  DB.tasks.filter(t=>recordMatches(t,q,from,to,types,statuses))
  .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
  .forEach(t=>{
    const d=document.createElement("div");d.className="item";
    const dateAU=formatDateAU(t.date);
    d.innerHTML=`<b>${t.name}</b><br><small>${t.type} • ${dateAU} • ${t.status}</small>
      <div class="row end">
        <button class="pill" data-open="${t.id}">Open</button>
        ${t.coords&&t.coords.length?`<button class="pill" data-nav="${t.id}">Navigate</button>`:""}
      </div>`;
    d.querySelector("[data-open]")?.addEventListener("click",()=>showJobPopup(t));
    const navBtn=d.querySelector("[data-nav]");
    if(navBtn){
      navBtn.addEventListener("click",()=>{
        const pt=t.coords?.[0];
        if(!pt){toast("No coords saved");return;}
        openAppleMaps(pt[0],pt[1]);
      });
    }
    list.appendChild(d);
  });
}
renderRecords();

// -------------------------------------------------
// BATCH LIST + POPUP
// -------------------------------------------------
function renderBatches(){
  const list=$("#batchList");if(!list)return;list.innerHTML="";
  const from=$("#batFrom").value||"";const to=$("#batTo").value||"";
  DB.batches
  .filter(b=>(!from||b.date>=from)&&(!to||b.date<=to))
  .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
  .forEach(b=>{
    const item=document.createElement("div");item.className="item";
    item.innerHTML=`<b>${b.id}</b><br><small>${formatDateAU(b.date)} • Total ${fmt(b.mix)} L • Remaining ${fmt(b.remaining)} L</small>
      <div class="row end"><button class="pill" data-open="${b.id}">Open</button></div>`;
    item.querySelector("[data-open]")?.addEventListener("click",()=>showBatchPopup(b));
    list.appendChild(item);
  });
}
renderBatches();

function showBatchPopup(b){
  const jobs=DB.tasks.filter(t=>t.batch===b.id);
  const jobsHtml=jobs.length?`<ul>${jobs.map(t=>`<li><a href="#" data-open-job="${t.id}">${t.name}</a></li>`).join("")}</ul>`:"—";
  const html=`
  <div class="modal">
    <div class="card p">
      <h3 style="margin-top:0">${b.id}</h3>
      <div><b>Date:</b> ${formatDateAU(b.date)} · <b>Time:</b> ${b.time||"–"}</div>
      <div><b>Total Mix Made:</b> ${fmt(b.mix)} L</div>
      <div><b>Total Remaining:</b> ${fmt(b.remaining)} L</div>
      <div style="margin-top:.4rem;"><b>Chemicals:</b><br>${b.chemicals||"—"}</div>
      <div style="margin-top:.4rem;"><b>Linked Jobs:</b><br>${jobsHtml}</div>
      <div class="row gap end" style="margin-top:.8rem;">
        <button class="pill" data-edit-batch>Edit</button>
        <button class="pill warn" data-close>Close</button>
      </div>
    </div>
  </div>`;
  const wrap=document.createElement("div");wrap.innerHTML=html;
  document.body.appendChild(wrap.firstChild);
  const modal=$(".modal");
  modal?.addEventListener("click",(e)=>{if(e.target===modal||e.target.dataset.close!=null)modal.remove();});
  $$("[data-open-job]",modal).forEach(a=>a.addEventListener("click",(e)=>{e.preventDefault();const t=DB.tasks.find(x=>String(x.id)===a.dataset.openJob);t&&showJobPopup(t);})); 
  $("[data-edit-batch]",modal)?.addEventListener("click",()=>{
    const mix=Number(prompt("Total mix (L):",b.mix))||b.mix;
    const rem=Number(prompt("Remaining (L):",b.remaining))||b.remaining;
    const chems=prompt("Chemicals:",b.chemicals||"")||b.chemicals||"";
    b.mix=mix;b.remaining=rem;b.chemicals=chems;b.time ||= nowTime();
    saveDB();modal.remove();renderBatches();toast("Batch updated ✅");
  });
}

// -------------------------------------------------
// INVENTORY LIST (EDIT + DELETE)
// -------------------------------------------------
function renderChems(){
  const list=$("#chemList");if(!list)return;list.innerHTML="";
  DB.chems.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach(c=>{
    const total=(c.containers||0)*(c.containerSize||0);
    const line=`${c.containers} × ${fmt(c.containerSize)} ${c.containerUnit} • total ${fmt(total)} ${c.containerUnit}`;
    const card=document.createElement("div");card.className="item";
    card.innerHTML=`<b>${c.name}</b><br><small>${line}</small><br><small>Active: ${c.active||"—"}</small>
      <div class="row gap end" style="margin-top:.4rem;">
        <button class="pill" data-edit>Edit</button>
        <button class="pill warn" data-del>Delete</button>
      </div>`;
    card.querySelector("[data-edit]")?.addEventListener("click",()=>openChemEditor(c));
    card.querySelector("[data-del]")?.addEventListener("click",()=>{
      if(!confirm("Delete chemical?"))return;
      DB.chems=DB.chems.filter(x=>x!==c);saveDB();renderChems();
    });
    list.appendChild(card);
  });
}
renderChems();

function openChemEditor(c){
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
    saveDB();renderChems();$("#chemEditSheet").style.display="none";toast("Updated ✅");
  };
  $("#ce_cancel").onclick=()=>$("#chemEditSheet").style.display="none";
}

// -------------------------------------------------
// MAP & CLICKABLE PINS
// -------------------------------------------------
let map;
function ensureMap(){
  if(map)return map;
  map=L.map("map").setView([-34.75,148.65],10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);
  // locate me
  const ctrl=L.control({position:"bottomright"});
  ctrl.onAdd=function(){
    const d=L.DomUtil.create("div","leaflet-bar");
    d.style.background="#127f32";d.style.color="#fff";d.style.borderRadius="6px";
    d.style.padding="6px 10px";d.style.cursor="pointer";d.innerText="Locate Me";
    d.onclick=()=>{
      if(!navigator.geolocation){toast("Enable location");return;}
      navigator.geolocation.getCurrentPosition(p=>{
        const pt=[p.coords.latitude,p.coords.longitude];
        map.setView(pt,14);
        L.circleMarker(pt,{radius:7,opacity:.9}).addTo(map).bindPopup("You are here").openPopup();
      });
    };
    return d;
  };
  ctrl.addTo(map);
  return map;
}

function renderMap(fit=false){
  const m=ensureMap();
  m.eachLayer(l=>{if(!(l instanceof L.TileLayer))m.removeLayer(l);});
  const tasks=DB.tasks.filter(t=>!t.archived);
  const group=L.featureGroup();
  tasks.forEach(t=>{
    if(t.coords?.length>1)group.addLayer(L.polyline(t.coords,{color:"yellow",weight:4,opacity:.9}));
    const pt=t.coords?.[0]||[-34.75+Math.random()*0.08,148.65+Math.random()*0.08];
    const thumb=t.photo?`<br><img src="${t.photo}" style="max-width:180px;border-radius:6px;margin-top:.3rem">`:"";
    const openId=`open_${t.id}`,navId=`nav_${t.id}`;
    const popup=`<b>${t.name}</b><br>${t.type} • ${formatDateAU(t.date)}${thumb}
      <br><button id="${openId}" class="pill" style="margin-top:.35rem">Open</button>
      <button id="${navId}" class="pill" style="margin-top:.35rem;margin-left:.4rem">Navigate</button>`;
    const marker=L.marker(pt);marker.bindPopup(popup);
    marker.on("popupopen",()=>{
      setTimeout(()=>{
        const ob=document.getElementById(openId);
        const nb=document.getElementById(navId);
        ob&&(ob.onclick=()=>showJobPopup(t));
        nb&&(nb.onclick=()=>openAppleMaps(pt[0],pt[1]));
      },0);
    });
    group.addLayer(marker);
  });
  group.addTo(m);
  if(fit&&tasks.length){try{m.fitBounds(group.getBounds().pad(0.2));}catch{}}
}
renderMap(true);

// -------------------------------------------------
// JOB POPUP
// -------------------------------------------------
function showJobPopup(t){
  const batchLink=t.batch?`<a href="#" data-open-batch="${t.batch}">${t.batch}</a>`:"—";
  const photoHtml=t.photo?`<div style="margin:.4rem 0"><img src="${t.photo}" style="max-width:100%;border-radius:8px"/></div>`:"";
  const html=`
  <div class="modal">
    <div class="card p">
      <h3 style="margin-top:0">${t.name}</h3>
      <div><b>Type:</b> ${t.type} · <b>Status:</b> ${t.status}</div>
      <div><b>Date:</b> ${formatDateAU(t.date)} · <b>Start:</b> ${t.start||"–"} · <b>Finish:</b> ${t.end||"–"}</div>
      <div><b>Weed:</b> ${t.weed||"—"} · <b>Batch:</b> ${batchLink}</div>
      <div><b>Weather:</b> ${fmt(t.temp)}°C, ${fmt(t.wind)} km/h, ${t.windDir||"–"}, ${fmt(t.humidity)}%</div>
      <div><b>Notes:</b> ${t.notes||"—"}</div>
      ${photoHtml}
      <div class="row gap end" style="margin-top:.8rem;">
        <button class="pill" data-edit>Edit</button>
        ${t.coords?.length?`<button class="pill" data-nav>Navigate</button>`:""}
        <button class="pill warn" data-close>Close</button>
      </div>
    </div>
  </div>`;
  const wrap=document.createElement("div");wrap.innerHTML=html;
  document.body.appendChild(wrap.firstChild);
  const modal=$(".modal");
  modal?.addEventListener("click",(e)=>{if(e.target===modal||e.target.dataset.close!=null)modal.remove();});
  $("[data-open-batch]",modal)?.addEventListener("click",(e)=>{e.preventDefault();const b=DB.batches.find(x=>x.id===t.batch);b&&showBatchPopup(b);});
  $("[data-edit]",modal)?.addEventListener("click",()=>{
    switchScreen("createTask");
    $("#jobName").value=t.name;$("#councilNum").value=t.council||"";$("#linkInspectionId").value=t.linkedInspectionId||"";
    $("#taskType").value=t.type;$("#taskType").dispatchEvent(new Event("change"));
    $("#weedSelect").value=t.weed||"";$("#batchSelect").value=t.batch||"";
    $("#jobDate").value=t.date||todayISO();$("#startTime").value=t.start||"";$("#endTime").value=t.end||"";
    $("#temp").value=t.temp||"";$("#wind").value=t.wind||"";$("#windDir").value=t.windDir||"";$("#humidity").value=t.humidity||"";
    $("#notes").value=t.notes||"";if(t.photo){$("#photoPreview").src=t.photo;$("#photoPreview").style.display="block";}
    modal.remove();
  });
  $("[data-nav]",modal)?.addEventListener("click",()=>{
    const pt=t.coords?.[0];if(!pt){toast("No coords saved");return;}openAppleMaps(pt[0],pt[1]);
  });
}
});
