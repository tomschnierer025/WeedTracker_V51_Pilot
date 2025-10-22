// ---------- WeedTracker V63 - batches.js ---------- //
// Handles batch creation, totals, and chemical usage deduction

document.addEventListener("DOMContentLoaded", () => {
  loadBatchList();
});

// ---------- LOAD BATCHES ----------
function loadBatchList() {
  const container = document.getElementById("batchList");
  if (!container) return;
  const batches = getBatches();
  container.innerHTML = "";

  if (!batches.length) {
    container.innerHTML = "<p style='text-align:center;color:#bbb;'>No batches created yet.</p>";
    return;
  }

  batches.forEach(batch => {
    const div = document.createElement("div");
    div.classList.add("record-card");
    div.innerHTML = `
      <strong>${batch.name}</strong><br>
      Date: ${batch.date}<br>
      Total Mix: ${batch.totalMix} L<br>
      Remaining: ${batch.remainingMix ?? batch.totalMix} L
      ${batch.dumped ? `<br><span style="color:#e74c3c;">Dumped: ${batch.dumpReason || "N/A"}</span>` : ""}
      <div class="button-row">
        <button onclick="openBatch('${batch.id}')">Open</button>
        <button onclick="deleteBatch('${batch.id}')">Delete</button>
      </div>
    `;
    container.appendChild(div);
  });
}

// ---------- OPEN BATCH ----------
function openBatch(id) {
  const batch = getBatches().find(b => b.id === id);
  if (!batch) return flashMessage("Batch not found", "#e74c3c");

  const chemicalDetails = batch.chemicals.map(c =>
    `<li>${c.name}: ${c.amount}${c.unit}</li>`
  ).join("");

  const linkedJobs = batch.linkedJobs?.length
    ? batch.linkedJobs.map(j => `<li><a href="#" onclick="openJob('${j}')">${j}</a></li>`).join("")
    : "<em>No linked jobs</em>";

  showPopup(
    `Batch ${batch.id}`,
    `
      <strong>Date:</strong> ${batch.date}<br>
      <strong>Total Mix:</strong> ${batch.totalMix} L<br>
      <strong>Remaining Mix:</strong> ${batch.remainingMix ?? 0} L<br>
      <hr>
      <strong>Chemicals:</strong><ul>${chemicalDetails}</ul>
      <strong>Linked Jobs:</strong><ul>${linkedJobs}</ul>
      <div class="button-row">
        <button onclick="promptDumpBatch('${batch.id}')">Dump</button>
      </div>
    `
  );
}

// ---------- PROMPT DUMP ----------
function promptDumpBatch(id) {
  const reason = prompt("Enter reason for dumping:");
  if (!reason) return;
  markBatchDumped(id, reason);
  flashMessage("Batch dumped successfully", "#e67e22");
  loadBatchList();
}

// ---------- CREATE BATCH ----------
function openCreateBatchForm() {
  const chemOptions = getChemicals().map(c => `<option value="${c.name}">${c.name}</option>`).join("");
  showPopup("Create New Batch", `
    <label>Auto Name:</label>
    <input id="batchName" placeholder="Auto-generated" readonly value="Batch-${Date.now()}">
    <label>Date:</label>
    <input type="datetime-local" id="batchDate" value="${formatDateTime()}">
    <label>Total Mix (L):</label>
    <input type="number" id="totalMix" min="0" step="0.1">

    <div id="chemList"></div>
    <button onclick="addChemicalRow()">➕ Add Chemical</button>

    <label>Link Job Number (optional):</label>
    <input id="linkJob" placeholder="Enter job ID if applicable">

    <div class="button-row">
      <button onclick="createBatch()">Create Batch</button>
      <button onclick="cancelBatch()">Delete / Cancel</button>
    </div>
  `);
  addChemicalRow();
}

// ---------- ADD / REMOVE CHEMICALS ----------
function addChemicalRow() {
  const chemList = document.getElementById("chemList");
  const row = document.createElement("div");
  row.classList.add("record-card");
  const chemOptions = getChemicals().map(c => `<option value="${c.name}">${c.name}</option>`).join("");

  row.innerHTML = `
    <label>Chemical:</label>
    <select class="chemName">${chemOptions}</select>

    <label>Amount per 100L:</label>
    <input type="number" class="chemRate" placeholder="e.g., 2">

    <label>Unit:</label>
    <select class="chemUnit">
      <option value="L">L</option>
      <option value="mL">mL</option>
      <option value="g">g</option>
      <option value="kg">kg</option>
    </select>
    <button onclick="this.parentElement.remove()">❌ Remove</button>
  `;
  chemList.appendChild(row);
}

// ---------- CREATE BATCH FINAL ----------
function createBatch() {
  const name = document.getElementById("batchName").value.trim();
  const date = document.getElementById("batchDate").value;
  const totalMix = parseFloat(document.getElementById("totalMix").value);
  const jobLink = document.getElementById("linkJob").value.trim();

  if (!totalMix || totalMix <= 0) return flashMessage("Enter valid total mix", "#e74c3c");

  const chemRows = document.querySelectorAll("#chemList .record-card");
  const chemicals = [];
  let totalChemCheck = true;

  chemRows.forEach(row => {
    const name = row.querySelector(".chemName").value;
    const rate = parseFloat(row.querySelector(".chemRate").value);
    const unit = row.querySelector(".chemUnit").value;

    if (!name || !rate) return;
    const totalAmount = (rate / 100) * totalMix;

    // Check inventory
    const chem = getChemicals().find(c => c.name === name);
    if (!chem || chem.quantity < totalAmount) {
      totalChemCheck = false;
      flashMessage(`Not enough ${name} in inventory`, "#e74c3c");
    }

    chemicals.push({ name, rate, amount: totalAmount, unit });
  });

  if (!totalChemCheck || !chemicals.length) return;

  const batch = {
    id: generateID("B"),
    name,
    date,
    totalMix,
    remainingMix: totalMix,
    chemicals,
    linkedJobs: jobLink ? [jobLink] : [],
    dumped: false
  };

  // Deduct usage
  chemicals.forEach(c => deductChemicalUsage(c.name, c.amount, c.unit));

  saveBatch(batch);
  showBatchSummary(batch);
  showSpinner("Batch Saved");
  loadBatchList();
  document.getElementById("popup").remove();
}

// ---------- CANCEL ----------
function cancelBatch() {
  if (confirm("Cancel batch creation?")) document.getElementById("popup").remove();
}
