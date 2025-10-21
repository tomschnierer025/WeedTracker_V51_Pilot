/* WeedTracker V61 Final Pilot — batches.js
   One-page batch creation, live totals, stock validation,
   dump with reason, list + open/edit, ring indicator, summary card.
*/
(function(){
  const $  = (s, r=document)=> r.querySelector(s);
  const $$ = (s, r=document)=> [...r.querySelectorAll(s)];

  const TYPE_UNITS = ["L","mL","g","kg"];

  let DB = DBStore.ensureDB();

  function todayISO(){ return new Date().toISOString().split("T")[0]; }
  function nowTime(){ return new Date().toTimeString().slice(0,5); }

  // ---------- Helpers ----------
  function genBatchId(){
    const d = new Date();
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const yy = String(d.getFullYear()).slice(-2);
    return `B${dd}${mm}${yy}${String(Math.floor(Math.random()*900)+100)}`;
  }
  function chemOptionsHTML(){
    const names = DB.chems.map(c=>c.name).sort((a,b)=>a.localeCompare(b));
    return names.map(n=>`<option>${n}</option>`).join("");
  }
  function unitOptsHTML(){
    return TYPE_UNITS.map(u=>`<option>${u}</option>`).join("");
  }
  function calcTotalUsed(totalMixL, ratePer100, unit){
    if (!totalMixL || !ratePer100) return 0;
    const base = (Number(totalMixL)/100) * Number(ratePer100);
    // base is in "unit" given by user
    return base; // just show with unit chosen
  }
  function fmt(n, d=2){
    if (n==null || isNaN(n)) return "0";
    const nn = Number(n);
    return (Math.abs(nn) >= 1 ? nn.toFixed(d) : nn.toFixed(3));
  }

  // ---------- UI wiring ----------
  const batId = $("#batId");
  const batDate = $("#batDate");
  const batTime = $("#batTime");
  const batCouncil = $("#batCouncil");
  const batTotalMix = $("#batTotalMix");
  const chemRows = $("#chemRows");
  const addChemRowBtn = $("#addChemRow");
  const totMix = $("#totMix");
  const totUsed = $("#totUsed");
  const totRemain = $("#totRemain");
  const ring = $("#ring");
  const warn = $("#batWarn");
  const createBtn = $("#createBatch");
  const deleteDraftBtn = $("#deleteBatchDraft");
  const dumpBtn = $("#dumpBatch");

  // init
  function resetCreateForm(){
    batId.value = genBatchId();
    batDate.value = todayISO();
    batTime.value = nowTime();
    batCouncil.value = "";
    batTotalMix.value = 600;
    chemRows.innerHTML = "";
    addChemRow(); // one row by default
    updateTotals();
    hideWarn();
    ring.textContent = "●";
    ring.style.color = "#0c7d2b";
  }
  resetCreateForm();

  function addChemRow(){
    const row = document.createElement("div");
    row.className = "chem-row";
    row.innerHTML = `
      <select class="chem-name">${chemOptionsHTML()}</select>
      <input class="chem-rate" inputmode="decimal" placeholder="Rate /100L" />
      <select class="chem-unit">${unitOptsHTML()}</select>
      <div class="calc"><span class="calc-val">0</span> <span class="calc-unit">L</span></div>
      <div class="row gap">
        <button class="pill" data-del-row>❌</button>
      </div>
    `;
    chemRows.appendChild(row);
    row.querySelector(".chem-unit").addEventListener("change", ()=> {
      row.querySelector(".calc-unit").textContent = row.querySelector(".chem-unit").value;
      updateTotals();
    });
    row.querySelector(".chem-rate").addEventListener("input", updateTotals);
    row.querySelector(".chem-name").addEventListener("change", updateTotals);
  }

  function updateTotals(){
    const totalMixL = Number(batTotalMix.value)||0;
    totMix.textContent = fmt(totalMixL,0);

    let usedSummary = [];
    let remaining = totalMixL; // display only; "remaining mix" just mirrors total - used volume display
    // In spray context, "remaining" refers to liquid in tank. We show as number; ring color logic below.

    // per-chemical calc
    $$(".chem-row", chemRows).forEach(r=>{
      const rate = Number(r.querySelector(".chem-rate").value)||0;
      const unit = r.querySelector(".chem-unit").value;
      const total = calcTotalUsed(totalMixL, rate, unit);
      r.querySelector(".calc-val").textContent = fmt(total);
      r.querySelector(".calc-unit").textContent = unit;

      const name = r.querySelector(".chem-name").value;
      usedSummary.push({name, total, unit});
    });

    // Build “total used (by list)”
    if (usedSummary.length){
      totUsed.textContent = usedSummary.map(u=>`${u.name}: ${fmt(u.total)} ${u.unit}`).join("  •  ");
    } else {
      totUsed.textContent = "0";
    }

    // Remaining display (always show even 0)
    totRemain.textContent = fmt(remaining,0);

    // ring color: red if remaining == 0 (when user sets remaining to 0 after dump/usage)
    ring.style.color = (Number(totRemain.textContent) <= 0 ? "#b53a2f" : "#0c7d2b");
  }

  function showWarn(msg){
    warn.textContent = msg;
    warn.hidden = false;
  }
  function hideWarn(){
    warn.hidden = true;
  }

  addChemRowBtn.addEventListener("click", ()=>{
    addChemRow();
    // auto-scroll down to totals
    setTimeout(()=> totRemain.scrollIntoView({behavior:"smooth", block:"center"}), 50);
  });

  chemRows.addEventListener("click", (e)=>{
    const del = e.target.closest("[data-del-row]");
    if (del){
      const row = del.closest(".chem-row");
      if (row) row.remove();
      updateTotals();
    }
  });

  batTotalMix.addEventListener("input", updateTotals);

  // ---------- Persistence ----------
  function save(){
    DBStore.saveDB(DB);
  }

  // Stock check for one batch
  function checkStockOk(totalMixL, lines){
    for (const ln of lines){
      const chem = DB.chems.find(c=>c.name===ln.name);
      if (!chem) return {ok:false, msg:`Chemical not in inventory: ${ln.name}`};
      // Compute total used in base unit of the container just for availability check
      // For stock we approximate: if unit is mL convert to L; kg/g assumed separate bucket
      let need = ln.total;
      if (ln.unit === "mL") need = need/1000;
      if (ln.unit === "kg") need = need*1000; // compare in grams if container is g
      // Compare against total available in same family:
      const totalAvailable =
        chem.containerUnit==="L" ? (chem.containers*chem.containerSize)
      : chem.containerUnit==="mL" ? (chem.containers*chem.containerSize)
      : chem.containerUnit==="g" ? (chem.containers*chem.containerSize)
      : chem.containerUnit==="kg" ? (chem.containers*chem.containerSize)
      : 0;

      // Normalize both to the same unit family
      function toCommon(v,u){
        if (u==="L") return {fam:"volL", vL:v};
        if (u==="mL") return {fam:"volL", vL: v/1000};
        if (u==="kg") return {fam:"massG", vG: v*1000};
        if (u==="g") return {fam:"massG", vG: v};
        return {fam:"other", v};
      }
      const needN = toCommon(ln.total, ln.unit);
      const invN  = toCommon(totalAvailable, chem.containerUnit);

      if (needN.fam !== invN.fam) {
        // If units don't match family, allow but skip strict block; just warn
        console.warn("Unit family mismatch for check:", ln.name);
        continue;
      }
      if (needN.fam === "volL" && needN.vL > invN.vL) {
        return {ok:false, msg:`Not enough stock: ${ln.name}`};
      }
      if (needN.fam === "massG" && needN.vG > invN.vG) {
        return {ok:false, msg:`Not enough stock: ${ln.name}`};
      }
    }
    return {ok:true};
  }

  function deductStock(lines){
    for (const ln of lines){
      const chem = DB.chems.find(c=>c.name===ln.name);
      if (!chem) continue;
      // convert ln.total in match family to decrement by container units
      function toCommon(v,u){
        if (u==="L") return {fam:"volL", vL:v};
        if (u==="mL") return {fam:"volL", vL: v/1000};
        if (u==="kg") return {fam:"massG", vG: v*1000};
        if (u==="g") return {fam:"massG", vG: v};
        return {fam:"other", v};
      }
      const need = toCommon(ln.total, ln.unit);
      // available in same family
      function fromCommonSubtract(chem,need){
        // reduce total volume/weight across containers evenly (simple)
        let total = chem.containers*chem.containerSize;
        if (chem.containerUnit==="mL") total = total/1000; // to L
        if (chem.containerUnit==="kg") total = total*1000; // to g
        // subtract
        if (need.fam==="volL"){
          total -= need.vL;
          if (chem.containerUnit==="mL") total = total*1000;
          if (chem.containerUnit==="kg") {/*noop*/}
        } else if (need.fam==="massG"){
          if (chem.containerUnit==="kg") total = total/1000; // to kg then back below
          total -= need.vG;
          if (chem.containerUnit==="kg") total = total/1000;
        }
        // Re-split into containers (approx): keep containerSize, adjust count
        const newTotal = Math.max(0,total);
        const per = chem.containerSize;
        let newContainers = Math.floor(newTotal / per);
        if ((newTotal % per) > 0) newContainers += 0; // leave fractional remainder implicit
        chem.containers = Math.max(0,newContainers);
      }
      fromCommonSubtract(chem,need);
    }
  }

  // Create batch
  createBtn.addEventListener("click", ()=>{
    const id = batId.value.trim();
    const date = batDate.value || todayISO();
    const time = batTime.value || nowTime();
    const council = batCouncil.value.trim();
    const totalMixL = Number(batTotalMix.value)||0;

    const lines = $$(".chem-row", chemRows).map(r=>{
      const name = r.querySelector(".chem-name").value;
      const rate = Number(r.querySelector(".chem-rate").value)||0;
      const unit = r.querySelector(".chem-unit").value;
      const total = calcTotalUsed(totalMixL, rate, unit);
      return {name, ratePer100: rate, unit, total};
    });

    if (!id || !totalMixL) { showWarn("Provide Batch ID and Total Mix (L)."); return; }
    if (!lines.length) { showWarn("Add at least one chemical line."); return; }

    // validate inventory
    const check = checkStockOk(totalMixL, lines);
    if (!check.ok){ showWarn(check.msg); return; }
    hideWarn();

    _WTOverlay.show("Creating Batch…");
    setTimeout(()=>{
      // save
      DB.batches.push({
        id, date, time, council,
        mix: totalMixL, remaining: totalMixL, used: 0,
        chemicals: lines,
        dumpLog: [],
        lastEdited: new Date().toISOString()
      });
      deductStock(lines);
      DBStore.saveDB(DB);

      _WTOverlay.hide();
      _WTSummary(`Batch ${id} Created`, [
        `${lines.length} chemical(s)`,
        `${totalMixL} L total mix`
      ]);

      // refresh list + reset form
      renderBatches();
      resetCreateForm();
    }, 500);
  });

  deleteDraftBtn.addEventListener("click", ()=>{
    // just clear form
    resetCreateForm();
    _WTToast("Draft cleared");
  });

  dumpBtn.addEventListener("click", ()=>{
    const id = prompt("Batch ID to dump (exact):", $("#batId").value);
    if (!id) return;
    const b = DB.batches.find(x=>x.id===id);
    if (!b){ _WTToast("Batch not found"); return; }
    const amt = Number(prompt("Amount to dump (L):","0"))||0;
    if (amt<=0){ _WTToast("Nothing dumped"); return; }
    const reason = prompt("Reason for dump:","")||"";
    b.dumpLog = b.dumpLog || [];
    b.dumpLog.push({ts:new Date().toISOString(), amount:amt, reason});
    b.remaining = Math.max(0, (b.remaining||0) - amt);
    b.lastEdited = new Date().toISOString();
    DBStore.saveDB(DB);
    renderBatches();
    _WTSummary(`Dumped ${amt} L`, [reason || ""]);
  });

  // ---------- List / Open ----------
  const list = document.getElementById("batchList");

  function renderBatches(){
    if (!list) return;
    list.innerHTML = "";
    const from = $("#batFrom").value||"";
    const to   = $("#batTo").value||"";
    DB.batches
      .filter(b=>(!from||b.date>=from)&&(!to||b.date<=to))
      .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
      .forEach(b=>{
        const d = document.createElement("div");
        d.className = "item";
        d.innerHTML = `
          <b>${b.id}</b><br>
          <small>${DBStore.fmtAU(b.date)} · Total ${b.mix||0} L · Remaining ${b.remaining||0} L</small>
          <div class="row end">
            <button class="pill" data-open="${b.id}">Open</button>
          </div>
        `;
        d.querySelector("[data-open]")?.addEventListener("click", ()=> openBatch(b));
        list.appendChild(d);
      });
  }
  renderBatches();

  $("#batSearchBtn")?.addEventListener("click", renderBatches);
  $("#batResetBtn")?.addEventListener("click", ()=>{
    $("#batFrom").value=""; $("#batTo").value="";
    renderBatches();
  });

  function openBatch(b){
    const jobs = DB.tasks.filter(t=>t.batch===b.id);
    const jobsHtml = jobs.length ? jobs.map(t=>`<li><a href="#" data-open-job="${t.id}">${t.name}</a></li>`).join("") : "<li>—</li>";
    const chemsHtml = (b.chemicals||[]).map(c=>`
      <div class="row" style="justify-content:space-between">
        <div><b>${c.name}</b> • ${c.ratePer100}/100L</div>
        <div>${fmt(c.total)} ${c.unit}</div>
      </div>
    `).join("");

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="card p" style="position:fixed;left:12px;right:12px;top:14%;z-index:1300">
        <div class="row" style="justify-content:space-between;align-items:center">
          <h3 style="margin:0">${b.id}</h3>
          <button class="pill warn" data-close-modal>❌ Close</button>
        </div>
        <div class="grid two" style="margin-top:.5rem">
          <div><b>Date:</b> ${DBStore.fmtAU(b.date)} · <b>Time:</b> ${b.time||"–"}</div>
          <div><b>Council Job #:</b> ${b.council||"—"}</div>
        </div>
        <div class="grid three" style="margin-top:.5rem">
          <div><b>Total Mix:</b> ${b.mix||0} L</div>
          <div><b>Remaining:</b> ${b.remaining||0} L</div>
          <div><b>Status:</b> ${Number(b.remaining||0)<=0 ? "🔴 Empty" : "🟢 In Use"}</div>
        </div>

        <h4 style="margin-top:.8rem">Chemicals</h4>
        <div class="card p">
          ${chemsHtml || "—"}
        </div>

        <h4 style="margin-top:.8rem">Linked Jobs</h4>
        <ul style="margin:.2rem 0 .6rem 1rem">${jobsHtml}</ul>

        <div class="row gap end">
          <button class="pill" data-edit-batch>Edit</button>
          <button class="pill warn" data-del-batch>Delete</button>
        </div>
        <div class="muted" style="margin-top:.4rem">Last edited: ${b.lastEdited ? DBStore.fmtAU(b.lastEdited) : "—"}</div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click",(e)=>{
      if (e.target.dataset.closeModal!=null) modal.remove();
      const a = e.target.closest("[data-open-job]");
      if (a){
        const t = DB.tasks.find(x=> String(x.id)===a.dataset.openJob);
        if (!t) return;
        modal.remove();
        if (window.showJobPopup) window.showJobPopup(t);
      }
      if (e.target?.dataset?.editBatch!=null){
        modal.remove();
        // Load values into create area for quick edit
        $("#batId").value = b.id;
        $("#batDate").value = b.date || todayISO();
        $("#batTime").value = b.time || nowTime();
        $("#batCouncil").value = b.council||"";
        $("#batTotalMix").value = b.mix||0;
        chemRows.innerHTML = "";
        (b.chemicals||[]).forEach(c=>{
          addChemRow();
          const last = chemRows.lastElementChild;
          last.querySelector(".chem-name").value = c.name;
          last.querySelector(".chem-rate").value = c.ratePer100;
          last.querySelector(".chem-unit").value = c.unit;
          last.querySelector(".calc-unit").textContent = c.unit;
        });
        updateTotals();
        document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
        document.getElementById("batches").classList.add("active");
        _WTToast("Batch loaded for editing");
      }
      if (e.target?.dataset?.delBatch!=null){
        if (!confirm("Delete this batch?")) return;
        DB.batches = DB.batches.filter(x=>x!==b);
        DBStore.saveDB(DB);
        modal.remove();
        renderBatches();
        _WTToast("Batch deleted");
      }
    });
  }
})();
