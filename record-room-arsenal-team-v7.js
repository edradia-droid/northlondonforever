// NL4 Record Room — Arsenal full-team integration.
// Adds Arsenal to the existing 19-team Record Room without altering forecast/model code.
(function(){
'use strict';
if(window.__NL4_RR_ARSENAL_TEAM_V7__)return;
window.__NL4_RR_ARSENAL_TEAM_V7__=true;
const TEAM='Arsenal';
const clone=v=>JSON.parse(JSON.stringify(v));
const blankClub=()=>typeof defaultClub==='function'?defaultClub():({matches:0,avgPossession:0,totalShots:0,shotsOnTarget:0,corners:0,cornerGoals:0,fouls:0,offsides:0,yellowCards:0,redCards:0,points:0});
const P=(name,position,number=null)=>({name,position,number,appearances:0,starts:0,minutes:0,goals:0,assists:0,cleanSheets:0,yellowCards:0,redCards:0,mom:0,shots:0,shotsOnTarget:0,chancesCreated:0,tackles:0,interceptions:0,saves:0});
const BASE_ROSTER=[
 P('David Raya','Goalkeeper',1),P('Kepa Arrizabalaga','Goalkeeper',13),P('Illan Meslier','Goalkeeper',30),P('Tommy Setford','Goalkeeper',35),
 P('William Saliba','Defender',2),P('Cristhian Mosquera','Defender',3),P('Ben White','Defender',4),P('Piero Hincapié','Defender',5),P('Gabriel Magalhães','Defender',6),P('Jurriën Timber','Defender',12),P('Riccardo Calafiori','Defender',33),P('Myles Lewis-Skelly','Defender',49),
 P('Martin Ødegaard','Midfielder',8),P('Eberechi Eze','Midfielder',10),P('Fabio Vieira','Midfielder',21),P('Ethan Nwaneri','Midfielder',22),P('Mikel Merino','Midfielder',23),P('Martín Zubimendi','Midfielder',36),P('Bruno Guimarães','Midfielder',39),P('Declan Rice','Midfielder',41),P('Max Dowman','Midfielder',null),
 P('Bukayo Saka','Forward',7),P('Gabriel Jesus','Forward',9),P('Christos Tzolis','Forward',null),P('Kai Havertz','Forward',null),P('Noni Madueke','Forward',null),P('Gabriel Martinelli','Forward',null),P('Viktor Gyökeres','Forward',null),
 P('Ezri Konsa','Defender',null)
];
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
function ensureRoster(){
 if(typeof TEAM_ROSTERS!=='undefined')TEAM_ROSTERS[TEAM]=BASE_ROSTER.map(clone);
 if(typeof TEAMS!=='undefined'&&!TEAMS.includes(TEAM))TEAMS.unshift(TEAM);
 if(typeof db==='undefined')return;
 const old=db[TEAM]||{club:blankClub(),players:[],fixtureData:{}};
 const oldBy=new Map((old.players||[]).map(p=>[norm(p.name),p]));
 old.players=BASE_ROSTER.map(p=>({...clone(p),...(oldBy.get(norm(p.name))||{}),name:p.name,position:p.position,number:p.number}));
 old.club=old.club||blankClub();old.fixtureData=old.fixtureData||{};db[TEAM]=old;
}
function ensureOptions(){
 ['teamSelect','inputTeam'].forEach(id=>{
  const el=document.getElementById(id);if(!el)return;
  if(![...el.options].some(o=>o.value===TEAM))el.add(new Option(TEAM,TEAM),0);
 });
}
function fixtureScore(s){return !s?-1:((s.homeScore!==null&&s.homeScore!==undefined&&s.awayScore!==null&&s.awayScore!==undefined)?1000:0)+(s.homeLineup?.filter(Boolean).length||0)*10+(s.awayLineup?.filter(Boolean).length||0)*10+(s.homeSubs?.length||0)*3+(s.awaySubs?.length||0)*3+(s.events?.length||0)*4+Object.keys(s.stats||{}).length;}
function mirrorArsenalFixtures(){
 if(typeof ALL_FIXTURES==='undefined'||typeof db==='undefined')return;
 ALL_FIXTURES.filter(f=>f.home===TEAM||f.away===TEAM).forEach(f=>{
  const opponent=f.home===TEAM?f.away:f.home;
  const candidates=[];
  const a=db[TEAM]?.fixtureData?.[f.id];if(a)candidates.push(a);
  const o=db[opponent]?.fixtureData?.[f.id];if(o)candidates.push(o);
  if(!candidates.length)return;
  const best=candidates.sort((x,y)=>fixtureScore(y)-fixtureScore(x))[0];
  db[TEAM].fixtureData[f.id]=clone(best);
 });
}
function addFixturePlayers(){
 if(typeof ALL_FIXTURES==='undefined'||typeof db==='undefined'||!db[TEAM])return;
 const known=new Map(db[TEAM].players.map(p=>[norm(p.name),p]));
 const add=(name,guess='')=>{name=String(name||'').trim();if(!name||/^Own Goal \(/i.test(name)||known.has(norm(name)))return;let position=guess||'';if(!position){if(/raya|kepa|meslier|setford/i.test(name))position='Goalkeeper';else position='Midfielder';}const p=P(name,position,null);db[TEAM].players.push(p);known.set(norm(name),p)};
 ALL_FIXTURES.filter(f=>f.home===TEAM||f.away===TEAM).forEach(f=>{
  const s=db[TEAM]?.fixtureData?.[f.id];if(!s)return;
  const side=f.home===TEAM?'home':'away';
  (s[side+'Lineup']||[]).forEach(n=>add(n));
  (s[side+'Subs']||[]).forEach(x=>{add(x.out);add(x.in)});
  (s.events||[]).forEach(e=>{const parts=String(e.player||'').split('|||');if(parts[0]===TEAM)add(parts.slice(1).join('|||'));const ap=String(e.assist||'').split('|||');if(ap[0]===TEAM)add(ap.slice(1).join('|||'))});
  const m=String(s.manOfTheMatch||'').split('|||');if(m[0]===TEAM)add(m.slice(1).join('|||'));
 });
}
function exposePlayers(){
 try{window.teamPlayers=function(team){return (typeof db!=='undefined'&&db[team]?.players)||[];};}catch(_){ }
}
function recalc(){
 if(typeof window.NL4RecordRoomRecalculateAll==='function')window.NL4RecordRoomRecalculateAll();
 else{
  if(typeof recalculatePlayerStatsFromFixtures==='function')recalculatePlayerStatsFromFixtures(TEAM);
  if(typeof recalculateClubStatsFromFixtures==='function')recalculateClubStatsFromFixtures(TEAM);
  if(typeof persist==='function')persist();if(typeof render==='function')render();
 }
}
function apply(){
 ensureRoster();ensureOptions();exposePlayers();mirrorArsenalFixtures();addFixturePlayers();
 if(typeof TEAM_ROSTERS!=='undefined')TEAM_ROSTERS[TEAM]=db[TEAM].players.map(p=>({name:p.name,position:p.position,number:p.number??null}));
 recalc();
 const marker=document.getElementById('buildMarker');if(marker)marker.textContent='BUILD V10 • ALL 20 PREMIER LEAGUE TEAMS';
 const hero=document.querySelector('.hero p');if(hero)hero.textContent='Admin record workspace for all 20 Premier League clubs, including Arsenal. Every club uses the same 2026/27 club, player, fixture, lineup, event and season-stat structure while remaining isolated from NL4 forecast calculations.';
}
window.NL4RecordRoomAddArsenal=apply;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,150));else setTimeout(apply,150);
})();
