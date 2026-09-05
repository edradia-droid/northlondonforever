// NL4 Record Room — goalkeeper saves calculation V9
(function(){
'use strict';
if(window.__NL4_RR_GK_SAVES_V9__) return;
window.__NL4_RR_GK_SAVES_V9__=true;
const VERSION='20260905-gk-saves-v9-season-alias';
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘`]/g,"'").replace(/[‐‑‒–—]/g,'-').replace(/\s+/g,' ').trim().toLowerCase();}
function num(v){const x=Number(v);return Number.isFinite(x)?x:null;}
function completed(s){return s&&s.homeScore!==null&&s.homeScore!==undefined&&s.awayScore!==null&&s.awayScore!==undefined;}
function isGK(p){return p&&norm(p.position)==='goalkeeper';}
function splitEvent(v){const p=String(v||'').split('|||');return {team:p[0]||'',name:p.slice(1).join('|||')||''};}
function ownGoalCount(saved,scoringTeam){return (Array.isArray(saved?.events)?saved.events:[]).filter(e=>{if(e?.type!=='goal')return false;const w=splitEvent(e.player);return w.team===scoringTeam&&/own goal/i.test(String(w.name||e.player||''));}).length;}
function resolver(players){
 const keepers=(players||[]).filter(isGK);
 const exact=new Map();keepers.forEach(p=>{const k=norm(p.name);if(k&&!exact.has(k))exact.set(k,p);});
 return name=>{
  const q=norm(name);if(!q)return null;
  if(exact.has(q))return exact.get(q);
  const qTokens=q.split(' ').filter(Boolean);
  const matches=keepers.filter(p=>{
   const pn=norm(p.name),pt=pn.split(' ').filter(Boolean);
   if(qTokens.length===1)return pt.includes(q)||pn.startsWith(q+' ');
   return pn.startsWith(q+' ')||q.startsWith(pn+' ');
  });
  return matches.length===1?matches[0]:null;
 };
}
function patchVerifiedData(){
 if(typeof db==='undefined'||typeof ALL_FIXTURES==='undefined')return;
 const f=ALL_FIXTURES.find(x=>String(x.id)==='9');
 if(f&&f.home==='Newcastle United'&&f.away==='Liverpool'){
  [f.home,f.away].forEach(team=>{
   const s=db[team]?.fixtureData?.[9];if(!s)return;
   s.stats=s.stats||{};s.stats.sot=s.stats.sot||{h:0,a:0};s.stats.saves=s.stats.saves||{h:0,a:0};
   s.stats.sot.h=5;
   s.stats.saves.a=3;
   s.goalkeeperDataVerified=s.goalkeeperDataVerified||{};
   s.goalkeeperDataVerified.Liverpool=3;
  });
 }
}
function matchSaveTotal(saved,side,fixture,team){
 const verified=num(saved?.goalkeeperDataVerified?.[team]);if(verified!==null)return Math.max(0,verified);
 const ownKey=side==='home'?'h':'a',oppKey=side==='home'?'a':'h';
 const stored=num(saved?.stats?.saves?.[ownKey]);
 const oppSot=num(saved?.stats?.sot?.[oppKey]);
 const conceded=num(side==='home'?saved?.awayScore:saved?.homeScore);
 const opponent=side==='home'?fixture?.away:fixture?.home;
 if(oppSot!==null&&conceded!==null){const credited=Math.max(0,conceded-ownGoalCount(saved,opponent));return Math.max(0,oppSot-credited);}
 return Math.max(0,stored??0);
}
function goalkeeperParticipants(saved,side,resolve){
 const lineup=Array.isArray(saved?.[side+'Lineup'])?saved[side+'Lineup'].filter(Boolean):[];
 const subs=Array.isArray(saved?.[side+'Subs'])?saved[side+'Subs']:[];
 const names=new Set(lineup);subs.forEach(s=>{if(s?.out)names.add(s.out);if(s?.in)names.add(s.in);});
 let keepers=[...names].map(name=>({name,player:resolve(name)})).filter(x=>isGK(x.player));
 if(!keepers.length&&lineup[0]){const p=resolve(lineup[0]);if(p)keepers=[{name:lineup[0],player:p,fallback:true}];}
 // Canonicalize historical shorthand names once safely resolved.
 if(lineup[0]){const p=resolve(lineup[0]);if(isGK(p)&&Array.isArray(saved?.[side+'Lineup']))saved[side+'Lineup'][0]=p.name;}
 return {keepers};
}
function perKeeperMap(saved,team,resolve){
 const raw=saved?.goalkeeperSaves||saved?.playerGoalkeeperSaves||{};const out=new Map();
 Object.entries(raw||{}).forEach(([k,v])=>{let name=k;if(k.includes('|||')){const p=k.split('|||');if(p[0]!==team)return;name=p.slice(1).join('|||');}const n=num(v),player=resolve(name);if(n!==null&&player)out.set(norm(player.name),Math.max(0,n));});
 return out;
}
function recalcTeam(team){
 if(typeof db==='undefined'||!db[team]||typeof ALL_FIXTURES==='undefined')return {team,issues:[]};
 const players=Array.isArray(db[team].players)?db[team].players:[];const resolve=resolver(players);players.forEach(p=>{if(isGK(p))p.saves=0;});
 const issues=[];
 Object.entries(db[team].fixtureData||{}).forEach(([fid,saved])=>{
  if(!completed(saved))return;const f=ALL_FIXTURES.find(x=>String(x.id)===String(fid));if(!f)return;
  const side=f.home===team?'home':f.away===team?'away':null;if(!side)return;
  const total=matchSaveTotal(saved,side,f,team),ownKey=side==='home'?'h':'a';
  saved.stats=saved.stats||{};saved.stats.saves=saved.stats.saves||{h:0,a:0};saved.stats.saves[ownKey]=total;
  const {keepers}=goalkeeperParticipants(saved,side,resolve);const split=perKeeperMap(saved,team,resolve);
  if(split.size){let assigned=0;keepers.forEach(k=>{const v=split.get(norm(k.player.name));if(v!==undefined){k.player.saves+=v;assigned+=v;}});if(assigned!==total)issues.push(`${f.home} vs ${f.away}: goalkeeper split ${assigned} != ${total}`);return;}
  if(keepers.length===1){keepers[0].player.saves+=total;return;}
  if(keepers.length===0){issues.push(`${f.home} vs ${f.away}: unresolved goalkeeper for ${team}; saves=${total}`);return;}
  issues.push(`${f.home} vs ${f.away}: multiple goalkeepers used by ${team}; individual split required`);
 });
 return {team,issues};
}
function recalcAll(){patchVerifiedData();if(typeof db==='undefined')return [];const results=Object.keys(db).map(recalcTeam);try{if(typeof persist==='function')persist();}catch(_){}try{if(typeof render==='function')render();}catch(_){}const issues=results.flatMap(r=>r.issues.map(x=>`${r.team}: ${x}`));if(issues.length)console.warn('[NL4 Record Room] goalkeeper save audit',issues);try{localStorage.setItem('nl4_rr_gk_saves_version',VERSION);}catch(_){}return results;}
function installCalculatorWrapper(){const base=window.recalculatePlayerStatsFromFixtures;if(typeof base!=='function'||base.__nl4GkV9)return;const wrapped=function(team){const r=base(team);recalcTeam(team);return r;};wrapped.__nl4GkV9=true;wrapped.__nl4Base=base;window.recalculatePlayerStatsFromFixtures=wrapped;}
function installSaveWrapper(){const base=window.saveFixtureDetails;if(typeof base!=='function'||base.__nl4GkV9)return;const wrapped=function(){const r=base.apply(this,arguments);setTimeout(()=>{patchVerifiedData();installCalculatorWrapper();recalcAll();},0);return r;};wrapped.__nl4GkV9=true;window.saveFixtureDetails=wrapped;}
function install(){patchVerifiedData();installCalculatorWrapper();installSaveWrapper();recalcAll();}
window.NL4RecordRoomGoalkeeperSaves={version:VERSION,recalcTeam,recalcAll,matchSaveTotal,install};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,1100),{once:true});else setTimeout(install,1100);
})();
