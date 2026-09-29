alter table public.fixtures
add column if not exists details_synced_at timestamptz;
