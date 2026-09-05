// NL4 Record Room — goalkeeper saves calculation V7
(function(){
'use strict';
const VERSION='20260905-gk-saves-v7';
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘`]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();}
function num(v){const x=Number(v);return Number.isFinite(x)?x:null;}
function completed(s){return s&&s.homeScore!==null&&s.homeScore!==undefined&&s.awayScore!==null&&s.awayScore!==undefined;}
function isGK(p){return p&&norm(p.position)==='goalkeeper';}
function matchSaveTotal(saved,side){
  const ownKey=side==='home'?'h':'a',oppKey=side==='home'?'a':'h';
  const stored=num(saved?.stats?.saves?.[ownKey]);
  const oppSot=num(saved?.stats?.sot?.[oppKey]);
  const conceded=num(side==='home'?saved?.awayScore:saved?.homeScore);
  const hasOwnGoal=(Array.isArray(saved?.events)?saved.events:[]).some(e=>e?.type==='goal'&&/own goal/i.test(String(e?.player||'')));
  const derived=(!hasOwnGoal&&oppSot!==null&&conceded!==null)?Math.max(0,oppSot-conceded):null;
  // Keep verified/non-zero stored saves. Repair blank/zero placeholders when match stats prove saves occurred.
  if(stored!==null&&stored>0)return stored;
  if(derived!==null&&derived>0)return derived;
  return Math.max(0,stored??derived??0);
}
function resolver(players){const m=new Map();(players||[]).forEach(p=>{const k=norm(p.name);if(k&&!m.has(k))m.set(k,p);});return n=>m.get(norm(n))||null;}
function goalkeeperParticipants(saved,side,resolve){
  const lineup=Array.isArray(saved?.[side+'Lineup'])?saved[side+'Lineup'].filter(Boolean):[];
  const subs=Array.isArray(saved?.[side+'Subs'])?saved[side+'Subs']:[];
  const names=new Set(lineup);
  subs.forEach(s=>{if(s?.out)names.add(s.out);if(s?.in)names.add(s.in);});
  const keepers=[...names].map(name=>({name,player:resolve(name)})).filter(x=>isGK(x.player));
  // First XI slot is a safe fallback only when it resolves to an existing roster player.
  if(!keepers.length&&lineup[0]){const p=resolve(lineup[0]);if(p)keepers.push({name:lineup[0],player:p,fallback:true});}
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
    const total=matchSaveTotal(saved,side);
    saved.stats=saved.stats||{};saved.stats.saves=saved.stats.saves||{h:0,a:0};
    const ownKey=side==='home'?'h':'a';
    if((num(saved.stats.saves[ownKey])??0)===0&&total>0)saved.stats.saves[ownKey]=total;
    const {keepers}=goalkeeperParticipants(saved,side,resolve);
    const split=perKeeperMap(saved,team);
    if(split.size){
      let assigned=0;
      keepers.forEach(k=>{const v=split.get(norm(k.name));if(v!==undefined){k.player.saves+=v;assigned+=v;}});
      if(assigned!==total)issues.push(`${f.home} vs ${f.away}: goalkeeper split ${assigned} does not equal team saves ${total}`);
      return;
    }
    if(keepers.length===1){keepers[0].player.saves+=total;return;}
    if(keepers.length===0){issues.push(`${f.home} vs ${f.away}: no goalkeeper could be resolved for ${team}`);return;}
    // More than one keeper appeared: do not fabricate a split.
    issues.push(`${f.home} vs ${f.away}: ${team} used multiple goalkeepers; enter per-goalkeeper saves before allocation`);
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
  localStorage.setItem('nl4_rr_gk_saves_version',VERSION);
  return results;
}
function wrapBaseCalculator(){
  const base=window.recalculatePlayerStatsFromFixtures;
  if(base&&base.__nl4GkV7)return;
  const wrapped=function(team){const r=typeof base==='function'?base(team):undefined;recalcTeam(team);return r;};
  wrapped.__nl4GkV7=true;window.recalculatePlayerStatsFromFixtures=wrapped;
}
function run(){wrapBaseCalculator();recalcAll();}
window.NL4RecordRoomGoalkeeperSaves={version:VERSION,recalcTeam,recalcAll,matchSaveTotal};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,900),{once:true});else setTimeout(run,900);
})();