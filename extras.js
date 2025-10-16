/* === WeedTracker V59 — Extras (helpers available before apps.js) === */
window.WTHelpers = {
  // Simple debounce if needed later
  debounce(fn, wait=250){
    let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), wait); };
  }
};
// Nothing here is required by apps.js, but it’s available if we expand later.
