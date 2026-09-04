// NL4 Supabase browser client
// Safe for frontend use: this is the low-privilege publishable key.
// Never place a Supabase secret/service_role key in browser files.

const NL4_SUPABASE_URL = "https://vrjxejuyiynllygiozhs.supabase.co";
const NL4_SUPABASE_PUBLISHABLE_KEY = "sb_publishable__esNlSYCC7dc4Cbn1yFZ4w_ttag7wqw";

if (!window.supabase) throw new Error("Supabase JS library was not loaded.");
window.nl4Supabase = window.supabase.createClient(NL4_SUPABASE_URL,NL4_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

if (/record-room\.html\/?$/i.test(location.pathname)) {
  const RR_DETAILS_KEY='nl4_record_room_match_details_v1';
  const readBackup=()=>{try{return JSON.parse(localStorage.getItem(RR_DETAILS_KEY)||'{}')}catch(_){return {}}};
  const fixtureId=()=>Number(document.getElementById('fixtureDetail')?.dataset?.fixtureId);
  const readInputs=()=>({
    referee:(document.getElementById('rrReferee')?.value||'').trim(),
    venue:(document.getElementById('rrVenue')?.value||'').trim(),
    attendance:document.getElementById('rrAttendance')?.value===''?null:Number(document.getElementById('rrAttendance')?.value),
    halftimeHomeScore:document.getElementById('rrHalfHome')?.value===''?null:Number(document.getElementById('rrHalfHome')?.value),
    halftimeAwayScore:document.getElementById('rrHalfAway')?.value===''?null:Number(document.getElementById('rrHalfAway')?.value),
    addedTime:Math.max(0,Math.min(30,Number(document.getElementById('rrAddedTime')?.value)||0))
  });
  const capture=()=>{
    const id=fixtureId(); if(!Number.isFinite(id)||!document.getElementById('rrExtendedDetails')) return;
    const md=readInputs(), backup=readBackup(); backup[id]=md;
    localStorage.setItem(RR_DETAILS_KEY,JSON.stringify(backup));
    try{
      if(typeof ALL_FIXTURES!=='undefined'&&typeof db!=='undefined'){
        const f=ALL_FIXTURES.find(x=>Number(x.id)===id);
        const selected=(typeof teamSelect!=='undefined'&&teamSelect?.value)||null;
        const participants=f?[f.home,f.away].filter(t=>db[t]):[];
        if(selected&&db[selected]){ const s=fixtureStore(selected,id); s.matchDetails={...md}; }
        participants.forEach(t=>{const s=fixtureStore(t,id);s.matchDetails={...md}});
        if(typeof persist==='function') persist();
      }
    }catch(e){console.warn('[NL4 Record Room] Match-detail native-state capture fallback used.',e);}
    window.NL4RecordRoomPendingMatchDetails={fixtureId:id,details:md};
  };
  const restore=()=>{
    const id=fixtureId(); if(!Number.isFinite(id)) return;
    let md=null;
    try{const selected=(typeof teamSelect!=='undefined'&&teamSelect?.value)||null;if(selected&&typeof db!=='undefined') md=db[selected]?.fixtureData?.[id]?.matchDetails||null;}catch(_){}
    md=md||readBackup()[id]||{};
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v??''};
    set('rrReferee',md.referee||''); set('rrVenue',md.venue||''); set('rrAttendance',md.attendance);
    set('rrHalfHome',md.halftimeHomeScore); set('rrHalfAway',md.halftimeAwayScore); set('rrAddedTime',md.addedTime??0);
  };
  const inject=()=>{
    const box=document.getElementById('fixtureDetail');
    if(!box||!box.classList.contains('open')||document.getElementById('rrExtendedDetails')) return;
    const scoreBox=box.querySelector('.detail-box'); if(!scoreBox) return;
    scoreBox.insertAdjacentHTML('afterend',`<div class="detail-box" id="rrExtendedDetails" style="margin-top:15px"><h4>Match details</h4><div class="admin-grid" style="margin-top:10px">
      <div class="field"><label>REFEREE</label><input id="rrReferee" placeholder="Referee"></div><div class="field"><label>VENUE</label><input id="rrVenue" placeholder="Stadium / venue"></div><div class="field"><label>ATTENDANCE</label><input id="rrAttendance" type="number" min="0" placeholder="Attendance"></div><div class="field"><label>HALF-TIME • HOME</label><input id="rrHalfHome" type="number" min="0" placeholder="HT home"></div><div class="field"><label>HALF-TIME • AWAY</label><input id="rrHalfAway" type="number" min="0" placeholder="HT away"></div><div class="field"><label>ADDED TIME</label><input id="rrAddedTime" type="number" min="0" max="30" value="0" placeholder="Minutes"></div>
    </div></div>`); restore();
  };
  document.addEventListener('input',e=>{if(e.target?.closest?.('#rrExtendedDetails'))capture()},true);
  document.addEventListener('change',e=>{if(e.target?.closest?.('#rrExtendedDetails'))capture()},true);
  document.addEventListener('pointerdown',e=>{if(e.target?.closest?.('.detail-save'))capture()},true);
  document.addEventListener('click',e=>{if(e.target?.closest?.('.detail-save'))capture()},true);
  inject(); const rrBox=document.getElementById('fixtureDetail'); if(rrBox)new MutationObserver(inject).observe(rrBox,{childList:true}); setInterval(inject,250);

  const loadScript=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error(`Could not load ${src}`));document.head.appendChild(s)});
  loadScript('record-room-supabase.js')
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
    .catch(error=>console.warn('[NL4 Record Room] Optional Record Room extension unavailable; local fallback remains active.',error));
}
