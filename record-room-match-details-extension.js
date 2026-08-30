/* NL4 Record Room • extended match details
 * Admin-only extension. Injects metadata fields into the existing Record Room
 * without rewriting its large standalone HTML file or touching model logic.
 */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const numOrNull=v=>String(v??'').trim()===''?null:Number(v);

  function currentRecord(){
    try{
      const id=Number($('fixtureDetail')?.dataset?.fixtureId);
      if(!Number.isFinite(id)||typeof ALL_FIXTURES==='undefined'||typeof db==='undefined') return null;
      const f=ALL_FIXTURES.find(x=>Number(x.id)===id); if(!f) return null;
      const owner=db[f.home]?f.home:(db[f.away]?f.away:null); if(!owner) return null;
      db[owner].fixtureData=db[owner].fixtureData||{};
      return {id,f,owner,s:db[owner].fixtureData[id]||{}};
    }catch(_){return null;}
  }

  function inject(){
    const box=$('fixtureDetail');
    if(!box?.classList.contains('open')||$('rrExtendedDetails')) return;
    const ctx=currentRecord(); if(!ctx) return;
    const d=ctx.s.matchDetails||{};
    const scoreBox=box.querySelector('.detail-box');
    if(!scoreBox) return;
    scoreBox.insertAdjacentHTML('afterend',`<div class="detail-box" id="rrExtendedDetails" style="margin-top:15px">
      <h4>Match details</h4>
      <div class="admin-grid" style="margin-top:10px">
        <div class="field"><label>REFEREE</label><input id="rrReferee" value="${esc(d.referee||'')}" placeholder="Referee"></div>
        <div class="field"><label>VENUE</label><input id="rrVenue" value="${esc(d.venue||'')}" placeholder="Stadium / venue"></div>
        <div class="field"><label>ATTENDANCE</label><input id="rrAttendance" type="number" min="0" value="${d.attendance??''}" placeholder="Attendance"></div>
        <div class="field"><label>HALF-TIME • HOME</label><input id="rrHalfHome" type="number" min="0" value="${d.halftimeHomeScore??''}" placeholder="HT home"></div>
        <div class="field"><label>HALF-TIME • AWAY</label><input id="rrHalfAway" type="number" min="0" value="${d.halftimeAwayScore??''}" placeholder="HT away"></div>
        <div class="field"><label>ADDED TIME</label><input id="rrAddedTime" type="number" min="0" max="30" value="${d.addedTime??0}" placeholder="Minutes"></div>
      </div>
    </div>`);
  }

  function capture(){
    const ctx=currentRecord(); if(!ctx||!$('rrExtendedDetails')) return;
    const details={
      referee:$('rrReferee')?.value.trim()||'', venue:$('rrVenue')?.value.trim()||'',
      attendance:numOrNull($('rrAttendance')?.value), halftimeHomeScore:numOrNull($('rrHalfHome')?.value),
      halftimeAwayScore:numOrNull($('rrHalfAway')?.value), addedTime:Math.max(0,Math.min(30,Number($('rrAddedTime')?.value)||0))
    };
    const participants=[ctx.f.home,ctx.f.away].filter(t=>db[t]);
    participants.forEach(team=>{
      db[team].fixtureData=db[team].fixtureData||{};
      const row=db[team].fixtureData[ctx.id]||{};
      row.matchDetails={...details};
      db[team].fixtureData[ctx.id]=row;
    });
  }

  function wrapSave(){
    if(typeof window.saveFixtureDetails!=='function'||window.saveFixtureDetails.__rrExtended) return false;
    const original=window.saveFixtureDetails;
    const wrapped=function(){ capture(); return original.apply(this,arguments); };
    wrapped.__rrExtended=true;
    window.saveFixtureDetails=wrapped;
    return true;
  }

  const observer=new MutationObserver(()=>inject());
  const start=()=>{
    const box=$('fixtureDetail'); if(box) observer.observe(box,{childList:true,subtree:false});
    inject();
    let attempts=0; const timer=setInterval(()=>{attempts++; if(wrapSave()||attempts>40)clearInterval(timer);},100);
    console.log('[NL4 Record Room] Extended match details active');
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
