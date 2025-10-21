/* WeedTracker V62 Final Pilot — styles.css */

/* Global Reset */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: "Segoe UI", Roboto, Arial, sans-serif;
}

html, body {
  background: #f3f4f3;
  color: #0a280d;
  height: 100%;
  overflow-x: hidden;
}

main {
  padding: 1rem;
}

/* Appbar */
.appbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #2f6930;
  color: white;
  padding: 0.7rem 1rem;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
}

.appbar .brand {
  font-size: 1.1rem;
  font-weight: bold;
}

/* Screens */
.screen {
  display: none;
  padding: 1rem 0;
}

.screen.active {
  display: block;
}

h2, h3 {
  color: #175317;
  margin-bottom: 0.5rem;
}

/* Home Menu */
.menu {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.menu-btn {
  display: block;
  width: 100%;
  background: #eaf5ea;
  color: #1b4d1b;
  font-size: 1.1rem;
  font-weight: 600;
  padding: 0.9rem;
  border: 2px solid #226622;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.15);
  text-align: left;
  transition: all 0.2s;
}

.menu-btn:hover {
  background: #cfe9cf;
  transform: translateY(-1px);
}

.menu-btn:active {
  transform: translateY(0);
}

/* Cards */
.card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
  padding: 1rem;
  margin-bottom: 1rem;
}

.card.accent {
  background: #ecf8ec;
  border-left: 5px solid #2f6930;
}

.card.p {
  padding: 1.2rem;
}

/* Form Fields */
.field {
  margin-bottom: 1rem;
}

.field label {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 0.3rem;
  color: #143d14;
}

.field input,
.field select,
.field textarea {
  width: 100%;
  padding: 0.6rem;
  border: 1.5px solid #8ab78a;
  border-radius: 6px;
  font-size: 1rem;
  background: #fff;
  color: #0a280d;
}

.field input:focus,
.field select:focus,
.field textarea:focus {
  outline: none;
  border-color: #2f6930;
  box-shadow: 0 0 3px rgba(47,105,48,0.5);
}

/* Buttons */
button, .pill {
  cursor: pointer;
  border: none;
  background: #2f6930;
  color: white;
  border-radius: 25px;
  padding: 0.5rem 1rem;
  font-size: 0.95rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

button:hover, .pill:hover {
  background: #3d8040;
}

button.danger, .pill.danger {
  background: #a83232;
}

button.danger:hover {
  background: #cc4040;
}

button.solid {
  background: #175317;
  color: #fff;
}

/* Layout Helpers */
.row {
  display: flex;
  align-items: center;
}

.row.gap {
  gap: 0.6rem;
}

.row.end {
  justify-content: flex-end;
}

.grid.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}

.grid.three {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.6rem;
}

.grid.four {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.6rem;
}

.grid.two.tight {
  gap: 0.4rem;
}

.grow { flex: 1; }

/* Spinner */
.spinner {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255,255,255,0.7);
  z-index: 9999;
  align-items: center;
  justify-content: center;
}

.spinner.active {
  display: flex;
}

.spinner::after {
  content: "";
  width: 48px;
  height: 48px;
  border: 5px solid #d9f7d9;
  border-top: 5px solid #2f6930;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Toasts */
#toastHost {
  position: fixed;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000;
}

.toast {
  background: #e2f7e2;
  color: #064a06;
  padding: 0.6rem 1rem;
  border-radius: 20px;
  margin-top: 0.5rem;
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  font-weight: 600;
  animation: fadeInOut 2.2s ease-in-out;
}

@keyframes fadeInOut {
  0% { opacity: 0; transform: translateY(20px); }
  10%, 90% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(20px); }
}

/* Lists */
.list .item {
  background: white;
  padding: 0.8rem;
  border-radius: 6px;
  margin-bottom: 0.6rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}

.list .item b {
  display: block;
  margin-bottom: 0.2rem;
  color: #1a4d1a;
}

.list .item small {
  color: #426e42;
}

/* Modal Popups */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.45);
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal .card {
  background: white;
  border-radius: 10px;
  padding: 1.2rem;
  width: 92%;
  max-width: 480px;
  max-height: 85%;
  overflow-y: auto;
}

/* Sheet (inventory editor) */
.sheet {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0,0,0,0.4);
  z-index: 9999;
  align-items: flex-end;
  justify-content: center;
}

.sheet-card {
  background: white;
  width: 100%;
  max-width: 600px;
  padding: 1rem;
  border-radius: 12px 12px 0 0;
}

/* Map */
.map {
  width: 100%;
  height: 75vh;
  border-radius: 10px;
  margin-top: 0.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
}

/* Chips */
.chip {
  background: #e4f5e4;
  padding: 0.35rem 0.7rem;
  border-radius: 20px;
  border: 1.5px solid #8ab78a;
  cursor: pointer;
}

.chip input {
  margin-right: 0.4rem;
}

.chip:hover {
  background: #cbeacb;
}

/* Misc */
.muted {
  color: #608660;
  font-size: 0.9rem;
}

.ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hide { display: none; }
