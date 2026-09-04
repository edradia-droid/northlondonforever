// NL4 Record Room — lightweight Arsenal full-team integration.
// Adds Arsenal as the 20th Premier League Record Room club with exactly the same
// club, player, fixture, lineup, substitution, event and match-stat structure.
(function(){
'use strict';
if(window.__NL4_RR_ARSENAL_LIGHT_V11__) return;
window.__NL4_RR_ARSENAL_LIGHT_V11__=true;

const TEAM='Arsenal';
const clone=v=>JSON.parse(JSON.stringify(v));
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
const blankClub=()=>({
  matches:0,avgPossession:0,totalShots:0,shotsOnTarget:0,corners:0,cornerGoals:0,
  fouls:0,offsides:0,yellowCards:0,redCards:0,points:0
});
const P=(name,position,number=null)=>({
  name,position,number,
  appearances:0,starts:0,minutes:0,goals:0,assists:0,cleanSheets:0,
  yellowCards:0,redCards:0,mom:0,shots:0,shotsOnTarget:0,
  chancesCreated:0,tackles:0,interceptions:0,saves:0
});

const BASE_ROSTER=[
 P('David Raya','Goalkeeper',1),P('Kepa Arrizabalaga','Goalkeeper',13),P('Illan Meslier','Goalkeeper',30),P('Tommy Setford','Goalkeeper',35),
 P('William Saliba','Defender',2),P('Cristhian Mosquera','Defender',3),P('Ben White','Defender',4),P('Piero Hincapié','Defender',5),P('Gabriel Magalhães','Defender',6),P('Jurriën Timber','Defender',12),P('Riccardo Calafiori','Defender',33),P('Myles Lewis-Skelly','Defender',49),P('Ezri Konsa','Defender',null),
 P('Martin Ødegaard','Midfielder',8),P('Eberechi Eze','Midfielder',10),P('Fabio Vieira','Midfielder',21),P('Ethan Nwaneri','Midfielder',22),P('Mikel Merino','Midfielder',23),P('Martín Zubimendi','Midfielder',36),P('Bruno Guimarães','Midfielder',39),P('Declan Rice','Midfielder',41),P('Max Dowman','Midfielder',null),
 P('Bukayo Saka','Forward',7),P('Gabriel Jesus','Forward',9),P('Christos Tzolis','Forward',null),P('Kai Havertz','Forward',null),P('Noni Madueke','Forward',null),P('Gabriel Martinelli','Forward',null),P('Viktor Gyökeres','Forward',null)
];

function fullPlayer(p){
  return {...P(p.name||'',p.position||'',p.number??null),...p};
}

function ensureArsenal(){
  if(typeof TEAMS!=='undefined'){
    while(TEAMS.includes(TEAM)) TEAMS.splice(TEAMS.indexOf(TEAM),1);
    TEAMS.unshift(TEAM);
  }
  if(typeof TEAM_ROSTERS!=='undefined') TEAM_ROSTERS[TEAM]=BASE_ROSTER.map(clone);
  if(typeof db==='undefined') return false;

  const old=db[TEAM]||{club:blankClub(),players:[],fixtureData:{}};
  const oldBy=new Map((old.players||[]).map(p=>[norm(p.name),p]));
  const players=BASE_ROSTER.map(seed=>fullPlayer({...seed,...(oldBy.get(norm(seed.name))||{}),name:seed.name,position:seed.position,number:seed.number}));

  // Keep any Arsenal player already present in saved fixture data/admin records.
  (old.players||[]).forEach(p=>{
    if(p?.name && !players.some(x=>norm(x.name)===norm(p.name))) players.push(fullPlayer(p));
  });

  db[TEAM]={
    ...old,
    club:{...blankClub(),...(old.club||{})},
    players,
    fixtureData:(old.fixtureData&&typeof old.fixtureData==='object')?old.fixtureData:{}
  };

  // Reuse canonical fixture records already saved under the opponent, but do not
  // run a whole-season recalculation here. Future saves use the native Record Room
  // sync and will update Arsenal exactly like every other participating team.
  if(typeof ALL_FIXTURES!=='undefined'){
    ALL_FIXTURES.filter(f=>f.home===TEAM||f.away===TEAM).forEach(f=>{
      if(db[TEAM].fixtureData[f.id]) return;
      const opponent=f.home===TEAM?f.away:f.home;
      const saved=db[opponent]?.fixtureData?.[f.id];
      if(saved) db[TEAM].fixtureData[f.id]=clone(saved);
    });
  }

  if(typeof TEAM_ROSTERS!=='undefined'){
    TEAM_ROSTERS[TEAM]=db[TEAM].players.map(p=>({name:p.name,position:p.position,number:p.number??null}));
  }
  return true;
}

function putArsenalFirst(select){
  if(!select) return;
  const selected=select.value;
  [...select.options].filter(o=>o.value===TEAM).forEach(o=>o.remove());
  select.add(new Option(TEAM,TEAM),0);
  if(selected&&selected!==TEAM&&[...select.options].some(o=>o.value===selected)) select.value=selected;
}

function exposeArsenalPlayers(){
  const original=typeof window.teamPlayers==='function'?window.teamPlayers:null;
  window.teamPlayers=function(team){
    if(team===TEAM) return (typeof db!=='undefined'&&db[TEAM]?.players)||[];
    return original?original(team):((typeof db!=='undefined'&&db[team]?.players)||[]);
  };
}

function apply(){
  if(!ensureArsenal()) return false;
  putArsenalFirst(document.getElementById('teamSelect'));
  putArsenalFirst(document.getElementById('inputTeam'));
  exposeArsenalPlayers();

  const marker=document.getElementById('buildMarker');
  if(marker) marker.textContent='BUILD V11 • ALL 20 PREMIER LEAGUE TEAMS • ARSENAL INCLUDED';
  const hero=document.querySelector('.hero p');
  if(hero) hero.textContent='Admin record workspace for all 20 Premier League clubs, including Arsenal. Arsenal now uses the same 2026/27 club stats, player stats, fixtures, lineups, substitutions, match events, saves, cards and Man of the Match structure as every other club.';

  // One normal render is enough to expose Arsenal. No polling and no MutationObserver.
  if(typeof render==='function') render();
  return true;
}

window.NL4RecordRoomAddArsenal=apply;
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,0),{once:true});
else setTimeout(apply,0);
})();
