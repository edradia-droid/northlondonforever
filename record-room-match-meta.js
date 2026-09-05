(() => {
'use strict';
if(window.__NL4_RR_MATCH_META_V2__)return;
window.__NL4_RR_MATCH_META_V2__=true;
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[m]));
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
 restoreSavedSelections();
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
 rec.matchDetails={...(rec.matchDetails||{}),referee:info.referee,venue:info.venue,attendance:info.attendance,halftimeHomeScore:info.halftimeHomeScore,halftimeAwayScore:info.halftimeAwayScore,addedTime:info.addedTime,kickoff:info.kickoff,weather:info.weather,notes:info.notes};
}
function saveInfo(f,info){
 if(!f||typeof db==='undefined')return;
 [f.home,f.away].forEach(team=>applyToRecord(db?.[team]?.fixtureData?.[f.id],info));
 try{if(typeof persist==='function')persist()}catch(e){console.warn('[NL4] Match information persist failed',e)}
}
function save(){const f=fixture();if(!f)return;saveInfo(f,read());}

function ensureSelectValue(select,value,label){
 if(!select||value===undefined||value===null||String(value)==='')return;
 const wanted=String(value);
 let option=[...select.options].find(o=>o.value===wanted);
 if(!option){
   option=new Option(label||`Saved • ${wanted}`,wanted,true,true);
   option.dataset.savedFallback='1';
   select.insertBefore(option,select.firstChild);
 }
 select.value=wanted;
}
function displaySavedPlayer(value){
 const parts=String(value||'').split('|||');
 return parts.length>1?`Saved • ${parts.slice(1).join('|||')} — ${parts[0]}`:`Saved • ${value}`;
}
function restoreSavedSelections(){
 const f=fixture(),box=document.getElementById('fixtureDetail'),rec=recFor(f);
 if(!f||!box||!rec)return;
 const home=Array.isArray(rec.homeLineup)?rec.homeLineup:[];
 const away=Array.isArray(rec.awayLineup)?rec.awayLineup:[];
 box.querySelectorAll('[data-lineup="home"]').forEach((sel,i)=>ensureSelectValue(sel,home[i],`Saved • ${home[i]||''}`));
 box.querySelectorAll('[data-lineup="away"]').forEach((sel,i)=>ensureSelectValue(sel,away[i],`Saved • ${away[i]||''}`));
 const restoreSubs=(side,rows)=>{
   box.querySelectorAll(`#${side}Subs .sub-row`).forEach((row,i)=>{
     const saved=rows?.[i]||{};
     ensureSelectValue(row.querySelector('.sub-out'),saved.out,`Saved • ${saved.out||''}`);
     ensureSelectValue(row.querySelector('.sub-in'),saved.in,`Saved • ${saved.in||''}`);
     const outMin=row.querySelector('.sub-out-min'),inMin=row.querySelector('.sub-in-min');
     if(outMin&&outMin.value===''&&saved.outMin!==undefined&&saved.outMin!==null)outMin.value=saved.outMin;
     if(inMin&&inMin.value===''&&saved.inMin!==undefined&&saved.inMin!==null)inMin.value=saved.inMin;
   });
 };
 restoreSubs('home',Array.isArray(rec.homeSubs)?rec.homeSubs:[]);
 restoreSubs('away',Array.isArray(rec.awaySubs)?rec.awaySubs:[]);
 box.querySelectorAll('#eventRows .event-row').forEach((row,i)=>{
   const saved=(Array.isArray(rec.events)?rec.events:[])?.[i]||{};
   ensureSelectValue(row.querySelector('.event-player'),saved.player,displaySavedPlayer(saved.player));
   ensureSelectValue(row.querySelector('.event-assist'),saved.assist,displaySavedPlayer(saved.assist));
   const min=row.querySelector('.event-min');if(min&&min.value===''&&saved.minute!==undefined&&saved.minute!==null)min.value=saved.minute;
   const type=row.querySelector('.event-type');if(type&&saved.type)type.value=saved.type;
 });
 ensureSelectValue(document.getElementById('manOfTheMatch'),rec.manOfTheMatch,displaySavedPlayer(rec.manOfTheMatch));
}

function installMobileAndPerformanceFixes(){
 if(document.getElementById('rrMobileParityCss'))return;
 const style=document.createElement('style');style.id='rrMobileParityCss';style.textContent=`
 .fixture-detail{content-visibility:auto;contain-intrinsic-size:900px}
 .stats-table{content-visibility:auto;contain-intrinsic-size:1000px}
 @media(max-width:900px){
  .admin-record-bar{position:sticky;align-items:stretch;flex-direction:column;padding:9px 12px}
  .admin-record-brand{justify-content:space-between}.admin-record-brand span{font-size:10px}
  .admin-record-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:100%}
  .admin-record-actions a,.admin-record-actions button{width:100%;text-align:center;padding:10px 7px}
  .page{width:96vw!important;padding-top:12px!important}
  .hero{border-radius:18px!important}.toolbar{position:relative;z-index:2}
  .fixture-card{grid-template-columns:52px minmax(0,1fr) 70px!important;padding:10px!important}
  .fixture-open{grid-column:1/-1;width:100%;min-height:40px}.fixture-card .fixture-date{grid-column:2/4!important}
  .fixture-detail{padding:10px!important}.match-detail-head{flex-direction:column}.match-detail-actions{width:100%;display:grid;grid-template-columns:1fr 1fr}
  .match-detail-actions .detail-save{grid-column:1/-1;width:100%;min-height:44px}.match-detail-actions .mini-btn{width:100%}
  .detail-box{padding:11px!important}.detail-grid-2,.lineup-grid{grid-template-columns:1fr!important}
  .score-grid{grid-template-columns:1fr 64px 64px 1fr!important}.score-grid input{min-width:0}
  .lineup-row{grid-template-columns:25px minmax(0,1fr)!important}.lineup-row select{min-width:0}
  .sub-row{grid-template-columns:minmax(0,1fr) 58px!important;padding:8px;border:1px solid rgba(255,255,255,.06);border-radius:10px;margin-bottom:8px!important}
  .sub-row .sub-in{grid-column:1}.sub-row .sub-in-min{grid-column:2}.sub-row .remove-row{grid-column:1/-1;width:100%}
  .event-row{grid-template-columns:minmax(0,1fr) 70px!important;padding:8px;border:1px solid rgba(255,255,255,.06);border-radius:10px;margin-bottom:8px!important}
  .event-row .event-player,.event-row .event-assist{grid-column:1/-1!important}.event-row .remove-row{grid-column:1/-1!important;width:100%}
  .match-stat-row{grid-template-columns:92px minmax(0,1fr) minmax(0,1fr)!important}
  .match-stat-row input{min-width:0}.admin-grid{grid-template-columns:1fr 1fr!important}
 }
 @media(max-width:560px){
  .admin-record-actions{grid-template-columns:1fr 1fr}.admin-grid{grid-template-columns:1fr!important}
  .stat-grid{grid-template-columns:1fr 1fr!important}.detail-box{border-radius:12px!important}
  .score-grid{grid-template-columns:1fr 54px 54px 1fr!important}.team-label{font-size:9px!important}
  select,input{font-size:16px!important}.lineup-row select,.sub-row select,.sub-row input,.event-row select,.event-row input,.match-stat-row input,.score-grid input{font-size:16px!important}
 }
 `;document.head.appendChild(style);
 const search=document.getElementById('playerSearch');
 if(search&&!search.dataset.rrFastSearch){
   search.dataset.rrFastSearch='1';let timer=0;
   search.addEventListener('input',e=>{e.stopImmediatePropagation();clearTimeout(timer);timer=setTimeout(()=>{try{if(typeof render==='function')render()}catch(err){console.warn('[NL4] fast search render failed',err)}},140);},true);
 }
 const playerContent=document.getElementById('playerStatsContent');
 const playerRows=document.getElementById('playerRows');
 if(playerContent?.hidden&&playerRows)playerRows.innerHTML='';
 document.getElementById('togglePlayerStats')?.addEventListener('click',()=>setTimeout(()=>{if(!playerContent?.hidden&&playerRows&&!playerRows.children.length){try{if(typeof render==='function')render()}catch(_){}}},0),true);
}

document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(!(b.classList.contains('detail-save')||/SAVE MATCH DETAILS/i.test(b.textContent||'')))return;
 restoreSavedSelections();
 const f=fixture(),info=read();
 setTimeout(()=>{saveInfo(f,info);setTimeout(()=>{inject();restoreSavedSelections();},0);},140);
},true);
const start=()=>{
 installMobileAndPerformanceFixes();
 const box=document.getElementById('fixtureDetail');if(!box)return;
 let queued=false;
 new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;if(box.classList.contains('open')&&fixture()){inject();restoreSavedSelections();}})}).observe(box,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-fixture-id']});
 if(box.classList.contains('open')){inject();restoreSavedSelections();}
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.NL4RecordRoomMatchInfo={inject,save,read,dataFor,restoreSavedSelections};
})();