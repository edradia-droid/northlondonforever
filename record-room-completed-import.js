// NL4 Record Room — visible completed-match importer (admin only)
(function(){
'use strict';
const MATCHES=[
['Arsenal','Coventry City',3,0],['Hull City','Manchester United',2,0],['Everton','Crystal Palace',2,0],['Ipswich Town','Sunderland',2,1],['Nottingham Forest','Leeds United',0,1],['Brentford','Tottenham Hotspur',3,0],['Brighton & Hove Albion','Aston Villa',4,0],['Manchester City','AFC Bournemouth',2,1],['Newcastle United','Liverpool',2,2],['Fulham','Chelsea',2,3],['Crystal Palace','Manchester City',1,4],['Liverpool','Nottingham Forest',2,2],['AFC Bournemouth','Everton',1,1],['Coventry City','Hull City',0,1],['Tottenham Hotspur','Newcastle United',0,2],['Chelsea','Brighton & Hove Albion',4,3],['Leeds United','Brentford',1,1],['Sunderland','Fulham',1,0],['Manchester United','Ipswich Town',5,2]
];
const DETAILS={
'Hull City|||Manchester United':{referee:'Darren England',venue:'The MKM Stadium',attendance:24470,ht:[2,0],addedTime:6,motm:'Hull City|||Ryan Giles',stats:{possession:[29,71],shots:[5,9],sot:[4,2],corners:[1,1],fouls:[6,7],offsides:[0,1],saves:[2,2]}},
'Coventry City|||Hull City':{referee:'Josh Smith',venue:'Coventry Building Society Arena',attendance:31239,ht:[0,0],addedTime:5,events:[['goal',82,'Hull City|||Liam Millar','Hull City|||Mohamed Belloumi']]},
'AFC Bournemouth|||Everton':{referee:'Chris Kavanagh',venue:'Vitality Stadium',ht:[1,0],addedTime:4,stats:{possession:[59,41],shots:[17,13],sot:[5,7],corners:[10,7]},events:[['goal',41,'AFC Bournemouth|||Alex Scott','AFC Bournemouth|||Evanilson'],['goal',91,'Everton|||James Tarkowski','']]},
'Tottenham Hotspur|||Newcastle United':{referee:'Peter Bankes',venue:'Tottenham Hotspur Stadium',attendance:61025,ht:[0,0],addedTime:4,events:[['yellow',3,'Tottenham Hotspur|||Micky van de Ven',''],['yellow',13,'Newcastle United|||Nico González',''],['goal',62,'Newcastle United|||Anthony Elanga','Newcastle United|||Amar Dedić'],['goal',72,'Newcastle United|||Yoane Wissa','Newcastle United|||Nick Woltemade'],['yellow',79,'Newcastle United|||Sven Botman','']]},
'Chelsea|||Brighton & Hove Albion':{referee:'Michael Oliver',venue:'Stamford Bridge',ht:[3,1],motm:'Chelsea|||João Pedro',stats:{possession:[25.6,74.4],shots:[17,15],sot:[6,6],corners:[4,7],fouls:[6,12],saves:[4,1]}},
'Leeds United|||Brentford':{referee:'Tony Harrington',venue:'Elland Road',attendance:35971,ht:[0,1],stats:{possession:[47,53],shots:[13,22],sot:[2,5],corners:[5,6],fouls:[5,13],offsides:[2,0],saves:[4,1]}},
'Sunderland|||Fulham':{referee:'Michael Salisbury',venue:'Stadium of Light',attendance:46781,ht:[0,0],addedTime:4,stats:{possession:[42,58],shots:[12,11],sot:[4,0],corners:[3,4],fouls:[10,15],offsides:[1,1],saves:[0,3]},events:[['goal',75,'Sunderland|||Wilson Isidor','Sunderland|||Habib Diarra'],['yellow',35,'Fulham|||Joachim Andersen',''],['yellow',59,'Fulham|||César Palacios','']]},
'Manchester United|||Ipswich Town':{referee:'Craig Pawson',venue:'Old Trafford',attendance:74148,ht:[1,1],motm:'Manchester United|||Bruno Fernandes',stats:{possession:[60,40],shots:[33,9],sot:[12,5],corners:[8,4],fouls:[7,12]}}
};
const fixtures=()=>typeof ALL_FIXTURES!=='undefined'?ALL_FIXTURES:[];
const hasDb=()=>typeof db!=='undefined';
const findFixture=(h,a)=>fixtures().find(f=>f.home===h&&f.away===a);
const copy=v=>JSON.parse(JSON.stringify(v));
function apply(row){
 const [h,a,hs,as]=row,f=findFixture(h,a); if(!f)return false;
 const clubs=[h,a].filter(t=>hasDb()&&db[t]); if(!clubs.length)return false;
 const s=fixtureStore(clubs[0],f.id); s.homeScore=hs;s.awayScore=as;
 const d=DETAILS[`${h}|||${a}`];
 if(d){
  s.matchDetails={...(s.matchDetails||{}),referee:d.referee||s.matchDetails?.referee||'',venue:d.venue||s.matchDetails?.venue||'',attendance:d.attendance??s.matchDetails?.attendance??null,halftimeHomeScore:d.ht?.[0]??s.matchDetails?.halftimeHomeScore??null,halftimeAwayScore:d.ht?.[1]??s.matchDetails?.halftimeAwayScore??null,addedTime:d.addedTime??s.matchDetails?.addedTime??0};
  if(d.motm&&!s.manOfTheMatch)s.manOfTheMatch=d.motm;
  Object.entries(d.stats||{}).forEach(([k,v])=>{s.stats=s.stats||{};s.stats[k]={h:v[0],a:v[1]};});
  if(d.events&&(!s.events||!s.events.length))s.events=d.events.map(e=>({type:e[0],minute:e[1],player:e[2],assist:e[3]}));
 }
 clubs.forEach(t=>{db[t].fixtureData=db[t].fixtureData||{};db[t].fixtureData[f.id]=copy(s);}); return true;
}
function status(row){const f=findFixture(row[0],row[1]);if(!f||!hasDb())return 'NOT FOUND';const t=db[row[0]]?row[0]:row[1],s=db[t]?.fixtureData?.[f.id];return s&&Number(s.homeScore)===row[2]&&Number(s.awayScore)===row[3]?'IMPORTED':'READY';}
function paint(){const box=document.getElementById('rrCompletedRows');if(!box)return;box.innerHTML=MATCHES.map(r=>`<div style="display:grid;grid-template-columns:1fr auto;gap:12px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.08)"><span>${r[0]} <b>${r[2]}–${r[3]}</b> ${r[1]}</span><b style="font-size:10px">${status(r)}</b></div>`).join('');}
function run(){let count=0;MATCHES.forEach(r=>{if(apply(r))count++;});const touched=new Set(MATCHES.flatMap(r=>[r[0],r[1]]));touched.forEach(t=>{if(hasDb()&&db[t]){recalculatePlayerStatsFromFixtures(t);recalculateClubStatsFromFixtures(t);}});if(typeof persist==='function')persist();if(typeof render==='function')render();paint();const s=document.getElementById('rrCompletedStatus');if(s)s.textContent=`${count}/${MATCHES.length} completed matches applied. Open any club fixture to review the displayed data.`;}
function mount(){if(document.getElementById('rrCompletedUpdates'))return;const target=document.querySelector('.admin-shell,main,.container')||document.body,p=document.createElement('section');p.id='rrCompletedUpdates';p.style.cssText='margin:18px 0;padding:18px;border:1px solid rgba(255,255,255,.14);border-radius:16px;background:rgba(8,8,8,.88)';p.innerHTML=`<div style="display:flex;justify-content:space-between;gap:15px;align-items:center;flex-wrap:wrap"><div><div style="font-size:10px;font-weight:900;letter-spacing:.16em;opacity:.7">2026/27 PREMIER LEAGUE</div><h3 style="margin:5px 0">COMPLETED MATCH UPDATES</h3><p id="rrCompletedStatus" style="margin:0;opacity:.7;font-size:12px">19 completed matches detected. Importing updates will preserve existing richer manual match data.</p></div><button id="rrImportCompleted" type="button" style="padding:11px 16px;border:0;border-radius:10px;font-weight:900;cursor:pointer">IMPORT COMPLETED MATCHES</button></div><div id="rrCompletedRows" style="margin-top:14px"></div>`;target.insertBefore(p,target.firstChild);document.getElementById('rrImportCompleted').onclick=run;paint();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,300));else setTimeout(mount,300);
})();
