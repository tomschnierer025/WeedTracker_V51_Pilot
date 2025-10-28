/* === WeedTracker V60 Pilot — settings.js ===
   Settings / Data management panel:
   - Save email for backup
   - Export / Restore data
   - Clear all data confirmation
   - Syncs with WeedStorage.js
*/

(function () {
  const $ = (s, r=document)=>r.querySelector(s);

  function bindSettings(){
    const emailEl = $("#accountEmail");
    const saveBtn = $("#saveAccount");
    const exportBtn = $("#exportBtn");
    const restoreBtn = $("#restoreBtn");
    const clearBtn = $("#clearBtn");

    // --- Load saved email ---
    const DB = window.WeedStorage.load();
    if (emailEl && DB.accountEmail) emailEl.value = DB.accountEmail;

    // --- Save email ---
    saveBtn?.addEventListener("click", ()=>{
      const val = (emailEl?.value||"").trim();
      const db = window.WeedStorage.load();
      db.accountEmail = val;
      window.WeedStorage.save(db);
      alert("Email saved: " + val);
    });

    // --- Export ---
    exportBtn?.addEventListener("click", ()=>{
      const data = window.WeedStorage.load();
      window.WeedStorage.export(data);
    });

    // --- Restore ---
    restoreBtn?.addEventListener("click", ()=>{
      window.WeedStorage.import((json)=>{
        alert("Data imported successfully. Reloading…");
        setTimeout(()=>location.reload(),800);
      });
    });

    // --- Clear ---
    clearBtn?.addEventListener("click", ()=>{
      if (confirm("Are you sure you want to clear ALL WeedTracker data? This cannot be undone.")){
        window.WeedStorage.clear();
      }
    });
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bindSettings);
  } else bindSettings();
})();
