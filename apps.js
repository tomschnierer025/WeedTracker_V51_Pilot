/* === WeedTracker V56 Pilot === */
/* Main App Logic */

document.addEventListener("DOMContentLoaded", () => {
  const screens = document.querySelectorAll(".screen");
  const homeBtn = document.getElementById("homeBtn");
  const spinner = document.getElementById("spinner");

  // ======= NAVIGATION =======
  document.querySelectorAll("[data-target]").forEach(btn => {
    btn.addEventListener("click", () => {
      switchScreen(btn.dataset.target);
    });
  });

  homeBtn.addEventListener("click", () => switchScreen("home"));
  function switchScreen(id) {
    screens.forEach(s => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
  }

  // ======= SPLASH =======
  setTimeout(() => {
    document.getElementById("splash").style.display = "none";
  }, 2500);

  // ======= INITIAL DATA LOAD =======
  const data = JSON.parse(localStorage.getItem("weedtracker_data") || "{}");
  if (!data.tasks) data.tasks = [];
  if (!data.batches) data.batches = [];
  if (!data.chems) data.chems = [];
  if (!data.procurement) data.procurement = [];

  // ======= LOGIN =======
  const accountInput = document.getElementById("accountEmail");
  if (accountInput && data.accountEmail) {
    accountInput.value = data.accountEmail;
  }
  document.getElementById("saveAccount").onclick = () => {
    data.accountEmail = accountInput.value.trim();
    saveData();
    alert("Account email saved for sync: " + data.accountEmail);
  };

  // ======= SPINNER HANDLER =======
  function showSpinner(show) {
    spinner.classList[show ? "add" : "remove"]("active");
  }

  // ======= REMINDER SPINNER (1–52 weeks) =======
  const remSel = document.getElementById("reminderWeeks");
  if (remSel) {
    for (let i = 1; i <= 52; i++) {
      const opt = document.createElement("option");
      opt.textContent = i;
      opt.value = i;
      remSel.appendChild(opt);
    }
  }

  // ======= LOCATION & AUTO-NAME =======
  const locateBtn = document.getElementById("locateBtn");
  const locRoad = document.getElementById("locRoad");
  let currentRoad = "Unknown Location";

  locateBtn.addEventListener("click", async () => {
    showSpinner(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
          const json = await res.json();
          currentRoad = json.address.road || json.display_name || "Unnamed Road";
          locRoad.textContent = currentRoad;
        } catch {
          locRoad.textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        }
        showSpinner(false);
      }, () => {
        showSpinner(false);
        alert("Unable to get location.");
      });
    } else {
      alert("Geolocation not supported.");
      showSpinner(false);
    }
  });

  document.getElementById("autoNameBtn").addEventListener("click", () => {
    const type = document.getElementById("taskType").value.charAt(0).toUpperCase();
    const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const jobName = `${type}${date}_${currentRoad.replace(/\s+/g, "")}`;
    document.getElementById("jobName").value = jobName;
  });

  // ======= WEATHER AUTO-FILL =======
  async function getWeather() {
    try {
      const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=-34.75&longitude=148.65&current_weather=true");
      const data = await res.json();
      const w = data.current_weather;
      document.getElementById("temp").value = w.temperature;
      document.getElementById("wind").value = w.windspeed;
      document.getElementById("windDir").value = w.winddirection + "°";
    } catch (e) { console.warn("Weather fetch failed", e); }
  }
  getWeather();

  // ======= ROAD TRACKING =======
  let tracking = false;
  let trackCoords = [];
  const startBtn = document.getElementById("startTrack");
  const stopBtn = document.getElementById("stopTrack");
  const trackStatus = document.getElementById("trackStatus");

  startBtn.addEventListener("click", () => {
    trackCoords = [];
    tracking = true;
    trackStatus.textContent = "Tracking started…";
  });

  stopBtn.addEventListener("click", () => {
    tracking = false;
    trackStatus.textContent = "Tracking stopped.";
    localStorage.setItem("lastTrack", JSON.stringify(trackCoords));
  });

  if (navigator.geolocation) {
    setInterval(() => {
      if (tracking) {
        navigator.geolocation.getCurrentPosition(pos => {
          trackCoords.push([pos.coords.latitude, pos.coords.longitude]);
        });
      }
    }, 5000);
  }

  // ======= SAVE TASK =======
  document.getElementById("saveTask").addEventListener("click", () => saveTask(false));
  document.getElementById("saveDraft").addEventListener("click", () => saveTask(true));

  function saveTask(isDraft) {
    showSpinner(true);
    const id = Date.now();
    const obj = {
      id,
      name: document.getElementById("jobName").value,
      council: document.getElementById("councilNum").value,
      type: document.getElementById("taskType").value,
      weed: document.getElementById("weedSelect").value,
      batch: document.getElementById("batchSelect").value,
      date: document.getElementById("jobDate").value,
      start: document.getElementById("startTime").value,
      end: document.getElementById("endTime").value,
      temp: document.getElementById("temp").value,
      wind: document.getElementById("wind").value,
      windDir: document.getElementById("windDir").value,
      humidity: document.getElementById("humidity").value,
      reminder: document.getElementById("reminderWeeks").value,
      status: isDraft ? "Draft" : document.querySelector("input[name='status']:checked").value,
      notes: document.getElementById("notes").value,
      coords: trackCoords,
      created: new Date().toISOString()
    };
    const existing = data.tasks.find(t => t.name === obj.name);
    if (existing) Object.assign(existing, obj);
    else data.tasks.push(obj);
    saveData();
    setTimeout(() => {
      showSpinner(false);
      alert("Task saved successfully!");
    }, 800);
  }

  // ======= SAVE DATA =======
  function saveData() {
    localStorage.setItem("weedtracker_data", JSON.stringify(data));
  }

  // ======= LOAD RECORDS =======
  function loadRecords() {
    const list = document.getElementById("recordsList");
    list.innerHTML = "";
    data.tasks.forEach(t => {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `<b>${t.name}</b><br><small>${t.type} • ${t.date} • ${t.status}</small>`;
      div.onclick = () => showRecordPopup(t);
      list.appendChild(div);
    });
  }
  loadRecords();

  function showRecordPopup(t) {
    const html = `
      <div class="popup">
        <h3>${t.name}</h3>
        <p><b>Type:</b> ${t.type}<br>
        <b>Weed:</b> ${t.weed}<br>
        <b>Batch:</b> ${t.batch}<br>
        <b>Weather:</b> ${t.temp}°C, ${t.wind}km/h ${t.windDir}, Humidity ${t.humidity}%<br>
        <b>Status:</b> ${t.status}<br>
        <b>Notes:</b> ${t.notes}</p>
        <button onclick="document.body.removeChild(this.parentElement)">Close</button>
      </div>`;
    const div = document.createElement("div");
    div.innerHTML = html;
    document.body.appendChild(div.firstChild);
  }

  // ======= BATCHES =======
  const newBatch = document.getElementById("newBatch");
  if (newBatch) {
    newBatch.onclick = () => {
      const id = "B" + Date.now();
      const chemicals = prompt("Enter chemicals (comma separated):");
      const mix = prompt("Enter total mix (L):");
      const obj = {
        id,
        chemicals,
        mix,
        remaining: mix,
        date: new Date().toISOString().split("T")[0],
      };
      data.batches.push(obj);
      saveData();
      loadBatches();
    };
  }

  function loadBatches() {
    const list = document.getElementById("batchList");
    list.innerHTML = "";
    data.batches.forEach(b => {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `<b>${b.id}</b> • ${b.date} • ${b.mix}L`;
      div.onclick = () => showBatchPopup(b);
      list.appendChild(div);
    });
  }
  loadBatches();

  function showBatchPopup(b) {
    const html = `
      <div class="popup">
        <h3>${b.id}</h3>
        <p><b>Date:</b> ${b.date}<br>
        <b>Total Mix:</b> ${b.mix}L<br>
        <b>Remaining:</b> ${b.remaining}L<br>
        <b>Chemicals:</b> ${b.chemicals}</p>
        <button onclick="document.body.removeChild(this.parentElement)">Close</button>
      </div>`;
    const div = document.createElement("div");
    div.innerHTML = html;
    document.body.appendChild(div.firstChild);
  }

  // ======= MAPPING =======
  const map = L.map("map").setView([-34.75, 148.65], 9);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(map);
  if (localStorage.getItem("lastTrack")) {
    const coords = JSON.parse(localStorage.getItem("lastTrack"));
    if (coords.length > 1) {
      L.polyline(coords, { color: "yellow", weight: 4 }).addTo(map);
    }
  }

  // ======= EXPORT & CLEAR =======
  document.getElementById("exportBtn").onclick = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "weedtracker_data.json";
    a.click();
  };

  document.getElementById("clearBtn").onclick = () => {
    if (confirm("Clear all data?")) {
      localStorage.removeItem("weedtracker_data");
      location.reload();
    }
  };

  // ======= ADD CHEMICAL =======
  const addChem = document.getElementById("addChem");
  if (addChem) {
    addChem.onclick = () => {
      const name = prompt("Chemical name:");
      const qty = prompt("Amount in stock:");
      if (!name || !qty) return;
      data.chems.push({ name, qty });
      saveData();
      loadChems();
    };
  }

  function loadChems() {
    const list = document.getElementById("chemList");
    list.innerHTML = "";
    data.chems.forEach(c => {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `<b>${c.name}</b> — ${c.qty}`;
      list.appendChild(div);
    });
  }
  loadChems();

  // ======= SDS PORTAL =======
  const openSDS = document.getElementById("openSDS");
  if (openSDS) {
    openSDS.onclick = () => {
      window.open("https://www.pilot.net.au/sds", "_blank");
    };
  }

});
