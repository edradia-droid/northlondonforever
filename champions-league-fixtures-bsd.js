(function(){
'use strict';
const clean=v=>String(v||'').replace(/\s+(FC|AFC)$/i,'').trim();
const esc=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const crest=(name,url)=>url?'<img class="team-logo" src="'+esc(url)+'" alt="'+esc(name)+' crest" loading="lazy" onerror="this.style.display=\'none\'">':'<span class="club-dot">'+esc(String(name||'').slice(0,3).toUpperCase())+'</span>';
function statusOf(f){
 const s=String(f.status||'scheduled').toLowerCase();
 const kickoff=f.kickoff_at?new Date(f.kickoff_at):null;
 const future=kickoff&&!Number.isNaN(kickoff.getTime())&&kickoff.getTime()>Date.now();
 if(future)return {label:'SCHEDULED',done:false,live:false};
 if(['live','1h','ht','2h','et'].includes(s))return {label:'LIVE',done:false,live:true};
 if(['fulltime','finished','ft','aet','pen'].includes(s))return {label:'FULL TIME',done:true,live:false};
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
  const centre=st.done?'<span>FULL TIME</span><strong class="ucl-score">'+Number(f.home_score||0)+'–'+Number(f.away_score||0)+'</strong><small>Champions League</small>':st.live?'<span>LIVE</span><strong class="ucl-score">'+Number(f.home_score||0)+'–'+Number(f.away_score||0)+'</strong><small>Champions League</small>':'<span>'+esc(time)+'</span><strong>VS</strong><small>Champions League</small>';
  return '<article class="ucl-fixture '+(st.done?'completed ':'')+(st.live?'is-live ':'')+'"><div class="fixture-top"><span>MD'+esc(f.matchday)+' • '+esc(date)+'</span><span class="fixture-status'+(st.done?' fulltime':'')+(st.live?' live':'')+'">'+st.label+'</span></div><div class="fixture-match"><div class="fixture-team">'+crest(home,f.home_crest_url)+'<b>'+esc(home)+'</b><small>HOME</small></div><div class="fixture-centre">'+centre+'</div><div class="fixture-team">'+crest(away,f.away_crest_url)+'<b>'+esc(away)+'</b><small>AWAY</small></div></div><div class="fixture-bottom ucl-fixture-bottom"><div class="ucl-fixture-caption"><span>'+esc(home)+' vs '+esc(away)+'</span><span>2026/27</span></div><div class="ucl-fixture-actions"><a class="ucl-action ucl-action-details" href="match-details.html?fixture='+encodeURIComponent(f.id)+'">More Details →</a></div></div></article>';
 }).join('');
}
async function init(){
 const db=window.nl4Supabase;
 const el=document.getElementById('arsenalUclFixtures');
 if(!db||!el){setTimeout(init,250);return;}
 const {data,error}=await db.from('fixtures').select('id,matchday,status,kickoff_at,venue,home_team,away_team,home_score,away_score,home_crest_url,away_crest_url').eq('season','2026/27').eq('competition','UEFA Champions League').eq('source','BSD').order('matchday',{ascending:true});
 if(error){el.innerHTML='<div class="ucl-loading">Unable to load Champions League fixtures.</div>';console.warn(error);return;}
 render(data||[]);
 setInterval(()=>render(data||[]),30000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();