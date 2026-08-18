-- Run this once in Supabase SQL Editor.
create table if not exists public.premier_league_standings (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  position integer not null check (position between 1 and 20),
  club text not null,
  played integer not null default 0 check (played >= 0),
  wins integer not null default 0 check (wins >= 0),
  draws integer not null default 0 check (draws >= 0),
  losses integer not null default 0 check (losses >= 0),
  goals_for integer not null default 0 check (goals_for >= 0),
  goals_against integer not null default 0 check (goals_against >= 0),
  goal_difference integer not null default 0,
  points integer not null default 0 check (points >= 0),
  updated_at timestamptz not null default now(),
  unique (season, club),
  unique (season, position)
);

alter table public.premier_league_standings enable row level security;

-- Public site may read standings.
drop policy if exists "Public can read Premier League standings" on public.premier_league_standings;
create policy "Public can read Premier League standings"
on public.premier_league_standings for select
to anon, authenticated
using (true);

-- Only users registered in public.admins may change standings.
drop policy if exists "Admins can insert Premier League standings" on public.premier_league_standings;
create policy "Admins can insert Premier League standings"
on public.premier_league_standings for insert
to authenticated
with check (exists (
  select 1 from public.admins a where a.user_id = auth.uid()
));

drop policy if exists "Admins can update Premier League standings" on public.premier_league_standings;
create policy "Admins can update Premier League standings"
on public.premier_league_standings for update
to authenticated
using (exists (
  select 1 from public.admins a where a.user_id = auth.uid()
))
with check (exists (
  select 1 from public.admins a where a.user_id = auth.uid()
));

drop policy if exists "Admins can delete Premier League standings" on public.premier_league_standings;
create policy "Admins can delete Premier League standings"
on public.premier_league_standings for delete
to authenticated
using (exists (
  select 1 from public.admins a where a.user_id = auth.uid()
));
