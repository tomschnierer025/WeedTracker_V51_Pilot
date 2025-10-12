/* Weed Tracker V50 Pilot — core logic: navigation, tasks, batches, records, map, reminders */

const qs = (s)=>document.querySelector(s);
const qsa = (s)=>[...document.querySelectorAll(s)];

function showPage(id){
  qsa(".page").forEach(p=>p.classList.remove("active"));
  qs("#"+id).classList.add("active");
  if(id==="records") renderRecords();
  if(id==="inventory") renderChemInventory();
  if(id==="batches") renderBatches();
  if(id==="procurement") renderProcurement();
  if(id==="map") { ensureMap(); renderMap(); }
  if(id==="reminders") renderReminders();
}

/* ---------------- Boot & Nav ---------------- */
document.addEventListener("DOMContentLoaded", ()=>{
  setTimeout(()=>qs("#splash-screen").style.display="none", 2400);

  // Home buttons
  qs("#btnCreateTask").onclick = ()=>showPage("createTask");
  qs("#btnRecords").onclick    = ()=>showPage("records");
  qs("#btnInventory").onclick  = ()=>showPage("inventory");
  qs("#btnBatches").onclick    = ()=>showPage("batches");
  qs("#btnProcurement").onclick= ()=>showPage("procurement");
  qs("#btnMapping").onclick    = ()=>showPage("map");
  qs("#btnReminders").onclick  = ()=>showPage("reminders");
  qs("#btnSettings").onclick   = ()=>showPage("settings");

  // Back home buttons
  ["1","2","3","4","5","6","7","8"].forEach(n=>{
    const el = qs("#btnBackHome"+n); if(el) el.onclick = ()=>showPage("home");
  });

  // Create Task handlers
  qs("#btnLocate").onclick     = handleLocate;
  qs("#btnAutoName").onclick   = handleAutoName;
  qs("#btnWeather").onclick    = handleWeather;
  qs("#btnNewBatch").onclick   = openCreateBatch;
  qs("#btnSaveJob").onclick    = ()=>handleSaveJob(false);
  qs("#btnSaveDraft").onclick  = ()=>handleSaveJob(true);

  // Records filters
  qs("#btnRecordsFilter").onclick = renderRecords;

  // Batches filters / create
  qs("#btnBatchFilter").onclick = renderBatches;
  qs("#btnCreateBatch").onclick = openCreateBatch;

  // Map filters
  qs("#btnMapFilter").onclick = renderMap;
  qs("#btnLocateMe").onclick  = locateUser;

  // Settings
  qs("#btnClearData").onclick = ()=>clearAllData(true);

  // Populate initial weeds & batches into selects
  refreshWeedSelect();
  refreshBatchSelect();
});

/* ---------------- Helpers ---------------- */
function handleLocate(){
  getGPSLocation(c=>{
    qs("#gpsPreview").textContent = `GPS: ${c.lat}, ${c.lng}`;
    qs("#gpsPreview").dataset.lat = c.lat;
    qs("#gpsPreview").dataset.lng = c.lng;
  });
}
async function handleWeather(){
  const lat = +qs("#gpsPreview").dataset.lat || -34.75;
  const lng = +qs("#gpsPreview").dataset.lng || 148.65;
  const w = await fetchWeather(lat,lng);
  qs("#weatherPreview").textContent = `🌡 ${w.temp}°C  💨 ${w.wind} km/h  RH ${w.humidity}%`;
  qs("#weatherPreview").dataset.weather = JSON.stringify(w);
}
function handleAutoName(){
  const type = qs("#jobType").value;
  const loc  = (qs("#locationInput").value||"Location").trim().replace(/\s+/g,"_");
  const date = new Date().toISOString().slice(0,10);
  const job = `${loc}_${date}_${type}`;
  qs("#jobNamePreview").textContent = `Name: ${job}`;
  qs("#jobNamePreview").dataset.name = job;
}
function refreshWeedSelect(){
  const weeds = load(STORAGE_KEYS.weeds);
  const sel = qs("#weedSelect");
  sel.innerHTML = "";
  weeds.forEach(w=>{
    const opt = document.createElement("option");
    opt.textContent = w.name; opt.value = w.name;
    sel.appendChild(opt);
  });
}
function refreshBatchSelect(){
  const list = load(STORAGE_KEYS.batches);
  const sel = qs("#batchSelect");
  sel.innerHTML = "<option value=''>— None —</option>";
  list.forEach(b=>{
    const opt = document.createElement("option");
    opt.textContent = `${b.id} • ${b.totalMade}L • Rem ${b.remaining}L`;
    opt.value = b.id;
    sel.appendChild(opt);
  });
}

/* ---------------- Save Job ---------------- */
function handleSaveJob(isDraft){
  const type = qs("#jobType").value;
  const name = qs("#jobNamePreview").dataset.name || "Untitled";
  const weed = qs("#weedSelect").value || "";
  const batchId = qs("#batchSelect").value || "";
  const notes = qs("#jobNotes").value||"";
  const start = qs("#startTime").value||"";
  const stop  = qs("#stopTime").value||"";
  const lat = +(qs("#gpsPreview").dataset.lat||0);
  const lng = +(qs("#gpsPreview").dataset.lng||0);
  const weather = JSON.parse(qs("#weatherPreview").dataset.weather||"{}");
  const reminderWeeks = +qs("#reminderWeeks").value||0;

  const job = {
    id: generateID("JOB"),
    name, type, weed, batchId, notes, start, stop, lat, lng,
    date: new Date().toISOString().slice(0,10),
    time: new Date().toTimeString().slice(0,5),
    weather,
    status: isDraft ? "Draft" : "Incomplete",
    linkedJobs: []
  };
  const jobs = load(STORAGE_KEYS.jobs); jobs.push(job); save(STORAGE_KEYS.jobs, jobs);

  if(reminderWeeks>0){
    const due = new Date(); due.setDate(due.getDate()+7*reminderWeeks);
    addReminder({ id:generateID("REM"), task:name, date:due.toISOString(), alerted:false });
  }

  alert(isDraft ? "Draft saved." : "Job saved.");
  showPage("records");
}

/* ---------------- Records ---------------- */
function renderRecords(){
  const q = (qs("#recordsSearch").value||"").toLowerCase();
  const type = qs("#recordsType").value;
  const status = qs("#recordsStatus").value;
  const date = qs("#recordsDate").value;

  let jobs = load(STORAGE_KEYS.jobs);
  if(q) jobs = jobs.filter(j=>[j.name,j.weed].join(" ").toLowerCase().includes(q));
  if(type!=="All") jobs = jobs.filter(j=>j.type===type);
  if(status!=="All") jobs = jobs.filter(j=>j.status===status);
  if(date) jobs = jobs.filter(j=>j.date===date);

  const list = qs("#recordsList"); list.innerHTML="";
  if(!jobs.length){ list.innerHTML = `<div class="muted">No records.</div>`; return;}

  jobs.forEach(j=>{
    const card = document.createElement("div");
    card.className="record-card";
    card.innerHTML = `
      <h3>${j.name}</h3>
      <div>
        <span class="tag ${j.status==='Complete'?'complete':j.status==='Draft'?'draft':'incomplete'}">${j.status}</span>
        <span class="tag">${j.type}</span>
        ${j.weed?`<span class="tag">${j.weed}</span>`:""}
      </div>
      <div class="muted small">${j.date} ${j.time}</div>
      <div class="row-compact" style="margin-top:8px">
        <button class="action" onclick="openJob('${j.id}')">Open</button>
        ${j.lat&&j.lng?`<button class="action" onclick="openAppleMaps(${j.lat},${j.lng})">Navigate</button>`:""}
      </div>
    `;
    list.appendChild(card);
  });
}

/* Job modal */
function openJob(id){
  const j = load(STORAGE_KEYS.jobs).find(x=>x.id===id); if(!j) return;
  const m = qs("#modal");
  m.innerHTML = `
    <h3>${j.name}</h3>
    <div class="grid-2">
      <div>
        <div><b>Type:</b> ${j.type}</div>
        <div><b>Status:</b> ${j.status}</div>
        <div><b>Weed:</b> ${j.weed||"—"}</div>
        <div><b>Batch:</b> ${j.batchId||"—"}</div>
        <div><b>Start/Stop:</b> ${j.start||"—"} → ${j.stop||"—"}</div>
      </div>
      <div>
        <div><b>Date:</b> ${j.date} ${j.time}</div>
        <div><b>GPS:</b> ${j.lat||"—"}, ${j.lng||"—"}</div>
        <div><b>Weather:</b> ${j.weather?.temp??"—"}°C, ${j.weather?.wind??"—"} km/h</div>
        <div><b>Notes:</b> ${j.notes||"—"}</div>
      </div>
    </div>
    <div class="row-right" style="margin-top:10px">
      <button class="action" onclick="markComplete('${j.id}')">Mark Complete</button>
      <button class="action" onclick="editJob('${j.id}')">Edit</button>
      <button class="action ghost" onclick="closeModal()">Close</button>
    </div>
  `;
  m.classList.add("active");
}
function closeModal(){ qs("#modal").classList.remove("active"); }
function markComplete(id){
  const jobs = load(STORAGE_KEYS.jobs);
  const i = jobs.findIndex(j=>j.id===id); if(i<0) return;
  jobs[i].status="Complete"; save(STORAGE_KEYS.jobs, jobs);
  closeModal(); renderRecords();
}
function editJob(id){
  const j = load(STORAGE_KEYS.jobs).find(x=>x.id===id); if(!j) return;
  showPage("createTask");
  qs("#jobType").value = j.type;
  qs("#locationInput").value = j.name.split("_")[0].replace(/_/g," ");
  qs("#weedSelect").value = j.weed||"";
  qs("#batchSelect").value = j.batchId||"";
  qs("#jobNotes").value = j.notes||"";
  qs("#startTime").value = j.start||"";
  qs("#stopTime").value  = j.stop||"";
  qs("#gpsPreview").textContent = `GPS: ${j.lat||"—"}, ${j.lng||"—"}`;
  qs("#gpsPreview").dataset.lat = j.lat||"";
  qs("#gpsPreview").dataset.lng = j.lng||"";
  qs("#jobNamePreview").textContent = `Name: ${j.name}`;
  qs("#jobNamePreview").dataset.name = j.name;
  qs("#weatherPreview").textContent = j.weather?`🌡 ${j.weather.temp}°C  💨 ${j.weather.wind} km/h`:"—";
  qs("#weatherPreview").dataset.weather = JSON.stringify(j.weather||{});
  // On save, we update instead of duplicating:
  const originalSave = qs("#btnSaveJob").onclick;
  qs("#btnSaveJob").onclick = ()=>{
    const jobs2 = load(STORAGE_KEYS.jobs);
    const k = jobs2.findIndex(x=>x.id===id);
    if(k>-1){
      jobs2[k] = {
        ...jobs2[k],
        type: qs("#jobType").value,
        name: qs("#jobNamePreview").dataset.name || jobs2[k].name,
        weed: qs("#weedSelect").value,
        batchId: qs("#batchSelect").value,
        notes: qs("#jobNotes").value,
        start: qs("#startTime").value,
        stop: qs("#stopTime").value,
        lat: +(qs("#gpsPreview").dataset.lat||0),
        lng: +(qs("#gpsPreview").dataset.lng||0),
        weather: JSON.parse(qs("#weatherPreview").dataset.weather||"{}")
      };
      save(STORAGE_KEYS.jobs, jobs2);
      alert("Job updated.");
      showPage("records");
    }
    qs("#btnSaveJob").onclick = originalSave; // restore
  };
  closeModal();
}

/* ---------------- Batches ---------------- */
function openCreateBatch(){
  const m = qs("#modal");
  // allow up to 10 chemicals
  const chemOptions = load(STORAGE_KEYS.chems).map(c=>`<option value="${c.name}">${c.name}</option>`).join("");
  const chemRows = Array.from({length:10}).map((_,i)=>`
    <div class="row-compact">
      <select class="batchChem" data-i="${i}">
        <option value="">— Chemical —</option>${chemOptions}
      </select>
      <input class="ratePer100" data-i="${i}" type="number" step="0.01" placeholder="Rate /100L"/>
      <input class="totalAdded" data-i="${i}" type="number" step="0.01" placeholder="Total added (L/kg)"/>
    </div>
  `).join("");

  m.innerHTML = `
    <h3>Create Batch</h3>
    <div class="row-compact">
      <input id="batchTotal" type="number" step="1" placeholder="Total made (L)"/>
    </div>
    ${chemRows}
    <div class="row-right" style="margin-top:10px">
      <button class="action" onclick="saveBatch()">Save Batch</button>
      <button class="action ghost" onclick="closeModal()">Close</button>
    </div>
  `;
  m.classList.add("active");
}
function saveBatch(){
  const totalMade = +qs("#batchTotal").value||0;
  const chems = [];
  qsa(".batchChem").forEach((sel,i)=>{
    const name = sel.value;
    const rate = +qs(`.ratePer100[data-i="${i}"]`).value||0;
    const total = +qs(`.totalAdded[data-i="${i}"]`).value||0;
    if(name) chems.push({name, ratePer100:rate, totalAdded:total});
  });
  const remaining = totalMade;
  const id = generateID("BATCH");
  const batch = { id, totalMade, remaining, chems, date:new Date().toISOString().slice(0,10) };

  const list = load(STORAGE_KEYS.batches); list.push(batch); save(STORAGE_KEYS.batches, list);

  // Deduct inventory by totals entered
  const inv = load(STORAGE_KEYS.chems);
  chems.forEach(c=>{
    const i = inv.findIndex(x=>x.name===c.name);
    if(i>-1){
      inv[i].quantity = Math.max(0, (inv[i].quantity||0) - (c.totalAdded||0));
    }
  });
  save(STORAGE_KEYS.chems, inv);

  alert("Batch saved.");
  closeModal();
  refreshBatchSelect();
  renderBatches();
}
function renderBatches(){
  const q = (qs("#batchSearch").value||"").toLowerCase();
  const date = qs("#batchDateFilter").value;
  let list = load(STORAGE_KEYS.batches);
  if(q) list = list.filter(b=>b.id.toLowerCase().includes(q));
  if(date) list = list.filter(b=>b.date===date);

  const wrap = qs("#batchList"); wrap.innerHTML="";
  if(!list.length){ wrap.innerHTML=`<div class="muted">No batches.</div>`; return; }

  list.forEach(b=>{
    const card = document.createElement("div");
    card.className="batch-card";
    const chemLines = b.chems.map(c=>`<div>• ${c.name} — ${c.ratePer100}/100L — total ${c.totalAdded}</div>`).join("");
    card.innerHTML = `
      <div><b>${b.id}</b></div>
      <div class="muted small">${b.date}</div>
      <div>Total: ${b.totalMade} L • Remaining: ${b.remaining} L</div>
      <div style="margin-top:6px">${chemLines||"<i>No chemicals recorded</i>"}</div>
    `;
    wrap.appendChild(card);
  });
}

/* ---------------- Inventory & Procurement ---------------- */
function renderChemInventory(){
  const q = (qs("#chemSearch").value||"").toLowerCase();
  const list = load(STORAGE_KEYS.chems).filter(c=>!q || c.name.toLowerCase().includes(q));
  const wrap = qs("#chemList"); wrap.innerHTML="";
  list.forEach(c=>{
    const low = c.quantity<=c.low;
    const card = document.createElement("div");
    card.className="chem-card";
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div><b>${c.name}</b></div>
          <div class="muted small">${c.active}</div>
        </div>
        <div>${c.quantity} ${c.unit}</div>
      </div>
      ${low?`<div class="tag draft" style="margin-top:6px">Low stock (≤ ${c.low} ${c.unit})</div>`:""}
    `;
    wrap.appendChild(card);
  });
}
function renderProcurement(){
  const list = load(STORAGE_KEYS.chems).filter(c=>c.quantity<=c.low);
  const wrap = qs("#procureList"); wrap.innerHTML="";
  if(!list.length){ wrap.innerHTML = `<div class="muted">No items need re-ordering.</div>`; return; }
  list.forEach(c=>{
    const card = document.createElement("div");
    card.className="chem-card";
    card.innerHTML = `<div><b>${c.name}</b> — Need to reorder (current ${c.quantity}${c.unit}, min ${c.low}${c.unit})</div>`;
    wrap.appendChild(card);
  });
}

/* ---------------- Map ---------------- */
function renderMap(){
  const type = qs("#mapType").value;
  const status = qs("#mapStatus").value;
  const date = qs("#mapDate").value;

  let jobs = load(STORAGE_KEYS.jobs);
  if(type!=="All") jobs = jobs.filter(j=>j.type===type);
  if(status==="Open") jobs = jobs.filter(j=>j.status!=="Complete");
  if(status==="Closed") jobs = jobs.filter(j=>j.status==="Complete");
  if(date) jobs = jobs.filter(j=>j.date===date);

  plotJobs(jobs);
}

/* ---------------- Reminders ---------------- */
function renderReminders(){
  const wrap = qs("#reminderList"); wrap.innerHTML="";
  const list = load(STORAGE_KEYS.reminders);
  if(!list.length){ wrap.innerHTML = `<div class="muted">No reminders set.</div>`; return; }
  list.forEach(r=>{
    const card = document.createElement("div");
    card.className="rem-card";
    card.innerHTML = `
      <div><b>${r.task}</b></div>
      <div class="muted small">Due: ${new Date(r.date).toLocaleString()}</div>
      <div class="row-right" style="margin-top:6px">
        <button class="action" onclick="snoozeReminder('${r.id}',7)">Snooze 1w</button>
        <button class="action danger" onclick="deleteReminder('${r.id}')">Dismiss</button>
      </div>
    `;
    wrap.appendChild(card);
  });
}
function snoozeReminder(id,weeks){
  const list = load(STORAGE_KEYS.reminders);
  const i = list.findIndex(r=>r.id===id); if(i<0) return;
  const d = new Date(list[i].date); d.setDate(d.getDate()+7*weeks);
  list[i].date = d.toISOString(); list[i].alerted=false;
  save(STORAGE_KEYS.reminders, list);
  renderReminders();
}
function deleteReminder(id){
  removeReminder(id); renderReminders();
}
