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
  // This UI is injected directly from the client that Record Room already requires
  // for its admin authentication. It therefore cannot be skipped by a failed
  // secondary extension load.
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
  };
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
