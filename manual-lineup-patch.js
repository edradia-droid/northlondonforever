(function(){
  'use strict';
  function load(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}
  // Preserve the exact existing manual-lineup implementation from its last unchanged commit,
  // then always fetch a fresh Champions League admin/fan-prediction patch so UI changes are not hidden by cache.
  load('https://cdn.jsdelivr.net/gh/edradia-droid/northlondonforever@361f6036ee7598c2839020e865170c79737c2603/manual-lineup-patch.js')
    .catch(err=>console.warn('NL4 manual lineup core failed to load:',err))
    .finally(()=>load('ucl-admin-patch.js?v='+Date.now()).catch(err=>console.warn('NL4 UCL admin patch failed to load:',err)));
})();