/* === WeedTracker V60 Pilot — batches.js ===
   Full batch builder module
   Includes:
   - Big popup UI (not alerts)
   - Timestamp (date + time)
   - Add multiple chemicals from inventory
   - Auto total calculations
   - Deduction from inventory
   - Dump logic with reason + red border for zero remaining
*/

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = (n, d = 0) => (n == null || n === "") ? "–" : Number(n).toFixed(d);
  const DB = window.WeedStorage.load();

  // Utility — refresh & save
  function saveDB() {
    window.WeedStorage.save(DB);
  }

  // Render all batches
  function renderBatches() {
    const list = $("#batchList");
    if (!list) return;
    list.innerHTML = "";
    DB.batches
      .slice()
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .forEach(b => {
        const div = document.createElement("div");
        div.className = "item batch-card";
        if (b.remaining <= 0) div.classList.add("red");
        div.innerHTML = `
          <b>${b.id}</b><br>
          <small>${b.date || "—"} • ${b.time || "—"}<br>
          Total: ${fmt(b.mix)} L • Remaining: ${fmt(b.remaining)} L</small>
          <div class="row end">
            <button class="pill" data-open="${b.id}">Open</button>
          </div>`;
        div.querySelector("[data-open]").addEventListener("click", () => openBatchPopup(b));
        list.appendChild(div);
      });
  }

  // Open the big batch creation popup
  $("#newBatch")?.addEventListener("click", () => {
    const modal = document.createElement("div");
    modal.className = "modal";
    const timestamp = new Date();
    const date = timestamp.toISOString().split("T")[0];
    const time = timestamp.toTimeString().slice(0, 5);

    modal.innerHTML = `
      <div class="card p">
        <h3>Create Batch</h3>
        <p><b>Date:</b> ${date} • <b>Time:</b> ${time}</p>
        <label>Total Mix (L)</label>
        <input type="number" id="batchTotal" placeholder="e.g. 200" />
        <div id="chemLines"></div>
        <button id="addChemBtn" class="pill">➕ Add Chemical</button>
        <div class="row gap end" style="margin-top:1rem;">
          <button id="createBatchBtn">Create Batch</button>
          <button id="cancelBatchBtn" class="warn">Cancel</button>
        </div>
      </div>`;

    document.body.appendChild(modal);

    $("#cancelBatchBtn").addEventListener("click", () => modal.remove());

    // Add new chemical line
    $("#addChemBtn").addEventListener("click", () => addChemicalLine($("#chemLines")));

    // Create final batch
    $("#createBatchBtn").addEventListener("click", () => {
      const totalMix = Number($("#batchTotal").value) || 0;
      if (!totalMix) return alert("Enter total mix litres.");
      const chems = [];
      $$("#chemLines .chem-line").forEach(line => {
        const name = line.querySelector(".chemSelect").value;
        const per100 = Number(line.querySelector(".chemPer100").value);
        const unit = line.querySelector(".chemUnit").value;
        const chemObj = DB.chems.find(c => c.name === name);
        const totalUsed = (per100 / 100) * totalMix;

        chems.push({ name, per100, unit, totalUsed });

        // Deduct from inventory
        if (chemObj) {
          const containerVol = chemObj.containerSize || 1;
          const totalAvailable = chemObj.containers * containerVol;
          const remaining = Math.max(0, totalAvailable - totalUsed);
          chemObj.containers = remaining / containerVol;
        }
      });

      const id = "B" + Date.now();
      const batch = {
        id,
        date,
        time,
        mix: totalMix,
        remaining: totalMix,
        used: 0,
        chemicals: chems,
        dumps: [],
      };

      DB.batches.push(batch);
      saveDB();
      modal.remove();
      renderBatches();
      alert("✅ Batch created successfully!");
    });
  });

  function addChemicalLine(container) {
    const div = document.createElement("div");
    div.className = "chem-line";
    const chemOptions = DB.chems
      .map(c => `<option value="${c.name}">${c.name}</option>`)
      .join("");
    div.innerHTML = `
      <div style="margin-top:.4rem;border:1px solid #ccc;padding:.5rem;border-radius:6px;">
        <label>Chemical</label>
        <select class="chemSelect">${chemOptions}</select>
        <label>Amount per 100L</label>
        <input type="number" class="chemPer100" placeholder="e.g. 2" />
        <label>Unit</label>
        <select class="chemUnit">
          <option value="L">L</option>
          <option value="mL">mL</option>
          <option value="g">g</option>
          <option value="kg">kg</option>
        </select>
      </div>`;
    container.appendChild(div);
  }

  // Popup for viewing or editing batch
  function openBatchPopup(batch) {
    const modal = document.createElement("div");
    modal.className = "modal";
    const jobsLinked = DB.tasks.filter(t => t.batch === batch.id);
    const jobList = jobsLinked.length
      ? `<ul>${jobsLinked.map(j => `<li>${j.name}</li>`).join("")}</ul>`
      : "—";
    const chemList = batch.chemicals
      .map(c => `<li>${c.name}: ${c.per100} ${c.unit}/100L • Used ${fmt(c.totalUsed)} ${c.unit}</li>`)
      .join("");
    const dumps = (batch.dumps || [])
      .map(d => `<li>${d.amount} L dumped (${d.reason})</li>`)
      .join("");

    modal.innerHTML = `
      <div class="card p">
        <h3>${batch.id}</h3>
        <p><b>Date:</b> ${batch.date} • <b>Time:</b> ${batch.time}</p>
        <p><b>Total Mix:</b> ${fmt(batch.mix)} L</p>
        <p><b>Remaining:</b> ${fmt(batch.remaining)} L</p>
        <p><b>Chemicals:</b></p>
        <ul>${chemList}</ul>
        <p><b>Linked Jobs:</b></p>${jobList}
        <p><b>Dump History:</b></p>
        <ul>${dumps || "—"}</ul>
        <div class="row gap end" style="margin-top:1rem;">
          <button id="editBatchBtn">Edit</button>
          <button id="dumpBatchBtn">Dump</button>
          <button id="closeBatchBtn" class="warn">Close</button>
        </div>
      </div>`;

    document.body.appendChild(modal);

    $("#closeBatchBtn").addEventListener("click", () => modal.remove());

    $("#dumpBatchBtn").addEventListener("click", () => {
      const amt = Number(prompt("Dump amount (L):", "0")) || 0;
      if (!amt) return;
      const reason = prompt("Reason for dumping:", "Leftover / spill") || "Unspecified";
      batch.remaining = Math.max(0, batch.remaining - amt);
      batch.dumps = batch.dumps || [];
      batch.dumps.push({ amount: amt, reason });
      saveDB();
      modal.remove();
      renderBatches();
      alert("Dump logged successfully.");
    });

    $("#editBatchBtn").addEventListener("click", () => {
      const mix = Number(prompt("Total mix (L):", batch.mix)) || batch.mix;
      batch.mix = mix;
      batch.remaining = Math.max(0, batch.remaining);
      saveDB();
      modal.remove();
      renderBatches();
      alert("Batch updated.");
    });
  }

  document.addEventListener("DOMContentLoaded", renderBatches);
})();
