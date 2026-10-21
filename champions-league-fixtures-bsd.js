(function(){
'use strict';
const clean=v=>String(v||'').replace(/\s+(FC|AFC)$/i,'').trim();
const esc=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const BSD_TEAM_IDS=Object.freeze({"Arsenal":18,"SSC Napoli":62,"Lille":106,"FC Bayern München":79,"SK Slavia Praha":120,"Borussia Dortmund":92,"Real Madrid":57,"Real Betis":56,"Sabah FK":412});
const crest=(name,url)=>{const supplied=String(url||'').trim();const id=BSD_TEAM_IDS[String(name||'').trim()];const primary=supplied|| (id?'https://sports.bzzoiro.com/img/team/'+id+'/':'');const fallback=id?'https://sports.bzzoiro.com/img/team/'+id+'/?bg=transparent':'';if(!primary)return '<span class="club-dot">'+esc(String(name||'').slice(0,3).toUpperCase())+'</span>';return '<img class="team-logo" src="'+esc(primary)+'" data-bsd-fallback="'+esc(fallback)+'" alt="'+esc(name)+' crest" loading="eager" onerror="if(this.dataset.bsdFallback&&this.src!==this.dataset.bsdFallback){this.src=this.dataset.bsdFallback;this.dataset.bsdFallback=\'\';}else{this.style.display=\'none\';}">';};
function statusOf(f){
 const s=String(f.status||'scheduled').toLowerCase().replace(/[_\s]+/g,'-');
 if(['live','1h','ht','2h','et','in-progress','inprogress','in-play','playing','half-time','halftime','extra-time'].includes(s))return {label:'LIVE',done:false,live:true};
 if(['fulltime','full-time','finished','ft','aet','pen','completed','ended'].includes(s))return {label:'FULL TIME',done:true,live:false};
 const kickoff=f.kickoff_at?new Date(f.kickoff_at):null;
 const future=kickoff&&!Number.isNaN(kickoff.getTime())&&kickoff.getTime()>Date.now();
 if(future)return {label:'UPCOMING',done:false,live:false};
 return {label:'SCHEDULED',done:false,live:false};
}
function render(rows){
 const el=document.getElementById('arsenalUclFixtures');
 if(!el)return;
 if(!rows.length){el.innerHTML='<div class="ucl-loading">No Champions League fixtures are available from BSD yet.</div>';return;}
 el.innerHTML=rows.map(f=>{
  const home=clean(f.home_team),away=clean(f.away_team),st=statusOf(f);
  const d=f.kickoff_at?new Date(f.kickoff_at):null;
  const valid=d&&!Number.isNaN(d.getTime());
  const date=valid?d.toLocaleDateString([],{day:'2-digit',month:'short',year:'numeric'}).toUpperCase():'DATE TBC';
  const time=valid?d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'TBA';
  const centre=st.done?'<span>FULL TIME</span><strong class="ucl-score">'+(f.home_score??'—')+'–'+(f.away_score??'—')+'</strong><small>Champions League</small>':st.live?'<span>LIVE</span><strong class="ucl-score">'+(f.home_score??'—')+'–'+(f.away_score??'—')+'</strong><small>Champions League</small>':'<span>'+esc(time)+'</span><strong>VS</strong><small>Champions League</small>';
  const kickoffMs=f.kickoff_at?new Date(f.kickoff_at).getTime():NaN;
  const predictionOpen=Number.isFinite(kickoffMs)&&kickoffMs>Date.now()&&!st.done&&!st.live;
  const predictionAction=predictionOpen?'<a class="ucl-action ucl-action-predict" href="predict-lineup.html?competition=cl&fixture='+encodeURIComponent(f.id)+'">Predict Scores/Lineup →</a>':'';
  return '<article class="ucl-fixture '+(st.done?'completed ':'')+(st.live?'is-live ':'')+'"><div class="fixture-top"><span>MD'+esc(f.matchday)+' • '+esc(date)+'</span><span class="fixture-status'+(st.done?' fulltime':'')+(st.live?' live':'')+'">'+st.label+'</span></div><div class="fixture-match"><div class="fixture-team">'+crest(home,f.home_crest_url)+'<b>'+esc(home)+'</b><small>HOME</small></div><div class="fixture-centre">'+centre+'</div><div class="fixture-team">'+crest(away,f.away_crest_url)+'<b>'+esc(away)+'</b><small>AWAY</small></div></div><div class="fixture-bottom ucl-fixture-bottom"><div class="ucl-fixture-caption"><span>'+esc(home)+' vs '+esc(away)+'</span><span>2026/27</span></div><div class="ucl-fixture-actions">'+predictionAction+'<a class="ucl-action ucl-action-details" href="match-details.html?fixture='+encodeURIComponent(f.id)+'">More Details →</a></div></div></article>';
 }).join('');
}
async function init(){
 const db=window.nl4Supabase;
 const el=document.getElementById('arsenalUclFixtures');
 if(!db||!el){setTimeout(init,250);return;}
 let loading=false;
 async function refresh(){
  if(loading)return;
  loading=true;
  try{
   const {data,error}=await db.from('fixtures').select('id,matchday,status,kickoff_at,venue,home_team,away_team,home_score,away_score,home_crest_url,away_crest_url').eq('season','2026/27').eq('competition','UEFA Champions League').eq('source','BSD').order('matchday',{ascending:true});
   if(error){console.warn('NL4 UCL fixtures refresh:',error);return;}
   render(data||[]);
  }catch(e){console.warn('NL4 UCL fixtures refresh failed:',e);}
  finally{loading=false;}
 }
 await refresh();
 setInterval(refresh,30000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();