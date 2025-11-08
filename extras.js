/* === WeedTracker V60 Pilot — extras.js ===
 * General helper functions: weather, navigation, popups, filters, etc.
 * Matches full apps.js version.
 */

window.WeedExtras = (() => {
  const EX = {};

  /* ===== WEATHER ===== */
  EX.getWeather = async () => {
    try {
      if (!navigator.geolocation) throw new Error("No geolocation support");
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
      const { latitude, longitude } = pos.coords;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;
      const r = await fetch(url);
      const j = await r.json();
      const c = j.current || {};
      document.getElementById("temp").value = c.temperature_2m ?? "";
      document.getElementById("wind").value = c.wind_speed_10m ?? "";
      document.getElementById("windDir").value = (c.wind_direction_10m ?? "") + (c.wind_direction_10m != null ? "°" : "");
      document.getElementById("humidity").value = c.relative_humidity_2m ?? "";
      document.getElementById("wxUpdated").textContent = "Weather updated: " + new Date().toLocaleTimeString();
    } catch (e) {
      console.warn("Weather fetch failed", e);
      alert("Unable to fetch weather automatically.");
    }
  };

  /* ===== APPLE MAPS NAVIGATION ===== */
  EX.navigateAppleMaps = (lat, lon) => {
    if (!lat || !lon) return alert("No coordinates found.");
    const url = `maps://?daddr=${lat},${lon}`;
    window.open(url, "_blank");
  };

  /* ===== FILTER RESET ===== */
  EX.resetFilters = (group) => {
    document
      .querySelectorAll(`#${group} input[type=text], #${group} input[type=date]`)
      .forEach((i) => (i.value = ""));
    document.querySelectorAll(`#${group} input[type=checkbox]`).forEach((i) => (i.checked = false));
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

  /* ===== POPUPS ===== */
  EX.createPopup = (title, html) => {
    const div = document.createElement("div");
    div.className = "popup";
    div.innerHTML = `<h3>${title}</h3><div>${html}</div><button class="closePopup">Close</button>`;
    document.body.appendChild(div);
    div.querySelector(".closePopup").onclick = () => div.remove();
  };

  EX.createRecordPopup = (rec) => {
    const html = `
      <p><b>Type:</b> ${rec.type}<br>
      <b>Weed:</b> ${rec.weed}<br>
      <b>Date:</b> ${EX.formatDateAU(rec.date)}<br>
      <b>Status:</b> ${rec.status}<br>
      <b>Notes:</b> ${rec.notes || ""}</p>
      <button class="navBtn">Navigate</button>`;
    const div = document.createElement("div");
    div.className = "popup";
    div.innerHTML = `<h3>${rec.name}</h3>${html}<button class="closePopup">Close</button>`;
    document.body.appendChild(div);
    div.querySelector(".closePopup").onclick = () => div.remove();
    const navBtn = div.querySelector(".navBtn");
    if (navBtn) {
      navBtn.onclick = () => {
        if (rec.coords && rec.coords.length > 0) {
          const [lat, lon] = rec.coords[0];
          EX.navigateAppleMaps(lat, lon);
        } else alert("No coordinates for this record.");
      };
    }
  };

  EX.createBatchPopup = (batch) => {
    const html = `
      <p><b>Date:</b> ${EX.formatDateAU(batch.date)}<br>
      <b>Total Mix:</b> ${batch.mix} L<br>
      <b>Remaining:</b> ${batch.remaining || batch.mix} L<br>
      <b>Chemicals:</b> ${batch.chemicals.map((c) => c.name).join(", ")}</p>`;
    EX.createPopup(batch.id, html);
  };

  /* ===== MAP PIN POPUPS ===== */
  EX.createMapPinPopup = (map, data) => {
    if (!map || !Array.isArray(data)) return;
    data.forEach((rec) => {
      if (!rec.coords || rec.coords.length === 0) return;
      const [lat, lon] = rec.coords[0];
      const marker = L.marker([lat, lon]).addTo(map);
      marker.bindPopup(
        `<b>${rec.name}</b><br>${rec.type} - ${EX.formatDateAU(rec.date)}<br>
        <button class="pinNav" data-lat="${lat}" data-lon="${lon}">Navigate</button>`
      );
    });
    map.on("popupopen", (e) => {
      const btn = e.popup._contentNode.querySelector(".pinNav");
      if (btn) {
        btn.onclick = () => {
          EX.navigateAppleMaps(btn.dataset.lat, btn.dataset.lon);
        };
      }
    });
  };

  return EX;
})();
