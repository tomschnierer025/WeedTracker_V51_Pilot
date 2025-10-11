/* WeedTracker Pilot V52 – core app (UI, jobs, records, batches, map, inventory) */

const ui = {
  nav(targetId){
    document.querySelectorAll('main, section.panel').forEach(el=> el.hidden = true);
    const el = document.getElementById(targetId);
    if(el) el.hidden = false;
    localStorage.setItem('wt:last', targetId);

    // page hooks
    if(targetId==='create') ui.refreshCreate();
    if(targetId==='records') records.render();
    if(targetId==='batches'){ batches.ensureRows(); batches.render(); }
    if(targetId==='inventory') inventory.render();
    if(targetId==='procurement') inventory.renderProc();
    if(targetId==='map') mapView.initOnce();
    if(targetId==='reminders') reminders.render();
  },

  start(){
    // splash
    setTimeout(()=> document.getElementById('splash').classList.add('hide'), 1800);

    // seed
    weeds.ensureSeeded();
    inventory.ensureSeeded();
    batches.ensureRows();
    ui.populateWeeds();
    ui.populateBatches();
    ui.fillWeeksSpinner();

    // last page or home
    const last = localStorage.getItem('wt:last') || 'home';
    ui.nav(last);

    reminders.askPermission();
    reminders.updateBadge && reminders.updateBadge();
  },

  refreshCreate(){
    // default start time now
    const start = document.getElementById('startTime');
    if(!start.value){
      const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
      start.value = d.toISOString().slice(0,16);
    }
    jobs.autoName();
  },

  populateWeeds(){
    const list = weeds.getGrouped(); // noxious first
    const weedSel = document.getElementById('weedSelect');
    const rWeed = document.getElementById('rWeed');
    const mWeed = document.getElementById('mWeed');

    const options = (arr)=> arr.map(w=>`<option value="${w.name}">${w.name}</option>`).join('');

    weedSel.innerHTML = options(list);
    rWeed.innerHTML   = `<option value="">All weeds</option>` + options(list);
    mWeed.innerHTML   = `<option value="">All weeds</option>` + options(list);
  },

  populateBatches(){
    const sel = document.getElementById('batchSelect');
    const all = store.get('wt:batches');
    sel.innerHTML = `<option value="">— None —</option>` + all.map(b=>`<option value="${b.id}">#${b.id} (${b.remaining} / ${b.totalL} L)</option>`).join('');
  },

  fillWeeksSpinner(){
    const sel = document.getElementById('followWeeks');
    let html = '<option value="0">No reminder</option>';
    for(let i=1;i<=52;i++) html += `<option value="${i}">${i}</option>`;
    sel.innerHTML = html;
  },

  toggleTimeRow(){
    // nothing fancy for now (all jobs can have start/stop)
  },

  quickNewBatch(){
    ui.nav('batches');
    alert('Create a new batch here. It will appear in the job batch dropdown automatically.');
  },

  busy(on){ document.getElementById('busy').hidden = !on; },

  toast(msg){ alert(msg); },

  showModal(html){
    const body = document.getElementById('modalBody');
    body.innerHTML = html;
    document.getElementById('modal').hidden = false;
  },
  hideModal(){ document.getElementById('modal').hidden = true; }
};

/* GEO & Weather */
const geo = {
  last:null,
  capture(){
    if(!navigator.geolocation){ ui.toast('Location not supported'); return; }
    navigator.geolocation.getCurrentPosition(pos=>{
      geo.last = {lat:pos.coords.latitude, lng:pos.coords.longitude};
      document.getElementById('gpsText').textContent = `${geo.last.lat.toFixed(5)}, ${geo.last.lng.toFixed(5)}`;
      jobs.autoName();
    },()=>ui.toast('Could not get GPS'));
  }
};

const weather = {
  async fetchNow(){
    try{
      if(!navigator.geolocation) throw new Error('No geolocation');
      navigator.geolocation.getCurrentPosition(async pos=>{
        const {latitude, longitude} = pos.coords;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
        const r = await fetch(url); const j = await r.json();
        const w = j.current_weather;
        const text = `Temp ${w.temperature}°C, Wind ${w.windspeed} km/h, Dir ${w.winddirection}°`;
        document.getElementById('weatherBox').textContent = text;
      },()=>ui.toast('GPS required for weather'));
    }catch(e){ ui.toast('Weather error'); }
  }
};

/* Jobs + records */
const jobs = {
  _photo:null,

  handlePhoto(input){
    const f = input.files?.[0]; if(!f) return;
    const reader = new FileReader();
    reader.onload = e=>{
      const img = new Image();
      img.onload = ()=>{
        const c = document.createElement('canvas');
        const maxW = 1280, s = Math.min(1, maxW/img.width);
        c.width = Math.round(img.width*s); c.height = Math.round(img.height*s);
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        jobs._photo = c.toDataURL('image/jpeg', .8);
        const prev = document.getElementById('photoPreview');
        prev.src = jobs._photo; prev.hidden=false;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(f);
  },

  autoName(){
    const type = document.getElementById('jobType').value;
    const loc = (document.getElementById('location').value||'').trim().replace(/\s+/g,'');
    let start = document.getElementById('startTime').value;
    if(!start){ const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); start=d.toISOString().slice(0,16); }
    const dt = start.replace(/[-:T]/g,'').slice(0,8); // YYYYMMDD
    const code = type==='Road Spray'?'R':(type==='Spot Spray'?'S':'I');
    document.getElementById('jobName').value = `${loc||'LOC'} ${dt} ${code}`;
  },

  linkBothWays(job, linkedNamesOrIds){
    if(!linkedNamesOrIds) return;
    const tokens = linkedNamesOrIds.split(',').map(s=>s.trim()).filter(Boolean);
    if(tokens.length===0) return;
    const all = store.get('wt:jobs');
    job.linked = job.linked || [];
    tokens.forEach(tok=>{
      const match = all.find(j=> (j.id+''===tok) || (j.name===tok));
      if(match){
        if(!job.linked.includes(match.id)) job.linked.push(match.id);
        match.linked = match.linked||[];
        if(!match.linked.includes(job.id)) match.linked.push(job.id);
      }
    });
    store.set('wt:jobs', all);
  },

  save(status){
    ui.busy(true);
    setTimeout(()=>{
      const job = {
        id: Date.now(),
        name: document.getElementById('jobName').value.trim(),
        councilNo: document.getElementById('councilNo').value.trim(),
        type: document.getElementById('jobType').value,
        location: document.getElementById('location').value.trim() || 'Unknown',
        start: document.getElementById('startTime').value || null,
        stop: document.getElementById('stopTime').value || null,
        weed: document.getElementById('weedSelect').value || '',
        batchId: document.getElementById('batchSelect').value || '',
        notes: document.getElementById('notes').value || '',
        lat: geo.last?.lat ?? null,
        lng: geo.last?.lng ?? null,
        photo: jobs._photo || null,
        status,
        createdAt: new Date().toISOString(),
        lastEdited: new Date().toISOString(),
        linked: []
      };

      const editId = localStorage.getItem('wt:editId');
      if(editId){
        let arr = store.get('wt:jobs'); const i = arr.findIndex(x=>x.id==editId);
        if(i>-1){ job.id = +editId; job.createdAt = arr[i].createdAt; arr[i]=job; store.set('wt:jobs', arr); }
        localStorage.removeItem('wt:editId');
      }else{
        store.push('wt:jobs', job);
      }

      // link both ways (inspections -> jobs etc.)
      jobs.linkBothWays(job, document.getElementById('linkedJobs').value);

      // link job to batch
      if(job.batchId){
        const all = store.get('wt:batches');
        const b = all.find(x=>x.id==job.batchId);
        if(b){
          b.jobIds = b.jobIds||[];
          if(!b.jobIds.includes(job.id)) b.jobIds.push(job.id);
          store.set('wt:batches', all);
        }
      }

      // reminder
      const weeks = parseInt(document.getElementById('followWeeks').value||'0',10);
      if(weeks>0){
        const due = new Date(Date.now() + weeks*7*24*3600*1000).toISOString();
        reminders.addSilent(`Follow-up: ${job.name}`, due);
      }

      ui.populateBatches();
      ui.busy(false);
      ui.toast(status==='draft'?'📝 Draft saved':'✅ Saved');
      records.render();
      mapView.refresh();
      ui.nav('records');
    }, 500);
  }
};

const records = {
  filter(){
    const type = document.getElementById('rType').value;
    const status = document.getElementById('rStatus').value;
    const weed = document.getElementById('rWeed').value;
    const from = document.getElementById('rFrom').value;
    const to   = document.getElementById('rTo').value;
    const q = (document.getElementById('rQuery').value||'').toLowerCase();

    return store.get('wt:jobs').filter(j=>{
      if(type && j.type!==type) return false;
      if(status && j.status!==status) return false;
      if(weed && j.weed!==weed) return false;
      if(from && new Date(j.createdAt) < new Date(from)) return false;
      if(to   && new Date(j.createdAt) > new Date(to+'T23:59:59')) return false;
      if(q && !(`${j.name} ${j.location}`.toLowerCase().includes(q))) return false;
      return true;
    }).sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
  },

  render(){
    const list = document.getElementById('recordsList'); list.innerHTML='';
    const rows = records.filter();
    if(rows.length===0){ list.innerHTML = '<div class="card">No records.</div>'; return; }
    rows.forEach(r=>{
      const card = document.createElement('div'); card.className='card';
      card.innerHTML = `
        <div class="row">
          <strong>${r.name}</strong>
          <span class="tag">${r.type}</span>
          <span class="tag">${r.status}</span>
          ${r.weed?`<span class="tag">${r.weed}</span>`:''}
        </div>
        <div class="row">
          <button class="btn small blue" onclick="records.open(${r.id})">Open</button>
        </div>`;
      list.appendChild(card);
    });
  },

  open(id){
    const j = store.get('wt:jobs').find(x=>x.id===id); if(!j) return;
    const linked = (j.linked||[]).map(k=>{
      const t = store.get('wt:jobs').find(x=>x.id===k);
      return t?`<button class="btn small gray" onclick="records.open(${t.id})">${t.name}</button>`:'';
    }).join(' ');

    const photo = j.photo? `<img class="thumb" src="${j.photo}"/>` : '';
    const batchBtn = j.batchId? `<button class="btn small teal" onclick="batches.open('${j.batchId}')">Batch #${j.batchId}</button>`:'<span class="muted">No batch</span>';
    const navBtn = (j.lat && j.lng)? `<button class="btn small blue" onclick="mapView.nav(${j.lat},${j.lng})">🧭 Navigate</button>` : '';

    ui.showModal(`
      <h3>${j.name}</h3>
      <div class="row">
        <span class="tag">${j.type}</span>
        <span class="tag">${j.status}</span>
      </div>
      <p><b>Weed:</b> ${j.weed||'—'}</p>
      <p><b>Road/Location:</b> ${j.location}</p>
      <p><b>Weather:</b> ${document.getElementById('weatherBox')?.textContent||'—'}</p>
      <p><b>Batch:</b> ${batchBtn}</p>
      <p><b>Start:</b> ${j.start||'—'} &nbsp; <b>Stop:</b> ${j.stop||'—'}</p>
      <p><b>Council #:</b> ${j.councilNo||'—'}</p>
      <p><b>Notes:</b> ${j.notes||'—'}</p>
      <p><b>Linked Jobs:</b> ${linked || '—'}</p>
      ${photo}
      <div class="row">
        <button class="btn small gold" onclick="records.edit(${j.id})">✏️ Edit</button>
        <button class="btn small gray" onclick="records.remove(${j.id})">🗑️ Delete</button>
        ${navBtn}
        <button class="btn small" onclick="ui.hideModal()">Close</button>
      </div>
      <div class="muted">Last edited: ${new Date(j.lastEdited||j.createdAt).toLocaleString()}</div>
    `);
  },

  edit(id){
    const r = store.get('wt:jobs').find(x=>x.id===id); if(!r) return;
    document.getElementById('jobType').value = r.type;
    document.getElementById('location').value = r.location;
    document.getElementById('startTime').value = r.start||'';
    document.getElementById('stopTime').value = r.stop||'';
    document.getElementById('weedSelect').value = r.weed||'';
    document.getElementById('batchSelect').value = r.batchId||'';
    document.getElementById('notes').value = r.notes||'';
    document.getElementById('councilNo').value = r.councilNo||'';
    document.getElementById('jobName').value = r.name||'';
    document.getElementById('linkedJobs').value = (r.linked||[]).map(id=>{
      const t = store.get('wt:jobs').find(x=>x.id===id);
      return t? t.name : id;
    }).join(', ');
    geo.last = (r.lat&&r.lng)?{lat:r.lat,lng:r.lng}:null;
    localStorage.setItem('wt:editId', id);
    ui.hideModal();
    ui.nav('create');
  },

  remove(id){
    if(!confirm('Delete this record?')) return;
    store.set('wt:jobs', store.get('wt:jobs').filter(x=>x.id!==id));
    ui.hideModal();
    records.render(); mapView.refresh();
  }
};

/* Batches */
const batches = {
  ensureRows(){
    const c = document.getElementById('chemRows'); if(!c) return;
    if(!c.children.length){ for(let i=0;i<4;i++) batches.addRow(); }
    batches.updateRowCount();
  },
  addRow(){
    const cont = document.getElementById('chemRows');
    if(cont.children.length>=10){ ui.toast('Max 10 chemicals'); return; }
    const row = document.createElement('div'); row.className='chemRow';
    row.innerHTML = `
      <select class="chemName">${inventory.optionsHtml()}</select>
      <input class="chemRate" type="number" min="0" step="0.01" placeholder="Rate per 100 L"/>
    `;
    cont.appendChild(row); batches.updateRowCount();
  },
  resetRows(){
    const cont = document.getElementById('chemRows'); cont.innerHTML=''; batches.ensureRows();
  },
  updateRowCount(){ const c=document.getElementById('chemRowCount'); if(c) c.textContent = `${document.getElementById('chemRows').children.length}/10`; },
  add(){
    const id = (document.getElementById('batchNo').value || Date.now()).toString();
    const totalL = Number(document.getElementById('mixTotal').value||0);
    const rows = [...document.querySelectorAll('#chemRows .chemRow')];
    const ch = rows.map(r=>{
      const name = r.querySelector('.chemName').value;
      const rate = Number(r.querySelector('.chemRate').value||0);
      return name? {name, rate} : null;
    }).filter(Boolean);

    const breakdown = ch.map(c=>{
      const totalUsed = (c.rate||0) * (totalL/100);
      inventory.deduct(c.name, totalUsed);
      return {...c, totalUsed};
    });

    const batch = {
      id, totalL, remaining: totalL, chems: breakdown, jobIds: [],
      createdAt: new Date().toISOString(), lastEdited: new Date().toISOString()
    };
    const all = store.get('wt:batches'); all.push(batch); store.set('wt:batches', all);
    ui.toast(`Batch #${id} added`);
    inventory.render(); inventory.renderProc(); ui.populateBatches(); batches.render();
  },
  render(){
    const list = document.getElementById('batchList'); list.innerHTML='';
    const q=(document.getElementById('bQuery').value||'').toLowerCase();
    const from=document.getElementById('bFrom').value, to=document.getElementById('bTo').value;
    const all = store.get('wt:batches').filter(b=>{
      if(q && !(b.id+'').toLowerCase().includes(q)) return false;
      if(from && new Date(b.createdAt) < new Date(from)) return false;
      if(to && new Date(b.createdAt) > new Date(to+'T23:59:59')) return false;
      return true;
    }).sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
    if(all.length===0){ list.innerHTML='<div class="card">No batches yet.</div>'; return; }
    all.forEach(b=>{
      const card=document.createElement('div'); card.className='card';
      if(b.remaining<=0) card.style.border='1px solid #a33';
      card.innerHTML = `
        <div class="row"><strong>${b.id}</strong></div>
        <div class="row"><button class="btn small blue" onclick="batches.open('${b.id}')">Open</button></div>
      `;
      list.appendChild(card);
    });
  },
  open(id){
    const b = store.get('wt:batches').find(x=>x.id==id); if(!b) return;
    const chems = b.chems.map((c,i)=>`<div class="row"> ${i+1}️⃣ <b>${c.name}</b> — ${c.rate||0} / 100L → <b>${c.totalUsed.toFixed(2)}</b></div>`).join('');
    const links = (b.jobIds||[]).map(jid=>{
      const j = store.get('wt:jobs').find(x=>x.id===jid);
      return j? `<button class="btn small gray" onclick="records.open(${j.id})">${j.name}</button>`:'';
    }).join(' ');

    ui.showModal(`
      <h3>Batch #${b.id}</h3>
      <p><b>Created:</b> ${new Date(b.createdAt).toLocaleString()}</p>
      <p><b>Last Edited:</b> ${new Date(b.lastEdited||b.createdAt).toLocaleString()}</p>
      <p><b>Total Mix:</b> ${b.totalL} L &nbsp; <b>Remaining:</b> ${b.remaining} L</p>
      <h4>Chemicals</h4>
      ${chems || '<div class="muted">None</div>'}
      <h4>Linked Jobs</h4>
      <div class="row">${links || '<span class="muted">No linked jobs</span>'}</div>
      <div class="row">
        <button class="btn small gold" onclick="batches.consumePrompt('${b.id}')">Use (custom L)</button>
        <button class="btn small gray" onclick="ui.hideModal()">Close</button>
      </div>
    `);
  },
  consumePrompt(id){
    const v = Number(prompt('Litres to deduct?')||'0'); if(!v) return;
    const all = store.get('wt:batches'); const b = all.find(x=>x.id==id); if(!b) return;
    b.remaining = Math.max(0, b.remaining - v);
    b.lastEdited = new Date().toISOString();
    store.set('wt:batches', all);
    ui.hideModal(); batches.render();
  }
};

/* Inventory & procurement */
const inventory = {
  ensureSeeded(){ if(!localStorage.getItem('wt:chem')) store.set('wt:chem', chemicalsSeed()); },
  optionsHtml(){ return store.get('wt:chem').map(c=>`<option>${c.name}</option>`).join(''); },
  add(){
    const name=document.getElementById('invName').value.trim();
    const active=document.getElementById('invActive').value.trim();
    const qty=Number(document.getElementById('invQty').value||0);
    if(!name) return ui.toast('Chemical name required');
    const list=store.get('wt:chem'); const ex=list.find(x=>x.name.toLowerCase()===name.toLowerCase());
    if(ex){ ex.qty=(ex.qty||0)+qty; if(active) ex.active=active; }
    else list.push({name,active,qty});
    store.set('wt:chem', list); inventory.render();
  },
  deduct(name, amount){
    const list=store.get('wt:chem'); const ex=list.find(x=>x.name===name);
    if(ex){ ex.qty=Math.max(0,(ex.qty||0)-amount); }
    store.set('wt:chem', list); inventory.render(); inventory.renderProc();
  },
  applyThreshold(){
    const th=Number(document.getElementById('lowStock').value||0);
    store.set('wt:low', th); inventory.renderProc(); ui.toast('Threshold set');
  },
  render(){
    const list = document.getElementById('inventoryList'); list.innerHTML='';
    const data = store.get('wt:chem');
    if(data.length===0){ list.innerHTML='<div class="card">No chemicals.</div>'; return; }
    data.forEach(c=>{
      const card = document.createElement('div'); card.className='card';
      card.innerHTML = `
        <div class="row">
          <strong class="chem-link" onclick="inventory.show('${c.name.replace(/'/g,"\\'")}')">${c.name}</strong>
          <span class="tag">${c.active||'—'}</span>
          <span class="tag">Qty: ${(c.qty||0).toFixed(2)}</span>
        </div>`;
      list.appendChild(card);
    });
  },
  renderProc(){
    const list = document.getElementById('procList'); if(!list) return; list.innerHTML='';
    const th = Number(store.get('wt:low')||0);
    const data = store.get('wt:chem').filter(c=> th>0 && (c.qty||0) <= th*5);
    if(data.length===0){ list.innerHTML='<div class="card">Nothing to reorder.</div>'; return; }
    data.forEach(c=>{
      const card = document.createElement('div'); card.className='card';
      card.innerHTML = `🛒 <b>${c.name}</b> — ${(c.qty||0).toFixed(2)} left (threshold ≈ ${th} drums)`;
      list.appendChild(card);
    });
  },
  show(name){
    const c = store.get('wt:chem').find(x=>x.name===name); if(!c) return;
    const used = (store.get('wt:batches')||[])
      .filter(b=> (b.chems||[]).some(ch=>ch.name===name))
      .map(b=>`Batch #${b.id}: ${(b.chems.find(ch=>ch.name===name).totalUsed).toFixed(2)} used`).join('<br>') || '—';
    ui.showModal(`
      <h3>${c.name}</h3>
      <p><b>Active:</b> ${c.active||'—'}</p>
      <p><b>In stock:</b> ${(c.qty||0).toFixed(2)}</p>
      <p><b>Usage:</b><br>${used}</p>
      <div class="row-inline">
        <input id="chemAdj" type="number" step="0.1" placeholder="Qty"/>
        <button class="btn small teal" onclick="inventory.adjust('${c.name}', +document.getElementById('chemAdj').value)">➕ Add</button>
        <button class="btn small orange" onclick="inventory.adjust('${c.name}', -Math.abs(+document.getElementById('chemAdj').value||0))">➖ Use</button>
        <button class="btn small gray" onclick="ui.hideModal()">Close</button>
      </div>
    `);
  },
  adjust(name, delta){
    if(!delta) return;
    const list=store.get('wt:chem'); const ex=list.find(x=>x.name===name); if(!ex) return;
    ex.qty = Math.max(0,(ex.qty||0)+delta);
    store.set('wt:chem', list); ui.hideModal(); inventory.render(); inventory.renderProc();
  }
};

/* Weeds */
const weeds = {
  ensureSeeded(){ if(!localStorage.getItem('wt:weeds')) store.set('wt:weeds', weedsSeed()); },
  getAll(){ return store.get('wt:weeds'); },
  getGrouped(){
    const data = weeds.getAll();
    const nox = data.filter(w=>w.noxious).sort((a,b)=>a.name.localeCompare(b.name));
    const other = data.filter(w=>!w.noxious).sort((a,b)=>a.name.localeCompare(b.name));
    return [...nox, ...other];
  }
};

/* Map */
const mapView = {
  map:null, markers:[],
  initOnce(){
    if(!mapView.map){
      mapView.map = L.map('mapCanvas',{zoomControl:true});
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19, attribution:'© OpenStreetMap'}).addTo(mapView.map);
      mapView.locate(true);
    }
    ui.populateWeeds();
    mapView.refresh();
  },
  locate(first=false){
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(pos=>{
        mapView.map.setView([pos.coords.latitude,pos.coords.longitude], first? 13 : mapView.map.getZoom()||13);
      }, ()=> mapView.map.setView([-33.8688,151.2093], 11));
    }else mapView.map.setView([-33.8688,151.2093], 11);
  },
  color(t){ return t==='Road Spray'?'yellow':(t==='Spot Spray'?'green':'blue'); },
  refresh(){
    // clear
    mapView.markers.forEach(m=>m.remove()); mapView.markers=[];
    const type = document.getElementById('mType').value;
    const weed = document.getElementById('mWeed').value;
    const status = document.getElementById('mStatus').value;
    const batch = (document.getElementById('mBatch').value||'').trim();
    const from = document.getElementById('mFrom').value;
    const to   = document.getElementById('mTo').value;
    const q = (document.getElementById('mQuery').value||'').toLowerCase();

    store.get('wt:jobs').forEach(j=>{
      if(type && j.type!==type) return;
      if(status && j.status!==status) return;
      if(weed && j.weed!==weed) return;
      if(batch && j.batchId!==batch) return;
      if(from && new Date(j.createdAt) < new Date(from)) return;
      if(to && new Date(j.createdAt) > new Date(to+'T23:59:59')) return;
      if(q && !(`${j.name} ${j.location}`.toLowerCase().includes(q))) return;
      if(j.lat && j.lng){
        const m = L.circleMarker([j.lat,j.lng],{radius:7,color:mapView.color(j.type),fillOpacity:.85})
          .addTo(mapView.map)
          .bindPopup(`<b>${j.name}</b><br>${j.type} · ${j.status}<br>${j.location}<br>
          <button onclick="records.open(${j.id})">Open</button> &nbsp;
          <button onclick="mapView.nav(${j.lat},${j.lng})">Navigate</button>`);
        mapView.markers.push(m);
      }
    });
  },
  nav(lat,lng){ window.open(`https://maps.apple.com/?daddr=${lat},${lng}`,'_blank'); }
};

/* Storage helper */
const store = {
  get(k){ return JSON.parse(localStorage.getItem(k)||'[]'); },
  set(k,v){ localStorage.setItem(k, JSON.stringify(v)); },
  push(k,obj){ const arr = store.get(k); arr.push(obj); store.set(k,arr); }
};

window.addEventListener('load', ()=>{
  batches.ensureRows();
  ui.start();
});
