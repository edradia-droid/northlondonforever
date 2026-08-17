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
    const gd = gf - ga; // Always derive GD from the same GF/GA values shown in the table.
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
              ${clubLogo(team.club,"club-mini-logo")}
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




  const CLUB_LOGOS = {
    'AFC Bournemouth': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/AFC%20Bournemouth.png',
    'Arsenal': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Arsenal%20FC.png',
    'Aston Villa': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Aston%20Villa.png',
    'Brentford': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Brentford%20FC.png',
    'Brighton & Hove Albion': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Brighton%20%26%20Hove%20Albion.png',
    'Chelsea': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Chelsea%20FC.png',
    'Coventry City': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Coventry%20City.png',
    'Crystal Palace': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Crystal%20Palace.png',
    'Everton': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Everton%20FC.png',
    'Fulham': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Fulham%20FC.png',
    'Hull City': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Hull%20City.png',
    'Ipswich Town': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Ipswich%20Town.png',
    'Leeds United': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Leeds%20United.png',
    'Liverpool': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Liverpool%20FC.png',
    'Manchester City': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Manchester%20City.png',
    'Manchester United': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Manchester%20United.png',
    'Newcastle United': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Newcastle%20United.png',
    'Nottingham Forest': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Nottingham%20Forest.png',
    'Sunderland': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Sunderland%20AFC.png',
    'Tottenham Hotspur': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Tottenham%20Hotspur.png'
  };
  const CLUB_FOTMOB_IDS = {
    'AFC Bournemouth': 8678,
    'Arsenal': 9825,
    'Aston Villa': 10252,
    'Brentford': 9937,
    'Brighton & Hove Albion': 10204,
    'Chelsea': 8455,
    'Coventry City': 8669,
    'Crystal Palace': 9826,
    'Everton': 8668,
    'Fulham': 9879,
    'Hull City': 8667,
    'Ipswich Town': 9902,
    'Leeds United': 8463,
    'Liverpool': 8650,
    'Manchester City': 8456,
    'Manchester United': 10260,
    'Newcastle United': 10261,
    'Nottingham Forest': 10203,
    'Sunderland': 8472,
    'Tottenham Hotspur': 8586
  };
  const CLUB_GITHUB_FALLBACK = {
    'AFC Bournemouth': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/AFC%20Bournemouth.png',
    'Arsenal': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Arsenal%20FC.png',
    'Aston Villa': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Aston%20Villa.png',
    'Brentford': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Brentford%20FC.png',
    'Brighton & Hove Albion': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Brighton%20%26%20Hove%20Albion.png',
    'Chelsea': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Chelsea%20FC.png',
    'Coventry City': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Coventry%20City.png',
    'Crystal Palace': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Crystal%20Palace.png',
    'Everton': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Everton%20FC.png',
    'Fulham': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Fulham%20FC.png',
    'Hull City': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Hull%20City.png',
    'Ipswich Town': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Ipswich%20Town.png',
    'Leeds United': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Leeds%20United.png',
    'Liverpool': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Liverpool%20FC.png',
    'Manchester City': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Manchester%20City.png',
    'Manchester United': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Manchester%20United.png',
    'Newcastle United': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Newcastle%20United.png',
    'Nottingham Forest': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Nottingham%20Forest.png',
    'Sunderland': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Sunderland%20AFC.png',
    'Tottenham Hotspur': 'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Tottenham%20Hotspur.png'
  };

  function clubLogo(team, className='club-real-logo') {
    const key=String(team||'').trim();
    const id=CLUB_FOTMOB_IDS[key];
    const primary=id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png` : '';
    const backup=CLUB_GITHUB_FALLBACK[key] || CLUB_LOGOS[key] || '';
    if(!primary && !backup) return `<span class="club-logo-fallback">${escapeHtml(clubCode(team))}</span>`;
    const first=primary||backup;
    const second=primary&&backup&&backup!==primary ? backup : '';
    return `<img class="${className}" src="${first}" data-logo-backup="${second}" alt="${escapeHtml(team)} crest" loading="lazy" referrerpolicy="no-referrer"
      onerror="if(this.dataset.logoBackup){this.src=this.dataset.logoBackup;this.dataset.logoBackup='';}else{this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='inline-flex';}">
      <span class="club-logo-fallback" style="display:none">${escapeHtml(clubCode(team))}</span>`;
  }

  function finishedStatus(value) {
    return ['fulltime','finished','ft','aet','pen'].includes(String(value || '').trim().toLowerCase());
  }

  function arsenalFixtureScore(row) {
    const isHome = row.home_team === 'Arsenal' || row.is_home === true;
    const arsenalScore = Number(row.arsenal_score);
    const opponentScore = Number(row.opponent_score);
    if (!Number.isFinite(arsenalScore) || !Number.isFinite(opponentScore)) return null;
    return {
      isHome,
      arsenalScore,
      opponentScore,
      home: row.home_team || (isHome ? 'Arsenal' : row.opponent),
      away: row.away_team || (isHome ? row.opponent : 'Arsenal'),
      opponent: row.opponent || (isHome ? row.away_team : row.home_team) || 'Opponent'
    };
  }

  function fixtureOrder(row) {
    const md = Number(row.matchday);
    if (Number.isFinite(md)) return md;
    const t = row.kickoff_at ? new Date(row.kickoff_at).getTime() : NaN;
    return Number.isFinite(t) ? t : 0;
  }

  function renderArsenalFormAndResults(fixtures) {
    const completed = (fixtures || [])
      .filter(row => row && finishedStatus(row.status))
      .map(row => ({ row, score: arsenalFixtureScore(row) }))
      .filter(item => item.score)
      .sort((a,b) => fixtureOrder(b.row) - fixtureOrder(a.row));

    const formEl = document.getElementById('arsenalFormStrip');
    if (formEl) {
      const lastFive = completed.slice(0,5).reverse();
      if (!lastFive.length) {
        formEl.innerHTML = '<span class="pl-form-empty">No completed league matches yet.</span>';
      } else {
        formEl.innerHTML = lastFive.map(({row,score}) => {
          const outcome = score.arsenalScore > score.opponentScore ? 'W' : score.arsenalScore < score.opponentScore ? 'L' : 'D';
          return `<div class="pl-form-match pl-form-${outcome.toLowerCase()}">
            <span class="pl-form-result">${outcome}</span>
            ${clubLogo(score.opponent,"pl-form-opponent-logo")}
            <strong>${score.arsenalScore}–${score.opponentScore}</strong>
            <small>${escapeHtml(score.opponent)}</small>
          </div>`;
        }).join('');
      }
    }

    const resultsEl = document.getElementById('recentResultsList');
    if (resultsEl) {
      const recent = completed.slice(0,5);
      if (!recent.length) {
        resultsEl.innerHTML = '<div class="pl-results-empty">No completed Arsenal league matches yet.</div>';
      } else {
        resultsEl.innerHTML = recent.map(({row,score}) => {
          const outcome = score.arsenalScore > score.opponentScore ? 'WIN' : score.arsenalScore < score.opponentScore ? 'LOSS' : 'DRAW';
          const date = row.kickoff_at ? new Date(row.kickoff_at).toLocaleDateString('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'short',year:'numeric'}).toUpperCase() : 'DATE TBC';
          const homeGoals = score.isHome ? score.arsenalScore : score.opponentScore;
          const awayGoals = score.isHome ? score.opponentScore : score.arsenalScore;
          return `<article class="pl-result-card pl-card-${outcome.toLowerCase()}">
            <div class="pl-result-meta"><span>${row.matchday ? `MATCHDAY ${escapeHtml(row.matchday)}` : 'PREMIER LEAGUE'}</span><small>${date}</small></div>
            <div class="pl-result-scoreline">
              <div class="pl-result-team">${clubLogo(score.home,"pl-result-team-logo")}<span class="pl-result-team-name">${escapeHtml(score.home)}</span></div>
              <strong class="pl-result-score">${homeGoals}–${awayGoals}</strong>
              <div class="pl-result-team away"><span class="pl-result-team-name">${escapeHtml(score.away)}</span>${clubLogo(score.away,"pl-result-team-logo")}</div>
            </div>
            <span class="pl-result-outcome pl-result-${outcome.toLowerCase()}">ARSENAL ${outcome}</span>
          </article>`;
        }).join('');
      }
    }
  }

  function renderTitleRaceFromStandings(rows) {
    const el = document.getElementById('titleRaceGrid');
    if (!el) return;
    const standings = (rows || []).map(normalizeStanding).sort((a,b) => a.position-b.position).slice(0,6);
    if (!standings.length) {
      el.innerHTML = '<div class="pl-results-empty">No standings available yet.</div>';
      return;
    }
    el.innerHTML = standings.map(team => `<article class="pl-title-race-card ${team.club.toLowerCase()==='arsenal'?'arsenal-race-card':''}">
      <span class="pl-title-race-pos">${team.position}</span>
      <div>${clubLogo(team.club,"pl-race-club-logo")}<strong>${escapeHtml(team.club)}</strong><small>${team.played} played • ${team.wins}W ${team.draws}D ${team.losses}L • GD ${team.gd>0?'+':''}${team.gd}</small></div>
      <b>${team.points}<small>PTS</small></b>
    </article>`).join('');
  }

  async function loadArsenalResults() {
    try {
      const client = window.nl4Supabase || window.supabaseClient || window.NL4_SUPABASE || window.supabaseDb || window.db;
      if (!client || typeof client.from !== 'function') return;
      const { data, error } = await client.from('fixtures')
        .select('home_team,away_team,is_home,opponent,arsenal_score,opponent_score,status,kickoff_at,matchday,competition,season')
        .eq('season','2026/27')
        .eq('competition','Premier League')
        .order('matchday',{ascending:true});
      if (error) throw error;
      renderArsenalFormAndResults(data || []);
    } catch (error) {
      console.warn('NL4 Arsenal results sections failed:', error);
    }
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
      renderTitleRaceFromStandings(data);
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

    const nextHomeBadge = document.getElementById('nextHomeCode');
    const nextAwayBadge = document.getElementById('nextAwayCode');

    if (nextHomeBadge) {
      nextHomeBadge.innerHTML = clubLogo(home, 'pl-next-team-logo');
      nextHomeBadge.setAttribute('aria-label', `${home} crest`);
    }
    if (nextAwayBadge) {
      nextAwayBadge.innerHTML = clubLogo(away, 'pl-next-team-logo');
      nextAwayBadge.setAttribute('aria-label', `${away} crest`);
    }

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

  loadStandings();
  loadArsenalResults();
  loadNextFixture();
})();
