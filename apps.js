/* V55 — core app: nav, create, records, batches, inventory, map, reminders, tracking */

const qs=s=>document.querySelector(s), qsa=s=>[...document.querySelectorAll(s)];
function showPage(id){ qsa(".page").forEach(p=>p.classList.remove("active")); qs("#"+id).classList.add("active");
  if(id==="records") renderRecords(); if(id==="inventory") renderChemInventory();
  if(id==="batches") renderBatches(); if(id==="procurement") renderProcurement();
  if(id==="map"){ ensureMap(); renderMap(); } if(id==="reminders") renderReminders();
}

/* ---------- Boot & Nav ---------- */
document.addEventListener("DOMContentLoaded",()=>{
  setTimeout(()=>qs("#splash-screen").style.display="none",2400);

  qs("#btnCreateTask").onclick = ()=>showPage("createTask");
  qs("#btnRecords").onclick    = ()=>showPage("records");
  qs("#btnInventory").onclick  = ()=>showPage("inventory");
  qs("#btnBatches").onclick    = ()=>showPage("batches");
  qs("#btnProcurement").onclick= ()=>showPage("procurement");
  qs("#btnMapping").onclick    = ()=>showPage("map");
  qs("#btnReminders").onclick  = ()=>showPage("reminders");
  qs("#btnSettings").onclick   = ()=>showPage("settings");

  // Create Task
  qs("#btnLocate").onclick     = onLocate;
  qs("#btnAutoName").onclick   = autoName;
  qs("#btnWeather").onclick    = onWeather;
  qs("#btnNewBatch").onclick   = openCreateBatch;
  qs("#btnSaveJob").onclick    = ()=>saveJob(false);
  qs("#btnSaveDraft").onclick  = ()=>saveJob(true);

  // Records
  qs("#btnRecordsFilter").onclick = renderRecords;

  // Batches
  qs("#btnBatchFilter").onclick = renderBatches;
  qs("#btnCreateBatch").onclick = openCreateBatch;

  // Map
  qs("#btnMapFilter").onclick = renderMap;
  qs("#btnLocateMe").onclick  = locateUser;

  // Settings
  qs("#btnClearData").onclick = ()=>clearAllData(true);
  qs("#btnExportJSON").onclick= exportJSON;
  qs("#btnExportCSV").onclick = exportCSV;

  // Populate selects
  refreshWeeds(); refreshBatchSelect();
});

/* ---------- Helpers ---------- */
function onLocate(){
  getGPS(c=>{
    qs("#gpsPreview").textContent=`GPS: ${c.lat}, ${c.lng}`;
    qs("#gpsPreview").dataset.lat=c.lat; qs("#gpsPreview").dataset.lng=c.lng;
    // If no location name, try to use coordinates as fallback label
    const loc=qs("#locationInput").value.trim();
    if(!loc) qs("#locationInput").value = `${c.lat}, ${c.lng}`;
  });
}
async function onWeather(){
  const lat=+qs("#gpsPreview").dataset.lat||-34.75;
  const lng=+qs("#gpsPreview").dataset.lng||148.65;
  const w=await fetchWeather(lat,lng);
  qs("#wTemp").textContent = `${w.temp}°C`;
  qs("#wWind").textContent = `${w.wind} km/h`;
  qs("#wDir").textContent  = `${toCompass(+w.dir)} (${w.dir}°)`;
  qs("#wHum").textContent  = `${w.hum}%`;
  qs("#wTemp").dataset.w = JSON.stringify(w);
}
function jobLetter(type){ return type==="Inspection"?"I":type==="SpotSpray"?"S":"R"; }
function autoName(){
  const type=qs("#jobType").value;
  const letter=jobLetter(type);
  const d=qs("#jobDate").value || new Date().toISOString().slice(0,10);
  const yyyymmdd=d.replaceAll("-","");
  let road = (qs("#locationInput").value||"Location").replace(/\s+/g,"");
  road = road.replace(/[^A-Za-z0-9]/g,""); // alnum only
  const name = `${letter}${yyyymmdd}_${road||"Site"}`;
  qs("#jobNamePreview").textContent=`Name: ${name}`;
  qs("#jobNamePreview").dataset.name=name;
}
function refreshWeeds(){
  const weeds=load(STORAGE_KEYS.weeds), sel=qs("#weedSelect");
  sel.innerHTML=""; weeds.forEach(w=>{const o=document.createElement("option");o.value=w.name;o.textContent=w.name;sel.appendChild(o);});
}
function refreshBatchSelect(){
  const list=load(STORAGE_KEYS.batches), sel=qs("#batchSelect");
  sel.innerHTML="<option value=''>— None —</option>";
  list.forEach(b=>{const o=document.createElement("option");o.value=b.id;o.textContent=`${b.id} • ${b.totalMade}L • Rem ${b.remaining}L`; sel.appendChild(o);});
}

/* ---------- Save Job ---------- */
function saveJob(isDraft){
  const type=qs("#jobType").value;
  const name=qs("#jobNamePreview").dataset.name || "Untitled";
  const weed=qs("#weedSelect").value||"";
  const batchId=qs("#batchSelect").value||"";
  const notes=qs("#jobNotes").value||"";
  const date=qs("#jobDate").value || new Date().toISOString().slice(0,10);
  const start=qs("#startTime").value||"";
  const stop =qs("#stopTime").value||"";
  const lat=+(qs("#gpsPreview").dataset.lat||0);
  const lng=+(qs("#gpsPreview").dataset.lng||0);
  const w=JSON.parse(qs("#wTemp").dataset.w||"{}");
  const status=[...document.querySelectorAll("input[name='status']")].find(r=>r.checked)?.value || "Incomplete";
  const linkId=qs("#linkJobId").value.trim();

  const job={ id:genID("JOB"), name, type, weed, batchId, notes, date, start, stop, lat, lng, weather:w, status, linkedJobs:[] };

  const jobs=load(STORAGE_KEYS.jobs); jobs.push(job); save(STORAGE_KEYS.jobs,jobs);

  // Link if provided
  if(linkId){
    const all=load(STORAGE_KEYS.jobs);
    const other=all.find(j=>j.id===linkId);
    if(other){ other.linkedJobs=other.linkedJobs||[]; other.linkedJobs.push(job.id); job.linkedJobs.push(other.id); save(STORAGE_KEYS.jobs,all); }
  }

  // Reminder
  const weeks=+qs("#reminderWeeks").value||0;
  if(weeks>0){ const due=new Date(date||new Date()); due.setDate(due.getDate()+7*weeks);
    addReminder({id:genID("REM"),task:name,date:due.toISOString(),alerted:false}); }

  alert(isDraft?"Draft saved.":"Job saved.");
  showPage("records");
}

/* ---------- Roadside tracking ---------- */
let tracking=false, trackStart=null, trackData=[];
qs("#jobType").addEventListener("change",()=>{
  qs("#roadTracking").style.display = qs("#jobType").value==="Roadside" ? "flex":"none";
});
qs("#btnStartTrack").addEventListener("click",()=>{
  tracking=true; trackData=[]; trackStart=Date.now();
  qs("#btnStartTrack").disabled=true; qs("#btnStopTrack").disabled=false;
  getGPS(c=>{trackData.push({t:Date.now(),...c}); qs("#trackInfo").textContent=`Started at ${c.lat}, ${c.lng}`;});
});
qs("#btnStopTrack").addEventListener("click",()=>{
  if(!tracking) return;
  getGPS(c=>{ trackData.push({t:Date.now(),...c});
    const elap=((Date.now()-trackStart)/60000).toFixed(1);
    qs("#trackInfo").textContent=`Stopped. Points: ${trackData.length} • ${elap} min`;
    tracking=false; qs("#btnStartTrack").disabled=false; qs("#btnStopTrack").disabled=true;
    const tracks=load(STORAGE_KEYS.tracks); tracks.push({id:genID("TRK"), points:trackData}); save(STORAGE_KEYS.tracks,tracks);
  });
});

/* ---------- Records ---------- */
function renderRecords(){
  const q=(qs("#recordsSearch").value||"").toLowerCase();
  const type=qs("#recordsType").value, status=qs("#recordsStatus").value;
  const from=qs("#recordsFrom").value, to=qs("#recordsTo").value;

  let jobs=load(STORAGE_KEYS.jobs);
  if(q) jobs=jobs.filter(j=>[j.name,j.weed].join(" ").toLowerCase().includes(q));
  if(type!=="All") jobs=jobs.filter(j=>j.type===type);
  if(status!=="All") jobs=jobs.filter(j=>j.status===status);
  if(from) jobs=jobs.filter(j=>j.date>=from);
  if(to) jobs=jobs.filter(j=>j.date<=to);

  const list=qs("#recordsList"); list.innerHTML="";
  if(!jobs.length){ list.innerHTML=`<div class="muted">No records.</div>`; return; }

  jobs.forEach(j=>{
    const line=document.createElement("div"); line.className="record-line";
    line.innerHTML=`<div>${j.name} ${j.status!=="Draft" ? `<span class="tag ${j.status==='Complete'?'complete':'incomplete'}">${j.status}</span>`:`<span class="tag draft">Draft</span>`}</div>
                    <button class="open-mini" onclick="openJob('${j.id}')">Open 🔍</button>`;
    list.appendChild(line);
  });
}
function openJob(id){
  const j=load(STORAGE_KEYS.jobs).find(x=>x.id===id); if(!j) return;
  const m=qs("#modal");
  const links=(j.linkedJobs||[]).map(x=>`<button class="open-mini" onclick="openJob('${x}')">${x}</button>`).join(" ");
  m.innerHTML=`
    <h3>${j.name}</h3>
    <div class="modal-row">
      <div><b>Type:</b> ${j.type}</div><div><b>Status:</b> ${j.status}</div><div><b>Date:</b> ${j.date}</div>
    </div>
    <div class="modal-row">
      <div><b>Start:</b> ${j.start||"—"}</div><div><b>Finish:</b> ${j.stop||"—"}</div>
      <div><b>GPS:</b> ${j.lat||"—"}, ${j.lng||"—"}</div>
    </div>
    <div class="modal-row">
      <div><b>Weed:</b> ${j.weed||"—"}</div><div><b>Batch:</b> ${j.batchId||"—"}</div>
      <div><b>Weather:</b> ${j.weather? `${j.weather.temp}°C, ${j.weather.wind} km/h, ${toCompass(+j.weather.dir)} (${j.weather.dir}°), ${j.weather.hum}%`:"—"}</div>
    </div>
    <div class="modal-row"><div><b>Notes:</b> ${j.notes||"—"}</div></div>
    ${links?`<div class="modal-row"><b>Linked Jobs:</b> ${links}</div>`:""}
    <div class="modal-actions">
      <button class="action" onclick="markComplete('${j.id}')">Mark Complete</button>
      <button class="action" onclick="editJob('${j.id}')">Edit</button>
      <button class="action ghost" onclick="closeModal()">Close</button>
    </div>`;
  m.classList.add("active");
}
function closeModal(){ qs("#modal").classList.remove("active"); }
function markComplete(id){
  const jobs=load(STORAGE_KEYS.jobs); const i=jobs.findIndex(j=>j.id===id); if(i<0) return;
  jobs[i].status="Complete"; save(STORAGE_KEYS.jobs,jobs); closeModal(); renderRecords();
}
function editJob(id){
  const j=load(STORAGE_KEYS.jobs).find(x=>x.id===id); if(!j) return;
  showPage("createTask");
  qs("#jobType").value=j.type; qs("#locationInput").value=j.name.split("_")[1]?.replace(/([A-Z])/g,' $1').trim()||"";
  qs("#weedSelect").value=j.weed||""; qs("#batchSelect").value=j.batchId||"";
  qs("#jobNotes").value=j.notes||""; qs("#jobDate").value=j.date||""; qs("#startTime").value=j.start||""; qs("#stopTime").value=j.stop||"";
  qs("#gpsPreview").textContent=`GPS: ${j.lat||"—"}, ${j.lng||"—"}`; qs("#gpsPreview").dataset.lat=j.lat||""; qs("#gpsPreview").dataset.lng=j.lng||"";
  qs("#wTemp").dataset.w=JSON.stringify(j.weather||{}); qs("#wTemp").textContent=`${j?.weather?.temp??"—"}°C`;
  qs("#wWind").textContent=`${j?.weather?.wind??"—"} km/h`;
  qs("#wDir").textContent = j?.weather?.dir?`${toCompass(+j.weather.dir)} (${j.weather.dir}°)`:"—";
  qs("#wHum").textContent = `${j?.weather?.hum??"—"}%`;
  (document.querySelectorAll("input[name='status']")).forEach(r=>r.checked=r.value===j.status);

  const originalSave=qs("#btnSaveJob").onclick;
  qs("#btnSaveJob").onclick=()=>{
    const all=load(STORAGE_KEYS.jobs); const k=all.findIndex(x=>x.id===id); if(k<0) return;
    const status=[...document.querySelectorAll("input[name='status']")].find(r=>r.checked)?.value || "Incomplete";
    all[k]={...all[k],
      type:qs("#jobType").value, name:(qs("#jobNamePreview").dataset.name||all[k].name),
      weed:qs("#weedSelect").value, batchId:qs("#batchSelect").value, notes:qs("#jobNotes").value,
      date:qs("#jobDate").value||all[k].date, start:qs("#startTime").value, stop:qs("#stopTime").value,
      lat:+(qs("#gpsPreview").dataset.lat||0), lng:+(qs("#gpsPreview").dataset.lng||0),
      weather:JSON.parse(qs("#wTemp").dataset.w||"{}"), status
    };
    save(STORAGE_KEYS.jobs,all); alert("Job updated."); showPage("records");
    qs("#btnSaveJob").onclick=originalSave;
  };
  closeModal();
}

/* ---------- Batches ---------- */
function openCreateBatch(){
  const m=qs("#modal");
  const opts=load(STORAGE_KEYS.chems).map(c=>`<option value="${c.name}">${c.name}</option>`).join("");
  const chemRows=Array.from({length:10}).map((_,i)=>`
    <div class="row-compact">
      <select class="batchChem" data-i="${i}"><option value="">— Chemical —</option>${opts}</select>
      <input class="ratePer100" data-i="${i}" type="number" step="0.01" placeholder="Rate /100L"/>
      <input class="totalAdded" data-i="${i}" type="number" step="0.01" placeholder="Total added (L/kg)"/>
    </div>`).join("");
  m.innerHTML=`
    <h3>Create Batch</h3>
    <div class="row-compact"><input id="batchTotal" type="number" step="1" placeholder="Total made (L)"/></div>
    ${chemRows}
    <div class="modal-actions">
      <button class="action" onclick="saveBatch()">Save Batch</button>
      <button class="action ghost" onclick="closeModal()">Close</button>
    </div>`;
  m.classList.add("active");
}
function saveBatch(){
  const totalMade=+qs("#batchTotal").value||0;
  const chems=[]; qsa(".batchChem").forEach((sel,i)=>{
    const name=sel.value; const rate=+qs(`.ratePer100[data-i='${i}']`).value||0; const total=+qs(`.totalAdded[data-i='${i}']`).value||0;
    if(name) chems.push({name,ratePer100:rate,totalAdded:total});
  });
  const batch={id:genID("BATCH"),totalMade,remaining:totalMade,chems,date:new Date().toISOString().slice(0,10)};
  const list=load(STORAGE_KEYS.batches); list.push(batch); save(STORAGE_KEYS.batches,list);

  // Deduct inventory
  const inv=load(STORAGE_KEYS.chems);
  chems.forEach(c=>{ const i=inv.findIndex(x=>x.name===c.name); if(i>-1) inv[i].quantity=Math.max(0,(inv[i].quantity||0)-(c.totalAdded||0)); });
  save(STORAGE_KEYS.chems,inv);

  alert("Batch saved."); closeModal(); refreshBatchSelect(); renderBatches();
}
function renderBatches(){
  const q=(qs("#batchSearch").value||"").toLowerCase();
  const from=qs("#batchFrom").value, to=qs("#batchTo").value;
  let list=load(STORAGE_KEYS.batches);
  if(q) list=list.filter(b=>b.id.toLowerCase().includes(q));
  if(from) list=list.filter(b=>b.date>=from);
  if(to) list=list.filter(b=>b.date<=to);

  const wrap=qs("#batchList"); wrap.innerHTML="";
  if(!list.length){ wrap.innerHTML=`<div class="muted">No batches.</div>`; return; }
  list.forEach(b=>{
    const line=document.createElement("div"); line.className="batch-line";
    line.innerHTML=`<div>${b.id}</div><button class="open-mini" onclick="openBatch('${b.id}')">Open 🔍</button>`;
    wrap.appendChild(line);
  });
}
function openBatch(id){
  const b=load(STORAGE_KEYS.batches).find(x=>x.id===id); if(!b) return;
  const chems=b.chems.map(c=>`• ${c.name} — ${c.ratePer100}/100L — total ${c.totalAdded}`).join("<br>");
  const m=qs("#modal");
  m.innerHTML=`
    <h3>${b.id}</h3>
    <div class="modal-row"><div><b>Date:</b> ${b.date}</div><div><b>Total:</b> ${b.totalMade} L</div><div><b>Remaining:</b> ${b.remaining} L</div></div>
    <div class="modal-row"><div><b>Chemicals:</b><br>${chems||"<i>None</i>"}</div></div>
    <div class="modal-actions"><button class="action ghost" onclick="closeModal()">Close</button></div>`;
  m.classList.add("active");
}

/* ---------- Inventory / Procurement ---------- */
function renderChemInventory(){
  const q=(qs("#chemSearch").value||"").toLowerCase();
  const list=load(STORAGE_KEYS.chems).filter(c=>!q || c.name.toLowerCase().includes(q));
  const wrap=qs("#chemList"); wrap.innerHTML="";
  list.forEach(c=>{
    const low=c.quantity<=c.low;
    const row=document.createElement("div");
    row.className="record-line";
    row.innerHTML=`<div><b>${c.name}</b> <span class="muted small">${c.active}</span></div>
                   <div>${c.quantity} ${c.unit} ${low?'<span class="tag draft">Low</span>':''}</div>`;
    wrap.appendChild(row);
  });
}
function renderProcurement(){
  const list=load(STORAGE_KEYS.chems).filter(c=>c.quantity<=c.low);
  const wrap=qs("#procureList"); wrap.innerHTML="";
  if(!list.length){ wrap.innerHTML=`<div class="muted">No items need re-ordering.</div>`; return; }
  list.forEach(c=>{
    const row=document.createElement("div");
    row.className="record-line";
    row.innerHTML=`<div><b>${c.name}</b></div><div>Reorder • Min ${c.low}${c.unit} • Have ${c.quantity}${c.unit}</div>`;
    wrap.appendChild(row);
  });
}

/* ---------- Map ---------- */
function renderMap(){
  const type=qs("#mapType").value, stat=qs("#mapStatus").value;
  const from=qs("#mapFrom").value, to=qs("#mapTo").value;
  let jobs=load(STORAGE_KEYS.jobs);
  if(type!=="All") jobs=jobs.filter(j=>j.type===type);
  if(stat==="Open") jobs=jobs.filter(j=>j.status!=="Complete");
  if(stat==="Closed") jobs=jobs.filter(j=>j.status==="Complete");
  if(from) jobs=jobs.filter(j=>j.date>=from);
  if(to) jobs=jobs.filter(j=>j.date<=to);
  plotJobs(jobs);
}

/* ---------- Reminders ---------- */
function renderReminders(){
  const wrap=qs("#reminderList"); wrap.innerHTML="";
  const list=load(STORAGE_KEYS.reminders);
  if(!list.length){ wrap.innerHTML=`<div class="muted">No reminders set.</div>`; return; }
  list.forEach(r=>{
    const row=document.createElement("div"); row.className="record-line";
    row.innerHTML=`<div><b>${r.task}</b><div class="small muted">Due: ${new Date(r.date).toLocaleString()}</div></div>
                   <button class="open-mini" onclick="dismissReminder('${r.id}')">Dismiss</button>`;
    wrap.appendChild(row);
  });
}
function dismissReminder(id){ deleteReminder(id); renderReminders(); }
