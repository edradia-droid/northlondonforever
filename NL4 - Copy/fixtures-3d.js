/* NL4 Fixtures & Results — Supabase powered */
(function () {
  const grid = document.getElementById('matchesGrid');
  const monthNav = document.getElementById('fixtureMonthNav');
  if (!grid) return;

  const monthNames = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  const TEAM_LOGOS = {
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

  function teamLogo(name) {
    return TEAM_LOGOS[name] || '';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    })[char]);
  }

  function teamCode(name) {
    const fixed = {
      'Arsenal':'ARS', 'AFC Bournemouth':'BOU', 'Aston Villa':'AVL',
      'Brentford':'BRE', 'Brighton & Hove Albion':'BHA', 'Chelsea':'CHE',
      'Coventry City':'COV', 'Crystal Palace':'CRY', 'Everton':'EVE',
      'Fulham':'FUL', 'Hull City':'HUL', 'Ipswich Town':'IPS',
      'Leeds United':'LEE', 'Liverpool':'LIV', 'Manchester City':'MCI',
      'Manchester United':'MUN', 'Newcastle United':'NEW',
      'Nottingham Forest':'NFO', 'Sunderland':'SUN', 'Tottenham Hotspur':'TOT'
    };
    return fixed[name] || String(name || '---').split(/\s+/).map(x => x[0]).join('').slice(0,3).toUpperCase();
  }

  function getClient() {
    return window.nl4Supabase || window.supabaseClient || window.NL4_SUPABASE ||
           window.supabaseDb || window.db || null;
  }

  function localParts(iso) {
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-GB', {
      timeZone:'Europe/London', weekday:'short', day:'2-digit', month:'short', year:'numeric'
    }).toUpperCase();
    const time = d.toLocaleTimeString('en-GB', {
      timeZone:'Europe/London', hour:'2-digit', minute:'2-digit', hour12:false
    });
    const monthParts = new Intl.DateTimeFormat('en-GB', {
      timeZone:'Europe/London', year:'numeric', month:'2-digit'
    }).formatToParts(d);

    const yearPart = monthParts.find(part => part.type === 'year');
    const monthPart = monthParts.find(part => part.type === 'month');

    const year = yearPart ? yearPart.value : String(d.getUTCFullYear());
    const month = monthPart ? monthPart.value.padStart(2, '0') : String(d.getUTCMonth() + 1).padStart(2, '0');

    const monthKey = `${year}-${month}`;
    return { date, time, monthKey };
  }

  function statusInfo(status) {
    const s = String(status || 'scheduled').toLowerCase();
    if (['fulltime','ft','aet','pen'].includes(s)) return { cls:'fulltime', label:'FULL TIME', result:true };
    if (['live','1h','ht','2h','et'].includes(s)) return { cls:'live', label:'LIVE', result:true };
    if (s === 'postponed' || s === 'pst') return { cls:'postponed', label:'POSTPONED', result:false };
    if (s === 'cancelled' || s === 'canc') return { cls:'postponed', label:'CANCELLED', result:false };
    return { cls:'upcoming', label:'UPCOMING', result:false };
  }

  function normalize(row) {
    const isHome = row.is_home === true || row.home_team === 'Arsenal';
    const home = row.home_team || (isHome ? 'Arsenal' : row.opponent);
    const away = row.away_team || (isHome ? row.opponent : 'Arsenal');
    const p = localParts(row.kickoff_at);
    return {
      id: row.external_fixture_id || row.id,
      dbId: row.id,
      matchday: row.matchday,
      home, away,
      homeCode: teamCode(home), awayCode: teamCode(away),
      homeLogo: teamLogo(home), awayLogo: teamLogo(away),
      venue: row.venue || 'Venue TBC',
      kickoffAt: row.kickoff_at,
      dateLabel: p.date,
      time: p.time,
      monthKey: p.monthKey,
      status: row.status,
      homeScore: isHome ? row.arsenal_score : row.opponent_score,
      awayScore: isHome ? row.opponent_score : row.arsenal_score,
      kickoffConfirmed: row.kickoff_confirmed !== false
    };
  }

  function applyTilt() {
    if (!window.matchMedia('(pointer:fine)').matches ||
        window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    document.querySelectorAll('[data-tilt-card]').forEach(card => {
      card.addEventListener('mousemove', event => {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        card.style.setProperty('--mini-rx', ((0.5-y)*4).toFixed(2)+'deg');
        card.style.setProperty('--mini-ry', ((x-0.5)*6).toFixed(2)+'deg');
      });
      card.addEventListener('mouseleave', () => {
        card.style.setProperty('--mini-rx','0deg');
        card.style.setProperty('--mini-ry','0deg');
      });
    });
  }

  function render(matches) {
    const groups = new Map();
    matches.forEach(match => {
      if (!groups.has(match.monthKey)) groups.set(match.monthKey, []);
      groups.get(match.monthKey).push(match);
    });

    if (monthNav) {
      monthNav.innerHTML = [...groups.keys()].map(key => {
        const [year, month] = key.split('-');
        const monthIndex = Math.max(0, Math.min(11, Number(month) - 1));
        const monthName = monthNames[monthIndex] || 'Month';
        return `<a href="#month-${key}">${monthName.slice(0,3).toUpperCase()} ${year}</a>`;
      }).join('');
    }

    grid.innerHTML = [...groups.entries()].map(([key, items]) => {
      const [year, month] = key.split('-');
      const monthIndex = Math.max(0, Math.min(11, Number(month) - 1));
      const heading = `${monthNames[monthIndex] || 'Month'} ${year}`;
      const cards = items.map(match => {
        const state = statusInfo(match.status);
        const hasScore = match.homeScore !== null && match.homeScore !== undefined &&
                         match.awayScore !== null && match.awayScore !== undefined;
        const score = state.result && hasScore
          ? `<div class="result-score"><b>${escapeHtml(match.homeScore)}</b><em>—</em><b>${escapeHtml(match.awayScore)}</b></div>`
          : `<span class="fixture-vs">VS</span>`;
        const confirmedText = match.kickoffConfirmed ? '' : ' • TIME PROVISIONAL';

        return `
          <article class="unified-match-card${state.result ? ' result-card' : ''}" data-tilt-card data-match-id="${escapeHtml(match.id)}">
            <div class="unified-card-top">
              <span class="competition-pill">PREMIER LEAGUE</span>
              <span class="match-status ${state.cls}">${state.label}</span>
            </div>
            <div class="match-edit-fields">
              <div class="match-edit-field"><small>DATE</small><strong>${match.dateLabel} • ${escapeHtml(match.time)}${confirmedText}</strong></div>
              <div class="match-edit-field"><small>VENUE</small><strong>${escapeHtml(match.venue)}</strong></div>
            </div>
            <div class="unified-teams">
              <div class="unified-team">
                <div class="unified-badge club-crest-badge ${match.home === 'Arsenal' ? 'arsenal-unified' : 'opponent-unified'}">
                  ${match.homeLogo ? `<img class="club-crest-img" src="${escapeHtml(match.homeLogo)}" alt="${escapeHtml(match.home)} crest" loading="lazy" referrerpolicy="no-referrer">` : escapeHtml(match.homeCode)}
                </div>
                <h3>${escapeHtml(match.home)}</h3><small>HOME</small>
              </div>
              <div class="unified-score">${score}<small>${state.result ? state.label : escapeHtml(match.time)}</small></div>
              <div class="unified-team">
                <div class="unified-badge club-crest-badge ${match.away === 'Arsenal' ? 'arsenal-unified' : 'opponent-unified'}">
                  ${match.awayLogo ? `<img class="club-crest-img" src="${escapeHtml(match.awayLogo)}" alt="${escapeHtml(match.away)} crest" loading="lazy" referrerpolicy="no-referrer">` : escapeHtml(match.awayCode)}
                </div>
                <h3>${escapeHtml(match.away)}</h3><small>AWAY</small>
              </div>
            </div>
            <div class="unified-card-bottom">
              <span>MATCH ${String(match.matchday || '').padStart(2,'0')} / 38</span>
              <div class="fixture-card-actions" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <a class="predict-lineup-link details-link" href="predict-lineup.html?fixture=${encodeURIComponent(match.id)}">Predict Lineup</a>
                <a class="details-link" href="match-details.html?fixture=${encodeURIComponent(match.id)}">More Details →</a>
              </div>
            </div>
          </article>`;
      }).join('');
      return `<section class="fixture-month-block" id="month-${key}">
        <div class="fixture-month-heading"><span>${heading}</span><small>${items.length} MATCH${items.length === 1 ? '' : 'ES'}</small></div>
        <div class="fixture-month-cards">${cards}</div></section>`;
    }).join('');
    applyTilt();
  }

  async function loadFixtures() {
    grid.innerHTML = '<div class="fixtures-loading">Loading Arsenal fixtures from Supabase…</div>';

    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Fixture request timed out.')), 12000);
    });

    async function fetchDirect() {
      const client = getClient();
      if (!client || typeof client.from !== 'function') {
        throw new Error('Supabase client was not found.');
      }

      const request = client
        .from('fixtures')
        .select('id,opponent,competition,venue,kickoff_at,arsenal_score,opponent_score,status,is_published,season,matchday,is_home,home_team,away_team,external_fixture_id,kickoff_confirmed')
        .eq('season','2026/27')
        .eq('competition','Premier League')
        .eq('is_published',true)
        .order('matchday',{ ascending:true });

      const result = await Promise.race([request, timeout]);
      if (result.error) throw result.error;
      return result.data || [];
    }

    async function fetchViaNL4Data() {
      if (!window.NL4Data || typeof window.NL4Data.fixtures !== 'function') {
        throw new Error('NL4Data fixture helper is unavailable.');
      }

      const result = await Promise.race([
        window.NL4Data.fixtures(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('NL4Data request timed out.')), 12000))
      ]);

      // NL4Data may return all published fixtures; filter this page to PL 2026/27.
      return (result || []).filter(row =>
        row &&
        row.season === '2026/27' &&
        row.competition === 'Premier League' &&
        row.is_published !== false
      );
    }

    try {
      let data = [];

      try {
        data = await fetchDirect();
      } catch (directError) {
        console.warn('NL4 direct Supabase fixture load failed, trying NL4Data fallback:', directError);
        data = await fetchViaNL4Data();
      }

      const matches = data.map(normalize);

      if (!matches.length) {
        throw new Error('No published 2026/27 Premier League fixtures were returned.');
      }

      render(matches);
      console.log(`NL4: ${matches.length} Premier League fixtures loaded from Supabase.`);
    } catch (error) {
      console.error('NL4 fixtures load failed:', error);
      grid.innerHTML = `
        <div class="fixtures-error">
          <strong>Fixtures could not load.</strong><br>
          ${escapeHtml(error.message || 'Unknown error')}<br>
          <button type="button" id="retryFixturesBtn" class="fixture-retry-btn">Retry</button>
        </div>`;

      const retry = document.getElementById('retryFixturesBtn');
      if (retry) {
        retry.addEventListener('click', loadFixtures, { once:true });
      }
    }
  }

  loadFixtures();
})();
