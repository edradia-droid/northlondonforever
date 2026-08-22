(() => {
  'use strict';
  const SEASON = '2026/27';
  const finished = s => ['fulltime','finished','ft'].includes(String(s || '').toLowerCase());
  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const isArsenal = v => norm(v) === 'arsenal' || norm(v).startsWith('arsenal ');

  function fixtureArsenalConceded(f){
    if (f.arsenal_score !== null && f.arsenal_score !== undefined && f.opponent_score !== null && f.opponent_score !== undefined) {
      return Number(f.opponent_score);
    }
    if (isArsenal(f.home_team)) return Number(f.away_score);
    if (isArsenal(f.away_team)) return Number(f.home_score);
    return null;
  }

  function fixtureEndMinute(fixture){
    const added = Math.max(0, Number(fixture?.added_time) || 0);
    return 90 + added;
  }

  function minutesFor(row, fixture){
    const endMinute = fixtureEndMinute(fixture);
    const onRaw = Number(row.minute_on);
    const on = Number.isFinite(onRaw) ? Math.max(0, onRaw) : (row.is_starter ? 0 : 0);
    const offRaw = row.minute_off === null || row.minute_off === undefined || row.minute_off === ''
      ? endMinute
      : Number(row.minute_off);
    const off = Number.isFinite(offRaw) ? Math.max(0, offRaw) : endMinute;
    return Math.max(0, Math.min(endMinute, off) - Math.min(endMinute, on));
  }

  function arsenalSavesForFixture(fixture){
    if (isArsenal(fixture.home_team)) return Math.max(0, Number(fixture.home_saves) || 0);
    if (isArsenal(fixture.away_team)) return Math.max(0, Number(fixture.away_saves) || 0);
    if (fixture.is_home === true) return Math.max(0, Number(fixture.home_saves) || 0);
    if (fixture.is_home === false) return Math.max(0, Number(fixture.away_saves) || 0);
    return 0;
  }

  function isGoalkeeperPosition(value){
    const p = norm(value);
    return p === 'gk' || p.includes('goalkeeper') || p.includes('keeper');
  }

  async function syncSeasonStats(options = {}){
    const db = window.nl4Supabase || window.supabaseClient || window.supabaseDb;
    if (!db || typeof db.from !== 'function') throw new Error('Supabase client not available.');

    const {data: fixtureData, error: fixtureError} = await db.from('fixtures').select('*').eq('season',SEASON);
    if (fixtureError) throw fixtureError;
    const fixtures = (fixtureData || []).filter(f => String(f.competition || '').toLowerCase().includes('premier'));
    const completed = fixtures.filter(f => finished(f.status) && (
      (f.arsenal_score !== null && f.arsenal_score !== undefined && f.opponent_score !== null && f.opponent_score !== undefined) ||
      (f.home_score !== null && f.home_score !== undefined && f.away_score !== null && f.away_score !== undefined)
    ));
    const completedIds = completed.map(f => f.id).filter(Boolean);
    const fixtureMap = new Map(completed.map(f => [String(f.id),f]));

    const [{data: existing, error: statsError}, lineupRes, eventRes] = await Promise.all([
      db.from('premier_league_player_stats').select('*').eq('season',SEASON),
      completedIds.length ? db.from('match_lineups').select('*').in('fixture_id',completedIds) : Promise.resolve({data:[],error:null}),
      completedIds.length ? db.from('match_events').select('*').in('fixture_id',completedIds) : Promise.resolve({data:[],error:null})
    ]);
    if (statsError) throw statsError;
    if (lineupRes.error) throw lineupRes.error;
    if (eventRes.error) throw eventRes.error;

    const byName = new Map();
    (existing || []).forEach(row => byName.set(norm(row.player_name), {
      row,
      player_name: row.player_name,
      position: row.position || null,
      appearances:0, starts:0, minutes:0, goals:0, assists:0, clean_sheets:0,
      yellow_cards:0, red_cards:0, man_of_the_match:0, saves:0
    }));

    const ensure = (name, position = null) => {
      const key = norm(name); if (!key) return null;
      if (!byName.has(key)) byName.set(key, {row:null,player_name:name,position:position||null,appearances:0,starts:0,minutes:0,goals:0,assists:0,clean_sheets:0,yellow_cards:0,red_cards:0,man_of_the_match:0,saves:0});
      const x = byName.get(key); if (!x.position && position) x.position = position; return x;
    };

    (lineupRes.data || []).forEach(row => {
      const f = fixtureMap.get(String(row.fixture_id)); if (!f) return;
      const s = ensure(row.player_name,row.position); if (!s) return;
      const mins = minutesFor(row, f);
      s.appearances += 1;
      if (row.is_starter) s.starts += 1;
      s.minutes += mins;
      const conceded = fixtureArsenalConceded(f);
      const pos = norm(s.position);
      if (conceded === 0 && mins >= 60 && (pos.includes('goalkeeper') || pos.includes('defender'))) s.clean_sheets += 1;
    });

    // Arsenal goalkeeper saves: all Arsenal saves recorded in Match Stats
    // belong to the goalkeeper who STARTED that fixture, per NL4 admin rules.
    completed.forEach(f => {
      const fixtureLineups = (lineupRes.data || []).filter(row => String(row.fixture_id) === String(f.id));
      const startingKeeper = fixtureLineups.find(row => row.is_starter && isGoalkeeperPosition(row.position));
      if (!startingKeeper) return;
      const saves = arsenalSavesForFixture(f);
      const s = ensure(startingKeeper.player_name, startingKeeper.position);
      if (s) s.saves += saves;
    });

    (eventRes.data || []).forEach(event => {
      if (!fixtureMap.has(String(event.fixture_id)) || !isArsenal(event.team_name)) return;

      const type = String(event.event_type || '').toLowerCase();
      const mainPlayer = ensure(event.player_name);

      if (type === 'goal') {
        // Player name is the scorer.
        if (mainPlayer) mainPlayer.goals += 1;

        // Related player is the assister for this goal.
        // Empty Related player means the goal was unassisted.
        const relatedName = String(event.related_player_name || '').trim();
        if (relatedName) {
          const assister = ensure(relatedName);
          if (assister) assister.assists += 1;
        }
      } else if (type === 'assist') {
        // Backward compatibility for old standalone assist events:
        // prefer Related player when present; otherwise use Player name.
        const assistName = String(event.related_player_name || event.player_name || '').trim();
        const assister = ensure(assistName);
        if (assister) assister.assists += 1;
      } else if (type === 'yellow_card') {
        if (mainPlayer) mainPlayer.yellow_cards += 1;
      } else if (type === 'red_card') {
        if (mainPlayer) mainPlayer.red_cards += 1;
      }
    });

    completed.forEach(f => {
      if (f.man_of_the_match) {
        const s = ensure(f.man_of_the_match);
        if (s) s.man_of_the_match += 1;
      }
    });

    let updated = 0, inserted = 0;
    for (const s of byName.values()) {
      const payload = {
        season:SEASON, player_name:s.player_name, position:s.position,
        appearances:s.appearances, starts:s.starts, minutes:s.minutes,
        goals:s.goals, assists:s.assists, clean_sheets:s.clean_sheets,
        yellow_cards:s.yellow_cards, red_cards:s.red_cards,
        man_of_the_match:s.man_of_the_match,
        saves:s.saves
      };
      if (s.row?.id) {
        const {error} = await db.from('premier_league_player_stats').update(payload).eq('id',s.row.id);
        if (error) throw error; updated++;
      } else {
        const {error} = await db.from('premier_league_player_stats').insert(payload);
        if (error) throw error; inserted++;
      }
    }
    window.dispatchEvent(new CustomEvent('nl4:player-stats-synced',{detail:{updated,inserted,completed:completed.length}}));
    if (!options.silent) console.info(`NL4 player stats synced: ${updated} updated, ${inserted} inserted from ${completed.length} completed PL matches.`);
    return {updated,inserted,completed:completed.length};
  }

  window.NL4PlayerStatsSync = {syncSeasonStats};
})();
