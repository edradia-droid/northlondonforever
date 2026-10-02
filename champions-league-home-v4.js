(function(){'use strict';
const theme=document.createElement('link');theme.rel='stylesheet';theme.href='champions-league-home-v2.css?v=20260911-1';document.head.appendChild(theme);
const db=window.nl4Supabase,$=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),complete=s=>['fulltime','finished','ft','aet','pen'].includes(String(s||'').toLowerCase());
const cleanTeam=team=>String(team||'').replace(/\\s+(FC|AFC)$/i,'').trim();
const crest=(team,url)=>url?'<img src="'+esc(url)+'" alt="'+esc(team)+' crest">':'<span class="ucl-club-fallback">'+esc(String(team||'').slice(0,3).toUpperCase())+'</span>';
function displayScore(f){return f.is_home?String(f.arsenal_score??'—')+'–'+String(f.opponent_score??'—'):String(f.opponent_score??'—')+'–'+String(f.arsenal_score??'—')}
function playerRows(players){
 const groups={Goalkeepers:[],Defenders:[],Midfielders:[],Forwards:[]};
 (players||[]).forEach(p=>{const pos=String(p.position||'').toUpperCase();const group=pos.includes('GK')||pos==='G'?'Goalkeepers':pos.includes('D')||pos.includes('DEF')?'Defenders':pos.includes('F')||pos.includes('FW')||pos.includes('ST')?'Forwards':'Midfielders';groups[group].push(p);});
 return Object.entries(groups).filter(([,rows])=>rows.length).map(([group,rows])=>'<tr class="ucl-position-row"><th colspan="12">'+group.toUpperCase()+' <span>'+rows.length+' ACTIVE</span></th></tr>'+rows.sort((a,b)=>Number(b.minutes||0)-Number(a.minutes||0)).map(p=>'<tr><td><strong>'+esc(p.player_name)+'</strong></td><td>'+esc(p.position||'—')+'</td><td>'+esc(p.appearances??0)+'</td><td>'+esc(p.starts??0)+'</td><td>'+esc(p.minutes??0)+'</td><td>'+esc(p.goals??0)+'</td><td>'+esc(p.assists??0)+'</td><td>'+esc(p.yellow_cards??0)+'</td><td>'+esc(p.red_cards??0)+'</td><td>'+esc(p.clean_sheets??0)+'</td><td>'+esc(p.saves??0)+'</td><td>'+esc(p.man_of_the_match??0)+'</td></tr>').join('')).join('');
}
async function load(){
 if(!db)return;
 const [fr,pr]=await Promise.all([
  db.from('fixtures').select('id,matchday,status,is_home,arsenal_score,opponent_score,kickoff_at,venue,home_team,away_team,opponent,home_crest_url,away_crest_url').eq('season','2026/27').eq('competition','UEFA Champions League').eq('source','BSD').order('matchday'),
  db.from('ucl_player_stats').select('*').eq('season','2026/27').eq('team_name','Arsenal')
 ]);
 if(fr.error||pr.error){console.warn('NL4 UCL home:',fr.error||pr.error);return}
 const fixtures=(fr.data||[]).map(f=>({...f,home_team:cleanTeam(f.home_team),away_team:cleanTeam(f.away_team),opponent:cleanTeam(f.opponent)}));
 const next=fixtures.find(f=>!complete(f.status)&&f.arsenal_score==null&&f.opponent_score==null);
 if(next){const home=next.home_team,away=next.away_team,d=new Date(next.kickoff_at);$('uclNextCard').innerHTML='<div class="ucl-next-top"><span>UEFA CHAMPIONS LEAGUE • MATCHDAY '+esc(next.matchday)+'</span><b>UPCOMING</b></div><div class="ucl-next-main"><div class="ucl-next-team">'+crest(home,next.home_crest_url)+'<strong>'+esc(home)+'</strong><small>HOME</small></div><div class="ucl-next-centre"><span>'+d.toLocaleDateString([],{day:'2-digit',month:'short',year:'numeric'})+'</span><strong>VS</strong><b>'+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</b><small>'+esc(next.venue||'Venue TBC')+'</small></div><div class="ucl-next-team">'+crest(away,next.away_crest_url)+'<strong>'+esc(away)+'</strong><small>AWAY</small></div></div><div class="ucl-next-bottom"><span>THE NEXT EUROPEAN NIGHT</span><a href="match-details.html?fixture='+encodeURIComponent(next.id)+'">Upcoming match details →</a></div>'}else $('uclNextCard').innerHTML='<div class="ucl-empty">No upcoming Champions League match.</div>';
 const done=fixtures.filter(f=>complete(f.status)&&f.arsenal_score!=null&&f.opponent_score!=null).reverse();
 $('uclResults').innerHTML=done.length?done.map(f=>{const home=f.home_team,away=f.away_team,d=new Date(f.kickoff_at),outcome=Number(f.arsenal_score)>Number(f.opponent_score)?'WIN':Number(f.arsenal_score)<Number(f.opponent_score)?'LOSS':'DRAW';return '<article class="ucl-result-card ucl-card-'+outcome.toLowerCase()+'"><div class="ucl-result-meta"><span>MATCHDAY '+esc(f.matchday)+'</span><small>'+d.toLocaleDateString([],{day:'2-digit',month:'short',year:'numeric'})+'</small></div><div class="ucl-result-scoreline"><div class="ucl-result-team">'+crest(home,f.home_crest_url)+'<b>'+esc(home)+'</b></div><strong class="ucl-result-score">'+displayScore(f)+'</strong><div class="ucl-result-team away"><b>'+esc(away)+'</b>'+crest(away,f.away_crest_url)+'</div></div><div class="ucl-result-footer"><span class="ucl-result-outcome">ARSENAL '+outcome+'</span><a href="match-details.html?fixture='+encodeURIComponent(f.id)+'">Match details →</a></div></article>'}).join(''):'<div class="ucl-empty">No completed Champions League matches yet.</div>';
 $('uclPlayerStats').innerHTML=playerRows(pr.data||[])||'<tr><td colspan="11">No Arsenal Champions League player statistics are available from BSD yet.</td></tr>';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();