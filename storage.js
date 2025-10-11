// WeedTracker V51 Pilot - Data Storage System

// Save a record to local storage
function saveRecord(type, data) {
  let records = JSON.parse(localStorage.getItem(type)) || [];
  records.push(data);
  localStorage.setItem(type, JSON.stringify(records));
}

// Load all records of a given type
function loadRecords(type) {
  return JSON.parse(localStorage.getItem(type)) || [];
}

// Clear all records (used for resets)
function clearRecords(type) {
  localStorage.removeItem(type);
}

// Example save call (used from apps.js)
function saveTask() {
  const job = {
    jobType: document.getElementById("jobType").value,
    location: document.getElementById("location").value,
    startTime: document.getElementById("startTime").value,
    stopTime: document.getElementById("stopTime").value,
    weed: document.getElementById("weedSelect").value,
    batchUsed: document.getElementById("batchUsed").value,
    date: new Date().toLocaleString(),
  };

  saveRecord("jobs", job);
  alert("✅ Job saved successfully!");
}

// Load saved jobs into Records page
function displayRecords() {
  const records = loadRecords("jobs");
  const container = document.getElementById("recordList");
  if (!container) return;

  container.innerHTML = "";
  if (records.length === 0) {
    container.innerHTML = "<p>No records found.</p>";
  } else {
    records.forEach((rec, index) => {
      const div = document.createElement("div");
      div.className = "record-entry";
      div.innerHTML = `
        <p><strong>${rec.jobType}</strong> - ${rec.location}</p>
        <p>${rec.weed} | Batch: ${rec.batchUsed}</p>
        <p>${rec.date}</p>
      `;
      container.appendChild(div);
    });
  }
}

// Run automatically on Records page load
if (window.location.href.includes("records")) {
  displayRecords();
}
