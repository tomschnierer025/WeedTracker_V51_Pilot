// WeedTracker V55 Pilot – Full Build (Part 1 of 2)
// Core logic + Cloud integration

// ---------- FIREBASE CONFIG ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, updateDoc,
  doc, deleteDoc, onSnapshot, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyWTP-EXAMPLEKEY-V55",
  authDomain: "weedtracker-v55.firebaseapp.com",
  projectId: "weedtracker-v55",
  storageBucket: "weedtracker-v55.appspot.com",
  messagingSenderId: "351202390517",
  appId: "1:351202390517:web:4c0d9c4e41example"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Silent login for tomschnierer@outlook.com
signInWithEmailAndPassword(auth, "tomschnierer@outlook.com", "AutoSync-55")
  .catch(err => console.warn("Login handled silently:", err.message));

onAuthStateChanged(auth, user => {
  if (user) console.log("✔ Signed in as", user.email);
  else console.warn("⚠ Offline mode – data will sync later");
});

// ---------- GLOBAL STORAGE ----------
let jobs = [];
let batches = [];
let chemicals = [];
let inventory = [];
let settings = {};

// ---------- SYNC HELPERS ----------
async function syncCollection(name, target) {
  const colRef = collection(db, name);
  onSnapshot(colRef, snap => {
    target.length = 0;
    snap.forEach(d => target.push({ id: d.id, ...d.data() }));
    console.log(`Synced ${name}: ${target.length} records`);
  });
}
syncCollection("jobs", jobs);
syncCollection("batches", batches);
syncCollection("inventory", inventory);
syncCollection("settings", [settings]);

// ---------- JOB HANDLERS ----------
async function saveJob(jobData) {
  try {
    if (jobData.id) {
      const docRef = doc(db, "jobs", jobData.id);
      await updateDoc(docRef, jobData);
    } else {
      await addDoc(collection(db, "jobs"), jobData);
    }
  } catch (e) {
    console.error("Job save failed:", e);
  }
}

// Auto-generate job name
function generateJobName(type, road, date) {
  const typeLetter = type === "Inspection" ? "I" :
                     type === "Spot Spray" ? "S" : "R";
  return `${typeLetter}${date.replaceAll("-", "")}-${road}`;
}

// ---------- BATCH HANDLERS ----------
async function saveBatch(batch) {
  try {
    if (batch.id) {
      await updateDoc(doc(db, "batches", batch.id), batch);
    } else {
      await addDoc(collection(db, "batches"), batch);
    }
  } catch (e) {
    console.error("Batch save error:", e);
  }
}

// ---------- INVENTORY & PROCUREMENT ----------
function updateStock(name, delta) {
  const chem = inventory.find(c => c.name === name);
  if (!chem) return;
  chem.stock = (chem.stock || 0) + delta;
  if (chem.stock <= chem.min) {
    addDoc(collection(db, "procurement"), {
      name: chem.name,
      status: "Low stock",
      date: new Date().toISOString()
    });
  }
  saveChemical(chem);
}

async function saveChemical(chem) {
  try {
    if (chem.id) {
      await updateDoc(doc(db, "inventory", chem.id), chem);
    } else {
      await addDoc(collection(db, "inventory"), chem);
    }
  } catch (e) {
    console.error("Chemical save failed:", e);
  }
}

// ---------- MAP & GEO ----------
let map, userMarker;
function initMap() {
  map = L.map("map").setView([-34.5, 148.3], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);
  L.control.scale().addTo(map);

  // Locate user
  map.locate({ setView: true, maxZoom: 15 });
  map.on("locationfound", e => {
    if (userMarker) userMarker.remove();
    userMarker = L.marker(e.latlng).addTo(map).bindPopup("You are here");
  });
}

function drawRoadLine(coords) {
  L.polyline(coords, { color: "yellow", weight: 4 }).addTo(map);
}

// ---------- UI HELPERS ----------
function showPopup(title, body) {
  const popup = document.createElement("div");
  popup.className = "popup";
  popup.innerHTML = `
    <div class="popup-header">${title}</div>
    <div class="popup-body">${body}</div>
    <button class="close-btn">Close</button>`;
  document.body.appendChild(popup);
  popup.querySelector(".close-btn").onclick = () => popup.remove();
} // WeedTracker V55 Pilot – Full Build (Part 2 of 2)
// UI wiring, forms, filters, popups, theme glue, and background sync helpers.
// (Part 1 included Firebase init, data models, and core helpers.)

// ---------- UTILITIES ----------
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const fmtDate = d => (d instanceof Date ? d : new Date(d)).toISOString().slice(0,10);
const nowISO = () => new Date().toISOString();
const toNumber = v => (v === "" || v == null ? 0 : Number(v));

// Weather helper (silent background; boxes display values)
async function fetchWeather(lat, lon) {
  // Using open-meteo style endpoint (no key). If blocked, fall back to empty values.
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;
    const r = await fetch(url);
    const j = await r.json();
    const c = j.current || {};
    return {
      temp: c.temperature_2m ?? "",
      humidity: c.relative_humidity_2m ?? "",
      windSpeed: c.wind_speed_10m ?? "",
      windDir: c.wind_direction_10m ?? ""
    };
  } catch {
    return { temp: "", humidity: "", windSpeed: "", windDir: "" };
  }
}

// Reverse geocode to street (fallback to coordinates if fails)
async function reverseGeocode(lat, lon) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
    const j = await r.json();
    return j.address?.road || j.display_name || `${lat.toFixed(5)},${lon.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)},${lon.toFixed(5)}`;
  }
}

// ---------- NAV & VIEWS ----------
const VIEWS = {
  HOME: "#view-home",
  CREATE: "#view-create",
  RECORDS: "#view-records",
  BATCHES: "#view-batches",
  INVENTORY: "#view-inventory",
  PROCUREMENT: "#view-procurement",
  MAP: "#view-map",
  SETTINGS: "#view-settings"
};

function show(viewSel) {
  // fade transition
  $$(".view").forEach(v => v.classList.remove("show"));
  const v = $(viewSel);
  if (!v) return;
  v.classList.add("show");
  window.scrollTo({ top: 0, behavior: "instant" });
}

// Home buttons
function bindHome() {
  $("#btn-create").onclick = () => { show(VIEWS.CREATE); initCreateForm(); };
  $("#btn-records").onclick = () => { show(VIEWS.RECORDS); renderRecords(); };
  $("#btn-batches").onclick = () => { show(VIEWS.BATCHES); renderBatches(); };
  $("#btn-inventory").onclick = () => { show(VIEWS.INVENTORY); renderInventory(); };
  $("#btn-procurement").onclick = () => { show(VIEWS.PROCUREMENT); renderProcurement(); };
  $("#btn-map").onclick = () => { show(VIEWS.MAP); initMapOnce(); renderMapFilters(); renderMapData(); };
  $$(".home-link").forEach(b => b.onclick = () => show(VIEWS.HOME));
  $("#btn-settings").onclick = () => { show(VIEWS.SETTINGS); renderSettings(); };
}

// ---------- CREATE TASK ----------
let currentGeo = { lat: null, lon: null, road: "" };

function initCreateForm() {
  // Defaults
  $("#task-type").value = "Inspection";
  $("#task-date").value = fmtDate(new Date());
  $("#task-start-time").value = "";
  $("#task-end-time").value = "";
  $("#task-complete").checked = false;
  $("#task-incomplete").checked = true;
  $("#council-job").value = "";
  $("#attach-photo").value = "";

  // Weather boxes cleared
  $("#wx-temp").value = "";
  $("#wx-humidity").value = "";
  $("#wx-wind-speed").value = "";
  $("#wx-wind-dir").value = "";

  // Weed dropdown labels visible above fields (handled in styles/index)
  // Reminder spinner 1–52 set default 4
  $("#rem-weeks").value = "4";

  // Locate Me
  $("#btn-locate").onclick = async () => {
    if (!navigator.geolocation) {
      alert("Location not available");
      return;
    }
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude, longitude } = pos.coords;
      currentGeo.lat = latitude; currentGeo.lon = longitude;
      const street = await reverseGeocode(latitude, longitude);
      currentGeo.road = street;
      $("#task-road").value = street;

      // Weather
      const wx = await fetchWeather(latitude, longitude);
      $("#wx-temp").value = wx.temp;
      $("#wx-humidity").value = wx.humidity;
      $("#wx-wind-speed").value = wx.windSpeed;
      $("#wx-wind-dir").value = wx.windDir;

      // Auto-name
      const type = $("#task-type").value;
      const date = $("#task-date").value;
      $("#auto-name").value = generateJobName(type, street.replaceAll(" ", ""), date);
    }, () => alert("Could not get GPS"));
  };

  // Auto-name button (if user changes type/date/road manually)
  $("#btn-autoname").onclick = () => {
    const type = $("#task-type").value;
    const date = $("#task-date").value;
    const road = $("#task-road").value || currentGeo.road || "UnnamedRoad";
    $("#auto-name").value = generateJobName(type, road.replaceAll(" ", ""), date);
  };

  // Start/Stop tracking visibility for Road Spray
  const trackRow = $("#row-tracking");
  const syncTrackingVisibility = () => {
    trackRow.style.display = $("#task-type").value === "Road Spray" ? "block" : "none";
  };
  $("#task-type").onchange = syncTrackingVisibility;
  syncTrackingVisibility();

  // Start/Stop tracking timestamps (simple markers)
  $("#btn-start-track").onclick = () => $("#task-start-time").value = new Date().toTimeString().slice(0,5);
  $("#btn-stop-track").onclick  = () => $("#task-end-time").value   = new Date().toTimeString().slice(0,5);

  // Save & Save as Draft
  $("#btn-save").onclick = () => persistTask(false);
  $("#btn-draft").onclick = () => persistTask(true);
}

async function persistTask(draft) {
  const type = $("#task-type").value;
  const date = $("#task-date").value;
  const startTime = $("#task-start-time").value;
  const endTime = $("#task-end-time").value;
  const road = $("#task-road").value || currentGeo.road || "";
  const jobName = $("#auto-name").value || generateJobName(type, (road||"Road").replaceAll(" ",""), date);
  const weed = $("#weed-select").value || "";
  const councilNo = $("#council-job").value || "";
  const complete = $("#task-complete").checked;

  const job = {
    name: jobName,
    type, date, startTime, endTime,
    road, weed, councilNo,
    draft, complete,
    lat: currentGeo.lat, lon: currentGeo.lon,
    weather: {
      temp: $("#wx-temp").value,
      humidity: $("#wx-humidity").value,
      windSpeed: $("#wx-wind-speed").value,
      windDir: $("#wx-wind-dir").value
    },
    linkedBatchIds: [],
    linkedJobIds: ($("#link-job").value || "").split(",").map(s => s.trim()).filter(Boolean),
    createdAt: nowISO(),
    updatedAt: nowISO()
  };

  // Attach photo (optional): just store the filename for now (static hosting)
  const file = $("#attach-photo").files?.[0];
  if (file) job.photoName = file.name;

  await saveJob(job);
  showPopup("Saved", `<div>Job <b>${job.name}</b> saved${draft ? " as draft" : ""}.</div>`);
  show(VIEWS.HOME);
}

// ---------- RECORDS ----------
function renderRecords() {
  const list = $("#records-list");
  list.innerHTML = "";

  // Filters
  const qType = $("#rec-type").value;            // All / Inspection / Spot / Road
  const qStatus = $("#rec-status").value;        // All / Complete / Incomplete / Draft
  const qFrom = $("#rec-from").value;
  const qTo = $("#rec-to").value;
  const qWeed = $("#rec-weed").value.trim().toLowerCase();
  const qCouncil = $("#rec-council").value.trim();

  const filtered = jobs.filter(j => {
    if (qType !== "All" && j.type !== qType) return false;
    if (qStatus === "Complete" && !j.complete) return false;
    if (qStatus === "Incomplete" && j.complete) return false;
    if (qStatus === "Draft" && !j.draft) return false;
    if (qFrom && j.date < qFrom) return false;
    if (qTo && j.date > qTo) return false;
    if (qWeed && !(j.weed||"").toLowerCase().includes(qWeed)) return false;
    if (qCouncil && j.councilNo !== qCouncil) return false;
    return true;
  }).sort((a,b)=> (b.date+a.name).localeCompare(a.date+b.name));

  filtered.forEach(j => {
    const li = document.createElement("li");
    li.className = "row";
    li.innerHTML = `
      <button class="pill">${j.name}</button>
    `;
    li.querySelector("button").onclick = () => openJobPopup(j);
    list.appendChild(li);
  });

  $("#rec-apply").onclick = renderRecords;
  $("#rec-reset").onclick = () => {
    $("#rec-type").value = "All";
    $("#rec-status").value = "All";
    $("#rec-from").value = "";
    $("#rec-to").value = "";
    $("#rec-weed").value = "";
    $("#rec-council").value = "";
    renderRecords();
  };
}

function openJobPopup(j) {
  const linked = (j.linkedBatchIds||[])
    .map(id => `<a href="#" data-batch="${id}" class="lnk">Batch ${id.slice(0,6)}</a>`).join(", ") || "—";
  const ljobs = (j.linkedJobIds||[])
    .map(id => `<a href="#" data-job="${id}" class="lnk">Job ${id.slice(0,6)}</a>`).join(", ") || "—";

  const body = `
    <div class="kv"><span>Type</span><span>${j.type}</span></div>
    <div class="kv"><span>Date</span><span>${j.date}</span></div>
    <div class="kv"><span>Road</span><span>${j.road||"—"}</span></div>
    <div class="kv"><span>Start</span><span>${j.startTime||"—"}</span></div>
    <div class="kv"><span>Finish</span><span>${j.endTime||"—"}</span></div>
    <div class="kv"><span>Weed</span><span>${j.weed||"—"}</span></div>
    <div class="kv"><span>Council #</span><span>${j.councilNo||"—"}</span></div>
    <div class="kv"><span>Status</span><span>${j.draft ? "Draft" : (j.complete ? "Complete" : "Incomplete")}</span></div>
    <hr/>
    <div class="kv"><span>Linked Batches</span><span>${linked}</span></div>
    <div class="kv"><span>Linked Jobs</span><span>${ljobs}</span></div>
    <hr/>
    <div class="grp">
      <button id="edit-job" class="btn">Edit</button>
      <button id="mark-complete" class="btn">Mark Complete</button>
      <button id="close-popup" class="btn gray">Close</button>
    </div>
  `;
  showPopup(j.name, body);

  document.querySelectorAll('[data-batch]').forEach(a => {
    a.onclick = (e) => {
      e.preventDefault();
      const b = batches.find(x => x.id === a.getAttribute("data-batch"));
      if (b) openBatchPopup(b);
    };
  });
  document.querySelectorAll('[data-job]').forEach(a => {
    a.onclick = (e) => {
      e.preventDefault();
      const other = jobs.find(x => x.id === a.getAttribute("data-job"));
      if (other) openJobPopup(other);
    };
  });

  $(".popup #edit-job").onclick = () => editJobInline(j);
  $(".popup #mark-complete").onclick = async () => {
    j.complete = true; j.draft = false; j.updatedAt = nowISO();
    await saveJob(j);
    document.querySelector(".popup .close-btn")?.click();
    renderRecords();
  };
  $(".popup #close-popup").onclick = () => document.querySelector(".popup .close-btn")?.click();
}

function editJobInline(j) {
  const form = `
    <label>Road<input id="e-road" value="${j.road||""}"></label>
    <label>Date<input id="e-date" type="date" value="${j.date||fmtDate(new Date())}"></label>
    <label>Start<input id="e-start" type="time" value="${j.startTime||""}"></label>
    <label>Finish<input id="e-end" type="time" value="${j.endTime||""}"></label>
    <label>Weed<input id="e-weed" value="${j.weed||""}"></label>
    <label>Council #<input id="e-council" value="${j.councilNo||""}"></label>
    <div class="grp">
      <button id="e-save" class="btn">Save</button>
      <button id="e-cancel" class="btn gray">Cancel</button>
    </div>
  `;
  const popupBody = document.querySelector(".popup-body");
  popupBody.innerHTML = form;
  $("#e-save").onclick = async () => {
    j.road = $("#e-road").value;
    j.date = $("#e-date").value;
    j.startTime = $("#e-start").value;
    j.endTime = $("#e-end").value;
    j.weed = $("#e-weed").value;
    j.councilNo = $("#e-council").value;
    j.name = generateJobName(j.type, (j.road||"").replaceAll(" ",""), j.date);
    j.updatedAt = nowISO();
    await saveJob(j);
    document.querySelector(".popup .close-btn")?.click();
    renderRecords();
  };
  $("#e-cancel").onclick = () => document.querySelector(".popup .close-btn")?.click();
}

// ---------- BATCHES ----------
function renderBatches() {
  const list = $("#batches-list");
  list.innerHTML = "";

  const qFrom = $("#bat-from").value;
  const qTo = $("#bat-to").value;

  const filtered = batches.filter(b => {
    if (qFrom && b.date < qFrom) return false;
    if (qTo && b.date > qTo) return false;
    return true;
  }).sort((a,b)=> (b.date+a.id).localeCompare(a.date+b.id));

  filtered.forEach(b => {
    const li = document.createElement("li");
    const empty = (toNumber(b.remainingMix) <= 0);
    li.className = "row";
    li.innerHTML = `
      <button class="pill ${empty ? "danger-border": ""}">Batch ${b.id?.slice(0,6) || "New"}</button>
    `;
    li.querySelector("button").onclick = () => openBatchPopup(b);
    list.appendChild(li);
  });

  $("#bat-apply").onclick = renderBatches;
  $("#bat-reset").onclick = () => {
    $("#bat-from").value = "";
    $("#bat-to").value = "";
    renderBatches();
  };

  // Create new batch button
  $("#btn-new-batch").onclick = () => openCreateBatch();
}

function openBatchPopup(b) {
  const chems = (b.chemicals||[]).map(c =>
    `<div class="kv"><span>${c.name}</span><span>${c.ratePer100} ${c.unit}/100L &nbsp;|&nbsp; Total: ${c.totalUsed||0} ${c.unit}</span></div>`
  ).join("") || "—";

  const jobsHtml = (b.linkedJobIds||[]).map(id =>
    `<a href="#" data-job="${id}" class="lnk">Job ${id.slice(0,6)}</a>`
  ).join(", ") || "—";

  const body = `
    <div class="kv"><span>Batch ID</span><span>${b.id?.slice(0,8) || "New"}</span></div>
    <div class="kv"><span>Date</span><span>${b.date || fmtDate(new Date())}</span></div>
    <div class="kv"><span>Total Mix</span><span>${b.totalMix || 0} L</span></div>
    <div class="kv"><span>Remaining</span><span>${b.remainingMix ?? b.totalMix || 0} L</span></div>
    <hr/>
    <div class="kv head"><span>Chemicals (rate & totals)</span><span></span></div>
    ${chems}
    <hr/>
    <div class="kv"><span>Linked Jobs</span><span>${jobsHtml}</span></div>
    <hr/>
    <div class="grp">
      <button id="edit-batch" class="btn">Edit</button>
      <button id="close-batch" class="btn gray">Close</button>
    </div>
  `;
  showPopup("Batch Details", body);

  document.querySelectorAll('[data-job]').forEach(a => {
    a.onclick = (e) => {
      e.preventDefault();
      const j = jobs.find(x => x.id === a.getAttribute("data-job"));
      if (j) openJobPopup(j);
    };
  });

  $(".popup #edit-batch").onclick = () => editBatchInline(b);
  $(".popup #close-batch").onclick = () => document.querySelector(".popup .close-btn")?.click();
}

function editBatchInline(b) {
  const body = `
    <label>Date<input id="bd-date" type="date" value="${b.date||fmtDate(new Date())}"></label>
    <label>Total Mix (L)<input id="bd-total" type="number" value="${b.totalMix||0}"></label>
    <label>Remaining (L)<input id="bd-rem" type="number" value="${b.remainingMix ?? b.totalMix || 0}"></label>
    <label>Linked Jobs (IDs comma-separated)<input id="bd-jobs" value="${(b.linkedJobIds||[]).join(",")}"></label>
    <div class="grp">
      <button id="bd-save" class="btn">Save</button>
      <button id="bd-cancel" class="btn gray">Cancel</button>
    </div>
  `;
  const el = $(".popup-body");
  el.innerHTML = body;
  $("#bd-save").onclick = async () => {
    b.date = $("#bd-date").value;
    b.totalMix = toNumber($("#bd-total").value);
    b.remainingMix = toNumber($("#bd-rem").value);
    b.linkedJobIds = $("#bd-jobs").value.split(",").map(s=>s.trim()).filter(Boolean);
    await saveBatch(b);
    document.querySelector(".popup .close-btn")?.click();
    renderBatches();
  };
  $("#bd-cancel").onclick = () => document.querySelector(".popup .close-btn")?.click();
}

function openCreateBatch() {
  // Simple modal builder for up to 10 chemicals with +Add button rows (as requested)
  let chems = [{name:"", ratePer100:"", unit:"L", totalUsed:0}];

  const render = () => {
    const chemRows = chems.map((c, idx) => `
      <div class="chem-row">
        <input placeholder="Chemical" value="${c.name}" data-idx="${idx}" data-k="name">
        <input placeholder="Rate per 100L" type="number" value="${c.ratePer100}" data-idx="${idx}" data-k="ratePer100">
        <select data-idx="${idx}" data-k="unit">
          <option ${c.unit==="L"?"selected":""}>L</option>
          <option ${c.unit==="mL"?"selected":""}>mL</option>
          <option ${c.unit==="kg"?"selected":""}>kg</option>
        </select>
      </div>
    `).join("");

    const body = `
      <label>Date<input id="nb-date" type="date" value="${fmtDate(new Date())}"></label>
      <label>Total Mix (L)<input id="nb-total" type="number" value="0"></label>
      <div class="kv head"><span>Chemicals</span><span></span></div>
      ${chemRows}
      <div class="grp">
        <button id="nb-add" class="btn">+ Add Chemical</button>
        <button id="nb-save" class="btn">Save Batch</button>
        <button id="nb-cancel" class="btn gray">Cancel</button>
      </div>
    `;
    showPopup("New Batch", body);

    // Wire inputs
    $$(".chem-row input, .chem-row select").forEach(inp => {
      inp.oninput = () => {
        const i = Number(inp.getAttribute("data-idx"));
        const k = inp.getAttribute("data-k");
        chems[i][k] = inp.type === "number" ? toNumber(inp.value) : inp.value;
      };
    });

    $("#nb-add").onclick = () => {
      if (chems.length >= 10) { alert("Max 10 chemicals"); return; }
      chems.push({name:"", ratePer100:"", unit:"L", totalUsed:0});
      document.querySelector(".popup .close-btn")?.click();
      render();
    };

    $("#nb-save").onclick = async () => {
      const totalMix = toNumber($("#nb-total").value);
      // Calculate total used per chem = (rate per 100L) * (totalMix / 100)
      chems.forEach(c => c.totalUsed = (toNumber(c.ratePer100) * (totalMix/100)).toFixed(2));

      const batch = {
        date: $("#nb-date").value,
        totalMix,
        remainingMix: totalMix,
        chemicals: chems,
        linkedJobIds: [],
        createdAt: nowISO(),
        updatedAt: nowISO()
      };
      await saveBatch(batch);
      document.querySelector(".popup .close-btn")?.click();
      renderBatches();
    };

    $("#nb-cancel").onclick = () => document.querySelector(".popup .close-btn")?.click();
  };

  render();
}

// ---------- INVENTORY ----------
function renderInventory() {
  const list = $("#inv-list");
  list.innerHTML = "";

  inventory
    .slice()
    .sort((a,b)=> (a.name||"").localeCompare(b.name||""))
    .forEach(c => {
      const li = document.createElement("li");
      li.className = "row";
      li.innerHTML = `
        <div class="inv-line">
          <span class="name">${c.name||"Unnamed"}</span>
          <span class="stock">${c.stock ?? 0} ${c.unit||""}</span>
          <div class="grp">
            <button class="btn sm" data-act="plus">＋</button>
            <button class="btn sm" data-act="minus">－</button>
            <button class="btn sm gray" data-act="edit">Edit</button>
          </div>
        </div>
      `;
      li.querySelector('[data-act="plus"]').onclick = async () => {
        c.stock = toNumber(c.stock) + 1;
        await saveChemical(c);
        renderInventory();
      };
      li.querySelector('[data-act="minus"]').onclick = async () => {
        c.stock = Math.max(0, toNumber(c.stock) - 1);
        await saveChemical(c);
        // Low stock? push to procurement
        if (toNumber(c.stock) <= toNumber(c.min||0)) {
          await addDoc(collection(db, "procurement"), {
            name: c.name, status: "Low stock", date: nowISO()
          });
        }
        renderInventory();
      };
      li.querySelector('[data-act="edit"]').onclick = () => openEditChemical(c);
      list.appendChild(li);
    });

  $("#btn-add-chemical").onclick = () => openEditChemical({ name:"", stock:0, unit:"L", min:0 });
}

function openEditChemical(c) {
  const body = `
    <label>Name<input id="ch-name" value="${c.name||""}"></label>
    <label>Stock<input id="ch-stock" type="number" value="${c.stock ?? 0}"></label>
    <label>Unit<select id="ch-unit">
      <option ${c.unit==="L"?"selected":""}>L</option>
      <option ${c.unit==="mL"?"selected":""}>mL</option>
      <option ${c.unit==="kg"?"selected":""}>kg</option>
      <option ${c.unit==="g"?"selected":""}>g</option>
    </select></label>
    <label>Low-stock threshold<input id="ch-min" type="number" value="${c.min ?? 0}"></label>
    <div class="grp">
      <button id="ch-save" class="btn">Save</button>
      <button id="ch-del" class="btn danger">Delete</button>
      <button id="ch-cancel" class="btn gray">Cancel</button>
    </div>
  `;
  showPopup("Chemical", body);

  $("#ch-save").onclick = async () => {
    c.name = $("#ch-name").value;
    c.stock = toNumber($("#ch-stock").value);
    c.unit = $("#ch-unit").value;
    c.min  = toNumber($("#ch-min").value);
    await saveChemical(c);
    document.querySelector(".popup .close-btn")?.click();
    renderInventory();
  };
  $("#ch-del").onclick = async () => {
    if (!c.id) { document.querySelector(".popup .close-btn")?.click(); return; }
    await deleteDoc(doc(db, "inventory", c.id));
    document.querySelector(".popup .close-btn")?.click();
    renderInventory();
  };
  $("#ch-cancel").onclick = () => document.querySelector(".popup .close-btn")?.click();
}

// ---------- PROCUREMENT ----------
function renderProcurement() {
  const list = $("#proc-list");
  list.innerHTML = "";
  // Pull procurement from cloud in live time
  onSnapshot(collection(db, "procurement"), snap => {
    list.innerHTML = "";
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    items.sort((a,b)=> (b.date||"").localeCompare(a.date||""));
    items.forEach(p => {
      const li = document.createElement("li");
      li.className = "row";
      li.innerHTML = `
        <div class="proc-line">
          <span class="name">${p.name}</span>
          <span class="status">${p.status||"needs order"}</span>
          <div class="grp">
            <button class="btn sm" data-act="snooze">Snooze</button>
            <button class="btn sm" data-act="done">Mark Ordered</button>
          </div>
        </div>
      `;
      li.querySelector('[data-act="snooze"]').onclick = async () => {
        await updateDoc(doc(db, "procurement", p.id), { status: "Snoozed", date: nowISO() });
      };
      li.querySelector('[data-act="done"]').onclick = async () => {
        await deleteDoc(doc(db, "procurement", p.id));
        renderProcurement();
      };
      list.appendChild(li);
    });
  });
}

// ---------- MAP ----------
let mapReady = false;
function initMapOnce() {
  if (!mapReady) {
    initMap();
    mapReady = true;
  }
}

function renderMapFilters() {
  $("#map-apply").onclick = renderMapData;
  $("#map-reset").onclick = () => {
    $("#map-type").value = "All";
    $("#map-from").value = "";
    $("#map-to").value = "";
    renderMapData();
  };
}

function renderMapData() {
  if (!map) return;
  // Clear layers except tile
  map.eachLayer(l => {
    // keep base tile layer
    if (l.getAttribution && l.getAttribution() && l.getAttribution().includes("OpenStreetMap")) return;
    if (l._url) return;
    map.removeLayer(l);
  });

  const qType = $("#map-type").value;
  const qFrom = $("#map-from").value;
  const qTo = $("#map-to").value;

  const filtered = jobs.filter(j => {
    if (qType !== "All" && j.type !== qType) return false;
    if (qFrom && j.date < qFrom) return false;
    if (qTo && j.date > qTo) return false;
    return true;
  });

  filtered.forEach(j => {
    if (j.type === "Road Spray" && j.track && j.track.length >= 2) {
      drawRoadLine(j.track); // expect array of [lat,lon] pairs
    }
    if (j.lat && j.lon) {
      const pin = L.marker([j.lat, j.lon]).addTo(map);
      pin.bindPopup(`<b>${j.name}</b><br>${j.type}<br>${j.date}`);
      pin.on("click", () => openJobPopup(j));
    }
  });
}

// ---------- SETTINGS ----------
function renderSettings() {
  $("#whoami").textContent = "Signed in as Thomas Schnierer (Outlook)";
  $("#btn-export").onclick = exportAll;
  $("#btn-clear").onclick = clearAll;
  $("#btn-backup-now").onclick = backgroundBackupNow; // optional visible button; runs silently
  // restore-from-backup handled via Drive list in a later screen (kept minimal here per request)
}

async function exportAll() {
  const blob = new Blob([JSON.stringify({ jobs, batches, inventory }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `WT_Export_${fmtDate(new Date())}.json`;
  a.click();
}

async function clearAll() {
  if (!confirm("This will clear local view. Cloud data remains. Continue?")) return;
  // Local arrays (cloud stays intact; next pull repopulates)
  jobs.length = 0;
  batches.length = 0;
  inventory.length = 0;
  showPopup("Cleared", "Local view cleared. Cloud sync will repopulate shortly.");
}

// ---------- BACKGROUND BACKUP (silent) ----------
async function backgroundBackupNow() {
  try {
    // Store a backup document (for Drive mirroring in your cloud function / daily job)
    await addDoc(collection(db, "backups"), {
      createdAt: nowISO(),
      payload: { jobs, batches, inventory }
    });
    // Silent by design; no toast.
  } catch (e) {
    console.warn("Backup now failed:", e.message);
  }
}

// ---------- BOOT ----------
document.addEventListener("DOMContentLoaded", () => {
  bindHome();
  show(VIEWS.HOME);

  // Pre-wire Records/Batches filters labels readability etc. (labels are in HTML/CSS)
  // Nothing else needed here; everything loads live from Firestore via onSnapshot.

  // Optional: quick locate to prime auto-naming during first visit to Create Task
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async pos => {
      currentGeo.lat = pos.coords.latitude;
      currentGeo.lon = pos.coords.longitude;
      currentGeo.road = await reverseGeocode(currentGeo.lat, currentGeo.lon);
    }, () => {});
  }
});


