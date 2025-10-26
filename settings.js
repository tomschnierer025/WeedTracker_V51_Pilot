/* =========================================================
   WeedTracker V60 Pilot — settings.js
   Handles: Clear Data, Export, Theme toggle
   ========================================================= */

(function () {
  const spin = (s,t) => WTStorage.showSpinner(s,t);
  const toast = (m) => WTStorage.showToast(m);

  // ---------- Clear Data ----------
  async function clearAllData() {
    if (!confirm("⚠️ This will delete ALL records, batches, and settings.\nContinue?")) return;
    spin(true,"Clearing data…");
    localStorage.clear();
    setTimeout(()=>{
      spin(false);
      toast("🧹 All data cleared");
      setTimeout(()=>location.reload(),800);
    },600);
  }

  // ---------- Export ----------
  function exportAll() {
    spin(true,"Exporting data…");
    const dump = {
      records: WTStorage.loadData("records", []),
      batches: WTStorage.loadData("batches", []),
      chemicals: WTStorage.loadData("chemicals", []),
      created: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(dump,null,2)],{type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `WeedTrackerExport_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    spin(false);
    toast("📦 Export complete");
  }

  // ---------- Theme Toggle ----------
  function toggleTheme() {
    const root = document.documentElement;
    const current = root.dataset.theme || "dark";
    const next = current==="dark" ? "light" : "dark";
    root.dataset.theme = next;
    toast(`🎨 Theme: ${next}`);
  }

  // ---------- Init ----------
  function initSettings() {
    const btnClear = document.getElementById("clearDataBtn");
    const btnExport = document.getElementById("exportDataBtn");
    const btnTheme = document.getElementById("toggleThemeBtn");
    if (btnClear)  btnClear.onclick  = clearAllData;
    if (btnExport) btnExport.onclick = exportAll;
    if (btnTheme)  btnTheme.onclick  = toggleTheme;
  }

  window.addEventListener("DOMContentLoaded", initSettings);

  window.WTSettings = { clearAllData, exportAll, toggleTheme };
})();
