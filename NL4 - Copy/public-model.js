(() => {
  const SEASON='2026/27';
  const db=window.nl4Supabase||window.supabaseClient||window.NL4_SUPABASE||window.supabaseDb||window.db;
  const root=document.getElementById('nl4PublicForecastRoot');
  const panel=document.getElementById('nl4PublicModel');
  if(!root||!panel||!db||typeof db.from!=='function'){
    if(root)root.hidden=true;
    return;
  }
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val||'';};

  function renderPublicHistory(rows,actualMatchday=null){
    const svg=document.getElementById('publicTitleHistoryChart');
    const latestEl=document.getElementById('publicTitleHistoryLatest');
    const changeEl=document.getElementById('publicTitleHistoryChange');
    const noteEl=document.getElementById('publicTitleHistoryNote');
    if(!svg)return;

    const latestByMatches=new Map();
    (rows||[]).forEach(r=>{
      const matches=Number(r.completed_matches)||0;
      const probability=Number(r.title_probability);
      if(!Number.isFinite(probability))return;
      const prior=latestByMatches.get(matches);
      const currentTime=new Date(r.created_at||0).getTime()||0;
      const priorTime=prior?new Date(prior.created_at||0).getTime()||0:-1;
      if(!prior||currentTime>=priorTime) latestByMatches.set(matches,{...r,completed_matches:matches,title_probability:probability});
    });
    const history=[...latestByMatches.values()].sort((a,b)=>a.completed_matches-b.completed_matches);

    const W=760,H=240,left=44,right=18,top=18,bottom=34;
    const iw=W-left-right,ih=H-top-bottom;
    const x=m=>left+(Math.max(0,Math.min(380,Number(m)||0))/380)*iw;
    const y=p=>top+(1-Math.max(0,Math.min(100,Number(p)||0))/100)*ih;
    let markup='';
    [0,25,50,75,100].forEach(v=>{
      const yy=y(v);
      markup+=`<line class="nl4-history-grid" x1="${left}" y1="${yy}" x2="${W-right}" y2="${yy}"></line>`;
      markup+=`<text class="nl4-history-axis-text" x="${left-8}" y="${yy+3}" text-anchor="end">${v}%</text>`;
    });
    [0,10,20,30,38].forEach(md=>{
      const xx=x(md*10);
      markup+=`<line class="nl4-history-grid" x1="${xx}" y1="${top}" x2="${xx}" y2="${H-bottom}"></line>`;
      markup+=`<text class="nl4-history-axis-text" x="${xx}" y="${H-12}" text-anchor="middle">MD ${md}</text>`;
    });

    if(!history.length){
      markup+=`<text class="nl4-history-label" x="${W/2}" y="${H/2}" text-anchor="middle">Waiting for the first saved NL4 Model forecast</text>`;
      svg.innerHTML=markup;
      if(latestEl)latestEl.textContent='WAITING FOR FIRST FORECAST';
      if(changeEl)changeEl.textContent='Season change: —';
      return;
    }

    const pts=history.map(r=>[x(r.completed_matches),y(r.title_probability),r]);
    if(pts.length>1){
      const line=pts.map(p=>`${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      const area=`${pts[0][0].toFixed(1)},${(H-bottom).toFixed(1)} ${line} ${pts[pts.length-1][0].toFixed(1)},${(H-bottom).toFixed(1)}`;
      markup+=`<polygon class="nl4-history-area" points="${area}"></polygon>`;
      markup+=`<polyline class="nl4-history-line" points="${line}"></polyline>`;
    }
    pts.forEach((p,i)=>{
      const md=Number.isFinite(Number(actualMatchday))?Number(actualMatchday):Math.max(0,Math.ceil((Number(p[2].completed_matches)||0)/10));
      markup+=`<circle class="nl4-history-dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i===pts.length-1?6:4}"></circle>`;
      if(i===0||i===pts.length-1||pts.length<=5){
        const anchor=p[0]>W-100?'end':p[0]<100?'start':'middle';
        markup+=`<text class="nl4-history-label" x="${p[0].toFixed(1)}" y="${Math.max(12,p[1]-10).toFixed(1)}" text-anchor="${anchor}">${p[2].title_probability.toFixed(1)}%</text>`;
      }
    });
    svg.innerHTML=markup;

    const first=history[0],last=history[history.length-1];
    const delta=last.title_probability-first.title_probability;
    const lastMd=Number.isFinite(Number(actualMatchday))?Number(actualMatchday):Math.max(0,Math.ceil(Number(last.completed_matches||0)/10));
    if(latestEl)latestEl.textContent=`MD ${lastMd} • ${last.title_probability.toFixed(1)}%`;
    if(changeEl)changeEl.textContent=`Season change: ${Math.abs(delta)<0.05?'±0.0':`${delta>0?'+':''}${delta.toFixed(1)}`} pts`;
    if(noteEl){
      noteEl.textContent=history.length===1
        ? `Pre-season NL4 Model baseline: ${last.title_probability.toFixed(1)}%. The line will grow automatically as live forecast snapshots are saved after league results.`
        : `${history.length} saved NL4 Model forecast points loaded from Supabase, from ${first.title_probability.toFixed(1)}% to ${last.title_probability.toFixed(1)}%.`;
    }
  }

  async function loadPublicHistory(){
    try{
      const [historyRes,arsenalRes]=await Promise.all([
        db.from('title_probability_history')
          .select('completed_matches,title_probability,created_at,model_version')
          .eq('season',SEASON)
          .order('completed_matches',{ascending:true})
          .order('created_at',{ascending:true}),
        db.from('premier_league_standings')
          .select('played')
          .eq('season',SEASON)
          .eq('club','Arsenal')
          .limit(1)
      ]);
      if(historyRes.error)throw historyRes.error;
      const actualMatchday=!arsenalRes.error&&arsenalRes.data?.length
        ? Number(arsenalRes.data[0].played||0)
        : null;
      renderPublicHistory(historyRes.data||[],actualMatchday);
      setTimeout(()=>window.NL4RefreshGraphInterpretation?.(),50);
    }catch(err){
      console.warn('NL4 Model history:',err);
      renderPublicHistory([]);
    }
  }

  function evidenceMixFromPlayed(played){
    const p=Math.max(0,Math.min(38,Number(played)||0));
    let historical;
    if(p<=0) historical=1;
    else if(p<=10) historical=1-(p/10)*0.40;
    else if(p<=20) historical=0.60-((p-10)/10)*0.35;
    else if(p<=25) historical=0.25-((p-20)/5)*0.10;
    else if(p<=30) historical=0.15-((p-25)/5)*0.10;
    else historical=Math.max(0,0.05-((p-30)/4)*0.05);
    historical=Math.max(0,Math.min(1,historical));
    return {history:historical*100,live:(1-historical)*100};
  }

  async function latestPublicSnapshot(){
    const res=await db.from('title_probability_history')
      .select('completed_matches,title_probability,top4_probability,top5_probability,expected_points,expected_position,confidence_score,created_at,model_version')
      .eq('season',SEASON)
      .order('completed_matches',{ascending:false})
      .order('created_at',{ascending:false})
      .limit(1);
    if(res.error)throw res.error;
    const snap=res.data?.[0]||null;
    if(!snap)return null;

    const stand=await db.from('premier_league_standings')
      .select('club,played,points,goals_for,goals_against,goal_difference,position')
      .eq('season',SEASON).eq('club','Arsenal').limit(1);
    const arsenal=!stand.error&&stand.data?.length?stand.data[0]:null;
    const mix=evidenceMixFromPlayed(Number.isFinite(Number(arsenal?.played))?Number(arsenal.played):Math.max(0,Math.ceil((Number(snap.completed_matches)||0)/10)));
    return {...snap,arsenal,history_weight:mix.history,live_weight:mix.live};
  }

  function currentStatValue(key,snap,fallback){
    if(!snap)return fallback;
    const pct=n=>Number.isFinite(Number(n))?`${Number(n).toFixed(1)}%`:fallback;
    const dec=(n,suffix='')=>Number.isFinite(Number(n))?`${Number(n).toFixed(1)}${suffix}`:fallback;
    const whole=(n,suffix='')=>Number.isFinite(Number(n))?`${Math.round(Number(n))}${suffix}`:fallback;
    const a=snap.arsenal||{};
    const map={
      title_probability:()=>pct(snap.title_probability),
      top4_probability:()=>pct(snap.top4_probability),
      top5_probability:()=>pct(snap.top5_probability),
      expected_points:()=>dec(snap.expected_points,' pts'),
      expected_position:()=>dec(snap.expected_position),
      confidence_score:()=>whole(snap.confidence_score,'/100'),
      completed_matches:()=>`${whole(snap.completed_matches)}/380`,
      history_weight:()=>pct(snap.history_weight),
      live_weight:()=>pct(snap.live_weight),
      arsenal_points:()=>whole(a.points,' pts'),
      arsenal_position:()=>whole(a.position),
      arsenal_gf:()=>whole(a.goals_for),
      arsenal_ga:()=>whole(a.goals_against),
      arsenal_gd:()=>whole(a.goal_difference),
      arsenal_ppg:()=>Number(a.played)?dec(Number(a.points||0)/Number(a.played)):fallback
    };
    return map[key]?map[key]():fallback;
  }

  function liveAutoCopy(row,snap){
    if(!snap)return {
      headline:row.headline||'Title Race Update', summary:row.summary||'', takeaway:row.key_takeaway||'',
      factors:[row.factor_1,row.factor_2,row.factor_3].filter(Boolean), synced:false
    };
    const t=Number(snap.title_probability||0), top4=Number(snap.top4_probability||0), pts=Number(snap.expected_points||0), pos=Number(snap.expected_position||0);
    const matches=Number(snap.completed_matches||0);
    const arsenalPlayed=Math.max(0,Number(snap.arsenal?.played)||0);
    const md=arsenalPlayed || Math.max(0,Math.ceil(matches/10));
    const mode=String(row.interpretation_mode||'').toLowerCase();
    const style=String(row.interpretation_style||'').toLowerCase();
    const looksAuto=mode.includes('automatic') || /after Matchday \d+/i.test(String(row.headline||'')) || !!style;
    if(!looksAuto)return {
      headline:row.headline||'Title Race Update', summary:row.summary||'', takeaway:row.key_takeaway||'',
      factors:[row.factor_1,row.factor_2,row.factor_3].filter(Boolean), synced:false
    };
    const state=matches>=380?'complete':t>=60?'fav':t>=40?'race':t>=20?'outside':'longshot';
    const headline=state==='complete'?'The Premier League season is complete':
      state==='fav'?`Arsenal are strong title favourites after Matchday ${md}`:
      state==='race'?`Arsenal remain firmly in the title race after Matchday ${md}`:
      state==='outside'?`Arsenal remain in contention after Matchday ${md}`:
      `Arsenal face a difficult title route after Matchday ${md}`;
    let summary=`Arsenal's current NL4 title probability is ${t.toFixed(1)}%, with ${pts.toFixed(1)} expected points and an expected finish of ${pos.toFixed(1)}. ${matches} Premier League ${matches===1?'match is':'matches are'} complete.`;
    if(style==='short') summary=`Arsenal: ${t.toFixed(1)}% for the title, ${pts.toFixed(1)} expected points, ${top4.toFixed(1)}% for the top four. ${matches} league ${matches===1?'match is':'matches are'} complete.`;
    const takeaway=t>=50?'Arsenal currently have the strongest simulated route to first place, but future results can still materially change the race.':'Arsenal remain live in the race, but the rest of the league currently holds the larger combined title chance.';
    const factors=[
      `Arsenal forecast: ${pts.toFixed(1)} expected points and ${pos.toFixed(1)} expected finish.`,
      `Evidence mix: ${Number(snap.history_weight||0).toFixed(0)}% historical / ${Number(snap.live_weight||0).toFixed(0)}% current season.`,
      `Model confidence: ${Math.round(Number(snap.confidence_score||0))}/100 after ${matches} completed league ${matches===1?'match':'matches'}.`
    ];
    return {headline,summary,takeaway,factors,synced:true};
  }

  async function load(){
    let visible=true;
    try{
      const vis=await db.from('nl4_public_forecast_settings').select('is_visible,interpretation_visible').eq('season',SEASON).limit(1);
      if(!vis.error&&vis.data?.length){
        visible=vis.data[0].is_visible!==false && vis.data[0].interpretation_visible!==false;
      }
    }catch(err){ console.warn('NL4 NL4 Model visibility:',err); }
    if(!visible){root.hidden=true;return;}
    await loadPublicHistory();
    try{
      const res=await db.from('nl4_model_interpretations')
        .select('headline,status_label,summary,key_takeaway,factor_1,factor_2,factor_3,selected_stats,published_at,is_published,interpretation_mode,interpretation_style')
        .eq('season',SEASON).eq('is_published',true).order('published_at',{ascending:false}).limit(1);
      if(res.error)throw res.error;
      const row=res.data?.[0];
      if(!row){root.hidden=true;return;}
      let snap=null;
      try{snap=await latestPublicSnapshot();}catch(e){console.warn('NL4 latest NL4 Model snapshot:',e);}
      const copy=liveAutoCopy(row,snap);
      set('nl4InterpretationHeadline',copy.headline);
      set('nl4InterpretationStatus',row.status_label||'PUBLIC FORECAST');
      set('nl4InterpretationSummary',copy.summary);
      set('nl4InterpretationTakeaway',copy.takeaway);
      const stats=Array.isArray(row.selected_stats)?row.selected_stats:[];
      const statsEl=document.getElementById('nl4InterpretationViewerStats');
      if(statsEl){
        statsEl.innerHTML=stats.map(s=>`<div class="viewer-stat"><span>${esc(s.label||'STAT')}</span><strong>${esc(currentStatValue(s.key,snap,s.value||'—'))}</strong></div>`).join('');
        statsEl.style.display=stats.length?'grid':'none';
      }
      const factors=copy.factors||[];
      const factorEl=document.getElementById('nl4InterpretationFactors');
      if(factorEl){
        factorEl.innerHTML=factors.map(x=>`<div class="factor">${esc(x)}</div>`).join('');
        factorEl.style.display=factors.length?'grid':'none';
      }
      const liveDate=copy.synced&&snap?.created_at?new Date(snap.created_at):null;
      const publishedDate=row.published_at?new Date(row.published_at):null;
      if(liveDate&&!Number.isNaN(liveDate.getTime())){
        set('nl4InterpretationPublished',`Automatic interpretation synced to NL4 Model • ${liveDate.toLocaleString()}`);
      }else{
        set('nl4InterpretationPublished',publishedDate&&!Number.isNaN(publishedDate.getTime())?`Published by NL4 Admin • ${publishedDate.toLocaleString()}`:'Published by NL4 Admin');
      }
      panel.hidden=false; root.hidden=false;
    }catch(err){
      console.warn('NL4 NL4 Model:',err); root.hidden=true;
    }
  }
  load();
})();





/* V16.6 • Authoritative NL4 Model graph interpretation renderer */
(function(){
  const SEASON='2026/27';

  function getDb(){
    return window.nl4Supabase ||
           window.supabaseClient ||
           window.NL4_SUPABASE ||
           window.supabaseDb ||
           window.db ||
           null;
  }

  const fmt=n=>Number(n||0).toFixed(1);

  function fallbackMatchday(completed){
    return Math.max(0,Math.min(38,Math.ceil(Number(completed||0)/10)));
  }

  function makeContext(rows, arsenalPlayed){
    const first=rows[0];
    const last=rows[rows.length-1];
    const start=Number(first?.title_probability||0);
    const now=Number(last?.title_probability||0);
    const delta=now-start;
    return {
      start, now, delta,
      abs:Math.abs(delta).toFixed(1),
      points:rows.length,
      matchday:Number.isFinite(Number(arsenalPlayed))
        ? Number(arsenalPlayed)
        : fallbackMatchday(last?.completed_matches),
      completed:Number(last?.completed_matches||0),
      top4:Number(last?.top4_probability||0),
      pts:Number(last?.expected_points||0),
      pos:Number(last?.expected_position||0),
      conf:Number(last?.confidence_score||0)
    };
  }

  function automaticChoices(c){
    const up=c.delta>0.05;
    const down=c.delta<-0.05;
    const direction=up?'risen':down?'fallen':'remained broadly stable';
    const trend=up?'gaining ground':down?'losing ground':'holding steady';

    return {
      'balanced-1':[
        `Arsenal ${trend} in the title race`,
        `Arsenal's NL4 Model title chance is ${fmt(c.now)}% at Matchday ${c.matchday}. It has ${direction}${Math.abs(c.delta)>=0.05?` by ${c.abs} percentage points from ${fmt(c.start)}%`:''}. The graph shows the model's season movement without assigning the full change to one result.`
      ],
      'balanced-2':[
        `NL4 Model moves to ${fmt(c.now)}%`,
        `After ${c.completed} completed league match${c.completed===1?'':'es'}, Arsenal are at ${fmt(c.now)}% for the title. The saved NL4 Model history has moved ${c.delta>=0?'+':''}${fmt(c.delta)} points from its first forecast. The direction may change again as new league evidence arrives.`
      ],
      'balanced-3':[
        `Arsenal's season trend after Matchday ${c.matchday}`,
        `The NL4 Model currently gives Arsenal a ${fmt(c.now)}% title chance, with ${c.points} saved forecast points on the graph. The season movement is ${up?'positive':down?'negative':'stable'} so far, but the graph should be read as a changing probability path rather than a guaranteed prediction.`
      ],
      'momentum-1':[
        `Arsenal ${up?'build':'track'} title-race momentum`,
        up
          ? `Arsenal are gaining momentum: their title probability has climbed from ${fmt(c.start)}% to ${fmt(c.now)}%, up ${c.abs} points across the saved NL4 Model history.`
          : down
          ? `Arsenal have lost momentum: their title probability has fallen from ${fmt(c.start)}% to ${fmt(c.now)}%, down ${c.abs} points.`
          : `Arsenal's title-race momentum is steady at ${fmt(c.now)}%, with little net movement from the opening forecast.`
      ],
      'momentum-2':[
        `Momentum reading: ${fmt(c.now)}%`,
        `At Matchday ${c.matchday}, Arsenal are ${trend}. The NL4 Model has changed ${c.delta>=0?'+':''}${fmt(c.delta)} percentage points from its first saved forecast and now projects ${fmt(c.pts)} expected points.`
      ],
      'momentum-3':[
        `Title-race direction: ${up?'upward':down?'downward':'steady'}`,
        `The graph's current direction is ${up?'upward':down?'downward':'flat'}. Arsenal stand at ${fmt(c.now)}% for the title, and the next saved result update will show whether this movement continues or reverses.`
      ],
      'analyst-1':[
        `Model movement analysis • MD${c.matchday}`,
        `Arsenal's title probability is ${fmt(c.now)}%, compared with ${fmt(c.start)}% at the first saved snapshot. Net movement is ${c.delta>=0?'+':''}${fmt(c.delta)} points across ${c.points} snapshots. Current model confidence is ${Math.round(c.conf)}/100.`
      ],
      'analyst-2':[
        `Probability path and evidence update`,
        `The latest NL4 Model snapshot has Arsenal at ${fmt(c.now)}%, ${fmt(c.pts)} expected points and an expected finish of ${fmt(c.pos)}. The graph has moved ${c.delta>=0?'+':''}${fmt(c.delta)} points from the opening snapshot as current-season evidence enters the model.`
      ],
      'analyst-3':[
        `Saved forecast distribution update`,
        `The graph currently contains ${c.points} NL4 Model forecast points through Matchday ${c.matchday}. Arsenal's latest title estimate is ${fmt(c.now)}%, a net ${c.delta>=0?'+':''}${fmt(c.delta)}-point move from the first saved forecast. This is a model update, not a causal attribution to one match.`
      ],
      'fan-1':[
        `Arsenal are at ${fmt(c.now)}% for the title`,
        up
          ? `The Gunners are moving the right way: Arsenal's title chance has risen ${c.abs} points from ${fmt(c.start)}% to ${fmt(c.now)}%.`
          : down
          ? `Arsenal have given up some ground: the title chance has dropped ${c.abs} points to ${fmt(c.now)}%.`
          : `Arsenal's title chance is holding steady at ${fmt(c.now)}%.`
      ],
      'fan-2':[
        `How the title race looks now`,
        `After Matchday ${c.matchday}, the NL4 Model gives Arsenal a ${fmt(c.now)}% chance of winning the league. The season graph is ${up?'trending upward':down?'trending downward':'currently steady'}.`
      ],
      'fan-3':[
        `North London title-race watch`,
        `Arsenal are currently ${fmt(c.now)}% to win the Premier League in the NL4 Model. That's ${c.delta>=0?'up':'down'} ${c.abs} points from the first saved forecast, with more movement expected as results arrive.`
      ]
    };
  }

  async function applySavedGraphInterpretation(){
    const db=getDb();
    if(!db || typeof db.from!=='function') return;

    try{
      const [settingsRes, historyRes, arsenalRes] = await Promise.all([
        db.from('nl4_public_forecast_settings')
          .select('graph_interpretation_mode,graph_interpretation_style,graph_interpretation_option,graph_interpretation_headline,graph_interpretation_text,updated_at')
          .eq('season',SEASON)
          .limit(1),
        db.from('title_probability_history')
          .select('completed_matches,title_probability,top4_probability,expected_points,expected_position,confidence_score,created_at')
          .eq('season',SEASON)
          .order('completed_matches',{ascending:true})
          .order('created_at',{ascending:true}),
        db.from('premier_league_standings')
          .select('played')
          .eq('season',SEASON)
          .eq('club','Arsenal')
          .limit(1)
      ]);

      if(settingsRes.error) throw settingsRes.error;
      if(historyRes.error) throw historyRes.error;

      const setting=settingsRes.data?.[0]||{};
      const rows=historyRes.data||[];
      if(!rows.length) return;

      const arsenalPlayed=!arsenalRes.error&&arsenalRes.data?.length
        ? Number(arsenalRes.data[0].played||0)
        : null;

      const c=makeContext(rows,arsenalPlayed);
      const mode=setting.graph_interpretation_mode||'automatic';
      const style=setting.graph_interpretation_style||'balanced';
      const option=setting.graph_interpretation_option||`${style}-1`;
      const choices=automaticChoices(c);
      const picked=choices[option]||choices[`${style}-1`]||choices['balanced-1'];

      const label=document.getElementById('nl4GraphInterpretationLabel');
      const change=document.getElementById('nl4GraphInterpretationChange');
      const text=document.getElementById('nl4GraphInterpretationText');
      const meta=document.getElementById('nl4GraphInterpretationMeta');

      if(change){
        change.textContent=c.delta>0.05
          ? `↑ +${c.abs} PTS`
          : c.delta<-0.05
          ? `↓ ${c.abs} PTS`
          : '±0.0 PTS';
      }

      if(mode==='manual' && setting.graph_interpretation_text){
        if(label) label.textContent=setting.graph_interpretation_headline||'NL4 GRAPH INTERPRETATION';
        if(text) text.textContent=setting.graph_interpretation_text;
        if(meta) meta.textContent=`Manual interpretation • synced to ${c.points} NL4 Model forecast point${c.points===1?'':'s'} • latest Matchday ${c.matchday}.`;
      }else{
        if(label) label.textContent=picked[0];
        if(text) text.textContent=picked[1];
        if(meta) meta.textContent=`Automatic • ${style.toUpperCase()} • Option ${String(option).split('-').pop()} • synced to ${c.points} NL4 Model forecast point${c.points===1?'':'s'} • latest Matchday ${c.matchday}.`;
      }

      document.getElementById('nl4PublicGraphInterpretation')?.setAttribute('data-saved-option',option);
    }catch(error){
      console.error('NL4 saved graph interpretation could not be applied:',error);
    }
  }

  document.addEventListener('DOMContentLoaded',()=>setTimeout(applySavedGraphInterpretation,900));
  window.addEventListener('load',()=>setTimeout(applySavedGraphInterpretation,300));
  window.addEventListener('focus',applySavedGraphInterpretation);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)applySavedGraphInterpretation();});
  setInterval(applySavedGraphInterpretation,15000);

  window.NL4RefreshGraphInterpretation=applySavedGraphInterpretation;
})();


/* V16.9 • Instant NL4 Model realtime refresh */
(function(){
  let channel=null;
  let refreshTimer=null;

  function client(){
    return window.nl4Supabase ||
           window.supabaseClient ||
           window.NL4_SUPABASE ||
           window.supabaseDb ||
           window.db ||
           null;
  }

  async function refreshNow(){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(async()=>{
      try{
        // Re-run the page's public-model loader without waiting for focus/reload.
        if(typeof window.NL4ReloadPublicModel==='function'){
          await window.NL4ReloadPublicModel();
        }else{
          // Existing public-model.js boot functions are closure-local, so notify
          // the page and refresh the visible model from Supabase by reloading once.
          window.dispatchEvent(new CustomEvent('nl4:public-model-history-changed'));
          location.reload();
        }
      }catch(error){
        console.error('NL4 realtime public refresh failed:',error);
      }
    },80);
  }

  function subscribe(){
    const db=client();
    if(!db || typeof db.channel!=='function') return;
    try{
      channel=db.channel('nl4-public-model-live-v169')
        .on('postgres_changes',{
          event:'*',
          schema:'public',
          table:'title_probability_history',
          filter:'season=eq.2026/27'
        },refreshNow)
        .subscribe();
    }catch(error){
      console.error('NL4 realtime subscription failed:',error);
    }
  }

  document.addEventListener('DOMContentLoaded',subscribe);
})();
