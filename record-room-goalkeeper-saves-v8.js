// NL4 Record Room — goalkeeper saves calculation V8
(function(){
'use strict';
if(window.__NL4_RR_GK_SAVES_V8__) return;
window.__NL4_RR_GK_SAVES_V8__=true;
const VERSION='20260905-gk-saves-v8';
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘`]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();}
function num(v){const x=Number(v);return Number.isFinite(x)?x:null;}
function completed(s){return s&&s.homeScore!==null&&s.homeScore!==undefined&&s.awayScore!==null&&s.awayScore!==undefined;}
function isGK(p){return p&&norm(p.position)==='goalkeeper';}
function splitEvent(v){const p=String(v||'').split('|||');return {team:p[0]||'',name:p.slice(1).join('|||')||''};}
function ownGoalCount(saved,scoringTeam){
  return (Array.isArray(saved?.events)?saved.events:[]).filter(e=>{
    if(e?.type!=='goal') return false;
    const who=splitEvent(e.player);
    return who.team===scoringTeam && /own goal/i.test(String(who.name||e.player||''));
  }).length;
}
function matchSaveTotal(saved,side,fixture){
  const ownKey=side==='home'?'h':'a',oppKey=side==='home'?'a':'h';
  const stored=num(saved?.stats?.saves?.[ownKey]);
  const oppSot=num(saved?.stats?.sot?.[oppKey]);
  const conceded=num(side==='home'?saved?.awayScore:saved?.homeScore);
  const opponent=side==='home'?fixture?.away:fixture?.home;
  if(oppSot!==null&&conceded!==null){
    // SOT = goals credited to the shooting team + goalkeeper saves.
    // Own goals are not opponent shots on target, so remove them from goals conceded before subtraction.
    const ownGoals=ownGoalCount(saved,opponent);
    const creditedGoals=Math.max(0,conceded-ownGoals);
    return Math.max(0,oppSot-creditedGoals);
  }
  return Math.max(0,stored??0);
}
function resolver(players){
  const m=new Map();(players||[]).forEach(p=>{const k=norm(p.name);if(k&&!m.has(k))m.set(k,p);});
  return name=>m.get(norm(name))||null;
}
function goalkeeperParticipants(saved,side,resolve){
  const lineup=Array.isArray(saved?.[side+'Lineup'])?saved[side+'Lineup'].filter(Boolean):[];
  const subs=Array.isArray(saved?.[side+'Subs'])?saved[side+'Subs']:[];
  const names=new Set(lineup);
  subs.forEach(s=>{if(s?.out)names.add(s.out);if(s?.in)names.add(s.in);});
  let keepers=[...names].map(name=>({name,player:resolve(name)})).filter(x=>isGK(x.player));
  if(!keepers.length&&lineup[0]){
    const p=resolve(lineup[0]);
    if(p) keepers=[{name:lineup[0],player:p,fallback:true}];
  }
  return {lineup,subs,keepers};
}
function perKeeperMap(saved,team){
  const raw=saved?.goalkeeperSaves||saved?.playerGoalkeeperSaves||{};
  const out=new Map();
  Object.entries(raw||{}).forEach(([k,v])=>{
    let name=k;
    if(k.includes('|||')){const parts=k.split('|||');if(parts[0]!==team)return;name=parts.slice(1).join('|||');}
    const n=num(v);if(n!==null)out.set(norm(name),Math.max(0,n));
  });
  return out;
}
function recalcTeam(team){
  if(typeof db==='undefined'||!db[team]||typeof ALL_FIXTURES==='undefined')return {team,issues:[]};
  const players=Array.isArray(db[team].players)?db[team].players:[];
  const resolve=resolver(players);players.forEach(p=>p.saves=0);
  const issues=[];
  Object.entries(db[team].fixtureData||{}).forEach(([fid,saved])=>{
    if(!completed(saved))return;
    const f=ALL_FIXTURES.find(x=>String(x.id)===String(fid));if(!f)return;
    const side=f.home===team?'home':f.away===team?'away':null;if(!side)return;
    const total=matchSaveTotal(saved,side,f);
    const ownKey=side==='home'?'h':'a';
    saved.stats=saved.stats||{};saved.stats.saves=saved.stats.saves||{h:0,a:0};
    // Match-derived total is authoritative whenever SOT + score are available.
    saved.stats.saves[ownKey]=total;
    const {keepers}=goalkeeperParticipants(saved,side,resolve);
    const split=perKeeperMap(saved,team);
    if(split.size){
      let assigned=0;
      keepers.forEach(k=>{const v=split.get(norm(k.name));if(v!==undefined){k.player.saves+=v;assigned+=v;}});
      if(assigned!==total)issues.push(`${f.home} vs ${f.away}: per-goalkeeper saves ${assigned} do not equal match-derived team saves ${total}`);
      return;
    }
    if(keepers.length===1){keepers[0].player.saves+=total;return;}
    if(keepers.length===0){issues.push(`${f.home} vs ${f.away}: no goalkeeper resolved for ${team}; team saves=${total}`);return;}
    issues.push(`${f.home} vs ${f.away}: ${team} used multiple goalkeepers; verified individual split required for ${total} saves`);
  });
  return {team,issues};
}
function recalcAll(){
  if(typeof db==='undefined')return [];
  const results=Object.keys(db).map(recalcTeam);
  try{if(typeof persist==='function')persist();}catch(_){}
  try{if(typeof render==='function')render();}catch(_){}
  const issues=results.flatMap(r=>r.issues.map(x=>`${r.team}: ${x}`));
  if(issues.length)console.warn('[NL4 Record Room] goalkeeper save audit',issues);
  try{localStorage.setItem('nl4_rr_gk_saves_version',VERSION);}catch(_){}
  return results;
}
function installCalculatorWrapper(){
  const base=window.recalculatePlayerStatsFromFixtures;
  if(typeof base!=='function'||base.__nl4GkV8)return;
  const wrapped=function(team){const r=base(team);recalcTeam(team);return r;};
  wrapped.__nl4GkV8=true;
  wrapped.__nl4Base=base;
  window.recalculatePlayerStatsFromFixtures=wrapped;
}
function installSaveWrapper(){
  const base=window.saveFixtureDetails;
  if(typeof base!=='function'||base.__nl4GkV8)return;
  const wrapped=function(){const r=base.apply(this,arguments);setTimeout(()=>{installCalculatorWrapper();recalcAll();},0);return r;};
  wrapped.__nl4GkV8=true;
  window.saveFixtureDetails=wrapped;
}
function install(){installCalculatorWrapper();installSaveWrapper();recalcAll();}
window.NL4RecordRoomGoalkeeperSaves={version:VERSION,recalcTeam,recalcAll,matchSaveTotal,install};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,1100),{once:true});else setTimeout(install,1100);
})();
