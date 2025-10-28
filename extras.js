/* WeedTracker V60 Pilot — extras.js */
/* Splash screen fade, weather fetch, GPS, auto-name and UI helpers */

document.addEventListener("DOMContentLoaded", () => {
  fadeSplash();
  setupButtons();
  initReminderDropdown();
});

/* ---------- Splash ---------- */
function fadeSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;
  setTimeout(() => splash.classList.add("fade"), 1000);
  setTimeout(() => splash.remove(), 1800);
}

/* ---------- Spinner / Toast ---------- */
function showSpinner(msg = "Working…") {
  const s = document.getElementById("spinner");
  if (!s) return;
  document.getElementById("spinnerMsg").textContent = msg;
  s.classList.add("active");
}
function hideSpinner() {
  document.getElementById("spinner")?.classList.remove("active");
}
function showToast(msg, duration = 2500) {
  const div = document.createElement("div");
  div.className = "toast";
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), duration);
}

/* ---------- GPS + Reverse Geocode ---------- */
async function getRoadName(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
    );
    const data = await res.json();
    return data.address.road || data.display_name || "Unknown Road";
  } catch {
    return "Unknown Road";
  }
}

async function getLocation() {
  if (!navigator.geolocation) {
    alert("GPS not supported on this device.");
    return;
  }
  showSpinner("Getting location…");
  navigator.geolocation.getCurrentPosition(
    async pos => {
      const { latitude, longitude } = pos.coords;
      const road = await getRoadName(latitude, longitude);
      document.getElementById("locRoad").textContent = road;
      localStorage.setItem("lastLat", latitude);
      localStorage.setItem("lastLon", longitude);
      hideSpinner();
      showToast(`📍 ${road}`);
    },
    err => {
      hideSpinner();
      alert("Location error: " + err.message);
    },
    { enableHighAccuracy: true }
  );
}

/* ---------- Auto Name Job ---------- */
function autoNameJob(jobType) {
  const road = document.getElementById("locRoad")?.textContent || "Unknown";
  if (road === "Unknown") {
    showToast("Location not set. Tap Get Location first.");
    return;
  }
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const prefix = jobType === "Inspection" ? "I" : jobType === "Spot Spray" ? "SS" : "RS";
  const jobName = `${road.replace(/\s+/g, "")}${dd}${mm}${yyyy}_${prefix}`;
  document.getElementById("jobName").value = jobName;
}

/* ---------- Weather Fetch ---------- */
async function getWeather() {
  try {
    showSpinner("Fetching weather…");
    const lat = localStorage.getItem("lastLat");
    const lon = localStorage.getItem("lastLon");
    if (!lat || !lon) {
      showToast("⚠️ Location not found. Tap Get Location first.");
      hideSpinner();
      return;
    }
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
    const res = await fetch(url);
    const data = await res.json();
    const wx = data.current_weather;
    document.getElementById("temp").value = wx.temperature;
    document.getElementById("wind").value = wx.windspeed;
    document.getElementById("windDir").value = `${wx.winddirection}°`;
    document.getElementById("humidity").value = 65; // placeholder
    document.getElementById("wxUpdated").textContent = new Date().toLocaleTimeString();
    hideSpinner();
    showToast("🌦 Weather updated");
  } catch (e) {
    hideSpinner();
    alert("Weather fetch failed: " + e.message);
  }
}

/* ---------- Reminder Dropdown ---------- */
function initReminderDropdown() {
  const sel = document.getElementById("reminderWeeks");
  if (!sel) return;
  if (sel.options.length <= 2) {
    for (let i = 1; i <= 52; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `${i} weeks`;
      sel.appendChild(opt);
    }
  }
}

/* ---------- Buttons Binding & Navigation ---------- */
function setupButtons() {
  const homeBtns = document.querySelectorAll("[id^='homeBtn']");
  homeBtns.forEach(b => b.addEventListener("click", () => switchScreen("home")));
  document.getElementById("locateBtn")?.addEventListener("click", getLocation);
  document.getElementById("autoNameBtn")?.addEventListener("click", () =>
    autoNameJob(document.getElementById("taskType").value)
  );
  document.getElementById("autoWeatherBtn")?.addEventListener("click", getWeather);
}

/* ---------- Screen Switcher ---------- */
function switchScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  window.scrollTo(0, 0);
}

/* ---------- Exports ---------- */
window.getLocation = getLocation;
window.autoNameJob = autoNameJob;
window.getWeather = getWeather;
window.showSpinner = showSpinner;
window.hideSpinner = hideSpinner;
window.showToast = showToast;
window.switchScreen = switchScreen;
