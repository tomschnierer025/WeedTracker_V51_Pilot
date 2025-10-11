// WeedTracker V51 Pilot – Utility & Extras

// --- Reminder System ---
function addReminder(task, date) {
  let reminders = JSON.parse(localStorage.getItem("reminders")) || [];
  reminders.push({ task, date, done: false });
  localStorage.setItem("reminders", JSON.stringify(reminders));
  alert("⏰ Reminder set for " + date);
}

function showReminders() {
  const list = JSON.parse(localStorage.getItem("reminders")) || [];
  const container = document.getElementById("reminderList");
  if (!container) return;
  container.innerHTML = "";
  if (list.length === 0) {
    container.innerHTML = "<p>No reminders yet.</p>";
  } else {
    list.forEach((r, i) => {
      const div = document.createElement("div");
      div.className = "reminder-entry";
      div.innerHTML = `
        <p><strong>${r.task}</strong><br>
        📅 ${r.date}</p>
      `;
      container.appendChild(div);
    });
  }
}

// --- Weather Data Capture ---
function getWeatherData() {
  if (!navigator.geolocation) {
    alert("⚠️ Location not supported on this device.");
    return;
  }
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      const w = data.current_weather;
      alert(`🌤 Weather:
Temp: ${w.temperature}°C 
Wind: ${w.windspeed} km/h`);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch weather data.");
    }
  });
}

// --- Utilities ---
function clearAllData() {
  if (confirm("⚠️ Delete ALL saved data and reminders?")) {
    localStorage.clear();
    alert("🧹 All data cleared.");
  }
}

// Run reminder load automatically
window.addEventListener("load", () => {
  showReminders();
});
