begin;

alter table public.ucl_player_stats add column if not exists clean_sheets integer not null default 0;
alter table public.ucl_player_stats drop constraint if exists ucl_player_stats_clean_sheets_check;
alter table public.ucl_player_stats add constraint ucl_player_stats_clean_sheets_check check (clean_sheets >= 0);

CREATE OR REPLACE FUNCTION public.rebuild_ucl_player_stats()
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
with fx as (
  select id,home_team,away_team,home_score,away_score,home_saves,away_saves,man_of_the_match
  from public.fixtures
  where season='2026/27'
    and competition='UEFA Champions League'
    and source='BSD'
    and status in ('fulltime','finished','ft','aet','pen')
),
ev as (
  select e.* from public.match_events e join fx on fx.id=e.fixture_id
),
lu as (
  select l.*,
    case when l.is_starter
      then greatest(0,least(90,coalesce((
        select min(e.minute) from ev e
        where e.fixture_id=l.fixture_id
          and e.event_type='substitution'
          and public.ucl_name_matches(e.related_player_name,l.player_name)
      ),90)))
      else greatest(0,90-coalesce((
        select min(e.minute) from ev e
        where e.fixture_id=l.fixture_id
          and e.event_type='substitution'
          and public.ucl_name_matches(e.player_name,l.player_name)
      ),90))
    end mins,
    case when l.is_starter then true else exists(
      select 1 from ev e
      where e.fixture_id=l.fixture_id
        and e.event_type='substitution'
        and public.ucl_name_matches(e.player_name,l.player_name)
    ) end appeared
  from public.match_lineups l
  join fx on fx.id=l.fixture_id
  where l.team_name='Arsenal'
),
names as (
  select player_name,max(position) position,
    count(*) filter(where appeared)::int appearances,
    count(*) filter(where is_starter)::int starts,
    coalesce(sum(mins),0)::int minutes
  from lu group by player_name
),
counts as (
  select n.player_name,
    count(*) filter(where e.event_type in ('goal','own_goal')
      and public.ucl_name_matches(e.player_name,n.player_name))::int goals,
    count(*) filter(where e.event_type='goal'
      and e.related_player_name is not null
      and public.ucl_name_matches(e.related_player_name,n.player_name))::int assists,
    count(*) filter(where e.event_type='yellow_card'
      and public.ucl_name_matches(e.player_name,n.player_name))::int yellow_cards,
    count(*) filter(where e.event_type='red_card'
      and public.ucl_name_matches(e.player_name,n.player_name))::int red_cards
  from names n left join ev e on e.team_name='Arsenal'
  group by n.player_name
),
keeper_saves as (
  select l.player_name,
    sum(case when l.appeared and coalesce(l.position,'') in ('G','GK','Goalkeeper')
      then case when f.home_team='Arsenal'
        then coalesce(f.home_saves,0)
        else coalesce(f.away_saves,0)
      end else 0 end)::int saves
  from lu l join fx f on f.id=l.fixture_id
  group by l.player_name
),
clean_sheet_matches as (
  select l.player_name,l.fixture_id
  from lu l
  join fx f on f.id=l.fixture_id
  where l.appeared
    and coalesce(l.position,'') in ('G','GK','Goalkeeper')
    and (
      (f.home_team='Arsenal' and coalesce(f.away_score,0)=0)
      or
      (f.away_team='Arsenal' and coalesce(f.home_score,0)=0)
    )
  group by l.player_name,l.fixture_id
),
clean_sheets as (
  select player_name,count(*)::int clean_sheets
  from clean_sheet_matches
  group by player_name
),
motm as (
  select n.player_name,count(*)::int motm
  from names n join fx f on f.man_of_the_match is not null
  where public.ucl_name_matches(f.man_of_the_match,n.player_name)
  group by n.player_name
),
final_rows as (
  select n.player_name,n.position,n.appearances,n.starts,n.minutes,
    coalesce(c.goals,0) goals,
    coalesce(c.assists,0) assists,
    coalesce(c.yellow_cards,0) yellow_cards,
    coalesce(c.red_cards,0) red_cards,
    coalesce(k.saves,0) saves,
    coalesce(cs.clean_sheets,0) clean_sheets,
    coalesce(m.motm,0) man_of_the_match
  from names n
  left join counts c using(player_name)
  left join keeper_saves k using(player_name)
  left join clean_sheets cs using(player_name)
  left join motm m using(player_name)
),
upserted as (
  insert into public.ucl_player_stats(
    season,team_name,player_name,position,appearances,starts,minutes,
    goals,assists,yellow_cards,red_cards,saves,clean_sheets,man_of_the_match,updated_at
  )
  select '2026/27','Arsenal',player_name,position,appearances,starts,minutes,
    goals,assists,yellow_cards,red_cards,saves,clean_sheets,man_of_the_match,now()
  from final_rows
  on conflict (season,team_name,player_name) do update set
    position=excluded.position,
    appearances=excluded.appearances,
    starts=excluded.starts,
    minutes=excluded.minutes,
    goals=excluded.goals,
    assists=excluded.assists,
    yellow_cards=excluded.yellow_cards,
    red_cards=excluded.red_cards,
    saves=excluded.saves,
    clean_sheets=excluded.clean_sheets,
    man_of_the_match=excluded.man_of_the_match,
    updated_at=now()
  returning 1
)
select count(*)::int from upserted;
$function$
;

select public.rebuild_ucl_player_stats();

commit;
