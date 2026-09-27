(function(){
'use strict';
const db=window.nl4Supabase,$=id=>document.getElementById(id);
const cfg=window.CUP_ADMIN||{};
const COMP=cfg.competition||'The FA Cup', LABEL=cfg.label||COMP, PAGE=cfg.page||'fa-cup.html';
let fixtures=[],current=null,lineups=[],events=[],lineupTeam='',editLineup=null,editEvent=null,roundFilter='all';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=id=>$(id)?.value??'', val=(id,v)=>{if($(id))$(id).value=v??''};
const num=id=>read(id)===''?null:Number(read(id));
const msg=(id,s,b=false)=>{if($(id)){ $(id).textContent=s; $(id).style.color=b?'#ff8993':'#8df0b2'; }};
const fields=[
 ['Possession %','home_possession','away_possession','0.1','100'],
 ['Shots','home_shots','away_shots','1','999'],
 ['Shots on target','home_shots_on_target','away_shots_on_target','1','999'],
 ['Corners','home_corners','away_corners','1','999'],
 ['Corner goals','home_corner_goals','away_corner_goals','1','999'],
 ['Fouls','home_fouls','away_fouls','1','999'],
 ['Offsides','home_offsides','away_offsides','1','999'],
 ['Saves','home_saves','away_saves','1','999']
];
const comparisonFields=[
 ['Matches','matches',1],['Wins','wins',1],['Draws','draws',1],['Losses','losses',1],
 ['Goals for','goals_for',1],['Goals against','goals_against',1],['Points','points',1],
 ['Average possession %','possession_average',0.1],['Shots','shots',1],['Shots on target','shots_on_target',1],
 ['Corners','corners',1],['Corner goals','corner_goals',1],['Fouls','fouls',1],['Offsides','offsides',1],
 ['Saves','saves',1],['Yellow cards','yellow_cards',1],['Red cards','red_cards',1]
];

function names(){
 const home=current?.home_team||(current?.is_home?'Arsenal':'');
 const away=current?.away_team||(current?.is_home?current?.opponent:'Arsenal');
 return {home:home||'Arsenal',away:away||current?.opponent||'Opponent'};
}
function buildRoundFilter(){
 const box=document.getElementById('roundFilter'); if(!box)return;
 const rounds=[...new Set(fixtures.map(f=>f.matchday).filter(v=>v!==null&&v!==undefined))].sort((a,b)=>a-b);
 box.innerHTML='<button type="button" data-round="all">ALL ROUNDS</button>'+rounds.map(r=>'<button type="button" data-round="'+esc(r)+'">ROUND '+esc(r)+'</button>').join('');
 box.querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.round===String(roundFilter));b.onclick=()=>{roundFilter=b.dataset.round;buildRoundFilter();renderFixtures();};});
}
function buildStats(){
 if(!$('stats'))return;
 $('stats').innerHTML=fields.map((x,i)=>'<div class="stat"><input id="sh'+i+'" type="number" min="0" max="'+x[4]+'" step="'+x[3]+'"><span>'+x[0]+'</span><input id="sa'+i+'" type="number" min="0" max="'+x[4]+'" step="'+x[3]+'"></div>').join('');
}
function renderFixtures(){
 const list=$('list'); if(!list)return;
 const shown=roundFilter==='all'?fixtures:fixtures.filter(f=>String(f.matchday)===String(roundFilter));
 list.innerHTML=shown.length?shown.map(f=>{const home=f.home_team||'Arsenal',away=f.away_team||f.opponent||'Opponent';const played=f.arsenal_score!==null&&f.arsenal_score!==undefined&&f.opponent_score!==null&&f.opponent_score!==undefined;const score=played?'<strong class="fixture-score">'+esc(f.arsenal_score)+' — '+esc(f.opponent_score)+'</strong>':'<strong class="fixture-score muted">VS</strong>';return '<article class="match"><div><div class="fixture-line"><strong>Round '+esc(f.matchday??'—')+' • '+esc(home)+' vs '+esc(away)+'</strong>'+score+'</div><div class="meta">'+(f.kickoff_at?new Date(f.kickoff_at).toLocaleString():'TBC')+' • '+esc(f.venue||'TBC')+' • '+esc(f.status||'scheduled')+'</div></div><button class="primary edit" data-fixture="'+f.id+'">Manage</button></article>'}).join(''):'<div class="empty">No '+esc(LABEL)+' fixtures match this round filter.</div>';
}
async function loadFixtures(){
 if(!db){$('list').textContent='Supabase client unavailable.';return}
 const r=await db.from('fixtures').select('id,matchday,home_team,away_team,kickoff_at,venue,status,is_home,opponent,arsenal_score,opponent_score').eq('season','2026/27').eq('competition',COMP).order('matchday').order('kickoff_at');
 if(r.error){$('list').textContent='Could not load fixtures: '+r.error.message;return}
 fixtures=r.data||[]; buildRoundFilter(); renderFixtures();
 if($('fixtureCount'))$('fixtureCount').textContent=fixtures.length+' FIXTURE'+(fixtures.length===1?'':'S');
}
async function createFixture(){
 const home=read('newHome').trim()||'Arsenal',away=read('newAway').trim();
 if(!away)return msg('createMsg','Enter the opponent.',true);
 const homeIsArsenal=home.toLowerCase()==='arsenal';
 const p={
   competition:COMP,season:'2026/27',matchday:num('newRound'),home_team:home,away_team:away,
   opponent:homeIsArsenal?away:home,is_home:homeIsArsenal,kickoff_at:read('newKickoff')?new Date(read('newKickoff')).toISOString():null,
   venue:read('newVenue').trim()||null,status:read('newStatus')||'scheduled',is_published:true,
   source:'NL4 Admin',updated_at:new Date().toISOString()
 };
 const r=await db.from('fixtures').insert(p).select('*').single();
 if(r.error)return msg('createMsg',r.error.message,true);
 msg('createMsg','Fixture created ✓'); ['newAway','newVenue','newKickoff','newRound'].forEach(x=>val(x,'')); val('newHome','Arsenal'); await loadFixtures(); openFixture(r.data.id);
}
async function fetchFixture(id){const r=await db.from('fixtures').select('*').eq('id',id).single();if(r.error)throw r.error;return r.data}
async function openFixture(id){
 try{current=await fetchFixture(id)}catch(e){alert('Could not load match: '+e.message);return}
 const n=names();
 $('editor').hidden=false;
 $('title').textContent='Round '+(current.matchday??'—')+' • '+n.home+' vs '+n.away;
 [['status',current.status],['kickoff',current.kickoff_at?new Date(current.kickoff_at).toISOString().slice(0,16):''],['venue',current.venue],['referee',current.referee],
 ['arsenalScore',current.arsenal_score],['opponentScore',current.opponent_score],['htArsenal',current.halftime_arsenal_score],
 ['htOpponent',current.halftime_opponent_score],['attendance',current.attendance],['addedTime',current.added_time],['motm',current.man_of_the_match]].forEach(x=>val(...x));
 $('motmTeam').innerHTML=$('eventTeam').innerHTML='<option value="'+esc(n.home)+'">'+esc(n.home)+'</option><option value="'+esc(n.away)+'">'+esc(n.away)+'</option>';
 const homeLabel=$('arsenalScore')?.closest('label'),awayLabel=$('opponentScore')?.closest('label'); if(homeLabel)homeLabel.firstChild.textContent=(current.home_team==='Arsenal'||current.away_team==='Arsenal')?'Arsenal score':'Home score'; if(awayLabel)awayLabel.firstChild.textContent=(current.home_team==='Arsenal'||current.away_team==='Arsenal')?'Opponent score':'Away score';
 val('motmTeam',current.man_of_the_match_team||n.home);
 $('statsHome').textContent=n.home;$('statsAway').textContent=n.away;
 fields.forEach((x,i)=>{val('sh'+i,current[x[1]]);val('sa'+i,current[x[2]])});
 $('preview').href=PAGE;
 lineupTeam=n.home;
 $('lineupTabs').innerHTML='<button data-team="'+esc(n.home)+'">'+esc(n.home)+'</button><button data-team="'+esc(n.away)+'">'+esc(n.away)+'</button>';
 resetLineup();resetEvent();tabs();
 $('editor').scrollIntoView({behavior:'smooth'});
 await Promise.all([loadLineups(),loadEvents(),loadComparison()]);
}
async function saveDetails(){
 const k=read('kickoff');
 const p={status:read('status'),kickoff_at:k?new Date(k).toISOString():null,venue:read('venue').trim()||null,referee:read('referee').trim()||null,
 arsenal_score:num('arsenalScore'),opponent_score:num('opponentScore'),halftime_arsenal_score:num('htArsenal'),halftime_opponent_score:num('htOpponent'),
 attendance:num('attendance'),added_time:num('addedTime')||0,man_of_the_match:read('motm').trim()||null,
 man_of_the_match_team:read('motm').trim()?read('motmTeam'):null,updated_at:new Date().toISOString()};
 const r=await db.from('fixtures').update(p).eq('id',current.id).select('*').single();
 if(r.error)return msg('detailsMsg',r.error.message,true); current=r.data; msg('detailsMsg','Match details saved ✓'); await loadFixtures();
}
async function saveStats(){
 const p={updated_at:new Date().toISOString()};
 fields.forEach((x,i)=>{p[x[1]]=num('sh'+i);p[x[2]]=num('sa'+i)});
 const r=await db.from('fixtures').update(p).eq('id',current.id).select('*').single();
 if(r.error)return msg('statsMsg',r.error.message,true);current=r.data;msg('statsMsg','Statistics saved ✓');
}
async function loadLineups(){
 const r=await db.from('match_lineups').select('*').eq('fixture_id',current.id).order('is_starter',{ascending:false}).order('minute_on');
 if(r.error)return msg('lineupMsg',r.error.message,true);lineups=r.data||[];renderLineups();
}
function renderLineups(){
 const a=lineups.filter(x=>(x.team_name||'')===lineupTeam);
 $('lineupList').innerHTML=a.length?a.map(x=>{
  const unused=!x.is_starter&&(!x.minute_on||Number(x.minute_on)===0);
  const time=unused?'UNUSED':(x.minute_on??0)+"'–"+(x.minute_off??(90+Number(current.added_time||0)))+"'";
  const display=!x.is_starter&&x.player_out_name?esc(x.player_out_name)+' → '+esc(x.player_name):esc(x.player_name);
  return '<div class="row"><strong>'+(x.is_starter?'STARTER':'SUB')+'</strong><div><b>'+display+'</b><small>'+esc(x.position||'')+' • '+time+'</small></div><div class="row-actions"><button data-le="'+x.id+'">Edit</button> <button class="danger" data-ld="'+x.id+'">Delete</button></div></div>';
 }).join(''):'<div class="empty">No lineup saved for this team.</div>';
 refreshOutgoingOptions();
}
function refreshOutgoingOptions(selected=''){
 const el=$('lineupPlayerOut');if(!el)return;
 const starters=lineups.filter(x=>x.team_name===lineupTeam&&x.is_starter);
 el.innerHTML='<option value="">Select player going out</option>'+starters.map(x=>'<option value="'+esc(x.player_name)+'">'+esc(x.player_name)+'</option>').join('');
 val('lineupPlayerOut',selected||'');
}
function tabs(){$('lineupTabs').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.team===lineupTeam));renderLineups()}
function resetLineup(){editLineup=null;val('lineupPlayer','');val('lineupPosition','Goalkeeper');val('lineupRole','true');val('lineupPlayerOut','');val('minuteOn',0);val('minuteOff','');$('lineupPlayerOut').disabled=true;$('saveLineup').textContent='Add Player';$('cancelLineup').hidden=true}
async function saveLineup(){
 const name=read('lineupPlayer').trim(),starter=read('lineupRole')==='true',playerOut=starter?null:(read('lineupPlayerOut').trim()||null);
 if(!name)return msg('lineupMsg','Enter a player name.',true);
 if(!starter&&!playerOut&&Number(num('minuteOn')??0)>0)return msg('lineupMsg','Select the player going out for this substitution.',true);
 const p={fixture_id:current.id,team_name:lineupTeam,player_name:name,position:read('lineupPosition'),is_starter:starter,minute_on:starter?0:(num('minuteOn')??0),minute_off:num('minuteOff'),player_out_name:playerOut,updated_at:new Date().toISOString()};
 const r=editLineup?await db.from('match_lineups').update(p).eq('id',editLineup):await db.from('match_lineups').upsert(p,{onConflict:'fixture_id,team_name,player_name'});
 if(r.error)return msg('lineupMsg',r.error.message,true);msg('lineupMsg','Lineup saved ✓');resetLineup();await loadLineups();
}
async function loadEvents(){
 const r=await db.from('match_events').select('*').eq('fixture_id',current.id).order('minute').order('stoppage_minute');
 if(r.error)return msg('eventMsg',r.error.message,true);events=r.data||[];
 $('eventsList').innerHTML=events.length?events.map(x=>'<div class="row"><strong>'+esc(x.event_type)+'</strong><div><b>'+esc(x.player_name)+'</b><small>'+esc(x.team_name)+' • '+(x.minute??'—')+(x.stoppage_minute?'+'+x.stoppage_minute:'')+"'"+(x.related_player_name?' • '+esc(x.related_player_name):'')+'</small></div><div class="row-actions"><button data-ee="'+x.id+'">Edit</button> <button class="danger" data-ed="'+x.id+'">Delete</button></div></div>').join(''):'<div class="empty">No events saved.</div>';
}
function resetEvent(){editEvent=null;['eventPlayer','eventMinute','eventStoppage','eventRelated'].forEach(x=>val(x,''));val('eventType','goal');$('saveEvent').textContent='Add Event';$('cancelEvent').hidden=true}
async function saveEvent(){
 const player=read('eventPlayer').trim();if(!player)return msg('eventMsg','Enter a player name.',true);
 const p={fixture_id:current.id,event_type:read('eventType'),player_name:player,team_name:read('eventTeam'),minute:num('eventMinute'),stoppage_minute:num('eventStoppage'),related_player_name:read('eventRelated').trim()||null,updated_at:new Date().toISOString()};
 const r=editEvent?await db.from('match_events').update(p).eq('id',editEvent):await db.from('match_events').insert(p);
 if(r.error)return msg('eventMsg',r.error.message,true);msg('eventMsg','Event saved ✓');resetEvent();await loadEvents();
}
$('list').onclick=e=>{const b=e.target.closest('[data-fixture]');if(b)openFixture(b.dataset.fixture)};
$('newFixtureBtn').onclick=createFixture;
$('close').onclick=()=>{$('editor').hidden=true};
$('saveDetails').onclick=saveDetails;$('saveStats').onclick=saveStats;$('saveLineup').onclick=saveLineup;$('cancelLineup').onclick=resetLineup;
$('saveEvent').onclick=saveEvent;$('cancelEvent').onclick=resetEvent;$('lineupTabs').onclick=e=>{const b=e.target.closest('[data-team]');if(b){lineupTeam=b.dataset.team;resetLineup();tabs()}};
$('lineupRole').onchange=()=>{$('lineupPlayerOut').disabled=read('lineupRole')==='true';if(read('lineupRole')==='true')val('lineupPlayerOut','')};
$('lineupList').onclick=async e=>{
 const eb=e.target.closest('[data-le]'),del=e.target.closest('[data-ld]');
 if(eb){const x=lineups.find(y=>y.id===eb.dataset.le);if(!x)return;editLineup=x.id;lineupTeam=x.team_name;val('lineupPlayer',x.player_name);val('lineupPosition',x.position||'Goalkeeper');val('lineupRole',String(x.is_starter));val('minuteOn',x.minute_on);val('minuteOff',x.minute_off);$('lineupPlayerOut').disabled=x.is_starter;refreshOutgoingOptions(x.player_out_name||'');$('saveLineup').textContent='Save Player';$('cancelLineup').hidden=false;tabs();return}
 if(del&&confirm('Delete this lineup entry?')){const r=await db.from('match_lineups').delete().eq('id',del.dataset.ld);if(r.error)return msg('lineupMsg',r.error.message,true);await loadLineups();msg('lineupMsg','Lineup entry deleted ✓')}
};
$('eventsList').onclick=async e=>{
 const eb=e.target.closest('[data-ee]'),del=e.target.closest('[data-ed]');
 if(eb){const x=events.find(y=>y.id===eb.dataset.ee);if(!x)return;editEvent=x.id;val('eventType',x.event_type);val('eventPlayer',x.player_name);val('eventTeam',x.team_name);val('eventMinute',x.minute);val('eventStoppage',x.stoppage_minute);val('eventRelated',x.related_player_name);$('saveEvent').textContent='Save Event';$('cancelEvent').hidden=false;return}
 if(del&&confirm('Delete this event?')){const r=await db.from('match_events').delete().eq('id',del.dataset.ed);if(r.error)return msg('eventMsg',r.error.message,true);await loadEvents();msg('eventMsg','Event deleted ✓')}
};
$('refreshFixtures').onclick=loadFixtures;
buildStats();loadFixtures();
})();