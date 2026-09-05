(() => {
'use strict';
const SEASON='2026/27', ARSENAL='Arsenal';
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const clone=v=>JSON.parse(JSON.stringify(v));
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
function arsenalData(){try{return typeof db!=='undefined'&&db?.[ARSENAL]?db[ARSENAL]:null}catch(_){return null}}
function arsenalFixtures(){try{return typeof ALL_FIXTURES!=='undefined'?ALL_FIXTURES.filter(f=>f.home===ARSENAL||f.away===ARSENAL):[]}catch(_){return []}}
function ensureCanonicalArsenalFixtures(){
 const a=arsenalData(); if(!a)return 0; a.fixtureData=a.fixtureData||{}; let copied=0;
 arsenalFixtures().forEach(f=>{
   const candidates=[];
   const own=a.fixtureData?.[f.id]; if(own)candidates.push(own);
   const opponent=f.home===ARSENAL?f.away:f.home;
   const opp=typeof db!=='undefined'?db?.[opponent]?.fixtureData?.[f.id]:null; if(opp)candidates.push(opp);
   if(!candidates.length)return;
   candidates.sort((x,y)=>String(y?.updatedAt||'').localeCompare(String(x?.updatedAt||'')));
   const latest=candidates[0];
   if(!own || String(latest?.updatedAt||'')>String(own?.updatedAt||'')){a.fixtureData[f.id]=clone(latest);copied++;}
 });
 return copied;
}
function completedCount(){const a=arsenalData();if(!a)return 0;return arsenalFixtures().filter(f=>{const s=a.fixtureData?.[f.id];return s&&s.homeScore!==null&&s.homeScore!==undefined&&s.awayScore!==null&&s.awayScore!==undefined;}).length;}
function playerPayload(p){return {season:SEASON,player_name:p.name,position:p.position||null,appearances:n(p.appearances),starts:n(p.starts),minutes:n(p.minutes),goals:n(p.goals),assists:n(p.assists),clean_sheets:n(p.cleanSheets),yellow_cards:n(p.yellowCards),red_cards:n(p.redCards),man_of_the_match:n(p.mom),shots:n(p.shots),shots_on_target:n(p.shotsOnTarget),chances_created:n(p.chancesCreated),tackles:n(p.tackles),interceptions:n(p.interceptions),saves:n(p.saves),updated_at:new Date().toISOString()};}
async function push(){
 const client=window.nl4Supabase;if(!client)return {skipped:true,reason:'no-client'};
 const current=arsenalData();if(!current)return {skipped:true,reason:'no-arsenal-data'};
 const copied=ensureCanonicalArsenalFixtures();
 try{if(typeof recalculatePlayerStatsFromFixtures==='function')recalculatePlayerStatsFromFixtures(ARSENAL)}catch(e){console.warn('[NL4] Arsenal player recalc failed',e)}
 try{if(typeof recalculateClubStatsFromFixtures==='function')recalculateClubStatsFromFixtures(ARSENAL)}catch(e){console.warn('[NL4] Arsenal club recalc failed',e)}
 const completed=completedCount();
 const players=(current.players||[]).filter(p=>p?.name).map(playerPayload);
 if(players.length){const {error}=await client.from('premier_league_player_stats').upsert(players,{onConflict:'season,player_name'});if(error)throw error;}
 const c=current.club||{};
 const team={season:SEASON,matches:n(c.matches),avg_possession:n(c.avgPossession),total_shots:n(c.totalShots),shots_on_target:n(c.shotsOnTarget),corners:n(c.corners),corner_goals:n(c.cornerGoals),fouls:n(c.fouls),offsides:n(c.offsides),yellow_cards:n(c.yellowCards),red_cards:n(c.redCards),points:n(c.points),updated_at:new Date().toISOString()};
 if(team.matches!==completed){console.warn('[NL4] Arsenal aggregate mismatch',{clubMatches:team.matches,completedFixtures:completed,copied});}
 const {error}=await client.from('record_room_arsenal_team_stats').upsert(team,{onConflict:'season'});if(error)throw error;
 try{if(typeof persist==='function')persist()}catch(_){}
 const detail={players:players.length,team,completedFixtures:completed,copiedFixtures:copied};
 window.dispatchEvent(new CustomEvent('nl4:record-room-arsenal-public-synced',{detail}));
 console.info('[NL4] Arsenal Record Room public sync complete',detail);return detail;
}
let timer=null;function queue(delay=250){clearTimeout(timer);timer=setTimeout(()=>push().catch(err=>console.error('[NL4] Arsenal public sync failed:',err)),delay)}
// Native V9 save is inline. Capture the SAVE MATCH DETAILS click, then run after its handler has mirrored/persisted the fixture.
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.classList.contains('detail-save')||/SAVE MATCH DETAILS/i.test(b.textContent||''))queue(50);},true);
window.addEventListener('nl4:record-room-saved',()=>queue(50));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>queue(800),{once:true});else queue(800);
window.NL4RecordRoomArsenalPublicSync={push,queue,ensureCanonicalArsenalFixtures,completedCount};
})();