//// StartExtras
/* === extras.js — WeedTracker V57 Light Final === */

// Utility helpers for WeedTracker

const Extras = {
  // Format date/time nicely
  fmtDate(d) {
    const dt = new Date(d);
    return dt.toLocaleDateString() + " " + dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  },

  // Load NSW weed list with Noxious weeds pinned to top
  loadWeeds() {
    const select = document.getElementById("weedSelect");
    if (!select) return;
    select.innerHTML = "";
    const noxious = [
      "African Lovegrass",
      "Bathurst Burr",
      "Blackberry",
      "St John's Wort",
      "Chilean Needle Grass",
      "Coolatai Grass",
      "Serrated Tussock",
      "Fireweed",
      "Sweet Briar",
      "Blue Heliotrope",
      "Cape Broom"
    ];
    const common = [
      "Patterson's Curse",
      "Thistle",
      "Wild Turnip",
      "Wild Oats",
      "Dandelion",
      "Dock",
      "Fleabane",
      "Clover",
      "Burr Medic",
      "Barley Grass",
      "Brome Grass",
      "Onion Weed",
      "Mustard Weed",
      "Flatweed",
      "Marshmallow",
      "Cudweed",
      "Catsear",
      "Melilot",
      "Milk Thistle"
    ];

    const sorted = [
      ...noxious.map(w => ({ name: w, type: "Noxious" })),
      ...common.map(w => ({ name: w, type: "Common" }))
    ];

    for (const w of sorted) {
      const opt = document.createElement("option");
      opt.textContent = (w.type === "Noxious" ? "⚠ " : "") + w.name;
      opt.value = w.name;
      select.appendChild(opt);
    }
  },

  // Default chemicals pre-loaded into inventory
  preloadChems(data) {
    if (!data.chems || data.chems.length === 0) {
      data.chems = [
        { name: "Crucial", qty: "20L", active: "Glyphosate" },
        { name: "BowSaw", qty: "5L", active: "Triclopyr + Picloram" },
        { name: "Grazon", qty: "10L", active: "Triclopyr + Picloram" },
        { name: "Hastings", qty: "5L", active: "MCPA" },
        { name: "Outright", qty: "5L", active: "Dicamba" },
        { name: "ProSoil", qty: "2kg", active: "Oxyfluorfen" },
        { name: "SuperWet", qty: "5L", active: "Alkyl Phenol Ethoxylate" },
        { name: "Sword 750WG", qty: "2kg", active: "Metsulfuron-Methyl" }
      ];
    }
  },

  // Display a popup with custom content
  popup(content) {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="card">
        ${content}
        <div style="text-align:center;margin-top:0.8rem;">
          <button class="pill" onclick="this.closest('.modal').remove()">Close</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  },

  // Quick alert popup for errors/info
  alert(msg) {
    this.popup(`<p>${msg}</p>`);
  },

  // Get filtered tasks
  filterTasks(data, query) {
    return data.tasks.filter(t =>
      (!query || t.name.toLowerCase().includes(query.toLowerCase())) &&
      (!query || t.weed.toLowerCase().includes(query.toLowerCase()))
    );
  }
};

document.addEventListener("DOMContentLoaded", () => {
  Extras.loadWeeds();
});
//// EndExtras
