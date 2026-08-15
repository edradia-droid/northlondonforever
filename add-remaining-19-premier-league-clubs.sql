-- NL4: add the remaining 19 Premier League clubs for 2026/27.
-- Arsenal is intentionally NOT inserted because you already added it in Admin.

insert into public.premier_league_standings
  (season, position, club, played, wins, draws, losses, goals_for, goals_against, goal_difference, points)
values
  ('2026/27', 2, 'Manchester City', 0, 0, 0, 0, 0, 0, 0, 0),
  ('2026/27', 3, 'Liverpool', 0, 0, 0, 0, 0, 0, 0, 0),
  ('2026/27', 4, 'Chelsea', 0, 0, 0, 0, 0, 0, 0, 0),
  ('2026/27', 5, 'Tottenham Hotspur', 0, 0, 0, 0, 0, 0, 0, 0),
  ('2026/27', 6, 'Manchester United', 0, 0, 0, 0, 0, 0, 0, 0),
  ('2026/27', 7, 'Newcastle United', 0, 0, 0, 0, 0, 0, 0, 0),
  ('2026/27', 8, 'Aston Villa', 0, 0, 0, 0, 0, 0, 0, 0),
  ('2026/27', 9, 'Brighton & Hove Albion', 0, 0, 0, 0, 0, 0, 0, 0),
  ('2026/27', 10, 'Crystal Palace', 0, 0, 0, 0, 0, 0, 0, 0),
  ('2026/27', 11, 'Brentford', 0, 0, 0, 0, 0, 0, 0, 0),
  ('2026/27', 12, 'Fulham', 0, 0, 0, 0, 0, 0, 0, 0),
  ('2026/27', 13, 'Everton', 0, 0, 0, 0, 0, 0, 0, 0),
  ('2026/27', 14, 'Nottingham Forest', 0, 0, 0, 0, 0, 0, 0, 0),
  ('2026/27', 15, 'AFC Bournemouth', 0, 0, 0, 0, 0, 0, 0, 0),
  ('2026/27', 16, 'Leeds United', 0, 0, 0, 0, 0, 0, 0, 0),
  ('2026/27', 17, 'Sunderland', 0, 0, 0, 0, 0, 0, 0, 0),
  ('2026/27', 18, 'Coventry City', 0, 0, 0, 0, 0, 0, 0, 0),
  ('2026/27', 19, 'Hull City', 0, 0, 0, 0, 0, 0, 0, 0),
  ('2026/27', 20, 'Ipswich Town', 0, 0, 0, 0, 0, 0, 0, 0)
on conflict (season, club) do nothing;

-- Check the completed table.
select
  position,
  club,
  played,
  wins,
  draws,
  losses,
  goals_for,
  goals_against,
  goal_difference,
  points
from public.premier_league_standings
where season = '2026/27'
order by position;
