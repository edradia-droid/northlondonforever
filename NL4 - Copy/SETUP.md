# NL4 Supabase Admin — setup

The database side is already created in your Supabase project:

- `players`
- `news`
- `fixtures`
- `trophies`
- `admins`
- public image bucket: `nl4-media`
- Row Level Security is enabled.
- Visitors can read published content only.
- Authenticated users can edit only when their Supabase user ID exists in `admins`.

## 1. Copy these files into your NL4 project

Copy:

- `admin.html`
- `admin.css`
- `admin.js`
- `supabase-client.js`
- `nl4-data.js`

Keep them in the same folder as `index.html` unless you deliberately change paths.

## 2. Create your first admin user

In the Supabase dashboard:

1. Open **Authentication → Users**.
2. Create a user with your admin email and a strong password.
3. Copy that user's UUID.
4. Open **Table Editor → admins**.
5. Insert a row:
   - `user_id` = the copied UUID
   - `display_name` = your name (optional)

Do not put your password, service-role key, or secret key in any HTML/JS file.

## 3. Open the admin page

With Live Server:

`http://127.0.0.1:5500/admin.html`

Or on GitHub Pages:

`https://YOUR-USERNAME.github.io/YOUR-REPO/admin.html`

The page URL is not the security boundary. Supabase Auth + RLS enforce the permissions.

## 4. Use Supabase data on existing pages

Before your page's own JavaScript, add:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/dist/umd/supabase.min.js"></script>
<script src="supabase-client.js"></script>
<script src="nl4-data.js"></script>
```

Then:

```js
const stories = await NL4Data.news(6);
const players = await NL4Data.players();
const fixtures = await NL4Data.fixtures();
const trophies = await NL4Data.trophies();
```

See `integration-example.html`.

## Important

The frontend contains only a Supabase publishable key. This is expected for browser applications. The database's RLS policies are what prevent unauthorized writes.

The media bucket allows JPEG, PNG, WebP and GIF images up to 5 MB. The admin panel gives each upload a unique file path, so it does not need overwrite/upsert permissions.
