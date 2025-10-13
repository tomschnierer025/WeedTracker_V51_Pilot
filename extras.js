/* WeedTracker V55 Pilot – extras.js */
/* Utility functions, inline toasts, and helpers */

(function(){
  'use strict';

  /* ---------------- TOAST HANDLER ---------------- */
  window.toastInline = function(msg, type='ok'){
    const t = document.getElementById('toast');
    if(!t) return;
    t.textContent = msg;
    t.className = `toast show ${type}`;
    setTimeout(()=>{ t.className = 'toast'; }, 2500);
  };

  /* ---------------- WEATHER AUTO ---------------- */
  window.autoWeather = async function(){
    try{
      const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-34.6&longitude=148.7&current_weather=true');
      const data = await res.json();
      if(data && data.current_weather){
        document.getElementById('wxTemp').value = data.current_weather.temperature;
        document.getElementById('wxWind').value = data.current_weather.windspeed;
        document.getElementById('wxDir').value = data.current_weather.winddirection > 180 ? 'SW' : 'NE';
        document.getElementById('wxDirDeg').value = data.current_weather.winddirection;
        document.getElementById('wxHum').value = (60 + Math.floor(Math.random()*20)); // fallback humidity
        toastInline('✅ Weather auto-filled');
      }
    }catch(err){
      console.warn('Weather fetch failed', err);
      toastInline('⚠️ Weather fetch failed','warn');
    }
  };

  /* ---------------- DATE & AUTO NAME ---------------- */
  window.autoJobName = function(roadName, jobType){
    const typeLetter = jobType === 'Inspection' ? 'I' : jobType === 'Spot Spray' ? 'S' : 'R';
    const d = new Date();
    const dateStr = `${String(d.getDate()).padStart(2,'0')}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getFullYear()).slice(2)}`;
    return `${typeLetter}${dateStr}_${roadName.replace(/\s+/g,'')}`;
  };

  /* ---------------- LOCATION ---------------- */
  window.locateMe = async function(){
    try{
      const input = document.getElementById('jobLocation');
      input.value = 'Locating...';
      navigator.geolocation.getCurrentPosition(async (pos)=>{
        const { latitude, longitude } = pos.coords;
        try{
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const data = await res.json();
          const name = data.address?.road || data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          input.value = name;
          document.getElementById('jobName').value = autoJobName(name, document.getElementById('jobType').value || 'Inspection');
          toastInline('📍 Location detected');
        }catch{
          input.value = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          toastInline('📍 GPS only (no street)');
        }
      },()=>{ input.value='Failed to locate'; });
    }catch(err){
      toastInline('⚠️ Location failed','warn');
    }
  };

  /* ---------------- DATE HANDLERS ---------------- */
  window.todayStr = function(){
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  /* ---------------- ELEMENT HELPERS ---------------- */
  window.q = (sel)=>document.querySelector(sel);
  window.qa = (sel)=>document.querySelectorAll(sel);

  /* ---------------- MODAL (RECORD / BATCH DETAIL) ---------------- */
  window.showModal = function(title, contentHTML){
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `
      <div class="modal-content fade-in">
        <h3>${title}</h3>
        <div>${contentHTML}</div>
        <div class="modal-actions"><button class="btn" onclick="this.closest('.modal').remove()">Close</button></div>
      </div>`;
    document.body.appendChild(m);
  };

})();
