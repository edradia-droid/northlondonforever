(() => {
'use strict';
if (window.__NL4_RR_PLAYER_MATCH_STATS_V3__) return;
window.__NL4_RR_PLAYER_MATCH_STATS_V3__ = true;

const FIELDS=[['shots','SHOTS'],['shotsOnTarget','SOT'],['chancesCreated','CHANCES'],['tackles','TACKLES'],['interceptions','INTERCEPTIONS']];
const num=v=>Math.max(0,Number(v)||0);
const compound=(team,name)=>`${team}|||${name}`;
const nameKey=v=>String(v||'').trim().toLowerCase();
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[m]));

function currentFixture(){
 const box=document.getElementById('fixtureDetail');
 const id=Number(box?.dataset?.fixtureId);
 if(!Number.isFinite(id)||typeof ALL_FIXTURES==='undefined')return null;
 return ALL_FIXTURES.find(f=>Number(f.id)===id)||null;
}
function selectedNames(side){
 const names=new Set();
 document.querySelectorAll(`[data-lineup="${side}"]`).forEach(el=>{if(el.value)names.add(el.value)});
 document.querySelectorAll(`#${side}Subs .sub-row`).forEach(row=>{
   const out=row.querySelector('.sub-out')?.value,inn=row.querySelector('.sub-in')?.value;
   if(out)names.add(out);if(inn)names.add(inn);
 });
 return [...names];
}
function recordFor(f){
 if(typeof db==='undefined')return null;
 const selected=document.getElementById('teamSelect')?.value;
 return db?.[selected]?.fixtureData?.[f.id]||db?.[f.home]?.fixtureData?.[f.id]||db?.[f.away]?.fixtureData?.[f.id]||null;
}
function isCompleted(f){
 const rec=recordFor(f);
 return !!rec && rec.homeScore!==null && rec.homeScore!==undefined && rec.homeScore!=='' && rec.awayScore!==null && rec.awayScore!==undefined && rec.awayScore!=='';
}
function draftFromPanel(){
 const out={};
 document.querySelectorAll('#rrPlayerMatchStatsRows [data-player-team][data-player-name]').forEach(row=>{
   const team=row.dataset.playerTeam,name=row.dataset.playerName,rec={};
   FIELDS.forEach(([field])=>rec[field]=num(row.querySelector(`[data-player-stat="${field}"]`)?.value));
   out[compound(team,name)]=rec;
 });
 return out;
}
function inject(){
 const box=document.getElementById('fixtureDetail'),f=currentFixture();
 if(!box||!f||!box.classList.contains('open'))return;
 const existing=document.getElementById('rrPlayerMatchStatsBox');
 if(!isCompleted(f)){
   if(existing)existing.remove();
   return;
 }
 const previous=draftFromPanel(),stored=recordFor(f)?.playerMatchStats||{},merged={...stored,...previous};
 const people=[...selectedNames('home').map(name=>({team:f.home,name})),...selectedNames('away').map(name=>({team:f.away,name}))];
 let panel=existing;
 if(!panel){
   panel=document.createElement('div');panel.id='rrPlayerMatchStatsBox';panel.className='detail-box';panel.style.marginTop='14px';
   const grids=box.querySelectorAll('.detail-grid-2');
   const anchor=grids.length?grids[grids.length-1]:null;
   if(anchor)anchor.insertAdjacentElement('afterend',panel);else box.appendChild(panel);
 }
 panel.innerHTML=`<h4 style="color:#d8ad45">Player Match Stats</h4><p class="admin-note">Completed-match individual totals only. Enter each player's match figures; season totals are recalculated automatically.</p><div class="table-wrap"><table class="stats-table" style="min-width:760px"><thead><tr><th>PLAYER</th><th>TEAM</th>${FIELDS.map(([,label])=>`<th>${label}</th>`).join('')}</tr></thead><tbody id="rrPlayerMatchStatsRows">${people.map(p=>{const r=merged[compound(p.team,p.name)]||{};return `<tr data-player-team="${esc(p.team)}" data-player-name="${esc(p.name)}"><td>${esc(p.name)}</td><td>${esc(p.team)}</td>${FIELDS.map(([field])=>`<td><input data-player-stat="${field}" type="number" min="0" step="1" value="${num(r[field])}" style="width:72px;padding:7px"></td>`).join('')}</tr>`}).join('')}</tbody></table></div>${people.length?'':'<div class="fixture-empty">Choose the starting lineups or substitutions above and the players will appear here.</div>'}`;
}
function captureToFixture(){
 const f=currentFixture();if(!f||!isCompleted(f)||typeof db==='undefined')return;
 const stats=draftFromPanel();
 [f.home,f.away].forEach(team=>{const rec=db?.[team]?.fixtureData?.[f.id];if(rec)rec.playerMatchStats=JSON.parse(JSON.stringify(stats));});
}
function aggregateTeam(team){
 if(typeof db==='undefined'||!db?.[team])return;
 const players=Array.isArray(db[team].players)?db[team].players:[],byName=new Map(players.map(p=>[nameKey(p.name),p]));
 players.forEach(p=>FIELDS.forEach(([field])=>p[field]=0));
 Object.values(db[team].fixtureData||{}).forEach(rec=>{
   if(!rec?.playerMatchStats)return;
   Object.entries(rec.playerMatchStats).forEach(([k,vals])=>{
     const i=k.indexOf('|||');if(i<0)return;
     const statTeam=k.slice(0,i),name=k.slice(i+3);if(statTeam!==team)return;
     const p=byName.get(nameKey(name));if(!p)return;
     FIELDS.forEach(([field])=>p[field]+=num(vals?.[field]));
   });
 });
}
function persistAdvanced(f,pending){
 if(!f||!isCompleted(f)||typeof db==='undefined')return;
 [f.home,f.away].forEach(team=>{const rec=db?.[team]?.fixtureData?.[f.id];if(rec)rec.playerMatchStats=JSON.parse(JSON.stringify(pending));});
 [f.home,f.away].forEach(aggregateTeam);
 try{if(typeof persist==='function')persist()}catch(e){console.warn('[NL4] Player match stats persist failed',e)}
 window.dispatchEvent(new CustomEvent('nl4:record-room-player-match-stats-saved',{detail:{fixtureId:f.id}}));
 if(f.home==='Arsenal'||f.away==='Arsenal')setTimeout(()=>window.NL4RecordRoomArsenalPublicSync?.queue?.(80),100);
}

document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(!(b.classList.contains('detail-save')||/SAVE MATCH DETAILS/i.test(b.textContent||'')))return;
 const f=currentFixture(),pending=draftFromPanel();
 setTimeout(()=>{persistAdvanced(f,pending);setTimeout(inject,0)},120);
},true);

document.addEventListener('change',e=>{
 if(e.target.matches('[data-lineup],.sub-out,.sub-in,.score-grid input'))setTimeout(inject,0);
});

const startObserver=()=>{
 const box=document.getElementById('fixtureDetail');if(!box)return;
 const observer=new MutationObserver(()=>{
   if(box.classList.contains('open')&&currentFixture())setTimeout(inject,0);
 });
 observer.observe(box,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-fixture-id']});
 if(box.classList.contains('open'))inject();
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startObserver,{once:true});else startObserver();

window.NL4RecordRoomPlayerMatchStats={inject,aggregateTeam,captureToFixture,isCompleted};
})();