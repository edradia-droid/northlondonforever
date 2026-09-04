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
  // Arsenal is registered directly here so it is not dependent on a second script
  // request or an idle callback. This remains a one-time lightweight operation.
  const arsenalPlayers=[
    ['David Raya','Goalkeeper',1],['Kepa Arrizabalaga','Goalkeeper',13],['Illan Meslier','Goalkeeper',30],['Tommy Setford','Goalkeeper',35],
    ['William Saliba','Defender',2],['Cristhian Mosquera','Defender',3],['Ben White','Defender',4],['Piero Hincapié','Defender',5],['Gabriel Magalhães','Defender',6],['Jurriën Timber','Defender',12],['Riccardo Calafiori','Defender',33],['Myles Lewis-Skelly','Defender',49],['Ezri Konsa','Defender',null],
    ['Martin Ødegaard','Midfielder',8],['Eberechi Eze','Midfielder',10],['Fabio Vieira','Midfielder',21],['Ethan Nwaneri','Midfielder',22],['Mikel Merino','Midfielder',23],['Martín Zubimendi','Midfielder',36],['Bruno Guimarães','Midfielder',39],['Declan Rice','Midfielder',41],['Max Dowman','Midfielder',null],
    ['Bukayo Saka','Forward',7],['Gabriel Jesus','Forward',9],['Christos Tzolis','Forward',null],['Kai Havertz','Forward',null],['Noni Madueke','Forward',null],['Gabriel Martinelli','Forward',null],['Viktor Gyökeres','Forward',null]
  ];
  const makePlayer=([name,position,number])=>({name,position,number,appearances:0,starts:0,minutes:0,goals:0,assists:0,cleanSheets:0,yellowCards:0,redCards:0,mom:0,shots:0,shotsOnTarget:0,chancesCreated:0,tackles:0,interceptions:0,saves:0});
  const blankClub=()=>({matches:0,avgPossession:0,totalShots:0,shotsOnTarget:0,corners:0,cornerGoals:0,fouls:0,offsides:0,yellowCards:0,redCards:0,points:0});
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();

  const registerArsenal=()=>{
    try{
      if(typeof TEAMS!=='undefined'){
        while(TEAMS.includes('Arsenal')) TEAMS.splice(TEAMS.indexOf('Arsenal'),1);
        TEAMS.unshift('Arsenal');
      }
      if(typeof TEAM_ROSTERS!=='undefined') TEAM_ROSTERS.Arsenal=arsenalPlayers.map(makePlayer);
      if(typeof db!=='undefined'){
        const existing=db.Arsenal||{club:blankClub(),players:[],fixtureData:{}};
        const saved=new Map((existing.players||[]).map(p=>[norm(p.name),p]));
        const roster=arsenalPlayers.map(seed=>{
          const base=makePlayer(seed), old=saved.get(norm(seed[0]))||{};
          return {...base,...old,name:base.name,position:base.position,number:base.number};
        });
        (existing.players||[]).forEach(p=>{if(p?.name&&!roster.some(x=>norm(x.name)===norm(p.name)))roster.push({...makePlayer([p.name,p.position||'Midfielder',p.number??null]),...p});});
        db.Arsenal={...existing,club:{...blankClub(),...(existing.club||{})},players:roster,fixtureData:existing.fixtureData||{}};
      }
      ['teamSelect','inputTeam'].forEach(id=>{
        const el=document.getElementById(id); if(!el)return;
        const selected=el.value;
        [...el.options].filter(o=>o.value==='Arsenal').forEach(o=>o.remove());
        el.add(new Option('Arsenal','Arsenal'),0);
        if(selected&&selected!=='Arsenal'&&[...el.options].some(o=>o.value===selected))el.value=selected;
      });
      const marker=document.getElementById('buildMarker');
      if(marker)marker.textContent='BUILD V12 • ALL 20 PREMIER LEAGUE TEAMS • ARSENAL INCLUDED';
      const hero=document.querySelector('.hero p');
      if(hero)hero.textContent='Admin record workspace for all 20 Premier League clubs, including Arsenal. Every club uses the same 2026/27 club stats, player stats, fixtures, lineups, substitutions, match events, goalkeeper saves, cards and Man of the Match structure.';
      if(typeof render==='function')render();
    }catch(err){console.warn('[NL4 Record Room] Direct Arsenal registration failed:',err);}
  };
  registerArsenal();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',registerArsenal,{once:true});

  const loadScript = src => new Promise((resolve,reject)=>{
    if (document.querySelector(`script[data-nl4-rr-src="${src}"]`)) return resolve();
    const s=document.createElement('script');
    s.src=src;
    s.dataset.nl4RrSrc=src;
    s.onload=resolve;
    s.onerror=()=>reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });

  let toolsPromise=null;
  window.NL4LoadRecordRoomMaintenance = function(){
    if (toolsPromise) return toolsPromise;
    toolsPromise=Promise.resolve()
      .then(()=>loadScript('record-room-supabase.js'))
      .then(()=>loadScript('record-room-supabase-bridge.js'))
      .then(()=>loadScript('record-room-completed-import.js'))
      .then(()=>loadScript('record-room-participation-events-fix.js'))
      .then(()=>loadScript('record-room-verified-stats.js'))
      .then(()=>loadScript('record-room-canonical-events-v4.js'))
      .then(()=>loadScript('record-room-assists-motm-v5.js'))
      .then(()=>loadScript('record-room-player-calculation-v6.js'))
      .then(()=>loadScript('record-room-event-display-fix.js'))
      .then(()=>loadScript('record-room-season-sync-fix.js'))
      .then(()=>loadScript('record-room-matchday-groups.js'))
      .catch(err=>{ toolsPromise=null; throw err; });
    return toolsPromise;
  };

  const addButton=()=>{
    const actions=document.querySelector('.admin-record-actions');
    if(!actions || document.getElementById('rrLoadMaintenance')) return;
    const b=document.createElement('button');
    b.id='rrLoadMaintenance';
    b.type='button';
    b.textContent='Load full data tools';
    b.title='Loads heavy Record Room import, audit and season-sync tools only when you request them.';
    b.addEventListener('click',async()=>{
      if(b.dataset.loaded==='1') return;
      b.disabled=true;
      b.textContent='Loading data tools…';
      try{
        await window.NL4LoadRecordRoomMaintenance();
        b.dataset.loaded='1';
        b.textContent='Data tools loaded';
      }catch(error){
        console.warn('[NL4 Record Room] Manual data-tool load failed:',error);
        b.disabled=false;
        b.textContent='Retry data tools';
      }
    });
    actions.insertBefore(b,document.getElementById('recordRoomLogout')||null);
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',addButton,{once:true});
  else addButton();
}
