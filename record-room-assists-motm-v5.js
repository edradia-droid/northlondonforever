// NL4 Record Room — credited-assist + Man of the Match completion audit.
// Runs after canonical events. Changes ONLY goal assists and manOfTheMatch for the 20 completed matches.
(function(){
'use strict';
const VERSION='20260904-assists-motm-v5';
const KEY='nl4_rr_assists_motm_version';
const M=(team,name)=>`${team}|||${name}`;

// Only corrections where the canonical v4 event row was missing/wrong.
// Blank means the goal is officially unassisted and must stay blank.
const ASSIST_FIXES={
  'Arsenal|||Coventry City':{
    15:M('Arsenal','Riccardo Calafiori'),
    23:'',
    49:M('Arsenal','Ben White')
  },
  'Ipswich Town|||Sunderland':{
    24:M('Ipswich Town','Julio Enciso'),
    39:'',
    90:M('Ipswich Town','Saša Lukić')
  }
};

// One source-backed MOTM selection for every completed league match.
const MOTM={
  'Arsenal|||Coventry City':M('Arsenal','Martin Ødegaard'),
  'Hull City|||Manchester United':M('Hull City','Konstantinos Tzolakis'),
  'Everton|||Crystal Palace':M('Everton','Kiernan Dewsbury-Hall'),
  'Ipswich Town|||Sunderland':M('Ipswich Town','Julio Enciso'),
  'Nottingham Forest|||Leeds United':M('Leeds United','Anton Stach'),
  'Brentford|||Tottenham Hotspur':M('Brentford','Mamadou Sangaré'),
  'Brighton & Hove Albion|||Aston Villa':M('Brighton & Hove Albion','Jack Hinshelwood'),
  'Manchester City|||AFC Bournemouth':M('Manchester City','Rayan Cherki'),
  'Newcastle United|||Liverpool':M('Liverpool','Cody Gakpo'),
  'Fulham|||Chelsea':M('Chelsea','Cole Palmer'),
  'Crystal Palace|||Manchester City':M('Manchester City','Rayan Cherki'),
  'Liverpool|||Nottingham Forest':M('Nottingham Forest','Morgan Gibbs-White'),
  'AFC Bournemouth|||Everton':M('Everton','James Tarkowski'),
  'Coventry City|||Hull City':M('Hull City','Liam Millar'),
  'Tottenham Hotspur|||Newcastle United':M('Newcastle United','Anthony Elanga'),
  'Chelsea|||Brighton & Hove Albion':M('Chelsea','João Pedro'),
  'Leeds United|||Brentford':M('Leeds United','Tarik Muharemović'),
  'Sunderland|||Fulham':M('Sunderland','Nordi Mukiele'),
  'Manchester United|||Ipswich Town':M('Manchester United','Bruno Fernandes'),
  'Aston Villa|||Arsenal':M('Arsenal','Bukayo Saka')
};

function clone(v){return JSON.parse(JSON.stringify(v));}
function fixtureForKey(key){
  const [home,away]=key.split('|||');
  return (typeof ALL_FIXTURES!=='undefined'?ALL_FIXTURES:[]).find(f=>f.home===home&&f.away===away);
}
function stateFor(f){
  if(typeof db==='undefined')return null;
  const club=db[f.home]?f.home:(db[f.away]?f.away:null);
  if(!club)return null;
  if(typeof fixtureStore==='function')return fixtureStore(club,f.id);
  return db[club]?.fixtureData?.[f.id]||null;
}
function apply(){
  if(typeof db==='undefined'||typeof ALL_FIXTURES==='undefined')return {updated:0,errors:['Record Room unavailable']};
  const touched=new Set(),errors=[];let updated=0;
  Object.entries(MOTM).forEach(([key,motm])=>{
    const f=fixtureForKey(key);if(!f){errors.push(`${key}: fixture missing`);return;}
    const s=stateFor(f);if(!s){errors.push(`${key}: state missing`);return;}
    s.manOfTheMatch=motm;
    const fixes=ASSIST_FIXES[key]||{};
    Object.entries(fixes).forEach(([minute,assist])=>{
      const ev=(s.events||[]).find(e=>e.type==='goal'&&Number(e.minute)===Number(minute));
      if(!ev){errors.push(`${key}: goal ${minute} missing`);return;}
      ev.assist=assist;
    });
    s.assistsMotmVerified=true;
    s.assistsMotmVerifiedAt='2026-09-04';
    s.assistsMotmVerifiedVersion=VERSION;
    [f.home,f.away].filter(t=>db[t]).forEach(t=>{
      db[t].fixtureData=db[t].fixtureData||{};
      db[t].fixtureData[f.id]=clone(s);
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
  return {updated,errors};
}
function ensureSelectedOption(select,value){
  if(!select||!value)return;
  let o=[...select.options].find(x=>x.value===value);
  if(!o){
    const parts=value.split('|||');
    o=document.createElement('option');o.value=value;o.textContent=`${parts.slice(1).join('|||')} — ${parts[0]}`;select.appendChild(o);
  }
  select.value=value;
}
function syncOpenMatch(){
  const box=document.getElementById('fixtureDetail');
  const id=Number(box?.dataset?.fixtureId);
  if(!box?.classList.contains('open')||!Number.isFinite(id)||typeof ALL_FIXTURES==='undefined')return;
  const f=ALL_FIXTURES.find(x=>Number(x.id)===id);if(!f)return;
  const s=stateFor(f);if(!s)return;
  ensureSelectedOption(document.getElementById('manOfTheMatch'),s.manOfTheMatch);
  const rows=[...document.querySelectorAll('#eventRows .event-row')];
  (s.events||[]).forEach((ev,i)=>{
    const row=rows[i];if(!row)return;
    const assist=row.querySelector('.event-assist');
    if(ev.assist)ensureSelectedOption(assist,ev.assist); else if(assist)assist.value='';
  });
}
function scheduleSync(){setTimeout(syncOpenMatch,0);setTimeout(syncOpenMatch,100);setTimeout(syncOpenMatch,300);}
function run(){
  let result={updated:0,errors:[]};
  if(localStorage.getItem(KEY)!==VERSION)result=apply();
  scheduleSync();
  const box=document.getElementById('fixtureDetail');
  if(box&&!box.dataset.assistsMotmObserver){box.dataset.assistsMotmObserver='1';new MutationObserver(scheduleSync).observe(box,{childList:true,subtree:true});}
  document.addEventListener('click',e=>{if(e.target?.closest?.('.fixture-open,[data-open-match],.detail-save,#rrImportCompleted'))scheduleSync();},true);
  if(result.errors.length)console.error('[NL4 Record Room] assists/MOTM audit',result.errors);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,1050));else setTimeout(run,1050);
})();
