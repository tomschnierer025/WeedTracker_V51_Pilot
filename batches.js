/* === WeedTracker V60 Pilot — batches.js ===
 * Dedicated batch management logic:
 * - Multi-chemical batches
 * - Auto timestamps
 * - Inventory deduction
 * - Dump & edit with reason tracking
 * - Red border highlight for empty batches
 */

window.WeedBatches = (() => {
  const B = {};
  const fmt = (n, d = 0) => (n == null || n === "") ? "–" : Number(n).toFixed(d);

  /* ===== Create new batch ===== */
  B.createBatch = (DB, saveDB, renderBatches, populateBatchSelect) => {
    const id = "B" + Date.now();
    const date = new Date();
    const dateStr = date.toISOString().split("T")[0];
    const timeStr = date.toTimeString().slice(0, 5);

    const mix = Number(prompt("Total mix (L):", "200")) || 0;
    if (!mix) return alert("Invalid total mix.");

    const chemicals = [];
    let addMore = true;

    while (addMore) {
      const chemNames = DB.chems.map((c, i) => `${i + 1}. ${c.name}`).join("\n");
      const choice = prompt(`Select chemical:\n${chemNames}\nEnter number or cancel`, "1");
      if (!choice) break;
      const chem = DB.chems[Number(choice) - 1];
      if (!chem) break;

      const rate = Number(prompt(`Rate for ${chem.name} per 100L:`, "2")) || 0;
      const unit = prompt("Unit (L, mL, g, kg):", chem.containerUnit || "L");
      const totalUsed = (rate / 100) * mix;
      chemicals.push({ name: chem.name, rate, unit, totalUsed });

      // Deduct from inventory
      const chemItem = DB.chems.find((c) => c.name === chem.name);
      if (chemItem) {
        const perContainer = chemItem.containerSize || 1;
        const usedContainers = totalUsed / perContainer;
        chemItem.containers = Math.max(0, (chemItem.containers || 0) - usedContainers);
      }

      addMore = confirm("Add another chemical?");
    }

    const obj = {
      id,
      date: dateStr,
      time: timeStr,
      mix,
      remaining: mix,
      used: 0,
      chemicals,
      dumps: [],
      color: "#fff",
    };

    DB.batches.push(obj);
    saveDB();
    renderBatches();
    populateBatchSelect();
    alert("Batch created successfully!");
  };

  /* ===== Render all batches ===== */
  B.renderBatches = (DB, showBatchPopup) => {
    const list = document.getElementById("batchList");
    if (!list) return;
    list.innerHTML = "";

    DB.batches
      .slice()
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .forEach((b) => {
        const div = document.createElement("div");
        const empty = b.remaining <= 0 ? "style='border:2px solid red;'" : "";
        div.className = "item";
        div.innerHTML = `
          <div ${empty}>
            <b>${b.id}</b><br>
            <small>${b.date} ${b.time}</small><br>
            <small>Total Mix: ${fmt(b.mix)} L</small><br>
            <small>Remaining: ${fmt(b.remaining)} L</small><br>
            <button class="pill" data-open="${b.id}">Open</button>
          </div>`;
        div.querySelector("[data-open]").addEventListener("click", () => showBatchPopup(b));
        list.appendChild(div);
      });
  };

  /* ===== Batch Popup ===== */
  B.showBatchPopup = (b, DB, saveDB, renderBatches, populateBatchSelect) => {
    const totalChem = b.chemicals
      .map((c) => `<li>${c.name} — ${fmt(c.rate)} per 100L (${fmt(c.totalUsed)} ${c.unit})</li>`)
      .join("");
    const dumps = b.dumps?.length
      ? b.dumps.map((d) => `<li>${d.date} ${d.time} — ${fmt(d.amount)} L (${d.reason})</li>`).join("")
      : "—";

    const html = `
      <div class="modal">
        <div class="card p">
          <h3 style="margin-top:0">${b.id}</h3>
          <div><b>Date:</b> ${b.date} • ${b.time}</div>
          <div><b>Total Mix:</b> ${fmt(b.mix)} L</div>
          <div><b>Remaining:</b> ${fmt(b.remaining)} L</div>
          <div><b>Chemicals:</b><ul>${totalChem}</ul></div>
          <div><b>Dumped:</b><ul>${dumps}</ul></div>
          <div class="row gap end" style="margin-top:.8rem;">
            <button class="pill" data-dump>Dump</button>
            <button class="pill" data-edit>Edit</button>
            <button class="pill warn" data-close>Close</button>
          </div>
        </div>
      </div>`;

    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstChild);
    const modal = document.querySelector(".modal");
    modal.addEventListener("click", (e) => {
      if (e.target === modal || e.target.dataset.close != null) modal.remove();
    });

    modal.querySelector("[data-edit]").addEventListener("click", () => {
      const mix = Number(prompt("Total mix (L):", b.mix)) || b.mix;
      const remaining = Number(prompt("Remaining (L):", b.remaining)) || b.remaining;
      b.mix = mix;
      b.remaining = remaining;
      saveDB();
      modal.remove();
      renderBatches();
      populateBatchSelect();
    });

    modal.querySelector("[data-dump]").addEventListener("click", () => {
      const amt = Number(prompt("Amount to dump (L):", "0")) || 0;
      if (!amt) return alert("Invalid amount.");
      const reason = prompt("Reason for dump:", "Expired or spillage") || "—";
      const now = new Date();
      const dumpRecord = {
        amount: amt,
        reason,
        date: now.toISOString().split("T")[0],
        time: now.toTimeString().slice(0, 5),
      };
      b.dumps.push(dumpRecord);
      b.remaining = Math.max(0, b.remaining - amt);
      if (b.remaining <= 0) b.color = "red";
      saveDB();
      modal.remove();
      renderBatches();
      populateBatchSelect();
      alert("Dump recorded successfully.");
    });
  };

  return B;
})();
