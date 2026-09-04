// NL4 Record Room — canonical completed-match event audit (2026/27 through 2026-08-31)
// Replaces ONLY fixture event arrays. Existing XI, substitutions, match stats, saves and model code are untouched.
(function(){
'use strict';
const VERSION='20260904-canonical-events-v4';
const KEY='nl4_rr_canonical_events_version';
const E=(type,minute,team,player,assist='')=>({type,minute,player:`${team}|||${player}`,assist:assist?`${team}|||${assist}`:''});
const O=(minute,beneficiary,scorer)=>E('goal',minute,beneficiary,`Own Goal (${scorer})`);
const EVENTS={
'Arsenal|||Coventry City':[
 E('goal',15,'Arsenal','Kai Havertz','Riccardo Calafiori'),
 E('goal',23,'Arsenal','Bukayo Saka','Christos Tzolis'),
 E('yellow',27,'Coventry City','Caleb Yirenkyi'),
 E('yellow',34,'Arsenal','Gabriel Magalhães'),
 E('goal',49,'Arsenal','Martin Ødegaard')
],
'Hull City|||Manchester United':[
 E('goal',17,'Hull City','Semi Ajayi'),E('yellow',34,'Manchester United','Patrick Dorgu'),E('goal',38,'Hull City','Nobel Mendy','Regan Slater'),E('yellow',42,'Hull City','Matt Crooks'),E('yellow',96,'Hull City','Liam Millar')
],
'Everton|||Crystal Palace':[
 E('yellow',30,'Crystal Palace','Daichi Kamada'),E('goal',42,'Everton','Kiernan Dewsbury-Hall','Harrison Armstrong'),E('goal',53,'Everton','Thierno Barry','Iliman Ndiaye')
],
'Ipswich Town|||Sunderland':[
 E('goal',24,'Ipswich Town','Emersonn Correia da Silva','Julio Enciso'),E('yellow',36,'Sunderland','Dan Ballard'),E('goal',39,'Sunderland','Nilson Angulo'),E('yellow',55,'Sunderland','Nilson Angulo'),E('yellow',63,'Sunderland',"Luke O'Nien"),E('goal',90,'Ipswich Town','Jack Clarke')
],
'Nottingham Forest|||Leeds United':[
 E('yellow',18,'Nottingham Forest','Ola Aina'),E('yellow',32,'Leeds United','Dominic Calvert-Lewin'),E('yellow',52,'Nottingham Forest','Jair Cunha'),E('goal',88,'Leeds United','Anton Stach')
],
'Brentford|||Tottenham Hotspur':[
 E('goal',12,'Brentford','Keane Lewis-Potter','Mamadou Sangaré'),E('goal',33,'Brentford','Vitaly Janelt'),E('yellow',34,'Tottenham Hotspur','Conor Gallagher'),E('goal',49,'Brentford','Michael Kayode'),E('yellow',55,'Brentford','Igor Thiago'),E('yellow',78,'Brentford','Vitaly Janelt')
],
'Brighton & Hove Albion|||Aston Villa':[
 O(8,'Brighton & Hove Albion','Victor Lindelöf'),E('yellow',9,'Aston Villa','João Gomes'),E('yellow',9,'Brighton & Hove Albion','Pascal Groß'),E('yellow',11,'Brighton & Hove Albion','Yasin Ayari'),E('goal',18,'Brighton & Hove Albion','Maxim De Cuyper','Georginio Rutter'),E('goal',30,'Brighton & Hove Albion','Jack Hinshelwood','Diego Gómez'),E('goal',31,'Brighton & Hove Albion','Jack Hinshelwood'),E('yellow',33,'Aston Villa','John McGinn'),E('red',40,'Aston Villa','João Gomes'),E('yellow',95,'Aston Villa','Matty Cash')
],
'Manchester City|||AFC Bournemouth':[
 E('goal',26,'AFC Bournemouth','Marcus Tavernier','Evanilson'),E('yellow',46,'AFC Bournemouth','Evanilson'),E('yellow',78,'Manchester City','Phil Foden'),E('goal',84,'Manchester City','Marc Guéhi','Rayan Cherki'),E('yellow',85,'AFC Bournemouth','António Silva'),E('goal',91,'Manchester City','Joško Gvardiol','Rayan Cherki')
],
'Newcastle United|||Liverpool':[
 E('goal',5,'Newcastle United','Anthony Elanga','William Osula'),E('yellow',25,'Newcastle United','Yoane Wissa'),E('yellow',30,'Liverpool','Miloš Kerkez'),E('yellow',30,'Liverpool','Jeremie Frimpong'),E('yellow',34,'Newcastle United','Lewis Miley'),E('goal',55,'Liverpool','Cody Gakpo','Ryan Gravenberch'),E('goal',57,'Newcastle United','Joe Willock','Yoane Wissa'),E('yellow',64,'Newcastle United','Jacob Ramsey'),E('yellow',79,'Newcastle United','Jacob Murphy'),E('yellow',90,'Liverpool','Virgil van Dijk'),E('yellow',93,'Newcastle United','Lukáš Horníček'),E('goal',99,'Liverpool','Dominik Szoboszlai')
],
'Fulham|||Chelsea':[
 E('goal',1,'Chelsea','João Pedro','Cole Palmer'),E('yellow',5,'Chelsea','Levi Colwill'),E('yellow',12,'Chelsea','Roméo Lavia'),E('goal',23,'Fulham','Joshua King','Timothy Castagne'),E('goal',41,'Chelsea','Morgan Rogers','Maxence Lacroix'),E('goal',49,'Chelsea','Cole Palmer','João Pedro'),E('goal',54,'Fulham','Gonzalo García'),E('yellow',75,'Chelsea','Reece James'),E('yellow',76,'Fulham','Calvin Bassey'),E('yellow',88,'Fulham','Timothy Castagne')
],
'Crystal Palace|||Manchester City':[
 E('goal',17,'Manchester City','Erling Haaland','Antoine Semenyo'),E('yellow',33,'Manchester City','Rayan Cherki'),E('goal',54,'Manchester City','Rayan Cherki','Phil Foden'),E('yellow',55,'Manchester City','Elliot Anderson'),O(56,'Crystal Palace','Gianluigi Donnarumma'),E('goal',59,'Manchester City','Rayan Cherki','Joško Gvardiol'),E('yellow',68,'Crystal Palace','Anan Khalaili'),E('goal',84,'Manchester City','Erling Haaland','Phil Foden')
],
'Liverpool|||Nottingham Forest':[
 E('goal',24,'Nottingham Forest','Dan Ndoye','Morgan Gibbs-White'),E('yellow',50,'Nottingham Forest','Ola Aina'),E('yellow',54,'Liverpool','Víctor Muñoz'),E('yellow',58,'Liverpool','Florian Wirtz'),E('goal',60,'Liverpool','Alexander Isak','Cody Gakpo'),E('yellow',69,'Liverpool','Alisson'),E('goal',70,'Nottingham Forest','Morgan Gibbs-White'),E('yellow',79,'Liverpool','Rafael Araújo'),E('goal',82,'Liverpool','Víctor Muñoz','Florian Wirtz')
],
'AFC Bournemouth|||Everton':[
 E('yellow',21,'AFC Bournemouth','Alex Scott'),E('yellow',23,'AFC Bournemouth','Adam Smith'),E('goal',41,'AFC Bournemouth','Alex Scott','Evanilson'),E('yellow',53,'AFC Bournemouth','Marcus Tavernier'),E('yellow',59,'Everton','James Garner'),E('goal',91,'Everton','James Tarkowski'),E('yellow',95,'Everton','Carlos Alcaraz')
],
'Coventry City|||Hull City':[
 E('yellow',10,'Hull City','Lewie Coyle'),E('yellow',51,'Hull City','Regan Slater'),E('yellow',54,'Hull City','Elliot Stroud'),E('yellow',68,'Hull City','Oli McBurnie'),E('goal',82,'Hull City','Liam Millar','Mohamed Belloumi'),E('yellow',84,'Coventry City','Aurèle Amenda')
],
'Tottenham Hotspur|||Newcastle United':[
 E('yellow',3,'Tottenham Hotspur','Micky van de Ven'),E('yellow',13,'Newcastle United','Nico González'),E('goal',62,'Newcastle United','Anthony Elanga','Amar Dedić'),E('goal',72,'Newcastle United','Yoane Wissa','Nick Woltemade'),E('yellow',79,'Newcastle United','Sven Botman')
],
'Chelsea|||Brighton & Hove Albion':[
 E('goal',4,'Chelsea','Roméo Lavia'),E('goal',14,'Chelsea','Pedro Neto','Morgan Rogers'),E('goal',32,'Chelsea','João Pedro','Jorrel Hato'),E('goal',35,'Brighton & Hove Albion','Malick Yalcouyé'),E('yellow',55,'Chelsea','Wesley Fofana'),O(63,'Brighton & Hove Albion','João Pedro'),E('yellow',70,'Brighton & Hove Albion','Lewis Dunk'),E('goal',74,'Chelsea','Cole Palmer','João Pedro'),E('yellow',89,'Brighton & Hove Albion','Olivier Boscagli'),E('yellow',91,'Brighton & Hove Albion','João Costinha'),E('goal',96,'Brighton & Hove Albion','Pascal Groß')
],
'Leeds United|||Brentford':[
 E('yellow',30,'Brentford','Jaidon Anthony'),E('goal',41,'Brentford','Kevin Schade','Keane Lewis-Potter'),E('yellow',74,'Brentford','Kristoffer Ajer'),E('yellow',76,'Brentford','Vitaly Janelt'),E('goal',79,'Leeds United','Dominic Calvert-Lewin','Lukas Nmecha'),E('yellow',93,'Brentford','Nathan Collins')
],
'Sunderland|||Fulham':[
 E('yellow',35,'Fulham','Joachim Andersen'),E('yellow',59,'Fulham','César Palacios'),E('goal',75,'Sunderland','Wilson Isidor','Habib Diarra')
],
'Manchester United|||Ipswich Town':[
 E('goal',29,'Ipswich Town','Leif Davis','Abdul Fatawu'),E('yellow',33,'Ipswich Town','Saša Lukić'),E('yellow',37,'Ipswich Town','Abdul Fatawu'),E('goal',40,'Manchester United','Bruno Fernandes','Matheus Cunha'),O(56,'Manchester United','Jacob Greaves'),E('yellow',60,'Ipswich Town','Jacob Greaves'),E('goal',61,'Manchester United','Bruno Fernandes'),E('goal',68,'Manchester United','Bruno Fernandes'),E('goal',82,'Manchester United','Bryan Mbeumo','Bruno Fernandes'),E('goal',91,'Ipswich Town','Chuba Akpom','Julio Enciso'),E('yellow',93,'Manchester United','Bryan Mbeumo')
],
'Aston Villa|||Arsenal':[
 E('yellow',29,'Arsenal','Christos Tzolis'),E('goal',59,'Arsenal','Bukayo Saka','Riccardo Calafiori'),E('yellow',81,'Aston Villa','Alysson Edward'),E('yellow',82,'Aston Villa','John McGinn'),E('yellow',96,'Aston Villa','Ian Maatsen')
]
};
function findFixture(home,away){return (typeof ALL_FIXTURES!=='undefined'?ALL_FIXTURES:[]).find(f=>f.home===home&&f.away===away)}
function clone(v){return JSON.parse(JSON.stringify(v))}
function apply(){
 if(typeof db==='undefined'||typeof ALL_FIXTURES==='undefined')return {updated:0,errors:['Record Room state unavailable']};
 const touched=new Set(),errors=[];let updated=0;
 Object.entries(EVENTS).forEach(([key,events])=>{
  const [home,away]=key.split('|||'),f=findFixture(home,away);if(!f){errors.push(`${key}: fixture missing`);return;}
  const club=db[home]?home:(db[away]?away:null);if(!club){errors.push(`${key}: Record Room club missing`);return;}
  const s=(typeof fixtureStore==='function')?fixtureStore(club,f.id):db[club]?.fixtureData?.[f.id];if(!s){errors.push(`${key}: fixture state missing`);return;}
  const expected=Number(s.homeScore)+Number(s.awayScore),goals=events.filter(e=>e.type==='goal').length;
  if(Number.isFinite(expected)&&goals!==expected)errors.push(`${key}: ${goals} goal events for score total ${expected}`);
  events.forEach((e,i)=>{if(!e.player||!e.type||!Number.isFinite(Number(e.minute)))errors.push(`${key}: incomplete event ${i+1}`)});
  s.events=clone(events);s.eventsVerified=true;s.eventsVerifiedAt='2026-09-04';s.eventsVerifiedVersion=VERSION;
  [home,away].filter(t=>db[t]).forEach(t=>{db[t].fixtureData=db[t].fixtureData||{};db[t].fixtureData[f.id]=clone(s);touched.add(t)});
  updated++;
 });
 touched.forEach(t=>{if(typeof recalculatePlayerStatsFromFixtures==='function')recalculatePlayerStatsFromFixtures(t);if(typeof recalculateClubStatsFromFixtures==='function')recalculateClubStatsFromFixtures(t)});
 if(typeof persist==='function')persist();if(typeof render==='function')render();
 localStorage.setItem(KEY,VERSION);
 const open=document.getElementById('fixtureDetail'),id=Number(open?.dataset?.fixtureId);if(open?.classList.contains('open')&&Number.isFinite(id)&&typeof openFixture==='function')setTimeout(()=>openFixture(id),30);
 if(errors.length)console.error('[NL4 Record Room] canonical event audit',errors);
 return {updated,errors};
}
function run(){
 if(localStorage.getItem(KEY)===VERSION)return;
 const r=apply();const status=document.getElementById('rrCompletedStatus');if(status)status.textContent=r.errors.length?`${r.updated} completed-match event sets updated; ${r.errors.length} audit issue(s) logged.`:`${r.updated} completed matches audited: scorers, credited assists, cards and own goals synchronized.`;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,900));else setTimeout(run,900);
})();
