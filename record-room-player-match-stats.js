(() => {
'use strict';
if (window.__NL4_RR_PLAYER_MATCH_STATS_V1__) return;
window.__NL4_RR_PLAYER_MATCH_STATS_V1__ = true;

const FIELDS = [
  ['shots','SHOTS'],
  ['shotsOnTarget','SOT'],
  ['chancesCreated','CHANCES'],
  ['tackles','TACKLES'],
  ['interceptions','INTERCEPTIONS']
];
const num = v => Math.max(0, Number(v) || 0);
const key = (team,name) => `${team}|||${name}`;
const nameKey = v => String(v || '').trim().toLowerCase();
const esc = v => String(v ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

function currentFixture(){
  const box=document.getElementById('fixtureDetail');
  const id=Number(box?.dataset?.fixtureId);
  if(!Number.isFinite(id) || typeof ALL_FIXTURES==='undefined') return null;
  return ALL_FIXTURES.find(f=>Number(f.id)===id)||null;
}
function selectedNames(side){
  const names=new Set();
  document.querySelectorAll(`[data-lineup="${side}"]`).forEach(el=>{if(el.value)names.add(el.value)});
  document.querySelectorAll(`#${side}Subs .sub-row`).forEach(row=>{
    const out=row.querySelector('.sub-out')?.value;
    const inn=row.querySelector('.sub-in')?.value;
    if(out)names.add(out); if(inn)names.add(inn);
  });
  return [...names];
}
function recordFor(f){
  if(typeof db==='undefined') return null;
  const selected=document.getElementById('teamSelect')?.value;
  return db?.[selected]?.fixtureData?.[f.id] || db?.[f.home]?.fixtureData?.[f.id] || db?.[f.away]?.fixtureData?.[f.id] || null;
}
function draftFromPanel(){
  const out={};
  document.querySelectorAll('#rrPlayerMatchStatsRows [data-player-team][data-player-name]').forEach(row=>{
    const team=row.dataset.playerTeam,name=row.dataset.playerName;
    const rec={};
    FIELDS.forEach(([field])=>rec[field]=num(row.querySelector(`[data-player-stat="${field}"]`)?.value));
    out[key(team,name)]=rec;
  });
  return out;
}
function inject(){
  const box=document.getElementById('fixtureDetail');
  const f=currentFixture();
  if(!box||!f||!box.classList.contains('open')) return;
  const previous=draftFromPanel();
  const stored=recordFor(f)?.playerMatchStats||{};
  const merged={...stored,...previous};
  const people=[...selectedNames('home').map(name=>({team:f.home,name})),...selectedNames('away').map(name=>({team:f.away,name}))];
  let panel=document.getElementById('rrPlayerMatchStatsBox');
  if(!panel){
    panel=document.createElement('div'); panel.id='rrPlayerMatchStatsBox'; panel.className='detail-box'; panel.style.marginTop='14px'; box.appendChild(panel);
  }
  panel.innerHTML=`<h4>Player match stats</h4><p class="admin-note">Only players in the starting XI or substitutions are shown. Enter each player's match totals; season totals are rebuilt automatically when you save.</p><div class="table-wrap"><table class="stats-table" style="min-width:760px"><thead><tr><th>PLAYER</th><th>TEAM</th>${FIELDS.map(([,label])=>`<th>${label}</th>`).join('')}</tr></thead><tbody id="rrPlayerMatchStatsRows">${people.map(p=>{const r=merged[key(p.team,p.name)]||{};return `<tr data-player-team="${esc(p.team)}" data-player-name="${esc(p.name)}"><td>${esc(p.name)}</td><td>${esc(p.team)}</td>${FIELDS.map(([field])=>`<td><input data-player-stat="${field}" type="number" min="0" step="1" value="${num(r[field])}" style="width:72px;padding:7px"></td>`).join('')}</tr>`}).join('')}</tbody></table></div>${people.length?'':'<div class="fixture-empty">Select the starting lineups/substitutions to enter player match stats.</div>'}`;
}
function captureToFixture(){
  const f=currentFixture(); if(!f||typeof db==='undefined') return;
  const stats=draftFromPanel();
  [f.home,f.away].forEach(team=>{
    const rec=db?.[team]?.fixtureData?.[f.id];
    if(rec) rec.playerMatchStats=JSON.parse(JSON.stringify(stats));
  });
}
function aggregateTeam(team){
  if(typeof db==='undefined'||!db?.[team])return;
  const players=Array.isArray(db[team].players)?db[team].players:[];
  const byName=new Map(players.map(p=>[nameKey(p.name),p]));
  players.forEach(p=>FIELDS.forEach(([field])=>p[field]=0));
  Object.entries(db[team].fixtureData||{}).forEach(([fixtureId,rec])=>{
    if(!rec?.playerMatchStats)return;
    Object.entries(rec.playerMatchStats).forEach(([compound,vals])=>{
      const split=compound.indexOf('|||'); if(split<0)return;
      const statTeam=compound.slice(0,split),name=compound.slice(split+3);
      if(statTeam!==team)return;
      const p=byName.get(nameKey(name)); if(!p)return;
      FIELDS.forEach(([field])=>p[field]+=num(vals?.[field]));
    });
  });
}
function finishSave(f){
  if(!f)return;
  captureToFixture();
  [f.home,f.away].forEach(aggregateTeam);
  try{if(typeof persist==='function')persist()}catch(e){console.warn('[NL4] Player match stats persist failed',e)}
  try{if(typeof render==='function')render(); if(typeof openFixture==='function')openFixture(f.id)}catch(e){console.warn('[NL4] Player match stats render failed',e)}
  window.dispatchEvent(new CustomEvent('nl4:record-room-player-match-stats-saved',{detail:{fixtureId:f.id}}));
  if(f.home==='Arsenal'||f.away==='Arsenal') setTimeout(()=>window.NL4RecordRoomArsenalPublicSync?.queue?.(50),80);
}

const originalOpen=window.openFixture;
if(typeof originalOpen==='function'){
  window.openFixture=function(id){const r=originalOpen.apply(this,arguments);setTimeout(inject,0);return r;};
}
const originalSave=window.saveFixtureDetails;
if(typeof originalSave==='function'){
  window.saveFixtureDetails=function(){
    const f=currentFixture();
    const pending=draftFromPanel();
    const r=originalSave.apply(this,arguments);
    // Native save re-renders the detail. Restore the values captured before it ran,
    // then aggregate them after the canonical fixture has been mirrored to both clubs.
    if(f&&typeof db!=='undefined'){
      [f.home,f.away].forEach(team=>{const rec=db?.[team]?.fixtureData?.[f.id];if(rec)rec.playerMatchStats=JSON.parse(JSON.stringify(pending));});
      [f.home,f.away].forEach(aggregateTeam);
      try{if(typeof persist==='function')persist()}catch(_){}
      setTimeout(()=>{try{if(typeof render==='function')render(); originalOpen.call(window,f.id); setTimeout(inject,0);}catch(_){};window.dispatchEvent(new CustomEvent('nl4:record-room-player-match-stats-saved',{detail:{fixtureId:f.id}}));if(f.home==='Arsenal'||f.away==='Arsenal')window.NL4RecordRoomArsenalPublicSync?.queue?.(80);},0);
    }
    return r;
  };
}

document.addEventListener('change',e=>{
  if(e.target.matches('[data-lineup],.sub-out,.sub-in')) setTimeout(inject,0);
});
window.NL4RecordRoomPlayerMatchStats={inject,aggregateTeam,captureToFixture};
})();