/* ===== WeedTracker V60 Pilot — extras.js ===== */
window.$ = (sel, ctx=document) => ctx.querySelector(sel);
window.$$ = (sel, ctx=document) => [...ctx.querySelectorAll(sel)];

function showSpinner(text='Saving…'){ $('#spinnerText').textContent=text; $('#spinner').classList.remove('hidden'); }
function hideSpinner(){ $('#spinner').classList.add('hidden'); }
function toast(msg, ms=2000){
  const host = $('#toastHost');
  const el = document.createElement('div');
  el.className='toast'; el.textContent=msg;
  host.appendChild(el);
  setTimeout(()=> el.remove(), ms);
}

function fmtDate(d){ return new Date(d).toLocaleDateString('en-AU',{day:'2-digit',month:'2-digit',year:'numeric'}); }
function ddmmyy(dateObj){
  const d = new Date(dateObj);
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
}

function typeLetter(t){
  if (t === 'Road Spray') return 'R';
  if (t === 'Spot Spray') return 'S';
  if (t === 'Slash') return 'L';
  return 'I'; // Inspection
}

function getRoadFromGeocode(addr=''){
  // very simple road extractor
  const m = addr.match(/([A-Za-z'\- ]+)\s(Road|Rd|Street|St|Avenue|Ave|Lane|Ln|Way|Track|Hwy)/i);
  return m ? `${m[1].trim().replace(/\s+/g,'')}${m[2][0]}` : 'UnknownRoad';
}

async function geolocate(){
  return new Promise((resolve,reject)=>{
    navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:8000});
  });
}

async function reverseGeocode(lat, lng){
  // simple/robust free endpoint (osm) – no key required
  try{
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
    const j = await r.json();
    return j.display_name || '';
  }catch{ return ''; }
}

function ensureWeedOptions(select){
  // Always include Cape Broom and the noxious list, with yellow diamond marker
  const weeds = [
    'African Boxthorn (noxious)',
    'African Lovegrass (noxious)',
    'Bathurst Burr (noxious)',
    'Blackberry (noxious)',
    'Cape Broom (noxious)',
    'Chilean Needle Grass (noxious)',
    'Coolatai Grass (noxious)',
    'Fireweed (noxious)',
    'Gorse (noxious)',
    'Lantana (noxious)',
    'Patterson’s Curse (noxious)'
  ];
  select.innerHTML = '<option value="">— Select Weed —</option>' +
    weeds.map(w=>`<option>${w}</option>`).join('');
}

function selectFill(select, items, getLabel, getValue){
  select.innerHTML = '<option value="">— Select —</option>' + items.map(i=>(
    `<option value="${getValue(i)}">${getLabel(i)}</option>`
  )).join('');
}

/* Map helper */
function newMap(el){
  const map = L.map(el, { zoomControl: true });
  // Light, high-contrast tiles for outdoor visibility
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  map.setView([-34.64, 148.03], 12);
  return map;
}

/* Simple id */
const uid = (p='id') => p + Math.random().toString(36).slice(2,8);

/* Popup modal */
function modal(html){
  const host = $('#popupHost');
  const box = document.createElement('div');
  box.className = 'card';
  box.style.position='fixed'; box.style.left='50%'; box.style.top='10%';
  box.style.transform='translateX(-50%)'; box.style.width='min(92vw, 720px)';
  box.style.maxHeight='80vh'; box.style.overflow='auto'; box.style.zIndex='80';
  box.innerHTML = html;
  host.appendChild(box);
  const close = ()=> box.remove();
  box.querySelectorAll('[data-close]').forEach(b=> b.addEventListener('click', close));
  return { close, el: box };
}

/* Export */
window.WT = {
  toast, showSpinner, hideSpinner, ddmmyy, typeLetter,
  geolocate, reverseGeocode, getRoadFromGeocode,
  ensureWeedOptions, selectFill, newMap, uid
};
