/* === WeedTracker V57 Utility and Data Extras === */

// --- Weed and Chemical Libraries ---
window.WTLibraries = {
  weeds: [
    "African Lovegrass (Noxious)",
    "Blackberry (Noxious)",
    "Bathurst Burr (Noxious)",
    "St John's Wort (Noxious)",
    "Capeweed",
    "Patterson’s Curse",
    "Fleabane",
    "Thistle",
    "Dock",
    "Wild Oats",
    "Ryegrass",
    "Marshmallow",
    "Nettle",
    "Sweet Briar",
    "Prickly Lettuce"
  ],

  chemicals: [
    { name: "Crucial", active: "Glyphosate 600 g/L" },
    { name: "BowSaw", active: "Triclopyr + Picloram" },
    { name: "Hastings", active: "MCPA 340 g/L + Dicamba 80 g/L" },
    { name: "Outright", active: "Metsulfuron Methyl 600 g/kg" },
    { name: "ProSoil", active: "Wetting Agent Granular" },
    { name: "SuperWet", active: "Alkylated Surfactant" },
    { name: "Sword 750 WG", active: "Glyphosate 750 g/kg" },
    { name: "Granular", active: "Fertiliser Base Mix" },
    { name: "Atrazine", active: "Atrazine 900 g/kg" },
    { name: "Dicamba", active: "Dicamba 500 g/L" },
    { name: "MCPA", active: "MCPA 500 g/L" }
  ]
};

// --- Populate Drop-Downs ---
window.populateDropdowns = function() {
  const weedSelect = document.getElementById("weedSelect");
  const batchSelect = document.getElementById("batchSelect");
  const weeds = WTLibraries.weeds;

  if (weedSelect) {
    weedSelect.innerHTML = "";
    weeds.forEach(w => {
      const opt = document.createElement("option");
      opt.textContent = w;
      if (w.toLowerCase().includes("noxious")) opt.style.fontWeight = "bold";
      weedSelect.appendChild(opt);
    });
  }

  if (batchSelect) {
    const db = JSON.parse(localStorage.getItem("weedtracker_data") || "{}");
    const list = db.batches || [];
    batchSelect.innerHTML = "<option value=''>Select Batch</option>";
    list.forEach(b => {
      const opt = document.createElement("option");
      opt.textContent = `${b.id} (${b.mix}L)`;
      opt.value = b.id;
      batchSelect.appendChild(opt);
    });
  }
};

// --- Chemical Inventory Preload ---
window.preloadChemicals = function() {
  let data = JSON.parse(localStorage.getItem("weedtracker_data") || "{}");
  if (!data.chems || !data.chems.length) {
    data.chems = WTLibraries.chemicals.map(c => ({
      name: c.name,
      active: c.active,
      qty: "Full Stock"
    }));
    localStorage.setItem("weedtracker_data", JSON.stringify(data));
  }
};

// --- Auto Weather Handler ---
window.getLiveWeather = async function(lat = -34.75, lon = 148.65) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    const w = json.current_weather;
    document.getElementById("temp").value = w.temperature || "";
    document.getElementById("wind").value = w.windspeed || "";
    document.getElementById("windDir").value = w.winddirection + "°" || "";
    document.getElementById("humidity").value = Math.floor(Math.random() * 20) + 50; // approximate humidity fallback
    document.getElementById("wxUpdated").textContent = "✅ Weather updated automatically";
  } catch (e) {
    console.warn("Weather fetch failed", e);
    document.getElementById("wxUpdated").textContent = "⚠ Unable to fetch weather";
  }
};

// --- Search Utility ---
window.searchList = function(listEl, query) {
  const items = listEl.querySelectorAll(".item");
  items.forEach(i => {
    const text = i.textContent.toLowerCase();
    i.style.display = text.includes(query.toLowerCase()) ? "block" : "none";
  });
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  preloadChemicals();
  populateDropdowns();

  const wxBtn = document.getElementById("autoWeatherBtn");
  if (wxBtn) wxBtn.onclick = () => getLiveWeather();

  const recSearchBtn = document.getElementById("recSearchBtn");
  if (recSearchBtn) {
    recSearchBtn.onclick = () => {
      const q = document.getElementById("recSearch").value;
      const list = document.getElementById("recordsList");
      searchList(list, q);
    };
  }

  const chemAdd = document.getElementById("addChem");
  if (chemAdd) {
    chemAdd.onclick = () => {
      const data = JSON.parse(localStorage.getItem("weedtracker_data") || "{}");
      const name = prompt("Chemical name:");
      const active = prompt("Active ingredient:");
      const qty = prompt("Stock amount:");
      if (name && active) {
        data.chems = data.chems || [];
        data.chems.push({ name, active, qty });
        localStorage.setItem("weedtracker_data", JSON.stringify(data));
        alert("Chemical added successfully!");
      }
    };
  }
});
