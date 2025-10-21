/* WeedTracker V61 Final Pilot — extras.js
   - UI polish, spinner overlays, modal helpers
   - Toast + summary card
   - Delegated Open/Edit actions wiring
*/

(function () {
  document.addEventListener("DOMContentLoaded", () => {
    // ---------- Splash fade ----------
    const splash = document.getElementById("splash");
    setTimeout(() => splash?.classList.add("hide"), 900);
    splash?.addEventListener("transitionend", () => splash.remove(), { once: true });

    // ---------- Spinner Overlay ----------
    const overlay = document.getElementById("overlaySpinner");
    const backdrop = document.getElementById("backdrop");
    const overlayText = document.getElementById("overlayText");

    function showOverlay(text) {
      overlayText.textContent = text;
      backdrop.hidden = false;
      overlay.hidden = false;
    }
    function hideOverlay() {
      backdrop.hidden = true;
      overlay.hidden = true;
    }
    window._WTOverlay = { show: showOverlay, hide: hideOverlay };

    // ---------- Toast + Summary ----------
    window._WTToast = function (msg, ms = 1600) {
      const d = document.createElement("div");
      d.textContent = msg;
      Object.assign(d.style, {
        position: "fixed",
        bottom: "1.1rem",
        left: "50%",
        transform: "translateX(-50%)",
        background: "#e9f9ea",
        border: "1px solid #bfe6c6",
        color: "#0a4f18",
        padding: ".55rem .9rem",
        borderRadius: "16px",
        boxShadow: "0 2px 8px rgba(0,0,0,.25)",
        zIndex: 9999,
        fontWeight: 800,
      });
      document.body.appendChild(d);
      setTimeout(() => d.remove(), ms);
    };

    window._WTSummary = function (title, lines = [], ms = 2200) {
      const wrap = document.createElement("div");
      wrap.innerHTML = `
        <div style="
          position:fixed;left:50%;top:18%;transform:translateX(-50%);
          background:#ffffff;border:1px solid #d9e6d9;border-radius:14px;
          box-shadow:0 14px 36px rgba(0,0,0,.18);
          z-index:9999;padding:14px 18px;min-width:260px">
          <div style="font-weight:900;color:#0c7d2b">${title}</div>
          <div style="margin-top:6px;color:#1c3e1c;font-weight:700">
            ${lines.map(l => `<div>${l}</div>`).join("")}
          </div>
        </div>`;
      const el = wrap.firstElementChild;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), ms);
    };

    // ---------- Simple modal helpers (close with X) ----------
    document.body.addEventListener("click", (e) => {
      const closeBtn = e.target.closest("[data-close-modal]");
      if (closeBtn) {
        const modal = closeBtn.closest(".modal");
        if (modal) modal.remove();
      }
    });

    // ---------- Home buttons (nav) ----------
    document.querySelectorAll("[data-target]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
        document.getElementById(btn.dataset.target)?.classList.add("active");
      });
    });
    document.querySelectorAll(".home-btn").forEach(b => {
      b.addEventListener("click", () => {
        document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
        document.getElementById("home")?.classList.add("active");
      });
    });
  });
})();
