/* WeedTracker V60 Pilot — batches.js */
/* Handles chemical batch creation, editing, linking to jobs, and dumps */

const BATCH_KEY = "weedtracker_batches_v60";

/* ---------- Load / Save ---------- */
function loadBatches() {
  try {
    return JSON.parse(localStorage.getItem(BATCH_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveBatches(list) {
  localStorage.setItem(BATCH_KEY, JSON.stringify(list || []));
}

/* ---------- Render List ---------- */
function renderBatches() {
  const listEl = document.getElementById("batchList");
  if (!listEl) return;

  const batches = loadBatches();
  if (!batches.length) {
    listEl.innerHTML = "<p>No batches created yet.</p>";
    return;
  }

  listEl.innerHTML = "";
  batches
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .forEach(b => {
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <b>${b.id}</b><br>
        <small>${b.date || ""} • Mix ${b.mix || 0} L • Remaining ${b.remaining || 0} L</small>
        <div class="row gap end mt-2">
          <button class="pill" data-open>Open</button>
          <button class="pill warn" data-del>Delete</button>
        </div>`;
      item.querySelector("[data-open]").onclick = () => openBatchPopup(b);
      item.querySelector("[data-del]").onclick = () => {
        if (confirm("Delete this batch?")) {
          const all = loadBatches().filter(x => x.id !== b.id);
          saveBatches(all);
          showToast("Batch deleted");
          renderBatches();
        }
      };
      listEl.appendChild(item);
    });
}

/* ---------- Open Batch Popup ---------- */
function openBatchPopup(b) {
  const html = `
  <div class="modal" id="batchModal">
    <div class="card scrollable" style="max-height:90vh;overflow-y:auto;">
      <div class="row spread">
        <h3>${b.id}</h3>
        <button class="pill warn" data-close>Close</button>
      </div>
      <p><b>Date:</b> ${b.date || ""}</p>
      <p><b>Total Mix:</b> ${b.mix || 0} L</p>
      <p><b>Remaining:</b> ${b.remaining || 0} L</p>
      <h4>Chemicals</h4>
      <ul>${(b.chems || [])
        .map(c => `<li>${c.name} – ${c.rate || ""}${c.unit || ""}/100 L</li>`)
        .join("")}</ul>
      <h4>Linked Jobs</h4>
      ${b.linkedJobs?.length
        ? `<ul>${b.linkedJobs
            .map(j => `<li>${j}</li>`)
            .join("")}</ul>`
        : "<p>None</p>"}
      <h4>Dumped History</h4>
      ${b.dumped?.length
        ? `<ul>${b.dumped
            .map(d => `<li>${d.date} – ${d.amount} L (${d.reason})</li>`)
            .join("")}</ul>`
        : "<p>None</p>"}
      <div class="row gap mt">
        <button id="dumpBtn" class="pill">Dump Remaining</button>
      </div>
    </div>
  </div>`;
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  document.body.appendChild(wrap.firstChild);
  const modal = document.getElementById("batchModal");
  modal.onclick = e => { if (e.target === modal || e.target.dataset.close != null) modal.remove(); };
  document.getElementById("dumpBtn").onclick = () => dumpBatch(b.id);
}

/* ---------- Dump Remaining ---------- */
function dumpBatch(id) {
  const list = loadBatches();
  const b = list.find(x => x.id === id);
  if (!b) return alert("Batch not found");
  const amt = Number(prompt("Dump how many litres?","0")) || 0;
  if (amt <= 0 || amt > (b.remaining || 0)) return alert("Invalid amount");
  const reason = prompt("Reason for dump?","Expired or leftover") || "Leftover";
  b.remaining -= amt;
  b.dumped = b.dumped || [];
  b.dumped.push({ date: todayISO(), amount: amt, reason });
  saveBatches(list);
  showToast("Batch updated");
  renderBatches();
}

/* ---------- Link Batch to Job ---------- */
function linkBatchToJob(batchId, jobId) {
  const all = loadBatches();
  const b = all.find(x => x.id === batchId);
  if (!b) return;
  b.linkedJobs = b.linkedJobs || [];
  if (!b.linkedJobs.includes(jobId)) b.linkedJobs.push(jobId);
  saveBatches(all);
}

console.log("✅ batches.js loaded");
