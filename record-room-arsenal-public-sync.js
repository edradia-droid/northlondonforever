(() => {
  'use strict';
  const SEASON='2026/27';
  const n=v=>Number.isFinite(Number(v))?Number(v):0;
  function arsenalData(){try{return typeof db!=='undefined'&&db?.Arsenal?db.Arsenal:null}catch(_){return null}}
  function playerPayload(p){return {season:SEASON,player_name:p.name,position:p.position||null,appearances:n(p.appearances),starts:n(p.starts),minutes:n(p.minutes),goals:n(p.goals),assists:n(p.assists),clean_sheets:n(p.cleanSheets),yellow_cards:n(p.yellowCards),red_cards:n(p.redCards),man_of_the_match:n(p.mom),shots:n(p.shots),shots_on_target:n(p.shotsOnTarget),chances_created:n(p.chancesCreated),tackles:n(p.tackles),interceptions:n(p.interceptions),saves:n(p.saves)};}
  async function push(){
    const client=window.nl4Supabase;if(!client)return {skipped:true,reason:'no-client'};
    try{if(typeof recalculatePlayerStatsFromFixtures==='function')recalculatePlayerStatsFromFixtures('Arsenal')}catch(e){console.warn('[NL4] Arsenal player recalc failed',e)}
    try{if(typeof recalculateClubStatsFromFixtures==='function')recalculateClubStatsFromFixtures('Arsenal')}catch(e){console.warn('[NL4] Arsenal club recalc failed',e)}
    const current=arsenalData();if(!current)return {skipped:true,reason:'no-arsenal-data'};
    const players=(current.players||[]).filter(p=>p?.name).map(playerPayload);
    if(players.length){const {error}=await client.from('premier_league_player_stats').upsert(players,{onConflict:'season,player_name'});if(error)throw error;}
    const c=current.club||{};
    const team={season:SEASON,matches:n(c.matches),avg_possession:n(c.avgPossession),total_shots:n(c.totalShots),shots_on_target:n(c.shotsOnTarget),corners:n(c.corners),corner_goals:n(c.cornerGoals),fouls:n(c.fouls),offsides:n(c.offsides),yellow_cards:n(c.yellowCards),red_cards:n(c.redCards),points:n(c.points),updated_at:new Date().toISOString()};
    const {error}=await client.from('record_room_arsenal_team_stats').upsert(team,{onConflict:'season'});if(error)throw error;
    window.dispatchEvent(new CustomEvent('nl4:record-room-arsenal-public-synced',{detail:{players:players.length,team}}));
    console.info('[NL4] Arsenal Record Room synced to public stats',players.length,team);return {players:players.length,team};
  }
  let timer=null;function queue(delay=450){clearTimeout(timer);timer=setTimeout(()=>push().catch(err=>console.error('[NL4] Arsenal public sync failed:',err)),delay)}
  // The previous bridge guessed save button IDs. V9 creates fixture controls dynamically,
  // so sync after any Record Room data-edit click/change while Arsenal is involved.
  document.addEventListener('click',e=>{if(e.target.closest('button')&&arsenalData())queue()});
  document.addEventListener('change',e=>{if(e.target.matches('input,select')&&arsenalData())queue(650)});
  window.addEventListener('nl4:record-room-saved',()=>queue(100));
  // Establish the first durable Supabase snapshot as soon as the authenticated Record Room loads.
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>queue(900),{once:true});else queue(900);
  window.NL4RecordRoomArsenalPublicSync={push,queue};
})();