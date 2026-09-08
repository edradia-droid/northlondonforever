// NL4 Record Room — Supabase single-authority persistence layer
(function(){
'use strict';
if(window.__NL4_RR_SUPABASE_AUTHORITY__)return;
window.__NL4_RR_SUPABASE_AUTHORITY__=true;
const SEASON='2026/27';
const STORAGE_KEY='nl4_other_19_stats_v9_direct_roster';
const clone=v=>JSON.parse(JSON.stringify(v));
const norm=v=>String(v||'').trim();
const split=v=>{const p=String(v||'').split('|||');return {team:norm(p.shift()),name:norm(p.join('|||'))};};
const nullable=v=>(v===null||v===undefined||v==='')?null:Number(v);
let memoryShadow=null;

// Keep legacy Record Room call sites working without persisting Record Room data in browser storage.
try{
  const proto=Storage.prototype;
  if(!proto.__nl4RrAuthorityPatched){
    const nativeGet=proto.getItem,nativeSet=proto.setItem,nativeRemove=proto.removeItem;
    Object.defineProperty(proto,'__nl4RrAuthorityPatched',{value:true});
    proto.getItem=function(key){if(key===STORAGE_KEY)return memoryShadow;return nativeGet.call(this,key);};
    proto.setItem=function(key,value){if(key===STORAGE_KEY){memoryShadow=String(value);return;}return nativeSet.call(this,key,value);};
    proto.removeItem=function(key){if(key===STORAGE_KEY){memoryShadow=null;try{return nativeRemove.call(this,key);}catch(_){return;}}return nativeRemove.call(this,key);};
    try{nativeRemove.call(localStorage,STORAGE_KEY);}catch(_){ }
  }
}catch(e){console.warn('[NL4 Record Room] Could not disable Record Room browser persistence',e);}

function client(){return window.nl4Supabase||window.supabaseClient||window.supabaseDb||null;}
function baseReset(){
  try{
    if(typeof defaultData==='function'){
      const fresh=defaultData();
      if(typeof db==='object'&&db){Object.keys(db).forEach(k=>delete db[k]);Object.assign(db,fresh);}else{window.db=fresh;try{db=fresh;}catch(_){}}
      return true;
    }
  }catch(e){console.warn('[NL4 Record Room] Default-state reset failed',e);}
  return false;
}
function ensureFixture(team,f){
  if(!db?.[team])return null;
  db[team].fixtureData=db[team].fixtureData||{};
  if(!db[team].fixtureData[f.id])db[team].fixtureData[f.id]={homeScore:null,awayScore:null,homeLineup:Array(11).fill(''),awayLineup:Array(11).fill(''),homeSubs:[],awaySubs:[],events:[],stats:{},matchDetails:{}};
  return db[team].fixtureData[f.id];
}
function playerRows(){
  const rows=[]; if(typeof TEAMS==='undefined'||typeof db==='undefined')return rows;
  TEAMS.forEach(club=>(db[club]?.players||[]).forEach(p=>rows.push({season:SEASON,club,player_name:p.name,position:p.position||null,shirt_number:p.number??null,appearances:Number(p.appearances)||0,starts:Number(p.starts)||0,minutes:Number(p.minutes)||0,goals:Number(p.goals)||0,assists:Number(p.assists)||0,clean_sheets:Number(p.cleanSheets)||0,yellow_cards:Number(p.yellowCards)||0,red_cards:Number(p.redCards)||0,man_of_the_match:Number(p.mom)||0,shots:Number(p.shots)||0,shots_on_target:Number(p.shotsOnTarget)||0,chances_created:Number(p.chancesCreated)||0,tackles:Number(p.tackles)||0,interceptions:Number(p.interceptions)||0,saves:Number(p.saves)||0,updated_at:new Date().toISOString()})));
  return rows;
}
async function savePlayers(){
  const c=client();if(!c)return {ok:false,error:new Error('Supabase unavailable')};
  const rows=playerRows();if(!rows.length)return {ok:true};
  const r=await c.from('record_room_players').upsert(rows,{onConflict:'season,club,player_name'});
  return {ok:!r.error,error:r.error||null};
}
async function resolveMatch(f){
  const c=client();if(!c||!f)return null;
  const q=await c.from('premier_league_matches').select('id,matchday,home_team,away_team,home_score,away_score,status').eq('season',SEASON).eq('home_team',f.home).eq('away_team',f.away).limit(2);
  if(q.error||!q.data?.length)return null;
  return q.data.find(x=>Number(x.matchday)===Number(f.mw))||q.data[0];
}
function lineupRows(f,s){
  const rows=[];const add=(team,lineup,subs)=>{const outMap=new Map((subs||[]).map(x=>[norm(x.out).toLowerCase(),x]));(lineup||[]).filter(Boolean).forEach((name,i)=>{const sub=outMap.get(norm(name).toLowerCase());rows.push({team_name:team,player_name:name,is_starter:true,minute_on:0,minute_off:sub&&Number.isFinite(Number(sub.outMin))?Number(sub.outMin):null,pitch_slot:String(i+1)});});(subs||[]).filter(x=>x.in).forEach(x=>rows.push({team_name:team,player_name:x.in,is_starter:false,minute_on:Number(x.inMin??x.outMin)||0,minute_off:null}));};add(f.home,s.homeLineup,s.homeSubs);add(f.away,s.awayLineup,s.awaySubs);return rows;
}
function substitutionRows(f,s){const rows=[];const add=(team,subs)=>(subs||[]).forEach(x=>{if(x.out&&x.in)rows.push({team_name:team,player_out:x.out,player_in:x.in,minute:Number(x.inMin??x.outMin)||0});});add(f.home,s.homeSubs);add(f.away,s.awaySubs);return rows;}
function eventRows(s){return (s.events||[]).map(ev=>{const p=split(ev.player),a=split(ev.assist);return {team_name:p.team,event_type:ev.type==='yellow'?'yellow_card':ev.type==='red'?'red_card':'goal',player_name:p.name,related_player_name:a.name||null,minute:Number(ev.minute)||0};}).filter(x=>x.team_name&&x.player_name);}
function payload(f,s){const md=s.matchDetails||{},motm=split(s.manOfTheMatch),st=s.stats||{},val=(k,side)=>Number(st?.[k]?.[side])||0;return {details:{referee:norm(md.referee)||null,venue:norm(md.venue)||null,attendance:nullable(md.attendance),man_of_the_match:motm.name||null,halftime_home_score:nullable(md.halftimeHomeScore),halftime_away_score:nullable(md.halftimeAwayScore),added_time:Math.max(0,Math.min(30,Number(md.addedTime)||0)),source:'NL4 Record Room',source_updated_at:new Date().toISOString()},stats:{home_possession:val('possession','h'),away_possession:val('possession','a'),home_shots:val('shots','h'),away_shots:val('shots','a'),home_shots_on_target:val('sot','h'),away_shots_on_target:val('sot','a'),home_corners:val('corners','h'),away_corners:val('corners','a'),home_corner_goals:val('cornerGoals','h'),away_corner_goals:val('cornerGoals','a'),home_fouls:val('fouls','h'),away_fouls:val('fouls','a'),home_offsides:val('offsides','h'),away_offsides:val('offsides','a'),home_saves:val('saves','h'),away_saves:val('saves','a')},lineups:lineupRows(f,s),substitutions:substitutionRows(f,s),events:eventRows(s)};}
async function replaceRows(table,matchId,rows){const c=client();let r=await c.from(table).delete().eq('match_id',matchId);if(r.error)throw r.error;if(rows.length){r=await c.from(table).insert(rows.map(x=>({...x,match_id:matchId})));if(r.error)throw r.error;}}
async function saveFixture(f,s){
  const c=client();if(!c)return {ok:false,error:new Error('Supabase unavailable')};
  const match=await resolveMatch(f);if(!match)return {ok:false,error:new Error('Could not resolve Supabase match')};
  const p=payload(f,s);const stamp=new Date().toISOString();
  let r=await c.from('record_room_match_details').upsert({...p.details,match_id:match.id,updated_at:stamp},{onConflict:'match_id'});if(r.error)return {ok:false,error:r.error};
  r=await c.from('record_room_match_stats').upsert({...p.stats,match_id:match.id,updated_at:stamp},{onConflict:'match_id'});if(r.error)return {ok:false,error:r.error};
  try{await replaceRows('record_room_lineups',match.id,p.lineups);await replaceRows('record_room_substitutions',match.id,p.substitutions);await replaceRows('record_room_events',match.id,p.events);}catch(error){return {ok:false,error};}
  const pr=await savePlayers();if(!pr.ok)return pr;
  return {ok:true,matchId:match.id};
}
function applyMatch(f,match,d,st,lineups,subs,events){
  const homeXI=lineups.filter(x=>x.team_name===f.home&&x.is_starter).sort((a,b)=>(Number(a.pitch_slot)||99)-(Number(b.pitch_slot)||99)).map(x=>x.player_name);const awayXI=lineups.filter(x=>x.team_name===f.away&&x.is_starter).sort((a,b)=>(Number(a.pitch_slot)||99)-(Number(b.pitch_slot)||99)).map(x=>x.player_name);const mapSubs=team=>subs.filter(x=>x.team_name===team).map(x=>({out:x.player_out,in:x.player_in,outMin:Number(x.minute)||0,inMin:Number(x.minute)||0}));const mappedEvents=events.map(x=>({type:x.event_type==='yellow_card'?'yellow':x.event_type==='red_card'?'red':'goal',player:`${x.team_name}|||${x.player_name}`,assist:x.related_player_name?`${x.team_name}|||${x.related_player_name}`:'',minute:Number(x.minute)||0}));
  [f.home,f.away].forEach(team=>{const s=ensureFixture(team,f);if(!s)return;s.homeScore=match.home_score;s.awayScore=match.away_score;s.homeLineup=[...homeXI,...Array(Math.max(0,11-homeXI.length)).fill('')].slice(0,11);s.awayLineup=[...awayXI,...Array(Math.max(0,11-awayXI.length)).fill('')].slice(0,11);s.homeSubs=mapSubs(f.home);s.awaySubs=mapSubs(f.away);s.events=mappedEvents;s.manOfTheMatch=d?.man_of_the_match?`${(lineups.find(x=>x.player_name===d.man_of_the_match)||{}).team_name||''}|||${d.man_of_the_match}`:'';s.matchDetails={...(s.matchDetails||{}),referee:d?.referee||'',venue:d?.venue||'',attendance:d?.attendance??'',halftimeHomeScore:d?.halftime_home_score??'',halftimeAwayScore:d?.halftime_away_score??'',addedTime:d?.added_time??0};s.stats={...(s.stats||{}),possession:{h:Number(st?.home_possession)||0,a:Number(st?.away_possession)||0},shots:{h:Number(st?.home_shots)||0,a:Number(st?.away_shots)||0},sot:{h:Number(st?.home_shots_on_target)||0,a:Number(st?.away_shots_on_target)||0},corners:{h:Number(st?.home_corners)||0,a:Number(st?.away_corners)||0},cornerGoals:{h:Number(st?.home_corner_goals)||0,a:Number(st?.away_corner_goals)||0},fouls:{h:Number(st?.home_fouls)||0,a:Number(st?.away_fouls)||0},offsides:{h:Number(st?.home_offsides)||0,a:Number(st?.away_offsides)||0},saves:{h:Number(st?.home_saves)||0,a:Number(st?.away_saves)||0}};});f.homeScore=match.home_score;f.awayScore=match.away_score;
}
async function hydrate(){
  const c=client();if(!c||typeof ALL_FIXTURES==='undefined'||typeof db==='undefined')return {ok:false};
  baseReset();
  const matches=await c.from('premier_league_matches').select('id,matchday,home_team,away_team,home_score,away_score,status').eq('season',SEASON).in('status',['FULL_TIME','fulltime']).not('home_score','is',null).not('away_score','is',null);
  if(matches.error)return {ok:false,error:matches.error};
  let imported=0;
  for(const m of matches.data||[]){const f=ALL_FIXTURES.find(x=>x.home===m.home_team&&x.away===m.away_team&&Number(x.mw)===Number(m.matchday));if(!f)continue;const [d,st,li,su,ev]=await Promise.all([c.from('record_room_match_details').select('*').eq('match_id',m.id).maybeSingle(),c.from('record_room_match_stats').select('*').eq('match_id',m.id).maybeSingle(),c.from('record_room_lineups').select('*').eq('match_id',m.id),c.from('record_room_substitutions').select('*').eq('match_id',m.id),c.from('record_room_events').select('*').eq('match_id',m.id)]);if([d,st,li,su,ev].some(x=>x.error))continue;applyMatch(f,m,d.data||{},st.data||{},li.data||[],su.data||[],ev.data||[]);imported++;}
  const pr=await c.from('record_room_players').select('*').eq('season',SEASON);if(!pr.error)(pr.data||[]).forEach(r=>{const p=db?.[r.club]?.players?.find(x=>norm(x.name).toLowerCase()===norm(r.player_name).toLowerCase());if(p)Object.assign(p,{appearances:r.appearances||0,starts:r.starts||0,minutes:r.minutes||0,goals:r.goals||0,assists:r.assists||0,cleanSheets:r.clean_sheets||0,yellowCards:r.yellow_cards||0,redCards:r.red_cards||0,mom:r.man_of_the_match||0,shots:r.shots||0,shotsOnTarget:r.shots_on_target||0,chancesCreated:r.chances_created||0,tackles:r.tackles||0,interceptions:r.interceptions||0,saves:r.saves||0});});
  try{if(typeof TEAMS!=='undefined'&&typeof recalculateClubStatsFromFixtures==='function')TEAMS.forEach(t=>recalculateClubStatsFromFixtures(t));if(typeof render==='function')render();}catch(e){console.warn('[NL4 Record Room] Render/recalc after Supabase hydrate failed',e);}
  memoryShadow=JSON.stringify(db);
  const marker=document.getElementById('buildMarker');if(marker)marker.textContent='BUILD V34 • SUPABASE SINGLE AUTHORITY • LOCAL STORAGE DISABLED • HISTORY PRESERVED';
  console.info(`[NL4 Record Room] Supabase authority hydrated ${imported} completed matches.`);
  return {ok:true,imported};
}
async function saveOpenFixture(){const box=document.getElementById('fixtureDetail');const id=Number(box?.dataset?.fixtureId);const f=(typeof ALL_FIXTURES!=='undefined'?ALL_FIXTURES:[]).find(x=>Number(x.id)===id);if(!f)return;const s=db?.[f.home]?.fixtureData?.[f.id]||db?.[f.away]?.fixtureData?.[f.id];if(!s)return;const state=document.getElementById('fixtureSaveState');if(state){state.style.color='#d8ad45';state.textContent='SAVING TO SUPABASE…';}const r=await saveFixture(f,s);if(r.ok){if(state){state.style.color='#49d17d';state.textContent='SUPABASE CONFIRMED';setTimeout(()=>{if(state)state.textContent='';},3000);}window.dispatchEvent(new CustomEvent('nl4:record-room-supabase-confirmed',{detail:{fixtureId:id,matchId:r.matchId}}));}else{if(state){state.style.color='#ff5f6d';state.textContent='SUPABASE SAVE FAILED';}console.error('[NL4 Record Room] Supabase authoritative save failed',r.error);}}
function start(){hydrate().catch(e=>console.error('[NL4 Record Room] Supabase authoritative hydrate failed',e));document.addEventListener('click',e=>{const b=e.target.closest?.('button');if(!b)return;if(b.classList.contains('detail-save')||/SAVE MATCH DETAILS/i.test(b.textContent||''))setTimeout(()=>saveOpenFixture(),80);},true);document.getElementById('savePlayer')?.addEventListener('click',()=>setTimeout(()=>savePlayers().catch(console.error),80));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.NL4RecordRoomSupabaseAuthority={hydrate,saveFixture,savePlayers,saveOpenFixture,version:'20260908-v1'};
})();