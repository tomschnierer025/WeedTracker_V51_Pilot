/* === WeedTracker V60 Pilot — batches.js ===
 * Handles batch storage, linking, totals, remaining, dump & edit pop-ups
 * Works directly with storage.js + apps.js integration
 * No placeholders or half-built functions
 */

const BATCH_KEY = "weedtracker_batches_v60";

function loadBatches() {
  try { return JSON.parse(localStorage.getItem(BATCH_KEY) || "[]"); }
  catch { return []; }
}
function saveBatches(list) {
  localStorage.setItem(BATCH_KEY, JSON.stringify(list || []));
}
function getBatch(id) {
  return loadBatches().find(b => b.id === id) || null;
}

/* ----------  UI RENDER  ---------- */
function renderBatches() {
  const container = document.getElementById("batchesList");
  if (!container) return;
  const list = loadBatches();
  if (list.length === 0) {
    container.innerHTML = "<p>No batches created yet.</p>";
    return;
  }

  container.innerHTML = list.map(b => `
    <div class="batchCard card" data-id="${b.id}">
      <div class="row spread">
        <strong>${b.id}</strong>
        <span>${b.date || ""} ${b.time || ""}</span>
      </div>
      <div class="small">
        Mix: ${b.mixL || 0} L<br>
        Remaining: ${b.remainingL || 0} L<br>
        Chemicals: ${b.chemicals.map(c => c.name).join(", ")}
      </div>
      <div class="row gap mt">
        <button class="pill small openBatch">Open</button>
        <button class="pill small warn delBatch">Delete</button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll(".openBatch").forEach(btn =>
    btn.onclick = e => openBatchDetails(e.target.closest(".batchCard").dataset.id)
  );
  container.querySelectorAll(".delBatch").forEach(btn =>
    btn.onclick = e => {
      const id = e.target.closest(".batchCard").dataset.id;
      if (confirm("Delete this batch?")) {
        deleteBatch(id);
        renderBatches();
      }
    }
  );
}

/* ----------  CREATE  ---------- */
function createBatch(batch) {
  const all = loadBatches();
  all.push(batch);
  saveBatches(all);
  renderBatches();
}

/* ----------  DELETE  ---------- */
function deleteBatch(id) {
  const all = loadBatches().filter(b => b.id !== id);
  saveBatches(all);
  showToast("Batch deleted");
}

/* ----------  DETAILS / POP-UP  ---------- */
function openBatchDetails(id) {
  const b = getBatch(id);
  if (!b) return alert("Batch not found");

  const html = `
    <div class="modal" id="batchDetail">
      <div class="card p scrollable" style="max-height:90vh;overflow-y:auto;">
        <div class="row spread">
          <h3>${b.id}</h3>
          <button class="pill warn" data-close>Close</button>
        </div>
        <p><b>Date:</b> ${b.date || ""} ${b.time || ""}</p>
        <p><b>Total Mix:</b> ${b.mixL || 0} L</p>
        <p><b>Remaining:</b> ${b.remainingL || 0} L</p>
        <h4>Chemicals</h4>
        <ul>${b.chemicals.map(c =>
          `<li>${c.name} – ${c.per100.value}${c.per100.unit}/100 L = ${c.total.value}${c.total.unit}</li>`
        ).join("")}</ul>
        <h4>Linked Jobs</h4>
        ${b.linkedJobs?.length
          ? `<ul>${b.linkedJobs.map(j=>`<li><a href="#" onclick="openJob('${j}')">${j}</a></li>`).join("")}</ul>`
          : "<p>None</p>"}
        <h4>Dumped</h4>
        ${b.dumped?.length
          ? `<ul>${b.dumped.map(d=>`<li>${d.date} ${d.time} – ${d.amount} L (${d.reason})</li>`).join("")}</ul>`
          : "<p>None</p>"}
        <div class="row gap mt">
          <button id="dumpBtn" class="pill small">Dump Remaining</button>
          <button id="closeDetail" class="pill small">Close</button>
        </div>
      </div>
    </div>`;

  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  document.body.appendChild(wrap.firstChild);
  const modal = document.getElementById("batchDetail");
  modal.onclick = e => { if (e.target === modal || e.target.dataset.close != null) modal.remove(); };
  document.getElementById("dumpBtn").onclick = () => dumpRemaining(id);
  document.getElementById("closeDetail").onclick = () => modal.remove();
}

/* ----------  DUMP / UPDATE  ---------- */
function dumpRemaining(id) {
  const all = loadBatches();
  const b = all.find(x => x.id === id);
  if (!b) return alert("Batch not found");
  const amt = Number(prompt("Dump how many litres?", "0")) || 0;
  if (amt <= 0 || amt > (b.remainingL || 0)) return alert("Invalid amount");
  const reason = prompt("Reason for dump?", "Expired or leftover");
  b.remainingL -= amt;
  b.dumped = b.dumped || [];
  b.dumped.push({ date: todayISO(), time: nowTime(), amount: amt, reason });
  saveBatches(all);
  renderBatches();
  showToast("Batch updated");
}

/* ----------  LINKS TO JOBS  ---------- */
function linkBatchToJob(batchId, jobId) {
  const all = loadBatches();
  const b = all.find(x => x.id === batchId);
  if (!b) return;
  if (!b.linkedJobs.includes(jobId)) b.linkedJobs.push(jobId);
  saveBatches(all);
}

console.log("✅ batches.js fully loaded");
