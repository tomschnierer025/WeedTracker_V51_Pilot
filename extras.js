// WeedTracker V60 Pilot — extras.js
// UI polish, timestamp logic, spinners, color themes, and utilities.

// =============== THEME & STYLING ===============
document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("dark-theme");
});

// =============== SPINNER HANDLER ===============
const spinnerOverlay = document.createElement("div");
spinnerOverlay.id = "spinnerOverlay";
spinnerOverlay.style.cssText = `
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  color: white;
  font-size: 20px;
  font-weight: bold;
`;
spinnerOverlay.innerHTML = `<div class="spinner">⏳ Saving...</div>`;
document.body.appendChild(spinnerOverlay);

function showSpinner(text = "Saving...") {
  spinnerOverlay.querySelector(".spinner").textContent = text;
  spinnerOverlay.style.display = "flex";
}

function hideSpinner() {
  spinnerOverlay.style.display = "none";
}

// =============== TOAST NOTIFICATION ===============
function showToast(message, duration = 2500) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.display = "block";
  toast.style.background = "#333";
  toast.style.color = "white";
  toast.style.padding = "10px 20px";
  toast.style.borderRadius = "5px";
  toast.style.position = "fixed";
  toast.style.bottom = "25px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.zIndex = "10000";
  setTimeout(() => (toast.style.display = "none"), duration);
}

// =============== AUTO TIMESTAMP ===============
function getTimestamp() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${day}/${month}/${year} ${time}`;
}

function appendTimestamp(elId, label = "Timestamp") {
  const el = document.getElementById(elId);
  if (!el) return;
  const stamp = document.createElement("small");
  stamp.textContent = `${label}: ${getTimestamp()}`;
  stamp.style.color = "#aaa";
  el.appendChild(stamp);
}

// =============== BUTTON FEEDBACK ===============
function flashButton(button, color = "#4CAF50") {
  const original = button.style.backgroundColor;
  button.style.backgroundColor = color;
  setTimeout(() => (button.style.backgroundColor = original), 400);
}

// =============== JOB NAMING FORMAT ===============
function formatJobName(roadName, typeLetter) {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const y = now.getFullYear().toString().slice(-2);
  return `${roadName.replace(/\s+/g, "_")}_${d}${m}${y}_${typeLetter}`;
}

// =============== SCROLL FIX FOR iPHONE ===============
document.addEventListener("touchmove", e => {
  if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") {
    e.stopPropagation();
  }
}, { passive: true });

// =============== MAP MARKER COLORS ===============
function mapColorByType(type) {
  switch (type) {
    case "Inspection": return "blue";
    case "Spot Spray": return "green";
    case "Road Spray": return "yellow";
    default: return "gray";
  }
}

// =============== BATCH STATUS COLORS ===============
function batchStatusRing(batch) {
  const remaining = parseFloat(batch.remaining || 0);
  if (remaining <= 0) return "🔴 Used (0L left)";
  if (remaining < batch.totalMix * 0.3) return "🟠 Low";
  return "🟢 Available";
}

// =============== WEATHER MOCK (AUTO-FILL) ===============
async function autoWeather() {
  try {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=-34.65&longitude=148.33&current_weather=true");
    const data = await res.json();
    const w = data.current_weather;
    return {
      temp: `${w.temperature}°C`,
      wind: `${w.windspeed} km/h`,
      direction: w.winddirection + "°"
    };
  } catch {
    return { temp: "N/A", wind: "N/A", direction: "N/A" };
  }
}

// =============== FINAL INTEGRATION ===============
window.addEventListener("beforeunload", () => {
  hideSpinner();
});
