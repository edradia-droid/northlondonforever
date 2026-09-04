// NL4 Record Room — rendered match-event player visibility repair.
// Runs only on record-room.html through the existing Record Room extension chain.
// Does not replace the save/stat/recalculation model.
(function(){
'use strict';
const VERSION='20260904-event-dom-v3';
const KEY='nl4_rr_event_display_fix_version';
let syncing=false;

function split(value){
  const parts=String(value||'').split('|||');
  return {team:parts[0]||'',name:parts.slice(1).join('|||')||''};
}
function labelFor(value){
  const x=split(value);
  return x.name&&x.team?`${x.name} — ${x.team}`:(x.name||value||'');
}
function ensureOption(select,value,label){
  if(!select||!value)return;
  let option=[...select.options].find(o=>o.value===value);
  if(!option){
    option=document.createElement('option');
    option.value=value;
    option.textContent=label||labelFor(value);
    select.appendChild(option);
  }
  select.value=value;
}
function currentFixtureAndState(){
  const box=document.getElementById('fixtureDetail');
  const id=Number(box?.dataset?.fixtureId);
  if(!box?.classList.contains('open')||!Number.isFinite(id)||typeof ALL_FIXTURES==='undefined'||typeof db==='undefined')return null;
  const f=ALL_FIXTURES.find(x=>Number(x.id)===id);
  if(!f)return null;
  const selected=(typeof teamSelect!=='undefined'&&teamSelect?.value)||'';
  const club=db[selected]?selected:(db[f.home]?f.home:(db[f.away]?f.away:null));
  const s=club?db?.[club]?.fixtureData?.[id]:null;
  return s?{f,s,box}:null;
}
function forceEventRows(){
  if(syncing)return;
  const ctx=currentFixtureAndState();
  if(!ctx)return;
  const {f,s}=ctx;
  const events=Array.isArray(s.events)?s.events:[];
  const holder=document.getElementById('eventRows');
  if(!holder)return;
  syncing=true;
  try{
    // If the UI has stale/partial rows, rebuild the row count from the canonical saved events.
    let rows=[...holder.querySelectorAll('.event-row')];
    if(rows.length!==events.length && typeof eventRowsHtml==='function'){
      holder.innerHTML=eventRowsHtml(f,events);
      rows=[...holder.querySelectorAll('.event-row')];
    }
    events.forEach((ev,i)=>{
      const row=rows[i];if(!row)return;
      const type=row.querySelector('.event-type');
      const minute=row.querySelector('.event-min');
      const player=row.querySelector('.event-player');
      const assist=row.querySelector('.event-assist');
      if(type)type.value=ev.type||'goal';
      if(minute)minute.value=ev.minute??'';
      if(ev.player)ensureOption(player,ev.player,labelFor(ev.player));
      if(assist){
        if(ev.assist)ensureOption(assist,ev.assist,labelFor(ev.assist));
        else assist.value='';
      }
    });
  }finally{syncing=false;}
}
function scheduleSync(){
  setTimeout(forceEventRows,0);
  setTimeout(forceEventRows,80);
  setTimeout(forceEventRows,220);
}
function audit(){
  if(typeof ALL_FIXTURES==='undefined'||typeof db==='undefined')return [];
  const errors=[];
  ALL_FIXTURES.forEach(f=>{
    const club=db[f.home]?f.home:(db[f.away]?f.away:null);if(!club)return;
    const s=db[club]?.fixtureData?.[f.id];
    if(!s||s.homeScore==null||s.awayScore==null)return;
    const events=Array.isArray(s.events)?s.events:[];
    const goals=events.filter(e=>e.type==='goal');
    const expected=Number(s.homeScore)+Number(s.awayScore);
    if(goals.length!==expected)errors.push(`${f.home} vs ${f.away}: ${goals.length}/${expected} goal events`);
    events.forEach((e,i)=>{
      if(!e.type||!e.player||!Number.isFinite(Number(e.minute)))errors.push(`${f.home} vs ${f.away}: event ${i+1} incomplete`);
      if(e.type==='goal'&&e.assist){const a=split(e.assist);if(!a.team||!a.name)errors.push(`${f.home} vs ${f.away}: assist ${i+1} incomplete`);}
    });
  });
  return errors;
}
function hook(){
  const box=document.getElementById('fixtureDetail');
  if(box&&!box.dataset.eventDomFix){
    box.dataset.eventDomFix='1';
    new MutationObserver(scheduleSync).observe(box,{childList:true,subtree:true});
  }
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.fixture-open,[data-open-match],#rrImportCompleted,.detail-save'))scheduleSync();
  },true);

  const btn=document.getElementById('rrImportCompleted');
  if(localStorage.getItem(KEY)!==VERSION){
    // Use the existing verified importer + participation repair to refresh canonical events,
    // then force those exact values into the rendered event controls.
    if(btn){
      btn.click();
      setTimeout(()=>{
        scheduleSync();
        const errors=audit();
        if(errors.length)console.error('[NL4 Record Room] match-event audit',errors);
        localStorage.setItem(KEY,VERSION);
      },350);
    }else{
      setTimeout(hook,250);return;
    }
  }else scheduleSync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(hook,650));else setTimeout(hook,650);
})();