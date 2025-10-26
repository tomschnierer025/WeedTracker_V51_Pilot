// WeedTracker V60 Pilot — apps.js (Part 1)
// Controls navigation, task creation, weather, records, mapping, and spinners.

const screens = document.querySelectorAll(".screen");
const homeButtons = document.querySelectorAll(".home-tile");
const homeBtn = document.getElementById("homeBtn");
const spinner = document.getElementById("spinner");
const spinnerText = document.getElementById("spinnerText");
const toastHost = document.getElementById("toastHost");
let map, roadTrackPolyline, trackPoints = [], trackDistance = 0;

// =============== NAVIGATION ===============
function showScreen(id) {
  screens.forEach(s => s.classList.remove("active"));
  const target = document.getElementById(id);
  if (target) target.classList.add("active");
}

homeButtons.forEach(b => b.addEventListener("click", () => {
  showScreen(b.dataset.target);
}));

homeBtn.addEventListener("click", () => showScreen("home"));

// =============== SPINNER CONTROL ===============
function showSpinner(msg) {
  spinnerText.textContent = msg || "Working…";
  spinner.classList.remove("hidden");
}
function hideSpinner() {
  spinner.classList.add("hidden");
}

// =============== TOASTS ===============
function showToast(msg, duration = 3000) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  toastHost.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

// =============== WEATHER AUTO-FILL ===============
async function getWeather() {
  try {
    showSpinner("Fetching weather...");
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej)
    );
    const { latitude, longitude } = pos.coords;
    // Open-Meteo API for simple local weather
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
    const r = await fetch(url);
    const d = await r.json();
    const w = d.current_weather;
    document.getElementById("temp").value = w.temperature;
    document.getElementById("wind").value = w.windspeed;
    document.getElementById("windDir").value = `${w.winddirection.toFixed(0)}°`;
    document.getElementById("wxUpdated").textContent = "Updated now";
    hideSpinner();
    showToast("Weather loaded");
  } catch (e) {
    hideSpinner();
    showToast("Weather unavailable");
  }
}
document.getElementById("autoWeatherBtn").addEventListener("click", getWeather);

// =============== LOCATION + AUTO-NAME ===============
document.getElementById("locateBtn").addEventListener("click", async () => {
  try {
    showSpinner("Locating...");
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej)
    );
    const { latitude, longitude } = pos.coords;
    const geo = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
    const data = await geo.json();
    const road = data.address.road || "Unknown Road";
    document.getElementById("locRoad").textContent = road;
    localStorage.setItem("lastRoad", road);
    hideSpinner();
  } catch (err) {
    hideSpinner();
    showToast("Could not get location");
  }
});

document.getElementById("autoNameBtn").addEventListener("click", () => {
  const road = localStorage.getItem("lastRoad") || "Unknown";
  const now = new Date();
  const d = String(now.getDate()).padStart(2, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const y = String(now.getFullYear()).slice(-2);
  const type = document.getElementById("taskType").value.substring(0, 1).toUpperCase();
  document.getElementById("jobName").value = `${road.replace(/\s+/g, "")}${d}${m}${y}${type}`;
});

// =============== ROAD TRACKING ===============
document.getElementById("taskType").addEventListener("change", e => {
  const isRoad = e.target.value === "Road Spray";
  document.getElementById("roadTrackBlock").style.display = isRoad ? "block" : "none";
});

document.getElementById("startTrack").addEventListener("click", () => {
  trackPoints = [];
  trackDistance = 0;
  roadTrackPolyline?.remove();
  showToast("Tracking started");
  trackWatch = navigator.geolocation.watchPosition(pos => {
    const { latitude, longitude } = pos.coords;
    trackPoints.push([latitude, longitude]);
    if (trackPoints.length > 1) {
      const last = trackPoints[trackPoints.length - 2];
      const dist = calcDistKm(last, [latitude, longitude]);
      trackDistance += dist;
      document.getElementById("trackKm").textContent = `Distance: ${trackDistance.toFixed(2)} km`;
      if (map && roadTrackPolyline) {
        roadTrackPolyline.setLatLngs(trackPoints);
      }
    } else if (map) {
      roadTrackPolyline = L.polyline(trackPoints, { color: "yellow" }).addTo(map);
    }
  });
});

document.getElementById("stopTrack").addEventListener("click", () => {
  navigator.geolocation.clearWatch(trackWatch);
  showToast(`Tracking stopped (${trackDistance.toFixed(2)} km)`);
  localStorage.setItem("lastTrack", JSON.stringify({
    points: trackPoints, distance: trackDistance
  }));
});

function calcDistKm(a, b) {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLon = (b[1] - a[1]) * Math.PI / 180;
  const lat1 = a[0] * Math.PI / 180;
  const lat2 = b[0] * Math.PI / 180;
  const x = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

// =============== SAVE TASKS ===============
document.getElementById("saveTask").addEventListener("click", () => saveTask(false));
document.getElementById("saveDraft").addEventListener("click", () => saveTask(true));

function saveTask(isDraft) {
  showSpinner(isDraft ? "Saving draft..." : "Saving task...");
  const task = {
    type: document.getElementById("taskType").value,
    road: document.getElementById("locRoad").textContent,
    jobName: document.getElementById("jobName").value,
    councilNum: document.getElementById("councilNum").value,
    date: document.getElementById("jobDate").value,
    startTime: document.getElementById("startTime").value,
    endTime: document.getElementById("endTime").value,
    weed: document.getElementById("weedSelect").value,
    batch: document.getElementById("batchSelect").value,
    linkJob: document.getElementById("linkJob").value,
    linkInspectionId: document.getElementById("linkInspectionId").value,
    temp: document.getElementById("temp").value,
    humidity: document.getElementById("humidity").value,
    wind: document.getElementById("wind").value,
    windDir: document.getElementById("windDir").value,
    notes: document.getElementById("notes").value,
    status: document.querySelector('input[name="status"]:checked').value,
    reminder: document.getElementById("reminderWeeks").value,
    trackKm: trackDistance.toFixed(2),
    created: new Date().toLocaleString()
  };

  const records = JSON.parse(localStorage.getItem("records") || "[]");
  records.push(task);
  localStorage.setItem("records", JSON.stringify(records));
  hideSpinner();
  showToast(isDraft ? "Draft saved" : "Task saved");
  setTimeout(() => showScreen("records"), 700);
}
// WeedTracker V60 Pilot — apps.js (Part 2)
// Continues from Part 1 — includes records, batches, map, and settings.

//
// =============== RECORDS DISPLAY ===============
function loadRecords() {
  const list = document.getElementById("recordsList");
  const records = JSON.parse(localStorage.getItem("records") || "[]");
  list.innerHTML = "";

  if (!records.length) {
    list.innerHTML = `<p class="muted">No records yet.</p>`;
    return;
  }

  records.forEach((r, i) => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div>
        <strong>${r.jobName}</strong><br/>
        <small>${r.type} | ${r.date} | ${r.road}</small><br/>
        <small>Status: ${r.status}</small>
      </div>
      <button class="btn" data-index="${i}">Open</button>
    `;
    item.querySelector("button").addEventListener("click", () => openRecord(i));
    list.appendChild(item);
  });
}

function openRecord(index) {
  const records = JSON.parse(localStorage.getItem("records") || "[]");
  const r = records[index];
  if (!r) return;
  alert(`Job: ${r.jobName}\nType: ${r.type}\nDate: ${r.date}\nWeed: ${r.weed}\nBatch: ${r.batch}\n\nNotes: ${r.notes || "—"}`);
}

document.getElementById("records").addEventListener("click", e => {
  if (e.target.id === "recSearchBtn") loadRecords();
});
loadRecords();

//
// =============== BATCHES DISPLAY ===============
function loadBatches() {
  const list = document.getElementById("batchList");
  const batches = JSON.parse(localStorage.getItem("batches") || "[]");
  list.innerHTML = "";

  if (!batches.length) {
    list.innerHTML = `<p class="muted">No batches found.</p>`;
    return;
  }

  batches.forEach((b, i) => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div>
        <strong>${b.name}</strong><br/>
        <small>Total chemicals: ${b.totalUsed}</small><br/>
        <small>${b.created}</small>
      </div>
      <button class="btn" data-index="${i}">Open</button>
    `;
    item.querySelector("button").addEventListener("click", () => openBatch(i));
    list.appendChild(item);
  });
}

function openBatch(index) {
  const batches = JSON.parse(localStorage.getItem("batches") || "[]");
  const b = batches[index];
  if (!b) return;
  alert(
    `Batch: ${b.name}\nCreated: ${b.created}\n\n` +
    b.chemicals.map(c => `${c.name} — ${c.rate}/100L, Total: ${c.total}`).join("\n")
  );
}
loadBatches();

document.getElementById("newBatch").addEventListener("click", createNewBatch);

function createNewBatch() {
  const chemInventory = JSON.parse(localStorage.getItem("chemicals") || "[]");
  if (!chemInventory.length) {
    showToast("No chemicals in inventory yet");
    return;
  }

  const bname = prompt("Enter batch name:");
  if (!bname) return;

  let totalUsed = 0;
  const chemicals = chemInventory.map(c => {
    const rate = parseFloat(prompt(`Rate for ${c.name} per 100L:`) || "0");
    const total = rate * 10; // default 1000L mix
    totalUsed += total;
    return { name: c.name, rate, total };
  });

  const newBatch = {
    name: bname,
    chemicals,
    totalUsed: totalUsed.toFixed(2),
    created: new Date().toLocaleString()
  };

  const batches = JSON.parse(localStorage.getItem("batches") || "[]");
  batches.push(newBatch);
  localStorage.setItem("batches", JSON.stringify(batches));
  showToast("Batch created");
  loadBatches();
}

//
// =============== MAPPING ===============
function initMap() {
  if (map) return;
  map = L.map("map").setView([-34.65, 148.33], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(map);

  renderPins();
}

function renderPins() {
  const records = JSON.parse(localStorage.getItem("records") || "[]");
  records.forEach(r => {
    if (!r.road) return;
    // Random approximate coords for preview
    const lat = -34.6 + Math.random() * 0.2;
    const lon = 148.3 + Math.random() * 0.2;
    const color = r.type === "Inspection" ? "blue" :
                  r.type === "Spot Spray" ? "green" :
                  "yellow";
    const pin = L.circleMarker([lat, lon], { radius: 6, color }).addTo(map);
    pin.bindPopup(`<strong>${r.jobName}</strong><br>${r.type}<br>${r.date}`);
  });
}

document.getElementById("mapping").addEventListener("click", e => {
  if (e.target.id === "mapSearchBtn") renderPins();
});
initMap();

//
// =============== SETTINGS / CLEAR DATA ===============
document.getElementById("clearBtn").addEventListener("click", () => {
  if (confirm("Clear all data?")) {
    localStorage.clear();
    showToast("All data cleared");
  }
});

document.getElementById("exportBtn").addEventListener("click", () => {
  const data = JSON.stringify(localStorage, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "weedtracker_backup.json";
  a.click();
  URL.revokeObjectURL(url);
  showToast("Backup exported");
});

document.getElementById("restoreBtn").addEventListener("click", async () => {
  const file = await pickFile();
  if (!file) return;
  const text = await file.text();
  const data = JSON.parse(text);
  for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
  showToast("Backup restored");
  location.reload();
});

function pickFile() {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = () => resolve(input.files[0]);
    input.click();
  });
}

// Spinner auto-hide safeguard
hideSpinner();
