// NL4 Record Room — verified Matchweek 3 update: Ipswich Town 0-2 Liverpool, 2026-09-04
(function(){
'use strict';
const VERSION='20260904-ipswich-liverpool-v1';
const FIXTURE_ID=21;
const HOME='Ipswich Town', AWAY='Liverpool';
const clone=v=>JSON.parse(JSON.stringify(v));
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘`]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
const split=v=>{const p=String(v||'').split('|||');return{team:p[0]||'',name:p.slice(1).join('|||')||''};};
const num=v=>{const x=Number(v);return Number.isFinite(x)?x:null;};
function endMinute(saved){
  const added=Math.max(0,num(saved?.matchDetails?.addedTime)??0);let end=90+added;
  ['homeSubs','awaySubs'].forEach(k=>(saved?.[k]||[]).forEach(s=>{[s.outMin,s.inMin].forEach(m=>{m=num(m);if(m!==null&&m>end)end=m;});}));
  (saved?.events||[]).forEach(e=>{const m=num(e.minute);if(m!==null&&m>end)end=m;});
  return Math.max(90,end);
}
function recalcPlayers(team){
  if(typeof db==='undefined'||!db[team]||typeof ALL_FIXTURES==='undefined')return;
  const players=Array.isArray(db[team].players)?db[team].players:[];
  const by=new Map(players.map(p=>[norm(p.name),p]));
  const derived=['appearances','starts','minutes','goals','assists','cleanSheets','yellowCards','redCards','mom','saves'];
  players.forEach(p=>derived.forEach(k=>p[k]=0));
  Object.entries(db[team].fixtureData||{}).forEach(([fixtureId,saved])=>{
    if(saved?.homeScore==null||saved?.awayScore==null)return;
    const f=ALL_FIXTURES.find(x=>String(x.id)===String(fixtureId));if(!f)return;
    const side=f.home===team?'home':f.away===team?'away':null;if(!side)return;
    const end=endMinute(saved), lineup=(saved[side+'Lineup']||[]).filter(Boolean), subs=saved[side+'Subs']||[];
    const state=new Map();
    const ensure=name=>{const k=norm(name);if(!k)return null;if(!state.has(k))state.set(k,{name,start:false,appeared:false,on:null,off:end});return state.get(k);};
    lineup.forEach(name=>{const s=ensure(name);if(s){s.start=true;s.appeared=true;s.on=0;s.off=end;}});
    subs.forEach(sub=>{
      if(sub.out){const s=ensure(sub.out);if(s){s.appeared=true;if(s.on===null)s.on=0;const m=num(sub.outMin);if(m!==null)s.off=Math.max(0,Math.min(end,m));}}
      if(sub.in){const s=ensure(sub.in);if(s){s.appeared=true;const m=num(sub.inMin)??num(sub.outMin)??end;s.on=Math.max(0,Math.min(end,m));s.off=end;}}
    });
    (saved.events||[]).filter(e=>e.type==='red').forEach(e=>{const w=split(e.player);if(w.team!==team)return;const s=ensure(w.name),m=num(e.minute);if(s&&m!==null)s.off=Math.min(s.off,Math.max(0,Math.min(end,m)));});
    state.forEach(s=>{const p=by.get(norm(s.name));if(!p)return;if(s.appeared)p.appearances+=1;if(s.start)p.starts+=1;if(s.appeared){const on=s.on===null?0:s.on;p.minutes+=Math.max(0,Math.round(Math.max(on,s.off)-on));}});
    const gk=lineup.map(name=>by.get(norm(name))).find(p=>p&&norm(p.position)==='goalkeeper');
    if(gk){const k=side==='home'?'h':'a';gk.saves+=Math.max(0,num(saved.stats?.saves?.[k])??0);}
    (saved.events||[]).forEach(e=>{const w=split(e.player);if(w.team===team){const p=by.get(norm(w.name));if(p){if(e.type==='goal')p.goals+=1;if(e.type==='yellow')p.yellowCards+=1;if(e.type==='red')p.redCards+=1;}}if(e.type==='goal'&&e.assist){const a=split(e.assist);if(a.team===team){const p=by.get(norm(a.name));if(p)p.assists+=1;}}});
    if(saved.manOfTheMatch){const m=split(saved.manOfTheMatch);if(m.team===team){const p=by.get(norm(m.name));if(p)p.mom+=1;}}
    const opponent=f.home===team?f.away:f.home;
    const oppGoals=(saved.events||[]).filter(e=>e.type==='goal'&&split(e.player).team===opponent).map(e=>num(e.minute)).filter(Number.isFinite);
    const conceded=Number(side==='home'?saved.awayScore:saved.homeScore)||0,eventComplete=conceded===0||oppGoals.length>=conceded;
    if(eventComplete)state.forEach(s=>{if(!s.appeared)return;const p=by.get(norm(s.name));if(!p)return;const pos=norm(p.position);if(pos!=='goalkeeper'&&pos!=='defender')return;const on=s.on===null?0:s.on,off=Math.max(on,s.off),mins=off-on;if(mins<60)return;if(!oppGoals.some(g=>g>=on&&g<=off))p.cleanSheets+=1;});
  });
  if(db[team].club){db[team].club.yellowCards=players.reduce((a,p)=>a+(Number(p.yellowCards)||0),0);db[team].club.redCards=players.reduce((a,p)=>a+(Number(p.redCards)||0),0);}
}
function apply(){
  if(typeof db==='undefined'||typeof ALL_FIXTURES==='undefined')return false;
  const f=ALL_FIXTURES.find(x=>Number(x.id)===FIXTURE_ID);if(!f||!db[HOME]||!db[AWAY])return false;
  const existing=db[HOME]?.fixtureData?.[FIXTURE_ID]||db[AWAY]?.fixtureData?.[FIXTURE_ID];
  if(existing?.verifiedMatchdayVersion===VERSION)return true;
  const record={
    ...(existing||{}),homeScore:0,awayScore:2,
    homeLineup:['Kjell Scherpen',"Dara O'Shea",'Issa Diop','Jacob Greaves','Leif Davis','Sasa Lukic','Exequiel Palacios','Abdul Fatawu','Julio Enciso','Daizen Maeda','Emersonn'],
    awayLineup:['Alisson Becker','Ronald Araujo','Jeremy Jacquet','Virgil van Dijk','Milos Kerkez','Alexis Mac Allister','Dominik Szoboszlai','Victor Munoz','Florian Wirtz','Cody Gakpo','Alexander Isak'],
    homeSubs:[
      {out:'Daizen Maeda',outMin:66,in:'Jack Clarke',inMin:66},
      {out:'Emersonn',outMin:66,in:'Zian Flemming',inMin:66},
      {out:'Exequiel Palacios',outMin:78,in:'Abdoul Ouattara',inMin:78},
      {out:'Abdul Fatawu',outMin:79,in:'Kasey McAteer',inMin:79}
    ],
    awaySubs:[
      {out:'Alexander Isak',outMin:64,in:'Ryan Gravenberch',inMin:64},
      {out:'Victor Munoz',outMin:64,in:'Bradley Barcola',inMin:64},
      {out:'Alexis Mac Allister',outMin:84,in:'Trey Nyoni',inMin:84},
      {out:'Florian Wirtz',outMin:91,in:'Lewis Koumas',inMin:91}
    ],
    stats:{
      possession:{h:45,a:55},shots:{h:14,a:10},sot:{h:5,a:7},corners:{h:4,a:3},cornerGoals:{h:0,a:0},fouls:{h:6,a:13},offsides:{h:5,a:4},saves:{h:5,a:5}
    },
    events:[
      {type:'goal',minute:6,player:'Liverpool|||Alexander Isak',assist:'Liverpool|||Cody Gakpo'},
      {type:'goal',minute:9,player:'Liverpool|||Alexander Isak',assist:'Liverpool|||Cody Gakpo'},
      {type:'yellow',minute:10,player:'Liverpool|||Alexis Mac Allister',assist:''},
      {type:'yellow',minute:41,player:'Ipswich Town|||Julio Enciso',assist:''},
      {type:'yellow',minute:52,player:'Liverpool|||Jeremy Jacquet',assist:''},
      {type:'yellow',minute:57,player:'Liverpool|||Milos Kerkez',assist:''}
    ],
    manOfTheMatch:'Liverpool|||Alexander Isak',
    matchDetails:{...(existing?.matchDetails||{}),referee:'Darren England',venue:'Portman Road',attendance:'',halftimeHomeScore:0,halftimeAwayScore:2,addedTime:6,kickoff:'20:00',weather:'',notes:'Premier League MW3, Friday 4 September 2026. First-half added time: +3; second-half added time: +6. Attendance/weather left blank because no exact reliable value was verified at import time.'},
    fullDataVerified:true,fullDataVerifiedAt:'2026-09-05',verifiedMatchdayVersion:VERSION,updatedAt:new Date().toISOString()
  };
  [HOME,AWAY].forEach(t=>{db[t].fixtureData=db[t].fixtureData||{};db[t].fixtureData[FIXTURE_ID]=clone(record);});
  [HOME,AWAY].forEach(recalcPlayers);
  if(typeof recalculateClubStatsFromFixtures==='function')[HOME,AWAY].forEach(recalculateClubStatsFromFixtures);
  try{if(typeof persist==='function')persist();}catch(e){console.warn('[NL4] Matchday persist failed',e);}
  try{if(typeof render==='function')render();}catch(_){}
  console.info('[NL4 Record Room] Imported verified matchday:',HOME,'0-2',AWAY);
  return true;
}
function run(){if(!apply())setTimeout(apply,800);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
window.NL4RecordRoomMatchday20260904={apply,version:VERSION};
})();