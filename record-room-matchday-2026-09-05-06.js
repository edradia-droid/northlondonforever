// NL4 Record Room — verified Premier League MW3 completion batch, 5–6 September 2026
// Adds only fixture IDs 22–30. Existing fixture records are merged, never cleared.
(function(){
'use strict';
const VERSION='20260908-mw3-completion-v1';
const clone=v=>JSON.parse(JSON.stringify(v));
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[Øø]/g,'o').replace(/[Đđ]/g,'d').replace(/[Łł]/g,'l').replace(/ß/g,'ss').replace(/[’‘`]/g,"'").toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const toks=v=>norm(v).split(' ').filter(Boolean);
function resolveName(team,name){
  if(!name||typeof db==='undefined')return name;
  const players=db?.[team]?.players||[]; const target=norm(name); if(!target)return name;
  let p=players.find(x=>norm(x.name)===target); if(p)return p.name;
  const tt=toks(name),last=tt[tt.length-1];
  const surname=players.filter(x=>{const t=toks(x.name);return last&&t[t.length-1]===last;});
  if(surname.length===1)return surname[0].name;
  let best=null,score=0;
  for(const x of players){const xt=new Set(toks(x.name));let s=0;tt.forEach(t=>{if(xt.has(t))s++;});if(s>score){score=s;best=x;}}
  return score>=2?best.name:name;
}
const ev=(type,minute,team,player,assist='',extra={})=>({type,minute,player:`${team}|||${resolveName(team,player)}`,assist:assist?`${team}|||${resolveName(team,assist)}`:'',...extra});
const sub=(team,out,outMin,inn,inMin=outMin)=>({out:resolveName(team,out),outMin,in:resolveName(team,inn),inMin});
const xi=(team,names)=>names.map(n=>resolveName(team,n));
const stats=(ph,pa,sh,sa,sth,sta,ch,ca,fh,fa,oh,oa,svh,sva)=>({possession:{h:ph,a:pa},shots:{h:sh,a:sa},sot:{h:sth,a:sta},corners:{h:ch,a:ca},cornerGoals:{h:0,a:0},fouls:{h:fh,a:fa},offsides:{h:oh,a:oa},saves:{h:svh,a:sva}});
const MATCHES=[
 {id:27,home:'Newcastle United',away:'AFC Bournemouth',score:[2,2],ht:[1,2],venue:"St. James' Park",referee:'Robert Jones',attendance:52643,kickoff:'12:30',endMinute:96,addedTime:null,weather:'',
  homeXI:['Lukas Hornicek','Amar Dedić','Malick Thiaw','Sven Botman','Lewis Hall','Nico González','Lewis Miley','Anthony Elanga','Joseph Willock','Harvey Barnes','Yoane Wissa'],
  awayXI:['Djordje Petrović','Adam Smith','James Hill','António Silva','Adrien Truffert','Tyler Adams','Alex Scott','Rayan','Justin Kluivert','Marcus Tavernier','Evanilson'],
  homeSubs:[['Lewis Miley',63,'Jacob Ramsey'],['Joseph Willock',63,'Matías Fernández-Pardo'],['Anthony Elanga',78,'Jacob Murphy'],['Nico González',77,'Sean Steur'],['Lewis Hall',90,'Valentino Livramento']],
  awaySubs:[['Justin Kluivert',76,'David Brooks'],['Tyler Adams',76,'Lewis Cook'],['Rayan',89,'Ben Doak'],['Marcus Tavernier',89,'Daniel Jebbison'],['Alex Scott',96,'Ryan Christie']],
  stat:[57,43,8,17,2,5,4,3,19,17,1,1,4,0],
  events:[['goal',9,'AFC Bournemouth','Marcus Tavernier',''],['yellow',28,'Newcastle United','Anthony Elanga',''],['goal',35,'AFC Bournemouth','Malick Thiaw (own goal)','',{ownGoal:true,ownGoalBy:'Newcastle United|||Malick Thiaw'}],['goal',37,'Newcastle United','Harvey Barnes',''],['yellow',57,'Newcastle United','Yoane Wissa',''],['yellow',66,'AFC Bournemouth','Justin Kluivert',''],['yellow',87,'AFC Bournemouth','Adrien Truffert',''],['goal',88,'Newcastle United','Jacob Ramsey',''],['yellow',94,'AFC Bournemouth','Adam Smith','']],
  notes:'MW3. Bournemouth led 2-0; Malick Thiaw own goal at 35. Jacob Ramsey equalised at 88. Individual assists not stored unless independently verified.'},
 {id:22,home:'Brentford',away:'Sunderland',score:[1,1],ht:[0,0],venue:'Gtech Community Stadium',referee:'Thomas Bramall',attendance:17131,kickoff:'15:00',endMinute:90,addedTime:null,weather:'',
  homeXI:['Caoimhin Kelleher','Michael Kayode','Kristoffer Ajer','Nathan Collins','Keane Lewis-Potter','Mamadou Sangare','Vitaly Janelt','Dango Ouattara','Mikkel Damsgaard','Kevin Schade','Igor Thiago'],
  awayXI:['Robin Roefs','Thomas Meunier','Nordi Mukiele','Daniel Ballard','Kevin Danso','Reinildo','Nilson Angulo','Noah Sadiki','Granit Xhaka','Enzo Le Fée','Brian Brobbey'],
  homeSubs:[['Nathan Collins',17,'Jannik Schuster'],['Michael Kayode',45,'Aaron Hickey'],['Dango Ouattara',45,'Jaidon Anthony'],['Mamadou Sangare',45,'Yegor Yarmolyuk'],['Mikkel Damsgaard',86,'Callum Wilson']],
  awaySubs:[['Thomas Meunier',64,'T Hume'],['Nilson Angulo',64,'Wilson Isidor'],['Noah Sadiki',74,'Malick Fofana']],
  stat:[49,51,12,14,2,5,4,3,19,9,0,3,2,1],
  events:[['yellow',14,'Sunderland','Noah Sadiki',''],['yellow',30,'Brentford','Mamadou Sangare',''],['goal',57,'Brentford','Vitaly Janelt',''],['yellow',62,'Brentford','Vitaly Janelt',''],['yellow',69,'Brentford','Yegor Yarmolyuk',''],['goal',82,'Sunderland','Enzo Le Fée','',{penalty:true}],['yellow',88,'Sunderland','Granit Xhaka','']],
  notes:'MW3. Enzo Le Fée equaliser was a penalty. No assist is credited to a penalty.'},
 {id:23,home:'Brighton & Hove Albion',away:'Leeds United',score:[1,1],ht:[0,1],venue:'Amex Stadium',referee:'Stuart Attwell',attendance:31661,kickoff:'15:00',endMinute:93,addedTime:null,weather:'20°C reported at match venue',
  homeXI:['Bart Verbruggen','Ferdi Kadıoğlu','Luka Vušković','Lewis Dunk','Olivier Boscagli','Pascal Groß','Yasin Ayari','Diego Gómez','Malick Yalcouyé','Maxim De Cuyper','Charalampos Kostoulas'],
  awayXI:['James Trafford','James Justin','Nico Elvedi','Tarik Muharemović','Jayden Bogle','Ethan Ampadu','Ao Tanaka','Gabriel Gudmundsson','Anton Stach','Noah Okafor','Dominic Calvert-Lewin'],
  homeSubs:[['Maxim De Cuyper',77,'Promise David'],['Ferdi Kadıoğlu',78,'Costinha'],['Olivier Boscagli',93,'Pascal Struijk']],
  awaySubs:[['Jayden Bogle',61,'Jaka Bijol'],['Noah Okafor',62,'Brenden Aaronson'],['Ao Tanaka',73,'Harry Wilson'],['Dominic Calvert-Lewin',73,'Lukas Nmecha']],
  stat:[67,33,20,10,5,5,7,6,13,16,4,2,3,4],
  events:[['yellow',6,'Leeds United','Jayden Bogle',''],['goal',15,'Leeds United','Jayden Bogle','Ao Tanaka'],['yellow',38,'Brighton & Hove Albion','Pascal Groß',''],['yellow',49,'Brighton & Hove Albion','Maxim De Cuyper',''],['yellow',64,'Leeds United','Dominic Calvert-Lewin',''],['goal',71,'Brighton & Hove Albion','Luka Vušković','Maxim De Cuyper'],['yellow',85,'Leeds United','Harry Wilson',''],['yellow',88,'Brighton & Hove Albion','Promise David','']],
  notes:'MW3. Goal assists verified via FBref/FotMob: Ao Tanaka and Maxim De Cuyper.'},
 {id:24,home:'Fulham',away:'Crystal Palace',score:[2,3],ht:[2,1],venue:'Craven Cottage',referee:'Samuel Barrott',attendance:null,kickoff:'15:00',endMinute:90,addedTime:null,weather:'',
  homeXI:['Bernd Leno','Timothy Castagne','Joachim Andersen','Calvin Bassey','Antonee Robinson','Shea Charles','Alex Iwobi','Oscar Bobb','Joshua King','César Palacios','Gonzalo García'],
  awayXI:['Dean Henderson','Jaydee Canvot','Axel Disasi','Chris Richards','Anan Khalaili','Adam Wharton','Quinten Timber','Tyrick Mitchell','Yéremi Pino','Daichi Kamada','Edward Nketiah'],
  homeSubs:[['César Palacios',62,'Sander Berge'],['Shea Charles',79,'Emile Smith Rowe'],['Oscar Bobb',79,'Hugo Larsson'],['Antonee Robinson',79,'Ryan Sessegnon'],['Alex Iwobi',83,'Rodrigo Muniz']],
  awaySubs:[['Edward Nketiah',45,'Jorgen Strand Larsen'],['Quinten Timber',74,'Will Hughes'],['Tyrick Mitchell',74,'Ben Chilwell'],['Daichi Kamada',89,'Darío Osorio'],['Yéremi Pino',89,'Oscar Mingueza']],
  stat:[65,35,25,10,6,5,7,1,6,7,1,6,2,5],
  events:[['goal',11,'Fulham','Joshua King',''],['goal',35,'Crystal Palace','Tyrick Mitchell','Edward Nketiah'],['goal',42,'Fulham','César Palacios',''],['goal',54,'Crystal Palace','Tyrick Mitchell',''],['goal',77,'Crystal Palace','Ben Chilwell','Daichi Kamada']],
  notes:'MW3. Matchcalendar verified Nketiah assist for Mitchell at 35 and Kamada assist for Chilwell at 77. Attendance, cards and remaining assists left unfilled where no exact reliable value was confirmed.'},
 {id:26,home:'Manchester City',away:'Coventry City',score:[1,0],ht:[1,0],venue:'Etihad Stadium',referee:'Paul Tierney',attendance:60765,kickoff:'15:00',endMinute:95,addedTime:null,weather:'',
  homeXI:['Gianluigi Donnarumma','Abdukodir Khusanov','Ruben Dias','Joško Gvardiol','Nico O’Reilly','Elliot Anderson','Marc Guehi','Antoine Semenyo','Rayan Cherki','Iliman Ndiaye','Erling Haaland'],
  awayXI:['Carl Rushworth','Bobby Thomas','Aurele Amenda','Ethan Pinnock','Milan van Ewijk','Frank Onyeka','Matt Grimes','Jay Dasilva','Jack Rudoni','Ephron Mason-Clarke','Taiwo Awoniyi'],
  homeSubs:[['Rayan Cherki',66,'Phil Foden'],['Ayyoub Bouaddi',76,'Enzo Fernandez'],['Iliman Ndiaye',87,'Ryan McAidoo']],
  awaySubs:[['Frank Onyeka',63,'Caleb Yirenkyi'],['Jack Rudoni',63,'Loum Tchaouna'],['Ephron Mason-Clarke',71,'Brandon Thomas-Asante'],['Taiwo Awoniyi',71,'Ellis Simms'],['Jay Dasilva',85,'Gustavo Hamer']],
  stat:[78,22,15,12,4,3,4,5,7,17,5,2,3,2],
  events:[['yellow',19,'Coventry City','Milan van Ewijk',''],['goal',26,'Manchester City','Erling Haaland','Antoine Semenyo'],['yellow',92,'Coventry City','Ethan Pinnock',''],['yellow',95,'Manchester City','Abdukodir Khusanov','']],
  notes:'MW3. Haaland goal assist verified from Premier League match report as Antoine Semenyo.'},
 {id:28,home:'Nottingham Forest',away:'Tottenham Hotspur',score:[0,0],ht:[0,0],venue:'City Ground',referee:'Craig Pawson',attendance:30686,kickoff:'15:00',endMinute:90,addedTime:null,weather:'',
  homeXI:['Matz Sels','Jair','Nikola Milenkovic','Murillo','Ola Aina','Xaver Schlager','James McAtee','Neco Williams','Morgan Gibbs-White','Dan Ndoye','Liam Delap'],
  awayXI:['Antonin Kinsky','Pedro Porro','Jan Paul van Hecke','Micky van de Ven','Iyenoma Udogie','Rodrigo Bentancur','Sandro Tonali','Savinho','Conor Gallagher','Mathys Tel','Omar Marmoush'],
  homeSubs:[['Ola Aina',59,'Daniel Muñoz'],['Liam Delap',74,'Chris Wood'],['Murillo',90,'Ousmane Diomandé']],
  awaySubs:[['Iyenoma Udogie',61,'Andrew Robertson'],['Savinho',61,'Kudus Mohammed'],['Mathys Tel',74,'Mykhailo Mudryk'],['Conor Gallagher',83,'Mateus Fernandes'],['Omar Marmoush',84,'Dominic Solanke']],
  stat:[41,59,12,11,2,0,2,10,22,14,2,1,0,1],
  events:[['yellow',46,'Tottenham Hotspur','Iyenoma Udogie',''],['yellow',52,'Nottingham Forest','Nikola Milenkovic',''],['yellow',78,'Nottingham Forest','James McAtee',''],['yellow',84,'Tottenham Hotspur','Mateus Fernandes','']],
  notes:'MW3. Neco Williams goal was disallowed; final score 0-0. Both starting goalkeepers/eligible defenders receive clean-sheet credit only through existing NL4 60-minute rule.'},
 {id:25,home:'Hull City',away:'Aston Villa',score:[0,0],ht:[0,0],venue:'MKM Stadium',referee:'Michael Oliver',attendance:24425,kickoff:'17:30',endMinute:90,addedTime:null,weather:'',
  homeXI:['Konstantinos Tzolakis','Lewie Coyle','Semi Ajayi','John Egan','Nobel Mendy','Ryan Giles','Mohamed Bachir Belloumi','Regan Slater','Lucas Gourna-Douath','Elliot Stroud','Oli McBurnie'],
  awayXI:['Zion Suzuki','Matty Cash','Victor Lindelöf','Tyrone Mings','Ian Maatsen','Boubacar Kamara','Ross Barkley','John McGinn','Emiliano Buendia','George Hemmings','Nicolas Jackson'],
  homeSubs:[['Elliot Stroud',63,'Sorba Thomas'],['Lewie Coyle',64,'Brooke Norton-Cuffy'],['Nobel Mendy',71,'Lucas Herrington'],['Lucas Gourna-Douath',81,'Jens Hjertø-Dahl'],['Mohamed Bachir Belloumi',82,'Mohamed Ali Cho']],
  awaySubs:[['Emiliano Buendia',75,'Alejandro Garnacho'],['George Hemmings',75,'Alysson'],['Ian Maatsen',75,'Matteo Ruggeri'],['Matty Cash',85,'Aaron Wan-Bissaka'],['Nicolas Jackson',85,'Tammy Abraham']],
  stat:[26,74,11,13,4,1,3,4,10,5,2,2,1,4],
  events:[['yellow',39,'Hull City','Semi Ajayi',''],['yellow',67,'Hull City','Lucas Gourna-Douath','']],
  notes:'MW3. Goalless draw. Lineups cross-checked with confirmed lineup source and match statistics with Football Web Pages.'},
 {id:30,home:'Everton',away:'Manchester United',score:[2,2],ht:[0,0],venue:'Hill Dickinson Stadium',referee:'John Brooks',attendance:52302,kickoff:'14:00',endMinute:96,addedTime:null,weather:'',
  homeXI:['Jordan Pickford','Merlin Röhl','James Tarkowski','Jarrad Branthwaite','Vitaliy Mykolenko','Harrison Armstrong','James Garner','Brennan Johnson','Kiernan Dewsbury-Hall','Tyrique George','Thierno Barry'],
  awayXI:['Senne Lammens','Diogo Dalot','Harry Maguire','Lisandro Martinez','Luke Shaw','Youri Tielemans','Kobbie Mainoo','Bryan Mbeumo','Bruno Fernandes','Marcus Rashford','Matheus Cunha'],
  homeSubs:[['Brennan Johnson',66,'Jack Grealish'],['Merlin Röhl',75,'Hayden Hackney'],['James Garner',77,'Ainsley Maitland-Niles']],
  awaySubs:[['Matheus Cunha',70,'Benjamin Šeško'],['Marcus Rashford',70,'Patrick Dorgu'],['Kobbie Mainoo',84,'Andrey Santos'],['Diogo Dalot',84,'Leny Yoro'],['Luke Shaw',91,'Noussair Mazraoui']],
  stat:[45,55,18,14,6,3,4,3,7,11,3,1,1,4],
  events:[['yellow',13,'Everton','Harrison Armstrong',''],['yellow',34,'Everton','Brennan Johnson',''],['goal',46,'Manchester United','Bryan Mbeumo',''],['yellow',62,'Manchester United','Luke Shaw',''],['yellow',64,'Everton','Merlin Röhl',''],['yellow',79,'Manchester United','Harry Maguire',''],['yellow',81,'Manchester United','Diogo Dalot',''],['goal',83,'Everton','Tyrique George',''],['goal',88,'Manchester United','Benjamin Šeško',''],['goal',96,'Everton','Ainsley Maitland-Niles','']],
  notes:'MW3. Maitland-Niles equalised at 90+6. Goal assists left blank where no independent exact source was confirmed.'},
 {id:29,home:'Arsenal',away:'Chelsea',score:[2,1],ht:[1,1],venue:'Emirates Stadium',referee:'Chris Kavanagh',attendance:60240,kickoff:'16:30',endMinute:95,addedTime:4,weather:'',
  homeXI:['David Raya','Ben White','Ezri Konsa','Gabriel Magalhães','Riccardo Calafiori','Declan Rice','Myles Lewis-Skelly','Bukayo Saka','Martin Ødegaard','Christos Tzolis','Kai Havertz'],
  awayXI:['Emiliano Martinez','Josh Acheampong','Maxence Lacroix','Wesley Fofana','Pedro Neto','Reece James','Roméo Lavia','Jorrel Hato','Cole Palmer','Morgan Rogers','João Pedro'],
  homeSubs:[['Myles Lewis-Skelly',67,'Martín Zubimendi'],['Riccardo Calafiori',67,'Piero Hincapié'],['Martin Ødegaard',77,'Mikel Merino'],['Kai Havertz',78,'Viktor Gyökeres'],['Bukayo Saka',90,'Noni Madueke']],
  awaySubs:[['Jorrel Hato',60,'Pep Chavarría'],['Roméo Lavia',60,'Malo Gusto'],['Pedro Neto',81,'Estêvão'],['Morgan Rogers',87,'Danny Welbeck']],
  stat:[55,45,16,13,9,5,5,3,13,16,3,0,4,8],
  events:[['goal',2,'Chelsea','Morgan Rogers','Jorrel Hato'],['yellow',14,'Chelsea','João Pedro',''],['goal',25,'Arsenal','Kai Havertz','Declan Rice'],['yellow',45,'Chelsea','Cole Palmer',''],['goal',50,'Arsenal','Martin Ødegaard','Christos Tzolis'],['yellow',58,'Arsenal','Christos Tzolis',''],['yellow',58,'Chelsea','Maxence Lacroix',''],['yellow',83,'Chelsea','Morgan Rogers',''],['yellow',95,'Arsenal','Mikel Merino','']],
  notes:'MW3. Goal assists cross-checked with FBref/Sporting Life: Rogers—Hato, Havertz—Rice, Ødegaard—Tzolis. Minimum second-half added time reported as +4; final card occurred at 90+5.'}
];
function build(m,existing){
  const record={...(existing||{}),homeScore:m.score[0],awayScore:m.score[1],homeLineup:xi(m.home,m.homeXI),awayLineup:xi(m.away,m.awayXI),homeSubs:m.homeSubs.map(x=>sub(m.home,...x)),awaySubs:m.awaySubs.map(x=>sub(m.away,...x)),stats:stats(...m.stat),events:m.events.map(x=>ev(x[0],x[1],x[2],x[3],x[4],x[5]||{})),manOfTheMatch:'',
    matchDetails:{...(existing?.matchDetails||{}),date:m.id===29||m.id===30?'2026-09-06':'2026-09-05',kickoff:m.kickoff,venue:m.venue,referee:m.referee,attendance:m.attendance,halftimeHomeScore:m.ht[0],halftimeAwayScore:m.ht[1],addedTime:m.addedTime,weather:m.weather,notes:m.notes},
    matchMeta:{...(existing?.matchMeta||{}),kickoff:(typeof ALL_FIXTURES!=='undefined'&&ALL_FIXTURES.find(f=>f.id===m.id)?.kickoff)||'',venue:m.venue,referee:m.referee,attendance:m.attendance,status:'full-time',endMinute:m.endMinute},
    fullDataVerified:true,verifiedMatchdayVersion:VERSION,verifiedAt:'2026-09-08',advancedPlayerStatsVerified:false,motmVerified:false,updatedAt:new Date().toISOString()};
  return record;
}
function apply(){
  if(typeof db==='undefined'||typeof ALL_FIXTURES==='undefined')return false;
  let changed=0;
  MATCHES.forEach(m=>{
    if(!db[m.home]||!db[m.away])return;
    const existing=db[m.home]?.fixtureData?.[m.id]||db[m.away]?.fixtureData?.[m.id]||{};
    if(existing?.verifiedMatchdayVersion===VERSION)return;
    const record=build(m,existing);
    [m.home,m.away].forEach(t=>{db[t].fixtureData=db[t].fixtureData||{};db[t].fixtureData[m.id]=clone(record);});
    changed++;
  });
  if(!changed)return true;
  const teams=[...new Set(MATCHES.flatMap(m=>[m.home,m.away]))];
  teams.forEach(team=>{try{if(typeof recalculatePlayerStatsFromFixtures==='function')recalculatePlayerStatsFromFixtures(team);}catch(e){console.warn('[NL4 MW3] player recalc failed',team,e);}});
  teams.forEach(team=>{try{if(typeof recalculateClubStatsFromFixtures==='function')recalculateClubStatsFromFixtures(team);}catch(e){console.warn('[NL4 MW3] club recalc failed',team,e);}});
  try{if(typeof persist==='function')persist();}catch(e){console.warn('[NL4 MW3] persist failed',e);}
  try{if(typeof render==='function')render();}catch(_){}
  try{window.NL4RecordRoomGoalkeeperSaves?.recalcAll?.();}catch(_){}
  try{window.NL4RecordRoomArsenalPublicSync?.queue?.(250);}catch(_){}
  window.dispatchEvent(new CustomEvent('nl4:record-room-saved',{detail:{source:'mw3-completion',matches:changed}}));
  console.info('[NL4 Record Room] MW3 completion batch applied',changed,'matches',VERSION);
  return true;
}
function run(){if(!apply())setTimeout(apply,900);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
window.NL4RecordRoomMatchday2026090506={apply,version:VERSION,matches:MATCHES.map(m=>m.id)};
})();