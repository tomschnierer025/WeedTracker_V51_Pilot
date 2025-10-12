/* V55 — GPS, weather, notifications, map, exports */

function toCompass(deg){
  if(deg==null||deg==='—')return '—';
  const dirs=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg/22.5)%16];
}

async function fetchWeather(lat,lng){
  try{
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat||-34.75}&longitude=${lng||148.65}&current=temperature_2m,wind_speed_10m,wind_direction_10m,relative_humidity_2m`;
    const r=await fetch(url); const d=await r.json(); const c=d.current||{};
    return { temp:c.temperature_2m??"—", wind:c.wind_speed_10m??"—", dir:c.wind_direction_10m??"—", hum:c.relative_humidity_2m??"—" };
  }catch(e){ return {temp:"—",wind:"—",dir:"—",hum:"—"} }
}

function getGPS(cb){
  if(!navigator.geolocation){ alert("GPS not supported"); cb({lat:-34.75,lng:148.65}); return; }
  navigator.geolocation.getCurrentPosition(
    p=>cb({lat:+p.coords.latitude.toFixed(5),lng:+p.coords.longitude.toFixed(5)}),
    _=>{alert("Unable to get GPS"); cb({lat:-34.75,lng:148.65});},
    {enableHighAccuracy:true,timeout:10000}
  );
}

/* Notifications / reminders */
function addReminder(rec){ const all=load(STORAGE_KEYS.reminders); all.push(rec); save(STORAGE_KEYS.reminders,all); }
function listReminders(){ return load(STORAGE_KEYS.reminders); }
function deleteReminder(id){ save(STORAGE_KEYS.reminders, listReminders().filter(r=>r.id!==id)); }
function tickReminders(){
  const all=listReminders(); const now=Date.now(); let changed=false;
  all.forEach(r=>{ const due=new Date(r.date).getTime(); if(!r.alerted && due-now<=24*3600*1000){ notify(`Reminder due: ${r.task}`); r.alerted=true; changed=true; }});
  if(changed) save(STORAGE_KEYS.reminders,all);
}
function notify(msg){
  if("Notification" in window){
    if(Notification.permission==="granted") new Notification("Weed Tracker", {body:msg});
    else if(Notification.permission!=="denied") Notification.requestPermission();
  } else alert(msg);
}

/* Map (Leaflet) */
let map,userMarker,markers=[];
function ensureMap(){
  if(map) return;
  map=L.map("mapView").setView([-34.75,148.65],10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);
}
function clearMarkers(){ markers.forEach(m=>map.removeLayer(m)); markers=[]; }
function plotJobs(jobs){
  ensureMap(); clearMarkers();
  jobs.forEach(j=>{
    if(!j.lat||!j.lng) return;
    const m=L.marker([j.lat,j.lng]).addTo(map);
    m.bindPopup(`<b>${j.name}</b><br>${j.type} • ${j.date}<br><button onclick="openAppleMaps(${j.lat},${j.lng})">Navigate</button>`);
    markers.push(m);
  });
}
function locateUser(){
  ensureMap();
  getGPS(c=>{
    if(userMarker) map.removeLayer(userMarker);
    userMarker=L.marker([c.lat,c.lng],{title:"You are here"}).addTo(map);
    map.setView([c.lat,c.lng],14);
  });
}
function openAppleMaps(lat,lng){ window.open(`https://maps.apple.com/?q=${lat},${lng}`,"_blank"); }

/* Exports */
function exportJSON(){
  const data={
    jobs:load(STORAGE_KEYS.jobs),
    batches:load(STORAGE_KEYS.batches),
    chems:load(STORAGE_KEYS.chems),
    reminders:load(STORAGE_KEYS.reminders),
    tracks:load(STORAGE_KEYS.tracks)
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="weedtracker_export.json"; a.click();
}
function toCSV(rows){
  if(!rows.length) return "";
  const headers=Object.keys(rows[0]);
  const escape=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  return [headers.join(","),...rows.map(r=>headers.map(h=>escape(r[h])).join(","))].join("\n");
}
function exportCSV(){
  const jobs=load(STORAGE_KEYS.jobs);
  const blob=new Blob([toCSV(jobs)],{type:"text/csv"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="weedtracker_jobs.csv"; a.click();
}

/* Boot */
document.addEventListener("DOMContentLoaded",()=>{
  if("Notification" in window && Notification.permission!=="granted") Notification.requestPermission();
  setInterval(tickReminders,60*1000);
});
