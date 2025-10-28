/* === WeedTracker V60 Pilot - apps.js === */

document.addEventListener("DOMContentLoaded", () => {
  const pages = document.querySelectorAll(".screen");
  const spinner = document.getElementById("spinner");
  const goHome = () => showPage("home");

  document.querySelectorAll(".home-btn-circle, .home-btn").forEach(btn =>
    btn.addEventListener("click", goHome)
  );
  document.querySelectorAll("[data-target]").forEach(btn =>
    btn.addEventListener("click", () => showPage(btn.dataset.target))
  );

  function showPage(id) {
    pages.forEach(p => p.classList.remove("active"));
    document.getElementById(id).classList.add("active");
  }

  /* ===== Data ===== */
  let data = WeedStorage.load();
  const saveAll = () => WeedStorage.save(data);

  /* ===== Spinner util ===== */
  const showSpin = msg => {
    spinner.style.display = "block";
    spinner.textContent = msg || "Working...";
  };
  const hideSpin = () => {
    spinner.style.display = "none";
    spinner.textContent = "";
  };

  /* ===== Create Task ===== */
  const taskType = document.getElementById("taskType");
  const weedSelect = document.getElementById("weedSelect");
  const jobDate = document.getElementById("jobDate");
  const startTime = document.getElementById("startTime");
  const endTime = document.getElementById("endTime");
  const locateBtn = document.getElementById("locateBtn");
  const locRoad = document.getElementById("locRoad");
  const autoWeatherBtn = document.getElementById("autoWeatherBtn");
  const reminderWeeks = document.getElementById("reminderWeeks");
  const saveTask = document.getElementById("saveTask");
  const saveDraft = document.getElementById("saveDraft");

  // reminders 0–52 weeks
  for (let i = 0; i <= 52; i++) {
    const o = document.createElement("option");
    o.value = i;
    o.textContent = `${i} week${i !== 1 ? "s" : ""}`;
    reminderWeeks.appendChild(o);
  }

  // populate date/time defaults
  const now = new Date();
  jobDate.valueAsDate = now;
  const pad = n => String(n).padStart(2, "0");
  const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  startTime.value = hhmm;
  endTime.value = hhmm;

  // Noxious + Other weeds
  const weeds = [
    "African Boxthorn (noxious)",
    "African Lovegrass (noxious)",
    "Bathurst Burr (noxious)",
    "Blackberry (noxious)",
    "Cape Broom (noxious)",
    "Chilean Needle Grass (noxious)",
    "Coolatai Grass (noxious)",
    "St John’s Wort (noxious)",
    "Other (Manual Entry)"
  ];
  weedSelect.innerHTML = `<option value="">— Select Weed —</option>`;
  const groupNox = document.createElement("optgroup");
  groupNox.label = "🔺 Noxious Weeds";
  weeds
    .filter(w => w.includes("(noxious)"))
    .forEach(w => {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      groupNox.appendChild(opt);
    });
  weedSelect.appendChild(groupNox);

  const groupOther = document.createElement("optgroup");
  groupOther.label = "Other (Manual Entry)";
  const o2 = document.createElement("option");
  o2.value = "Other";
  o2.textContent = "Other";
  groupOther.appendChild(o2);
  weedSelect.appendChild(groupOther);

  /* ===== GPS + Location ===== */
  locateBtn.addEventListener("click", async () => {
    showSpin("Getting location…");
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej)
      );
      const { latitude, longitude } = pos.coords;
      const locTxt = `Lat ${latitude.toFixed(5)}, Lon ${longitude.toFixed(5)}`;
      locRoad.textContent = locTxt;
      hideSpin();
    } catch (e) {
      hideSpin();
      alert("Failed to get location.");
    }
  });

  /* ===== Weather ===== */
  autoWeatherBtn.addEventListener("click", WeedExtras.getWeather);

  /* ===== Save Task ===== */
  function collectTask(status) {
    const task = {
      id: Date.now(),
      type: taskType.value,
      weed: weedSelect.value,
      date: jobDate.value,
      start: startTime.value,
      end: endTime.value,
      reminder: reminderWeeks.value,
      status,
      notes: document.getElementById("notes").value,
      coords: locRoad.textContent,
    };
    return task;
  }

  saveTask.addEventListener("click", () => {
    const t = collectTask("Complete");
    data.tasks.push(t);
    saveAll();
    alert("✅ Task saved.");
  });

  saveDraft.addEventListener("click", () => {
    const t = collectTask("Draft");
    data.tasks.push(t);
    saveAll();
    alert("🕓 Draft saved.");
  });

  /* ===== Mapping ===== */
  let map;
  const mapDiv = document.getElementById("map");
  const mapBtn = document.getElementById("mapSearchBtn");
  const mapReset = document.getElementById("mapResetBtn");
  const locateMap = document.createElement("button");
  locateMap.textContent = "Locate Me";
  locateMap.className = "mapLocateBtn";
  locateMap.addEventListener("click", async () => {
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej)
      );
      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], 15);
    } catch {
      alert("Location unavailable");
    }
  });
  mapDiv.insertAdjacentElement("afterend", locateMap);

  function initMap() {
    if (map) return;
    try {
      map = L.map("map").setView([-34.65, 148.95], 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap"
      }).addTo(map);
      if (data.tasks && data.tasks.length)
        WeedExtras.createMapPinPopup(map, data.tasks);
    } catch (e) {
      alert("Map failed to load.");
    }
  }
  document.querySelector("[data-target='mapping']").addEventListener("click", () => {
    showPage("mapping");
    initMap();
  });

  mapBtn.addEventListener("click", () => {
    if (map) map.eachLayer(l => { if (l instanceof L.Marker) l.remove(); });
    WeedExtras.createMapPinPopup(map, data.tasks);
  });
  mapReset.addEventListener("click", () => {
    if (map) map.setView([-34.65, 148.95], 12);
  });

  /* ===== End ===== */
  console.log("WeedTracker V60 Pilot loaded.");
});
