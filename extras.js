/* WeedTracker Pilot V52 – reminders + notifications */

const reminders = {
  list(){ return JSON.parse(localStorage.getItem('wt:rem')||'[]'); },
  save(arr){ localStorage.setItem('wt:rem', JSON.stringify(arr)); reminders.updateBadge(); },

  askPermission(){
    if(!('Notification' in window)) return;
    if(Notification.permission==='default'){
      try{ Notification.requestPermission(); }catch{}
    }
  },

  updateBadge(){
    const due = reminders.list().filter(r=>!r.done && new Date(r.when)<=new Date()).length;
    // optional badge on home tile (not in header)
    // could be shown elsewhere if needed
  },

  add(){
    const text = document.getElementById('remText').value.trim();
    const when = document.getElementById('remDate').value;
    if(!text || !when) return alert('Provide text & date/time');
    const arr = reminders.list(); arr.push({id:Date.now(), text, when, done:false});
    reminders.save(arr); reminders.render(); alert('Reminder added');
  },

  addSilent(text, when){
    const arr = reminders.list(); arr.push({id:Date.now(), text, when, done:false});
    reminders.save(arr);
  },

  render(){
    const list = document.getElementById('remList'); list.innerHTML='';
    const arr = reminders.list().sort((a,b)=> new Date(a.when)-new Date(b.when));
    if(arr.length===0){ list.innerHTML = '<div class="card">No reminders.</div>'; return; }
    arr.forEach(r=>{
      const due = new Date(r.when) <= new Date() && !r.done;
      const card = document.createElement('div'); card.className='card';
      card.innerHTML = `
        <div class="row"><strong>${r.text}</strong></div>
        <div class="row">⏰ ${new Date(r.when).toLocaleString()} ${due?'<span class="tag" style="background:#3c2a00;border-color:#ad7a00;color:#ffd27a">DUE</span>':''}</div>
        <div class="row">
          <button class="btn small green" onclick="reminders.mark(${r.id})">✅ Actioned</button>
          <button class="btn small amber" onclick="reminders.snooze(${r.id},7)">⏳ Delay 1 week</button>
          <button class="btn small gray" onclick="reminders.remove(${r.id})">🗑️ Delete</button>
        </div>`;
      list.appendChild(card);
    });
  },

  mark(id){ reminders.save(reminders.list().map(r=> r.id===id ? {...r, done:true} : r)); reminders.render(); },
  snooze(id, days){
    reminders.save(reminders.list().map(r=> r.id===id ? {...r, when: new Date(Date.parse(r.when)+days*86400000).toISOString()} : r));
    reminders.render();
  },
  remove(id){ reminders.save(reminders.list().filter(r=> r.id!==id)); reminders.render(); }
};

/* Simple due check + notify every minute */
setInterval(()=>{
  const arr = reminders.list();
  arr.forEach(r=>{
    if(!r.done && new Date(r.when) <= new Date()){
      try{
        if('Notification' in window && Notification.permission==='granted'){
          new Notification('WeedTracker Reminder', { body: r.text });
        }else{
          alert(`🔔 Reminder due: ${r.text}`);
        }
      }catch{ alert(`🔔 Reminder due: ${r.text}`); }
    }
  });
  reminders.updateBadge();
}, 60000);
