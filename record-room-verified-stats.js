// NL4 Record Room — verified completed-match corrections
// Applies after completed-match importer. Uses existing Record Room state + recalculation pipeline.
(function(){
'use strict';
if(window.__NL4_RR_VERIFIED_STATS_V3__)return;window.__NL4_RR_VERIFIED_STATS_V3__=true;
const S=(possession,shots,sot,corners,fouls,offsides,saves)=>({possession:{h:possession[0],a:possession[1]},shots:{h:shots[0],a:shots[1]},sot:{h:sot[0],a:sot[1]},corners:{h:corners[0],a:corners[1]},cornerGoals:{h:0,a:0},fouls:{h:fouls[0],a:fouls[1]},offsides:{h:offsides[0],a:offsides[1]},saves:{h:saves[0],a:saves[1]}});
// One row per completed 2026/27 PL match through 30 Aug 2026. Values are HOME/AWAY.
const V=[
 {h:'Arsenal',a:'Coventry City',stats:S([65,35],[20,4],[6,1],[8,2],[10,13],[5,0],[1,2])},
 {h:'Hull City',a:'Manchester United',stats:S([28,72],[8,21],[4,5],[1,6],[10,9],[0,3],[5,2]),motm:'Hull City|||Semi Ajayi'},
 {h:'Everton',a:'Crystal Palace',stats:S([42,58],[16,11],[5,4],[4,0],[5,15],[2,0],[4,3]),motm:'Everton|||Kiernan Dewsbury-Hall'},
 {h:'Ipswich Town',a:'Sunderland',stats:S([38,63],[10,11],[3,4],[3,5],[12,14],[1,4],[2,1]),motm:'Ipswich Town|||Julio Enciso'},
 {h:'Nottingham Forest',a:'Leeds United',stats:S([55,45],[12,11],[2,3],[3,2],[15,14],[3,3],[2,3]),motm:'Leeds United|||Anton Stach'},
 {h:'Brentford',a:'Tottenham Hotspur',stats:S([41,59],[26,9],[8,4],[7,3],[17,14],[3,2],[4,5]),motm:'Brentford|||Mamadou Sangaré'},
 {h:'Brighton & Hove Albion',a:'Aston Villa',stats:S([69,31],[21,6],[6,0],[5,2],[12,10],[6,2],[0,3]),motm:'Brighton & Hove Albion|||Jack Hinshelwood'},
 {h:'Manchester City',a:'AFC Bournemouth',stats:S([66,34],[13,5],[6,4],[8,3],[11,11],[2,1],[3,4])},
 {h:'Newcastle United',a:'Liverpool',stats:S([39,61],[13,27],[4,7],[2,6],[16,15],[2,1],[5,3])},
 {h:'Fulham',a:'Chelsea',stats:S([61,39],[14,18],[6,6],[6,4],[12,7],[0,3],[3,4]),motm:'Chelsea|||Cole Palmer'},
 {h:'Crystal Palace',a:'Manchester City',stats:S([28,72],[9,18],[1,9],[2,6],[8,10],[3,0],[4,1]),motm:'Manchester City|||Rayan Cherki'},
 {h:'Liverpool',a:'Nottingham Forest',stats:S([70,30],[13,12],[4,3],[3,5],[13,10],[3,0],[1,2]),motm:'Nottingham Forest|||Morgan Gibbs-White'},
 {h:'AFC Bournemouth',a:'Everton',stats:S([58,42],[17,13],[5,7],[10,7],[11,14],[0,1],[5,4]),motm:'AFC Bournemouth|||Alex Scott'},
 {h:'Coventry City',a:'Hull City',stats:S([69,31],[11,5],[3,2],[6,2],[11,8],[3,0],[1,3]),motm:'Hull City|||Konstantinos Tzolakis'},
 {h:'Tottenham Hotspur',a:'Newcastle United',stats:S([58,42],[17,11],[6,2],[9,7],[15,9],[2,1],[0,4]),motm:'Newcastle United|||Anthony Elanga'},
 {h:'Chelsea',a:'Brighton & Hove Albion',stats:S([26,74],[17,15],[6,6],[4,7],[6,12],[1,2],[4,1]),motm:'Chelsea|||João Pedro'},
 {h:'Leeds United',a:'Brentford',stats:S([47,53],[13,22],[2,5],[5,6],[5,13],[2,0],[4,1]),motm:'Leeds United|||James Trafford'},
 {h:'Sunderland',a:'Fulham',stats:S([42,58],[12,9],[4,0],[3,4],[10,15],[1,1],[0,3]),motm:'Sunderland|||Granit Xhaka'},
 {h:'Manchester United',a:'Ipswich Town',stats:S([60,40],[31,9],[11,5],[8,4],[7,12],[0,1],[3,6]),motm:'Manchester United|||Bruno Fernandes'}
];
function findFixture(h,a){return (typeof ALL_FIXTURES!=='undefined'?ALL_FIXTURES:[]).find(f=>f.home===h&&f.away===a)}
function apply(){
 if(typeof db==='undefined'||typeof fixtureStore!=='function')return;
 const touched=new Set();
 V.forEach(r=>{const f=findFixture(r.h,r.a);if(!f)return;[r.h,r.a].filter(t=>db[t]).forEach(t=>{const s=fixtureStore(t,f.id);s.stats=JSON.parse(JSON.stringify(r.stats));if(r.motm)s.manOfTheMatch=r.motm;touched.add(t);});});
 touched.forEach(t=>{if(typeof recalculatePlayerStatsFromFixtures==='function')recalculatePlayerStatsFromFixtures(t);if(typeof recalculateClubStatsFromFixtures==='function')recalculateClubStatsFromFixtures(t)});
 if(typeof persist==='function')persist();if(typeof render==='function')render();
 const e=document.getElementById('rrCompletedStatus');if(e)e.textContent='FULL MATCH STATS APPLIED • Every completed fixture now feeds each club 2026/27 Premier League totals.';
}
function bind(){const b=document.getElementById('rrImportCompleted');if(!b)return false;if(b.dataset.fullStatsBound)return true;b.dataset.fullStatsBound='1';b.addEventListener('click',()=>setTimeout(apply,140));return true}
window.NL4RecordRoomApplyVerifiedStats=apply;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{let n=0;const i=setInterval(()=>{if(bind()||++n>40)clearInterval(i)},250)});else{let n=0;const i=setInterval(()=>{if(bind()||++n>40)clearInterval(i)},250)}
})();