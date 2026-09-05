(() => {
  'use strict';
  const SEASON='2026/27';
  const n=v=>Number.isFinite(Number(v))?Number(v):0;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function setTeam(key,value){
    document.querySelectorAll(`[data-team-stat="${key}"]`).forEach(el=>el.textContent=value);
  }
  function setAvg(key,total,matches){
    document.querySelectorAll(`[data-team-avg="${key}"]`).forEach(el=>el.textContent=`${matches?(n(total)/matches).toFixed(1):'0.0'} / match`);
  }
  function renderTeam(row){
    if(!row) return;
    const m=n(row.matches);
    setTeam('matches',m); setTeam('possession',`${n(row.avg_possession).toFixed(1)}%`);
    setTeam('shots',n(row.total_shots)); setTeam('shots_on_target',n(row.shots_on_target));
    setTeam('corners',n(row.corners)); setTeam('corner_goals',n(row.corner_goals));
    setTeam('fouls',n(row.fouls)); setTeam('offsides',n(row.offsides));
    setTeam('yellow_cards',n(row.yellow_cards)); setTeam('red_cards',n(row.red_cards));
    setAvg('shots',row.total_shots,m); setAvg('shots_on_target',row.shots_on_target,m);
    setAvg('corners',row.corners,m); setAvg('fouls',row.fouls,m); setAvg('offsides',row.offsides,m);
    const s=document.getElementById('arsenalTeamSeasonStatsStatus');
    if(s) s.textContent='LIVE • SYNCHRONIZED FROM ARSENAL RECORD ROOM';
  }

  function renderPlayers(rows){
    const body=document.getElementById('arsenalPlayerStatsBody');
    if(!body || !rows?.length) return;
    const old=new Map([...body.querySelectorAll('tr[data-player]')].map(tr=>[String(tr.dataset.player||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),tr]));
    rows.forEach(p=>{
      const key=String(p.player_name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      const tr=old.get(key); if(!tr) return;
      const cells=tr.querySelectorAll('td');
      const vals=[p.appearances,p.starts,p.minutes,p.goals,p.assists,p.clean_sheets,p.yellow_cards,p.red_cards,p.man_of_the_match,p.shots,p.shots_on_target,p.chances_created,p.tackles,p.interceptions,p.saves];
      vals.forEach((v,i)=>{if(cells[i+1]) cells[i+1].textContent=n(v);});
    });
    const s=document.getElementById('arsenalPlayerStatsStatus');
    if(s) s.textContent='LIVE • SYNCHRONIZED FROM ARSENAL RECORD ROOM';
  }

  async function refresh(){
    const client=window.nl4Supabase; if(!client) return;
    const [teamRes,playerRes]=await Promise.all([
      client.from('record_room_arsenal_team_stats').select('*').eq('season',SEASON).maybeSingle(),
      client.from('premier_league_player_stats').select('*').eq('season',SEASON).order('player_name')
    ]);
    if(teamRes.error) console.warn('[NL4] Record Room team stats read failed:',teamRes.error); else renderTeam(teamRes.data);
    if(playerRes.error) console.warn('[NL4] Record Room player stats read failed:',playerRes.error); else renderPlayers(playerRes.data||[]);
  }

  window.NL4PremierLeagueRecordRoomSync={refresh};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(refresh,0),{once:true});
  else setTimeout(refresh,0);
  window.addEventListener('nl4:player-stats-synced',refresh);
})();