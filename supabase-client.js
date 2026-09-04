// NL4 Supabase browser client
// Safe for frontend use: this is the low-privilege publishable key.
// Never place a Supabase secret/service_role key in browser files.

const NL4_SUPABASE_URL = "https://vrjxejuyiynllygiozhs.supabase.co";
const NL4_SUPABASE_PUBLISHABLE_KEY = "sb_publishable__esNlSYCC7dc4Cbn1yFZ4w_ttag7wqw";

if (!window.supabase) throw new Error("Supabase JS library was not loaded.");
window.nl4Supabase = window.supabase.createClient(
  NL4_SUPABASE_URL,
  NL4_SUPABASE_PUBLISHABLE_KEY,
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
);

const NL4_IS_RECORD_ROOM = !!document.getElementById('recordRoomPage') || /(?:^|\/)record-room(?:\.html)?\/?$/i.test(location.pathname);

if (NL4_IS_RECORD_ROOM) {
  // Record Room stays lightweight. Only the one-time Arsenal registration is loaded
  // automatically; import/audit/Supabase season tools remain manual.
  const loadScript = src => new Promise((resolve,reject)=>{
    if (document.querySelector(`script[data-nl4-rr-src="${src}"]`)) return resolve();
    const s=document.createElement('script');
    s.src=src;
    s.dataset.nl4RrSrc=src;
    s.onload=resolve;
    s.onerror=()=>reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });

  const loadArsenal=()=>loadScript('record-room-arsenal-team-v7.js')
    .catch(err=>console.warn('[NL4 Record Room] Arsenal team registration failed:',err));

  if('requestIdleCallback' in window) requestIdleCallback(loadArsenal,{timeout:800});
  else setTimeout(loadArsenal,80);

  let toolsPromise=null;
  window.NL4LoadRecordRoomMaintenance = function(){
    if (toolsPromise) return toolsPromise;
    toolsPromise=Promise.resolve()
      .then(()=>loadScript('record-room-supabase.js'))
      .then(()=>loadScript('record-room-supabase-bridge.js'))
      .then(()=>loadScript('record-room-completed-import.js'))
      .then(()=>loadScript('record-room-participation-events-fix.js'))
      .then(()=>loadScript('record-room-verified-stats.js'))
      .then(()=>loadScript('record-room-canonical-events-v4.js'))
      .then(()=>loadScript('record-room-assists-motm-v5.js'))
      .then(()=>loadScript('record-room-player-calculation-v6.js'))
      .then(()=>loadScript('record-room-event-display-fix.js'))
      .then(()=>loadScript('record-room-season-sync-fix.js'))
      .then(()=>loadScript('record-room-matchday-groups.js'))
      .catch(err=>{ toolsPromise=null; throw err; });
    return toolsPromise;
  };

  const addButton=()=>{
    const actions=document.querySelector('.admin-record-actions');
    if(!actions || document.getElementById('rrLoadMaintenance')) return;
    const b=document.createElement('button');
    b.id='rrLoadMaintenance';
    b.type='button';
    b.textContent='Load full data tools';
    b.title='Loads heavy Record Room import, audit and season-sync tools only when you request them.';
    b.addEventListener('click',async()=>{
      if(b.dataset.loaded==='1') return;
      b.disabled=true;
      b.textContent='Loading data tools…';
      try{
        await window.NL4LoadRecordRoomMaintenance();
        b.dataset.loaded='1';
        b.textContent='Data tools loaded';
      }catch(error){
        console.warn('[NL4 Record Room] Manual data-tool load failed:',error);
        b.disabled=false;
        b.textContent='Retry data tools';
      }
    });
    actions.insertBefore(b,document.getElementById('recordRoomLogout')||null);
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',addButton,{once:true});
  else addButton();
}
