/* === WeedTracker V60.4 Pilot - batches.js === */
/* Complete batch creation, editing, dump, and linking system */

window.WeedBatches = (() => {
  const BT = {};

  // ===== Create New Batch =====
  BT.createBatchPopup = (chems, saveCallback) => {
    const div = document.createElement("div");
    div.className = "modal";

    const id = "B" + Date.now();
    const date = new Date();
    const dateStr = date.toISOString().split("T")[0];
    const timeStr = date.toTimeString().slice(0, 5);

    let chemRowsHTML = "";

    const buildChemRow = (idx) => `
      <div class="chem-row" data-idx="${idx}">
        <select class="chem-name" style="width:100%">
          <option value="">Select Chemical</option>
          ${chems.map(c => `<option value="${c.name}">${c.name}</option>`).join("")}
        </select>
        <div class="row gap mt">
          <input type="number" class="chem-rate" placeholder="Rate per 100L" />
          <select class="chem-unit">
            <option value="L">L</option>
            <option value="mL">mL</option>
            <option value="g">g</option>
            <option value="kg">kg</option>
          </select>
          <button class="pill warn delChem">✖</button>
        </div>
      </div>
    `;

    let idx = 0;
    chemRowsHTML += buildChemRow(idx);

    div.innerHTML = `
      <div class="card p scrollable" style="max-width:480px;width:95%">
        <h3>Create New Batch</h3>
        <p><b>Batch ID:</b> ${id}</p>
        <p><b>Date:</b> ${dateStr} · <b>Time:</b> ${timeStr}</p>

        <label>Total Mix (L)</label>
        <input type="number" id="bt_mix" placeholder="Enter total mix" />

        <div id="chemContainer">${chemRowsHTML}</div>
        <button id="addChemRow" class="pill mt">➕ Add Chemical</button>

        <div class="row gap end mt-2">
          <button id="bt_save" class="pill emph">Save Batch</button>
          <button id="bt_cancel" class="pill warn">Cancel</button>
        </div>
      </div>`;

    document.body.appendChild(div);

    const container = div.querySelector("#chemContainer");
    const addBtn = div.querySelector("#addChemRow");

    addBtn.onclick = () => {
      idx++;
      const newRow = document.createElement("div");
      newRow.innerHTML = buildChemRow(idx);
      container.appendChild(newRow.firstChild);
      refreshDelBtns();
    };

    const refreshDelBtns = () => {
      container.querySelectorAll(".delChem").forEach(btn => {
        btn.onclick = (e) => e.target.closest(".chem-row").remove();
      });
    };
    refreshDelBtns();

    div.querySelector("#bt_cancel").onclick = () => div.remove();
    div.querySelector("#bt_save").onclick = () => {
      const mix = Number(document.getElementById("bt_mix").value || 0);
      if (!mix) return alert("Enter total mix.");

      const chemicals = [];
      container.querySelectorAll(".chem-row").forEach(row => {
        const name = row.querySelector(".chem-name").value;
        const rate = parseFloat(row.querySelector(".chem-rate").value || 0);
        const unit = row.querySelector(".chem-unit").value;
        if (name && rate) chemicals.push({ name, rate, unit });
      });

      if (!chemicals.length) return alert("Add at least one chemical.");

      const batch = {
        id,
        date: dateStr,
        time: timeStr,
        mix,
        remaining: mix,
        chemicals,
        used: 0,
        dumps: [],
      };

      saveCallback(batch);
      div.remove();
    };
  };

  // ===== Show Existing Batch =====
  BT.showBatchDetails = (batch, updateCallback) => {
    const redBorder = batch.remaining <= 0 ? "border:2px solid red" : "";
    const usedTotal = batch.used || 0;
    const dumpList = (batch.dumps || [])
      .map(d => `<li>${d.amount}L dumped - ${d.reason}</li>`)
      .join("");

    const html = `
      <div class="card p scrollable" style="max-width:480px;width:95%;${redBorder}">
        <h3>${batch.id}</h3>
        <p><b>Date:</b> ${batch.date} ${batch.time || ""}</p>
        <p><b>Total Mix:</b> ${batch.mix}L<br>
        <b>Remaining:</b> ${batch.remaining}L<br>
        <b>Used:</b> ${usedTotal}L</p>

        <h4>Chemicals Used</h4>
        <ul>${batch.chemicals
          .map(c => `<li>${c.name} – ${c.rate}${c.unit}/100L</li>`)
          .join("")}</ul>

        <h4>Dumped Mix</h4>
        <ul>${dumpList || "—"}</ul>

        <div class="row gap end mt-2">
          <button class="pill" id="dumpBtn">Dump</button>
          <button class="pill" id="editBtn">Edit</button>
          <button class="pill warn" id="closeBtn">Close</button>
        </div>
      </div>`;

    const div = document.createElement("div");
    div.className = "modal";
    div.innerHTML = html;
    document.body.appendChild(div);

    div.querySelector("#closeBtn").onclick = () => div.remove();

    div.querySelector("#editBtn").onclick = () => {
      div.remove();
      BT.editBatch(batch, updateCallback);
    };

    div.querySelector("#dumpBtn").onclick = () => {
      const amount = Number(prompt("Enter amount to dump (L):", "0"));
      if (!amount || amount <= 0) return;
      const reason = prompt("Reason for dump:", "Contamination");
      batch.remaining = Math.max(0, batch.remaining - amount);
      batch.dumps = batch.dumps || [];
      batch.dumps.push({ amount, reason, date: new Date().toISOString() });
      updateCallback(batch);
      div.remove();
    };
  };

  // ===== Edit Batch =====
  BT.editBatch = (batch, saveCallback) => {
    const div = document.createElement("div");
    div.className = "modal";

    const buildRow = (c, i) => `
      <div class="chem-row" data-idx="${i}">
        <input value="${c.name}" class="chem-name" />
        <div class="row gap mt">
          <input type="number" value="${c.rate}" class="chem-rate" />
          <select class="chem-unit">
            <option ${c.unit === "L" ? "selected" : ""}>L</option>
            <option ${c.unit === "mL" ? "selected" : ""}>mL</option>
            <option ${c.unit === "g" ? "selected" : ""}>g</option>
            <option ${c.unit === "kg" ? "selected" : ""}>kg</option>
          </select>
        </div>
      </div>`;

    div.innerHTML = `
      <div class="card p scrollable" style="max-width:480px;width:95%">
        <h3>Edit Batch ${batch.id}</h3>
        <label>Total Mix (L)</label>
        <input id="edit_mix" type="number" value="${batch.mix}" />
        <label>Remaining (L)</label>
        <input id="edit_remaining" type="number" value="${batch.remaining}" />
        <div id="editChems">${batch.chemicals.map(buildRow).join("")}</div>
        <div class="row gap end mt-2">
          <button id="editSave" class="pill emph">Save</button>
          <button id="editCancel" class="pill warn">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(div);

    div.querySelector("#editCancel").onclick = () => div.remove();
    div.querySelector("#editSave").onclick = () => {
      batch.mix = Number(document.getElementById("edit_mix").value);
      batch.remaining = Number(document.getElementById("edit_remaining").value);
      batch.chemicals = [];
      div.querySelectorAll(".chem-row").forEach(row => {
        const name = row.querySelector(".chem-name").value;
        const rate = parseFloat(row.querySelector(".chem-rate").value || 0);
        const unit = row.querySelector(".chem-unit").value;
        if (name) batch.chemicals.push({ name, rate, unit });
      });
      saveCallback(batch);
      div.remove();
    };
  };

  return BT;
})();
