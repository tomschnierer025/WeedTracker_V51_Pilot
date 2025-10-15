//// StartBatches
/* === batches.js — WeedTracker V57 Light Final === */

const Batches = {
  init(data) {
    this.data = data;
    this.list = document.getElementById("batchList");
    this.render();
    this.bind();
  },

  bind() {
    const btn = document.getElementById("newBatch");
    if (btn) {
      btn.onclick = () => this.create();
    }
  },

  create() {
    const id = "B" + Date.now();
    const chemicals = prompt("Enter chemicals (comma separated):");
    const mix = prompt("Enter total mix (L):");
    if (!chemicals || !mix) return;

    const obj = {
      id,
      chemicals,
      mix,
      remaining: mix,
      date: new Date().toISOString().split("T")[0],
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      linkedJobs: []
    };

    this.data.batches.push(obj);
    Storage.save(this.data);
    this.render();
  },

  render() {
    if (!this.list) return;
    this.list.innerHTML = "";

    this.data.batches.forEach(b => {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <b>${b.id}</b> • ${b.date} ${b.time} • ${b.mix}L
      `;
      div.onclick = () => this.popup(b);
      this.list.appendChild(div);
    });
  },

  popup(b) {
    const linked = (b.linkedJobs && b.linkedJobs.length)
      ? b.linkedJobs.map(j => `<li><a href="#" onclick="alert('Open job: ${j}')">${j}</a></li>`).join("")
      : "<li>No linked jobs</li>";

    const html = `
      <h3>${b.id}</h3>
      <p><b>Date:</b> ${b.date} ${b.time}<br>
      <b>Total Mix:</b> ${b.mix}L<br>
      <b>Remaining:</b> ${b.remaining}L<br>
      <b>Chemicals:</b> ${b.chemicals}</p>
      <p><b>Linked Jobs:</b></p>
      <ul>${linked}</ul>
      <div class="row gap end">
        <button class="pill" onclick="document.querySelector('.modal').remove()">Close</button>
      </div>
    `;

    Extras.popup(html);
  }
};

// === Hook ===
document.addEventListener("DOMContentLoaded", () => {
  if (window.data && data.batches) {
    Batches.init(data);
  }
});
//// EndBatches
