/* === WeedTracker V61 Final Pilot — extras.js ===
   UI helpers: popups, spinners, Apple Maps navigation, modals, alerts
*/

// --- Spinner Controls ---
function showSpinner(text = "Working…") {
  const sp = document.getElementById("spinner");
  if (!sp) return;
  sp.textContent = text;
  sp.classList.add("active");
}
function hideSpinner() {
  const sp = document.getElementById("spinner");
  if (!sp) return;
  sp.classList.remove("active");
}

// --- Toast (temporary alert) ---
function showToast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1600);
}

// --- Modal / Pop-up Window ---
function showModal(title, body, actions = []) {
  closeModal(); // clear any previous
  const modal = document.createElement("div");
  modal.className = "modal";

  const card = document.createElement("div");
  card.className = "card";

  const h3 = document.createElement("h3");
  h3.textContent = title;
  card.appendChild(h3);

  if (typeof body === "string") {
    const p = document.createElement("div");
    p.innerHTML = body;
    card.appendChild(p);
  } else if (body instanceof Node) {
    card.appendChild(body);
  }

  const footer = document.createElement("div");
  footer.style.marginTop = "0.8rem";
  footer.style.textAlign = "right";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.onclick = closeModal;
  footer.appendChild(closeBtn);

  actions.forEach(a => footer.appendChild(a));

  card.appendChild(footer);
  modal.appendChild(card);
  document.body.appendChild(modal);
}

function closeModal() {
  const m = document.querySelector(".modal");
  if (m) m.remove();
}

// --- Apple Maps Navigation ---
function openInAppleMaps(lat, lon, name = "Location") {
  if (!lat || !lon) {
    showToast("No coordinates found for navigation");
    return;
  }
  const url = `https://maps.apple.com/?daddr=${lat},${lon}&q=${encodeURIComponent(name)}`;
  window.open(url, "_blank");
}

// --- Record & Batch Pop-ups ---
function openRecordPopup(job) {
  if (!job) return;
  const body = document.createElement("div");
  body.innerHTML = `
    <p><strong>Job Name:</strong> ${job.name}</p>
    <p><strong>Type:</strong> ${job.type}</p>
    <p><strong>Weed:</strong> ${job.weed}</p>
    <p><strong>Batch:</strong> ${job.batchId || "—"}</p>
    <p><strong>Date:</strong> ${job.date}</p>
    <p><strong>Notes:</strong> ${job.notes || "—"}</p>
    <div style="margin-top:0.8rem;">
      <button id="navJob">Navigate</button>
      <button id="editJob">Edit</button>
    </div>
  `;
  showModal("Record Details", body);

  document.getElementById("navJob").onclick = () => {
    if (job.lat && job.lon) openInAppleMaps(job.lat, job.lon, job.name);
    else showToast("No coordinates recorded");
  };

  document.getElementById("editJob").onclick = () => {
    closeModal();
    editJob(job.id);
  };
}

function openBatchPopup(batch) {
  if (!batch) return;
  const body = document.createElement("div");
  body.innerHTML = `
    <p><strong>Batch ID:</strong> ${batch.id}</p>
    <p><strong>Date Created:</strong> ${batch.date}</p>
    <p><strong>Total Volume:</strong> ${batch.volume || "—"} L</p>
    <p><strong>Chemicals:</strong></p>
    <ul>${(batch.chems || []).map(c => `<li>${c.name} – ${c.amount}</li>`).join("")}</ul>
    <p><strong>Jobs Linked:</strong></p>
    <ul>${(batch.jobs || []).map(j => `<li>${j}</li>`).join("")}</ul>
  `;
  showModal("Batch Details", body);
}

// --- Hook up click handlers ---
document.addEventListener("click", e => {
  const btn = e.target.closest("[data-open-job]");
  if (btn) {
    const id = btn.getAttribute("data-open-job");
    const jobs = loadData(WT_KEYS.JOBS);
    const job = jobs.find(j => j.id === id);
    if (job) openRecordPopup(job);
  }

  const bat = e.target.closest("[data-open-batch]");
  if (bat) {
    const id = bat.getAttribute("data-open-batch");
    const batches = loadData(WT_KEYS.BATCHES);
    const b = batches.find(x => x.id === id);
    if (b) openBatchPopup(b);
  }
});

// --- Spinner wrapper for async ops ---
async function withSpinner(label, fn) {
  showSpinner(label);
  try {
    await fn();
  } catch (err) {
    alert("Error: " + err.message);
  } finally {
    hideSpinner();
  }
}
