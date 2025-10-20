/* === WeedTracker V61 Final Pilot — batches.js ===
   Handles: Batch creation, editing, linking with Jobs,
   SDS link, time/date stamps, and auto-update of totals.
*/

// SDS Safety Data Sheet pinned link
const SDS_LINK = "https://sds.chemgov.com.au/"; // ✅ main SDS search site

// --- Auto-inject SDS link in Chemical Inventory ---
document.addEventListener("DOMContentLoaded", () => {
  const chemList = document.getElementById("chemList");
  if (chemList && !document.getElementById("sdsLinkPinned")) {
    const sdsDiv = document.createElement("div");
    sdsDiv.id = "sdsLinkPinned";
    sdsDiv.innerHTML = `
      <div style="margin-bottom:.8rem;padding:.6rem;border:1px solid #ccc;border-radius:8px;background:#eef9ee;">
        <strong>📄 Safety Data Sheets (SDS):</strong>
        <a href="${SDS_LINK}" target="_blank" style="color:#036;font-weight:bold;text-decoration:underline;">Open SDS Library ↗</a>
      </div>
    `;
    chemList.parentNode.insertBefore(sdsDiv, chemList);
  }
});

// --- Create a new Batch ---
function createBatch() {
  const id = "B" + Date.now();
  const date = new Date();
  const mix = Number(prompt("Total Mix Volume (L):", "600")) || 0;
  const chems = prompt("Chemicals Used (e.g. 'Crucial 1.5 L/100 L, SuperWet 300 mL/100 L')", "") || "";
  const now = date.toLocaleTimeString();

  const batch = {
    id,
    date: date.toISOString().split("T")[0],
    time: now,
    mix,
    remaining: mix,
    used: 0,
    chemicals: chems,
    jobs: [],
    createdAt: nowStamp()
  };

  saveBatch(batch);
  renderBatchesList();
  showToast("Batch Created ✅");
}

// --- Render all batches ---
function renderBatchesList() {
  const list = document.getElementById("batchList");
  if (!list) return;
  const batches = getBatches();
  list.innerHTML = "";

  batches
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .forEach(b => {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <b>${b.id}</b><br>
        <small>${b.date} • ${b.time || "—"} • Total ${b.mix || 0} L • Remaining ${b.remaining || 0} L</small>
        <div class="row end" style="margin-top:.4rem;">
          <button class="pill" data-open-batch="${b.id}">Open</button>
          <button class="pill" data-edit-batch="${b.id}">Edit</button>
        </div>
      `;
      list.appendChild(div);
    });
}

// --- Open existing Batch ---
document.addEventListener("click", e => {
  const openBtn = e.target.closest("[data-open-batch]");
  const editBtn = e.target.closest("[data-edit-batch]");
  if (openBtn) {
    const id = openBtn.dataset.openBatch;
    const batch = getBatches().find(b => b.id === id);
    if (batch) showBatchModal(batch);
  } else if (editBtn) {
    const id = editBtn.dataset.editBatch;
    const batch = getBatches().find(b => b.id === id);
    if (batch) editBatch(batch);
  }
});

// --- Modal Display ---
function showBatchModal(batch) {
  const jobs = getJobs({ batchId: batch.id });
  const jobList = jobs.length
    ? `<ul>${jobs.map(j => `<li><a href="#" data-open-job="${j.id}">${j.name}</a></li>`).join("")}</ul>`
    : "—";

  const html = `
    <p><b>Date:</b> ${batch.date} • <b>Time:</b> ${batch.time}</p>
    <p><b>Total Mix:</b> ${batch.mix} L • <b>Remaining:</b> ${batch.remaining} L</p>
    <p><b>Chemicals:</b><br>${batch.chemicals || "—"}</p>
    <p><b>Linked Jobs:</b><br>${jobList}</p>
    <p><b>Created At:</b> ${batch.createdAt || "—"}</p>
  `;

  showModal("Batch Details 🧪", html);
}

// --- Edit Batch ---
function editBatch(batch) {
  const newMix = Number(prompt("Update Total Mix (L):", batch.mix)) || batch.mix;
  const newRemain = Number(prompt("Update Remaining (L):", batch.remaining)) || batch.remaining;
  const newChems = prompt("Update Chemicals:", batch.chemicals) || batch.chemicals;

  batch.mix = newMix;
  batch.remaining = newRemain;
  batch.chemicals = newChems;
  batch.time = new Date().toLocaleTimeString();
  saveBatch(batch);

  renderBatchesList();
  showToast("Batch Updated ✅");
}

// --- Link Job to Batch ---
function linkJobToBatch(jobId, batchId) {
  linkBatchToJob(jobId, batchId);
  showToast("Job Linked to Batch ✅");
}

// --- Auto Refresh on Load ---
document.addEventListener("DOMContentLoaded", () => {
  renderBatchesList();
});
