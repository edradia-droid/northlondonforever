(function(){
  'use strict';
  function load(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}
  // Preserve the exact existing manual-lineup implementation from its last unchanged commit,
  // then layer the Champions League admin integration after it.
  load('https://cdn.jsdelivr.net/gh/edradia-droid/northlondonforever@361f6036ee7598c2839020e865170c79737c2603/manual-lineup-patch.js')
    .catch(err=>console.warn('NL4 manual lineup core failed to load:',err))
    .finally(()=>load('ucl-admin-patch.js?v=20260911-1').catch(err=>console.warn('NL4 UCL admin patch failed to load:',err)));
})();