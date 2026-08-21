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




  premier_league_matches: {
    title: "Other Teams Premier League Result",
    order: "matchday",
    fields: [
      ["season","Season","text",true],
      ["matchday","Matchday","number",true],
      ["home_team","Home team","select",true,[
        "AFC Bournemouth","Aston Villa","Brentford","Brighton & Hove Albion","Chelsea",
        "Coventry City","Crystal Palace","Everton","Fulham","Hull City","Ipswich Town",
        "Leeds United","Liverpool","Manchester City","Manchester United","Newcastle United",
        "Nottingham Forest","Sunderland","Tottenham Hotspur"
      ]],
      ["away_team","Away team","select",true,[
        "AFC Bournemouth","Aston Villa","Brentford","Brighton & Hove Albion","Chelsea",
        "Coventry City","Crystal Palace","Everton","Fulham","Hull City","Ipswich Town",
        "Leeds United","Liverpool","Manchester City","Manchester United","Newcastle United",
        "Nottingham Forest","Sunderland","Tottenham Hotspur"
      ]],
      ["kickoff_at","Kick-off","datetime-local",false],
      ["status","Status","select",true,["scheduled","live","fulltime","postponed","cancelled"]],
      ["home_score","Home score","number",false],
      ["away_score","Away score","number",false]
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

  // A league match must be counted exactly once, even if the same fixture
  // accidentally exists in both fixtures and premier_league_matches.
  // The fixtures table is authoritative for Arsenal matches.
  const countedMatches = new Set();
  const matchKey = (home, away) =>
    `${normalizeClubName(home).toLowerCase()}::${normalizeClubName(away).toLowerCase()}`;

  (arsenalFixtures || []).forEach(row => {
    const competitionName = String(row.competition || "").trim().toLowerCase();

    if (!competitionName.includes("premier")) return;
    if (!["fulltime","finished","ft"].includes(String(row.status || "").toLowerCase())) return;

    const home = row.home_team || (row.is_home ? "Arsenal" : row.opponent);
    const away = row.away_team || (row.is_home ? row.opponent : "Arsenal");
    const homeScore = row.is_home ? row.arsenal_score : row.opponent_score;
    const awayScore = row.is_home ? row.opponent_score : row.arsenal_score;
    const key = matchKey(home, away);

    if (!home || !away || countedMatches.has(key)) return;
    countedMatches.add(key);
    applyResult(home, away, homeScore, awayScore);
  });

  (leagueMatches || []).forEach(row => {
    if (!["fulltime","finished","ft"].includes(String(row.status || "").toLowerCase())) return;

    const key = matchKey(row.home_team, row.away_team);
    if (!row.home_team || !row.away_team || countedMatches.has(key)) return;

    countedMatches.add(key);
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
  let status = document.getElementById('matchStatus').value;
  const scoreA = document.getElementById('matchArsenalScore').value;
  const scoreO = document.getElementById('matchOpponentScore').value;

  // The two fields below are explicitly FULL-TIME score fields in Admin.
  // Once both are entered for a Premier League fixture, treat the match as completed
  // so standings, form, recent results, next-fixture progression and V12.9 all consume it.
  const hasFullTimeScoreInputs = scoreA !== '' && scoreO !== '';
  const currentIsPremierLeague =
    String(currentFixture.competition || '').trim().toLowerCase().includes('premier') &&
    String(currentFixture.season || '').trim() === '2026/27';

  if (currentIsPremierLeague && hasFullTimeScoreInputs && !['cancelled','postponed'].includes(String(status).toLowerCase())) {
    status = 'fulltime';
    const statusSelect = document.getElementById('matchStatus');
    if (statusSelect) statusSelect.value = 'fulltime';
  }

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
        try {
          const publicSnapshot = await runOfficialPublicModelAfterScoreUpdate(matchSaveMessage);
          setMessage(
            matchSaveMessage,
            `Score updated → Public Model saved → Admin Model refreshed. Official title probability: ${Number(publicSnapshot.title_probability).toFixed(1)}%.`,
            'success'
          );
        } catch (modelError) {
          console.error('Official Public Model refresh failed:', modelError);
          setMessage(
            matchSaveMessage,
            `Score and standings saved, but Public Model refresh failed: ${modelError.message}`,
            'error'
          );
        }
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

// ============================================================
// NL4 ONE-WAY FORECAST PIPELINE
// UPDATED SCORE -> PUBLIC MODEL -> ADMIN MODEL
// ============================================================
async function runOfficialPublicModelAfterScoreUpdate(messageEl = null) {
  return new Promise((resolve, reject) => {
    const oldFrame = document.getElementById('nl4PublicModelPipelineFrame');
    if (oldFrame) oldFrame.remove();

    const frame = document.createElement('iframe');
    frame.id = 'nl4PublicModelPipelineFrame';
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText =
      'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0;left:-9999px;top:-9999px;';

    let settled = false;
    const finish = (ok, detail) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      frame.remove();

      if (ok) {
        // Admin never calculates/overwrites the forecast here.
        // It simply reloads the official snapshot produced by the Public Model.
        document.getElementById('loadLatestModelBtn')?.click();
        resolve(detail);
      } else {
        reject(detail instanceof Error ? detail : new Error(String(detail || 'Public Model refresh failed.')));
      }
    };

    const onMessage = event => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frame.contentWindow) return;
      if (event.data?.type !== 'nl4-public-model-snapshot-saved') return;
      finish(true, event.data);
    };

    window.addEventListener('message', onMessage);

    // Safety cleanup only; it does not create a second forecast.
    const timer = setTimeout(() => {
      finish(false, new Error('Public Model did not confirm a saved forecast snapshot.'));
    }, 45000);

    frame.addEventListener('error', () => {
      finish(false, new Error('The Public Model page could not be loaded.'));
    });

    // The Admin login session is shared on the same origin, allowing the
    // Public Model's existing authenticated snapshot RPC to save the result.
    frame.src = `premier-league.html?nl4_pipeline=1&_=${Date.now()}`;
    document.body.appendChild(frame);

    if (messageEl) {
      setMessage(messageEl, 'Standings updated. Running official Public Model…', 'success');
    }
  });
}

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

      // A cleared result invalidates probability-history snapshots that were
      // created with more completed league matches than are currently valid.
      // Derive the live completed-match count from the recalculated table,
      // then remove only snapshots beyond that point. Earlier valid history
      // (including the exact preseason baseline) is preserved unchanged.
      const { data: standingsNow, error: standingsNowError } = await db
        .from('premier_league_standings')
        .select('played')
        .eq('season', '2026/27');

      if (standingsNowError) throw standingsNowError;

      const completedMatchesNow = Math.round(
        (standingsNow || []).reduce((sum, row) => sum + Number(row.played || 0), 0) / 2
      );

      const { error: rollbackError } = await db.rpc('rollback_title_probability_history', {
        p_season: '2026/27',
        p_completed_matches: completedMatchesNow
      });

      if (rollbackError) throw rollbackError;

      setMessage(
        matchSaveMessage,
        `Scores cleared. Standings and probability timeline restored to ${completedMatchesNow} completed match${completedMatchesNow === 1 ? '' : 'es'}.`,
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
              <div class="pl-admin-mini-stat"><strong>${row.appearances ?? 0}</strong><span>APP</span><button type="button" class="nl4-direct-stat-download" data-stat-label="${esc(row.player_name)} • APPEARANCES" data-stat-value="${row.appearances ?? 0}" title="Download appearances">⇩</button></div>
              <div class="pl-admin-mini-stat"><strong>${row.goals ?? 0}</strong><span>GOALS</span><button type="button" class="nl4-direct-stat-download" data-stat-label="${esc(row.player_name)} • GOALS" data-stat-value="${row.goals ?? 0}" title="Download goals">⇩</button></div>
              <div class="pl-admin-mini-stat"><strong>${row.assists ?? 0}</strong><span>ASSISTS</span><button type="button" class="nl4-direct-stat-download" data-stat-label="${esc(row.player_name)} • ASSISTS" data-stat-value="${row.assists ?? 0}" title="Download assists">⇩</button></div>
              <div class="pl-admin-mini-stat"><strong>${row.man_of_the_match ?? 0}</strong><span>MOTM</span><button type="button" class="nl4-direct-stat-download" data-stat-label="${esc(row.player_name)} • MAN OF THE MATCH" data-stat-value="${row.man_of_the_match ?? 0}" title="Download MOTM">⇩</button></div>
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


let plResultsMatchdayFilter = "all";

function renderPremierLeagueResultsAdmin(rows) {
  const holder = document.getElementById("premier_league_matchesList");
  if (!holder) return;

  const filtered = plResultsMatchdayFilter === "all"
    ? rows
    : rows.filter(row => String(row.matchday ?? "") === String(plResultsMatchdayFilter));

  const status = document.getElementById("plResultsAdminStatus");
  if (status) {
    status.textContent = `${filtered.length} fixture${filtered.length === 1 ? "" : "s"}${plResultsMatchdayFilter === "all" ? "" : ` • Matchday ${plResultsMatchdayFilter}`}`;
  }

  holder.innerHTML = filtered.length
    ? filtered.map(row => cardHtml("premier_league_matches", row)).join("")
    : '<div class="empty">No non-Arsenal fixtures found for this matchday.</div>';
}

document.addEventListener("click", event => {
  const btn = event.target.closest("[data-pl-results-matchday]");
  if (!btn) return;
  document.querySelectorAll("[data-pl-results-matchday]").forEach(x => x.classList.remove("active"));
  btn.classList.add("active");
  plResultsMatchdayFilter = btn.dataset.plResultsMatchday;
  loadTable("premier_league_matches");
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

  if (table === "premier_league_matches") {
    renderPremierLeagueResultsAdmin(data || []);
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

      const isConfirmedResult =
        String(payload.season || '') === '2026/27' &&
        ['fulltime','finished','ft'].includes(String(payload.status || '').toLowerCase()) &&
        payload.home_score !== null &&
        payload.away_score !== null;

      if (isConfirmedResult) {
        try {
          const publicSnapshot = await runOfficialPublicModelAfterScoreUpdate(editorMessage);
          setMessage(
            editorMessage,
            `Result updated → Public Model saved → Admin Model refreshed. Official title probability: ${Number(publicSnapshot.title_probability).toFixed(1)}%.`,
            'success'
          );
        } catch (modelError) {
          console.error('Official Public Model refresh failed:', modelError);
          setMessage(
            editorMessage,
            `Result and standings saved, but Public Model refresh failed: ${modelError.message}`,
            'error'
          );
        }
      }
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


/* =========================================================
   NL4 FAN PREDICTIONS ADMIN
   ========================================================= */
(() => {
  const listEl = document.getElementById('fanPredictionFixtureList');
  if (!listEl) return;

  const totalEl = document.getElementById('fanPredictionTotal');
  const refreshBtn = document.getElementById('refreshFanPredictionsBtn');
  const dialog = document.getElementById('fanPredictionDialog');
  const closeBtn = document.getElementById('closeFanPredictionDialog');
  const dialogTitle = document.getElementById('fanPredictionDialogTitle');
  const dialogSummary = document.getElementById('fanPredictionDialogSummary');
  const formationEl = document.getElementById('fanPredictionFormation');
  const countEl = document.getElementById('fanPredictionDialogCount');
  const xiEl = document.getElementById('fanPredictionXI');
  const adminScoreProbabilityList = document.getElementById('adminScoreProbabilityList');

  let fanRows = [];

  function fanEsc(value){
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[ch]);
  }

  function fanDb(){
    // This admin project exposes the connected Supabase client as window.nl4Supabase.
    return window.nl4Supabase || window.supabaseClient || window.db || window.supabaseDb || null;
  }

  function fanDate(value){
    if (!value) return 'Kick-off TBC';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'Kick-off TBC';
    return d.toLocaleString([],{
      weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'
    });
  }

  function teams(row){
    const home = row.home_team || 'Arsenal';
    const away = row.away_team || row.opponent || 'Opponent';
    return {home,away};
  }

  async function loadFanPredictionAdmin(){
    const db = fanDb();
    if (!db || typeof db.rpc !== 'function'){
      listEl.innerHTML = '<p class="message">Supabase client was not found on this Admin page. Check supabase-client.js.</p>';
      return;
    }

    listEl.innerHTML = '<p class="muted">Loading fan predictions…</p>';

    try{
      const {data,error} = await db.rpc('get_fan_prediction_admin_summary');
      if (error) throw error;
      fanRows = data || [];

      const total = fanRows.reduce((sum,row) => sum + Number(row.fan_count || 0),0);
      if (totalEl) totalEl.textContent = `${total} PREDICTION${total === 1 ? '' : 'S'}`;

      listEl.innerHTML = fanRows.length ? fanRows.map(row => {
        const t = teams(row);
        const count = Number(row.fan_count || 0);
        return `<article class="fan-prediction-card">
          <div class="fan-prediction-card-top">
            <div>
              <h3>${fanEsc(t.home)} vs ${fanEsc(t.away)}</h3>
              <div class="fixture-meta">${fanEsc(fanDate(row.kickoff_at))}<br>${fanEsc(row.venue || 'Venue TBC')}</div>
            </div>
            <div class="fan-vote-number">${count}<small>FANS</small></div>
          </div>
          <div class="admin-prediction-type-counts">
            <span><b>${fanEsc(row.lineup_prediction_count || 0)}</b> LINEUP PREDICTIONS</span>
            <span><b>${fanEsc(row.score_prediction_count || 0)}</b> SCORE PREDICTIONS</span>
          </div>
          <span class="formation-pill">MOST POPULAR FORMATION: ${fanEsc(row.most_popular_formation || '—')}</span>
          <span class="formation-pill">MOST PREDICTED SCORE: ${
            row.most_popular_home_score === null || row.most_popular_home_score === undefined
              ? '—'
              : `${fanEsc(t.home)} ${fanEsc(row.most_popular_home_score)}–${fanEsc(row.most_popular_away_score)} ${fanEsc(t.away)}`
          }</span>
          <div class="admin-card-score-probability">
            <div class="admin-card-score-probability-head">
              <b>SCORE PROBABILITY</b>
              <strong>${fanEsc(row.score_prediction_probability || 0)}%</strong>
            </div>
            <div class="admin-card-score-probability-track">
              <div class="admin-card-score-probability-fill" style="width:${Math.max(0,Math.min(100,Number(row.score_prediction_probability)||0))}%"></div>
            </div>
            <small>${fanEsc(row.score_prediction_votes || 0)} of ${fanEsc(row.score_prediction_total || 0)} score votes chose this result</small>
          </div>
          <button type="button" class="primary-btn" data-view-fan-xi="${fanEsc(row.fixture_id)}" ${Number(row.lineup_prediction_count || 0) ? '' : 'disabled'}>View Most Selected XI</button>
        </article>`;
      }).join('') : '<p class="muted">No published fixtures found.</p>';
    }catch(error){
      console.error('Fan prediction admin load failed:',error);
      listEl.innerHTML = `<p class="message">Could not load fan predictions: ${fanEsc(error.message || 'Unknown error')}</p>`;
    }
  }

  async function openFanXI(fixtureId){
    const db = fanDb();
    const row = fanRows.find(r => String(r.fixture_id) === String(fixtureId));
    if (!db || !row) return;

    const t = teams(row);
    dialogTitle.textContent = `${t.home} vs ${t.away}`;
    dialogSummary.innerHTML = `<strong>${fanEsc(fanDate(row.kickoff_at))}</strong>
      <span>${fanEsc(row.venue || 'Venue TBC')}</span>
      <span><b>Most predicted score:</b> ${
        row.most_popular_home_score === null || row.most_popular_home_score === undefined
          ? '—'
          : `${fanEsc(t.home)} ${fanEsc(row.most_popular_home_score)}–${fanEsc(row.most_popular_away_score)} ${fanEsc(t.away)}`
      }</span>`;
    formationEl.textContent = `Formation ${row.most_popular_formation || '—'}`;
    countEl.textContent = `${Number(row.fan_count || 0)} prediction${Number(row.fan_count || 0) === 1 ? '' : 's'}`;
    xiEl.innerHTML = '<p class="muted">Loading Most Selected XI…</p>';
    if (adminScoreProbabilityList) adminScoreProbabilityList.innerHTML = '<p class="muted">Loading score probabilities…</p>';
    dialog.showModal();

    try{
      const {data,error} = await db.rpc('get_most_selected_xi',{p_fixture_id:fixtureId});
      if (error) throw error;
      const rows = data || [];
      if (rows.length) formationEl.textContent = `Formation ${rows[0].formation || '—'}`;
      xiEl.innerHTML = rows.length ? rows.map(player => `
        <div class="fan-xi-player">
          <small>${fanEsc(player.slot)}</small>
          <b>${fanEsc(player.player_name)}</b>
          <span>${fanEsc(player.votes)} vote${Number(player.votes) === 1 ? '' : 's'} • ${fanEsc(player.percentage)}%</span>
        </div>
      `).join('') : '<p class="muted">No submitted predictions for this fixture yet.</p>';
    }catch(error){
      xiEl.innerHTML = `<p class="message">Could not load Most Selected XI: ${fanEsc(error.message || 'Unknown error')}</p>`;
    }

    if (adminScoreProbabilityList){
      try{
        const {data:scores,error:scoreError} = await db.rpc('get_fan_score_probabilities',{p_fixture_id:fixtureId});
        if (scoreError) throw scoreError;
        const scoreRows=scores || [];
        adminScoreProbabilityList.innerHTML=scoreRows.length ? scoreRows.slice(0,8).map(score=>`
          <div class="admin-score-probability-row">
            <b>${fanEsc(t.home)} ${fanEsc(score.predicted_home_score)}–${fanEsc(score.predicted_away_score)} ${fanEsc(t.away)}</b>
            <div class="admin-score-probability-track"><div class="admin-score-probability-fill" style="width:${Math.max(0,Math.min(100,Number(score.probability)||0))}%"></div></div>
            <strong>${fanEsc(score.probability)}%</strong>
          </div>`).join('') : '<p class="muted">No score predictions yet.</p>';
      }catch(error){
        console.error('Admin score probability load failed:',error);
        adminScoreProbabilityList.innerHTML=`<p class="message">Could not load score probability: ${fanEsc(error.message || 'Unknown error')}</p>`;
      }
    }
  }

  listEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-view-fan-xi]');
    if (btn) openFanXI(btn.dataset.viewFanXi);
  });

  refreshBtn?.addEventListener('click',loadFanPredictionAdmin);
  closeBtn?.addEventListener('click',() => dialog.close());
  dialog?.addEventListener('click',e => {
    if (e.target === dialog) dialog.close();
  });

  window.nl4RefreshFanPredictions = loadFanPredictionAdmin;
  loadFanPredictionAdmin();
})();



/* =========================================================
   NL4 V13.2 MODEL TESTING MACHINE — browser-only sandbox
   One master random season is generated, then matchday selection
   reveals more of that SAME season for a valid probability timeline.
   ========================================================= */
(function(){
  const panel=document.getElementById('modelTestingPanel'); if(!panel)return;
  const STORAGE_KEY='nl4_v13_test_dataset';
  const HISTORY_KEY='nl4_v132_test_history';
  const through=document.getElementById('modelTestThroughMatchday'),style=document.getElementById('modelTestScoreStyle');
  const generateBtn=document.getElementById('generateModelTestBtn'),regenerateBtn=document.getElementById('regenerateModelTestBtn'),openBtn=document.getElementById('openModelTestBtn'),clearBtn=document.getElementById('clearModelTestBtn');
  const preview=document.getElementById('modelTestPreview'),message=document.getElementById('modelTestMessage'),badge=document.getElementById('modelTestStatusBadge');

  for(let i=1;i<=38;i++){
    const o=document.createElement('option');
    o.value=i;o.textContent=`Matchday ${i} • ${i*10} league results`;
    through.appendChild(o);
  }

  const norm=v=>String(v||'').trim().replace(/\s+/g,' '),pair=(h,a)=>`${norm(h).toLowerCase()}__${norm(a).toLowerCase()}`;
  function poisson(lambda,cap){let L=Math.exp(-lambda),k=0,p=1;do{k++;p*=Math.random();}while(p>L&&k<14);return Math.max(0,Math.min(cap,k-1));}
  function randomScore(mode,home){return mode==='chaotic'?poisson(home?1.8:1.5,7):poisson(home?1.48:1.22,6);}

  async function fetchSchedule(){
    const [a,l]=await Promise.all([
      db.from('fixtures').select('home_team,away_team,is_home,opponent,matchday,season,competition').eq('season','2026/27').eq('competition','Premier League'),
      db.from('premier_league_matches').select('home_team,away_team,matchday,season').eq('season','2026/27')
    ]);
    if(a.error)throw a.error;if(l.error)throw l.error;
    const map=new Map();
    (l.data||[]).forEach(r=>{
      if(r.home_team&&r.away_team)map.set(pair(r.home_team,r.away_team),{
        home_team:norm(r.home_team),away_team:norm(r.away_team),matchday:Number(r.matchday)||null
      });
    });
    (a.data||[]).forEach(r=>{
      const ih=r.home_team==='Arsenal'||r.is_home===true;
      const h=norm(r.home_team||(ih?'Arsenal':r.opponent)),aw=norm(r.away_team||(ih?r.opponent:'Arsenal'));
      if(h&&aw)map.set(pair(h,aw),{home_team:h,away_team:aw,matchday:Number(r.matchday)||null});
    });
    return [...map.values()].filter(r=>r.matchday>=1&&r.matchday<=38)
      .sort((x,y)=>x.matchday-y.matchday||x.home_team.localeCompare(y.home_team));
  }

  function currentDataset(){
    try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');}catch(_){return null;}
  }

  function visibleDataset(master,max){
    const m=Math.max(1,Math.min(38,Number(max)||1));
    return {
      ...master,
      version:'V13_TEST_2',
      throughMatchday:m,
      results:(master.masterResults||[]).filter(r=>Number(r.matchday)<=m)
    };
  }

  function storeVisible(master,max){
    const d=visibleDataset(master,max);
    localStorage.setItem(STORAGE_KEY,JSON.stringify(d));
    return d;
  }

  function render(d){
    const rounds=document.getElementById('modelTestRounds'),matches=document.getElementById('modelTestMatches'),record=document.getElementById('modelTestArsenalRecord'),time=document.getElementById('modelTestGeneratedAt');
    if(!d?.results?.length){
      preview.innerHTML='<p class="muted">Generate one random season, then move through Matchdays 1–38 using the same test universe.</p>';
      rounds.textContent='0';matches.textContent='0';record.textContent='—';time.textContent='';
      badge.textContent='NO TEST LOADED';openBtn.disabled=true;return;
    }
    const groups=new Map();
    d.results.forEach(r=>{if(!groups.has(r.matchday))groups.set(r.matchday,[]);groups.get(r.matchday).push(r);});
    preview.innerHTML=[...groups.entries()].map(([md,rows])=>`
      <section class="model-test-round">
        <h4>MATCHDAY ${md}</h4>
        ${rows.map(r=>`<div class="model-test-match ${(r.home_team==='Arsenal'||r.away_team==='Arsenal')?'arsenal':''}">
          <span class="home">${escapeHtml(r.home_team)}</span>
          <strong class="score">${r.home_score}–${r.away_score}</strong>
          <span>${escapeHtml(r.away_team)}</span>
        </div>`).join('')}
      </section>`).join('');

    const ar=d.results.filter(r=>r.home_team==='Arsenal'||r.away_team==='Arsenal');
    let w=0,dr=0,lo=0;
    ar.forEach(r=>{
      const home=r.home_team==='Arsenal',gf=home?r.home_score:r.away_score,ga=home?r.away_score:r.home_score;
      if(gf>ga)w++;else if(gf===ga)dr++;else lo++;
    });
    rounds.textContent=d.throughMatchday;
    matches.textContent=d.results.length;
    record.textContent=`${w}W ${dr}D ${lo}L`;
    time.textContent=new Date(d.generatedAt).toLocaleString();
    badge.textContent=`SAME TEST SEASON • THROUGH MD ${d.throughMatchday}`;
    openBtn.disabled=false;
  }

  async function generateMaster(){
    setMessage(message,'Building one complete random test season…');
    const schedule=await fetchSchedule();
    if(schedule.length!==380)throw new Error(`Testing machine needs 380 fixtures. Found ${schedule.length}.`);
    const mode=style.value||'realistic';
    const masterResults=schedule.map(r=>({
      ...r,
      home_score:randomScore(mode,true),
      away_score:randomScore(mode,false),
      status:'fulltime'
    }));
    const master={
      version:'V13_TEST_2',
      season:'2026/27',
      scoreStyle:mode,
      generatedAt:new Date().toISOString(),
      testId:(crypto.randomUUID?crypto.randomUUID():String(Date.now())),
      masterResults
    };
    localStorage.removeItem(HISTORY_KEY);
    return storeVisible(master,Number(through.value)||1);
  }

  generateBtn?.addEventListener('click',async()=>{
    try{
      const existing=currentDataset();
      let d;
      if(existing?.masterResults?.length===380){
        d=storeVisible(existing,Number(through.value)||1);
        setMessage(message,`Loaded the same random test season through Matchday ${d.throughMatchday}. Sandbox history was preserved.`,'success');
      }else{
        d=await generateMaster();
        setMessage(message,`Generated one complete random season and loaded it through Matchday ${d.throughMatchday}. Supabase was not changed.`,'success');
      }
      render(d);
    }catch(e){console.error('NL4 model testing:',e);setMessage(message,e.message||'Could not generate test results.','error');}
  });

  regenerateBtn?.addEventListener('click',async()=>{
    try{
      const d=await generateMaster();
      render(d);
      setMessage(message,`Started a NEW random test season through Matchday ${d.throughMatchday}. Previous sandbox snapshots were cleared.`,'success');
    }catch(e){console.error('NL4 model testing:',e);setMessage(message,e.message||'Could not regenerate test season.','error');}
  });

  through?.addEventListener('change',()=>{
    const d=currentDataset();
    if(!d?.masterResults?.length)return;
    const next=storeVisible(d,Number(through.value)||1);
    render(next);
    setMessage(message,`Same test season now exposed through Matchday ${next.throughMatchday}. Open V13 Test to save this sandbox forecast point.`,'success');
  });

  openBtn?.addEventListener('click',()=>{
    if(!localStorage.getItem(STORAGE_KEY))return setMessage(message,'Generate a test season first.','error');
    window.open('premier-league.html?test=1','_blank');
  });

  clearBtn?.addEventListener('click',()=>{
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(HISTORY_KEY);
    render(null);
    setMessage(message,'Test season and sandbox probability history cleared. Live season data was untouched.','success');
  });

  try{
    const d=currentDataset();
    if(d?.results?.length){
      through.value=d.throughMatchday;
      style.value=d.scoreStyle||'realistic';
      render(d);
    }else render(null);
  }catch(_){render(null);}
})();




/* =========================================================
   V15.3 FORECAST PUBLISHING STUDIO
   ========================================================= */
(() => {
  const root=document.getElementById('modelInterpretationAdmin');
  if(!root)return;
  const $=id=>document.getElementById(id);
  const msg=$('modelInterpretationMessage');
  let latest=null;
  let forecastStats=[];
  let selectedStyle='balanced';

  function db(){return window.nl4Supabase||window.supabaseClient||window.db||window.supabaseDb||null;}
  function say(text,ok=false){if(msg){msg.textContent=text;msg.style.color=ok?'#d8ad45':'';}}
  function v(id){return ($(id)?.value||'').trim();}
  function setv(id,val){const el=$(id);if(el)el.value=val||'';}
  function esc(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function num(n,d=1){const x=Number(n);return Number.isFinite(x)?x.toFixed(d):'—';}

  const STAT_DEFS=[
    ['Core','title_probability','Title probability','%'],
    ['Core','top4_probability','Top 4 probability','%'],
    ['Core','top5_probability','Top 5 probability','%'],
    ['Core','expected_points','Expected final points','pts'],
    ['Core','expected_position','Expected finish',''],
    ['Core','confidence_score','Model confidence','/100'],
    ['Season','completed_matches','Completed league matches','/380'],
    ['Season','history_weight','Historical evidence weight','%'],
    ['Season','live_weight','Current-season evidence weight','%'],
    ['Season','arsenal_points','Arsenal current points','pts'],
    ['Season','arsenal_position','Arsenal current position',''],
    ['Season','arsenal_ppg','Arsenal PPG',''],
    ['Season','arsenal_gf','Goals for',''],
    ['Season','arsenal_ga','Goals against',''],
    ['Season','arsenal_gd','Goal difference',''],
    ['Season','arsenal_form','Recent league form',''],
    ['Model','historical_anchor','Historical points anchor','pts'],
    ['Model','scoring_baseline','Scoring baseline','goals/team'],
    ['Model','arsenal_elo','Opponent-adjusted Elo',''],
    ['Model','elo_delta','Current-season Elo movement',''],
    ['Race','credible_rival','Credible title threat',''],
    ['Race','rival_title_probability','Rival title probability','%'],
    ['Race','probability_gap','Probability gap to rival','pts'],
    ['Race','champion_average','Expected champion points','pts'],
    ['Race','median_champion','Median champion points','pts'],
    ['Race','model_trend','Model trend',''],
    ['Race','season_probability_change','Season title-probability change','pts']
  ];

  function statLabelValue(def,row){
    const [,key,label,suffix]=def;
    let raw=row[key];
    if(raw===null||raw===undefined||raw==='')return null;
    let display=raw;
    if(typeof raw==='number'||!Number.isNaN(Number(raw))){
      const n=Number(raw);
      const whole=['completed_matches','arsenal_points','arsenal_position','arsenal_gf','arsenal_ga','arsenal_gd','confidence_score','median_champion'].includes(key);
      display=whole?String(Math.round(n)):n.toFixed(1);
    }
    if(suffix==='%')display+= '%';
    else if(suffix==='pts')display+= ' pts';
    else if(suffix==='/100')display+= '/100';
    else if(suffix==='/380')display+= '/380';
    else if(suffix)display+=' '+suffix;
    return {key,label,value:display,group:def[0]};
  }

  async function loadSupplementaryForecast(client,snapshot){
    const result={...snapshot};
    // Current league table.
    const stand=await client.from('premier_league_standings')
      .select('club,position,played,points,goals_for,goals_against,goal_difference')
      .eq('season','2026/27');
    if(!stand.error){
      const rows=stand.data||[],ars=rows.find(x=>x.club==='Arsenal');
      if(ars){
        result.arsenal_points=Number(ars.points); result.arsenal_position=Number(ars.position);
        result.arsenal_gf=Number(ars.goals_for); result.arsenal_ga=Number(ars.goals_against);
        result.arsenal_gd=Number(ars.goal_difference); result.arsenal_ppg=Number(ars.played)?Number(ars.points)/Number(ars.played):0;
        const mp=Number(ars.played)||0;
        let hist=mp<=10?1-(mp/10)*.4:mp<=20?.6-((mp-10)/10)*.35:mp<=25?.25-((mp-20)/5)*.10:mp<=30?.15-((mp-25)/5)*.10:mp<34?.05-((mp-30)/4)*.05:0;
        hist=Math.max(0,Math.min(1,hist)); result.history_weight=hist*100;result.live_weight=(1-hist)*100;
      }
    }
    // Optional current public history fields from snapshot.
    result.model_trend=(Number(result.title_probability)>=49?'RISING / STRONG':'WATCHING');
    result.historical_anchor=81.5;
    result.scoring_baseline=1.42;
    return result;
  }

  function renderStats(){
    const host=$('allForecastStatsList');
    if(!host)return;
    let lastGroup='';
    host.innerHTML=forecastStats.map(s=>{
      const heading=s.group!==lastGroup?`<div class="forecast-stat-group-title">${esc(s.group.toUpperCase())}</div>`:'';
      lastGroup=s.group;
      return heading+`<label class="forecast-stat-option">
        <input type="checkbox" class="forecast-stat-check" value="${esc(s.key)}">
        <span><b>${esc(s.label)}</b><strong>${esc(s.value)}</strong><small>Choose to show this statistic to viewers.</small></span>
        <button type="button" class="nl4-direct-stat-download" title="Download this stat" aria-label="Download ${esc(s.label)} stat" data-stat-label="${esc(s.label)}" data-stat-value="${esc(s.value)}">⇩</button>
      </label>`;
    }).join('');
    host.querySelectorAll('.forecast-stat-check').forEach(x=>x.addEventListener('change',updateSelectedCount));
    updateSelectedCount();
  }
  function selectedStats(){
    const keys=[...document.querySelectorAll('.forecast-stat-check:checked')].map(x=>x.value);
    return forecastStats.filter(s=>keys.includes(s.key));
  }
  function updateSelectedCount(){
    const n=selectedStats().length;const el=$('selectedForecastStatsCount');if(el)el.textContent=`${n} SELECTED`;
  }

  async function loadLatest(){
    const client=db();if(!client){say('Supabase client not found.');return;}
    say('Loading complete forecast…');
    let q=await client.from('title_probability_history')
      .select('completed_matches,title_probability,top4_probability,top5_probability,expected_points,expected_position,confidence_score,created_at')
      .eq('season','2026/27').order('completed_matches',{ascending:false}).limit(1);
    if(q.error){say(q.error.message);return;}
    if(!q.data?.[0]){say('No live title-probability snapshot found.');return;}
    latest=await loadSupplementaryForecast(client,q.data[0]);
    forecastStats=STAT_DEFS.map(d=>statLabelValue(d,latest)).filter(Boolean);
    renderStats();
    // Sensible defaults.
    ['title_probability','top4_probability','expected_points','expected_position','confidence_score','completed_matches','history_weight','live_weight']
      .forEach(k=>{const c=document.querySelector(`.forecast-stat-check[value="${k}"]`);if(c)c.checked=true;});
    updateSelectedCount();
    say(`Loaded ${forecastStats.length} forecast statistics. Choose what viewers should see.`,true);
  }

  function context(){
    const t=Number(latest?.title_probability||0),top4=Number(latest?.top4_probability||0),
      pts=Number(latest?.expected_points||0),pos=Number(latest?.expected_position||0),
      conf=Number(latest?.confidence_score||0),matches=Number(latest?.completed_matches||0),
      md=Math.round(matches/10),hist=Number(latest?.history_weight??0),live=Number(latest?.live_weight??100);
    return {t,top4,pts,pos,conf,matches,md,hist,live};
  }

  function generate(style){
    if(!latest)return null;
    const c=context();
    const state=c.matches>=380?'complete':c.t>=60?'fav':c.t>=40?'race':c.t>=20?'outside':'longshot';
    const baseHeadline=state==='complete'?'The Premier League season is complete':
      state==='fav'?`Arsenal are strong title favourites after Matchday ${c.md}`:
      state==='race'?`Arsenal remain firmly in the title race after Matchday ${c.md}`:
      state==='outside'?`Arsenal remain in contention after Matchday ${c.md}`:
      `Arsenal face a difficult title route after Matchday ${c.md}`;

    const shared=`Arsenal's current NL4 title probability is ${c.t.toFixed(1)}%, with ${c.pts.toFixed(1)} expected points and an expected finish of ${c.pos.toFixed(1)}. The model is currently using ${c.live.toFixed(0)}% current-season evidence and ${c.hist.toFixed(0)}% historical evidence.`;

    const variants={
      balanced:{
        headline:baseHeadline,status:'TITLE RACE UPDATE',
        summary:`${shared} This estimate combines Arsenal's results with the performance and remaining path of all 19 Premier League clubs. It is a probability, not a prediction of certainty.`,
        takeaway:c.t>=50?'Arsenal currently have the strongest simulated route to first place, but future results can still materially change the race.':'Arsenal remain live in the race, but the rest of the league currently holds the larger combined title chance.'
      },
      short:{
        headline:baseHeadline,status:'NL4 QUICK READ',
        summary:`Arsenal: ${c.t.toFixed(1)}% for the title, ${c.pts.toFixed(1)} expected points, ${c.top4.toFixed(1)}% for the top four. ${c.matches} league matches are complete.`,
        takeaway:c.t>=50?'Current position: title favourite.':'Current position: chasing the title leaders.'
      },
      analyst:{
        headline:`NL4 model: Arsenal ${c.t.toFixed(1)}% for the title`,status:'MODEL ANALYSIS',
        summary:`${shared} Model confidence is ${c.conf}/100. The interpretation should focus on the probability distribution rather than a single projected finishing total: Arsenal's title chance changes when their own expected points move and when credible rivals gain or lose title paths.`,
        takeaway:'The key signal is not one result in isolation, but how the full 20-team probability distribution changes.'
      },
      fan:{
        headline:c.t>=50?'Arsenal have the edge in the title race':baseHeadline,status:'FAN EXPLAINER',
        summary:`Right now, NL4 gives Arsenal a ${c.t.toFixed(1)}% chance of becoming champions. In simple terms, if the rest of this exact league situation were played out many times, Arsenal would finish first in about ${Math.round(c.t)} out of every 100 runs. Their expected total is ${c.pts.toFixed(1)} points.`,
        takeaway:c.t>=50?'Arsenal are in a strong position, but the title is not won until the points make it certain.':'There is still a route to the title, but Arsenal need the balance of results to move their way.'
      },
      cautious:{
        headline:`Arsenal's title probability stands at ${c.t.toFixed(1)}%`,status:'CAUTIOUS MODEL READ',
        summary:`${shared} This number should not be treated as certainty. Football results are volatile, and the probability can move quickly when Arsenal or major rivals outperform pre-match expectations.`,
        takeaway:`Confidence is ${c.conf}/100; use the probability as a current estimate of the race, not a guarantee of the final table.`
      },
      story:{
        headline:c.t>=50?'The title path currently runs through Arsenal':`Arsenal's title path remains open`,status:'TITLE-RACE STORY',
        summary:`The NL4 race has Arsenal at ${c.t.toFixed(1)}%. Their own path projects to ${c.pts.toFixed(1)} points, but the bigger story is the race around them: every City, Liverpool, Chelsea and other contender result changes how many routes to first remain available.`,
        takeaway:c.t>=50?'Arsenal control the largest share of possible title outcomes right now.':'Arsenal need both strong results and some help from rival outcomes to increase their share of title-winning paths.'
      }
    };
    const out=variants[style]||variants.balanced;
    out.factor1=`Arsenal forecast: ${c.pts.toFixed(1)} expected points and ${c.pos.toFixed(1)} expected finish.`;
    out.factor2=`Evidence mix: ${c.hist.toFixed(0)}% historical / ${c.live.toFixed(0)}% current season.`;
    out.factor3=`Model confidence: ${c.conf}/100 after ${c.matches} completed league matches.`;
    return out;
  }

  function showAuto(style){
    if(!latest){say('Load the complete forecast first.');return;}
    selectedStyle=style;
    document.querySelectorAll('.interpret-style-btn').forEach(b=>b.classList.toggle('active',b.dataset.style===style));
    const host=$('automaticInterpretationChoices');if(!host)return;
    const styles=[style, ...['balanced','short','analyst','fan','cautious','story'].filter(x=>x!==style).slice(0,2)];
    host.innerHTML=styles.map(s=>{
      const d=generate(s);
      return `<article class="auto-interpretation-card"><h4>${esc(s.toUpperCase())}</h4><p><b>${esc(d.headline)}</b><br>${esc(d.summary)}</p><button type="button" class="ghost-btn use-auto-draft" data-style="${s}">Use This Interpretation</button></article>`;
    }).join('');
    host.querySelectorAll('.use-auto-draft').forEach(b=>b.addEventListener('click',()=>useDraft(b.dataset.style)));
  }

  function useDraft(style){
    const d=generate(style);if(!d)return;
    setv('interpHeadline',d.headline);setv('interpStatusLabel',d.status);
    setv('interpSummary',d.summary);setv('interpTakeaway',d.takeaway);
    setv('interpFactor1',d.factor1);setv('interpFactor2',d.factor2);setv('interpFactor3',d.factor3);
    say(`${style} interpretation copied into the manual editor. You can change anything before publishing.`,true);
  }

  async function publish(){
    const client=db();if(!client){say('Supabase client not found.');return;}
    const stats=selectedStats();
    if(!stats.length){say('Choose at least one forecast statistic for viewers.');return;}
    if(!v('interpHeadline')||!v('interpSummary')){say('Add a headline and interpretation before publishing.');return;}
    const row={
      season:'2026/27',headline:v('interpHeadline'),status_label:v('interpStatusLabel')||'TITLE RACE UPDATE',
      summary:v('interpSummary'),key_takeaway:v('interpTakeaway'),factor_1:v('interpFactor1'),factor_2:v('interpFactor2'),factor_3:v('interpFactor3'),
      selected_stats:stats,interpretation_mode:'automatic+manual',interpretation_style:selectedStyle,
      is_published:true,published_at:new Date().toISOString(),
      source_completed_matches:latest?.completed_matches??null,source_title_probability:latest?.title_probability??null
    };
    await client.from('nl4_model_interpretations').update({is_published:false}).eq('season','2026/27').eq('is_published',true);
    const {error}=await client.from('nl4_model_interpretations').insert(row);
    if(error){
      if(String(error.message||'').includes('schema cache')||String(error.message||'').includes('nl4_model_interpretations')){
        const warn=$('forecastPublisherSetupWarning'); if(warn)warn.hidden=false;
        say('Database setup required. Run V15.4-forecast-publisher-setup.sql in Supabase SQL Editor once.');
      }else say(error.message);
      return;
    }
    $('modelInterpretationState').textContent='PUBLISHED';
    say(`${stats.length} selected statistics and the interpretation were published to viewers.`,true);
  }

  async function unpublish(){
    const client=db();if(!client)return;
    const {error}=await client.from('nl4_model_interpretations').update({is_published:false}).eq('season','2026/27').eq('is_published',true);
    if(error){
      if(String(error.message||'').includes('schema cache')){
        const warn=$('forecastPublisherSetupWarning'); if(warn)warn.hidden=false;
        say('Database setup required before publishing controls can work.');
      }else say(error.message);
      return;
    }
    $('modelInterpretationState').textContent='NOT PUBLISHED';say('Viewer forecast interpretation unpublished.',true);
  }

  function clearInterpretation(){
    ['interpHeadline','interpStatusLabel','interpSummary','interpTakeaway','interpFactor1','interpFactor2','interpFactor3'].forEach(id=>setv(id,''));
    say('Interpretation cleared. Forecast-stat selections were kept.');
  }


  async function loadPublicForecastVisibilityAdmin(){
    const client=db(); if(!client)return;
    const state=$('publicForecastVisibilityState');
    try{
      const {data,error}=await client.from('nl4_public_forecast_settings')
        .select('is_visible').eq('season','2026/27').limit(1);
      if(error){
        if(String(error.message||'').includes('schema cache')){
          const warn=$('forecastPublisherSetupWarning'); if(warn)warn.hidden=false;
          if(state)state.textContent='SETUP REQUIRED';
        }else{
          if(state)state.textContent='CHECK FAILED';
        }
        return;
      }
      const visible=data?.length?data[0].is_visible!==false:true;
      if(state)state.textContent=visible?'VISIBLE TO VIEWERS':'REMOVED FROM VIEWERS';
    }catch(_){
      if(state)state.textContent='CHECK FAILED';
    }
  }

  async function setPublicForecastVisibility(isVisible){
    const client=db(); if(!client){say('Supabase client not found.');return;}
    const state=$('publicForecastVisibilityState');
    const payload={season:'2026/27',is_visible:!!isVisible,updated_at:new Date().toISOString()};
    const {error}=await client.from('nl4_public_forecast_settings')
      .upsert(payload,{onConflict:'season'});
    if(error){
      if(String(error.message||'').includes('schema cache')){
        const warn=$('forecastPublisherSetupWarning'); if(warn)warn.hidden=false;
        if(state)state.textContent='SETUP REQUIRED';
        say('Run V15.4-forecast-publisher-setup.sql in Supabase first.');
      }else say(error.message);
      return;
    }
    if(state)state.textContent=isVisible?'VISIBLE TO VIEWERS':'REMOVED FROM VIEWERS';
    say(isVisible?'The complete NL4 forecast is now visible on the Premier League page.':'The complete NL4 forecast has been removed from the public Premier League page.',true);
  }

  $('showPublicForecastBtn')?.addEventListener('click',()=>setPublicForecastVisibility(true));
  $('hidePublicForecastBtn')?.addEventListener('click',()=>setPublicForecastVisibility(false));
  loadPublicForecastVisibilityAdmin();

  $('loadLatestModelBtn')?.addEventListener('click',loadLatest);
  $('selectAllForecastStatsBtn')?.addEventListener('click',()=>{document.querySelectorAll('.forecast-stat-check').forEach(x=>x.checked=true);updateSelectedCount();});
  $('clearForecastStatsBtn')?.addEventListener('click',()=>{document.querySelectorAll('.forecast-stat-check').forEach(x=>x.checked=false);updateSelectedCount();});
  document.querySelectorAll('.interpret-style-btn').forEach(b=>b.addEventListener('click',()=>showAuto(b.dataset.style)));
  $('publishInterpretationBtn')?.addEventListener('click',publish);
  $('unpublishInterpretationBtn')?.addEventListener('click',unpublish);
  $('clearInterpretationBtn')?.addEventListener('click',clearInterpretation);
})();

// =====================================================
// NL4 TREASURE ROOM • VAULT ENTRY + COMPLETION ANALYTICS
// Viewer 0/49 progress is NEVER modified here.
// =====================================================
(() => {
  const entryCountEl = document.getElementById("trophyVaultEntryCount");
  const completionCountEl = document.getElementById("trophyCompletionCount");
  const refreshBtn = document.getElementById("refreshTrophyCompletionBtn");
  const resetBtn = document.getElementById("resetTrophyCompletionAnalyticsBtn");
  const message = document.getElementById("trophyCompletionMessage");
  if (!entryCountEl && !completionCountEl && !refreshBtn && !resetBtn) return;

  const client = window.nl4Supabase || window.supabaseClient || window.supabaseDb || null;

  function setMessage(text, ok = false) {
    if (!message) return;
    message.textContent = text;
    message.style.color = ok ? "#d8ad45" : "";
  }

  async function getAnalyticsVersion() {
    const { data, error } = await client
      .from("nl4_trophy_settings")
      .select("analytics_version")
      .eq("id", "collection")
      .maybeSingle();
    if (error) throw error;
    return Number(data?.analytics_version || 0);
  }

  async function loadTrophyAnalytics() {
    if (!client || typeof client.from !== "function") {
      if (entryCountEl) entryCountEl.textContent = "SUPABASE UNAVAILABLE";
      if (completionCountEl) completionCountEl.textContent = "SUPABASE UNAVAILABLE";
      return;
    }
    try {
      const version = await getAnalyticsVersion();
      const [entriesResult, completionsResult] = await Promise.all([
        client.from("nl4_trophy_entries").select("id", { count: "exact", head: true }).eq("analytics_version", version),
        client.from("nl4_trophy_completions").select("id", { count: "exact", head: true }).eq("analytics_version", version)
      ]);
      if (entriesResult.error) throw entriesResult.error;
      if (completionsResult.error) throw completionsResult.error;
      if (entryCountEl) entryCountEl.textContent = `${Number(entriesResult.count || 0)} VAULT ENTRIES`;
      if (completionCountEl) completionCountEl.textContent = `${Number(completionsResult.count || 0)} COMPLETED 49/49`;
      setMessage(`Every successful quiz entry is counted. Analytics period: ${version}. Viewer trophy progress is untouched.`, true);
    } catch (error) {
      console.error("NL4 trophy analytics load failed:", error);
      if (entryCountEl) entryCountEl.textContent = "SETUP REQUIRED";
      if (completionCountEl) completionCountEl.textContent = "SETUP REQUIRED";
      setMessage("Run NL4-trophy-progress-admin-setup.sql in Supabase SQL Editor.");
    }
  }

  refreshBtn?.addEventListener("click", loadTrophyAnalytics);

  resetBtn?.addEventListener("click", async () => {
    if (!client || typeof client.from !== "function") {
      setMessage("Supabase client is not available.");
      return;
    }
    const confirmed = window.confirm(
      "Reset ONLY the Admin vault-entry and 49/49 analytics counters? Viewer trophy progress will NOT be changed."
    );
    if (!confirmed) return;

    resetBtn.disabled = true;
    setMessage("");
    try {
      const current = await getAnalyticsVersion();
      const nextVersion = current + 1;
      const { error } = await client
        .from("nl4_trophy_settings")
        .update({ analytics_version: nextVersion, updated_at: new Date().toISOString() })
        .eq("id", "collection");
      if (error) throw error;
      if (entryCountEl) entryCountEl.textContent = "0 VAULT ENTRIES";
      if (completionCountEl) completionCountEl.textContent = "0 COMPLETED 49/49";
      setMessage("Admin analytics reset to 0. No viewer's trophy progress was changed.", true);
    } catch (error) {
      console.error("NL4 trophy analytics reset failed:", error);
      setMessage(error?.message || "Could not reset Admin trophy analytics.");
    } finally {
      resetBtn.disabled = false;
    }
  });

  loadTrophyAnalytics();
})();;



// ============================================================
// NL4 DIRECT STAT DOWNLOADS — UI ONLY
// No Supabase writes, no standings changes, no model calls.
// ============================================================
(function(){
  function safeName(v){
    return String(v||'nl4-stat').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase().slice(0,70)||'nl4-stat';
  }

  function makePng(label,value,extra){
    const c=document.createElement('canvas');
    c.width=1200;c.height=675;
    const x=c.getContext('2d');
    x.fillStyle='#070707';x.fillRect(0,0,1200,675);
    x.fillStyle='#111';x.fillRect(55,55,1090,565);
    x.strokeStyle='#d8ad45';x.lineWidth=3;x.strokeRect(55,55,1090,565);
    x.fillStyle='#d8ad45';x.font='800 28px Arial';x.fillText('NL4 • NORTH LONDON FOREVER',95,112);
    x.fillStyle='#d8001f';x.fillRect(95,140,150,5);
    x.fillStyle='#f5f5f2';x.font='800 42px Arial';
    x.fillText(String(label||'NL4 STAT').toUpperCase().slice(0,48),95,245);
    x.fillStyle='#d8ad45';x.font='900 92px Arial';
    x.fillText(String(value??''),95,380);
    if(extra){
      x.fillStyle='#aaa';x.font='600 25px Arial';
      x.fillText(String(extra).slice(0,75),95,455);
    }
    x.fillStyle='#666';x.font='600 21px Arial';x.fillText('NL4 Admin • 2026/27',95,585);
    const a=document.createElement('a');
    a.download=safeName(label)+'.png';
    a.href=c.toDataURL('image/png');
    document.body.appendChild(a);a.click();a.remove();
  }

  function addStaticButtons(){
    document.querySelectorAll('.model-test-summary article,.interpretation-metrics article').forEach(box=>{
      if(box.querySelector(':scope > .nl4-direct-stat-download')) return;
      const label=box.querySelector('span,b,small')?.textContent?.trim()||'NL4 STAT';
      const value=box.querySelector('strong')?.textContent?.trim()||'';
      const btn=document.createElement('button');
      btn.type='button';btn.className='nl4-direct-stat-download';btn.textContent='⇩';
      btn.title='Download this stat';btn.dataset.statLabel=label;btn.dataset.statValue=value;
      box.appendChild(btn);
    });
  }

  document.addEventListener('click',event=>{
    const btn=event.target.closest('.nl4-direct-stat-download');
    if(!btn) return;
    event.preventDefault();event.stopPropagation();
    makePng(btn.dataset.statLabel,btn.dataset.statValue,'2026/27');
  },true);

  addStaticButtons();
  const obs=new MutationObserver(addStaticButtons);
  obs.observe(document.documentElement,{subtree:true,childList:true});
})();
