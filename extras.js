/* WeedTracker V60 Final Pilot — extras.js
   Handles UI layout, colors, and modal styling.
   Clean green/white theme — no purple/pink. */

document.addEventListener("DOMContentLoaded", () => {
  // Theme adjustments
  document.body.style.backgroundColor = "#f4f8f4";
  document.body.style.color = "#0a370a";
  const header = document.querySelector("header");
  if (header) {
    header.style.background = "linear-gradient(90deg,#0c7d2b,#17a543)";
    header.style.color = "white";
  }

  // Buttons
  document.querySelectorAll("button, .pill").forEach(btn => {
    btn.style.borderRadius = "12px";
    btn.style.border = "none";
    btn.style.padding = "8px 14px";
    btn.style.background = "#0c7d2b";
    btn.style.color = "white";
    btn.style.cursor = "pointer";
    btn.addEventListener("mouseover", () => btn.style.background = "#0a5f20");
    btn.addEventListener("mouseout",  () => btn.style.background = "#0c7d2b");
  });

  // Cards / boxes
  document.querySelectorAll(".item, .card").forEach(card => {
    card.style.background = "white";
    card.style.borderRadius = "
