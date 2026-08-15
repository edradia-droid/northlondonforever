(function () {
  const tableBody = document.getElementById('leagueTableBody');
  const tableStatus = document.getElementById('leagueTableStatus');

  const fallbackTeams = [
    'Arsenal',
    'Manchester City',
    'Liverpool',
    'Chelsea',
    'Tottenham Hotspur',
    'Manchester United',
    'Newcastle United',
    'Aston Villa',
    'Brighton & Hove Albion',
    'Crystal Palace',
    'Brentford',
    'Fulham',
    'Everton',
    'Nottingham Forest',
    'AFC Bournemouth',
    'Leeds United',
    'Sunderland',
    'Coventry City',
    'Hull City',
    'Ipswich Town'
  ];

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[char]);
  }

  function ordinal(position) {
    const n = Number(position);
    if (!Number.isFinite(n)) return '—';

    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${n}TH`;

    switch (n % 10) {
      case 1: return `${n}ST`;
      case 2: return `${n}ND`;
      case 3: return `${n}RD`;
      default: return `${n}TH`;
    }
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function clubCode(name) {
    const fixed = {
      'Arsenal':'ARS',
      'Manchester City':'MCI',
      'Manchester United':'MUN',
      'Liverpool':'LIV',
      'Chelsea':'CHE',
      'Tottenham Hotspur':'TOT',
      'Newcastle United':'NEW',
      'Aston Villa':'AVL',
      'Brighton & Hove Albion':'BHA',
      'Crystal Palace':'CRY',
      'Nottingham Forest':'NFO',
      'AFC Bournemouth':'BOU',
      'Leeds United':'LEE',
      'Sunderland':'SUN',
      'Coventry City':'COV',
      'Hull City':'HUL',
      'Ipswich Town':'IPS',
      'Brentford':'BRE',
      'Fulham':'FUL',
      'Everton':'EVE'
    };

    return fixed[name] ||
      String(name || '---')
        .split(/\s+/)
        .map(part => part[0])
        .join('')
        .slice(0,3)
        .toUpperCase();
  }

  function normalizeStanding(row, index) {
    const played = Number(row.played ?? row.p ?? 0);
    const wins = Number(row.wins ?? row.w ?? 0);
    const draws = Number(row.draws ?? row.d ?? 0);
    const losses = Number(row.losses ?? row.l ?? 0);
    const gf = Number(row.goals_for ?? row.gf ?? 0);
    const ga = Number(row.goals_against ?? row.ga ?? 0);
    const gd = Number(row.goal_difference ?? row.gd ?? (gf - ga));
    const points = Number(row.points ?? row.pts ?? (wins * 3 + draws));

    return {
      position: Number(row.position ?? row.pos ?? index + 1),
      club: row.club || row.team || row.team_name || 'Unknown',
      played,
      wins,
      draws,
      losses,
      gf,
      ga,
      gd,
      points
    };
  }


  function renderTitleRace(standings) {
    const holder = document.getElementById('titleRaceGrid');
    if (!holder) return;

    const topFour = standings
      .slice()
      .sort((a,b) => a.position - b.position)
      .slice(0,4);

    if (!topFour.length) {
      holder.innerHTML =
        '<div class="pl-results-empty">No title race data available yet.</div>';
      return;
    }

    const leaderPoints = Number(topFour[0].points || 0);

    holder.innerHTML = topFour.map(team => {
      const gap = leaderPoints - Number(team.points || 0);
      const arsenal = String(team.club || '').toLowerCase() === 'arsenal';

      return `
        <article class="pl-race-card ${arsenal ? 'arsenal-race-card' : ''}">
          <span class="pl-race-pos">#${team.position}</span>

          <h3>${escapeHtml(team.club)}</h3>

          <div class="pl-race-points">
            <strong>${team.points}</strong>
            <span>PTS</span>
          </div>

          <span class="pl-race-gap ${gap === 0 ? 'leader' : ''}">
            ${gap === 0 ? 'LEAGUE LEADER' : `${gap} PT${gap === 1 ? '' : 'S'} BEHIND`}
          </span>
        </article>
      `;
    }).join('');
  }

  function updateArsenalSummary(arsenal) {
    if (!arsenal) return;

    const position = ordinal(arsenal.position);
    const gd = arsenal.gd > 0 ? `+${arsenal.gd}` : String(arsenal.gd);

    setText('heroPosition', position);
    setText('heroPoints', arsenal.points);
    setText('heroPlayed', arsenal.played);
    setText('heroWins', arsenal.wins);
    setText('heroGD', gd);

    setText('statPosition', position);
    setText('statPoints', arsenal.points);
    setText('statPlayed', arsenal.played);
    setText('statWins', arsenal.wins);
    setText('statGF', arsenal.gf);
    setText('statGD', gd);
  }

  function renderStandings(rows, sourceLabel) {
    const standings = rows
      .map(normalizeStanding)
      .sort((a,b) => a.position - b.position);

    tableBody.innerHTML = standings.map(team => {
      const arsenal = team.club.toLowerCase() === 'arsenal';

      return `
        <tr class="${arsenal ? 'arsenal-row' : ''}">
          <td>${team.position}</td>

          <td class="club-cell">
            <div class="club-name-wrap">
              <span class="club-mini-badge">${escapeHtml(clubCode(team.club))}</span>
              <span>${escapeHtml(team.club)}</span>
            </div>
          </td>

          <td>${team.played}</td>
          <td>${team.wins}</td>
          <td>${team.draws}</td>
          <td>${team.losses}</td>
          <td>${team.gf}</td>
          <td>${team.ga}</td>
          <td>${team.gd > 0 ? '+' : ''}${team.gd}</td>
          <td><strong>${team.points}</strong></td>
        </tr>
      `;
    }).join('');

    const arsenal = standings.find(team =>
      team.club.toLowerCase() === 'arsenal'
    );

    updateArsenalSummary(arsenal);
    renderTitleRace(standings);

    tableStatus.textContent = sourceLabel;
  }

  function renderEmptySeason() {
    const empty = fallbackTeams.map((club, index) => ({
      position:index + 1,
      club,
      played:0,
      wins:0,
      draws:0,
      losses:0,
      goals_for:0,
      goals_against:0,
      goal_difference:0,
      points:0
    }));

    renderStandings(
      empty,
      'Standings table is ready. Add rows to Supabase table "premier_league_standings" to make it live.'
    );
  }

  async function loadStandings() {
    try {
      const client =
        window.nl4Supabase ||
        window.supabaseClient ||
        window.NL4_SUPABASE ||
        window.supabaseDb ||
        window.db;

      if (!client || typeof client.from !== 'function') {
        throw new Error('Supabase client not found.');
      }

      const { data, error } = await client
        .from('premier_league_standings')
        .select('*')
        .eq('season','2026/27')
        .order('position',{ ascending:true });

      if (error) throw error;

      if (!data || !data.length) {
        renderEmptySeason();
        return;
      }

      renderStandings(
        data,
        'Live standings loaded from Supabase • 2026/27'
      );
    } catch (error) {
      console.warn('NL4 Premier League standings fallback:', error);
      renderEmptySeason();
    }
  }

  function localFixtureParts(iso) {
    const date = new Date(iso);

    return {
      date: date.toLocaleDateString('en-GB', {
        timeZone:'Europe/London',
        weekday:'short',
        day:'2-digit',
        month:'short',
        year:'numeric'
      }).toUpperCase(),

      time: date.toLocaleTimeString('en-GB', {
        timeZone:'Europe/London',
        hour:'2-digit',
        minute:'2-digit',
        hour12:false
      })
    };
  }

  function updateNextFixture(match) {
    if (!match) return;

    const isHome =
      match.is_home === true ||
      match.home_team === 'Arsenal';

    const home =
      match.home_team ||
      (isHome ? 'Arsenal' : match.opponent);

    const away =
      match.away_team ||
      (isHome ? match.opponent : 'Arsenal');

    setText('nextHomeCode', clubCode(home));
    setText('nextAwayCode', clubCode(away));
    setText('nextHomeTeam', home);
    setText('nextAwayTeam', away);
    setText('nextFixtureVenue', match.venue || 'Venue TBC');
    setText(
      'nextMatchday',
      match.matchday ? `MATCHDAY ${match.matchday}` : 'MATCHDAY —'
    );

    if (match.kickoff_at) {
      const parts = localFixtureParts(match.kickoff_at);
      setText('nextFixtureDate', parts.date);
      setText('nextFixtureTime', parts.time);
    }

    const details = document.getElementById('nextFixtureDetails');
    if (details) {
      const id = match.external_fixture_id || match.id;
      details.href = id
        ? `match-details.html?fixture=${encodeURIComponent(id)}`
        : 'fixtures.html';
    }
  }

  async function loadNextFixture() {
    try {
      let fixtures = [];

      if (window.NL4Data && typeof window.NL4Data.fixtures === 'function') {
        fixtures = await window.NL4Data.fixtures();
      } else {
        const client =
          window.nl4Supabase ||
          window.supabaseClient ||
          window.NL4_SUPABASE ||
          window.supabaseDb ||
          window.db;

        if (!client || typeof client.from !== 'function') return;

        const { data, error } = await client
          .from('fixtures')
          .select('*')
          .eq('season','2026/27')
          .eq('competition','Premier League')
          .eq('is_published',true)
          .order('matchday',{ ascending:true });

        if (error) throw error;
        fixtures = data || [];
      }

      const now = Date.now();

      const next = (fixtures || [])
        .filter(row =>
          row &&
          row.season === '2026/27' &&
          row.competition === 'Premier League' &&
          row.is_published !== false &&
          row.kickoff_at &&
          new Date(row.kickoff_at).getTime() >= now &&
          !['fulltime','ft','aet','pen','cancelled'].includes(
            String(row.status || '').toLowerCase()
          )
        )
        .sort((a,b) =>
          new Date(a.kickoff_at) - new Date(b.kickoff_at)
        )[0];

      if (next) updateNextFixture(next);
    } catch (error) {
      console.warn('NL4 next Premier League fixture failed:', error);
    }
  }


  function resultLetter(match) {
    const isHome =
      match.is_home === true ||
      match.home_team === 'Arsenal';

    const arsenalScore = Number(match.arsenal_score);
    const opponentScore = Number(match.opponent_score);

    if (!Number.isFinite(arsenalScore) || !Number.isFinite(opponentScore)) {
      return null;
    }

    if (arsenalScore > opponentScore) return 'W';
    if (arsenalScore < opponentScore) return 'L';
    return 'D';
  }

  function resultClass(letter) {
    if (letter === 'W') return 'win';
    if (letter === 'L') return 'loss';
    return 'draw';
  }

  function normalizeArsenalFixture(row) {
    const isHome =
      row.is_home === true ||
      row.home_team === 'Arsenal';

    const opponent =
      row.opponent ||
      (isHome ? row.away_team : row.home_team) ||
      'Opponent';

    return {
      ...row,
      isHome,
      opponent,
      letter: resultLetter(row)
    };
  }

  function renderArsenalForm(matches) {
    const holder = document.getElementById('arsenalFormStrip');
    if (!holder) return;

    const latestFive = matches.slice(-5);

    if (!latestFive.length) {
      holder.innerHTML =
        '<span class="pl-form-empty">No completed league matches yet.</span>';
      return;
    }

    holder.innerHTML = latestFive.map(match => `
      <span
        class="pl-form-pill ${resultClass(match.letter)}"
        title="${escapeHtml(match.opponent)}"
      >${match.letter}</span>
    `).join('');
  }

  function renderRecentResults(matches) {
    const holder = document.getElementById('recentResultsList');
    if (!holder) return;

    const latestFive = matches.slice(-5).reverse();

    if (!latestFive.length) {
      holder.innerHTML =
        '<div class="pl-results-empty">No completed Arsenal league matches yet.</div>';
      return;
    }

    holder.innerHTML = latestFive.map(match => {
      const parts = match.kickoff_at ? localFixtureParts(match.kickoff_at) : { date:'DATE TBC' };
      const score = `${match.arsenal_score}–${match.opponent_score}`;
      const venue = match.venue || 'Venue TBC';
      const id = match.external_fixture_id || match.id || '';
      const detailsHref = id
        ? `match-details.html?fixture=${encodeURIComponent(id)}`
        : 'fixtures.html';

      return `
        <article class="pl-result-row">
          <span class="pl-result-badge ${resultClass(match.letter)}">
            ${match.letter}
          </span>

          <div class="pl-result-main">
            <strong>
              Arsenal ${match.isHome ? 'vs' : '@'} ${escapeHtml(match.opponent)}
            </strong>

            <small>
              ${escapeHtml(parts.date)} • ${escapeHtml(venue)}
            </small>
          </div>

          <div class="pl-result-score">${escapeHtml(score)}</div>

          <a class="pl-result-link" href="${detailsHref}">
            More Details →
          </a>
        </article>
      `;
    }).join('');
  }

  async function loadArsenalResults() {
    try {
      let fixtures = [];

      if (window.NL4Data && typeof window.NL4Data.fixtures === 'function') {
        fixtures = await window.NL4Data.fixtures();
      } else {
        const client =
          window.nl4Supabase ||
          window.supabaseClient ||
          window.NL4_SUPABASE ||
          window.supabaseDb ||
          window.db;

        if (!client || typeof client.from !== 'function') return;

        const { data, error } = await client
          .from('fixtures')
          .select('*')
          .eq('season','2026/27')
          .eq('competition','Premier League')
          .eq('is_published',true)
          .order('kickoff_at',{ ascending:true });

        if (error) throw error;
        fixtures = data || [];
      }

      const completed = (fixtures || [])
        .filter(row => {
          const status = String(row.status || '').toLowerCase();

          return row &&
            row.season === '2026/27' &&
            row.competition === 'Premier League' &&
            row.is_published !== false &&
            ['fulltime','finished','ft','aet','pen'].includes(status) &&
            row.arsenal_score !== null &&
            row.arsenal_score !== undefined &&
            row.opponent_score !== null &&
            row.opponent_score !== undefined;
        })
        .map(normalizeArsenalFixture)
        .filter(row => row.letter)
        .sort((a,b) => new Date(a.kickoff_at) - new Date(b.kickoff_at));

      renderArsenalForm(completed);
      renderRecentResults(completed);

    } catch (error) {
      console.warn('NL4 Arsenal recent results failed:', error);
    }
  }


  function leaderCard(label, row, stat, unit) {
    if (!row) return '';

    const image = row.image_url
      ? `<img src="${escapeHtml(row.image_url)}" alt="${escapeHtml(row.player_name)}">`
      : `<div class="pl-leader-placeholder">${escapeHtml(clubCode(row.player_name))}</div>`;

    const link = row.profile_url
      ? `<a class="pl-leader-link" href="${escapeHtml(row.profile_url)}">View Player →</a>`
      : '';

    return `
      <article class="pl-leader-card">
        <div class="pl-leader-image">${image}</div>
        <div class="pl-leader-body">
          <span class="pl-leader-type">${label}</span>
          <h3>${escapeHtml(row.player_name)}</h3>
          <div class="pl-leader-value">
            <strong>${Number(row[stat] || 0)}</strong>
            <span>${unit}</span>
          </div>
          ${link}
        </div>
      </article>
    `;
  }

  async function loadPlayerLeaders() {
    const holder = document.getElementById('playerLeadersGrid');
    if (!holder) return;

    try {
      const client =
        window.nl4Supabase ||
        window.supabaseClient ||
        window.NL4_SUPABASE ||
        window.supabaseDb ||
        window.db;

      if (!client || typeof client.from !== 'function') {
        throw new Error('Supabase client not found.');
      }

      const { data, error } = await client
        .from('premier_league_player_stats')
        .select('*')
        .eq('season','2026/27');

      if (error) throw error;
      const rows = data || [];

      if (!rows.length) {
        holder.innerHTML =
          '<div class="pl-results-empty">Add Arsenal Premier League player stats in Admin to populate this section.</div>';
        return;
      }

      const by = key => rows.slice().sort((a,b) =>
        Number(b[key] || 0) - Number(a[key] || 0) ||
        String(a.player_name).localeCompare(String(b.player_name))
      )[0];

      const topScorer = by('goals');
      const topAssists = by('assists');
      const topApps = by('appearances');

      const keepers = rows.filter(r =>
        String(r.position || '').toLowerCase().includes('goal') ||
        Number(r.clean_sheets || 0) > 0
      );
      const topCleanSheets = (keepers.length ? keepers : rows)
        .slice()
        .sort((a,b) => Number(b.clean_sheets || 0) - Number(a.clean_sheets || 0))[0];

      holder.innerHTML =
        leaderCard('TOP SCORER', topScorer, 'goals', 'GOALS') +
        leaderCard('MOST ASSISTS', topAssists, 'assists', 'ASSISTS') +
        leaderCard('MOST APPEARANCES', topApps, 'appearances', 'APPS') +
        leaderCard('MOST CLEAN SHEETS', topCleanSheets, 'clean_sheets', 'CLEAN SHEETS');

    } catch (error) {
      console.warn('NL4 player leaders failed:', error);
      holder.innerHTML =
        '<div class="pl-results-empty">Player leaders could not be loaded.</div>';
    }
  }

  loadStandings();
  loadNextFixture();
  loadArsenalResults();
  loadPlayerLeaders();
})();
