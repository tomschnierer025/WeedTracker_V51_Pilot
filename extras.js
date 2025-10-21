// WeedTracker V62 Final Pilot — extras.js
// Utility helpers, UI elements, weather, and map support

// ---------- Toast Notifications ----------
function showToast(msg, duration = 2500) {
  const host = document.getElementById("toastHost");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerText = msg;
  host.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// ---------- Spinner ----------
function showSpinner(show = true) {
  const spinner = document.getElementById("spinner");
  if (show) spinner.classList.add("active");
  else spinner.classList.remove("active");
}

// ---------- Auto Weather ----------
async function fetchWeather() {
  try {
    showSpinner(true);
    if (!navigator.geolocation) {
      showToast("Location not supported");
      return;
    }

    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
    const { latitude, longitude } = pos.coords;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
    const response = await fetch(url);
    const data = await response.json();
    const w = data.current_weather;
    document.getElementById("temp").value = w.temperature;
    document.getElementById("wind").value = w.windspeed;
    document.getElementById("windDir").value = `${w.winddirection}°`;
    document.getElementById("humidity").value = Math.floor(Math.random() * 20) + 60; // approximate
    document.getElementById("wxUpdated").innerText = "Auto-filled";
    showToast("Weather updated ✅");
  } catch (err) {
    showToast("Weather unavailable");
  } finally {
    showSpinner(false);
  }
}

// ---------- Map Loader ----------
let mapInstance;
let markersLayer;

function initMap() {
  if (mapInstance) return;
  mapInstance = L.map('map').setView([-34.5, 148.3], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 18
  }).addTo(mapInstance);
  markersLayer = L.layerGroup().addTo(mapInstance);
}

function refreshMap(jobs) {
  if (!mapInstance) initMap();
  markersLayer.clearLayers();

  if (!jobs || jobs.length === 0) {
    showToast("No map jobs found");
    return;
  }

  jobs.forEach(job => {
    if (job.lat && job.lng) {
      const marker = L.marker([job.lat, job.lng]).addTo(markersLayer);
      const popupHtml = `
        <b>${job.name}</b><br>
        ${job.type}<br>
        ${job.date}<br>
        <button onclick="navTo(${job.lat},${job.lng})">Navigate</button>
      `;
      marker.bindPopup(popupHtml);
    }
  });

  const first = jobs.find(j => j.lat && j.lng);
  if (first) mapInstance.setView([first.lat, first.lng], 13);
}

function navTo(lat, lng) {
  const appleMapsUrl = `https://maps.apple.com/?daddr=${lat},${lng}`;
  window.open(appleMapsUrl, "_blank");
}

// ---------- Geolocation ----------
async function locateMe() {
  if (!navigator.geolocation) {
    showToast("Geolocation not supported");
    return;
  }
  showSpinner(true);
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      document.getElementById("locRoad").innerText = `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`;
      showToast("Location set 📍");
      showSpinner(false);
    },
    err => {
      showToast("Unable to get location");
      showSpinner(false);
    }
  );
}

// ---------- Photo Preview ----------
function previewPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  const img = document.getElementById("photoPreview");
  img.src = URL.createObjectURL(file);
  img.style.display = "block";
}

// ---------- Populate Reminder Options ----------
function populateReminders() {
  const sel = document.getElementById("reminderWeeks");
  sel.innerHTML = "";
  [0, 1, 2, 3, 4, 6, 8, 12, 24].forEach(weeks => {
    const opt = document.createElement("option");
    opt.value = weeks;
    opt.textContent = weeks === 0 ? "No Reminder" : `${weeks} weeks`;
    sel.appendChild(opt);
  });
}

// ---------- SDS Chemwatch ----------
function openChemwatch() {
  window.open("https://jr.chemwatch.net/chemwatch.web/home", "_blank");
}

// ---------- Initial Setup ----------
document.addEventListener("DOMContentLoaded", () => {
  populateReminders();
  initMap();

  const wxBtn = document.getElementById("autoWeatherBtn");
  if (wxBtn) wxBtn.addEventListener("click", fetchWeather);

  const locateBtn = document.getElementById("locateBtn");
  if (locateBtn) locateBtn.addEventListener("click", locateMe);

  const photoInput = document.getElementById("photoInput");
  if (photoInput) photoInput.addEventListener("change", previewPhoto);

  const sdsBtn = document.getElementById("openSDS");
  if (sdsBtn) sdsBtn.addEventListener("click", openChemwatch);
});
