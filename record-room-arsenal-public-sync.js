(() => {
'use strict';
const SEASON='2026/27', ARSENAL='Arsenal';
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const clone=v=>JSON.parse(JSON.stringify(v));
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[Øø]/g,'o').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const isOdegaard=v=>norm(v).includes('odegaard');
const CORE_STAT_FIELDS=['appearances','starts','minutes','goals','assists','clean_sheets','yellow_cards','red_cards','man_of_the_match'];
const statSignal=row=>CORE_STAT_FIELDS.reduce((sum,key)=>sum+n(row?.[key]),0);
function arsenalData(){try{return typeof db!=='undefined'&&db?.[ARSENAL]?db[ARSENAL]:null}catch(_){return null}}
function arsenalFixtures(){try{return typeof ALL_FIXTURES!=='undefined'?ALL_FIXTURES.filter(f=>f.home===ARSENAL||f.away===ARSENAL):[]}catch(_){return []}}
function ensureCanonicalArsenalFixtures(){const a=arsenalData();if(!a)return 0;a.fixtureData=a.fixtureData||{};let copied=0;arsenalFixtures().forEach(f=>{const candidates=[];const own=a.fixtureData?.[f.id];if(own)candidates.push(own);const opponent=f.home===ARSENAL?f.away:f.home;const opp=typeof db!=='undefined'?db?.[opponent]?.fixtureData?.[f.id]:null;if(opp)candidates.push(opp);if(!candidates.length)return;candidates.sort((x,y)=>String(y?.updatedAt||'').localeCompare(String(x?.updatedAt||'')));const latest=candidates[0];if(!own||String(latest?.updatedAt||'')>String(own?.updatedAt||'')){a.fixtureData[f.id]=clone(latest);copied++;}});return copied;}
function completedCount(){const a=arsenalData();if(!a)return 0;return arsenalFixtures().filter(f=>{const s=a.fixtureData?.[f.id];return s&&s.homeScore!==null&&s.homeScore!==undefined&&s.awayScore!==null&&s.awayScore!==undefined;}).length;}
function playerPayload(p,stamp){return {season:SEASON,player_name:p.name,position:p.position||null,appearances:n(p.appearances),starts:n(p.starts),minutes:n(p.minutes),goals:n(p.goals),assists:n(p.assists),clean_sheets:n(p.cleanSheets),yellow_cards:n(p.yellowCards),red_cards:n(p.redCards),man_of_the_match:n(p.mom),shots:n(p.shots),shots_on_target:n(p.shotsOnTarget),chances_created:n(p.chancesCreated),tackles:n(p.tackles),interceptions:n(p.interceptions),saves:n(p.saves),updated_at:stamp};}
function applyStoredRow(local,stored){
 local.appearances=n(stored.appearances);local.starts=n(stored.starts);local.minutes=n(stored.minutes);local.goals=n(stored.goals);local.assists=n(stored.assists);local.cleanSheets=n(stored.clean_sheets);local.yellowCards=n(stored.yellow_cards);local.redCards=n(stored.red_cards);local.mom=n(stored.man_of_the_match);local.shots=n(stored.shots);local.shotsOnTarget=n(stored.shots_on_target);local.chancesCreated=n(stored.chances_created);local.tackles=n(stored.tackles);local.interceptions=n(stored.interceptions);local.saves=n(stored.saves);
}
async function hydrateFromSupabase({renderNow=true}={}){
 const client=window.nl4Supabase,current=arsenalData();
 if(!client||!current)return {skipped:true};
 const result=await client.from('premier_league_player_stats').select('*').eq('season',SEASON);
 if(result.error){console.warn('[NL4] Arsenal Record Room hydration failed:',result.error);return {error:result.error};}
 const rows=result.data||[];
 const storedByKey=new Map();
 rows.forEach(row=>{const key=norm(row.player_name);const prev=storedByKey.get(key);if(!prev||statSignal(row)>statSignal(prev))storedByKey.set(key,row);});
 (current.players||[]).forEach(local=>{
   const key=norm(local.name);
   let stored=storedByKey.get(key);
   if(!stored&&isOdegaard(local.name))stored=rows.filter(r=>isOdegaard(r.player_name)).sort((a,b)=>statSignal(b)-statSignal(a))[0];
   if(stored&&statSignal(stored)>=statSignal(playerPayload(local,''))){
     if(isOdegaard(local.name))local.name='Martin Ødegaard';
     applyStoredRow(local,stored);
   }
 });
 try{if(typeof persist==='function')persist()}catch(_){}
 if(renderNow){try{if(typeof render==='function')render()}catch(e){console.warn('[NL4] Arsenal Record Room render after hydration failed:',e)}}
 window.dispatchEvent(new CustomEvent('nl4:record-room-arsenal-hydrated',{detail:{rows:rows.length}}));
 return {rows:rows.length};
}
async function protectOdegaardFromZeroOverwrite(client,players,completed,stamp){
 if(!completed)return players;
 const candidate=players.find(p=>isOdegaard(p.player_name));
 if(!candidate||statSignal(candidate)>0)return players;
 const existing=await client.from('premier_league_player_stats').select('*').eq('season',SEASON);
 if(existing.error){console.warn('[NL4] Could not verify Ødegaard before player sync:',existing.error);return players;}
 const stored=(existing.data||[]).filter(p=>isOdegaard(p.player_name)).sort((a,b)=>statSignal(b)-statSignal(a))[0];
 if(!stored||statSignal(stored)<=0)return players;
 CORE_STAT_FIELDS.forEach(key=>{candidate[key]=n(stored[key]);});
 ['shots','shots_on_target','chances_created','tackles','interceptions','saves'].forEach(key=>{candidate[key]=n(stored[key]);});
 candidate.player_name='Martin Ødegaard';candidate.position=candidate.position||stored.position||'Midfielder';candidate.updated_at=stamp;
 return players;
}
async function push(){
 const client=window.nl4Supabase;if(!client)return {skipped:true,reason:'no-client'};
 const current=arsenalData();if(!current)return {skipped:true,reason:'no-arsenal-data'};
 try{window.NL4RecordRoomOdegaardCanonicalize?.run?.();}catch(e){console.warn('[NL4] Ødegaard canonicalizer pre-push failed',e)}
 const copied=ensureCanonicalArsenalFixtures();
 try{if(typeof recalculatePlayerStatsFromFixtures==='function')recalculatePlayerStatsFromFixtures(ARSENAL)}catch(e){console.warn('[NL4] Arsenal player recalc failed',e)}
 try{if(window.NL4RecordRoomPlayerMatchStats?.aggregateTeam)window.NL4RecordRoomPlayerMatchStats.aggregateTeam(ARSENAL)}catch(e){console.warn('[NL4] Arsenal advanced player stat recalc failed',e)}
 try{if(typeof recalculateClubStatsFromFixtures==='function')recalculateClubStatsFromFixtures(ARSENAL)}catch(e){console.warn('[NL4] Arsenal club recalc failed',e)}
 await hydrateFromSupabase({renderNow:false});
 const completed=completedCount(),stamp=new Date().toISOString(),c=current.club||{};
 const team={season:SEASON,matches:n(c.matches),avg_possession:n(c.avgPossession),total_shots:n(c.totalShots),shots_on_target:n(c.shotsOnTarget),corners:n(c.corners),corner_goals:n(c.cornerGoals),fouls:n(c.fouls),offsides:n(c.offsides),yellow_cards:n(c.yellowCards),red_cards:n(c.redCards),points:n(c.points),updated_at:stamp};
 const teamWrite=await client.from('record_room_arsenal_team_stats').upsert(team,{onConflict:'season'}).select().maybeSingle();
 let players=(current.players||[]).filter(p=>p?.name).map(p=>playerPayload(p,stamp));
 players=await protectOdegaardFromZeroOverwrite(client,players,completed,stamp);
 const odegaardPayload=players.find(p=>isOdegaard(p.player_name));const localOdegaard=(current.players||[]).find(p=>isOdegaard(p.name));if(odegaardPayload&&localOdegaard){localOdegaard.name='Martin Ødegaard';applyStoredRow(localOdegaard,odegaardPayload);}
 let playerError=null;
 if(players.length){const result=await client.from('premier_league_player_stats').upsert(players,{onConflict:'season,player_name'}).select('player_name,updated_at');playerError=result.error;}
 try{if(typeof persist==='function')persist();if(typeof render==='function')render()}catch(_){}
 const detail={players:players.length,team,completedFixtures:completed,copiedFixtures:copied,teamError:teamWrite.error?.message||null,playerError:playerError?.message||null};
 window.dispatchEvent(new CustomEvent('nl4:record-room-arsenal-public-synced',{detail}));
 if(teamWrite.error||playerError)throw new Error(`Arsenal public sync incomplete. Team: ${teamWrite.error?.message||'OK'}; Players: ${playerError?.message||'OK'}`);
 return detail;
}
let timer=null;function queue(delay=250){clearTimeout(timer);timer=setTimeout(()=>push().catch(err=>console.error('[NL4] Arsenal public sync failed:',err)),delay)}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.classList.contains('detail-save')||/SAVE MATCH DETAILS/i.test(b.textContent||''))queue(120);},true);
window.addEventListener('nl4:record-room-saved',()=>queue(80));
window.NL4RecordRoomArsenalPublicSync={push,queue,hydrateFromSupabase,ensureCanonicalArsenalFixtures,completedCount};
function bootstrap(src,key,onload){if(window[key]){onload?.();return;}const existing=[...document.scripts].find(s=>String(s.src||'').includes(src.split('?')[0]));if(existing){existing.addEventListener('load',()=>onload?.(),{once:true});return;}const s=document.createElement('script');s.src=src;s.async=false;s.onload=()=>onload?.();s.onerror=()=>console.error('[NL4] Failed to load',src);document.head.appendChild(s);}
function start(){
 bootstrap(`record-room-odegaard-canonicalize.js?v=20260908-canon1-${Date.now()}`,'NL4RecordRoomOdegaardCanonicalize',()=>{
   try{window.NL4RecordRoomOdegaardCanonicalize?.run?.();}catch(e){console.warn('[NL4] Ødegaard canonicalizer startup failed',e)}
   hydrateFromSupabase().finally(()=>queue(900));
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
bootstrap('record-room-player-match-stats.js?v=20260905-v5','NL4RecordRoomPlayerMatchStats',()=>setTimeout(()=>window.NL4RecordRoomPlayerMatchStats?.inject?.(),0));
bootstrap('record-room-match-meta.js?v=20260905-v1','NL4RecordRoomMatchInfo',()=>setTimeout(()=>window.NL4RecordRoomMatchInfo?.inject?.(),0));
bootstrap(`record-room-matchday-2026-09-05-06.js?v=20260908-mw3-${Date.now()}`,'NL4RecordRoomMatchday2026090506',()=>setTimeout(()=>window.NL4RecordRoomMatchday2026090506?.apply?.(),40));
bootstrap(`record-room-matchday-2026-09-05-06-corrections.js?v=20260908-city-${Date.now()}`,'NL4RecordRoomMW3CityCorrection',()=>setTimeout(()=>window.NL4RecordRoomMW3CityCorrection?.apply?.(),160));
bootstrap(`record-room-mw3-player-reconcile.js?v=20260908-player-${Date.now()}`,'NL4RecordRoomMW3PlayerReconcile',()=>setTimeout(()=>window.NL4RecordRoomMW3PlayerReconcile?.apply?.(),320));
})();