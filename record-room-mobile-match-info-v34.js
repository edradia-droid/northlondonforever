(() => {
'use strict';
if (window.__NL4_RR_MOBILE_MATCH_INFO_V34__) return;
window.__NL4_RR_MOBILE_MATCH_INFO_V34__ = true;

function loadOnce(src){
  const base=src.split('?')[0];
  const existing=[...document.scripts].find(s=>(s.getAttribute('src')||'').split('?')[0]===base);
  if(existing) return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=src;
    s.onload=resolve;
    s.onerror=()=>reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}

function startSharedSync(){
  if(window.__NL4_RR_SHARED_SYNC_LOADING__) return;
  window.__NL4_RR_SHARED_SYNC_LOADING__=true;
  loadOnce('record-room-supabase.js?v=20260906-shared1')
    .then(()=>loadOnce('record-room-supabase-bridge.js?v=20260906-shared1'))
    .catch(err=>{window.__NL4_RR_SHARED_SYNC_LOADING__=false;console.warn('[NL4 Record Room] Shared Supabase sync failed to load:',err);});
}

function forceVisible(){
  const box=document.getElementById('fixtureDetail');
  if(!box || !box.classList.contains('open')) return;
  try{window.NL4RecordRoomMatchInfo?.inject?.();}catch(_){ }
  try{window.NL4RecordRoomMatchInfo?.restoreSavedSelections?.();}catch(_){ }
  const panel=document.getElementById('rrMatchInfoBox');
  if(panel){
    panel.style.setProperty('display','block','important');
    panel.style.setProperty('visibility','visible','important');
    panel.style.setProperty('opacity','1','important');
    panel.style.setProperty('width','100%','important');
    panel.style.setProperty('max-width','none','important');
    panel.style.setProperty('position','relative','important');
    panel.style.setProperty('overflow','visible','important');
    panel.style.setProperty('content-visibility','visible','important');
  }
}

function schedule(){[0,40,120,260,520,900].forEach(ms=>setTimeout(forceVisible,ms));}

document.addEventListener('click',e=>{
  const btn=e.target.closest('.fixture-open');
  if(btn) schedule();
},true);

document.addEventListener('touchend',e=>{
  const btn=e.target.closest?.('.fixture-open');
  if(btn) schedule();
},true);

const start=()=>{
  startSharedSync();
  const box=document.getElementById('fixtureDetail');
  if(box){
    new MutationObserver(schedule).observe(box,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-fixture-id']});
  }
  window.addEventListener('pageshow',schedule);
  window.addEventListener('orientationchange',schedule);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  schedule();
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
