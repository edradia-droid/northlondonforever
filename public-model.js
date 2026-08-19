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

  // V12.9 frozen preseason strength calibration. V13.0 only changes the live evidence transition.
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
  function evidenceWeights(played){
    const p=Math.max(0,Math.min(38,Number(played)||0));
    let historical;
    if(p<=0) historical=1;
    else if(p<=10) historical=1-(p/10)*0.40;          // MD10: 60% history
    else if(p<=20) historical=0.60-((p-10)/10)*0.35;  // MD20: 25% history
    else if(p<=25) historical=0.25-((p-20)/5)*0.10;   // MD25: 15% history
    else if(p<=30) historical=0.15-((p-25)/5)*0.10;   // MD30: 5% history
    else historical=Math.max(0,0.05-((p-30)/4)*0.05); // MD34+: live season
    historical=Math.max(0,Math.min(1,historical));
    return {historical,current:1-historical};
  }

  function preseasonWeight(played){
    return evidenceWeights(played).historical;
  }


  const tableEl=document.getElementById('titleProbabilityTable');
  const statusEl=document.getElementById('titleModelStatus');
  if(!tableEl) return;

  const db=window.nl4Supabase || window.supabaseClient || window.NL4_SUPABASE || window.supabaseDb || window.db;
  const TEST_MODE=new URLSearchParams(window.location.search).get('test')==='1';
  const TEST_STORAGE_KEY='nl4_v13_test_dataset';
  const TEST_HISTORY_KEY='nl4_v132_test_history';
  const V129_ENV_BASELINE={
    championAverage:82.9,
    championMedian:83,
    arsenalExpectedPoints:78.7,
    arsenalTitleProbability:49.0,
    arsenalMedianPoints:79,
    avgGoalsPerMatch:2.84
  };

  const V129_FROZEN_BASELINE={
    season:SEASON,
    completed_matches:0,
    title_probability:49.0,
    top4_probability:93.8,
    top5_probability:96.9,
    expected_points:78.7,
    expected_position:2.0,
    confidence_score:18,
    model_version:'V12.9 FROZEN PRESEASON',
    created_at:'2026-08-16T00:00:00.000Z',
    sandbox:true,
    label:'PRE-SEASON'
  };

  function loadSandboxHistory(){
    if(!TEST_MODE)return [];
    let rows=[];
    try{
      const parsed=JSON.parse(localStorage.getItem(TEST_HISTORY_KEY)||'[]');
      if(Array.isArray(parsed))rows=parsed;
    }catch(_){rows=[];}
    const byCount=new Map();
    [V129_FROZEN_BASELINE,...rows].forEach(row=>{
      if(!row||row.season!==SEASON)return;
      byCount.set(Number(row.completed_matches)||0,row);
    });
    return [...byCount.values()].sort((a,b)=>Number(a.completed_matches)-Number(b.completed_matches));
  }

  function saveSandboxSnapshot(arsenal,completedCount,dataset){
    if(!TEST_MODE||!arsenal)return loadSandboxHistory();
    const confidence=confidenceFromResults(completedCount);
    const snapshot={
      season:SEASON,
      completed_matches:Number(completedCount)||0,
      title_probability:Number(arsenal.titleProb.toFixed(4)),
      top4_probability:Number(arsenal.top4Prob.toFixed(4)),
      top5_probability:Number(arsenal.top5Prob.toFixed(4)),
      expected_points:Number(arsenal.expectedPoints.toFixed(4)),
      expected_position:Number(arsenal.expectedPosition.toFixed(4)),
      confidence_score:confidence.score,
      model_version:'V13.2 SANDBOX',
      created_at:new Date().toISOString(),
      sandbox:true,
      test_id:dataset?.testId||null,
      matchday:Number(dataset?.throughMatchday)||Math.round((Number(completedCount)||0)/10),
      label:`TEST MD ${Number(dataset?.throughMatchday)||Math.round((Number(completedCount)||0)/10)}`
    };
    const history=loadSandboxHistory().filter(row=>Number(row.completed_matches)!==Number(completedCount));
    history.push(snapshot);
    history.sort((a,b)=>Number(a.completed_matches)-Number(b.completed_matches));
    try{localStorage.setItem(TEST_HISTORY_KEY,JSON.stringify(history.filter(x=>Number(x.completed_matches)>0)));}catch(_){}
    return [V129_FROZEN_BASELINE,...history.filter(x=>Number(x.completed_matches)>0)]
      .sort((a,b)=>Number(a.completed_matches)-Number(b.completed_matches));
  }

  function clearSandboxHistoryAfter(completedCount){
    if(!TEST_MODE)return;
    const keep=loadSandboxHistory().filter(row=>Number(row.completed_matches)>0&&Number(row.completed_matches)<=Number(completedCount));
    try{localStorage.setItem(TEST_HISTORY_KEY,JSON.stringify(keep));}catch(_){}
  }

  function readTestDataset(){
    if(!TEST_MODE)return null;
    try{
      const parsed=JSON.parse(localStorage.getItem(TEST_STORAGE_KEY)||'null');
      return parsed&&parsed.season===SEASON&&Array.isArray(parsed.results)?parsed:null;
    }catch(_){return null;}
  }

  function testStandingsFromResults(clubs,results){
    const table=new Map(clubs.map(club=>[club,{club,played:0,wins:0,draws:0,losses:0,goals_for:0,goals_against:0,goal_difference:0,points:0}]));
    for(const r of results){
      const h=table.get(r.home),a=table.get(r.away);
      const hs=Number(r.home_score),as=Number(r.away_score);
      if(!h||!a||!Number.isFinite(hs)||!Number.isFinite(as))continue;
      h.played++;a.played++;h.goals_for+=hs;h.goals_against+=as;a.goals_for+=as;a.goals_against+=hs;
      if(hs>as){h.wins++;a.losses++;h.points+=3;}
      else if(hs<as){a.wins++;h.losses++;a.points+=3;}
      else{h.draws++;a.draws++;h.points++;a.points++;}
    }
    const rows=[...table.values()];
    rows.forEach(r=>r.goal_difference=r.goals_for-r.goals_against);
    rows.sort((a,b)=>b.points-a.points||b.goal_difference-a.goal_difference||b.goals_for-a.goals_for||a.club.localeCompare(b.club));
    rows.forEach((r,i)=>r.position=i+1);
    return rows;
  }

  function applyTestDataset(fixtures,dataset){
    const testMap=new Map((dataset?.results||[]).map(r=>[pairKey(r.home_team,r.away_team),r]));
    return fixtures.map(f=>{
      const t=testMap.get(pairKey(f.home,f.away));
      if(t){
        return {...f,status:'fulltime',home_score:Number(t.home_score),away_score:Number(t.away_score),matchday:Number(t.matchday)||f.matchday};
      }
      return {...f,status:'scheduled',home_score:null,away_score:null};
    });
  }

  function showTestModeBanner(dataset){
    if(!TEST_MODE)return;
    let banner=document.getElementById('nl4TestModeBanner');
    if(!banner){
      banner=document.createElement('div');
      banner.id='nl4TestModeBanner';
      banner.style.cssText='position:sticky;top:0;z-index:100000;background:#d8ad45;color:#111;padding:10px 14px;text-align:center;font:900 12px/1.35 Arial,sans-serif;letter-spacing:.4px;box-shadow:0 4px 18px rgba(0,0,0,.3)';
      document.body.prepend(banner);
    }
    banner.textContent=dataset
      ? `🧪 NL4 V13.2 TEST MODE • SAME RANDOM SEASON THROUGH MATCHDAY ${dataset.throughMatchday} • SANDBOX SNAPSHOTS LOCAL ONLY`
      : '🧪 NL4 MODEL TEST MODE • NO TEST DATASET FOUND';
  }


  function ensureV133InfluencePanel(){
    if(document.getElementById('v133InfluenceAudit'))return;

    if(!document.getElementById('v133-selfinject-styles')){
      const style=document.createElement('style');
      style.id='v133-selfinject-styles';
      style.textContent=`
      .v133-influence-audit{margin-top:13px;border:1px solid rgba(214,0,31,.24);border-radius:18px;background:linear-gradient(145deg,#12090b,#090909);padding:16px}
      .v133-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.v133-head h3{margin:5px 0 4px;color:#fff;font-size:18px}.v133-head p{margin:0;color:#777;font-size:8px;line-height:1.55;max-width:720px}.v133-head>b{font-size:7px;color:#fff;background:#d6001c;padding:7px 9px;border-radius:999px;white-space:nowrap}
      .v133-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.v133-summary article{border:1px solid rgba(255,255,255,.07);background:#0d0d0d;border-radius:12px;padding:11px}.v133-summary span{display:block;color:#666;font-size:6px;font-weight:1000;letter-spacing:.7px}.v133-summary strong{display:block;color:#fff;font-size:17px;margin:5px 0}.v133-summary small{color:#666;font-size:6.5px;line-height:1.4}
      .v133-table{margin-top:11px;border:1px solid rgba(255,255,255,.06);border-radius:12px;overflow:hidden}.v133-row{display:grid;grid-template-columns:1.25fr .8fr .8fr 1.1fr 1fr;gap:7px;align-items:center;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.05);font-size:7px}.v133-row:last-child{border-bottom:0}.v133-row strong{color:#fff}.v133-row span{color:#777}.v133-row b{color:#d8ad45;text-align:right}.v133-headrow{background:#111}.v133-headrow strong,.v133-headrow span,.v133-headrow b{color:#888;font-size:6px;letter-spacing:.6px}
      .v133-note{margin:10px 0 0;color:#666;font-size:7px;line-height:1.5}
      @media(max-width:760px){.v133-summary{grid-template-columns:1fr}.v133-head{display:block}.v133-head>b{display:inline-block;margin-top:8px}.v133-row{grid-template-columns:1.2fr .8fr .8fr}.v133-row span:nth-of-type(3){display:none}.v133-row b{text-align:left}.v133-headrow span:nth-of-type(3){display:none}}`;
      document.head.appendChild(style);
    }

    const panel=document.createElement('section');
    panel.className='v133-influence-audit';
    panel.id='v133InfluencePanel';
    panel.innerHTML=`
      <div class="v133-head">
        <div>
          <span class="nl4-model-label">V13.3 • EARLY-SEASON INFLUENCE AUDIT</span>
          <h3>How Much Is One Result Really Entering the Model?</h3>
          <p>The nominal evidence gate can be small while several live channels still add up. This panel shows each pathway separately.</p>
        </div>
        <b>DIAGNOSTIC ONLY</b>
      </div>
      <div class="v133-summary">
        <article><span>NOMINAL LIVE GATE</span><strong id="v133NominalLiveGate">—</strong><small>V13 transition schedule</small></article>
        <article><span>EFFECTIVE LIVE INFLUENCE</span><strong id="v133EffectiveLiveInfluence">—</strong><small>Sum of absolute live factor contributions</small></article>
        <article><span>INFLUENCE / GATE</span><strong id="v133InfluenceRatio">—</strong><small>Warning signal, not a probability percentage</small></article>
      </div>
      <div class="v133-table">
        <div class="v133-row v133-headrow"><strong>INPUT</strong><span>RAW VALUE</span><span>SAMPLE</span><span>WEIGHT</span><b>STRENGTH CONTRIBUTION</b></div>
        <div id="v133InfluenceAudit"><div class="nl4-title-model-loading">Preparing influence audit…</div></div>
      </div>
      <p class="v133-note">“Effective Live Influence” is a diagnostic index, not a title probability. It reveals when several channels are counting the same early result at once.</p>`;

    const confidence=document.querySelector('.nl4-model-confidence');
    const evidence=document.querySelector('.v13-evidence-engine');
    if(confidence?.parentNode){
      confidence.parentNode.insertBefore(panel,confidence);
    }else if(evidence?.parentNode){
      evidence.parentNode.insertBefore(panel,evidence.nextSibling);
    }else{
      const forecast=document.getElementById('titleProbability')||document.querySelector('.nl4-title-forecast-shell')||document.body;
      forecast.appendChild(panel);
    }
  }

  ensureV133InfluencePanel();

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



  function v1501Num(value,digits=1,fallback='N/A'){
    const n=Number(value);
    return Number.isFinite(n)?n.toFixed(digits):fallback;
  }

  function v1501Pct(value,digits=1,fallback='N/A'){
    const n=Number(value);
    return Number.isFinite(n)?`${n.toFixed(digits)}%`:fallback;
  }

  function isSeasonComplete(fixtures){
    const playable=(fixtures||[]).filter(f=>!ignored(f.status));
    return playable.length>0 && playable.every(f=>finished(f.status));
  }

  function finalSeasonSummary(rows){
    const sorted=[...(rows||[])].sort((a,b)=>
      Number(a.position||99)-Number(b.position||99)
    );
    const arsenal=sorted.find(r=>String(r.club||'').toLowerCase()==='arsenal');
    const champion=sorted[0]||null;
    return {arsenal,champion,rows:sorted};
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

    // V13.7 scoring-baseline stabilization:
    // Never replace the calibrated 1.42 preseason base with a tiny raw sample.
    // The observed league scoring rate earns influence gradually using the
    // same season-transition philosophy as the club evidence engine.
    const PRESEASON_GOALS_PER_TEAM=1.42;
    const observedLeagueGoalAvg=totalPlayed?totalGF/totalPlayed:PRESEASON_GOALS_PER_TEAM;
    const averageClubPlayed=teams.length?totalPlayed/teams.length:0;
    const leagueScoringEvidence=evidenceWeights(averageClubPlayed);
    const leagueGoalAvg=
      PRESEASON_GOALS_PER_TEAM*leagueScoringEvidence.historical +
      observedLeagueGoalAvg*leagueScoringEvidence.current;

    const avgPpg=teams.reduce((s,t)=>s+t.ppg,0)/teams.length||1.35;
    const avgPosition=(teams.length+1)/2;

    return teams.map(t=>{
      const evidence=evidenceWeights(t.played);
      const historicalWeight=evidence.historical;
      const currentWeight=evidence.current;

      // Current-season attack/defence only earn influence as the live sample grows.
      const rawSample=t.played/(t.played+10);
      const liveSample=rawSample*currentWeight;
      const attackRaw=t.played?t.gfpg/leagueGoalAvg:1;
      const defenceRaw=t.played?t.gapg/leagueGoalAvg:1; // lower is better
      const attack=1+(attackRaw-1)*liveSample;
      const defence=1+(defenceRaw-1)*liveSample;

      // Actual points-per-game and table position are live evidence, not priors.
      const ppgGap=(t.ppg-avgPpg)/1.35;
      const ppgPower=1+ppgGap*Math.min(.14,currentWeight*.14);

      // Position is deliberately a small, capped signal because PPG already
      // contains most of the same information. It becomes meaningful later.
      const positionSignal=t.played
        ? Math.max(-1,Math.min(1,(avgPosition-t.position)/avgPosition))
        : 0;
      const tablePositionFactor=1+positionSignal*(.045*currentWeight);

      const profile=preseasonProfile(t.club);
      const priorWeight=historicalWeight;
      const historicalPointsAnchor=Number(profile.historicalPointsAnchor||50);
      const historicalPpg=historicalPointsAnchor/38;

      // Historical strength fades with the historical side of the V13 evidence gate.
      const historicalPointsFactor=Math.exp(((historicalPpg-(50/38))*.18)*historicalWeight);

      // Elo learns opponent strength from actual results, but the amount by which
      // preseason Elo survives is controlled by the same evidence transition.
      // V13.4 Elo prior/live separation:
      // Historical Elo and current-season Elo are separate evidence channels.
      // The historical side is the preseason club strength above league-average Elo.
      // The live side is the Elo movement learned from 2026/27 results starting from neutral.
      // This prevents the entire preseason Elo advantage from being misclassified as live evidence.
      const preseasonElo=Number(profile.elo||ELO_BASE);
      const neutralElo=Number(eloState.neutralRatings.get(t.club)??ELO_BASE);
      const priorTrackedElo=Number(eloState.priorRatings.get(t.club)??preseasonElo);

      const historicalEloEdge=preseasonElo-ELO_BASE;
      const liveNeutralEloDelta=neutralElo-ELO_BASE;
      const livePriorEloDelta=priorTrackedElo-preseasonElo;

      const historicalEloComponent=historicalEloEdge*historicalWeight;
      const liveEloComponent=liveNeutralEloDelta*currentWeight;
      const eloRating=ELO_BASE+historicalEloComponent+liveEloComponent;
      const eloFactor=Math.pow(10,(eloRating-ELO_BASE)/550);

      // Diagnostic live Elo factor: ONLY the gated 2026/27 component.
      const liveEloFactor=Math.pow(10,liveEloComponent/550);
      const historicalEloFactor=Math.pow(10,historicalEloComponent/550);

      const form=recent.get(t.club)||{factor:1,label:'PRE-SEASON'};
      const gatedFormFactor=1+((form.factor||1)-1)*currentWeight;

      const split=splits.get(t.club)||{homeGF:0,homeGA:0,homeP:0,awayGF:0,awayGA:0,awayP:0};
      const homeSample=Math.min(1,split.homeP/6)*currentWeight;
      const awaySample=Math.min(1,split.awayP/6)*currentWeight;

      const homeAttackAdj=split.homeP ? 1+(((split.homeGF/split.homeP)/leagueGoalAvg)-1)*homeSample*.18 : 1;
      const homeDefAdj=split.homeP ? 1+(((split.homeGA/split.homeP)/leagueGoalAvg)-1)*homeSample*.18 : 1;
      const awayAttackAdj=split.awayP ? 1+(((split.awayGF/split.awayP)/leagueGoalAvg)-1)*awaySample*.18 : 1;
      const awayDefAdj=split.awayP ? 1+(((split.awayGA/split.awayP)/leagueGoalAvg)-1)*awaySample*.18 : 1;

      const attackContribution=attack-1;
      const defenceContribution=1-defence; // positive = stronger defence
      const ppgContribution=ppgPower-1;
      const tableContribution=tablePositionFactor-1;
      const eloContribution=liveEloFactor-1;
      const formContribution=gatedFormFactor-1;
      const homeContribution=((homeAttackAdj-1)+(1-homeDefAdj))/2;
      const awayContribution=((awayAttackAdj-1)+(1-awayDefAdj))/2;
      const liveContributionAbs=
        Math.abs(attackContribution)+Math.abs(defenceContribution)+Math.abs(ppgContribution)+
        Math.abs(tableContribution)+Math.abs(eloContribution)+Math.abs(formContribution)+
        Math.abs(homeContribution)+Math.abs(awayContribution);

      return {...t,attack,defence,ppgPower,tablePositionFactor,eloRating,eloFactor,
        preseasonElo,preseasonTier:profile.tier,promoted:profile.promoted,priorWeight,
        historicalWeight,currentSeasonWeight:currentWeight,
        v133:{
          rawSample,
          liveSample,
          attackRaw,
          defenceRaw,
          attackContribution,
          defenceContribution,
          ppgGap,
          ppgContribution,
          positionSignal,
          tableContribution,
          eloContribution,
          preseasonElo,
          neutralElo,
          priorTrackedElo,
          historicalEloEdge,
          historicalEloComponent,
          historicalEloFactor,
          liveNeutralEloDelta,
          livePriorEloDelta,
          liveEloComponent,
          liveEloFactor,
          formContribution,
          homeContribution,
          awayContribution,
          liveContributionAbs,
          homeMatches:split.homeP||0,
          awayMatches:split.awayP||0
        },
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
        formFactor:gatedFormFactor,rawFormFactor:form.factor,formLabel:form.label,
        homeAttackAdj,homeDefAdj,awayAttackAdj,awayDefAdj,leagueGoalAvg,
        observedLeagueGoalAvg,
        leagueScoringHistoricalWeight:leagueScoringEvidence.historical,
        leagueScoringCurrentWeight:leagueScoringEvidence.current,
        averageClubPlayed};
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

    // V12.9 frozen match-strength calibration (V13.0 evidence inputs feed this unchanged engine):
    // V12.9 compressed large club-strength gaps too aggressively.
    // PPG and form remain controlled, while Elo now has enough influence to
    // separate elite clubs from relegation-level clubs over a 38-game season.
    const powerRatio=Math.max(.78,Math.min(1.28,home.ppgPower/away.ppgPower));
    const formRatio=Math.max(.82,Math.min(1.20,home.formFactor/away.formFactor));
    const eloRatio=Math.max(.70,Math.min(1.45,home.eloFactor/away.eloFactor));
    const historicalRatio=Math.max(.82,Math.min(1.25,
      (home.historicalPointsFactor||1)/(away.historicalPointsFactor||1)
    ));
    const tableRatio=Math.max(.94,Math.min(1.06,
      (home.tablePositionFactor||1)/(away.tablePositionFactor||1)
    ));

    const powerEffect=Math.pow(powerRatio,.55);
    const formEffect=Math.pow(formRatio,.55);
    const eloEffect=Math.pow(eloRatio,.70);
    const historicalEffect=Math.pow(historicalRatio,.58);
    const tableEffect=Math.pow(tableRatio,.45);

    // V12.9 frozen league-points calibration:
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
      powerEffect * formEffect * eloEffect * historicalEffect * tableEffect * homeMismatch;

    let awayLambda=away.leagueGoalAvg * away.attack * home.defence *
      away.awayAttackAdj * home.homeDefAdj * HOME_ADV_DEFENCE /
      powerEffect / formEffect / eloEffect / historicalEffect / tableEffect * awayMismatch;

    homeLambda=Math.max(.18,Math.min(4.2,homeLambda));
    awayLambda=Math.max(.12,Math.min(3.8,awayLambda));

    return {homeLambda,awayLambda,homeCDF:scoreDistribution(homeLambda),awayCDF:scoreDistribution(awayLambda)};
  }


  function fixtureGoalModelWithBase(home,away,forcedLeagueGoalAvg){
    const h={...home,leagueGoalAvg:forcedLeagueGoalAvg};
    const a={...away,leagueGoalAvg:forcedLeagueGoalAvg};
    return fixtureGoalModel(h,a);
  }

  function v136GoalPipelineTrace(teams,fixtures,results){
    if(isSeasonComplete(fixtures)){
      const totalPlayed=teams.reduce((s,t)=>s+t.played,0);
      const totalGF=teams.reduce((s,t)=>s+t.gf,0);
      const observed=totalPlayed?totalGF/totalPlayed:1.42;
      return {
        terminal:true,
        frozenBase:1.42,
        observedTeamGoalAvg:observed,
        stabilizedTeamGoalAvg:observed,
        scoringHist:0,
        scoringLive:1,
        liveRemainingGoals:null,
        frozenBaseRemainingGoals:null,
        goalLossFromBase:null,
        liveDrawRate:null,
        frozenDrawRate:null,
        liveFavoriteRate:null,
        frozenFavoriteRate:null,
        fixtureCount:0
      };
    }

    const byName=new Map(teams.map(t=>[t.club,t]));
    const remaining=fixtures.filter(f=>!finished(f.status));
    const frozenBase=1.42;
    let liveGoals=0,frozenGoals=0,n=0;
    let liveDraw=0,frozenDraw=0;
    let liveFav=0,frozenFav=0;

    function probs(model,strongerHome){
      let draw=0,fav=0;
      for(let hs=0;hs<model.homeCDF.length;hs++){
        const hp=hs===0?model.homeCDF[0]:model.homeCDF[hs]-model.homeCDF[hs-1];
        for(let as=0;as<model.awayCDF.length;as++){
          const ap=as===0?model.awayCDF[0]:model.awayCDF[as]-model.awayCDF[as-1];
          if(hs===as)draw+=hp*ap;
          if((strongerHome&&hs>as)||(!strongerHome&&as>hs))fav+=hp*ap;
        }
      }
      return {draw,fav};
    }

    for(const f of remaining){
      const home=byName.get(f.home),away=byName.get(f.away);
      if(!home||!away)continue;
      const live=fixtureGoalModel(home,away);
      const frozen=fixtureGoalModelWithBase(home,away,frozenBase);
      const strongerHome=Number(home.eloRating||ELO_BASE)>=Number(away.eloRating||ELO_BASE);
      const lp=probs(live,strongerHome),fp=probs(frozen,strongerHome);
      liveGoals+=live.homeLambda+live.awayLambda;
      frozenGoals+=frozen.homeLambda+frozen.awayLambda;
      liveDraw+=lp.draw; frozenDraw+=fp.draw;
      liveFav+=lp.fav; frozenFav+=fp.fav;
      n++;
    }

    const totalPlayed=teams.reduce((s,t)=>s+t.played,0);
    const totalGF=teams.reduce((s,t)=>s+t.gf,0);
    const observedTeamGoalAvg=totalPlayed?totalGF/totalPlayed:frozenBase;
    const stabilizedTeamGoalAvg=teams[0]?.leagueGoalAvg??frozenBase;
    const scoringHist=teams[0]?.leagueScoringHistoricalWeight??1;
    const scoringLive=teams[0]?.leagueScoringCurrentWeight??0;

    return {
      frozenBase,
      observedTeamGoalAvg,
      stabilizedTeamGoalAvg,
      scoringHist,
      scoringLive,
      observedMatchGoalAvg:observedTeamGoalAvg*2,
      liveRemainingGoals:n?liveGoals/n:0,
      frozenBaseRemainingGoals:n?frozenGoals/n:0,
      liveDraw:n?liveDraw/n:0,
      frozenDraw:n?frozenDraw/n:0,
      liveFavorite:n?liveFav/n:0,
      frozenFavorite:n?frozenFav/n:0,
      goalLossFromBase:n?(liveGoals-frozenGoals)/n:0,
      sameFixtureCount:n
    };
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


  function simulationEnvironmentAudit(teams,fixtures,results){
    const complete=isSeasonComplete(fixtures);
    if(complete){
      const champ=[...(teams||[])].sort((a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf)[0]||null;
      const arsenal=(teams||[]).find(t=>t.club==='Arsenal')||null;
      return {
        terminal:true,
        status:'SEASON COMPLETE',
        championAverage:Number(champ?.points||0),
        arsenalExpectedPoints:Number(arsenal?.points||0),
        remainingGoals:null,
        drawRate:null,
        favoriteWinRate:null,
        avgEloGap:null,
        completedMatches:completedResults(fixtures).length,
        remainingMatches:0,
        note:'No remaining fixtures. Regression audit is closed because there is no simulation environment left to validate.'
      };
    }

    const byName=new Map(teams.map(t=>[t.club,t]));
    const remaining=fixtures.filter(f=>!finished(f.status));
    let totalHomeLambda=0,totalAwayLambda=0,valid=0;
    let favoriteWinProxy=0,drawProxy=0;
    let eloGapSum=0;
    let arsenalRemaining=0;
    let arsenalHomeLambda=0,arsenalAwayLambda=0;

    for(const f of remaining){
      const home=byName.get(f.home),away=byName.get(f.away);
      if(!home||!away)continue;
      const model=fixtureGoalModel(home,away);
      valid++;
      totalHomeLambda+=model.homeLambda;
      totalAwayLambda+=model.awayLambda;

      const hP0=Math.exp(-model.homeLambda),aP0=Math.exp(-model.awayLambda);
      // quick draw proxy from score distribution 0..7
      let d=0;
      for(let k=0;k<model.homeCDF.length;k++){
        const hp=k===0?model.homeCDF[0]:model.homeCDF[k]-model.homeCDF[k-1];
        const ap=k===0?model.awayCDF[0]:model.awayCDF[k]-model.awayCDF[k-1];
        d+=hp*ap;
      }
      drawProxy+=d;

      const gap=Math.abs(Number(home.eloRating||ELO_BASE)-Number(away.eloRating||ELO_BASE));
      eloGapSum+=gap;

      // Probability stronger Elo side wins, approximated from score grid.
      const strongerHome=(Number(home.eloRating||ELO_BASE)>=Number(away.eloRating||ELO_BASE));
      let fav=0;
      for(let hs=0;hs<model.homeCDF.length;hs++){
        const hp=hs===0?model.homeCDF[0]:model.homeCDF[hs]-model.homeCDF[hs-1];
        for(let as=0;as<model.awayCDF.length;as++){
          const ap=as===0?model.awayCDF[0]:model.awayCDF[as]-model.awayCDF[as-1];
          if((strongerHome&&hs>as)||(!strongerHome&&as>hs))fav+=hp*ap;
        }
      }
      favoriteWinProxy+=fav;

      if(f.home==='Arsenal'||f.away==='Arsenal'){
        arsenalRemaining++;
        if(f.home==='Arsenal')arsenalHomeLambda+=model.homeLambda;
        else arsenalAwayLambda+=model.awayLambda;
      }
    }

    const arsenal=teams.find(t=>t.club==='Arsenal');
    const leaguePlayed=teams.reduce((s,t)=>s+t.played,0);
    const leaguePoints=teams.reduce((s,t)=>s+t.points,0);
    const leagueGF=teams.reduce((s,t)=>s+t.gf,0);

    return {
      completedMatches:(results||[]).length,
      remainingMatches:remaining.length,
      avgGoalsPerRemainingMatch:valid?(totalHomeLambda+totalAwayLambda)/valid:0,
      avgHomeLambda:valid?totalHomeLambda/valid:0,
      avgAwayLambda:valid?totalAwayLambda/valid:0,
      avgDrawProbability:valid?drawProxy/valid:0,
      avgFavoriteWinProbability:valid?favoriteWinProxy/valid:0,
      avgEloGap:valid?eloGapSum/valid:0,
      leaguePlayed,
      leaguePoints,
      leagueGoals:leagueGF,
      pointsPerTeamGame:leaguePlayed?leaguePoints/leaguePlayed:0,
      goalsPerTeamGame:leaguePlayed?leagueGF/leaguePlayed:0,
      arsenalExpectedStrength:arsenal?{
        played:arsenal.played,
        points:arsenal.points,
        elo:arsenal.eloRating,
        attack:arsenal.attack,
        defence:arsenal.defence,
        ppgPower:arsenal.ppgPower,
        historicalWeight:arsenal.historicalWeight,
        currentWeight:arsenal.currentSeasonWeight,
        remaining:arsenalRemaining
      }:null
    };
  }

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


  const V138_SENSITIVITY_SIMS=6000;

  function cloneTeamsForAudit(teams){
    return teams.map(t=>({...t}));
  }

  function removeFinishedResultsForScenario(currentTeams,fixtures,targets){
    let teams=cloneTeamsForAudit(currentTeams);
    for(const target of targets){
      teams=reverseCompletedResult(teams,target);
    }
    const cfFixtures=fixtures.map(f=>
      targets.some(t=>sameFixture(f,t))
        ? {...f,status:'scheduled',home_score:null,away_score:null}
        : {...f}
    );
    const evidence=completedResults(cfFixtures);
    return {teams,fixtures:cfFixtures,evidence};
  }

  function v138DiagnosticRun(currentTeams,fixtures,targets,seed=1382026){
    const scenario=removeFinishedResultsForScenario(currentTeams,fixtures,targets);
    const rated=buildRatings(scenario.teams,scenario.evidence);
    const byName=new Map(rated.map(t=>[t.club,t]));
    const remaining=scenario.fixtures.filter(f=>!finished(f.status));
    const prepared=remaining.map(f=>{
      const home=byName.get(f.home),away=byName.get(f.away);
      return home&&away?{...f,homeTeam:home,awayTeam:away,model:fixtureGoalModel(home,away)}:null;
    }).filter(Boolean);

    let arsenalTitles=0,arsenalPointsSum=0;
    const rng=rngFactory(seed>>>0);

    for(let sim=0;sim<V138_SENSITIVITY_SIMS;sim++){
      const season=new Map(rated.map(t=>[t.club,{club:t.club,points:t.points,gd:t.gd,gf:t.gf}]));
      for(const f of prepared){
        const hs=sampleScore(f.model.homeCDF,rng);
        const as=sampleScore(f.model.awayCDF,rng);
        const h=season.get(f.homeTeam.club),a=season.get(f.awayTeam.club);
        h.gf+=hs;a.gf+=as;h.gd+=hs-as;a.gd+=as-hs;
        if(hs>as)h.points+=3;
        else if(as>hs)a.points+=3;
        else{h.points++;a.points++;}
      }
      const table=[...season.values()].sort((a,b)=>
        b.points-a.points||b.gd-a.gd||b.gf-a.gf||a.club.localeCompare(b.club)
      );
      if(table[0]?.club==='Arsenal')arsenalTitles++;
      arsenalPointsSum+=Number(season.get('Arsenal')?.points||0);
    }

    return {
      titleProb:arsenalTitles/V138_SENSITIVITY_SIMS*100,
      expectedPoints:arsenalPointsSum/V138_SENSITIVITY_SIMS,
      completedMatches:scenario.evidence.length,
      removed:targets.map(t=>fixtureId(t))
    };
  }

  function buildV138SensitivityAudit(currentTeams,fixtures){
    const finishedRows=completedResults(fixtures).slice().sort((a,b)=>resultTime(a)-resultTime(b));
    const arsenalResult=[...finishedRows].reverse().find(r=>r.home==='Arsenal'||r.away==='Arsenal');
    const cityResult=[...finishedRows].reverse().find(r=>r.home==='Manchester City'||r.away==='Manchester City');
    if(!arsenalResult||!cityResult||sameFixture(arsenalResult,cityResult))return null;

    // Common random numbers: same seed for all four scenarios.
    const seed=1382026;
    const actual=v138DiagnosticRun(currentTeams,fixtures,[],seed);
    const arsenalOnly=v138DiagnosticRun(currentTeams,fixtures,[cityResult],seed);
    const cityOnly=v138DiagnosticRun(currentTeams,fixtures,[arsenalResult],seed);
    const neither=v138DiagnosticRun(currentTeams,fixtures,[arsenalResult,cityResult],seed);

    const arsenalEffect=arsenalOnly.titleProb-neither.titleProb;
    const cityEffect=cityOnly.titleProb-neither.titleProb;
    const combinedEffect=actual.titleProb-neither.titleProb;
    const interaction=combinedEffect-arsenalEffect-cityEffect;

    return {
      actual,arsenalOnly,cityOnly,neither,
      arsenalEffect,cityEffect,combinedEffect,interaction,
      arsenalResult,cityResult,
      simulations:V138_SENSITIVITY_SIMS
    };
  }







  const V1491_SIMS=25000;

  function v1491ExactPairedEffect(baseTeams,allFixtures,md5,targetFixture,seed){
    const fixed=md5.filter(r=>!sameFixture(r,targetFixture));
    const fixedIds=new Set(fixed.map(f=>fixtureId(f)));
    const teams=v146StandingsFromResults(baseTeams,fixed);
    const ratings=buildRatings(teams,fixed);
    const byName=new Map(ratings.map(t=>[t.club.toLowerCase(),t]));

    const prepared=allFixtures.map(f=>{
      if(fixedIds.has(fixtureId(f))) return null;
      const home=byName.get(f.home.toLowerCase()),away=byName.get(f.away.toLowerCase());
      if(!home||!away)return null;
      return {...f,homeTeam:home,awayTeam:away,model:fixtureGoalModel(home,away),target:sameFixture(f,targetFixture)};
    }).filter(Boolean);

    const rng=rngFactory(seed>>>0);
    let positive=0,negative=0,same=0,expectedTitles=0,actualTitles=0;

    for(let s=0;s<V1491_SIMS;s++){
      const natural=new Map(ratings.map(t=>[t.club,{club:t.club,points:t.points,gd:t.gd,gf:t.gf}]));
      const locked=new Map(ratings.map(t=>[t.club,{club:t.club,points:t.points,gd:t.gd,gf:t.gf}]));

      for(const f of prepared){
        // ONE shared random draw for this fixture/universe.
        const naturalHs=sampleScore(f.model.homeCDF,rng);
        const naturalAs=sampleScore(f.model.awayCDF,rng);
        const lockedHs=f.target?Number(targetFixture.home_score):naturalHs;
        const lockedAs=f.target?Number(targetFixture.away_score):naturalAs;

        const apply=(season,hs,as)=>{
          const h=season.get(f.homeTeam.club),a=season.get(f.awayTeam.club);
          h.gf+=hs;a.gf+=as;h.gd+=hs-as;a.gd+=as-hs;
          if(hs>as)h.points+=3; else if(as>hs)a.points+=3; else {h.points++;a.points++;}
        };
        apply(natural,naturalHs,naturalAs);
        apply(locked,lockedHs,lockedAs);
      }

      const champ=(season)=>{
        const rows=[...season.values()].sort((a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf||a.club.localeCompare(b.club));
        return rows[0]?.club==='Arsenal';
      };
      const a=champ(natural),b=champ(locked);
      if(a)expectedTitles++;
      if(b)actualTitles++;
      if(!a&&b)positive++;
      else if(a&&!b)negative++;
      else same++;
    }

    const net=positive-negative;
    const effect=net/V1491_SIMS*100;
    // Conservative paired Bernoulli SE from discordant-pair variance.
    const pPlus=positive/V1491_SIMS,pMinus=negative/V1491_SIMS;
    const variance=Math.max(0,(pPlus+pMinus)-Math.pow(pPlus-pMinus,2))/V1491_SIMS;
    const se=Math.sqrt(variance)*100;
    return {
      positive,negative,same,net,effect,se,
      low95:effect-1.96*se,high95:effect+1.96*se,
      naturalTitle:expectedTitles/V1491_SIMS*100,
      lockedTitle:actualTitles/V1491_SIMS*100
    };
  }

  function buildV1491HotfixAudit(currentTeams,fixtures){
    const actual=completedResults(fixtures).slice().sort((a,b)=>resultTime(a)-resultTime(b));
    if(actual.length<20)return {ready:false,count:actual.length};
    const maxMd=Math.max(...actual.map(r=>Number(r.matchday)||0));
    const through=Math.min(5,maxMd||5);
    const md5=actual.filter(r=>(Number(r.matchday)||0)<=through);

    const wanted=[
      ['Manchester City',3],
      ['Manchester City',4],
      ['Manchester City',2],
      ['Chelsea',3],
      ['Chelsea',2],
      ['Aston Villa',2]
    ];
    const rows=[];
    wanted.forEach(([club,md],i)=>{
      const g=md5.find(r=>(Number(r.matchday)||0)===md&&(r.home===club||r.away===club));
      if(!g)return;
      const result=v1491ExactPairedEffect(currentTeams,fixtures,md5,g,149100+i*97);
      rows.push({
        club,md,fixture:`${g.home} ${g.home_score}–${g.away_score} ${g.away}`,...result
      });
    });
    const cityRows=rows.filter(r=>r.club==='Manchester City');
    const cityStable=cityRows.every(r=>Math.abs(r.effect)>=1 && r.low95*r.high95>0);
    return {
      ready:true,count:md5.length,rows,
      verdict:cityStable?'EXACT PAIRING STABLE':'REVIEW REQUIRED'
    };
  }



  function renderV1501TerminalDiagnostics(fixtures){
    if(!isSeasonComplete(fixtures))return;

    const sections=[...document.querySelectorAll('section')];

    const env=sections.find(s=>s.textContent.includes('SIMULATION ENVIRONMENT REGRESSION AUDIT'));
    if(env){
      const badge=[...env.querySelectorAll('b,strong')].find(el=>/CHECKING|REGRESSION DETECTED|ENVIRONMENT STABLE|SEASON COMPLETE/.test(el.textContent));
      if(badge)badge.textContent='SEASON COMPLETE • REGRESSION AUDIT CLOSED';

      const metricLabels=['REMAINING MATCH GOALS','DRAW RATE','FAVOURITE WIN RATE','AVG ELO GAP'];
      metricLabels.forEach(label=>{
        const labelEl=[...env.querySelectorAll('*')].find(el=>el.children.length===0&&el.textContent.trim()===label);
        if(labelEl){
          const box=labelEl.parentElement;
          if(box){
            const value=[...box.querySelectorAll('strong,b')].find(x=>x!==labelEl);
            if(value)value.textContent='N/A';
          }
        }
      });

      const rows=[...env.querySelectorAll('tr')];
      rows.forEach(row=>{
        if(/Remaining-match goals|Draw probability|Favorite win probability|Average Elo gap/i.test(row.textContent)){
          const cells=[...row.querySelectorAll('td')];
          cells.forEach(c=>{
            if(c.cellIndex>0)c.textContent='N/A';
          });
        }
      });

      const note=[...env.querySelectorAll('p,small')].find(el=>/diagnostic only|remaining-season/i.test(el.textContent));
      if(note)note.textContent='Season complete: there are no unresolved fixtures, so the remaining-season regression audit is closed.';
    }

    const scoring=sections.find(s=>s.textContent.includes('SCORING BASELINE STABILIZATION'));
    if(scoring){
      const badge=[...scoring.querySelectorAll('b,strong')].find(el=>/TRACING|BASELINE STABILIZED|SEASON COMPLETE/.test(el.textContent));
      if(badge)badge.textContent='SEASON COMPLETE';

      ['CURRENT REMAINING GOALS','FROZEN-BASE COUNTERFACTUAL','GOAL LOSS FROM BASE'].forEach(label=>{
        const labelEl=[...scoring.querySelectorAll('*')].find(el=>el.children.length===0&&el.textContent.trim()===label);
        if(labelEl){
          const box=labelEl.parentElement;
          if(box){
            const value=[...box.querySelectorAll('strong,b')].find(x=>x!==labelEl);
            if(value)value.textContent='N/A';
          }
        }
      });

      const rows=[...scoring.querySelectorAll('tr')];
      rows.forEach(row=>{
        if(/Same .*fixtures|draw rate|favourite win|favorite win/i.test(row.textContent)){
          const cells=[...row.querySelectorAll('td')];
          cells.forEach(c=>{
            if(c.cellIndex>0)c.textContent='N/A';
          });
        }
      });

      const note=[...scoring.querySelectorAll('p,small')].find(el=>/same remaining fixtures|repairs only/i.test(el.textContent));
      if(note)note.textContent='Season complete: scoring diagnostics remain available as final-season context, but there are no future fixtures left to simulate.';
    }

    const obsoleteTitles=[
      'EXACT-PAIRING HOTFIX',
      'RIVAL SHOCK MONTE CARLO STABILITY AUDIT',
      'OPPONENT-NEUTRAL RIVAL SHOCK AUDIT',
      'RIVAL SHOCK SENSITIVITY AUDIT',
      'MD5 TITLE SURGE DECOMPOSITION',
      'CONTENDER DISTRIBUTION COMPRESSION AUDIT',
      'TITLE BOUNDARY / RANK SENSITIVITY AUDIT',
      'EXPECTED RESULT VS ACTUAL RESULT AUDIT',
      'FIXTURE EXPECTATION / SURPRISE AUDIT',
      'BANKED POINTS VS EVIDENCE DECOMPOSITION',
      'TITLE PROBABILITY SENSITIVITY AUDIT',
      'TRUE RESULT IMPACT'
    ];
    sections.forEach(section=>{
      if(obsoleteTitles.some(t=>section.textContent.includes(t))){
        section.style.display='none';
        section.dataset.v1501Hidden='season-complete';
      }
    });
  }

  function renderV150TerminalState(simulation,fixtures,results){
    if(!isSeasonComplete(fixtures))return;
    const summary=finalSeasonSummary(simulation?.rows||[]);
    const arsenal=summary.arsenal,champion=summary.champion;
    const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};

    // Main deterministic outputs
    if(arsenal){
      set('arsenalTitleProbability',Number(arsenal.titleProb||0).toFixed(1)+'%');
      set('arsenalExpectedPoints',Number(arsenal.points||arsenal.expectedPoints||0).toFixed(1));
      set('arsenalExpectedFinish',Number(arsenal.position||arsenal.expectedPosition||0).toFixed(1));
    }

    // V13.5 terminal interpretation
    const envStatus=document.querySelector('.v135-regression .status, #v135Status, [data-v135-status]');
    if(envStatus)envStatus.textContent='SEASON COMPLETE • REGRESSION AUDIT CLOSED';

    const envSection=[...document.querySelectorAll('section')].find(s=>s.textContent.includes('SIMULATION ENVIRONMENT REGRESSION AUDIT'));
    if(envSection){
      const badge=[...envSection.querySelectorAll('b,strong')].find(el=>/REGRESSION DETECTED|ENVIRONMENT STABLE/.test(el.textContent));
      if(badge)badge.textContent='SEASON COMPLETE';
      const note=[...envSection.querySelectorAll('p,small')].find(el=>el.textContent.includes('diagnostic only')||el.textContent.includes('Diagnostic only'));
      if(note)note.textContent='Season complete: there are no remaining fixtures, so the remaining-season regression audit is closed.';
    }

    // V13.7 terminal interpretation
    const scoringSection=[...document.querySelectorAll('section')].find(s=>s.textContent.includes('SCORING BASELINE STABILIZATION'));
    if(scoringSection){
      const replaceText=(from,to)=>{
        [...scoringSection.querySelectorAll('*')].forEach(el=>{if(el.children.length===0&&el.textContent.trim()===from)el.textContent=to;});
      };
      replaceText('CURRENT REMAINING GOALS','REMAINING GOALS');
      const note=[...scoringSection.querySelectorAll('p,small')].find(el=>el.textContent.includes('On the same remaining fixtures'));
      if(note)note.textContent='Season complete: no remaining fixtures exist, so future-goal, draw-rate and favourite-win diagnostics are not applicable.';
    }

    // Monte Carlo validation terminal interpretation
    const mcSection=[...document.querySelectorAll('section')].find(s=>s.textContent.includes('Monte Carlo Validation Dashboard'));
    if(mcSection){
      const label=mcSection.querySelector('.nl4-model-label');
      if(label)label.textContent='V15.0 • FINAL SEASON RESULT';
      const heading=mcSection.querySelector('h3');
      if(heading)heading.textContent='Final Premier League Outcome';
      const expl=[...mcSection.querySelectorAll('p')][0];
      if(expl)expl.textContent='All 380 league matches are complete. Forecast uncertainty has collapsed to the observed final table.';
    }

    const reliability=[...document.querySelectorAll('section')].find(s=>s.textContent.includes('Simulation Reliability & Tail Diagnostics'));
    if(reliability){
      const label=reliability.querySelector('.nl4-model-label');
      if(label)label.textContent='V15.0 • FINAL-SEASON CONVERGENCE';
      const heading=reliability.querySelector('h3');
      if(heading)heading.textContent='No Remaining Forecast Uncertainty';
    }

    // Add dedicated final-state banner once.
    let banner=document.getElementById('v150FinalSeasonBanner');
    if(!banner){
      banner=document.createElement('section');
      banner.id='v150FinalSeasonBanner';
      banner.className='v150-terminal';
      banner.innerHTML=`
        <span class="nl4-model-label">V15.0 • FINAL SEASON CONVERGENCE</span>
        <h3>Season Complete</h3>
        <div class="v150-grid">
          <article><span>CHAMPION</span><strong>${esc(champion?.club||'—')}</strong><small>${Number(champion?.points||0)} pts</small></article>
          <article><span>ARSENAL FINAL POSITION</span><strong>${Number(arsenal?.position||0)||'—'}</strong><small>${Number(arsenal?.points||0)} pts</small></article>
          <article><span>REMAINING FIXTURES</span><strong>0</strong><small>380 / 380 complete</small></article>
          <article><span>EVIDENCE</span><strong>100% LIVE</strong><small>0% historical</small></article>
        </div>
        <p>All forecast probabilities are now deterministic outcomes from the final table. Remaining-season simulation diagnostics are closed because there are no unresolved Premier League fixtures.</p>`;
      const target=document.querySelector('.pl-title-probability-section')||document.body.firstElementChild;
      if(target?.parentNode)target.parentNode.insertBefore(banner,target);
      else document.body.prepend(banner);
    }
  }

  function renderV1491HotfixAudit(a){
    const root=document.getElementById('v1491HotfixAudit'),status=document.getElementById('v1491HotfixStatus');
    if(!root)return;
    if(!a?.ready){
      if(status)status.textContent='WAITING FOR MD5';
      root.innerHTML=`<div class="nl4-title-model-loading">${a?.count||0} completed results found. Keep the same MD5 sandbox.</div>`;
      return;
    }
    if(status)status.textContent=a.verdict;
    const signed=n=>`${n>=0?'+':''}${Number(n).toFixed(2)} pts`;
    root.innerHTML=`
      <div class="v1491-kpis">
        <article><span>PAIRED UNIVERSES</span><strong>${V1491_SIMS.toLocaleString()}</strong><small>per tested result</small></article>
        <article><span>RESULTS CHECKED</span><strong>${a.rows.length}</strong><small>same MD5 shock set</small></article>
        <article><span>PAIRING METHOD</span><strong>EXACT</strong><small>all other fixture draws identical</small></article>
      </div>
      <table class="v1491-table"><thead><tr>
        <th>CLUB</th><th>MD</th><th>RESULT</th><th>POSITIVE FLIPS</th><th>NEGATIVE FLIPS</th><th>NET FLIPS</th><th>TITLE EFFECT</th><th>95% INTERVAL</th><th>SE</th>
      </tr></thead><tbody>
      ${a.rows.map(r=>`<tr>
        <th>${esc(r.club)}</th><td>MD${r.md}</td><td>${esc(r.fixture)}</td>
        <td>${r.positive.toLocaleString()}</td><td>${r.negative.toLocaleString()}</td>
        <td>${r.net>=0?'+':''}${r.net.toLocaleString()}</td>
        <td class="${r.effect>0?'stable':'neutral'}">${signed(r.effect)}</td>
        <td>${signed(r.low95)} to ${signed(r.high95)}</td><td>±${r.se.toFixed(2)}</td>
      </tr>`).join('')}
      </tbody></table>
      <p class="v1491-read">This hotfix no longer subtracts two separately evolving Monte Carlo title estimates. Every paired universe shares the exact same random scores for every other unresolved fixture. The title effect is the net Arsenal championship flips divided by 25,000.</p>`;
  }

  const V149_SIMS=25000;

  function v149PairedMatchEffect(baseTeams,allFixtures,md5,targetFixture,seed){
    const fixed=md5.filter(r=>!sameFixture(r,targetFixture));
    const fixedIds=new Set(fixed.map(f=>fixtureId(f)));
    const teams=v146StandingsFromResults(baseTeams,fixed);
    const ratings=buildRatings(teams,fixed);
    const byName=new Map(ratings.map(t=>[t.club.toLowerCase(),t]));
    const scenarioFixtures=allFixtures.map(f=>{
      if(sameFixture(f,targetFixture)) return {...f,status:'scheduled',home_score:null,away_score:null};
      return fixedIds.has(fixtureId(f))?{...f,status:'fulltime'}:{...f,status:'scheduled',home_score:null,away_score:null};
    });
    const prepared=scenarioFixtures.filter(f=>!finished(f.status)).map(f=>{
      const home=byName.get(f.home.toLowerCase()),away=byName.get(f.away.toLowerCase());
      return home&&away?{...f,homeTeam:home,awayTeam:away,model:fixtureGoalModel(home,away),target:sameFixture(f,targetFixture)}:null;
    }).filter(Boolean);

    const rngExpected=rngFactory(seed>>>0);
    const rngActual=rngFactory(seed>>>0);
    let expectedTitles=0,actualTitles=0;

    function runOne(mode,rng){
      let titles=0;
      for(let s=0;s<V149_SIMS;s++){
        const season=new Map(ratings.map(t=>[t.club,{club:t.club,points:t.points,gd:t.gd,gf:t.gf}]));
        for(const f of prepared){
          let hs,as;
          if(f.target && mode==='actual'){
            hs=Number(targetFixture.home_score); as=Number(targetFixture.away_score);
          }else{
            hs=sampleScore(f.model.homeCDF,rng); as=sampleScore(f.model.awayCDF,rng);
          }
          const h=season.get(f.homeTeam.club),a=season.get(f.awayTeam.club);
          h.gf+=hs;a.gf+=as;h.gd+=hs-as;a.gd+=as-hs;
          if(hs>as)h.points+=3; else if(as>hs)a.points+=3; else {h.points++;a.points++;}
        }
        const rows=[...season.values()].sort((a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf||a.club.localeCompare(b.club));
        if(rows[0]?.club==='Arsenal')titles++;
      }
      return titles/V149_SIMS*100;
    }

    const expectedTitle=runOne('expected',rngExpected);
    const actualTitle=runOne('actual',rngActual);
    return {expectedTitle,actualTitle,effect:actualTitle-expectedTitle};
  }

  function buildV149StabilityAudit(currentTeams,fixtures){
    const actual=completedResults(fixtures).slice().sort((a,b)=>resultTime(a)-resultTime(b));
    if(actual.length<20)return {ready:false,count:actual.length};
    const maxMd=Math.max(...actual.map(r=>Number(r.matchday)||0));
    const through=Math.min(5,maxMd||5);
    const md5=actual.filter(r=>(Number(r.matchday)||0)<=through);

    const candidates=[];
    for(const club of V148_RIVALS){
      const games=md5.filter(r=>r.home===club||r.away===club).sort((a,b)=>(Number(a.matchday)||0)-(Number(b.matchday)||0)||resultTime(a)-resultTime(b));
      for(let i=0;i<games.length;i++){
        const g=games[i], seed=148000+(V148_RIVALS.indexOf(club)*100)+i;
        const lowExpected=v148ScenarioSim(currentTeams,fixtures,md5,g,'expected',seed);
        const lowActual=v148ScenarioSim(currentTeams,fixtures,md5,g,'actual',seed);
        candidates.push({club,g,md:Number(g.matchday)||i+1,low:lowActual.title-lowExpected.title,seed});
      }
    }
    candidates.sort((a,b)=>Math.abs(b.low)-Math.abs(a.low));
    const selected=candidates.slice(0,6);

    const rows=selected.map(item=>{
      const hi=v149PairedMatchEffect(currentTeams,fixtures,md5,item.g,item.seed+149000);
      const drift=hi.effect-item.low;
      const stable=Math.abs(drift)<=0.8;
      return {
        club:item.club,md:item.md,
        fixture:`${item.g.home} ${item.g.home_score}–${item.g.away_score} ${item.g.away}`,
        low:item.low,high:hi.effect,drift,
        expectedTitle:hi.expectedTitle,actualTitle:hi.actualTitle,stable
      };
    });
    const stableCount=rows.filter(r=>r.stable).length;
    return {ready:true,count:md5.length,rows,stableCount,total:rows.length,
      verdict:stableCount===rows.length?'MD5 EFFECTS STABLE':stableCount>=rows.length-1?'MOSTLY STABLE':'INSTABILITY DETECTED'};
  }

  function renderV149StabilityAudit(a){
    const root=document.getElementById('v149StabilityAudit'),status=document.getElementById('v149StabilityStatus');
    if(!root)return;
    if(!a?.ready){
      if(status)status.textContent='WAITING FOR MD5';
      root.innerHTML=`<div class="nl4-title-model-loading">${a?.count||0} completed results found. Keep the same MD5 sandbox.</div>`;
      return;
    }
    if(status)status.textContent=a.verdict;
    const signed=n=>`${n>=0?'+':''}${Number(n).toFixed(1)} pts`;
    root.innerHTML=`
      <div class="v149-kpis">
        <article><span>HIGH-RES SIMS</span><strong>${V149_SIMS.toLocaleString()}</strong><small>paired per state</small></article>
        <article><span>EFFECTS CHECKED</span><strong>${a.total}</strong><small>largest V14.8 match shocks</small></article>
        <article><span>STABLE</span><strong>${a.stableCount}/${a.total}</strong><small>≤ 0.8 pt drift</small></article>
      </div>
      <table class="v149-table"><thead><tr>
        <th>CLUB</th><th>MD</th><th>RESULT</th><th>V14.8 • 6K EFFECT</th><th>V14.9 • 25K EFFECT</th><th>DRIFT</th><th>STATUS</th>
      </tr></thead><tbody>
        ${a.rows.map(r=>`<tr>
          <th>${esc(r.club)}</th><td>MD${r.md}</td><td>${esc(r.fixture)}</td>
          <td>${signed(r.low)}</td><td>${signed(r.high)}</td><td>${signed(r.drift)}</td>
          <td class="${r.stable?'stable':'unstable'}">${r.stable?'STABLE':'CHECK'}</td>
        </tr>`).join('')}
      </tbody></table>
      <p class="v149-read">V14.9 re-runs only the largest V14.8 match effects at 25,000 simulations. If the high-resolution estimates stay close to the original 6,000-simulation values, we can treat the MD5 rival-shock diagnosis as Monte Carlo stable and move on to MD10 progression testing.</p>`;
  }

  const V148_SIMS=6000;
  const V148_RIVALS=['Manchester City','Liverpool','Chelsea','Aston Villa'];

  function v148ScenarioSim(baseTeams,allFixtures,md5,targetFixture,mode,seed){
    const fixed=md5.filter(r=>!sameFixture(r,targetFixture));
    const fixedIds=new Set(fixed.map(f=>fixtureId(f)));
    const teams=v146StandingsFromResults(baseTeams,fixed);
    const ratings=buildRatings(teams,fixed);
    const byName=new Map(ratings.map(t=>[t.club.toLowerCase(),t]));
    const scenarioFixtures=allFixtures.map(f=>{
      if(sameFixture(f,targetFixture)) return {...f,status:'scheduled',home_score:null,away_score:null};
      return fixedIds.has(fixtureId(f))?{...f,status:'fulltime'}:{...f,status:'scheduled',home_score:null,away_score:null};
    });
    const prepared=scenarioFixtures.filter(f=>!finished(f.status)).map(f=>{
      const home=byName.get(f.home.toLowerCase()),away=byName.get(f.away.toLowerCase());
      return home&&away?{...f,homeTeam:home,awayTeam:away,model:fixtureGoalModel(home,away),target:sameFixture(f,targetFixture)}:null;
    }).filter(Boolean);

    const rng=rngFactory(seed>>>0);
    let titles=0, arsenalPts=0;
    for(let s=0;s<V148_SIMS;s++){
      const season=new Map(ratings.map(t=>[t.club,{club:t.club,points:t.points,gd:t.gd,gf:t.gf}]));
      for(const f of prepared){
        let hs,as;
        if(f.target && mode==='actual'){
          hs=Number(targetFixture.home_score); as=Number(targetFixture.away_score);
        } else {
          hs=sampleScore(f.model.homeCDF,rng); as=sampleScore(f.model.awayCDF,rng);
        }
        const h=season.get(f.homeTeam.club),a=season.get(f.awayTeam.club);
        h.gf+=hs;a.gf+=as;h.gd+=hs-as;a.gd+=as-hs;
        if(hs>as)h.points+=3; else if(as>hs)a.points+=3; else {h.points++;a.points++;}
      }
      const rows=[...season.values()].sort((a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf||a.club.localeCompare(b.club));
      if(rows[0]?.club==='Arsenal')titles++;
      arsenalPts+=season.get('Arsenal')?.points||0;
    }
    return {title:titles/V148_SIMS*100,expectedPoints:arsenalPts/V148_SIMS};
  }

  function v148ExpectedForFixture(baseTeams,md5,target){
    const prior=md5.filter(r=>resultTime(r)<resultTime(target));
    const teams=v146StandingsFromResults(baseTeams,prior);
    const ratings=buildRatings(teams,prior);
    const home=ratings.find(t=>t.club===target.home),away=ratings.find(t=>t.club===target.away);
    if(!home||!away)return null;
    const model=fixtureGoalModel(home,away);
    let hp=0,ap=0;
    for(let hs=0;hs<model.homeCDF.length;hs++){
      const ph=hs===0?model.homeCDF[0]:model.homeCDF[hs]-model.homeCDF[hs-1];
      for(let as=0;as<model.awayCDF.length;as++){
        const pa=as===0?model.awayCDF[0]:model.awayCDF[as]-model.awayCDF[as-1],p=ph*pa;
        if(hs>as)hp+=3*p; else if(as>hs)ap+=3*p; else {hp+=p;ap+=p;}
      }
    }
    return {home:hp,away:ap};
  }

  function buildV148OpponentNeutralAudit(currentTeams,fixtures){
    const actual=completedResults(fixtures).slice().sort((a,b)=>resultTime(a)-resultTime(b));
    if(actual.length<20)return {ready:false,count:actual.length};
    const maxMd=Math.max(...actual.map(r=>Number(r.matchday)||0));
    const through=Math.min(5,maxMd||5);
    const md5=actual.filter(r=>(Number(r.matchday)||0)<=through);
    const clubs=[];

    for(const club of V148_RIVALS){
      const games=md5.filter(r=>r.home===club||r.away===club).sort((a,b)=>(Number(a.matchday)||0)-(Number(b.matchday)||0)||resultTime(a)-resultTime(b));
      const rows=[];
      let totalEffect=0,totalSurprise=0;
      for(let i=0;i<games.length;i++){
        const g=games[i],seed=148000+(V148_RIVALS.indexOf(club)*100)+i;
        const expected=v148ScenarioSim(currentTeams,fixtures,md5,g,'expected',seed);
        const actualState=v148ScenarioSim(currentTeams,fixtures,md5,g,'actual',seed);
        const expPts=v148ExpectedForFixture(currentTeams,md5,g);
        const hs=Number(g.home_score),as=Number(g.away_score),isHome=g.home===club;
        const actualPts=hs===as?1:(isHome?(hs>as?3:0):(as>hs?3:0));
        const expectedPts=expPts?(isHome?expPts.home:expPts.away):0;
        const surprise=actualPts-expectedPts;
        const effect=actualState.title-expected.title;
        totalEffect+=effect; totalSurprise+=surprise;
        rows.push({
          md:Number(g.matchday)||i+1,
          fixture:`${g.home} ${hs}–${as} ${g.away}`,
          actualPts,expectedPts,surprise,
          expectedTitle:expected.title,actualTitle:actualState.title,effect,
          leverage:Math.abs(surprise)>.15?effect/(-surprise):null
        });
      }
      clubs.push({club,rows,totalEffect,totalSurprise});
    }
    clubs.sort((a,b)=>Math.abs(b.totalEffect)-Math.abs(a.totalEffect));
    return {ready:true,count:md5.length,through,clubs};
  }

  function renderV148OpponentNeutralAudit(a){
    const root=document.getElementById('v148OpponentNeutralAudit'),status=document.getElementById('v148OpponentNeutralStatus');
    if(!root)return;
    if(!a?.ready){
      if(status)status.textContent='WAITING FOR MD5';
      root.innerHTML=`<div class="nl4-title-model-loading">${a?.count||0} completed results found. Keep the same sandbox through Matchday 5.</div>`;
      return;
    }
    if(status)status.textContent=`${V148_SIMS.toLocaleString()} PAIRED SIMS / MATCH`;
    const signed=n=>`${n>=0?'+':''}${Number(n).toFixed(1)}`;
    const pct=n=>`${Number(n).toFixed(1)}%`;
    root.innerHTML=`
      <div class="v148-summary">
        ${a.clubs.map(c=>`<article><span>${esc(c.club)}</span><strong>${signed(c.totalEffect)} pts</strong><small>${signed(c.totalSurprise)} expected-point surprise • sum of match-level effects</small></article>`).join('')}
      </div>
      ${a.clubs.map(c=>`
        <div class="v148-club">
          <h4>${esc(c.club)} <b>${signed(c.totalEffect)} title pts</b></h4>
          <table class="v148-table"><thead><tr><th>MD</th><th>ACTUAL RESULT</th><th>ACTUAL PTS</th><th>EXPECTED PTS</th><th>POINT SURPRISE</th><th>EXPECTED-DISTRIBUTION TITLE</th><th>ACTUAL-LOCKED TITLE</th><th>TITLE EFFECT</th><th>LEVERAGE</th></tr></thead>
          <tbody>${c.rows.map(r=>`<tr>
            <th>MD${r.md}</th><td>${esc(r.fixture)}</td><td>${r.actualPts}</td><td>${r.expectedPts.toFixed(2)}</td>
            <td class="${r.surprise<0?'boost':'drag'}">${signed(r.surprise)}</td>
            <td>${pct(r.expectedTitle)}</td><td>${pct(r.actualTitle)}</td>
            <td class="${r.effect>0?'boost':'drag'}">${signed(r.effect)} pts</td>
            <td>${r.leverage==null?'—':r.leverage.toFixed(2)+'×'}</td>
          </tr>`).join('')}</tbody></table>
        </div>`).join('')}
      <p class="v148-read">Each row changes only one completed rival fixture: the other 49 MD1–5 results remain fixed, while that single match is either resolved naturally from its reconstructed distribution or locked to the observed score. This avoids V14.7's club-removal contamination. Match effects still overlap across nonlinear title states, so club totals are diagnostic sums rather than additive decomposition.</p>`;
  }

  const V147_SIMS=6000;
  const V147_RIVALS=['Manchester City','Liverpool','Chelsea','Aston Villa','Newcastle United','Manchester United','Tottenham Hotspur'];

  function v147FastSim(baseTeams,allFixtures,fixedResults,seed=14705){
    const fixedIds=new Set(fixedResults.map(f=>fixtureId(f)));
    const scenarioFixtures=allFixtures.map(f=>fixedIds.has(fixtureId(f))
      ? {...f,status:'fulltime'}
      : {...f,status:'scheduled',home_score:null,away_score:null});
    const teams=v146StandingsFromResults(baseTeams,fixedResults);
    const ratings=buildRatings(teams,fixedResults);
    const byName=new Map(ratings.map(t=>[t.club.toLowerCase(),t]));
    const prepared=scenarioFixtures.filter(f=>!finished(f.status)).map(f=>{
      const home=byName.get(f.home.toLowerCase()),away=byName.get(f.away.toLowerCase());
      return home&&away?{...f,homeTeam:home,awayTeam:away,model:fixtureGoalModel(home,away)}:null;
    }).filter(Boolean);
    let titles=0,arsenalPts=0;
    const rng=rngFactory(seed);
    for(let s=0;s<V147_SIMS;s++){
      const season=new Map(ratings.map(t=>[t.club,{club:t.club,points:t.points,gd:t.gd,gf:t.gf}]));
      for(const f of prepared){
        const hs=sampleScore(f.model.homeCDF,rng),as=sampleScore(f.model.awayCDF,rng);
        const h=season.get(f.homeTeam.club),a=season.get(f.awayTeam.club);
        h.gf+=hs;a.gf+=as;h.gd+=hs-as;a.gd+=as-hs;
        if(hs>as)h.points+=3; else if(as>hs)a.points+=3; else {h.points++;a.points++;}
      }
      const rows=[...season.values()].sort((a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf||a.club.localeCompare(b.club));
      if(rows[0]?.club==='Arsenal')titles++;
      arsenalPts+=rows.find(r=>r.club==='Arsenal')?.points||0;
    }
    return {title:titles/V147_SIMS*100,expectedPoints:arsenalPts/V147_SIMS};
  }

  function buildV147RivalShockAudit(currentTeams,fixtures){
    const actual=completedResults(fixtures).slice().sort((a,b)=>resultTime(a)-resultTime(b));
    if(actual.length<20)return {ready:false,count:actual.length};
    const maxMd=Math.max(...actual.map(r=>Number(r.matchday)||0));
    const through=Math.min(5,maxMd||5);
    const md5=actual.filter(r=>(Number(r.matchday)||0)<=through);
    const full=v147FastSim(currentTeams,fixtures,md5,14700);

    const rows=[];
    for(const club of V147_RIVALS){
      const clubResults=md5.filter(r=>r.home===club||r.away===club);
      const without=md5.filter(r=>r.home!==club&&r.away!==club);
      const restored=v147FastSim(currentTeams,fixtures,without,14700);

      let prior=[],actualPts=0,expectedPts=0;
      for(const r of clubResults.slice().sort((a,b)=>resultTime(a)-resultTime(b))){
        const exp=v146ExpectedPointsForResult(r,currentTeams,prior);
        const hs=Number(r.home_score),as=Number(r.away_score),isHome=r.home===club;
        actualPts+=hs===as?1:(isHome?(hs>as?3:0):(as>hs?3:0));
        expectedPts+=isHome?exp.home:exp.away;
        prior.push(r);
      }
      const surprise=actualPts-expectedPts;
      const arsenalTitleEffect=full.title-restored.title;
      rows.push({
        club,matches:clubResults.length,actualPts,expectedPts,surprise,
        restoredTitle:restored.title,fullTitle:full.title,
        arsenalTitleEffect,
        leverage:Math.abs(surprise)>0.15?arsenalTitleEffect/(-surprise):null
      });
    }
    rows.sort((a,b)=>Math.abs(b.arsenalTitleEffect)-Math.abs(a.arsenalTitleEffect));
    const sumEffects=rows.reduce((s,r)=>s+r.arsenalTitleEffect,0);
    return {ready:true,through,count:md5.length,full,rows,sumEffects};
  }

  function renderV147RivalShockAudit(a){
    const root=document.getElementById('v147RivalShockAudit'),status=document.getElementById('v147RivalShockStatus');
    if(!root)return;
    if(!a?.ready){
      if(status)status.textContent='WAITING FOR MD5';
      root.innerHTML=`<div class="nl4-title-model-loading">${a?.count||0} completed results found. Keep the same sandbox season through Matchday 5.</div>`;
      return;
    }
    if(status)status.textContent=`${V147_SIMS.toLocaleString()} SIMS × ${a.rows.length+1} STATES`;
    const pct=n=>`${Number(n).toFixed(1)}%`;
    const signed=n=>`${n>=0?'+':''}${Number(n).toFixed(1)}`;
    const biggest=a.rows[0];
    root.innerHTML=`
      <div class="v147-kpis">
        <article><span>FULL MD5 ARSENAL TITLE</span><strong>${pct(a.full.title)}</strong><small>all 50 results fixed</small></article>
        <article><span>BIGGEST RIVAL DRIVER</span><strong>${esc(biggest?.club||'—')}</strong><small>${biggest?signed(biggest.arsenalTitleEffect)+' title pts':'—'}</small></article>
        <article><span>SUM OF ISOLATED EFFECTS</span><strong>${signed(a.sumEffects)} pts</strong><small>not expected to equal combined effect</small></article>
      </div>
      <table class="v147-table"><thead><tr>
        <th>RIVAL</th><th>MP</th><th>ACTUAL PTS</th><th>EXPECTED</th><th>POINT SURPRISE</th>
        <th>ARSENAL TITLE IF RIVAL RESULTS REMOVED</th><th>RIVAL EFFECT ON ARSENAL</th><th>LEVERAGE</th>
      </tr></thead><tbody>
        ${a.rows.map(r=>`<tr>
          <th>${esc(r.club)}</th><td>${r.matches}</td><td>${r.actualPts}</td><td>${r.expectedPts.toFixed(1)}</td>
          <td class="${r.surprise<0?'positive':'negative'}">${signed(r.surprise)}</td>
          <td>${pct(r.restoredTitle)}</td>
          <td class="${r.arsenalTitleEffect>0?'positive':'negative'}">${signed(r.arsenalTitleEffect)} pts</td>
          <td>${r.leverage==null?'—':r.leverage.toFixed(2)+'×'}</td>
        </tr>`).join('')}
      </tbody></table>
      <p class="v147-read"><b>${esc(biggest?.club||'The leading rival')}</b> has the largest isolated MD1–5 effect on Arsenal's title probability in this sandbox. Compare the effect column with point surprise: a major preseason contender should normally have more title leverage per dropped expected point than a weaker contender. The isolated effects overlap, so their sum is diagnostic rather than additive.</p>`;
  }

  const V146_SIMS=6000;

  function v146StandingsFromResults(baseTeams,results){
    const clubs=baseTeams.map(t=>t.club);
    return normalizeStandings(testStandingsFromResults(clubs,results));
  }

  function v146FastSim(baseTeams,allFixtures,fixedResults,seed=14605){
    const fixedIds=new Set(fixedResults.map(f=>fixtureId(f)));
    const scenarioFixtures=allFixtures.map(f=>fixedIds.has(fixtureId(f))
      ? {...f,status:'fulltime'}
      : {...f,status:'scheduled',home_score:null,away_score:null});
    const teams=v146StandingsFromResults(baseTeams,fixedResults);
    const ratings=buildRatings(teams,fixedResults);
    const byName=new Map(ratings.map(t=>[t.club.toLowerCase(),t]));
    const prepared=scenarioFixtures.filter(f=>!finished(f.status)).map(f=>{
      const home=byName.get(f.home.toLowerCase()),away=byName.get(f.away.toLowerCase());
      return home&&away?{...f,homeTeam:home,awayTeam:away,model:fixtureGoalModel(home,away)}:null;
    }).filter(Boolean);
    let titles=0, arsenalPts=0;
    const rng=rngFactory(seed);
    for(let s=0;s<V146_SIMS;s++){
      const season=new Map(ratings.map(t=>[t.club,{club:t.club,points:t.points,gd:t.gd,gf:t.gf}]));
      for(const f of prepared){
        const hs=sampleScore(f.model.homeCDF,rng),as=sampleScore(f.model.awayCDF,rng);
        const h=season.get(f.homeTeam.club),a=season.get(f.awayTeam.club);
        h.gf+=hs;a.gf+=as;h.gd+=hs-as;a.gd+=as-hs;
        if(hs>as)h.points+=3; else if(as>hs)a.points+=3; else {h.points++;a.points++;}
      }
      const rows=[...season.values()].sort((a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf||a.club.localeCompare(b.club));
      if(rows[0]?.club==='Arsenal')titles++;
      arsenalPts+=rows.find(r=>r.club==='Arsenal')?.points||0;
    }
    return {title:titles/V146_SIMS*100,expectedPoints:arsenalPts/V146_SIMS};
  }

  function v146ExpectedPointsForResult(r,baseTeams,priorResults){
    const teams=v146StandingsFromResults(baseTeams,priorResults);
    const ratings=buildRatings(teams,priorResults);
    const home=ratings.find(t=>t.club===r.home),away=ratings.find(t=>t.club===r.away);
    if(!home||!away)return 1.35;
    const model=fixtureGoalModel(home,away);
    let hp=0,ap=0;
    for(let hs=0;hs<model.homeCDF.length;hs++){
      const ph=hs===0?model.homeCDF[0]:model.homeCDF[hs]-model.homeCDF[hs-1];
      for(let as=0;as<model.awayCDF.length;as++){
        const pa=as===0?model.awayCDF[0]:model.awayCDF[as]-model.awayCDF[as-1],p=ph*pa;
        if(hs>as)hp+=3*p; else if(as>hs)ap+=3*p; else {hp+=p;ap+=p;}
      }
    }
    return {home:hp,away:ap};
  }

  function buildV146TitleSurgeAudit(currentTeams,fixtures){
    const actual=completedResults(fixtures).slice().sort((a,b)=>resultTime(a)-resultTime(b));
    if(actual.length<20)return {ready:false,count:actual.length};
    const maxMd=Math.max(...actual.map(r=>Number(r.matchday)||0));
    const through=Math.min(5,maxMd||5);
    const md5=actual.filter(r=>(Number(r.matchday)||0)<=through);
    const arsenalResults=md5.filter(r=>r.home==='Arsenal'||r.away==='Arsenal');
    const others=md5.filter(r=>r.home!=='Arsenal'&&r.away!=='Arsenal');
    const none=v146FastSim(currentTeams,fixtures,[],14600);
    const arsenalOnly=v146FastSim(currentTeams,fixtures,arsenalResults,14600);
    const othersOnly=v146FastSim(currentTeams,fixtures,others,14600);
    const full=v146FastSim(currentTeams,fixtures,md5,14600);
    const arsenalContribution=arsenalOnly.title-none.title;
    const restContribution=othersOnly.title-none.title;
    const combined=full.title-none.title;
    const interaction=combined-arsenalContribution-restContribution;

    const contenders=['Manchester City','Liverpool','Chelsea','Newcastle United','Aston Villa','Manchester United','Tottenham Hotspur'];
    const rivalRows=[];
    for(const club of contenders){
      const clubResults=md5.filter(r=>r.home===club||r.away===club).sort((a,b)=>resultTime(a)-resultTime(b));
      let prior=[];
      let actualPts=0,expectedPts=0;
      for(const r of clubResults){
        const exp=v146ExpectedPointsForResult(r,currentTeams,prior);
        const hs=Number(r.home_score),as=Number(r.away_score);
        const isHome=r.home===club;
        actualPts+=hs===as?1:(isHome?(hs>as?3:0):(as>hs?3:0));
        expectedPts+=isHome?exp.home:exp.away;
        prior.push(r);
      }
      rivalRows.push({club,matches:clubResults.length,actualPts,expectedPts,surprise:actualPts-expectedPts});
    }
    rivalRows.sort((a,b)=>a.surprise-b.surprise);
    return {ready:true,through,count:md5.length,arsenalCount:arsenalResults.length,otherCount:others.length,
      none,arsenalOnly,othersOnly,full,arsenalContribution,restContribution,combined,interaction,rivalRows};
  }

  function renderV146TitleSurgeAudit(a){
    const root=document.getElementById('v146TitleSurgeAudit'),status=document.getElementById('v146TitleSurgeStatus');
    if(!root)return;
    if(!a?.ready){
      if(status)status.textContent='WAITING FOR MD5';
      root.innerHTML=`<div class="nl4-title-model-loading">${a?.count||0} completed results found. Keep the same sandbox season through Matchday 5.</div>`;
      return;
    }
    if(status)status.textContent=`${V146_SIMS.toLocaleString()} SIMS × 4 CONTROLLED STATES`;
    const pct=n=>`${Number(n).toFixed(1)}%`, pts=n=>`${n>=0?'+':''}${Number(n).toFixed(1)} pts`;
    root.innerHTML=`
      <div class="v146-states">
        ${[
          ['UNRESOLVED CONTROL',a.none,'No MD1–5 results fixed'],
          ['ARSENAL RESULTS ONLY',a.arsenalOnly,`${a.arsenalCount} Arsenal results fixed`],
          ['OTHER 19 CLUBS ONLY',a.othersOnly,`${a.otherCount} non-Arsenal results fixed`],
          ['FULL MD5 ACTUAL',a.full,`${a.count} actual results fixed`]
        ].map(([label,v,note])=>`<article><span>${label}</span><strong>${pct(v.title)}</strong><b>${v.expectedPoints.toFixed(1)} exp pts</b><small>${note}</small></article>`).join('')}
      </div>
      <div class="v146-effects">
        <article><span>ARSENAL CONTRIBUTION</span><strong>${pts(a.arsenalContribution)}</strong></article>
        <article><span>REST-OF-LEAGUE CONTRIBUTION</span><strong>${pts(a.restContribution)}</strong></article>
        <article><span>COMBINED MOVEMENT</span><strong>${pts(a.combined)}</strong></article>
        <article><span>INTERACTION</span><strong>${pts(a.interaction)}</strong></article>
      </div>
      <h4>Contender points vs pre-match expectation</h4>
      <table class="v146-table"><thead><tr><th>CLUB</th><th>MP</th><th>ACTUAL PTS</th><th>EXPECTED PTS</th><th>SURPRISE</th></tr></thead>
      <tbody>${a.rivalRows.map(r=>`<tr><th>${esc(r.club)}</th><td>${r.matches}</td><td>${r.actualPts}</td><td>${r.expectedPts.toFixed(1)}</td><td class="${r.surprise<0?'help':'hurt'}">${r.surprise>=0?'+':''}${r.surprise.toFixed(1)}</td></tr>`).join('')}</tbody></table>
      <p class="v146-read">${Math.abs(a.restContribution)>Math.abs(a.arsenalContribution)
        ? 'The rest of the league is contributing more to Arsenal’s MD5 title movement than Arsenal’s own results.'
        : 'Arsenal’s own results are contributing at least as much as the rest of the league to the MD5 title movement.'}
        Interaction is shown separately because title probability is nonlinear.</p>`;
  }

  const V145_CHECKPOINTS=[1,5,10,15,20,25,30,34,38];

  function buildV145TransitionConsistencyAudit(currentTeams,fixtures){
    const completed=completedResults(fixtures);
    const completedCount=completed.length;
    const approxMd=Math.max(0,Math.min(38,Math.round(completedCount/10)));
    const rows=V145_CHECKPOINTS.map(md=>{
      const actual=evidenceWeights(md);
      // Expected schedule is the published V13 transition specification.
      let expectedHistorical;
      if(md<=0) expectedHistorical=1;
      else if(md<=10) expectedHistorical=1-(md/10)*0.40;
      else if(md<=20) expectedHistorical=0.60-((md-10)/10)*0.35;
      else if(md<=25) expectedHistorical=0.25-((md-20)/5)*0.10;
      else if(md<=30) expectedHistorical=0.15-((md-25)/5)*0.10;
      else if(md<34) expectedHistorical=0.05-((md-30)/4)*0.05;
      else expectedHistorical=0;
      expectedHistorical=Math.max(0,Math.min(1,expectedHistorical));
      const diff=(actual.historical-expectedHistorical)*100;
      return {
        md,
        actualHistorical:actual.historical*100,
        actualLive:actual.current*100,
        expectedHistorical:expectedHistorical*100,
        expectedLive:(1-expectedHistorical)*100,
        diff,
        completed:Math.min(380,md*10),
        remaining:Math.max(0,380-md*10)
      };
    });
    const current=evidenceWeights(approxMd);
    const maxDiff=Math.max(...rows.map(r=>Math.abs(r.diff)));
    return {
      rows,completedCount,approxMd,currentHistorical:current.historical*100,currentLive:current.current*100,
      maxDiff,
      verdict:maxDiff<0.05?'SCHEDULES IDENTICAL':'SCHEDULE MISMATCH'
    };
  }

  function renderV145TransitionConsistencyAudit(a){
    const root=document.getElementById('v145TransitionAudit');
    const status=document.getElementById('v145TransitionStatus');
    if(!root||!a)return;
    if(status)status.textContent=a.verdict;
    const fmt=v=>`${Number(v).toFixed(1)}%`;
    const diff=v=>`${v>=0?'+':''}${Number(v).toFixed(1)} pts`;
    root.innerHTML=`
      <div class="v145-current">
        <article><span>CURRENT CHECKPOINT</span><strong>MD${a.approxMd}</strong><small>${a.completedCount} league results</small></article>
        <article><span>ACTUAL MODEL HISTORY</span><strong>${fmt(a.currentHistorical)}</strong><small>read directly from evidenceWeights()</small></article>
        <article><span>ACTUAL MODEL LIVE</span><strong>${fmt(a.currentLive)}</strong><small>read directly from evidenceWeights()</small></article>
        <article><span>MAX SCHEDULE DIFFERENCE</span><strong>${diff(a.maxDiff)}</strong><small>actual vs published target</small></article>
      </div>
      <table class="v145-table">
        <thead><tr><th>CHECKPOINT</th><th>ACTUAL HIST</th><th>ACTUAL LIVE</th><th>EXPECTED HIST</th><th>EXPECTED LIVE</th><th>DIFF</th></tr></thead>
        <tbody>${a.rows.map(r=>`<tr class="${r.md===a.approxMd?'active':''}">
          <th>MD${r.md}</th><td>${fmt(r.actualHistorical)}</td><td>${fmt(r.actualLive)}</td>
          <td>${fmt(r.expectedHistorical)}</td><td>${fmt(r.expectedLive)}</td><td>${diff(r.diff)}</td>
        </tr>`).join('')}</tbody>
      </table>`;
    const note=document.getElementById('v145TransitionExplanation');
    if(note) note.textContent=a.verdict==='SCHEDULES IDENTICAL'
      ? `The validation panel is now reading the exact evidenceWeights() function used by the forecast. The published transition schedule and live model agree at every checkpoint, including the 0% historical / 100% live handover from MD34 onward.`
      : `The live forecast and published transition target disagree. Do not advance the progression test until the listed differences are resolved.`;
  }

  const V143_COMPRESSION_SIMS=12000;

  function v143RunCompression(currentTeams,fixtures,target,mode,seed){
    const preTeams=reverseCompletedResult(cloneTeamsForAudit(currentTeams),target);
    const evidenceWithout=completedResults(fixtures).filter(r=>!sameFixture(r,target));
    const rated=buildRatings(preTeams,evidenceWithout);
    const byName=new Map(rated.map(t=>[t.club,t]));
    const allFixtures=fixtures.map(f=>sameFixture(f,target)
      ? {...f,status:'scheduled',home_score:null,away_score:null}
      : {...f});
    const prepared=allFixtures.filter(f=>!finished(f.status)).map(f=>{
      const home=byName.get(f.home),away=byName.get(f.away);
      return home&&away?{...f,homeTeam:home,awayTeam:away,model:fixtureGoalModel(home,away),isTarget:sameFixture(f,target)}:null;
    }).filter(Boolean);

    const rng=rngFactory(seed>>>0);
    const clubs=['Arsenal','Manchester City','Liverpool'];
    const points=Object.fromEntries(clubs.map(c=>[c,[]]));
    const finishes=Object.fromEntries(clubs.map(c=>[c,Array(21).fill(0)]));
    const titleCounts=Object.fromEntries(clubs.map(c=>[c,0]));
    const gaps=[];
    let championPts=0, top3Span=0, top2Gap=0, titleBoundary2=0, titleBoundary4=0;

    for(let sim=0;sim<V143_COMPRESSION_SIMS;sim++){
      const season=new Map(rated.map(t=>[t.club,{club:t.club,points:t.points,gd:t.gd,gf:t.gf}]));
      for(const f of prepared){
        let hs,as;
        if(f.isTarget && mode==='actual'){
          hs=Number(target.home_score); as=Number(target.away_score);
        }else{
          hs=sampleScore(f.model.homeCDF,rng); as=sampleScore(f.model.awayCDF,rng);
        }
        const h=season.get(f.homeTeam.club),a=season.get(f.awayTeam.club);
        h.gf+=hs;a.gf+=as;h.gd+=hs-as;a.gd+=as-hs;
        if(hs>as)h.points+=3; else if(as>hs)a.points+=3; else{h.points++;a.points++;}
      }
      const table=[...season.values()].sort((a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf||a.club.localeCompare(b.club));
      championPts+=table[0].points;
      top2Gap+=table[0].points-table[1].points;
      top3Span+=table[0].points-table[2].points;
      if(table[0].points-table[1].points<=2)titleBoundary2++;
      if(table[0].points-table[1].points<=4)titleBoundary4++;
      for(const c of clubs){
        const row=season.get(c);
        if(!row)continue;
        points[c].push(row.points);
        const pos=table.findIndex(x=>x.club===c)+1;
        finishes[c][pos]++;
        if(pos===1)titleCounts[c]++;
      }
      const ars=season.get('Arsenal'), city=season.get('Manchester City'), liv=season.get('Liverpool');
      if(ars&&city&&liv){
        gaps.push({
          ac:ars.points-city.points,
          al:ars.points-liv.points,
          cl:city.points-liv.points
        });
      }
    }

    const quant=(arr,q)=>{
      const s=[...arr].sort((a,b)=>a-b);
      if(!s.length)return 0;
      return s[Math.max(0,Math.min(s.length-1,Math.floor((s.length-1)*q)))];
    };
    const sd=arr=>{
      if(!arr.length)return 0;
      const m=arr.reduce((a,b)=>a+b,0)/arr.length;
      return Math.sqrt(arr.reduce((a,b)=>a+(b-m)*(b-m),0)/arr.length);
    };
    const stats={};
    for(const c of clubs){
      const arr=points[c];
      stats[c]={
        mean:arr.reduce((a,b)=>a+b,0)/arr.length,
        sd:sd(arr),p10:quant(arr,.10),p25:quant(arr,.25),median:quant(arr,.50),p75:quant(arr,.75),p90:quant(arr,.90),
        title:titleCounts[c]/V143_COMPRESSION_SIMS*100,
        second:finishes[c][2]/V143_COMPRESSION_SIMS*100,
        third:finishes[c][3]/V143_COMPRESSION_SIMS*100
      };
    }
    const gapStats=(key)=>{
      const arr=gaps.map(x=>x[key]);
      return {mean:arr.reduce((a,b)=>a+b,0)/arr.length,sd:sd(arr),within2:arr.filter(v=>Math.abs(v)<=2).length/V143_COMPRESSION_SIMS*100,within4:arr.filter(v=>Math.abs(v)<=4).length/V143_COMPRESSION_SIMS*100};
    };
    return {
      stats,
      gaps:{arsCity:gapStats('ac'),arsLiverpool:gapStats('al'),cityLiverpool:gapStats('cl')},
      championPts:championPts/V143_COMPRESSION_SIMS,
      avgTop2Gap:top2Gap/V143_COMPRESSION_SIMS,
      avgTop3Span:top3Span/V143_COMPRESSION_SIMS,
      boundary2:titleBoundary2/V143_COMPRESSION_SIMS*100,
      boundary4:titleBoundary4/V143_COMPRESSION_SIMS*100
    };
  }

  function buildV143CompressionAudit(currentTeams,fixtures){
    const rows=completedResults(fixtures);
    const arsenal=[...rows].reverse().find(r=>r.home==='Arsenal'||r.away==='Arsenal');
    if(!arsenal)return null;
    const seed=1432026;
    return {
      target:arsenal,
      expected:v143RunCompression(currentTeams,fixtures,arsenal,'expected',seed),
      actual:v143RunCompression(currentTeams,fixtures,arsenal,'actual',seed),
      simulations:V143_COMPRESSION_SIMS
    };
  }

  function renderV143CompressionAudit(a){
    const root=document.getElementById('v143CompressionAudit');
    const status=document.getElementById('v143CompressionStatus');
    if(!root)return;
    if(!a){
      root.innerHTML='<div class="nl4-title-model-loading">Need a completed Arsenal result.</div>';
      if(status)status.textContent='WAITING FOR RESULT';
      return;
    }
    if(status)status.textContent=`${a.simulations.toLocaleString()} PAIRED SIMULATIONS`;
    const e=a.expected,c=a.actual;
    const f=v=>Number(v).toFixed(1);
    const pct=v=>`${f(v)}%`;
    const signed=v=>`${v>=0?'+':''}${f(v)}`;
    const clubRow=(club,label)=>{
      const x=e.stats[club],y=c.stats[club];
      return `<tr>
        <th>${label}</th>
        <td>${f(x.mean)} → ${f(y.mean)}</td>
        <td>${f(x.sd)} → ${f(y.sd)}</td>
        <td>${x.p25}–${x.p75} → ${y.p25}–${y.p75}</td>
        <td>${pct(x.title)} → ${pct(y.title)}</td>
        <td>${pct(x.second)} → ${pct(y.second)}</td>
      </tr>`;
    };
    const gapRow=(label,key)=>{
      const x=e.gaps[key],y=c.gaps[key];
      return `<tr>
        <th>${label}</th>
        <td>${signed(x.mean)} → ${signed(y.mean)}</td>
        <td>${f(x.sd)} → ${f(y.sd)}</td>
        <td>${pct(x.within2)} → ${pct(y.within2)}</td>
        <td>${pct(x.within4)} → ${pct(y.within4)}</td>
      </tr>`;
    };

    root.innerHTML=`
      <div class="v143-kpis">
        <article><span>TITLE DECIDED WITHIN 2 PTS</span><strong>${pct(e.boundary2)} → ${pct(c.boundary2)}</strong></article>
        <article><span>TITLE DECIDED WITHIN 4 PTS</span><strong>${pct(e.boundary4)} → ${pct(c.boundary4)}</strong></article>
        <article><span>AVG 1ST–2ND GAP</span><strong>${f(e.avgTop2Gap)} → ${f(c.avgTop2Gap)}</strong></article>
        <article><span>AVG 1ST–3RD SPAN</span><strong>${f(e.avgTop3Span)} → ${f(c.avgTop3Span)}</strong></article>
      </div>
      <h4>Contender Final-Points Distributions</h4>
      <table class="v143-table"><thead><tr><th>CLUB</th><th>MEAN PTS</th><th>PTS SD</th><th>MIDDLE 50%</th><th>TITLE</th><th>2ND</th></tr></thead><tbody>
        ${clubRow('Arsenal','Arsenal')}
        ${clubRow('Manchester City','Manchester City')}
        ${clubRow('Liverpool','Liverpool')}
      </tbody></table>
      <h4>Head-to-Head Points Compression</h4>
      <table class="v143-table"><thead><tr><th>PAIR</th><th>AVG GAP</th><th>GAP SD</th><th>WITHIN ±2</th><th>WITHIN ±4</th></tr></thead><tbody>
        ${gapRow('Arsenal − City','arsCity')}
        ${gapRow('Arsenal − Liverpool','arsLiverpool')}
        ${gapRow('City − Liverpool','cityLiverpool')}
      </tbody></table>
      <div class="v143-foot">
        <span>CHAMPION AVG <b>${f(e.championPts)} → ${f(c.championPts)}</b></span>
        <span>ARSENAL TITLE <b>${pct(e.stats.Arsenal.title)} → ${pct(c.stats.Arsenal.title)}</b></span>
      </div>`;
    const note=document.getElementById('v143CompressionExplanation');
    if(note){
      note.textContent=`This audit asks whether the title race itself is too tightly packed. A high share of champions finishing within 2–4 points of second, unusually narrow contender point distributions, or very high Arsenal/City/Liverpool proximity would explain why a +0.70 expected-points surprise can move title probability by several points. No calibration is applied here.`;
    }
  }

  const V142_BOUNDARY_SIMS=10000;

  function v142RunArsenalBoundary(currentTeams,fixtures,target,mode,seed){
    const preTeams=reverseCompletedResult(cloneTeamsForAudit(currentTeams),target);
    const evidenceWithout=completedResults(fixtures).filter(r=>!sameFixture(r,target));
    const rated=buildRatings(preTeams,evidenceWithout);
    const byName=new Map(rated.map(t=>[t.club,t]));
    const allFixtures=fixtures.map(f=>sameFixture(f,target)?{...f,status:'scheduled',home_score:null,away_score:null}:{...f});
    const prepared=allFixtures.filter(f=>!finished(f.status)).map(f=>{
      const home=byName.get(f.home),away=byName.get(f.away);
      return home&&away?{...f,homeTeam:home,awayTeam:away,model:fixtureGoalModel(home,away),isTarget:sameFixture(f,target)}:null;
    }).filter(Boolean);

    const rng=rngFactory(seed>>>0);
    const finishCounts=Array(21).fill(0);
    const marginBins={win5:0,win34:0,win12:0,tieWin:0,tieLose:0,lose12:0,lose34:0,lose5:0};
    let titles=0, ptsSum=0, championPtsSum=0, tiedOnPoints=0, titleByGd=0;
    const titleFlags=new Uint8Array(V142_BOUNDARY_SIMS);

    for(let sim=0;sim<V142_BOUNDARY_SIMS;sim++){
      const season=new Map(rated.map(t=>[t.club,{club:t.club,points:t.points,gd:t.gd,gf:t.gf}]));
      for(const f of prepared){
        let hs,as;
        if(f.isTarget && mode==='actual'){
          hs=Number(target.home_score); as=Number(target.away_score);
        } else {
          hs=sampleScore(f.model.homeCDF,rng); as=sampleScore(f.model.awayCDF,rng);
        }
        const h=season.get(f.homeTeam.club),a=season.get(f.awayTeam.club);
        h.gf+=hs;a.gf+=as;h.gd+=hs-as;a.gd+=as-hs;
        if(hs>as)h.points+=3; else if(as>hs)a.points+=3; else{h.points++;a.points++;}
      }
      const table=[...season.values()].sort((a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf||a.club.localeCompare(b.club));
      const pos=table.findIndex(x=>x.club==='Arsenal')+1;
      finishCounts[pos]++;
      const arsenal=season.get('Arsenal'), champ=table[0];
      ptsSum+=arsenal.points; championPtsSum+=champ.points;
      const won=pos===1;
      if(won){titles++;titleFlags[sim]=1;}
      const bestOther=table.find(x=>x.club!=='Arsenal');
      const margin=arsenal.points-bestOther.points;
      if(margin>=5)marginBins.win5++;
      else if(margin>=3)marginBins.win34++;
      else if(margin>=1)marginBins.win12++;
      else if(margin===0){
        tiedOnPoints++;
        if(won){marginBins.tieWin++;titleByGd++;} else marginBins.tieLose++;
      } else if(margin>=-2)marginBins.lose12++;
      else if(margin>=-4)marginBins.lose34++;
      else marginBins.lose5++;
    }
    return {titleProb:titles/V142_BOUNDARY_SIMS*100,finishCounts,marginBins,pts:ptsSum/V142_BOUNDARY_SIMS,
      championPts:championPtsSum/V142_BOUNDARY_SIMS,tiedOnPoints,titleByGd,titleFlags};
  }

  function buildV142BoundaryAudit(currentTeams,fixtures){
    const rows=completedResults(fixtures);
    const arsenal=[...rows].reverse().find(r=>r.home==='Arsenal'||r.away==='Arsenal');
    if(!arsenal)return null;
    const seed=1422026;
    const expected=v142RunArsenalBoundary(currentTeams,fixtures,arsenal,'expected',seed);
    const actual=v142RunArsenalBoundary(currentTeams,fixtures,arsenal,'actual',seed);
    let flippedToTitle=0,flippedFromTitle=0;
    for(let i=0;i<V142_BOUNDARY_SIMS;i++){
      if(!expected.titleFlags[i]&&actual.titleFlags[i])flippedToTitle++;
      if(expected.titleFlags[i]&&!actual.titleFlags[i])flippedFromTitle++;
    }
    return {target:arsenal,expected,actual,flippedToTitle,flippedFromTitle,netFlips:flippedToTitle-flippedFromTitle,simulations:V142_BOUNDARY_SIMS};
  }

  function renderV142BoundaryAudit(a){
    const root=document.getElementById('v142BoundaryAudit'),status=document.getElementById('v142BoundaryStatus');
    if(!root)return;
    if(!a){root.innerHTML='<div class="nl4-title-model-loading">Need a completed Arsenal result.</div>';if(status)status.textContent='WAITING FOR RESULT';return;}
    if(status)status.textContent=`${a.simulations.toLocaleString()} PAIRED SIMULATIONS`;
    const p=(n)=>`${(100*n/a.simulations).toFixed(1)}%`;
    const pp=v=>`${Number(v).toFixed(1)}%`;
    const delta=(x,y)=>`${x-y>=0?'+':''}${(x-y).toFixed(1)} pts`;
    const e=a.expected,c=a.actual;
    setText('v142NetFlips',a.netFlips.toLocaleString());
    setText('v142TitleDelta',delta(c.titleProb,e.titleProb));
    setText('v142GdTitles',(c.titleByGd-e.titleByGd).toLocaleString());
    setText('v142ChampionDelta',(c.championPts-e.championPts).toFixed(2));

    const row=(label,key)=>`<tr><th>${label}</th><td>${p(e.marginBins[key])}</td><td>${p(c.marginBins[key])}</td><td>${((c.marginBins[key]-e.marginBins[key])*100/a.simulations>=0?'+':'')+((c.marginBins[key]-e.marginBins[key])*100/a.simulations).toFixed(1)} pts</td></tr>`;
    root.innerHTML=`
      <div class="v142-top">
        <article><span>PRE-MATCH TITLE</span><strong>${pp(e.titleProb)}</strong></article>
        <article><span>ACTUAL 3–0 TITLE</span><strong>${pp(c.titleProb)}</strong></article>
        <article><span>1ST → ACTUAL</span><strong>${p(c.finishCounts[1])}</strong></article>
        <article><span>2ND → ACTUAL</span><strong>${p(c.finishCounts[2])}</strong></article>
        <article><span>3RD → ACTUAL</span><strong>${p(c.finishCounts[3])}</strong></article>
      </div>
      <div class="v142-flips">
        <div><span>FLIPPED INTO TITLE</span><strong>${a.flippedToTitle.toLocaleString()}</strong></div>
        <div><span>FLIPPED OUT OF TITLE</span><strong>${a.flippedFromTitle.toLocaleString()}</strong></div>
        <div><span>NET TITLE FLIPS</span><strong>${a.netFlips.toLocaleString()}</strong></div>
        <div><span>ACTUAL GD TIE TITLES</span><strong>${c.titleByGd.toLocaleString()}</strong><small>${p(c.titleByGd)} of sims</small></div>
      </div>
      <table class="v142-table"><thead><tr><th>ARSENAL VS BEST RIVAL</th><th>PRE-MATCH</th><th>ACTUAL</th><th>SHIFT</th></tr></thead><tbody>
        ${row('Win by 5+ pts','win5')}${row('Win by 3–4','win34')}${row('Win by 1–2','win12')}
        ${row('Level pts • Arsenal wins tie','tieWin')}${row('Level pts • Arsenal loses tie','tieLose')}
        ${row('Lose by 1–2','lose12')}${row('Lose by 3–4','lose34')}${row('Lose by 5+','lose5')}
      </tbody></table>
      <div class="v142-env">
        <span>ARSENAL EXPECTED PTS <b>${e.pts.toFixed(2)} → ${c.pts.toFixed(2)}</b></span>
        <span>CHAMPION AVG <b>${e.championPts.toFixed(2)} → ${c.championPts.toFixed(2)}</b></span>
        <span>TIED ON POINTS <b>${p(e.tiedOnPoints)} → ${p(c.tiedOnPoints)}</b></span>
      </div>`;
    const note=document.getElementById('v142BoundaryExplanation');
    if(note)note.textContent=`Across ${a.simulations.toLocaleString()} paired seasons, locking Arsenal's 3–0 result creates ${a.flippedToTitle.toLocaleString()} new title wins and removes ${a.flippedFromTitle.toLocaleString()} previous title wins, a net ${a.netFlips.toLocaleString()} simulations. The margin table shows whether those flips are concentrated around 0–2 points and whether goal-difference tie-breaks are materially responsible.`;
  }

  const V141_EXPECTED_ACTUAL_SIMS=8000;

  function v141RunWeightedOutcome(currentTeams,fixtures,target,focusClub,mode,seed){
    // Reconstruct the fixture before its result. For EXPECTED, simulate that
    // fixture normally. For ACTUAL, lock the observed score. Other completed
    // sandbox results remain exactly as they are.
    const preTeams=reverseCompletedResult(cloneTeamsForAudit(currentTeams),target);
    const evidenceWithout=completedResults(fixtures).filter(r=>!sameFixture(r,target));
    const rated=buildRatings(preTeams,evidenceWithout);
    const byName=new Map(rated.map(t=>[t.club,t]));

    const allFixtures=fixtures.map(f=>sameFixture(f,target)
      ? {...f,status:'scheduled',home_score:null,away_score:null}
      : {...f});
    const remaining=allFixtures.filter(f=>!finished(f.status));
    const prepared=remaining.map(f=>{
      const home=byName.get(f.home),away=byName.get(f.away);
      if(!home||!away)return null;
      return {...f,homeTeam:home,awayTeam:away,model:fixtureGoalModel(home,away),isTarget:sameFixture(f,target)};
    }).filter(Boolean);

    const rng=rngFactory(seed>>>0);
    let titles=0,arsenalPts=0;
    for(let sim=0;sim<V141_EXPECTED_ACTUAL_SIMS;sim++){
      const season=new Map(rated.map(t=>[t.club,{club:t.club,points:t.points,gd:t.gd,gf:t.gf}]));
      for(const f of prepared){
        let hs,as;
        if(f.isTarget && mode==='actual'){
          hs=Number(target.home_score); as=Number(target.away_score);
        }else{
          hs=sampleScore(f.model.homeCDF,rng); as=sampleScore(f.model.awayCDF,rng);
        }
        const h=season.get(f.homeTeam.club),a=season.get(f.awayTeam.club);
        h.gf+=hs;a.gf+=as;h.gd+=hs-as;a.gd+=as-hs;
        if(hs>as)h.points+=3; else if(as>hs)a.points+=3; else{h.points++;a.points++;}
      }
      const table=[...season.values()].sort((a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf||a.club.localeCompare(b.club));
      if(table[0]?.club==='Arsenal')titles++;
      arsenalPts+=season.get('Arsenal')?.points||0;
    }
    return {titleProb:titles/V141_EXPECTED_ACTUAL_SIMS*100,expectedPoints:arsenalPts/V141_EXPECTED_ACTUAL_SIMS};
  }

  function v141One(currentTeams,fixtures,target,focusClub,seed){
    const expectation=v140FixtureExpectation(currentTeams,fixtures,target,focusClub);
    if(!expectation)return null;
    // Common seed makes the two season simulations directly comparable.
    const expected=v141RunWeightedOutcome(currentTeams,fixtures,target,focusClub,'expected',seed);
    const actual=v141RunWeightedOutcome(currentTeams,fixtures,target,focusClub,'actual',seed);
    return {
      focusClub,target,expectation,expected,actual,
      titleSurprise:actual.titleProb-expected.titleProb,
      arsenalPtsChange:actual.expectedPoints-expected.expectedPoints
    };
  }

  function buildV141ExpectedActualAudit(currentTeams,fixtures){
    const rows=completedResults(fixtures).slice().sort((a,b)=>resultTime(a)-resultTime(b));
    const arsenal=[...rows].reverse().find(r=>r.home==='Arsenal'||r.away==='Arsenal');
    const city=[...rows].reverse().find(r=>r.home==='Manchester City'||r.away==='Manchester City');
    if(!arsenal||!city)return null;
    return {
      arsenal:v141One(currentTeams,fixtures,arsenal,'Arsenal',1411001),
      city:v141One(currentTeams,fixtures,city,'Manchester City',1412001),
      simulations:V141_EXPECTED_ACTUAL_SIMS
    };
  }

  function renderV141ExpectedActualAudit(audit){
    const root=document.getElementById('v141ExpectedActualAudit');
    const status=document.getElementById('v141ExpectedActualStatus');
    if(!root)return;
    if(!audit?.arsenal||!audit?.city){
      root.innerHTML='<div class="nl4-title-model-loading">Need completed Arsenal and Manchester City results.</div>';
      if(status)status.textContent='WAITING FOR RESULTS';
      return;
    }
    if(status)status.textContent=`${audit.simulations.toLocaleString()} SIMS × 2 STATES / RESULT`;
    const pct=v=>`${Number(v).toFixed(1)}%`;
    const d=v=>`${Number(v)>=0?'+':''}${Number(v).toFixed(1)} pts`;
    const d2=v=>`${Number(v)>=0?'+':''}${Number(v).toFixed(2)}`;
    const score=f=>`${f.home} ${f.home_score}–${f.away_score} ${f.away}`;

    const card=x=>`
      <article class="v141-card">
        <div class="v141-card-head">
          <div><span>${esc(x.focusClub.toUpperCase())}</span><strong>${esc(score(x.target))}</strong></div>
          <b>${d(x.titleSurprise)} TITLE SURPRISE</b>
        </div>
        <div class="v141-two-state">
          <div><span>PRE-MATCH DISTRIBUTION</span><strong>${pct(x.expected.titleProb)}</strong><small>Fixture resolved naturally from its W/D/L + score distribution</small></div>
          <div><span>ACTUAL RESULT LOCKED</span><strong>${pct(x.actual.titleProb)}</strong><small>Observed score replaces that expected distribution</small></div>
        </div>
        <div class="v141-metrics">
          <div><span>FIXTURE EXPECTED PTS</span><strong>${x.expectation.expectedPoints.toFixed(2)}</strong></div>
          <div><span>ACTUAL PTS</span><strong>${x.expectation.actualPoints}</strong></div>
          <div><span>POINT SURPRISE</span><strong>${d2(x.expectation.pointSurprise)}</strong></div>
          <div><span>TITLE SURPRISE</span><strong>${d(x.titleSurprise)}</strong></div>
          <div><span>ARSENAL EXP-PTS CHANGE</span><strong>${d2(x.arsenalPtsChange)}</strong></div>
        </div>
      </article>`;

    root.innerHTML=card(audit.arsenal)+card(audit.city);
    setText('v141ArsenalTitleSurprise',d(audit.arsenal.titleSurprise));
    setText('v141CityTitleSurprise',d(audit.city.titleSurprise));
    setText('v141ArsenalPointSurprise',d2(audit.arsenal.expectation.pointSurprise));
    setText('v141CityPointSurprise',d2(audit.city.expectation.pointSurprise));

    const note=document.getElementById('v141ExpectedActualExplanation');
    if(note){
      note.textContent=`This removes the ordinary value of completing a fixture. Arsenal's actual result is compared directly with the model's own pre-match score distribution, and City's result is treated the same way. The resulting title-surprise numbers are the probability movement attributable to outperforming or underperforming pre-match expectation, not merely banking a completed match.`;
    }
  }

  function poissonOutcomeProbabilities(model){
    let homeWin=0,draw=0,awayWin=0,homeGoals=0,awayGoals=0;
    for(let hs=0;hs<model.homeCDF.length;hs++){
      const hp=hs===0?model.homeCDF[0]:model.homeCDF[hs]-model.homeCDF[hs-1];
      homeGoals+=hs*hp;
      for(let as=0;as<model.awayCDF.length;as++){
        const ap=as===0?model.awayCDF[0]:model.awayCDF[as]-model.awayCDF[as-1];
        if(hs>as)homeWin+=hp*ap; else if(hs===as)draw+=hp*ap; else awayWin+=hp*ap;
      }
    }
    for(let as=0;as<model.awayCDF.length;as++){
      const ap=as===0?model.awayCDF[0]:model.awayCDF[as]-model.awayCDF[as-1];
      awayGoals+=as*ap;
    }
    const total=homeWin+draw+awayWin||1;
    return {homeWin:homeWin/total,draw:draw/total,awayWin:awayWin/total,
      expectedHomeGoals:homeGoals,expectedAwayGoals:awayGoals};
  }

  function v140FixtureExpectation(currentTeams,fixtures,target,focusClub){
    if(!target)return null;
    const preTeams=reverseCompletedResult(cloneTeamsForAudit(currentTeams),target);
    const evidence=completedResults(fixtures).filter(r=>!sameFixture(r,target));
    const rated=buildRatings(preTeams,evidence);
    const home=rated.find(t=>t.club===target.home),away=rated.find(t=>t.club===target.away);
    if(!home||!away)return null;
    const model=fixtureGoalModel(home,away),p=poissonOutcomeProbabilities(model);
    const focusHome=target.home===focusClub;
    const winProb=focusHome?p.homeWin:p.awayWin,drawProb=p.draw,lossProb=focusHome?p.awayWin:p.homeWin;
    const expectedPoints=3*winProb+drawProb;
    const fg=focusHome?Number(target.home_score):Number(target.away_score);
    const ag=focusHome?Number(target.away_score):Number(target.home_score);
    const actualPoints=fg>ag?3:fg===ag?1:0;
    const expectedGD=focusHome?p.expectedHomeGoals-p.expectedAwayGoals:p.expectedAwayGoals-p.expectedHomeGoals;
    const actualGD=fg-ag,actualOutcomeProb=actualPoints===3?winProb:actualPoints===1?drawProb:lossProb;
    const rarity=actualOutcomeProb<.10?'VERY UNLIKELY':actualOutcomeProb<.20?'UNLIKELY':actualOutcomeProb<.35?'NOT EXPECTED':actualOutcomeProb<.55?'PLAUSIBLE':'EXPECTED';
    return {focusClub,target,winProb,drawProb,lossProb,expectedPoints,actualPoints,
      pointSurprise:actualPoints-expectedPoints,expectedGD,actualGD,gdSurprise:actualGD-expectedGD,
      expectedGoalsFor:focusHome?p.expectedHomeGoals:p.expectedAwayGoals,
      expectedGoalsAgainst:focusHome?p.expectedAwayGoals:p.expectedHomeGoals,actualOutcomeProb,rarity};
  }

  function buildV140SurpriseAudit(currentTeams,fixtures){
    const rows=completedResults(fixtures).slice().sort((a,b)=>resultTime(a)-resultTime(b));
    const arsenal=[...rows].reverse().find(r=>r.home==='Arsenal'||r.away==='Arsenal');
    const city=[...rows].reverse().find(r=>r.home==='Manchester City'||r.away==='Manchester City');
    if(!arsenal||!city)return null;
    return {arsenal:v140FixtureExpectation(currentTeams,fixtures,arsenal,'Arsenal'),
      city:v140FixtureExpectation(currentTeams,fixtures,city,'Manchester City')};
  }

  function renderV140SurpriseAudit(audit){
    const root=document.getElementById('v140SurpriseAudit'),status=document.getElementById('v140SurpriseStatus');
    if(!root)return;
    if(!audit?.arsenal||!audit?.city){
      root.innerHTML='<div class="nl4-title-model-loading">Need completed Arsenal and Manchester City results.</div>';
      if(status)status.textContent='WAITING FOR RESULTS'; return;
    }
    if(status)status.textContent='PRE-MATCH EXPECTATION RECONSTRUCTED';
    const pct=v=>`${(Number(v)*100).toFixed(1)}%`,num=v=>`${Number(v)>=0?'+':''}${Number(v).toFixed(2)}`;
    const score=f=>`${f.home} ${f.home_score}–${f.away_score} ${f.away}`;
    const card=x=>`
      <article class="v140-card">
        <div class="v140-card-head"><div><span>${esc(x.focusClub.toUpperCase())}</span><strong>${esc(score(x.target))}</strong></div><b>${esc(x.rarity)} • ${pct(x.actualOutcomeProb)}</b></div>
        <div class="v140-wdl"><div><span>WIN</span><strong>${pct(x.winProb)}</strong></div><div><span>DRAW</span><strong>${pct(x.drawProb)}</strong></div><div><span>LOSS</span><strong>${pct(x.lossProb)}</strong></div></div>
        <div class="v140-metrics">
          <div><span>EXPECTED POINTS</span><strong>${x.expectedPoints.toFixed(2)}</strong></div><div><span>ACTUAL POINTS</span><strong>${x.actualPoints}</strong></div><div><span>POINTS SURPRISE</span><strong>${num(x.pointSurprise)}</strong></div>
          <div><span>EXPECTED GD</span><strong>${num(x.expectedGD)}</strong></div><div><span>ACTUAL GD</span><strong>${x.actualGD>=0?'+':''}${x.actualGD}</strong></div><div><span>GD SURPRISE</span><strong>${num(x.gdSurprise)}</strong></div>
        </div><small>Expected score environment: ${x.expectedGoalsFor.toFixed(2)}–${x.expectedGoalsAgainst.toFixed(2)} for ${esc(x.focusClub)}.</small>
      </article>`;
    root.innerHTML=card(audit.arsenal)+card(audit.city);
    setText('v140ArsenalExpectedPts',audit.arsenal.expectedPoints.toFixed(2));
    setText('v140ArsenalSurprise',num(audit.arsenal.pointSurprise));
    setText('v140CityExpectedPts',audit.city.expectedPoints.toFixed(2));
    setText('v140CitySurprise',num(audit.city.pointSurprise));
    const e=document.getElementById('v140SurpriseExplanation');
    if(e)e.textContent=`Before its result was fixed, Arsenal were worth ${audit.arsenal.expectedPoints.toFixed(2)} expected points; the actual result created a ${num(audit.arsenal.pointSurprise)}-point surprise. Manchester City were worth ${audit.city.expectedPoints.toFixed(2)} expected points; their actual result created a ${num(audit.city.pointSurprise)}-point surprise.`;
  }

  const V139_DECOMP_SIMS=6000;

  function v139RunState(baseTeams,fixtures,target,mode,seed){
    // mode:
    // pre      = result removed from table AND evidence; fixture unresolved
    // points   = result banked in table, but evidence ratings are pre-result
    // evidence = result removed from table/fixture unresolved, but evidence includes result
    // full     = result banked and evidence includes result
    const currentEvidence=completedResults(fixtures);
    const preTeams=reverseCompletedResult(cloneTeamsForAudit(baseTeams),target);
    const evidenceWithout=currentEvidence.filter(r=>!sameFixture(r,target));

    let startingTeams,evidence,cfFixtures;
    if(mode==='pre'){
      startingTeams=preTeams;
      evidence=evidenceWithout;
      cfFixtures=fixtures.map(f=>sameFixture(f,target)?{...f,status:'scheduled',home_score:null,away_score:null}:{...f});
    }else if(mode==='points'){
      startingTeams=cloneTeamsForAudit(baseTeams);
      evidence=evidenceWithout;
      cfFixtures=fixtures.map(f=>({...f}));
    }else if(mode==='evidence'){
      startingTeams=preTeams;
      evidence=currentEvidence;
      cfFixtures=fixtures.map(f=>sameFixture(f,target)?{...f,status:'scheduled',home_score:null,away_score:null}:{...f});
    }else{
      startingTeams=cloneTeamsForAudit(baseTeams);
      evidence=currentEvidence;
      cfFixtures=fixtures.map(f=>({...f}));
    }

    const rated=buildRatings(startingTeams,evidence);
    const byName=new Map(rated.map(t=>[t.club,t]));
    const remaining=cfFixtures.filter(f=>!finished(f.status));
    const prepared=remaining.map(f=>{
      const home=byName.get(f.home),away=byName.get(f.away);
      return home&&away?{...f,homeTeam:home,awayTeam:away,model:fixtureGoalModel(home,away)}:null;
    }).filter(Boolean);

    const rng=rngFactory(seed>>>0);
    let titles=0,pts=0;
    for(let sim=0;sim<V139_DECOMP_SIMS;sim++){
      const season=new Map(rated.map(t=>[t.club,{club:t.club,points:t.points,gd:t.gd,gf:t.gf}]));
      for(const f of prepared){
        const hs=sampleScore(f.model.homeCDF,rng),as=sampleScore(f.model.awayCDF,rng);
        const h=season.get(f.homeTeam.club),a=season.get(f.awayTeam.club);
        h.gf+=hs;a.gf+=as;h.gd+=hs-as;a.gd+=as-hs;
        if(hs>as)h.points+=3; else if(as>hs)a.points+=3; else{h.points++;a.points++;}
      }
      const table=[...season.values()].sort((a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf||a.club.localeCompare(b.club));
      if(table[0]?.club==='Arsenal')titles++;
      pts+=season.get('Arsenal')?.points||0;
    }
    return {titleProb:titles/V139_DECOMP_SIMS*100,expectedPoints:pts/V139_DECOMP_SIMS};
  }

  function v139DecomposeResult(currentTeams,fixtures,target,label,seed){
    if(!target)return null;
    const pre=v139RunState(currentTeams,fixtures,target,'pre',seed);
    const points=v139RunState(currentTeams,fixtures,target,'points',seed);
    const evidence=v139RunState(currentTeams,fixtures,target,'evidence',seed);
    const full=v139RunState(currentTeams,fixtures,target,'full',seed);

    const banked=points.titleProb-pre.titleProb;
    const evidenceOnly=evidence.titleProb-pre.titleProb;
    const total=full.titleProb-pre.titleProb;
    const interaction=total-banked-evidenceOnly;
    return {label,target,pre,points,evidence,full,banked,evidenceOnly,total,interaction};
  }

  function buildV139Decomposition(currentTeams,fixtures){
    const finishedRows=completedResults(fixtures).slice().sort((a,b)=>resultTime(a)-resultTime(b));
    const arsenal=[...finishedRows].reverse().find(r=>r.home==='Arsenal'||r.away==='Arsenal');
    const city=[...finishedRows].reverse().find(r=>r.home==='Manchester City'||r.away==='Manchester City');
    if(!arsenal||!city)return null;
    return {
      arsenal:v139DecomposeResult(currentTeams,fixtures,arsenal,'Arsenal result',1391001),
      city:v139DecomposeResult(currentTeams,fixtures,city,'Manchester City result',1392001),
      simulations:V139_DECOMP_SIMS
    };
  }

  function renderV139Decomposition(audit){
    const root=document.getElementById('v139Decomposition');
    const status=document.getElementById('v139DecompositionStatus');
    if(!root)return;
    if(!audit?.arsenal||!audit?.city){
      root.innerHTML='<div class="nl4-title-model-loading">Need completed Arsenal and Manchester City results.</div>';
      if(status)status.textContent='WAITING FOR RESULTS';
      return;
    }
    if(status)status.textContent=`${audit.simulations.toLocaleString()} SIMS × 4 STATES / RESULT`;

    const pct=v=>`${Number(v).toFixed(1)}%`;
    const d=v=>`${Number(v)>=0?'+':''}${Number(v).toFixed(1)} pts`;
    const score=f=>`${f.home} ${f.home_score}–${f.away_score} ${f.away}`;

    const renderOne=x=>`
      <article class="v139-result-card">
        <div class="v139-result-head">
          <div><span>${esc(x.label.toUpperCase())}</span><strong>${esc(score(x.target))}</strong></div>
          <b>TOTAL ${d(x.total)}</b>
        </div>
        <div class="v139-state-grid">
          <div><span>PRE-RESULT</span><strong>${pct(x.pre.titleProb)}</strong><small>${x.pre.expectedPoints.toFixed(1)} exp pts</small></div>
          <div><span>POINTS ONLY</span><strong>${pct(x.points.titleProb)}</strong><small>${x.points.expectedPoints.toFixed(1)} exp pts</small></div>
          <div><span>EVIDENCE ONLY</span><strong>${pct(x.evidence.titleProb)}</strong><small>${x.evidence.expectedPoints.toFixed(1)} exp pts</small></div>
          <div><span>FULL ACTUAL</span><strong>${pct(x.full.titleProb)}</strong><small>${x.full.expectedPoints.toFixed(1)} exp pts</small></div>
        </div>
        <div class="v139-effect-grid">
          <div><span>BANKED RESULT EFFECT</span><strong>${d(x.banked)}</strong></div>
          <div><span>EVIDENCE EFFECT</span><strong>${d(x.evidenceOnly)}</strong></div>
          <div><span>INTERACTION</span><strong>${d(x.interaction)}</strong></div>
        </div>
      </article>`;

    root.innerHTML=renderOne(audit.arsenal)+renderOne(audit.city);

    setText('v139ArsenalBanked',d(audit.arsenal.banked));
    setText('v139ArsenalEvidence',d(audit.arsenal.evidenceOnly));
    setText('v139CityBanked',d(audit.city.banked));
    setText('v139CityEvidence',d(audit.city.evidenceOnly));

    const note=document.getElementById('v139DecompositionExplanation');
    if(note){
      note.textContent=`Arsenal: ${d(audit.arsenal.banked)} from banking the result versus ${d(audit.arsenal.evidenceOnly)} from allowing that match into V13 evidence. Manchester City: ${d(audit.city.banked)} from banking the result versus ${d(audit.city.evidenceOnly)} from new evidence. Interaction terms capture the non-additive overlap between points and evidence.`;
    }
  }

  function renderV138SensitivityAudit(audit){
    const el=document.getElementById('v138SensitivityAudit');
    if(!el)return;
    const status=document.getElementById('v138SensitivityStatus');
    if(!audit){
      el.innerHTML='<div class="nl4-title-model-loading">Need completed Arsenal and Manchester City results in the same test state.</div>';
      if(status)status.textContent='WAITING FOR RESULTS';
      return;
    }

    const pct=v=>`${Number(v).toFixed(1)}%`;
    const delta=v=>`${Number(v)>=0?'+':''}${Number(v).toFixed(1)} pts`;
    const score=f=>`${f.home} ${f.home_score}–${f.away_score} ${f.away}`;

    setText('v138ArsenalResult',score(audit.arsenalResult));
    setText('v138CityResult',score(audit.cityResult));
    setText('v138ArsenalEffect',delta(audit.arsenalEffect));
    setText('v138CityEffect',delta(audit.cityEffect));
    setText('v138CombinedEffect',delta(audit.combinedEffect));
    setText('v138Interaction',delta(audit.interaction));
    if(status)status.textContent=`${audit.simulations.toLocaleString()} SIMS × 4 CONTROLLED STATES`;

    const states=[
      ['NEITHER FIXED','Both Arsenal and City fixtures unresolved',audit.neither],
      ['ARSENAL ONLY','Arsenal result fixed • City unresolved',audit.arsenalOnly],
      ['CITY ONLY','City result fixed • Arsenal unresolved',audit.cityOnly],
      ['ACTUAL','Both real test results fixed',audit.actual]
    ];
    el.innerHTML=states.map(([label,note,r])=>`
      <article class="v138-state ${label==='ACTUAL'?'actual':''}">
        <span>${esc(label)}</span>
        <strong>${pct(r.titleProb)}</strong>
        <small>${esc(note)}</small>
        <b>${r.expectedPoints.toFixed(1)} exp pts</b>
      </article>`).join('');

    const explanation=document.getElementById('v138SensitivityExplanation');
    if(explanation){
      explanation.textContent=
        `With the other eight Matchday 1 results held fixed, Arsenal's result contributes about ${delta(audit.arsenalEffect)} relative to leaving both headline fixtures unresolved. City's result contributes about ${delta(audit.cityEffect)}. Together they move the controlled forecast ${delta(audit.combinedEffect)}. The remaining ${delta(audit.interaction)} is interaction/non-additivity between the two results.`;
    }
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



  let NL4_PUBLIC_CANONICAL=null;
  let NL4_PUBLIC_CONTEXT=null;
  let NL4_PUBLISHED_INTERPRETATION=null;
  let NL4_LAST_PUBLIC_HISTORY=[];
  let NL4_LAST_PUBLIC_ARSENAL=null;
  let NL4_LAST_PUBLIC_COMPLETED=0;

  function nl4CanonicalPct(value){
    return `${Number(value||0).toFixed(1)}%`;
  }

  function syncVisiblePublicProbability(){
    if(!NL4_PUBLIC_CANONICAL)return;

    const C=NL4_PUBLIC_CANONICAL;
    const values={
      title:nl4CanonicalPct(C.titleProbability),
      top4:nl4CanonicalPct(C.top4Probability),
      top5:nl4CanonicalPct(C.top5Probability),
      points:C.expectedPoints.toFixed(1),
      finish:C.expectedPosition.toFixed(1)
    };

    const headline=document.getElementById('nl4InterpretationHeadline');
    if(headline)headline.textContent=`NL4 model: Arsenal ${values.title} for the title`;

    const summary=document.getElementById('nl4InterpretationSummary');
    if(summary && summary.textContent){
      summary.textContent=summary.textContent
        .replace(/(current NL4\s+title probability is\s+)\d+(?:\.\d+)?%/i,`$1${values.title}`)
        .replace(/(Arsenal(?:'s)?\s+title (?:probability|chance)(?:\s+is|\s*:)?\s*)\d+(?:\.\d+)?%/i,`$1${values.title}`);
    }

    document.querySelectorAll('#nl4InterpretationViewerStats .viewer-stat').forEach(card=>{
      const label=(card.querySelector('span')?.textContent||'').trim().toLowerCase();
      const strong=card.querySelector('strong');
      if(!strong)return;
      if(label.includes('title') && (label.includes('prob')||label.includes('chance'))) strong.textContent=values.title;
      else if(label.includes('top 4')) strong.textContent=values.top4;
      else if(label.includes('top 5')) strong.textContent=values.top5;
      else if(label.includes('expected') && label.includes('point')) strong.textContent=`${values.points} pts`;
      else if(label.includes('expected') && (label.includes('finish')||label.includes('position'))) strong.textContent=values.finish;
    });

    const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
    set('publicArsenalTitleProbability',values.title);
    set('publicArsenalTop4Probability',values.top4);
    set('publicArsenalTop5Probability',values.top5);
    set('publicArsenalExpectedPoints',values.points);
    set('publicArsenalExpectedPosition',values.finish);
  }


  function renderAutomaticPublicInterpretation(modelRows,completedCount){
    const arsenal=(modelRows||[]).find(t=>String(t.club||'').toLowerCase()==='arsenal');
    if(!arsenal)return;

    const rivals=(modelRows||[])
      .filter(t=>String(t.club||'').toLowerCase()!=='arsenal')
      .slice()
      .sort((a,b)=>Number(b.titleProb||0)-Number(a.titleProb||0));
    const rival=rivals[0]||null;

    const confidence=confidenceFromResults(completedCount);
    const title=Number(arsenal.titleProb||0);
    const top4=Number(arsenal.top4Prob||0);
    const top5=Number(arsenal.top5Prob||0);
    const pts=Number(arsenal.expectedPoints||0);
    const finish=Number(arsenal.expectedPosition||0);
    const hist=Math.round(Number(arsenal.historicalWeight??preseasonWeight(arsenal.played))*100);
    const live=Math.round(Number(arsenal.currentSeasonWeight??(1-preseasonWeight(arsenal.played)))*100);
    const form=arsenal.formLabel||'PRE-SEASON';
    NL4_PUBLIC_CONTEXT={
      arsenal,
      completedCount:Number(completedCount)||0,
      confidence,
      historicalWeight:hist,
      currentWeight:live,
      form
    };

    let race='OPEN TITLE RACE';
    let tone='Arsenal remain firmly in the title race.';
    if(title>=65){race='ARSENAL LEADING';tone='Arsenal currently hold a strong position in the model, but the title is not secure.';}
    else if(title>=50){race='ARSENAL SLIGHT FAVOURITE';tone='Arsenal are the model favourite, although credible rival paths remain significant.';}
    else if(title>=30){race='TIGHT TITLE RACE';tone='Arsenal have a substantial title path, but the race remains highly competitive.';}
    else {race='CHASING POSITION';tone='Arsenal need stronger future results, rival setbacks, or both to become the model favourite.';}

    const rivalText=rival
      ? `${rival.club} are the closest title rival at ${Number(rival.titleProb||0).toFixed(1)}%.`
      : 'No credible rival probability is currently available.';

    const set=(id,value)=>{
      const el=document.getElementById(id);
      if(el)el.textContent=value;
    };

    set('nl4InterpretationHeadline',`NL4 model: Arsenal ${title.toFixed(1)}% for the title`);
    set('nl4InterpretationStatus','AUTOMATIC MODEL ANALYSIS');
    set('nl4InterpretationSummary',
      `Arsenal's current NL4 title probability is ${title.toFixed(1)}%, with ${pts.toFixed(1)} expected points and an expected finish of ${finish.toFixed(1)}. `+
      `The model is using ${live}% current-season evidence and ${hist}% historical evidence. Model confidence is ${confidence.score}/100. `+
      `${tone} ${rivalText}`
    );
    set('nl4InterpretationTakeaway',
      `The key signal is how Arsenal's own expected points and the full 20-team probability distribution move together. Current form: ${form}.`
    );

    const stats=document.getElementById('nl4InterpretationViewerStats');
    if(stats){
      const items=[
        ['Title probability',`${title.toFixed(1)}%`],
        ['Top 4 probability',`${top4.toFixed(1)}%`],
        ['Top 5 probability',`${top5.toFixed(1)}%`],
        ['Expected final points',`${pts.toFixed(1)} pts`],
        ['Expected finish',finish.toFixed(1)],
        ['Model confidence',`${confidence.score}/100`],
        ['Historical evidence weight',`${hist}%`],
        ['Current-season evidence weight',`${live}%`]
      ];
      stats.innerHTML=items.map(([label,value])=>
        `<div class="viewer-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`
      ).join('');
    }

    const factors=document.getElementById('nl4InterpretationFactors');
    if(factors){
      const items=[
        `${race}: ${tone}`,
        rivalText,
        `Evidence mix: ${hist}% historical / ${live}% current season. Form signal: ${form}.`
      ];
      factors.innerHTML=items.map(text=>`<div class="factor">${esc(text)}</div>`).join('');
    }

    set('nl4InterpretationPublished',
      `Automatic NL4 Public Model interpretation • ${Number(completedCount)||0}/380 completed league matches`
    );

    syncVisiblePublicProbability();
  }

  function latestPerCompletedCount(history){
    const ordered=(history||[]).slice().sort((a,b)=>{
      const cm=Number(a.completed_matches||0)-Number(b.completed_matches||0);
      if(cm!==0)return cm;
      return new Date(a.created_at||0)-new Date(b.created_at||0);
    });
    const map=new Map();
    ordered.forEach(r=>map.set(Number(r.completed_matches||0),r));
    return [...map.values()].sort((a,b)=>Number(a.completed_matches||0)-Number(b.completed_matches||0));
  }


  function renderAutomaticGraphInterpretation(history,currentArsenal,completedCount){
    const label=document.getElementById('nl4GraphInterpretationLabel');
    const changeEl=document.getElementById('nl4GraphInterpretationChange');
    const textEl=document.getElementById('nl4GraphInterpretationText');
    const metaEl=document.getElementById('nl4GraphInterpretationMeta');
    if(!label||!changeEl||!textEl||!metaEl)return;

    const rows=latestPerCompletedCount(history||[]);
    const current=Number(currentArsenal?.titleProb ?? NL4_PUBLIC_CANONICAL?.titleProbability ?? 0);
    const liveCount=Number(completedCount)||0;

    // If Admin ever publishes explicit graph-specific copy in the same
    // interpretation row, use it. Otherwise automatic analysis is the default.
    const admin=NL4_PUBLISHED_INTERPRETATION;
    const adminGraphText=admin && (
      admin.graph_interpretation ||
      admin.graph_interpretation_text ||
      admin.graph_summary
    );
    if(adminGraphText){
      label.textContent=String(admin.graph_interpretation_label||'ADMIN GRAPH ANALYSIS');
      textEl.textContent=String(adminGraphText);
      metaEl.textContent='Admin-published graph interpretation • live Public Model numbers remain authoritative.';
      if(rows.length){
        const first=Number(rows[0].title_probability||0);
        const change=current-first;
        changeEl.textContent=`${change>=0?'+':''}${change.toFixed(1)} pts`;
      }else{
        changeEl.textContent='—';
      }
      return;
    }

    label.textContent='AUTOMATIC GRAPH ANALYSIS';

    if(!rows.length){
      changeEl.textContent='CURRENT';
      textEl.textContent=`Arsenal's live title probability is ${current.toFixed(1)}%. The season-movement explanation will become richer as Public Model snapshots are saved.`;
      metaEl.textContent='Automatic NL4 analysis • current Public Model first-response value.';
      return;
    }

    const first=Number(rows[0].title_probability||0);
    const previous=rows.length>1 ? Number(rows[rows.length-1].title_probability||0) : first;
    const seasonChange=current-first;
    const recentChange=current-previous;

    let direction='steady';
    if(seasonChange>=5)direction='rising strongly';
    else if(seasonChange>=1)direction='rising';
    else if(seasonChange<=-5)direction='falling sharply';
    else if(seasonChange<=-1)direction='falling';

    let recent='little changed from the latest saved snapshot';
    if(recentChange>=1)recent=`up ${recentChange.toFixed(1)} points from the latest saved snapshot`;
    else if(recentChange<=-1)recent=`down ${Math.abs(recentChange).toFixed(1)} points from the latest saved snapshot`;

    const sign=seasonChange>=0?'+':'';
    changeEl.textContent=`${sign}${seasonChange.toFixed(1)} pts`;

    textEl.textContent=
      `Arsenal's title probability is ${current.toFixed(1)}% after ${liveCount} completed league matches. `+
      `Compared with the first saved Public Model forecast (${first.toFixed(1)}%), the title chance is ${direction} `+
      `and is ${recent}. This graph tracks probability movement, not a guarantee of the final league outcome.`;

    metaEl.textContent='Automatic NL4 graph interpretation • generated from saved Public Model history plus the current live calculation.';
  }

  function renderPublicTitleHistory(history,currentArsenal,completedCount){
    NL4_LAST_PUBLIC_HISTORY=Array.isArray(history)?history.slice():[];
    NL4_LAST_PUBLIC_ARSENAL=currentArsenal||null;
    NL4_LAST_PUBLIC_COMPLETED=Number(completedCount)||0;
    renderAutomaticGraphInterpretation(history,currentArsenal,completedCount);
    const svg=document.getElementById('publicTitleHistoryChart');
    if(!svg)return;

    let rows=latestPerCompletedCount(history);

    // Public Model is first responder: at the current match count, the live
    // canonical calculation replaces any slightly older stored snapshot.
    if(currentArsenal){
      const live={
        completed_matches:Number(completedCount)||0,
        title_probability:Number(currentArsenal.titleProb||0),
        created_at:new Date().toISOString(),
        __live:true
      };
      const map=new Map(rows.map(r=>[Number(r.completed_matches||0),r]));
      map.set(Number(live.completed_matches),live);
      rows=[...map.values()].sort((a,b)=>Number(a.completed_matches||0)-Number(b.completed_matches||0));
    }

    if(!rows.length){
      svg.innerHTML='<text x="380" y="120" text-anchor="middle" class="nl4-history-axis-text">History begins after the first Public Model snapshot.</text>';
      const latest=document.getElementById('publicTitleHistoryLatest');
      const change=document.getElementById('publicTitleHistoryChange');
      const note=document.getElementById('publicTitleHistoryNote');
      if(latest)latest.textContent='WAITING FOR FIRST SNAPSHOT';
      if(change)change.textContent='Season change: —';
      if(note)note.textContent='No saved Public Model history is available yet.';
      return;
    }

    const W=760,H=240,L=44,R=18,T=18,B=34;
    const innerW=W-L-R, innerH=H-T-B;
    const maxMatches=Math.max(38,...rows.map(r=>Number(r.completed_matches)||0));
    const x=m=>L+(Number(m||0)/maxMatches)*innerW;
    const y=p=>T+(1-Math.max(0,Math.min(100,Number(p||0)))/100)*innerH;

    let grid='';
    [0,25,50,75,100].forEach(p=>{
      const yy=y(p);
      grid+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" class="nl4-history-grid"/>`;
      grid+=`<text x="${L-8}" y="${yy+3}" text-anchor="end" class="nl4-history-axis-text">${p}%</text>`;
    });

    const points=rows.map(r=>`${x(r.completed_matches)},${y(r.title_probability)}`).join(' ');
    const first=rows[0], last=rows[rows.length-1];
    const area=`${x(first.completed_matches)},${H-B} ${points} ${x(last.completed_matches)},${H-B}`;
    const dots=rows.map((r,i)=>{
      const xx=x(r.completed_matches), yy=y(r.title_probability);
      const label=(i===rows.length-1 || rows.length<=8)
        ? `<text x="${xx}" y="${Math.max(12,yy-9)}" text-anchor="middle" class="nl4-history-label">${nl4CanonicalPct(r.title_probability)}</text>`:'';
      return `<circle cx="${xx}" cy="${yy}" r="5" class="nl4-history-dot"/>${label}`;
    }).join('');

    svg.innerHTML=`${grid}<polygon points="${area}" class="nl4-history-area"/><polyline points="${points}" class="nl4-history-line"/>${dots}
      <text x="${L}" y="${H-8}" class="nl4-history-axis-text">0 matches</text>
      <text x="${W-R}" y="${H-8}" text-anchor="end" class="nl4-history-axis-text">${maxMatches} matches</text>`;

    const change=Number(last.title_probability)-Number(first.title_probability);
    const latest=document.getElementById('publicTitleHistoryLatest');
    const changeEl=document.getElementById('publicTitleHistoryChange');
    const note=document.getElementById('publicTitleHistoryNote');
    if(latest)latest.textContent=`${nl4CanonicalPct(last.title_probability)} AFTER ${Number(last.completed_matches)||0} MATCHES`;
    if(changeEl)changeEl.textContent=`Season change: ${change>=0?'+':''}${change.toFixed(1)} pts`;
    if(note)note.textContent=last.__live
      ? 'The final point is the current Public Model first-response calculation; saved Supabase snapshots provide the earlier season history.'
      : 'Saved Public Model forecasts from Supabase show how Arsenal’s title probability changes through the season.';
  }


  function publishCanonicalResultBridge(arsenal,completedCount){
    if(!arsenal)return;
    try{
      const payload={
        season:SEASON,
        source:'PUBLIC_MODEL_CANONICAL',
        completed_matches:Number(completedCount)||0,
        title_probability:Number(arsenal.titleProb||0),
        top4_probability:Number(arsenal.top4Prob||0),
        top5_probability:Number(arsenal.top5Prob||0),
        expected_points:Number(arsenal.expectedPoints||0),
        expected_position:Number(arsenal.expectedPosition||0),
        confidence_score:confidenceFromResults(Number(completedCount)||0).score,
        calculated_at:new Date().toISOString()
      };
      localStorage.setItem('nl4_public_model_canonical_2026_27',JSON.stringify(payload));
      window.NL4_PUBLIC_MODEL_CANONICAL_RESULT=payload;
    }catch(err){
      console.warn('NL4 canonical result bridge:',err);
    }
  }

  function renderPublicModel(rows, completedCount){
    const arsenal=rows.find(x=>String(x.club||'').toLowerCase()==='arsenal');
    const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
    const table=document.getElementById('publicProbabilityTable');
    if(!arsenal){
      if(table)table.innerHTML='<div class="nl4-title-model-loading">Arsenal model data is unavailable.</div>';
      return;
    }
    NL4_PUBLIC_CANONICAL={
      titleProbability:Number(arsenal.titleProb||0),
      top4Probability:Number(arsenal.top4Prob||0),
      top5Probability:Number(arsenal.top5Prob||0),
      expectedPoints:Number(arsenal.expectedPoints||0),
      expectedPosition:Number(arsenal.expectedPosition||0),
      completedMatches:Number(completedCount)||0
    };
    publishCanonicalResultBridge(arsenal,completedCount);
    set('publicArsenalTitleProbability',nl4CanonicalPct(NL4_PUBLIC_CANONICAL.titleProbability));
    set('publicArsenalTop4Probability',nl4CanonicalPct(NL4_PUBLIC_CANONICAL.top4Probability));
    set('publicArsenalTop5Probability',nl4CanonicalPct(NL4_PUBLIC_CANONICAL.top5Probability));
    set('publicArsenalExpectedPoints',NL4_PUBLIC_CANONICAL.expectedPoints.toFixed(1));
    set('publicArsenalExpectedPosition',NL4_PUBLIC_CANONICAL.expectedPosition.toFixed(1));
    const phase=Number(completedCount||0)===0?'PRE-SEASON BASELINE':Number(completedCount||0)<80?'EARLY-SEASON MODEL':'IN-SEASON MODEL';
    set('publicModelLiveStatus',`${phase} • ${SIMULATIONS.toLocaleString()} simulations • Public Model first responder • live Supabase inputs`);
    if(table){
      table.innerHTML=rows.slice().sort((a,b)=>Number(b.titleProb||0)-Number(a.titleProb||0)).map(t=>`
        <div class="nl4-public-probability-row ${t.club==='Arsenal'?'arsenal':''}">
          <b>${esc(t.club)}</b>
          <strong>${Number(t.titleProb||0).toFixed(1)}%</strong>
          <span>${Number(t.top4Prob||0).toFixed(1)}%</span>
          <span>${Number(t.expectedPoints||0).toFixed(1)}</span>
        </div>`).join('');
    }
    syncVisiblePublicProbability();
  }

  function render(rows,fixtureCount,completedCount,scenario,impact,championPointStats,pointThresholds,validationStats,environmentAudit,goalPipelineTrace){
    renderPublicModel(rows,completedCount);
    renderAutomaticPublicInterpretation(rows,completedCount);
    const terminalSeason=Number(completedCount||0)>=TOTAL_FIXTURES || Number(fixtureCount||0)===Number(completedCount||0);

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
      setText('arsenalHistoricalPointsWeight',`${Math.round((arsenal.historicalWeight??preseasonWeight(arsenal.played))*100)}% active`);
      setText('arsenalPriorDedupStatus','ACTIVE');
      setText('arsenalHistoricalEffect','BALANCED');
      setText('arsenalCalibrationBand','77–81 pts');
      setText('leagueScoringBaseline',`${arsenal.played?Number(arsenal.leagueGoalAvg||0).toFixed(2):'1.42'} goals/team`);
      setText('leagueDecisivenessMode','GAP-AWARE');
      setText('titleModelVersion','V14.5 • TRANSITION SCHEDULE CONSISTENCY AUDIT');
      document.querySelectorAll('.v123-timeline-head .nl4-model-label').forEach(el=>{
        if(/MATCHDAY PROBABILITY TIMELINE/i.test(el.textContent||''))el.textContent='V13.3 • SANDBOX / LIVE PROBABILITY TIMELINE';
      });
      document.querySelectorAll('.v12-tracker-head .nl4-model-label').forEach(el=>{
        if(/LIVE MATCHDAY TRACKER/i.test(el.textContent||''))el.textContent='V13.3 • LIVE MATCHDAY TRACKER';
      });
      setText('titleModelRunLabel',`${SIMULATIONS.toLocaleString()} V13.0 SIMULATIONS • V13.2 SANDBOX AUDIT`);

      const historicalPct=Math.round((arsenal.historicalWeight??preseasonWeight(arsenal.played))*100);
      const currentPct=Math.round((arsenal.currentSeasonWeight??(1-preseasonWeight(arsenal.played)))*100);
      setText('v13HistoricalWeight',`${historicalPct}%`);
      setText('v13CurrentWeight',`${currentPct}%`);
      setText('v13ArsenalPlayed',`${arsenal.played}/38`);
      setText('v13EvidencePhase',arsenal.played===0?'PRE-SEASON':
        arsenal.played<10?'EARLY TRANSITION':
        arsenal.played<20?'BLENDED EVIDENCE':
        arsenal.played<30?'CURRENT SEASON LEADS':'LIVE SEASON DOMINANT');
      const historyBar=document.getElementById('v13HistoricalBar');
      const currentBar=document.getElementById('v13CurrentBar');
      if(historyBar)historyBar.style.width=`${historicalPct}%`;
      if(currentBar)currentBar.style.width=`${currentPct}%`;

      const evidenceTable=document.getElementById('v13EvidenceClubList');
      if(evidenceTable){
        evidenceTable.innerHTML=rows
          .slice()
          .sort((a,b)=>a.position-b.position)
          .map(team=>{
            const h=Math.round((team.historicalWeight??preseasonWeight(team.played))*100);
            const c=100-h;
            return `<div class="v13-evidence-row ${team.club==='Arsenal'?'arsenal':''}">
              <span class="v13-evidence-club">${esc(team.club)}</span>
              <span>${team.played} MP</span>
              <span>HIST ${h}%</span>
              <span>LIVE ${c}%</span>
            </div>`;
          }).join('');
      }


      const audit=document.getElementById('v131EvidenceAudit');
      if(audit){
        const signed=(v,d=3)=>`${Number(v)>=0?'+':''}${Number(v||0).toFixed(d)}`;
        const eloDelta=Number(arsenal.eloRating||ELO_BASE)-Number(arsenal.preseasonElo||ELO_BASE);
        const gdPerGame=arsenal.played?arsenal.gd/arsenal.played:0;
        const homeComposite=((arsenal.homeAttackAdj||1)+(2-(arsenal.homeDefAdj||1)))/2;
        const awayComposite=((arsenal.awayAttackAdj||1)+(2-(arsenal.awayDefAdj||1)))/2;

        audit.innerHTML=`
          <article class="v131-audit-card">
            <span>POINTS / PPG</span>
            <strong>${arsenal.points} pts • ${arsenal.played?arsenal.ppg.toFixed(2):'—'} PPG</strong>
            <small>Applied PPG factor: ${(arsenal.ppgPower||1).toFixed(3)}</small>
          </article>
          <article class="v131-audit-card">
            <span>GOALS FOR</span>
            <strong>${arsenal.gf} • ${arsenal.played?arsenal.gfpg.toFixed(2):'—'} / match</strong>
            <small>Live attack factor: ${(arsenal.attack||1).toFixed(3)}</small>
          </article>
          <article class="v131-audit-card">
            <span>GOALS AGAINST</span>
            <strong>${arsenal.ga} • ${arsenal.played?arsenal.gapg.toFixed(2):'—'} / match</strong>
            <small>Live defence factor: ${(arsenal.defence||1).toFixed(3)}</small>
          </article>
          <article class="v131-audit-card">
            <span>GOAL DIFFERENCE</span>
            <strong>${arsenal.gd>=0?'+':''}${arsenal.gd}</strong>
            <small>${arsenal.played?signed(gdPerGame,2):'—'} GD per match</small>
          </article>
          <article class="v131-audit-card">
            <span>OPPONENT-ADJUSTED ELO</span>
            <strong>${Math.round(arsenal.eloRating||ELO_BASE)}</strong>
            <small>Preseason ${Math.round(arsenal.preseasonElo||ELO_BASE)} • live 2026/27 delta ${signed(arsenal.v133?.liveNeutralEloDelta||0,1)} • gated contribution ${signed(arsenal.v133?.liveEloComponent||0,1)}</small>
          </article>
          <article class="v131-audit-card">
            <span>RECENT FORM</span>
            <strong>${esc(arsenal.formLabel||'PRE-SEASON')}</strong>
            <small>Gated form factor: ${(arsenal.formFactor||1).toFixed(3)}</small>
          </article>
          <article class="v131-audit-card">
            <span>HOME PERFORMANCE</span>
            <strong>${(arsenal.homeAttackAdj||1).toFixed(3)} / ${(arsenal.homeDefAdj||1).toFixed(3)}</strong>
            <small>Attack / defence adjustment • composite ${homeComposite.toFixed(3)}</small>
          </article>
          <article class="v131-audit-card">
            <span>AWAY PERFORMANCE</span>
            <strong>${(arsenal.awayAttackAdj||1).toFixed(3)} / ${(arsenal.awayDefAdj||1).toFixed(3)}</strong>
            <small>Attack / defence adjustment • composite ${awayComposite.toFixed(3)}</small>
          </article>
          <article class="v131-audit-card">
            <span>TABLE POSITION</span>
            <strong>${arsenal.position}</strong>
            <small>Applied position factor: ${(arsenal.tablePositionFactor||1).toFixed(3)}</small>
          </article>
          <article class="v131-audit-card emphasis">
            <span>EVIDENCE GATE</span>
            <strong>${historicalPct}% HIST • ${currentPct}% LIVE</strong>
            <small>Every current-season signal above is constrained by this transition.</small>
          </article>`;
      }


      ensureV133InfluencePanel();
      const v133=document.getElementById('v133InfluenceAudit');
      if(v133){
        const a=arsenal.v133||{};
        const fmt=(v,d=3)=>Number(v||0).toFixed(d);
        const sign=(v,d=3)=>`${Number(v)>=0?'+':''}${Number(v||0).toFixed(d)}`;
        const effectiveLiveRaw=Number(a.liveContributionAbs||0);
        const effectiveLivePct=Math.min(100,effectiveLiveRaw*100);
        const gatePct=Math.round((arsenal.currentSeasonWeight||0)*100);
        const ratio=gatePct>0?effectiveLivePct/gatePct:null;

        setText('v133NominalLiveGate',`${gatePct}%`);
        setText('v133EffectiveLiveInfluence',`${effectiveLivePct.toFixed(1)}%`);
        setText('v133InfluenceRatio',ratio===null?'—':`${ratio.toFixed(2)}× gate`);

        const rows=[
          {name:'PPG',raw:arsenal.played?arsenal.ppg.toFixed(2):'—',sample:`${arsenal.played} MP`,weight:`${Math.round((arsenal.currentSeasonWeight||0)*100)}% gate`,contrib:sign(a.ppgContribution)},
          {name:'Attack (GF)',raw:arsenal.played?arsenal.gfpg.toFixed(2):'—',sample:`${arsenal.played} MP`,weight:`live sample ${fmt(a.liveSample)}`,contrib:sign(a.attackContribution)},
          {name:'Defence (GA)',raw:arsenal.played?arsenal.gapg.toFixed(2):'—',sample:`${arsenal.played} MP`,weight:`live sample ${fmt(a.liveSample)}`,contrib:sign(a.defenceContribution)},
          {name:'Goal difference',raw:`${arsenal.gd>=0?'+':''}${arsenal.gd}`,sample:`${arsenal.played} MP`,weight:'indirect via PPG/Elo/table',contrib:'TRACKED INDIRECTLY'},
          {name:'Historical Elo prior',raw:Math.round(a.preseasonElo||arsenal.preseasonElo||ELO_BASE),sample:'preseason',weight:`${Math.round((arsenal.historicalWeight||0)*100)}% historical`,contrib:`${sign((a.historicalEloFactor||1)-1)}`},
          {name:'2026/27 Elo movement',raw:`${sign(a.liveNeutralEloDelta||0,1)} Elo`,sample:`${arsenal.played} MP`,weight:`${Math.round((arsenal.currentSeasonWeight||0)*100)}% live gate`,contrib:sign(a.eloContribution)},
          {name:'Recent form',raw:arsenal.formLabel||'PRE-SEASON',sample:`${Math.min(5,arsenal.played)} match window`,weight:`${gatePct}% gate`,contrib:sign(a.formContribution)},
          {name:'Home split',raw:`${a.homeMatches||0} home MP`,sample:`${a.homeMatches||0}`,weight:'split × live gate',contrib:sign(a.homeContribution)},
          {name:'Away split',raw:`${a.awayMatches||0} away MP`,sample:`${a.awayMatches||0}`,weight:'split × live gate',contrib:sign(a.awayContribution)},
          {name:'Table position',raw:`${arsenal.position}`,sample:`${arsenal.played} MP`,weight:`small capped × ${gatePct}%`,contrib:sign(a.tableContribution)}
        ];

        v133.innerHTML=rows.map(r=>`
          <div class="v133-row">
            <strong>${esc(r.name)}</strong>
            <span>${esc(r.raw)}</span>
            <span>${esc(r.sample)}</span>
            <span>${esc(r.weight)}</span>
            <b>${esc(r.contrib)}</b>
          </div>`).join('');
      }

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
          ? `Only ${completedCount} league matches are complete. V13.0 is still weighting historical evidence heavily; live-season signals are deliberately gated.`
          : confidence.label==='MEDIUM'
            ? `${completedCount} completed matches provide meaningful current-season evidence; the live-season share is now substantial, though historical evidence still contributes.`
            : `${completedCount} completed matches provide strong live-season evidence. Current points, goals, opponent-adjusted Elo, form, splits and table position now dominate the strength estimate.`;
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




    const traceEl=document.getElementById('v136GoalTrace');
    if(traceEl && goalPipelineTrace){
      const g=goalPipelineTrace;
      const pct=v=>`${(Number(v||0)*100).toFixed(1)}%`;
      setText('v136ObservedBase',`${g.stabilizedTeamGoalAvg.toFixed(2)} / team`);
      setText('v136FrozenBase',`${g.frozenBase.toFixed(2)} / team`);
      setText('v136LiveGoals',v1501Num(g.liveRemainingGoals,2));
      setText('v137RawObservedBase',`${g.observedTeamGoalAvg.toFixed(2)} / team`);
      setText('v137ScoringWeights',`${Math.round(g.scoringHist*100)}% HIST • ${Math.round(g.scoringLive*100)}% LIVE`);
      setText('v136FrozenGoals',v1501Num(g.frozenBaseRemainingGoals,2));
      setText('v136GoalLoss',`${g.goalLossFromBase>=0?'+':''}${v1501Num(g.goalLossFromBase,2)}`);

      const rowsTrace=[
        ['Raw 2026/27 scoring sample',g.frozenBase.toFixed(2),g.observedTeamGoalAvg.toFixed(2),`${(g.observedTeamGoalAvg-g.frozenBase)>=0?'+':''}${(g.observedTeamGoalAvg-g.frozenBase).toFixed(2)} / team`],
        ['Stabilized base fed into λ',g.frozenBase.toFixed(2),g.stabilizedTeamGoalAvg.toFixed(2),`${(g.stabilizedTeamGoalAvg-g.frozenBase)>=0?'+':''}${(g.stabilizedTeamGoalAvg-g.frozenBase).toFixed(2)} / team`],
        ['Same 370 fixtures • goals/match',v1501Num(g.frozenBaseRemainingGoals,2),v1501Num(g.liveRemainingGoals,2),`${g.goalLossFromBase>=0?'+':''}${v1501Num(g.goalLossFromBase,2)}`],
        ['Same fixtures • draw rate',pct(g.frozenDraw),pct(g.liveDraw),`${((g.liveDraw-g.frozenDraw)*100)>=0?'+':''}${((g.liveDraw-g.frozenDraw)*100).toFixed(1)} pts`],
        ['Same fixtures • favourite win',pct(g.frozenFavorite),pct(g.liveFavorite),`${((g.liveFavorite-g.frozenFavorite)*100)>=0?'+':''}${((g.liveFavorite-g.frozenFavorite)*100).toFixed(1)} pts`],
        ['Fixture count',String(g.sameFixtureCount),String(g.sameFixtureCount),'identical']
      ];
      traceEl.innerHTML=rowsTrace.map(r=>`
        <div class="v136-trace-row"><strong>${esc(r[0])}</strong><span>${esc(r[1])}</span><span>${esc(r[2])}</span><b>${esc(r[3])}</b></div>`).join('');

      const status=document.getElementById('v136TraceStatus');
      if(status){
        const baseCollapse=Math.abs(g.stabilizedTeamGoalAvg-g.frozenBase)>=.12;
        status.textContent=baseCollapse?'BASELINE STILL UNSTABLE':'BASELINE STABILIZED';
        status.classList.toggle('danger',baseCollapse);
      }
      const diagnosis=document.getElementById('v136Diagnosis');
      if(diagnosis){
        diagnosis.textContent=`V13.7 sees a raw 2026/27 scoring sample of ${g.observedTeamGoalAvg.toFixed(2)} goals/team, but only ${Math.round(g.scoringLive*100)}% of that sample is allowed into the shared scoring baseline at this stage. The model now feeds ${g.stabilizedTeamGoalAvg.toFixed(2)} goals/team into λ instead of ${g.observedTeamGoalAvg.toFixed(2)}. On the same remaining fixtures, scoring is ${v1501Num(g.liveRemainingGoals,2)} goals/match versus ${v1501Num(g.frozenBaseRemainingGoals,2)} under a fully frozen 1.42 base.`;
      }
    }

    const envEl=document.getElementById('v135EnvironmentAudit');
    if(envEl && environmentAudit){
      const champAvg=Number(championPointStats?.average||0);
      const arsenalNow=rows.find(t=>t.club==='Arsenal');
      const arsenalExp=Number(arsenalNow?.expectedPoints||0);
      const championDelta=champAvg-V129_ENV_BASELINE.championAverage;
      const arsenalDelta=arsenalExp-V129_ENV_BASELINE.arsenalExpectedPoints;
      const drawPct=Number(environmentAudit.avgDrawProbability||0)*100;
      const favPct=Number(environmentAudit.avgFavoriteWinProbability||0)*100;

      setText('v135ChampionNow',`${champAvg.toFixed(1)} pts`);
      setText('v135ChampionDelta',`${championDelta>=0?'+':''}${championDelta.toFixed(1)} pts`);
      setText('v135ArsenalNow',`${arsenalExp.toFixed(1)} pts`);
      setText('v135ArsenalDelta',`${arsenalDelta>=0?'+':''}${arsenalDelta.toFixed(1)} pts`);
      setText('v135GoalsNow',`${Number(environmentAudit.avgGoalsPerRemainingMatch||0).toFixed(2)}`);
      setText('v135DrawNow',`${drawPct.toFixed(1)}%`);
      setText('v135FavoriteNow',`${favPct.toFixed(1)}%`);
      setText('v135EloGapNow',`${Number(environmentAudit.avgEloGap||0).toFixed(0)}`);

      const rowsAudit=[
        ['Champion average',`${V129_ENV_BASELINE.championAverage.toFixed(1)} pts`,`${champAvg.toFixed(1)} pts`,`${championDelta>=0?'+':''}${championDelta.toFixed(1)}`],
        ['Arsenal expected points',`${V129_ENV_BASELINE.arsenalExpectedPoints.toFixed(1)}`,`${arsenalExp.toFixed(1)}`,`${arsenalDelta>=0?'+':''}${arsenalDelta.toFixed(1)}`],
        ['Remaining-match goals',`${V129_ENV_BASELINE.avgGoalsPerMatch.toFixed(2)}`,`${Number(environmentAudit.avgGoalsPerRemainingMatch||0).toFixed(2)}`,`${(Number(environmentAudit.avgGoalsPerRemainingMatch||0)-V129_ENV_BASELINE.avgGoalsPerMatch)>=0?'+':''}${(Number(environmentAudit.avgGoalsPerRemainingMatch||0)-V129_ENV_BASELINE.avgGoalsPerMatch).toFixed(2)}`],
        ['Draw probability','baseline audit',''+drawPct.toFixed(1)+'%','—'],
        ['Favorite win probability','baseline audit',''+favPct.toFixed(1)+'%','—'],
        ['Average Elo gap','baseline audit',`${Number(environmentAudit.avgEloGap||0).toFixed(0)}`,'—'],
        ['Completed league matches','0',`${environmentAudit.completedMatches}`,''],
        ['Remaining league matches','380',`${environmentAudit.remainingMatches}`,'']
      ];

      envEl.innerHTML=rowsAudit.map(r=>`
        <div class="v135-env-row">
          <strong>${esc(r[0])}</strong><span>${esc(r[1])}</span><span>${esc(r[2])}</span><b>${esc(r[3])}</b>
        </div>`).join('');

      const flag=document.getElementById('v135EnvironmentStatus');
      if(flag){
        const severe=Math.abs(championDelta)>=2 || Math.abs(arsenalDelta)>=2;
        flag.textContent=severe?'REGRESSION DETECTED':'ENVIRONMENT STABLE';
        flag.classList.toggle('danger',severe);
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
      statusEl.textContent=`V13.0 • ${TEST_MODE?'TEST MODE • ':''}${phase} • ${SIMULATIONS.toLocaleString()} simulations • LIVE SEASON TRANSITION ENGINE • evidence-weighted current points • goals for/against • goal difference • opponent-adjusted Elo • recent form • home/away performance • table position • V12.9 frozen match engine • multi-season historical prior • prior de-duplication • Monte Carlo reliability diagnostics`;
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
    const rounds=(Number(completedCount)||0)/10;
    if(rounds<5 && arsenalRank===1){
      raceStatus='ARSENAL EARLY LEADER';
      raceNote='Arsenal lead the probability table, but the season sample is still too small for control language.';
    }
    else if(arsenalRank===1 && gap>=15){raceStatus='ARSENAL IN CONTROL';raceNote='Arsenal hold a clear probability lead over the nearest challenger.';}
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
        summary.textContent=`The live tracker is armed at ${current.toFixed(1)}%. Once the first 2026/27 league results are recorded, V13.2 will compare the new forecast with this frozen preseason baseline.`;
      }else if(previousProb===null){
        summary.textContent=`Arsenal are currently ${current.toFixed(1)}% to win the league. No earlier sandbox snapshot is available yet, so an exact before/after change cannot be shown.`;
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

  async function safeLoadPublicHistory(){
    try{
      const rows=await loadTitleHistory();
      return Array.isArray(rows)?rows:[];
    }catch(err){
      console.warn('NL4 public history read:',err);
      return [];
    }
  }

  async function savePublicSnapshot(arsenal,completedCount){
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
        p_model_version:'PUBLIC MODEL • V13 ENGINE'
      });
      if(rpc.error)throw rpc.error;

      // PUBLIC MODEL IS THE FIRST RESPONDER / SOURCE OF TRUTH.
      // Only after the official public snapshot is safely stored do we mirror
      // that exact snapshot into the Admin Model's separate history.
      let adminModelSynced=false;
      let adminModelSyncError='';
      try{
        const matchday=Math.max(1,Math.min(38,Math.ceil((Number(completedCount)||0)/10)));
        const mirror={
          season:SEASON,
          test_id:'admin-live-2026-27',
          matchday,
          completed_matches:Number(completedCount)||0,
          title_probability:Number(arsenal.titleProb.toFixed(4)),
          top4_probability:Number(arsenal.top4Prob.toFixed(4)),
          top5_probability:Number(arsenal.top5Prob.toFixed(4)),
          expected_points:Number(arsenal.expectedPoints.toFixed(4)),
          expected_position:Number(arsenal.expectedPosition.toFixed(4)),
          confidence_score:confidence.score,
          model_version:'PUBLIC-FIRST SYNC • V13 ENGINE',
          created_at:new Date().toISOString()
        };
        const mirrorRes=await db.from('nl4_admin_model_snapshots')
          .upsert(mirror,{onConflict:'test_id,completed_matches'});
        if(mirrorRes.error)throw mirrorRes.error;
        adminModelSynced=true;
      }catch(syncErr){
        adminModelSyncError=String(syncErr?.message||syncErr||'Admin Model mirror failed');
        console.warn('NL4 Public → Admin Model mirror:',syncErr);
      }

      // UPDATED SCORE -> PUBLIC MODEL -> ADMIN MODEL
      // Report success only after the public snapshot exists. The message also
      // carries the exact public values so Admin can perform a fallback mirror.
      try{
        if(window.parent && window.parent !== window){
          window.parent.postMessage({
            type:'nl4-public-model-snapshot-saved',
            season:SEASON,
            completed_matches:Number(completedCount)||0,
            title_probability:Number(arsenal.titleProb.toFixed(4)),
            top4_probability:Number(arsenal.top4Prob.toFixed(4)),
            top5_probability:Number(arsenal.top5Prob.toFixed(4)),
            expected_points:Number(arsenal.expectedPoints.toFixed(4)),
            expected_position:Number(arsenal.expectedPosition.toFixed(4)),
            confidence_score:confidence.score,
            model_version:'PUBLIC MODEL • V13 ENGINE',
            admin_model_synced:adminModelSynced,
            admin_model_sync_error:adminModelSyncError
          }, window.location.origin);
        }
      }catch(_){}
    }catch(err){
      // Public viewers are intentionally unable to save snapshots.
      console.debug('NL4 snapshot not saved for this session.');
    }
  }


  const NL4_DIAGNOSTIC_PANEL_MARKERS=[
    'EARLY-SEASON INFLUENCE AUDIT','SIMULATION ENVIRONMENT REGRESSION AUDIT',
    'GOAL ENVIRONMENT TRACE','SCORING BASELINE STABILIZATION',
    'TITLE PROBABILITY SENSITIVITY AUDIT','BANKED POINTS VS EVIDENCE DECOMPOSITION',
    'FIXTURE EXPECTATION / SURPRISE AUDIT','EXPECTED RESULT VS ACTUAL RESULT AUDIT',
    'TITLE BOUNDARY / RANK SENSITIVITY AUDIT','CONTENDER DISTRIBUTION COMPRESSION AUDIT',
    'TRANSITION SCHEDULE CONSISTENCY AUDIT','MD5 TITLE SURGE DECOMPOSITION',
    'RIVAL SHOCK SENSITIVITY AUDIT','OPPONENT-NEUTRAL RIVAL SHOCK AUDIT',
    'RIVAL SHOCK MONTE CARLO STABILITY AUDIT','EXACT-PAIRING HOTFIX',
    'Monte Carlo Validation Dashboard','Simulation Reliability & Tail Diagnostics'
  ];
  function markNL4DiagnosticPanels(){
    document.querySelectorAll('section').forEach(s=>{
      if(NL4_DIAGNOSTIC_PANEL_MARKERS.some(m=>(s.textContent||'').includes(m))) s.dataset.nl4Diagnostic='true';
    });
  }
  function setNL4DiagnosticsMode(on){
    document.body.classList.toggle('nl4-diagnostics-mode',!!on);
    document.getElementById('nl4FanViewBtn')?.classList.toggle('active',!on);
    document.getElementById('nl4DiagnosticsBtn')?.classList.toggle('active',!!on);
    try{sessionStorage.setItem('nl4ModelDiagnostics',on?'1':'0')}catch(_){}
  }
  function initNL4DiagnosticsMode(){
    markNL4DiagnosticPanels();
    document.getElementById('nl4FanViewBtn')?.addEventListener('click',()=>setNL4DiagnosticsMode(false));
    document.getElementById('nl4DiagnosticsBtn')?.addEventListener('click',()=>setNL4DiagnosticsMode(true));
    let on=false; try{on=sessionStorage.getItem('nl4ModelDiagnostics')==='1'}catch(_){}
    setNL4DiagnosticsMode(on);
  }



  async function loadPublicForecastVisibility(){
    const root=document.getElementById('nl4PublicForecastRoot');
    const publicModel=document.getElementById('nl4PublicModel');
    if(!root)return true;

    // PUBLIC MODEL IS FIRST RESPONDER: show it immediately. Only an explicit
    // saved is_visible=false setting is allowed to hide the public forecast.
    root.hidden=false;
    root.classList.remove('nl4-public-forecast-disabled');
    if(publicModel) publicModel.hidden=false;

    let visible=true;
    try{
      const res=await db.from('nl4_public_forecast_settings')
        .select('is_visible')
        .eq('season',SEASON)
        .limit(1);
      if(res.error){
        // Missing settings table should not break the title model.
        if(String(res.error.message||'').includes('schema cache')){
          console.warn('NL4 public forecast settings table has not been created yet.');
        }else{
          console.warn('NL4 forecast visibility:',res.error);
        }
      }else if(res.data?.length){
        visible=res.data[0].is_visible!==false;
      }
    }catch(err){
      console.warn('NL4 forecast visibility:',err);
    }

    root.hidden=!visible;
    root.classList.toggle('nl4-public-forecast-disabled',!visible);
    if(publicModel) publicModel.hidden=!visible;
    return visible;
  }


  function liveValueForAdminSelectedStat(label,savedValue){
    const l=String(label||'').trim().toLowerCase();
    const C=NL4_PUBLIC_CANONICAL;
    const X=NL4_PUBLIC_CONTEXT;
    if(!C)return savedValue||'—';

    if(l.includes('title') && (l.includes('prob')||l.includes('chance'))) return nl4CanonicalPct(C.titleProbability);
    if(l.includes('top 4')) return nl4CanonicalPct(C.top4Probability);
    if(l.includes('top 5')) return nl4CanonicalPct(C.top5Probability);
    if(l.includes('expected') && l.includes('point')) return `${C.expectedPoints.toFixed(1)} pts`;
    if(l.includes('expected') && (l.includes('finish')||l.includes('position'))) return C.expectedPosition.toFixed(1);

    if(X){
      const a=X.arsenal||{};
      if(l.includes('confidence')) return `${X.confidence?.score??'—'}/100`;
      if(l.includes('completed') && l.includes('match')) return `${X.completedCount}/380`;
      if(l.includes('historical') && l.includes('weight')) return `${X.historicalWeight}%`;
      if((l.includes('current-season')||l.includes('current season')) && l.includes('weight')) return `${X.currentWeight}%`;
      if(l.includes('current points')||l==='arsenal points') return `${Number(a.points||0)} pts`;
      if(l.includes('current position')||l==='arsenal position') return String(a.position??'—');
      if(l.includes('ppg')) return Number(a.ppg||0).toFixed(1);
      if(l.includes('goals for')) return String(Number(a.gf||a.goalsFor||0));
      if(l.includes('goals against')) return String(Number(a.ga||a.goalsAgainst||0));
      if(l.includes('goal difference')) return String(Number(a.gd||a.goalDifference||0));
      if(l.includes('historical points anchor')) return `${Number(a.historicalPointsAnchor||0).toFixed(1)} pts`;
      if(l.includes('scoring baseline')) return `${Number(a.scoringBaseline||1.4).toFixed(1)} goals/team`;
      if(l.includes('model trend')) return String(a.modelTrend||a.trendLabel||X.form||'—');
      if(l.includes('form')) return String(X.form||'—');
    }

    return savedValue||'—';
  }

  async function loadPublishedModelInterpretation(){
    const panel=document.getElementById('nl4PublicModel');
    if(!panel)return;
    try{
      const res=await db.from('nl4_model_interpretations')
        .select('headline,status_label,summary,key_takeaway,factor_1,factor_2,factor_3,selected_stats,interpretation_mode,interpretation_style,published_at,is_published')
        .eq('season',SEASON)
        .eq('is_published',true)
        .order('published_at',{ascending:false})
        .limit(1);
      if(res.error)throw res.error;
      const row=res.data?.[0];
      if(!row){NL4_PUBLISHED_INTERPRETATION=null;panel.hidden=false;syncVisiblePublicProbability();return;}
      NL4_PUBLISHED_INTERPRETATION=row;
      const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val||''};
      set('nl4InterpretationHeadline',row.headline||'Title Race Update');
      set('nl4InterpretationStatus',row.status_label||'ADMIN ANALYSIS');
      set('nl4InterpretationSummary',row.summary||'');
      set('nl4InterpretationTakeaway',row.key_takeaway||'');
      const stats=Array.isArray(row.selected_stats)?row.selected_stats:[];
      const statsEl=document.getElementById('nl4InterpretationViewerStats');
      if(statsEl){
        statsEl.innerHTML=stats.map(s=>`<div class="viewer-stat"><span>${esc(s.label||'STAT')}</span><strong>${esc(liveValueForAdminSelectedStat(s.label,s.value))}</strong></div>`).join('');
        statsEl.style.display=stats.length?'grid':'none';
      }
      const factors=[row.factor_1,row.factor_2,row.factor_3].filter(Boolean);
      const factorEl=document.getElementById('nl4InterpretationFactors');
      if(factorEl){
        factorEl.innerHTML=factors.map(x=>`<div class="factor">${esc(x)}</div>`).join('');
        factorEl.style.display=factors.length?'grid':'none';
      }
      const d=row.published_at?new Date(row.published_at):null;
      set('nl4InterpretationPublished',d&&!Number.isNaN(d.getTime())?`Published by NL4 Admin • ${d.toLocaleString()}`:'Published by NL4 Admin');
      panel.hidden=false;
      syncVisiblePublicProbability();
      renderAutomaticGraphInterpretation(NL4_LAST_PUBLIC_HISTORY,NL4_LAST_PUBLIC_ARSENAL,NL4_LAST_PUBLIC_COMPLETED);
    }catch(err){
      const message=String(err?.message||'');
      if(!message.includes('nl4_model_interpretations') && !message.includes('schema cache')){
        console.warn('NL4 published model interpretation:',err);
      }
      panel.hidden=false;
      syncVisiblePublicProbability();
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

      let fixtures=mergeFixtures(arsenalRes.data||[],leagueRes.data||[]);
      const testDataset=readTestDataset();
      showTestModeBanner(testDataset);

      if(TEST_MODE){
        if(!testDataset)throw new Error('No sandbox dataset found. Generate one in Admin → Model Testing.');
        fixtures=applyTestDataset(fixtures,testDataset);
      }
      updateCoverage(fixtures);

      const results=completedResults(fixtures);
      const currentRows=TEST_MODE
        ? testStandingsFromResults((standingsRes.data||[]).map(r=>norm(r.club)),results)
        : standingsRes.data;
      const currentTeams=normalizeStandings(currentRows);
      const ratings=buildRatings(currentTeams,results);

      await new Promise(r=>setTimeout(r,25));
      const simulation=simulate(ratings,fixtures);
      const environmentAudit=simulationEnvironmentAudit(ratings,fixtures,results);
      const goalPipelineTrace=v136GoalPipelineTrace(ratings,fixtures,results);
      render(
        simulation.rows,
        fixtures.length,
        results.length,
        simulation.scenario,
        simulation.impact,
        simulation.championPointStats,
        simulation.pointThresholds,
        simulation.validationStats,
        environmentAudit,
        goalPipelineTrace
      );
      renderV150TerminalState(simulation,fixtures,results);
      renderV1501TerminalDiagnostics(fixtures);
      markNL4DiagnosticPanels();
      const arsenal=simulation.rows.find(t=>t.club.toLowerCase()==='arsenal');
      let history=[];

      if(TEST_MODE){
        // V13.2: sandbox history is browser-only. It mirrors the live timeline
        // without writing a single probability snapshot to Supabase.
        clearSandboxHistoryAfter(results.length);
        history=saveSandboxSnapshot(arsenal,results.length,testDataset);
        renderTitleHistory(history);
        renderPublicTitleHistory(history,arsenal,results.length);
        syncVisiblePublicProbability();
        renderV123Timeline(history,results,simulation.rows);
        renderV12MatchdayTracker(simulation.rows,results,history,results.length);
        renderV11Explainer(simulation.rows,results,history,results.length);

        const status=document.getElementById('v123TimelineStatus');
        if(status)status.textContent=`TEST MODE • ${Math.max(0,history.length-1)} SANDBOX SNAPSHOT${Math.max(0,history.length-1)===1?'':'S'}`;
        const historyNote=document.getElementById('titleHistoryNote');
        if(historyNote)historyNote.textContent='V13.2 sandbox history is stored only in this browser. Supabase probability history is untouched.';
      }else{
        history=await safeLoadPublicHistory();
        renderPublicTitleHistory(history,arsenal,results.length);
        syncVisiblePublicProbability();

        try{
          await savePublicSnapshot(arsenal,results.length);
          history=await safeLoadPublicHistory();
        }catch(snapshotError){
          console.warn('NL4 public snapshot save:',snapshotError);
        }

        renderPublicTitleHistory(history,arsenal,results.length);
        syncVisiblePublicProbability();
      await loadPublishedModelInterpretation();
        renderV123Timeline(history,results,simulation.rows);
        renderV12MatchdayTracker(simulation.rows,results,history,results.length);
        renderV11Explainer(simulation.rows,results,history,results.length);
      }

      if(isSeasonComplete(fixtures)){
        // V15.0.1: terminal state is deterministic. Early/mid-season
        // counterfactual audits are not applicable once all 380 matches are known.
        renderV1501TerminalDiagnostics(fixtures);
      }else{
        const v138Audit=buildV138SensitivityAudit(currentTeams,fixtures);
        renderV138SensitivityAudit(v138Audit);

        const v140Audit=buildV140SurpriseAudit(currentTeams,fixtures);
        renderV140SurpriseAudit(v140Audit);

        const v141Audit=buildV141ExpectedActualAudit(currentTeams,fixtures);
        renderV141ExpectedActualAudit(v141Audit);

        const v142Audit=buildV142BoundaryAudit(currentTeams,fixtures);
        renderV142BoundaryAudit(v142Audit);

        const v143Audit=buildV143CompressionAudit(currentTeams,fixtures);
        renderV143CompressionAudit(v143Audit);

        const v145Audit=buildV145TransitionConsistencyAudit(currentTeams,fixtures);
        renderV145TransitionConsistencyAudit(v145Audit);

        const v146Audit=buildV146TitleSurgeAudit(currentTeams,fixtures);
        renderV146TitleSurgeAudit(v146Audit);

        const v147Audit=buildV147RivalShockAudit(currentTeams,fixtures);
        renderV147RivalShockAudit(v147Audit);

        const v148Audit=buildV148OpponentNeutralAudit(currentTeams,fixtures);
        renderV148OpponentNeutralAudit(v148Audit);

        const v149Audit=buildV149StabilityAudit(currentTeams,fixtures);
        renderV149StabilityAudit(v149Audit);

        const v1491Audit=buildV1491HotfixAudit(currentTeams,fixtures);
        renderV1491HotfixAudit(v1491Audit);

        const v139Audit=buildV139Decomposition(currentTeams,fixtures);
        renderV139Decomposition(v139Audit);

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
      }
    }catch(error){
      console.error('NL4 title model V13.0:',error);
      tableEl.innerHTML=`<div class="nl4-title-model-loading">Could not calculate title probability: ${esc(error.message)}</div>`;
      if(statusEl)statusEl.textContent='Title model could not run.';
      const publicStatus=document.getElementById('publicModelLiveStatus'); if(publicStatus)publicStatus.textContent='Public Model could not read the live data: '+String(error.message||error);
    }
  }

  loadPublicForecastVisibility();
  load();
})();