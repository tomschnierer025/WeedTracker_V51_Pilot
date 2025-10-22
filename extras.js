/* ===== WeedTrackerV60Pilot — extras.js (helpers, spinner, popup, date, wind) ===== */

// Toast
window.toast = function(msg, ms=1600){
  const d=document.createElement("div");
  d.textContent=msg;
  Object.assign(d.style,{
    position:"fixed",bottom:"1.2rem",left:"50%",transform:"translateX(-50%)",
    background:"#d9f7d9",color:"#063",padding:".6rem 1rem",borderRadius:"20px",
    boxShadow:"0 2px 8px rgba(0,0,0,.25)",zIndex:9999,fontWeight:800
  });
  document.body.appendChild(d); setTimeout(()=>d.remove(),ms);
};

// Popup
window.showPopup = function(title, contentHTML){
  const existing = document.getElementById("popup");
  if (existing) existing.remove();
  const host = document.createElement("div");
  host.id="popup"; host.className="modal";
  host.innerHTML = `
    <div class="card p">
      <h3 style="margin-top:0">${title}</h3>
      <div class="popup-body">${contentHTML}</div>
      <div class="row end" style="margin-top:.6rem">
        <button class="pill warn" id="popupClose">✖ Close</button>
      </div>
    </div>`;
  document.body.appendChild(host);
  document.getElementById("popupClose").onclick = ()=> host.remove();
  host.addEventListener("click",(e)=>{ if(e.target===host) host.remove(); });
};
document.addEventListener("keydown",(e)=>{ if(e.key==="Escape"){ const m=document.getElementById("popup"); if(m) m.remove(); }});

// Spinner overlay
function ensureSpinner(){
  let s=document.getElementById("spinner");
  if(!s){ s=document.createElement("div"); s.id="spinner"; s.className="spinner-overlay"; s.style.display='none'; document.body.appendChild(s); }
  return s;
}
window.showSpinner = function(msg="Working…"){
  const s=ensureSpinner(); s.textContent=msg; s.style.display="flex";
};
window.showSpinnerDone = function(msg="Done ✅", timeout=1200){
  const s=ensureSpinner(); s.textContent=msg; setTimeout(()=> s.style.display="none", timeout);
};

// Date helpers (AU)
window.formatDateAU = function(d){
  const dt = (d instanceof Date)? d : new Date(d);
  const dd = String(dt.getDate()).padStart(2,"0");
  const mm = String(dt.getMonth()+1).padStart(2,"0");
  const yyyy = dt.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};
window.formatDateAUCompact = function(d){
  const dt = (d instanceof Date)? d : new Date(d);
  const dd = String(dt.getDate()).padStart(2,"0");
  const mm = String(dt.getMonth()+1).padStart(2,"0");
  const yy = String(dt.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
};

// Wind cardinal
window.cardinalFromDeg = function(deg){
  if (deg == null || isNaN(deg)) return "";
  const dirs=["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  const i = Math.round(deg / 22.5) % 16;
  return dirs[i];
};
