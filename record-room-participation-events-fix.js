// NL4 Record Room — completed-match participation/event repair.
// Isolated to record-room.html. Preserves the existing model, stats importer and save pipeline.
(function(){
'use strict';
const VERSION='20260904-participation-events-v1';
const KEY='nl4_rr_participation_events_fix_version';
const E=(type,minute,team,player,assist='')=>({type,minute,player:`${team}|||${player}`,assist:assist?`${team}|||${assist}`:''});
const EVENTS={
  'Arsenal|||Coventry City':[
    E('goal',15,'Arsenal','Kai Havertz','Riccardo Calafiori'),
    E('goal',23,'Arsenal','Bukayo Saka'),
    E('yellow',27,'Coventry City','Caleb Yirenkyi'),
    E('yellow',34,'Arsenal','Gabriel Magalhães'),
    E('goal',49,'Arsenal','Martin Ødegaard','Ben White')
  ],
  'Hull City|||Manchester United':[
    E('goal',17,'Hull City','Semi Ajayi'),
    E('yellow',34,'Manchester United','Patrick Dorgu'),
    E('goal',38,'Hull City','Nobel Mendy','Regan Slater'),
    E('yellow',42,'Hull City','Matt Crooks'),
    E('yellow',96,'Hull City','Liam Millar')
  ],
  'Everton|||Crystal Palace':[
    E('yellow',30,'Crystal Palace','Daichi Kamada'),
    E('goal',42,'Everton','Kiernan Dewsbury-Hall','Harrison Armstrong'),
    E('goal',53,'Everton','Thierno Barry','Iliman Ndiaye')
  ],
  'Ipswich Town|||Sunderland':[
    E('goal',24,'Ipswich Town','Emersonn Correia da Silva','Julio Enciso'),
    E('yellow',36,'Sunderland','Dan Ballard'),
    E('goal',39,'Sunderland','Nilson Angulo'),
    E('yellow',55,'Sunderland','Nilson Angulo'),
    E('yellow',63,'Sunderland',"Luke O'Nien"),
    E('goal',90,'Ipswich Town','Jack Clarke')
  ],
  'Nottingham Forest|||Leeds United':[
    E('yellow',18,'Nottingham Forest','Ola Aina'),
    E('yellow',32,'Leeds United','Dominic Calvert-Lewin'),
    E('yellow',52,'Nottingham Forest','Jair Cunha'),
    E('goal',88,'Leeds United','Anton Stach')
  ],
  'Brentford|||Tottenham Hotspur':[
    E('goal',12,'Brentford','Keane Lewis-Potter','Mamadou Sangaré'),
    E('goal',33,'Brentford','Vitaly Janelt'),
    E('goal',49,'Brentford','Michael Kayode'),
    E('yellow',55,'Brentford','Igor Thiago'),
    E('yellow',78,'Brentford','Vitaly Janelt')
  ],
  'Brighton & Hove Albion|||Aston Villa':[
    E('goal',8,'Brighton & Hove Albion','Victor Lindelöf'),
    E('yellow',9,'Aston Villa','João Gomes'),
    E('yellow',9,'Brighton & Hove Albion','Pascal Groß'),
    E('yellow',11,'Brighton & Hove Albion','Yasin Ayari'),
    E('goal',18,'Brighton & Hove Albion','Maxim De Cuyper'),
    E('goal',30,'Brighton & Hove Albion','Jack Hinshelwood','Diego Gómez'),
    E('goal',31,'Brighton & Hove Albion','Jack Hinshelwood'),
    E('yellow',33,'Aston Villa','John McGinn'),
    E('red',40,'Aston Villa','João Gomes'),
    E('yellow',95,'Aston Villa','Matty Cash')
  ],
  'Manchester City|||AFC Bournemouth':[
    E('goal',26,'AFC Bournemouth','Marcus Tavernier','Evanilson'),
    E('yellow',46,'AFC Bournemouth','Evanilson'),
    E('yellow',78,'Manchester City','Phil Foden'),
    E('goal',84,'Manchester City','Marc Guéhi','Rayan Cherki'),
    E('yellow',85,'AFC Bournemouth','António Silva'),
    E('goal',91,'Manchester City','Joško Gvardiol','Rayan Cherki')
  ],
  'Newcastle United|||Liverpool':[
    E('goal',5,'Newcastle United','Anthony Elanga','William Osula'),
    E('yellow',25,'Newcastle United','Yoane Wissa'),
    E('yellow',30,'Liverpool','Miloš Kerkez'),
    E('yellow',30,'Liverpool','Jeremie Frimpong'),
    E('yellow',34,'Newcastle United','Lewis Miley'),
    E('goal',55,'Liverpool','Cody Gakpo','Ryan Gravenberch'),
    E('goal',57,'Newcastle United','Joe Willock','Yoane Wissa'),
    E('yellow',65,'Newcastle United','Jacob Ramsey'),
    E('yellow',79,'Newcastle United','Jacob Murphy'),
    E('yellow',90,'Liverpool','Virgil van Dijk'),
    E('yellow',93,'Newcastle United','Lukáš Horníček'),
    E('goal',99,'Liverpool','Dominik Szoboszlai')
  ],
  'Fulham|||Chelsea':[
    E('goal',1,'Chelsea','João Pedro','Cole Palmer'),
    E('yellow',5,'Chelsea','Levi Colwill'),
    E('yellow',12,'Chelsea','Roméo Lavia'),
    E('goal',23,'Fulham','Joshua King','Timothy Castagne'),
    E('goal',41,'Chelsea','Morgan Rogers','Maxence Lacroix'),
    E('goal',49,'Chelsea','Cole Palmer','João Pedro'),
    E('goal',54,'Fulham','Gonzalo García'),
    E('yellow',75,'Chelsea','Reece James'),
    E('yellow',76,'Fulham','Calvin Bassey'),
    E('yellow',88,'Fulham','Timothy Castagne')
  ],
  'Crystal Palace|||Manchester City':[
    E('goal',17,'Manchester City','Erling Haaland','Antoine Semenyo'),
    E('yellow',33,'Manchester City','Rayan Cherki'),
    E('goal',54,'Manchester City','Rayan Cherki'),
    E('yellow',56,'Manchester City','Elliot Anderson'),
    E('goal',56,'Crystal Palace','Gianluigi Donnarumma'),
    E('goal',59,'Manchester City','Rayan Cherki'),
    E('goal',84,'Manchester City','Erling Haaland','Phil Foden')
  ],
  'Liverpool|||Nottingham Forest':[
    E('goal',24,'Nottingham Forest','Dan Ndoye','Morgan Gibbs-White'),
    E('yellow',50,'Nottingham Forest','Ola Aina'),
    E('yellow',54,'Liverpool','Víctor Muñoz'),
    E('yellow',58,'Liverpool','Florian Wirtz'),
    E('goal',60,'Liverpool','Alexander Isak','Cody Gakpo'),
    E('yellow',69,'Liverpool','Alisson'),
    E('goal',70,'Nottingham Forest','Morgan Gibbs-White'),
    E('yellow',79,'Liverpool','Rafael Araújo'),
    E('goal',82,'Liverpool','Víctor Muñoz','Florian Wirtz')
  ],
  'AFC Bournemouth|||Everton':[
    E('yellow',21,'AFC Bournemouth','Alex Scott'),
    E('yellow',23,'AFC Bournemouth','Adam Smith'),
    E('goal',41,'AFC Bournemouth','Alex Scott','Evanilson'),
    E('yellow',53,'AFC Bournemouth','Marcus Tavernier'),
    E('yellow',59,'Everton','James Garner'),
    E('goal',91,'Everton','James Tarkowski'),
    E('yellow',95,'Everton','Carlos Alcaraz')
  ],
  'Coventry City|||Hull City':[
    E('yellow',10,'Hull City','Lewie Coyle'),
    E('yellow',51,'Hull City','Regan Slater'),
    E('yellow',54,'Hull City','Elliot Stroud'),
    E('yellow',68,'Hull City','Oli McBurnie'),
    E('goal',82,'Hull City','Liam Millar','Mohamed Belloumi'),
    E('yellow',84,'Coventry City','Aurèle Amenda')
  ],
  'Tottenham Hotspur|||Newcastle United':[
    E('yellow',3,'Tottenham Hotspur','Micky van de Ven'),
    E('yellow',13,'Newcastle United','Nico González'),
    E('goal',62,'Newcastle United','Anthony Elanga','Amar Dedić'),
    E('goal',72,'Newcastle United','Yoane Wissa','Nick Woltemade'),
    E('yellow',79,'Newcastle United','Sven Botman')
  ],
  'Chelsea|||Brighton & Hove Albion':[
    E('goal',4,'Chelsea','Roméo Lavia'),
    E('goal',14,'Chelsea','Pedro Neto','Morgan Rogers'),
    E('goal',32,'Chelsea','João Pedro','Jorrel Hato'),
    E('goal',35,'Brighton & Hove Albion','Malick Yalcouyé'),
    E('yellow',55,'Chelsea','Wesley Fofana'),
    E('goal',63,'Brighton & Hove Albion','João Pedro'),
    E('yellow',70,'Brighton & Hove Albion','Lewis Dunk'),
    E('goal',74,'Chelsea','Cole Palmer','João Pedro'),
    E('yellow',89,'Brighton & Hove Albion','Olivier Boscagli'),
    E('yellow',91,'Brighton & Hove Albion','João Costinha'),
    E('goal',96,'Brighton & Hove Albion','Pascal Groß')
  ],
  'Leeds United|||Brentford':[
    E('yellow',30,'Brentford','Jaidon Anthony'),
    E('goal',41,'Brentford','Kevin Schade','Keane Lewis-Potter'),
    E('yellow',74,'Brentford','Kristoffer Ajer'),
    E('yellow',76,'Brentford','Vitaly Janelt'),
    E('goal',79,'Leeds United','Dominic Calvert-Lewin','Lukas Nmecha'),
    E('yellow',93,'Brentford','Nathan Collins')
  ],
  'Sunderland|||Fulham':[
    E('yellow',35,'Fulham','Joachim Andersen'),
    E('yellow',59,'Fulham','César Palacios'),
    E('goal',75,'Sunderland','Wilson Isidor','Habib Diarra')
  ],
  'Manchester United|||Ipswich Town':[
    E('goal',29,'Ipswich Town','Leif Davis','Abdul Fatawu'),
    E('goal',40,'Manchester United','Bruno Fernandes','Matheus Cunha'),
    E('goal',56,'Manchester United','Jacob Greaves'),
    E('goal',61,'Manchester United','Bruno Fernandes'),
    E('goal',68,'Manchester United','Bruno Fernandes'),
    E('goal',82,'Manchester United','Bryan Mbeumo','Bruno Fernandes'),
    E('goal',91,'Ipswich Town','Chuba Akpom','Julio Enciso'),
    E('yellow',93,'Manchester United','Bryan Mbeumo')
  ],
  'Aston Villa|||Arsenal':[
    E('yellow',29,'Arsenal','Christos Tzolis'),
    E('goal',59,'Arsenal','Bukayo Saka','Riccardo Calafiori'),
    E('yellow',81,'Aston Villa','Alysson Edward'),
    E('yellow',82,'Aston Villa','John McGinn'),
    E('yellow',96,'Aston Villa','Ian Maatsen')
  ]
};
const SUB_FIXES={
  'Arsenal|||Coventry City':{away:[['Caleb Yirenkyi',62,'Victor Torp'],['Brandon Thomas-Asante',70,'Jack Rudoni'],['Ellis Simms',70,'Taiwo Awoniyi'],['Loum Tchaouna',82,'Gustavo Hamer']]},
  'Manchester City|||AFC Bournemouth':{away:[['Lewis Cook',75,'Tyler Adams'],['Justin Kluivert',75,'Alex Tóth'],['Evanilson',75,'Daniel Jebbison'],['Rayan',89,'Ben Gannon-Doak']]},
  'Newcastle United|||Liverpool':{home:[['Sean Steur',56,'Jacob Ramsey'],['William Osula',56,'Joe Willock'],['Lewis Miley',76,'Alhassan Bamba'],['Anthony Elanga',76,'Jacob Murphy'],['Yoane Wissa',95,'Fabian Schär']]}
};
function escHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function patchPlayerOptions(){
  if(typeof window.playerOptions!=='function'||window.playerOptions.__nl4ImportedFix)return;
  const original=window.playerOptions;
  const patched=function(team,selected=''){
    let html=original(team,selected);
    const wanted=String(selected||'').trim();
    if(wanted){
      const probe=`value="${escHtml(wanted)}"`;
      if(!html.includes(probe)) html=`<option value="${escHtml(wanted)}" selected>${escHtml(wanted)}</option>`+html;
    }
    return html;
  };
  patched.__nl4ImportedFix=true;
  window.playerOptions=patched;
}
function keyForFixture(f){return `${f.home}|||${f.away}`;}
function canonicalStore(f){
  if(typeof db==='undefined'||typeof fixtureStore!=='function')return null;
  const club=db[f.home]?f.home:(db[f.away]?f.away:null);
  return club?fixtureStore(club,f.id):null;
}
function applyParticipationAndEvents(){
  if(typeof ALL_FIXTURES==='undefined'||typeof db==='undefined')return {updated:0,missing:[]};
  let updated=0;const missing=[];const touched=new Set();
  Object.entries(EVENTS).forEach(([key,events])=>{
    const [home,away]=key.split('|||'),f=ALL_FIXTURES.find(x=>x.home===home&&x.away===away);
    if(!f){missing.push(key);return;}
    const s=canonicalStore(f);if(!s){missing.push(key);return;}
    s.events=JSON.parse(JSON.stringify(events));
    const fix=SUB_FIXES[key];
    if(fix?.home)s.homeSubs=fix.home.map(([out,min,inn])=>({out,outMin:min,in:inn,inMin:min}));
    if(fix?.away)s.awaySubs=fix.away.map(([out,min,inn])=>({out,outMin:min,in:inn,inMin:min}));
    [home,away].filter(t=>db[t]).forEach(t=>{
      db[t].fixtureData=db[t].fixtureData||{};
      db[t].fixtureData[f.id]=JSON.parse(JSON.stringify(s));
      touched.add(t);
    });
    updated++;
  });
  touched.forEach(t=>{
    if(typeof recalculatePlayerStatsFromFixtures==='function')recalculatePlayerStatsFromFixtures(t);
    if(typeof recalculateClubStatsFromFixtures==='function')recalculateClubStatsFromFixtures(t);
  });
  if(typeof persist==='function')persist();
  if(typeof render==='function')render();
  localStorage.setItem(KEY,VERSION);
  return {updated,missing};
}
function auditVisible(){
  if(typeof ALL_FIXTURES==='undefined'||typeof db==='undefined')return [];
  const errors=[];
  Object.keys(EVENTS).forEach(key=>{
    const [home,away]=key.split('|||'),f=ALL_FIXTURES.find(x=>x.home===home&&x.away===away);if(!f)return;
    const s=canonicalStore(f);if(!s)return;
    if((s.homeLineup||[]).filter(Boolean).length!==11)errors.push(`${home} vs ${away}: home XI is not 11`);
    if((s.awayLineup||[]).filter(Boolean).length!==11)errors.push(`${home} vs ${away}: away XI is not 11`);
    [...(s.homeSubs||[]),...(s.awaySubs||[])].forEach((x,i)=>{if(!x?.out||!x?.in)errors.push(`${home} vs ${away}: substitution ${i+1} incomplete`);});
    (s.events||[]).forEach((x,i)=>{if(!x?.type||!x?.player||!Number.isFinite(Number(x.minute)))errors.push(`${home} vs ${away}: event ${i+1} incomplete`);});
  });
  return errors;
}
function afterFullImport(){
  patchPlayerOptions();
  const result=applyParticipationAndEvents();
  const errors=auditVisible();
  const status=document.getElementById('rrCompletedStatus');
  if(status)status.textContent=errors.length?`${result.updated} matches repaired; ${errors.length} participation/event audit issue(s) remain.`:`${result.updated} matches repaired: complete 11-player XIs, used substitutions and verified match-event rows preserved.`;
  if(errors.length)console.error('[NL4 Record Room] participation/event audit',errors);
}
function hook(){
  patchPlayerOptions();
  const btn=document.getElementById('rrImportCompleted');
  if(btn&&!btn.dataset.participationHook){
    btn.dataset.participationHook='1';
    btn.addEventListener('click',()=>setTimeout(afterFullImport,60));
  }
  // Repair existing imported storage once per data-version; the normal importer remains the source for lineups/details/stats.
  if(localStorage.getItem(KEY)!==VERSION){
    if(btn){btn.click();setTimeout(afterFullImport,120);}
    else setTimeout(hook,200);
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(hook,500));else setTimeout(hook,500);
})();