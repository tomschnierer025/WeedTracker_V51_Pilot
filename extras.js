/* === WeedTracker V56 Light – Extra Utilities === */

// Date + time formatting helpers
function formatDate(date) {
  if (!date) return "—";
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}
function formatTime(date) {
  if (!date) return "—";
  const d = new Date(date);
  return d.toTimeString().slice(0, 5);
}

// Distance between coordinates (for mapping summaries)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2 - lat1) * Math.PI/180;
  const Δλ = (lon2 - lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Simple popup message
function toast(msg, ms=1500) {
  const div = document.createElement("div");
  div.textContent = msg;
  Object.assign(div.style,{
    position:"fixed", bottom:"1.5rem", left:"50%", transform:"translateX(-50%)",
    background:"#cfffcf", color:"#030", padding:".6rem 1.2rem",
    borderRadius:"20px", boxShadow:"0 2px 6px rgba(0,0,0,.2)", zIndex:9999
  });
  document.body.appendChild(div);
  setTimeout(()=>div.remove(), ms);
}
