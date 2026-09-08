// NL4 Record Room — V39 bulk mobile Supabase hydration
(function(){
'use strict';
if(window.__NL4_RR_MOBILE_SUPABASE_RETRY__)return;
window.__NL4_RR_MOBILE_SUPABASE_RETRY__=true;
const SEASON='2026/27';
let flight=null;
let attempts=0;
let lastImported=null;

const norm=v=>String(v||'').trim();
const split=v=>{const p=String(v||'').split('|||');return {team:norm(p.shift()),name:norm(p.join('|||'))};};
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
  if(!db[team].fixtureData[f.id])db[team].fixtureData[f.id]={homeScore:null,awayScore:null,homeLineup:Array(11).fill(''),awayLineup:Array(11).fill(''),homeSubs:[],awaySubs:[],events:[],stats:{},matchDetails:{}};
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
    const motmTeam=d?.man_of_the_match?(lineups.find(x=>x.player_name===d.man_of_the_match)||{}).team_name||'':'';
    s.manOfTheMatch=d?.man_of_the_match?`${motmTeam}|||${d.man_of_the_match}`:'';
    s.matchDetails={...(s.matchDetails||{}),referee:d?.referee||'',venue:d?.venue||'',attendance:d?.attendance??'',halftimeHomeScore:d?.halftime_home_score??'',halftimeAwayScore:d?.halftime_away_score??'',addedTime:d?.added_time??0};
    s.stats={...(s.stats||{}),possession:{h:Number(st?.home_possession)||0,a:Number(st?.away_possession)||0},shots:{h:Number(st?.home_shots)||0,a:Number(st?.away_shots)||0},sot:{h:Number(st?.home_shots_on_target)||0,a:Number(st?.away_shots_on_target)||0},corners:{h:Number(st?.home_corners)||0,a:Number(st?.away_corners)||0},cornerGoals:{h:Number(st?.home_corner_goals)||0,a:Number(st?.away_corner_goals)||0},fouls:{h:Number(st?.home_fouls)||0,a:Number(st?.away_fouls)||0},offsides:{h:Number(st?.home_offsides)||0,a:Number(st?.away_offsides)||0},saves:{h:Number(st?.home_saves)||0,a:Number(st?.away_saves)||0}};
  });
  f.homeScore=m.home_score;f.awayScore=m.away_score;
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
    let imported=0;
    for(const m of completed){
      const f=ALL_FIXTURES.find(x=>x.home===m.home_team&&x.away===m.away_team&&Number(x.mw)===Number(m.matchday));
      if(!f)continue;
      const k=String(m.id);applyMatch(f,m,dm.get(k)||{},sm.get(k)||{},lm.get(k)||[],um.get(k)||[],em.get(k)||[]);imported++;
    }
    (players.data||[]).forEach(r=>{
      const p=db?.[r.club]?.players?.find(x=>norm(x.name).toLowerCase()===norm(r.player_name).toLowerCase());
      if(p)Object.assign(p,{appearances:r.appearances||0,starts:r.starts||0,minutes:r.minutes||0,goals:r.goals||0,assists:r.assists||0,cleanSheets:r.clean_sheets||0,yellowCards:r.yellow_cards||0,redCards:r.red_cards||0,mom:r.man_of_the_match||0,shots:r.shots||0,shotsOnTarget:r.shots_on_target||0,chancesCreated:r.chances_created||0,tackles:r.tackles||0,interceptions:r.interceptions||0,saves:r.saves||0});
    });
    try{if(typeof recalculateClubStatsFromFixtures==='function'&&typeof TEAMS!=='undefined')TEAMS.forEach(t=>recalculateClubStatsFromFixtures(t));}catch(e){console.warn('[NL4 V39] Club recalc skipped',e);}
    try{if(typeof render==='function')render();}catch(e){console.warn('[NL4 V39] Render skipped',e);}
    lastImported=imported;
    document.documentElement.dataset.rrSupabaseHydrated=String(imported);
    marker(`BUILD V39 • SUPABASE LIVE • ${imported} MATCHES HYDRATED • BULK MOBILE LOAD • HISTORY PRESERVED`);
    console.info('[NL4 Record Room] V39 bulk mobile hydration complete',imported);
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
  const el=document.getElementById('buildMarker');
  if(el)new MutationObserver(()=>{if(lastImported!==null&&!String(el.textContent||'').includes('BUILD V39'))el.textContent=`BUILD V39 • SUPABASE LIVE • ${lastImported} MATCHES HYDRATED • BULK MOBILE LOAD • HISTORY PRESERVED`;}).observe(el,{childList:true,subtree:true,characterData:true});
}
window.NL4RecordRoomBulkMobileHydrateV39={hydrate:bulkHydrate,version:'39'};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});else setTimeout(install,0);
})();