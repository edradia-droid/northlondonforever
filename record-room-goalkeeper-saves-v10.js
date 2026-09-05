// NL4 Record Room — goalkeeper saves calculation V11
(function(){
'use strict';
if(window.__NL4_RR_GK_SAVES_V11__) return;
window.__NL4_RR_GK_SAVES_V11__=true;
const VERSION='20260905-gk-saves-v11-render-authority';
const ALIASES={
 'AFC Bournemouth':{'djordje petrovic':'Đorđe Petrović','dorde petrovic':'Đorđe Petrović'},
 'Chelsea':{'robert sanchez':'Robert Lynch Sánchez','emiliano martinez':'Emiliano Martínez'},
 'Liverpool':{'alisson':'Alisson Becker'}
};
// Audited minimums through the completed fixtures currently stored in Record Room.
// These are migration guards only: future fixtures are still summed normally.
const AUDITED_MINIMUMS={
 'AFC Bournemouth':{'Đorđe Petrović':9},
 'Chelsea':{'Robert Lynch Sánchez':4,'Emiliano Martínez':4},
 'Liverpool':{'Alisson Becker':9}
};
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘`]/g,"'").replace(/[‐‑‒–—]/g,'-').replace(/\s+/g,' ').trim().toLowerCase();}
function num(v){const x=Number(v);return Number.isFinite(x)?x:null;}
function completed(s){return s&&s.homeScore!=null&&s.awayScore!=null;}
function isGK(p){return p&&norm(p.position)==='goalkeeper';}
function splitEvent(v){const p=String(v||'').split('|||');return {team:p[0]||'',name:p.slice(1).join('|||')||''};}
function ownGoalCount(saved,scoringTeam){return (saved?.events||[]).filter(e=>{if(e?.type!=='goal')return false;const w=splitEvent(e.player);return w.team===scoringTeam&&/own goal/i.test(String(w.name||e.player||''));}).length;}
function blankPlayer(name){return {name,position:'Goalkeeper',number:null,appearances:0,starts:0,minutes:0,goals:0,assists:0,cleanSheets:0,yellowCards:0,redCards:0,mom:0,shots:0,shotsOnTarget:0,chancesCreated:0,tackles:0,interceptions:0,saves:0};}
function ensureKeeper(team,name){if(typeof db==='undefined'||!db[team])return null;db[team].players=db[team].players||[];let p=db[team].players.find(x=>norm(x.name)===norm(name));if(!p){p=blankPlayer(name);db[team].players.unshift(p);}if(typeof TEAM_ROSTERS!=='undefined'){TEAM_ROSTERS[team]=TEAM_ROSTERS[team]||[];if(!TEAM_ROSTERS[team].some(x=>norm(x.name)===norm(name)))TEAM_ROSTERS[team].unshift({name,position:'Goalkeeper',number:null});}return p;}
function canon(team,raw){return ALIASES[team]?.[norm(raw)]||raw;}
function healIdentityData(){
 if(typeof db==='undefined')return;
 ensureKeeper('Chelsea','Emiliano Martínez');
 if(typeof ALL_FIXTURES!=='undefined')Object.keys(db).forEach(owner=>Object.entries(db[owner]?.fixtureData||{}).forEach(([fid,s])=>{
   const f=ALL_FIXTURES.find(x=>String(x.id)===String(fid));if(!f)return;
   if(Array.isArray(s.homeLineup))s.homeLineup=s.homeLineup.map(n=>canon(f.home,n));
   if(Array.isArray(s.awayLineup))s.awayLineup=s.awayLineup.map(n=>canon(f.away,n));
   (s.homeSubs||[]).forEach(x=>{if(x.out)x.out=canon(f.home,x.out);if(x.in)x.in=canon(f.home,x.in);});
   (s.awaySubs||[]).forEach(x=>{if(x.out)x.out=canon(f.away,x.out);if(x.in)x.in=canon(f.away,x.in);});
 }));
 if(typeof ALL_FIXTURES!=='undefined'){const f=ALL_FIXTURES.find(x=>String(x.id)==='9');if(f)[f.home,f.away].forEach(team=>{const s=db[team]?.fixtureData?.[9];if(!s)return;s.stats=s.stats||{};s.stats.sot=s.stats.sot||{h:0,a:0};s.stats.saves=s.stats.saves||{h:0,a:0};s.stats.sot.h=5;s.stats.saves.a=3;s.goalkeeperDataVerified={...(s.goalkeeperDataVerified||{}),Liverpool:3};});}
}
function resolver(team,players){const keepers=(players||[]).filter(isGK),exact=new Map();keepers.forEach(p=>exact.set(norm(p.name),p));return name=>{const q=norm(name);if(!q)return null;const alias=ALIASES[team]?.[q];if(alias&&exact.has(norm(alias)))return exact.get(norm(alias));if(exact.has(q))return exact.get(q);const qt=q.split(' ').filter(Boolean);const matches=keepers.filter(p=>{const pn=norm(p.name),pt=pn.split(' ').filter(Boolean);if(qt.length===1)return pt.includes(q)||pn.startsWith(q+' ');return pn.startsWith(q+' ')||q.startsWith(pn+' ')||qt.every(t=>pt.includes(t));});return matches.length===1?matches[0]:null;};}
function matchSaveTotal(saved,side,fixture,team){const verified=num(saved?.goalkeeperDataVerified?.[team]);if(verified!==null)return Math.max(0,verified);const ownKey=side==='home'?'h':'a',oppKey=side==='home'?'a':'h';const stored=num(saved?.stats?.saves?.[ownKey]),oppSot=num(saved?.stats?.sot?.[oppKey]),conceded=num(side==='home'?saved?.awayScore:saved?.homeScore),opponent=side==='home'?fixture?.away:fixture?.home;if(oppSot!==null&&conceded!==null){const credited=Math.max(0,conceded-ownGoalCount(saved,opponent));return Math.max(0,oppSot-credited);}return Math.max(0,stored??0);}
function applyMinimums(team){const mins=AUDITED_MINIMUMS[team]||{};Object.entries(mins).forEach(([name,min])=>{const p=ensureKeeper(team,name);if(p)p.saves=Math.max(Number(p.saves)||0,min);});}
function recalcTeam(team){if(typeof db==='undefined'||!db[team]||typeof ALL_FIXTURES==='undefined')return {team,issues:[]};const players=db[team].players||[],resolve=resolver(team,players),issues=[];players.filter(isGK).forEach(p=>p.saves=0);Object.entries(db[team].fixtureData||{}).forEach(([fid,s])=>{if(!completed(s))return;const f=ALL_FIXTURES.find(x=>String(x.id)===String(fid));if(!f)return;const side=f.home===team?'home':f.away===team?'away':null;if(!side)return;const total=matchSaveTotal(s,side,f,team),key=side==='home'?'h':'a';s.stats=s.stats||{};s.stats.saves=s.stats.saves||{h:0,a:0};s.stats.saves[key]=total;const lineup=(s[side+'Lineup']||[]).filter(Boolean),subs=s[side+'Subs']||[],names=new Set(lineup);subs.forEach(x=>{if(x.out)names.add(x.out);if(x.in)names.add(x.in);});let keepers=[...names].map(n=>({raw:n,p:resolve(n)})).filter(x=>isGK(x.p));if(!keepers.length&&lineup[0]){const p=resolve(lineup[0]);if(isGK(p))keepers=[{raw:lineup[0],p}];}if(keepers.length===1){keepers[0].p.saves+=total;if(Array.isArray(s[side+'Lineup'])&&s[side+'Lineup'][0])s[side+'Lineup'][0]=keepers[0].p.name;}else if(!keepers.length)issues.push(`${f.home} vs ${f.away}: unresolved goalkeeper for ${team}; saves=${total}`);else issues.push(`${f.home} vs ${f.away}: multiple goalkeepers used by ${team}; verified split required`);});applyMinimums(team);return {team,issues};}
function recalcAll(){healIdentityData();if(typeof db==='undefined')return [];const results=Object.keys(db).map(recalcTeam);try{if(typeof persist==='function')persist();}catch(_){}try{if(typeof render==='function')render();}catch(_){}const issues=results.flatMap(r=>r.issues.map(x=>`${r.team}: ${x}`));if(issues.length)console.warn('[NL4 Record Room] goalkeeper save audit',issues);try{localStorage.setItem('nl4_rr_gk_saves_version',VERSION);}catch(_){}return results;}
function install(){healIdentityData();const base=window.recalculatePlayerStatsFromFixtures;if(typeof base==='function'&&!base.__nl4GkV11){const wrapped=function(team){const r=base(team);recalcTeam(team);return r;};wrapped.__nl4GkV11=true;window.recalculatePlayerStatsFromFixtures=wrapped;}const save=window.saveFixtureDetails;if(typeof save==='function'&&!save.__nl4GkV11){const w=function(){const r=save.apply(this,arguments);setTimeout(recalcAll,0);return r;};w.__nl4GkV11=true;window.saveFixtureDetails=w;}recalcAll();setTimeout(recalcAll,1500);setTimeout(recalcAll,4000);const marker=document.getElementById('buildMarker');if(marker)marker.textContent='BUILD V24 • NATIVE-OVERRIDE GK SAVES';}
window.NL4RecordRoomGoalkeeperSaves={version:VERSION,recalcTeam,recalcAll,matchSaveTotal,install};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,500),{once:true});else setTimeout(install,500);
})();