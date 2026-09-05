(() => {
'use strict';
const SEASON='2026/27', ARSENAL='Arsenal';
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const clone=v=>JSON.parse(JSON.stringify(v));
function arsenalData(){try{return typeof db!=='undefined'&&db?.[ARSENAL]?db[ARSENAL]:null}catch(_){return null}}
function arsenalFixtures(){try{return typeof ALL_FIXTURES!=='undefined'?ALL_FIXTURES.filter(f=>f.home===ARSENAL||f.away===ARSENAL):[]}catch(_){return []}}
function ensureCanonicalArsenalFixtures(){const a=arsenalData();if(!a)return 0;a.fixtureData=a.fixtureData||{};let copied=0;arsenalFixtures().forEach(f=>{const candidates=[];const own=a.fixtureData?.[f.id];if(own)candidates.push(own);const opponent=f.home===ARSENAL?f.away:f.home;const opp=typeof db!=='undefined'?db?.[opponent]?.fixtureData?.[f.id]:null;if(opp)candidates.push(opp);if(!candidates.length)return;candidates.sort((x,y)=>String(y?.updatedAt||'').localeCompare(String(x?.updatedAt||'')));const latest=candidates[0];if(!own||String(latest?.updatedAt||'')>String(own?.updatedAt||'')){a.fixtureData[f.id]=clone(latest);copied++;}});return copied;}
function completedCount(){const a=arsenalData();if(!a)return 0;return arsenalFixtures().filter(f=>{const s=a.fixtureData?.[f.id];return s&&s.homeScore!==null&&s.homeScore!==undefined&&s.awayScore!==null&&s.awayScore!==undefined;}).length;}
function playerPayload(p,stamp){return {season:SEASON,player_name:p.name,position:p.position||null,appearances:n(p.appearances),starts:n(p.starts),minutes:n(p.minutes),goals:n(p.goals),assists:n(p.assists),clean_sheets:n(p.cleanSheets),yellow_cards:n(p.yellowCards),red_cards:n(p.redCards),man_of_the_match:n(p.mom),shots:n(p.shots),shots_on_target:n(p.shotsOnTarget),chances_created:n(p.chancesCreated),tackles:n(p.tackles),interceptions:n(p.interceptions),saves:n(p.saves),updated_at:stamp};}
async function push(){
 const client=window.nl4Supabase;if(!client)return {skipped:true,reason:'no-client'};
 const current=arsenalData();if(!current)return {skipped:true,reason:'no-arsenal-data'};
 const copied=ensureCanonicalArsenalFixtures();
 try{if(typeof recalculatePlayerStatsFromFixtures==='function')recalculatePlayerStatsFromFixtures(ARSENAL)}catch(e){console.warn('[NL4] Arsenal player recalc failed',e)}
 try{if(typeof recalculateClubStatsFromFixtures==='function')recalculateClubStatsFromFixtures(ARSENAL)}catch(e){console.warn('[NL4] Arsenal club recalc failed',e)}
 const completed=completedCount(),stamp=new Date().toISOString(),c=current.club||{};
 const team={season:SEASON,matches:n(c.matches),avg_possession:n(c.avgPossession),total_shots:n(c.totalShots),shots_on_target:n(c.shotsOnTarget),corners:n(c.corners),corner_goals:n(c.cornerGoals),fouls:n(c.fouls),offsides:n(c.offsides),yellow_cards:n(c.yellowCards),red_cards:n(c.redCards),points:n(c.points),updated_at:stamp};
 if(team.matches!==completed)console.warn('[NL4] Arsenal aggregate mismatch',{clubMatches:team.matches,completedFixtures:completed,copied});
 // Team and player writes are deliberately independent. A player-table policy/error must never leave the public team card half stale.
 const teamWrite=await client.from('record_room_arsenal_team_stats').upsert(team,{onConflict:'season'}).select().maybeSingle();
 if(teamWrite.error)console.error('[NL4] Arsenal TEAM sync failed:',teamWrite.error);else console.info('[NL4] Arsenal TEAM sync saved',teamWrite.data||team);
 const players=(current.players||[]).filter(p=>p?.name).map(p=>playerPayload(p,stamp));
 let playerError=null;
 if(players.length){const result=await client.from('premier_league_player_stats').upsert(players,{onConflict:'season,player_name'}).select('player_name,updated_at');playerError=result.error;if(playerError)console.error('[NL4] Arsenal PLAYER sync failed:',playerError);else console.info('[NL4] Arsenal PLAYER sync saved',result.data?.length||players.length);}
 try{if(typeof persist==='function')persist()}catch(_){}
 const detail={players:players.length,team,completedFixtures:completed,copiedFixtures:copied,teamError:teamWrite.error?.message||null,playerError:playerError?.message||null};
 window.dispatchEvent(new CustomEvent('nl4:record-room-arsenal-public-synced',{detail}));
 if(teamWrite.error||playerError)throw new Error(`Arsenal public sync incomplete. Team: ${teamWrite.error?.message||'OK'}; Players: ${playerError?.message||'OK'}`);
 console.info('[NL4] Arsenal Record Room public sync complete',detail);return detail;
}
let timer=null;function queue(delay=250){clearTimeout(timer);timer=setTimeout(()=>push().catch(err=>console.error('[NL4] Arsenal public sync failed:',err)),delay)}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.classList.contains('detail-save')||/SAVE MATCH DETAILS/i.test(b.textContent||''))queue(120);},true);
window.addEventListener('nl4:record-room-saved',()=>queue(80));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>queue(800),{once:true});else queue(800);
window.NL4RecordRoomArsenalPublicSync={push,queue,ensureCanonicalArsenalFixtures,completedCount};
})();