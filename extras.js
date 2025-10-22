// ---------- WeedTracker V63 - extras.js ---------- //
// Popup management, notifications, and shared helpers

// ---------- POPUP ----------
function showPopup(title, content, allowClose = true) {
  const existing = document.getElementById("popup");
  if (existing) existing.remove();

  const popup = document.createElement("div");
  popup.classList.add("popup");
  popup.id = "popup";

  const heading = document.createElement("h3");
  heading.textContent = title;
  popup.appendChild(heading);

  const body = document.createElement("div");
  body.innerHTML = content;
  popup.appendChild(body);

  if (allowClose) {
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✖ Close";
    closeBtn.classList.add("close");
    closeBtn.onclick = () => popup.remove();
    popup.appendChild(closeBtn);
  }

  document.body.appendChild(popup);
}

// ---------- SPINNER ----------
function showSpinner(msg = "Saving…") {
  let spinner = document.getElementById("spinner");
  if (!spinner) {
    spinner = document.createElement("div");
    spinner.id = "spinner";
    document.body.appendChild(spinner);
  }
  spinner.textContent = msg;
  spinner.style.display = "block";

  setTimeout(() => {
    spinner.style.display = "none";
  }, 1800);
}

// ---------- TOAST (BOTTOM FLASH) ----------
function flashMessage(message, color = "#4caf50") {
  const msgBox = document.createElement("div");
  msgBox.textContent = message;
  msgBox.style.position = "fixed";
  msgBox.style.bottom = "25px";
  msgBox.style.left = "50%";
  msgBox.style.transform = "translateX(-50%)";
  msgBox.style.background = color;
  msgBox.style.color = "#fff";
  msgBox.style.padding = "10px 18px";
  msgBox.style.borderRadius = "8px";
  msgBox.style.fontWeight = "600";
  msgBox.style.zIndex = "99999";
  msgBox.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
  document.body.appendChild(msgBox);

  setTimeout(() => msgBox.remove(), 2000);
}

// ---------- BATCH SUMMARY CARD ----------
function showBatchSummary(batch) {
  const content = `
    <strong>Batch Created:</strong> ${batch.id}<br>
    <strong>Date:</strong> ${batch.date}<br>
    <strong>Total Mix:</strong> ${batch.totalMix} L<br>
    <strong>Chemicals:</strong> ${batch.chemicals.map(c => `${c.name} (${c.amount}${c.unit})`).join(", ")}<br>
    <strong>Remaining:</strong> ${batch.remainingMix ?? batch.totalMix} L
  `;
  flashMessage(`✅ Batch Saved: ${batch.id}`, "#2ecc71");
  console.log("Batch summary:", content);
}

// ---------- GENERAL HELPERS ----------
function generateID(prefix = "ID") {
  return `${prefix}-${Math.floor(Math.random() * 99999)}-${Date.now()}`;
}

function formatDateTime() {
  const now = new Date();
  const d = now.toISOString().slice(0, 10);
  const t = now.toTimeString().slice(0, 5);
  return `${d}T${t}`;
}

function openPage(pageID) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(pageID).classList.add("active");
}

function clearData() {
  clearAllData();
}
