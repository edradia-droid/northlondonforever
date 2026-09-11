begin;

alter table public.match_lineups add column if not exists team_name text;
alter table public.fixtures add column if not exists man_of_the_match_team text;

update public.match_lineups ml set team_name = 'Arsenal'
from public.fixtures f
where ml.fixture_id = f.id and (ml.team_name is null or btrim(ml.team_name) = '');

alter table public.match_lineups alter column team_name set not null;

alter table public.match_lineups drop constraint if exists match_lineups_fixture_id_player_name_key;
drop index if exists public.match_lineups_fixture_id_player_name_key;
create unique index if not exists match_lineups_fixture_team_player_key
  on public.match_lineups (fixture_id, team_name, player_name);
create index if not exists match_lineups_fixture_team_idx
  on public.match_lineups (fixture_id, team_name, is_starter);

create table if not exists public.ucl_player_stats (
  id uuid primary key default gen_random_uuid(), season text not null, team_name text not null,
  player_name text not null, position text, appearances integer not null default 0,
  starts integer not null default 0, minutes integer not null default 0, goals integer not null default 0,
  assists integer not null default 0, yellow_cards integer not null default 0,
  red_cards integer not null default 0, saves integer not null default 0,
  man_of_the_match integer not null default 0, updated_at timestamptz not null default now(),
  unique (season, team_name, player_name)
);

create table if not exists public.ucl_team_stats (
  id uuid primary key default gen_random_uuid(), season text not null, team_name text not null,
  matches integer not null default 0, wins integer not null default 0, draws integer not null default 0,
  losses integer not null default 0, goals_for integer not null default 0, goals_against integer not null default 0,
  points integer not null default 0, possession_total numeric not null default 0,
  shots integer not null default 0, shots_on_target integer not null default 0, corners integer not null default 0,
  corner_goals integer not null default 0, fouls integer not null default 0, offsides integer not null default 0,
  saves integer not null default 0, yellow_cards integer not null default 0,
  red_cards integer not null default 0, updated_at timestamptz not null default now(),
  unique (season, team_name)
);

alter table public.ucl_player_stats enable row level security;
alter table public.ucl_team_stats enable row level security;
drop policy if exists "public reads UCL player stats" on public.ucl_player_stats;
drop policy if exists "admins manage UCL player stats" on public.ucl_player_stats;
drop policy if exists "public reads UCL team stats" on public.ucl_team_stats;
drop policy if exists "admins manage UCL team stats" on public.ucl_team_stats;
create policy "public reads UCL player stats" on public.ucl_player_stats for select to anon, authenticated using (true);
create policy "admins manage UCL player stats" on public.ucl_player_stats for all to authenticated
  using ((select private.is_nl4_admin())) with check ((select private.is_nl4_admin()));
create policy "public reads UCL team stats" on public.ucl_team_stats for select to anon, authenticated using (true);
create policy "admins manage UCL team stats" on public.ucl_team_stats for all to authenticated
  using ((select private.is_nl4_admin())) with check ((select private.is_nl4_admin()));
grant select on public.ucl_player_stats, public.ucl_team_stats to anon;
grant select, insert, update, delete on public.ucl_player_stats, public.ucl_team_stats to authenticated, service_role;
commit;
