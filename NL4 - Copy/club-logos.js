/* NL4 shared Premier League club crest registry */
(function(){
  const logos = {
    'AFC Bournemouth':'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/AFC%20Bournemouth.png',
    'Arsenal':'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Arsenal%20FC.png',
    'Aston Villa':'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Aston%20Villa.png',
    'Brentford':'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Brentford%20FC.png',
    'Brighton & Hove Albion':'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Brighton%20%26%20Hove%20Albion.png',
    'Chelsea':'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Chelsea%20FC.png',
    'Coventry City':'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Coventry%20City.png',
    'Crystal Palace':'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Crystal%20Palace.png',
    'Everton':'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Everton%20FC.png',
    'Fulham':'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Fulham%20FC.png',
    'Hull City':'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Hull%20City.png',
    'Ipswich Town':'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Ipswich%20Town.png',
    'Leeds United':'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Leeds%20United.png',
    'Liverpool':'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Liverpool%20FC.png',
    'Manchester City':'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Manchester%20City.png',
    'Manchester United':'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Manchester%20United.png',
    'Newcastle United':'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Newcastle%20United.png',
    'Nottingham Forest':'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Nottingham%20Forest.png',
    'Sunderland':'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Sunderland%20AFC.png',
    'Tottenham Hotspur':'https://raw.githubusercontent.com/luukhopman/football-logos/master/logos/England%20-%20Premier%20League/Tottenham%20Hotspur.png'
  };
  window.NL4ClubLogos = Object.freeze(logos);
  window.nl4ClubLogoUrl = function(name){ return logos[String(name||'').trim()] || ''; };
})();
