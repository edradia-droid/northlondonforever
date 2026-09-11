(function(){
'use strict';
const db=()=>window.nl4Supabase;
const p=new URLSearchParams(location.search);
let idx=Number(p.get('match'));
if(!Number.isInteger(idx)||idx<0||idx>7)idx=0;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eventLabels={goal:'GOAL',assist:'ASSIST',yellow_card:'YELLOW CARD',red_card:'RED CARD',own_goal:'OWN GOAL'};

function renderStats(f,home,away){
  const stats=[
    ['Possession',f.home_possession,f.away_possession,'%'],
    ['Shots',f.home_shots,f.away_shots,''],
    ['Shots on target',f.home_shots_on_target,f.away_shots_on_target,''],
    ['Corners',f.home_corners,f.away_corners,''],
    ['Fouls',f.home_fouls,f.away_fouls,''],
    ['Offsides',f.home_offsides,f.away_offsides,''],
    ['Saves',f.home_saves,f.away_saves,'']
  ].filter(x=>x[1]!=null||x[2]!=null);
  const box=document.getElementById('statisticsBox');
  if(!box)return;
  if(!stats.length){
    box.className='empty';
    box.textContent="Both teams' match statistics will appear here when recorded.";
    return;
  }
  box.className='';
  box.innerHTML=`<div class="stats-head"><strong>${esc(home)}</strong><span>STAT</span><strong>${esc(away)}</strong></div><div class="stats-list">${stats.map(x=>`<div class="stat-row"><strong>${x[1]??'—'}${x[1]!=null?x[3]:''}</strong><span>${esc(x[0])}</span><strong>${x[2]??'—'}${x[2]!=null?x[3]:''}</strong></div>`).join('')}</div>`;
}

function renderEvents(events,home,away){
  const box=document.getElementById('eventsBox');
  if(!box)return;
  if(!events.length){
    box.className='empty';
    box.textContent='Goals, assists, cards and own goals for both teams will appear here when recorded.';
    return;
  }
  box.className='events-list';
  box.innerHTML=events.map(event=>{
    const minute=event.minute==null?'—':`${event.minute}${event.stoppage_minute?`+${event.stoppage_minute}`:''}'`;
    const type=eventLabels[event.event_type]||String(event.event_type||'EVENT').replaceAll('_',' ').toUpperCase();
    const team=event.team_name||'—';
    let relation='';
    if(event.related_player_name){
      relation=event.event_type==='goal'?` • Assist: ${esc(event.related_player_name)}`:` • Related: ${esc(event.related_player_name)}`;
    }
    const side=team===home?'HOME':team===away?'AWAY':'';
    const cls=String(event.event_type||'').replaceAll('_','-');
    return `<div class="event-row ${esc(cls)}"><span class="event-minute">${minute}</span><div class="event-main"><strong>${esc(event.player_name||'Unknown player')}</strong><small>${esc(team)}${side?` • ${side}`:''}${relation}</small></div><span class="event-type">${esc(type)}</span></div>`;
  }).join('');
}

async function load(){
  const client=db();
  if(!client)return;
  const {data:f,error}=await client.from('fixtures').select('*').eq('season','2026/27').eq('competition','UEFA Champions League').eq('matchday',idx+1).maybeSingle();
  if(error||!f){if(error)console.warn(error);return;}
  const home=f.home_team||(f.is_home?'Arsenal':f.opponent);
  const away=f.away_team||(f.is_home?f.opponent:'Arsenal');
  const status=String(f.status||'scheduled').toLowerCase();
  const complete=['fulltime','finished','ft','aet','pen'].includes(status);
  document.getElementById('title').textContent=home+' vs '+away;
  document.getElementById('homeTeam').textContent=home;
  document.getElementById('awayTeam').textContent=away;
  document.getElementById('venue').textContent=f.venue||'TBC';
  document.getElementById('matchday').textContent='Matchday '+(f.matchday||idx+1);
  const d=new Date(f.kickoff_at);
  if(!Number.isNaN(d.getTime())){
    document.getElementById('date').textContent=d.toLocaleDateString([],{day:'2-digit',month:'short',year:'numeric'});
    document.getElementById('time').textContent=d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  }
  const statusEl=document.getElementById('status');
  statusEl.textContent=complete?'FULL TIME':status==='live'?'LIVE':'SCHEDULED';
  statusEl.className='pill'+(complete?' fulltime':status==='live'?' live':'');
  const score=document.getElementById('score');
  const mc=document.getElementById('matchCentre');
  const detailParts=[];
  if(complete&&f.arsenal_score!=null&&f.opponent_score!=null){
    const hs=f.is_home?f.arsenal_score:f.opponent_score;
    const as=f.is_home?f.opponent_score:f.arsenal_score;
    score.textContent=hs+' – '+as;
    document.getElementById('kickoff').textContent='FULL TIME';
    document.getElementById('predictionLink').style.display='none';
    detailParts.push(`<div><span>Full-time</span><strong>${esc(home)} ${hs} – ${as} ${esc(away)}</strong></div>`);
    if(f.halftime_arsenal_score!=null&&f.halftime_opponent_score!=null){
      const hh=f.is_home?f.halftime_arsenal_score:f.halftime_opponent_score;
      const ha=f.is_home?f.halftime_opponent_score:f.halftime_arsenal_score;
      detailParts.push(`<div><span>Half-time</span><strong>${hh} – ${ha}</strong></div>`);
    }
  }else if(!Number.isNaN(d.getTime())){
    document.getElementById('kickoff').textContent=d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  }
  if(f.referee)detailParts.push(`<div><span>Referee</span><strong>${esc(f.referee)}</strong></div>`);
  if(f.attendance!=null)detailParts.push(`<div><span>Attendance</span><strong>${Number(f.attendance).toLocaleString()}</strong></div>`);
  if(f.man_of_the_match)detailParts.push(`<div><span>Man of the Match</span><strong>${esc(f.man_of_the_match)}</strong></div>`);
  if(detailParts.length){mc.className='result-summary';mc.innerHTML=detailParts.join('');}

  renderStats(f,home,away);

  const {data:events,error:eventsError}=await client.from('match_events').select('*').eq('fixture_id',f.id).order('minute',{ascending:true,nullsFirst:false}).order('stoppage_minute',{ascending:true,nullsFirst:false});
  if(eventsError){
    console.warn('NL4 UCL match events:',eventsError);
    const box=document.getElementById('eventsBox');
    if(box){box.className='empty';box.textContent='Match events could not be loaded.';}
  }else renderEvents(events||[],home,away);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();