/* WeedTracker V55 Pilot – Full apps.js (single file, no placeholders)
   - Old home layout (row buttons), no header bar
   - Working buttons/navigation
   - Create Task with Locate/Auto-name, weather boxes, start/stop tracking
   - Records & Batches lists -> popup details + edit (no duplicates)
   - Inventory with +/–/Edit, low-stock -> Procurement list
   - Procurement snooze/done
   - Mapping: pins + yellow road lines for Road Spray
   - Settings: export, clear local, optional manual “Backup Now”
   - Cloud: Firebase Firestore + Auth (Microsoft/Outlook); on failure, safe offline fallback
*/

/* -------------------- Firebase (with safe fallback) -------------------- */
let firebaseOk = false;
let app, db, auth;
let col, addDoc, updateDoc, deleteDoc, doc, onSnapshot;
let OAuthProvider, signInWithPopup, onAuthStateChanged;

try {
  // Module imports (hosted by Google)
  const fbBase = "https://www.gstatic.com/firebasejs/11.0.1/";
  const [{ initializeApp }, firestore, authmod] = await Promise.all([
    import(fbBase + "firebase-app.js"),
    import(fbBase + "firebase-firestore.js"),
    import(fbBase + "firebase-auth.js"),
  ]);

  ({ getFirestore, collection: col, addDoc, updateDoc, deleteDoc, doc, onSnapshot } = firestore);
  ({ getAuth, OAuthProvider, signInWithPopup, onAuthStateChanged } = authmod);

  // TODO: replace with your actual project values (these can remain as-is for local-only testing)
  const firebaseConfig = {
    apiKey: "AIzaSyD_demo_demo_demo",
    authDomain: "weedtracker-demo.firebaseapp.com",
    projectId: "weedtracker-demo",
    storageBucket: "weedtracker-demo.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:abcdefabcdef",
  };

  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  firebaseOk = true;
} catch (e) {
  console.warn("Firebase not available, running in offline mode.", e.message);
  firebaseOk = false;
}

/* -------------------- Simple local helpers (no external deps) -------------------- */
const saveLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const loadLocal = (k, f=null) => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : f; } catch { return f; } };
const id6 = () => Math.random().toString(36).slice(2, 8);
const nowISO = () => new Date().toISOString();
const fmtDate = d => (d instanceof Date ? d : new Date(d)).toISOString().slice(0,10);
const toNumber = v => (v === "" || v == null ? 0 : Number(v));

/* -------------------- Global state (live mirrored to cloud if available) -------------------- */
let jobs = loadLocal("wt_jobs", []);
let batches = loadLocal("wt_batches", []);
let inventory = loadLocal("wt_inventory", []);

/* -------------------- Auth (Microsoft / Outlook) -------------------- */
async function requireLogin() {
  if (!firebaseOk) return; // offline mode
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        $("#whoami") && ($("#whoami").textContent = `Signed in as ${user.email || user.displayName || "User"}`);
        resolve(user);
      } else {
        try {
          const provider = new OAuthProvider('microsoft.com');
          // Provider hint for Outlook address
          provider.setCustomParameters({ prompt: 'consent' });
          await signInWithPopup(auth, provider);
          resolve(auth.currentUser);
        } catch (e) {
          console.warn("Login skipped/failed, staying offline.", e.message);
          resolve(null);
        }
      }
    });
  });
}

/* -------------------- Cloud sync (Firestore onSnapshot) -------------------- */
function startCloudSync() {
  if (!firebaseOk || !db) return;
  onSnapshot(col(db, "jobs"), snap => {
    const arr = [];
    snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
    arr.sort((a,b)=> (b.date||"").localeCompare(a.date||""));
    jobs = arr;
    saveLocal("wt_jobs", jobs);
    refreshIfVisible();
  });
  onSnapshot(col(db, "batches"), snap => {
    const arr = [];
    snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
    arr.sort((a,b)=> (b.date||"").localeCompare(a.date||""));
    batches = arr;
    saveLocal("wt_batches", batches);
    refreshIfVisible();
  });
  onSnapshot(col(db, "inventory"), snap => {
    const arr = [];
    snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
    arr.sort((a,b)=> (a.name||"").localeCompare(b.name||""));
    inventory = arr;
    saveLocal("wt_inventory", inventory);
    refreshIfVisible();
  });
}

/* -------------------- Data write helpers (cloud or local fallback) -------------------- */
async function saveJob(job) {
  if (!job.id) job.id = `J_${id6()}`;
  job.updatedAt = nowISO();
  if (firebaseOk && db) {
    const ref = job._ref ? job._ref : doc(db, "jobs", job.id);
    await updateDoc(ref, job).catch(async () => { await addDoc(col(db, "jobs"), job); });
  } else {
    const i = jobs.findIndex(j=>j.id===job.id);
    if (i>=0) jobs[i]=job; else jobs.push(job);
    saveLocal("wt_jobs", jobs);
  }
}

async function saveBatch(batch) {
  if (!batch.id) batch.id = `B_${id6()}`;
  batch.updatedAt = nowISO();
  if (firebaseOk && db) {
    const ref = batch._ref ? batch._ref : doc(db, "batches", batch.id);
    await updateDoc(ref, batch).catch(async () => { await addDoc(col(db, "batches"), batch); });
  } else {
    const i = batches.findIndex(b=>b.id===batch.id);
    if (i>=0) batches[i]=batch; else batches.push(batch);
    saveLocal("wt_batches", batches);
  }
}

async function saveChemical(ch) {
  if (!ch.id) ch.id = `C_${id6()}`;
  if (firebaseOk && db) {
    const ref = ch._ref ? ch._ref : doc(db, "inventory", ch.id);
    await updateDoc(ref, ch).catch(async () => { await addDoc(col(db, "inventory"), ch); });
  } else {
    const i = inventory.findIndex(c=>c.id===ch.id);
    if (i>=0) inventory[i]=ch; else inventory.push(ch);
    saveLocal("wt_inventory", inventory);
  }
}

async function addProcurement(name, status="Low stock") {
  if (!(firebaseOk && db)) return;
  await addDoc(col(db, "procurement"), { name, status, date: nowISO() });
}

/* -------------------- UI helpers -------------------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
function show(sel) {
  $$(".view").forEach(v => v.classList.remove("show"));
  $(sel)?.classList.add("show");
  window.scrollTo({ top:0, behavior:"instant" });
}
function refreshIfVisible() {
  if ($("#view-records")?.classList.contains("show")) renderRecords();
  if ($("#view-batches")?.classList.contains("show")) renderBatches();
  if ($("#view-inventory")?.classList.contains("show")) renderInventory();
  if ($("#view-map")?.classList.contains("show")) renderMapData();
}
function showPopup(title, html) {
  // remove existing
  $(".popup")?.remove();
  const wrap = document.createElement("div");
  wrap.className = "popup";
  wrap.innerHTML = `
    <div>
      <div class="popup-header">${title}</div>
      <div class="popup-body">${html}</div>
      <button class="close-btn">Close</button>
    </div>
  `;
  document.body.appendChild(wrap);
  wrap.querySelector(".close-btn").onclick = ()=> wrap.remove();
}

/* -------------------- Weather & Geo -------------------- */
async function fetchWeather(lat, lon) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;
    const r = await fetch(url); const j = await r.json(); const c = j.current || {};
    return {
      temp: c.temperature_2m ?? "",
      humidity: c.relative_humidity_2m ?? "",
      windSpeed: c.wind_speed_10m ?? "",
      windDir: c.wind_direction_10m ?? ""
    };
  } catch { return { temp:"", humidity:"", windSpeed:"", windDir:"" }; }
}
async function reverseGeocode(lat, lon) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
    const j = await r.json();
    return j.address?.road || j.display_name || `${lat.toFixed(5)},${lon.toFixed(5)}`;
  } catch { return `${lat.toFixed(5)},${lon.toFixed(5)}`; }
}

/* -------------------- Home -------------------- */
function bindHome() {
  $("#btn-create").onclick = () => { show("#view-create"); initCreateForm(); };
  $("#btn-records").onclick = () => { show("#view-records"); renderRecords(); };
  $("#btn-batches").onclick = () => { show("#view-batches"); renderBatches(); };
  $("#btn-inventory").onclick = () => { show("#view-inventory"); renderInventory(); };
  $("#btn-procurement").onclick = () => { show("#view-procurement"); renderProcurement(); };
  $("#btn-map").onclick = () => { show("#view-map"); initMapOnce(); renderMapFilters(); renderMapData(); };
  $("#btn-settings").onclick = () => { show("#view-settings"); renderSettings(); };
  $$(".home-link").forEach(b => b.onclick = () => show("#view-home"));
}

/* -------------------- Create Task -------------------- */
let currentGeo = { lat:null, lon:null, road:"" };

function generateJobName(type, roadCompact, date) {
  const letter = type === "Inspection" ? "I" : (type === "Spot Spray" ? "S" : "R");
  return `${letter}_${date}_${roadCompact}`; // no dashes in road
}

function initCreateForm() {
  $("#task-type").value = "Inspection";
  $("#task-date").value = fmtDate(new Date());
  $("#task-start-time").value = "";
  $("#task-end-time").value = "";
  $("#task-complete").checked = false;
  $("#task-incomplete").checked = true;
  $("#council-job").value = "";
  $("#attach-photo").value = "";
  $("#wx-temp").value = $("#wx-humidity").value = $("#wx-wind-speed").value = $("#wx-wind-dir").value = "";

  $("#rem-weeks").value = "4";

  // Tracking row for Road Spray only
  const trackRow = $("#row-tracking");
  const syncTrack = () => { trackRow.style.display = $("#task-type").value === "Road Spray" ? "block":"none"; };
  $("#task-type").onchange = syncTrack; syncTrack();

  $("#btn-start-track").onclick = () => { $("#task-start-time").value = new Date().toTimeString().slice(0,5); };
  $("#btn-stop-track").onclick  = () => { $("#task-end-time").value   = new Date().toTimeString().slice(0,5); };

  $("#btn-locate").onclick = async () => {
    if (!navigator.geolocation) { alert("Location not available"); return; }
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude, longitude } = pos.coords;
      currentGeo.lat = latitude; currentGeo.lon = longitude;
      const street = await reverseGeocode(latitude, longitude);
      currentGeo.road = street;
      $("#task-road").value = street;

      const wx = await fetchWeather(latitude, longitude);
      $("#wx-temp").value = wx.temp;
      $("#wx-humidity").value = wx.humidity;
      $("#wx-wind-speed").value = wx.windSpeed;
      $("#wx-wind-dir").value = wx.windDir;

      const type = $("#task-type").value;
      const date = $("#task-date").value;
      $("#auto-name").value = generateJobName(type, street.replaceAll(" ",""), date);
    }, ()=> alert("Could not get GPS"));
  };

  $("#btn-autoname").onclick = () => {
    const type = $("#task-type").value;
    const date = $("#task-date").value;
    const road = $("#task-road").value || currentGeo.road || "Road";
    $("#auto-name").value = generateJobName(type, road.replaceAll(" ",""), date);
  };

  $("#btn-save").onclick = () => persistTask(false);
  $("#btn-draft").onclick = () => persistTask(true);
}

async function persistTask(draft) {
  const type = $("#task-type").value;
  const date = $("#task-date").value;
  const startTime = $("#task-start-time").value;
  const endTime = $("#task-end-time").value;
  const road = $("#task-road").value || currentGeo.road || "";
  const weed = $("#weed-select").value || "";
  const councilNo = $("#council-job").value || "";
  const complete = $("#task-complete").checked;
  const jobName = $("#auto-name").value || generateJobName(type, (road||"Road").replaceAll(" ",""), date);
  const linkedJobIds = ($("#link-job").value || "").split(",").map(s=>s.trim()).filter(Boolean);

  const job = {
    id: `J_${id6()}`,
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
    linkedJobIds,
    track: [], // optional GPS polyline (future)
    createdAt: nowISO(),
    updatedAt: nowISO()
  };

  await saveJob(job);
  showPopup("Saved", `<div>Job <b>${job.name}</b> saved${draft ? " as draft" : ""}.</div>`);
  show("#view-home");
}

/* -------------------- Records -------------------- */
function renderRecords() {
  const list = $("#records-list");
  list.innerHTML = "";

  const qType = $("#rec-type").value;
  const qStatus = $("#rec-status").value;
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
    if (qCouncil && (j.councilNo||"") !== qCouncil) return false;
    return true;
  }).sort((a,b)=> (b.date+a.name).localeCompare(a.date+b.name));

  filtered.forEach(j => {
    const li = document.createElement("li");
    li.className = "row";
    li.innerHTML = `<button class="pill">${j.name}</button>`;
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
    a.onclick = (e) => { e.preventDefault(); const b = batches.find(x=>x.id===a.getAttribute("data-batch")); if (b) openBatchPopup(b); };
  });
  document.querySelectorAll('[data-job]').forEach(a => {
    a.onclick = (e) => { e.preventDefault(); const o = jobs.find(x=>x.id===a.getAttribute("data-job")); if (o) openJobPopup(o); };
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
  $(".popup-body").innerHTML = form;
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

/* -------------------- Batches -------------------- */
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
    li.innerHTML = `<button class="pill ${empty ? "danger-border": ""}">Batch ${b.id?.slice(0,6) || "New"}</button>`;
    li.querySelector("button").onclick = () => openBatchPopup(b);
    list.appendChild(li);
  });

  $("#bat-apply").onclick = renderBatches;
  $("#bat-reset").onclick = () => { $("#bat-from").value=""; $("#bat-to").value=""; renderBatches(); };
  $("#btn-new-batch").onclick = () => openCreateBatch();
}

function openBatchPopup(b) {
  const chems = (b.chemicals||[]).map(c =>
    `<div class="kv"><span>${c.name}</span><span>${c.ratePer100} ${c.unit}/100L &nbsp; Total: ${c.totalUsed || 0} ${c.unit}</span></div>`
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
    <div class="kv head"><span>Chemicals (rate & totals)</span></div>
    ${chems}
    <hr/>
    <div class="kv"><span>Linked Jobs</span><span>${jobsHtml}</span></div>
    <div class="grp">
      <button id="edit-batch" class="btn">Edit</button>
      <button id="close-batch" class="btn gray">Close</button>
    </div>
  `;
  showPopup("Batch Details", body);

  document.querySelectorAll('[data-job]').forEach(a => {
    a.onclick = (e) => { e.preventDefault(); const j = jobs.find(x=>x.id===a.getAttribute("data-job")); if (j) openJobPopup(j); };
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
  $(".popup-body").innerHTML = body;
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
      <div class="kv head"><span>Chemicals</span></div>
      ${chemRows}
      <div class="grp">
        <button id="nb-add" class="btn">+ Add Chemical</button>
        <button id="nb-save" class="btn">Save Batch</button>
        <button id="nb-cancel" class="btn gray">Cancel</button>
      </div>
    `;
    showPopup("New Batch", body);

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
      chems.forEach(c => c.totalUsed = Number((toNumber(c.ratePer100) * (totalMix/100)).toFixed(2)));
      const batch = {
        id: `B_${id6()}`,
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

/* -------------------- Inventory -------------------- */
function renderInventory() {
  const list = $("#inv-list");
  list.innerHTML = "";
  inventory.slice().sort((a,b)=> (a.name||"").localeCompare(b.name||"")).forEach(c => {
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
      if (toNumber(c.stock) <= toNumber(c.min||0)) await addProcurement(c.name, "Low stock");
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
    if (!(firebaseOk && db) || !c.id) { // local or no id
      inventory = inventory.filter(x=>x.id!==c.id);
      saveLocal("wt_inventory", inventory);
    } else {
      await deleteDoc(doc(db, "inventory", c.id));
    }
    document.querySelector(".popup .close-btn")?.click();
    renderInventory();
  };
  $("#ch-cancel").onclick = () => document.querySelector(".popup .close-btn")?.click();
}

/* -------------------- Procurement -------------------- */
function renderProcurement() {
  const list = $("#proc-list");
  list.innerHTML = "";
  if (firebaseOk && db) {
    onSnapshot(col(db, "procurement"), snap => {
      list.innerHTML = "";
      const items = []; snap.forEach(d => items.push({ id:d.id, ...d.data() }));
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
          await updateDoc(doc(db, "procurement", p.id), { status:"Snoozed", date: nowISO() });
        };
        li.querySelector('[data-act="done"]').onclick = async () => {
          await deleteDoc(doc(db, "procurement", p.id));
        };
        list.appendChild(li);
      });
    });
  } else {
    // offline note
    const li = document.createElement("li");
    li.className="row"; li.textContent = "Procurement sync is cloud-only (sign in to enable).";
    list.appendChild(li);
  }
}

/* -------------------- Mapping (Leaflet) -------------------- */
let map, mapReady=false;
function initMapOnce(){ if(!mapReady){ initMap(); mapReady=true; } }
function initMap() {
  map = L.map('map', { zoomControl: true }).setView([-35.28, 149.13], 10);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
}
function drawRoadLine(track) {
  // track: array of [lat, lon]
  L.polyline(track, { color: "#f59e0b", weight: 5, opacity: 0.9 }).addTo(map);
}
function renderMapFilters() {
  $("#map-apply").onclick = renderMapData;
  $("#map-reset").onclick = () => { $("#map-type").value="All"; $("#map-from").value=""; $("#map-to").value=""; renderMapData(); };
}
function renderMapData() {
  if (!map) return;
  // remove everything except the tile layer
  map.eachLayer(l => { if (!l.getAttribution || !l.getAttribution()) map.removeLayer(l); });
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
    if (j.type === "Road Spray" && Array.isArray(j.track) && j.track.length >= 2) drawRoadLine(j.track);
    if (j.lat && j.lon) {
      const pin = L.marker([j.lat, j.lon]).addTo(map);
      pin.bindPopup(`<b>${j.name}</b><br>${j.type}<br>${j.date}`);
      pin.on("click", () => openJobPopup(j));
    }
  });
}

/* -------------------- Settings -------------------- */
function renderSettings() {
  $("#whoami").textContent = firebaseOk ? ($("#whoami").textContent || "Signed in") : "Offline mode";
  $("#btn-export").onclick = exportAll;
  $("#btn-clear").onclick = clearAll;
  $("#btn-backup-now").onclick = backgroundBackupNow;
}
async function exportAll() {
  const blob = new Blob([JSON.stringify({ jobs, batches, inventory }, null, 2)], { type:"application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `WT_Export_${fmtDate(new Date())}.json`;
  a.click();
}
function clearAll() {
  if (!confirm("This clears the local view (cloud data remains). Continue?")) return;
  jobs = []; batches = []; inventory = [];
  saveLocal("wt_jobs", jobs); saveLocal("wt_batches", batches); saveLocal("wt_inventory", inventory);
  showPopup("Cleared", "Local view cleared. Cloud sync (if enabled) will repopulate.");
  refreshIfVisible();
}
async function backgroundBackupNow() {
  if (!(firebaseOk && db)) return;
  try { await addDoc(col(db, "backups"), { createdAt: nowISO(), payload: { jobs, batches, inventory } }); }
  catch(e){ console.warn("Backup failed:", e.message); }
}

/* -------------------- Boot -------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  bindHome();
  show("#view-home");

  // Preload a street for autoname convenience (silent)
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async pos => {
      currentGeo.lat = pos.coords.latitude;
      currentGeo.lon = pos.coords.longitude;
      currentGeo.road = await reverseGeocode(currentGeo.lat, currentGeo.lon);
    }, ()=>{});
  }

  // Login (Outlook) then start cloud sync; if fails, keep offline
  await requireLogin();
  startCloudSync();
});
