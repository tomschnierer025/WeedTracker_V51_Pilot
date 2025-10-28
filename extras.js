/* === WeedTracker V60 Pilot — extras.js ===
   Shared helper utilities: date/time formatting, popup helpers,
   dynamic lists, Apple Maps launcher, and AU conventions.
*/

window.WeedExtras = (() => {
  const X = {};

  // ---------- Date helpers ----------
  X.todayISO = () => new Date().toISOString().split("T")[0];
  X.nowTime = () => new Date().toTimeString().slice(0,5);
  X.auDate = (d) => {
    const dt = d instanceof Date ? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2,"0");
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const yyyy = dt.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };
  X.auCompact = (d) => {
    const dt = d instanceof Date ? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2,"0");
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const yyyy = dt.getFullYear();
    return `${dd}${mm}${yyyy}`;
  };

  // ---------- Popup builder ----------
  X.popup = (title, html, opts={}) => {
    const modal = document.createElement("div");
    modal.className = "popup";
    modal.innerHTML = `
      <h3 style="margin-top:0">${title}</h3>
      <div class="popup-body">${html}</div>
      <button id="popCloseBtn">Close</button>`;
    document.body.appendChild(modal);
    modal.querySelector("#popCloseBtn").addEventListener("click", ()=> modal.remove());
    if (opts.autoClose) setTimeout(()=> modal.remove(), opts.autoClose);
    return modal;
  };

  // ---------- Toasts ----------
  X.toast = (msg, ms=1800)=>{
    const d=document.createElement("div");
    d.textContent=msg;
    Object.assign(d.style,{
      position:"fixed",bottom:"1.2rem",left:"50%",transform:"translateX(-50%)",
      background:"#222",color:"#fff",padding:".5rem 1rem",borderRadius:"1rem",
      zIndex:2000,boxShadow:"0 2px 6px rgba(0,0,0,.3)"
    });
    document.body.appendChild(d);
    setTimeout(()=>d.remove(),ms);
  };

  // ---------- Apple Maps Launcher ----------
  X.openAppleMaps = (lat, lon, name="WeedTracker Location") => {
    const url = `maps://?daddr=${lat},${lon}&q=${encodeURIComponent(name)}`;
    const alt = `https://maps.apple.com/?daddr=${lat},${lon}&q=${encodeURIComponent(name)}`;
    const a=document.createElement("a");
    a.href=url; document.body.appendChild(a); a.click();
    setTimeout(()=>{ window.open(alt, "_blank"); a.remove(); }, 250);
  };

  // ---------- Unified filter reset ----------
  X.resetFilters = (ids)=>{
    ids.forEach(id=>{
      const el=document.getElementById(id);
      if(!el) return;
      if(el.type==="checkbox") el.checked=false;
      else el.value="";
    });
  };

  // ---------- Safe JSON helpers ----------
  X.safeParse = (t, def)=>{ try{return JSON.parse(t);}catch{return def;} };
  X.safeString = (obj)=>{ try{return JSON.stringify(obj,null,2);}catch{return "{}";} };

  // ---------- Weather helpers ----------
  X.fetchWeather = async (lat, lon)=>{
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;
    const r=await fetch(url); const j=await r.json(); return j.current||{};
  };

  return X;
})();
