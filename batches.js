// ===============================
// WeedTracker V60 Pilot Final
// BATCHES.JS
// ===============================

function openBatchesScreen() {
  switchScreen("batchesScreen");
  renderBatches();
}

function renderBatches() {
  const container = $("batchList");
  const batches = getBatches();
  container.innerHTML = "";
  if (!batches.length) {
    container.innerHTML = `<p style="text-align:center;opacity:0.6;">No batches created yet 🧪</p>`;
    return;
  }

  batches.forEach(b => {
    const div = document.createElement("div");
    div.className = "list-item";
    const remaining = b.totalMix - (b.usedMix || 0) - (b.dumpedMix || 0);
    let status = "🟢";
    if (remaining <= 0) status = "🔴";
    else if (remaining < b.totalMix / 2) status = "🟡";
    div.innerHTML = `
      <div>
        <strong>${b.name}</strong><br>
        <small>${b.date} • ${b.time}</small><br>
        <small>Total: ${b.totalMix} L | Remaining: ${remaining} L</small>
      </div>
      <div class="row gap">
        <button class="pill" onclick="openBatchDetails('${b.id}')">Open</button>
        <button class="pill warn" onclick="deleteBatch('${b.id}')">Delete</button>
      </div>`;
    container.appendChild(div);
  });
}

function newBatchPopup() {
  const popup = document.createElement("div");
  popup.className = "card soft";
  popup.id = "batchPopup";
  popup.style.position = "fixed";
  popup.style.top = "5%";
  popup.style.left = "50%";
  popup.style.transform = "translateX(-50%)";
  popup.style.width = "90%";
  popup.style.maxHeight = "85vh";
  popup.style.overflowY = "auto";
  popup.style.zIndex = "200";
  popup.innerHTML = `
    <h3>Create New Batch 🧪</h3>
    <label>Date: <input type="date" id="batchDate"></label>
    <label>Time: <input type="time" id="batchTime"></label>
    <label>Total Mix (L): <input type="number" id="batchTotal" placeholder="e.g. 800"></label>
    <div id="batchChemList"></div>
    <button class="btn secondary" onclick="addChemicalRow()">+ Add Chemical</button>
    <div class="row end gap" style="margin-top:1rem;">
      <button class="btn danger" onclick="cancelBatch()">Delete</button>
      <button class="btn primary" onclick="saveBatch()">Create Batch</button>
    </div>
  `;
  popup.prepend(addPopupClose("batchPopup"));
  document.body.appendChild(popup);
  addChemicalRow(); // first row
}

function addChemicalRow() {
  const div = document.createElement("div");
  div.className = "card soft";
  div.style.marginTop = "0.5rem";
  const chems = getChemicals();
  const opts = chems.map(c => `<option value="${c.name}">${c.name}</option>`).join("");
  div.innerHTML = `
    <label>Chemical:
      <select class="chemName">${opts}</select>
    </label>
    <div class="row gap">
      <label class="grow">Per 100 L:
        <input type="number" class="chemRate" placeholder="e.g. 2">
      </label>
      <label class="grow">Unit:
        <select class="chemUnit">
          <option value="L">L</option>
          <option value="mL">mL</option>
          <option value="g">g</option>
          <option value="kg">kg</option>
        </select>
      </label>
    </div>
  `;
  $("batchChemList").appendChild(div);
}

function cancelBatch() {
  $("batchPopup").remove();
  toast("Batch cancelled ❌");
}

function saveBatch() {
  const totalMix = parseFloat($("batchTotal").value) || 0;
  const date = $("batchDate").value || new Date().toISOString().split("T")[0];
  const time = $("batchTime").value || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (!totalMix) { toast("Enter total mix ❗"); return; }

  const chemicals = [];
  let valid = true;
  document.querySelectorAll("#batchChemList .card").forEach(c => {
    const name = c.querySelector(".chemName").value;
    const rate = parseFloat(c.querySelector(".chemRate").value) || 0;
    const unit = c.querySelector(".chemUnit").value;
    const totalUsed = (totalMix / 100) * rate;
    if (!checkInventory(name, totalUsed)) valid = false;
    chemicals.push({ name, rate, unit, totalUsed });
  });
  if (!valid) return;

  const id = `B${Date.now()}`;
  const name = `Batch_${date}_${time.replace(/:/g, "")}`;
  const batch = { id, name, date, time, totalMix, chemicals, usedMix: 0, dumpedMix: 0 };

  const batches = getBatches();
  batches.push(batch);
  setBatches(batches);

  spinnerDone("Batch created ✅");
  $("batchPopup").remove();
  renderBatches();
}

function openBatchDetails(id) {
  const batch = getBatches().find(b => b.id === id);
  if (!batch) return toast("Batch not found");
  const popup = document.createElement("div");
  popup.className = "card soft";
  popup.id = "batchDetailPopup";
  popup.style.position = "fixed";
  popup.style.top = "5%";
  popup.style.left = "50%";
  popup.style.transform = "translateX(-50%)";
  popup.style.width = "90%";
  popup.style.maxHeight = "85vh";
  popup.style.overflowY = "auto";
  popup.style.zIndex = "200";

  const chemList = batch.chemicals.map(c => `
    <li>${c.name} – ${c.rate}${c.unit}/100 L → ${c.totalUsed}${c.unit} total</li>`).join("");

  popup.innerHTML = `
    <h3>${batch.name}</h3>
    <p><strong>Date:</strong> ${batch.date} ${batch.time}</p>
    <p><strong>Total Mix:</strong> ${batch.totalMix} L</p>
    <ul>${chemList}</ul>
    <p><strong>Used:</strong> ${batch.usedMix} L • <strong>Dumped:</strong> ${batch.dumpedMix} L</p>
    <div class="row gap end" style="margin-top:1rem;">
      <button class="btn secondary" onclick="dumpBatch('${batch.id}')">Dump</button>
      <button class="btn danger" onclick="deleteBatch('${batch.id}')">Delete</button>
    </div>
  `;
  popup.prepend(addPopupClose("batchDetailPopup"));
  document.body.appendChild(popup);
}

function dumpBatch(id) {
  const batch = getBatches().find(b => b.id === id);
  if (!batch) return;
  const dumpAmount = prompt("Enter amount to dump (L):", "0");
  const reason = prompt("Reason for dumping:", "Not required");
  if (!dumpAmount) return;
  batch.dumpedMix = (batch.dumpedMix || 0) + parseFloat(dumpAmount);
  setBatches(getBatches().map(b => (b.id === id ? batch : b)));
  toast(`Dumped ${dumpAmount} L (${reason})`);
  renderBatches();
}

function deleteBatch(id) {
  if (!confirm("Delete this batch permanently?")) return;
  const list = getBatches().filter(b => b.id !== id);
  setBatches(list);
  renderBatches();
  toast("Batch deleted 🗑️");
}
