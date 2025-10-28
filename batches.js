/* === WeedTracker V60 Pilot — batches.js === */
window.WTBatches = (() => {
  const B = {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = (n, d=0) => (n==null||n==="") ? "–" : Number(n).toFixed(d);
  const { formatDateAU, nowTime, todayISO, popup, toast } = window.WTExtras;

  B.renderBatches = (DB, opts = {}) => {
    const list = $("#batchList"); if (!list) return;
    list.innerHTML = "";
    const from = $("#batFrom")?.value || "";
    const to   = $("#batTo")?.value || "";

    DB.batches
      .filter(b => (!from || b.date >= from) && (!to || b.date <= to))
      .sort((a,b) => (b.date||"").localeCompare(a.date||""))
      .forEach(b => {
        const d = document.createElement("div");
        d.className = "item";
        d.innerHTML = `
          <b>${b.id}</b><br>
          <small>${formatDateAU(b.date)} • Total ${fmt(b.mix)} L • Remaining ${fmt(b.remaining)} L</small>
          <div class="row gap end" style="margin-top:.35rem">
            <button class="pill" data-open>Open</button>
            <button class="pill" data-edit>Edit</button>
          </div>`;
        d.querySelector("[data-open]").onclick = () => B.showBatchPopup(DB, b);
        d.querySelector("[data-edit]").onclick = () => {
          const mix = Number(prompt("Total mix (L):", b.mix)) || b.mix;
          const rem = Number(prompt("Remaining (L):", b.remaining)) || b.remaining;
          const chems = prompt("Chemicals:", b.chemicals || "") || b.chemicals || "";
          b.mix = mix; b.remaining = rem; b.chemicals = chems; b.time ||= nowTime();
          opts.save && opts.save(DB);
          B.renderBatches(DB, opts);
          opts.populateBatchSelect && opts.populateBatchSelect(DB);
        };
        list.appendChild(d);
      });
  };

  B.showBatchPopup = (DB, b) => {
    const jobs = DB.tasks.filter(t => t.batch === b.id);
    const jobsHtml = jobs.length ? `<ul>${jobs.map(t=>`<li><a href="#" data-job="${t.id}">${t.name}</a></li>`).join("")}</ul>` : "—";
    const html = `
      <h3 style="margin-top:0">${b.id}</h3>
      <div><b>Date:</b> ${formatDateAU(b.date) || "–"} · <b>Time:</b> ${b.time || "–"}</div>
      <div><b>Total Mix Made:</b> ${fmt(b.mix)} L</div>
      <div><b>Total Mix Remaining:</b> ${fmt(b.remaining)} L</div>
      <div style="margin-top:.4rem;"><b>Chemicals:</b><br>${b.chemicals || "—"}</div>
      <div style="margin-top:.4rem;"><b>Linked Jobs:</b><br>${jobsHtml}</div>
      <div class="row gap end" style="margin-top:.8rem;">
        <button class="pill" data-close>Close</button>
      </div>`;
    const m = popup(html);
    m.querySelector("[data-close]").onclick = () => m.remove();
    m.querySelectorAll("[data-job]").forEach(a=>{
      a.onclick = (e) => {
        e.preventDefault();
        const t = DB.tasks.find(x => String(x.id) === a.dataset.job);
        window.WTApp && window.WTApp.showJobPopup(DB, t, true);
      };
    });
  };

  B.newBatch = (DB) => {
    const id = "B" + Date.now();
    const mix = Number(prompt("Total mix (L):", "600")) || 0;
    const chems = prompt("Chemicals (e.g. 'Crucial 1.5L/100L; SuperWet 300mL/100L')", "") || "";
    const obj = { id, date: todayISO(), time: nowTime(), mix, remaining: mix, used: 0, chemicals: chems };
    DB.batches.push(obj);
    toast("Batch created");
    return obj;
  };

  return B;
})();
