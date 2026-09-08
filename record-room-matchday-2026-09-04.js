// NL4 Record Room — verified Premier League Matchweek 3 lineups, substitutions and events
(function(){
'use strict';
const VERSION='20260908-pl-mw3-complete-v1';
const clone=v=>JSON.parse(JSON.stringify(v));
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘`]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
const split=v=>{const p=String(v||'').split('|||');return{team:p[0]||'',name:p.slice(1).join('|||')||''};};
const num=v=>{const x=Number(v);return Number.isFinite(x)?x:null;};
const teamMatch=(actual, aliases)=>aliases.some(a=>norm(actual)===norm(a));
function findFixture(homeAliases,awayAliases){
  return ALL_FIXTURES.find(f=>teamMatch(f.home,homeAliases)&&teamMatch(f.away,awayAliases));
}
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
const MW3=[
  {
    home:['Ipswich Town'],away:['Liverpool'],score:[0,2],
    homeLineup:['Kjell Scherpen',"Dara O'Shea",'Issa Diop','Jacob Greaves','Leif Davis','Sasa Lukic','Exequiel Palacios','Abdul Fatawu','Julio Enciso','Daizen Maeda','Emersonn'],
    awayLineup:['Alisson Becker','Ronald Araujo','Jeremy Jacquet','Virgil van Dijk','Milos Kerkez','Alexis Mac Allister','Dominik Szoboszlai','Victor Munoz','Florian Wirtz','Cody Gakpo','Alexander Isak'],
    homeSubs:[{out:'Daizen Maeda',outMin:66,in:'Jack Clarke',inMin:66},{out:'Emersonn',outMin:66,in:'Zian Flemming',inMin:66},{out:'Exequiel Palacios',outMin:78,in:'Abdoul Ouattara',inMin:78},{out:'Abdul Fatawu',outMin:79,in:'Kasey McAteer',inMin:79}],
    awaySubs:[{out:'Alexander Isak',outMin:64,in:'Ryan Gravenberch',inMin:64},{out:'Victor Munoz',outMin:64,in:'Bradley Barcola',inMin:64},{out:'Alexis Mac Allister',outMin:84,in:'Trey Nyoni',inMin:84},{out:'Florian Wirtz',outMin:91,in:'Lewis Koumas',inMin:91}],
    events:[['goal',6,'a','Alexander Isak','a','Cody Gakpo'],['goal',9,'a','Alexander Isak','a','Cody Gakpo'],['yellow',10,'a','Alexis Mac Allister'],['yellow',41,'h','Julio Enciso'],['yellow',52,'a','Jeremy Jacquet'],['yellow',57,'a','Milos Kerkez']]
  },
  {
    home:['Newcastle United','Newcastle'],away:['AFC Bournemouth','Bournemouth'],score:[2,2],
    homeLineup:['Lukas Hornicek','Amar Dedic','Malick Thiaw','Sven Botman','Lewis Hall','Nicolas Gonzalez','Lewis Miley','Anthony Elanga','Joe Willock','Harvey Barnes','Yoane Wissa'],
    awayLineup:['Djordje Petrovic','Adam Smith','James Hill','Antonio Silva','Adrien Truffert','Tyler Adams','Alex Scott','Rayan','Justin Kluivert','Marcus Tavernier','Evanilson'],
    homeSubs:[{out:'Lewis Miley',outMin:63,in:'Jacob Ramsey',inMin:63},{out:'Joe Willock',outMin:63,in:'Matias Fernandez-Pardo',inMin:63},{out:'Nicolas Gonzalez',outMin:77,in:'Sean Steur',inMin:77},{out:'Anthony Elanga',outMin:78,in:'Jacob Murphy',inMin:78},{out:'Lewis Hall',outMin:90,in:'Tino Livramento',inMin:90}],
    awaySubs:[{out:'Tyler Adams',outMin:76,in:'Lewis Cook',inMin:76},{out:'Justin Kluivert',outMin:76,in:'David Brooks',inMin:76},{out:'Marcus Tavernier',outMin:89,in:'Daniel Jebbison',inMin:89},{out:'Rayan',outMin:89,in:'Ben Gannon-Doak',inMin:89},{out:'Alex Scott',outMin:96,in:'Ryan Christie',inMin:96}],
    events:[['goal',9,'a','Marcus Tavernier'],['yellow',28,'h','Anthony Elanga'],['goal',35,'a','Own Goal (Malick Thiaw)'],['goal',37,'h','Harvey Barnes','h','Lewis Hall'],['yellow',57,'h','Yoane Wissa'],['yellow',66,'a','Justin Kluivert'],['yellow',87,'a','Adrien Truffert'],['goal',88,'h','Jacob Ramsey'],['yellow',94,'a','Adam Smith']]
  },
  {
    home:['Brentford'],away:['Sunderland'],score:[1,1],
    homeLineup:['Caoimhin Kelleher','Michael Kayode','Kristoffer Ajer','Nathan Collins','Keane Lewis-Potter','Mamadou Sangare','Vitaly Janelt','Dango Ouattara','Mikkel Damsgaard','Kevin Schade','Igor Thiago'],
    awayLineup:['Robin Roefs','Nordi Mukiele','Kevin Danso','Dan Ballard','Reinildo Mandava','Granit Xhaka','Noah Sadiki','Thomas Meunier','Enzo Le Fee','Nilson Angulo','Brian Brobbey'],
    homeSubs:[{out:'Nathan Collins',outMin:17,in:'Jannik Schuster',inMin:17},{out:'Michael Kayode',outMin:46,in:'Aaron Hickey',inMin:46},{out:'Dango Ouattara',outMin:46,in:'Jaidon Anthony',inMin:46},{out:'Mamadou Sangare',outMin:46,in:'Yehor Yarmoliuk',inMin:46},{out:'Mikkel Damsgaard',outMin:86,in:'Callum Wilson',inMin:86}],
    awaySubs:[{out:'Thomas Meunier',outMin:64,in:'Trai Hume',inMin:64},{out:'Nilson Angulo',outMin:64,in:'Wilson Isidor',inMin:64},{out:'Noah Sadiki',outMin:74,in:'Malick Fofana',inMin:74}],
    events:[['yellow',14,'a','Noah Sadiki'],['yellow',30,'h','Mamadou Sangare'],['goal',57,'h','Vitaly Janelt'],['yellow',62,'h','Vitaly Janelt'],['yellow',69,'h','Yehor Yarmoliuk'],['goal',82,'a','Enzo Le Fee'],['yellow',88,'a','Granit Xhaka']]
  },
  {
    home:['Brighton & Hove Albion','Brighton'],away:['Leeds United','Leeds'],score:[1,1],
    homeLineup:['Bart Verbruggen','Ferdi Kadioglu','Luka Vuskovic','Lewis Dunk','Olivier Boscagli','Pascal Gross','Yasin Ayari','Diego Gomez','Malick Yalcouye','Maxim De Cuyper','Charalampos Kostoulas'],
    awayLineup:['James Trafford','James Justin','Nico Elvedi','Tarik Muharemovic','Jayden Bogle','Anton Stach','Ethan Ampadu','Ao Tanaka','Gabriel Gudmundsson','Dominic Calvert-Lewin','Noah Okafor'],
    homeSubs:[{out:'Maxim De Cuyper',outMin:77,in:'Promise David',inMin:77},{out:'Ferdi Kadioglu',outMin:78,in:'Costinha',inMin:78},{out:'Olivier Boscagli',outMin:93,in:'Pascal Struijk',inMin:93}],
    awaySubs:[{out:'Jayden Bogle',outMin:61,in:'Jaka Bijol',inMin:61},{out:'Noah Okafor',outMin:62,in:'Brenden Aaronson',inMin:62},{out:'Ao Tanaka',outMin:73,in:'Harry Wilson',inMin:73},{out:'Dominic Calvert-Lewin',outMin:73,in:'Lukas Nmecha',inMin:73}],
    events:[['yellow',6,'a','Jayden Bogle'],['goal',15,'a','Jayden Bogle','a','Ao Tanaka'],['yellow',38,'h','Pascal Gross'],['yellow',49,'h','Maxim De Cuyper'],['yellow',64,'a','Dominic Calvert-Lewin'],['goal',71,'h','Luka Vuskovic','h','Maxim De Cuyper'],['yellow',85,'a','Harry Wilson'],['yellow',88,'h','Promise David']]
  },
  {
    home:['Fulham'],away:['Crystal Palace','C Palace'],score:[2,3],
    homeLineup:['Bernd Leno','Timothy Castagne','Joachim Andersen','Calvin Bassey','Antonee Robinson','Shea Charles','Alex Iwobi','Oscar Bobb','Joshua King','Cesar Palacios','Gonzalo Garcia'],
    awayLineup:['Dean Henderson','Chris Richards','Axel Disasi','Jaydee Canvot','Anan Khalaili','Quinten Timber','Adam Wharton','Tyrick Mitchell','Daichi Kamada','Yeremy Pino','Eddie Nketiah'],
    homeSubs:[{out:'Cesar Palacios',outMin:62,in:'Sander Berge',inMin:62},{out:'Antonee Robinson',outMin:79,in:'Ryan Sessegnon',inMin:79},{out:'Oscar Bobb',outMin:79,in:'Hugo Larsson',inMin:79},{out:'Shea Charles',outMin:79,in:'Emile Smith Rowe',inMin:79},{out:'Alex Iwobi',outMin:83,in:'Rodrigo Muniz',inMin:83}],
    awaySubs:[{out:'Eddie Nketiah',outMin:46,in:'Jorgen Strand Larsen',inMin:46},{out:'Quinten Timber',outMin:74,in:'Will Hughes',inMin:74},{out:'Tyrick Mitchell',outMin:74,in:'Ben Chilwell',inMin:74},{out:'Yeremy Pino',outMin:89,in:'Oscar Mingueza',inMin:89},{out:'Daichi Kamada',outMin:89,in:'Dario Osorio',inMin:89}],
    events:[['goal',11,'h','Joshua King'],['goal',35,'a','Tyrick Mitchell','a','Eddie Nketiah'],['goal',42,'h','Cesar Palacios'],['goal',54,'a','Tyrick Mitchell'],['goal',77,'a','Ben Chilwell','a','Daichi Kamada']]
  },
  {
    home:['Manchester City','Man City'],away:['Coventry City','Coventry'],score:[1,0],
    homeLineup:['Gianluigi Donnarumma','Abdukodir Khusanov','Ruben Dias','Marc Guehi','Josko Gvardiol','Enzo Fernandez','Elliot Anderson','Antoine Semenyo','Rayan Cherki','Iliman Ndiaye','Erling Haaland'],
    awayLineup:['Carl Rushworth','Albian Ajeti Amenda','Bobby Thomas','Ethan Pinnock','Milan van Ewijk','Frank Onyeka','Matt Grimes','Jay Dasilva','Jack Rudoni','Ephron Mason-Clark','Taiwo Awoniyi'],
    homeSubs:[{out:'Rayan Cherki',outMin:66,in:'Phil Foden',inMin:66},{out:'Enzo Fernandez',outMin:76,in:'Ayyoub Bouaddi',inMin:76},{out:'Iliman Ndiaye',outMin:87,in:'Ryan McAidoo',inMin:87}],
    awaySubs:[{out:'Jack Rudoni',outMin:63,in:'Loum Tchaouna',inMin:63},{out:'Frank Onyeka',outMin:63,in:'Caleb Yirenkyi',inMin:63},{out:'Ephron Mason-Clark',outMin:71,in:'Brandon Thomas-Asante',inMin:71},{out:'Taiwo Awoniyi',outMin:71,in:'Ellis Simms',inMin:71},{out:'Jay Dasilva',outMin:85,in:'Gustavo Hamer',inMin:85}],
    events:[['yellow',19,'a','Milan van Ewijk'],['goal',26,'h','Erling Haaland','h','Antoine Semenyo'],['yellow',92,'a','Ethan Pinnock'],['yellow',95,'h','Abdukodir Khusanov']]
  },
  {
    home:['Nottingham Forest','Nottm Forest','N Forest'],away:['Tottenham Hotspur','Tottenham','Spurs'],score:[0,0],
    homeLineup:['Matz Sels','Jair Cunha','Nikola Milenkovic','Murillo','Ola Aina','Xaver Schlager','James McAtee','Neco Williams','Dan Ndoye','Morgan Gibbs-White','Liam Delap'],
    awayLineup:['Antonin Kinsky','Pedro Porro','Jan Paul van Hecke','Micky van de Ven','Destiny Udogie','Rodrigo Bentancur','Sandro Tonali','Savinho','Conor Gallagher','Mathys Tel','Omar Marmoush'],
    homeSubs:[{out:'Ola Aina',outMin:59,in:'Daniel Munoz',inMin:59},{out:'Dan Ndoye',outMin:59,in:'Igor Jesus',inMin:59},{out:'Liam Delap',outMin:74,in:'Chris Wood',inMin:74},{out:'Murillo',outMin:90,in:'Ousmane Diomande',inMin:90}],
    awaySubs:[{out:'Destiny Udogie',outMin:61,in:'Andy Robertson',inMin:61},{out:'Savinho',outMin:61,in:'Mohammed Kudus',inMin:61},{out:'Mathys Tel',outMin:74,in:'Mykhailo Mudryk',inMin:74},{out:'Conor Gallagher',outMin:83,in:'Mateus Fernandes',inMin:83},{out:'Omar Marmoush',outMin:84,in:'Dominic Solanke',inMin:84}],
    events:[['yellow',46,'a','Destiny Udogie'],['yellow',52,'h','Nikola Milenkovic'],['yellow',78,'h','James McAtee'],['yellow',84,'a','Mateus Fernandes']]
  },
  {
    home:['Hull City','Hull'],away:['Aston Villa'],score:[0,0],
    homeLineup:['Kostas Tzolakis','Lewie Coyle','Semi Ajayi','John Egan','Nobel Mendy','Ryan Giles','Bachir Belloumi','Regan Slater','Lucas Gourna-Douath','Elliot Stroud','Oliver McBurnie'],
    awayLineup:['Zion Suzuki','Matty Cash','Victor Lindelof','Tyrone Mings','Ian Maatsen','Boubacar Kamara','Ross Barkley','John McGinn','Emi Buendia','George Hemmings','Nicolas Jackson'],
    homeSubs:[{out:'Elliot Stroud',outMin:63,in:'Sorba Thomas',inMin:63},{out:'Lewie Coyle',outMin:64,in:'Brooke Norton-Cuffy',inMin:64},{out:'Nobel Mendy',outMin:71,in:'Lucas Herrington',inMin:71},{out:'Lucas Gourna-Douath',outMin:82,in:'Jens Hjerto-Dahl',inMin:82},{out:'Bachir Belloumi',outMin:82,in:'Mohamed Ali Cho',inMin:82}],
    awaySubs:[{out:'Ian Maatsen',outMin:75,in:'Matteo Ruggeri',inMin:75},{out:'Emi Buendia',outMin:75,in:'Alejandro Garnacho',inMin:75},{out:'George Hemmings',outMin:75,in:'Alysson',inMin:75},{out:'Matty Cash',outMin:85,in:'Aaron Wan-Bissaka',inMin:85},{out:'Nicolas Jackson',outMin:85,in:'Tammy Abraham',inMin:85}],
    events:[['yellow',39,'h','Semi Ajayi'],['yellow',67,'h','Lucas Gourna-Douath']]
  },
  {
    home:['Everton'],away:['Manchester United','Man Utd'],score:[2,2],
    homeLineup:['Jordan Pickford','Merlin Rohl','James Tarkowski','Jarrad Branthwaite','Vitalii Mykolenko','Harrison Armstrong','James Garner','Brennan Johnson','Kiernan Dewsbury-Hall','Tyrique George','Thierno Barry'],
    awayLineup:['Senne Lammens','Diogo Dalot','Harry Maguire','Lisandro Martinez','Luke Shaw','Youri Tielemans','Kobbie Mainoo','Bryan Mbeumo','Bruno Fernandes','Marcus Rashford','Matheus Cunha'],
    homeSubs:[{out:'Brennan Johnson',outMin:66,in:'Jack Grealish',inMin:66},{out:'Merlin Rohl',outMin:75,in:'Hayden Hackney',inMin:75},{out:'James Garner',outMin:77,in:'Ainsley Maitland-Niles',inMin:77}],
    awaySubs:[{out:'Marcus Rashford',outMin:70,in:'Patrick Dorgu',inMin:70},{out:'Matheus Cunha',outMin:70,in:'Benjamin Sesko',inMin:70},{out:'Kobbie Mainoo',outMin:84,in:'Andrey Santos',inMin:84},{out:'Diogo Dalot',outMin:84,in:'Leny Yoro',inMin:84},{out:'Luke Shaw',outMin:91,in:'Noussair Mazraoui',inMin:91}],
    events:[['yellow',13,'h','Harrison Armstrong'],['yellow',34,'h','Brennan Johnson'],['goal',46,'a','Bryan Mbeumo','a','Kobbie Mainoo'],['yellow',62,'a','Luke Shaw'],['yellow',64,'h','Merlin Rohl'],['yellow',79,'a','Harry Maguire'],['yellow',81,'a','Diogo Dalot'],['goal',83,'h','Tyrique George','h','Hayden Hackney'],['goal',88,'a','Benjamin Sesko','a','Luke Shaw'],['goal',96,'h','Ainsley Maitland-Niles']]
  },
  {
    home:['Arsenal'],away:['Chelsea'],score:[2,1],
    homeLineup:['David Raya','Ben White','Ezri Konsa','Gabriel Magalhaes','Riccardo Calafiori','Declan Rice','Myles Lewis-Skelly','Bukayo Saka','Martin Odegaard','Christos Tzolis','Kai Havertz'],
    awayLineup:['Emiliano Martinez','Josh Acheampong','Maxence Lacroix','Wesley Fofana','Pedro Neto','Romeo Lavia','Reece James','Jorrel Hato','Cole Palmer','Morgan Rogers','Joao Pedro'],
    homeSubs:[{out:'Riccardo Calafiori',outMin:67,in:'Piero Hincapie',inMin:67},{out:'Myles Lewis-Skelly',outMin:67,in:'Martin Zubimendi',inMin:67},{out:'Martin Odegaard',outMin:77,in:'Mikel Merino',inMin:77},{out:'Kai Havertz',outMin:78,in:'Viktor Gyokeres',inMin:78},{out:'Bukayo Saka',outMin:90,in:'Noni Madueke',inMin:90}],
    awaySubs:[{out:'Jorrel Hato',outMin:60,in:'Pep Chavarria',inMin:60},{out:'Romeo Lavia',outMin:60,in:'Malo Gusto',inMin:60},{out:'Pedro Neto',outMin:81,in:'Estevao',inMin:81},{out:'Morgan Rogers',outMin:87,in:'Danny Welbeck',inMin:87}],
    events:[['goal',2,'a','Morgan Rogers','a','Jorrel Hato'],['yellow',14,'a','Joao Pedro'],['goal',25,'h','Kai Havertz','h','Declan Rice'],['yellow',45,'a','Cole Palmer'],['goal',50,'h','Martin Odegaard','h','Christos Tzolis'],['yellow',58,'h','Christos Tzolis'],['yellow',58,'a','Maxence Lacroix'],['yellow',83,'a','Morgan Rogers'],['yellow',95,'h','Mikel Merino']]
  }
];
function materializeEvents(raw,home,away){
  return raw.map(e=>({type:e[0],minute:e[1],player:(e[2]==='h'?home:away)+'|||'+e[3],assist:e[4]?(e[4]==='h'?home:away)+'|||'+e[5]:''}));
}
function apply(){
  if(typeof db==='undefined'||typeof ALL_FIXTURES==='undefined')return false;
  const touched=new Set();let applied=0;
  MW3.forEach(m=>{
    const f=findFixture(m.home,m.away);if(!f||!db[f.home]||!db[f.away]){console.warn('[NL4 Record Room] MW3 fixture/team not found',m.home[0],m.away[0]);return;}
    const existing=db[f.home]?.fixtureData?.[f.id]||db[f.away]?.fixtureData?.[f.id]||{};
    const record={...existing,homeScore:m.score[0],awayScore:m.score[1],homeLineup:clone(m.homeLineup),awayLineup:clone(m.awayLineup),homeSubs:clone(m.homeSubs),awaySubs:clone(m.awaySubs),events:materializeEvents(m.events,f.home,f.away),verifiedMatchdayVersion:VERSION,fullDataVerified:true,fullDataVerifiedAt:'2026-09-08',updatedAt:new Date().toISOString()};
    [f.home,f.away].forEach(t=>{db[t].fixtureData=db[t].fixtureData||{};db[t].fixtureData[f.id]=clone(record);touched.add(t);});
    applied++;
  });
  if(!applied)return false;
  touched.forEach(recalcPlayers);
  try{if(typeof persist==='function')persist();}catch(e){console.warn('[NL4] Matchday persist failed',e);}
  try{if(typeof render==='function')render();}catch(_){}
  console.info('[NL4 Record Room] Matchweek 3 lineups/substitutions/events imported:',applied,'fixtures');
  return true;
}
function run(){if(!apply())setTimeout(apply,800);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
window.NL4RecordRoomMatchday20260904={apply,version:VERSION};
})();