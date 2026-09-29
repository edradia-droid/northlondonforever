alter table public.match_events drop constraint if exists match_events_event_type_check;

alter table public.match_events add constraint match_events_event_type_check
check (
  event_type = any (
    array[
      'goal',
      'assist',
      'yellow_card',
      'red_card',
      'own_goal',
      'substitution',
      'var_decision'
    ]::text[]
  )
);

-- Remove legacy duplicate substitution rows from the BSD Premier League feed.
delete from public.match_events
where event_type = 'substitution'
  and external_event_id is null
  and fixture_id in (
    select id
    from public.fixtures
    where season = '2026/27'
      and competition = 'Premier League'
  );
