/* === WeedTracker V60 Pilot — extras.js === */
/* Helpers: AU date, Apple Maps, spinner/toast, weather, popups */

window.WTExtras = (() => {
  const EX = {};
  const $ = (s, r = document) => r.querySelector(s);

  EX.todayISO = () => new Date().toISOString().split("T")[0];
  EX.formatDateAU = (d) => {
    const dt = d instanceof Date ? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = dt.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };
  EX.formatDateAUCompact = (d) => {
    const dt = d instanceof Date ? d : new Date(d);
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = dt.getFullYear();
    return `${dd}${mm}${yyyy}`;
  };
  EX.nowTime = () => new Date().toTimeString().slice(0,5);

  // Spinner
  EX.spin = (on, msg = "Working…") => {
    const ov = $("#spinnerOverlay"); if (!ov) return;
    $("#spinnerMsg").textContent = msg;
    ov.classList[on ? "add" : "remove"]("active");
  };

  // Toast (simple)
  EX.toast = (msg, ms = 1600) => {
    const d = document.createElement("div");
    d.textContent = msg;
    Object.assign(d.style, {
      position: "fixed", bottom: "16px", left: "50%", transform: "translateX(-50%)",
      background: "#d9f7d9", color: "#063", padding: ".6rem 1rem", borderRadius: "20px",
      boxShadow: "0 2px 8px rgba(0,0,0,.25)", zIndex: 4000, fontWeight: 800
    });
    document.body.appendChild(d); setTimeout(() => d.remove(), ms);
  };

  // Apple Maps navigate
  EX.openAppleMaps = (lat, lon) => {
    const mapsURL = `maps://?daddr=${lat},${lon}&dirflg=d`;
    const webURL = `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
    const a = document.createElement("a"); a.href = mapsURL; document.body.appendChild(a); a.click();
    setTimeout(() => { window.open(webURL, "_blank"); a.remove(); }, 250);
  };

  // Weather (open-meteo, current)
  EX.fillWeather = async () => {
    if (!navigator.geolocation) { EX.toast("Enable location services"); return; }
    EX.spin(true, "Fetching weather…");
    navigator.geolocation.getCurrentPosition(async pos => {
      try{
        const { latitude, longitude } = pos.coords;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;
        const r = await fetch(url); const j = await r.json(); const c = j.current || {};
        $("#temp").value = c.temperature_2m ?? "";
        $("#wind").value = c.wind_speed_10m ?? "";
        $("#windDir").value = (c.wind_direction_10m ?? "") + (c.wind_direction_10m!=null ? "°" : "");
        $("#humidity").value = c.relative_humidity_2m ?? "";
        $("#wxUpdated").textContent = "Updated @ " + EX.nowTime();
        EX.spin(false); EX.toast("🌦 Weather updated");
      }catch(e){ EX.spin(false); alert("Weather fetch failed"); }
    }, ()=>{ EX.spin(false); EX.toast("Location not available"); });
  };

  // Popup shell
  EX.popup = (html) => {
    const wrap = document.createElement("div");
    wrap.className = "modal";
    const card = document.createElement("div");
    card.className = "card p";
    card.innerHTML = html;
    wrap.appendChild(card);
    wrap.addEventListener("click", e => { if (e.target === wrap) wrap.remove(); });
    document.addEventListener("keydown", escClose, { once: true });
    document.body.appendChild(wrap);
    function escClose(ev){ if (ev.key === "Escape") wrap.remove(); }
    return wrap;
  };

  return EX;
})();
