START batches.js
/* === WeedTracker V60 Pilot - batches.js === */
/* Handles batch creation, chemical linking, and usage tracking */

window.BatchManager = (() => {
  const BM = {};
  let appData = {};
  let chemSelect, chemList, batchList, batchModal;
  let currentBatch = null;

  BM.init = (data, saveFn) => {
    appData = data;
    BM.save = saveFn;
    batchList = document.getElementById("batchList");
    batchModal = document.getElementById("batchModal");

    // Buttons
    document.getElementById("newBatch").onclick = BM.newBatch;
    document.getElementById("bm_addChem").onclick = BM.addChemical;
    document.getElementById("bm_save").onclick = BM.saveBatch;
    document.getElementById("bm_cancel").onclick = BM.closeModal;

    // Elements
    chemSelect = document.getElementById("bm_chemSelect");
    chemList = document.getElementById("bm_chemList");

    BM.refreshChemSelect();
    BM.renderList();
  };

  // Create new batch
  BM.newBatch = () => {
    currentBatch = {
      id: "B" + Date.now(),
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 5),
      totalMix: 0,
      remaining: 0,
      chems: [],
      dump: [],
    };
    BM.fillForm();
    BM.showModal("Create Batch");
  };

  BM.fillForm = () => {
    document.getElementById("bm_id").value = currentBatch.id;
    document.getElementById("bm_date").value = currentBatch.date;
    document.getElementById("bm_time").value = currentBatch.time;
    document.getElementById("bm_mix").value = currentBatch.totalMix || "";
    document.getElementById("bm_remaining").value = currentBatch.remaining || "";
    chemList.innerHTML = "";
  };

  BM.showModal = (title) => {
    document.getElementById("batchModalTitle").textContent = title;
    batchModal.style.display = "flex";
  };

  BM.closeModal = () => {
    batchModal.style.display = "none";
  };

  BM.refreshChemSelect = () => {
    chemSelect.innerHTML = `<option value="">— Select —</option>`;
    appData.chems.forEach((c) => {
      const o = document.createElement("option");
      o.value = c.name;
      o.textContent = `${c.name} (${c.active})`;
      chemSelect.appendChild(o);
    });
  };

  BM.addChemical = () => {
    const chem = chemSelect.value;
    const per100 = parseFloat(document.getElementById("bm_per100").value);
    const unit = document.getElementById("bm_unit").value;
    const totalMix = parseFloat(document.getElementById("bm_mix").value || 0);
    if (!chem || !per100 || !unit || !totalMix) return alert("Fill all chemical fields.");
    const total = ((per100 / 100) * totalMix).toFixed(2);
    const obj = { chem, per100, unit, total: parseFloat(total) };
    currentBatch.chems.push(obj);
    BM.updateChemList();
  };

  BM.updateChemList = () => {
    chemList.innerHTML = "";
    currentBatch.chems.forEach((c, i) => {
      const div = document.createElement("div");
      div.className = "card soft";
      div.innerHTML = `
        <b>${c.chem}</b> – ${c.per100}${c.unit}/100L → <span class="accent">${c.total}${c.unit}</span>
        <button data-i="${i}" class="pill warn small">Remove</button>`;
      div.querySelector("button").onclick = (e) => {
        currentBatch.chems.splice(e.target.dataset.i, 1);
        BM.updateChemList();
      };
      chemList.appendChild(div);
    });
  };

  BM.saveBatch = () => {
    currentBatch.date = document.getElementById("bm_date").value;
    currentBatch.time = document.getElementById("bm_time").value;
    currentBatch.totalMix = parseFloat(document.getElementById("bm_mix").value || 0);
    currentBatch.remaining = parseFloat(document.getElementById("bm_remaining").value || currentBatch.totalMix);
    const dumpAmt = parseFloat(document.getElementById("bm_dumpAmt").value || 0);
    const dumpReason = document.getElementById("bm_dumpReason").value;
    if (dumpAmt > 0) {
      currentBatch.dump.push({ amount: dumpAmt, reason: dumpReason });
      currentBatch.remaining -= dumpAmt;
      if (currentBatch.remaining < 0) currentBatch.remaining = 0;
    }

    const existing = appData.batches.findIndex((b) => b.id === currentBatch.id);
    if (existing >= 0) appData.batches[existing] = currentBatch;
    else appData.batches.push(currentBatch);

    BM.save(appData);
    BM.renderList();
    BM.closeModal();
  };

  BM.renderList = () => {
    batchList.innerHTML = "";
    if (!appData.batches.length) {
      batchList.innerHTML = "<div class='muted'>No batches recorded.</div>";
      return;
    }

    appData.batches.forEach((b) => {
      const div = document.createElement("div");
      const ring = b.remaining <= 0 ? "style='border:2px solid red;'" : "";
      div.className = "card soft";
      div.innerHTML = `
        <div ${ring}>
          <b>${b.id}</b> — ${b.date} ${b.time}<br>
          <small>Total Mix: ${b.totalMix}L | Remaining: ${b.remaining}L</small><br>
          <button class="pill small" data-id="${b.id}">Open</button>
        </div>`;
      div.querySelector("button").onclick = () => BM.viewBatch(b.id);
      batchList.appendChild(div);
    });
  };

  BM.viewBatch = (id) => {
    const b = appData.batches.find((x) => x.id === id);
    if (!b) return;
    const popup = document.createElement("div");
    popup.className = "modal";
    const dumps = b.dump.map((d) => `<li>${d.amount}L dumped — ${d.reason}</li>`).join("") || "<li>None</li>";
    const chems = b.chems
      .map((c) => `<li>${c.chem}: ${c.per100}${c.unit}/100L → ${c.total}${c.unit}</li>`)
      .join("");
    popup.innerHTML = `
      <div class="card p">
        <h3>${b.id}</h3>
        <p>Date: ${b.date} ${b.time}</p>
        <p>Total Mix: ${b.totalMix}L | Remaining: ${b.remaining}L</p>
        <h4>Chemicals</h4><ul>${chems}</ul>
        <h4>Dump Log</h4><ul>${dumps}</ul>
        <div class="row end gap mt">
          <button class="pill warn" id="closeBatchPopup">Close</button>
        </div>
      </div>`;
    document.body.appendChild(popup);
    document.getElementById("closeBatchPopup").onclick = () => popup.remove();
  };

  return BM;
})();
END batches.js
