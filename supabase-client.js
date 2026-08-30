// NL4 Supabase browser client
// Safe for frontend use: this is the low-privilege publishable key.
// Never place a Supabase secret/service_role key in browser files.

const NL4_SUPABASE_URL = "https://vrjxejuyiynllygiozhs.supabase.co";
const NL4_SUPABASE_PUBLISHABLE_KEY = "sb_publishable__esNlSYCC7dc4Cbn1yFZ4w_ttag7wqw";

if (!window.supabase) {
  throw new Error("Supabase JS library was not loaded.");
}

window.nl4Supabase = window.supabase.createClient(
  NL4_SUPABASE_URL,
  NL4_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } }
);

if (/record-room\.html\/?$/i.test(location.pathname)) {
  const currentFixtureState=()=>{
    const box=document.getElementById('fixtureDetail');
    const id=Number(box?.dataset?.fixtureId);
    if(!Number.isFinite(id)||typeof ALL_FIXTURES==='undefined'||typeof db==='undefined') return null;
    const f=ALL_FIXTURES.find(x=>Number(x.id)===id); if(!f) return null;
    const owner=db[f.home]?f.home:(db[f.away]?f.away:null); if(!owner) return null;
    const state=db[owner]?.fixtureData?.[id];
    return state?{id,f,owner,state}:null;
  };
  const readMatchDetails=()=>({
    referee:(document.getElementById('rrReferee')?.value||'').trim(),
    venue:(document.getElementById('rrVenue')?.value||'').trim(),
    attendance:document.getElementById('rrAttendance')?.value===''?null:Number(document.getElementById('rrAttendance')?.value),
    halftimeHomeScore:document.getElementById('rrHalfHome')?.value===''?null:Number(document.getElementById('rrHalfHome')?.value),
    halftimeAwayScore:document.getElementById('rrHalfAway')?.value===''?null:Number(document.getElementById('rrHalfAway')?.value),
    addedTime:Math.max(0,Math.min(30,Number(document.getElementById('rrAddedTime')?.value)||0))
  });
  const restoreMatchDetails=()=>{
    const x=currentFixtureState(); if(!x) return;
    const md=x.state.matchDetails||{};
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v??'';};
    set('rrReferee',md.referee||''); set('rrVenue',md.venue||''); set('rrAttendance',md.attendance);
    set('rrHalfHome',md.halftimeHomeScore); set('rrHalfAway',md.halftimeAwayScore); set('rrAddedTime',md.addedTime??0);
  };
  const captureMatchDetails=()=>{
    const x=currentFixtureState(); if(!x||!document.getElementById('rrExtendedDetails')) return;
    x.state.matchDetails=readMatchDetails();
    try{if(typeof persist==='function')persist();}catch(e){console.warn('[NL4 Record Room] Match details local persist failed',e);}
  };
  const injectRecordRoomDetails=()=>{
    const box=document.getElementById('fixtureDetail');
    if(!box||!box.classList.contains('open')||document.getElementById('rrExtendedDetails')) return;
    const scoreBox=box.querySelector('.detail-box');
    if(!scoreBox) return;
    scoreBox.insertAdjacentHTML('afterend',`<div class="detail-box" id="rrExtendedDetails" style="margin-top:15px">
      <h4>Match details</h4>
      <div class="admin-grid" style="margin-top:10px">
        <div class="field"><label>REFEREE</label><input id="rrReferee" placeholder="Referee"></div>
        <div class="field"><label>VENUE</label><input id="rrVenue" placeholder="Stadium / venue"></div>
        <div class="field"><label>ATTENDANCE</label><input id="rrAttendance" type="number" min="0" placeholder="Attendance"></div>
        <div class="field"><label>HALF-TIME • HOME</label><input id="rrHalfHome" type="number" min="0" placeholder="HT home"></div>
        <div class="field"><label>HALF-TIME • AWAY</label><input id="rrHalfAway" type="number" min="0" placeholder="HT away"></div>
        <div class="field"><label>ADDED TIME</label><input id="rrAddedTime" type="number" min="0" max="30" value="0" placeholder="Minutes"></div>
      </div>
    </div>`);
    restoreMatchDetails();
  };
  document.addEventListener('click',e=>{
    if(e.target?.classList?.contains('detail-save')) captureMatchDetails();
  },true);
  injectRecordRoomDetails();
  const rrBox=document.getElementById('fixtureDetail');
  if(rrBox) new MutationObserver(injectRecordRoomDetails).observe(rrBox,{childList:true});
  setInterval(injectRecordRoomDetails,250);

  const loadScript = (src) => new Promise((resolve, reject) => {
    const s=document.createElement('script'); s.src=src; s.onload=resolve;
    s.onerror=()=>reject(new Error(`Could not load ${src}`)); document.head.appendChild(s);
  });
  loadScript('record-room-supabase.js')
    .then(()=>loadScript('record-room-supabase-bridge.js'))
    .catch(error=>console.warn('[NL4 Record Room] Supabase bridge unavailable; local fallback remains active.',error));
}
