/* NL4 Record Room • Supabase adapter
 * Dedicated to the other 19 Premier League clubs.
 * Does not read/write Arsenal match_events, match_lineups,
 * premier_league_player_stats or any forecast/model table.
 *
 * The adapter is deliberately tolerant while record-room-supabase-setup.sql
 * has not yet been applied: table-not-found / permission failures return
 * {available:false} and allow the existing localStorage Record Room to remain
 * the working fallback.
 */
(function () {
  'use strict';

  const TABLES = {
    details: 'record_room_match_details',
    stats: 'record_room_match_stats',
    lineups: 'record_room_lineups',
    substitutions: 'record_room_substitutions',
    events: 'record_room_events',
    players: 'record_room_players'
  };

  function client() {
    return window.nl4Supabase || window.supabaseClient || window.supabaseDb || null;
  }

  function unavailable(error) {
    if (error) console.warn('[NL4 Record Room] Supabase fallback:', error.message || error);
    return { available: false, error: error || null };
  }

  async function isAdmin() {
    const db = client();
    if (!db?.auth) return false;
    const { data, error } = await db.auth.getSession();
    if (error || !data?.session?.user) return false;
    const check = await db.from('admins').select('user_id').eq('user_id', data.session.user.id).maybeSingle();
    return !check.error && Boolean(check.data);
  }

  async function probe() {
    const db = client();
    if (!db) return unavailable(new Error('Supabase client unavailable'));
    if (!(await isAdmin())) return unavailable(new Error('Administrator authorization required'));
    const { error } = await db.from(TABLES.players).select('id').limit(1);
    if (error) return unavailable(error);
    return { available: true };
  }

  async function loadPlayers(season = '2026/27') {
    const db = client();
    const ready = await probe();
    if (!ready.available) return ready;
    const { data, error } = await db.from(TABLES.players)
      .select('*').eq('season', season).order('club').order('player_name');
    if (error) return unavailable(error);
    return { available: true, data: data || [] };
  }

  async function savePlayers(rows) {
    const db = client();
    const ready = await probe();
    if (!ready.available) return ready;
    if (!Array.isArray(rows) || !rows.length) return { available: true, data: [] };
    const payload = rows.map(row => ({
      season: row.season || '2026/27', club: row.club, player_name: row.player_name,
      position: row.position || null, shirt_number: row.shirt_number ?? null,
      appearances: Number(row.appearances) || 0, starts: Number(row.starts) || 0,
      minutes: Number(row.minutes) || 0, goals: Number(row.goals) || 0,
      assists: Number(row.assists) || 0, clean_sheets: Number(row.clean_sheets) || 0,
      yellow_cards: Number(row.yellow_cards) || 0, red_cards: Number(row.red_cards) || 0,
      man_of_the_match: Number(row.man_of_the_match) || 0, shots: Number(row.shots) || 0,
      shots_on_target: Number(row.shots_on_target) || 0,
      chances_created: Number(row.chances_created) || 0, tackles: Number(row.tackles) || 0,
      interceptions: Number(row.interceptions) || 0, saves: Number(row.saves) || 0,
      updated_at: new Date().toISOString()
    }));
    const { error } = await db.from(TABLES.players)
      .upsert(payload, { onConflict: 'season,club,player_name' });
    if (error) return unavailable(error);
    return { available: true };
  }

  async function loadMatch(matchId) {
    const db = client();
    const ready = await probe();
    if (!ready.available) return ready;
    const [details, stats, lineups, substitutions, events] = await Promise.all([
      db.from(TABLES.details).select('*').eq('match_id', matchId).maybeSingle(),
      db.from(TABLES.stats).select('*').eq('match_id', matchId).maybeSingle(),
      db.from(TABLES.lineups).select('*').eq('match_id', matchId).order('is_starter', { ascending: false }),
      db.from(TABLES.substitutions).select('*').eq('match_id', matchId).order('minute'),
      db.from(TABLES.events).select('*').eq('match_id', matchId).order('minute')
    ]);
    const failed = [details, stats, lineups, substitutions, events].find(x => x.error);
    if (failed) return unavailable(failed.error);
    return { available: true, data: {
      details: details.data || null, stats: stats.data || null,
      lineups: lineups.data || [], substitutions: substitutions.data || [], events: events.data || []
    }};
  }

  async function replaceRows(table, matchId, rows) {
    const db = client();
    const removed = await db.from(table).delete().eq('match_id', matchId);
    if (removed.error) throw removed.error;
    if (!rows.length) return;
    const inserted = await db.from(table).insert(rows);
    if (inserted.error) throw inserted.error;
  }

  async function saveMatch(matchId, payload) {
    const db = client();
    const ready = await probe();
    if (!ready.available) return ready;
    try {
      if (payload.details) {
        const { error } = await db.from(TABLES.details)
          .upsert({ ...payload.details, match_id: matchId, updated_at: new Date().toISOString() }, { onConflict: 'match_id' });
        if (error) throw error;
      }
      if (payload.stats) {
        const { error } = await db.from(TABLES.stats)
          .upsert({ ...payload.stats, match_id: matchId, updated_at: new Date().toISOString() }, { onConflict: 'match_id' });
        if (error) throw error;
      }
      if (payload.lineups) await replaceRows(TABLES.lineups, matchId, payload.lineups.map(x => ({ ...x, match_id: matchId })));
      if (payload.substitutions) await replaceRows(TABLES.substitutions, matchId, payload.substitutions.map(x => ({ ...x, match_id: matchId })));
      if (payload.events) await replaceRows(TABLES.events, matchId, payload.events.map(x => ({ ...x, match_id: matchId })));
      return { available: true };
    } catch (error) {
      return unavailable(error);
    }
  }

  window.NL4RecordRoomSupabase = Object.freeze({
    tables: TABLES, isAdmin, probe, loadPlayers, savePlayers, loadMatch, saveMatch
  });
})();
