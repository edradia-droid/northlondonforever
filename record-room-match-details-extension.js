/* NL4 Record Room • extended match details
 * Admin-only extension. Injects metadata fields without touching model logic.
 */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const numOrNull=v=>String(v??'').trim()===''?null:Number(v);

  function globals(){
    try{return {fixtures:eval('ALL_FIXTURES'),data:eval('db')};}catch(_){return null;}
  }
  function currentRecord(){
    try{
      const g=globals(); if(!g) return null;
      const id=Number($('fixtureDetail')?.dataset?.fixtureId);
      if(!Number.isFinite(id)) return null;
      const f=g.fixtures.find(x=>Number(x.id)===id); if(!f) return null;
      const owner=g.data[f.home]?f.home:(g.data[f.away]?f.away:null); if(!owner) return null;
      g.data[owner].fixtureData=g.data[owner].fixtureData||{};
      return {id,f,owner,s:g.data[owner].fixtureData[id]||{},data:g.data};
    }catch(_){return null;}
  }
  function inject(){
    const box=$('fixtureDetail');
    if(!box?.classList.contains('open')||$('rrExtendedDetails')) return false;
    const ctx=currentRecord(); if(!ctx) return false;
    const d=ctx.s.matchDetails||{};
    const scoreBox=box.querySelector('.detail-box'); if(!scoreBox) return false;
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
    return true;
  }
  function capture(){
    const ctx=currentRecord(); if(!ctx||!$('rrExtendedDetails')) return;
    const details={referee:$('rrReferee')?.value.trim()||'',venue:$('rrVenue')?.value.trim()||'',attendance:numOrNull($('rrAttendance')?.value),halftimeHomeScore:numOrNull($('rrHalfHome')?.value),halftimeAwayScore:numOrNull($('rrHalfAway')?.value),addedTime:Math.max(0,Math.min(30,Number($('rrAddedTime')?.value)||0))};
    [ctx.f.home,ctx.f.away].filter(t=>ctx.data[t]).forEach(team=>{
      ctx.data[team].fixtureData=ctx.data[team].fixtureData||{};
      const row=ctx.data[team].fixtureData[ctx.id]||{}; row.matchDetails={...details}; ctx.data[team].fixtureData[ctx.id]=row;
    });
  }
  function hookSaveButton(){
    document.addEventListener('pointerdown',e=>{if(e.target?.classList?.contains('detail-save'))capture();},true);
  }
  function start(){
    hookSaveButton();
    const timer=setInterval(()=>{inject();},250);
    window.addEventListener('beforeunload',()=>clearInterval(timer),{once:true});
    console.log('[NL4 Record Room] Extended match details watcher active');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
