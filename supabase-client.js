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
  const arsenalDirectory=()=>arsenalSeeds.map(([name,position,number])=>({name,position,number}));
  const blankClub=()=>({matches:0,avgPossession:0,totalShots:0,shotsOnTarget:0,corners:0,cornerGoals:0,fouls:0,offsides:0,yellowCards:0,redCards:0,points:0});
  const clone=v=>JSON.parse(JSON.stringify(v));

  let rrRegistering=false;
  let nativeBindingsPatched=false;

  function ensureArsenalOption(el){
    if(!el)return false;
    const existing=[...el.options].filter(o=>o.value===ARSENAL);
    if(existing.length>1)existing.slice(1).forEach(o=>o.remove());
    if(!existing.length){el.add(new Option(ARSENAL,ARSENAL),0);}
    else if(el.options[0]!==existing[0]){el.removeChild(existing[0]);el.add(existing[0],0);}
    return true;
  }

  function patchNativeRecordRoomBindings(){
    if(nativeBindingsPatched)return;
    try{
      if(typeof TEAM_ROSTERS!=='undefined') TEAM_ROSTERS[ARSENAL]=arsenalDirectory();
      if(typeof PLAYER_DIRECTORY!=='undefined') PLAYER_DIRECTORY[ARSENAL.toLowerCase()]=arsenalDirectory();
      if(typeof rosterForTeam==='function'){
        const nativeRosterForTeam=rosterForTeam;
        rosterForTeam=function(team){if(team===ARSENAL){const current=(typeof db!=='undefined'&&db?.[ARSENAL]?.players)||[];return (current.length?current:arsenalBase()).map(p=>({...p}));}return nativeRosterForTeam(team);};
        window.rosterForTeam=rosterForTeam;
      }
      if(typeof teamPlayers==='function'){
        const nativeTeamPlayers=teamPlayers;
        teamPlayers=function(team){if(team===ARSENAL)return (typeof db!=='undefined'&&db?.[ARSENAL]?.players)||arsenalBase();return nativeTeamPlayers(team);};
        window.teamPlayers=teamPlayers;
      }
      nativeBindingsPatched=true;
    }catch(err){console.warn('[NL4 Record Room] Native Arsenal binding patch failed:',err);}
  }

  function registerArsenal(forceSelection=false){
    if(rrRegistering)return false;
    rrRegistering=true;
    try{
      if(typeof TEAMS==='undefined' || typeof db==='undefined') return false;
      while(TEAMS.includes(ARSENAL)) TEAMS.splice(TEAMS.indexOf(ARSENAL),1);
      TEAMS.unshift(ARSENAL);
      const teamSelect=document.getElementById('teamSelect');
      const inputTeam=document.getElementById('inputTeam');
      ensureArsenalOption(teamSelect);ensureArsenalOption(inputTeam);
      if(forceSelection){if(teamSelect)teamSelect.value=ARSENAL;if(inputTeam)inputTeam.value=ARSENAL;}
      if(window.__NL4_FINAL_SQUAD_SYNC_READY__){
        return true;
      }
      if(typeof TEAM_ROSTERS!=='undefined') TEAM_ROSTERS[ARSENAL]=arsenalDirectory();
      if(typeof PLAYER_DIRECTORY!=='undefined') PLAYER_DIRECTORY[ARSENAL.toLowerCase()]=arsenalDirectory();
      const existing=db[ARSENAL]||{club:blankClub(),players:[],fixtureData:{}};
      const savedByName=new Map((existing.players||[]).map(p=>[norm(p.name),p]));
      const merged=arsenalBase().map(p=>({...p,...(savedByName.get(norm(p.name))||{}),name:p.name,position:p.position,number:p.number}));
      (existing.players||[]).forEach(p=>{if(p?.name&&!merged.some(x=>norm(x.name)===norm(p.name)))merged.push({...playerFromSeed([p.name,p.position||'Midfielder',p.number??null]),...p});});
      db[ARSENAL]={...existing,club:{...blankClub(),...(existing.club||{})},players:merged,fixtureData:existing.fixtureData||{}};
      patchNativeRecordRoomBindings();
      if(typeof ALL_FIXTURES!=='undefined')ALL_FIXTURES.filter(f=>f.home===ARSENAL||f.away===ARSENAL).forEach(f=>{if(db[ARSENAL].fixtureData?.[f.id])return;const opponent=f.home===ARSENAL?f.away:f.home;const copy=db[opponent]?.fixtureData?.[f.id];if(copy){db[ARSENAL].fixtureData=db[ARSENAL].fixtureData||{};db[ARSENAL].fixtureData[f.id]=clone(copy);}});
      if(typeof recalculatePlayerStatsFromFixtures==='function')recalculatePlayerStatsFromFixtures(ARSENAL);
      if(typeof recalculateClubStatsFromFixtures==='function')recalculateClubStatsFromFixtures(ARSENAL);
      try{if(typeof persist==='function')persist();}catch(_){ }
      const hero=document.querySelector('.hero p');if(hero)hero.textContent='Admin record workspace for all 20 Premier League clubs, including Arsenal, with full squad, fixtures, lineups, substitutions, events, match stats and season calculations.';
      const manualTitle=document.querySelector('.admin h3');if(manualTitle&&/Other 19 Teams/i.test(manualTitle.textContent||''))manualTitle.textContent='All 20 Teams Stat Input';
      return true;
    }catch(err){console.warn('[NL4 Record Room] Arsenal registration failed:',err);return false;}
    finally{rrRegistering=false;}
  }

  registerArsenal(true);
  [0,80,250,700,1500,3000].forEach(delay=>setTimeout(()=>registerArsenal(false),delay));
  window.addEventListener('pageshow',()=>registerArsenal(false));
  window.addEventListener('focus',()=>registerArsenal(false));

  const watchSelectors=()=>{['teamSelect','inputTeam'].forEach(id=>{const el=document.getElementById(id);if(!el||el.dataset.arsenalWatch==='1')return;el.dataset.arsenalWatch='1';new MutationObserver(()=>{if(![...el.options].some(o=>o.value===ARSENAL))registerArsenal(false);}).observe(el,{childList:true});});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{registerArsenal(false);watchSelectors();},{once:true});else watchSelectors();

  const loadScript=src=>new Promise((resolve,reject)=>{const base=src.split('?')[0];const existing=[...document.scripts].find(el=>{try{return (el.getAttribute('src')||'').split('?')[0]===base}catch(_){return false}});if(existing)return resolve();const s=document.createElement('script');s.src=src;s.dataset.nl4RrSrc=src;s.onload=resolve;s.onerror=()=>reject(new Error(`Could not load ${src}`));document.head.appendChild(s);});

  Promise.resolve()
    .then(()=>loadScript('premier-league-final-squads-2026-27.js?v=20260905-final8'))
    .then(()=>loadScript('record-room-final-squad-history-sync.js?v=20260905-v34'))
    .then(()=>loadScript('record-room-match-meta.js?v=20260905-v34-mobile-info2'))
    .then(()=>loadScript('record-room-player-match-stats.js?v=20260905-v5'))
    .then(()=>loadScript('record-room-matchday-2026-09-04.js?v=20260905-v1'))
    .then(()=>loadScript('record-room-goalkeeper-saves-v10.js?v=20260905-v2'))
    .then(()=>{window.NL4RecordRoomGoalkeeperSaves?.install?.();window.NL4RecordRoomGoalkeeperSaves?.recalcAll?.();window.NL4FinalSquadHistorySync?.syncAll?.();registerArsenal(false);})
    .then(()=>loadScript('record-room-arsenal-public-sync.js?v=20260905-v4'))
    .then(()=>registerArsenal(false))
    .catch(err=>console.warn('[NL4 Record Room] Lightweight startup module failed:',err));

  let toolsPromise=null;
  window.NL4LoadRecordRoomMaintenance=function(){
    if(toolsPromise)return toolsPromise;
    toolsPromise=Promise.resolve()
      .then(()=>loadScript('record-room-supabase.js')).then(()=>loadScript('record-room-supabase-bridge.js')).then(()=>loadScript('record-room-completed-import.js')).then(()=>loadScript('record-room-participation-events-fix.js')).then(()=>loadScript('record-room-verified-stats.js')).then(()=>loadScript('record-room-canonical-events-v4.js')).then(()=>loadScript('record-room-assists-motm-v5.js')).then(()=>loadScript('record-room-player-calculation-v6.js')).then(()=>loadScript('record-room-event-display-fix.js')).then(()=>loadScript('record-room-season-sync-fix.js')).then(()=>loadScript('record-room-matchday-groups.js'))
      .then(()=>{window.NL4RecordRoomGoalkeeperSaves?.install?.();window.NL4RecordRoomGoalkeeperSaves?.recalcAll?.();window.NL4FinalSquadHistorySync?.syncAll?.();registerArsenal(false);})
      .catch(err=>{toolsPromise=null;throw err;});
    return toolsPromise;
  };
  const addButton=()=>{const actions=document.querySelector('.admin-record-actions');if(!actions||document.getElementById('rrLoadMaintenance'))return;const b=document.createElement('button');b.id='rrLoadMaintenance';b.type='button';b.textContent='Load full data tools';b.title='Loads heavy Record Room import, audit and season-sync tools only when you request them.';b.addEventListener('click',async()=>{if(b.dataset.loaded==='1')return;b.disabled=true;b.textContent='Loading data tools…';try{await window.NL4LoadRecordRoomMaintenance();b.dataset.loaded='1';b.textContent='Data tools loaded';registerArsenal(false);}catch(error){console.warn('[NL4 Record Room] Manual data-tool load failed:',error);b.disabled=false;b.textContent='Retry data tools';}});actions.insertBefore(b,document.getElementById('recordRoomLogout')||null);};
  addButton();
}

if(document.getElementById('arsenalPremierLeagueStats') || document.getElementById('arsenalPlayerStats')){
  const data=document.createElement('script');
  data.src='premier-league-final-squads-2026-27.js?v=20260905-final8';
  data.onload=()=>{const s=document.createElement('script');s.src='premier-league-record-room-sync.js?v=20260905-v6';document.head.appendChild(s);};
  data.onerror=()=>{const s=document.createElement('script');s.src='premier-league-record-room-sync.js?v=20260905-v6';document.head.appendChild(s);};
  document.head.appendChild(data);
}