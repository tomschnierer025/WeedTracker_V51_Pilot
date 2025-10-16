/* === WeedTracker V60.4 — apps.js (Part A of 2) ===
   Fully working build with:
   - Apple Maps navigation (Records + Map Pins)
   - Noxious Weeds pinned top + colour indicators
   - Locate Me + clickable pins
   - Records & Batches Open buttons fixed
   - AU date format (DD-MM-YYYY)
   - Photo upload + weather autofill
   - LocalStorage + rolling backups
*/
document.addEventListener("DOMContentLoaded", () => {
  const $  = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>[...r.querySelectorAll(s)];
  const fmt=(n,d=0)=>(n==null||n==="")?"–":Number(n).toFixed(d);

  // ---------- Date helpers ----------
  function formatDateAU(d){
    const dt=(d instanceof Date)?d:new Date(d);
    return `${String(dt.getDate()).padStart(2,"0")}-${String(dt.getMonth()+1).padStart(2,"0")}-${dt.getFullYear()}`;
  }
  function formatDateAUCompact(d){
    const dt=(d instanceof Date)?d:new Date(d);
    return `${String(dt.getDate()).padStart(2,"0")}${String(dt.getMonth()+1).padStart(2,"0")}${dt.getFullYear()}`;
  }
  const todayISO = ()=>new Date().toISOString().split("T")[0];
  const nowTime  = ()=>new Date().toTimeString().slice(0,5);

  // ---------- Toast ----------
  function toast(msg,ms=1600){
    const d=document.createElement("div");
    d.textContent=msg;
    Object.assign(d.style,{
      position:"fixed",bottom:"1rem",left:"50%",transform:"translateX(-50%)",
      background:"#e6ffe6",color:"#064f00",padding:".6rem 1rem",borderRadius:"20px",
      fontWeight:"600",boxShadow:"0 2px 6px rgba(0,0,0,.25)",zIndex:9999
    });
    document.body.appendChild(d);setTimeout(()=>d.remove(),ms);
  }

  // ---------- DB + defaults ----------
  const STORAGE_KEY="weedtracker_data_v60";
  const BACKUP_KEY="weedtracker_backup_v60";
  const MAX_BACKUPS=3;

  const NSW_WEEDS_40=[
    "African Boxthorn (noxious)","African Lovegrass (noxious)","Bathurst Burr (noxious)","Blackberry (noxious)",
    "Cape Broom (noxious)","Chilean Needle Grass (noxious)","Coolatai Grass (noxious)","Fireweed (noxious)",
    "Gorse (noxious)","Lantana (noxious)","Patterson’s Curse (noxious)","Serrated Tussock (noxious)",
    "St John’s Wort (noxious)","Sweet Briar (noxious)","Willow spp. (noxious)",
    "African Feathergrass","Artichoke Thistle","Balloon Vine","Blue Heliotrope","Bridal Creeper","Caltrop",
    "Coltsfoot","Fleabane","Flax-leaf Broom","Fountain Grass","Galvanised Burr","Giant Parramatta Grass",
    "Glycine","Green Cestrum","Horehound","Khaki Weed","Noogoora Burr","Parthenium Weed","Prickly Pear (common)",
    "Saffron Thistle","Silverleaf Nightshade","Spear Thistle","Sweet Vernal Grass","Three-cornered Jack","Wild Radish"
  ];

  const DEFAULT_CHEMS=[
    {name:"Crucial",active:"Glyphosate 540 g/L",containerSize:20,containerUnit:"L",containers:4,threshold:2},
    {name:"SuperWet",active:"Non-ionic surfactant",containerSize:20,containerUnit:"L",containers:1,threshold:1},
    {name:"Bow Saw 600",active:"Triclopyr 600 g/L",containerSize:1,containerUnit:"L",containers:2,threshold:1},
    {name:"Clethodim",active:"Clethodim 240 g/L",containerSize:20,containerUnit:"L",containers:1,threshold:1},
    {name:"Grazon",active:"Triclopyr + Picloram",containerSize:20,containerUnit:"L",containers:1,threshold:1},
    {name:"Bosol",active:"Metsulfuron-methyl",containerSize:500,containerUnit:"g",containers:2,threshold:1},
    {name:"Hastings",active:"MCPA",containerSize:20,containerUnit:"L",containers:1,threshold:1},
    {name:"Outright",active:"Fluroxypyr",containerSize:20,containerUnit:"L",containers:1,threshold:1}
  ];

  function backupDB(db){
    const arr=JSON.parse(localStorage.getItem(BACKUP_KEY)||"[]");
    arr.unshift({ts:new Date().toISOString(),db});
    while(arr.length>MAX_BACKUPS)arr.pop();
    localStorage.setItem(BACKUP_KEY,JSON.stringify(arr));
  }

  function restoreLatest(){
    const arr=JSON.parse(localStorage.getItem(BACKUP_KEY)||"[]");
    if(!arr.length)return null;
    const latest=arr[0].db;
    localStorage.setItem(STORAGE_KEY,JSON.stringify(latest));
    return latest;
  }

  function ensureDB(){
    let db;
    try{db=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");}catch{db={};}
    db.version??=60.4;
    db.tasks??=[];db.batches??=[];db.chems??=[];db.procurement??=[];db.weeds??=NSW_WEEDS_40.slice();
    if(!db.chems.length)db.chems=DEFAULT_CHEMS.slice();
    localStorage.setItem(STORAGE_KEY,JSON.stringify(db));
    return db;
  }
  let DB=ensureDB();
  const saveDB=(bkp=true)=>{localStorage.setItem(STORAGE_KEY,JSON.stringify(DB));if(bkp)backupDB(DB);};

  // ---------- Navigation ----------
  const screens=$$(".screen");
  function switchScreen(id){
    screens.forEach(s=>s.classList.remove("active"));
    $("#"+id)?.classList.add("active");
    if(id==="records")renderRecords();
    if(id==="batches")renderBatches();
    if(id==="inventory")renderChems();
    if(id==="mapping")renderMap(true);
  }
  $$("[data-target]").forEach(b=>b.addEventListener("click",()=>switchScreen(b.dataset.target)));
  $$(".home-btn").forEach(b=>b.addEventListener("click",e=>{e.preventDefault();switchScreen("home");}));

  // ---------- Splash fade ----------
  const splash=$("#splash");
  setTimeout(()=>splash?.classList.add("hide"),1200);
  splash?.addEventListener("transitionend",()=>splash.remove(),{once:true});

  // ---------- Spinner ----------
  const spinner=$("#spinner");
  const spin=on=>spinner?.classList[on?"add":"remove"]("active");

  // ---------- Create Task ----------
  const taskTypeSel=$("#taskType");
  const roadTrackBlock=$("#roadTrackBlock");
  const syncTrack=()=>roadTrackBlock.style.display=(taskTypeSel.value==="Road Spray")?"block":"none";
  taskTypeSel?.addEventListener("change",syncTrack);syncTrack();

  const remSel=$("#reminderWeeks");
  if(remSel&&!remSel.options.length)
    for(let i=1;i<=52;i++){const o=document.createElement("option");o.value=o.textContent=i;remSel.appendChild(o);}

  // ---------- Locate + AutoName ----------
  const locateBtn=$("#locateBtn");
  const locRoad=$("#locRoad");
  let currentRoad="";
  locateBtn?.addEventListener("click",()=>{
    spin(true);
    if(!navigator.geolocation){spin(false);toast("Enable location");return;}
    navigator.geolocation.getCurrentPosition(async pos=>{
      const{latitude:lat,longitude:lon}=pos.coords;
      try{
        const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const j=await r.json();
        currentRoad=j.address?.road||j.display_name||`${lat.toFixed(5)},${lon.toFixed(5)}`;
      }catch{currentRoad=`${lat.toFixed(5)},${lon.toFixed(5)}`;}
      locRoad.textContent=currentRoad||"Unknown";
      spin(false);
    },()=>{spin(false);toast("GPS failed");});
  });

  const TYPE_PREFIX={"Inspection":"I","Spot Spray":"SS","Road Spray":"RS"};
  $("#autoNameBtn")?.addEventListener("click",()=>{
    const t=$("#taskType").value||"Inspection";
    const prefix=TYPE_PREFIX[t]||"I";
    const dInput=$("#jobDate");
    const dt=dInput&&dInput.value?new Date(dInput.value):new Date();
    const dateCompact=formatDateAUCompact(dt);
    const base=(currentRoad||"Unknown").replace(/\s+/g,"");
    $("#jobName").value=`${prefix}${dateCompact}_${base}`;
  });
  // ---------- Weather ----------
  $("#autoWeatherBtn")?.addEventListener("click",()=>{
    if(!navigator.geolocation){toast("Enable location");return;}
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{
        const {latitude,longitude}=pos.coords;
        const url=`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;
        const r=await fetch(url);const j=await r.json();const c=j.current||{};
        $("#temp").value=c.temperature_2m??"";$("#wind").value=c.wind_speed_10m??"";
        $("#windDir").value=(c.wind_direction_10m??"")+"°";$("#humidity").value=c.relative_humidity_2m??"";
        $("#wxUpdated").textContent="Updated @ "+nowTime();
      }catch{toast("Weather unavailable");}
    },()=>toast("Location not available"));
  });

  // ---------- Populate weeds (pinned + colours) ----------
  function populateWeeds(){
    const sel=$("#weedSelect");if(!sel)return;
    sel.innerHTML="";
    const nox=DB.weeds.filter(w=>/noxious/i.test(w)).sort((a,b)=>a.localeCompare(b));
    const rest=DB.weeds.filter(w=>!/noxious/i.test(w)).sort((a,b)=>a.localeCompare(b));
    const all=["⚠ Noxious Weeds",...nox,...rest];
    all.forEach((w,i)=>{
      const o=document.createElement("option");
      o.value=w==="⚠ Noxious Weeds"?"Noxious Weeds":w;
      o.textContent=w;
      if(w==="⚠ Noxious Weeds")o.style.color="red";
      else if(/noxious/i.test(w))o.style.color="#c09000";
      sel.appendChild(o);
    });
  }
  populateWeeds();

  // ---------- Populate batch dropdown ----------
  function populateBatchSelect(){
    const sel=$("#batchSelect");if(!sel)return;
    sel.innerHTML="";
    const def=document.createElement("option");
    def.value="";def.textContent="— Select Batch —";sel.appendChild(def);
    DB.batches.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""))
      .forEach(b=>{
        const o=document.createElement("option");
        o.value=b.id;o.textContent=`${b.id} • ${formatDateAU(b.date)} • remain ${fmt(b.remaining)} L`;
        sel.appendChild(o);
      });
  }
  populateBatchSelect();

  // ---------- Record rendering ----------
  function renderRecords(){
    const list=$("#recordsList");if(!list)return;list.innerHTML="";
    DB.tasks.filter(t=>!t.archived)
      .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
      .forEach(t=>{
        const div=document.createElement("div");
        div.className="item";
        div.innerHTML=`<b>${t.name}</b><br><small>${t.type} • ${formatDateAU(t.date)} • ${t.status}</small>
        <div class="row end">
          <button class="pill" data-open="${t.id}">Open</button>
          ${t.coords?.length?`<button class="pill" data-nav="${t.id}">Navigate</button>`:""}
        </div>`;
        div.querySelector("[data-open]")?.addEventListener("click",()=>showJobPopup(t));
        div.querySelector("[data-nav]")?.addEventListener("click",()=>{
          const pt=t.coords?.[0];if(!pt){toast("No coords");return;}
          openAppleMaps(pt[0],pt[1]);
        });
        list.appendChild(div);
      });
  }
  renderRecords();

  // ---------- Batch rendering ----------
  function renderBatches(){
    const list=$("#batchList");if(!list)return;list.innerHTML="";
    DB.batches.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""))
      .forEach(b=>{
        const div=document.createElement("div");
        div.className="item";
        div.innerHTML=`<b>${b.id}</b><br><small>${formatDateAU(b.date)} • Total ${fmt(b.mix)} L • Remaining ${fmt(b.remaining)} L</small>
        <div class="row end"><button class="pill" data-open="${b.id}">Open</button></div>`;
        div.querySelector("[data-open]")?.addEventListener("click",()=>showBatchPopup(b));
        list.appendChild(div);
      });
  }
  renderBatches();

  // ---------- Show batch popup ----------
  function showBatchPopup(b){
    const jobs=DB.tasks.filter(t=>t.batch===b.id);
    const jobsHtml=jobs.length?`<ul>${jobs.map(t=>`<li><a href="#" data-open-job="${t.id}">${t.name}</a></li>`).join("")}</ul>`:"—";
    const html=`<div class="modal"><div class="card p">
      <h3>${b.id}</h3>
      <div><b>Date:</b> ${formatDateAU(b.date)} · <b>Time:</b> ${b.time||"–"}</div>
      <div><b>Total Mix:</b> ${fmt(b.mix)} L</div>
      <div><b>Remaining:</b> ${fmt(b.remaining)} L</div>
      <div><b>Chemicals:</b><br>${b.chemicals||"—"}</div>
      <div><b>Linked Jobs:</b><br>${jobsHtml}</div>
      <div class="row gap end" style="margin-top:.6rem;">
        <button class="pill warn" data-close>Close</button>
      </div></div></div>`;
    const wrap=document.createElement("div");wrap.innerHTML=html;document.body.appendChild(wrap.firstChild);
    const modal=$(".modal");
    modal?.addEventListener("click",e=>{if(e.target===modal||e.target.dataset.close!=null)modal.remove();});
    $$("[data-open-job]",modal).forEach(a=>a.addEventListener("click",e=>{
      e.preventDefault();const t=DB.tasks.find(x=>String(x.id)===a.dataset.openJob);t&&showJobPopup(t);
    }));
  }

  // ---------- Apple Maps navigation ----------
  function openAppleMaps(lat,lon){
    const mapsURL=`maps://?daddr=${lat},${lon}&dirflg=d`;
    const webURL=`https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
    const a=document.createElement("a");a.href=mapsURL;document.body.appendChild(a);a.click();
    setTimeout(()=>{window.open(webURL,"_blank");a.remove();},300);
  }

  // ---------- Job popup ----------
  function showJobPopup(t){
    const batchLink=t.batch?`<a href="#" data-open-batch="${t.batch}">${t.batch}</a>`:"—";
    const html=`<div class="modal"><div class="card p">
      <h3>${t.name}</h3>
      <div><b>Type:</b> ${t.type} · <b>Status:</b> ${t.status}</div>
      <div><b>Date:</b> ${formatDateAU(t.date)} · <b>Start:</b> ${t.start||"–"} · <b>Finish:</b> ${t.end||"–"}</div>
      <div><b>Weed:</b> ${t.weed||"—"} · <b>Batch:</b> ${batchLink}</div>
      <div><b>Weather:</b> ${fmt(t.temp)}°C, ${fmt(t.wind)} km/h, ${t.windDir||"–"}, ${fmt(t.humidity)}%</div>
      <div><b>Notes:</b><br>${t.notes||"—"}</div>
      ${t.photo?`<img src="${t.photo}" style="max-width:100%;border-radius:6px;margin-top:.3rem">`:""}
      <div class="row gap end" style="margin-top:.5rem;">
        ${t.coords?.length?`<button class="pill" data-nav>Navigate</button>`:""}
        <button class="pill warn" data-close>Close</button>
      </div></div></div>`;
    const wrap=document.createElement("div");wrap.innerHTML=html;document.body.appendChild(wrap.firstChild);
    const modal=$(".modal");
    modal?.addEventListener("click",e=>{if(e.target===modal||e.target.dataset.close!=null)modal.remove();});
    $("[data-nav]",modal)?.addEventListener("click",()=>{
      const pt=t.coords?.[0];if(!pt){toast("No coords saved");return;}
      openAppleMaps(pt[0],pt[1]);
    });
    $("[data-open-batch]",modal)?.addEventListener("click",e=>{
      e.preventDefault();const b=DB.batches.find(x=>x.id===t.batch);b&&showBatchPopup(b);
    });
  }

}); // end DOMContentLoaded
