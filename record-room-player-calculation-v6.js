// NL4 Record Room — accurate fixture-derived player calculation engine.
// Rebuilds only fields that can be derived from completed match records.
(function(){
'use strict';
const VERSION='20260904-player-calc-v6';
const KEY='nl4_rr_player_calc_version';

function norm(v){
 return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘`]/g,"'").replace(/[‐‑‒–—]/g,'-').replace(/\s+/g,' ').trim().toLowerCase();
}
function splitEvent(v){const p=String(v||'').split('|||');return {team:p[0]||'',name:p.slice(1).join('|||')||''};}
function num(v){const x=Number(v);return Number.isFinite(x)?x:null;}
function completed(saved){return saved && saved.homeScore!==null&&saved.homeScore!==undefined&&saved.awayScore!==null&&saved.awayScore!==undefined;}
function matchEnd(saved){
 const added=Math.max(0,num(saved?.matchDetails?.addedTime)??0);
 let end=90+added;
 const clocks=[];
 ['homeSubs','awaySubs'].forEach(k=>(Array.isArray(saved?.[k])?saved[k]:[]).forEach(s=>{clocks.push(num(s.outMin),num(s.inMin));}));
 (Array.isArray(saved?.events)?saved.events:[]).forEach(e=>clocks.push(num(e.minute)));
 clocks.filter(Number.isFinite).forEach(m=>{if(m>end)end=m;});
 return Math.max(90,end);
}
function makeResolver(players){
 const direct=new Map();
 players.forEach(p=>{const k=norm(p.name);if(k&&!direct.has(k))direct.set(k,p);});
 return name=>direct.get(norm(name))||null;
}
function recalc(team){
 if(typeof db==='undefined'||!db[team])return {team,unmatched:[]};
 const players=Array.isArray(db[team].players)?db[team].players:[];
 const resolve=makeResolver(players);
 const derived=['appearances','starts','minutes','goals','assists','cleanSheets','yellowCards','redCards','mom','saves'];
 players.forEach(p=>derived.forEach(k=>p[k]=0));
 const unmatched=new Set();
 const fixtures=typeof ALL_FIXTURES!=='undefined'?ALL_FIXTURES:[];
 const fixtureData=db[team].fixtureData||{};

 Object.entries(fixtureData).forEach(([fixtureId,saved])=>{
  if(!completed(saved))return;
  const f=fixtures.find(x=>String(x.id)===String(fixtureId));if(!f)return;
  const side=f.home===team?'home':f.away===team?'away':null;if(!side)return;
  const end=matchEnd(saved);
  const lineup=Array.isArray(saved[side+'Lineup'])?saved[side+'Lineup'].filter(Boolean):[];
  const subs=Array.isArray(saved[side+'Subs'])?saved[side+'Subs']:[];
  const state=new Map();
  function ensure(name){
   const k=norm(name);if(!k)return null;
   if(!state.has(k))state.set(k,{name,start:false,appeared:false,on:null,off:end});
   return state.get(k);
  }
  lineup.forEach(name=>{const s=ensure(name);if(s){s.start=true;s.appeared=true;s.on=0;s.off=end;}});
  subs.forEach(sub=>{
   if(sub.out){const s=ensure(sub.out);if(s){s.appeared=true;if(s.on===null)s.on=0;const m=num(sub.outMin);if(m!==null)s.off=Math.max(0,Math.min(end,m));}}
   if(sub.in){const s=ensure(sub.in);if(s){s.appeared=true;const m=num(sub.inMin)??num(sub.outMin)??end;s.on=Math.max(0,Math.min(end,m));s.off=end;}}
  });
  // A sending-off ends that player's participation at the card minute.
  (Array.isArray(saved.events)?saved.events:[]).forEach(ev=>{
   if(ev.type!=='red')return;const who=splitEvent(ev.player);if(who.team!==team)return;
   const s=ensure(who.name);if(!s)return;const m=num(ev.minute);if(m!==null)s.off=Math.min(s.off,Math.max(0,Math.min(end,m)));
  });
  state.forEach(s=>{
   const p=resolve(s.name);if(!p){unmatched.add(s.name);return;}
   if(s.appeared)p.appearances+=1;
   if(s.start)p.starts+=1;
   if(s.appeared){const on=s.on===null?0:s.on,off=Math.max(on,s.off);p.minutes+=Math.max(0,Math.round(off-on));}
  });

  // Goalkeeper saves belong to the starting goalkeeper because the Record Room stores team saves.
  const starterGK=lineup.map(resolve).find(p=>p&&norm(p.position)==='goalkeeper');
  if(starterGK){const k=side==='home'?'h':'a';starterGK.saves+=Math.max(0,num(saved.stats?.saves?.[k])??0);}

  (Array.isArray(saved.events)?saved.events:[]).forEach(ev=>{
   const who=splitEvent(ev.player);
   if(who.team===team){
    const p=resolve(who.name);
    // Synthetic Own Goal (...) labels intentionally do not resolve to a roster player.
    if(p){if(ev.type==='goal')p.goals+=1;if(ev.type==='yellow')p.yellowCards+=1;if(ev.type==='red')p.redCards+=1;}
   }
   if(ev.type==='goal'&&ev.assist){const a=splitEvent(ev.assist);if(a.team===team){const p=resolve(a.name);if(p)p.assists+=1;else unmatched.add(a.name);}}
  });
  if(saved.manOfTheMatch){const m=splitEvent(saved.manOfTheMatch);if(m.team===team){const p=resolve(m.name);if(p)p.mom+=1;else unmatched.add(m.name);}}

  // Clean sheet: GK/DEF, 60+ minutes, and no opponent goal while on the pitch.
  const opponent=f.home===team?f.away:f.home;
  const oppGoals=(Array.isArray(saved.events)?saved.events:[]).filter(ev=>ev.type==='goal'&&splitEvent(ev.player).team===opponent).map(ev=>num(ev.minute)).filter(Number.isFinite);
  const conceded=Number(side==='home'?saved.awayScore:saved.homeScore)||0;
  const eventComplete=conceded===0||oppGoals.length>=conceded;
  if(eventComplete){
   state.forEach(s=>{
    if(!s.appeared)return;const p=resolve(s.name);if(!p)return;
    const pos=norm(p.position);if(pos!=='goalkeeper'&&pos!=='defender')return;
    const on=s.on===null?0:s.on,off=Math.max(on,s.off),mins=Math.max(0,off-on);if(mins<60)return;
    const concededOn=oppGoals.some(g=>g>=on&&g<=off);if(!concededOn)p.cleanSheets+=1;
   });
  }
 });
 if(db[team].club){db[team].club.yellowCards=players.reduce((a,p)=>a+(Number(p.yellowCards)||0),0);db[team].club.redCards=players.reduce((a,p)=>a+(Number(p.redCards)||0),0);}
 return {team,unmatched:[...unmatched]};
}
function recalcAll(){
 if(typeof db==='undefined')return [];
 const results=Object.keys(db).map(recalc);
 if(typeof persist==='function')persist();if(typeof render==='function')render();
 const unmatched=results.flatMap(r=>r.unmatched.map(name=>`${r.team}: ${name}`));
 if(unmatched.length)console.warn('[NL4 Record Room] player calculation names not found in roster',unmatched);
 localStorage.setItem(KEY,VERSION);
 return results;
}
// Replace the old calculator so future SAVE/import/sync actions use the corrected rules.
window.recalculatePlayerStatsFromFixtures=recalc;
window.NL4RecordRoomRecalculateAllPlayers=recalcAll;
function run(){recalcAll();const b=document.getElementById('rrImportCompleted');if(b&&!b.dataset.playerCalcV6){b.dataset.playerCalcV6='1';b.addEventListener('click',()=>setTimeout(recalcAll,500));}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,1350));else setTimeout(run,1350);
})();