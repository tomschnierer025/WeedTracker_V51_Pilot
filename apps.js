/* WeedTracker V52.1 – App logic (navigation, jobs, records, batches, map, photo, auto-name) */

const ui = {
  nav(id){
    // show/hide
    document.querySelectorAll('section.panel').forEach(s=>s.hidden=true);
    if(id==='homeTiles'){ /* just return to tiles */ }
    else document.getElementById(id).hidden=false;

    localStorage.setItem('wt:last', id);
    if(id==='create') ui.refreshCreate();
    if(id==='records') records.render();
    if(id==='batches'){ batches.ensureRows(); batches.render(); }
    if(id==='inventory'){ inventory.render(); }
    if(id==='procurement'){ inventory.renderProc(); }
    if(id==='weeds') weeds.render();
    if(id==='map') mapView.initOnce();
    if(id==='reminders') reminders.render();
  },
  start(){
    // Splash fade after 2.2s
    setTimeout(()=>document.getElementById('splash').classList.add('hide'),2200);

    // Seed data
    weeds.ensureSeeded();
    inventory.ensureSeeded();
    batches.ensureRows();
    ui.populateWeeds();
    ui.populateBatches();
    ui.fillWeeksSpinner();

    // Last page or default home
    ui.nav(localStorage.getItem('wt:last')||'homeTiles');

    // Badge
    reminders.updateBadge();

    // Demo once for first look
    if(!localStorage.getItem('wt:demoSeeded')){
      dataTools.seedDemo();
      localStorage.setItem('wt:demoSeeded','1');
      ui.populateBatches();
    }
  },
  populateWeeds(){
    const list = weeds.getAll();
    const sel = document.getElementById('weedSelect');
    sel.innerHTML = list.map(w=>`<option>${w.name}</option>`).join('');
    document.getElementById('fWeed').innerHTML =
      `<option value="">All weeds</option>` + list.map(w=>`<option value="${w.name}">${w.name}</option>`).join('');
  },
  populateBatches(){
    const b = store.get('wt:batches');
    const sel = document.getElementById('batchSelect');
    sel.innerHTML = `<option value="">— None —</option>` + b.map(x=>`<option value="${x.id}">Batch #${x.id} (${x.totalL}L, rem ${x.remaining}L)</option>`).join('');
  },
  refreshCreate(){
    // default start time now local
    const start = document.getElementById('startTime');
    if(!start.value){ const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); start.value=d.toISOString().slice(0,16); }
    jobs.autoName();
  },
  fillWeeksSpinner(){
    const sel = document.getElementById('followWeeks'); if(!sel) return;
    let opts = '<option value="0">No reminder</option>';
    for(let i=1;i<=52;i++) opts += `<option value="${i}">${i} week${i>1?'s':''}</option>`;
    sel.innerHTML = opts;
  },
  busy(on){ document.getElementById('busy').hidden = !on; },
  toast(msg){ alert(msg); } // kept simple & reliable
};

/* GEO & weather */
const geo = {
  last:null,
  capture(){
    if(!navigator.geolocation){ ui.toast('Location not supported'); return; }
    navigator.geolocation.getCurrentPosition(pos=>{
      geo.last = {lat:pos.coords.latitude, lng:pos.coords.longitude};
      ui.toast(`📍 ${geo.last.lat.toFixed(5)}, ${geo.last.lng.toFixed(5)}`);
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
        const box = document.getElementById('weatherBox');
        box.textContent = `Temp ${w.temperature}°C, Wind ${w.windspeed} km/h`;
      },()=>ui.toast('GPS required for weather'));
    }catch(e){ ui.toast('Weather error'); }
  }
};

/* Jobs & Records */
const jobs = {
  _photoData:null,

  handlePhoto(input){
    const file = input.files?.[0]; if(!file) return;
    const img = new Image(); const reader = new FileReader();
    reader.onload = e=>{
      img.onload = ()=>{
        // resize to max 1280px width
        const canvas = document.createElement('canvas');
        const maxW = 1280; const scale = Math.min(1, maxW/img.width);
        canvas.width = Math.round(img.width*scale);
        canvas.height = Math.round(img.height*scale);
        const ctx = canvas.getContext('2d'); ctx.drawImage(img,0,0,canvas.width,canvas.height);
        jobs._photoData = canvas.toDataURL('image/jpeg',0.8);
        const prev = document.getElementById('photoPreview');
        prev.src = jobs._photoData; prev.hidden=false;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  autoName(){
    const type = document.getElementById('jobType').value;
    const loc = (document.getElementById('location').value||'').trim().replace(/\s+/g,'');
    let start = document.getElementById('startTime').value;
    if(!start){ const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); start=d.toISOString().slice(0,16); }
    const dt = start.replace(/[-:T]/g,'').slice(0,12); // YYYYMMDDHHMM
    const code = type==='Roadside Spray'?'ROAD':(type==='Spot Spray'?'SPOT':'INSP');
    document.getElementById('jobName').value = `${code}-${loc||'LOC'}-${dt}`;
  },

  save(status){
    ui.busy(true);
    setTimeout(()=>{ // simulate spinner/processing
      const job = {
        id: Date.now(),
        name: document.getElementById('jobName').value,
        councilNo: document.getElementById('councilNo').value.trim(),
        type: document.getElementById('jobType').value,
        location: document.getElementById('location').value || 'Unknown',
        start: document.getElementById('startTime').value || null,
        stop: document.getElementById('stopTime').value || null,
        weed: document.getElementById('weedSelect').value || '',
        batchId: document.getElementById('batchSelect').value || '',
        notes: document.getElementById('notes').value || '',
        lat: geo.last?.lat ?? null,
        lng: geo.last?.lng ?? null,
        photo: jobs._photoData || null,
        status,
        createdAt: new Date().toISOString()
      };

      // Update mode (no duplicates)
      const editId = localStorage.getItem('wt:editId');
      if(editId){
        let arr = store.get('wt:jobs'); const idx = arr.findIndex(x=>x.id==editId);
        if(idx>-1){ job.id = +editId; arr[idx]=job; store.set('wt:jobs',arr); }
        localStorage.removeItem('wt:editId');
      }else{
        store.push('wt:jobs', job);
      }

      // Link job to batch
      if(job.batchId){
        const all = store.get('wt:batches');
        const b = all.find(x=>x.id==job.batchId);
        if(b){
          b.jobIds = b.jobIds||[];
          if(!b.jobIds.includes(job.id)) b.jobIds.push(job.id);
          store.set('wt:batches', all);
        }
      }

      // Follow-up reminder spinner
      const weeks = parseInt(document.getElementById('followWeeks').value||'0',10);
      if(weeks>0){
        const due = new Date(Date.now() + weeks*7*24*3600*1000);
        reminders.addSilent(`Follow-up: ${job.name}`, due.toISOString());
      }

      ui.populateBatches();
      ui.busy(false);
      ui.toast(status==='draft'?'📝 Draft saved':'✅ Saved');
      records.render();
    }, 600);
  }
};

const records = {
  search(){
    ui.busy(true);
    setTimeout(()=>{records.render(); ui.busy(false);}, 400);
  },
  filter(){
    const type   = document.getElementById('fType').value;
    const status = document.getElementById('fStatus').value;
    const weed   = document.getElementById('fWeed').value;
    const from   = document.getElementById('fFrom').value;
    const to     = document.getElementById('fTo').value;
    const q      = (document.getElementById('fQuery').value||'').toLowerCase();

    return store.get('wt:jobs').filter(j=>{
      if(type && j.type!==type) return false;
      if(status && j.status!==status) return false;
      if(weed && j.weed!==weed) return false;
      if(from && new Date(j.createdAt) < new Date(from)) return false;
      if(to   && new Date(j.createdAt) > new Date(to+'T23:59:59')) return false;
      if(q && !(`${j.name} ${j.location}`.toLowerCase().includes(q))) return false;
      return true;
    });
  },
  render(){
    const list = document.getElementById('recordsList'); list.innerHTML='';
    const rows = records.filter();
    if(rows.length===0){ list.innerHTML='<div class="card">No records.</div>'; return; }
    rows.forEach(r=>{
      const card = document.createElement('div'); card.className='card';
      const tags = `
        <span class="tag">${r.type}</span>
        <span class="tag">${r.status}</span>
        ${r.weed?`<span class="tag">${r.weed}</span>`:''}
        ${r.batchId?`<span class="tag">Batch #${r.batchId}</span>`:''}
      `;
      card.innerHTML = `
        <div class="row"><strong>${r.name}</strong> — ${r.location}</div>
        <div class="row">${tags}</div>
        <div class="row">Start: ${r.start||'—'} &nbsp; Stop: ${r.stop||'—'}</div>
        ${r.photo?`<div class="row"><img class="thumb" src="${r.photo}"></div>`:''}
        <div class="row">
          <button class="btn small blue" onclick="mapView.center(${r.lat||'null'},${r.lng||'null'})">🧭 Navigate</button>
          <button class="btn small gold" onclick="records.edit(${r.id})">✏️ Edit</button>
          <button class="btn small gray" onclick="records.remove(${r.id})">🗑️ Delete</button>
        </div>`;
      list.appendChild(card);
    });
  },
  edit(id){
    const all = store.get('wt:jobs'); const r = all.find(x=>x.id===id); if(!r) return;
    document.getElementById('jobType').value = r.type;
    document.getElementById('location').value = r.location;
    document.getElementById('startTime').value = r.start||'';
    document.getElementById('stopTime').value = r.stop||'';
    document.getElementById('weedSelect').value = r.weed||'';
    document.getElementById('batchSelect').value = r.batchId||'';
    document.getElementById('notes').value = r.notes||'';
    document.getElementById('councilNo').value = r.councilNo||'';
    document.getElementById('jobName').value = r.name||'';
    geo.last = (r.lat&&r.lng)?{lat:r.lat,lng:r.lng}:null;
    localStorage.setItem('wt:editId', id);
    ui.nav('create');
  },
  remove(id){
    store.set('wt:jobs', store.get('wt:jobs').filter(x=>x.id!==id));
    ui.toast('Deleted'); records.render(); mapView.refresh();
  }
};

/* Batches (up to 10 chemicals) */
const batches = {
  ensureRows(){
    const cont = document.getElementById('chemRows'); if(!cont) return;
    if(!cont.children.length){ for(let i=0;i<4;i++) batches.addRow(); }
    batches.updateRowCount();
  },
  addRow(){
    const cont = document.getElementById('chemRows');
    if(cont.children.length>=10){ ui.toast('Max 10 chemicals'); return; }
    const idx = cont.children.length+1;
    const row = document.createElement('div'); row.className='chemRow';
    row.innerHTML = `
      <select class="chemName">${inventory.optionsHtml()}</select>
      <input class="chemRate" type="number" min="0" step="0.01" placeholder="Rate per 100L">
    `;
    cont.appendChild(row); batches.updateRowCount();
  },
  resetRows(){
    const cont = document.getElementById('chemRows'); cont.innerHTML=''; batches.ensureRows();
  },
  updateRowCount(){
    const c = document.getElementById('chemRowCount');
    if(c){ c.textContent = `${document.getElementById('chemRows').children.length}/10`; }
  },
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

    const batch = { id, totalL, remaining: totalL, chems: breakdown, jobIds: [], createdAt: new Date().toISOString() };
    const all = store.get('wt:batches'); all.push(batch); store.set('wt:batches', all);
    ui.toast(`Batch #${id} added`); inventory.render(); inventory.renderProc(); ui.populateBatches(); batches.render();
  },
  render(){
    const list = document.getElementById('batchList'); list.innerHTML='';
    const q = (document.getElementById('batchSearch')?.value||'').toLowerCase();
    const all = store.get('wt:batches').filter(b=> !q || (b.id+'').toLowerCase().includes(q));
    if(all.length===0){ list.innerHTML='<div class="card">No batches yet.</div>'; return; }
    all.forEach(b=>{
      const red = b.remaining<=0 ? 'style="border:1px solid #a33"' : '';
      const chems = b.chems.map(c=>`<div class="row">• ${c.name}: ${c.rate||0}/100L → total ${c.totalUsed.toFixed(2)}</div>`).join('');
      const links = (b.jobIds||[]).map(id=>`<span class="tag">Job ${id}</span>`).join(' ');
      const card = document.createElement('div'); card.className='card';
      if(red) card.setAttribute('style','border:1px solid #a33');
      card.innerHTML = `
        <div class="row"><strong>Batch #${b.id}</strong> &nbsp; Total: ${b.totalL}L &nbsp; Remaining: ${b.remaining}L</div>
        ${chems}
        <div class="row">${links || '<span class="tag">No linked jobs yet</span>'}</div>
        <div class="row">
          <button class="btn small gray" onclick="batches.consume('${b.id}',100)">Use 100L</button>
          <input id="dec-${b.id}" type="number" min="1" step="1" placeholder="L">
          <button class="btn small gray" onclick="batches.consume('${b.id}', Number(document.getElementById('dec-${b.id}').value||0))">Use custom</button>
        </div>`;
      list.appendChild(card);
    });
  },
  consume(id, amount){
    if(!amount) return;
    const all = store.get('wt:batches'); const b = all.find(x=>x.id==id); if(!b) return;
    b.remaining = Math.max(0, b.remaining-amount);
    store.set('wt:batches', all); batches.render();
  }
};

/* Inventory & Procurement */
const inventory = {
  ensureSeeded(){
    if(!localStorage.getItem('wt:chem')){
      const seed = chemicalsSeed(); // from storage.js
      store.set('wt:chem', seed);
    }
  },
  optionsHtml(){
    return store.get('wt:chem').map(c=>`<option value="${c.name}">${c.name}</option>`).join('');
  },
  add(){
    const name = document.getElementById('invName').value.trim();
    const active = document.getElementById('invActive').value.trim();
    const qty = Number(document.getElementById('invQty').value||0);
    if(!name) return ui.toast('Name required');
    const list = store.get('wt:chem');
    const ex = list.find(x=>x.name.toLowerCase()===name.toLowerCase());
    if(ex){ ex.qty = (ex.qty||0) + qty; if(active) ex.active = active; }
    else list.push({name, active, qty});
    store.set('wt:chem', list);
    inventory.render();
  },
  deduct(name, amount){
    const list = store.get('wt:chem');
    const ex = list.find(x=>x.name===name);
    if(ex){ ex.qty = Math.max(0,(ex.qty||0) - amount); }
    store.set('wt:chem', list);
    inventory.render(); inventory.renderProc();
  },
  applyThreshold(){
    const th = Number(document.getElementById('lowStock').value||0);
    store.set('wt:low', th);
    inventory.renderProc(); ui.toast('Threshold set');
  },
  render(){
    const list = document.getElementById('inventoryList'); list.innerHTML='';
    const data = store.get('wt:chem');
    if(data.length===0){ list.innerHTML='<div class="card">No chemicals.</div>'; return; }
    data.forEach(c=>{
      const card = document.createElement('div'); card.className='card';
      card.innerHTML = `<div class="row"><strong class="chem-link" onclick="inventory.show('${c.name.replace(/'/g,"\\'")}')">${c.name}</strong> — ${c.active||'—'} — Qty: ${(+c.qty).toFixed(2)}</div>`;
      list.appendChild(card);
    });
  },
  renderProc(){
    const list = document.getElementById('procList'); if(!list) return; list.innerHTML='';
    const th = Number(store.get('wt:low')||0);
    const data = store.get('wt:chem').filter(c=> th>0 && (c.qty||0) <= th*5); // rough “drums” heuristic
    if(data.length===0){ list.innerHTML='<div class="card">Nothing to reorder.</div>'; return; }
    data.forEach(c=>{
      const card = document.createElement('div'); card.className='card';
      card.innerHTML = `<div class="row">🛒 <strong>${c.name}</strong> — ${(+c.qty).toFixed(2)} left (threshold ≈ ${th} drums)</div>`;
      list.appendChild(card);
    });
  },
  show(name){
    const c = store.get('wt:chem').find(x=>x.name===name); if(!c) return;
    const used = (store.get('wt:batches')||[])
      .filter(b=> (b.chems||[]).some(ch=>ch.name===name))
      .map(b=>`Batch #${b.id}: ${(b.chems.find(ch=>ch.name===name).totalUsed).toFixed(2)} used`).join('<br>') || '—';
    const body = document.getElementById('modalBody');
    body.innerHTML = `
      <h3>${c.name}</h3>
      <p><b>Active:</b> ${c.active||'—'}</p>
      <p><b>In stock:</b> ${(+c.qty).toFixed(2)}</p>
      <p><b>Usage:</b><br>${used}</p>
      <div class="row-inline">
        <input id="chemAdj" type="number" step="0.1" placeholder="Qty">
        <button class="btn small teal" onclick="inventory.adjust('${c.name}', +document.getElementById('chemAdj').value)">➕ Add</button>
        <button class="btn small orange" onclick="inventory.adjust('${c.name}', -Math.abs(+document.getElementById('chemAdj').value||0))">➖ Use</button>
        <button class="btn small gray" onclick="modal.hide()">✖ Close</button>
      </div>`;
    modal.show();
  },
  adjust(name, delta){
    if(!delta) return;
    const list = store.get('wt:chem');
    const ex = list.find(x=>x.name===name); if(!ex) return;
    ex.qty = Math.max(0,(ex.qty||0)+delta);
    store.set('wt:chem', list);
    modal.hide(); inventory.render(); inventory.renderProc();
  }
};

/* Weeds */
const weeds = {
  ensureSeeded(){ if(!localStorage.getItem('wt:weeds')) store.set('wt:weeds', weedsSeed()); },
  getAll(){ return store.get('wt:weeds'); },
  render(){
    const list = document.getElementById('weedList'); list.innerHTML='';
    const data = weeds.getAll().slice().sort((a,b)=> (b.noxious?1:0)-(a.noxious?1:0) || a.name.localeCompare(b.name));
    data.forEach(w=>{
      const card = document.createElement('div'); card.className='card';
      card.innerHTML = `<div class="row">${w.noxious? '🚨 NOXIOUS — ' : ''}<strong>${w.name}</strong></div>`;
      list.appendChild(card);
    });
  }
};

/* Map */
const mapView = {
  map:null, markers:[],
  initOnce(){
    if(!mapView.map){
      mapView.map = L.map('mapCanvas',{zoomControl:true});
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19, attribution:'© OpenStreetMap'}).addTo(mapView.map);
      if(navigator.geolocation){
        navigator.geolocation.getCurrentPosition(pos=> mapView.map.setView([pos.coords.latitude,pos.coords.longitude], 13),
          ()=> mapView.map.setView([-33.8688,151.2093], 11));
      }else mapView.map.setView([-33.8688,151.2093], 11);
    }
    mapView.refresh();
  },
  color(t){ return t==='Roadside Spray'?'yellow':(t==='Spot Spray'?'green':'blue'); },
  refresh(){
    // clear
    mapView.markers.forEach(m=>m.remove()); mapView.markers=[];
    const type = document.getElementById('mType').value;
    const status = document.getElementById('mStatus').value;
    const q = (document.getElementById('mQuery').value||'').toLowerCase();

    store.get('wt:jobs').forEach(j=>{
      if(type && j.type!==type) return;
      if(status && j.status!==status) return;
      if(q && !(`${j.name} ${j.location}`.toLowerCase().includes(q))) return;
      if(j.lat && j.lng){
        const m = L.circleMarker([j.lat,j.lng],{radius:7,color:mapView.color(j.type),fillOpacity:.8})
          .addTo(mapView.map)
          .bindPopup(`<b>${j.name}</b><br>${j.type} · ${j.status}<br>${j.location}<br>
          <button onclick="mapView.nav(${j.lat},${j.lng})">Navigate</button>`);
        mapView.markers.push(m);
      }
    });
  },
  center(lat,lng){ if(lat && lng && mapView.map){ mapView.map.setView([lat,lng], 15); } ui.nav('map'); },
  nav(lat,lng){ window.open(`https://maps.apple.com/?daddr=${lat},${lng}`,'_blank'); }
};

/* Modal helper */
const modal = {
  show(){ document.getElementById('modal').hidden=false; },
  hide(){ document.getElementById('modal').hidden=true; }
};

/* Simple storage wrapper */
const store = {
  get(k){ return JSON.parse(localStorage.getItem(k)||'[]'); },
  set(k,v){ localStorage.setItem(k, JSON.stringify(v)); },
  push(k,obj){ const arr = store.get(k); arr.push(obj); store.set(k,arr); }
};

window.addEventListener('load', ui.start);

