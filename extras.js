/* === WeedTracker V60.4 Pilot - extras.js === */
/* Helper utilities for weather, Apple Maps, filters, popups, and formatting */

window.WeedExtras = (() => {
  const EX = {};

  /* ===== WEATHER (Auto Fetch) ===== */
  EX.getWeather = async () => {
    try {
      const pos = await new Promise((res, rej) => {
        if (!navigator.geolocation) rej("no geo");
        navigator.geolocation.getCurrentPosition(res, rej);
      });
      const { latitude, longitude } = pos.coords;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
      const r = await fetch(url);
      const j = await r.json();
      const w = j.current_weather || {};
      document.getElementById("temp").value = w.temperature ?? "";
      document.getElementById("wind").value = w.windspeed ?? "";
      document.getElementById("windDir").value = (w.winddirection ?? "") + "°";
      document.getElementById("humidity").value = w.relative_humidity ?? 50;
      document.getElementById("wxUpdated").textContent =
        "Weather updated: " + new Date().toLocaleTimeString();
    } catch (e) {
      console.warn("Weather fetch failed", e);
      alert("Unable to fetch weather automatically.");
    }
  };

  /* ===== APPLE MAPS NAVIGATION ===== */
  EX.navigateAppleMaps = (lat, lon) => {
    if (!lat || !lon) return alert("No coordinates found.");
    const mapsURL = `maps://?daddr=${lat},${lon}`;
    const webURL = `https://maps.apple.com/?daddr=${lat},${lon}`;
    const a = document.createElement("a");
    a.href = mapsURL;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      window.open(webURL, "_blank");
      a.remove();
    }, 400);
  };

  /* ===== DATE FORMATTING ===== */
  EX.formatDateAU = (d) => {
    const dt = new Date(d);
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = dt.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  EX.formatDateAUCompact = (d) => {
    const dt = new Date(d);
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = dt.getFullYear();
    return `${dd}${mm}${yyyy}`;
  };

  /* ===== FILTER RESET ===== */
  EX.resetFilters = (group) => {
    document
      .querySelectorAll(`#${group} input[type=text], #${group} input[type=date]`)
      .forEach((i) => (i.value = ""));
    document
      .querySelectorAll(`#${group} input[type=checkbox]`)
      .forEach((i) => (i.checked = false));
  };

  /* ===== POPUP CREATION ===== */
  EX.popup = (title, html) => {
    const div = document.createElement("div");
    div.className = "modal";
    div.innerHTML = `
      <div class="card p scrollable" style="max-width:440px;width:95%">
        <h3>${title}</h3>
        <div>${html}</div>
        <div class="row gap end mt-2">
          <button class="pill warn" id="closePopup">Close</button>
        </div>
      </div>`;
    document.body.appendChild(div);
    div.querySelector("#closePopup").onclick = () => div.remove();
  };

  /* ===== MAP PIN POPUP ===== */
  EX.createMapPins = (map, data) => {
    if (!map || !Array.isArray(data)) return;
    data.forEach((rec) => {
      if (!rec.coords || rec.coords.length === 0) return;
      const [lat, lon] = rec.coords[0];
      const marker = L.marker([lat, lon]).addTo(map);
      marker.bindPopup(
        `<b>${rec.name}</b><br>${rec.type}<br>${EX.formatDateAU(rec.date)}<br>
        <button class="pill small pinNav" data-lat="${lat}" data-lon="${lon}">Navigate</button>`
      );
    });
    map.on("popupopen", (e) => {
      const btn = e.popup._contentNode.querySelector(".pinNav");
      if (btn) {
        btn.onclick = () =>
          EX.navigateAppleMaps(btn.dataset.lat, btn.dataset.lon);
      }
    });
  };

  /* ===== TOAST MESSAGE ===== */
  EX.toast = (msg, ms = 2000) => {
    const d = document.createElement("div");
    d.textContent = msg;
    Object.assign(d.style, {
      position: "fixed",
      bottom: "1.2rem",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#2ecc71",
      color: "#fff",
      padding: ".6rem 1.2rem",
      borderRadius: "20px",
      boxShadow: "0 2px 8px rgba(0,0,0,.25)",
      zIndex: 9999,
      fontWeight: 600,
    });
    document.body.appendChild(d);
    setTimeout(() => d.remove(), ms);
  };

  return EX;
})();
