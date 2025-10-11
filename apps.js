// WeedTracker V51 Pilot - Main App Script

// Navigation between sections
function navigate(sectionId) {
  document.querySelectorAll("main section").forEach(sec => {
    sec.classList.remove("active");
  });

  const selected = document.getElementById(sectionId);
  if (selected) {
    selected.classList.add("active");
  }
}

// Example dynamic form for Create Task page
function loadJobForm() {
  const form = `
    <form id="taskForm">
      <label>Job Type:</label>
      <select id="jobType">
        <option>Inspection</option>
        <option>Spot Spray</option>
        <option>Roadside Spray</option>
      </select>

      <label>Location:</label>
      <input type="text" id="location" placeholder="Enter road name or area">

      <label>Start Time:</label>
      <input type="datetime-local" id="startTime">

      <label>Stop Time (optional):</label>
      <input type="datetime-local" id="stopTime">

      <label>Weed:</label>
      <select id="weedSelect">
        <option>-- Select Weed --</option>
        <option>African Lovegrass</option>
        <option>Cape Broom</option>
        <option>Fleabane</option>
      </select>

      <label>Batch Used:</label>
      <input type="text" id="batchUsed" placeholder="Enter batch ID">

      <button type="button" class="save-btn" onclick="saveTask()">💾 Save</button>
      <button type="button" class="save-btn" onclick="saveDraft()">📝 Save as Draft</button>
      <button type="button" class="save-btn" onclick="navigate('home')">🏠 Home</button>
    </form>
  `;
  document.getElementById("jobForm").innerHTML = form;
}

function saveTask() {
  alert("✅ Task saved successfully!");
}

function saveDraft() {
  alert("💾 Task saved as draft!");
}

// When page loads, show default section and form
window.onload = () => {
  navigate("home");
  loadJobForm();
};
