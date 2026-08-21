(() => {
  'use strict';
  const pageMap = {
    'saka.html':'Bukayo Saka','saliba.html':'William Saliba','rice.html':'Declan Rice','kai.html':'Kai Havertz',
    'gabby.html':'Gabriel Magalhães','ode.html':'Martin Ødegaard','nelly.html':'Gabriel Martinelli'
  };
  const file = (location.pathname.split('/').pop() || '').toLowerCase();
  const playerName = pageMap[file];
  if (!playerName) return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function ensureStyles(){ if(document.getElementById('nl4SeasonStatsStyle'))return; const s=document.createElement('style');s.id='nl4SeasonStatsStyle';s.textContent=`
    .nl4-live-season-stats{margin:36px 0;padding:26px;border:1px solid rgba(212,175,55,.35);border-radius:20px;background:linear-gradient(145deg,#101010,#171717);color:#fff}
    .nl4-live-season-stats .nl4-live-kicker{margin:0 0 7px;color:#d8ad45;font-size:.76rem;font-weight:900;letter-spacing:.18em;text-transform:uppercase}
    .nl4-live-season-stats h2{margin:0 0 18px;font-size:clamp(1.45rem,3vw,2.2rem)}
    .nl4-live-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    .nl4-live-stat{padding:14px 10px;border-radius:14px;background:rgba(255,255,255,.055);text-align:center}.nl4-live-stat strong{display:block;font-size:1.45rem;color:#d8ad45}.nl4-live-stat span{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:#cfcfcf}
    .nl4-live-note{margin:14px 0 0;color:#aaa;font-size:.82rem}@media(max-width:620px){.nl4-live-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;document.head.appendChild(s); }

  function mount(row){
    ensureStyles(); let host=document.getElementById('nl4LiveSeasonStats'); if(!host){host=document.createElement('section');host.id='nl4LiveSeasonStats';host.className='nl4-live-season-stats';const profile=document.querySelector('.profile'); if(profile)profile.insertAdjacentElement('afterend',host); else (document.querySelector('main')||document.body).appendChild(host);}
    const stats=[['APP',row.appearances],['STARTS',row.starts],['MIN',row.minutes],['GOALS',row.goals],['ASSISTS',row.assists],['CLEAN SHEETS',row.clean_sheets],['YELLOW',row.yellow_cards],['RED',row.red_cards],['MOTM',row.man_of_the_match],['SHOTS',row.shots],['ON TARGET',row.shots_on_target],['CHANCES',row.chances_created],['TACKLES',row.tackles],['INTERCEPTIONS',row.interceptions],['SAVES',row.saves]];
    host.innerHTML=`<p class="nl4-live-kicker">LIVE FROM NL4 • 2026/27 PREMIER LEAGUE</p><h2>${esc(playerName)} — Season Stats</h2><div class="nl4-live-stat-grid">${stats.map(([l,v])=>`<div class="nl4-live-stat"><strong>${esc(v ?? 0)}</strong><span>${esc(l)}</span></div>`).join('')}</div><p class="nl4-live-note">Appearances, starts, minutes, goals, assists and cards sync from match records. Other player-level metrics remain editable in NL4 Admin.</p>`;
  }

  async function load(){const db=window.nl4Supabase;if(!db)return;try{const {data,error}=await db.from('premier_league_player_stats').select('*').eq('season','2026/27').eq('player_name',playerName).maybeSingle();if(error)throw error;if(data)mount(data);}catch(e){console.warn('NL4 live player stats fallback:',e?.message||e);}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
  window.addEventListener('nl4:player-stats-synced',load);
  const db=window.nl4Supabase;
  if(db?.channel){
    try{db.channel(`nl4-player-stats-${file}`).on('postgres_changes',{event:'*',schema:'public',table:'premier_league_player_stats',filter:`season=eq.2026/27`},payload=>{if(!payload?.new?.player_name || payload.new.player_name===playerName || payload?.old?.player_name===playerName) load();}).subscribe();}catch(_){}
  }
})();
