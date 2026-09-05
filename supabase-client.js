// NL4 Supabase browser client
// Safe for frontend use: this is the low-privilege publishable key.
// Never place a Supabase secret/service_role key in browser files.

const NL4_SUPABASE_URL = "https://vrjxejuyiynllygiozhs.supabase.co";
const NL4_SUPABASE_PUBLISHABLE_KEY = "sb_publishable__esNlSYCC7dc4Cbn1yFZ4w_ttag7wqw";

if (!window.supabase) throw new Error("Supabase JS library was not loaded.");
window.nl4Supabase = window.supabase.createClient(
  NL4_SUPABASE_URL,
  NL4_SUPABASE_PUBLISHABLE_KEY,
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
);

const NL4_IS_RECORD_ROOM = !!document.getElementById('recordRoomPage') || /(?:^|\/)record-room(?:\.html)?\/?$/i.test(location.pathname);

if (NL4_IS_RECORD_ROOM) {
  const ARSENAL='Arsenal';
  const arsenalSeeds=[
    ['David Raya','Goalkeeper',1],['Kepa Arrizabalaga','Goalkeeper',13],['Illan Meslier','Goalkeeper',30],['Tommy Setford','Goalkeeper',35],
    ['William Saliba','Defender',2],['Cristhian Mosquera','Defender',3],['Ben White','Defender',4],['Piero Hincapié','Defender',5],['Gabriel Magalhães','Defender',6],['Jurriën Timber','Defender',12],['Riccardo Calafiori','Defender',33],['Myles Lewis-Skelly','Defender',49],['Ezri Konsa','Defender',null],
    ['Martin Ødegaard','Midfielder',8],['Eberechi Eze','Midfielder',10],['Fabio Vieira','Midfielder',21],['Ethan Nwaneri','Midfielder',22],['Mikel Merino','Midfielder',23],['Martín Zubimendi','Midfielder',36],['Bruno Guimarães','Midfielder',39],['Declan Rice','Midfielder',41],['Max Dowman','Midfielder',null],
    ['Bukayo Saka','Forward',7],['Gabriel Jesus','Forward',9],['Christos Tzolis','Forward',null],['Kai Havertz','Forward',null],['Noni Madueke','Forward',null],['Gabriel Martinelli','Forward',null],['Viktor Gyökeres','Forward',null]
  ];
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
  const playerFromSeed=([name,position,number])=>({name,position,number,appearances:0,starts:0,minutes:0,goals:0,assists:0,cleanSheets:0,yellowCards:0,redCards:0,mom:0,shots:0,shotsOnTarget:0,chancesCreated:0,tackles:0,interceptions:0,saves:0});
  const arsenalBase=()=>arsenalSeeds.map(playerFromSeed);
  const blankClub=()=>({matches:0,avgPossession:0,totalShots:0,shotsOnTarget:0,corners:0,cornerGoals:0,fouls:0,offsides:0,yellowCards:0,redCards:0,points:0});
  const clone=v=>JSON.parse(JSON.stringify(v));

  function registerArsenal(){
    try{
      if(typeof TEAMS==='undefined' || typeof db==='undefined') return;
      while(TEAMS.includes(ARSENAL)) TEAMS.splice(TEAMS.indexOf(ARSENAL),1);
      TEAMS.unshift(ARSENAL);
      if(typeof TEAM_ROSTERS!=='undefined') TEAM_ROSTERS[ARSENAL]=arsenalBase().map(p=>({name:p.name,position:p.position,number:p.number}));
      const existing=db[ARSENAL]||{club:blankClub(),players:[],fixtureData:{}};
      const savedByName=new Map((existing.players||[]).map(p=>[norm(p.name),p]));
      const merged=arsenalBase().map(p=>({...p,...(savedByName.get(norm(p.name))||{}),name:p.name,position:p.position,number:p.number}));
      (existing.players||[]).forEach(p=>{if(p?.name&&!merged.some(x=>norm(x.name)===norm(p.name))) merged.push({...playerFromSeed([p.name,p.position||'Midfielder',p.number??null]),...p});});
      db[ARSENAL]={...existing,club:{...blankClub(),...(existing.club||{})},players:merged,fixtureData:existing.fixtureData||{}};
      const originalRosterForTeam=typeof window.rosterForTeam==='function'?window.rosterForTeam:null;
      window.rosterForTeam=function(team){if(team===ARSENAL){const current=(db[ARSENAL]?.players||[]);return current.length?current.map(p=>({...p})):arsenalBase();}return originalRosterForTeam?originalRosterForTeam(team):[];};
      const originalTeamPlayers=typeof window.teamPlayers==='function'?window.teamPlayers:null;
      window.teamPlayers=function(team){if(team===ARSENAL)return db[ARSENAL]?.players||[];return originalTeamPlayers?originalTeamPlayers(team):(db[team]?.players||[]);};
      if(typeof ALL_FIXTURES!=='undefined') ALL_FIXTURES.filter(f=>f.home===ARSENAL||f.away===ARSENAL).forEach(f=>{if(db[ARSENAL].fixtureData?.[f.id])return;const opponent=f.home===ARSENAL?f.away:f.home;const copy=db[opponent]?.fixtureData?.[f.id];if(copy){db[ARSENAL].fixtureData=db[ARSENAL].fixtureData||{};db[ARSENAL].fixtureData[f.id]=clone(copy);}});
      ['teamSelect','inputTeam'].forEach(id=>{const el=document.getElementById(id);if(!el)return;[...el.options].filter(o=>o.value===ARSENAL).forEach(o=>o.remove());el.add(new Option(ARSENAL,ARSENAL),0);});
      const teamSelect=document.getElementById('teamSelect'),inputTeam=document.getElementById('inputTeam');if(teamSelect)teamSelect.value=ARSENAL;if(inputTeam)inputTeam.value=ARSENAL;
      if(typeof recalculatePlayerStatsFromFixtures==='function')recalculatePlayerStatsFromFixtures(ARSENAL);
      if(typeof recalculateClubStatsFromFixtures==='function')recalculateClubStatsFromFixtures(ARSENAL);
      const marker=document.getElementById('buildMarker');if(marker)marker.textContent='BUILD V17 • RESTORED COMPLETED MATCH INFO';
      const hero=document.querySelector('.hero p');if(hero)hero.textContent='Admin record workspace for all 20 Premier League clubs, including Arsenal. Existing completed-match information is restored into editable inputs, completed-match player stats are recorded per fixture, and Arsenal season totals synchronize through the Record Room.';
      const manualTitle=document.querySelector('.admin h3');if(manualTitle&&/Other 19 Teams/i.test(manualTitle.textContent||''))manualTitle.textContent='All 20 Teams Stat Input';
      if(typeof render==='function')render();
    }catch(err){console.warn('[NL4 Record Room] Arsenal registration failed:',err);}
  }
  registerArsenal();

  const loadScript=src=>new Promise((resolve,reject)=>{if(document.querySelector(`script[data-nl4-rr-src="${src}"]`))return resolve();const s=document.createElement('script');s.src=src;s.dataset.nl4RrSrc=src;s.onload=resolve;s.onerror=()=>reject(new Error(`Could not load ${src}`));document.head.appendChild(s);});
  // Lightweight match metadata, completed-match player inputs and public-stat bridge are automatic.
  loadScript('record-room-match-meta.js?v=20260905-v2').catch(err=>console.warn('[NL4 Record Room] Match information failed:',err));
  loadScript('record-room-player-match-stats.js?v=20260905-v5').catch(err=>console.warn('[NL4 Record Room] Player match stats failed:',err));
  loadScript('record-room-arsenal-public-sync.js?v=20260905-v4').catch(err=>console.warn('[NL4 Record Room] Public stats bridge failed:',err));

  let toolsPromise=null;
  window.NL4LoadRecordRoomMaintenance=function(){if(toolsPromise)return toolsPromise;toolsPromise=Promise.resolve().then(()=>loadScript('record-room-supabase.js')).then(()=>loadScript('record-room-supabase-bridge.js')).then(()=>loadScript('record-room-completed-import.js')).then(()=>loadScript('record-room-participation-events-fix.js')).then(()=>loadScript('record-room-verified-stats.js')).then(()=>loadScript('record-room-canonical-events-v4.js')).then(()=>loadScript('record-room-assists-motm-v5.js')).then(()=>loadScript('record-room-player-calculation-v6.js')).then(()=>loadScript('record-room-event-display-fix.js')).then(()=>loadScript('record-room-season-sync-fix.js')).then(()=>loadScript('record-room-matchday-groups.js')).catch(err=>{toolsPromise=null;throw err;});return toolsPromise;};
  const addButton=()=>{const actions=document.querySelector('.admin-record-actions');if(!actions||document.getElementById('rrLoadMaintenance'))return;const b=document.createElement('button');b.id='rrLoadMaintenance';b.type='button';b.textContent='Load full data tools';b.title='Loads heavy Record Room import, audit and season-sync tools only when you request them.';b.addEventListener('click',async()=>{if(b.dataset.loaded==='1')return;b.disabled=true;b.textContent='Loading data tools…';try{await window.NL4LoadRecordRoomMaintenance();b.dataset.loaded='1';b.textContent='Data tools loaded';}catch(error){console.warn('[NL4 Record Room] Manual data-tool load failed:',error);b.disabled=false;b.textContent='Retry data tools';}});actions.insertBefore(b,document.getElementById('recordRoomLogout')||null);};
  addButton();
}

if(document.getElementById('arsenalPremierLeagueStats') || document.getElementById('arsenalPlayerStats')){
  const s=document.createElement('script');s.src='premier-league-record-room-sync.js?v=20260905-v2';s.defer=true;document.head.appendChild(s);
}