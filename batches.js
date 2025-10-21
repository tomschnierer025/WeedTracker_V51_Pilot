/* WeedTracker V60 Final Pilot — batches.js
   Handles creation, editing, linking, and viewing batches.
   Includes popups, job linking, totals, and timestamps. */

document.addEventListener("DOMContentLoaded", () => {
  const batchesContainer = document.getElementById("batchesContainer");
  const batchPopup = document.getElementById("batchPopup");
  const closePopupBtn = document.getElementById("closeBatchPopup");
  const popupContent = document.getElementById("batchPopupContent");

  let batches = JSON.parse(localStorage.getItem("batches")) || [];

  // Render all batches
  function renderBatches() {
    batchesContainer.innerHTML = "";
    batches.forEach(batch => {
      const card = document.createElement("div");
      card.className = "batchCard";
      card.innerHTML = `
        <h3>${batch.name}</h3>
        <p><strong>Batch ID:</strong> ${batch.id}</p>
        <p><strong>Date:</strong> ${batch.date}</p>
        <p><strong>Total Made:</strong> ${batch.totalMade} L</p>
        <p><strong>Total Remaining:</strong> ${batch.totalRemaining
