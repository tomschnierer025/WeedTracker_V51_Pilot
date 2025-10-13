/* WeedTracker V55 Pilot – apps.js (Part 1 of 2)
   Core functionality: navigation, task creation, records, batches, inventory, map, reminders */

(function(){
'use strict';
/* ------------------- GLOBAL STATE ------------------- */
let jobs = JSON.parse(localStorage.getItem('jobs')||'[]');
let batches = JSON.parse(localStorage.getItem('batches')||'[]');
let chemicals = JSON.parse(localStorage.getItem('chemicals')||'[]');
let reminders = JSON.parse(localStorage.getItem('reminders')||'[]');

/* ------------------- SAVE WRAPPERS ------------------- */
function saveAll(){
  localStorage.setItem('jobs', JSON.stringify(jobs));
  localStorage.setItem('batches', JSON.stringify(batches));
  localStorage.setItem('chemicals', JSON.stringify(chemicals));
  localStorage.setItem('reminders', JSON.stringify(reminders));
}

/* ------------------- NAVIGATION ------------------- */
document.querySelectorAll('[data-view]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('section').forEach(s=>s.classList.add('hidden'));
    document.getElementById(btn.getAttribute('data-view')).classList.remove('hidden');
  });
});
document.querySelectorAll('[data-home]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('section').forEach(s=>s.classList.add('hidden'));
    document.getElementById('view-home').classList.remove('hidden');
  });
});

/* ------------------- CREATE TASK ------------------- */
const f = document.getElementById('taskForm');
if(f){
  f.addEventListener('submit',e=>{
    e.preventDefault();
    const job = {
      id: Date.now(),
      type: f.jobType.value,
      location: f.jobLocation.value,
      name: f.jobName.value,
      council: f.councilNumber.value,
      date: f.jobDate.value,
      wx: {
        temp: f.wxTemp.value,
        wind: f.wxWind.value,
        dir: f.wxDir.value,
        dirDeg: f.wxDirDeg.value,
        hum: f.wxHum.value
      },
      weed: f.weedSelect.value,
      batch: f.batchSelect.value,
      notes: f.jobNotes.value,
      status: f.jobStatus.value,
      reminder: f.reminderWeeks.value,
      timeStart: new Date().toLocaleTimeString(),
      timeStop: '',
      linkedJobs: []
    };
    jobs.push(job);
    if(+job.reminder>0){
      const due = new Date();
      due.setDate(due.getDate() + (+job.reminder*7));
      reminders.push({id: job.id, job: job.name, due: due.toISOString().split('T')[0]});
    }
    saveAll();
    toastInline('✅ Job saved');
    f.reset();
  });
}

/* locate me button */
const btnLocate = document.getElementById('btnLocate');
if(btnLocate) btnLocate.addEventListener('click', locateMe);

/* weather auto */
autoWeather();

/* tracking */
const btnStartTracking = document.getElementById('btnStartTracking');
const btnStopTracking = document.getElementById('btnStopTracking');
let trackingJob = null;
if(btnStartTracking){
  btnStartTracking.addEventListener('click',()=>{
    trackingJob = new Date().toLocaleTimeString();
    toastInline('▶️ Tracking started');
  });
}
if(btnStopTracking){
  btnStopTracking.addEventListener('click',()=>{
    if(!trackingJob) return toastInline('⚠️ No tracking started','warn');
    const t = new Date().toLocaleTimeString();
    toastInline(`⏹ Tracking stopped (${trackingJob} - ${t})`);
    trackingJob = null;
  });
}

/* ------------------- RECORDS ------------------- */
function renderRecords(filter=''){
  const list = document.getElementById('recordList');
  if(!list) return;
  list.innerHTML='';
  const start = document.getElementById('searchStart')?.value;
  const end = document.getElementById('searchEnd')?.value;
  let results = jobs;
  if(filter) results = results.filter(j=>Object.values(j).join(' ').toLowerCase().includes(filter.toLowerCase()));
  if(start) results = results.filter(j=>j.date>=start);
  if(end) results = results.filter(j=>j.date<=end);
  if(results.length===0){ list.innerHTML='<p>No records found.</p>'; return; }
  results.forEach(j=>{
    const div=document.createElement('div');
    div.className='record-card';
    div.innerHTML=`
      <div class="record-head">${j.name}<span class="badge ${j.status==='Complete'?'green':'amber'}">${j.status}</span></div>
      <div class="record-sub"><span>${j.type}</span><span>${j.date}</span></div>
      <div class="record-actions"><button class="btn" data-open="${j.id}">Open</button></div>`;
    list.appendChild(div);
  });
  list.querySelectorAll('[data-open]').forEach(b=>{
    b.addEventListener('click',()=>{
      const j=jobs.find(x=>x.id==b.dataset.open);
      showModal(j.name,`
        <p><b>Type:</b> ${j.type}</p>
        <p><b>Location:</b> ${j.location}</p>
        <p><b>Date:</b> ${j.date}</p>
        <p><b>Weather:</b> ${j.wx.temp}°C, ${j.wx.wind}km/h, ${j.wx.dir} ${j.wx.dirDeg}°, ${j.wx.hum}%</p>
        <p><b>Weed:</b> ${j.weed}</p>
        <p><b>Batch:</b> ${j.batch}</p>
        <p><b>Notes:</b> ${j.notes}</p>
        <p><b>Status:</b> ${j.status}</p>
        <p><b>Reminder:</b> ${j.reminder} weeks</p>
      `);
    });
  });
}
const btnSearch=document.getElementById('btnSearch');
if(btnSearch) btnSearch.addEventListener('click',()=>renderRecords(document.getElementById('searchText').value));
renderRecords();

/* ------------------- BATCHES ------------------- */
function renderBatches(){
  const list=document.getElementById('batchList');
  if(!list) return;
  list.innerHTML='';
  if(batches.length===0){list.innerHTML='<p>No batches found.</p>';return;}
  batches.forEach(b=>{
    const usedPerc=b.remaining<=0?0:Math.round((b.remaining/b.total)*100);
    const ring=b.remaining<=0?'ring-red':usedPerc<30?'ring-amber':'ring-green';
    const div=document.createElement('div');
    div.className=`batch-card ${ring}`;
    div.innerHTML=`
      <div class="record-head">${b.id}<span>${b.date}</span></div>
      <div class="record-sub"><span>Total mix:</span><span>${b.total}L</span></div>
      <div class="record-sub"><span>Remaining:</span><span>${b.remaining}L</span></div>
      <div class="record-actions"><button class="btn" data-batch="${b.id}">Open</button></div>`;
    list.appendChild(div);
  });
  list.querySelectorAll('[data-batch]').forEach(b=>{
    b.addEventListener('click',()=>{
      const bt=batches.find(x=>x.id==b.dataset.batch);
      const chems=bt.chems.map(c=>`<li>${c.name}: ${c.rate}/100L (Total ${c.total})</li>`).join('');
      showModal(bt.id,`
        <p><b>Date:</b> ${bt.date}</p>
        <p><b>Total mix:</b> ${bt.total}L</p>
        <p><b>Remaining:</b> ${bt.remaining}L</p>
        <p><b>Chemicals:</b></p><ul>${chems}</ul>
        <p><b>Jobs linked:</b> ${(bt.jobs||[]).map(j=>`<span>${j}</span>`).join(', ')}</p>
      `);
    });
  });
}
renderBatches();

/* create batch */
const btnAddBatch=document.getElementById('btnAddBatch');
if(btnAddBatch){
  btnAddBatch.addEventListener('click',()=>{
    const id=`B${Date.now()}`;
    const date=todayStr();
    const total=prompt('Total mix (L):')||'0';
    const remaining=total;
    const chems=[];
    let addMore=true;
    while(addMore){
      const name=prompt('Chemical name (leave blank to stop)');
      if(!name) break;
      const rate=prompt(`Rate of ${name} per 100L:`)||'0';
      const totalChem=+total*+rate/100;
      chems.push({name,rate,total:totalChem});
    }
    batches.push({id,date,total,remaining,chems,jobs:[]});
    saveAll(); renderBatches(); toastInline('🧪 Batch added');
  });
}
/* WeedTracker V55 Pilot – apps.js (Part 2 of 2)
   Sections: Inventory, Procurement, Mapping, Settings & Reminders */

(function(){
'use strict';

/* ------------------- CHEMICAL INVENTORY ------------------- */
function renderInventory(){
  const list=document.getElementById('inventoryList');
  if(!list) return;
  list.innerHTML='';
  if(chemicals.length===0){list.innerHTML='<p>No chemicals in inventory.</p>';return;}
  chemicals.forEach((c,i)=>{
    const div=document.createElement('div');
    div.className='chem-card';
    div.innerHTML=`
      <div class="chem-head">${c.name} <span>${c.amount}${c.unit}</span></div>
      <div class="chem-actions">
        <button class="btn" data-edit="${i}">Edit</button>
      </div>`;
    list.appendChild(div);
  });
  list.querySelectorAll('[data-edit]').forEach(b=>{
    b.addEventListener('click',()=>{
      const c=chemicals[b.dataset.edit];
      const newAmt=prompt(`Adjust amount for ${c.name}:`,c.amount);
      if(newAmt===null) return;
      c.amount=+newAmt;
      if(c.amount<=c.low){
        toastInline(`${c.name} low in stock – added to Procurement List`);
        addToProc(c.name);
      }
      saveAll(); renderInventory();
    });
  });
}
function addToProc(name){
  const p=document.getElementById('procList');
  const existing=procurements.find(p=>p.name===name);
  if(existing) return;
  procurements.push({id:Date.now(),name,status:'Pending'});
  localStorage.setItem('procurements',JSON.stringify(procurements));
  renderProcurement();
}

/* Add Chemical */
const btnAddChem=document.getElementById('btnAddChemical');
if(btnAddChem){
  btnAddChem.addEventListener('click',()=>{
    const name=prompt('Chemical name:'); if(!name)return;
    const unit=prompt('Unit (L/kg/ml):','L');
    const amount=+(prompt('Current amount:','0'));
    const low=+(prompt('Low stock threshold:','5'));
    const active=prompt('Active ingredient:','');
    chemicals.push({name,unit,amount,low,active});
    saveAll(); renderInventory(); toastInline('💧 Chemical added');
  });
}
renderInventory();

/* ------------------- PROCUREMENT LIST ------------------- */
let procurements=JSON.parse(localStorage.getItem('procurements')||'[]');
function renderProcurement(){
  const list=document.getElementById('procList');
  if(!list) return;
  list.innerHTML='';
  if(procurements.length===0){list.innerHTML='<p>No procurement items.</p>';return;}
  procurements.forEach((p,i)=>{
    const div=document.createElement('div');
    div.className='proc-card';
    div.innerHTML=`
      <div>${p.name}</div>
      <div>
        <button class="btn" data-action="done" data-i="${i}">Done</button>
        <button class="btn" data-action="snooze" data-i="${i}">Snooze</button>
      </div>`;
    list.appendChild(div);
  });
  list.querySelectorAll('[data-action]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const i=btn.dataset.i;
      if(btn.dataset.action==='done'){
        procurements.splice(i,1);
        toastInline('✅ Procurement completed');
      }else{
        toastInline('⏰ Snoozed for 1 week');
      }
      localStorage.setItem('procurements',JSON.stringify(procurements));
      renderProcurement();
    });
  });
}
renderProcurement();

/* ------------------- MAPPING (Via Leaflet) ------------------- */
let map;
function initMap(){
  map=L.map('map').setView([-34.55,148.72],10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
  jobs.forEach(j=>{
    const latlng=[j.lat||-34.55+(Math.random()/10),j.lng||148.72+(Math.random()/10)];
    const color=j.type==='Road Spray'?'yellow':j.type==='Inspection'?'blue':'green';
    const marker=L.circleMarker(latlng,{radius:6,color}).addTo(map);
    marker.bindPopup(`<b>${j.name}</b><br>${j.type}<br>${j.date}`);
  });
}
const mapBtn=document.getElementById('btnLocateMap');
if(mapBtn){
  mapBtn.addEventListener('click',()=>{
    navigator.geolocation.getCurrentPosition(p=>{
      map.setView([p.coords.latitude,p.coords.longitude],15);
      L.marker([p.coords.latitude,p.coords.longitude]).addTo(map)
        .bindPopup('📍 You are here').openPopup();
    });
  });
}
setTimeout(()=>{ if(document.getElementById('map')) initMap(); },500);

/* ------------------- SETTINGS ------------------- */
const btnClearAll=document.getElementById('btnClearAll');
if(btnClearAll){
  btnClearAll.addEventListener('click',()=>{
    if(confirm('Delete all data?')){
      localStorage.clear();
      toastInline('🗑️ All data cleared');
      location.reload();
    }
  });
}
const btnExport=document.getElementById('btnExport');
if(btnExport){
  btnExport.addEventListener('click',()=>{
    const data={jobs,batches,chemicals,reminders,procurements};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='WeedTrackerData.json';
    a.click();
    toastInline('📤 Data exported');
  });
}

/* ------------------- REMINDERS ------------------- */
function checkReminders(){
  const today=todayStr();
  reminders.filter(r=>r.due===today).forEach(r=>{
    toastInline(`🔔 Reminder due: ${r.job}`,'warn');
  });
}
setInterval(checkReminders,60000);
checkReminders();

})();
