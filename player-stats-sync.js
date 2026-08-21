(() => {
  'use strict';
  const SEASON = '2026/27';
  const finished = s => { const x=norm(s).replace(/ /g,'_'); return ['fulltime','full_time','finished','ft','final','complete','completed'].includes(x); };
  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const isArsenal = v => norm(v) === 'arsenal' || norm(v).startsWith('arsenal ');
  const ARSENAL_PLAYERS = new Set([
    'David Raya','Kepa Arrizabalaga','Illan Meslier','Tommy Setford','William Saliba','Cristhian Mosquera','Ben White','Piero Hincapié','Gabriel Magalhães','Jurriën Timber','Riccardo Calafiori','Myles Lewis-Skelly','Martin Ødegaard','Eberechi Eze','Fabio Vieira','Ethan Nwaneri','Mikel Merino','Martín Zubimendi','Bruno Guimarães','Declan Rice','Bukayo Saka','Gabriel Jesus','Gabriel Martinelli','Viktor Gyökeres','Christos Tzolis','Noni Madueke','Reiss Nelson','Kai Havertz'
  ].map(norm));
  const isArsenalPlayerEvent = event => isArsenal(event.team_name) || ARSENAL_PLAYERS.has(norm(event.player_name));

  function fixtureArsenalConceded(f){
    if (f.arsenal_score !== null && f.arsenal_score !== undefined && f.opponent_score !== null && f.opponent_score !== undefined) {
      return Number(f.opponent_score);
    }
    if (isArsenal(f.home_team)) return Number(f.away_score);
    if (isArsenal(f.away_team)) return Number(f.home_score);
    return null;
  }

  function minutesFor(row){
    const on = Number.isFinite(Number(row.minute_on)) ? Number(row.minute_on) : (row.is_starter ? 0 : 0);
    const off = row.minute_off === null || row.minute_off === undefined || row.minute_off === '' ? 90 : Number(row.minute_off);
    return Math.max(0, Math.min(90, Number.isFinite(off) ? off : 90) - Math.max(0, Math.min(90,on)));
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
    const allPremierIds = fixtures.map(f => f.id).filter(Boolean);
    const fixtureMap = new Map(fixtures.map(f => [String(f.id),f]));
    const completedFixtureMap = new Map(completed.map(f => [String(f.id),f]));

    const [{data: existing, error: statsError}, lineupRes, eventRes] = await Promise.all([
      db.from('premier_league_player_stats').select('*').eq('season',SEASON),
      completedIds.length ? db.from('match_lineups').select('*').in('fixture_id',completedIds) : Promise.resolve({data:[],error:null}),
      allPremierIds.length ? db.from('match_events').select('*').in('fixture_id',allPremierIds) : Promise.resolve({data:[],error:null})
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
      yellow_cards:0, red_cards:0, man_of_the_match:0
    }));

    const ensure = (name, position = null) => {
      const key = norm(name); if (!key) return null;
      if (!byName.has(key)) byName.set(key, {row:null,player_name:name,position:position||null,appearances:0,starts:0,minutes:0,goals:0,assists:0,clean_sheets:0,yellow_cards:0,red_cards:0,man_of_the_match:0});
      const x = byName.get(key); if (!x.position && position) x.position = position; return x;
    };

    (lineupRes.data || []).forEach(row => {
      const f = completedFixtureMap.get(String(row.fixture_id)); if (!f) return;
      const s = ensure(row.player_name,row.position); if (!s) return;
      const mins = minutesFor(row);
      s.appearances += 1;
      if (row.is_starter) s.starts += 1;
      s.minutes += mins;
      const conceded = fixtureArsenalConceded(f);
      const pos = norm(s.position);
      if (conceded === 0 && mins >= 60 && (pos.includes('goalkeeper') || pos.includes('defender'))) s.clean_sheets += 1;
    });

    const explicitAssistKeys = new Set();
    (eventRes.data || []).forEach(event => {
      if (!fixtureMap.has(String(event.fixture_id)) || !isArsenalPlayerEvent(event)) return;
      const type = norm(event.event_type).replace(/ /g,'_');
      if (!['assist','assisted','goal_assist'].includes(type)) return;
      explicitAssistKeys.add(`${event.fixture_id}::${norm(event.player_name)}::${event.minute ?? ''}::${event.stoppage_minute ?? ''}`);
    });

    (eventRes.data || []).forEach(event => {
      if (!fixtureMap.has(String(event.fixture_id)) || !isArsenalPlayerEvent(event)) return;
      const type = norm(event.event_type).replace(/ /g,'_');
      const s = ensure(event.player_name); if (!s) return;

      if (['goal','goals','goal_scored','scored'].includes(type)) {
        s.goals += 1;
        const assister = String(event.related_player_name || '').trim();
        if (assister) {
          const assistKey = `${event.fixture_id}::${norm(assister)}::${event.minute ?? ''}::${event.stoppage_minute ?? ''}`;
          if (!explicitAssistKeys.has(assistKey)) {
            const a = ensure(assister);
            if (a) a.assists += 1;
          }
        }
      }
      else if (['assist','assisted','goal_assist'].includes(type)) s.assists += 1;
      else if (['yellow_card','yellow','booking'].includes(type)) s.yellow_cards += 1;
      else if (['red_card','red','sending_off','sent_off'].includes(type)) s.red_cards += 1;
    });

    // MOM is an explicit Admin award, so count it as soon as it is saved on a
    // 2026/27 Premier League fixture. Recalculation from fixtures prevents duplicates.
    fixtures.forEach(f => {
      const mom = String(f.man_of_the_match || '').trim();
      if (!mom) return;
      const s = ensure(mom);
      if (s) s.man_of_the_match += 1;
    });

    let updated = 0, inserted = 0;
    for (const s of byName.values()) {
      const payload = {
        season:SEASON, player_name:s.player_name, position:s.position,
        appearances:s.appearances, starts:s.starts, minutes:s.minutes,
        goals:s.goals, assists:s.assists, clean_sheets:s.clean_sheets,
        yellow_cards:s.yellow_cards, red_cards:s.red_cards,
        man_of_the_match:s.man_of_the_match
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
