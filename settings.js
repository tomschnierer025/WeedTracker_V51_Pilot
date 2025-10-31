START settings.js
/* === WeedTracker V60 Pilot - settings.js === */
/* Settings, data management, and account preferences */

window.SettingsManager = (() => {
  const SM = {};
  let dataRef = {};
  let saveFn;

  SM.init = (data, saveFunction) => {
    dataRef = data;
    saveFn = saveFunction;

    // Buttons
    document.getElementById("saveAccount").onclick = SM.saveAccount;
    document.getElementById("exportBtn").onclick = () => WeedStorage.export(dataRef);
    document.getElementById("restoreBtn").onclick = () => WeedStorage.import(SM.refreshAfterRestore);
    document.getElementById("clearBtn").onclick = () => WeedStorage.clear();

    // Prefill if email exists
    const emailInput = document.getElementById("accountEmail");
    if (dataRef.accountEmail) emailInput.value = dataRef.accountEmail;
  };

  SM.saveAccount = () => {
    const email = document.getElementById("accountEmail").value.trim();
    dataRef.accountEmail = email;
    saveFn(dataRef);
    alert("✅ Email saved successfully.");
  };

  SM.refreshAfterRestore = () => {
    alert("Data restored successfully. Reloading...");
    location.reload();
  };

  return SM;
})();
END settings.js
