(() => {
'use strict';
if(window.__NL4_RR_MATCH_META_V1__)return;
window.__NL4_RR_MATCH_META_V1__=true;
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
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
function inject(){
 const box=document.getElementById('fixtureDetail'),f=fixture();
 if(!box||!f||!box.classList.contains('open'))return;
 const rec=recFor(f)||{},m=rec.matchInfo||{};
 let panel=document.getElementById('rrMatchInfoBox');
 if(!panel){
   panel=document.createElement('div');panel.id='rrMatchInfoBox';panel.className='detail-box';panel.style.marginTop='14px';
   const head=box.querySelector('.match-detail-head');
   if(head)head.insertAdjacentElement('afterend',panel);else box.prepend(panel);
 }
 panel.innerHTML=`<h4 style="color:#d8ad45">Match Information</h4><div class="admin-grid" style="margin-top:10px">
 <div class="field"><label>REFEREE</label><input id="rrReferee" value="${esc(m.referee||'')}" placeholder="Referee name"></div>
 <div class="field"><label>ATTENDANCE</label><input id="rrAttendance" type="number" min="0" step="1" value="${esc(m.attendance??'')}" placeholder="Attendance"></div>
 <div class="field"><label>STADIUM / VENUE</label><input id="rrVenue" value="${esc(m.venue||'')}" placeholder="Stadium"></div>
 <div class="field"><label>KICK-OFF TIME</label><input id="rrKickoff" type="time" value="${esc(m.kickoff||'')}"></div>
 <div class="field"><label>WEATHER</label><input id="rrWeather" value="${esc(m.weather||'')}" placeholder="Weather"></div>
 <div class="field"><label>ADDED TIME</label><input id="rrAddedTime" value="${esc(m.addedTime||'')}" placeholder="e.g. 4 + 6"></div>
 </div><div class="field" style="margin-top:10px"><label>MATCH NOTES</label><input id="rrMatchNotes" value="${esc(m.notes||'')}" placeholder="Other match information / notes"></div>`;
}
function read(){return {referee:document.getElementById('rrReferee')?.value?.trim()||'',attendance:document.getElementById('rrAttendance')?.value===''?'':Math.max(0,Number(document.getElementById('rrAttendance')?.value)||0),venue:document.getElementById('rrVenue')?.value?.trim()||'',kickoff:document.getElementById('rrKickoff')?.value||'',weather:document.getElementById('rrWeather')?.value?.trim()||'',addedTime:document.getElementById('rrAddedTime')?.value?.trim()||'',notes:document.getElementById('rrMatchNotes')?.value?.trim()||''};}
function save(){
 const f=fixture();if(!f||typeof db==='undefined')return;
 const info=read();
 [f.home,f.away].forEach(team=>{const rec=db?.[team]?.fixtureData?.[f.id];if(rec)rec.matchInfo=JSON.parse(JSON.stringify(info));});
 try{if(typeof persist==='function')persist()}catch(e){console.warn('[NL4] Match information persist failed',e)}
}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.classList.contains('detail-save')||/SAVE MATCH DETAILS/i.test(b.textContent||'')){const info=read(),f=fixture();setTimeout(()=>{if(f&&typeof db!=='undefined'){[f.home,f.away].forEach(team=>{const rec=db?.[team]?.fixtureData?.[f.id];if(rec)rec.matchInfo=JSON.parse(JSON.stringify(info));});try{if(typeof persist==='function')persist()}catch(_){}}},120);}},true);
const start=()=>{const box=document.getElementById('fixtureDetail');if(!box)return;new MutationObserver(()=>{if(box.classList.contains('open')&&fixture())setTimeout(inject,0)}).observe(box,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-fixture-id']});if(box.classList.contains('open'))inject();};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.NL4RecordRoomMatchInfo={inject,save,read};
})();