(function(){
  'use strict';
  const db = window.nl4Supabase;
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cleanTeam = v => String(v || '').replace(/\s+(FC|AFC)$/i,'').trim();

  async function loadLiveStandings(){
    if (!db) return;
    const body = $('uclTableBody');
    if (body) body.innerHTML = '<tr><td colspan="10">Loading live Champions League table…</td></tr>';

    const { data, error } = await db
      .from('ucl_standings')
      .select('position,team_name,played,wins,draws,losses,goals_for,goals_against,goal_difference,points,source_updated_at')
      .eq('season','2026/27')
      .order('position',{ascending:true});

    if (error) {
      console.warn('NL4 UCL live standings:', error);
      if (body) body.innerHTML = `<tr><td colspan="10">${esc(error.message)}</td></tr>`;
      return;
    }

    const rows = data || [];
    if (!rows.length) {
      if (body) body.innerHTML = '<tr><td colspan="10">No Champions League table data synced yet.</td></tr>';
      return;
    }

    if (body) {
      body.innerHTML = rows.map(r => {
        const name = cleanTeam(r.team_name);
        const arsenal = /arsenal/i.test(name);
        const gd = Number(r.goal_difference || 0);
        return `<tr class="${arsenal ? 'arsenal-row' : ''}"><td>${r.position}</td><td class="club"><strong>${esc(name)}</strong></td><td>${r.played}</td><td>${r.wins}</td><td>${r.draws}</td><td>${r.losses}</td><td>${r.goals_for}</td><td>${r.goals_against}</td><td>${gd > 0 ? '+' : ''}${gd}</td><td><strong>${r.points}</strong></td></tr>`;
      }).join('');
    }

    const arsenal = rows.find(r => /arsenal/i.test(String(r.team_name || '')));
    if (arsenal) {
      if ($('uclPosition')) $('uclPosition').textContent = arsenal.position ?? '—';
      if ($('uclPoints')) $('uclPoints').textContent = arsenal.points ?? 0;
      if ($('uclPlayed')) $('uclPlayed').textContent = arsenal.played ?? 0;
      if ($('uclWins')) $('uclWins').textContent = arsenal.wins ?? 0;
      if ($('uclGoals')) $('uclGoals').textContent = arsenal.goals_for ?? 0;
      const gd = Number(arsenal.goal_difference || 0);
      if ($('uclGoalDiff')) $('uclGoalDiff').textContent = `${gd > 0 ? '+' : ''}${gd}`;
    }

    const status = document.querySelector('.ucl-table-status');
    const lastSync = rows.map(r => r.source_updated_at).filter(Boolean).sort().pop();
    if (status) status.textContent = lastSync ? `Live API table • updated ${new Date(lastSync).toLocaleString()}` : 'Live API table from football-data.org.';
  }

  window.NL4ReloadUclStandings = loadLiveStandings;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadLiveStandings, {once:true});
  else loadLiveStandings();
})();
