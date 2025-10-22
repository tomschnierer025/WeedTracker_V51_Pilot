/* ===== WeedTrackerV60Pilot — batches.js =====
   Utilities for batch creation rows & summary
*/
(function(){
  function chemRowTemplate(idx, names){
    const options = names.map(n=>`<option value="${n}">${n}</option>`).join("");
    return `
      <div class="chem-row" data-idx="${idx}" style="display:grid;grid-template-columns:1.4fr .9fr .9fr .9fr auto;gap:.5rem;margin:.45rem 0">
        <div class="field">
          <label>Chemical</label>
          <select class="br_name">
            <option value="">— Select —</option>
            ${options}
          </select>
        </div>
        <div class="field">
          <label>Rate /100L</label>
          <input class="br_rate" inputmode="decimal" placeholder="e.g. 2"/>
        </div>
        <div class="field">
          <label>Unit</label>
          <select class="br_unit">
            <option>L</option>
            <option>mL</option>
            <option>g</option>
            <option>kg</option>
          </select>
        </div>
        <div class="field">
          <label>Calculated Amount</label>
          <input class="br_calc" readonly/>
        </div>
        <div class="row center">
          <button class="pill warn br_del">✖</button>
        </div>
      </div>`;
  }

  window.BF_buildRow = function(container, idx, chemicalNames){
    const temp = document.createElement("div");
    temp.innerHTML = chemRowTemplate(idx, chemicalNames);
    const row = temp.firstElementChild;
    container.appendChild(row);
    return row;
  };

  window.BF_recalc = function(container, totalL){
    let summary = [];
    [...container.querySelectorAll(".chem-row")].forEach(row=>{
      const name = row.querySelector(".br_name").value.trim();
      const rate = Number(row.querySelector(".br_rate").value)||0;
      const unit = row.querySelector(".br_unit").value || "L";
      const calc = (rate/100) * (Number(totalL)||0);
      row.querySelector(".br_calc").value = calc ? `${calc.toFixed(2)} ${unit}` : "";
      if (name && calc) summary.push({name, calc, unit});
    });
    return summary;
  };
})();
