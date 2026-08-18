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
  const { data, error } = await db.rpc("rebuild_premier_league_standings", {
    p_season: "2026/27"
  });

  if (error) throw error;

  await loadTable("premier_league_standings");
  return Number(data || 0);
}

async function requestPublicForecastRefresh(reason = "score_update") {
  try {
    const { data, error } = await db.rpc("request_public_forecast_refresh", {
      p_season: "2026/27",
      p_reason: String(reason || "score_update")
    });

    if (error) throw error;

    console.log("NL4 Public Model refresh requested:", data);
    return data;
  } catch (error) {
    // A refresh-request failure must never undo a successfully saved score
    // or a successfully rebuilt league table.
    console.error("NL4 Public Model refresh request failed:", error);
    return null;
  }
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
const lineupFormation = document.getElementById('lineupFormation');
const lineupPitchSlot = document.getElementById('lineupPitchSlot');
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
      <div class="admin-event-player"><strong>${escapeHtml(row.player_name)}</strong><small>${escapeHtml(row.position || 'Player')}${row.is_starter && row.pitch_slot ? ` • ${escapeHtml(row.pitch_slot)}` : ''}${row.formation ? ` • ${escapeHtml(row.formation)}` : ''} • ${mins} min</small></div>
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
  if (lineupPitchSlot) {
    lineupPitchSlot.disabled = !starter;
    if (!starter) lineupPitchSlot.value = '';
  }
});
lineupMinuteOn.disabled = true;
if (lineupPitchSlot) lineupPitchSlot.disabled = false;


document.getElementById('clearLineupBtn').addEventListener('click', async () => {
  if (!currentFixture) return;
  if (!confirm('Clear the entire Arsenal lineup and substitutions for this fixture? This deletes the saved lineup from Supabase.')) return;

  setMessage(lineupMessage, 'Clearing lineup…');
  const { error } = await db.from('match_lineups').delete().eq('fixture_id', currentFixture.id);
  if (error) return setMessage(lineupMessage, error.message, 'error');

  lineupPlayer.value = '';
  lineupRole.value = 'starter';
  if (lineupFormation) lineupFormation.value = '4-3-3';
  if (lineupPitchSlot) {
    lineupPitchSlot.value = '';
    lineupPitchSlot.disabled = false;
  }
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
  const formation = lineupFormation?.value || '4-3-3';
  const pitchSlot = isStarter ? (lineupPitchSlot?.value || '') : '';
  const minuteOn = isStarter ? 0 : Number(lineupMinuteOn.value);
  const minuteOff = lineupMinuteOff.value === '' ? null : Number(lineupMinuteOff.value);

  if (isStarter && !pitchSlot)
    return setMessage(lineupMessage,'Choose a pitch slot for this starter.','error');
  if (!isStarter && (!Number.isFinite(minuteOn) || minuteOn < 0))
    return setMessage(lineupMessage,'Enter minute on for the substitute.','error');
  if (minuteOff !== null && minuteOff < minuteOn)
    return setMessage(lineupMessage,'Minute off cannot be before minute on.','error');

  const payload = {
    fixture_id: currentFixture.id,
    player_name: playerName,
    position: selected.dataset.position || null,
    formation: formation,
    pitch_slot: isStarter ? pitchSlot : null,
    is_starter: isStarter,
    minute_on: minuteOn,
    minute_off: minuteOff,
    updated_at: new Date().toISOString()
  };

  if (isStarter) {
    const { data: slotOwner, error: slotError } = await db.from('match_lineups')
      .select('id,player_name')
      .eq('fixture_id',currentFixture.id)
      .eq('is_starter',true)
      .eq('pitch_slot',pitchSlot)
      .neq('player_name',playerName)
      .maybeSingle();
    if (slotError) return setMessage(lineupMessage,slotError.message,'error');
    if (slotOwner) return setMessage(lineupMessage,`${pitchSlot} is already assigned to ${slotOwner.player_name}.`,'error');
  }

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
  if (lineupPitchSlot) {
    lineupPitchSlot.value = '';
    lineupPitchSlot.disabled = false;
  }
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
        const refreshId = await requestPublicForecastRefresh('arsenal_fulltime_score_update');
        setMessage(
          matchSaveMessage,
          refreshId
            ? 'Match saved → standings updated → Public Model refresh requested.'
            : 'Match saved and standings updated. Public Model refresh request failed; existing forecast was left untouched.',
          refreshId ? 'success' : 'error'
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

      const confirmed =
        ['fulltime','finished','ft'].includes(String(payload.status || '').toLowerCase()) &&
        payload.home_score !== null &&
        payload.away_score !== null;

      if (confirmed) {
        const refreshId = await requestPublicForecastRefresh('league_result_update');
        setMessage(
          editorMessage,
          refreshId
            ? 'Result saved → standings updated → Public Model refresh requested.'
            : 'Result saved and standings updated. Public Model refresh request failed; existing forecast was left untouched.',
          refreshId ? 'success' : 'error'
        );
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
      await requestPublicForecastRefresh('league_result_deleted');
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
   NL4 ADMIN MODEL — LIVE READER RECOVERY
   Reads live Supabase football data first.
   Admin-history tables are optional and can never block reading.
   ========================================================= */
(function(){
  const panel=document.getElementById('modelTestingPanel'); if(!panel)return;
  const syncBtn=document.getElementById('generateModelTestBtn');
  const openBtn=document.getElementById('openModelTestBtn');
  const clearBtn=document.getElementById('clearModelTestBtn');
  const preview=document.getElementById('modelTestPreview');
  const message=document.getElementById('modelTestMessage');
  const badge=document.getElementById('modelTestStatusBadge');
  const snapshotCount=document.getElementById('modelTestRounds');
  const matchesEl=document.getElementById('modelTestMatches');
  const recordEl=document.getElementById('modelTestArsenalRecord');
  const timeEl=document.getElementById('modelTestGeneratedAt');
  const RUN_ID='admin-live-2026-27';

  const finished=s=>['fulltime','ft','aet','pen','finished','complete','completed'].includes(String(s||'').trim().toLowerCase());
  const key=(h,a)=>`${String(h||'').trim().toLowerCase()}__${String(a||'').trim().toLowerCase()}`;

  function setAdminModelMessage(text,type){
    if(typeof setMessage==='function') return setMessage(message,text,type);
    if(message) message.textContent=text;
  }

  async function readSharedData(){
    if(!db || typeof db.from!=='function') throw new Error('Supabase client is not available.');

    // These three sources are the only required inputs.
    const [standingsRes,arsenalRes,leagueRes]=await Promise.all([
      db.from('premier_league_standings')
        .select('position,club,played,wins,draws,losses,goals_for,goals_against,goal_difference,points')
        .eq('season','2026/27').order('position',{ascending:true}),
      db.from('fixtures')
        .select('home_team,away_team,is_home,opponent,arsenal_score,opponent_score,status,kickoff_at,matchday,competition,season,updated_at')
        .eq('season','2026/27').eq('competition','Premier League'),
      db.from('premier_league_matches')
        .select('home_team,away_team,home_score,away_score,status,kickoff_at,matchday,season,updated_at')
        .eq('season','2026/27')
    ]);

    if(standingsRes.error) throw standingsRes.error;
    if(arsenalRes.error) throw arsenalRes.error;
    if(leagueRes.error) throw leagueRes.error;

    // Admin snapshot count is informative only. Never let it block the live reader.
    let savedSnapshots=0;
    try{
      const snapRes=await db.from('nl4_admin_model_snapshots')
        .select('id',{count:'exact',head:true})
        .eq('season','2026/27').eq('test_id',RUN_ID);
      if(!snapRes.error) savedSnapshots=snapRes.count||0;
      else console.warn('Admin snapshot count unavailable:',snapRes.error);
    }catch(err){
      console.warn('Admin snapshot count unavailable:',err);
    }

    return {
      standings:standingsRes.data||[],
      arsenalFixtures:arsenalRes.data||[],
      leagueMatches:leagueRes.data||[],
      snapshotCount:savedSnapshots
    };
  }

  function normalizedArsenalResult(x){
    const home=String(x.home_team || (x.is_home ? 'Arsenal' : x.opponent) || '').trim();
    const away=String(x.away_team || (x.is_home ? x.opponent : 'Arsenal') || '').trim();
    const hs=x.is_home ? x.arsenal_score : x.opponent_score;
    const as=x.is_home ? x.opponent_score : x.arsenal_score;
    return {home_team:home,away_team:away,home_score:Number(hs),away_score:Number(as),matchday:Number(x.matchday)||0};
  }

  function liveCompletedResults(data){
    const arsenal=data.arsenalFixtures
      .filter(x=>finished(x.status)&&x.arsenal_score!=null&&x.opponent_score!=null)
      .map(normalizedArsenalResult);

    const seen=new Set(arsenal.map(x=>key(x.home_team,x.away_team)));

    const others=data.leagueMatches
      .filter(x=>finished(x.status)&&x.home_score!=null&&x.away_score!=null)
      .filter(x=>!seen.has(key(x.home_team,x.away_team)))
      .map(x=>({
        home_team:String(x.home_team||'').trim(),
        away_team:String(x.away_team||'').trim(),
        home_score:Number(x.home_score),
        away_score:Number(x.away_score),
        matchday:Number(x.matchday)||0
      }));

    return {arsenal,others,all:[...arsenal,...others]};
  }

  function arsenalRecord(fixtures){
    let w=0,d=0,l=0;
    fixtures.filter(x=>finished(x.status)&&x.arsenal_score!=null&&x.opponent_score!=null).forEach(x=>{
      const gf=Number(x.arsenal_score),ga=Number(x.opponent_score);
      if(gf>ga)w++; else if(gf===ga)d++; else l++;
    });
    return `${w}W ${d}D ${l}L`;
  }

  async function syncAdminModel(){
    setAdminModelMessage('Reading live Supabase data…');
    if(badge)badge.textContent='READING…';

    const data=await readSharedData();
    const completed=liveCompletedResults(data);
    const completedMatches=completed.all.length;
    const maxMd=Math.max(0,...completed.all.map(x=>x.matchday||0));
    const now=new Date().toISOString();

    if(matchesEl)matchesEl.textContent=String(completedMatches);
    if(recordEl)recordEl.textContent=arsenalRecord(data.arsenalFixtures);
    if(snapshotCount)snapshotCount.textContent=String(data.snapshotCount);
    if(timeEl)timeEl.textContent=`Last read ${new Date(now).toLocaleString()}`;
    if(badge)badge.textContent='LIVE DATA READY';

    if(preview)preview.innerHTML=`<div class="model-test-summary" style="margin:0">
      <article><span>LEAGUE TABLE</span><strong>${data.standings.length}/20 clubs</strong></article>
      <article><span>ARSENAL FIXTURES</span><strong>${data.arsenalFixtures.length}/38</strong></article>
      <article><span>OTHER TEAM FIXTURES</span><strong>${data.leagueMatches.length}/342</strong></article>
      <article><span>COMPLETED RESULTS</span><strong>${completedMatches}/380</strong></article>
    </div>
    <p class="muted" style="margin-top:10px">Live reader de-duplicates Arsenal matches across fixtures and premier_league_matches. Admin-history storage is not required for this status check.</p>`;

    // Keep admin-model run syncing if permissions allow it, but make it non-blocking.
    try{
      const payload={
        season:'2026/27',
        test_id:RUN_ID,
        score_style:'live-supabase',
        through_matchday:Math.max(1,Math.min(38,maxMd||1)),
        master_results:{
          standings:data.standings,
          arsenal_fixtures:data.arsenalFixtures,
          league_matches:data.leagueMatches
        },
        visible_results:{
          completed_matches:completedMatches,
          arsenal_completed:completed.arsenal.length,
          other_completed:completed.others.length
        },
        generated_at:now,
        updated_at:now
      };
      const runRes=await db.from('nl4_admin_model_runs').upsert(payload,{onConflict:'test_id'});
      if(runRes.error) console.warn('Admin Model run history not saved:',runRes.error);
    }catch(err){
      console.warn('Admin Model run history not saved:',err);
    }

    setAdminModelMessage(
      `Admin Model reader is working • ${completedMatches} completed league matches detected from live Supabase data.`,
      'success'
    );
    return data;
  }

  syncBtn?.addEventListener('click',()=>{
    syncAdminModel().catch(e=>{
      console.error('NL4 Admin Model sync:',e);
      setAdminModelMessage(e.message||'Could not read Admin Model live data.','error');
      if(badge)badge.textContent='READ FAILED';
    });
  });

  openBtn?.addEventListener('click',()=>{
    const frame=document.getElementById('adminModelFrame');
    if(!frame)return;
    if(!frame.src)frame.src=frame.dataset.src||'admin-model.html?adminmodel=1';
    frame.style.display='block';
    frame.scrollIntoView({behavior:'smooth',block:'start'});
    setAdminModelMessage('Admin Model loaded below.','success');
  });

  clearBtn?.addEventListener('click',async()=>{
    try{
      const {error}=await db.from('nl4_admin_model_snapshots')
        .delete().eq('season','2026/27').eq('test_id',RUN_ID);
      if(error)throw error;
      if(snapshotCount)snapshotCount.textContent='0';
      setAdminModelMessage('Admin Model forecast history cleared. Live football data was untouched.','success');
    }catch(e){
      setAdminModelMessage(e.message||'Could not clear Admin Model history.','error');
    }
  });

  syncAdminModel().catch(e=>{
    console.error('NL4 Admin Model initial read:',e);
    if(badge)badge.textContent='READ FAILED';
    setAdminModelMessage(`Admin Model read failed: ${e.message||'Unknown error'}`,'error');
  });
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
    const completedRaw=Number(latest?.completed_matches);
    const titleRaw=Number(latest?.title_probability);
    const row={
      season:'2026/27',headline:v('interpHeadline'),status_label:v('interpStatusLabel')||'TITLE RACE UPDATE',
      summary:v('interpSummary'),key_takeaway:v('interpTakeaway'),factor_1:v('interpFactor1'),factor_2:v('interpFactor2'),factor_3:v('interpFactor3'),
      selected_stats:stats,interpretation_mode:'automatic+manual',interpretation_style:selectedStyle,
      is_published:true,published_at:new Date().toISOString(),
      source_completed_matches:Number.isFinite(completedRaw)?Math.round(completedRaw):null,
      source_title_probability:Number.isFinite(titleRaw)?titleRaw:null
    };

    const {error:unpublishError}=await client.from('nl4_model_interpretations')
      .update({is_published:false}).eq('season','2026/27').eq('is_published',true);
    if(unpublishError){
      console.error('NL4 forecast unpublish-before-publish failed:',unpublishError);
      say(`Could not prepare publication: ${unpublishError.message||'Unknown Supabase error'}${unpublishError.code?` [${unpublishError.code}]`:''}`);
      return;
    }

    const {error}=await client.from('nl4_model_interpretations').insert(row);
    if(error){
      console.error('NL4 forecast publish failed:',{error,row});
      const code=String(error.code||'');
      const message=String(error.message||'');
      const confirmedMissingTable=(code==='PGRST205'||code==='42P01'||/could not find the table/i.test(message));
      if(confirmedMissingTable){
        const warn=$('forecastPublisherSetupWarning'); if(warn)warn.hidden=false;
        say(`Database setup required: ${message}${code?` [${code}]`:''}`);
      }else{
        const warn=$('forecastPublisherSetupWarning'); if(warn)warn.hidden=true;
        const details=error.details?` • ${error.details}`:'';
        const hint=error.hint?` • Hint: ${error.hint}`:'';
        say(`Publish failed: ${message||'Unknown Supabase error'}${code?` [${code}]`:''}${details}${hint}`);
      }
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



/* V16.2 • NL4 Model graph interpretation editor + selectable automatic options */
(function(){
 const SEASON='2026/27';
 const labels={balanced:'BALANCED',momentum:'MOMENTUM',analyst:'ANALYST',fan:'FAN VIEW'};
 let current={mode:'automatic',style:'balanced',option:'balanced-1'};
 let latestHistory=[];

 function db(){return window.nl4Supabase||window.nl4Supabase?.client||window.nl4Supabase?.supabase||window.supabaseClient||window.db||window.supabaseDb||null}
 const fmt=n=>Number(n||0).toFixed(1);
 const md=n=>Math.max(0,Math.min(38,Math.ceil(Number(n||0)/10)));

 function historyContext(rows){
   const first=rows[0],last=rows[rows.length-1];
   const start=Number(first?.title_probability||0),now=Number(last?.title_probability||0),delta=now-start;
   return {
     start,now,delta,abs:Math.abs(delta).toFixed(1),points:rows.length,
     matchday:md(last?.completed_matches),completed:Number(last?.completed_matches||0),
     top4:Number(last?.top4_probability||0),pts:Number(last?.expected_points||0),
     pos:Number(last?.expected_position||0),conf:Number(last?.confidence_score||0)
   };
 }

 function choices(style,c){
   const up=c.delta>0.05,down=c.delta<-0.05;
   const direction=up?'risen':down?'fallen':'remained broadly stable';
   const trend=up?'gaining ground':down?'losing ground':'holding steady';
   const base = {
     balanced:[
       {id:'balanced-1',title:`Arsenal ${trend} in the title race`,text:`Arsenal's NL4 Model title chance is ${fmt(c.now)}% at Matchday ${c.matchday}. It has ${direction}${Math.abs(c.delta)>=0.05?` by ${c.abs} percentage points from ${fmt(c.start)}%`:''}. The graph shows the model's season movement without assigning the full change to one result.`},
       {id:'balanced-2',title:`NL4 Model moves to ${fmt(c.now)}%`,text:`After ${c.completed} completed league match${c.completed===1?'':'es'}, Arsenal are at ${fmt(c.now)}% for the title. The saved NL4 Model history has moved ${c.delta>=0?'+':''}${fmt(c.delta)} points from its first forecast. The direction may change again as new league evidence arrives.`},
       {id:'balanced-3',title:`Arsenal's season trend after Matchday ${c.matchday}`,text:`The NL4 Model currently gives Arsenal a ${fmt(c.now)}% title chance, with ${c.points} saved forecast points on the graph. The season movement is ${up?'positive':down?'negative':'stable'} so far, but the graph should be read as a changing probability path rather than a guaranteed prediction.`}
     ],
     momentum:[
       {id:'momentum-1',title:`Arsenal ${up?'build':'track'} title-race momentum`,text:up?`Arsenal are gaining momentum: their title probability has climbed from ${fmt(c.start)}% to ${fmt(c.now)}%, up ${c.abs} points across the saved NL4 Model history.`:down?`Arsenal have lost momentum: their title probability has fallen from ${fmt(c.start)}% to ${fmt(c.now)}%, down ${c.abs} points.`:`Arsenal's title-race momentum is steady at ${fmt(c.now)}%, with little net movement from the opening forecast.`},
       {id:'momentum-2',title:`Momentum reading: ${fmt(c.now)}%`,text:`At Matchday ${c.matchday}, Arsenal are ${trend}. The NL4 Model has changed ${c.delta>=0?'+':''}${fmt(c.delta)} percentage points from its first saved forecast and now projects ${fmt(c.pts)} expected points.`},
       {id:'momentum-3',title:`Title-race direction: ${up?'upward':down?'downward':'steady'}`,text:`The graph's current direction is ${up?'upward':down?'downward':'flat'}. Arsenal stand at ${fmt(c.now)}% for the title, and the next saved result update will show whether this movement continues or reverses.`}
     ],
     analyst:[
       {id:'analyst-1',title:`Model movement analysis • MD${c.matchday}`,text:`Arsenal's title probability is ${fmt(c.now)}%, compared with ${fmt(c.start)}% at the first saved snapshot. Net movement is ${c.delta>=0?'+':''}${fmt(c.delta)} points across ${c.points} snapshots. Current model confidence is ${Math.round(c.conf)}/100.`},
       {id:'analyst-2',title:`Probability path and evidence update`,text:`The latest NL4 Model snapshot has Arsenal at ${fmt(c.now)}%, ${fmt(c.pts)} expected points and an expected finish of ${fmt(c.pos)}. The graph has moved ${c.delta>=0?'+':''}${fmt(c.delta)} points from the opening snapshot as current-season evidence enters the model.`},
       {id:'analyst-3',title:`Saved forecast distribution update`,text:`The graph currently contains ${c.points} NL4 Model forecast points through Matchday ${c.matchday}. Arsenal's latest title estimate is ${fmt(c.now)}%, a net ${c.delta>=0?'+':''}${fmt(c.delta)}-point move from the first saved forecast. This is a model update, not a causal attribution to one match.`}
     ],
     fan:[
       {id:'fan-1',title:`Arsenal are at ${fmt(c.now)}% for the title`,text:up?`The Gunners are moving the right way: Arsenal's title chance has risen ${c.abs} points from ${fmt(c.start)}% to ${fmt(c.now)}%.` : down?`Arsenal have given up some ground: the title chance has dropped ${c.abs} points to ${fmt(c.now)}%.`:`Arsenal's title chance is holding steady at ${fmt(c.now)}%.`},
       {id:'fan-2',title:`How the title race looks now`,text:`After Matchday ${c.matchday}, the NL4 Model gives Arsenal a ${fmt(c.now)}% chance of winning the league. The season graph is ${up?'trending upward':down?'trending downward':'currently steady'}.`},
       {id:'fan-3',title:`North London title-race watch`,text:`Arsenal are currently ${fmt(c.now)}% to win the Premier League in the NL4 NL4 Model. That's ${c.delta>=0?'up':'down'} ${c.abs} points from the first saved forecast, with more movement expected as results arrive.`}
     ]
   };
   return base[style]||base.balanced;
 }

 function render(){
   document.querySelectorAll('.graph-mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.graphMode===current.mode));
   document.querySelectorAll('.graph-style-btn').forEach(b=>b.classList.toggle('active',b.dataset.graphStyle===current.style));
   const auto=document.getElementById('graphAutomaticControls'), man=document.getElementById('graphManualControls');
   if(auto)auto.hidden=current.mode!=='automatic'; if(man)man.hidden=current.mode!=='manual';
   const st=document.getElementById('graphInterpretationState'), pv=document.getElementById('graphInterpretationAdminPreview');
   if(st)st.textContent=current.mode==='manual'?'MANUAL':`AUTOMATIC • ${labels[current.style]||'BALANCED'}`;
   if(pv)pv.textContent=current.mode==='manual'
      ?'The NL4 Model graph will display the manual text below.'
      :'Choose one of the generated options below. Its live numbers and wording will refresh when results change.';
   renderChoices();
 }

 function renderChoices(){
   const host=document.getElementById('graphAutomaticChoices'); if(!host)return;
   if(!latestHistory.length){host.innerHTML='<div class="empty">No NL4 Model history found yet.</div>';return;}
   const c=historyContext(latestHistory), opts=choices(current.style,c);
   if(!opts.some(x=>x.id===current.option)) current.option=opts[0].id;
   host.innerHTML=opts.map((o,i)=>`
     <article class="graph-auto-choice-card ${o.id===current.option?'selected':''}">
       <div class="choice-top"><span>OPTION ${i+1}</span>${o.id===current.option?'<strong>SELECTED</strong>':''}</div>
       <h5>${o.title}</h5>
       <p>${o.text}</p>
       <button type="button" class="ghost-btn" data-select-graph-option="${o.id}">${o.id===current.option?'Selected':'Use This Interpretation'}</button>
     </article>`).join('');
 }

 async function load(showMessage=false){
   const c=db();
   if(!c){saveStatus('Could not connect to Supabase.',true);return false;}
   try{
     if(showMessage)saveStatus('Refreshing NL4 Model graph options…');
     const [settings,history]=await Promise.all([
       c.from('nl4_public_forecast_settings')
         .select('graph_interpretation_mode,graph_interpretation_style,graph_interpretation_option,graph_interpretation_headline,graph_interpretation_text')
         .eq('season',SEASON).limit(1),
       c.from('title_probability_history')
         .select('completed_matches,title_probability,top4_probability,expected_points,expected_position,confidence_score,created_at')
         .eq('season',SEASON).order('completed_matches',{ascending:true})
     ]);
     if(settings.error)throw settings.error;
     if(history.error)throw history.error;

     const r=settings.data?.[0]||{};
     current.mode=r.graph_interpretation_mode||'automatic';
     current.style=r.graph_interpretation_style||'balanced';
     current.option=r.graph_interpretation_option||`${current.style}-1`;
     latestHistory=history.data||[];

     const h=document.getElementById('graphInterpretationHeadlineInput');
     const t=document.getElementById('graphInterpretationTextInput');
     if(h)h.value=r.graph_interpretation_headline||'';
     if(t)t.value=r.graph_interpretation_text||'';

     render();
     if(showMessage){
       saveStatus(latestHistory.length
         ? `Options refreshed from ${latestHistory.length} saved NL4 Model forecast point${latestHistory.length===1?'':'s'}.`
         : 'No NL4 Model forecast history was returned from Supabase.', !latestHistory.length);
     }
     return true;
   }catch(error){
     console.error('NL4 graph option refresh failed:',error);
     saveStatus(`Refresh failed: ${error?.message||'Unknown Supabase error'}`,true);
     return false;
   }
 }
 function saveStatus(message,isError=false){
   let el=document.getElementById('graphInterpretationSaveMessage');
   if(!el){
     const host=document.getElementById('graphInterpretationAdmin');
     if(host){
       el=document.createElement('p');
       el.id='graphInterpretationSaveMessage';
       el.className='muted';
       host.appendChild(el);
     }
   }
   if(el){
     el.textContent=message;
     el.style.color=isError?'#ff7676':'#7ee787';
   }
 }
 async function patch(values){
   const c=db();
   if(!c){saveStatus('Could not connect to Supabase.',true);return false;}
   try{
     const payload={
       p_season:SEASON,
       p_mode:values.graph_interpretation_mode ?? current.mode ?? 'automatic',
       p_style:values.graph_interpretation_style ?? current.style ?? 'balanced',
       p_option:values.graph_interpretation_option ?? current.option ?? `${current.style||'balanced'}-1`,
       p_headline:values.graph_interpretation_headline !== undefined
         ? values.graph_interpretation_headline
         : (document.getElementById('graphInterpretationHeadlineInput')?.value.trim()||null),
       p_text:values.graph_interpretation_text !== undefined
         ? values.graph_interpretation_text
         : (document.getElementById('graphInterpretationTextInput')?.value.trim()||null)
     };
     const {data,error}=await c.rpc('nl4_save_graph_interpretation',payload);
     if(error)throw error;
     saveStatus('Graph interpretation saved to Supabase.');
     return true;
   }catch(error){
     console.error('NL4 graph interpretation save failed:',error);
     saveStatus(`Save failed: ${error?.message||'Unknown Supabase error'}`,true);
     return false;
   }
 }
 async function mode(v){
   const previous=current.mode; current.mode=v; render();
   if(!await patch({graph_interpretation_mode:v})){current.mode=previous;render();}
 }
 async function style(v){
   const previous={...current};
   current.style=v; current.mode='automatic'; current.option=`${v}-1`; render();
   if(!await patch({graph_interpretation_style:v,graph_interpretation_option:current.option,graph_interpretation_mode:'automatic'})){
     current=previous;render();
   }
 }
 async function selectOption(id){
   const previous={...current};
   current.option=id; current.mode='automatic'; render();
   if(!await patch({graph_interpretation_mode:'automatic',graph_interpretation_style:current.style,graph_interpretation_option:id})){
     current=previous;render();
   }
 }
 async function saveCurrentInterpretation(){
   if(current.mode==='automatic'){
     if(!latestHistory.length){
       saveStatus('Refresh Options first — no NL4 Model history is loaded.',true);
       return;
     }
     const ok=await patch({
       graph_interpretation_mode:'automatic',
       graph_interpretation_style:current.style,
       graph_interpretation_option:current.option
     });
     if(ok){
       render();
       saveStatus(`Automatic graph interpretation saved: ${labels[current.style]||'BALANCED'} • Option ${String(current.option).split('-').pop()}.`);
     }
     return;
   }

   const h=document.getElementById('graphInterpretationHeadlineInput')?.value.trim()||'';
   const t=document.getElementById('graphInterpretationTextInput')?.value.trim()||'';
   if(!t){
     saveStatus('Enter a manual graph interpretation first.',true);
     return;
   }
   if(await patch({
     graph_interpretation_mode:'manual',
     graph_interpretation_headline:h||null,
     graph_interpretation_text:t
   })){
     current.mode='manual';
     render();
     saveStatus('Manual graph interpretation saved to Supabase.');
   }
 }
 async function clear(){
   const h=document.getElementById('graphInterpretationHeadlineInput'),t=document.getElementById('graphInterpretationTextInput');
   if(h)h.value='';if(t)t.value='';await patch({graph_interpretation_headline:null,graph_interpretation_text:null});
 }
 document.addEventListener('DOMContentLoaded',()=>{
   document.querySelectorAll('.graph-mode-btn').forEach(b=>b.addEventListener('click',()=>mode(b.dataset.graphMode)));
   document.querySelectorAll('.graph-style-btn').forEach(b=>b.addEventListener('click',()=>style(b.dataset.graphStyle)));
   document.getElementById('saveGraphInterpretationBtn')?.addEventListener('click',saveCurrentInterpretation);
   document.getElementById('clearGraphInterpretationBtn')?.addEventListener('click',clear);
   document.getElementById('refreshGraphAutoChoicesBtn')?.addEventListener('click',()=>load(true));
   document.getElementById('graphAutomaticChoices')?.addEventListener('click',e=>{
      const b=e.target.closest('[data-select-graph-option]'); if(b)selectOption(b.dataset.selectGraphOption);
   });
   setTimeout(()=>load(false),700);
 });
})();

/* V16.8 • Atomic Premier League result save — integrated */
(function(){
  const btn=document.getElementById('saveMatchBtn');
  if(!btn) return;

  btn.addEventListener('click', async function(event){
    const fixture=(typeof currentFixture!=='undefined'?currentFixture:window.currentFixture);
    if(!fixture) return;

    const isPL=
      String(fixture.competition||'').trim().toLowerCase().includes('premier') &&
      String(fixture.season||'').trim()==='2026/27';

    if(!isPL) return; // keep existing save flow for non-Premier-League fixtures

    event.preventDefault();
    event.stopImmediatePropagation();

    const client=
      window.nl4Supabase ||
      window.supabaseClient ||
      window.NL4_SUPABASE ||
      window.supabaseDb ||
      window.db;

    const msg=document.getElementById('matchSaveMessage');

    if(!client || typeof client.rpc!=='function'){
      if(msg){
        msg.textContent='Supabase client is not available.';
        msg.className='message error';
      }
      return;
    }

    const aRaw=document.getElementById('matchArsenalScore')?.value ?? '';
    const oRaw=document.getElementById('matchOpponentScore')?.value ?? '';
    const htARaw=document.getElementById('matchHTArsenalScore')?.value ?? '';
    const htORaw=document.getElementById('matchHTOpponentScore')?.value ?? '';

    let status=document.getElementById('matchStatus')?.value||'scheduled';

    const arsenalScore=aRaw===''?null:Number(aRaw);
    const opponentScore=oRaw===''?null:Number(oRaw);
    const htArsenalScore=htARaw===''?null:Number(htARaw);
    const htOpponentScore=htORaw===''?null:Number(htORaw);

    if(
      arsenalScore!==null &&
      opponentScore!==null &&
      !['cancelled','postponed'].includes(String(status).toLowerCase())
    ){
      status='fulltime';
      const statusSelect=document.getElementById('matchStatus');
      if(statusSelect) statusSelect.value='fulltime';
    }

    if(msg){
      msg.textContent='Saving result and rebuilding Premier League standings…';
      msg.className='message';
    }

    try{
      const {data,error}=await client.rpc('nl4_save_premier_league_fixture_result',{
        p_fixture_id:fixture.id,
        p_arsenal_score:arsenalScore,
        p_opponent_score:opponentScore,
        p_status:status,
        p_halftime_arsenal_score:htArsenalScore,
        p_halftime_opponent_score:htOpponentScore
      });

      if(error) throw error;

      if(typeof currentFixture!=='undefined'){
        currentFixture={
          ...currentFixture,
          arsenal_score:arsenalScore,
          opponent_score:opponentScore,
          halftime_arsenal_score:htArsenalScore,
          halftime_opponent_score:htOpponentScore,
          status
        };
      }

      const gd=Number(data?.goal_difference||0);
      const gdText=gd>0?`+${gd}`:`${gd}`;

      if(msg){
        msg.textContent=
          `Result saved • Table rebuilt • Arsenal: ${data?.played ?? '—'} P, `+
          `${data?.points ?? '—'} pts, GF ${data?.goals_for ?? '—'}, `+
          `GA ${data?.goals_against ?? '—'}, GD ${gdText}`;
        msg.className='message success';
      }

      if(typeof loadFixturesAdmin==='function') await loadFixturesAdmin();
      if(typeof loadStandingsAdmin==='function') await loadStandingsAdmin();
      if(typeof loadPremierLeagueStandings==='function') await loadPremierLeagueStandings();

      window.dispatchEvent(
        new CustomEvent('nl4:premier-league-result-saved',{detail:data||{}})
      );
    }catch(error){
      console.error('NL4 atomic Premier League result save failed:',error);
      if(msg){
        msg.textContent=`Result save failed: ${error?.message||'Unknown Supabase error'}`;
        msg.className='message error';
      }
    }
  }, true);
})();
