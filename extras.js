// extras.js — WeedTracker V60 Pilot
// Handles location, weather, UI helpers, and date formatting.

document.addEventListener("DOMContentLoaded", () => {
  fadeSplash();
  setupButtons();
  initReminderDropdown();
});

// ===== Splash Fade =====
function fadeSplash() {
  const splash = document.getElementById("splash");
  setTimeout(() => splash.classList.add("fade"), 1000);
  setTimeout(() => splash.remove(), 1800);
}

// ===== Spinner / Toast =====
function showSpinner(msg = "Working…") {
  const s = document.getElementById("spinner");
  document.getElementById("spinnerMsg").textContent = msg;
  s.classList.add("active");
}
function hideSpinner() {
  document.getElementById("spinner").classList.remove("active");
}
function showToast(msg, duration = 2500) {
  const div = document.createElement("div");
  div.className = "toast";
  div.textContent = msg;
  Object.assign(div.style, {
    position: "fixed",
    bottom: "30px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#333",
    color: "#fff",
    padding: "10px 18px",
    borderRadius: "8px",
    zIndex: 9999,
    fontSize: "14px",
  });
  document.body.appendChild(div);
  setTimeout(() => div.remove(), duration);
}

// ===== Auto Name =====
async function getRoadName(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
    );
    const data = await res.json();
    return data.address.road || "Unknown Road";
  } catch {
    return "Unknown Road";
  }
}

async function autoNameJob(jobType) {
  const locEl = document.getElementById("locRoad");
  const nameEl = document.getElementById("jobName");

  if (locEl.textContent === "Unknown") {
    showToast("Location not set. Tap Get Location first.");
    return;
  }

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);

  const road = locEl.textContent.replace(/\s+/g, "");
  const typeLetter =
    jobType === "Inspection"
      ? "I"
      : jobType === "Spot Spray"
      ? "S"
      : "R";

  const jobName = `${road}${dd}${mm}${yy}${typeLetter}`;
  nameEl.value = jobName;
}

// ===== GPS =====
async function getLocation() {
  if (!navigator.geolocation) {
    alert("GPS not supported on this device.");
    return;
  }

  showSpinner("Getting location...");
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      const road = await getRoadName(latitude, longitude);
      document.getElementById("locRoad").textContent = road;
      localStorage.setItem("lastLat", latitude);
      localStorage.setItem("lastLon", longitude);
      hideSpinner();
      showToast(`📍 ${road}`);
    },
    (err) => {
      hideSpinner();
      alert("Location error: " + err.message);
    },
    { enableHighAccuracy: true }
  );
}

// ===== Weather =====
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

    // Use open-meteo API
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
    const res = await fetch(url);
    const data = await res.json();
    const wx = data.current_weather;

    document.getElementById("temp").value = wx.temperature;
    document.getElementById("wind").value = wx.windspeed;
    document.getElementById("windDir").value = `${wx.winddirection}°`;
    document.getElementById("humidity").value = 65; // placeholder humidity (not in open-meteo basic API)
    document.getElementById("wxUpdated").textContent = new Date().toLocaleTimeString();

    hideSpinner();
    showToast("🌦 Weather updated");
  } catch (e) {
    hideSpinner();
    alert("Weather fetch failed: " + e.message);
  }
}

// ===== Helpers =====
function initReminderDropdown() {
  const sel = document.getElementById("reminderWeeks");
  if (!sel) return;
  for (let i = 0; i <= 24; i += 3) {
    const opt = document.createElement("option");
    opt.textContent = i === 0 ? "None" : `${i} weeks`;
    opt.value = i;
    sel.appendChild(opt);
  }
}

// ===== Button bindings =====
function setupButtons() {
  const homeBtn = document.getElementById("homeBtn");
  if (homeBtn)
    homeBtn.addEventListener("click", () => switchScreen("home"));

  const locBtn = document.getElementById("locateBtn");
  if (locBtn) locBtn.addEventListener("click", getLocation);

  const autoNameBtn = document.getElementById("autoNameBtn");
  if (autoNameBtn)
    autoNameBtn.addEventListener("click", () =>
      autoNameJob(document.getElementById("taskType").value)
    );

  const wxBtn = document.getElementById("autoWeatherBtn");
  if (wxBtn) wxBtn.addEventListener("click", getWeather);
}

// ===== Screen Navigation =====
function switchScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  window.scrollTo(0, 0);
}

// Expose global functions
window.getWeather = getWeather;
window.getLocation = getLocation;
window.autoNameJob = autoNameJob;
window.switchScreen = switchScreen;
window.showSpinner = showSpinner;
window.hideSpinner = hideSpinner;
window.showToast = showToast;
