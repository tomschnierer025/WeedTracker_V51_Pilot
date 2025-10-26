/* =========================================================
   WeedTracker V60 Pilot - batches.js
   Batch creation, linking, totals & pop-up view handling
   ========================================================= */

function openBatchCreator() {
  const sheet = document.getElementById("batchSheet");
  if (sheet) {
    sheet.style.display = "flex";
    renderChemicalRows([]);
  }
}

/* ---------- Add chemical rows dynamically ---------- */
function renderChemicalRows(rows) {
  const container = document.getElementById("chemRows");
  if (!container) return;
  container.innerHTML = "";

  rows.forEach((row, i) => {
    container.appendChild(createChemicalRow(i, row));
  });

  const addBtn = document.createElement("button");
  addBtn.textContent = "➕ Add Chemical";
  addBtn.className = "pill emph";
  addBtn.onclick = () => {
    rows.push({ name: "", rate: "", unit: "" });
    renderChemicalRows(rows);
  };
  container.appendChild(addBtn);
}

function createChemicalRow(i, data) {
  const row = document.createElement("div");
  row.className = "row gap";
  row.innerHTML = `
    <div class="col"><label>Chemical</label>
      <select id="chem_name_${i}">
        ${loadChemicals()
          .map(
            (c) =>
              `<option value="${c.name}" ${
                c.name === data.name ? "selected" : ""
              }>${c.name}</option>`
          )
          .join("")}
      </select>
    </div>
    <div class="col"><label>Amount /100L</label>
      <input id="chem_rate_${i}" type="number" step="0.01" value="${
    data.rate || ""
  }">
    </div>
    <div class="col"><label>Unit</label>
      <select id="chem_unit_${i}">
        ${["L", "mL", "g", "kg"]
          .map(
            (u) =>
              `<option value="${u}" ${
                u === data.unit ? "selected" : ""
              }>${u}</option>`
          )
          .join("")}
      </select>
    </div>
    <div class="col end">
      <button class="pill warn" onclick="removeChemical(${i})">🗑️</button>
    </div>`;
  return row;
}

/* ---------- Remove chemical ---------- */
function removeChemical(i) {
  const rows = getChemicalInputs();
  rows.splice(i, 1);
  renderChemicalRows(rows);
}

/* ---------- Collect data ---------- */
function getChemicalInputs() {
  const rows = [];
  const container = document.getElementById("chemRows");
  if (!container) return rows;
  const selects = container.querySelectorAll("select[id^='chem_name_']");
  selects.forEach((sel, i) => {
    const rate = document.getElementById(`chem_rate_${i}`)?.value || "";
    const unit = document.getElementById(`chem_unit_${i}`)?.value || "";
    rows.push({ name: sel.value, rate, unit });
  });
  return rows;
}

/* ---------- Create batch ---------- */
function createBatch() {
  WTStorage.showSpinner(true, "Creating batch…");

  const batchName = document.getElementById("batchName").value.trim();
  const date = WTStorage.todayDate();
  const time = WTStorage.nowTime();
  const totalMix = Number(document.getElementById("totalMix").value) || 0;
  const chemicals = getChemicalInputs();
  const batches = WTStorage.loadData("batches", []);

  // Validate
  if (!batchName || totalMix <= 0 || chemicals.length === 0) {
    WTStorage.showSpinner(false);
    WTStorage.showToast("⚠️ Please fill all fields");
    return;
  }

  // Build totals and remaining
  const batch = {
    id: WTStorage.generateId("BATCH"),
    batchName,
    date,
    time,
    totalMix,
    remaining: totalMix,
    chemicals,
    linkedJobs: [],
  };

  batches.push(batch);
  WTStorage.saveData("batches", batches);

  WTStorage.showSpinner(false);
  WTStorage.showToast("✅ Batch Created");
  closeSheet("batchSheet");
  renderBatchList();
}

/* ---------- Render Batches ---------- */
function renderBatchList() {
  const list = document.getElementById("batchList");
  if (!list) return;
  list.innerHTML = "";
  const batches = WTStorage.loadData("batches", []);
  if (batches.length === 0) {
    list.innerHTML = `<p class='muted'>No batches recorded</p>`;
    return;
  }

  batches.forEach((b) => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <b>${b.batchName}</b><br>
      <span>${b.date} ${b.time}</span><br>
      <span>Total: ${b.totalMix}L • Remaining: ${b.remaining}L</span><br>
      <div class="row end gap">
        <button class="pill" onclick="openBatch('${b.id}')">Open</button>
        <button class="pill warn" onclick="deleteBatch('${b.id}')">Delete</button>
      </div>`;
    list.appendChild(div);
  });
}

/* ---------- Open Batch Popup ---------- */
function openBatch(id) {
  const batches = WTStorage.loadData("batches", []);
  const b = batches.find((x) => x.id === id);
  if (!b) return;

  const popup = document.createElement("div");
  popup.className = "sheet";
  popup.innerHTML = `
    <div class="sheet-content">
      <button class="pill warn end" onclick="this.closest('.sheet').remove()">✖ Close</button>
      <h3>${b.batchName}</h3>
      <p><b>Date:</b> ${b.date} ${b.time}</p>
      <p><b>Total:</b> ${b.totalMix}L</p>
      <p><b>Remaining:</b> ${b.remaining}L</p>
      <h4>Chemicals</h4>
      ${b.chemicals
        .map(
          (c) =>
            `<div>${c.name} — ${c.rate}${c.unit}/100L</div>`
        )
        .join("")}
      <h4>Linked Jobs</h4>
      ${
        b.linkedJobs.length
          ? b.linkedJobs.map((j) => `<div>${j}</div>`).join("")
          : "<p class='muted'>None</p>"
      }
      <div class="row gap end">
        <button class="pill warn" onclick="dumpBatch('${id}')">Dump</button>
      </div>
    </div>`;
  document.body.appendChild(popup);
}

/* ---------- Dump Batch ---------- */
function dumpBatch(id) {
  const batches = WTStorage.loadData("batches", []);
  const b = batches.find((x) => x.id === id);
  if (!b) return;
  const reason = prompt("Reason for dumping batch?");
  if (!reason) return;
  b.remaining = 0;
  b.dumpedReason = reason;
  WTStorage.saveData("batches", batches);
  WTStorage.showToast("🚮 Batch dumped");
  document.querySelector(".sheet")?.remove();
  renderBatchList();
}

/* ---------- Delete Batch ---------- */
function deleteBatch(id) {
  if (!confirm("Delete this batch?")) return;
  let batches = WTStorage.loadData("batches", []);
  batches = batches.filter((b) => b.id !== id);
  WTStorage.saveData("batches", batches);
  WTStorage.showToast("🗑️ Batch deleted");
  renderBatchList();
}

/* ---------- Load chemicals for dropdown ---------- */
function loadChemicals() {
  return WTStorage.loadData("chemicals", []);
}

/* ---------- Init ---------- */
window.addEventListener("DOMContentLoaded", renderBatchList);

/* ---------- Export ---------- */
window.WTBatches = {
  openBatchCreator,
  createBatch,
  renderBatchList,
  openBatch,
  dumpBatch,
  deleteBatch,
};
