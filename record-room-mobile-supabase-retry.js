// NL4 Record Room — V39 bulk mobile Supabase hydration
(function(){
'use strict';
if(window.__NL4_RR_MOBILE_SUPABASE_RETRY__)return;
window.__NL4_RR_MOBILE_SUPABASE_RETRY__=true;
const SEASON='2026/27';
let flight=null;
let attempts=0;
let lastImported=null;
const authoritativeFixtures=new Map();

const norm=v=>String(v||'').trim();
const client=()=>window.nl4Supabase||window.supabaseClient||window.supabaseDb||null;
const marker=text=>{const el=document.getElementById('buildMarker');if(el)el.textContent=text;};
const withTimeout=(promise,ms,label)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error(`${label} timed out after ${ms}ms`)),ms);
  Promise.resolve(promise).then(v=>{clearTimeout(timer);resolve(v);},e=>{clearTimeout(timer);reject(e);});
});
function byMatch(rows){const map=new Map();(rows||[]).forEach(r=>{const k=String(r.match_id);if(!map.has(k))map.set(k,[]);map.get(k).push(r);});return map;}
function ensureFixture(team,f){
  if(!db?.[team])return null;
  db[team].fixtureData=db[team].fixtureData||{};
  if(!db[team].fixtureData[f.id])db[team].fixtureData[f.id]={homeScore:null,awayScore:null,homeLineup:Array(11).fill(''),awayLineup:Array(11).fill(''),homeSubs:[],awaySubs:[],events:[],stats:{},matchDetails:{},matchInfo:{}};
  return db[team].fixtureData[f.id];
}
function applyMatch(f,m,d,st,lineups,subs,events){
  const homeXI=lineups.filter(x=>x.team_name===f.home&&x.is_starter).sort((a,b)=>(Number(a.pitch_slot)||99)-(Number(b.pitch_slot)||99)).map(x=>x.player_name);
  const awayXI=lineups.filter(x=>x.team_name===f.away&&x.is_starter).sort((a,b)=>(Number(a.pitch_slot)||99)-(Number(b.pitch_slot)||99)).map(x=>x.player_name);
  const mapSubs=team=>subs.filter(x=>x.team_name===team).map(x=>({out:x.player_out,in:x.player_in,outMin:Number(x.minute)||0,inMin:Number(x.minute)||0}));
  const mappedEvents=events.map(x=>({type:x.event_type==='yellow_card'?'yellow':x.event_type==='red_card'?'red':'goal',player:`${x.team_name}|||${x.player_name}`,assist:x.related_player_name?`${x.team_name}|||${x.related_player_name}`:'',minute:Number(x.minute)||0}));
  [f.home,f.away].forEach(team=>{
    const s=ensureFixture(team,f);if(!s)return;
    s.homeScore=m.home_score;s.awayScore=m.away_score;
    s.homeLineup=[...homeXI,...Array(Math.max(0,11-homeXI.length)).fill('')].slice(0,11);
    s.awayLineup=[...awayXI,...Array(Math.max(0,11-awayXI.length)).fill('')].slice(0,11);
    s.homeSubs=mapSubs(f.home);s.awaySubs=mapSubs(f.away);s.events=mappedEvents;
    const motmTeam=d?.man_of_the_match?(lineups.find(x=>norm(x.player_name).toLowerCase()===norm(d.man_of_the_match).toLowerCase())||{}).team_name||'':'';
    s.manOfTheMatch=d?.man_of_the_match?`${motmTeam}|||${d.man_of_the_match}`:'';
    const info={
      referee:d?.referee||'',
      venue:d?.venue||'',
      stadium:d?.venue||'',
      attendance:d?.attendance??'',
      halftimeHomeScore:d?.halftime_home_score??'',
      halftimeAwayScore:d?.halftime_away_score??'',
      addedTime:d?.added_time??0,
      kickoff:f?.kickoff||'',
      weather:d?.weather||'',
      notes:d?.notes||''
    };
    s.matchInfo={...(s.matchInfo||{}),...info};
    s.matchDetails={...(s.matchDetails||{}),...info};
    s.stats={...(s.stats||{}),possession:{h:Number(st?.home_possession)||0,a:Number(st?.away_possession)||0},shots:{h:Number(st?.home_shots)||0,a:Number(st?.away_shots)||0},sot:{h:Number(st?.home_shots_on_target)||0,a:Number(st?.away_shots_on_target)||0},corners:{h:Number(st?.home_corners)||0,a:Number(st?.away_corners)||0},cornerGoals:{h:Number(st?.home_corner_goals)||0,a:Number(st?.away_corner_goals)||0},fouls:{h:Number(st?.home_fouls)||0,a:Number(st?.away_fouls)||0},offsides:{h:Number(st?.home_offsides)||0,a:Number(st?.away_offsides)||0},saves:{h:Number(st?.home_saves)||0,a:Number(st?.away_saves)||0}};
  });
  f.homeScore=m.home_score;f.awayScore=m.away_score;
}
function fixtureFromOpenPanel(){
  const box=document.getElementById('fixtureDetail');
  const id=Number(box?.dataset?.fixtureId);
  if(!box||!box.classList.contains('open')||!Number.isFinite(id)||typeof ALL_FIXTURES==='undefined')return null;
  return ALL_FIXTURES.find(x=>Number(x.id)===id)||null;
}
function getAuthoritativeInfo(fixtureId){
  const bundle=authoritativeFixtures.get(String(fixtureId));
  if(!bundle)return null;
  const d=bundle.d||{};
  return {
    referee:d.referee||'',
    attendance:d.attendance??'',
    venue:d.venue||'',
    stadium:d.venue||'',
    kickoff:'',
    weather:d.weather||'',
    halftimeHomeScore:d.halftime_home_score??'',
    halftimeAwayScore:d.halftime_away_score??'',
    addedTime:d.added_time??0,
    notes:d.notes||'',
    manOfTheMatch:d.man_of_the_match||''
  };
}
function setInput(id,value){
  const el=document.getElementById(id);if(!el)return;
  const v=value===undefined||value===null?'':String(value);
  if(el.value!==v)el.value=v;
}
function ensureSelect(select,value,label){
  if(!select||value===undefined||value===null||String(value)==='')return;
  const wanted=String(value);
  let opt=[...select.options].find(o=>o.value===wanted);
  if(!opt){opt=new Option(label||wanted,wanted,true,true);opt.dataset.savedFallback='1';select.insertBefore(opt,select.firstChild);}
  select.value=wanted;
}
function reassertOpenFixture(){
  const f=fixtureFromOpenPanel();if(!f)return false;
  const bundle=authoritativeFixtures.get(String(f.id));if(!bundle)return false;
  applyMatch(f,bundle.m,bundle.d,bundle.st,bundle.lineups,bundle.subs,bundle.events);
  return true;
}
function fillOpenPanelDirect(){
  const f=fixtureFromOpenPanel();if(!f)return;
  const bundle=authoritativeFixtures.get(String(f.id));if(!bundle)return;
  const d=bundle.d||{};
  setInput('rrReferee',d.referee||'');
  setInput('rrAttendance',d.attendance??'');
  setInput('rrVenue',d.venue||'');
  setInput('rrHtHome',d.halftime_home_score??'');
  setInput('rrHtAway',d.halftime_away_score??'');
  setInput('rrAddedTime',d.added_time??0);
  setInput('rrWeather',d.weather||'');
  setInput('rrMatchNotes',d.notes||'');
  const motm=d.man_of_the_match||'';
  if(motm){
    const row=(bundle.lineups||[]).find(x=>norm(x.player_name).toLowerCase()===norm(motm).toLowerCase());
    const team=row?.team_name||f.home;
    ensureSelect(document.getElementById('manOfTheMatch'),`${team}|||${motm}`,`Saved • ${motm} — ${team}`);
  }
}
function refreshOpenFixture(){
  try{
    const box=document.getElementById('fixtureDetail');
    if(!box||!box.classList.contains('open'))return;
    reassertOpenFixture();
    if(window.NL4RecordRoomMatchInfo){
      window.NL4RecordRoomMatchInfo.inject?.();
      window.NL4RecordRoomMatchInfo.restoreSavedSelections?.();
    }
    fillOpenPanelDirect();
  }catch(e){console.warn('[NL4 V39] Authoritative open-fixture refresh skipped',e);}
}
function scheduleOpenRefresh(){[0,60,160,320,700,1200].forEach(ms=>setTimeout(refreshOpenFixture,ms));}
function postHydrationRefresh(){
  [0,80,220,500,900].forEach(ms=>setTimeout(()=>{
    try{if(typeof render==='function')render();}catch(_){ }
    refreshOpenFixture();
  },ms));
}
async function bulkHydrate(){
  if(flight)return flight;
  flight=(async()=>{
    const c=client();
    if(!c)throw new Error('Supabase client unavailable');
    if(typeof ALL_FIXTURES==='undefined'||typeof db==='undefined')throw new Error('Record Room runtime not ready');
    marker('BUILD V39 • SUPABASE CONNECTING • BULK LOAD…');
    const matches=await withTimeout(c.from('premier_league_matches').select('id,matchday,home_team,away_team,home_score,away_score,status').eq('season',SEASON).in('status',['FULL_TIME','fulltime']).not('home_score','is',null).not('away_score','is',null),12000,'Match list');
    if(matches.error)throw matches.error;
    const completed=matches.data||[];
    const ids=completed.map(x=>x.id);
    if(!ids.length)throw new Error('No completed matches returned');
    const all=await withTimeout(Promise.all([
      c.from('record_room_match_details').select('*').in('match_id',ids),
      c.from('record_room_match_stats').select('*').in('match_id',ids),
      c.from('record_room_lineups').select('*').in('match_id',ids),
      c.from('record_room_substitutions').select('*').in('match_id',ids),
      c.from('record_room_events').select('*').in('match_id',ids),
      c.from('record_room_players').select('*').eq('season',SEASON)
    ]),18000,'Record Room bulk data');
    const bad=all.find(r=>r?.error);if(bad?.error)throw bad.error;
    const [details,stats,lineups,subs,events,players]=all;
    const dm=new Map((details.data||[]).map(r=>[String(r.match_id),r]));
    const sm=new Map((stats.data||[]).map(r=>[String(r.match_id),r]));
    const lm=byMatch(lineups.data),um=byMatch(subs.data),em=byMatch(events.data);
    authoritativeFixtures.clear();
    let imported=0;
    for(const m of completed){
      const f=ALL_FIXTURES.find(x=>x.home===m.home_team&&x.away===m.away_team&&Number(x.mw)===Number(m.matchday));
      if(!f)continue;
      const k=String(m.id);
      const bundle={m,d:dm.get(k)||{},st:sm.get(k)||{},lineups:lm.get(k)||[],subs:um.get(k)||[],events:em.get(k)||[]};
      authoritativeFixtures.set(String(f.id),bundle);
      applyMatch(f,bundle.m,bundle.d,bundle.st,bundle.lineups,bundle.subs,bundle.events);imported++;
    }
    (players.data||[]).forEach(r=>{
      const p=db?.[r.club]?.players?.find(x=>norm(x.name).toLowerCase()===norm(r.player_name).toLowerCase());
      if(p)Object.assign(p,{appearances:r.appearances||0,starts:r.starts||0,minutes:r.minutes||0,goals:r.goals||0,assists:r.assists||0,cleanSheets:r.clean_sheets||0,yellowCards:r.yellow_cards||0,redCards:r.red_cards||0,mom:r.man_of_the_match||0,shots:r.shots||0,shotsOnTarget:r.shots_on_target||0,chancesCreated:r.chances_created||0,tackles:r.tackles||0,interceptions:r.interceptions||0,saves:r.saves||0});
    });
    try{if(typeof recalculateClubStatsFromFixtures==='function'&&typeof TEAMS!=='undefined')TEAMS.forEach(t=>recalculateClubStatsFromFixtures(t));}catch(e){console.warn('[NL4 V39] Club recalc skipped',e);}
    try{if(typeof render==='function')render();}catch(e){console.warn('[NL4 V39] Render skipped',e);}
    postHydrationRefresh();
    lastImported=imported;
    document.documentElement.dataset.rrSupabaseHydrated=String(imported);
    marker(`BUILD V39 • SUPABASE LIVE • ${imported} MATCHES HYDRATED • AUTHORITATIVE OPEN FIXTURE • HISTORY PRESERVED`);
    console.info('[NL4 Record Room] V39 authoritative mobile hydration complete',imported);
    return {ok:true,imported};
  })().catch(error=>{
    marker(`BUILD V39 • SUPABASE ERROR • ${String(error?.message||error).slice(0,80)}`);
    console.error('[NL4 Record Room] V39 bulk hydration failed',error);
    throw error;
  }).finally(()=>{flight=null;});
  return flight;
}
function install(){
  const authority=window.NL4RecordRoomSupabaseAuthority;
  const ready=authority&&client()&&typeof ALL_FIXTURES!=='undefined'&&typeof db!=='undefined';
  if(!ready){attempts++;if(attempts<80)setTimeout(install,250);return;}
  authority.hydrate=bulkHydrate;
  bulkHydrate().catch(()=>{});
  if(!document.documentElement.dataset.rrV39OpenWatch){
    document.documentElement.dataset.rrV39OpenWatch='1';
    document.addEventListener('click',e=>{if(e.target.closest?.('.fixture-open'))scheduleOpenRefresh();},true);
    document.addEventListener('touchend',e=>{if(e.target.closest?.('.fixture-open'))scheduleOpenRefresh();},true);
    window.addEventListener('pageshow',scheduleOpenRefresh);
    window.addEventListener('focus',scheduleOpenRefresh);
  }
  const el=document.getElementById('buildMarker');
  if(el)new MutationObserver(()=>{if(lastImported!==null&&!String(el.textContent||'').includes('BUILD V39'))el.textContent=`BUILD V39 • SUPABASE LIVE • ${lastImported} MATCHES HYDRATED • AUTHORITATIVE OPEN FIXTURE • HISTORY PRESERVED`;}).observe(el,{childList:true,subtree:true,characterData:true});
}
window.NL4RecordRoomBulkMobileHydrateV39={hydrate:bulkHydrate,refreshOpenFixture,getAuthoritativeInfo,version:'39-authoritative-meta-source'};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});else setTimeout(install,0);
})();