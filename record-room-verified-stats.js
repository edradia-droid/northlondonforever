// NL4 Record Room — verified completed-match corrections
// Applies after the completed-match importer. Keeps existing Record Room state/recalculation authoritative.
(function(){
'use strict';
const V=[
['Hull City','Manchester United',0,1,2,2,'Hull City|||Semi Ajayi'],
['Nottingham Forest','Leeds United',3,3,2,2,'Leeds United|||Anton Stach'],
['Brentford','Tottenham Hotspur',3,2,4,5,'Brentford|||Mamadou Sangaré'],
['Brighton & Hove Albion','Aston Villa',6,2,0,3,'Brighton & Hove Albion|||Jack Hinshelwood'],
['Newcastle United','Liverpool',2,1,5,3,''],
['Crystal Palace','Manchester City',3,0,4,1,'Manchester City|||Rayan Cherki'],
['Coventry City','Hull City',3,0,1,3,'Hull City|||Konstantinos Tzolakis'],
['Leeds United','Brentford',2,0,4,1,'Leeds United|||James Trafford'],
['Sunderland','Fulham',1,1,0,3,'Sunderland|||Granit Xhaka'],
['Manchester United','Ipswich Town',0,1,3,7,'Manchester United|||Bruno Fernandes'],
['Liverpool','Nottingham Forest',1,1,2,3,'Nottingham Forest|||James McAtee'],
['AFC Bournemouth','Everton',1,1,6,4,''],
['Tottenham Hotspur','Newcastle United',1,2,3,4,'Newcastle United|||Anthony Elanga'],
['Chelsea','Brighton & Hove Albion',1,2,3,2,'Chelsea|||João Pedro']
];
function findFixture(h,a){return (typeof ALL_FIXTURES!=='undefined'?ALL_FIXTURES:[]).find(f=>f.home===h&&f.away===a)}
function apply(){if(typeof db==='undefined'||typeof fixtureStore!=='function')return;const touched=new Set();V.forEach(([h,a,ho,ao,hs,as,motm])=>{const f=findFixture(h,a);if(!f)return;[h,a].filter(t=>db[t]).forEach(t=>{const s=fixtureStore(t,f.id);s.stats=s.stats||{};s.stats.offsides={h:ho,a:ao};s.stats.saves={h:hs,a:as};if(motm)s.manOfTheMatch=motm;touched.add(t)});});touched.forEach(t=>{if(typeof recalculatePlayerStatsFromFixtures==='function')recalculatePlayerStatsFromFixtures(t);if(typeof recalculateClubStatsFromFixtures==='function')recalculateClubStatsFromFixtures(t)});if(typeof persist==='function')persist();if(typeof render==='function')render();const e=document.getElementById('rrCompletedStatus');if(e)e.textContent='Completed-match details applied. Verified offsides, goalkeeper saves and MOTM corrections were also applied.';}
function bind(){const b=document.getElementById('rrImportCompleted');if(!b)return false;if(b.dataset.verifiedStatsBound)return true;b.dataset.verifiedStatsBound='1';b.addEventListener('click',()=>setTimeout(apply,80));return true}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{let n=0;const i=setInterval(()=>{if(bind()||++n>40)clearInterval(i)},250)});else{let n=0;const i=setInterval(()=>{if(bind()||++n>40)clearInterval(i)},250)}
})();