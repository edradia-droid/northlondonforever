(function(){
  'use strict';

  const db = window.nl4Supabase;
  const $ = id => document.getElementById(id);
  const EXPECTED_FIXTURES = 8;
  // Legacy anon JWT is intentionally used only for protected Edge Function gateway
  // compatibility. It is a public browser key, not a secret/service-role credential.
  const UCL_FUNCTION_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyanhlanV5aXlubGx5Z2lvemhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NDk1ODcsImV4cCI6MjEwMjIyNTU4N30.4TJLwF0FjDvTj0ZwlzPJoUJF-pP655hz-ROCnHJcStw';
  const functionHeaders = { Authorization: `Bearer ${UCL_FUNCTION_JWT}` };

  function setText(id, value, state){
    const el = $(id);
    if (!el) return;
    el.textContent = value;
    if (state) el.dataset.state = state;
  }

  function fmtDate(value){
    if (!value) return 'Not synced yet';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 'Unknown' : d.toLocaleString();
  }

  function duplicateCount(rows){
    const seen = new Set();
    let duplicates = 0;
    for (const row of rows || []) {
      const external = String(row.external_fixture_id || '').trim();
      const pair = [row.matchday ?? '', row.home_team || '', row.away_team || ''].join('|').toLowerCase();
      const key = external && !external.startsWith('ucl-arsenal-') ? `ext:${external}` : `pair:${pair}`;
      if (seen.has(key)) duplicates += 1;
      else seen.add(key);
    }
    return duplicates;
  }

  async function invokeProtected(name){
    return db.functions.invoke(name, { body: {}, headers: functionHeaders });
  }

  async function readFixtureStatus(){
    const result = await db
      .from('fixtures')
      .select('id,matchday,home_team,away_team,status,external_fixture_id,source,source_updated_at,updated_at')
      .eq('season','2026/27')
      .eq('competition','UEFA Champions League')
      .order('matchday');

    if (result.error) throw result.error;
    const rows = result.data || [];
    const duplicates = duplicateCount(rows);
    const providerRows = rows.filter(r => String(r.source || '').toLowerCase() === 'football-data.org');
    const lastSync = rows
      .map(r => r.source_updated_at || (String(r.source || '').toLowerCase() === 'football-data.org' ? r.updated_at : null))
      .filter(Boolean)
      .sort()
      .pop() || null;

    setText('uclCoverage', `${rows.length} / ${EXPECTED_FIXTURES}`, rows.length === EXPECTED_FIXTURES ? 'good' : 'warn');
    setText('uclDuplicates', duplicates ? `${duplicates} found` : 'None', duplicates ? 'bad' : 'good');
    setText('uclLastSync', fmtDate(lastSync), lastSync ? 'good' : 'warn');
    setText('uclDbSource', providerRows.length === rows.length && rows.length ? 'football-data.org' : `${providerRows.length}/${rows.length} football-data.org`, providerRows.length === rows.length && rows.length ? 'good' : 'warn');
    return rows;
  }

  async function readProviderHealth(){
    setText('uclProviderHealth','Checking…','neutral');
    setText('uclFunctionHealth','Checking…','neutral');
    try {
      const { data, error } = await invokeProtected('test-ucl-football-data');
      if (error) throw error;
      if (!data || data.ok !== true) throw new Error(data?.error || `Provider returned ${data?.status || 'an error'}`);
      setText('uclProviderHealth', `Online • HTTP ${data.status || 200}`, 'good');
      setText('uclFunctionHealth', 'test-ucl-football-data • Active', 'good');
      if (Number.isFinite(Number(data.arsenalFixtures))) {
        const count = Number(data.arsenalFixtures);
        setText('uclProviderCoverage', `${count} / ${EXPECTED_FIXTURES}`, count === EXPECTED_FIXTURES ? 'good' : 'warn');
      } else {
        setText('uclProviderCoverage','Available','good');
      }
      setText('uclStatusError','None','good');
      return data;
    } catch (err) {
      const detail = err?.message || String(err);
      setText('uclProviderHealth','Unavailable','bad');
      setText('uclFunctionHealth','Diagnostic failed','bad');
      setText('uclProviderCoverage','Unknown','warn');
      setText('uclStatusError',detail,'bad');
      throw err;
    }
  }

  async function refreshStatus(){
    const button = $('uclRefreshStatus');
    if (!db) {
      setText('uclStatusError','Supabase client is unavailable.','bad');
      return;
    }
    if (button) { button.disabled = true; button.textContent = 'Refreshing…'; }
    setText('uclStatusUpdated','Refreshing…','neutral');
    try {
      const results = await Promise.allSettled([readFixtureStatus(), readProviderHealth()]);
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length === 0) setText('uclStatusError','None','good');
      else if (failed.length === 1 && results[0].status === 'rejected') setText('uclStatusError',results[0].reason?.message || 'Fixture status check failed','bad');
      setText('uclStatusUpdated', `Checked ${new Date().toLocaleTimeString()}`, failed.length ? 'warn' : 'good');
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Refresh Status'; }
    }
  }

  async function syncNow(){
    const button = $('syncApi');
    if (!db || !button) return;
    button.disabled = true;
    button.textContent = 'Syncing UCL…';
    setText('uclStatusError','None','neutral');
    try {
      const { data, error } = await invokeProtected('sync-ucl-football');
      if (error) throw error;
      if (data?.error) throw new Error(`${data.error}${data.stage ? ` (${data.stage})` : ''}`);
      button.textContent = 'Sync Complete ✓';
      setText('uclFunctionHealth','sync-ucl-football • Active','good');
      await refreshStatus();
      if (typeof window.location !== 'undefined') {
        setTimeout(() => window.location.reload(), 650);
      }
    } catch (err) {
      const detail = err?.message || String(err);
      button.textContent = 'Sync Failed — Retry';
      setText('uclFunctionHealth','sync-ucl-football • Error','bad');
      setText('uclStatusError',detail,'bad');
    } finally {
      button.disabled = false;
      if (button.textContent === 'Sync Complete ✓') setTimeout(() => { button.textContent = 'Sync Now'; }, 2200);
    }
  }

  function loadCompetitionDataModule(){
    if (document.querySelector('script[data-ucl-competition-data]')) return;
    const script = document.createElement('script');
    script.src = 'ucl-competition-data.js?v=20260912-1';
    script.dataset.uclCompetitionData = '1';
    document.head.appendChild(script);
  }

  function init(){
    const refresh = $('uclRefreshStatus');
    const sync = $('syncApi');
    if (refresh) refresh.addEventListener('click', refreshStatus);
    if (sync) sync.addEventListener('click', syncNow);
    setText('uclJwt','Required • verify_jwt enabled','good');
    refreshStatus();
    loadCompetitionDataModule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
