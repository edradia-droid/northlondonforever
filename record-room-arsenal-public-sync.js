(() => {
  'use strict';
  const SEASON='2026/27';
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const n=v=>Number.isFinite(Number(v))?Number(v):0;

  function arsenalData(){
    try{
      if(typeof db!=='undefined' && db?.Arsenal) return db.Arsenal;
    }catch(_){ }
    return null;
  }

  function playerPayload(p){
    return {
      season:SEASON,
      player_name:p.name,
      position:p.position||null,
      appearances:n(p.appearances), starts:n(p.starts), minutes:n(p.minutes),
      goals:n(p.goals), assists:n(p.assists), clean_sheets:n(p.cleanSheets),
      yellow_cards:n(p.yellowCards), red_cards:n(p.redCards),
      man_of_the_match:n(p.mom), shots:n(p.shots), shots_on_target:n(p.shotsOnTarget),
      chances_created:n(p.chancesCreated), tackles:n(p.tackles), interceptions:n(p.interceptions), saves:n(p.saves)
    };
  }

  async function push(){
    const client=window.nl4Supabase;
    const arsenal=arsenalData();
    if(!client || !arsenal) return {skipped:true};

    // Recalculate in memory first so Supabase receives the same values displayed in Record Room.
    try{ if(typeof recalculatePlayerStatsFromFixtures==='function') recalculatePlayerStatsFromFixtures('Arsenal'); }catch(_){ }
    try{ if(typeof recalculateClubStatsFromFixtures==='function') recalculateClubStatsFromFixtures('Arsenal'); }catch(_){ }

    const current=arsenalData();
    const players=(current?.players||[]).filter(p=>p?.name).map(playerPayload);
    if(players.length){
      const {error}=await client.from('premier_league_player_stats').upsert(players,{onConflict:'season,player_name'});
      if(error) throw error;
    }

    const c=current?.club||{};
    const team={
      season:SEASON,
      matches:n(c.matches), avg_possession:n(c.avgPossession), total_shots:n(c.totalShots),
      shots_on_target:n(c.shotsOnTarget), corners:n(c.corners), corner_goals:n(c.cornerGoals),
      fouls:n(c.fouls), offsides:n(c.offsides), yellow_cards:n(c.yellowCards), red_cards:n(c.redCards),
      points:n(c.points), updated_at:new Date().toISOString()
    };
    const {error:teamError}=await client.from('record_room_arsenal_team_stats').upsert(team,{onConflict:'season'});
    if(teamError) throw teamError;

    window.dispatchEvent(new CustomEvent('nl4:record-room-arsenal-public-synced',{detail:{players:players.length,team}}));
    return {players:players.length,team};
  }

  let timer=null;
  function queue(){
    clearTimeout(timer);
    timer=setTimeout(()=>push().catch(err=>console.warn('[NL4] Arsenal public sync failed:',err)),250);
  }

  // Native Record Room saves bubble through these controls. Queue after the native handler finishes.
  document.addEventListener('click',e=>{
    if(e.target.closest('.detail-save,#saveStats,#savePlayerStats,#saveClubStats')) queue();
  });
  window.addEventListener('nl4:record-room-saved',queue);
  window.NL4RecordRoomArsenalPublicSync={push,queue};
})();