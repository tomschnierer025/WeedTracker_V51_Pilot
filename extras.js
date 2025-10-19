/* === WeedTracker V60 Patch 1 — extras.js ===
   Helper functions: formatting, spinner, toast, etc.
*/

// ---------- DOM helpers ----------
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

// ---------- Formatting ----------
const fmt = (n, d=0) => (n==null || n==="") ? "–" : Number(n).toFixed(d);

// ---------- Date Helpers ----------
function formatDateAU(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${dd}-${mm}-${yyyy}`;   // e.g. 19-10-2025
}
function formatDateAUCompact(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${dd}${mm}${yyyy}`;     // e.g. 19102025
}
const todayISO = () => new Date().toISOString().split("T")[0];
const nowTime  = () => new Date().toTimeString().slice(0,5);

// ---------- Toast ----------
function toast(msg, ms=1800) {
  const el = document.createElement("div");
  el.textContent = msg;
  Object.assign(el.style, {
    position: "fixed",
    bottom: "1.3rem",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#e9fbe9",
    color: "#064d1e",
    fontWeight: 700,
    padding: "0.6rem 1rem",
    borderRadius: "20px",
    boxShadow: "0 2px 8px rgba(0,0,0,.25)",
    zIndex: 9999,
    fontSize: "0.95rem"
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// ---------- Spinner ----------
function setSpinner(active, text="Loading…") {
  let sp = $("#spinner");
  if (!sp) {
    sp = document.createElement("div");
    sp.id = "spinner";
    sp.className = "spinner";
    sp.textContent = text;
    document.body.appendChild(sp);
  }
  sp.textContent = text;
  sp.classList[active ? "add" : "remove"]("active");
}

// ---------- Splash Fade ----------
function hideSplash() {
  const splash = $("#splash");
  if (!splash) return;
  setTimeout(() => splash.classList.add("hide"), 1200);
  splash.addEventListener("transitionend", () => splash.remove(), { once: true });
}

// ---------- Map Navigation ----------
function openAppleMaps(lat, lon) {
  const mapsURL = `maps://?daddr=${lat},${lon}&dirflg=d`;
  const webURL  = `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
  const a = document.createElement("a");
  a.href = mapsURL;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { window.open(webURL, "_blank"); a.remove(); }, 300);
}

// ---------- Simple debounce (for filters/search) ----------
function debounce(fn, delay=400) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}
