/* =========================================================
   WeedTracker V60 Pilot - extras.js
   Utility helpers, weather, location, mapping & UI support
   ========================================================= */

/* ---------- GEOLOCATION & AUTONAME ---------- */
async function getLocationAndAutoName(jobType) {
  if (!navigator.geolocation) {
    WTStorage.showToast("📵 Geolocation not supported");
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const locString = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
        const date = new Date();
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = String(date.getFullYear()).slice(-2);
        const jobLetter = jobType ? jobType.charAt(0).toUpperCase() : "J";
        const name = `AutoRoad${day}${month}${year}${jobLetter}`;

        WTStorage.saveData("last_location", { latitude, longitude });
        WTStorage.showToast("📍 Location captured");
        resolve({ name, latitude, longitude });
      },
      (err) => {
        console.error("GPS error:", err);
        WTStorage.showToast("⚠️ Location failed");
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

/* ---------- WEATHER ---------- */
async function getWeatherAuto() {
  const api = "https://api.open-meteo.com/v1/forecast";
  const loc = WTStorage.loadData("last_location");
  if (!loc) return { temp: "", humidity: "", windSpeed: "", windDir: "" };

  try {
    const res = await fetch(
      `${api}?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`
    );
    const data = await res.json();
    const c = data.current;
    return {
      temp: `${c.temperature_2m ?? ""}°C`,
      humidity: `${c.relative_humidity_2m ?? ""}%`,
      windSpeed: `${c.wind_speed_10m ?? ""} km/h`,
      windDir: degToCompass(c.wind_direction_10m ?? 0),
    };
  } catch (e) {
    console.error("Weather fetch error:", e);
    return { temp: "", humidity: "", windSpeed: "", windDir: "" };
  }
}

/* ---------- WIND DIRECTION CONVERSION ---------- */
function degToCompass(num) {
  const val = Math.floor(num / 22.5 + 0.5);
  const dirs = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  return `${dirs[val % 16]} (${Math.round(num)}°)`;
}

/* ---------- MAP INITIALIZATION ---------- */
let map, userMarker, pinsLayer;

function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl) return;
  WTStorage.showSpinner(true, "Loading map…");

  setTimeout(() => {
    WTStorage.showSpinner(false);
  }, 1000);

  if (!window.L) {
    WTStorage.showToast("⚠️ Map library missing");
    return;
  }

  map = L.map("map").setView([-34.55, 148.37], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
    maxZoom: 19,
  }).addTo(map);

  pinsLayer = L.layerGroup().addTo(map);
  map.locate({ setView: true, maxZoom: 15 });

  map.on("locationfound", (e) => {
    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.marker(e.latlng)
      .addTo(map)
      .bindPopup("📍 You are here")
      .openPopup();
  });

  renderMapPins();
}

/* ---------- PINS RENDER ---------- */
function renderMapPins() {
  if (!pinsLayer) return;
  pinsLayer.clearLayers();
  const records = WTStorage.loadData("records", []);
  records.forEach((r) => {
    if (r.lat && r.lng) {
      const pin = L.marker([r.lat, r.lng]).addTo(pinsLayer);
      pin.bindPopup(
        `<b>${r.jobName}</b><br>${r.date}<br>${r.weed ?? ""}<br>
        <button onclick="navigateTo(${r.lat},${r.lng})">Navigate</button>`
      );
    }
  });
}

/* ---------- APPLE MAPS NAVIGATION ---------- */
function navigateTo(lat, lng) {
  const url = `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
  window.open(url, "_blank");
}

/* ---------- UI HELPERS ---------- */
function closeSheet(id) {
  const sheet = document.getElementById(id);
  if (sheet) sheet.style.display = "none";
}

function openSheet(id) {
  const sheet = document.getElementById(id);
  if (sheet) sheet.style.display = "flex";
}

/* ---------- Init ---------- */
window.addEventListener("DOMContentLoaded", () => {
  WTStorage.initDefaults();
  const mapEl = document.getElementById("map");
  if (mapEl) initMap();
});

/* ---------- EXPORT ---------- */
window.WTExtras = {
  getLocationAndAutoName,
  getWeatherAuto,
  degToCompass,
  initMap,
  renderMapPins,
  navigateTo,
  openSheet,
  closeSheet,
};
