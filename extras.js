/* === WeedTracker V60 Final Pilot — extras.js === */

function showToast(msg) {
  const old = document.querySelector('.toast'); if (old) old.remove();
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el); setTimeout(() => el.remove(), 2000);
}
function showSpinner(msg = "Working…") { const s=document.getElementById('spinner'); s.textContent=msg; s.classList.add('active'); }
function hideSpinner() { document.getElementById('spinner').classList.remove('active'); }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
}
document.addEventListener('click', e=>{ if (e.target.classList.contains('back')) showScreen('home'); });

window.addEventListener('load', ()=>{ setTimeout(()=>{ document.getElementById('splash').classList.add('hide'); }, 1000); });

const NOXIOUS_WEEDS = ["African Lovegrass","Blackberry","Serrated Tussock","St John’s Wort","Bathurst Burr","Chilean Needle Grass","Cape Broom"];
function decorateWeedList(selectEl) {
  [...selectEl.options].forEach(opt=>{
    if (NOXIOUS_WEEDS.includes(opt.text)) { opt.text = `⚠️ ${opt.text}`; opt.style.color = "#ffcc00"; }
  });
  const cat = document.createElement('option'); cat.text = "🚫 Noxious Weeds (Category)"; cat.style.color = "#ff2222"; selectEl.prepend(cat);
}

function openAppleMaps(lat, lon) {
  if (!lat || !lon) { showToast("No coordinates found"); return; }
  window.open(`http://maps.apple.com/?daddr=${lat},${lon}`, '_blank');
}

function openPopup(title, content) {
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="card p"><h3>${title}</h3><div>${content}</div>
    <button class="pill warn closePop" style="margin-top:.8rem">Close</button></div>`;
  document.body.appendChild(m);
  m.querySelector('.closePop').addEventListener('click', ()=>m.remove());
}
function closeAllPopups() { document.querySelectorAll('.modal').forEach(m=>m.remove()); }

function insertSDSLink(listEl) {
  const sds = document.createElement('div');
  sds.className = 'item sds';
  sds.innerHTML = `
    <strong>📘 Safety Data Sheets (SDS)</strong><br>
    <a href="https://online.chemwatch.net/" target="_blank" style="color:#33cc66;">
      Open Chemwatch
    </a>`;
  listEl.prepend(sds);
}

function ensureLabels() {
  document.querySelectorAll('input,select,textarea').forEach(el=>{
    const id = el.id || el.name; if (!id) return;
    const prev = el.previousElementSibling;
    if (prev && prev.tagName === 'LABEL') return;
    const lbl = document.createElement('label');
    lbl.textContent = id.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase());
    el.parentNode.insertBefore(lbl, el);
  });
}

function unitIcon(unit) {
  if (!unit) return '';
  const u=unit.toLowerCase();
  if (u.includes('l')) return '💧';
  if (u.includes('g')) return '⚖️';
  return '🧪';
}

window.showToast=showToast; window.showSpinner=showSpinner; window.hideSpinner=hideSpinner; window.showScreen=showScreen;
window.decorateWeedList=decorateWeedList; window.openAppleMaps=openAppleMaps; window.openPopup=openPopup; window.closeAllPopups=closeAllPopups;
window.insertSDSLink=insertSDSLink; window.ensureLabels=ensureLabels; window.unitIcon=unitIcon;
