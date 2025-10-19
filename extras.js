/* === WeedTracker V60 Pilot — extras.js ===
   Shared helpers and UI utilities
*/

(function () {

  // ------------------------------
  // DOM helpers
  // ------------------------------
  window.$  = (s, r=document) => r.querySelector(s);
  window.$$ = (s, r=document) => [...r.querySelectorAll(s)];

  // ------------------------------
  // Toast notification
  // ------------------------------
  window.toast = function (msg, ms = 1600) {
    const d = document.createElement("div");
    d.textContent = msg;
    Object.assign(d.style, {
      position: "fixed",
      bottom: "1.2rem",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#d9f7d9",
      color: "#063",
      padding: ".6rem 1rem",
      borderRadius: "20px",
      boxShadow: "0 2px 8px rgba(0,0,0,.25)",
      zIndex: 9999,
      fontWeight: 800,
    });
    document.body.appendChild(d);
    setTimeout(() => d.remove(), ms);
  };

  // ------------------------------
  // Spinner overlay
  // ------------------------------
  window.spin = function (on, msg = "Working…") {
    let sp = $("#spinner");
    if (!sp) {
      sp = document.createElement("div");
      sp.id = "spinner";
      sp.className = "spinner";
      document.body.appendChild(sp);
    }
    sp.textContent = msg;
    sp.classList[on ? "remove" : "add"]("hidden");
  };

  // ------------------------------
  // Date and time formatters
  // ------------------------------
  window.formatDateAU = function (d) {
    const dt = d instanceof Date ? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = dt.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  window.formatDateAUCompact = function (d) {
    const dt = d instanceof Date ? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = dt.getFullYear();
    return `${dd}${mm}${yyyy}`;
  };

  window.todayISO = () => new Date().toISOString().split("T")[0];
  window.nowTime  = () => new Date().toTimeString().slice(0, 5);

  // ------------------------------
  // Random ID helper
  // ------------------------------
  window.uid = function (prefix = "") {
    return prefix + Math.random().toString(36).slice(2, 9);
  };

})();
