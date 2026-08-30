// NL4 Record Room — fixture -> season synchronization hardening
// Keeps Record Room isolated from the Arsenal model.
(function(){
'use strict';
if(window.__NL4_RR_SEASON_SYNC_FIX__) return;
window.__NL4_RR_SEASON_SYNC_FIX__=true;
const key=v=>String(v||'').trim().toLowerCase();
const split=v=>{const p=String(v||'').split('|||');return {team:p[0]||'',name:p.slice(1).join('|||')||''}};
const clone=v=>JSON.parse(JSON.stringify(v));
function completed(s){return s&&s.homeScore!==null&&s.homeScore!==undefined&&s.awayScore!==null&&s.awayScore!==undefined}
function fixtureLength(s){const added=Math.max(0,Number(s?.matchDetails?.addedTime??s?.addedTime??0)||0);return 90+added}
function richer(a,b,k){const aa=Array.isArray(a?.[k])?a[k]:[],bb=Array.isArray(b?.[k])?b[k]:[];return aa.length>=bb.length?aa:bb}
function mirrorFixture(f){
 const teams=[f.home,f.away].filter(t=>typeof db!=='undefined'&&db[t]); if(!teams.length)return;
 const states=teams.map(t=>fixtureStore(t,f.id));
 const source=states.reduce((best,s)=>{
   const score=x=>(completed(x)?100:0)+(x.homeLineup?.filter(Boolean).length||0)+(x.awayLineup?.filter(Boolean).length||0)+(x.homeSubs?.length||0)+(x.awaySubs?.length||0)+(x.events?.length||0)+Object.keys(x.stats||{}).length;
   return !best||score(s)>score(best)?s:best;
 },null);
 if(!source)return;
 teams.forEach(t=>{const s=fixtureStore(t,f.id);
   ['homeScore','awayScore','manOfTheMatch'].forEach(k=>{if(source[k]!==undefined&&source[k]!==null&&source[k]!=='')s[k]=source[k]});
   ['homeLineup','awayLineup','homeSubs','awaySubs','events'].forEach(k=>{const v=richer(s,source,k);if(v.length)s[k]=clone(v)});
   if(source.stats)s.stats={...(s.stats||{}),...clone(source.stats)};
   if(source.matchDetails)s.matchDetails={...(s.matchDetails||{}),...clone(source.matchDetails)};
 });
}
function recalcPlayers(team){
 if(typeof db==='undefined'||!db[team])return;
 const players=Array.isArray(db[team].players)?db[team].players:[], by=new Map(players.map(p=>[key(p.name),p]));
 const derived=['appearances','starts','minutes','goals','assists','cleanSheets','yellowCards','redCards','mom','saves'];players.forEach(p=>derived.forEach(k=>p[k]=0));
 const fixtures=(typeof fixtureForTeam==='function'?fixtureForTeam(team):[]);
 fixtures.forEach(f=>{
   const s=db[team]?.fixtureData?.[f.id];if(!completed(s))return;
   const side=f.home===team?'home':f.away===team?'away':null;if(!side)return;
   const full=fixtureLength(s), lineup=(Array.isArray(s[side+'Lineup'])?s[side+'Lineup']:[]).filter(Boolean), subs=Array.isArray(s[side+'Subs'])?s[side+'Subs']:[];
   const starters=new Set(lineup.map(key)), appeared=new Set(starters), mins=new Map([...starters].map(k=>[k,full]));
   subs.forEach(x=>{const o=key(x.out),i=key(x.in);const om=x.outMin==null?null:Math.max(0,Number(x.outMin)||0),im=x.inMin==null?om:Math.max(0,Number(x.inMin)||0);
     if(o){appeared.add(o);if(om!==null)mins.set(o,Math.min(full,om));}
     if(i){appeared.add(i);const on=im===null?0:Math.min(full,im);mins.set(i,Math.max(mins.get(i)||0,full-on));}
   });
   appeared.forEach(k=>{const p=by.get(k);if(!p)return;p.appearances++;if(starters.has(k))p.starts++;p.minutes+=Math.max(0,Math.min(full,Number(mins.get(k))||0));});
   const gk=lineup.map(n=>by.get(key(n))).find(p=>p&&String(p.position||'').toLowerCase()==='goalkeeper');if(gk){const sk=side==='home'?'h':'a';gk.saves+=Math.max(0,Number(s.stats?.saves?.[sk])||0)}
   (Array.isArray(s.events)?s.events:[]).forEach(ev=>{const w=split(ev.player);if(w.team!==team)return;const p=by.get(key(w.name));if(p){if(ev.type==='goal')p.goals++;if(ev.type==='yellow')p.yellowCards++;if(ev.type==='red')p.redCards++;}if(ev.type==='goal'&&ev.assist){const a=split(ev.assist);if(a.team===team){const ap=by.get(key(a.name));if(ap)ap.assists++;}}});
   if(s.manOfTheMatch){const m=split(s.manOfTheMatch);if(m.team===team){const p=by.get(key(m.name));if(p)p.mom++;}}
 });
}
function recalcClub(team){
 if(typeof db==='undefined'||!db[team])return;const next=typeof defaultClub==='function'?defaultClub():{matches:0,avgPossession:0,totalShots:0,shotsOnTarget:0,corners:0,cornerGoals:0,fouls:0,offsides:0,yellowCards:0,redCards:0,points:0};let pt=0,pc=0;
 (typeof fixtureForTeam==='function'?fixtureForTeam(team):[]).forEach(f=>{const s=db[team]?.fixtureData?.[f.id];if(!completed(s))return;const home=f.home===team,side=home?'h':'a',gf=Number(home?s.homeScore:s.awayScore)||0,ga=Number(home?s.awayScore:s.homeScore)||0;next.matches++;next.points+=gf>ga?3:gf===ga?1:0;const r=k=>Math.max(0,Number(s.stats?.[k]?.[side])||0);next.totalShots+=r('shots');next.shotsOnTarget+=r('sot');next.corners+=r('corners');next.cornerGoals+=r('cornerGoals');next.fouls+=r('fouls');next.offsides+=r('offsides');if(s.stats?.possession?.[side]!==undefined&&s.stats?.possession?.[side]!==null){pt+=Number(s.stats.possession[side])||0;pc++;}});
 next.avgPossession=pc?Number((pt/pc).toFixed(1)):0;const ps=db[team].players||[];next.yellowCards=ps.reduce((n,p)=>n+(Number(p.yellowCards)||0),0);next.redCards=ps.reduce((n,p)=>n+(Number(p.redCards)||0),0);db[team].club=next;
}
function syncAll(){if(typeof ALL_FIXTURES==='undefined'||typeof db==='undefined'||typeof fixtureStore!=='function')return;ALL_FIXTURES.forEach(mirrorFixture);Object.keys(db).forEach(t=>{recalcPlayers(t);recalcClub(t)});if(typeof persist==='function')persist();if(typeof render==='function')render();const e=document.getElementById('rrCompletedStatus');if(e)e.textContent='SEASON SYNC COMPLETE • lineups/substitutions, appearances/minutes and every completed-match club stat recalculated.';}
function bind(){const b=document.getElementById('rrImportCompleted');if(!b)return false;if(b.dataset.seasonSyncBound)return true;b.dataset.seasonSyncBound='1';b.addEventListener('click',()=>setTimeout(syncAll,260));return true}
window.NL4RecordRoomSeasonSync=syncAll;
let n=0;const timer=setInterval(()=>{if(bind()||++n>60)clearInterval(timer)},250);
})();