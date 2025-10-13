/* WeedTracker V55 Pilot – storage.js */
/* Handles save/load of data, ensuring persistence and fallback */

(function(){
  'use strict';

  const KEY = 'weedtracker_v55_data';

  /* ---------------------- SAVE / LOAD / CLEAR ---------------------- */
  window.saveDB = async function(data){
    try{
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    }catch(err){
      console.error('Save failed', err);
      toastInline('⚠️ Failed to save data', 'warn');
      return false;
    }
  };

  window.loadDB = async function(){
    try{
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    }catch(err){
      console.error('Load failed', err);
      return null;
    }
  };

  window.clearDB = async function(){
    try{
      localStorage.removeItem(KEY);
      toastInline('Data cleared', 'ok');
    }catch(err){
      console.error('Clear failed', err);
    }
  };

  /* -------------------------- EXPORT / IMPORT -------------------------- */
  window.exportDB = function(){
    const data = localStorage.getItem(KEY);
    if(!data){ toastInline('No data to export', 'warn'); return; }
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weedtracker_backup_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toastInline('Data exported', 'ok');
  };

  window.importDB = async function(file){
    try{
      const text = await file.text();
      const data = JSON.parse(text);
      if(data && typeof data === 'object'){
        localStorage.setItem(KEY, JSON.stringify(data));
        toastInline('✅ Import successful', 'ok');
        setTimeout(()=>location.reload(), 800);
      } else throw new Error('Invalid format');
    }catch(err){
      console.error('Import failed', err);
      toastInline('⚠️ Import failed', 'warn');
    }
  };

  /* ---------------------- REPAIR / MIGRATION ---------------------- */
  window.migrateOldDB = function(){
    try{
      const old = localStorage.getItem('weedtracker_data');
      if(!old) return;
      const data = JSON.parse(old);
      if(data) {
        localStorage.setItem(KEY, JSON.stringify(data));
        localStorage.removeItem('weedtracker_data');
        toastInline('Migrated old data to v55', 'ok');
      }
    }catch(e){ console.error('Migration error', e); }
  };

})();
