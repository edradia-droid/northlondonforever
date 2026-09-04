// NL4 Record Room — match-event selected-player visibility repair.
// Keeps the existing Record Room data model and calculations unchanged.
(function(){
'use strict';
const VERSION='20260904-event-display-v2';
const KEY='nl4_rr_event_display_fix_version';
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const split=value=>{const p=String(value||'').split('|||');return {team:p[0]||'',name:p.slice(1).join('|||')||''};};
function rosterEntries(f){
  const all=[];
  if(typeof teamPlayers==='function'){
    (teamPlayers(f.home)||[]).forEach(p=>all.push({team:f.home,name:p.name,number:p.number||''}));
    (teamPlayers(f.away)||[]).forEach(p=>all.push({team:f.away,name:p.name,number:p.number||''}));
  }
  return all;
}
function addSelected(all,value){
  const s=split(value);if(!s.team||!s.name)return;
  if(!all.some(p=>p.team===s.team&&p.name===s.name))all.push({team:s.team,name:s.name,number:''});
}
function optionHtml(all,selected,blankLabel){
  return `<option value="">${blankLabel}</option>`+all.map(p=>{
    const value=`${p.team}|||${p.name}`;
    const label=`${p.number?`#${p.number} • `:''}${p.name} — ${p.team}`;
    return `<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(label)}</option>`;
  }).join('');
}
function patchEventRenderer(){
  if(typeof window.eventRowHtml!=='function'||window.eventRowHtml.__nl4EventDisplayFix)return false;
  const patched=function(f,r={}){
    const all=rosterEntries(f);
    addSelected(all,r.player);addSelected(all,r.assist);
    // Also include every player already involved in the saved match so subsequent manual edits stay visible.
    try{
      const team=(typeof teamSelect!=='undefined'&&teamSelect?.value)||null;
      const saved=team&&typeof db!=='undefined'?db?.[team]?.fixtureData?.[f.id]:null;
      (saved?.homeLineup||[]).filter(Boolean).forEach(name=>addSelected(all,`${f.home}|||${name}`));
      (saved?.awayLineup||[]).filter(Boolean).forEach(name=>addSelected(all,`${f.away}|||${name}`));
      [...(saved?.homeSubs||[]),...(saved?.awaySubs||[])].forEach(s=>{
        const side=(saved?.homeLineup||[]).includes(s.out)||(saved?.homeSubs||[]).some(x=>x.in===s.out)?f.home:f.away;
        if(s.out)addSelected(all,`${side}|||${s.out}`);
        if(s.in)addSelected(all,`${side}|||${s.in}`);
      });
      (saved?.events||[]).forEach(ev=>{addSelected(all,ev.player);addSelected(all,ev.assist);});
    }catch(_){ }
    all.sort((a,b)=>a.team.localeCompare(b.team)||a.name.localeCompare(b.name));
    const options=optionHtml(all,r.player,'Player…');
    const assist=optionHtml(all,r.assist,'No assist / N/A');
    return `<div class="event-row">
      <select class="event-type"><option ${r.type==='goal'?'selected':''} value="goal">Goal</option><option ${r.type==='yellow'?'selected':''} value="yellow">Yellow card</option><option ${r.type==='red'?'selected':''} value="red">Red card</option></select>
      <input class="event-min" type="number" min="0" max="130" placeholder="MIN" value="${r.minute??''}">
      <select class="event-player">${options}</select>
      <select class="event-assist assist-select">${assist}</select>
      <button class="remove-row" type="button" onclick="this.parentElement.remove()">×</button>
    </div>`;
  };
  patched.__nl4EventDisplayFix=true;
  window.eventRowHtml=patched;
  return true;
}
function auditEvents(){
  if(typeof ALL_FIXTURES==='undefined'||typeof db==='undefined')return [];
  const errors=[];
  ALL_FIXTURES.forEach(f=>{
    const club=db[f.home]?f.home:(db[f.away]?f.away:null);if(!club)return;
    const s=db[club]?.fixtureData?.[f.id];if(!s||s.homeScore==null||s.awayScore==null)return;
    const goals=(s.events||[]).filter(e=>e.type==='goal');
    if(goals.length!==Number(s.homeScore)+Number(s.awayScore))errors.push(`${f.home} vs ${f.away}: ${goals.length} goal event(s) for ${Number(s.homeScore)+Number(s.awayScore)} goals`);
    (s.events||[]).forEach((e,i)=>{
      if(!e.player||!e.type||!Number.isFinite(Number(e.minute)))errors.push(`${f.home} vs ${f.away}: event ${i+1} incomplete`);
      if(e.type==='goal'&&e.assist){const a=split(e.assist);if(!a.team||!a.name)errors.push(`${f.home} vs ${f.away}: goal ${i+1} assist incomplete`);}
    });
  });
  return errors;
}
function refreshOpenFixture(){
  const box=document.getElementById('fixtureDetail');
  const id=Number(box?.dataset?.fixtureId);
  if(box?.classList.contains('open')&&Number.isFinite(id)&&typeof openFixture==='function')openFixture(id);
}
function run(){
  patchEventRenderer();
  // Re-run the already installed verified full-data/event repair through its normal button hook.
  if(localStorage.getItem(KEY)!==VERSION){
    const btn=document.getElementById('rrImportCompleted');
    if(btn){btn.click();setTimeout(()=>{patchEventRenderer();refreshOpenFixture();const errors=auditEvents();if(errors.length)console.error('[NL4 Record Room] event audit',errors);localStorage.setItem(KEY,VERSION);},180);}
    else {setTimeout(run,250);return;}
  }else refreshOpenFixture();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,700));else setTimeout(run,700);
})();