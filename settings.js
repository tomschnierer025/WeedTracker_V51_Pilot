/* === WeedTracker V60 Pilot — settings.js === */
window.WTSettings = (() => {
  const S = {};
  const $ = (s, r=document) => r.querySelector(s);
  const { exportJSON, restoreLatest, clearAll, importJSON } = window.WTStorage;
  const { toast } = window.WTExtras;

  S.bind = (DB, saveDB, rerenderAll) => {
    const email = $("#accountEmail");
    if (email) email.value = DB.accountEmail || "";

    $("#saveAccount")?.addEventListener("click", () => {
      DB.accountEmail = (email?.value || "").trim();
      saveDB(DB);
      toast("Saved");
    });

    $("#exportBtn")?.addEventListener("click", () => exportJSON(DB));
    $("#restoreBtn")?.addEventListener("click", () => {
      const r = restoreLatest();
      if (r) {
        Object.assign(DB, r);
        saveDB(DB, false);
        rerenderAll && rerenderAll();
        toast("Restored from latest backup");
      } else toast("No backup found");
    });

    $("#clearBtn")?.addEventListener("click", clearAll);
  };

  return S;
})();
