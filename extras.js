// ===============================
// WeedTracker V60 Pilot Final
// EXTRAS.JS – utility + helpers
// ===============================

function toast(msg) {
  const host = document.getElementById("toastHost");
  if (!host) return;
  const div = document.createElement("div");
  div.className = "toast";
  div.textContent = msg;
  host.appendChild(div);
  setTimeout(() => div.remove(), 2500);
}

function showSpinner(text = "Working…") {
  const spinner = document.getElementById("spinner");
  const spinnerText = document.getElementById("spinnerText");
  spinnerText.textContent = text;
  spinner.classList.remove("hidden");
}
function hideSpinner() {
  document.getElementById("spinner").classList.add("hidden");
}

// Navigation
function switchScreen(target) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(target).classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Shortcuts
function $(id) { return document.getElementById(id); }

// Weather auto fill mock
async function fetchWeather() {
  try {
    const resp = await fetch("https://api.open-meteo.com/v1/forecast?latitude=-34.55&longitude=148.37&current_weather=true");
    const data = await resp.json();
    if (!data.current_weather) throw "bad";
    $("wTemp").value = data.current_weather.temperature;
    $("wWind").value = data.current_weather.windspeed;
    $("wDir").value = data.current_weather.winddirection;
    $("wHum").value = 55 + Math.round(Math.random() * 10); // placeholder humidity
    toast("Weather updated 🌦️");
  } catch {
    toast("Weather unavailable ⚠️");
  }
}

// Generate autoname
function generateAutoName(location, jobType) {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const y = String(now.getFullYear()).slice(-2);
  const prefix = location ? location.replace(/\s+/g, "") : "Unknown";
  const suffix = jobType === "inspection" ? "I" : jobType === "roadspray" ? "R" : "S";
  return `${prefix}${d}${m}${y}${suffix}`;
}

// Spinner success
function spinnerDone(msg = "Done ✅") {
  const spinnerText = document.getElementById("spinnerText");
  spinnerText.textContent = msg;
  setTimeout(() => hideSpinner(), 1200);
}

// Map helper
function initMap() {
  const map = L.map("mapHost", { center: [-34.55, 148.37], zoom: 11 });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);
  return map;
}

// Notification mock
function notify(msg) {
  try {
    if (Notification.permission === "granted") {
      new Notification(msg);
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(p => {
        if (p === "granted") new Notification(msg);
      });
    }
  } catch { /* ignore */ }
}

// Add “close” X to all popups dynamically
function addPopupClose(btnTarget) {
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✖";
  closeBtn.className = "pill warn";
  closeBtn.style.float = "right";
  closeBtn.onclick = () => document.getElementById(btnTarget).remove();
  return closeBtn;
}

// Validation helper
function checkInventory(chemName, neededAmt) {
  const chems = getChemicals();
  const chem = chems.find(c => c.name === chemName);
  if (!chem) {
    toast(`❌ ${chemName} not found in inventory`);
    return false;
  }
  if (chem.amount < neededAmt) {
    toast(`⚠️ Not enough ${chemName} in stock`);
    return false;
  }
  return true;
}

// Link generator
function linkJobs(jobID, linkTo) {
  const jobs = getJobs();
  const job = jobs.find(j => j.id === jobID);
  const linked = jobs.find(j => j.id === linkTo);
  if (job && linked) {
    job.linked = linkTo;
    toast(`🔗 Linked ${job.jobName} → ${linked.jobName}`);
    setJobs(jobs);
  }
}
