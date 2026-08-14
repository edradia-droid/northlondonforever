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

function cardHtml(table, row) {
  const image = row.image_url
    ? `<img src="${escapeHtml(row.image_url)}" alt="">`
    : `<div style="height:180px;display:grid;place-items:center;background:#1c1c1c;color:#555">NL4</div>`;

  let title = row.name || row.title || row.opponent || "Untitled";
  let meta = "";
  if (table === "players") meta = [row.position,row.era,row.shirt_number ? `#${row.shirt_number}` : ""].filter(Boolean).join(" • ");
  if (table === "news") meta = row.published_at ? new Date(row.published_at).toLocaleString() : "No publish date";
  if (table === "fixtures") meta = `${row.competition || "Fixture"} • ${new Date(row.kickoff_at).toLocaleString()}`;
  if (table === "trophies") meta = [row.season,row.trophy_year].filter(Boolean).join(" • ");

  return `<article class="content-card">
    ${image}
    <div class="card-body">
      <h3>${escapeHtml(title)}</h3>
      <div class="meta">${escapeHtml(meta)}</div>
      <span class="status ${row.is_published ? "live" : ""}">${row.is_published ? "Published" : "Draft"}</span>
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
  setMessage(matchSaveMessage, 'Match saved. Public fixtures will use this data.', 'success');
  await loadFixturesAdmin();
}

document.getElementById('saveMatchBtn').addEventListener('click', saveCurrentMatch);
document.getElementById('closeMatchDialog').addEventListener('click', () => matchDialog.close());
document.getElementById('doneMatchDialog').addEventListener('click', () => matchDialog.close());

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

async function loadTable(table) {
  if (table === "fixtures") return loadFixturesAdmin();
  const schema = schemas[table];
  const ascending = table !== "news";
  const { data, error } = await db.from(table).select("*").order(schema.order, { ascending });

  const holder = document.getElementById(`${table}List`);
  if (error) {
    holder.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
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

  setMessage(editorMessage, "Saving…");
  let response;
  if (id) response = await db.from(table).update(payload).eq("id", id);
  else response = await db.from(table).insert(payload);

  if (response.error) {
    setMessage(editorMessage, response.error.message, "error");
    return;
  }

  setMessage(editorMessage, "Saved.", "success");
  await loadTable(table);
  setTimeout(() => dialog.close(), 300);
});

window.nl4Edit = openEditor;
window.nl4Delete = async (table, id) => {
  if (!confirm("Delete this item permanently?")) return;
  const { error } = await db.from(table).delete().eq("id", id);
  if (error) return alert(error.message);
  await loadTable(table);
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
