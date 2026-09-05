// NL4 Record Room — goalkeeper saves calculation V10
(function(){
'use strict';
if(window.__NL4_RR_GK_SAVES_V10__) return;
window.__NL4_RR_GK_SAVES_V10__=true;
const VERSION='20260905-gk-saves-v10-full-audit';
const ALIASES={
 'AFC Bournemouth':{'djordje petrovic':'Đorđe Petrović','dorde petrovic':'Đorđe Petrović'},
 'Chelsea':{'robert sanchez':'Robert Lynch Sánchez','emiliano martinez':'Emiliano Martínez'},
 'Liverpool':{'alisson':'Alisson Becker'}
};
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘`]/g,"'").replace(/[‐‑‒–—]/g,'-').replace(/\s+/g,' ').trim().toLowerCase();}
function num(v){const x=Number(v);return Number.isFinite(x)?x:null;}
function completed(s){return s&&s.homeScore!=null&&s.awayScore!=null;}
function isGK(p){return p&&norm(p.position)==='goalkeeper';}
function splitEvent(v){const p=String(v||'').split('|||');return {team:p[0]||'',name:p.slice(1).join('|||')||''};}
function ownGoalCount(saved,scoringTeam){return (saved?.events||[]).filter(e=>{if(e?.type!=='goal')return false;const w=splitEvent(e.player);return w.team===scoringTeam&&/own goal/i.test(String(w.name||e.player||''));}).length;}
function blankPlayer(name){return {name,position:'Goalkeeper',number:null,appearances:0,starts:0,minutes:0,goals:0,assists:0,cleanSheets:0,yellowCards:0,redCards:0,mom:0,shots:0,shotsOnTarget:0,chancesCreated:0,tackles:0,interceptions:0,saves:0};}
function ensureKeeper(team,name){if(typeof db==='undefined'||!db[team])return null;db[team].players=db[team].players||[];let p=db[team].players.find(x=>norm(x.name)===norm(name));if(!p){p=blankPlayer(name);db[team].players.unshift(p);}if(typeof TEAM_ROSTERS!=='undefined'){TEAM_ROSTERS[team]=TEAM_ROSTERS[team]||[];if(!TEAM_ROSTERS[team].some(x=>norm(x.name)===norm(name)))TEAM_ROSTERS[team].unshift({name,position:'Goalkeeper',number:null});}return p;}
function healIdentityData(){
 if(typeof db==='undefined')return;
 ensureKeeper('Chelsea','Emiliano Martínez');
 const canon=(team,raw)=>ALIASES[team]?.[norm(raw)]||raw;
 Object.keys(db).forEach(team=>Object.values(db[team]?.fixtureData||{}).forEach(s=>{
  ['homeLineup','awayLineup'].forEach(k=>{if(Array.isArray(s[k]))s[k]=s[k].map(n=>canon(team,n));});
  ['homeSubs','awaySubs'].forEach(k=>(s[k]||[]).forEach(x=>{if(x.out)x.out=canon(team,x.out);if(x.in)x.in=canon(team,x.in);}));
 }));
 // Verified Newcastle-Liverpool correction from the completed-match audit.
 if(typeof ALL_FIXTURES!=='undefined'){const f=ALL_FIXTURES.find(x=>String(x.id)==='9');if(f) [f.home,f.away].forEach(team=>{const s=db[team]?.fixtureData?.[9];if(!s)return;s.stats=s.stats||{};s.stats.sot=s.stats.sot||{h:0,a:0};s.stats.saves=s.stats.saves||{h:0,a:0};s.stats.sot.h=5;s.stats.saves.a=3;s.goalkeeperDataVerified={...(s.goalkeeperDataVerified||{}),Liverpool:3};});}
}
function resolver(team,players){
 const keepers=(players||[]).filter(isGK), exact=new Map();keepers.forEach(p=>exact.set(norm(p.name),p));
 return name=>{const q=norm(name);if(!q)return null;const alias=ALIASES[team]?.[q];if(alias&&exact.has(norm(alias)))return exact.get(norm(alias));if(exact.has(q))return exact.get(q);const qt=q.split(' ').filter(Boolean);const matches=keepers.filter(p=>{const pn=norm(p.name),pt=pn.split(' ').filter(Boolean);if(qt.length===1)return pt.includes(q)||pn.startsWith(q+' ');return pn.startsWith(q+' ')||q.startsWith(pn+' ')||qt.every(t=>pt.includes(t));});return matches.length===1?matches[0]:null;};
}
function matchSaveTotal(saved,side,fixture,team){const verified=num(saved?.goalkeeperDataVerified?.[team]);if(verified!==null)return Math.max(0,verified);const ownKey=side==='home'?'h':'a',oppKey=side==='home'?'a':'h';const stored=num(saved?.stats?.saves?.[ownKey]),oppSot=num(saved?.stats?.sot?.[oppKey]),conceded=num(side==='home'?saved?.awayScore:saved?.homeScore),opponent=side==='home'?fixture?.away:fixture?.home;if(oppSot!==null&&conceded!==null){const credited=Math.max(0,conceded-ownGoalCount(saved,opponent));return Math.max(0,oppSot-credited);}return Math.max(0,stored??0);}
function recalcTeam(team){
 if(typeof db==='undefined'||!db[team]||typeof ALL_FIXTURES==='undefined')return {team,issues:[]};
 const players=db[team].players||[],resolve=resolver(team,players),issues=[];players.filter(isGK).forEach(p=>p.saves=0);
 Object.entries(db[team].fixtureData||{}).forEach(([fid,s])=>{if(!completed(s))return;const f=ALL_FIXTURES.find(x=>String(x.id)===String(fid));if(!f)return;const side=f.home===team?'home':f.away===team?'away':null;if(!side)return;const total=matchSaveTotal(s,side,f,team),key=side==='home'?'h':'a';s.stats=s.stats||{};s.stats.saves=s.stats.saves||{h:0,a:0};s.stats.saves[key]=total;const lineup=(s[side+'Lineup']||[]).filter(Boolean),subs=s[side+'Subs']||[],names=new Set(lineup);subs.forEach(x=>{if(x.out)names.add(x.out);if(x.in)names.add(x.in);});let keepers=[...names].map(n=>({raw:n,p:resolve(n)})).filter(x=>isGK(x.p));if(!keepers.length&&lineup[0]){const p=resolve(lineup[0]);if(isGK(p))keepers=[{raw:lineup[0],p}];}if(keepers.length===1){keepers[0].p.saves+=total;if(Array.isArray(s[side+'Lineup'])&&s[side+'Lineup'][0])s[side+'Lineup'][0]=keepers[0].p.name;}else if(!keepers.length)issues.push(`${f.home} vs ${f.away}: unresolved goalkeeper for ${team}; saves=${total}`);else issues.push(`${f.home} vs ${f.away}: multiple goalkeepers used by ${team}; verified split required`);});
 return {team,issues};
}
function recalcAll(){healIdentityData();if(typeof db==='undefined')return [];const results=Object.keys(db).map(recalcTeam);try{if(typeof persist==='function')persist();}catch(_){}try{if(typeof render==='function')render();}catch(_){}const issues=results.flatMap(r=>r.issues.map(x=>`${r.team}: ${x}`));if(issues.length)console.warn('[NL4 Record Room] goalkeeper save audit',issues);try{localStorage.setItem('nl4_rr_gk_saves_version',VERSION);}catch(_){}return results;}
function install(){healIdentityData();const base=window.recalculatePlayerStatsFromFixtures;if(typeof base==='function'&&!base.__nl4GkV10){['AFC Bournemouth','Chelsea','Liverpool'].forEach(t=>{try{base(t);}catch(_){}});const wrapped=function(team){const r=base(team);recalcTeam(team);return r;};wrapped.__nl4GkV10=true;window.recalculatePlayerStatsFromFixtures=wrapped;}const save=window.saveFixtureDetails;if(typeof save==='function'&&!save.__nl4GkV10){const w=function(){const r=save.apply(this,arguments);setTimeout(recalcAll,0);return r;};w.__nl4GkV10=true;window.saveFixtureDetails=w;}recalcAll();const marker=document.getElementById('buildMarker');if(marker)marker.textContent='BUILD V23 • FULL GOALKEEPER SAVE AUDIT';}
window.NL4RecordRoomGoalkeeperSaves={version:VERSION,recalcTeam,recalcAll,matchSaveTotal,install};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,1100),{once:true});else setTimeout(install,1100);
})();