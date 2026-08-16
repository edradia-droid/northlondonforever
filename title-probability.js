(function(){
  const SEASON='2026/27';
  const PREVIOUS_SEASON='2025/26';
  const SECOND_PREVIOUS_SEASON='2024/25';
  const SIMULATIONS=25000;
  const COUNTERFACTUAL_SIMULATIONS=8000;
  const TOTAL_FIXTURES=380;
  const MAX_SCORE=7;
  const ELO_BASE=1500;
  const ELO_K_EARLY=34;
  const ELO_K_MATURE=22;

  // V12.9 preseason strength calibration.
  // These are model priors, not predictions. They stop tiny early-season samples
  // from treating every club as equally strong, then fade as 2026/27 evidence grows.
  const FALLBACK_PRESEASON_STRENGTH={
    'Arsenal':{
      elo:1815,
      tier:'DEFENDING CHAMPION',
      promoted:false,
      previousFinish:1,
      defendingChampion:true,
      previousSeasonLabel:'2025/26 PREMIER LEAGUE CHAMPIONS'
    },
    'Manchester City':{elo:1750,tier:'TITLE',promoted:false},
    'Liverpool':{elo:1735,tier:'TITLE',promoted:false},
    'Chelsea':{elo:1685,tier:'ELITE',promoted:false},
    'Newcastle United':{elo:1665,tier:'ELITE',promoted:false},
    'Aston Villa':{elo:1645,tier:'EUROPE',promoted:false},
    'Manchester United':{elo:1630,tier:'EUROPE',promoted:false},
    'Tottenham Hotspur':{elo:1610,tier:'EUROPE',promoted:false},
    'Brighton & Hove Albion':{elo:1585,tier:'UPPER MID',promoted:false},
    'Crystal Palace':{elo:1570,tier:'UPPER MID',promoted:false},
    'Nottingham Forest':{elo:1555,tier:'MID',promoted:false},
    'Brentford':{elo:1545,tier:'MID',promoted:false},
    'Fulham':{elo:1535,tier:'MID',promoted:false},
    'Everton':{elo:1525,tier:'MID',promoted:false},
    'AFC Bournemouth':{elo:1520,tier:'MID',promoted:false},
    'Leeds United':{elo:1460,tier:'PROMOTED',promoted:true},
    'Sunderland':{elo:1445,tier:'PROMOTED',promoted:true},
    'Coventry City':{elo:1435,tier:'PROMOTED',promoted:true},
    'Hull City':{elo:1425,tier:'PROMOTED',promoted:true},
    'Ipswich Town':{elo:1440,tier:'PROMOTED',promoted:true}
  };


  let ACTIVE_PRESEASON_STRENGTH={...FALLBACK_PRESEASON_STRENGTH};
  let PREVIOUS_SEASON_META={
    source:'FALLBACK',
    rows:0,
    secondRows:0,
    currentClubMatches:0,
    promotedClubs:[],
    relegatedClubs:[],
    warning:'2025/26 standings have not been loaded yet.'
  };

  function tierFromElo(elo,defendingChampion=false,promoted=false){
    if(defendingChampion)return 'DEFENDING CHAMPION';
    if(promoted)return 'PROMOTED';
    if(elo>=1730)return 'TITLE';
    if(elo>=1660)return 'ELITE';
    if(elo>=1600)return 'EUROPE';
    if(elo>=1560)return 'UPPER MID';
    if(elo>=1500)return 'MID';
    return 'LOWER';
  }

  function previousSeasonDerivedElo(row){
    const played=Math.max(1,Number(row.played||38));
    const points=Number(row.points||0);
    const gf=Number(row.goals_for||0);
    const ga=Number(row.goals_against||0);
    const gd=Number(row.goal_difference??(gf-ga));
    const position=Math.max(1,Math.min(20,Number(row.position||20)));

    const ppg=points/played;
    const gdpg=gd/played;
    const attackPg=gf/played;
    const defencePg=ga/played;

    // Data-driven 2025/26 performance score.
    // PPG and goal difference carry most weight; position adds table context.
    // Attack/defence balance contributes modestly so two equal-point clubs need not be identical.
    const ppgComponent=(ppg-1.35)*120;
    const gdComponent=gdpg*60;
    const positionComponent=(10.5-position)*5;
    const balanceComponent=((attackPg-1.35)-(defencePg-1.35))*12;
    return Math.max(1325,Math.min(1840,
      ELO_BASE+ppgComponent+gdComponent+positionComponent+balanceComponent
    ));
  }


  function longTermPointsFromElo(elo){
    // Converts the long-term strength anchor into an approximate 38-match points level.
    // This is calibration evidence, never a guaranteed final points total.
    return Math.max(36,Math.min(90,50+(Number(elo)-ELO_BASE)*0.10));
  }

  function blendedHistoricalPoints(row,olderRow,fallbackElo){
    const recent=Number(row?.points);
    const older=Number(olderRow?.points);
    const longTerm=longTermPointsFromElo(fallbackElo);

    if(Number.isFinite(recent)&&Number.isFinite(older)){
      return recent*.55+older*.25+longTerm*.20;
    }
    if(Number.isFinite(recent)){
      return recent*.65+longTerm*.35;
    }
    return longTerm;
  }

  function buildPreviousSeasonProfiles(previousRows,secondPreviousRows,currentRows){
    const currentClubs=(currentRows||[]).map(r=>norm(r.club));
    const prev=(previousRows||[]).map((r,i)=>({
      ...r,
      club:norm(r.club),
      position:Number(r.position||i+1)
    })).filter(r=>r.club);

    const secondPrev=(secondPreviousRows||[]).map((r,i)=>({
      ...r,
      club:norm(r.club),
      position:Number(r.position||i+1)
    })).filter(r=>r.club);
    const prevByClub=new Map(prev.map(r=>[r.club,r]));
    const secondPrevByClub=new Map(secondPrev.map(r=>[r.club,r]));
    const currentSet=new Set(currentClubs);
    const previousSet=new Set(prev.map(r=>r.club));

    const promotedClubs=currentClubs.filter(c=>!previousSet.has(c));
    const relegatedClubs=prev.map(r=>r.club).filter(c=>!currentSet.has(c));
    const currentClubMatches=currentClubs.filter(c=>previousSet.has(c)).length;

    // Require a full previous Premier League table before replacing the fallback.
    if(prev.length!==20){
      ACTIVE_PRESEASON_STRENGTH={...FALLBACK_PRESEASON_STRENGTH};
      PREVIOUS_SEASON_META={
        source:'FALLBACK',
        rows:prev.length,
        secondRows:secondPrev.length,
        currentClubMatches,
        promotedClubs,
        relegatedClubs,
        warning:`Expected 20 rows for ${PREVIOUS_SEASON}; found ${prev.length}. V12.9 kept the V12.9 fallback priors.`
      };
      return PREVIOUS_SEASON_META;
    }

    const next={};

    for(const club of currentClubs){
      const row=prevByClub.get(club);

      if(row){
        const dataElo=previousSeasonDerivedElo(row);
        const olderRow=secondPrevByClub.get(club);
        const olderElo=olderRow?previousSeasonDerivedElo(olderRow):null;
        const fallback=FALLBACK_PRESEASON_STRENGTH[club]?.elo ?? dataElo;
        let historicalPointsAnchor=blendedHistoricalPoints(row,olderRow,fallback);

        // V12.9 established-club shrinkage:
        // Long-term strength stops one or two poor seasons from pushing a historically
        // established club all the way down to promoted-club/relegation baseline levels.
        // It does not protect promoted clubs and does not guarantee survival.
        const longTermPointsAnchor=longTermPointsFromElo(fallback);
        if(fallback>=1580){
          const floor=longTermPointsAnchor-8;
          historicalPointsAnchor=Math.max(historicalPointsAnchor,floor);
        }

        // V12.9 multi-season blend.
        // Most recent season remains the strongest evidence, but one unusual year
        // can no longer dominate the whole preseason prior.
        // 55% = 2025/26, 25% = 2024/25 when available, 20% = long-term anchor.
        // If 2024/25 is unavailable for a club, its 25% is transferred to the anchor.
        let elo=olderElo!==null
          ? dataElo*.55+olderElo*.25+fallback*.20
          : dataElo*.55+fallback*.45;
        const defendingChampion=Number(row.position)===1;

        // Established-club shrinkage is deliberately mild: keep at least 60% of
        // the gap between neutral Elo and the long-term anchor when recent seasons collapse.
        if(fallback>=1580){
          const establishedFloor=ELO_BASE+(fallback-ELO_BASE)*0.60;
          elo=Math.max(elo,establishedFloor);
        }

        // Defending-champion status is kept for explanation and tier labelling,
        // but V12.9 does not add a separate Elo bonus because the championship
        // is already represented by points, goal difference and final position.
        elo=Math.max(1325,Math.min(1850,elo));

        next[club]={
          elo,
          tier:tierFromElo(elo,defendingChampion,false),
          promoted:false,
          previousFinish:Number(row.position),
          previousPoints:Number(row.points||0),
          previousGD:Number(row.goal_difference??((row.goals_for||0)-(row.goals_against||0))),
          previousGF:Number(row.goals_for||0),
          previousGA:Number(row.goals_against||0),
          secondPreviousFinish:olderRow?Number(olderRow.position):null,
          secondPreviousPoints:olderRow?Number(olderRow.points||0):null,
          historicalPointsAnchor,
          longTermPointsAnchor,
          defendingChampion,
          previousSeasonLabel:defendingChampion
            ? `${PREVIOUS_SEASON} PREMIER LEAGUE CHAMPIONS`
            : `${PREVIOUS_SEASON} PREMIER LEAGUE • ${Number(row.position)}${Number(row.position)===1?'ST':Number(row.position)===2?'ND':Number(row.position)===3?'RD':'TH'}`
        };
      }else{
        // Current Premier League club absent from the previous EPL table = promoted.
        // Championship performance is not yet available to V12.9, so use a conservative
        // promoted baseline rather than pretending Premier League data exists.
        const fallback=FALLBACK_PRESEASON_STRENGTH[club]?.elo;
        const elo=Math.max(1400,Math.min(1480,Number.isFinite(fallback)?fallback:1445));

        next[club]={
          elo,
          tier:'PROMOTED',
          promoted:true,
          previousFinish:null,
          previousPoints:null,
          previousGD:null,
          previousGF:null,
          previousGA:null,
          historicalPointsAnchor:longTermPointsFromElo(elo),
          longTermPointsAnchor:longTermPointsFromElo(elo),
          defendingChampion:false,
          previousSeasonLabel:`PROMOTED TO PREMIER LEAGUE FOR ${SEASON}`
        };
      }
    }

    ACTIVE_PRESEASON_STRENGTH=next;

    let warning='';
    if(promotedClubs.length!==3){
      warning=`Detected ${promotedClubs.length} promoted clubs (${promotedClubs.join(', ')||'none'}). A Premier League season should normally replace three clubs; check the ${SEASON} club list and ${PREVIOUS_SEASON} standings.`;
    }

    PREVIOUS_SEASON_META={
      source:secondPrev.length===20?'SUPABASE 2025/26 + 2024/25':'SUPABASE 2025/26',
      rows:prev.length,
      secondRows:secondPrev.length,
      currentClubMatches,
      promotedClubs,
      relegatedClubs,
      warning
    };
    return PREVIOUS_SEASON_META;
  }

  function preseasonProfile(club){
    return ACTIVE_PRESEASON_STRENGTH[club]||{
      elo:ELO_BASE,tier:'UNRATED',promoted:false,
      previousFinish:null,historicalPointsAnchor:50,longTermPointsAnchor:50,defendingChampion:false,previousSeasonLabel:'NO PREVIOUS-SEASON PROFILE'
    };
  }

  // V12.9: previous-season evidence fades gradually rather than disappearing after a few games.
  // At 0 matches it is fully active; at 10 it still carries 60% weight;
  // at 20 it carries 25%; at 30 it is almost gone; by 34 it is zero.
  function preseasonWeight(played){
    const p=Number(played)||0;
    if(p<=0)return 1;
    if(p<=10)return 1-(p/10)*0.40;
    if(p<=20)return 0.60-((p-10)/10)*0.35;
    if(p<=30)return 0.25-((p-20)/10)*0.20;
    return Math.max(0,0.05-((p-30)/4)*0.05);
  }


  const tableEl=document.getElementById('titleProbabilityTable');
  const statusEl=document.getElementById('titleModelStatus');
  if(!tableEl) return;

  const db=window.nl4Supabase || window.supabaseClient || window.NL4_SUPABASE || window.supabaseDb || window.db;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const setText=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  const norm=v=>String(v||'').trim().replace(/\s+/g,' ');
  const finished=s=>['fulltime','finished','ft','aet','pen'].includes(String(s||'').toLowerCase());
  const ignored=s=>['cancelled','postponed'].includes(String(s||'').toLowerCase());
  const pairKey=(h,a)=>`${norm(h).toLowerCase()}__${norm(a).toLowerCase()}`;

  function code(name){
    const m={'Arsenal':'ARS','Manchester City':'MCI','Manchester United':'MUN','Liverpool':'LIV','Chelsea':'CHE',
      'Tottenham Hotspur':'TOT','Newcastle United':'NEW','Aston Villa':'AVL','Brighton & Hove Albion':'BHA',
      'Crystal Palace':'CRY','Nottingham Forest':'NFO','AFC Bournemouth':'BOU','Leeds United':'LEE','Sunderland':'SUN',
      'Coventry City':'COV','Hull City':'HUL','Ipswich Town':'IPS','Brentford':'BRE','Fulham':'FUL','Everton':'EVE'};
    return m[name]||String(name||'---').split(/\s+/).map(x=>x[0]).join('').slice(0,3).toUpperCase();
  }

  function rngFactory(seed){
    let t=seed>>>0;
    return()=>{t+=0x6D2B79F5;let x=t;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);return((x^(x>>>14))>>>0)/4294967296;};
  }

  function normalizeStandings(rows){
    return rows.map((r,i)=>{
      const played=Number(r.played||0),gf=Number(r.goals_for||0),ga=Number(r.goals_against||0);
      const pts=Number(r.points||0),gd=Number(r.goal_difference??(gf-ga));
      return {
        club:norm(r.club),position:Number(r.position||i+1),played,
        wins:Number(r.wins||0),draws:Number(r.draws||0),losses:Number(r.losses||0),
        gf,ga,gd,points:pts,remaining:Math.max(0,38-played),
        ppg:played?pts/played:1.35,gfpg:played?gf/played:1.35,gapg:played?ga/played:1.35
      };
    });
  }

  function mergeFixtures(arsenalRows,leagueRows){
    const map=new Map();

    (leagueRows||[]).forEach(r=>{
      if(!r.home_team||!r.away_team) return;
      map.set(pairKey(r.home_team,r.away_team),{
        home:norm(r.home_team),away:norm(r.away_team),status:r.status||'scheduled',
        kickoff_at:r.kickoff_at||null,matchday:r.matchday??null,
        home_score:r.home_score,away_score:r.away_score,updated_at:r.updated_at||null
      });
    });

    (arsenalRows||[]).forEach(r=>{
      const isHome=r.home_team==='Arsenal'||r.is_home===true;
      const home=norm(r.home_team||(isHome?'Arsenal':r.opponent));
      const away=norm(r.away_team||(isHome?r.opponent:'Arsenal'));
      if(!home||!away) return;
      map.set(pairKey(home,away),{
        home,away,status:r.status||'scheduled',kickoff_at:r.kickoff_at||null,matchday:r.matchday??null,
        home_score:isHome?r.arsenal_score:r.opponent_score,
        away_score:isHome?r.opponent_score:r.arsenal_score,updated_at:r.updated_at||null
      });
    });

    return [...map.values()].filter(x=>!ignored(x.status));
  }

  function completedResults(fixtures){
    return fixtures.filter(f=>finished(f.status) &&
      Number.isFinite(Number(f.home_score)) && Number.isFinite(Number(f.away_score)));
  }

  function resultTime(r){
    if(r.kickoff_at){
      const t=new Date(r.kickoff_at).getTime();
      if(Number.isFinite(t)) return t;
    }
    if(Number.isFinite(Number(r.matchday))) return Number(r.matchday)*86400000;
    if(r.updated_at){
      const t=new Date(r.updated_at).getTime();
      if(Number.isFinite(t)) return t;
    }
    return 0;
  }

  function expectedEloScore(homeElo,awayElo,homeAdv=55){
    return 1/(1+Math.pow(10,-((homeElo+homeAdv)-awayElo)/400));
  }

  function buildElo(results,clubs){
    const priorRatings=new Map(clubs.map(c=>[c,preseasonProfile(c).elo]));
    const neutralRatings=new Map(clubs.map(c=>[c,ELO_BASE]));
    const matchesPlayed=new Map(clubs.map(c=>[c,0]));
    const ordered=[...results].sort((a,b)=>resultTime(a)-resultTime(b));

    const applyResult=(ratings,r,hs,as,k,marginMult)=>{
      const home=ratings.get(r.home),away=ratings.get(r.away);
      if(home===undefined||away===undefined)return;
      const actual=hs>as?1:hs===as?.5:0;
      const expected=expectedEloScore(home,away,55);
      const change=k*marginMult*(actual-expected);
      ratings.set(r.home,home+change);
      ratings.set(r.away,away-change);
    };

    for(const r of ordered){
      if(!priorRatings.has(r.home)||!priorRatings.has(r.away))continue;
      const hs=Number(r.home_score),as=Number(r.away_score);
      if(!Number.isFinite(hs)||!Number.isFinite(as))continue;

      const hp=matchesPlayed.get(r.home)||0,ap=matchesPlayed.get(r.away)||0;
      const maturity=Math.min(1,(hp+ap)/20);
      const k=ELO_K_EARLY+(ELO_K_MATURE-ELO_K_EARLY)*maturity;
      const margin=Math.max(1,Math.abs(hs-as));
      const marginMult=Math.min(1.35,1+Math.log1p(margin-1)*.18);

      applyResult(priorRatings,r,hs,as,k,marginMult);
      applyResult(neutralRatings,r,hs,as,k,marginMult);
      matchesPlayed.set(r.home,hp+1);
      matchesPlayed.set(r.away,ap+1);
    }
    return {priorRatings,neutralRatings,matchesPlayed};
  }

  function confidenceFromResults(completedCount){
    const coverage=Math.min(1,completedCount/TOTAL_FIXTURES);
    const evidence=Math.sqrt(coverage);
    const score=Math.round(18+82*evidence);
    let label='LOW';
    if(score>=75) label='HIGH';
    else if(score>=45) label='MEDIUM';
    return {score,label};
  }

  function buildRecentForm(results,clubs){
    const map=new Map(clubs.map(c=>[c,[]]));
    [...results].sort((a,b)=>resultTime(a)-resultTime(b)).forEach(r=>{
      const hs=Number(r.home_score),as=Number(r.away_score);
      if(map.has(r.home)) map.get(r.home).push(hs>as?3:hs===as?1:0);
      if(map.has(r.away)) map.get(r.away).push(as>hs?3:as===hs?1:0);
    });

    const weights=[1,.82,.67,.55,.45];
    const out=new Map();
    for(const club of clubs){
      const arr=(map.get(club)||[]).slice(-5).reverse();
      if(!arr.length){out.set(club,{factor:1,label:'PRE-SEASON'});continue;}
      let sum=0,w=0;
      arr.forEach((pts,i)=>{sum+=pts*weights[i];w+=3*weights[i];});
      const ratio=w?sum/w:.5;
      const factor=.88+ratio*.24; // approx 0.88–1.12
      const label=arr.map(p=>p===3?'W':p===1?'D':'L').join(' ');
      out.set(club,{factor,label});
    }
    return out;
  }

  function buildSplits(results,clubs){
    const base=()=>({homeGF:0,homeGA:0,homeP:0,awayGF:0,awayGA:0,awayP:0});
    const map=new Map(clubs.map(c=>[c,base()]));
    results.forEach(r=>{
      const h=map.get(r.home),a=map.get(r.away);
      const hs=Number(r.home_score),as=Number(r.away_score);
      if(h){h.homeGF+=hs;h.homeGA+=as;h.homeP++;}
      if(a){a.awayGF+=as;a.awayGA+=hs;a.awayP++;}
    });
    return map;
  }

  function buildRatings(teams,results){
    const clubs=teams.map(t=>t.club);
    const recent=buildRecentForm(results,clubs);
    const splits=buildSplits(results,clubs);
    const eloState=buildElo(results,clubs);

    const totalPlayed=teams.reduce((s,t)=>s+t.played,0);
    const totalGF=teams.reduce((s,t)=>s+t.gf,0);
    const leagueGoalAvg=totalPlayed?totalGF/totalPlayed:1.42;
    const avgPpg=teams.reduce((s,t)=>s+t.ppg,0)/teams.length||1.35;

    return teams.map(t=>{
      const sample=t.played/(t.played+10);
      const attackRaw=t.played?t.gfpg/leagueGoalAvg:1;
      const defenceRaw=t.played?t.gapg/leagueGoalAvg:1; // lower is better
      const attack=1+(attackRaw-1)*sample;
      const defence=1+(defenceRaw-1)*sample;
      const ppgPower=1+((t.ppg-avgPpg)/1.35)*Math.min(.14,sample*.14);
      const profile=preseasonProfile(t.club);
      const priorWeight=preseasonWeight(t.played);
      const historicalPointsAnchor=Number(profile.historicalPointsAnchor||50);
      const historicalPpg=historicalPointsAnchor/38;
      // 50 pts is roughly neutral. Elite 80+ point histories receive a meaningful
      // preseason win-rate lift, but it fades with the same prior weight as history.
      const historicalPointsFactor=Math.exp(((historicalPpg-(50/38))*.18)*priorWeight);
      const priorElo=eloState.priorRatings.get(t.club)??profile.elo;
      const neutralElo=eloState.neutralRatings.get(t.club)??ELO_BASE;
      const eloRating=neutralElo+(priorElo-neutralElo)*priorWeight;
      const eloFactor=Math.pow(10,(eloRating-ELO_BASE)/550);
      const form=recent.get(t.club)||{factor:1,label:'PRE-SEASON'};
      const split=splits.get(t.club)||{homeGF:0,homeGA:0,homeP:0,awayGF:0,awayGA:0,awayP:0};

      const homeSample=Math.min(1,split.homeP/6);
      const awaySample=Math.min(1,split.awayP/6);

      const homeAttackAdj=split.homeP ? 1+(((split.homeGF/split.homeP)/leagueGoalAvg)-1)*homeSample*.18 : 1;
      const homeDefAdj=split.homeP ? 1+(((split.homeGA/split.homeP)/leagueGoalAvg)-1)*homeSample*.18 : 1;
      const awayAttackAdj=split.awayP ? 1+(((split.awayGF/split.awayP)/leagueGoalAvg)-1)*awaySample*.18 : 1;
      const awayDefAdj=split.awayP ? 1+(((split.awayGA/split.awayP)/leagueGoalAvg)-1)*awaySample*.18 : 1;

      return {...t,attack,defence,ppgPower,eloRating,eloFactor,
        preseasonElo:profile.elo,preseasonTier:profile.tier,promoted:profile.promoted,priorWeight,
        previousFinish:profile.previousFinish||null,
        previousPoints:profile.previousPoints??null,
        previousGD:profile.previousGD??null,
        previousGF:profile.previousGF??null,
        previousGA:profile.previousGA??null,
        historicalPointsAnchor,
        historicalPointsFactor,
        priorDeduped:true,
        secondPreviousFinish:profile.secondPreviousFinish??null,
        secondPreviousPoints:profile.secondPreviousPoints??null,
        defendingChampion:!!profile.defendingChampion,
        previousSeasonLabel:profile.previousSeasonLabel||'',
        formFactor:form.factor,formLabel:form.label,
        homeAttackAdj,homeDefAdj,awayAttackAdj,awayDefAdj,leagueGoalAvg};
    });
  }

  function factorial(n){let x=1;for(let i=2;i<=n;i++)x*=i;return x;}
  const FACT=Array.from({length:MAX_SCORE+1},(_,i)=>factorial(i));

  function poissonP(k,lambda){return Math.exp(-lambda)*Math.pow(lambda,k)/FACT[k];}

  function scoreDistribution(lambda){
    const probs=[];
    let total=0;
    for(let k=0;k<MAX_SCORE;k++){const p=poissonP(k,lambda);probs.push(p);total+=p;}
    probs.push(Math.max(0,1-total));
    let c=0;
    return probs.map(p=>(c+=p));
  }

  function sampleScore(cdf,rng){
    const r=rng();
    for(let i=0;i<cdf.length;i++) if(r<=cdf[i]) return i;
    return cdf.length-1;
  }

  function fixtureGoalModel(home,away){
    const HOME_ADV_ATTACK=1.12;
    const HOME_ADV_DEFENCE=.96;

    // V12.9 match-strength calibration:
    // V12.9 compressed large club-strength gaps too aggressively.
    // PPG and form remain controlled, while Elo now has enough influence to
    // separate elite clubs from relegation-level clubs over a 38-game season.
    const powerRatio=Math.max(.78,Math.min(1.28,home.ppgPower/away.ppgPower));
    const formRatio=Math.max(.82,Math.min(1.20,home.formFactor/away.formFactor));
    const eloRatio=Math.max(.70,Math.min(1.45,home.eloFactor/away.eloFactor));
    const historicalRatio=Math.max(.82,Math.min(1.25,
      (home.historicalPointsFactor||1)/(away.historicalPointsFactor||1)
    ));

    const powerEffect=Math.pow(powerRatio,.55);
    const formEffect=Math.pow(formRatio,.55);
    const eloEffect=Math.pow(eloRatio,.70);
    const historicalEffect=Math.pow(historicalRatio,.58);

    // V12.9 league-points calibration:
    // Large, well-supported strength gaps should create fewer coin-flip draws.
    // The adjustment is capped and fades naturally once current-season Elo/form
    // replaces preseason evidence. Close matches receive almost no adjustment.
    const eloGap=(Number(home.eloRating||ELO_BASE)-Number(away.eloRating||ELO_BASE));
    const mismatch=Math.tanh(Math.abs(eloGap)/260);
    const homeStronger=eloGap>=0;
    const favoriteBoost=1+0.085*mismatch;
    const underdogSuppression=1-0.055*mismatch;
    const homeMismatch=homeStronger?favoriteBoost:underdogSuppression;
    const awayMismatch=homeStronger?underdogSuppression:favoriteBoost;

    let homeLambda=home.leagueGoalAvg * home.attack * away.defence *
      home.homeAttackAdj * away.awayDefAdj * HOME_ADV_ATTACK *
      powerEffect * formEffect * eloEffect * historicalEffect * homeMismatch;

    let awayLambda=away.leagueGoalAvg * away.attack * home.defence *
      away.awayAttackAdj * home.homeDefAdj * HOME_ADV_DEFENCE /
      powerEffect / formEffect / eloEffect / historicalEffect * awayMismatch;

    homeLambda=Math.max(.18,Math.min(4.2,homeLambda));
    awayLambda=Math.max(.12,Math.min(3.8,awayLambda));

    return {homeLambda,awayLambda,homeCDF:scoreDistribution(homeLambda),awayCDF:scoreDistribution(awayLambda)};
  }

  function updateCoverage(fixtures){
    const count=Math.min(TOTAL_FIXTURES,fixtures.length);
    const pct=count/TOTAL_FIXTURES*100;
    setText('titleFixtureCoverage',`${count}/${TOTAL_FIXTURES}`);
    const bar=document.getElementById('titleFixtureCoverageBar');
    if(bar)bar.style.width=`${pct}%`;
    const note=document.getElementById('titleFixtureCoverageNote');
    if(note)note.textContent=count===TOTAL_FIXTURES
      ? 'Full 380-match matrix loaded — exact fixture simulation active.'
      : `${TOTAL_FIXTURES-count} fixture rows are still missing.`;
  }

  function fixtureOrderValue(f){
    if(f.kickoff_at){
      const t=new Date(f.kickoff_at).getTime();
      if(Number.isFinite(t)) return t;
    }
    if(Number.isFinite(Number(f.matchday))) return Number(f.matchday)*86400000;
    return Number.MAX_SAFE_INTEGER;
  }

  function nextArsenalFixture(fixtures){
    return fixtures
      .filter(f=>!finished(f.status) && (f.home==='Arsenal'||f.away==='Arsenal'))
      .sort((a,b)=>fixtureOrderValue(a)-fixtureOrderValue(b))[0] || null;
  }

  function fixtureId(f){return f ? pairKey(f.home,f.away) : ''; }

  function simulate(teams,fixtures){
    const byName=new Map(teams.map(t=>[t.club.toLowerCase(),t]));
    const remaining=fixtures.filter(f=>!finished(f.status));
    const arsenalUpcoming=fixtures
      .filter(f=>!finished(f.status) && (f.home==='Arsenal'||f.away==='Arsenal'))
      .sort((a,b)=>fixtureOrderValue(a)-fixtureOrderValue(b));

    const nextArsenal=arsenalUpcoming[0]||null;
    const nextArsenalId=fixtureId(nextArsenal);

    const scenario={
      fixture:nextArsenal,
      counts:{win:0,draw:0,loss:0},
      titles:{win:0,draw:0,loss:0},
      resultProb:{win:0,draw:0,loss:0}
    };

    const trackedImpact=arsenalUpcoming.slice(0,5).map(f=>({
      fixture:f,
      id:fixtureId(f),
      counts:{win:0,draw:0,loss:0},
      titles:{win:0,draw:0,loss:0},
      resultProb:{win:0,draw:0,loss:0}
    }));

    const prepared=remaining.map(f=>{
      const home=byName.get(f.home.toLowerCase()),away=byName.get(f.away.toLowerCase());
      return home&&away?{...f,homeTeam:home,awayTeam:away,model:fixtureGoalModel(home,away)}:null;
    }).filter(Boolean);

    function resultProbForPrepared(preparedFixture){
      if(!preparedFixture) return {win:0,draw:0,loss:0};
      let w=0,d=0,l=0;
      for(let hs=0;hs<preparedFixture.model.homeCDF.length;hs++){
        const hp=hs===0?preparedFixture.model.homeCDF[0]:preparedFixture.model.homeCDF[hs]-preparedFixture.model.homeCDF[hs-1];
        for(let as=0;as<preparedFixture.model.awayCDF.length;as++){
          const ap=as===0?preparedFixture.model.awayCDF[0]:preparedFixture.model.awayCDF[as]-preparedFixture.model.awayCDF[as-1];
          const p=hp*ap;
          const arsenalHome=preparedFixture.homeTeam.club==='Arsenal';
          const ag=arsenalHome?hs:as, og=arsenalHome?as:hs;
          if(ag>og)w+=p;
          else if(ag===og)d+=p;
          else l+=p;
        }
      }
      return {win:w*100,draw:d*100,loss:l*100};
    }

    if(nextArsenal){
      scenario.resultProb=resultProbForPrepared(prepared.find(f=>fixtureId(f)===nextArsenalId));
    }

    trackedImpact.forEach(item=>{
      item.resultProb=resultProbForPrepared(prepared.find(f=>fixtureId(f)===item.id));
    });

    const acc=new Map(teams.map(t=>[t.club,{titles:0,top4:0,top5:0,relegation:0,pts:0,pos:0,positions:Array(20).fill(0)}]));
    const championPoints=[];
    const arsenalPointOutcomes=new Map();
    const arsenalAllPoints=[],arsenalTitlePoints=[],arsenalNonTitlePoints=[];

    const seed=teams.reduce((s,t)=>s+t.points*37+t.played*19+t.gf*11+t.ga*5,20260815)+fixtures.length*101;
    const rng=rngFactory(seed);

    for(let sim=0;sim<SIMULATIONS;sim++){
      let nextArsenalOutcome=null;
      const impactOutcomes=new Map();
      const season=new Map(teams.map(t=>[t.club,{club:t.club,points:t.points,gd:t.gd,gf:t.gf}]));

      for(const f of prepared){
        const hs=sampleScore(f.model.homeCDF,rng);
        const as=sampleScore(f.model.awayCDF,rng);
        const h=season.get(f.homeTeam.club),a=season.get(f.awayTeam.club);

        const currentFixtureId=fixtureId(f);
        if(nextArsenalId && currentFixtureId===nextArsenalId){
          const arsenalHome=f.homeTeam.club==='Arsenal';
          const ag=arsenalHome?hs:as, og=arsenalHome?as:hs;
          nextArsenalOutcome=ag>og?'win':ag===og?'draw':'loss';
          scenario.counts[nextArsenalOutcome]++;
        }

        const impactItem=trackedImpact.find(item=>item.id===currentFixtureId);
        if(impactItem){
          const arsenalHome=f.homeTeam.club==='Arsenal';
          const ag=arsenalHome?hs:as, og=arsenalHome?as:hs;
          const outcome=ag>og?'win':ag===og?'draw':'loss';
          impactItem.counts[outcome]++;
          impactOutcomes.set(impactItem.id,outcome);
        }

        h.gf+=hs;a.gf+=as;
        h.gd+=hs-as;a.gd+=as-hs;

        if(hs>as)h.points+=3;
        else if(as>hs)a.points+=3;
        else{h.points++;a.points++;}
      }

      const rows=[...season.values()].sort((a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf||a.club.localeCompare(b.club));
      const arsenalChampion=rows[0]?.club==='Arsenal';
      championPoints.push(Number(rows[0]?.points||0));

      const arsenalFinal=rows.find(r=>r.club==='Arsenal');
      if(arsenalFinal){
        const pts=Number(arsenalFinal.points||0);
        if(!arsenalPointOutcomes.has(pts)) arsenalPointOutcomes.set(pts,{samples:0,titles:0});
        const rec=arsenalPointOutcomes.get(pts);
        rec.samples++;
        arsenalAllPoints.push(pts);
        if(arsenalChampion){rec.titles++;arsenalTitlePoints.push(pts);}else arsenalNonTitlePoints.push(pts);
      }

      if(nextArsenalOutcome && arsenalChampion){
        scenario.titles[nextArsenalOutcome]++;
      }
      if(arsenalChampion){
        trackedImpact.forEach(item=>{
          const outcome=impactOutcomes.get(item.id);
          if(outcome)item.titles[outcome]++;
        });
      }

      rows.forEach((t,i)=>{
        const a=acc.get(t.club);
        if(i===0)a.titles++;
        if(i<4)a.top4++;
        if(i<5)a.top5++;
        if(i>=17)a.relegation++;
        a.positions[i]++;
        a.pts+=t.points;
        a.pos+=i+1;
      });
    }

    const rows=teams.map(t=>{
      const a=acc.get(t.club);
      const positionProbabilities=a.positions.map(v=>v/SIMULATIONS*100);
      let mostLikelyIndex=0;
      positionProbabilities.forEach((p,i)=>{if(p>positionProbabilities[mostLikelyIndex])mostLikelyIndex=i;});
      return {...t,
        titleProb:a.titles/SIMULATIONS*100,
        top4Prob:a.top4/SIMULATIONS*100,
        top5Prob:a.top5/SIMULATIONS*100,
        relegationProb:a.relegation/SIMULATIONS*100,
        expectedPoints:a.pts/SIMULATIONS,
        expectedPosition:a.pos/SIMULATIONS,
        mostLikelyPosition:mostLikelyIndex+1,
        positionProbabilities
      };
    }).sort((a,b)=>b.titleProb-a.titleProb||b.top4Prob-a.top4Prob);

    scenario.conditionalTitle={
      win:scenario.counts.win?scenario.titles.win/scenario.counts.win*100:0,
      draw:scenario.counts.draw?scenario.titles.draw/scenario.counts.draw*100:0,
      loss:scenario.counts.loss?scenario.titles.loss/scenario.counts.loss*100:0
    };

    const impact=trackedImpact.map(item=>({
      fixture:item.fixture,
      resultProb:item.resultProb,
      conditionalTitle:{
        win:item.counts.win?item.titles.win/item.counts.win*100:0,
        draw:item.counts.draw?item.titles.draw/item.counts.draw*100:0,
        loss:item.counts.loss?item.titles.loss/item.counts.loss*100:0
      }
    }));

    const sortedChampionPoints=championPoints.slice().sort((a,b)=>a-b);
    const quantile=q=>{
      if(!sortedChampionPoints.length) return 0;
      const pos=(sortedChampionPoints.length-1)*q;
      const base=Math.floor(pos), rest=pos-base;
      const next=sortedChampionPoints[base+1];
      return next===undefined?sortedChampionPoints[base]:sortedChampionPoints[base]+rest*(next-sortedChampionPoints[base]);
    };

    const championPointStats={
      average:championPoints.length?championPoints.reduce((a,b)=>a+b,0)/championPoints.length:0,
      q10:quantile(.10),q25:quantile(.25),median:quantile(.5),q75:quantile(.75),q90:quantile(.90),
      min:sortedChampionPoints[0]||0,max:sortedChampionPoints[sortedChampionPoints.length-1]||0
    };
    const arrayStats=v=>{const s=v.slice().sort((a,b)=>a-b);const q=p=>{if(!s.length)return 0;const x=(s.length-1)*p,b=Math.floor(x),r=x-b,n=s[b+1];return n===undefined?s[b]:s[b]+r*(n-s[b]);};const countAtLeast=x=>s.reduce((n,v)=>n+(v>=x?1:0),0);return {samples:s.length,average:s.length?s.reduce((a,b)=>a+b,0)/s.length:0,q01:q(.01),q05:q(.05),q10:q(.1),q25:q(.25),median:q(.5),q75:q(.75),q90:q(.9),q95:q(.95),q99:q(.99),min:s[0]||0,max:s[s.length-1]||0,atLeast80:countAtLeast(80),atLeast85:countAtLeast(85),atLeast90:countAtLeast(90),atLeast95:countAtLeast(95),atLeast100:countAtLeast(100)};};
    const validationStats={arsenal:arrayStats(arsenalAllPoints),arsenalTitles:arrayStats(arsenalTitlePoints),arsenalNonTitles:arrayStats(arsenalNonTitlePoints),champion:arrayStats(championPoints)};
    validationStats.championBelow75=championPoints.reduce((n,v)=>n+(v<75?1:0),0);
    validationStats.championAbove95=championPoints.reduce((n,v)=>n+(v>95?1:0),0);
    validationStats.championAtLeast100=championPoints.reduce((n,v)=>n+(v>=100?1:0),0);

    // Threshold = among simulations where Arsenal finish at or above N points,
    // how often do they win the league?
    const minTarget=Math.max(60,Math.floor((rows.find(t=>t.club==='Arsenal')?.expectedPoints||75)/5)*5-10);
    const maxTarget=Math.min(100,minTarget+30);
    const pointThresholds=[];
    for(let target=minTarget;target<=maxTarget;target+=5){
      let samples=0,titles=0;
      for(const [pts,rec] of arsenalPointOutcomes.entries()){
        if(pts>=target){
          samples+=rec.samples;
          titles+=rec.titles;
        }
      }
      pointThresholds.push({
        points:target,
        probability:samples?titles/samples*100:0,
        samples
      });
    }

    return {rows,scenario,impact,championPointStats,pointThresholds,validationStats};
  }


  function reverseCompletedResult(teams,target){
    const out=teams.map(t=>({...t}));
    const home=out.find(t=>t.club===target.home);
    const away=out.find(t=>t.club===target.away);
    if(!home||!away)return out;

    const hs=Number(target.home_score),as=Number(target.away_score);
    if(!Number.isFinite(hs)||!Number.isFinite(as))return out;

    home.played=Math.max(0,home.played-1);
    away.played=Math.max(0,away.played-1);
    home.gf-=hs; home.ga-=as; home.gd-=hs-as;
    away.gf-=as; away.ga-=hs; away.gd-=as-hs;

    if(hs>as){
      home.wins=Math.max(0,home.wins-1);
      away.losses=Math.max(0,away.losses-1);
      home.points=Math.max(0,home.points-3);
    }else if(as>hs){
      away.wins=Math.max(0,away.wins-1);
      home.losses=Math.max(0,home.losses-1);
      away.points=Math.max(0,away.points-3);
    }else{
      home.draws=Math.max(0,home.draws-1);
      away.draws=Math.max(0,away.draws-1);
      home.points=Math.max(0,home.points-1);
      away.points=Math.max(0,away.points-1);
    }

    for(const team of [home,away]){
      team.remaining=Math.max(0,38-team.played);
      team.ppg=team.played?team.points/team.played:1.35;
      team.gfpg=team.played?team.gf/team.played:1.35;
      team.gapg=team.played?team.ga/team.played:1.35;
    }
    return out;
  }

  function sameFixture(a,b){
    return !!a&&!!b&&pairKey(a.home,a.away)===pairKey(b.home,b.away);
  }

  function counterfactualTitleImpact(currentTeams,fixtures,target,focalClub){
    if(!target||!focalClub)return null;

    const preTeams=reverseCompletedResult(currentTeams,target);
    const evidenceResults=completedResults(fixtures).filter(r=>!sameFixture(r,target));
    const ratedTeams=buildRatings(preTeams,evidenceResults);
    const byName=new Map(ratedTeams.map(t=>[t.club.toLowerCase(),t]));

    const cfFixtures=fixtures.map(f=>sameFixture(f,target)
      ? {...f,status:'scheduled',home_score:null,away_score:null}
      : {...f});

    const remaining=cfFixtures.filter(f=>!finished(f.status));
    const prepared=remaining.map(f=>{
      const home=byName.get(f.home.toLowerCase());
      const away=byName.get(f.away.toLowerCase());
      return home&&away?{...f,homeTeam:home,awayTeam:away,model:fixtureGoalModel(home,away)}:null;
    }).filter(Boolean);

    const targetPrepared=prepared.find(f=>sameFixture(f,target));
    if(!targetPrepared)return null;

    const counts={win:0,draw:0,loss:0};
    const titles={win:0,draw:0,loss:0};

    const seed=ratedTeams.reduce((s,t)=>s+t.points*41+t.played*23+t.gf*13+t.ga*7,20261202)
      + fixtureOrderValue(target)%100000 + focalClub.length*97;
    const rng=rngFactory(seed>>>0);

    for(let sim=0;sim<COUNTERFACTUAL_SIMULATIONS;sim++){
      const season=new Map(ratedTeams.map(t=>[t.club,{club:t.club,points:t.points,gd:t.gd,gf:t.gf}]));
      let focalOutcome=null;

      for(const f of prepared){
        const hs=sampleScore(f.model.homeCDF,rng);
        const as=sampleScore(f.model.awayCDF,rng);
        const h=season.get(f.homeTeam.club);
        const a=season.get(f.awayTeam.club);

        if(sameFixture(f,target)){
          const focalHome=f.homeTeam.club===focalClub;
          const fg=focalHome?hs:as;
          const og=focalHome?as:hs;
          focalOutcome=fg>og?'win':fg===og?'draw':'loss';
          counts[focalOutcome]++;
        }

        h.gf+=hs; a.gf+=as;
        h.gd+=hs-as; a.gd+=as-hs;
        if(hs>as)h.points+=3;
        else if(as>hs)a.points+=3;
        else{h.points++;a.points++;}
      }

      const table=[...season.values()].sort((a,b)=>
        b.points-a.points||b.gd-a.gd||b.gf-a.gf||a.club.localeCompare(b.club)
      );
      if(focalOutcome&&table[0]?.club==='Arsenal')titles[focalOutcome]++;
    }

    const conditional={
      win:counts.win?titles.win/counts.win*100:0,
      draw:counts.draw?titles.draw/counts.draw*100:0,
      loss:counts.loss?titles.loss/counts.loss*100:0
    };

    const hs=Number(target.home_score),as=Number(target.away_score);
    const focalHome=target.home===focalClub;
    const fg=focalHome?hs:as,og=focalHome?as:hs;
    const actualOutcome=fg>og?'win':fg===og?'draw':'loss';

    return {
      fixture:target,
      focalClub,
      actualOutcome,
      conditional,
      samples:counts
    };
  }

  function buildCounterfactualImpacts(currentTeams,fixtures,rows,completedCount){
    if(completedCount<1)return [];

    const credible=rows.filter(t=>t.club!=='Arsenal'&&isCredibleTitleThreat(t,completedCount))
      .sort((a,b)=>b.titleProb-a.titleProb)
      .slice(0,3)
      .map(t=>t.club);

    const finishedRows=completedResults(fixtures).slice().sort((a,b)=>resultTime(a)-resultTime(b));
    const selected=[];
    const seenClubs=new Set();

    for(const r of [...finishedRows].reverse()){
      let focal=null;
      if(r.home==='Arsenal'||r.away==='Arsenal')focal='Arsenal';
      else focal=credible.find(c=>r.home===c||r.away===c)||null;
      if(!focal||seenClubs.has(focal))continue;
      seenClubs.add(focal);
      selected.push({fixture:r,focal});
      if(selected.length>=3)break;
    }

    return selected.map(item=>counterfactualTitleImpact(currentTeams,fixtures,item.fixture,item.focal)).filter(Boolean);
  }

  function renderV122Counterfactuals(items,currentArsenalProb){
    const el=document.getElementById('v122CounterfactualList');
    const status=document.getElementById('v122CounterfactualStatus');
    if(!el)return;

    if(!items?.length){
      el.innerHTML='<div class="nl4-title-model-loading">Counterfactual impact will appear after completed Premier League results.</div>';
      if(status)status.textContent='WAITING FOR RESULTS';
      return;
    }

    if(status)status.textContent=`${items.length} RESULT${items.length===1?'':'S'} RE-SIMULATED`;

    el.innerHTML=items.map(item=>{
      const f=item.fixture;
      const focal=item.focalClub;
      const opp=f.home===focal?f.away:f.home;
      const hs=Number(f.home_score),as=Number(f.away_score);
      const score=`${f.home} ${hs}–${as} ${f.away}`;

      const actual=item.conditional[item.actualOutcome]||0;
      const alternatives=['win','draw','loss'].filter(x=>x!==item.actualOutcome);
      const altRows=alternatives.map(outcome=>{
        const p=item.conditional[outcome]||0;
        const delta=actual-p;
        return `<div class="v122-alt-row">
          <span>IF ${esc(focal.toUpperCase())} ${outcome.toUpperCase()}</span>
          <strong>${p.toFixed(1)}%</strong>
          <b class="${delta>=0?'positive':'negative'}">${delta>=0?'+':''}${delta.toFixed(1)} pts vs that scenario</b>
        </div>`;
      }).join('');

      const actualLabel=item.actualOutcome==='win'?'WON':item.actualOutcome==='draw'?'DREW':'LOST';
      const currentDiff=Number(currentArsenalProb)-actual;

      return `<article class="v122-cf-card">
        <div class="v122-cf-head">
          <div>
            <span>TRUE COUNTERFACTUAL • ${esc(focal)}</span>
            <strong>${esc(score)}</strong>
            <small>${esc(focal)} ${actualLabel} vs ${esc(opp)}</small>
          </div>
          <div class="v122-actual">
            <span>ARSENAL TITLE CHANCE<br>CONDITIONAL ON ACTUAL OUTCOME</span>
            <strong>${actual.toFixed(1)}%</strong>
          </div>
        </div>
        <div class="v122-alt-grid">${altRows}</div>
        <p>
          Re-simulated from the table with this result removed, while every other completed league result stays fixed.
          ${Math.abs(currentDiff)>1.0?` The live forecast (${Number(currentArsenalProb).toFixed(1)}%) can differ slightly because the full model also incorporates the complete current evidence state.`:''}
        </p>
      </article>`;
    }).join('');
  }

  function render(rows,fixtureCount,completedCount,scenario,impact,championPointStats,pointThresholds,validationStats){
    const arsenal=rows.find(x=>x.club.toLowerCase()==='arsenal');
    if(arsenal){
      setText('arsenalTitleProbability',`${arsenal.titleProb.toFixed(1)}%`);
      setText('arsenalTop4Probability',`${arsenal.top4Prob.toFixed(1)}%`);
      setText('arsenalTop5Probability',`${arsenal.top5Prob.toFixed(1)}%`);
      setText('arsenalExpectedPoints',arsenal.expectedPoints.toFixed(1));
      setText('arsenalExpectedPosition',arsenal.expectedPosition.toFixed(1));
      setText('arsenalMostLikelyPosition',`${arsenal.mostLikelyPosition}`);
      setText('arsenalRelegationProbability',`${arsenal.relegationProb.toFixed(1)}%`);
      setText('arsenalPodiumProbability',`${arsenal.positionProbabilities.slice(0,3).reduce((a,b)=>a+b,0).toFixed(1)}% PODIUM`);
      setText('titleArsenalForm',arsenal.formLabel||'PRE-SEASON');
      setText('arsenalHistoricalPointsAnchor',`${Number(arsenal.historicalPointsAnchor||0).toFixed(1)} pts`);
      setText('arsenalHistoricalPointsWeight',`${Math.round(preseasonWeight(arsenal.played)*100)}% active`);
      setText('arsenalPriorDedupStatus','ACTIVE');
      setText('arsenalHistoricalEffect','BALANCED');
      setText('arsenalCalibrationBand','77–81 pts');
      setText('leagueScoringBaseline',`${arsenal.played?Number(arsenal.leagueGoalAvg||0).toFixed(2):'1.42'} goals/team`);
      setText('leagueDecisivenessMode','GAP-AWARE');

      const dist=document.getElementById('arsenalPositionDistribution');
      if(dist){
        const max=Math.max(...arsenal.positionProbabilities);
        dist.innerHTML=arsenal.positionProbabilities.map((p,i)=>`
          <div class="nl4-position-prob ${p===max?'hot':''}">
            <b>${i+1}${i===0?'ST':i===1?'ND':i===2?'RD':'TH'}</b>
            <strong>${p.toFixed(1)}%</strong>
            <small>${p===max?'MOST LIKELY':'FINISH'}</small>
          </div>
        `).join('');
      }
    }
    if(scenario?.fixture){
      const f=scenario.fixture;
      const opp=f.home==='Arsenal'?f.away:f.home;
      const venue=f.home==='Arsenal'?'HOME':'AWAY';
      setText('scenarioFixtureLabel',`ARSENAL vs ${opp} • ${venue}`);
      setText('scenarioWinTitle',`${scenario.conditionalTitle.win.toFixed(1)}%`);
      setText('scenarioDrawTitle',`${scenario.conditionalTitle.draw.toFixed(1)}%`);
      setText('scenarioLossTitle',`${scenario.conditionalTitle.loss.toFixed(1)}%`);
      setText('scenarioWinChance',`W ${scenario.resultProb.win.toFixed(1)}%`);
      setText('scenarioDrawChance',`D ${scenario.resultProb.draw.toFixed(1)}%`);
      setText('scenarioLossChance',`L ${scenario.resultProb.loss.toFixed(1)}%`);

      if(arsenal){
        const base=arsenal.titleProb;
        const swing=(v)=>v-base;
        const label=(v)=>`${v>=0?'+':''}${v.toFixed(1)} pts vs current forecast`;
        setText('scenarioWinSwing',label(swing(scenario.conditionalTitle.win)));
        setText('scenarioDrawSwing',label(swing(scenario.conditionalTitle.draw)));
        setText('scenarioLossSwing',label(swing(scenario.conditionalTitle.loss)));
      }
    }else{
      setText('scenarioFixtureLabel','No remaining Arsenal league fixture');
    }

    const impactEl=document.getElementById('arsenalImpactMap');
    if(impactEl){
      if(impact?.length){
        impactEl.innerHTML=impact.map((item,index)=>{
          const f=item.fixture;
          const opp=f.home==='Arsenal'?f.away:f.home;
          const venue=f.home==='Arsenal'?'HOME':'AWAY';
          const base=arsenal?.titleProb||0;
          const winSwing=item.conditionalTitle.win-base;
          const lossSwing=item.conditionalTitle.loss-base;
          const spread=item.conditionalTitle.win-item.conditionalTitle.loss;

          return `<div class="nl4-impact-row">
            <div class="nl4-impact-fixture">
              <b>${index+1}. Arsenal vs ${esc(opp)}</b>
              <span>${venue}${f.matchday?` • MATCHDAY ${esc(f.matchday)}`:''}</span>
            </div>
            <div class="nl4-impact-outcome win">
              <small>WIN → TITLE</small>
              <strong>${item.conditionalTitle.win.toFixed(1)}%</strong>
            </div>
            <div class="nl4-impact-outcome draw">
              <small>DRAW → TITLE</small>
              <strong>${item.conditionalTitle.draw.toFixed(1)}%</strong>
            </div>
            <div class="nl4-impact-outcome loss">
              <small>LOSS → TITLE</small>
              <strong>${item.conditionalTitle.loss.toFixed(1)}%</strong>
            </div>
            <div class="nl4-impact-swing">
              <small>WIN/LOSS SPREAD</small>
              <strong>${spread.toFixed(1)} pts</strong>
            </div>
          </div>`;
        }).join('');
      }else{
        impactEl.innerHTML='<div class="nl4-title-model-loading">No remaining Arsenal league fixtures.</div>';
      }
    }

    if(championPointStats){
      setText('expectedChampionPoints',championPointStats.average.toFixed(1));
      setText('championPointsRange',`${Math.round(championPointStats.q25)}–${Math.round(championPointStats.q75)} pts`);
      setText('titleTargetHeadline',`MEDIAN CHAMPION: ${Math.round(championPointStats.median)} PTS`);
      if(arsenal) setText('arsenalPointsTargetCurrent',arsenal.expectedPoints.toFixed(1));

      const thresholdEl=document.getElementById('arsenalPointsThresholdList');
      if(thresholdEl){
        thresholdEl.innerHTML=(pointThresholds||[]).map(item=>`
          <div class="nl4-threshold-row">
            <b>${item.points}+ PTS</b>
            <div class="nl4-threshold-track">
              <div class="nl4-threshold-fill" style="width:${Math.max(0,Math.min(100,item.probability))}%"></div>
            </div>
            <strong>${item.samples?item.probability.toFixed(1)+'%':'—'}</strong>
          </div>
        `).join('');
      }
    }

    const confidence=confidenceFromResults(completedCount);
    setText('titleConfidenceLabel',confidence.label);
    setText('titleConfidenceScore',`${confidence.score}/100`);
    const confidenceBar=document.getElementById('titleConfidenceBar');
    if(confidenceBar) confidenceBar.style.width=`${confidence.score}%`;

    const confidenceNote=document.getElementById('titleConfidenceNote');
    if(confidenceNote){
      confidenceNote.textContent=completedCount===0
        ? 'Pre-season baseline: no 2026/27 league result has been recorded yet. Clubs start from differentiated previous-season strength priors, with Arsenal receiving defending-champion weighting; confidence remains low until 2026/27 results arrive.'
        : confidence.label==='LOW'
          ? `Only ${completedCount} league matches are complete. Current-season ratings are still strongly regressed toward league average.`
          : confidence.label==='MEDIUM'
            ? `${completedCount} completed matches provide meaningful current-season evidence, though uncertainty remains.`
            : `${completedCount} completed matches provide strong evidence for Elo, recent form and home/away ratings.`;
    }

    setText('titleCompletedMatches',`${completedCount}/${TOTAL_FIXTURES}`);

    setText('previousSeasonSource',PREVIOUS_SEASON_META.source);
    setText('previousSeasonCoverage',`${PREVIOUS_SEASON_META.rows}/20 rows`);
    setText('secondPreviousSeasonCoverage',`${PREVIOUS_SEASON_META.secondRows||0}/20 rows`);
    setText('previousSeasonPromoted',PREVIOUS_SEASON_META.promotedClubs.length
      ? PREVIOUS_SEASON_META.promotedClubs.join(', ')
      : '—');

    const priorWarning=document.getElementById('previousSeasonWarning');
    if(priorWarning){
      if(PREVIOUS_SEASON_META.warning){
        priorWarning.textContent=PREVIOUS_SEASON_META.warning;
        priorWarning.classList.add('warning');
      }else{
        priorWarning.textContent=`${PREVIOUS_SEASON} table loaded successfully. ${PREVIOUS_SEASON_META.secondRows===20?SECOND_PREVIOUS_SEASON+' multi-season context is also active. ':''}${PREVIOUS_SEASON_META.currentClubMatches} returning Premier League clubs matched and ${PREVIOUS_SEASON_META.promotedClubs.length} promoted clubs were detected automatically.`;
        priorWarning.classList.remove('warning');
      }
    }


    if(validationStats){
      const a=validationStats.arsenal||{},at=validationStats.arsenalTitles||{},an=validationStats.arsenalNonTitles||{},c=validationStats.champion||{};
      setText('v128ArsenalMedian',`${Math.round(a.median||0)} pts`);setText('v128ArsenalP10',`${Math.round(a.q10||0)} pts`);setText('v128ArsenalP25',`${Math.round(a.q25||0)} pts`);setText('v128ArsenalP75',`${Math.round(a.q75||0)} pts`);setText('v128ArsenalP90',`${Math.round(a.q90||0)} pts`);
      setText('v128TitleSamples',`${Number(at.samples||0).toLocaleString()} / ${SIMULATIONS.toLocaleString()}`);setText('v128TitleAvg',`${Number(at.average||0).toFixed(1)} pts`);setText('v128TitleMin',`${Math.round(at.min||0)} pts`);setText('v128TitleMax',`${Math.round(at.max||0)} pts`);setText('v128NonTitleAvg',`${Number(an.average||0).toFixed(1)} pts`);
      setText('v128ChampionAvg',`${Number(c.average||0).toFixed(1)} pts`);setText('v128ChampionMedian',`${Math.round(c.median||0)} pts`);setText('v128ChampionP10',`${Math.round(c.q10||0)} pts`);setText('v128ChampionP90',`${Math.round(c.q90||0)} pts`);
      setText('v129ArsenalP01',`${Math.round(a.q01||0)} pts`);setText('v129ArsenalP05',`${Math.round(a.q05||0)} pts`);setText('v129ArsenalP95',`${Math.round(a.q95||0)} pts`);setText('v129ArsenalP99',`${Math.round(a.q99||0)} pts`);
      setText('v129Arsenal80',`${((a.atLeast80||0)/SIMULATIONS*100).toFixed(1)}%`);setText('v129Arsenal85',`${((a.atLeast85||0)/SIMULATIONS*100).toFixed(1)}%`);setText('v129Arsenal90',`${((a.atLeast90||0)/SIMULATIONS*100).toFixed(1)}%`);setText('v129Arsenal95',`${((a.atLeast95||0)/SIMULATIONS*100).toFixed(1)}%`);setText('v129Arsenal100',`${((a.atLeast100||0)/SIMULATIONS*100).toFixed(2)}%`);
      setText('v129ChampionBelow75',`${((validationStats.championBelow75||0)/SIMULATIONS*100).toFixed(1)}%`);setText('v129ChampionAbove95',`${((validationStats.championAbove95||0)/SIMULATIONS*100).toFixed(1)}%`);setText('v129Champion100',`${((validationStats.championAtLeast100||0)/SIMULATIONS*100).toFixed(2)}%`);
      const ar=rows.find(team=>team.club==='Arsenal');if(ar){const p=ar.titleProb/100,se=Math.sqrt(p*(1-p)/SIMULATIONS),half=1.96*se*100;setText('v129MonteCarloSE',`±${half.toFixed(1)} pts`);setText('v129MonteCarloCI',`${Math.max(0,ar.titleProb-half).toFixed(1)}–${Math.min(100,ar.titleProb+half).toFixed(1)}%`);}
      const w=document.getElementById('v128TitleWinnerShare');if(w)w.innerHTML=rows.slice().sort((x,y)=>y.titleProb-x.titleProb).slice(0,8).map(team=>`<div class="v128-winner-row"><span>${esc(team.club)}</span><div><i style="width:${Math.max(1,team.titleProb)}%"></i></div><strong>${team.titleProb.toFixed(1)}%</strong></div>`).join('');
    }

    tableEl.innerHTML=rows.map(t=>`
      <div class="nl4-title-probability-row ${t.club==='Arsenal'?'arsenal':''}">
        <div class="nl4-title-team"><span class="badge">${esc(code(t.club))}</span><b>${esc(t.club)}<span class="nl4-elo-pill">ELO ${Math.round(t.eloRating||ELO_BASE)}</span></b></div>
        <div class="nl4-title-cell title">${t.titleProb.toFixed(1)}%
          <div class="nl4-title-prob-bar"><div class="nl4-title-prob-fill" style="width:${Math.min(100,t.titleProb)}%"></div></div>
        </div>
        <div class="nl4-title-cell">${t.top4Prob.toFixed(1)}%</div>
        <div class="nl4-title-cell">${t.top5Prob.toFixed(1)}%</div>
        <div class="nl4-title-cell">${t.relegationProb.toFixed(1)}%</div>
        <div class="nl4-title-cell">${t.expectedPoints.toFixed(1)}</div>
      </div>`).join('');

    if(statusEl){
      const phase=completedCount===0?'PRE-SEASON BASELINE':completedCount<80?'EARLY-SEASON MODEL':'IN-SEASON MODEL';
      statusEl.textContent=`V12.9 • ${phase} • ${SIMULATIONS.toLocaleString()} simulations • title-points target • race momentum • probability history • simulation reliability diagnostics • tail audit • Monte Carlo uncertainty • points distribution audit • league points distribution calibration • elite win/draw calibration • balanced historical calibration • prior de-duplication • established-club shrinkage • interactive matchday timeline • true result counterfactuals • multi-season strength • 2025/26 + 2024/25 data • defending-champion evidence • fading prior • Poisson-style goals • recent form • home/away performance`;
    }
  }



  function isCredibleTitleThreat(team,completedCount){
    if(!team||team.club==='Arsenal')return false;
    const rounds=(Number(completedCount)||0)/10; // 10 league matches ~= one full round across 20 clubs.
    const established=['DEFENDING CHAMPION','TITLE','ELITE'].includes(team.preseasonTier);
    if(established)return true;

    // Before six rounds, do not label a non-elite or promoted side a genuine title threat
    // from a tiny sample alone. The raw simulation remains visible in the full table.
    if(rounds<6)return false;

    if(team.promoted){
      if(rounds<10)return false;
      if(rounds<19)return team.titleProb>=5 && team.expectedPosition<=6 && team.eloRating>=1575;
      return team.titleProb>=2 && team.expectedPosition<=6;
    }

    if(rounds<12)return team.titleProb>=4 && team.expectedPosition<=6 && team.eloRating>=1585;
    return team.titleProb>=2 && team.expectedPosition<=6;
  }

  function v11ResultLabel(result,club){
    const hs=Number(result.home_score),as=Number(result.away_score);
    const isHome=result.home===club;
    const gf=isHome?hs:as,ga=isHome?as:hs;
    const opponent=isHome?result.away:result.home;
    const outcome=gf>ga?'beat':gf===ga?'drew with':'lost to';
    const signal=gf>ga?'positive':gf===ga?'neutral':'negative';
    return {opponent,outcome,score:`${gf}–${ga}`,signal};
  }

  function renderV11Explainer(rows,results,history,completedCount){
    const arsenal=rows.find(t=>t.club==='Arsenal');
    if(!arsenal)return;

    const sortedHistory=(history||[]).slice().sort((a,b)=>Number(a.completed_matches)-Number(b.completed_matches));
    const distinct=sortedHistory.filter((row,i,arr)=>i===0||Number(row.completed_matches)!==Number(arr[i-1].completed_matches));
    let previous=null;
    for(const row of distinct){
      if(Number(row.completed_matches)<completedCount) previous=row;
    }
    if(!previous && distinct.length && Number(distinct[distinct.length-1].completed_matches)!==completedCount){
      previous=distinct[distinct.length-1];
    }

    const current=Number(arsenal.titleProb||0);
    const previousProb=previous?Number(previous.title_probability):null;
    const change=previousProb===null?null:current-previousProb;
    const changeEl=document.getElementById('v11ProbabilityChange');
    if(changeEl){
      changeEl.classList.remove('rising','falling');
      if(change===null){
        changeEl.textContent='FIRST FORECAST';
      }else{
        changeEl.textContent=`${change>=0?'↑ +':'↓ '}${change.toFixed(1)} pts`;
        if(change>0.05)changeEl.classList.add('rising');
        else if(change<-0.05)changeEl.classList.add('falling');
      }
    }

    const rivals=rows.filter(t=>t.club!=='Arsenal').sort((a,b)=>b.titleProb-a.titleProb);
    const rawRunnerUp=rivals[0]||null;
    const credibleRivals=rivals.filter(t=>isCredibleTitleThreat(t,completedCount));
    const challenger=credibleRivals[0]||null;
    const gap=challenger?current-Number(challenger.titleProb||0):0;
    setText('v11ClosestChallenger',challenger?.club||'NOT RELIABLE YET');
    setText('v11ChallengerChance',challenger?`Credible threat • ${challenger.titleProb.toFixed(1)}%`:'Early-season evidence is too limited');
    setText('v11ProbabilityGap',challenger?`${gap>=0?'+':''}${gap.toFixed(1)} pts`:'—');

    const arsenalRank=rows.slice().sort((a,b)=>b.titleProb-a.titleProb).findIndex(t=>t.club==='Arsenal')+1;
    let raceStatus='TITLE RACE WIDE OPEN',raceNote='Several clubs remain closely matched by the model.';
    if(arsenalRank===1 && gap>=15){raceStatus='ARSENAL IN CONTROL';raceNote='Arsenal hold a clear probability lead over the nearest challenger.';}
    else if(arsenalRank===1 && gap>=5){raceStatus='ARSENAL LEADING THE RACE';raceNote='Arsenal lead, but the nearest challenger remains within striking distance.';}
    else if(arsenalRank===1){raceStatus='ARSENAL NARROWLY AHEAD';raceNote='The model has Arsenal first, but the race is extremely tight.';}
    else if(arsenalRank<=3){raceStatus='ARSENAL IN THE TITLE FIGHT';raceNote=`Arsenal rank ${arsenalRank}${arsenalRank===2?'nd':'rd'} by title probability.`;}
    else if(current>=10){raceStatus='ARSENAL CHASING';raceNote='Arsenal remain live contenders but need ground to be made up.';}
    else{raceStatus='OUTSIDER POSITION';raceNote='Arsenal need a significant swing in results to become model favourites.';}
    setText('v11RaceStatus',raceStatus);setText('v11RaceStatusNote',raceNote);

    const orderedResults=(results||[]).slice().sort((a,b)=>resultTime(a)-resultTime(b));
    const deltaMatches=previous?Math.max(1,completedCount-Number(previous.completed_matches||0)):Math.min(10,orderedResults.length);
    const newest=orderedResults.slice(-Math.min(deltaMatches,20));
    const drivers=[];

    const arsenalLatest=[...newest].reverse().find(r=>r.home==='Arsenal'||r.away==='Arsenal');
    if(arsenalLatest){
      const info=v11ResultLabel(arsenalLatest,'Arsenal');
      drivers.push({icon:info.signal==='positive'?'✓':info.signal==='negative'?'!':'=',signal:info.signal,title:`Arsenal ${info.outcome} ${info.opponent} ${info.score}`,detail:'Arsenal’s own result directly changes points, form, Elo strength and the remaining title path.',tag:info.signal==='positive'?'POSITIVE SIGNAL':info.signal==='negative'?'NEGATIVE SIGNAL':'MIXED SIGNAL'});
    }

    const rivalNames=(credibleRivals.length?credibleRivals:rivals.filter(r=>!r.promoted)).slice(0,4).map(r=>r.club);
    const rivalResults=[...newest].reverse().filter(r=>rivalNames.includes(r.home)||rivalNames.includes(r.away));
    const seen=new Set();
    for(const rr of rivalResults){
      const club=rivalNames.find(n=>rr.home===n||rr.away===n);
      if(!club||seen.has(club))continue; seen.add(club);
      const info=v11ResultLabel(rr,club);
      const dropped=info.signal!=='positive';
      drivers.push({icon:dropped?'↗':'↔',signal:dropped?'positive':'neutral',title:`${club} ${info.outcome} ${info.opponent} ${info.score}`,detail:dropped?'A leading rival dropped points, which generally improves Arsenal’s route to first place.':'A leading rival took maximum points, keeping pressure on Arsenal in the simulation.',tag:dropped?'RIVAL DROP':'RIVAL PRESSURE'});
      if(drivers.length>=3)break;
    }

    if(rawRunnerUp?.promoted && !isCredibleTitleThreat(rawRunnerUp,completedCount)){
      drivers.push({icon:'P',signal:'neutral',title:`Raw simulation runner-up: ${rawRunnerUp.club}`,detail:`${rawRunnerUp.club} is newly promoted, so V12.9 does not describe it as a genuine title rival from a small early-season sample. Its raw ${rawRunnerUp.titleProb.toFixed(1)}% remains visible in the probability table.`,tag:'PROMOTION CALIBRATION'});
    }

    if(arsenal.defendingChampion){
      drivers.push({
        icon:'C',
        signal:'positive',
        title:'Defending Premier League champions',
        detail:`Arsenal enter 2026/27 as the 2025/26 champions. V12.9 carries that title-winning evidence into the preseason strength prior, then gradually reduces its influence as new league results arrive.`,
        tag:'CHAMPION PRIOR'
      });
    }





    drivers.push({
      icon:'L',
      signal:'neutral',
      title:'League points environment calibrated',
      detail:'V12.9 raises the preseason scoring environment and applies a capped strength-gap adjustment. Strong favourites should convert more matches into wins, while close contests remain largely unchanged. The adjustment applies to every club, not Arsenal alone.',
      tag:'LEAGUE CALIBRATION'
    });

    drivers.push({
      icon:'B',
      signal:'neutral',
      title:'Balanced historical calibration',
      detail:'V12.9 slightly strengthens the historical-points influence relative to V12.5 while keeping champion-bonus de-duplication active. The 77–81 point band is a calibration check, not a forced forecast target.',
      tag:'BALANCED CALIBRATION'
    });

    drivers.push({
      icon:'D',
      signal:'neutral',
      title:'Prior de-duplication active',
      detail:'V12.9 prevents Arsenal’s 2025/26 championship from being rewarded multiple times through separate champion Elo bonuses and an overly strong historical-points multiplier. The same evidence still matters, but each channel has a distinct role.',
      tag:'CALIBRATION CONTROL'
    });

    if(Number.isFinite(Number(arsenal.historicalPointsAnchor))){
      drivers.push({
        icon:'H',
        signal:'positive',
        title:`Historical points anchor: ${Number(arsenal.historicalPointsAnchor).toFixed(1)} pts`,
        detail:`V12.9 uses a recency-weighted points baseline as calibration evidence for preseason win rates. It influences match probabilities but does not guarantee Arsenal that final total, and its weight fades as 2026/27 results arrive.`,
        tag:'POINTS CALIBRATION'
      });
    }

    if(Number.isFinite(Number(arsenal.previousPoints))&&Number.isFinite(Number(arsenal.previousGD))){
      const gd=Number(arsenal.previousGD);
      drivers.push({
        icon:'25',
        signal:'positive',
        title:`2025/26 evidence: ${arsenal.previousPoints} pts • ${gd>=0?'+':''}${gd} GD`,
        detail:`V12.9 blends Arsenal's 2025/26 title-winning season with 2024/25 performance and a long-term strength anchor, so one season does not determine the entire prior.`,
        tag:'PREVIOUS-SEASON DATA'
      });
    }

    const form=arsenal.formLabel||'PRE-SEASON';
    const formWins=(form.match(/W/g)||[]).length,formLosses=(form.match(/L/g)||[]).length;
    const formSignal=formWins>formLosses?'positive':formLosses>formWins?'negative':'neutral';
    drivers.push({icon:'F',signal:formSignal,title:`Recent form: ${form}`,detail:`The model weights Arsenal’s latest league results, alongside season-long attack, defence and Elo evidence.`,tag:formSignal==='positive'?'FORM BOOST':formSignal==='negative'?'FORM DRAG':'FORM STEADY'});

    if(challenger){
      drivers.push({icon:'R',signal:gap>=0?'positive':'negative',title:`Credible title threat: ${challenger.club} at ${challenger.titleProb.toFixed(1)}%`,detail:`Arsenal are ${Math.abs(gap).toFixed(1)} probability points ${gap>=0?'ahead of':'behind'} the nearest title rival.`,tag:'RACE PRESSURE'});
    }

    const list=document.getElementById('v11DriverList');
    if(list){
      list.innerHTML=drivers.slice(0,4).map(d=>`<div class="nl4-v11-driver ${d.signal}"><div class="nl4-v11-driver-icon">${esc(d.icon)}</div><div class="nl4-v11-driver-copy"><b>${esc(d.title)}</b><span>${esc(d.detail)}</span></div><strong class="nl4-v11-driver-signal">${esc(d.tag)}</strong></div>`).join('');
    }

    const summary=document.getElementById('v11ChangeSummary');
    if(summary){
      if(change===null){
        if(challenger) summary.textContent=`This is the first comparable V12.9 forecast. Arsenal are currently ${current.toFixed(1)}% to retain the Premier League title after entering 2026/27 as defending champions. ${challenger.club} is the strongest credible title-race threat after combining the 2025/26 Premier League table with current-season evidence.`;
        else summary.textContent=`This is the first comparable V12.9 forecast. Arsenal are currently ${current.toFixed(1)}% to win the league. It is still too early to identify a reliable title-race challenger from current-season evidence alone.`;
      }
      else if(Math.abs(change)<0.05) summary.textContent=`Arsenal remain effectively unchanged at ${current.toFixed(1)}% compared with the previous saved forecast. The signals below show what is currently shaping the race.`;
      else summary.textContent=`Arsenal moved from ${previousProb.toFixed(1)}% to ${current.toFixed(1)}% — a ${change>0?'rise':'fall'} of ${Math.abs(change).toFixed(1)} probability points. These are the strongest football signals around that movement.`;
    }
  }

  function renderTitleHistory(history){
    const svg=document.getElementById('titleHistoryChart');
    if(!svg)return;

    const rows=(history||[]).slice().sort((a,b)=>Number(a.completed_matches)-Number(b.completed_matches));
    if(!rows.length){
      svg.innerHTML='<text x="380" y="120" text-anchor="middle" class="nl4-history-axis-text">History begins after the first saved probability snapshot.</text>';
      setText('titleHistoryLatest','WAITING FOR FIRST RESULT');
      setText('titleHistoryChange','Season change: —');
      setText('raceMomentumStatus','WAITING FOR RESULTS');
      setText('arsenalMomentumChange','—');
      setText('arsenalMomentumCurrent','—');
      setText('arsenalMomentumTrend','—');
      return;
    }

    const W=760,H=240,L=44,R=18,T=18,B=34;
    const innerW=W-L-R,innerH=H-T-B;
    const maxMatches=Math.max(38,...rows.map(r=>Number(r.completed_matches)||0));
    const x=m=>L+(Number(m)/maxMatches)*innerW;
    const y=p=>T+(1-Math.max(0,Math.min(100,Number(p)))/100)*innerH;

    let grid='';
    [0,25,50,75,100].forEach(p=>{
      const yy=y(p);
      grid+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" class="nl4-history-grid"/>`;
      grid+=`<text x="${L-8}" y="${yy+3}" text-anchor="end" class="nl4-history-axis-text">${p}%</text>`;
    });

    const points=rows.map(r=>`${x(r.completed_matches)},${y(r.title_probability)}`).join(' ');
    const first=rows[0],last=rows[rows.length-1];
    const area=`${x(first.completed_matches)},${H-B} ${points} ${x(last.completed_matches)},${H-B}`;
    const dots=rows.map((r,i)=>{
      const xx=x(r.completed_matches),yy=y(r.title_probability);
      const label=(i===rows.length-1||rows.length<=8)
        ? `<text x="${xx}" y="${Math.max(12,yy-9)}" text-anchor="middle" class="nl4-history-label">${Number(r.title_probability).toFixed(1)}%</text>`:'';
      return `<circle cx="${xx}" cy="${yy}" r="5" class="nl4-history-dot"/>${label}`;
    }).join('');

    svg.innerHTML=`${grid}<polygon points="${area}" class="nl4-history-area"/><polyline points="${points}" class="nl4-history-line"/>${dots}
      <text x="${L}" y="${H-8}" class="nl4-history-axis-text">0 matches</text>
      <text x="${W-R}" y="${H-8}" text-anchor="end" class="nl4-history-axis-text">${maxMatches} matches</text>`;

    const change=Number(last.title_probability)-Number(first.title_probability);
    setText('titleHistoryLatest',`${Number(last.title_probability).toFixed(1)}% AFTER ${last.completed_matches} MATCHES`);
    setText('titleHistoryChange',`Season change: ${change>=0?'+':''}${change.toFixed(1)} pts`);

    const recent=rows.slice(-Math.min(4,rows.length));
    const recentChange=recent.length>1
      ? Number(recent[recent.length-1].title_probability)-Number(recent[0].title_probability)
      : 0;
    const trend=recentChange>1?'RISING':recentChange<-1?'FALLING':'STEADY';

    setText('arsenalMomentumChange',`${change>=0?'+':''}${change.toFixed(1)} pts`);
    setText('arsenalMomentumCurrent',`${Number(last.title_probability).toFixed(1)}%`);
    setText('arsenalMomentumTrend',trend);
    setText('raceMomentumStatus',`${trend} • ${last.completed_matches} MATCHES COMPLETE`);

    const trendEl=document.getElementById('arsenalMomentumTrend');
    if(trendEl){
      trendEl.classList.remove('rising','falling','steady');
      trendEl.classList.add(trend.toLowerCase());
    }
  }


  function renderV12MatchdayTracker(rows,results,history,completedCount){
    const arsenal=rows.find(t=>t.club==='Arsenal');
    if(!arsenal)return;

    const ordered=(history||[]).slice().sort((a,b)=>{
      const cm=Number(a.completed_matches)-Number(b.completed_matches);
      if(cm!==0)return cm;
      return new Date(a.created_at||0)-new Date(b.created_at||0);
    });

    // Keep the latest snapshot for each completed-match count.
    const byCount=new Map();
    ordered.forEach(row=>byCount.set(Number(row.completed_matches),row));
    const snapshots=[...byCount.values()].sort((a,b)=>Number(a.completed_matches)-Number(b.completed_matches));

    let previous=null;
    for(const row of snapshots){
      if(Number(row.completed_matches)<completedCount)previous=row;
    }

    const current=Number(arsenal.titleProb||0);
    const previousProb=previous?Number(previous.title_probability):null;
    const change=previousProb===null?null:current-previousProb;
    const addedMatches=previous?Math.max(0,completedCount-Number(previous.completed_matches||0)):completedCount;

    setText('v12BeforeProbability',previousProb===null?'—':`${previousProb.toFixed(1)}%`);
    setText('v12AfterProbability',`${current.toFixed(1)}%`);
    setText('v12CompletedDelta',previous?`+${addedMatches} league result${addedMatches===1?'':'s'}`:(completedCount===0?'Preseason baseline':`${completedCount} completed matches`));

    const changeEl=document.getElementById('v12MatchdayChange');
    if(changeEl){
      changeEl.classList.remove('rising','falling','steady');
      if(change===null){
        changeEl.textContent=completedCount===0?'BASELINE':'FIRST LIVE READING';
        changeEl.classList.add('steady');
      }else if(Math.abs(change)<0.05){
        changeEl.textContent='±0.0 pts';
        changeEl.classList.add('steady');
      }else{
        changeEl.textContent=`${change>0?'↑ +':'↓ '}${change.toFixed(1)} pts`;
        changeEl.classList.add(change>0?'rising':'falling');
      }
    }

    const played=Number(arsenal.played||0);
    const priorWeight=preseasonWeight(played);
    const currentEvidence=1-priorWeight;
    const priorPct=Math.max(0,Math.min(100,priorWeight*100));
    const evidencePct=Math.max(0,Math.min(100,currentEvidence*100));

    setText('v12PriorWeight',`${priorPct.toFixed(0)}%`);
    setText('v12SeasonEvidence',`${evidencePct.toFixed(0)}%`);
    const priorBar=document.getElementById('v12PriorBar');
    const evidenceBar=document.getElementById('v12EvidenceBar');
    if(priorBar)priorBar.style.width=`${priorPct}%`;
    if(evidenceBar)evidenceBar.style.width=`${evidencePct}%`;

    const summary=document.getElementById('v12MatchdaySummary');
    if(summary){
      if(completedCount===0){
        summary.textContent=`The live tracker is armed at ${current.toFixed(1)}%. Once the first 2026/27 league results are recorded, V12.9 will compare the new forecast with this preseason baseline.`;
      }else if(previousProb===null){
        summary.textContent=`Arsenal are currently ${current.toFixed(1)}% to win the league. No earlier saved snapshot is available yet, so an exact before/after change cannot be shown.`;
      }else{
        const direction=change>0.05?'increased':change<-0.05?'decreased':'was effectively unchanged';
        summary.textContent=`Since the previous saved forecast, Arsenal's title probability ${direction}${Math.abs(change)>=0.05?` by ${Math.abs(change).toFixed(1)} points`:''}, moving from ${previousProb.toFixed(1)}% to ${current.toFixed(1)}%.`;
      }
    }

    const resultsEl=document.getElementById('v12ResultImpactList');
    if(resultsEl){
      const orderedResults=(results||[]).slice().sort((a,b)=>resultTime(a)-resultTime(b));
      const take=previous?Math.max(1,Math.min(20,addedMatches)):Math.min(10,orderedResults.length);
      const latest=take?orderedResults.slice(-take):[];
      const credible=rows.filter(t=>t.club!=='Arsenal'&&isCredibleTitleThreat(t,completedCount))
        .sort((a,b)=>b.titleProb-a.titleProb)
        .slice(0,4).map(t=>t.club);

      const relevant=[...latest].reverse().filter(r=>
        r.home==='Arsenal'||r.away==='Arsenal'||credible.includes(r.home)||credible.includes(r.away)
      );

      if(!relevant.length){
        resultsEl.innerHTML='<div class="nl4-title-model-loading">No new Arsenal or leading-rival results to explain yet.</div>';
      }else{
        const seen=new Set();
        const cards=[];
        for(const r of relevant){
          let club='Arsenal';
          if(!(r.home==='Arsenal'||r.away==='Arsenal')){
            club=credible.find(c=>r.home===c||r.away===c);
          }
          if(!club)continue;
          const key=`${club}|${fixtureId(r)}`;
          if(seen.has(key))continue;
          seen.add(key);

          const info=v11ResultLabel(r,club);
          let effect='RIVAL PRESSURE';
          let signal='neutral';
          let explanation='A leading rival result changes the competitive path in the remaining season simulations.';
          if(club==='Arsenal'){
            effect=info.signal==='positive'?'ARSENAL BOOST':info.signal==='negative'?'ARSENAL SETBACK':'ARSENAL DRAW';
            signal=info.signal;
            explanation='Arsenal’s own result directly changes league points, Elo, recent form and the remaining fixture path.';
          }else if(info.signal!=='positive'){
            effect='RIVAL DROPPED POINTS';
            signal='positive';
            explanation='A leading rival dropped points, generally improving Arsenal’s route to first place.';
          }

          cards.push(`<article class="v12-impact-card ${signal}">
            <div>
              <span>${esc(effect)}</span>
              <strong>${esc(club)} ${esc(info.outcome)} ${esc(info.opponent)}</strong>
              <small>${esc(info.score)}</small>
            </div>
            <p>${esc(explanation)}</p>
          </article>`);
          if(cards.length>=5)break;
        }
        resultsEl.innerHTML=cards.length?cards.join(''):'<div class="nl4-title-model-loading">No relevant result drivers found for this update.</div>';
      }
    }
  }


  function v123LatestPerCompletedCount(history){
    const ordered=(history||[]).slice().sort((a,b)=>{
      const cm=Number(a.completed_matches)-Number(b.completed_matches);
      if(cm!==0)return cm;
      return new Date(a.created_at||0)-new Date(b.created_at||0);
    });
    const byCount=new Map();
    ordered.forEach(row=>byCount.set(Number(row.completed_matches),row));
    return [...byCount.values()].sort((a,b)=>Number(a.completed_matches)-Number(b.completed_matches));
  }

  function renderV123Timeline(history,results,modelRows){
    const list=document.getElementById('v123TimelineList');
    const detail=document.getElementById('v123TimelineDetail');
    const status=document.getElementById('v123TimelineStatus');
    if(!list||!detail)return;

    const snapshots=v123LatestPerCompletedCount(history);
    if(!snapshots.length){
      list.innerHTML='<div class="nl4-title-model-loading">The timeline begins when the first NL4 forecast snapshot is saved.</div>';
      detail.innerHTML='<div class="nl4-title-model-loading">No saved forecast selected.</div>';
      if(status)status.textContent='WAITING FOR SNAPSHOTS';
      return;
    }

    const orderedResults=(results||[]).slice().sort((a,b)=>resultTime(a)-resultTime(b));
    const currentRivals=(modelRows||[]).filter(t=>t.club!=='Arsenal')
      .sort((a,b)=>b.titleProb-a.titleProb)
      .slice(0,4).map(t=>t.club);

    function snapshotDrivers(index){
      const snap=snapshots[index];
      const prev=index>0?snapshots[index-1]:null;
      const from=prev?Number(prev.completed_matches||0):0;
      const to=Number(snap.completed_matches||0);
      if(to<=from)return [];

      const newResults=orderedResults.slice(from,to);
      const relevant=[...newResults].reverse().filter(r=>
        r.home==='Arsenal'||r.away==='Arsenal'||currentRivals.includes(r.home)||currentRivals.includes(r.away)
      );

      const out=[];
      const seen=new Set();
      for(const r of relevant){
        let club=(r.home==='Arsenal'||r.away==='Arsenal')?'Arsenal':
          currentRivals.find(c=>r.home===c||r.away===c);
        if(!club)continue;
        const key=`${club}|${fixtureId(r)}`;
        if(seen.has(key))continue;
        seen.add(key);
        const info=v11ResultLabel(r,club);
        out.push({
          club,
          text:`${club} ${info.outcome} ${info.opponent} ${info.score}`,
          signal:club==='Arsenal'?info.signal:(info.signal==='positive'?'negative':'positive')
        });
        if(out.length>=4)break;
      }
      return out;
    }

    function snapshotChange(index){
      if(index===0)return null;
      return Number(snapshots[index].title_probability)-Number(snapshots[index-1].title_probability);
    }

    function selectSnapshot(index){
      const snap=snapshots[index];
      if(!snap)return;
      const change=snapshotChange(index);
      const drivers=snapshotDrivers(index);
      const created=snap.created_at?new Date(snap.created_at):null;
      const when=created&&!Number.isNaN(created.getTime())
        ? created.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
        : 'Saved forecast';

      detail.innerHTML=`
        <div class="v123-detail-head">
          <div>
            <span>${Number(snap.completed_matches)===0?'PRESEASON BASELINE':`${Number(snap.completed_matches)} LEAGUE MATCHES COMPLETE`}</span>
            <strong>${Number(snap.title_probability).toFixed(1)}%</strong>
            <small>Arsenal title probability • ${esc(when)}</small>
          </div>
          <b class="${change===null?'steady':change>0.05?'rising':change<-0.05?'falling':'steady'}">
            ${change===null?'BASELINE':`${change>=0?'↑ +':'↓ '}${change.toFixed(1)} pts`}
          </b>
        </div>
        <div class="v123-detail-grid">
          <div><span>TOP 4</span><strong>${snap.top4_probability==null?'—':Number(snap.top4_probability).toFixed(1)+'%'}</strong></div>
          <div><span>TOP 5</span><strong>${snap.top5_probability==null?'—':Number(snap.top5_probability).toFixed(1)+'%'}</strong></div>
          <div><span>EXPECTED PTS</span><strong>${snap.expected_points==null?'—':Number(snap.expected_points).toFixed(1)}</strong></div>
          <div><span>EXPECTED FINISH</span><strong>${snap.expected_position==null?'—':Number(snap.expected_position).toFixed(1)}</strong></div>
          <div><span>CONFIDENCE</span><strong>${snap.confidence_score==null?'—':Number(snap.confidence_score)+'/100'}</strong></div>
        </div>
        <div class="v123-detail-drivers">
          <span>RESULTS ENTERING THIS UPDATE</span>
          ${drivers.length?drivers.map(d=>`<div class="${d.signal}"><b>${d.signal==='positive'?'↑':d.signal==='negative'?'↓':'•'}</b><strong>${esc(d.text)}</strong></div>`).join(''):
            '<p>No new Arsenal or current leading-rival result can be associated with this saved snapshot.</p>'}
        </div>`;

      list.querySelectorAll('.v123-timeline-item').forEach((el,i)=>el.classList.toggle('active',i===index));
      document.querySelectorAll('#titleHistoryChart .v123-history-point').forEach((el,i)=>el.classList.toggle('active',i===index));
    }

    list.innerHTML=snapshots.map((snap,index)=>{
      const change=snapshotChange(index);
      const label=Number(snap.completed_matches)===0?'PRESEASON':`${Number(snap.completed_matches)} MATCHES`;
      return `<button type="button" class="v123-timeline-item ${index===snapshots.length-1?'active':''}" data-index="${index}">
        <span>${label}</span>
        <strong>${Number(snap.title_probability).toFixed(1)}%</strong>
        <b class="${change===null?'steady':change>0.05?'rising':change<-0.05?'falling':'steady'}">
          ${change===null?'BASE':`${change>=0?'+':''}${change.toFixed(1)}`}
        </b>
      </button>`;
    }).join('');

    list.querySelectorAll('.v123-timeline-item').forEach(btn=>{
      btn.addEventListener('click',()=>selectSnapshot(Number(btn.dataset.index)));
    });

    // Make existing probability-chart dots clickable and align them with de-duplicated snapshots.
    const svg=document.getElementById('titleHistoryChart');
    if(svg){
      const points=svg.querySelectorAll('.nl4-history-dot');
      points.forEach((dot,index)=>{
        dot.classList.add('v123-history-point');
        dot.setAttribute('tabindex','0');
        dot.setAttribute('role','button');
        dot.style.cursor='pointer';
        dot.addEventListener('click',()=>selectSnapshot(Math.min(index,snapshots.length-1)));
        dot.addEventListener('keydown',e=>{
          if(e.key==='Enter'||e.key===' '){e.preventDefault();selectSnapshot(Math.min(index,snapshots.length-1));}
        });
      });
    }

    if(status){
      const latest=snapshots[snapshots.length-1];
      status.textContent=`${snapshots.length} SAVED UPDATE${snapshots.length===1?'':'S'} • LATEST ${Number(latest.title_probability).toFixed(1)}%`;
    }
    selectSnapshot(snapshots.length-1);
  }

  async function loadTitleHistory(){
    try{
      const res=await db.from('title_probability_history')
        .select('completed_matches,title_probability,top4_probability,top5_probability,expected_points,expected_position,confidence_score,created_at')
        .eq('season',SEASON)
        .order('completed_matches',{ascending:true});
      if(res.error)throw res.error;
      const history=res.data||[];
      renderTitleHistory(history);
      return history;
    }catch(err){
      console.warn('NL4 probability history:',err);
      const note=document.getElementById('titleHistoryNote');
      if(note)note.textContent='Probability history could not be loaded.';
      return [];
    }
  }

  async function saveAdminSnapshot(arsenal,completedCount){
    if(!arsenal||completedCount<0)return;
    try{
      const auth=await db.auth?.getUser?.();
      if(!auth?.data?.user)return;
      const confidence=confidenceFromResults(completedCount);
      const rpc=await db.rpc('save_title_probability_snapshot',{
        p_season:SEASON,
        p_completed_matches:completedCount,
        p_title_probability:Number(arsenal.titleProb.toFixed(4)),
        p_top4_probability:Number(arsenal.top4Prob.toFixed(4)),
        p_top5_probability:Number(arsenal.top5Prob.toFixed(4)),
        p_expected_points:Number(arsenal.expectedPoints.toFixed(4)),
        p_expected_position:Number(arsenal.expectedPosition.toFixed(4)),
        p_confidence_score:confidence.score,
        p_model_version:'V12.9'
      });
      if(rpc.error)throw rpc.error;
    }catch(err){
      // Public viewers are intentionally unable to save snapshots.
      console.debug('NL4 snapshot not saved for this session.');
    }
  }

  async function load(){
    if(!db||typeof db.from!=='function'){
      tableEl.innerHTML='<div class="nl4-title-model-loading">Supabase is unavailable.</div>';
      return;
    }

    try{
      const [standingsRes,arsenalRes,leagueRes,previousStandingsRes,secondPreviousStandingsRes]=await Promise.all([
        db.from('premier_league_standings')
          .select('position,club,played,wins,draws,losses,goals_for,goals_against,goal_difference,points')
          .eq('season',SEASON).order('position',{ascending:true}),
        db.from('fixtures')
          .select('home_team,away_team,is_home,opponent,arsenal_score,opponent_score,status,kickoff_at,matchday,competition,season,updated_at')
          .eq('season',SEASON).eq('competition','Premier League'),
        db.from('premier_league_matches')
          .select('home_team,away_team,home_score,away_score,status,kickoff_at,matchday,season,updated_at')
          .eq('season',SEASON),
        db.from('premier_league_standings')
          .select('position,club,played,wins,draws,losses,goals_for,goals_against,goal_difference,points')
          .eq('season',PREVIOUS_SEASON).order('position',{ascending:true}),
        db.from('premier_league_standings')
          .select('position,club,played,wins,draws,losses,goals_for,goals_against,goal_difference,points')
          .eq('season',SECOND_PREVIOUS_SEASON).order('position',{ascending:true})
      ]);

      if(standingsRes.error)throw standingsRes.error;
      if(arsenalRes.error)throw arsenalRes.error;
      if(leagueRes.error)throw leagueRes.error;
      if(previousStandingsRes.error){
        console.warn('NL4 V12.9 previous-season standings unavailable:',previousStandingsRes.error);
        buildPreviousSeasonProfiles([],[],standingsRes.data||[]);
      }else{
        if(secondPreviousStandingsRes.error){
          console.warn('NL4 V12.9 second previous-season standings unavailable:',secondPreviousStandingsRes.error);
        }
        buildPreviousSeasonProfiles(
          previousStandingsRes.data||[],
          secondPreviousStandingsRes.error?[]:(secondPreviousStandingsRes.data||[]),
          standingsRes.data||[]
        );
      }
      if(!standingsRes.data||standingsRes.data.length!==20)
        throw new Error(`The model needs all 20 clubs. Found ${standingsRes.data?.length||0}.`);

      const fixtures=mergeFixtures(arsenalRes.data||[],leagueRes.data||[]);
      updateCoverage(fixtures);

      const results=completedResults(fixtures);
      const currentTeams=normalizeStandings(standingsRes.data);
      const ratings=buildRatings(currentTeams,results);

      await new Promise(r=>setTimeout(r,25));
      const simulation=simulate(ratings,fixtures);
      render(
        simulation.rows,
        fixtures.length,
        results.length,
        simulation.scenario,
        simulation.impact,
        simulation.championPointStats,
        simulation.pointThresholds,
        simulation.validationStats
      );
      const arsenal=simulation.rows.find(t=>t.club.toLowerCase()==='arsenal');
      let history=await loadTitleHistory();

      // Save the current state for admins, including the 0-match preseason baseline.
      // Reload history afterward so the tracker and chart both see the saved snapshot.
      await saveAdminSnapshot(arsenal,results.length);
      history=await loadTitleHistory();

      renderV123Timeline(history,results,simulation.rows);
      renderV12MatchdayTracker(simulation.rows,results,history,results.length);
      renderV11Explainer(simulation.rows,results,history,results.length);

      const counterfactuals=buildCounterfactualImpacts(
        currentTeams,
        fixtures,
        simulation.rows,
        results.length
      );
      renderV122Counterfactuals(
        counterfactuals,
        simulation.rows.find(t=>t.club==='Arsenal')?.titleProb||0
      );
    }catch(error){
      console.error('NL4 title model V12.9:',error);
      tableEl.innerHTML=`<div class="nl4-title-model-loading">Could not calculate title probability: ${esc(error.message)}</div>`;
      if(statusEl)statusEl.textContent='Title model could not run.';
    }
  }

  load();
})();