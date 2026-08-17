(() => {
  'use strict';

  function initForecastPublisher(){
    const root=document.getElementById('modelInterpretationAdmin');
    if(!root)return;

    const $=id=>document.getElementById(id);
    const msg=$('modelInterpretationMessage');
    const setupWarning=$('forecastPublisherSetupWarning');
    let latest=null, forecastStats=[], selectedStyle='balanced', selectedForecastSource='live';

    const db=()=>window.nl4Supabase||window.supabaseClient||window.db||window.supabaseDb||null;
    const errorText=e=>String(e?.message||e||'').toLowerCase();
    const missingTable=e=>{
      const m=errorText(e);
      return (m.includes('schema cache')||m.includes('pgrst205')) &&
        (m.includes('nl4_model_interpretations')||m.includes('nl4_public_forecast_settings'));
    };
    const authFailure=e=>{
      const m=errorText(e);
      return m.includes('401')||m.includes('unauthorized')||m.includes('jwt')||
        m.includes('session not found')||m.includes('refresh token')||m.includes('not authenticated');
    };
    const say=(text,kind='')=>{
      if(!msg)return;
      msg.textContent=text;
      msg.dataset.kind=kind;
      msg.style.color=kind==='ok'?'#d8ad45':kind==='error'?'#ff8c8c':'';
    };
    const setBusy=(btn,on,label)=>{
      if(!btn)return;
      if(on){
        btn.dataset.originalText=btn.textContent;
        btn.textContent=label||'WORKING…';
        btn.disabled=true;
        btn.classList.add('nl4-btn-busy');
      }else{
        btn.textContent=btn.dataset.originalText||btn.textContent;
        btn.disabled=false;
        btn.classList.remove('nl4-btn-busy');
      }
    };
    const showSetup=()=>{
      if(setupWarning)setupWarning.hidden=false;
      const s=$('publicForecastVisibilityState');
      if(s)s.textContent='SETUP REQUIRED';
    };

    const clearSetupWarning=()=>{
      if(setupWarning)setupWarning.hidden=true;
    };

    async function requireAdminSession(){
      const client=db();
      if(!client)throw new Error('Supabase client not found.');

      let session=null;
      try{
        const {data,error}=await client.auth.getSession();
        if(error)throw error;
        session=data?.session||null;
      }catch(e){
        throw new Error('ADMIN_SESSION_INVALID: '+(e.message||String(e)));
      }

      if(!session){
        throw new Error('ADMIN_SESSION_EXPIRED: No active Admin session.');
      }

      // Verify the access token against Supabase, rather than trusting stale local storage.
      try{
        const {data,error}=await client.auth.getUser();
        if(error||!data?.user)throw error||new Error('User not found');
      }catch(firstError){
        // One refresh attempt only.
        try{
          const refreshed=await client.auth.refreshSession();
          if(refreshed.error||!refreshed.data?.session)throw refreshed.error||new Error('Refresh failed');
          session=refreshed.data.session;

          const verified=await client.auth.getUser();
          if(verified.error||!verified.data?.user)throw verified.error||new Error('User verification failed');
        }catch(refreshError){
          throw new Error('ADMIN_SESSION_EXPIRED: '+(refreshError?.message||firstError?.message||'Please sign in again.'));
        }
      }

      return {client,session};
    }

    function handleWriteError(e){
      const m=String(e?.message||e||'');
      if(m.includes('ADMIN_SESSION_EXPIRED')||m.includes('ADMIN_SESSION_INVALID')||authFailure(e)){
        clearSetupWarning();
        const state=$('publicForecastVisibilityState');
        if(state)state.textContent='ADMIN SIGN-IN REQUIRED';
        say('Your Admin session has expired. Sign out, sign in again, then retry this action.','error');
        return true;
      }
      if(missingTable(e)){
        showSetup();
        say('Database setup required. Run V15.4-forecast-publisher-setup.sql once in Supabase.','error');
        return true;
      }
      return false;
    }

    const v=id=>($(id)?.value||'').trim();
    const setv=(id,val)=>{const e=$(id);if(e)e.value=val||'';};
    const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

    const STAT_DEFS=[
      ['Core','title_probability','Title probability','%'],
      ['Core','top4_probability','Top 4 probability','%'],
      ['Core','top5_probability','Top 5 probability','%'],
      ['Core','expected_points','Expected final points','pts'],
      ['Core','expected_position','Expected finish',''],
      ['Core','confidence_score','Model confidence','/100'],
      ['Season','completed_matches','Completed league matches','/380'],
      ['Season','history_weight','Historical evidence weight','%'],
      ['Season','live_weight','Current-season evidence weight','%'],
      ['Season','arsenal_points','Arsenal current points','pts'],
      ['Season','arsenal_position','Arsenal current position',''],
      ['Season','arsenal_ppg','Arsenal PPG',''],
      ['Season','arsenal_gf','Goals for',''],
      ['Season','arsenal_ga','Goals against',''],
      ['Season','arsenal_gd','Goal difference',''],
      ['Model','historical_anchor','Historical points anchor','pts'],
      ['Model','scoring_baseline','Scoring baseline','goals/team']
    ];

    function stat(def,row){
      const [group,key,label,suffix]=def,raw=row[key];
      if(raw===null||raw===undefined||raw==='')return null;
      let display=raw;
      if(!Number.isNaN(Number(raw))){
        const n=Number(raw);
        const integer=['completed_matches','arsenal_points','arsenal_position','arsenal_gf','arsenal_ga','arsenal_gd','confidence_score'].includes(key);
        display=integer?String(Math.round(n)):n.toFixed(1);
      }
      if(suffix==='%')display+='%';
      else if(suffix==='pts')display+=' pts';
      else if(suffix==='/100')display+='/100';
      else if(suffix==='/380')display+='/380';
      else if(suffix)display+=' '+suffix;
      return {group,key,label,value:display};
    }

    function selectedStats(){
      const keys=[...root.querySelectorAll('.forecast-stat-check:checked')].map(e=>e.value);
      return forecastStats.filter(s=>keys.includes(s.key));
    }
    function selectedCount(){
      const el=$('selectedForecastStatsCount');
      if(el)el.textContent=`${selectedStats().length} SELECTED`;
    }
    function renderStats(){
      const host=$('allForecastStatsList'); if(!host)return;
      let last='';
      host.innerHTML=forecastStats.map(s=>{
        const h=s.group!==last?`<div class="forecast-stat-group-title">${esc(s.group.toUpperCase())}</div>`:'';
        last=s.group;
        return h+`<label class="forecast-stat-option"><input type="checkbox" class="forecast-stat-check" value="${esc(s.key)}"><span><b>${esc(s.label)}</b><strong>${esc(s.value)}</strong><small>Show this statistic to viewers.</small></span></label>`;
      }).join('');
      host.querySelectorAll('.forecast-stat-check').forEach(e=>e.addEventListener('change',selectedCount));
    }

    async function supplementary(client,row){
      const result={...row,historical_anchor:81.5,scoring_baseline:1.42};
      const {data,error}=await client.from('premier_league_standings')
        .select('club,position,played,points,goals_for,goals_against,goal_difference')
        .eq('season','2026/27');
      if(!error){
        const a=(data||[]).find(x=>x.club==='Arsenal');
        if(a){
          const mp=Number(a.played)||0;
          result.arsenal_points=Number(a.points);result.arsenal_position=Number(a.position);
          result.arsenal_gf=Number(a.goals_for);result.arsenal_ga=Number(a.goals_against);
          result.arsenal_gd=Number(a.goal_difference);result.arsenal_ppg=mp?Number(a.points)/mp:0;
          let hist=mp<=10?1-(mp/10)*.4:mp<=20?.6-((mp-10)/10)*.35:mp<=25?.25-((mp-20)/5)*.10:mp<=30?.15-((mp-25)/5)*.10:mp<34?.05-((mp-30)/4)*.05:0;
          hist=Math.max(0,Math.min(1,hist));result.history_weight=hist*100;result.live_weight=(1-hist)*100;
        }
      }
      return result;
    }


    function readSandboxForecast(){
      const HISTORY_KEY='nl4_v132_test_history';
      try{
        const parsed=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
        if(!Array.isArray(parsed)||!parsed.length)return null;
        const rows=parsed
          .filter(r=>r&&r.season==='2026/27')
          .sort((a,b)=>{
            const count=Number(b.completed_matches||0)-Number(a.completed_matches||0);
            if(count!==0)return count;
            return new Date(b.created_at||0)-new Date(a.created_at||0);
          });
        if(!rows.length)return null;
        return {...rows[0],_forecast_source:'SANDBOX TEST'};
      }catch(err){
        console.warn('NL4 sandbox forecast history could not be read:',err);
        return null;
      }
    }

    async function readLiveForecast(client){
      const {data,error}=await client.from('title_probability_history')
        .select('completed_matches,title_probability,top4_probability,top5_probability,expected_points,expected_position,confidence_score,created_at')
        .eq('season','2026/27')
        .order('completed_matches',{ascending:false})
        .order('created_at',{ascending:false})
        .limit(1);
      if(error)throw error;
      return data?.[0]?{...data[0],_forecast_source:'LIVE SUPABASE'}:null;
    }

    function chooseForecastSource(live,sandbox){
      if(live&&!sandbox)return live;
      if(sandbox&&!live)return sandbox;
      if(!live&&!sandbox)return null;

      const liveCount=Number(live.completed_matches||0);
      const sandboxCount=Number(sandbox.completed_matches||0);

      // Prefer the forecast with more completed league matches.
      if(sandboxCount>liveCount)return sandbox;
      if(liveCount>sandboxCount)return live;

      // Same progress: use the newest timestamp.
      const liveTime=new Date(live.created_at||0).getTime()||0;
      const sandboxTime=new Date(sandbox.created_at||0).getTime()||0;
      return sandboxTime>liveTime?sandbox:live;
    }

    function showForecastSource(row,live,sandbox){
      const badge=$('forecastDataSourceState');
      const card=$('forecastSourceCard');
      const name=$('forecastSourceName');
      const detail=$('forecastSourceDetail');
      if(!row)return;
      const source=row._forecast_source||'UNKNOWN';
      if(badge)badge.textContent=`SOURCE: ${source}`;
      if(card)card.hidden=false;
      if(name)name.textContent=source;
      if(detail){
        const liveCount=live?Number(live.completed_matches||0):null;
        const sandboxCount=sandbox?Number(sandbox.completed_matches||0):null;
        const parts=[
          `Loaded ${Number(row.completed_matches||0)} completed league matches.`,
          liveCount!==null?`Live Supabase: ${liveCount} matches.`:'No live Supabase snapshot.',
          sandboxCount!==null?`Sandbox browser: ${sandboxCount} matches.`:'No sandbox snapshot.'
        ];
        detail.textContent=parts.join(' ');
      }
    }

    async function loadLatest(){
      const btn=$('loadLatestModelBtn'),client=db();
      if(!client){say('Supabase client not found.','error');return;}

      const sourceLabel=selectedForecastSource==='sandbox'?'SANDBOX TEST':'LIVE STATISTICAL';
      setBusy(btn,true,'READING FORECAST…');
      say(`Reading ${sourceLabel} forecast…`);

      try{
        let live=null,sandbox=null,chosen=null;

        if(selectedForecastSource==='sandbox'){
          sandbox=readSandboxForecast();
          if(!sandbox){
            throw new Error('No sandbox test forecast exists in this browser. Run the testing machine first or switch to LIVE STATISTICAL.');
          }
          chosen=sandbox;
        }else{
          live=await readLiveForecast(client);
          if(!live){
            throw new Error('No live statistical forecast snapshot exists in Supabase.');
          }
          chosen=live;
        }

        latest=await supplementary(client,chosen);
        latest._forecast_source=chosen._forecast_source;

        forecastStats=STAT_DEFS.map(d=>stat(d,latest)).filter(Boolean);
        renderStats();

        ['title_probability','top4_probability','top5_probability','expected_points',
         'expected_position','confidence_score','completed_matches','history_weight','live_weight']
          .forEach(k=>{
            const c=root.querySelector(`.forecast-stat-check[value="${k}"]`);
            if(c)c.checked=true;
          });

        selectedCount();
        showForecastSource(latest,live,sandbox);

        const source=latest._forecast_source;
        const count=Number(latest.completed_matches||0);
        say(`${source} loaded successfully: ${count} completed league matches.`, 'ok');
      }catch(e){
        say(e.message||String(e),'error');
      }finally{
        setBusy(btn,false);
      }
    }

    function context(){
      return {
        t:Number(latest?.title_probability||0),top4:Number(latest?.top4_probability||0),
        pts:Number(latest?.expected_points||0),pos:Number(latest?.expected_position||0),
        conf:Number(latest?.confidence_score||0),matches:Number(latest?.completed_matches||0),
        hist:Number(latest?.history_weight||0),live:Number(latest?.live_weight??100)
      };
    }
    function draft(style){
      if(!latest){say('Load the complete forecast first.','error');return null;}
      const c=context(),md=Math.round(c.matches/10);
      const h=c.matches>=380?'The Premier League season is complete':c.t>=60?`Arsenal are strong title favourites after Matchday ${md}`:c.t>=40?`Arsenal remain firmly in the title race after Matchday ${md}`:c.t>=20?`Arsenal remain in contention after Matchday ${md}`:`Arsenal face a difficult title route after Matchday ${md}`;
      const common=`Arsenal's NL4 title probability is ${c.t.toFixed(1)}%, with ${c.pts.toFixed(1)} expected points and an expected finish of ${c.pos.toFixed(1)}. The evidence mix is ${c.hist.toFixed(0)}% historical and ${c.live.toFixed(0)}% current season.`;
      const variants={
        balanced:[h,'TITLE RACE UPDATE',`${common} The estimate includes Arsenal and all 19 rivals and should be read as a probability, not a guarantee.`,c.t>=50?'Arsenal currently have the strongest simulated route to first place.':'Arsenal remain in the race, but the rest of the league holds the larger combined chance.'],
        short:[h,'NL4 QUICK READ',`Arsenal: ${c.t.toFixed(1)}% title chance, ${c.top4.toFixed(1)}% top-four chance and ${c.pts.toFixed(1)} expected points.`,c.t>=50?'Current position: title favourite.':'Current position: chasing the title leaders.'],
        analyst:[`NL4 model: Arsenal ${c.t.toFixed(1)}% for the title`,'MODEL ANALYSIS',`${common} Model confidence is ${c.conf}/100. The probability reacts to Arsenal's path and the title paths of credible rivals.`,'The full 20-team distribution matters more than one isolated result.'],
        fan:[c.t>=50?'Arsenal have the edge in the title race':h,'FAN EXPLAINER',`NL4 gives Arsenal a ${c.t.toFixed(1)}% chance of becoming champions — roughly ${Math.round(c.t)} title wins in every 100 simulations of the current situation.`,c.t>=50?'Arsenal are in a strong position, but the title is not certain.':'The route remains open, but Arsenal need the balance of results to improve.'],
        cautious:[`Arsenal's title probability stands at ${c.t.toFixed(1)}%`,'CAUTIOUS MODEL READ',`${common} Football is volatile, so this number can move quickly when Arsenal or major rivals outperform expectations.`,`Model confidence is ${c.conf}/100; this is an estimate, not a guarantee.`],
        story:[c.t>=50?'The title path currently runs through Arsenal':`Arsenal's title path remains open`,'TITLE-RACE STORY',`The NL4 race gives Arsenal ${c.t.toFixed(1)}%. Their own path projects to ${c.pts.toFixed(1)} points, while every major rival result changes how many routes to first remain available.`,c.t>=50?'Arsenal control the largest share of title-winning paths right now.':'Arsenal need strong results and some help from rival outcomes.']
      };
      const x=variants[style]||variants.balanced;
      return {headline:x[0],status:x[1],summary:x[2],takeaway:x[3],
        f1:`Arsenal forecast: ${c.pts.toFixed(1)} expected points and ${c.pos.toFixed(1)} expected finish.`,
        f2:`Evidence mix: ${c.hist.toFixed(0)}% historical / ${c.live.toFixed(0)}% current season.`,
        f3:`Model confidence: ${c.conf}/100 after ${c.matches} completed league matches.`};
    }
    function useDraft(style){
      selectedStyle=style; const d=draft(style); if(!d)return;
      setv('interpHeadline',d.headline);setv('interpStatusLabel',d.status);setv('interpSummary',d.summary);
      setv('interpTakeaway',d.takeaway);setv('interpFactor1',d.f1);setv('interpFactor2',d.f2);setv('interpFactor3',d.f3);
      say(`${style} interpretation loaded into the manual editor.`,'ok');
    }
    function showAuto(style){
      if(!latest){say('Load the complete forecast first.','error');return;}
      selectedStyle=style;
      root.querySelectorAll('.interpret-style-btn').forEach(b=>b.classList.toggle('active',b.dataset.style===style));
      const host=$('automaticInterpretationChoices'),styles=[style,...['balanced','short','analyst','fan','cautious','story'].filter(x=>x!==style).slice(0,2)];
      host.innerHTML=styles.map(s=>{const d=draft(s);return `<article class="auto-interpretation-card"><h4>${esc(s.toUpperCase())}</h4><p><b>${esc(d.headline)}</b><br>${esc(d.summary)}</p><button type="button" class="ghost-btn use-auto-draft" data-style="${s}">Use This Interpretation</button></article>`}).join('');
      host.querySelectorAll('.use-auto-draft').forEach(b=>b.addEventListener('click',()=>useDraft(b.dataset.style)));
    }

    async function publish(){
      const btn=$('publishInterpretationBtn');
      say('Publish button pressed…');
      let client;
      try{
        ({client}=await requireAdminSession());
        clearSetupWarning();
      }catch(e){
        handleWriteError(e);
        return;
      }
      const stats=selectedStats();
      if(!stats.length){say('Choose at least one forecast statistic.','error');return;}
      if(!v('interpHeadline')||!v('interpSummary')){say('Add a headline and interpretation before publishing.','error');return;}
      setBusy(btn,true,'PUBLISHING…');
      try{
        await client.from('nl4_model_interpretations').update({is_published:false}).eq('season','2026/27').eq('is_published',true);
        const row={season:'2026/27',headline:v('interpHeadline'),status_label:v('interpStatusLabel')||'TITLE RACE UPDATE',summary:v('interpSummary'),key_takeaway:v('interpTakeaway'),factor_1:v('interpFactor1'),factor_2:v('interpFactor2'),factor_3:v('interpFactor3'),selected_stats:stats,interpretation_mode:'automatic+manual',interpretation_style:selectedStyle,forecast_source:latest?._forecast_source||'UNKNOWN',is_published:true,published_at:new Date().toISOString(),source_completed_matches:latest?.completed_matches??null,source_title_probability:latest?.title_probability??null};
        const {error}=await client.from('nl4_model_interpretations').insert(row);
        if(error)throw error;
        $('modelInterpretationState').textContent='PUBLISHED'; say('Published successfully to viewers.','ok');
      }catch(e){
        if(!handleWriteError(e))say(e.message||String(e),'error');
      }finally{setBusy(btn,false);}
    }

    async function setVisibility(kind,show){
      const statistical=kind==='statistical';
      const btn=$(statistical
        ? (show?'showPublicForecastBtn':'hidePublicForecastBtn')
        : (show?'showInterpretationForecastBtn':'hideInterpretationForecastBtn'));
      say(`${show?'Add':'Remove'} ${statistical?'Statistical Forecast':'Interpretation'} button pressed…`);

      let client;
      try{
        ({client}=await requireAdminSession());
        clearSetupWarning();
      }catch(e){
        handleWriteError(e);
        return;
      }

      setBusy(btn,true,show?'ADDING…':'REMOVING…');
      try{
        const payload={season:'2026/27',updated_at:new Date().toISOString()};
        if(statistical)payload.is_visible=!!show;
        else payload.interpretation_visible=!!show;

        const {error}=await client.from('nl4_public_forecast_settings')
          .upsert(payload,{onConflict:'season'});
        if(error)throw error;

        const state=$(statistical?'publicForecastVisibilityState':'interpretationForecastVisibilityState');
        if(state)state.textContent=show?'VISIBLE TO VIEWERS':'REMOVED FROM VIEWERS';
        say(`${statistical?'Statistical forecast':'Interpretation forecast'} ${show?'added to':'removed from'} the public Premier League page.`,'ok');
      }catch(e){
        if(!handleWriteError(e))say(e.message||String(e),'error');
      }finally{
        setBusy(btn,false);
      }
    }

    async function readVisibility(){
      const client=db(),state=$('publicForecastVisibilityState');
      if(!client){if(state)state.textContent='NO DATABASE';return;}
      try{
        const {data,error}=await client.from('nl4_public_forecast_settings').select('is_visible,interpretation_visible').eq('season','2026/27').limit(1);
        if(error)throw error;
        clearSetupWarning();
        if(state)state.textContent=(data?.[0]?.is_visible!==false)?'VISIBLE TO VIEWERS':'REMOVED FROM VIEWERS';
        const interpretationState=$('interpretationForecastVisibilityState');
        if(interpretationState)interpretationState.textContent=(data?.[0]?.interpretation_visible!==false)?'VISIBLE TO VIEWERS':'REMOVED FROM VIEWERS';
      }catch(e){
        if(missingTable(e)){showSetup();if(state)state.textContent='SETUP REQUIRED';}
        else if(state)state.textContent='CHECK FAILED';
      }
    }


    function setForecastSource(source){
      selectedForecastSource=source==='sandbox'?'sandbox':'live';
      root.querySelectorAll('.source-choice-btn').forEach(btn=>{
        btn.classList.toggle('active',btn.dataset.source===selectedForecastSource);
      });
      const badge=$('forecastDataSourceState');
      if(badge)badge.textContent=`SOURCE: ${selectedForecastSource==='sandbox'?'SANDBOX TEST':'LIVE STATISTICAL'}`;
      latest=null;
      forecastStats=[];
      const host=$('allForecastStatsList');
      if(host)host.innerHTML='<p class="muted">Press Load Selected Forecast to read this source.</p>';
      selectedCount();
      const card=$('forecastSourceCard');
      if(card)card.hidden=true;
      say(`${selectedForecastSource==='sandbox'?'Sandbox Test':'Live Statistical'} source selected. Press Load Selected Forecast.`,'ok');
    }

    // Event delegation keeps controls alive even if part of the section is re-rendered.
    root.addEventListener('click',event=>{
      const b=event.target.closest('button'); if(!b)return;
      if(b.id==='useLiveForecastSourceBtn'){event.preventDefault();setForecastSource('live');}
      else if(b.id==='useSandboxForecastSourceBtn'){event.preventDefault();setForecastSource('sandbox');}
      else if(b.id==='showPublicForecastBtn'){event.preventDefault();setVisibility('statistical',true);}
      else if(b.id==='hidePublicForecastBtn'){event.preventDefault();setVisibility('statistical',false);}
      else if(b.id==='showInterpretationForecastBtn'){event.preventDefault();setVisibility('interpretation',true);}
      else if(b.id==='hideInterpretationForecastBtn'){event.preventDefault();setVisibility('interpretation',false);}
      else if(b.id==='loadLatestModelBtn'){event.preventDefault();loadLatest();}
      else if(b.id==='publishInterpretationBtn'){event.preventDefault();publish();}
      else if(b.id==='unpublishInterpretationBtn'){
        event.preventDefault();
        say('Unpublish button pressed…');
        requireAdminSession()
          .then(async ({client})=>{
            clearSetupWarning();
            const {error}=await client.from('nl4_model_interpretations')
              .update({is_published:false}).eq('season','2026/27').eq('is_published',true);
            if(error)throw error;
            $('modelInterpretationState').textContent='NOT PUBLISHED';
            say('Interpretation unpublished.','ok');
          })
          .catch(e=>{if(!handleWriteError(e))say(e.message||String(e),'error')});
      }
      else if(b.id==='clearInterpretationBtn'){event.preventDefault();['interpHeadline','interpStatusLabel','interpSummary','interpTakeaway','interpFactor1','interpFactor2','interpFactor3'].forEach(id=>setv(id,''));say('Interpretation cleared.','ok');}
      else if(b.id==='selectAllForecastStatsBtn'){event.preventDefault();root.querySelectorAll('.forecast-stat-check').forEach(x=>x.checked=true);selectedCount();}
      else if(b.id==='clearForecastStatsBtn'){event.preventDefault();root.querySelectorAll('.forecast-stat-check').forEach(x=>x.checked=false);selectedCount();}
      else if(b.classList.contains('interpret-style-btn')){event.preventDefault();showAuto(b.dataset.style);}
    });

    // Make sure nothing on this admin card blocks pointer input.
    root.style.pointerEvents='auto';
    root.querySelectorAll('button,input,textarea,a').forEach(el=>el.style.pointerEvents='auto');
    setForecastSource('live');
    readVisibility();

    // Keep the publisher status synchronized with the real Supabase session.
    db()?.auth?.onAuthStateChange?.((_event,session)=>{
      const state=$('publicForecastVisibilityState');
      if(!session){
        if(state)state.textContent='ADMIN SIGN-IN REQUIRED';
        say('Admin session is not active. Sign in before publishing or changing forecast visibility.','error');
      }else{
        readVisibility();
      }
    });

    db()?.auth?.getSession?.().then(({data})=>{
      if(!data?.session){
        const state=$('publicForecastVisibilityState');
        if(state)state.textContent='ADMIN SIGN-IN REQUIRED';
        say('Admin session is not active. Sign in before publishing or changing forecast visibility.','error');
      }else{
        say('Forecast Publishing Studio ready. Admin session verified.','ok');
      }
    }).catch(()=>{});


  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initForecastPublisher,{once:true});
  else initForecastPublisher();
})();