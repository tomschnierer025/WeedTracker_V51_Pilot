/* ===== WeedTracker V60 Pilot — apps.js ===== */
document.addEventListener('DOMContentLoaded', () => {
  const { toast, showSpinner, hideSpinner, ddmmyy, typeLetter,
          geolocate, reverseGeocode, getRoadFromGeocode,
          ensureWeedOptions, selectFill, newMap, uid } = WT;

  // ===== CREATE TASK =====
  const weedSel = document.getElementById('weedType');
  ensureWeedOptions(weedSel);

  function refreshBatchPicker(){
    const db = DB.get();
    selectFill(document.getElementById('taskBatch'), db.batches,
      b => `${b.id} • ${fmt(b.date)} • remain ${b.remaining} L`,
      b => b.id
    );
  }
  refreshBatchPicker();

  // date defaults
  const now = new Date();
  document.getElementById('dateInput').value = new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);

  // Geo + AutoName
  document.getElementById('btnLocate').addEventListener('click', async ()=>{
    try{
      const pos = await geolocate();
      $('#geoStatus').textContent = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
      const addr = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      const road = getRoadFromGeocode(addr);
      $('#jobName').placeholder = road;
      toast('Location found');
    }catch{ toast('Location failed'); }
  });

  document.getElementById('btnAutoName').addEventListener('click', ()=>{
    const road = ($('#jobName').placeholder || 'Road').replace(/\s+/g,'');
    const when = ddmmyy($('#dateInput').value || new Date());
    const t = $('#taskType').value || 'Inspection';
    const id = `${typeLetter(t)}${when}_${road}`;
    $('#jobName').value = id;
    toast('Auto-named');
  });

  // Auto weather (dummy fields – user can overwrite)
  $('#btnAutoWeather').addEventListener('click', ()=>{
    $('#wTemp').value = (18+Math.random()*8).toFixed(1);
    $('#wWind').value = (3+Math.random()*10).toFixed(1);
    $('#wDir').value  = Math.floor(Math.random()*360);
    $('#wHum').value  = (40+Math.random()*40).toFixed(0);
  });

  function fmt(d){ return new Date(d).toLocaleDateString('en-AU'); }

  // Save task
  $('#btnSaveTask').addEventListener('click', ()=>{
    const db = DB.get();
    const t = {
      id: $('#jobName').value || `${typeLetter($('#taskType').value)}${ddmmyy(new Date())}_Job`,
      name: $('#jobName').value || $('#jobName').placeholder || 'Job',
      councilJob: $('#councilJob').value.trim(),
      date: $('#dateInput').value || new Date().toISOString(),
      start: $('#startTime').value, finish: $('#finishTime').value,
      type: $('#taskType').value, weed: $('#weedType').value,
      batchId: $('#taskBatch').value || '',
      linkJobId: $('#linkJobId').value.trim(),
      mergeInspectionId: $('#mergeInspectionId').value.trim(),
      weather: { temp: $('#wTemp').value, wind: $('#wWind').value, dir: $('#wDir').value, hum: $('#wHum').value },
      notes: $('#notes').value, status: $('#status').value,
      reminderWeeks: $('#reminder').value,
      geo: $('#geoStatus').textContent
    };
    showSpinner('Saving task…');
    setTimeout(()=>{
      db.tasks.unshift(t);
      DB.set(db);
      hideSpinner();
      toast('Task saved');
      window.goto('records');
      renderRecords();
    }, 400);
  });

  $('#btnDraftTask').addEventListener('click', ()=>{
    toast('Draft saved (local only)');
  });

  // ===== RECORDS =====
  function matchesAll(task, q, type, from, to, status){
    const inQ = (s) => (s||'').toLowerCase().includes(q);
    const dateOk = (!from || new Date(task.date)>=new Date(from))
                && (!to || new Date(task.date)<=new Date(to));
    const typeOk = (type==='All' || task.type===type);
    const statusOk = (status==='All' || task.status===status);
    return dateOk && typeOk && statusOk &&
      (inQ(task.name) || inQ(task.weed) || inQ(task.councilJob) || inQ(task.batchId) || inQ(task.linkJobId));
  }

  function recCard(t){
    const div = document.createElement('div');
    div.className='list-card';
    div.innerHTML = `
      <div>
        <div class="list-title">${t.id || t.name}</div>
        <div class="list-sub">${t.type} • ${fmt(t.date)} • ${t.status}</div>
      </div>
      <div class="btn-row">
        <button class="btn primary" data-open="${t.id}">Open</button>
        <button class="btn" data-edit="${t.id}">Edit</button>
        <button class="btn danger" data-del="${t.id}">Delete</button>
      </div>`;
    return div;
  }

  function renderRecords(){
    const db = DB.get();
    const q = ($('#recSearch').value||'').toLowerCase();
    const type = $('#recType').value || 'All';
    const from = $('#recFrom').value || '';
    const to   = $('#recTo').value || '';
    const st   = $('#recStatus').value || 'All';

    const list = $('#recList'); list.innerHTML='';
    db.tasks.filter(t => matchesAll(t,q,type,from,to,st))
      .forEach(t => list.appendChild(recCard(t)));

    // wire buttons (OPEN/EDIT/DELETE – fixed)
    $$('#recList [data-open]').forEach(b=> b.onclick = ()=> openTask(b.dataset.open));
    $$('#recList [data-edit]').forEach(b=> b.onclick = ()=> editTask(b.dataset.edit));
    $$('#recList [data-del]').forEach(b=> b.onclick = ()=> deleteTask(b.dataset.del));
  }

  $('#btnRecSearch').addEventListener('click', renderRecords);
  $('#btnRecReset').addEventListener('click', ()=>{
    $('#recSearch').value=''; $('#recType').value='All'; $('#recFrom').value=''; $('#recTo').value=''; $('#recStatus').value='All';
    renderRecords();
  });

  function openTask(id){
    const db = DB.get();
    const t = db.tasks.find(x=> x.id===id);
    if (!t) return toast('Not found');
    const html = `
      <div class="row between"><h3>${t.id}</h3><button class="btn danger" data-close>Close</button></div>
      <div class="list-sub">Type: ${t.type} • ${fmt(t.date)} • ${t.status}</div>
      <div class="card soft" style="margin-top:.8rem">
        <div><b>Weather:</b> ${t.weather?.temp||'—'}°C, ${t.weather?.wind||'—'} km/h, ${t.weather?.dir||'—'}°, ${t.weather?.hum||'—'}%</div>
        <div><b>Batch:</b> ${t.batchId||'—'}</div>
        <div><b>Linked Inspection:</b> ${t.mergeInspectionId||'—'} &nbsp; <b>Reminder:</b> ${t.reminderWeeks||'—'} wk</div>
        <div><b>Notes:</b> ${t.notes||'—'}</div>
      </div>
      <div class="btn-row"><button class="btn" id="openEdit">Edit</button></div>`;
    const m = modal(html);
    $('#openEdit', m.el)?.addEventListener('click', ()=>{ m.close(); editTask(id); });
  }

  function editTask(id){
    const db = DB.get(); const t = db.tasks.find(x=> x.id===id); if(!t) return;
    window.goto('createTask');
    $('#jobName').value = t.id; $('#councilJob').value=t.councilJob||'';
    $('#dateInput').value = t.date.slice(0,16);
    $('#startTime').value = t.start||''; $('#finishTime').value=t.finish||'';
    $('#taskType').value=t.type; ensureWeedOptions($('#weedType')); $('#weedType').value=t.weed||'';
    refreshBatchPicker(); $('#taskBatch').value=t.batchId||'';
    $('#linkJobId').value=t.linkJobId||''; $('#mergeInspectionId').value=t.mergeInspectionId||'';
    $('#wTemp').value=t.weather?.temp||''; $('#wWind').value=t.weather?.wind||''; $('#wDir').value=t.weather?.dir||''; $('#wHum').value=t.weather?.hum||'';
    $('#notes').value=t.notes||''; $('#status').value=t.status||'';
    $('#reminder').value=t.reminderWeeks||'1';
    toast('Loaded for edit');
  }

  function deleteTask(id){
    const db = DB.get();
    const i = db.tasks.findIndex(x=> x.id===id);
    if (i>=0 && confirm('Delete this record?')){ db.tasks.splice(i,1); DB.set(db); renderRecords(); toast('Deleted'); }
  }

  renderRecords();

  // ===== INVENTORY =====
  function renderChemicals(){
    const db = DB.get();
    const host = $('#chemList'); host.innerHTML='';
    db.chemicals.forEach(c=>{
      const card = document.createElement('div');
      card.className='list-card';
      const total = (c.containerSize*c.containers) + ' ' + c.unit;
      card.innerHTML = `
        <div>
          <div class="list-title">${c.name}</div>
          <div class="list-sub">Containers: ${c.containers} × ${c.containerSize} ${c.unit} • total ${total}<br/>
            Active: ${c.active||'—'}</div>
        </div>
        <div class="btn-row">
          <button class="btn" data-edit="${c.id}">Edit</button>
          <button class="btn danger" data-del="${c.id}">Delete</button>
        </div>`;
      host.appendChild(card);
    });
    // wire
    $$('#chemList [data-edit]').forEach(b=> b.onclick = ()=> editChem(b.dataset.edit));
    $$('#chemList [data-del]').forEach(b=> b.onclick = ()=> delChem(b.dataset.del));
  }

  function editChem(id){
    const db = DB.get(); const c = db.chemicals.find(x=> x.id===id)||{id:uid('chem'),name:'',active:'',unit:'L',containerSize:'',containers:'',reorder:''};
    const m = modal(`
      <div class="row between"><h3>${c.id ? 'Edit Chemical' : 'Add Chemical'}</h3><button class="btn danger" data-close>Close</button></div>
      <div class="row three" style="margin-top:.7rem">
        <div class="col"><label class="lbl">Name</label><input id="cName" class="input" value="${c.name||''}"/></div>
        <div class="col"><label class="lbl">Active Ingredient</label><input id="cActive" class="input" value="${c.active||''}"/></div>
        <div class="col"><label class="lbl">Container Size</label><input id="cSize" class="input" inputmode="decimal" value="${c.containerSize||''}"/></div>
      </div>
      <div class="row three">
        <div class="col"><label class="lbl">Unit</label>
          <select id="cUnit" class="input">
            <option ${c.unit==='L'?'selected':''}>L</option>
            <option ${c.unit==='mL'?'selected':''}>mL</option>
            <option ${c.unit==='g'?'selected':''}>g</option>
            <option ${c.unit==='kg'?'selected':''}>kg</option>
          </select>
        </div>
        <div class="col"><label class="lbl">Containers</label><input id="cCount" class="input" inputmode="numeric" value="${c.containers||''}"/></div>
        <div class="col"><label class="lbl">Reorder Threshold (containers)</label><input id="cReorder" class="input" inputmode="numeric" value="${c.reorder||''}"/></div>
      </div>
      <div class="btn-row"><button id="cSave" class="btn primary">Save</button></div>
    `);
    $('#cSave', m.el).onclick = ()=>{
      const db2 = DB.get();
      const obj = {
        id: c.id || uid('chem'),
        name: $('#cName', m.el).value.trim(),
        active: $('#cActive', m.el).value.trim(),
        containerSize: parseFloat($('#cSize', m.el).value)||0,
        unit: $('#cUnit', m.el).value,
        containers: parseInt($('#cCount', m.el).value||'0',10),
        reorder: parseInt($('#cReorder', m.el).value||'0',10)
      };
      const i = db2.chemicals.findIndex(x=> x.id===obj.id);
      if (i>=0) db2.chemicals[i]=obj; else db2.chemicals.push(obj);
      DB.set(db2); m.close(); renderChemicals(); toast('Saved');
    };
  }

  function delChem(id){
    const db = DB.get(); const i = db.chemicals.findIndex(x=> x.id===id);
    if (i>=0 && confirm('Delete chemical?')){ db.chemicals.splice(i,1); DB.set(db); renderChemicals(); toast('Deleted'); }
  }

  $('#btnAddChem').addEventListener('click', ()=> editChem(''));
  renderChemicals();

  // ===== BATCHES =====
  function addChemLine(pref={}){
    const line = document.createElement('div');
    line.className='card soft';
    line.innerHTML = `
      <div class="row three">
        <div class="col"><label class="lbl">Chemical</label><select class="input chem-name"></select></div>
        <div class="col"><label class="lbl">Rate / 100L</label><input class="input chem-rate" inputmode="decimal" placeholder="e.g. 1.5"/></div>
        <div class="col"><label class="lbl">Unit</label>
          <select class="input chem-unit">
            <option>L</option><option>mL</option><option>g</option><option>kg</option>
          </select>
        </div>
      </div>
      <div class="row two">
        <div class="col"><label class="lbl">Calculated amount</label><input class="input chem-calc" disabled placeholder="0"/></div>
        <div class="col btn-row-right"><button class="btn danger chem-del">Remove</button></div>
      </div>
    `;
    // fill names from inventory
    const db = DB.get();
    selectFill(line.querySelector('.chem-name'), db.chemicals, c=>c.name, c=>c.id);
    if (pref.id) line.querySelector('.chem-name').value = pref.id;
    if (pref.rate) line.querySelector('.chem-rate').value = pref.rate;
    if (pref.unit) line.querySelector('.chem-unit').value = pref.unit;

    // interactions
    const recalc = ()=>{
      const total = parseFloat($('#batchTotal').value||'0');
      const rate = parseFloat(line.querySelector('.chem-rate').value||'0');
      const unit = line.querySelector('.chem-unit').value;
      const amount = (total/100)*rate;
      line.querySelector('.chem-calc').value = (isFinite(amount)? amount.toFixed(3):'0') + ' ' + unit;
      sumUp();
    };
    line.querySelector('.chem-rate').addEventListener('input', recalc);
    line.querySelector('.chem-unit').addEventListener('change', recalc);
    $('#chemLines').appendChild(line);
    line.querySelector('.chem-del').onclick = ()=> { line.remove(); sumUp(); };
    recalc();
  }

  function sumUp(){
    let used = 0;
    $$('#chemLines .chem-calc').forEach(i=>{
      const n = parseFloat(i.value)||0;
      used += n;
    });
    const total = parseFloat($('#batchTotal').value||'0');
    $('#sumUsed').textContent = (isFinite(used)? used.toFixed(3):'0.000') + ' L';
    $('#sumRemain').textContent = (isFinite(total-used)? (total-used).toFixed(0):'0') + ' L';
  }

  $('#btnAddLine').addEventListener('click', ()=> addChemLine());
  $('#batchTotal').addEventListener('input', sumUp);
  // seed with one line
  addChemLine();

  // Create Batch
  $('#btnCreateBatch').addEventListener('click', ()=>{
    const db = DB.get();
    const total = parseFloat($('#batchTotal').value||'0');
    if (!total || total<=0) return toast('Enter total mix');

    // validate stock (simple check if chemical exists; not decrementing containers by mL here)
    const lines = $$('#chemLines .card.soft').map(card=>{
      return {
        chemId: card.querySelector('.chem-name').value,
        name: card.querySelector('.chem-name').selectedOptions[0]?.textContent || '',
        rate: parseFloat(card.querySelector('.chem-rate').value||'0'),
        unit: card.querySelector('.chem-unit').value,
        required: parseFloat(card.querySelector('.chem-calc').value)||0
      };
    });
    if (lines.some(l => !l.chemId)) return toast('Select chemicals');

    const id = ($('#batchName').value || `B${uid().slice(-6).toUpperCase()}`);
    const batch = {
      id,
      date: $('#batchDate').value || new Date().toISOString().slice(0,10),
      total, remaining: total,
      lines, jobs:[]
    };
    db.batches.unshift(batch);
    DB.set(db);

    // quick summary card (2.5s)
    const m = modal(`
      <div class="row between"><h3>${id}</h3><button class="btn" data-close>Close</button></div>
      <div class="list-sub">${fmt(batch.date)} • remaining ${batch.remaining} L</div>
      <ul>${batch.lines.map(l=>`<li>${l.name}: ${l.rate}/100L → need ${l.required.toFixed(3)} ${l.unit}</li>`).join('')}</ul>
    `);
    setTimeout(()=> m.close(), 2500);

    refreshBatchPicker();
    renderBatches();
    toast('Batch created');
  });

  $('#btnDeleteDraft').addEventListener('click', ()=>{
    // just clears the form
    $('#batchName').value=''; $('#batchTotal').value='600'; $('#chemLines').innerHTML=''; addChemLine(); sumUp();
  });

  function batchCard(b){
    const ring = b.remaining<=0 ? '🔴' : (b.remaining<b.total*0.25 ? '🟠' : '🟢');
    const div = document.createElement('div');
    div.className = 'list-card';
    div.innerHTML = `
      <div>
        <div class="list-title">${b.id}</div>
        <div class="list-sub">${fmt(b.date)} • remaining ${b.remaining} L • used ${(b.total-b.remaining).toFixed(2)} L</div>
      </div>
      <div class="btn-row">
        <button class="btn primary" data-open="${b.id}">Open</button>
        <button class="btn danger" data-dump="${b.id}">Dump</button>
      </div>`;
    return div;
  }

  function renderBatches(){
    const db = DB.get(); const host = $('#batchList'); host.innerHTML='';
    const from = $('#batFrom').value, to = $('#batTo').value;
    db.batches.filter(b => (!from || new Date(b.date)>=new Date(from)) && (!to || new Date(b.date)<=new Date(to)))
      .forEach(b => host.appendChild(batchCard(b)));

    $$('#batchList [data-open]').forEach(b=> b.onclick = ()=> openBatch(b.dataset.open));
    $$('#batchList [data-dump]').forEach(b=> b.onclick = ()=> dumpBatch(b.dataset.dump));
  }
  $('#btnBatSearch').addEventListener('click', renderBatches);
  $('#btnBatReset').addEventListener('click', ()=>{ $('#batFrom').value=''; $('#batTo').value=''; renderBatches(); });
  renderBatches();

  function openBatch(id){
    const db = DB.get(); const b = db.batches.find(x=> x.id===id);
    if (!b) return;
    const html = `
      <div class="row between"><h3>${b.id}</h3><button class="btn danger" data-close>Close</button></div>
      <div class="list-sub">${fmt(b.date)} • remaining ${b.remaining} L • used ${(b.total-b.remaining).toFixed(2)} L</div>
      <div class="card soft" style="margin-top:.7rem">
        <b>Lines</b>
        <ul>${b.lines.map(l=>`<li>${l.name}: ${l.rate}/100L → need ${l.required.toFixed(3)} ${l.unit}</li>`).join('')}</ul>
        <b>Jobs</b>
        <ul>${(b.jobs||[]).map(j=>`<li><a href="#" data-job="${j}">${j}</a></li>`).join('') || '<li>—</li>'}</ul>
      </div>
      <div class="btn-row"><button class="btn danger" id="dumpHere">Dump Remaining</button></div>
    `;
    const m = modal(html);
    $('#dumpHere', m.el)?.addEventListener('click', ()=>{ m.close(); dumpBatch(id); });
    $$('a[data-job]', m.el).forEach(a=> a.onclick = (e)=>{ e.preventDefault(); m.close(); openTask(a.dataset.job); });
  }

  function dumpBatch(id){
    const db = DB.get(); const b = db.batches.find(x=> x.id===id); if(!b) return;
    if (b.remaining<=0) return toast('Nothing to dump');
    const reason = prompt('Dump how many L? (reason optional after a space)\nExample: 100 typo');
    if (!reason) return;
    const num = parseFloat(reason.split(/\s+/)[0]);
    if (!isFinite(num) || num<=0) return;
    b.remaining = Math.max(0, b.remaining - num);
    DB.set(db);
    toast(`Dumped ${num} L`);
    renderBatches();
  }

  // ===== MAPPING =====
  const map = newMap('map');
  $('#btnLocateMe').addEventListener('click', async ()=>{
    try{
      const pos = await geolocate();
      map.setView([pos.coords.latitude, pos.coords.longitude], 15);
      L.marker([pos.coords.latitude, pos.coords.longitude]).addTo(map);
    }catch{ toast('Location failed'); }
  });
  $('#btnMapSearch').addEventListener('click', ()=> toast('Map filter applied'));
  $('#btnMapReset').addEventListener('click', ()=> { $('#mapFrom').value=''; $('#mapTo').value=''; $('#mapType').value='All'; $('#mapSearch').value=''; });

});
