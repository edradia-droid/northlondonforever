NL4 2026/27 PLAYER STATS SYNC

SOURCE OF TRUTH
- premier_league_player_stats stores the season totals shown around the website.

AUTOMATICALLY RECALCULATED FROM COMPLETED PREMIER LEAGUE MATCHES
- Appearances: match_lineups rows in completed league fixtures
- Starts: is_starter=true
- Minutes: minute_on -> minute_off, defaulting to 90 when minute_off is blank
- Goals: Arsenal goal events
- Assists: Arsenal assist events
- Yellow cards: Arsenal yellow_card events
- Red cards: Arsenal red_card events
- Man of the Match: fixture man_of_the_match
- Clean sheets: goalkeeper/defender, 60+ minutes, Arsenal conceded 0

MANUAL PLAYER-LEVEL FIELDS RETAINED
- Shots
- Shots on target
- Chances created
- Tackles
- Interceptions
- Saves

These cannot be derived truthfully from team-level match statistics, so Admin remains the source for those fields.

SYNC TRIGGERS
- Save/clear/delete lineup or substitute
- Save/clear/delete goal, assist or card event
- Save Premier League match/result/MOTM
- Admin sign-in/load

PUBLIC PAGES
- premier-league.html already reads premier_league_player_stats.
- saka.html, saliba.html, rice.html, kai.html, gabby.html, ode.html and nelly.html now load the same table through current-player-season-stats.js.
