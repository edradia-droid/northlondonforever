const cleanTeam=team=>String(team||'').replace(/\\s+(FC|AFC)$/i,'').trim();
const esc=v=>String(v??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const logo=(team,url)=>url?'<img class="team-logo" src="'+esc(url)+'" alt="'+esc(team)+' crest" loading="lazy" onerror="this.style.display=\'none\'">':'<span class="club-dot">'+esc(String(team||'').slice(0,3).toUpperCase())+'</span>';
const state=f=>{const s=String(f.status||'scheduled').toLowerCase().replace(/[_\s]+/g,'-');if(['fulltime','full-time','finished','ft','aet','pen','completed','ended'].includes(s))return{label:'FULL TIME',done:true,live:false};if(['live','1h','ht','2h','et','in-progress','inprogress','in-play','playing','half-time','halftime','extra-time'].includes(s))return{label:'LIVE',done:false,live:true};return{label:'UPCOMING',done:false,live:false}};
let arsenalFixtures=[];
function renderFixtures(){
 const el=document.getElementById('arsenalUclFixtures');if(!el)return;
 if(!arsenalFixtures.length){el.innerHTML='<div class="ucl-loading">No Champions League fixtures are available from BSD yet.</div>';return;}
 el.innerHTML=arsenalFixtures.map(f=>{
  const left=cleanTeam(f.home_team),right=cleanTeam(f.away_team),home=left.toLowerCase()==='arsenal',s=state(f);
  const d=f.kickoff_at?new Date(f.kickoff_at):null;
  const date=d&&!Number.isNaN(d.getTime())?d.toLocaleDateString([],{day:'2-digit',month:'short',year:'numeric'}).toUpperCase():'DATE TBC';
  const time=d&&!Number.isNaN(d.getTime())?d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'TBA';
  const centre=s.done?'<span>FULL TIME</span><strong class="ucl-score">'+Number(f.home_score)+'–'+Number(f.away_score)+'</strong><small>Champions League</small>':s.live?'<span>LIVE</span><strong class="ucl-score">'+(f.home_score??'—')+'–'+(f.away_score??'—')+'</strong><small>Champions League</small>':'<span>'+esc(time)+'</span><strong>VS</strong><small>Champions League</small>';
  return '<article class="ucl-fixture '+(home?'arsenal-home ':'')+(s.done?'completed':'')+'"><div class="fixture-top"><span>MD'+esc(f.matchday)+' • '+esc(date)+'</span><span class="fixture-status'+(s.done?' fulltime':'')+(s.live?' live':'')+'">'+s.label+'</span></div><div class="fixture-match"><div class="fixture-team">'+logo(left,f.home_crest_url)+'<b>'+esc(left)+'</b><small>HOME</small></div><div class="fixture-centre">'+centre+'</div><div class="fixture-team">'+logo(right,f.away_crest_url)+'<b>'+esc(right)+'</b><small>AWAY</small></div></div><div class="fixture-bottom ucl-fixture-bottom"><div class="ucl-fixture-caption"><span>'+esc(left)+' vs '+esc(right)+'</span><span>2026/27</span></div><div class="ucl-fixture-actions"><a class="ucl-action ucl-action-details" href="match-details.html?fixture='+encodeURIComponent(f.id)+'">More Details →</a></div></div></article>';
 }).join('');
}
function renderTable(rows){
 const body=document.getElementById('uclTableBody');if(!body)return;
 const fail='Standings temporarily withheld because the source data failed validation.';
 if(!Array.isArray(rows)||rows.length!==36){body.innerHTML='<tr><td colspan="10">'+fail+'</td></tr>';return;}
 const names=new Set();
 for(const r of rows){
  const team=String(r.team_name||'').trim().toLowerCase();
  const fields=['position','played','wins','draws','losses','goals_for','goals_against','goal_difference','points'];
  if(!team||names.has(team)||fields.some(k=>r[k]===null||r[k]===undefined||!Number.isFinite(Number(r[k])))){body.innerHTML='<tr><td colspan="10">'+fail+'</td></tr>';return;}
  names.add(team);
  const played=Number(r.played),w=Number(r.wins),d=Number(r.draws),l=Number(r.losses),gf=Number(r.goals_for),ga=Number(r.goals_against),gd=Number(r.goal_difference),pts=Number(r.points);
  if(played!==w+d+l||pts!==w*3+d||gd!==gf-ga){body.innerHTML='<tr><td colspan="10">'+fail+'</td></tr>';return;}
 }
 body.innerHTML=rows.map(r=>'<tr class="'+(String(r.team_name).toLowerCase()==='arsenal'?'arsenal-row':'')+'"><td>'+esc(r.position)+'</td><td class="club-cell"><div class="club-wrap"><span class="club-dot">'+esc(String(r.team_name||'').slice(0,3).toUpperCase())+'</span><span>'+esc(r.team_name)+'</span></div></td><td>'+esc(r.played)+'</td><td>'+esc(r.wins)+'</td><td>'+esc(r.draws??0)+'</td><td>'+esc(r.losses)+'</td><td>'+esc(r.goals_for)+'</td><td>'+esc(r.goals_against)+'</td><td>'+((Number(r.goal_difference)>0?'+':'')+esc(r.goal_difference))+'</td><td>'+esc(r.points)+'</td></tr>').join('');
 const status=document.querySelector('.ucl-table-status'),last=rows.map(r=>r.source_updated_at).filter(Boolean).sort().pop(),derived=rows.some(r=>r.source==='BSD-results-derived');if(status)status.textContent=(derived?'Live table calculated from BSD match results':'Official BSD standings')+(last?' • updated '+new Date(last).toLocaleString():'');
}
function styles(){const s=document.createElement('style');s.textContent='.ucl-fixture-bottom{display:block!important;padding-top:13px!important}.ucl-fixture-caption{display:flex;justify-content:space-between}.ucl-fixture-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.ucl-action{display:inline-flex;padding:8px 11px;border-radius:9px;text-decoration:none;font-size:9px;font-weight:1000}.ucl-action-details{color:#d8ad45;border:1px solid rgba(216,173,69,.38)}.fixture-status.fulltime{color:#8df0b2}.ucl-score{width:auto!important;padding:0 13px!important;border-radius:14px!important}@media(max-width:600px){.ucl-action{flex:1}}';document.head.appendChild(s)}
let syncRunning=false;
async function sync(){
 if(syncRunning)return;
 const db=window.nl4Supabase;
 if(!db){console.warn('NL4 UCL: Supabase client unavailable; retrying after client load');setTimeout(sync,250);return;}
 syncRunning=true;
 try{
  const [fixturesResult,standingsResult]=await Promise.all([
   db.from('fixtures').select('id,matchday,status,kickoff_at,venue,home_team,away_team,home_score,away_score,home_crest_url,away_crest_url,source').eq('season','2026/27').eq('competition','UEFA Champions League').eq('source','BSD').or('home_team.ilike.%Arsenal%,away_team.ilike.%Arsenal%').order('matchday',{ascending:true}),
   db.from('ucl_standings').select('position,team_name,played,wins,draws,losses,goals_for,goals_against,goal_difference,points,source,source_updated_at').eq('season','2026/27').eq('stage','league-phase').in('source',['BSD','BSD-results-derived']).order('position',{ascending:true})
  ]);
  if(fixturesResult.error)throw fixturesResult.error;
  arsenalFixtures=(fixturesResult.data||[]).map(r=>({...r,home_team:cleanTeam(r.home_team),away_team:cleanTeam(r.away_team)}));
  renderFixtures();
  if(standingsResult.error)throw standingsResult.error;
  renderTable(standingsResult.data||[]);
 }catch(e){console.warn('NL4 UCL BSD data sync:',e)}finally{syncRunning=false;}
}
document.addEventListener('DOMContentLoaded',()=>{styles();sync();setTimeout(sync,1000);setTimeout(sync,2500);setInterval(sync,30000);});
