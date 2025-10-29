/* === WeedTracker V60 Pilot - apps.js === */
/* Handles navigation, tasks, records, mapping, weather, etc. */

window.addEventListener("DOMContentLoaded", () => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const spinner = $("#spinner");
  const showSpinner = (txt = "Working…") => {
    spinner.classList.add("active");
    spinner.setAttribute("data-msg", txt);
  };
  const hideSpinner = () => spinner.classList.remove("active");

  const DB = WeedStorage.load();
  const saveDB = () => WeedStorage.save(DB);

  /* === PAGE NAVIGATION === */
  const pages = $$(".screen");
  const goPage = (id) => {
    pages.forEach((p) => p.classList.remove("active"));
    $(`#${id}`).classList.add("active");
  };

  $$(".home-btn").forEach((btn) =>
    btn.addEventListener("click", () => goPage("home"))
  );
  $$("#home button[data-target]").forEach((btn) =>
    btn.addEventListener("click", () => goPage(btn.dataset.target))
  );

  /* === REMINDER OPTIONS (0–52 weeks) === */
  const remSel = $("#reminderWeeks");
  if (remSel) {
    for (let i = 0; i <= 52; i++) {
      const opt = document.createElement("option");
      opt.textContent = i;
      opt.value = i;
      remSel.appendChild(opt);
    }
  }

  /* === TASK TYPE SETUP === */
  const taskType = $("#taskType");
  const weedSelect = $("#weedSelect");
  const batchSelect = $("#batchSelect");

  const jobTypes = ["Inspection", "Spot Spray", "Road Shoulder Spray"];
  if (taskType && taskType.options.length === 0) {
    jobTypes.forEach((t) => {
      const opt = document.createElement("option");
      opt.textContent = t;
      taskType.appendChild(opt);
    });
  }

  /* === WEED LIST (Noxious Pinned + Other) === */
  const weeds = [
    { name: "🔺 Noxious Weeds", group: true },
    "African Boxthorn (noxious)",
    "African Lovegrass (noxious)",
    "Bathurst Burr (noxious)",
    "Blackberry (noxious)",
    "Cape Broom (noxious)",
    "Chilean Needle Grass (noxious)",
    "Coolatai Grass (noxious)",
    "St John’s Wort (noxious)",
    "Prickly Pear (noxious)",
    { name: "🌿 General Weeds", group: true },
    "Clover",
    "Dandelion",
    "Fleabane",
    "Patterson’s Curse",
    "Wild Oats",
    { name: "🟢 Other", group: true },
  ];

  if (weedSelect) {
    weedSelect.innerHTML = `<option value="">— Select Weed —</option>`;
    weeds.forEach((w) => {
      if (w.group) {
        const opt = document.createElement("option");
        opt.disabled = true;
        opt.textContent = w.name;
        opt.style.fontWeight = "bold";
        weedSelect.appendChild(opt);
      } else {
        const opt = document.createElement("option");
        opt.textContent = w;
        weedSelect.appendChild(opt);
      }
    });
  }

  /* === GET LOCATION === */
  const getLocationBtn = $("#locateBtn");
  const locRoad = $("#locRoad");
  let currentCoords = null;

  if (getLocationBtn) {
    getLocationBtn.onclick = async () => {
      showSpinner("Getting GPS…");
      try {
        const pos = await new Promise((res, rej) => {
          navigator.geolocation.getCurrentPosition(res, rej);
        });
        currentCoords = [pos.coords.latitude, pos.coords.longitude];
        const geo = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${currentCoords[0]}&lon=${currentCoords[1]}`
        );
        const data = await geo.json();
        const road = data.address.road || "Unknown Road";
        locRoad.textContent = road;
        hideSpinner();
      } catch (err) {
        hideSpinner();
        alert("Unable to get location.");
      }
    };
  }

  /* === AUTO JOB NAME === */
  const autoBtn = $("#autoNameBtn");
  const jobName = $("#jobName");

  if (autoBtn) {
    autoBtn.onclick = () => {
      const road = locRoad.textContent.replace(/\s+/g, "");
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = now.getFullYear();
      let typeCode = "_I";
      const t = taskType.value.toLowerCase();
      if (t.includes("spot")) typeCode = "_SS";
      else if (t.includes("shoulder")) typeCode = "_RS";
      const name = `${road}${dd}${mm}${yyyy}${typeCode}`;
      jobName.value = name;
    };
  }

  /* === WEATHER === */
  const wxBtn = $("#autoWeatherBtn");
  if (wxBtn) wxBtn.onclick = WeedExtras.getWeather;

  /* === SAVE TASK === */
  const saveTask = $("#saveTask");
  const saveDraft = $("#saveDraft");

  const saveRecord = (status) => {
    const record = {
      id: Date.now(),
      type: taskType.value,
      date: $("#jobDate").value,
      timeStart: $("#startTime").value,
      timeEnd: $("#endTime").value,
      name: jobName.value,
      coords: currentCoords ? [currentCoords] : [],
      weed: weedSelect.value,
      batch: batchSelect.value,
      temp: $("#temp").value,
      wind: $("#wind").value,
      windDir: $("#windDir").value,
      humidity: $("#humidity").value,
      reminder: $("#reminderWeeks").value,
      notes: $("#notes").value,
      status,
    };
    DB.tasks.push(record);
    saveDB();
    alert(`Task saved (${status}).`);
    goPage("records");
  };

  if (saveTask) saveTask.onclick = () => saveRecord("Complete");
  if (saveDraft) saveDraft.onclick = () => saveRecord("Draft");

  /* === RECORDS === */
  const recSearchBtn = $("#recSearchBtn");
  const recResetBtn = $("#recResetBtn");
  const recList = $("#recordsList");

  const renderRecords = () => {
    recList.innerHTML = "";
    DB.tasks
      .slice()
      .reverse()
      .forEach((r) => {
        const div = document.createElement("div");
        div.className = "item";
        div.innerHTML = `
          <b>${r.name}</b><br>
          <small>${r.type}</small><br>
          <small>${r.date}</small><br>
          <small>${r.status}</small><br>
          <button class="pill openRec">Open</button>`;
        div.querySelector(".openRec").onclick = () => WeedExtras.createRecordPopup(r);
        recList.appendChild(div);
      });
  };

  if (recSearchBtn) recSearchBtn.onclick = renderRecords;
  if (recResetBtn) recResetBtn.onclick = renderRecords;
  renderRecords();

  /* === BATCHES === */
  const newBatch = $("#newBatch");
  if (newBatch) newBatch.onclick = () => WeedBatches.newBatchPopup(DB, saveDB);

  WeedBatches.render(DB, (b) => WeedBatches.showPopup(DB, b, saveDB));

  /* === MAPPING === */
  const mapEl = $("#map");
  if (mapEl) {
    let map = L.map("map").setView([-34.5, 148.35], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);

    WeedExtras.createMapPinPopup(map, DB.tasks);

    const locateBtn = L.control({ position: "topright" });
    locateBtn.onAdd = () => {
      const btn = L.DomUtil.create("button", "");
      btn.innerHTML = "📍";
      btn.style.background = "#22aa66";
      btn.style.border = "none";
      btn.style.borderRadius = "50%";
      btn.style.color = "#fff";
      btn.style.width = "40px";
      btn.style.height = "40px";
      btn.style.fontSize = "20px";
      btn.style.cursor = "pointer";
      btn.onclick = () => {
        map.locate({ setView: true, maxZoom: 14 });
      };
      return btn;
    };
    locateBtn.addTo(map);
  }

  /* === SETTINGS === */
  WeedSettings.init(DB, saveDB);
});
