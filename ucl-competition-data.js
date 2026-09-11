(function(){
  'use strict';
  const db = window.nl4Supabase;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const season = '2026/27';

  function inject(){
    const list = document.getElementById('list');
    const editor = document.getElementById('editor');
    if (!list || !editor || document.getElementById('uclCompetitionData')) return;
    const section = document.createElement('section');
    section.id = 'uclCompetitionData';
    section.className = 'section';
    section.innerHTML = `
      <div class="section-head">
        <div><small>FULL COMPETITION</small><h3>Champions League Table & Results</h3><p class="meta">All 2026/27 Champions League matches and the league-phase table from football-data.org.</p></div>
        <button id="uclCompetitionRefresh" class="ghost" type="button">Refresh</button>
      </div>
      <div class="ucl-full-grid">
        <div class="ucl-full-card"><div class="section-head"><h3>League Table</h3><span id="uclTableCount" class="meta">Loading…</span></div><div id="uclLeagueTable" class="ucl-table-wrap">Loading…</div></div>
        <div class="ucl-full-card"><div class="section-head"><h3>All Results & Fixtures</h3><span id="uclMatchCount" class="meta">Loading…</span></div><div id="uclAllMatches" class="ucl-results">Loading…</div></div>
      </div>`;
    editor.parentElement.insertBefore(section, editor);

    const style = document.createElement('style');
    style.textContent = `.ucl-full-grid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:14px;margin-top:12px}.ucl-full-card{border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px;background:#0a0f1d;min-width:0}.ucl-table-wrap{overflow:auto;max-height:620px}.ucl-table{width:100%;border-collapse:collapse;font-size:10px}.ucl-table th,.ucl-table td{padding:8px 7px;border-bottom:1px solid rgba(255,255,255,.07);text-align:center;white-space:nowrap}.ucl-table th:nth-child(2),.ucl-table td:nth-child(2){text-align:left}.ucl-table tr.arsenal-row{background:rgba(216,173,69,.10)}.ucl-results{display:grid;gap:7px;max-height:620px;overflow:auto}.ucl-round{margin:9px 0 3px;color:#d8ad45;font-size:10px;font-weight:900;letter-spacing:.5px}.ucl-result{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:7px;align-items:center;padding:8px 9px;border:1px solid rgba(255,255,255,.06);border-radius:8px;background:#080d18;font-size:10px}.ucl-result .home{text-align:right}.ucl-result .score{font-weight:900;min-width:46px;text-align:center}.ucl-result .date{grid-column:1/-1;text-align:center;color:#748099;font-size:8px}.ucl-result.arsenal-match{border-color:rgba(216,173,69,.35)}@media(max-width:820px){.ucl-full-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
    document.getElementById('uclCompetitionRefresh')?.addEventListener('click', loadAll);
  }

  async function loadTable(){
    const holder = document.getElementById('uclLeagueTable');
    const count = document.getElementById('uclTableCount');
    if (!holder) return;
    const { data, error } = await db.from('ucl_standings').select('position,team_name,played,wins,draws,losses,goals_for,goals_against,goal_difference,points,stage').eq('season',season).order('position');
    if (error) { holder.textContent = error.message; if(count) count.textContent='Error'; return; }
    const rows = data || [];
    if (count) count.textContent = `${rows.length} teams`;
    if (!rows.length) { holder.innerHTML = '<div class="meta">No table synced yet. Press Sync Now above.</div>'; return; }
    holder.innerHTML = `<table class="ucl-table"><thead><tr><th>#</th><th>Team</th><th>MP</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead><tbody>${rows.map(r=>`<tr class="${/arsenal/i.test(r.team_name||'')?'arsenal-row':''}"><td>${r.position}</td><td>${esc(r.team_name)}</td><td>${r.played}</td><td>${r.wins}</td><td>${r.draws}</td><td>${r.losses}</td><td>${r.goals_for}</td><td>${r.goals_against}</td><td>${Number(r.goal_difference)>0?'+':''}${r.goal_difference}</td><td><b>${r.points}</b></td></tr>`).join('')}</tbody></table>`;
  }

  function scoreText(m){
    if (m.home_score === null || m.home_score === undefined || m.away_score === null || m.away_score === undefined) return 'vs';
    return `${m.home_score}–${m.away_score}`;
  }

  async function loadMatches(){
    const holder = document.getElementById('uclAllMatches');
    const count = document.getElementById('uclMatchCount');
    if (!holder) return;
    const { data, error } = await db.from('ucl_matches').select('external_match_id,matchday,stage,home_team,away_team,home_score,away_score,status,kickoff_at').eq('season',season).order('kickoff_at',{ascending:true});
    if (error) { holder.textContent = error.message; if(count) count.textContent='Error'; return; }
    const rows = data || [];
    if (count) count.textContent = `${rows.length} matches`;
    if (!rows.length) { holder.innerHTML = '<div class="meta">No competition matches synced yet. Press Sync Now above.</div>'; return; }
    let lastGroup = '';
    holder.innerHTML = rows.map(m=>{
      const group = m.matchday ? `MATCHDAY ${m.matchday}` : String(m.stage || 'CHAMPIONS LEAGUE').replaceAll('_',' ');
      const heading = group !== lastGroup ? `<div class="ucl-round">${esc(group)}</div>` : '';
      lastGroup = group;
      const arsenal = /arsenal/i.test(`${m.home_team} ${m.away_team}`);
      const when = m.kickoff_at ? new Date(m.kickoff_at).toLocaleString() : 'TBC';
      return `${heading}<div class="ucl-result ${arsenal?'arsenal-match':''}"><span class="home">${esc(m.home_team)}</span><span class="score">${esc(scoreText(m))}</span><span>${esc(m.away_team)}</span><span class="date">${esc(when)} • ${esc(m.status)}</span></div>`;
    }).join('');
  }

  async function loadAll(){
    if (!db) return;
    const button = document.getElementById('uclCompetitionRefresh');
    if (button) { button.disabled = true; button.textContent='Refreshing…'; }
    await Promise.all([loadTable(), loadMatches()]);
    if (button) { button.disabled = false; button.textContent='Refresh'; }
  }

  function init(){ inject(); loadAll(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();
