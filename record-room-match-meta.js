(() => {
'use strict';
if(window.__NL4_RR_MATCH_META_V2__)return;
window.__NL4_RR_MATCH_META_V2__=true;
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const clone=v=>JSON.parse(JSON.stringify(v));
function fixture(){
 const box=document.getElementById('fixtureDetail');
 const id=Number(box?.dataset?.fixtureId);
 if(!Number.isFinite(id)||typeof ALL_FIXTURES==='undefined')return null;
 return ALL_FIXTURES.find(f=>Number(f.id)===id)||null;
}
function recFor(f){
 if(!f||typeof db==='undefined')return null;
 const selected=document.getElementById('teamSelect')?.value;
 return db?.[selected]?.fixtureData?.[f.id]||db?.[f.home]?.fixtureData?.[f.id]||db?.[f.away]?.fixtureData?.[f.id]||null;
}
function first(...vals){return vals.find(v=>v!==undefined&&v!==null&&String(v)!=='')??'';}
function dataFor(f){
 const rec=recFor(f)||{},mi=rec.matchInfo||{},md=rec.matchDetails||{};
 return {
  referee:first(mi.referee,md.referee),
  attendance:first(mi.attendance,md.attendance),
  venue:first(mi.venue,mi.stadium,md.venue,md.stadium),
  kickoff:first(mi.kickoff,md.kickoff,md.kickoffTime,f?.kickoff,f?.kickoffTime,f?.time),
  weather:first(mi.weather,md.weather),
  halftimeHomeScore:first(mi.halftimeHomeScore,md.halftimeHomeScore),
  halftimeAwayScore:first(mi.halftimeAwayScore,md.halftimeAwayScore),
  addedTime:first(mi.addedTime,md.addedTime),
  notes:first(mi.notes,md.notes)
 };
}
function inject(){
 const box=document.getElementById('fixtureDetail'),f=fixture();
 if(!box||!f||!box.classList.contains('open'))return;
 const m=dataFor(f);
 let panel=document.getElementById('rrMatchInfoBox');
 if(!panel){
   panel=document.createElement('div');panel.id='rrMatchInfoBox';panel.className='detail-box';panel.style.marginTop='14px';
   const head=box.querySelector('.match-detail-head');
   if(head)head.insertAdjacentElement('afterend',panel);else box.prepend(panel);
 }
 panel.innerHTML=`<h4 style="color:#d8ad45">Match Information</h4><p class="admin-note">Imported completed-match information is restored automatically where it already exists. You can edit any value and save the match.</p><div class="admin-grid" style="margin-top:10px">
 <div class="field"><label>REFEREE</label><input id="rrReferee" value="${esc(m.referee)}" placeholder="Referee name"></div>
 <div class="field"><label>ATTENDANCE</label><input id="rrAttendance" type="number" min="0" step="1" value="${esc(m.attendance)}" placeholder="Attendance"></div>
 <div class="field"><label>STADIUM / VENUE</label><input id="rrVenue" value="${esc(m.venue)}" placeholder="Stadium / venue"></div>
 <div class="field"><label>KICK-OFF TIME</label><input id="rrKickoff" type="time" value="${esc(m.kickoff)}"></div>
 <div class="field"><label>WEATHER</label><input id="rrWeather" value="${esc(m.weather)}" placeholder="Weather"></div>
 <div class="field"><label>1ST HALF SCORE — ${esc(f.home)}</label><input id="rrHtHome" type="number" min="0" step="1" value="${esc(m.halftimeHomeScore)}" placeholder="HT"></div>
 <div class="field"><label>1ST HALF SCORE — ${esc(f.away)}</label><input id="rrHtAway" type="number" min="0" step="1" value="${esc(m.halftimeAwayScore)}" placeholder="HT"></div>
 <div class="field"><label>2ND HALF ADDED TIME</label><input id="rrAddedTime" type="number" min="0" step="1" value="${esc(m.addedTime)}" placeholder="Minutes"></div>
 </div><div class="field" style="margin-top:10px"><label>MATCH NOTES</label><input id="rrMatchNotes" value="${esc(m.notes)}" placeholder="Other match information / notes"></div>`;
}
function read(){
 const att=document.getElementById('rrAttendance')?.value??'',hth=document.getElementById('rrHtHome')?.value??'',hta=document.getElementById('rrHtAway')?.value??'',added=document.getElementById('rrAddedTime')?.value??'';
 return {
  referee:document.getElementById('rrReferee')?.value?.trim()||'',
  attendance:att===''?'':Math.max(0,Number(att)||0),
  venue:document.getElementById('rrVenue')?.value?.trim()||'',
  kickoff:document.getElementById('rrKickoff')?.value||'',
  weather:document.getElementById('rrWeather')?.value?.trim()||'',
  halftimeHomeScore:hth===''?'':Math.max(0,Number(hth)||0),
  halftimeAwayScore:hta===''?'':Math.max(0,Number(hta)||0),
  addedTime:added===''?'':Math.max(0,Number(added)||0),
  notes:document.getElementById('rrMatchNotes')?.value?.trim()||''
 };
}
function applyToRecord(rec,info){
 if(!rec)return;
 rec.matchInfo={...(rec.matchInfo||{}),...clone(info)};
 // Keep the historic completed-import format alive so old data tools and validation
 // continue to see referee, venue, attendance, half-time score and added time.
 rec.matchDetails={...(rec.matchDetails||{}),referee:info.referee,venue:info.venue,attendance:info.attendance,halftimeHomeScore:info.halftimeHomeScore,halftimeAwayScore:info.halftimeAwayScore,addedTime:info.addedTime,kickoff:info.kickoff,weather:info.weather,notes:info.notes};
}
function saveInfo(f,info){
 if(!f||typeof db==='undefined')return;
 [f.home,f.away].forEach(team=>applyToRecord(db?.[team]?.fixtureData?.[f.id],info));
 try{if(typeof persist==='function')persist()}catch(e){console.warn('[NL4] Match information persist failed',e)}
}
function save(){const f=fixture();if(!f)return;saveInfo(f,read());}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(!(b.classList.contains('detail-save')||/SAVE MATCH DETAILS/i.test(b.textContent||'')))return;
 const f=fixture(),info=read();
 // Native save replaces/mirrors the fixture first; restore metadata immediately after it.
 setTimeout(()=>{saveInfo(f,info);setTimeout(inject,0);},140);
},true);
const start=()=>{
 const box=document.getElementById('fixtureDetail');if(!box)return;
 new MutationObserver(()=>{if(box.classList.contains('open')&&fixture())setTimeout(inject,0)}).observe(box,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-fixture-id']});
 if(box.classList.contains('open'))inject();
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.NL4RecordRoomMatchInfo={inject,save,read,dataFor};
})();