// ===============================
// WeedTracker V60 Pilot Final
// SETTINGS.JS
// ===============================

function openSettings() {
  switchScreen("settingsScreen");
  renderSettings();
}

function renderSettings() {
  const s = getSettings();
  $("settingsHost").innerHTML = `
    <div class="card soft">
      <h3>Settings ⚙️</h3>
      <label><input type="checkbox" id="darkMode" ${s.darkMode ? "checked" : ""}> Dark Mode</label>
      <label><input type="checkbox" id="remindersOn" ${s.notifyReminders ? "checked" : ""}> Reminders On</label>
      <div class="row gap" style="margin-top:1rem;">
        <button class="btn primary" onclick="saveSettings()">Save</button>
        <button class="btn danger" onclick="clearAll()">Clear Data</button>
        <button class="btn secondary" onclick="exportAll()">Export Data</button>
      </div>
    </div>
    <div class="card soft">
      <h4>About WeedTracker V60 Pilot</h4>
      <p>Developed for field operations — tracks weeds, batches, and spray records with GPS and reminders.</p>
    </div>
  `;
}

function saveSettings() {
  const s = {
    darkMode: $("darkMode").checked,
    notifyReminders: $("remindersOn").checked
  };
  setSettings(s);
  applyTheme();
  toast("Settings saved ✅");
}

function applyTheme() {
  const s = getSettings();
  document.body.classList.toggle("dark", s.darkMode);
}
