/* ===========================================
   WeedTracker V60 Pilot Final — APPS.JS (Part 2/2)
   =========================================== */

  // ---------- Records ----------
  function renderRecords(){
    const cont=$("recordsContainer"); if(!cont)return;
    const jobs=getJobs(); cont.innerHTML="";
    if(!jobs.length){cont.innerHTML="<p>No records yet.</p>";return;}

    jobs.sort((a,b)=>new Date(b.date)-new Date(a.date));
    for(const j of jobs){
      const div=document.createElement("div"); div.className="record-card";
      div.innerHTML=`
        <h3>${j.jobName}</h3>
        <p><b>Type:</b> ${j.type} • <b>${ddmmyyyy(j.date)}</b> • ${j.status}</p>
        <p><b>Weed:</b> ${j.weed||"—"} | <b>Batch:</b> ${j.batchId||"—"}</p>
        <p><b>Weather:</b> ${j.temp}°C, ${j.wind} km/h ${j.windCard||""}, ${j.hum}%</p>
        <p><b>Reminder:</b> ${j.reminderWeeks?`${j.reminderWeeks} wk`:"—"}</p>
        <button class="btn green" data-open="${j.id}">Open</button>
        <button class="btn grey" data-edit="${j.id}">Edit</button>
        <button class="btn red" data-del="${j.id}">Delete</button>
      `;
      cont.appendChild(div);
    }
    $$("[data-open]").forEach(b=>b.addEventListener("click",()=>openRecord(b.dataset.open)));
    $$("[data-edit]").forEach(b=>b.addEventListener("click",()=>editRecord(b.dataset.edit)));
    $$("[data-del]").forEach(b=>b.addEventListener("click",()=>deleteRecord(b.dataset.del)));
  }

  function openRecord(id){
    const j=getJobs().find(x=>x.id===id); if(!j)return;
    alert(`${j.jobName}\n${j.type}\n${j.date}\n${j.notes||"No notes"}`);
  }
  function editRecord(id){const j=getJobs().find(x=>x.id===id); if(!j)return; loadJobToForm(j);}
  function deleteRecord(id){if(confirm("Delete this record?")){setJobs(getJobs().filter(x=>x.id!==id));renderRecords();}}

  // ---------- Mapping ----------
  let map=null; let mapInit=false;
  function ensureMapAndDraw(centerSelf){
    const div=$("mapContainer"); if(!div)return;
    if(!mapInit){ map=L.map("mapContainer").setView([-34.45,148.7],11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map); mapInit=true;}
    map.eachLayer(l=>{if(l instanceof L.Marker||l instanceof L.Polyline)map.removeLayer(l);});
    const jobs=getJobs();
    for(const j of jobs){
      if(!j.coords||!j.coords.length)continue;
      const c=j.coords; const clr=j.type==="Road Spray"?"yellow":j.type==="Spot Spray"?"red":"blue";
      if(j.type==="Road Spray"){L.polyline(c,{color:clr}).addTo(map);}else{
        const m=L.marker(c[0]); m.bindPopup(`<b>${j.jobName}</b><br>${j.type}<br>${ddmmyyyy(j.date)}`); m.addTo(map);}
    }
    if(centerSelf&&navigator.geolocation){navigator.geolocation.getCurrentPosition(p=>map.setView([p.coords.latitude,p.coords.longitude],12));}
  }

  // ---------- Batches ----------
  function renderBatches(){
    const cont=$("batchesContainer"); if(!cont)return;
    const batches=getBatches(); cont.innerHTML="";
    if(!batches.length){cont.innerHTML="<p>No batches yet.</p>";return;}
    for(const b of batches){
      const div=document.createElement("div"); div.className="batch-card";
      div.innerHTML=`
        <h3>${b.name}</h3>
        <p>${ddmmyyyy(b.date)} • remaining ${b.remaining||0} L • used ${b.used||0} L</p>
        <p>Total chemicals: ${b.total||"—"}</p>
        <button class="btn green" data-open="${b.id}">Open</button>
        <button class="btn red" data-dump="${b.id}">Dump</button>
      `;
      cont.appendChild(div);
    }
    $$("[data-open]").forEach(b=>b.addEventListener("click",()=>openBatch(b.dataset.open)));
    $$("[data-dump]").forEach(b=>b.addEventListener("click",()=>dumpBatch(b.dataset.dump)));
  }

  function openBatch(id){
    const b=getBatches().find(x=>x.id===id); if(!b)return;
    alert(`${b.name}\n${b.total||"—"} chemicals\nUsed ${b.used||0}L`);
  }
  function dumpBatch(id){
    const arr=getBatches(); const b=arr.find(x=>x.id===id); if(!b)return;
    if(confirm("Mark this batch as dumped?")){b.dumped=true;setBatches(arr);renderBatches();}
  }

  // ---------- Inventory ----------
  function renderInventory(){
    const cont=$("inventoryContainer"); if(!cont)return;
    const chems=getChemicals(); cont.innerHTML="";
    for(const c of chems){
      const div=document.createElement("div"); div.className="chem-item";
      div.innerHTML=`<b>${c.name}</b>: ${c.amount}${c.unit}`;
      cont.appendChild(div);
    }
  }

  // ---------- Reminders ----------
  setInterval(()=>{
    const jobs=getJobs(); const now=Date.now();
    for(const j of jobs){
      if(j.reminderDate && !j.archived){
        const diff=new Date(j.reminderDate).getTime()-now;
        if(diff<0){toast(`Reminder due: ${j.jobName}`); j.archived=true;}
      }
    }
    setJobs(jobs);
  },60000); // check every 60s

  // ---------- Utils ----------
  function switchScreen(id){$$(".screen").forEach(s=>s.classList.remove("active")); $(id)?.classList.add("active");}
  function toast(msg){const t=$("toastHost"); if(!t)return; const n=document.createElement("div"); n.className="toast"; n.textContent=msg; t.appendChild(n); setTimeout(()=>n.remove(),3000);}
  function showSpinner(msg){$("spinnerText").textContent=msg; $("spinner").style.display="flex";}
  function spinnerDone(msg){$("spinnerText").textContent=msg;}
  function hideSpinner(){$("spinner").style.display="none";}
});

/* ===== STORAGE HELPERS (for context) ===== */
function getJobs(){return JSON.parse(localStorage.getItem("jobs")||"[]");}
function setJobs(v){localStorage.setItem("jobs",JSON.stringify(v));}
function getBatches(){return JSON.parse(localStorage.getItem("batches")||"[]");}
function setBatches(v){localStorage.setItem("batches",JSON.stringify(v));}
function getChemicals(){return JSON.parse(localStorage.getItem("chemicals")||"[]");}
function setChemicals(v){localStorage.setItem("chemicals",JSON.stringify(v));}
