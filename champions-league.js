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
let uclCrests=new Map();
function teamCrest(team){
 const key=String(team||'').trim().toLocaleLowerCase(),url=uclCrests.get(key);
 return url?'<img class="ucl-table-crest" src="'+esc(url)+'" alt="" aria-hidden="true" loading="lazy" onerror="this.remove()">':'<span class="club-dot" aria-hidden="true">'+esc(String(team||'').slice(0,3).toUpperCase())+'</span>';
}
// Live match details are decorative only; standings values remain the validated BSD snapshot.
let uclLiveMatchByClub=new Map();
function uclClubKey(name){return String(name||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');}
function uclLiveClock(match){const s=String(match.status||'').toLowerCase().replace(/[\\s_-]+/g,'');if(s==='ht'||s==='halftime')return 'HT';const minute=Number(match.elapsed_minute),added=Number(match.stoppage_minute);if(Number.isInteger(minute)&&minute>=0)return String(minute)+(Number.isInteger(added)&&added>0?'+'+added:'')+"'";return '';}
function applyUclLiveMatchDetails(){const body=document.getElementById('uclTableBody'),head=document.getElementById('uclStatusHeader');if(!body)return;const hasLive=uclLiveMatchByClub.size>0;if(head)head.hidden=!hasLive;body.querySelectorAll('[data-ucl-status-cell]').forEach(cell=>{const m=uclLiveMatchByClub.get(cell.dataset.clubKey);cell.hidden=!hasLive;if(!m){cell.textContent='';return;}const clock=m.clock?'<small class="ucl-status-clock">'+esc(m.clock)+'</small>':'';cell.innerHTML='<span class="ucl-club-live-pill">LIVE</span><b class="ucl-home-away">'+m.venue+'</b>'+clock;});body.querySelectorAll('.ucl-club-name-wrap').forEach(w=>{const m=uclLiveMatchByClub.get(w.closest('[data-club-key]')?.dataset.clubKey),meta=w.querySelector('[data-ucl-live-meta]');if(!meta)return;meta.hidden=!m;if(!m){meta.textContent='';return;}const score=Number.isInteger(m.clubScore)&&Number.isInteger(m.opponentScore)?' · '+m.clubScore+'–'+m.opponentScore:'';meta.textContent='vs '+m.opponent+score;});}
async function loadUclLiveMatchDetails(){const db=window.nl4Supabase;if(!db||typeof db.from!=='function')return;try{const {data,error}=await db.from('ucl_matches').select('home_team,away_team,home_score,away_score,status,elapsed_minute,stoppage_minute,kickoff_at,source_updated_at').eq('season','2026/27').eq('stage','league-phase').eq('source','BSD');if(error)throw error;const next=new Map(),active=new Set(['live','1h','ht','2h','et','inplay','in-play','playing','halftime','extra-time','extratime','penalties','first-half','second-half','first_half','second_half']);(data||[]).forEach(m=>{if(!active.has(String(m.status||'').toLowerCase())||!m.home_team||!m.away_team)return;const scores=Number.isInteger(m.home_score)&&Number.isInteger(m.away_score),clock=uclLiveClock(m);next.set(uclClubKey(m.home_team),{opponent:m.away_team,venue:'H',clubScore:scores?m.home_score:null,opponentScore:scores?m.away_score:null,clock});next.set(uclClubKey(m.away_team),{opponent:m.home_team,venue:'A',clubScore:scores?m.away_score:null,opponentScore:scores?m.home_score:null,clock});});uclLiveMatchByClub=next;applyUclLiveMatchDetails();}catch(e){uclLiveMatchByClub=new Map();applyUclLiveMatchDetails();console.warn('NL4 UCL live match details unavailable:',e);}}
function renderTable(rows){
 const body=document.getElementById('uclTableBody');if(!body)return;
 const fail='Standings temporarily withheld because the source data failed validation.';
 if(!Array.isArray(rows)||rows.length!==36){body.innerHTML='<tr><td colspan="11">'+fail+'</td></tr>';return;}
 const names=new Set();
 for(const r of rows){
  const team=String(r.team_name||'').trim().toLowerCase();
  const fields=['position','played','wins','draws','losses','goals_for','goals_against','goal_difference','points'];
  if(!team||names.has(team)||fields.some(k=>r[k]===null||r[k]===undefined||!Number.isFinite(Number(r[k])))){body.innerHTML='<tr><td colspan="11">'+fail+'</td></tr>';return;}
  names.add(team);
  const played=Number(r.played),w=Number(r.wins),d=Number(r.draws),l=Number(r.losses),gf=Number(r.goals_for),ga=Number(r.goals_against),gd=Number(r.goal_difference),pts=Number(r.points);
  if(played!==w+d+l||pts!==w*3+d||gd!==gf-ga){body.innerHTML='<tr><td colspan="11">'+fail+'</td></tr>';return;}
 }
 body.innerHTML=rows.map(r=>{const key=uclClubKey(r.team_name);return '<tr class="'+(String(r.team_name).toLowerCase()==='arsenal'?'arsenal-row':'')+'"><td>'+esc(r.position)+'</td><td class="club-cell"><div class="ucl-club-name-wrap" data-club-key="'+esc(key)+'">'+teamCrest(r.team_name)+'<span class="ucl-club-name">'+esc(r.team_name)+'</span><small class="ucl-club-live-meta" data-ucl-live-meta hidden></small></div></td><td class="ucl-status-cell" data-ucl-status-cell data-club-key="'+esc(key)+'" hidden></td><td>'+esc(r.played)+'</td><td>'+esc(r.wins)+'</td><td>'+esc(r.draws??0)+'</td><td>'+esc(r.losses)+'</td><td>'+esc(r.goals_for)+'</td><td>'+esc(r.goals_against)+'</td><td>'+((Number(r.goal_difference)>0?'+':'')+esc(r.goal_difference))+'</td><td>'+esc(r.points)+'</td></tr>';}).join('');
 applyUclLiveMatchDetails();
 const status=document.querySelector('.ucl-table-status'),last=rows.map(r=>r.source_updated_at).filter(Boolean).sort().pop(),derived=rows.some(r=>r.source==='BSD-results-derived');if(status)status.textContent=(derived?'Live table calculated from BSD match results':'Official BSD standings')+(last?' • updated '+new Date(last).toLocaleString():'');
}
function styles(){const s=document.createElement('style');s.textContent='.ucl-club-name-wrap{display:grid;grid-template-columns:24px minmax(0,1fr);grid-template-rows:auto auto;align-items:center;column-gap:8px;row-gap:3px;min-width:0}.ucl-club-name{grid-column:2;grid-row:1;white-space:nowrap}.ucl-club-name-wrap>.ucl-table-crest{grid-column:1;grid-row:1}.ucl-status-cell{white-space:nowrap;vertical-align:middle}.ucl-status-cell:not([hidden]){display:table-cell}.ucl-status-cell .ucl-club-live-pill{display:inline-block;vertical-align:middle}.ucl-home-away{display:inline-block;margin-left:5px;color:#d8ad45;font-size:9px}.ucl-status-clock{display:block;margin-top:3px;color:#9fdcff;font-size:9px;font-weight:700}.ucl-club-live-meta{grid-column:1/-1;grid-row:2;padding-left:32px}.ucl-table-crest{width:24px;height:24px;object-fit:contain;flex:0 0 24px;display:block}.ucl-table .club-wrap{display:flex;align-items:center;gap:9px;min-width:0}.ucl-table .ucl-club-live-wrap{display:grid;grid-template-columns:38px 24px minmax(0,1fr);align-items:center;gap:9px}.ucl-live-slot{width:38px;min-width:38px;display:flex;align-items:center;justify-content:flex-start}.ucl-table .club-wrap>span:last-child{min-width:0}.ucl-fixture-bottom{display:block!important;padding-top:13px!important}.ucl-fixture-caption{display:flex;justify-content:space-between}.ucl-fixture-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.ucl-action{display:inline-flex;padding:8px 11px;border-radius:9px;text-decoration:none;font-size:9px;font-weight:1000}.ucl-action-details{color:#d8ad45;border:1px solid rgba(216,173,69,.38)}.fixture-status.fulltime{color:#8df0b2}.ucl-score{width:auto!important;padding:0 13px!important;border-radius:14px!important}@media(max-width:600px){.ucl-action{flex:1}}';document.head.appendChild(s)}

function uclLiveStyles(){const s=document.createElement('style');s.textContent='.ucl-club-live-wrap{display:flex;align-items:center;gap:9px;min-width:0}.ucl-club-live-pill{padding:4px 7px;border:1px solid rgba(127,215,255,.55);border-radius:5px;background:rgba(20,82,150,.28);color:#9fe3ff;font-size:7px;font-weight:1000;letter-spacing:.8px}.ucl-club-live-pill:not([hidden]){animation:uclLivePulse 1.8s ease-in-out infinite}.ucl-club-name-wrap{display:grid;grid-template-columns:24px minmax(0,1fr);grid-template-rows:auto auto;column-gap:8px;row-gap:3px;min-width:0}.ucl-club-live-meta{color:#9fdcff;font-size:8px;font-weight:700;line-height:1.35}@keyframes uclLivePulse{50%{border-color:#fff;box-shadow:0 0 14px rgba(90,190,255,.4)}}';document.head.appendChild(s);}
let syncRunning=false;
async function sync(){
 if(syncRunning)return;
 const db=window.nl4Supabase;
 if(!db){console.warn('NL4 UCL: Supabase client unavailable; retrying after client load');setTimeout(sync,250);return;}
 syncRunning=true;
 try{
  const [fixturesResult,standingsResult,crestResult]=await Promise.all([
   db.from('fixtures').select('id,matchday,status,kickoff_at,venue,home_team,away_team,home_score,away_score,home_crest_url,away_crest_url,source').eq('season','2026/27').eq('competition','UEFA Champions League').eq('source','BSD').or('home_team.ilike.%Arsenal%,away_team.ilike.%Arsenal%').order('matchday',{ascending:true}),
   db.from('ucl_standings').select('position,team_name,played,wins,draws,losses,goals_for,goals_against,goal_difference,points,source,source_updated_at').eq('season','2026/27').eq('stage','league-phase').in('source',['BSD','BSD-results-derived']).order('position',{ascending:true}),
   db.from('ucl_matches').select('home_team,away_team,home_crest_url,away_crest_url').eq('season','2026/27').eq('stage','league-phase')
  ]);
  if(fixturesResult.error)throw fixturesResult.error;
  arsenalFixtures=(fixturesResult.data||[]).map(r=>({...r,home_team:cleanTeam(r.home_team),away_team:cleanTeam(r.away_team)}));
  renderFixtures();
  uclCrests=new Map();
  if(!crestResult.error){
   for(const match of (crestResult.data||[])){
    if(match.home_team&&match.home_crest_url)uclCrests.set(String(match.home_team).trim().toLocaleLowerCase(),String(match.home_crest_url).trim());
    if(match.away_team&&match.away_crest_url)uclCrests.set(String(match.away_team).trim().toLocaleLowerCase(),String(match.away_crest_url).trim());
   }
  }
  if(standingsResult.error)throw standingsResult.error;
  renderTable(standingsResult.data||[]);
 }catch(e){console.warn('NL4 UCL BSD data sync:',e)}finally{syncRunning=false;}
}
document.addEventListener('DOMContentLoaded',()=>{styles();uclLiveStyles();sync();setTimeout(sync,1000);setTimeout(sync,2500);setInterval(sync,30000);loadUclLiveMatchDetails();setInterval(loadUclLiveMatchDetails,30000);});
