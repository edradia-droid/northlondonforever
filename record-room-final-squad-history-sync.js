(() => {
'use strict';
if(!window.NL4_FINAL_PL_SQUADS)return;
const FINAL=window.NL4_FINAL_PL_SQUADS;
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const toks=v=>new Set(norm(v).split(' ').filter(Boolean));
const htmlEsc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const blank=(name,position='Midfielder',number=null)=>({name,position,number,appearances:0,starts:0,minutes:0,goals:0,assists:0,cleanSheets:0,yellowCards:0,redCards:0,mom:0,shots:0,shotsOnTarget:0,chancesCreated:0,tackles:0,interceptions:0,saves:0});
const overlap=(a,b)=>{const A=toks(a),B=toks(b);let n=0;A.forEach(x=>{if(B.has(x))n++});return n};
function bestExisting(entry,existing){
  const en=norm(entry.name),wn=norm(entry.webName);
  let best=null,bestScore=0;
  for(const p of existing||[]){
    const pn=norm(p.name);let s=0;
    if(pn===en)s=100;
    else if(wn&&pn===wn)s=95;
    else if(wn&&pn.split(' ').includes(wn))s=85;
    else {const o=overlap(entry.name,p.name);if(o>=2)s=70+o;else if(o===1&&en.split(' ').length===1)s=55;}
    if(s>bestScore){best=p;bestScore=s;}
  }
  return bestScore>=70?best:null;
}
function currentRoster(team){
  const feed=FINAL[team]||[];
  const seeded=(typeof TEAM_ROSTERS!=='undefined'&&TEAM_ROSTERS[team])||[];
  const saved=(typeof db!=='undefined'&&db?.[team]?.players)||[];
  const candidates=[...seeded,...saved];
  const used=new Set();
  return feed.map(e=>{
    const old=bestExisting(e,candidates.filter(p=>!used.has(p)));
    if(old)used.add(old);
    return {name:old?.name||e.name,position:old?.position||e.position||'Midfielder',number:old?.number??e.number??null,webName:e.webName,fplId:e.fplId,current:true};
  });
}
function eventPerson(v){const p=String(v||'').split('|||');return {team:p.shift()||'',name:p.join('|||')||''};}
function historicalNames(team){
  const out=new Set();
  const fd=db?.[team]?.fixtureData||{};
  Object.values(fd).forEach(s=>{
    ['homeLineup','awayLineup'].forEach(k=>(Array.isArray(s?.[k])?s[k]:[]).forEach(n=>{if(n)out.add(n)}));
    ['homeSubs','awaySubs'].forEach(k=>(Array.isArray(s?.[k])?s[k]:[]).forEach(r=>{if(r?.out)out.add(r.out);if(r?.in)out.add(r.in)}));
    (Array.isArray(s?.events)?s.events:[]).forEach(ev=>{const a=eventPerson(ev?.player),b=eventPerson(ev?.assist);if(a.team===team&&a.name)out.add(a.name);if(b.team===team&&b.name)out.add(b.name)});
    const m=eventPerson(s?.manOfTheMatch);if(m.team===team&&m.name)out.add(m.name);
  });
  return out;
}
function mergeTeam(team){
  if(typeof db==='undefined'||!db?.[team])return;
  const current=currentRoster(team);
  const prior=Array.isArray(db[team].players)?db[team].players:[];
  const historical=historicalNames(team);
  const merged=[];
  const claimed=new Set();
  current.forEach(c=>{
    const old=bestExisting({name:c.name,webName:c.webName},prior.filter(p=>!claimed.has(p)));
    if(old)claimed.add(old);
    merged.push({...blank(c.name,c.position,c.number),...(old||{}),name:c.name,position:c.position,number:c.number,current:true,historical:false,webName:c.webName,fplId:c.fplId});
  });
  prior.forEach(p=>{
    if(claimed.has(p)||!p?.name)return;
    merged.push({...blank(p.name,p.position||'Midfielder',p.number??null),...p,current:false,historical:true});
  });
  historical.forEach(name=>{
    if(!merged.some(p=>norm(p.name)===norm(name)))merged.push({...blank(name),current:false,historical:true});
  });
  db[team].players=merged;
  if(typeof TEAM_ROSTERS!=='undefined')TEAM_ROSTERS[team]=current.map(({name,position,number})=>({name,position,number}));
  if(typeof PLAYER_DIRECTORY!=='undefined')PLAYER_DIRECTORY[norm(team)]=TEAM_ROSTERS[team].map(p=>({...p}));
}
function installCurrentRosterFunctions(){
  rosterForTeam=function(team){return ((typeof TEAM_ROSTERS!=='undefined'&&TEAM_ROSTERS[team])||[]).map(p=>typeof blankPlayer==='function'?blankPlayer(p):blank(p.name,p.position,p.number));};
  teamPlayers=function(team){
    const currentNames=new Set(((typeof TEAM_ROSTERS!=='undefined'&&TEAM_ROSTERS[team])||[]).map(p=>norm(p.name)));
    return (db?.[team]?.players||[]).filter(p=>currentNames.has(norm(p.name)));
  };
  window.rosterForTeam=rosterForTeam;window.teamPlayers=teamPlayers;
}
function selectedOption(team,selected=''){
  const players=teamPlayers(team);let found=false;
  let options='<option value="">Select player…</option>'+players.map(p=>{const hit=p.name===selected;found=found||hit;return `<option value="${htmlEsc(p.name)}" ${hit?'selected':''}>${p.number?`#${p.number} • `:''}${htmlEsc(p.name)}</option>`}).join('');
  if(selected&&!found)options+=`<option value="${htmlEsc(selected)}" selected>Saved • ${htmlEsc(selected)}</option>`;
  return options;
}
function installHistoricalDropdowns(){
  playerOptions=function(team,selected=''){return selectedOption(team,selected)};window.playerOptions=playerOptions;
  eventRowHtml=function(f,r={}){
    const all=[...teamPlayers(f.home).map(p=>({...p,team:f.home})),...teamPlayers(f.away).map(p=>({...p,team:f.away}))];
    const make=(selected,none)=>{let found=false;let s=`<option value="">${none}</option>`+all.map(p=>{const value=`${p.team}|||${p.name}`;const hit=value===selected;found=found||hit;return `<option value="${htmlEsc(value)}" ${hit?'selected':''}>${htmlEsc(p.name)} — ${htmlEsc(p.team)}</option>`}).join('');if(selected&&!found){const q=eventPerson(selected);s+=`<option value="${htmlEsc(selected)}" selected>Saved • ${htmlEsc(q.name||selected)}${q.team?' — '+htmlEsc(q.team):''}</option>`}return s;};
    return `<div class="event-row"><select class="event-type"><option ${r.type==='goal'?'selected':''} value="goal">Goal</option><option ${r.type==='yellow'?'selected':''} value="yellow">Yellow card</option><option ${r.type==='red'?'selected':''} value="red">Red card</option></select><input class="event-min" type="number" min="0" max="120" placeholder="MIN" value="${r.minute??''}"><select class="event-player">${make(r.player,'Player…')}</select><select class="event-assist assist-select">${make(r.assist,'No assist / N/A')}</select><button class="remove-row" type="button" onclick="this.parentElement.remove()">×</button></div>`;
  };window.eventRowHtml=eventRowHtml;
  motmOptions=function(f,selected=''){
    const all=[...teamPlayers(f.home).map(p=>({...p,team:f.home})),...teamPlayers(f.away).map(p=>({...p,team:f.away}))];let found=false;
    let s='<option value="">Select Man of the Match…</option>'+all.map(p=>{const value=`${p.team}|||${p.name}`;const hit=value===selected;found=found||hit;return `<option value="${htmlEsc(value)}" ${hit?'selected':''}>${p.number?`#${p.number} • `:''}${htmlEsc(p.name)} — ${htmlEsc(p.team)}</option>`}).join('');
    if(selected&&!found){const q=eventPerson(selected);s+=`<option value="${htmlEsc(selected)}" selected>Saved • ${htmlEsc(q.name||selected)}${q.team?' — '+htmlEsc(q.team):''}</option>`}return s;
  };window.motmOptions=motmOptions;
}
function syncAll(){
  if(typeof TEAMS==='undefined'||typeof db==='undefined')return false;
  TEAMS.forEach(mergeTeam);installCurrentRosterFunctions();installHistoricalDropdowns();
  TEAMS.forEach(team=>{try{if(typeof recalculatePlayerStatsFromFixtures==='function')recalculatePlayerStatsFromFixtures(team);if(typeof recalculateClubStatsFromFixtures==='function')recalculateClubStatsFromFixtures(team)}catch(e){console.warn('[NL4] squad-history recalc',team,e)}});
  try{if(typeof persist==='function')persist()}catch(_){ }
  window.__NL4_FINAL_SQUAD_SYNC_READY__=true;
  const marker=document.getElementById('buildMarker');if(marker)marker.textContent='BUILD V28 • FINAL SQUADS + HISTORICAL MATCH PLAYERS';
  const note=document.querySelector('.admin-note');if(note)note.dataset.finalSquads='2026-09-03';
  try{if(typeof render==='function')render()}catch(e){console.warn('[NL4] final squad render',e)}
  return true;
}
window.NL4FinalSquadHistorySync={syncAll};
syncAll();
})();
