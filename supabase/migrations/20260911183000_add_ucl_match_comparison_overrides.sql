create table if not exists public.ucl_match_comparisons (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null unique references public.fixtures(id) on delete cascade,
  home_stats jsonb not null default '{}'::jsonb,
  away_stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint ucl_match_comparison_home_object check (jsonb_typeof(home_stats) = 'object'),
  constraint ucl_match_comparison_away_object check (jsonb_typeof(away_stats) = 'object')
);

alter table public.ucl_match_comparisons enable row level security;
drop policy if exists "public reads UCL match comparisons" on public.ucl_match_comparisons;
drop policy if exists "admins manage UCL match comparisons" on public.ucl_match_comparisons;
create policy "public reads UCL match comparisons" on public.ucl_match_comparisons
  for select to anon, authenticated using (
    exists (select 1 from public.fixtures f where f.id = fixture_id
      and f.is_published = true and f.competition = 'UEFA Champions League')
  );
create policy "admins manage UCL match comparisons" on public.ucl_match_comparisons
  for all to authenticated using ((select private.is_nl4_admin()))
  with check ((select private.is_nl4_admin()));
grant select on public.ucl_match_comparisons to anon;
grant select, insert, update, delete on public.ucl_match_comparisons to authenticated, service_role;
