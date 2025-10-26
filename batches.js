// WeedTracker V60 Pilot — batches.js
// Handles batch creation, chemical selection, totals, and inventory validation.

const batchForm = document.getElementById("batchForm");
const batchChemList = document.getElementById("batchChemList");
const addChemBtn = document.getElementById("addChemicalBtn");
const totalMixInput = document.getElementById("totalMix");
const batchNameField = document.getElementById("batchName");
const batchSummary = document.getElementById("batchSummary");
const createBatchBtn = document.getElementById("createBatch");
const deleteBatchBtn = document.getElementById("deleteBatch");

let batchChemicals = [];

addChemBtn.addEventListener("click", addChemicalRow);

function addChemicalRow() {
  const row = document.createElement("div");
  row.className = "field-row chem-row";
  row.innerHTML = `
    <select class="chem-name">
      ${getChemListOptions()}
    </select>
    <input type="number" class="chem-rate" placeholder="Rate /100L" step="0.01">
    <select class="chem-unit">
      <option value="L">L</option>
      <option value="mL">mL</option>
      <option value="g">g</option>
      <option value="kg">kg</option>
    </select>
    <button class="btn warn remove-chem">Remove</button>
  `;
  batchChemList.appendChild(row);
  batchChemList.scrollTop = batchChemList.scrollHeight;
  row.querySelector(".remove-chem").addEventListener("click", () => {
    row.remove();
    updateTotals();
  });
  row.querySelectorAll("input, select").forEach(el =>
    el.addEventListener("input", updateTotals)
  );
}

function getChemListOptions() {
  const inventory = JSON.parse(localStorage.getItem("chemicals") || "[]");
  return inventory.map(c => `<option value="${c.name}">${c.name}</option>`).join("");
}

totalMixInput.addEventListener("input", updateTotals);
batchChemList.addEventListener("input", updateTotals);

function updateTotals() {
  const totalMix = parseFloat(totalMixInput.value || "0");
  const chemRows = [...document.querySelectorAll(".chem-row")];
  let summaryHtml = "";

  chemRows.forEach(row => {
    const name = row.querySelector(".chem-name").value;
    const rate = parseFloat(row.querySelector(".chem-rate").value || "0");
    const unit = row.querySelector(".chem-unit").value;
    const total = ((rate / 100) * totalMix).toFixed(2);
    summaryHtml += `<p>${name}: ${rate}${unit}/100L → Total ${total}${unit}</p>`;
  });

  batchSummary.innerHTML = summaryHtml || "<p class='muted'>No chemicals added yet.</p>";
}

createBatchBtn.addEventListener("click", () => {
  const name = batchNameField.value.trim();
  const totalMix = parseFloat(totalMixInput.value || "0");
  if (!name || totalMix <= 0) {
    alert("Enter batch name and total mix amount first");
    return;
  }

  const inventory = JSON.parse(localStorage.getItem("chemicals") || "[]");
  const chemRows = [...document.querySelectorAll(".chem-row")];
  const chemicals = [];
  let hasError = false;

  chemRows.forEach(row => {
    const cname = row.querySelector(".chem-name").value;
    const rate = parseFloat(row.querySelector(".chem-rate").value || "0");
    const unit = row.querySelector(".chem-unit").value;
    const total = (rate / 100) * totalMix;

    const inv = inventory.find(c => c.name === cname);
    if (!inv) {
      alert(`Chemical "${cname}" not found in inventory.`);
      hasError = true;
      return;
    }
    if (inv.amount < total) {
      alert(`Not enough ${cname} in inventory (need ${total}${unit}, have ${inv.amount}${inv.unit}).`);
      hasError = true;
      return;
    }

    inv.amount -= total;
    chemicals.push({ name: cname, rate, unit, total: total.toFixed(2) });
  });

  if (hasError) return;

  localStorage.setItem("chemicals", JSON.stringify(inventory));

  const batch = {
    name,
    totalMix,
    chemicals,
    created: new Date().toLocaleString(),
    remaining: totalMix,
  };

  const batches = JSON.parse(localStorage.getItem("batches") || "[]");
  batches.push(batch);
  localStorage.setItem("batches", JSON.stringify(batches));

  batchSummary.innerHTML = `<strong>Batch Created:</strong> ${name}<br>${new Date().toLocaleString()}`;
  showToast("✅ Batch created successfully");
});

deleteBatchBtn.addEventListener("click", () => {
  if (confirm("Cancel batch creation?")) {
    batchNameField.value = "";
    totalMixInput.value = "";
    batchChemList.innerHTML = "";
    batchSummary.innerHTML = "<p class='muted'>No chemicals added yet.</p>";
  }
});
