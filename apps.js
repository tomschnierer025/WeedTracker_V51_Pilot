/* WeedTracker V63 – Charcoal Edition
-----------------------------------*/

// ---------- GLOBAL VARIABLES ----------
let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
let chemicals = JSON.parse(localStorage.getItem("chemicals")) || [];
let batches = JSON.parse(localStorage.getItem("batches")) || [];
let map;

// ---------- NAVIGATION ----------
function openPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");
  window.scrollTo(0, 0);
}

// ---------- LOCATION ----------
function getLocation() {
  if (!navigator.geolocation) return alert("GPS not supported");
  navigator.geolocation.getCurrentPosition(pos => {
    const coords = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
    document.getElementById("location").value = coords;
    const now = new Date();
    const road = "AutoRoad"; // placeholder; real version uses reverse geocode
    const type = document.getElementById("jobType").value[0].toUpperCase();
    const name = `${road}-${now.toISOString().slice(0,10)}-${type}`;
    document.getElementById("autoJobName").value = name;
  }, () => alert("Unable to fetch location"));
}

// ---------- TASK MANAGEMENT ----------
function saveTask() {
  const jobType = document.getElementById("jobType").value;
  const jobName = document.getElementById("autoJobName").value;
  const councilJob = document.getElementById("councilJobNumber").value;
  const loc = document.getElementById("location").value;
  const weed = document.getElementById("weedSelect").value;
  const batch = document.getElementById("batchSelect").value;
  const notes = document.getElementById("notes").value;
  const temp = document.getElementById("temperature").value;
  const humidity = document.getElementById("humidity").value;
  const windSpeed = document.getElementById("windSpeed").value;
  const windDirection = document.getElementById("windDirection").value;
  const date = document.getElementById("jobDateTime").value;
  const status = "Incomplete";

  if (!jobName) return alert("Please get location first.");

  const task = {
    id: Date.now(),
    jobType,
    jobName,
    councilJob,
    loc,
    weed,
    batch,
    notes,
    temp,
    humidity,
    windSpeed,
    windDirection,
    date,
    status
  };

  tasks.push(task);
  localStorage.setItem("tasks", JSON.stringify(tasks));
  showSpinner("Task Saved ✅");
  renderRecords();
}

function showSpinner(msg) {
  const pop = document.createElement("div");
  pop.className = "popup";
  pop.innerHTML = `<p>${msg}</p>`;
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 1500);
}

function markTask(state) {
  alert(`Task marked as ${state}`);
}

// ---------- RECORDS ----------
function renderRecords() {
  const container = document.getElementById("recordList");
  container.innerHTML = "";
  if (tasks.length === 0) {
    container.innerHTML = "<p>No records found.</p>";
    return;
  }
  tasks.forEach(t => {
    const card = document.createElement("div");
    card.className = "record-card";
    card.innerHTML = `
      <b>${t.jobName}</b><br>
      Weed: ${t.weed}<br>
      Type: ${t.jobType}<br>
      <button onclick="openRecord(${t.id})">Open</button>
      <button onclick="editRecord(${t.id})">Edit</button>
      <button onclick="deleteRecord(${t.id})">Delete</button>
    `;
    container.appendChild(card);
  });
}

function openRecord(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const pop = document.createElement("div");
  pop.className = "popup";
  pop.innerHTML = `
    <button class="close" onclick="this.parentNode.remove()">X</button>
    <h3>${task.jobName}</h3>
    <p><b>Weed:</b> ${task.weed}</p>
    <p><b>Location:</b> ${task.loc}</p>
    <p><b>Batch:</b> ${task.batch}</p>
    <p><b>Notes:</b> ${task.notes}</p>
    <button onclick="navigateToJob('${task.loc}')">Navigate 🚗</button>
  `;
  document.body.appendChild(pop);
}

function editRecord(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  alert("Edit mode for " + task.jobName + " (coming soon)");
}

function deleteRecord(id) {
  tasks = tasks.filter(t => t.id !== id);
  localStorage.setItem("tasks", JSON.stringify(tasks));
  renderRecords();
}

// ---------- BATCH MANAGEMENT ----------
function renderBatches() {
  const container = document.getElementById("batchList");
  container.innerHTML = "";
  if (batches.length === 0) {
    container.innerHTML = "<p>No batches available.</p>";
    return;
  }
  batches.forEach(b => {
    const card = document.createElement("div");
    card.className = "batch-card";
    const color = b.remaining <= 0 ? "red" : "lime";
    card.innerHTML = `
      <b>${b.name}</b> (${b.date})<br>
      Total: ${b.total}L | Remaining: <span style="color:${color}">${b.remaining}</span><br>
      <button onclick="openBatch(${b.id})">Open</button>
      <button onclick="deleteBatch(${b.id})">Delete</button>
    `;
    container.appendChild(card);
  });
}

function openBatch(id) {
  const b = batches.find(x => x.id === id);
  if (!b) return;
  const pop = document.createElement("div");
  pop.className = "popup";
  pop.innerHTML = `
    <button class="close" onclick="this.parentNode.remove()">X</button>
    <h3>${b.name}</h3>
    <p><b>Date:</b> ${b.date}</p>
    <p><b>Chemicals:</b> ${b.chems.map(c => `${c.name} - ${c.rate}/100L`).join("<br>")}</p>
    <p><b>Total Mix:</b> ${b.total}L</p>
    <p><b>Remaining:</b> ${b.remaining}L</p>
    <button onclick="dumpBatch(${b.id})">Dump 🧪</button>
  `;
  document.body.appendChild(pop);
}

function deleteBatch(id) {
  batches = batches.filter(b => b.id !== id);
  localStorage.setItem("batches", JSON.stringify(batches));
  renderBatches();
}

function dumpBatch(id) {
  const reason = prompt("Reason for dumping?");
  if (!reason) return;
  const batch = batches.find(b => b.id === id);
  if (batch) {
    batch.remaining = 0;
    batch.dumpReason = reason;
    localStorage.setItem("batches", JSON.stringify(batches));
    renderBatches();
  }
}

// ---------- MAPPING ----------
function initMap() {
  if (map) return;
  map = L.map("map").setView([-34.55, 148.37], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);
}

function locateUser() {
  if (!map) initMap();
  map.locate({ setView: true, maxZoom: 16 });
}

function navigateToJob(loc) {
  const [lat, lon] = loc.split(", ");
  window.open(`http://maps.apple.com/?daddr=${lat},${lon}`, "_blank");
}
/* ---------- UTILITIES & CONSTANTS ---------- */
const NOXIOUS_FLAG = "⚠";
const NOXIOUS_COLOR = "red";
const NOXIOUS_COLOR_ALT = "gold";

const DEFAULT_WEEDS = [
  "Noxious Weeds",                       // category (red)
  "African Lovegrass",                   // listed (yellow)
  "Serrated Tussock",
  "St John’s Wort",
  "Bathurst Burr",
  "Blackberry",
  "Cape Broom",                          // added per request
  "Patterson’s Curse",
  "Sweet Briar",
  "Willow spp.",
  "Gorse",
  "Fireweed",
  "Coolatai Grass",
  "Chilean Needle Grass",
  "Cape Broom",                          // keep in list to ensure present
  "Saffron Thistle",
  "Silverleaf Nightshade",
  "Fleabane",
  "Caltrop",
  "Prickly Pear",
  "Three-cornered Jack"
];

/* ---------- INITIAL CHEMICALS (if empty) ---------- */
const DEFAULT_CHEMICALS = [
  { name: "Crucial", active: "Glyphosate 540 g/L", containerSize: 20, containerUnit: "L", containers: 4, threshold: 2 },
  { name: "Bosol",   active: "Metsulfuron-methyl", containerSize: 500, containerUnit: "g", containers: 2, threshold: 1 },
  { name: "Grazon",  active: "Triclopyr + Picloram", containerSize: 20, containerUnit: "L", containers: 1, threshold: 1 }
];

/* ---------- ONE-TIME SEEDS ---------- */
(function seedData() {
  if (!Array.isArray(chemicals) || chemicals.length === 0) {
    chemicals = DEFAULT_CHEMICALS.slice();
    localStorage.setItem("chemicals", JSON.stringify(chemicals));
  }
  // Ensure weeds select is populated once UI exists
  setTimeout(populateWeeds, 0);
})();

/* ---------- RENDER HELPERS ---------- */
function populateWeeds() {
  const sel = document.getElementById("weedSelect");
  if (!sel) return;
  const listed = DEFAULT_WEEDS.slice(1).sort((a,b)=>a.localeCompare(b));
  sel.innerHTML = "";

  // Noxious category (red)
  const cat = document.createElement("option");
  cat.textContent = `${NOXIOUS_FLAG} Noxious Weeds`;
  cat.value = "Noxious Weeds";
  cat.style.color = NOXIOUS_COLOR;
  sel.appendChild(cat);

  // Listed noxious weeds (yellow triangles)
  listed.forEach(w => {
    const o = document.createElement("option");
    o.value = w;
    o.textContent = `${NOXIOUS_FLAG} ${w}`;
    o.style.color = NOXIOUS_COLOR_ALT;
    sel.appendChild(o);
  });
}

function renderInventory() {
  const container = document.getElementById("chemicalList");
  if (!container) return;
  container.innerHTML = "";

  // SDS pinned link (already in HTML page; we just ensure chemicals list below)
  if (!chemicals || chemicals.length === 0) {
    container.innerHTML = `<p>No chemicals yet.</p>`;
    return;
  }

  chemicals
    .slice()
    .sort((a,b)=>a.name.localeCompare(b.name))
    .forEach(c => {
      const total = (Number(c.containerSize)||0) * (Number(c.containers)||0);
      const low = c.threshold && (c.containers||0) < c.threshold;
      const card = document.createElement("div");
      card.className = "record-card";
      card.style.borderLeft = low ? "4px solid #ff5252" : "4px solid #2f7d31";
      card.innerHTML = `
        <b>🧪 ${c.name}</b><br>
        Active: ${c.active || "—"}<br>
        Pack: ${c.containerSize || 0} ${c.containerUnit || "L"} × ${c.containers || 0} = <b>${total} ${c.containerUnit || "L"}</b><br>
        Threshold: ${c.threshold || 0} container(s)
        <div style="margin-top:8px;">
          <button onclick="openChem('${c.name}')">Edit</button>
          <button onclick="removeChem('${c.name}')">Delete</button>
        </div>
      `;
      container.appendChild(card);
    });

  // Add button pinned at end
  const add = document.createElement("button");
  add.textContent = "➕ Add Chemical";
  add.style.marginTop = "10px";
  add.onclick = () => openChem(); // new
  container.appendChild(add);
}

function openChem(name) {
  let c = chemicals.find(x => x.name === name) || {name:"",active:"",containerSize:20,containerUnit:"L",containers:0,threshold:0};
  const pop = document.createElement("div");
  pop.className = "popup";
  pop.innerHTML = `
    <button class="close" onclick="this.parentNode.remove()">✕</button>
    <h3>${name ? "Edit Chemical" : "Add Chemical"}</h3>
    <label>Name</label><input id="ce_name" value="${c.name}">
    <label>Active Ingredient</label><input id="ce_active" value="${c.active}">
    <label>Container Size</label><input id="ce_size" type="number" value="${c.containerSize}">
    <label>Unit</label>
      <select id="ce_unit">
        <option ${c.containerUnit==="L"?"selected":""}>L</option>
        <option ${c.containerUnit==="mL"?"selected":""}>mL</option>
        <option ${c.containerUnit==="g"?"selected":""}>g</option>
        <option ${c.containerUnit==="kg"?"selected":""}>kg</option>
      </select>
    <label>Containers</label><input id="ce_count" type="number" value="${c.containers}">
    <label>Threshold (containers)</label><input id="ce_thr" type="number" value="${c.threshold}">
    <div style="margin-top:10px;display:flex;gap:8px;justify-content:flex-end;">
      <button onclick="saveChem('${name||""}')">Save</button>
      <button class="close" onclick="this.parentNode.parentNode.remove()">Close</button>
    </div>
  `;
  document.body.appendChild(pop);
}

function saveChem(prevName) {
  const n = document.getElementById("ce_name").value.trim();
  if (!n) return alert("Chemical name required.");
  const obj = {
    name: n,
    active: document.getElementById("ce_active").value.trim(),
    containerSize: Number(document.getElementById("ce_size").value)||0,
    containerUnit: document.getElementById("ce_unit").value,
    containers: Number(document.getElementById("ce_count").value)||0,
    threshold: Number(document.getElementById("ce_thr").value)||0
  };
  const idx = chemicals.findIndex(x => x.name === prevName);
  if (idx >= 0) chemicals[idx] = obj;
  else {
    // prevent duplicates
    const dup = chemicals.find(x => x.name.toLowerCase()===n.toLowerCase());
    if (dup) return alert("Chemical with this name already exists.");
    chemicals.push(obj);
  }
  localStorage.setItem("chemicals", JSON.stringify(chemicals));
  document.querySelector(".popup")?.remove();
  renderInventory();
}

function removeChem(name) {
  if (!confirm("Delete chemical " + name + "?")) return;
  chemicals = chemicals.filter(x => x.name !== name);
  localStorage.setItem("chemicals", JSON.stringify(chemicals));
  renderInventory();
}

/* ---------- BATCH CREATION (ONE-PAGE MODAL) ---------- */
function openCreateBatch() {
  const pop = document.createElement("div");
  pop.className = "popup";
  pop.style.maxWidth = "480px";
  pop.innerHTML = `
    <button class="close" onclick="this.parentNode.remove()">✕</button>
    <h3>Create Batch</h3>
    <label>Auto Name</label>
    <input id="b_name" placeholder="Auto when saved…">

    <label>Date & Time</label>
    <input id="b_datetime" type="datetime-local" value="${new Date().toISOString().slice(0,16)}">

    <label>Total Mix (L)</label>
    <input id="b_total" type="number" value="600" min="0">

    <div id="chemRows"></div>
    <button id="addChemRow">➕ Add Chemical</button>

    <div id="b_summary" style="margin-top:8px; font-weight:700;"></div>

    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;">
      <button id="b_delete">Delete</button>
      <button id="b_dump">Dump</button>
      <button id="b_save">Create Batch</button>
    </div>
  `;
  document.body.appendChild(pop);

  const rows = pop.querySelector("#chemRows");
  const addRowBtn = pop.querySelector("#addChemRow");
  const totalEl = pop.querySelector("#b_total");
  const summary = pop.querySelector("#b_summary");

  function makeRow() {
    const wrap = document.createElement("div");
    wrap.style.border = "1px solid #444";
    wrap.style.borderRadius = "8px";
    wrap.style.padding = "8px";
    wrap.style.marginTop = "8px";
    const options = chemicals.map(c=>`<option>${c.name}</option>`).join("");
    wrap.innerHTML = `
      <label>Chemical</label>
      <select class="bc_name">${options}</select>

      <label>Rate per 100L</label>
      <input class="bc_rate" type="number" step="0.01" placeholder="e.g. 1.5">

      <label>Unit</label>
      <select class="bc_unit">
        <option>L</option>
        <option>mL</option>
        <option>g</option>
        <option>kg</option>
      </select>

      <div style="margin-top:6px;display:flex;justify-content:flex-end;">
        <button class="bc_remove">Remove</button>
      </div>
    `;
    rows.appendChild(wrap);
    wrap.querySelector(".bc_remove").onclick = () => { wrap.remove(); updateSummary(); };
    ["change","input"].forEach(ev=>{
      wrap.querySelector(".bc_rate").addEventListener(ev, updateSummary);
      wrap.querySelector(".bc_unit").addEventListener(ev, updateSummary);
      wrap.querySelector(".bc_name").addEventListener(ev, updateSummary);
    });
  }

  function updateSummary() {
    const total = Number(totalEl.value)||0;
    const rowEls = [...rows.querySelectorAll(":scope > div")];
    if (!rowEls.length) { summary.textContent = ""; return; }
    let lines = [];
    rowEls.forEach(r=>{
      const name = r.querySelector(".bc_name").value;
      const rate = Number(r.querySelector(".bc_rate").value)||0;
      const unit = r.querySelector(".bc_unit").value;
      const qty  = rate * (total/100);
      lines.push(`${name}: ${rate}/100L → ${qty.toFixed(2)} ${unit}`);
    });
    summary.textContent = `Totals for ${total}L:\n` + lines.join(" | ");
  }

  addRowBtn.onclick = () => { makeRow(); updateSummary(); };
  totalEl.oninput = updateSummary;
  makeRow();

  // Actions
  pop.querySelector("#b_save").onclick = () => saveBatchFromModal(pop);
  pop.querySelector("#b_dump").onclick = () => dumpFromModal(pop);
  pop.querySelector("#b_delete").onclick = () => pop.remove();
}

function saveBatchFromModal(pop) {
  const nameInput = pop.querySelector("#b_name");
  const when = pop.querySelector("#b_datetime").value;
  const total = Number(pop.querySelector("#b_total").value)||0;
  const rowEls = [...pop.querySelectorAll("#chemRows > div")];

  if (!rowEls.length) return alert("Add at least one chemical.");
  if (total <= 0) return alert("Total mix must be greater than 0.");

  // Check against inventory (must have enough to allow batch)
  for (const r of rowEls) {
    const nm = r.querySelector(".bc_name").value;
    const rate = Number(r.querySelector(".bc_rate").value)||0;
    const unit = r.querySelector(".bc_unit").value;
    const qty  = rate * (total/100); // required
    const chem = chemicals.find(x=>x.name===nm);
    if (!chem) return alert(`Chemical ${nm} not in inventory.`);
    // convert all to "base" for simple compare by unit match only
    if (chem.containerUnit !== unit) {
      // allow L <-> mL and g <-> kg conversions
      let factor = 1;
      if (chem.containerUnit==="L" && unit==="mL") factor = 1/1000;
      else if (chem.containerUnit==="mL" && unit==="L") factor = 1000;
      else if (chem.containerUnit==="kg" && unit==="g") factor = 1/1000;
      else if (chem.containerUnit==="g" && unit==="kg") factor = 1000;
      else return alert(`${nm} unit mismatch (${chem.containerUnit} vs ${unit})`);
      // adjust required qty into chemical's unit
      const qtyAdj = qty * factor;
      const available = (chem.containerSize||0) * (chem.containers||0);
      if (available < qtyAdj) return alert(`${nm} has insufficient stock.`);
    } else {
      const available = (chem.containerSize||0) * (chem.containers||0);
      if (available < qty) return alert(`${nm} has insufficient stock.`);
    }
  }

  // Create batch object
  const id = Date.now();
  const auto = `B${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${id.toString().slice(-4)}`;
  const chems = rowEls.map(r=>({
    name: r.querySelector(".bc_name").value,
    rate: Number(r.querySelector(".bc_rate").value)||0,
    unit: r.querySelector(".bc_unit").value
  }));

  const b = {
    id,
    name: nameInput.value.trim() || auto,
    date: new Date(when||new Date()).toISOString().slice(0,16).replace("T"," "),
    total,
    remaining: total,
    chems,
    used: 0
  };
  batches.push(b);
  localStorage.setItem("batches", JSON.stringify(batches));
  pop.remove();

  // Flash batch summary for 2–3 seconds
  showSpinner(`Batch Saved ✅\n${b.name} • ${b.total}L`);

  renderBatches();
  refreshBatchSelect();
}

function dumpFromModal(pop) {
  const reason = prompt("Reason for dumping?");
  if (!reason) return;
  const total = Number(pop.querySelector("#b_total").value)||0;
  showSpinner(`Dump recorded: ${total}L\nReason: ${reason}`);
  pop.remove();
}

function refreshBatchSelect() {
  const sel = document.getElementById("batchSelect");
  if (!sel) return;
  sel.innerHTML = `<option value="">Select Batch…</option>`;
  batches
    .slice()
    .sort((a,b)=> (b.date||"").localeCompare(a.date||""))
    .forEach(b=>{
      const o = document.createElement("option");
      o.value = b.id;
      o.textContent = `${b.name} • ${b.total}L • Rem ${b.remaining}L`;
      sel.appendChild(o);
    });
}

/* ---------- ENHANCED SEARCH ---------- */
function searchRecords() {
  const q = (document.getElementById("recordSearch").value||"").trim().toLowerCase();
  const container = document.getElementById("recordList");
  container.innerHTML = "";
  const rows = tasks.filter(t=>{
    const hay = `${t.jobName} ${t.loc} ${t.weed} ${t.jobType} ${t.councilJob}`.toLowerCase();
    return hay.includes(q);
  });
  if (!rows.length) {
    container.innerHTML = "<p>No records match.</p>";
    return;
  }
  rows.forEach(t=>{
    const card = document.createElement("div");
    card.className = "record-card";
    card.innerHTML = `
      <b>${t.jobName}</b><br>
      Road: ${t.loc || "–"}<br>
      Weed: ${t.weed || "–"} | Type: ${t.jobType}<br>
      <button onclick="openRecord(${t.id})">Open</button>
      <button onclick="editRecord(${t.id})">Edit</button>
      <button onclick="deleteRecord(${t.id})">Delete</button>
    `;
    container.appendChild(card);
  });
}

/* ---------- EDIT RECORD FLOWS ---------- */
function editRecord(id) {
  const t = tasks.find(x=>x.id===id);
  if (!t) return;
  openPage("createTask");
  // Fill the form for editing
  document.getElementById("jobType").value = t.jobType;
  document.getElementById("autoJobName").value = t.jobName;
  document.getElementById("councilJobNumber").value = t.councilJob || "";
  document.getElementById("location").value = t.loc || "";
  document.getElementById("weedSelect").value = t.weed || "Noxious Weeds";
  refreshBatchSelect();
  document.getElementById("batchSelect").value = t.batch || "";
  document.getElementById("notes").value = t.notes || "";
  document.getElementById("temperature").value = t.temp || "";
  document.getElementById("humidity").value = t.humidity || "";
  document.getElementById("windSpeed").value = t.windSpeed || "";
  document.getElementById("windDirection").value = t.windDirection || "";
  document.getElementById("jobDateTime").value = t.date || "";
  // Mark we are editing by storing id on form element
  document.getElementById("createTask").dataset.editingId = String(id);
}

/* ---------- SAVE OVERRIDE TO SUPPORT EDIT ---------- */
const _origSaveTask = saveTask;
saveTask = function() {
  const editingId = document.getElementById("createTask").dataset.editingId;
  if (editingId) {
    const id = Number(editingId);
    const idx = tasks.findIndex(t=>t.id===id);
    if (idx >= 0) {
      tasks[idx] = {
        ...tasks[idx],
        jobType: document.getElementById("jobType").value,
        jobName: document.getElementById("autoJobName").value,
        councilJob: document.getElementById("councilJobNumber").value,
        loc: document.getElementById("location").value,
        weed: document.getElementById("weedSelect").value,
        batch: document.getElementById("batchSelect").value,
        notes: document.getElementById("notes").value,
        temp: document.getElementById("temperature").value,
        humidity: document.getElementById("humidity").value,
        windSpeed: document.getElementById("windSpeed").value,
        windDirection: document.getElementById("windDirection").value,
        date: document.getElementById("jobDateTime").value
      };
      localStorage.setItem("tasks", JSON.stringify(tasks));
      document.getElementById("createTask").dataset.editingId = "";
      showSpinner("Task Updated ✅");
      renderRecords();
      return;
    }
  }
  // new save
  _origSaveTask();
};

/* ---------- MAP RENDERING WITH PINS ---------- */
function filterMap() {
  if (!map) initMap();
  // Clear existing non-tile layers
  map.eachLayer(l => { if (!(l instanceof L.TileLayer)) map.removeLayer(l); });

  const q = (document.getElementById("recordSearch")?.value||"").toLowerCase();
  tasks.forEach(t=>{
    if (!t.loc) return;
    const hay = `${t.jobName} ${t.loc} ${t.weed} ${t.jobType}`.toLowerCase();
    if (q && !hay.includes(q)) return;
    const parts = t.loc.split(",").map(s=>s.trim());
    if (parts.length !== 2) return;
    const lat = Number(parts[0]), lon = Number(parts[1]);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return;

    const m = L.marker([lat,lon]).addTo(map);
    const pid = `p_${t.id}`;
    const nid = `n_${t.id}`;
    m.bindPopup(`
      <b>${t.jobName}</b><br>
      ${t.jobType} • ${t.weed || "—"}
      <div style="margin-top:6px;">
        <button id="${pid}">Open</button>
        <button id="${nid}">Navigate</button>
      </div>
    `);
    m.on("popupopen", ()=>{
      setTimeout(()=>{
        const pb = document.getElementById(pid);
        const nb = document.getElementById(nid);
        if (pb) pb.onclick = ()=> openRecord(t.id);
        if (nb) nb.onclick = ()=> navigateToJob(t.loc);
      }, 0);
    });
  });
}

/* ---------- SETTINGS / EXPORT ---------- */
function exportData() {
  const db = { tasks, chemicals, batches };
  const blob = new Blob([JSON.stringify(db,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "weedtracker_data.json";
  a.click();
}

function clearData() {
  if (!confirm("Clear all local data?")) return;
  localStorage.removeItem("tasks");
  localStorage.removeItem("chemicals");
  localStorage.removeItem("batches");
  tasks = []; chemicals = []; batches = [];
  renderInventory(); renderRecords(); renderBatches(); refreshBatchSelect();
}

/* ---------- INIT ON LOAD ---------- */
document.addEventListener("DOMContentLoaded", () => {
  // Home buttons handled by inline openPage(); we just set up page renders
  renderRecords();
  renderInventory();
  renderBatches();
  refreshBatchSelect();

  // Add a create-batch button at top of Batches page
  const batchesPage = document.getElementById("batches");
  if (batchesPage && !document.getElementById("createBatchBtn")) {
    const btn = document.createElement("button");
    btn.id = "createBatchBtn";
    btn.textContent = "➕ Create Batch";
    btn.style.marginBottom = "10px";
    btn.onclick = openCreateBatch;
    batchesPage.insertBefore(btn, document.getElementById("batchList"));
  }

  // Initialize map when mapping page first opened
  const origOpenPage = openPage;
  openPage = function(pid){
    origOpenPage(pid);
    if (pid === "mapping") {
      setTimeout(()=> { initMap(); locateUser(); filterMap(); }, 200);
    }
  };
});
