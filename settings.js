/* ===== WeedTracker V60 Pilot — settings.js ===== */
document.addEventListener('DOMContentLoaded', () => {
  const homeBtn = document.getElementById('homeBtn');
  const screens = document.querySelectorAll('.screen');
  const goto = (id) => {
    screens.forEach(s=> s.classList.toggle('active', s.id===id));
    window.scrollTo({top:0, behavior:'instant'});
  };

  // Home button
  homeBtn.addEventListener('click', ()=> goto('home'));

  // Home nav buttons
  document.querySelectorAll('#home .nav-card').forEach(b=>{
    b.addEventListener('click', ()=> goto(b.dataset.target));
  });

  // Theme toggle
  const db = DB.get();
  if (db.settings.theme === 'light') document.body.classList.replace('theme-dark','theme-light');
  document.getElementById('btnTheme').addEventListener('click', ()=>{
    const light = document.body.classList.contains('theme-light');
    document.body.classList.toggle('theme-light', !light);
    document.body.classList.toggle('theme-dark', light);
    const d = DB.get(); d.settings.theme = (!light ? 'light':'dark'); DB.set(d);
  });

  // Export / Import / Clear
  document.getElementById('btnExport').addEventListener('click', ()=>{
    const blob = DB.export();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'weedtracker_v60.json';
    a.click();
  });
  document.getElementById('btnImport').addEventListener('click', ()=> document.getElementById('fileImport').click());
  document.getElementById('fileImport').addEventListener('change', async (e)=>{
    if (e.target.files[0]) { await DB.import(e.target.files[0]); WT.toast('Imported'); location.reload(); }
  });
  document.getElementById('btnClear').addEventListener('click', ()=>{
    if (confirm('Clear ALL local data?')) { DB.reset(); location.reload(); }
  });

  // expose for apps.js
  window.goto = goto;
});
