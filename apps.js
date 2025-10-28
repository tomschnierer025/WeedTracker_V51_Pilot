/* WeedTracker V60 Pilot — apps.js */
/* Core app controller: tasks, records, map integration, navigation */

let DB = loadDB();

/* ---------- Initial Setup ---------- */
document.addEventListener("DOMContentLoaded", () => {
  renderRecords();
  renderBatches();
  setupMap();
});

/* ---------- Save Task ---------- */
function saveTask(isDraft = false) {
  showSpinner(isDraft ? "Saving draft…" : "Saving task…");

  const t = {
    id: Date.now(),
    name: document.getElementById("jobName").value || "Unnamed Task",
    type: document.getElementById("taskType").value,
    council: document.getElementById("councilNum").value,
    weed: document.getElementById("weedSelect").value,
    batch: document.getElementById("batchSelect").value,
    date: document.getElementById("jobDate").value || todayISO(),
    start: document.getElementById("startTime").value,
    end: document.getElementById("endTime").value,
    temp: document.getElementById("temp").value,
    humidity: document.getElementById("humidity").value,
    wind: document.getElementById("wind").value,
    windDir: document.getElementById("windDir").value,
    reminder: document.getElementById("reminderWeeks").value,
    status: document.getElementById("statusSelect").value || (isDraft ? "Draft" : "Incomplete"),
    notes: document.getElementById("notes").value,
    road: document.getElementById("locRoad").textContent,
    coords: window.__trackCoords || [],
    createdAt: new Date().toISOString(),
  };

  addOrUpdateTask(t);
  hideSpinner();
  showToast(isDraft ? "Draft saved" : "Task saved");

  if (typeof renderRecords === "function") renderRecords();
}

/* Button bindings */
document.getElementById("saveTask")?.addEventListener("click", () => saveTask(false));
document.getElementById("saveDraft")?.addEventListener("click", () => saveTask(true));

/* ---------- Render Records ---------- */
function renderRecords() {
  const list = document.getElementById("recordsList");
  if (!list) return;
  const tasks = getTasks();
  if (!tasks.length) {
    list.innerHTML = "<p>No records yet.</p>";
    return;
  }

  const q = (document.getElementById("recSearch")?.value || "").toLowerCase();
  const from = document.getElementById("recFrom")?.value || "";
  const to = document.getElementById("recTo")?.value || "";

  const types = {
    Inspection: document.getElementById("fInspection")?.checked,
    "Spot Spray": document.getElementById("fSpot")?.checked,
    "Road Spray": document.getElementById("fRoad")?.checked,
  };
  const statuses = {
    Complete: document.getElementById("fComplete")?.checked,
    Incomplete: document.getElementById("fIncomplete")?.checked,
    Draft: document.getElementById("fDraft")?.checked,
  };

  list.innerHTML = "";
  tasks
    .filter(t => {
      if (from && (t.date || "") < from) return false;
      if (to && (t.date || "") > to) return false;

      const typeEmpty = !types.Inspection && !types["Spot Spray"] && !types["Road Spray"];
      const statusEmpty = !statuses.Complete && !statuses.Incomplete && !statuses.Draft;

      const tOK = typeEmpty || types[t.type];
      const sOK = statusEmpty || statuses[t.status];
      const hay = `${t.name} ${t.road} ${t.weed} ${t.council}`.toLowerCase();
      return tOK && sOK && (!q || hay.includes(q));
    })
    .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
    .forEach(t => {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <b>${t.name}</b><br>
        <small>${t.type} • ${formatDateAU(t.date)} • ${t.status}</small>
        <div class="row gap end mt-2">
          <button class="pill" data-open>Open</button>
          <button class="pill" data-edit>Edit</button>
        </div>`;
      div.querySelector("[data-open]").onclick = () => showJobPopup(t);
      div.querySelector("[data-edit]").onclick = () => editTask(t.id);
      list.appendChild(div);
    });
}

/* ---------- Edit Task ---------- */
function editTask(id) {
  const t = getTasks().find(x => x.id === id);
  if (!t) return alert("Task not found");
  switchScreen("createTask");
  document.getElementById("taskType").value = t.type;
  document.getElementById("jobName").value = t.name;
  document.getElementById("councilNum").value = t.council;
  document.getElementById("weedSelect").value = t.weed;
  document.getElementById("batchSelect").value = t.batch;
  document.getElementById("jobDate").value = t.date;
  document.getElementById("startTime").value = t.start;
  document.getElementById("endTime").value = t.end;
  document.getElementById("temp").value = t.temp;
  document.getElementById("humidity").value = t.humidity;
  document.getElementById("wind").value = t.wind;
  document.getElementById("windDir").value = t.windDir;
  document.getElementById("notes").value = t.notes;
  document.getElementById("statusSelect").value = t.status;
  document.getElementById("locRoad").textContent = t.road;
}

/* ---------- Job Popup ---------- */
function showJobPopup(t) {
  const html = `
  <div class="modal" id="jobModal">
    <div class="card scrollable" style="max-height:90vh;overflow-y:auto;">
      <div class="row spread">
        <h3>${t.name}</h3>
        <button class="pill warn" data-close>Close</button>
      </div>
      <p><b>Type:</b> ${t.type}</p>
      <p><b>Date:</b> ${formatDateAU(t.date)}</p>
      <p><b>Road:</b> ${t.road}</p>
      <p><b>Weed:</b> ${t.weed}</p>
      <p><b>Status:</b> ${t.status}</p>
      <p><b>Batch:</b> ${t.batch || "–"}</p>
      <p><b>Notes:</b><br>${t.notes || "–"}</p>
      <div class="row gap mt">
        <button class="pill" id="navApple">🗺 Open in Apple Maps</button>
      </div>
    </div>
  </div>`;
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  document.body.appendChild(wrap.firstChild);
  const modal = document.getElementById("jobModal");
  modal.onclick = e => { if (e.target === modal || e.target.dataset.close != null) modal.remove(); };
  document.getElementById("navApple").onclick = () => {
    if (t.coords?.length) {
      const c = t.coords[t.coords.length - 1];
      openAppleMaps(c.lat, c.lon);
    } else {
      showToast("No location data available");
    }
  };
}

/* ---------- Map Rendering ---------- */
function setupMap() {
  if (!window.L) return;
  const map = L.map("map").setView([-34.75, 148.65], 10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom: 19 }).addTo(map);
  window.__leafletMap = map;
  renderMapPins();
}

function renderMapPins() {
  if (!window.L || !window.__leafletMap) return;
  const map = window.__leafletMap;
  const tasks = getTasks().filter(t => t.coords?.length);
  tasks.forEach(t => {
    const c = t.coords[t.coords.length - 1];
    const m = L.marker([c.lat, c.lon]).addTo(map);
    m.bindPopup(`<b>${t.name}</b><br>${t.type}<br>${formatDateAU(t.date)}<br><button onclick="openAppleMaps(${c.lat},${c.lon})">Navigate</button>`);
  });
}

/* ---------- Helpers ---------- */
function formatDateAU(d) {
  if (!d) return "–";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,"0")}-${String(dt.getMonth()+1).padStart(2,"0")}-${dt.getFullYear()}`;
}

/* ---------- Apple Maps Navigation ---------- */
function openAppleMaps(lat, lon) {
  const mapsURL = `maps://?daddr=${lat},${lon}&dirflg=d`;
  const webURL = `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
  const a = document.createElement("a");
  a.href = mapsURL;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ window.open(webURL,"_blank"); a.remove(); }, 250);
}

console.log("✅ apps.js loaded");
