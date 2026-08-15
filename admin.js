console.log("NL4 ADMIN BUILD: 20260815-0518 LINEUPS AUTO STATS");
console.log("NL4 ADMIN BUILD: 20260815-0422 GROUPED PLAYER STATS");
console.log("NL4 ADMIN BUILD: 20260815-0358 FULL PLAYER STATS");
console.log("NL4 ADMIN BUILD: 20260815-0332 CLEAR TEST SCORES");
console.log("NL4 ADMIN BUILD: 20260815-0318 CLEAN STANDINGS REBUILD");
const db = window.nl4Supabase;

const loginView = document.getElementById("loginView");
const adminView = document.getElementById("adminView");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const logoutBtn = document.getElementById("logoutBtn");
const adminEmail = document.getElementById("adminEmail");
const dialog = document.getElementById("editorDialog");
const editorForm = document.getElementById("editorForm");
const editorFields = document.getElementById("editorFields");
const editorTitle = document.getElementById("editorTitle");
const editorMessage = document.getElementById("editorMessage");

let editorState = { table: null, id: null };

const schemas = {
  players: {
    title: "Player",
    order: "sort_order",
    fields: [
      ["name","Name","text",true],["slug","Slug","text",true],["position","Position","text"],
      ["shirt_number","Shirt number","number"],["era","Era","text",true],["image_url","Image URL","url"],
      ["profile_url","Profile page URL","text"],["sort_order","Sort order","number"],
      ["bio","Biography","textarea"],["is_published","Published","checkbox"]
    ]
  },
  news: {
    title: "News story",
    order: "created_at",
    fields: [
      ["title","Headline","text",true],["slug","Slug","text",true],["image_url","Image URL","url"],
      ["published_at","Publish date/time","datetime-local"],["summary","Summary","textarea"],
      ["body","Story","textarea"],["is_published","Published","checkbox"]
    ]
  },
  fixtures: {
    title: "Fixture",
    order: "kickoff_at",
    fields: [
      ["opponent","Opponent","text",true],["competition","Competition","text"],["season","Season","text"],
      ["matchday","Matchday","number"],["is_home","Arsenal at home","checkbox"],["home_team","Home team","text"],["away_team","Away team","text"],
      ["venue","Venue","text"],["kickoff_at","Kick-off","datetime-local",true],["kickoff_confirmed","Kick-off confirmed","checkbox"],
      ["status","Status","select",true,["scheduled","live","fulltime","postponed","cancelled"]],
      ["arsenal_score","Arsenal score","number"],["opponent_score","Opponent score","number"],
      ["match_url","Match page URL","text"],["is_published","Published","checkbox"]
    ]
  },



  premier_league_player_stats: {
    label: "Arsenal Player Stat",
    order: "goals",
    descending: true,
    fields: [
      ["season", "Season", "text", true],
      ["player_name", "Player name", "text", true],
      ["position", "Position", "text", false],
      ["image_url", "Image URL", "url", false],
      ["profile_url", "Profile URL", "url", false],
      ["appearances", "Appearances", "number", false],
      ["starts", "Starts", "number", false],
      ["minutes", "Minutes", "number", false],
      ["goals", "Goals", "number", false],
      ["assists", "Assists", "number", false],
      ["clean_sheets", "Clean sheets", "number", false],
      ["yellow_cards", "Yellow cards", "number", false],
      ["red_cards", "Red cards", "number", false],
      ["man_of_the_match", "Man of the Match", "number", false],
      ["shots", "Shots", "number", false],
      ["shots_on_target", "Shots on target", "number", false],
      ["chances_created", "Chances created", "number", false],
      ["tackles", "Tackles", "number", false],
      ["interceptions", "Interceptions", "number", false],
      ["saves", "Saves", "number", false]
    ]
  },
  premier_league_standings: {
    title: "Premier League club",
    order: "position",
    fields: [
      ["season","Season","text",true],
      ["position","Position","number",true],
      ["club","Club","text",true],
      ["played","Played","number",true],
      ["wins","Wins","number",true],
      ["draws","Draws","number",true],
      ["losses","Losses","number",true],
      ["goals_for","Goals for","number",true],
      ["goals_against","Goals against","number",true],
      ["goal_difference","Goal difference","number",true],
      ["points","Points","number",true]
    ]
  },
  trophies: {
    title: "Trophy",
    order: "sort_order",
    fields: [
      ["name","Trophy name","text",true],["season","Season","text"],["trophy_year","Year","number"],
      ["image_url","Image URL","url"],["sort_order","Sort order","number"],
      ["description","Description","textarea"],["is_published","Published","checkbox"]
    ]
  }
};

const PREMIER_LEAGUE_2026_27_CLUBS = [
  "Arsenal",
  "Aston Villa",
  "AFC Bournemouth",
  "Brentford",
  "Brighton & Hove Albion",
  "Chelsea",
  "Coventry City",
  "Crystal Palace",
  "Everton",
  "Fulham",
  "Hull City",
  "Ipswich Town",
  "Leeds United",
  "Liverpool",
  "Manchester City",
  "Manchester United",
  "Newcastle United",
  "Nottingham Forest",
  "Sunderland",
  "Tottenham Hotspur"
];

async function ensurePremierLeagueStandingsClubs() {
  const season = "2026/27";

  const { data: existing, error: readError } = await db
    .from("premier_league_standings")
    .select("club,position")
    .eq("season", season);

  if (readError) {
    console.warn("Could not check Premier League clubs:", readError.message);
    return;
  }

  const normalizeClub = value => String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  const existingNames = new Set(
    (existing || []).map(row => normalizeClub(row.club))
  );

  const missingClubs = PREMIER_LEAGUE_2026_27_CLUBS.filter(
    club => !existingNames.has(normalizeClub(club))
  );

  if (!missingClubs.length) return;

  const usedPositions = new Set(
    (existing || [])
      .map(row => Number(row.position))
      .filter(position => Number.isInteger(position) && position >= 1 && position <= 20)
  );

  const freePositions = [];
  for (let position = 1; position <= 20; position++) {
    if (!usedPositions.has(position)) freePositions.push(position);
  }

  for (let index = 0; index < missingClubs.length; index++) {
    const club = missingClubs[index];
    const position = freePositions[index] ?? ((existing || []).length + index + 1);

    const row = {
      season,
      position,
      club,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_for: 0,
      goals_against: 0,
      goal_difference: 0,
      points: 0
    };

    const { error: insertError } = await db
      .from("premier_league_standings")
      .insert(row);

    if (insertError) {
      console.warn(`Could not add ${club}:`, insertError.message);
    }
  }
}


async function recalculatePremierLeagueStandings() {
  const season = "2026/27";

  const normalizeClubName = value => String(value || "")
    .trim()
    .replace(/\s+/g, " ");

  const blankRow = club => ({
    season,
    club,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
    goal_difference: 0,
    points: 0
  });

  const table = new Map();

  function ensureClub(name) {
    const club = normalizeClubName(name);
    if (!club) return null;

    let key = club.toLowerCase();
    if (!table.has(key)) table.set(key, blankRow(club));
    return table.get(key);
  }

  function applyResult(homeName, awayName, homeScore, awayScore) {
    if (homeScore === null || homeScore === undefined ||
        awayScore === null || awayScore === undefined) return;

    const home = ensureClub(homeName);
    const away = ensureClub(awayName);
    if (!home || !away) return;

    const hs = Number(homeScore);
    const as = Number(awayScore);
    if (!Number.isFinite(hs) || !Number.isFinite(as)) return;

    home.played++;
    away.played++;

    home.goals_for += hs;
    home.goals_against += as;
    away.goals_for += as;
    away.goals_against += hs;

    if (hs > as) {
      home.wins++;
      away.losses++;
      home.points += 3;
    } else if (hs < as) {
      away.wins++;
      home.losses++;
      away.points += 3;
    } else {
      home.draws++;
      away.draws++;
      home.points++;
      away.points++;
    }
  }

  // Start with every 2026/27 club so the table always remains complete.
  PREMIER_LEAGUE_2026_27_CLUBS.forEach(ensureClub);

  const [{ data: arsenalFixtures, error: fixtureError },
         { data: leagueMatches, error: matchesError }] = await Promise.all([
    db.from("fixtures")
      .select("home_team,away_team,is_home,opponent,arsenal_score,opponent_score,status,competition,season")
      .eq("season", season),
    db.from("premier_league_matches")
      .select("home_team,away_team,home_score,away_score,status,season")
      .eq("season", season)
  ]);

  if (fixtureError) throw fixtureError;
  if (matchesError) throw matchesError;

  (arsenalFixtures || []).forEach(row => {
    const competitionName = String(row.competition || "").trim().toLowerCase();

    if (!competitionName.includes("premier")) return;
    if (!["fulltime","finished","ft"].includes(String(row.status || "").toLowerCase())) return;

    const home = row.home_team || (row.is_home ? "Arsenal" : row.opponent);
    const away = row.away_team || (row.is_home ? row.opponent : "Arsenal");
    const homeScore = row.is_home ? row.arsenal_score : row.opponent_score;
    const awayScore = row.is_home ? row.opponent_score : row.arsenal_score;

    applyResult(home, away, homeScore, awayScore);
  });

  (leagueMatches || []).forEach(row => {
    if (!["fulltime","finished","ft"].includes(String(row.status || "").toLowerCase())) return;
    applyResult(row.home_team, row.away_team, row.home_score, row.away_score);
  });

  let rows = [...table.values()].map(row => ({
    ...row,
    goal_difference: row.goals_for - row.goals_against
  }));

  rows.sort((a, b) =>
    b.points - a.points ||
    b.goal_difference - a.goal_difference ||
    b.goals_for - a.goals_for ||
    a.club.localeCompare(b.club)
  );

  rows = rows.slice(0, 20).map((row, index) => ({
    ...row,
    position: index + 1
  }));

  // Rebuild the current season table in one clean pass.
  // This avoids position collisions and invalid temporary positions.
  const { error: deleteError } = await db
    .from("premier_league_standings")
    .delete()
    .eq("season", season);

  if (deleteError) throw deleteError;

  const { error: insertError } = await db
    .from("premier_league_standings")
    .insert(rows);

  if (insertError) throw insertError;

  await loadTable("premier_league_standings");
}

function setMessage(el, text = "", type = "") {
  el.textContent = text;
  el.className = "message" + (type ? ` ${type}` : "");
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}

function toLocalInput(value) {
  if (!value) return "";
  const d = new Date(value);
  const pad = n => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function normalizeValue(type, value, checked) {
  if (type === "checkbox") return checked;
  if (value === "") return null;
  if (type === "number") return Number(value);
  if (type === "datetime-local") return new Date(value).toISOString();
  return value;
}

async function isAdmin(userId) {
  const { data, error } = await db.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) return false;
  return Boolean(data);
}

async function applySession(session) {
  if (!session?.user) {
    loginView.hidden = false;
    adminView.hidden = true;
    logoutBtn.hidden = true;
    adminEmail.textContent = "";
    return;
  }

  const allowed = await isAdmin(session.user.id);
  if (!allowed) {
    await db.auth.signOut();
    loginView.hidden = false;
    adminView.hidden = true;
    setMessage(loginMessage, "This account is authenticated but is not registered as an NL4 administrator.", "error");
    return;
  }

  loginView.hidden = true;
  adminView.hidden = false;
  logoutBtn.hidden = false;
  adminEmail.textContent = session.user.email || "NL4 Admin";
  await loadAll();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(loginMessage, "Signing in…");

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    setMessage(loginMessage, error.message, "error");
    return;
  }
  await applySession(data.session);
});

logoutBtn.addEventListener("click", async () => {
  await db.auth.signOut();
  await applySession(null);
});

document.querySelectorAll(".nav-link[data-panel]").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-link[data-panel]").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(x => x.classList.remove("active-panel"));
    button.classList.add("active");
    document.getElementById(button.dataset.panel).classList.add("active-panel");
  });
});

document.querySelectorAll("[data-new]").forEach(button => {
  button.addEventListener("click", () => openEditor(button.dataset.new));
});

const recalculateStandingsBtn = document.getElementById("recalculateStandingsBtn");
if (recalculateStandingsBtn) {
  recalculateStandingsBtn.addEventListener("click", async () => {
    const msg = document.getElementById("standingsRecalcMessage");
    setMessage(msg, "Recalculating Premier League standings…");

    try {
      await recalculatePremierLeagueStandings();
      setMessage(msg, "Premier League standings recalculated successfully.", "success");
    } catch (error) {
      console.error("Manual standings recalculation failed:", error);
      setMessage(msg, `Standings update failed: ${error.message}`, "error");
    }
  });
}

function cardHtml(table, row) {
  const image = row.image_url
    ? `<img src="${escapeHtml(row.image_url)}" alt="">`
    : `<div style="height:180px;display:grid;place-items:center;background:#1c1c1c;color:#555">NL4</div>`;

  let title = row.name || row.title || row.opponent || row.club || "Untitled";
  let meta = "";

  if (table === "premier_league_matches") {
    title = `${row.home_team || "Home"} vs ${row.away_team || "Away"}`;
  }

  if (table === "premier_league_player_stats") {
    title = row.player_name || "Arsenal player";
    meta = `${row.position || "Player"} • ${row.appearances ?? 0} apps • ${row.goals ?? 0} goals • ${row.assists ?? 0} assists • ${row.clean_sheets ?? 0} clean sheets`;
  }
  if (table === "players") meta = [row.position,row.era,row.shirt_number ? `#${row.shirt_number}` : ""].filter(Boolean).join(" • ");
  if (table === "news") meta = row.published_at ? new Date(row.published_at).toLocaleString() : "No publish date";
  if (table === "fixtures") meta = `${row.competition || "Fixture"} • ${new Date(row.kickoff_at).toLocaleString()}`;
  if (table === "trophies") meta = [row.season,row.trophy_year].filter(Boolean).join(" • ");
  if (table === "premier_league_standings") meta = `#${row.position ?? "—"} • ${row.points ?? 0} pts • P${row.played ?? 0} W${row.wins ?? 0} D${row.draws ?? 0} L${row.losses ?? 0} • GD ${Number(row.goal_difference || 0) > 0 ? "+" : ""}${row.goal_difference ?? 0}`;
  if (table === "premier_league_matches") {
    const hasScore = row.home_score !== null && row.home_score !== undefined &&
                     row.away_score !== null && row.away_score !== undefined;
    const score = hasScore ? `${row.home_score}–${row.away_score}` : "VS";
    meta = `MD ${row.matchday ?? "—"} • ${score} • ${String(row.status || "scheduled").toUpperCase()}`;
  }

  return `<article class="content-card">
    ${image}
    <div class="card-body">
      <h3>${escapeHtml(title)}</h3>
      <div class="meta">${escapeHtml(meta)}</div>
      ${(table === "premier_league_standings" || table === "premier_league_matches")
        ? ""
        : `<span class="status ${row.is_published ? "live" : ""}">${row.is_published ? "Published" : "Draft"}</span>`}
      <div class="card-actions">
        <button onclick="window.nl4Edit('${table}','${row.id}')">Edit</button>
        <button class="danger" onclick="window.nl4Delete('${table}','${row.id}')">Delete</button>
      </div>
    </div>
  </article>`;
}


let fixtureRows = [];
let currentFixture = null;
let currentEventId = null;
let currentMatchFilter = 'all';

const matchDialog = document.getElementById('matchDialog');
const eventDialog = document.getElementById('eventDialog');
const matchDialogTitle = document.getElementById('matchDialogTitle');
const matchAdminSummary = document.getElementById('matchAdminSummary');
const matchEventsList = document.getElementById('matchEventsList');
const lineupPlayer = document.getElementById('lineupPlayer');
const lineupRole = document.getElementById('lineupRole');
const lineupMinuteOn = document.getElementById('lineupMinuteOn');
const lineupMinuteOff = document.getElementById('lineupMinuteOff');
const lineupMessage = document.getElementById('lineupMessage');
const lineupList = document.getElementById('lineupList');

const matchSaveMessage = document.getElementById('matchSaveMessage');
const eventMessage = document.getElementById('eventMessage');

function fixtureStatusClass(status) {
  const s = String(status || 'scheduled').toLowerCase();
  if (['fulltime','finished','ft'].includes(s)) return 'fulltime';
  if (s === 'live') return 'live';
  return '';
}

function fixtureStatusLabel(status) {
  const s = String(status || 'scheduled').toLowerCase();
  if (['fulltime','finished','ft'].includes(s)) return 'FULL TIME';
  if (s === 'live') return 'LIVE';
  if (s === 'postponed') return 'POSTPONED';
  if (s === 'cancelled') return 'CANCELLED';
  return 'UPCOMING';
}

function isFinishedFixture(row) {
  return ['fulltime','finished','ft'].includes(String(row.status || '').toLowerCase());
}

function renderFixtureAdminList() {
  const holder = document.getElementById('fixturesList');
  let rows = fixtureRows;
  if (currentMatchFilter === 'upcoming') rows = rows.filter(r => !isFinishedFixture(r));
  if (currentMatchFilter === 'finished') rows = rows.filter(isFinishedFixture);

  document.getElementById('fixturesAdminStatus').textContent = `${rows.length} match${rows.length === 1 ? '' : 'es'}`;
  holder.innerHTML = rows.length ? rows.map(row => {
    const home = row.home_team || (row.is_home ? 'Arsenal' : row.opponent);
    const away = row.away_team || (row.is_home ? row.opponent : 'Arsenal');
    const hasScore = row.arsenal_score !== null && row.arsenal_score !== undefined && row.opponent_score !== null && row.opponent_score !== undefined;
    const homeScore = row.is_home ? row.arsenal_score : row.opponent_score;
    const awayScore = row.is_home ? row.opponent_score : row.arsenal_score;
    const score = hasScore ? `${homeScore} — ${awayScore}` : 'VS';
    return `<article class="admin-match-row">
      <div class="admin-match-number">#${String(row.matchday || '—').padStart(2,'0')}</div>
      <div class="admin-match-main">
        <strong>${escapeHtml(home)} vs ${escapeHtml(away)}</strong>
        <div class="admin-match-meta">${escapeHtml(row.venue || 'Venue TBC')} • ${escapeHtml(new Date(row.kickoff_at).toLocaleString())}</div>
      </div>
      <div class="admin-match-result">
        <span class="admin-match-status ${fixtureStatusClass(row.status)}">${fixtureStatusLabel(row.status)}</span>
        <span class="admin-match-score">${escapeHtml(score)}</span>
        <button type="button" onclick="window.nl4ManageMatch('${row.id}')">Manage</button>
      </div>
    </article>`;
  }).join('') : '<div class="match-empty">No matches in this view.</div>';
}



const clearEditorBtn = document.getElementById('clearEditorBtn');
if (clearEditorBtn) {
  clearEditorBtn.addEventListener('click', () => {
    if (!confirm('Clear all fields in this editor? This does not delete the saved record until you save the cleared values.')) return;
    editorFields.querySelectorAll('input, textarea, select').forEach(field => {
      if (field.type === 'checkbox') field.checked = false;
      else if (field.tagName === 'SELECT') field.selectedIndex = 0;
      else field.value = '';
    });
    setMessage(editorMessage, 'Fields cleared. Save only if you want to keep these cleared values.', 'success');
  });
}

async function loadFixturesAdmin() {
  const holder = document.getElementById('fixturesList');
  holder.innerHTML = '<div class="match-empty">Loading fixtures…</div>';
  let query = db.from('fixtures').select('*').order('matchday', { ascending:true });
  const { data, error } = await query;
  if (error) {
    holder.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
    return;
  }
  fixtureRows = (data || []).sort((a,b) => {
    const aPL = a.season === '2026/27' && a.competition === 'Premier League' ? 0 : 1;
    const bPL = b.season === '2026/27' && b.competition === 'Premier League' ? 0 : 1;
    return aPL - bPL || (a.matchday || 999) - (b.matchday || 999) || new Date(a.kickoff_at) - new Date(b.kickoff_at);
  });
  renderFixtureAdminList();
}


async function populateLineupPlayers() {
  const { data, error } = await db.from('premier_league_player_stats')
    .select('player_name,position').eq('season','2026/27').order('player_name');

  if (error) {
    lineupPlayer.innerHTML = '<option value="">Could not load squad</option>';
    return;
  }

  lineupPlayer.innerHTML = '<option value="">Select Arsenal player</option>' +
    (data || []).map(p =>
      `<option value="${escapeHtml(p.player_name)}" data-position="${escapeHtml(p.position || '')}">${escapeHtml(p.player_name)} — ${escapeHtml(p.position || 'Player')}</option>`
    ).join('');
}

async function loadMatchLineup() {
  if (!currentFixture) return;
  lineupList.innerHTML = '<div class="match-empty">Loading lineup…</div>';

  const { data, error } = await db.from('match_lineups').select('*')
    .eq('fixture_id', currentFixture.id)
    .order('is_starter', { ascending:false })
    .order('minute_on', { ascending:true });

  if (error) {
    lineupList.innerHTML = `<div class="match-empty">${escapeHtml(error.message)}</div>`;
    return;
  }

  lineupList.innerHTML = (data || []).length ? data.map(row => {
    const end = row.minute_off ?? 90;
    const mins = Math.max(0, Math.min(90,end) - Math.min(90,row.minute_on ?? 0));
    return `<div class="admin-event-row">
      <span class="admin-event-type">${row.is_starter ? 'START' : 'SUB'}</span>
      <div class="admin-event-player"><strong>${escapeHtml(row.player_name)}</strong><small>${escapeHtml(row.position || 'Player')} • ${mins} min</small></div>
      <span class="admin-event-minute">${row.is_starter ? "0'" : `${row.minute_on}'`}${row.minute_off != null ? ` → ${row.minute_off}'` : ''}</span>
      <div class="admin-event-actions">
        <button class="danger" type="button" onclick="window.nl4DeleteLineupPlayer('${row.id}')">Delete</button>
      </div>
    </div>`;
  }).join('') : '<div class="match-empty">No Arsenal lineup recorded yet.</div>';
}

lineupRole.addEventListener('change', () => {
  const starter = lineupRole.value === 'starter';
  lineupMinuteOn.disabled = starter;
  lineupMinuteOn.value = starter ? '0' : '';
});
lineupMinuteOn.disabled = true;


document.getElementById('clearLineupBtn').addEventListener('click', async () => {
  if (!currentFixture) return;
  if (!confirm('Clear the entire Arsenal lineup and substitutions for this fixture? This deletes the saved lineup from Supabase.')) return;

  setMessage(lineupMessage, 'Clearing lineup…');
  const { error } = await db.from('match_lineups').delete().eq('fixture_id', currentFixture.id);
  if (error) return setMessage(lineupMessage, error.message, 'error');

  lineupPlayer.value = '';
  lineupRole.value = 'starter';
  lineupMinuteOn.value = '0';
  lineupMinuteOn.disabled = true;
  lineupMinuteOff.value = '';

  setMessage(lineupMessage, 'Lineup and substitutions cleared.', 'success');
  await loadMatchLineup();
  await loadTable('premier_league_player_stats');
});

document.getElementById('saveLineupPlayerBtn').addEventListener('click', async () => {
  if (!currentFixture) return;
  const playerName = lineupPlayer.value;
  if (!playerName) return setMessage(lineupMessage,'Select a player.','error');

  const selected = lineupPlayer.options[lineupPlayer.selectedIndex];
  const isStarter = lineupRole.value === 'starter';
  const minuteOn = isStarter ? 0 : Number(lineupMinuteOn.value);
  const minuteOff = lineupMinuteOff.value === '' ? null : Number(lineupMinuteOff.value);

  if (!isStarter && (!Number.isFinite(minuteOn) || minuteOn < 0))
    return setMessage(lineupMessage,'Enter minute on for the substitute.','error');
  if (minuteOff !== null && minuteOff < minuteOn)
    return setMessage(lineupMessage,'Minute off cannot be before minute on.','error');

  const payload = {
    fixture_id: currentFixture.id,
    player_name: playerName,
    position: selected.dataset.position || null,
    is_starter: isStarter,
    minute_on: minuteOn,
    minute_off: minuteOff,
    updated_at: new Date().toISOString()
  };

  const { data: existing, error: findError } = await db.from('match_lineups')
    .select('id').eq('fixture_id',currentFixture.id).eq('player_name',playerName).maybeSingle();
  if (findError) return setMessage(lineupMessage,findError.message,'error');

  const response = existing?.id
    ? await db.from('match_lineups').update(payload).eq('id',existing.id)
    : await db.from('match_lineups').insert(payload);

  if (response.error) return setMessage(lineupMessage,response.error.message,'error');

  setMessage(lineupMessage,`${playerName} saved.`, 'success');
  lineupPlayer.value = '';
  lineupRole.value = 'starter';
  lineupMinuteOn.value = '0';
  lineupMinuteOn.disabled = true;
  lineupMinuteOff.value = '';
  await loadMatchLineup();
  await loadTable('premier_league_player_stats');
});

window.nl4DeleteLineupPlayer = async id => {
  if (!confirm('Remove this player from the lineup?')) return;
  const { error } = await db.from('match_lineups').delete().eq('id',id);
  if (error) return setMessage(lineupMessage,error.message,'error');
  await loadMatchLineup();
  await loadTable('premier_league_player_stats');
};

async function loadMatchEvents() {
  if (!currentFixture) return;
  matchEventsList.innerHTML = '<div class="match-empty">Loading events…</div>';
  const { data, error } = await db.from('match_events').select('*').eq('fixture_id', currentFixture.id)
    .order('minute', { ascending:true, nullsFirst:false }).order('stoppage_minute', { ascending:true, nullsFirst:false });
  if (error) {
    matchEventsList.innerHTML = `<div class="match-empty">${escapeHtml(error.message)}</div>`;
    return;
  }
  matchEventsList.innerHTML = data.length ? data.map(event => {
    const minute = event.minute === null || event.minute === undefined ? '—' : `${event.minute}${event.stoppage_minute ? '+' + event.stoppage_minute : ''}'`;
    const label = {goal:'GOAL',assist:'ASSIST',yellow_card:'YELLOW',red_card:'RED'}[event.event_type] || event.event_type;
    return `<div class="admin-event-row">
      <span class="admin-event-type">${escapeHtml(label)}</span>
      <div class="admin-event-player"><strong>${escapeHtml(event.player_name)}</strong><small>${escapeHtml(event.team_name)}${event.related_player_name ? ' • Related: ' + escapeHtml(event.related_player_name) : ''}</small></div>
      <span class="admin-event-minute">${minute}</span>
      <div class="admin-event-actions">
        <button type="button" onclick="window.nl4EditMatchEvent('${event.id}')">Edit</button>
        <button class="danger" type="button" onclick="window.nl4DeleteMatchEvent('${event.id}')">Delete</button>
      </div>
    </div>`;
  }).join('') : '<div class="match-empty">No match events recorded yet.</div>';
}

window.nl4ManageMatch = async function(id) {
  const { data, error } = await db.from('fixtures').select('*').eq('id', id).single();
  if (error) return alert(error.message);
  currentFixture = data;
  const home = data.home_team || (data.is_home ? 'Arsenal' : data.opponent);
  const away = data.away_team || (data.is_home ? data.opponent : 'Arsenal');
  matchDialogTitle.textContent = `${home} vs ${away}`;
  matchAdminSummary.innerHTML = `<strong>${escapeHtml(home)} vs ${escapeHtml(away)}</strong><span>Match ${escapeHtml(data.matchday || '—')} • ${escapeHtml(data.competition || '')} • ${escapeHtml(data.season || '')}</span>`;
  document.getElementById('matchStatus').value = isFinishedFixture(data) ? 'fulltime' : (data.status || 'scheduled');
  document.getElementById('matchKickoff').value = toLocalInput(data.kickoff_at);
  document.getElementById('matchVenue').value = data.venue || '';
  document.getElementById('matchKickoffConfirmed').checked = data.kickoff_confirmed !== false;
  document.getElementById('matchArsenalScore').value = data.arsenal_score ?? '';
  document.getElementById('matchOpponentScore').value = data.opponent_score ?? '';
  document.getElementById('matchHTArsenalScore').value = data.halftime_arsenal_score ?? '';
  document.getElementById('matchHTOpponentScore').value = data.halftime_opponent_score ?? '';
  document.getElementById('matchReferee').value = data.referee || '';
  document.getElementById('matchAttendance').value = data.attendance ?? '';
  document.getElementById('matchMOTM').value = data.man_of_the_match || '';
  document.getElementById('statsHomeName').textContent = home;
  document.getElementById('statsAwayName').textContent = away;
  document.getElementById('statHomePossession').value = data.home_possession ?? '';
  document.getElementById('statAwayPossession').value = data.away_possession ?? '';
  document.getElementById('statHomeShots').value = data.home_shots ?? '';
  document.getElementById('statAwayShots').value = data.away_shots ?? '';
  document.getElementById('statHomeSOT').value = data.home_shots_on_target ?? '';
  document.getElementById('statAwaySOT').value = data.away_shots_on_target ?? '';
  document.getElementById('statHomeCorners').value = data.home_corners ?? '';
  document.getElementById('statAwayCorners').value = data.away_corners ?? '';
  document.getElementById('statHomeFouls').value = data.home_fouls ?? '';
  document.getElementById('statAwayFouls').value = data.away_fouls ?? '';
  document.getElementById('statHomeOffsides').value = data.home_offsides ?? '';
  document.getElementById('statAwayOffsides').value = data.away_offsides ?? '';
  document.getElementById('statHomeSaves').value = data.home_saves ?? '';
  document.getElementById('statAwaySaves').value = data.away_saves ?? '';

  setMessage(matchSaveMessage);
  setMessage(lineupMessage);
  await populateLineupPlayers();
  await loadMatchLineup();
  await loadMatchEvents();
  matchDialog.showModal();
};

async function saveCurrentMatch() {
  if (!currentFixture) return;
  const status = document.getElementById('matchStatus').value;
  const scoreA = document.getElementById('matchArsenalScore').value;
  const scoreO = document.getElementById('matchOpponentScore').value;
  const payload = {
    status,
    kickoff_at: new Date(document.getElementById('matchKickoff').value).toISOString(),
    venue: document.getElementById('matchVenue').value.trim() || null,
    kickoff_confirmed: document.getElementById('matchKickoffConfirmed').checked,
    arsenal_score: scoreA === '' ? null : Number(scoreA),
    opponent_score: scoreO === '' ? null : Number(scoreO),
    halftime_arsenal_score: document.getElementById('matchHTArsenalScore').value === '' ? null : Number(document.getElementById('matchHTArsenalScore').value),
    halftime_opponent_score: document.getElementById('matchHTOpponentScore').value === '' ? null : Number(document.getElementById('matchHTOpponentScore').value),
    referee: document.getElementById('matchReferee').value.trim() || null,
    attendance: document.getElementById('matchAttendance').value === '' ? null : Number(document.getElementById('matchAttendance').value),
    man_of_the_match: document.getElementById('matchMOTM').value.trim() || null,
    updated_at: new Date().toISOString()
  };
  setMessage(matchSaveMessage, 'Saving…');
  const { data, error } = await db.from('fixtures').update(payload).eq('id', currentFixture.id).select('*').single();
  if (error) return setMessage(matchSaveMessage, error.message, 'error');
  currentFixture = data;

  const isPremierLeague =
    String(data.competition || '').trim().toLowerCase().includes('premier') &&
    String(data.season || '').trim() === '2026/27';

  if (isPremierLeague) {
    const hasFullTimeScore =
      payload.arsenal_score !== null &&
      payload.opponent_score !== null;

    setMessage(
      matchSaveMessage,
      hasFullTimeScore && status === 'fulltime'
        ? 'Match saved. Recalculating Premier League standings…'
        : 'Match saved. Removing any cleared/test result from the standings…',
      'success'
    );

    try {
      await recalculatePremierLeagueStandings();

      if (hasFullTimeScore && status === 'fulltime') {
        setMessage(
          matchSaveMessage,
          'Match saved and Premier League standings updated.',
          'success'
        );
      } else if (!hasFullTimeScore) {
        setMessage(
          matchSaveMessage,
          'Scores cleared and Premier League standings recalculated.',
          'success'
        );
      } else {
        setMessage(
          matchSaveMessage,
          'Score saved, but it will not count in the table until Status is Full Time.',
          'success'
        );
      }
    } catch (standingsError) {
      console.error('Standings recalculation failed:', standingsError);
      setMessage(
        matchSaveMessage,
        `Match saved, but standings update failed: ${standingsError.message}`,
        'error'
      );
    }
  } else {
    setMessage(
      matchSaveMessage,
      'Match saved. Public fixtures will use this data.',
      'success'
    );
  }

  await loadFixturesAdmin();
  if (isPremierLeague) await loadTable('premier_league_player_stats');
}

document.getElementById('saveMatchBtn').addEventListener('click', saveCurrentMatch);

document.getElementById('clearMatchScoresBtn').addEventListener('click', async () => {
  if (!currentFixture) return;

  if (!confirm('Clear the full-time and half-time scores for this fixture?')) return;

  setMessage(matchSaveMessage, 'Clearing scores…');

  const payload = {
    arsenal_score: null,
    opponent_score: null,
    halftime_arsenal_score: null,
    halftime_opponent_score: null,
    status: 'scheduled',
    updated_at: new Date().toISOString()
  };

  const { data, error } = await db
    .from('fixtures')
    .update(payload)
    .eq('id', currentFixture.id)
    .select('*')
    .single();

  if (error) {
    setMessage(matchSaveMessage, `Could not clear scores: ${error.message}`, 'error');
    return;
  }

  currentFixture = data;

  document.getElementById('matchStatus').value = 'scheduled';
  document.getElementById('matchArsenalScore').value = '';
  document.getElementById('matchOpponentScore').value = '';
  document.getElementById('matchHTArsenalScore').value = '';
  document.getElementById('matchHTOpponentScore').value = '';

  const isPremierLeague =
    String(data.competition || '').trim().toLowerCase().includes('premier') &&
    String(data.season || '').trim() === '2026/27';

  if (isPremierLeague) {
    try {
      await recalculatePremierLeagueStandings();
      setMessage(
        matchSaveMessage,
        'Test scores cleared. Premier League standings recalculated.',
        'success'
      );
    } catch (standingsError) {
      console.error('Standings recalculation after clearing scores failed:', standingsError);
      setMessage(
        matchSaveMessage,
        `Scores cleared, but standings update failed: ${standingsError.message}`,
        'error'
      );
    }
  } else {
    setMessage(matchSaveMessage, 'Scores cleared.', 'success');
  }

  await loadFixturesAdmin();
});
document.getElementById('closeMatchDialog').addEventListener('click', () => matchDialog.close());
document.getElementById('doneMatchDialog').addEventListener('click', async () => {
  if (currentFixture &&
      String(currentFixture.competition || '').trim().toLowerCase() === 'premier league' &&
      String(currentFixture.season || '').trim() === '2026/27') {
    await loadTable('premier_league_standings');
  }
  matchDialog.close();
});

document.querySelectorAll('[data-match-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-match-filter]').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    currentMatchFilter = btn.dataset.matchFilter;
    renderFixtureAdminList();
  });
});


function adminStatValue(id, decimal = false) {
  const value = document.getElementById(id).value;
  if (value === '') return null;
  return decimal ? Number.parseFloat(value) : Number.parseInt(value, 10);
}

document.getElementById('saveStatsBtn').addEventListener('click', async () => {
  if (!currentFixture) return;
  const msg = document.getElementById('statsSaveMessage');
  const payload = {
    home_possession: adminStatValue('statHomePossession', true),
    away_possession: adminStatValue('statAwayPossession', true),
    home_shots: adminStatValue('statHomeShots'),
    away_shots: adminStatValue('statAwayShots'),
    home_shots_on_target: adminStatValue('statHomeSOT'),
    away_shots_on_target: adminStatValue('statAwaySOT'),
    home_corners: adminStatValue('statHomeCorners'),
    away_corners: adminStatValue('statAwayCorners'),
    home_fouls: adminStatValue('statHomeFouls'),
    away_fouls: adminStatValue('statAwayFouls'),
    home_offsides: adminStatValue('statHomeOffsides'),
    away_offsides: adminStatValue('statAwayOffsides'),
    home_saves: adminStatValue('statHomeSaves'),
    away_saves: adminStatValue('statAwaySaves'),
    updated_at: new Date().toISOString()
  };
  if ((payload.home_possession !== null && (payload.home_possession < 0 || payload.home_possession > 100)) ||
      (payload.away_possession !== null && (payload.away_possession < 0 || payload.away_possession > 100))) {
    return setMessage(msg, 'Possession must be between 0 and 100.', 'error');
  }
  setMessage(msg, 'Saving…');
  const { data, error } = await db.from('fixtures').update(payload).eq('id', currentFixture.id).select('*').single();
  if (error) return setMessage(msg, error.message, 'error');
  currentFixture = data;
  setMessage(msg, 'Statistics saved.', 'success');
});


document.getElementById('clearStatsBtn').addEventListener('click', async () => {
  if (!currentFixture) return;
  const msg = document.getElementById('statsSaveMessage');
  if (!confirm('Clear all saved match statistics for this fixture?')) return;

  const payload = {
    home_possession:null, away_possession:null,
    home_shots:null, away_shots:null,
    home_shots_on_target:null, away_shots_on_target:null,
    home_corners:null, away_corners:null,
    home_fouls:null, away_fouls:null,
    home_offsides:null, away_offsides:null,
    home_saves:null, away_saves:null,
    updated_at:new Date().toISOString()
  };

  setMessage(msg, 'Clearing statistics…');
  const { data, error } = await db.from('fixtures').update(payload).eq('id', currentFixture.id).select('*').single();
  if (error) return setMessage(msg, error.message, 'error');
  currentFixture = data;

  ['statHomePossession','statAwayPossession','statHomeShots','statAwayShots','statHomeSOT','statAwaySOT','statHomeCorners','statAwayCorners','statHomeFouls','statAwayFouls','statHomeOffsides','statAwayOffsides','statHomeSaves','statAwaySaves']
    .forEach(id => { const el=document.getElementById(id); if (el) el.value=''; });

  setMessage(msg, 'Match statistics cleared.', 'success');
});

function openEventEditor(event = null) {
  if (!currentFixture) return;
  currentEventId = event?.id || null;
  document.getElementById('eventDialogTitle').textContent = event ? 'Edit event' : 'Add event';
  document.getElementById('eventType').value = event?.event_type || 'goal';
  document.getElementById('eventPlayer').value = event?.player_name || '';
  document.getElementById('eventMinute').value = event?.minute ?? '';
  document.getElementById('eventStoppage').value = event?.stoppage_minute ?? '';
  document.getElementById('eventRelatedPlayer').value = event?.related_player_name || '';
  const home = currentFixture.home_team || (currentFixture.is_home ? 'Arsenal' : currentFixture.opponent);
  const away = currentFixture.away_team || (currentFixture.is_home ? currentFixture.opponent : 'Arsenal');
  const teamSelect = document.getElementById('eventTeam');
  teamSelect.innerHTML = `<option value="${escapeHtml(home)}">${escapeHtml(home)}</option><option value="${escapeHtml(away)}">${escapeHtml(away)}</option>`;
  teamSelect.value = event?.team_name || home;
  setMessage(eventMessage);
  eventDialog.showModal();
}

document.getElementById('addEventBtn').addEventListener('click', () => openEventEditor());
document.getElementById('closeEventDialog').addEventListener('click', () => eventDialog.close());
document.getElementById('cancelEventDialog').addEventListener('click', () => eventDialog.close());

document.getElementById('clearEventBtn').addEventListener('click', () => {
  if (!confirm('Clear the event editor fields?')) return;
  currentEventId = null;
  document.getElementById('eventDialogTitle').textContent = 'Add event';
  document.getElementById('eventType').value = 'goal';
  document.getElementById('eventPlayer').value = '';
  document.getElementById('eventMinute').value = '';
  document.getElementById('eventStoppage').value = '';
  document.getElementById('eventRelatedPlayer').value = '';
  if (document.getElementById('eventTeam').options.length) document.getElementById('eventTeam').selectedIndex = 0;
  setMessage(eventMessage, 'Event fields cleared.', 'success');
});

document.getElementById('clearAllEventsBtn').addEventListener('click', async () => {
  if (!currentFixture) return;
  if (!confirm('Clear ALL goals, assists and cards saved for this fixture? This deletes them from Supabase.')) return;
  const { error } = await db.from('match_events').delete().eq('fixture_id', currentFixture.id);
  if (error) return alert(error.message);
  await loadMatchEvents();
});


window.nl4EditMatchEvent = async function(id) {
  const { data, error } = await db.from('match_events').select('*').eq('id', id).single();
  if (error) return alert(error.message);
  openEventEditor(data);
};

window.nl4DeleteMatchEvent = async function(id) {
  if (!confirm('Delete this match event?')) return;
  const { error } = await db.from('match_events').delete().eq('id', id);
  if (error) return alert(error.message);
  await loadMatchEvents();
};

document.getElementById('saveEventBtn').addEventListener('click', async () => {
  if (!currentFixture) return;
  const minute = document.getElementById('eventMinute').value;
  const stoppage = document.getElementById('eventStoppage').value;
  const payload = {
    fixture_id: currentFixture.id,
    event_type: document.getElementById('eventType').value,
    player_name: document.getElementById('eventPlayer').value.trim(),
    team_name: document.getElementById('eventTeam').value,
    minute: minute === '' ? null : Number(minute),
    stoppage_minute: stoppage === '' ? null : Number(stoppage),
    related_player_name: document.getElementById('eventRelatedPlayer').value.trim() || null,
    updated_at: new Date().toISOString()
  };
  if (!payload.player_name) return setMessage(eventMessage, 'Player name is required.', 'error');
  setMessage(eventMessage, 'Saving…');
  let response;
  if (currentEventId) response = await db.from('match_events').update(payload).eq('id', currentEventId);
  else response = await db.from('match_events').insert(payload);
  if (response.error) return setMessage(eventMessage, response.error.message, 'error');
  setMessage(eventMessage, 'Event saved.', 'success');
  await loadMatchEvents();
  setTimeout(() => eventDialog.close(), 250);
});


let plPlayerStatsRows = [];
let plPlayerStatsPositionFilter = "all";
let plPlayerStatsSearch = "";

function renderPremierLeaguePlayerStatsAdmin() {
  const holder = document.getElementById("premier_league_player_statsGrouped");
  if (!holder) return;

  const query = plPlayerStatsSearch.trim().toLowerCase();
  const groups = ["Goalkeeper", "Defender", "Midfielder", "Forward"];

  let filtered = plPlayerStatsRows.filter(row => {
    const matchesPosition =
      plPlayerStatsPositionFilter === "all" ||
      String(row.position || "") === plPlayerStatsPositionFilter;

    const matchesSearch =
      !query ||
      String(row.player_name || "").toLowerCase().includes(query);

    return matchesPosition && matchesSearch;
  });

  if (!filtered.length) {
    holder.innerHTML = '<div class="pl-admin-empty">No Arsenal players match this view.</div>';
    return;
  }

  holder.innerHTML = groups.map(group => {
    const rows = filtered.filter(row => String(row.position || "") === group);
    if (!rows.length) return "";

    return `<section class="pl-player-group">
      <div class="pl-player-group-head">
        <h3>${escapeHtml(group)}s</h3>
        <span>${rows.length} player${rows.length === 1 ? "" : "s"}</span>
      </div>
      <div class="pl-admin-player-grid">
        ${rows.map(row => `
          <article class="pl-admin-player-card">
            <h4>${escapeHtml(row.player_name || "Unnamed player")}</h4>
            <div class="meta">${escapeHtml(row.position || "Player")} • ${escapeHtml(row.season || "")}</div>

            <div class="pl-admin-player-stats">
              <div class="pl-admin-mini-stat"><strong>${row.appearances ?? 0}</strong><span>APP</span></div>
              <div class="pl-admin-mini-stat"><strong>${row.goals ?? 0}</strong><span>GOALS</span></div>
              <div class="pl-admin-mini-stat"><strong>${row.assists ?? 0}</strong><span>ASSISTS</span></div>
              <div class="pl-admin-mini-stat"><strong>${row.man_of_the_match ?? 0}</strong><span>MOTM</span></div>
            </div>

            <div class="card-actions">
              <button class="primary-btn" type="button" onclick="window.nl4Edit('premier_league_player_stats','${row.id}')">
                Edit Stats
              </button>
            </div>
          </article>
        `).join("")}
      </div>
    </section>`;
  }).join("");
}

const plPlayerSearch = document.getElementById("plPlayerSearch");
if (plPlayerSearch) {
  plPlayerSearch.addEventListener("input", event => {
    plPlayerStatsSearch = event.target.value || "";
    renderPremierLeaguePlayerStatsAdmin();
  });
}

document.querySelectorAll("[data-pl-position]").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-pl-position]").forEach(x => x.classList.remove("active"));
    button.classList.add("active");
    plPlayerStatsPositionFilter = button.dataset.plPosition;
    renderPremierLeaguePlayerStatsAdmin();
  });
});

async function loadTable(table) {
  if (table === "fixtures") return loadFixturesAdmin();
  if (table === "premier_league_standings") await ensurePremierLeagueStandingsClubs();
  const schema = schemas[table];
  const ascending = table !== "news";
  let query = db.from(table).select("*");
  if (table === "premier_league_standings") query = query.eq("season", "2026/27");
  const { data, error } = await query.order(schema.order, { ascending });

  const holder = document.getElementById(`${table}List`);
  if (error) {
    if (holder) holder.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
    if (table === "premier_league_player_stats") {
      const grouped = document.getElementById("premier_league_player_statsGrouped");
      if (grouped) grouped.innerHTML = `<div class="pl-admin-empty">${escapeHtml(error.message)}</div>`;
    }
    return;
  }

  if (table === "premier_league_player_stats") {
    plPlayerStatsRows = data || [];
    renderPremierLeaguePlayerStatsAdmin();
    if (holder) holder.innerHTML = "";
    return;
  }

  holder.innerHTML = data.length ? data.map(row => cardHtml(table,row)).join("") : `<div class="empty">No ${table} yet.</div>`;
}

async function loadAll() {
  await Promise.all(Object.keys(schemas).map(loadTable));
}

async function openEditor(table, id = null) {
  editorState = { table, id };
  const schema = schemas[table];
  let row = {};

  if (id) {
    const { data, error } = await db.from(table).select("*").eq("id", id).single();
    if (error) return alert(error.message);
    row = data;
  } else {
    if ("is_published" in Object.fromEntries(schema.fields.map(f => [f[0],true]))) row.is_published = true;
    if (table === "premier_league_standings") row.season = "2026/27";
    if (table === "premier_league_player_stats") row.season = "2026/27";
    if (table === "premier_league_matches") {
      row.season = "2026/27";
      row.status = "fulltime";
    }
  }

  editorTitle.textContent = `${id ? "Edit" : "Add"} ${schema.title}`;
  editorFields.innerHTML = schema.fields.map(([name,label,type,required,options]) => {
    const val = row[name];
    const cls = type === "textarea" ? "full" : "";
    if (type === "checkbox") {
      return `<label class="${cls}">${escapeHtml(label)}
        <input name="${name}" type="checkbox" ${val !== false ? "checked" : ""}>
      </label>`;
    }
    if (type === "textarea") {
      return `<label class="${cls}">${escapeHtml(label)}
        <textarea name="${name}" ${required ? "required" : ""}>${escapeHtml(val || "")}</textarea>
      </label>`;
    }
    if (type === "select") {
      return `<label class="${cls}">${escapeHtml(label)}
        <select name="${name}" ${required ? "required" : ""}>${options.map(opt => `<option value="${opt}" ${val === opt ? "selected" : ""}>${opt}</option>`).join("")}</select>
      </label>`;
    }
    const shown = type === "datetime-local" ? toLocalInput(val) : (val ?? "");
    return `<label class="${cls}">${escapeHtml(label)}
      <input name="${name}" type="${type}" value="${escapeHtml(shown)}" ${required ? "required" : ""}>
    </label>`;
  }).join("");

  setMessage(editorMessage);
  dialog.showModal();
}

editorForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const { table, id } = editorState;
  const schema = schemas[table];
  const formData = new FormData(editorForm);
  const payload = {};

  schema.fields.forEach(([name,,type]) => {
    const el = editorForm.elements[name];
    payload[name] = normalizeValue(type, formData.get(name), el?.checked);
  });

  if (table === "premier_league_matches") {
    const home = String(payload.home_team || "").trim();
    const away = String(payload.away_team || "").trim();

    if (!home || !away) {
      return setMessage(editorMessage, "Home team and away team are required.", "error");
    }

    if (home.toLowerCase() === away.toLowerCase()) {
      return setMessage(editorMessage, "Home team and away team cannot be the same.", "error");
    }

    if (home.toLowerCase() === "arsenal" || away.toLowerCase() === "arsenal") {
      return setMessage(
        editorMessage,
        "Manage Arsenal Premier League matches in the Fixtures panel. They sync automatically.",
        "error"
      );
    }

    if (payload.status === "fulltime" &&
        (payload.home_score === null || payload.away_score === null)) {
      return setMessage(
        editorMessage,
        "Enter both scores before saving a Full Time result.",
        "error"
      );
    }
  }

  setMessage(editorMessage, "Saving…");
  let response;
  if (id) response = await db.from(table).update(payload).eq("id", id);
  else response = await db.from(table).insert(payload);

  if (response.error) {
    setMessage(editorMessage, response.error.message, "error");
    return;
  }

  setMessage(
    editorMessage,
    table === "premier_league_matches"
      ? "Result saved. League standings recalculated automatically."
      : "Saved.",
    "success"
  );

  await loadTable(table);

  if (table === "premier_league_matches") {
    try {
      await recalculatePremierLeagueStandings();
    } catch (standingsError) {
      console.error("Standings recalculation failed:", standingsError);
      setMessage(
        editorMessage,
        `Result saved, but standings update failed: ${standingsError.message}`,
        "error"
      );
    }
  }

  setTimeout(() => dialog.close(), 300);
});

window.nl4Edit = openEditor;
window.nl4Delete = async (table, id) => {
  if (!confirm("Delete this item permanently?")) return;
  const { error } = await db.from(table).delete().eq("id", id);
  if (error) return alert(error.message);
  await loadTable(table);

  if (table === "premier_league_matches") {
    try {
      await recalculatePremierLeagueStandings();
    } catch (standingsError) {
      console.error("Standings recalculation failed:", standingsError);
      alert(`Result deleted, but standings update failed: ${standingsError.message}`);
    }
  }
};

document.getElementById("closeDialog").addEventListener("click", () => dialog.close());
document.getElementById("cancelDialog").addEventListener("click", () => dialog.close());

document.getElementById("mediaForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = document.getElementById("mediaFile").files[0];
  const message = document.getElementById("mediaMessage");
  const result = document.getElementById("mediaResult");
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    setMessage(message, "Image must be 5 MB or smaller.", "error");
    return;
  }

  setMessage(message, "Uploading…");
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
  const path = `uploads/${Date.now()}-${crypto.randomUUID()}-${cleanName}`;

  const { error } = await db.storage.from("nl4-media").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type
  });

  if (error) {
    setMessage(message, error.message, "error");
    return;
  }

  const { data } = db.storage.from("nl4-media").getPublicUrl(path);
  setMessage(message, "Upload complete. Copy the URL into an Image URL field.", "success");
  result.innerHTML = `<img src="${escapeHtml(data.publicUrl)}" alt=""><div>${escapeHtml(data.publicUrl)}</div>`;
});

db.auth.onAuthStateChange((_event, session) => {
  setTimeout(() => applySession(session), 0);
});

(async function start() {
  const { data } = await db.auth.getSession();
  await applySession(data.session);
})();
