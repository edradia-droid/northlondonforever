(function(){
'use strict';
const SEASON='2026/27',COMP='UEFA Champions League';
const done=s=>['fulltime','finished','ft','aet','pen'].includes(String(s||'').toLowerCase());
const key=(team,player)=>`${team}\u0000${player}`;
const blankPlayer=(team,player,position='')=>({season:SEASON,team_name:team,player_name:player,position:position||null,appearances:0,starts:0,minutes:0,goals:0,assists:0,yellow_cards:0,red_cards:0,saves:0,man_of_the_match:0});
const blankTeam=team=>({season:SEASON,team_name:team,matches:0,wins:0,draws:0,losses:0,goals_for:0,goals_against:0,points:0,possession_total:0,shots:0,shots_on_target:0,corners:0,corner_goals:0,fouls:0,offsides:0,saves:0,yellow_cards:0,red_cards:0});
async function recalculateUclStats(client=window.nl4Supabase){
  if(!client)throw new Error('Supabase is unavailable.');
  const fixturesResult=await client.from('fixtures').select('*').eq('season',SEASON).eq('competition',COMP);
  if(fixturesResult.error)throw fixturesResult.error;
  const fixtures=(fixturesResult.data||[]).filter(f=>done(f.status)&&f.arsenal_score!=null&&f.opponent_score!=null);
  const ids=fixtures.map(f=>f.id); let lineups=[],events=[];
  if(ids.length){
    const [lr,er]=await Promise.all([client.from('match_lineups').select('*').in('fixture_id',ids),client.from('match_events').select('*').in('fixture_id',ids)]);
    if(lr.error)throw lr.error;if(er.error)throw er.error;lineups=lr.data||[];events=er.data||[];
  }
  const players=new Map(),teams=new Map();
  const player=(team,name,pos='')=>{const k=key(team,name);if(!players.has(k))players.set(k,blankPlayer(team,name,pos));const p=players.get(k);if(!p.position&&pos)p.position=pos;return p};
  const team=name=>{if(!teams.has(name))teams.set(name,blankTeam(name));return teams.get(name)};
  for(const f of fixtures){
    const home=f.home_team||(f.is_home?'Arsenal':f.opponent),away=f.away_team||(f.is_home?f.opponent:'Arsenal');
    const hs=f.is_home?Number(f.arsenal_score):Number(f.opponent_score),as=f.is_home?Number(f.opponent_score):Number(f.arsenal_score);
    const end=90+Math.max(0,Number(f.added_time)||0),sides=[[home,'home',hs,as],[away,'away',as,hs]];
    sides.forEach(([name,side,gf,ga])=>{const t=team(name);t.matches++;t.goals_for+=gf;t.goals_against+=ga;if(gf>ga){t.wins++;t.points+=3}else if(gf===ga){t.draws++;t.points++}else t.losses++;t.possession_total+=Number(f[side+'_possession'])||0;t.shots+=Number(f[side+'_shots'])||0;t.shots_on_target+=Number(f[side+'_shots_on_target'])||0;t.corners+=Number(f[side+'_corners'])||0;t.corner_goals+=Number(f[side+'_corner_goals'])||0;t.fouls+=Number(f[side+'_fouls'])||0;t.offsides+=Number(f[side+'_offsides'])||0;t.saves+=Number(f[side+'_saves'])||0;});
    const fl=lineups.filter(x=>x.fixture_id===f.id);
    fl.forEach(x=>{const tn=x.team_name||'Arsenal',p=player(tn,x.player_name,x.position);p.appearances++;if(x.is_starter)p.starts++;p.minutes+=Math.max(0,Math.min(end,Number(x.minute_off??end))-Math.max(0,Number(x.minute_on)||0));});
    sides.forEach(([tn,side])=>{const gk=fl.find(x=>(x.team_name||'Arsenal')===tn&&x.is_starter&&/^(gk|goalkeeper|keeper)$/i.test(String(x.position||'')));if(gk)player(tn,gk.player_name,gk.position).saves+=Number(f[side+'_saves'])||0;});
    const fe=events.filter(x=>x.fixture_id===f.id);
    const explicitAssists=new Set(fe.filter(x=>x.event_type==='assist').map(x=>`${x.team_name}\u0000${x.player_name}\u0000${x.minute??''}`));
    fe.forEach(e=>{const p=player(e.team_name,e.player_name);if(e.event_type==='goal')p.goals++;if(e.event_type==='assist')p.assists++;if(e.event_type==='yellow_card'){p.yellow_cards++;team(e.team_name).yellow_cards++}if(e.event_type==='red_card'){p.red_cards++;team(e.team_name).red_cards++}if(e.event_type==='goal'&&e.related_player_name&&!explicitAssists.has(`${e.team_name}\u0000${e.related_player_name}\u0000${e.minute??''}`))player(e.team_name,e.related_player_name).assists++;});
    if(f.man_of_the_match){const row=fl.find(x=>x.player_name===f.man_of_the_match);const event=fe.find(x=>x.player_name===f.man_of_the_match);const tn=row?.team_name||event?.team_name||(f.man_of_the_match_team||'Arsenal');player(tn,f.man_of_the_match,row?.position).man_of_the_match++;}
  }
  const stamp=new Date().toISOString();
  const old=await client.from('ucl_player_stats').select('team_name,player_name,position').eq('season',SEASON);if(old.error)throw old.error;
  (old.data||[]).forEach(x=>player(x.team_name,x.player_name,x.position));
  const playerRows=[...players.values()].map(x=>({...x,updated_at:stamp}));
  const teamRows=[...teams.values()].map(x=>({...x,updated_at:stamp}));
  if(playerRows.length){const r=await client.from('ucl_player_stats').upsert(playerRows,{onConflict:'season,team_name,player_name'});if(r.error)throw r.error;}
  if(teamRows.length){const r=await client.from('ucl_team_stats').upsert(teamRows,{onConflict:'season,team_name'});if(r.error)throw r.error;}
  return {matches:fixtures.length,players:playerRows.length,teams:teamRows.length};
}
window.recalculateUclStats=recalculateUclStats;
})();

const nl4PlayerAdminLoader=document.createElement('script');nl4PlayerAdminLoader.src='ucl-player-admin.js?v=20260911-1';document.head.appendChild(nl4PlayerAdminLoader);
