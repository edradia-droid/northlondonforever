NL4 PREMIER LEAGUE TITLE PROBABILITY V1

Adds an NL4 Statistical Title Forecast to premier-league.html.

Uses all 20 rows from premier_league_standings:
- points per game
- goals scored per game
- goals conceded per game
- goal difference per game
- current points and games played

Runs 25,000 Monte Carlo simulations and shows:
- title probability for all 20 clubs
- top-four probability for all 20 clubs
- expected final points for all 20 clubs
- Arsenal expected finishing position

IMPORTANT:
Your database currently contains all 20 standings rows and 38 Arsenal fixtures, but premier_league_matches currently has only 2 rows. Therefore V1 is a performance-based forecast using each club's remaining match count and the strength distribution of the other 19 teams. It is NOT yet an exact remaining-fixture simulation.

Next step: add the complete 380-match Premier League fixture/result matrix. V2 can then simulate every real remaining fixture with home advantage and exact opponents.
