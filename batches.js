/* === WeedTracker V60 Pilot - batches.js === */
/* Batch creation, linking, and chemical deduction logic */

window.WeedBatches = (() => {
  const BA = {};

  const $ = (s, r = document) => r.querySelector(s);
  const fmt = (n, d = 0) => (n == null || n === "") ? "–" : Number(n).toFixed(d);

  /* ===== Create Batch ===== */
  BA.newBatchPopup = (DB, saveDB) => {
    const now = new Date();
    const ts = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const html = `
      <div class="modal">
        <div class="card p">
          <h3>Create New Batch</h3>
          <label><b>Date:</b></label>
          <input type="date" id="nb_date" value="${now.toISOString().split("T")[0]}">
          <label><b>Time:</b></label>
          <input type="time" id="nb_time" value="${ts}">
          <label><b>Total Mix (L):</b></label>
          <input type="number" id="nb_mix" value="200">
          <div id="chemArea"></div>
          <button id="addChemBtn">➕ Add Chemical</button>
          <div class="row gap end" style="margin-top:1rem;">
            <button id="saveBatchBtn">Save Batch</button>
            <button id="cancelBatchBtn" class="warn">Cancel</button>
          </div>
        </div>
      </div>`;

    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstChild);
    const modal = $(".modal");

    const chemArea = $("#chemArea");
    const addChemRow = () => {
      const row = document.createElement("div");
      row.className = "chemRow";
      const chems = DB.chems.slice().sort((a, b) => a.name.localeCompare(b.name));
      const opts = chems.map(c => `<option value="${c.name}">${c.name}</option>`).join("");
      row.innerHTML = `
        <label>Chemical</label>
        <select class="chemSelect"><option value="">Select</option>${opts}</select>
        <label>Amount per 100L</label>
        <input type="number" class="chemAmount" placeholder="e.g. 2">
        <label>Unit</label>
        <select class="chemUnit">
          <option value="L">L</option>
          <option value="mL">mL</option>
          <option value="g">g</option>
          <option value="kg">kg</option>
        </select>
        <div class="chemTotal dim">Total: –</div>
        <hr>`;
      chemArea.appendChild(row);

      const mixEl = $("#nb_mix");
      const updateTotals = () => {
        const mix = Number(mixEl.value) || 0;
        const amt = Number(row.querySelector(".chemAmount").value) || 0;
        const total = (mix / 100) * amt;
        row.querySelector(".chemTotal").textContent = `Total: ${fmt(total)} ${row.querySelector(".chemUnit").value}`;
      };
      row.querySelector(".chemAmount").addEventListener("input", updateTotals);
      row.querySelector(".chemUnit").addEventListener("change", updateTotals);
      mixEl.addEventListener("input", updateTotals);
    };
    $("#addChemBtn").onclick = addChemRow;
    addChemRow();

    $("#cancelBatchBtn").onclick = () => modal.remove();
    $("#saveBatchBtn").onclick = () => {
      const id = "B" + Date.now();
      const date = $("#nb_date").value;
      const time = $("#nb_time").value;
      const mix = Number($("#nb_mix").value) || 0;
      const chems = [...chemArea.querySelectorAll(".chemRow")].map(r => {
        const chem = r.querySelector(".chemSelect").value;
        const amt = Number(r.querySelector(".chemAmount").value) || 0;
        const unit = r.querySelector(".chemUnit").value;
        const total = (mix / 100) * amt;
        return { chem, amt, unit, total };
      }).filter(c => c.chem);

      const summary = chems.map(c => `${c.chem}: ${fmt(c.amt)}${c.unit}/100L (Total ${fmt(c.total)}${c.unit})`).join("<br>");
      const batch = { id, date, time, mix, remaining: mix, used: 0, chemicals: summary, dumped: false };

      DB.batches.push(batch);

      // Deduct chemicals from inventory
      chems.forEach(c => {
        const inv = DB.chems.find(x => x.name === c.chem);
        if (inv) {
          const containerVol = inv.containerSize * inv.containers;
          let totalUsed = 0;
          if (c.unit === "L" && inv.containerUnit === "L") totalUsed = c.total;
          if (c.unit === "mL" && inv.containerUnit === "L") totalUsed = c.total / 1000;
          if (c.unit === "g" && inv.containerUnit === "kg") totalUsed = c.total / 1000;
          if (c.unit === "kg" && inv.containerUnit === "kg") totalUsed = c.total;
          const remainingVol = containerVol - totalUsed;
          inv.containers = Math.max(0, remainingVol / inv.containerSize);
        }
      });

      saveDB();
      alert("Batch created successfully.");
      modal.remove();
    };
  };

  /* ===== Render Batches ===== */
  BA.render = (DB, showPopup) => {
    const list = document.getElementById("batchList");
    if (!list) return;
    list.innerHTML = "";
    DB.batches
      .slice()
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .forEach((b) => {
        const div = document.createElement("div");
        div.className = "item";
        if (b.remaining <= 0) div.classList.add("batch-empty");
        div.innerHTML = `
          <b>${b.id}</b><br>
          <small>${b.date || "—"} ${b.time || ""}</small><br>
          <small>Total Mix: ${fmt(b.mix)} L | Remaining: ${fmt(b.remaining)} L</small>
          <div class="row end"><button class="pill" data-open="${b.id}">Open</button></div>`;
        div.querySelector("[data-open]").onclick = () => showPopup(b);
        list.appendChild(div);
      });
  };

  /* ===== Show Batch Popup ===== */
  BA.showPopup = (DB, b, saveDB) => {
    const jobs = DB.tasks.filter((t) => t.batch === b.id);
    const jobsHtml = jobs.length
      ? `<ul>${jobs.map((t) => `<li>${t.name}</li>`).join("")}</ul>`
      : "—";

    const html = `
      <div class="modal">
        <div class="card p ${b.remaining <= 0 ? "dumped" : ""}">
          <h3>${b.id}</h3>
          <div><b>Date:</b> ${b.date || "–"} · <b>Time:</b> ${b.time || "–"}</div>
          <div><b>Total Mix:</b> ${fmt(b.mix)} L</div>
          <div><b>Remaining:</b> ${fmt(b.remaining)} L</div>
          <div style="margin-top:.4rem;"><b>Chemicals:</b><br>${b.chemicals}</div>
          <div style="margin-top:.4rem;"><b>Linked Jobs:</b><br>${jobsHtml}</div>
          <div class="row gap end" style="margin-top:.8rem;">
            <button class="pill" id="editBatchBtn">Edit</button>
            <button class="pill" id="dumpBatchBtn">Dump</button>
            <button class="pill warn" id="closeBatchBtn">Close</button>
          </div>
        </div>
      </div>`;

    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstChild);
    const modal = document.querySelector(".modal");

    modal.querySelector("#closeBatchBtn").onclick = () => modal.remove();

    modal.querySelector("#editBatchBtn").onclick = () => {
      const mix = Number(prompt("Total mix (L):", b.mix)) || b.mix;
      const remain = Number(prompt("Remaining (L):", b.remaining)) || b.remaining;
      const chems = prompt("Edit chemicals:", b.chemicals) || b.chemicals;
      b.mix = mix;
      b.remaining = remain;
      b.chemicals = chems;
      saveDB();
      modal.remove();
      alert("Batch updated.");
    };

    modal.querySelector("#dumpBatchBtn").onclick = () => {
      const amt = Number(prompt("Amount to dump (L):", b.remaining)) || 0;
      const reason = prompt("Reason for dumping:", "") || "No reason specified";
      b.remaining = Math.max(0, (b.remaining || 0) - amt);
      b.dumped = true;
      b.dumpReason = reason;
      saveDB();
      modal.remove();
      alert("Batch dumped.");
    };
  };

  return BA;
})();
