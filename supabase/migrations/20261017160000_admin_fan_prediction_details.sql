-- Admin-only retrieval of individual fan prediction submissions.
-- Public pages continue to use aggregate RPCs; raw voter keys are never returned.
create or replace function public.get_fan_prediction_admin_details(p_fixture_id uuid default null)
returns table (
  fixture_id uuid,
  created_at timestamptz,
  formation text,
  kit text,
  starters jsonb,
  substitutes jsonb,
  predicted_home_score integer,
  predicted_away_score integer,
  has_lineup_prediction boolean,
  has_score_prediction boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null
     or not exists (
       select 1
       from public.admins a
       where a.user_id = auth.uid()
     ) then
    raise exception 'Admin access required'
      using errcode = '42501';
  end if;

  return query
  select
    fp.fixture_id,
    fp.created_at,
    fp.formation,
    fp.kit,
    fp.starters,
    fp.substitutes,
    fp.predicted_home_score,
    fp.predicted_away_score,
    fp.has_lineup_prediction,
    fp.has_score_prediction
  from public.fan_lineup_predictions fp
  join public.fixtures f on f.id = fp.fixture_id
  where f.is_published is true
    and (p_fixture_id is null or fp.fixture_id = p_fixture_id)
  order by fp.created_at desc;
end;
$function$;

revoke all on function public.get_fan_prediction_admin_details(uuid) from public, anon;
grant execute on function public.get_fan_prediction_admin_details(uuid) to authenticated;
