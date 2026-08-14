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
      ["appearances","Appearances","number"],["goals","Goals","number"],
      ["assists","Assists","number"],["clean_sheets","Clean sheets","number"],
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
      ["opponent","Opponent","text",true],["competition","Competition","text"],["venue","Venue","text"],
      ["kickoff_at","Kick-off","datetime-local",true],["status","Status","select",true,["scheduled","live","finished","postponed"]],
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

async function loadTable(table) {
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
