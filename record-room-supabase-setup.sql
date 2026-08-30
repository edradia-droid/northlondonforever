-- NL4 Record Room • Supabase setup
-- Purpose: dedicated detailed data for the other 19 Premier League teams.
-- IMPORTANT: This migration is intentionally separate from Arsenal fixtures,
-- match_events, match_lineups and premier_league_player_stats.
-- Run only after reviewing against the live Supabase project.

begin;

create table if not exists public.record_room_match_details (
  match_id uuid primary key references public.premier_league_matches(id) on delete cascade,
  referee text,
  venue text,
  attendance integer check (attendance is null or attendance >= 0),
  man_of_the_match text,
  halftime_home_score integer check (halftime_home_score is null or halftime_home_score >= 0),
  halftime_away_score integer check (halftime_away_score is null or halftime_away_score >= 0),
  added_time integer not null default 0 check (added_time between 0 and 30),
  source text,
  source_match_id text,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.record_room_match_stats (
  match_id uuid primary key references public.premier_league_matches(id) on delete cascade,
  home_possession numeric check (home_possession is null or home_possession between 0 and 100),
  away_possession numeric check (away_possession is null or away_possession between 0 and 100),
  home_shots integer check (home_shots is null or home_shots >= 0),
  away_shots integer check (away_shots is null or away_shots >= 0),
  home_shots_on_target integer check (home_shots_on_target is null or home_shots_on_target >= 0),
  away_shots_on_target integer check (away_shots_on_target is null or away_shots_on_target >= 0),
  home_corners integer check (home_corners is null or home_corners >= 0),
  away_corners integer check (away_corners is null or away_corners >= 0),
  home_corner_goals integer not null default 0 check (home_corner_goals >= 0),
  away_corner_goals integer not null default 0 check (away_corner_goals >= 0),
  home_fouls integer check (home_fouls is null or home_fouls >= 0),
  away_fouls integer check (away_fouls is null or away_fouls >= 0),
  home_offsides integer check (home_offsides is null or home_offsides >= 0),
  away_offsides integer check (away_offsides is null or away_offsides >= 0),
  home_saves integer check (home_saves is null or home_saves >= 0),
  away_saves integer check (away_saves is null or away_saves >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.record_room_lineups (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.premier_league_matches(id) on delete cascade,
  team_name text not null,
  player_name text not null,
  position text,
  is_starter boolean not null default false,
  minute_on integer not null default 0 check (minute_on between 0 and 130),
  minute_off integer check (minute_off is null or minute_off between 0 and 130),
  formation text,
  pitch_slot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(match_id, team_name, player_name)
);

create table if not exists public.record_room_substitutions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.premier_league_matches(id) on delete cascade,
  team_name text not null,
  player_out text not null,
  player_in text not null,
  minute integer check (minute is null or minute between 0 and 130),
  stoppage_minute integer check (stoppage_minute is null or stoppage_minute between 0 and 30),
  external_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.record_room_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.premier_league_matches(id) on delete cascade,
  team_name text not null,
  event_type text not null check (event_type in ('goal','yellow_card','red_card')),
  player_name text not null,
  related_player_name text,
  minute integer check (minute is null or minute between 0 and 130),
  stoppage_minute integer check (stoppage_minute is null or stoppage_minute between 0 and 30),
  external_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.record_room_players (
  id uuid primary key default gen_random_uuid(),
  season text not null default '2026/27',
  club text not null,
  player_name text not null,
  position text,
  shirt_number integer,
  appearances integer not null default 0 check (appearances >= 0),
  starts integer not null default 0 check (starts >= 0),
  minutes integer not null default 0 check (minutes >= 0),
  goals integer not null default 0 check (goals >= 0),
  assists integer not null default 0 check (assists >= 0),
  clean_sheets integer not null default 0 check (clean_sheets >= 0),
  yellow_cards integer not null default 0 check (yellow_cards >= 0),
  red_cards integer not null default 0 check (red_cards >= 0),
  man_of_the_match integer not null default 0 check (man_of_the_match >= 0),
  shots integer not null default 0 check (shots >= 0),
  shots_on_target integer not null default 0 check (shots_on_target >= 0),
  chances_created integer not null default 0 check (chances_created >= 0),
  tackles integer not null default 0 check (tackles >= 0),
  interceptions integer not null default 0 check (interceptions >= 0),
  saves integer not null default 0 check (saves >= 0),
  updated_at timestamptz not null default now(),
  unique(season, club, player_name)
);

create index if not exists record_room_lineups_match_idx on public.record_room_lineups(match_id);
create index if not exists record_room_substitutions_match_idx on public.record_room_substitutions(match_id);
create index if not exists record_room_events_match_idx on public.record_room_events(match_id);
create index if not exists record_room_players_club_idx on public.record_room_players(season, club);

alter table public.record_room_match_details enable row level security;
alter table public.record_room_match_stats enable row level security;
alter table public.record_room_lineups enable row level security;
alter table public.record_room_substitutions enable row level security;
alter table public.record_room_events enable row level security;
alter table public.record_room_players enable row level security;

-- Do not grant Record Room access merely because a user is authenticated.
-- Every policy verifies that auth.uid() is explicitly registered in public.admins.

do $$
declare
  t text;
begin
  foreach t in array array[
    'record_room_match_details',
    'record_room_match_stats',
    'record_room_lineups',
    'record_room_substitutions',
    'record_room_events',
    'record_room_players'
  ] loop
    execute format('drop policy if exists record_room_admin_select on public.%I', t);
    execute format('drop policy if exists record_room_admin_insert on public.%I', t);
    execute format('drop policy if exists record_room_admin_update on public.%I', t);
    execute format('drop policy if exists record_room_admin_delete on public.%I', t);

    execute format(
      'create policy record_room_admin_select on public.%I for select to authenticated using (exists (select 1 from public.admins a where a.user_id = auth.uid()))', t
    );
    execute format(
      'create policy record_room_admin_insert on public.%I for insert to authenticated with check (exists (select 1 from public.admins a where a.user_id = auth.uid()))', t
    );
    execute format(
      'create policy record_room_admin_update on public.%I for update to authenticated using (exists (select 1 from public.admins a where a.user_id = auth.uid())) with check (exists (select 1 from public.admins a where a.user_id = auth.uid()))', t
    );
    execute format(
      'create policy record_room_admin_delete on public.%I for delete to authenticated using (exists (select 1 from public.admins a where a.user_id = auth.uid()))', t
    );
  end loop;
end $$;

-- Explicit grants are still required; RLS remains the authorization boundary.
grant select, insert, update, delete on public.record_room_match_details to authenticated;
grant select, insert, update, delete on public.record_room_match_stats to authenticated;
grant select, insert, update, delete on public.record_room_lineups to authenticated;
grant select, insert, update, delete on public.record_room_substitutions to authenticated;
grant select, insert, update, delete on public.record_room_events to authenticated;
grant select, insert, update, delete on public.record_room_players to authenticated;

revoke all on public.record_room_match_details from anon;
revoke all on public.record_room_match_stats from anon;
revoke all on public.record_room_lineups from anon;
revoke all on public.record_room_substitutions from anon;
revoke all on public.record_room_events from anon;
revoke all on public.record_room_players from anon;

commit;
