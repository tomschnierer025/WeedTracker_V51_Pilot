<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
  <title>WeedTracker V60 Pilot</title>

  <link rel="stylesheet" href="styles.css"/>

  <!-- Leaflet (Map) -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" defer></script>

  <!-- Data & Logic (order matters) -->
  <script src="storage.js" defer></script>
  <script src="extras.js" defer></script>
  <script src="settings.js" defer></script>
  <script src="apps.js" defer></script>
</head>
<body class="theme-dark">

  <!-- Spinner overlay -->
  <div id="spinner" class="spinner-overlay hidden">
    <div class="spinner"></div>
    <div id="spinnerText" class="spinner-text">Loading…</div>
  </div>

  <!-- Toasts -->
  <div id="toastHost"></div>

  <!-- Header -->
  <header class="app-header">
    <h1>🌿 WeedTracker V60 Pilot</h1>
    <button id="homeBtn" class="icon-btn" title="Home" aria-label="Home">🏠</button>
  </header>

  <!-- HOME -->
  <main id="home" class="screen active">
    <section class="stack">
      <button class="nav-card" data-target="createTask">📝 Create Task</button>
      <button class="nav-card" data-target="records">📄 Records</button>
      <button class="nav-card" data-target="inventory">💧 Chemical Inventory</button>
      <button class="nav-card" data-target="batches">🧪 Batches</button>
      <button class="nav-card" data-target="procurement">🛒 Procurement List</button>
      <button class="nav-card" data-target="mapping">🗺️ Mapping</button>
      <button class="nav-card" data-target="settings">⚙️ Settings</button>
    </section>
  </main>

  <!-- CREATE TASK (single-column, phone friendly) -->
  <main id="createTask" class="screen">
    <section class="page">
      <h2>Create Task</h2>

      <div class="card">
        <div class="row">
          <div class="col">
            <label class="lbl">Auto-Name</label>
            <div class="chip-row">
              <button id="btnLocate" class="chip">📍 Locate</button>
              <span id="geoStatus" class="muted">Not set</span>
              <button id="btnAutoName" class="chip">Auto Name</button>
            </div>
            <input id="jobName" class="input" type="text" placeholder="Job name (editable)"/>
            <input id="councilJob" class="input" type="text" placeholder="Council Job Number (optional)"/>
          </div>
        </div>

        <div class="row">
          <div class="col">
            <label class="lbl">Date</label>
            <input id="dateInput" class="input" type="datetime-local"/>
          </div>
        </div>

        <div class="row two">
          <div class="col">
            <label class="lbl">Start</label>
            <input id="startTime" class="input" type="time"/>
          </div>
          <div class="col">
            <label class="lbl">Finish</label>
            <input id="finishTime" class="input" type="time"/>
          </div>
        </div>

        <div class="row two">
          <div class="col">
            <label class="lbl">Task Type</label>
            <select id="taskType" class="input">
              <option value="Inspection">Inspection</option>
              <option value="Road Spray">Road Spray</option>
              <option value="Spot Spray">Spot Spray</option>
              <option value="Slash">Slash</option>
            </select>
          </div>
          <div class="col">
            <label class="lbl">Weed</label>
            <select id="weedType" class="input"></select>
          </div>
        </div>

        <div class="row two">
          <div class="col">
            <label class="lbl">Batch</label>
            <select id="taskBatch" class="input"></select>
          </div>
          <div class="col">
            <label class="lbl">Link Existing Job # (optional)</label>
            <input id="linkJobId" class="input" placeholder="e.g. RS12122025_WombatRd"/>
          </div>
        </div>

        <div class="row">
          <div class="col">
            <label class="lbl">Inspection # (optional)</label>
            <input id="mergeInspectionId" class="input" placeholder="Inspection ID to merge"/>
          </div>
        </div>

        <h3>Weather</h3>
        <div class="row four">
          <div class="col"><label class="lbl">Temp (°C)</label><input id="wTemp" class="input" inputmode="decimal"/></div>
          <div class="col"><label class="lbl">Wind (km/h)</label><input id="wWind" class="input" inputmode="decimal"/></div>
          <div class="col"><label class="lbl">Wind Dir (deg)</label><input id="wDir" class="input" inputmode="numeric"/></div>
          <div class="col"><label class="lbl">Humidity (%)</label><input id="wHum" class="input" inputmode="decimal"/></div>
        </div>
        <button id="btnAutoWeather" class="chip">🌤️ Auto Weather</button>

        <label class="lbl mt">Notes</label>
        <textarea id="notes" class="input" rows="4" placeholder="Notes / observations"></textarea>

        <div class="row two mt">
          <div class="col">
            <label class="lbl">Status</label>
            <select id="status" class="input">
              <option value="Incomplete">Incomplete</option>
              <option value="Complete">Complete</option>
            </select>
          </div>
          <div class="col">
            <label class="lbl">Reminder (weeks)</label>
            <select id="reminder" class="input">
              <option>1</option><option>2</option><option>3</option><option>4</option>
            </select>
          </div>
        </div>

        <div class="btn-row">
          <button id="btnSaveTask" class="btn primary">💾 Save</button>
          <button id="btnDraftTask" class="btn">📝 Save as Draft</button>
        </div>
      </div>
    </section>
  </main>

  <!-- RECORDS -->
  <main id="records" class="screen">
    <section class="page">
      <h2>Records</h2>

      <div class="card soft">
        <details open>
          <summary>Filters</summary>
          <input id="recSearch" class="input" placeholder="Search (road, name, weed, council, batch)"/>
          <div class="row three">
            <div class="col"><label class="lbl">Type</label>
              <select id="recType" class="input">
                <option value="All">All</option>
                <option>Inspection</option>
                <option>Road Spray</option>
                <option>Spot Spray</option>
                <option>Slash</option>
              </select>
            </div>
            <div class="col"><label class="lbl">From (Date)</label><input id="recFrom" class="input" type="date"/></div>
            <div class="col"><label class="lbl">To (Date)</label><input id="recTo" class="input" type="date"/></div>
          </div>
          <div class="row two">
            <div class="col"><label class="lbl">Status</label>
              <select id="recStatus" class="input">
                <option value="All">All</option>
                <option>Complete</option>
                <option>Incomplete</option>
              </select>
            </div>
            <div class="col btn-row-right">
              <button id="btnRecSearch" class="btn primary">🔍 Search</button>
              <button id="btnRecReset" class="btn danger">♻️ Reset</button>
            </div>
          </div>
        </details>
      </div>

      <div id="recList" class="stack"></div>
    </section>
  </main>

  <!-- INVENTORY -->
  <main id="inventory" class="screen">
    <section class="page">
      <h2>Chemical Inventory</h2>

      <div class="card soft">
        <div class="row between">
          <div><b>SDS Portal</b></div>
          <a class="btn" target="_blank" href="https://online.chemwatch.net">Open Chemwatch</a>
        </div>
      </div>

      <div class="btn-row">
        <button id="btnAddChem" class="btn primary">➕ Add chemical</button>
      </div>

      <div id="chemList" class="stack"></div>
    </section>
  </main>

  <!-- BATCHES -->
  <main id="batches" class="screen">
    <section class="page">
      <h2>Batches</h2>

      <!-- Create Batch on ONE PAGE -->
      <div class="card">
        <h3>Create Batch</h3>
        <div class="row">
          <div class="col"><label class="lbl">Auto-Name</label><input id="batchName" class="input" placeholder="Auto or custom"/></div>
        </div>
        <div class="row two">
          <div class="col"><label class="lbl">Date</label><input id="batchDate" class="input" type="date"/></div>
          <div class="col"><label class="lbl">Total mix (L)</label><input id="batchTotal" class="input" inputmode="decimal" value="600"/></div>
        </div>

        <div id="chemLines" class="stack bordered"></div>
        <div class="btn-row">
          <button id="btnAddLine" class="btn">➕ Add chemical</button>
        </div>

        <div class="summary-row">
          <div><b>Total used:</b> <span id="sumUsed">0.000 L</span></div>
          <div><b>Remaining:</b> <span id="sumRemain">0 L</span></div>
        </div>

        <div class="btn-row">
          <button id="btnCreateBatch" class="btn primary">🧪 Create Batch</button>
          <button id="btnDeleteDraft" class="btn danger">🗑️ Delete Batch</button>
        </div>
      </div>

      <h3 class="mt">Existing Batches</h3>
      <div class="card soft">
        <details open>
          <summary>Filters</summary>
          <div class="row two">
            <div class="col"><label class="lbl">From (Date)</label><input id="batFrom" class="input" type="date"/></div>
            <div class="col"><label class="lbl">To (Date)</label><input id="batTo" class="input" type="date"/></div>
          </div>
          <div class="btn-row-right">
            <button id="btnBatSearch" class="btn primary">🔍 Search</button>
            <button id="btnBatReset" class="btn danger">♻️ Reset</button>
          </div>
        </details>
      </div>

      <div id="batchList" class="stack"></div>
    </section>
  </main>

  <!-- PROCUREMENT (placeholder simple list) -->
  <main id="procurement" class="screen">
    <section class="page">
      <h2>Procurement List</h2>
      <div id="procList" class="stack"></div>
    </section>
  </main>

  <!-- MAPPING -->
  <main id="mapping" class="screen">
    <section class="page">
      <h2>Mapping</h2>
      <div class="card soft">
        <details open>
          <summary>Filters</summary>
          <div class="row three">
            <div class="col"><label class="lbl">From</label><input id="mapFrom" class="input" type="date"/></div>
            <div class="col"><label class="lbl">To</label><input id="mapTo" class="input" type="date"/></div>
            <div class="col"><label class="lbl">Type</label>
              <select id="mapType" class="input">
                <option value="All">All</option>
                <option>Inspection</option>
                <option>Road Spray</option>
                <option>Spot Spray</option>
                <option>Slash</option>
              </select>
            </div>
          </div>
          <input id="mapSearch" class="input" placeholder="Weed name…"/>
          <div class="btn-row-right">
            <button id="btnMapSearch" class="btn primary">🔍 Search</button>
            <button id="btnMapReset" class="btn danger">♻️ Reset</button>
          </div>
        </details>
      </div>

      <div id="map" class="map"></div>
      <div class="btn-row-right mt"><button id="btnLocateMe" class="btn">📍 Locate Me</button></div>
    </section>
  </main>

  <!-- SETTINGS -->
  <main id="settings" class="screen">
    <section class="page">
      <h2>Settings / Data</h2>
      <div class="card">
        <div class="row two">
          <button id="btnExport" class="btn">⬇️ Export JSON</button>
          <button id="btnImport" class="btn">⬆️ Import JSON</button>
        </div>
        <div class="row two">
          <button id="btnClear" class="btn danger">🧹 Clear Data</button>
          <button id="btnTheme" class="btn">🌓 Toggle Theme</button>
        </div>
        <input id="fileImport" type="file" accept="application/json" hidden/>
      </div>
    </section>
  </main>

  <!-- Popup host -->
  <div id="popupHost"></div>
</body>
</html>
