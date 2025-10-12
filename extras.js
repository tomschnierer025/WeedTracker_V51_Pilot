/* Weed Tracker V50 Pilot — extras: GPS, weather, reminders, map */

async function fetchWeather(lat,lng){
  try{
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat||-34.75}&longitude=${lng||148.65}&current=temperature_2m,wind_speed_10m,wind_direction_10m,relative_humidity_2m`;
    const r = await fetch(url);
    const d = await r.json();
    const w = d.current||{};
    return {
      temp: w.temperature_2m ?? "—",
      wind: w.wind_speed_10m ?? "—",
      windDir: w.wind_direction_10m ?? "—",
      humidity: w.relative_humidity_2m ?? "—"
    };
  }catch(e){
    console.warn("Weather fetch failed",e);
    return {temp:"—",wind:"—",windDir:"—",humidity:"—"};
  }
}

function getGPSLocation(cb){
  if(!navigator.geolocation){ alert("GPS not supported"); return; }
  navigator.geolocation.getCurrentPosition(
    pos=>{
      cb({lat:+pos.coords.latitude.toFixed(5), lng:+pos.coords.longitude.toFixed(5)});
    },
    err=>{
      console.warn("GPS error",err); alert("Unable to get GPS");
      cb({lat:-34.75,lng:148.65});
    }, {enableHighAccuracy:true, timeout:10000}
  );
}

/* Reminders */
function addReminder(rec){
  const all = load(STORAGE_KEYS.reminders); all.push(rec);
  save(STORAGE_KEYS.reminders, all);
}
function listReminders(){
  return load(STORAGE_KEYS.reminders);
}
function removeReminder(id){
  save(STORAGE_KEYS.reminders, listReminders().filter(r=>r.id!==id));
}
function checkRemindersTick(){
  const list = listReminders(); const now = Date.now();
  let changed=false;
  list.forEach(r=>{
    const due = new Date(r.date).getTime();
    if(!r.alerted && due-now<=24*3600*1000){
      notify(`Reminder due: ${r.task}`);
      r.alerted = true; changed=true;
    }
  });
  if(changed) save(STORAGE_KEYS.reminders, list);
}
function notify(msg){
  if("Notification" in window){
    if(Notification.permission==="granted") new Notification("Weed Tracker", {body:msg});
    else if(Notification.permission!=="denied") Notification.requestPermission();
  }else alert(msg);
}

/* Mapping */
let map, userMarker, markers=[];
function ensureMap(){
  if(map) return;
  map = L.map("mapView").setView([-34.75,148.65], 10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);
}
function clearMarkers(){ markers.forEach(m=>map.removeLayer(m)); markers=[]; }
function plotJobs(jobs){
  ensureMap(); clearMarkers();
  jobs.forEach(j=>{
    if(!j.lat||!j.lng) return;
    const m = L.marker([j.lat,j.lng]).addTo(map);
    m.bindPopup(`<b>${j.name}</b><br>${j.type} • ${j.date}<br><button onclick="openAppleMaps(${j.lat},${j.lng})">Navigate</button>`);
    markers.push(m);
  });
}
function locateUser(){
  ensureMap();
  getGPSLocation(c=>{
    if(userMarker) map.removeLayer(userMarker);
    userMarker = L.marker([c.lat,c.lng],{title:"You are here"}).addTo(map);
    map.setView([c.lat,c.lng], 14);
  });
}
function openAppleMaps(lat,lng){
  window.open(`https://maps.apple.com/?q=${lat},${lng}`,"_blank");
}

/* Boot */
document.addEventListener("DOMContentLoaded", ()=>{
  // Ask once for notifications
  if("Notification" in window && Notification.permission!=="granted"){
    Notification.requestPermission();
  }
  // Start reminder polling
  setInterval(checkRemindersTick, 60*1000);
});
