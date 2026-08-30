// NL4 Record Room — verified completed-match corrections
// Applies after the completed-match importer. Keeps existing Record Room state/recalculation authoritative.
(function(){
'use strict';
const SUB=(out,outMin,inn,inMin=outMin)=>({out,outMin,in:inn,inMin});
const E=(type,minute,team,name,assist='')=>({type,minute,player:`${team}|||${name}`,assist:assist?`${team}|||${assist}`:''});

// Verified correction records. Only fields present here are overwritten.
// This lets us improve historical data without deleting richer manually-entered fields elsewhere.
const V=[
{h:'Hull City',a:'Manchester United',offs:[0,3],saves:[5,2],motm:'Hull City|||Semi Ajayi',
 homeSubs:[SUB('Nobel Mendy',64,'Lucas Herrington'),SUB('Semi Ajayi',64,'Paddy McNair'),SUB('Lewie Coyle',70,'Cody Drameh'),SUB('Elliot Stroud',71,'Liam Millar'),SUB('Ryan Giles',85,'Matt Targett')],
 awaySubs:[SUB('Patrick Dorgu',46,'Marcus Rashford'),SUB('Andrey Santos',67,'Benjamin Šeško'),SUB('Youri Tielemans',67,'Kobbie Mainoo'),SUB('Noussair Mazraoui',80,'Diogo Dalot'),SUB('Matheus Cunha',80,'Shea Lacey')],
 events:[E('goal',17,'Hull City','Semi Ajayi'),E('yellow',34,'Manchester United','Patrick Dorgu'),E('goal',38,'Hull City','Nobel Mendy','Regan Slater'),E('yellow',42,'Hull City','Matt Crooks'),E('yellow',96,'Hull City','Liam Millar')]},

{h:'Everton',a:'Crystal Palace',motm:'Everton|||Kiernan Dewsbury-Hall',
 homeSubs:[SUB('Hayden Hackney',79,'James Garner'),SUB('Thierno Barry',79,'Beto'),SUB('Tyrique George',84,'Brennan Johnson'),SUB('Kiernan Dewsbury-Hall',94,'Carlos Alcaraz')],
 awaySubs:[SUB('Eddie Nketiah',55,'Yéremy Pino'),SUB('Daniel Muñoz',56,'Anan Khalaili'),SUB('Jean-Philippe Mateta',63,'Jørgen Strand Larsen'),SUB('Dwight McNeil',63,'Evann Guessand'),SUB('Chadi Riad',72,'Takehiro Tomiyasu')],
 events:[E('yellow',30,'Crystal Palace','Daichi Kamada'),E('goal',42,'Everton','Kiernan Dewsbury-Hall'),E('goal',53,'Everton','Thierno Barry','Iliman Ndiaye')]},

{h:'Ipswich Town',a:'Sunderland',motm:'Ipswich Town|||Julio Enciso',
 homeSubs:[SUB('Abdul Fatawu',66,'Kasey McAteer'),SUB('Emersonn Correia da Silva',66,'Chuba Akpom'),SUB('Julio Enciso',71,'Jack Clarke'),SUB('Marcelino Núñez',80,'Sindre Walle Egeli'),SUB('Daizen Maeda',80,'Abdoul Ouattara')],
 awaySubs:[SUB('Nilson Angulo',59,'Chemsdine Talbi'),SUB("Luke O'Nien",67,'Omar Alderete'),SUB('Brian Brobbey',67,'Wilson Isidor'),SUB('Trai Hume',80,'Chris Rigg'),SUB('Enzo Le Fée',80,'Habib Diarra')],
 events:[E('goal',24,'Ipswich Town','Emersonn Correia da Silva','Julio Enciso'),E('goal',39,'Sunderland','Nilson Angulo'),E('goal',90,'Ipswich Town','Jack Clarke','Saša Lukić')]},

{h:'Nottingham Forest',a:'Leeds United',offs:[3,3],saves:[2,2],motm:'Leeds United|||Anton Stach'},
{h:'Brentford',a:'Tottenham Hotspur',offs:[3,2],saves:[4,5],motm:'Brentford|||Mamadou Sangaré'},

{h:'Brighton & Hove Albion',a:'Aston Villa',offs:[6,2],saves:[0,3],motm:'Brighton & Hove Albion|||Jack Hinshelwood',
 homeSubs:[SUB('Jack Hinshelwood',64,'Charalampos Kostoulas'),SUB('Yasin Ayari',64,'João Costinha'),SUB('Mats Wieffer',78,'Z. Yohanna'),SUB('Maxim De Cuyper',78,'Ibrahim Osman'),SUB('Diego Gómez',86,'Malick Yalcouyé')],
 awaySubs:[SUB('Ross Barkley',74,'Lamare Bogarde'),SUB('Pau Torres',74,'Tyrone Mings'),SUB('Ian Maatsen',82,'Matteo Ruggeri'),SUB('John McGinn',82,'Alysson'),SUB('Emiliano Buendía',86,'Alejandro Garnacho')],
 events:[E('yellow',9,'Brighton & Hove Albion','Pascal Groß'),E('yellow',9,'Aston Villa','João Gomes'),E('yellow',11,'Brighton & Hove Albion','Yasin Ayari'),E('goal',18,'Brighton & Hove Albion','Maxim De Cuyper','Georginio Rutter'),E('goal',30,'Brighton & Hove Albion','Jack Hinshelwood','Diego Gómez'),E('goal',31,'Brighton & Hove Albion','Jack Hinshelwood'),E('yellow',33,'Aston Villa','John McGinn'),E('red',40,'Aston Villa','João Gomes'),E('yellow',95,'Aston Villa','Matty Cash')]},

{h:'Manchester City',a:'AFC Bournemouth',offs:[2,1],
 events:[E('goal',26,'AFC Bournemouth','Marcus Tavernier'),E('goal',84,'Manchester City','Marc Guéhi','Rayan Cherki'),E('yellow',84,'AFC Bournemouth','António Silva'),E('goal',91,'Manchester City','Joško Gvardiol','Rayan Cherki')]},

{h:'Newcastle United',a:'Liverpool',offs:[2,1],saves:[4,3],
 homeSubs:[SUB('Sean Steur',56,'Jacob Ramsey'),SUB('William Osula',56,'Joe Willock'),SUB('Lewis Miley',76,'M. Bamba'),SUB('Anthony Elanga',76,'Jacob Murphy'),SUB('Yoane Wissa',95,'Fabian Schär')],
 awaySubs:[SUB('Rio Ngumoha',63,'Víctor Muñoz'),SUB('Florian Wirtz',63,'Alexis Mac Allister'),SUB('Jérémy Jacquet',70,'Rafael Araújo'),SUB('Ryan Gravenberch',78,'Lewis Koumas')],
 events:[E('goal',5,'Newcastle United','Anthony Elanga','William Osula'),E('yellow',25,'Newcastle United','Yoane Wissa'),E('yellow',30,'Liverpool','Miloš Kerkez'),E('yellow',30,'Liverpool','Jeremie Frimpong'),E('yellow',34,'Newcastle United','Lewis Miley'),E('goal',55,'Liverpool','Cody Gakpo','Ryan Gravenberch'),E('goal',57,'Newcastle United','Joe Willock','Yoane Wissa'),E('yellow',65,'Newcastle United','Jacob Ramsey'),E('yellow',79,'Newcastle United','Jacob Murphy'),E('yellow',91,'Liverpool','Virgil van Dijk'),E('yellow',94,'Newcastle United','Lukáš Horníček'),E('goal',99,'Liverpool','Dominik Szoboszlai')]},

{h:'Crystal Palace',a:'Manchester City',offs:[3,0],saves:[4,1],motm:'Manchester City|||Rayan Cherki'},
{h:'Liverpool',a:'Nottingham Forest',offs:[1,1],saves:[2,3],motm:'Nottingham Forest|||James McAtee'},
{h:'AFC Bournemouth',a:'Everton',offs:[1,1],saves:[6,4]},
{h:'Coventry City',a:'Hull City',offs:[3,0],saves:[1,3],motm:'Hull City|||Konstantinos Tzolakis'},
{h:'Tottenham Hotspur',a:'Newcastle United',offs:[1,2],saves:[3,4],motm:'Newcastle United|||Anthony Elanga'},
{h:'Chelsea',a:'Brighton & Hove Albion',offs:[1,2],saves:[3,2],motm:'Chelsea|||João Pedro'},
{h:'Leeds United',a:'Brentford',offs:[2,0],saves:[4,1],motm:'Leeds United|||James Trafford'},
{h:'Sunderland',a:'Fulham',offs:[1,1],saves:[0,3],motm:'Sunderland|||Granit Xhaka'},
{h:'Manchester United',a:'Ipswich Town',offs:[0,1],saves:[3,7],motm:'Manchester United|||Bruno Fernandes'}
];

function findFixture(h,a){return (typeof ALL_FIXTURES!=='undefined'?ALL_FIXTURES:[]).find(f=>f.home===h&&f.away===a)}
function clone(v){return JSON.parse(JSON.stringify(v))}
function apply(){
 if(typeof db==='undefined'||typeof fixtureStore!=='function')return;
 const touched=new Set();
 V.forEach(r=>{
   const f=findFixture(r.h,r.a); if(!f)return;
   [r.h,r.a].filter(t=>db[t]).forEach(t=>{
     const s=fixtureStore(t,f.id); s.stats=s.stats||{};
     if(r.offs)s.stats.offsides={h:r.offs[0],a:r.offs[1]};
     if(r.saves)s.stats.saves={h:r.saves[0],a:r.saves[1]};
     if(r.motm)s.manOfTheMatch=r.motm;
     if(r.homeSubs)s.homeSubs=clone(r.homeSubs);
     if(r.awaySubs)s.awaySubs=clone(r.awaySubs);
     if(r.events)s.events=clone(r.events);
     touched.add(t);
   });
 });
 touched.forEach(t=>{
   if(typeof recalculatePlayerStatsFromFixtures==='function')recalculatePlayerStatsFromFixtures(t);
   if(typeof recalculateClubStatsFromFixtures==='function')recalculateClubStatsFromFixtures(t);
 });
 if(typeof persist==='function')persist();
 if(typeof render==='function')render();
 const e=document.getElementById('rrCompletedStatus');
 if(e)e.textContent='Verified match corrections applied: offsides, saves, MOTM, assists, cards and substitution/minute data. Player and club totals recalculated.';
}
function bind(){const b=document.getElementById('rrImportCompleted');if(!b)return false;if(b.dataset.verifiedStatsBound)return true;b.dataset.verifiedStatsBound='1';b.addEventListener('click',()=>setTimeout(apply,100));return true}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{let n=0;const i=setInterval(()=>{if(bind()||++n>40)clearInterval(i)},250)});else{let n=0;const i=setInterval(()=>{if(bind()||++n>40)clearInterval(i)},250)}
})();