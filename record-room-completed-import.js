// NL4 Record Room — completed 2026/27 Premier League match importer
// Admin-page helper only. Uses the existing Record Room local state/recalculation pipeline.
// It never writes to Arsenal forecast/model tables.
(function(){
  'use strict';

  const MATCHES=[
    ['Arsenal','Coventry City',3,0],
    ['Hull City','Manchester United',2,0],
    ['Everton','Crystal Palace',2,0],
    ['Ipswich Town','Sunderland',2,1],
    ['Nottingham Forest','Leeds United',0,1],
    ['Brentford','Tottenham Hotspur',3,0],
    ['Brighton & Hove Albion','Aston Villa',4,0],
    ['Manchester City','AFC Bournemouth',2,1],
    ['Newcastle United','Liverpool',2,2],
    ['Fulham','Chelsea',2,3],
    ['Crystal Palace','Manchester City',1,4],
    ['Liverpool','Nottingham Forest',2,2],
    ['AFC Bournemouth','Everton',1,1],
    ['Coventry City','Hull City',0,1],
    ['Tottenham Hotspur','Newcastle United',0,2],
    ['Chelsea','Brighton & Hove Albion',4,3],
    ['Leeds United','Brentford',1,1],
    ['Sunderland','Fulham',1,0],
    ['Manchester United','Ipswich Town',5,2]
  ];

  const DETAILS={
    'Hull City|||Manchester United':{referee:'Darren England',venue:'The MKM Stadium',attendance:24470,halftimeHomeScore:2,halftimeAwayScore:0,addedTime:6,manOfTheMatch:'Hull City|||Ryan Giles',stats:{possession:{h:29,a:71},shots:{h:5,a:9},sot:{h:4,a:2},corners:{h:1,a:1},fouls:{h:6,a:7},offsides:{h:0,a:1},saves:{h:2,a:2}}},
    'Coventry City|||Hull City':{referee:'Josh Smith',venue:'Coventry Building Society Arena',attendance:31239,halftimeHomeScore:0,halftimeAwayScore:0,addedTime:5,events:[{type:'goal',minute:82,player:'Hull City|||Liam Millar',assist:'Hull City|||Mohamed Belloumi'}]},
    'AFC Bournemouth|||Everton':{referee:'Chris Kavanagh',venue:'Vitality Stadium',halftimeHomeScore:1,halftimeAwayScore:0,addedTime:4,stats:{possession:{h:59,a:41},shots:{h:17,a:13},sot:{h:5,a:7},corners:{h:10,a:7}},events:[{type:'goal',minute:41,player:'AFC Bournemouth|||Alex Scott',assist:'AFC Bournemouth|||Evanilson'},{type:'goal',minute:91,player:'Everton|||James Tarkowski',assist:''}]},
    'Tottenham Hotspur|||Newcastle United':{referee:'Peter Bankes',venue:'Tottenham Hotspur Stadium',attendance:61025,halftimeHomeScore:0,halftimeAwayScore:0,addedTime:4,events:[{type:'yellow',minute:3,player:'Tottenham Hotspur|||Micky van de Ven',assist:''},{type:'yellow',minute:13,player:'Newcastle United|||Nico González',assist:''},{type:'goal',minute:62,player:'Newcastle United|||Anthony Elanga',assist:'Newcastle United|||Amar Dedić'},{type:'goal',minute:72,player:'Newcastle United|||Yoane Wissa',assist:'Newcastle United|||Nick Woltemade'},{type:'yellow',minute:79,player:'Newcastle United|||Sven Botman',assist:''}]},
    'Chelsea|||Brighton & Hove Albion':{referee:'Michael Oliver',venue:'Stamford Bridge',halftimeHomeScore:3,halftimeAwayScore:1,manOfTheMatch:'Chelsea|||João Pedro',stats:{possession:{h:25.6,a:74.4},shots:{h:17,a:15},sot:{h:6,a:6},corners:{h:4,a:7},fouls:{h:6,a:12},saves:{h:4,a:1}}},
    'Leeds United|||Brentford':{referee:'Tony Harrington',venue:'Elland Road',attendance:35971,halftimeHomeScore:0,halftimeAwayScore:1,stats:{possession:{h:47,a:53},shots:{h:13,a:22},sot:{h:2,a:5},corners:{h:5,a:6},fouls:{h:5,a:13},offsides:{h:2,a:0},saves:{h:4,a:1}}},
    'Sunderland|||Fulham':{referee:'Michael Salisbury',venue:'Stadium of Light',attendance:46781,halftimeHomeScore:0,halftimeAwayScore:0,addedTime:4,stats:{possession:{h:42,a:58},shots:{h:12,a:11},sot:{h:4,a:0},corners:{h:3,a:4},fouls:{h:10,a:15},offsides:{h:1,a:1},saves:{h:0,a:3}},events:[{type:'goal',minute:75,player:'Sunderland|||Wilson Isidor',assist:'Sunderland|||Habib Diarra'},{type:'yellow',minute:35,player:'Fulham|||Joachim Andersen',assist:''},{type:'yellow',minute:59,player:'Fulham|||César Palacios',assist:''}]},
    'Manchester United|||Ipswich Town':{referee:'Craig Pawson',venue:'Old Trafford',attendance:74148,halftimeHomeScore:1,halftimeAwayScore:1,manOfTheMatch:'Manchester United|||Bruno Fernandes',stats:{possession:{h:60,a:40},shots:{h:33,a:9},sot:{h:12,a:5},corners:{h:8,a:4},fouls:{h:7,a:12}}}
  };

  function fixtureFor(home,away){
    return (window.ALL_FIXTURES||[]).find(f=>f.home===home&&f.away===away);
  }
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function mergeStats(base,extra){
    const out=base||{};
    Object.entries(extra||{}).forEach(([k,v])=>{out[k]={...(out[k]||{}),...v};});
    return out;
  }
  function applyOne(row){
    const [home,away,hs,as]=row, f=fixtureFor(home,away);
    if(!f) return {ok:false,label:`${home} ${hs}-${as} ${away}`,reason:'fixture not found'};
    const clubs=[home,away].filter(t=>window.db&&db[t]);
    if(!clubs.length) return {ok:false,label:`${home} ${hs}-${as} ${away}`,reason:'Record Room club state unavailable'};
    const canonical=clubs[0];
    const s=fixtureStore(canonical,f.id);
    s.homeScore=hs; s.awayScore=as;
    const d=DETAILS[`${home}|||${away}`];
    if(d){
      s.matchDetails={...(s.matchDetails||{}),referee:d.referee||s.matchDetails?.referee||'',venue:d.venue||s.matchDetails?.venue||'',attendance:d.attendance??s.matchDetails?.attendance??null,halftimeHomeScore:d.halftimeHomeScore??s.matchDetails?.halftimeHomeScore??null,halftimeAwayScore:d.halftimeAwayScore??s.matchDetails?.halftimeAwayScore??null,addedTime:d.addedTime??s.matchDetails?.addedTime??0};
      if(d.stats) s.stats=mergeStats(s.stats,d.stats);
      if(d.manOfTheMatch&&!s.manOfTheMatch) s.manOfTheMatch=d.manOfTheMatch;
      if(d.events&&(!Array.isArray(s.events)||!s.events.length)) s.events=clone(d.events);
    }
    clubs.forEach(t=>{db[t].fixtureData=db[t].fixtureData||{};db[t].fixtureData[f.id]=clone(s);});
    return {ok:true,label:`${home} ${hs}-${as} ${away}`,fixture:f};
  }
  function importCompleted(){
    const results=MATCHES.map(applyOne);
    const touched=new Set();
    results.filter(x=>x.ok).forEach(x=>{touched.add(x.fixture.home);touched.add(x.fixture.away);});
    touched.forEach(t=>{if(db[t]){recalculatePlayerStatsFromFixtures(t);recalculateClubStatsFromFixtures(t);}});
    if(typeof persist==='function') persist();
    if(typeof render==='function') render();
    paint(results);
    const ok=results.filter(x=>x.ok).length;
    setStatus(`${ok}/${MATCHES.length} completed matches applied to Record Room.`);
  }
  function currentStatus(row){
    const [home,away,hs,as]=row,f=fixtureFor(home,away);
    if(!f) return 'FIXTURE NOT FOUND';
    const club=(window.db&&db[home])?home:away;
    const s=window.db&&db[club]?.fixtureData?.[f.id];
    return s&&Number(s.homeScore)===hs&&Number(s.awayScore)===as?'IMPORTED':'READY';
  }
  function setStatus(text){const el=document.getElementById('rrCompletedStatus');if(el)el.textContent=text;}
  function paint(results){
    const el=document.getElementById('rrCompletedRows'); if(!el)return;
    const map=new Map((results||[]).map(x=>[x.label,x]));
    el.innerHTML=MATCHES.map(r=>{
      const label=`${r[0]} ${r[2]}-${r[3]} ${r[1]}`,res=map.get(label),status=res?(res.ok?'IMPORTED':'ERROR'):currentStatus(r);
      return `<div style="display:grid;grid-template-columns:1fr auto;gap:12px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.08)"><span>${label}</span><b style="font-size:10px;letter-spacing:.08em">${status}</b></div>`;
    }).join('');
  }
  function mount(){
    if(document.getElementById('rrCompletedUpdates'))return;
    const target=document.querySelector('.admin-shell,main,.container')||document.body;
    const panel=document.createElement('section');
    panel.id='rrCompletedUpdates';
    panel.style.cssText='margin:18px 0;padding:18px;border:1px solid rgba(255,255,255,.14);border-radius:16px;background:rgba(8,8,8,.88)';
    panel.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap"><div><div style="font-size:10px;font-weight:900;letter-spacing:.16em;opacity:.7">2026/27 PREMIER LEAGUE</div><h3 style="margin:5px 0">COMPLETED MATCH UPDATES</h3><p id="rrCompletedStatus" style="margin:0;opacity:.7;font-size:12px">Review the completed set, then import it into Record Room.</p></div><button id="rrImportCompleted" type="button" style="padding:11px 16px;border:0;border-radius:10px;font-weight:900;cursor:pointer">IMPORT COMPLETED MATCHES</button></div><div id="rrCompletedRows" style="margin-top:14px"></div>`;
    target.insertBefore(panel,target.firstChild);
    document.getElementById('rrImportCompleted').addEventListener('click',importCompleted);
    paint();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,250));else setTimeout(mount,250);
})();
