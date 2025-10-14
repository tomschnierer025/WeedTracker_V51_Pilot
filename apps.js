/* === WeedTracker V56 Light === */
/* Main App Logic – full verified build */

document.addEventListener("DOMContentLoaded", () => {
  const screens = document.querySelectorAll(".screen");
  const homeBtn = document.getElementById("homeBtn");
  const spinner = document.getElementById("spinner");

  // ======= SCREEN SWITCHING =======
  function switchScreen(id) {
    screens.forEach(s => s.classList.remove("active"));
    const target = document.getElementById(id);
    if (target) target.classList.add("active");
  }
  document.querySelectorAll("[data-target]").forEach(btn => {
    btn.addEventListener("click", () => switchScreen(btn.dataset.target));
  });
  if (homeBtn) homeBtn.addEventListener("click", () => switchScreen("home"));

  // ======= SPLASH =======
  const splash = document.getElementById("splash");
  setTimeout(() => {
    if (splash) splash.style.display = "none";
    switchScreen("home");
  }, 1500);

  // ======= DATA SETUP =======
  let data;
  try {
    data = JSON.parse(localStorage.getItem("weedtracker_data")) || {};
  } catch {
    data = {};
  }
  if (!data.tasks) data.tasks = [];
  if (!data.batches) data.batches = [];
  if (!data.chems) data.chems = [];
  if (!data.procurement) data.procurement = [];

  const saveData = () =>
    localStorage.setItem("weedtracker_data", JSON.stringify(data));

  // ======= SPINNER =======
  const showSpinner = show =>
    spinner?.classList[show ? "add" : "remove"]("active");

  // ======= REMINDER SELECT =======
  const remSel = document.getElementById("reminderWeeks");
  if (remSel) {
    for (let i = 1; i <= 52; i++) {
      const o = document.createElement("option");
      o.value = o.textContent = i;
      remSel.appendChild(o);
    }
  }

  // ======= LOCATION + AUTO-NAME =======
  const locateBtn = document.getElementById("locateBtn");
  const locRoad = document.getElementById("locRoad");
  let currentRoad = "Unknown";

  if (locateBtn)
    locateBtn.addEventListener("click", async () => {
      showSpinner(true);
      if (!navigator.geolocation) {
        alert("Geolocation not supported");
        showSpinner(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const { latitude: lat, longitude: lon } = pos.coords;
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
            );
            const json = await res.json();
            currentRoad =
              json.address?.road ||
              json.display_name ||
              `${lat.toFixed(5)},${lon.toFixed(5)}`;
          } catch {
            currentRoad = `${lat.toFixed(5)},${lon.toFixed(5)}`;
          }
          if (locRoad) locRoad.textContent = currentRoad;
          showSpinner(false);
        },
        () => {
          alert("Unable to get location");
          showSpinner(false);
        }
      );
    });

  const autoBtn = document.getElementById("autoNameBtn");
  if (autoBtn)
    autoBtn.addEventListener("click", () => {
      const type = document
        .getElementById("taskType")
        ?.value?.charAt(0)
        ?.toUpperCase();
      const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
      const job = `${type || "X"}${date}_${currentRoad.replace(/\s+/g, "")}`;
      const jobName = document.getElementById("jobName");
      if (jobName) jobName.value = job;
    });

  // ======= AUTO WEATHER =======
  async function autoWeather() {
    try {
      const res = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=-34.75&longitude=148.65&current_weather=true"
      );
      const j = await res.json();
      const w = j.current_weather;
      document.getElementById("temp").value = w.temperature ?? "";
      document.getElementById("wind").value = w.windspeed ?? "";
      document.getElementById("windDir").value =
        (w.winddirection ?? "") + "°";
    } catch (e) {
      console.warn("Weather fetch failed", e);
      toast("Weather unavailable");
    }
  }
  const wBtn = document.getElementById("autoWeatherBtn");
  if (wBtn) wBtn.onclick = autoWeather;

  // ======= ROAD TRACKING =======
  let tracking = false;
  let coords = [];
  const startBtn = document.getElementById("startTrack");
  const stopBtn = document.getElementById("stopTrack");
  const trackLabel = document.getElementById("trackStatus");

  const updateTrackLabel = msg => (trackLabel ? (trackLabel.textContent = msg) : 0);

  if (startBtn)
    startBtn.onclick = () => {
      tracking = true;
      coords = [];
      updateTrackLabel("Tracking started…");
    };

  if (stopBtn)
    stopBtn.onclick = () => {
      tracking = false;
      updateTrackLabel("Tracking stopped.");
      localStorage.setItem("lastTrack", JSON.stringify(coords));
    };

  if (navigator.geolocation)
    setInterval(() => {
      if (tracking)
        navigator.geolocation.getCurrentPosition(p =>
          coords.push([p.coords.latitude, p.coords.longitude])
        );
    }, 4000);

  // ======= SAVE TASK =======
  const saveTask = isDraft => {
    showSpinner(true);
    const obj = {
      id: Date.now(),
      name: document.getElementById("jobName")?.value || "Unnamed",
      council: document.getElementById("councilNum")?.value || "",
      type: document.getElementById("taskType")?.value || "",
      weed: document.getElementById("weedSelect")?.value || "",
      batch: document.getElementById("batchSelect")?.value || "",
      date: document.getElementById("jobDate")?.value || "",
      start: document.getElementById("startTime")?.value || "",
      end: document.getElementById("endTime")?.value || "",
      temp: document.getElementById("temp")?.value || "",
      wind: document.getElementById("wind")?.value || "",
      windDir: document.getElementById("windDir")?.value || "",
      humidity: document.getElementById("humidity")?.value || "",
      reminder: document.getElementById("reminderWeeks")?.value || "",
      notes: document.getElementById("notes")?.value || "",
      status: isDraft ? "Draft" : "Incomplete",
      coords,
      created: new Date().toISOString(),
    };
    const ex = data.tasks.find(t => t.name === obj.name);
    if (ex) Object.assign(ex, obj);
    else data.tasks.push(obj);
    saveData();
    setTimeout(() => {
      showSpinner(false);
      toast("Task saved");
    }, 600);
  };

  document.getElementById("saveTask")?.addEventListener("click", () => saveTask(false));
  document.getElementById("saveDraft")?.addEventListener("click", () => saveTask(true));

  // ======= LOAD RECORDS =======
  const list = document.getElementById("recordsList");
  function loadRecords() {
    if (!list) return;
    list.innerHTML = "";
    data.tasks.forEach(t => {
      const d = document.createElement("div");
      d.className = "item";
      d.innerHTML = `<b>${t.name}</b><br><small>${t.type} • ${t.date} • ${t.status}</small>`;
      d.onclick = () => recordPopup(t);
      list.appendChild(d);
    });
  }
  function recordPopup(t) {
    const card = document.createElement("div");
    card.className = "modal";
    card.innerHTML = `
      <div class="card p">
        <h3>${t.name}</h3>
        <p><b>Type:</b> ${t.type}<br>
        <b>Weed:</b> ${t.weed}<br>
        <b>Batch:</b> ${t.batch}<br>
        <b>Weather:</b> ${t.temp}°C • ${t.wind} km/h • ${t.windDir} • ${t.humidity}%<br>
        <b>Status:</b> ${t.status}<br>
        <b>Notes:</b> ${t.notes || "—"}</p>
        <div class="row end gap">
          <button class="back" onclick="this.closest('.modal').remove()">Close</button>
        </div>
      </div>`;
    document.body.appendChild(card);
  }
  loadRecords();

  // ======= BATCHES =======
  const bList = document.getElementById("batchList");
  function loadBatches() {
    if (!bList) return;
    bList.innerHTML = "";
    data.batches.forEach(b => {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `<b>${b.id}</b> • ${b.date} • ${b.mix} L`;
      div.onclick = () => batchPopup(b);
      bList.appendChild(div);
    });
  }
  function batchPopup(b) {
    const card = document.createElement("div");
    card.className = "modal";
    card.innerHTML = `
      <div class="card p">
        <h3>${b.id}</h3>
        <p><b>Date:</b> ${b.date}<br>
        <b>Total:</b> ${b.mix} L<br>
        <b>Remaining:</b> ${b.remaining || 0} L<br>
        <b>Chemicals:</b> ${b.chemicals}</p>
        <div class="row end gap">
          <button class="back" onclick="this.closest('.modal').remove()">Close</button>
        </div>
      </div>`;
    document.body.appendChild(card);
  }
  loadBatches();

  // ======= MAP =======
  try {
    const map = L.map("map").setView([-34.75, 148.65], 9);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
    }).addTo(map);
    const tr = localStorage.getItem("lastTrack");
    if (tr) {
      const arr = JSON.parse(tr);
      if (arr.length > 1) L.polyline(arr, { color: "yellow" }).addTo(map);
    }
  } catch (e) {
    console.warn("Map load skipped", e);
  }

  // ======= EXPORT / CLEAR =======
  document.getElementById("exportBtn")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "weedtracker_data.json";
    a.click();
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    if (confirm("Clear all data?")) {
      localStorage.removeItem("weedtracker_data");
      location.reload();
    }
  });

  // ======= CHEMICALS =======
  const chemList = document.getElementById("chemList");
  const addChem = document.getElementById("addChem");
  if (addChem)
    addChem.onclick = () => {
      const n = prompt("Chemical name:");
      const q = prompt("Amount in stock:");
      if (!n || !q) return;
      data.chems.push({ name: n, qty: q });
      saveData();
      loadChems();
    };

  function loadChems() {
    if (!chemList) return;
    chemList.innerHTML = "";
    data.chems.forEach(c => {
      const d = document.createElement("div");
      d.className = "item";
      d.textContent = `${c.name} — ${c.qty}`;
      chemList.appendChild(d);
    });
  }
  loadChems();

  // ======= SDS PORTAL =======
  document.getElementById("openSDS")?.addEventListener("click", () =>
    window.open("https://www.pilot.net.au/sds", "_blank")
  );

  // ======= TOAST UTIL =======
  function toast(msg) {
    const d = document.createElement("div");
    d.textContent = msg;
    Object.assign(d.style, {
      position: "fixed",
      bottom: "1.2rem",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#cfffcf",
      color: "#030",
      padding: ".6rem 1rem",
      borderRadius: "20px",
      boxShadow: "0 2px 6px rgba(0,0,0,.25)",
      zIndex: 9999,
      fontWeight: 600,
    });
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1800);
  }
});
