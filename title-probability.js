(function(){
  const SEASON='2026/27';
  const SIMULATIONS=25000;
  const TOTAL_FIXTURES=380;
  const MAX_SCORE=7;
  const ELO_BASE=1500;
  const ELO_K_EARLY=34;
  const ELO_K_MATURE=22;

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
    const ratings=new Map(clubs.map(c=>[c,ELO_BASE]));
    const matchesPlayed=new Map(clubs.map(c=>[c,0]));
    const ordered=[...results].sort((a,b)=>resultTime(a)-resultTime(b));

    for(const r of ordered){
      const home=ratings.get(r.home), away=ratings.get(r.away);
      if(home===undefined||away===undefined) continue;

      const hs=Number(r.home_score), as=Number(r.away_score);
      if(!Number.isFinite(hs)||!Number.isFinite(as)) continue;

      const actual=hs>as?1:hs===as?.5:0;
      const expected=expectedEloScore(home,away,55);
      const hp=matchesPlayed.get(r.home)||0, ap=matchesPlayed.get(r.away)||0;
      const maturity=Math.min(1,(hp+ap)/20);
      const k=ELO_K_EARLY+(ELO_K_MATURE-ELO_K_EARLY)*maturity;
      const margin=Math.max(1,Math.abs(hs-as));
      const marginMult=Math.min(1.35,1+Math.log1p(margin-1)*.18);
      const change=k*marginMult*(actual-expected);

      ratings.set(r.home,home+change);
      ratings.set(r.away,away-change);
      matchesPlayed.set(r.home,hp+1);
      matchesPlayed.set(r.away,ap+1);
    }
    return ratings;
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
    const elo=buildElo(results,clubs);

    const totalPlayed=teams.reduce((s,t)=>s+t.played,0);
    const totalGF=teams.reduce((s,t)=>s+t.gf,0);
    const leagueGoalAvg=totalPlayed?totalGF/totalPlayed:1.35;
    const avgPpg=teams.reduce((s,t)=>s+t.ppg,0)/teams.length||1.35;

    return teams.map(t=>{
      const sample=t.played/(t.played+10);
      const attackRaw=t.played?t.gfpg/leagueGoalAvg:1;
      const defenceRaw=t.played?t.gapg/leagueGoalAvg:1; // lower is better
      const attack=1+(attackRaw-1)*sample;
      const defence=1+(defenceRaw-1)*sample;
      const ppgPower=1+((t.ppg-avgPpg)/1.35)*Math.min(.14,sample*.14);
      const eloRating=elo.get(t.club)??ELO_BASE;
      const eloFactor=Math.pow(10,(eloRating-ELO_BASE)/900);
      const form=recent.get(t.club)||{factor:1,label:'PRE-SEASON'};
      const split=splits.get(t.club)||{homeGF:0,homeGA:0,homeP:0,awayGF:0,awayGA:0,awayP:0};

      const homeSample=Math.min(1,split.homeP/6);
      const awaySample=Math.min(1,split.awayP/6);

      const homeAttackAdj=split.homeP ? 1+(((split.homeGF/split.homeP)/leagueGoalAvg)-1)*homeSample*.18 : 1;
      const homeDefAdj=split.homeP ? 1+(((split.homeGA/split.homeP)/leagueGoalAvg)-1)*homeSample*.18 : 1;
      const awayAttackAdj=split.awayP ? 1+(((split.awayGF/split.awayP)/leagueGoalAvg)-1)*awaySample*.18 : 1;
      const awayDefAdj=split.awayP ? 1+(((split.awayGA/split.awayP)/leagueGoalAvg)-1)*awaySample*.18 : 1;

      return {...t,attack,defence,ppgPower,eloRating,eloFactor,
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

    const powerRatio=Math.max(.80,Math.min(1.20,home.ppgPower/away.ppgPower));
    const formRatio=Math.max(.84,Math.min(1.16,home.formFactor/away.formFactor));
    const eloRatio=Math.max(.84,Math.min(1.16,home.eloFactor/away.eloFactor));

    let homeLambda=home.leagueGoalAvg * home.attack * away.defence *
      home.homeAttackAdj * away.awayDefAdj * HOME_ADV_ATTACK *
      Math.sqrt(powerRatio) * Math.sqrt(formRatio) * Math.sqrt(eloRatio);

    let awayLambda=away.leagueGoalAvg * away.attack * home.defence *
      away.awayAttackAdj * home.homeDefAdj * HOME_ADV_DEFENCE /
      Math.sqrt(powerRatio) / Math.sqrt(formRatio) / Math.sqrt(eloRatio);

    homeLambda=Math.max(.20,Math.min(3.8,homeLambda));
    awayLambda=Math.max(.15,Math.min(3.5,awayLambda));

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
        if(arsenalChampion) rec.titles++;
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
      q25:quantile(.25),
      median:quantile(.5),
      q75:quantile(.75)
    };

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

    return {rows,scenario,impact,championPointStats,pointThresholds};
  }

  function render(rows,fixtureCount,completedCount,scenario,impact,championPointStats,pointThresholds){
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
        ? 'Pre-season baseline: no 2026/27 league result has been recorded yet, so every club starts from the neutral Elo prior.'
        : confidence.label==='LOW'
          ? `Only ${completedCount} league matches are complete. Current-season ratings are still strongly regressed toward league average.`
          : confidence.label==='MEDIUM'
            ? `${completedCount} completed matches provide meaningful current-season evidence, though uncertainty remains.`
            : `${completedCount} completed matches provide strong evidence for Elo, recent form and home/away ratings.`;
    }

    setText('titleCompletedMatches',`${completedCount}/${TOTAL_FIXTURES}`);

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
      statusEl.textContent=`V10 • ${phase} • ${SIMULATIONS.toLocaleString()} simulations • title-points target • race momentum • probability history • Elo calibration • Poisson-style goals • recent form • home/away performance`;
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

  async function loadTitleHistory(){
    try{
      const res=await db.from('title_probability_history')
        .select('completed_matches,title_probability,top4_probability,top5_probability,expected_points,expected_position,confidence_score,created_at')
        .eq('season',SEASON)
        .order('completed_matches',{ascending:true});
      if(res.error)throw res.error;
      renderTitleHistory(res.data||[]);
    }catch(err){
      console.warn('NL4 probability history:',err);
      const note=document.getElementById('titleHistoryNote');
      if(note)note.textContent='Probability history could not be loaded.';
    }
  }

  async function saveAdminSnapshot(arsenal,completedCount){
    if(!arsenal||completedCount<1)return;
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
        p_model_version:'V8'
      });
      if(rpc.error)throw rpc.error;
      await loadTitleHistory();
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
      const [standingsRes,arsenalRes,leagueRes]=await Promise.all([
        db.from('premier_league_standings')
          .select('position,club,played,wins,draws,losses,goals_for,goals_against,goal_difference,points')
          .eq('season',SEASON).order('position',{ascending:true}),
        db.from('fixtures')
          .select('home_team,away_team,is_home,opponent,arsenal_score,opponent_score,status,kickoff_at,matchday,competition,season,updated_at')
          .eq('season',SEASON).eq('competition','Premier League'),
        db.from('premier_league_matches')
          .select('home_team,away_team,home_score,away_score,status,kickoff_at,matchday,season,updated_at')
          .eq('season',SEASON)
      ]);

      if(standingsRes.error)throw standingsRes.error;
      if(arsenalRes.error)throw arsenalRes.error;
      if(leagueRes.error)throw leagueRes.error;
      if(!standingsRes.data||standingsRes.data.length!==20)
        throw new Error(`The model needs all 20 clubs. Found ${standingsRes.data?.length||0}.`);

      const fixtures=mergeFixtures(arsenalRes.data||[],leagueRes.data||[]);
      updateCoverage(fixtures);

      const results=completedResults(fixtures);
      const ratings=buildRatings(normalizeStandings(standingsRes.data),results);

      await new Promise(r=>setTimeout(r,25));
      const simulation=simulate(ratings,fixtures);
      render(
        simulation.rows,
        fixtures.length,
        results.length,
        simulation.scenario,
        simulation.impact,
        simulation.championPointStats,
        simulation.pointThresholds
      );
      const arsenal=simulation.rows.find(t=>t.club.toLowerCase()==='arsenal');
      await loadTitleHistory();
      await saveAdminSnapshot(arsenal,results.length);
    }catch(error){
      console.error('NL4 title model V10:',error);
      tableEl.innerHTML=`<div class="nl4-title-model-loading">Could not calculate title probability: ${esc(error.message)}</div>`;
      if(statusEl)statusEl.textContent='Title model could not run.';
    }
  }

  load();
})();