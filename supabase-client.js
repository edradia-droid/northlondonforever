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
    const id=fixtureId(); if(!Number.isFinite(id)) return;
    const md=readInputs(), backup=readBackup(); backup[id]=md;
    localStorage.setItem(RR_DETAILS_KEY,JSON.stringify(backup));
    // Also place it in the native Record Room fixture object before its Save handler runs.
    try{
      if(typeof ALL_FIXTURES!=='undefined'&&typeof db!=='undefined'){
        const f=ALL_FIXTURES.find(x=>Number(x.id)===id);
        const team=(typeof teamSelect!=='undefined'&&teamSelect?.value)||null;
        if(f&&team&&db[team]){
          const s=fixtureStore(team,id); s.matchDetails={...md};
          [f.home,f.away].filter(t=>db[t]).forEach(t=>{db[t].fixtureData=db[t].fixtureData||{}; const ts=fixtureStore(t,id); ts.matchDetails={...md};});
          if(typeof persist==='function') persist();
        }
      }
    }catch(e){console.warn('[NL4 Record Room] Native match-detail capture fallback used.',e);}
    window.NL4RecordRoomPendingMatchDetails={fixtureId:id,details:md};
  };
  const restore=()=>{
    const id=fixtureId(); if(!Number.isFinite(id)) return;
    let md=null;
    try{
      if(typeof ALL_FIXTURES!=='undefined'&&typeof db!=='undefined'){
        const f=ALL_FIXTURES.find(x=>Number(x.id)===id), team=(typeof teamSelect!=='undefined'&&teamSelect?.value)||null;
        md=(team&&db[team]?.fixtureData?.[id]?.matchDetails)||null;
        if(!md&&f) md=db[f.home]?.fixtureData?.[id]?.matchDetails||db[f.away]?.fixtureData?.[id]?.matchDetails||null;
      }
    }catch(_){}
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
  // Capture before the inline onclick save handler. Input/change also protects against rerenders.
  document.addEventListener('click',e=>{if(e.target?.classList?.contains('detail-save'))capture()},true);
  document.addEventListener('change',e=>{if(e.target?.closest?.('#rrExtendedDetails'))capture()},true);
  inject(); const rrBox=document.getElementById('fixtureDetail'); if(rrBox)new MutationObserver(inject).observe(rrBox,{childList:true}); setInterval(inject,250);

  const loadScript=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error(`Could not load ${src}`));document.head.appendChild(s)});
  loadScript('record-room-supabase.js').then(()=>loadScript('record-room-supabase-bridge.js')).catch(error=>console.warn('[NL4 Record Room] Supabase bridge unavailable; local fallback remains active.',error));
}
