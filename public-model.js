(function(){
'use strict';

const SEASON='2026/27';
const db=window.nl4Supabase;
if(!db||typeof db.from!=='function'){
  console.warn('NL4 Public Model: Supabase unavailable.');
  return;
}

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const set=(id,val)=>{const el=$(id);if(el)el.textContent=val??''};
const pct=v=>Number.isFinite(Number(v))?`${Number(v).toFixed(1)}%`:'—';
const num=v=>Number.isFinite(Number(v))?Number(v).toFixed(1):'—';

async function loadVisibility(){
  const root=$('nl4PublicForecastRoot');
  if(!root)return;
  let visible=true;
  try{
    const {data,error}=await db.from('nl4_public_forecast_settings')
      .select('is_visible')
      .eq('season',SEASON)
      .limit(1);
    if(!error&&data?.length)visible=data[0].is_visible!==false;
  }catch(_){}
  root.hidden=!visible;
  root.classList.toggle('nl4-public-forecast-disabled',!visible);
}

async function loadLatestSnapshot(){
  try{
    const {data,error}=await db.from('title_probability_history')
      .select('completed_matches,title_probability,top4_probability,top5_probability,expected_points,expected_position,confidence_score,created_at')
      .eq('season',SEASON)
      .order('created_at',{ascending:false})
      .order('completed_matches',{ascending:false})
      .limit(1);
    if(error)throw error;
    return data?.[0]||null;
  }catch(err){
    console.warn('NL4 Public Model latest snapshot:',err);
    return null;
  }
}

async function loadHistory(){
  try{
    const {data,error}=await db.from('title_probability_history')
      .select('completed_matches,title_probability,expected_points,expected_position,confidence_score,created_at')
      .eq('season',SEASON)
      .order('completed_matches',{ascending:true})
      .order('created_at',{ascending:true});
    if(error)throw error;

    // De-duplicate by completed match count, keeping latest row for that count.
    const byCount=new Map();
    (data||[]).forEach(x=>byCount.set(Number(x.completed_matches)||0,x));
    return [...byCount.values()].sort((a,b)=>(Number(a.completed_matches)||0)-(Number(b.completed_matches)||0));
  }catch(err){
    console.warn('NL4 Public Model history:',err);
    return [];
  }
}

async function loadPublishedInterpretation(){
  try{
    const {data,error}=await db.from('nl4_model_interpretations')
      .select('headline,status_label,summary,key_takeaway,factor_1,factor_2,factor_3,selected_stats,published_at,is_published,source_completed_matches,source_title_probability')
      .eq('season',SEASON)
      .eq('is_published',true)
      .order('published_at',{ascending:false})
      .limit(1);
    if(error)throw error;
    return data?.[0]||null;
  }catch(err){
    console.warn('NL4 published interpretation:',err);
    return null;
  }
}

function renderSnapshot(snapshot){
  if(!snapshot)return;
  set('publicArsenalTitleProbability',pct(snapshot.title_probability));
  set('publicArsenalTop4Probability',pct(snapshot.top4_probability));
  set('publicArsenalTop5Probability',pct(snapshot.top5_probability));
  set('publicArsenalExpectedPoints',num(snapshot.expected_points));
  set('publicArsenalExpectedPosition',num(snapshot.expected_position));
  set('publicModelLiveStatus',`ADMIN MODEL SYNC • ${Number(snapshot.completed_matches)||0}/380 completed matches`);
}

function liveValueForPublishedLabel(label,snapshot){
  if(!snapshot)return null;
  const key=String(label||'').toLowerCase();
  if(key.includes('title') && key.includes('prob')) return pct(snapshot.title_probability);
  if(key.includes('top 4') || key.includes('top4')) return pct(snapshot.top4_probability);
  if(key.includes('top 5') || key.includes('top5')) return pct(snapshot.top5_probability);
  if(key.includes('expected') && key.includes('point')) return `${num(snapshot.expected_points)} pts`;
  if(key.includes('expected') && (key.includes('finish')||key.includes('position'))) return num(snapshot.expected_position);
  if(key.includes('confidence')) return `${Math.round(Number(snapshot.confidence_score)||0)}/100`;
  if(key.includes('completed') && key.includes('match')) return `${Number(snapshot.completed_matches)||0}/380`;
  return null;
}

function defaultStats(snapshot){
  if(!snapshot)return [];
  return [
    {label:'Title probability',value:pct(snapshot.title_probability)},
    {label:'Top 4 probability',value:pct(snapshot.top4_probability)},
    {label:'Expected final points',value:`${num(snapshot.expected_points)} pts`},
    {label:'Expected finish',value:num(snapshot.expected_position)},
    {label:'Model confidence',value:`${Math.round(Number(snapshot.confidence_score)||0)}/100`},
    {label:'Completed league matches',value:`${Number(snapshot.completed_matches)||0}/380`}
  ];
}

function renderInterpretation(row,snapshot){
  const panel=$('nl4PublicModel');
  if(!panel)return;

  if(row){
    if(snapshot){
      const snapshotMatches=Number(snapshot.completed_matches)||0;
      const sourceMatches=Number(row.source_completed_matches);
      const snapshotTitle=Number(snapshot.title_probability);
      const sourceTitle=Number(row.source_title_probability);
      const sameSnapshot=
        Number.isFinite(sourceMatches) &&
        sourceMatches===snapshotMatches &&
        Number.isFinite(sourceTitle) &&
        Number.isFinite(snapshotTitle) &&
        Math.abs(sourceTitle-snapshotTitle)<0.15;

      if(sameSnapshot){
        // The Admin interpretation belongs to the exact current Public Model snapshot.
        // Show the Admin-authored/published interpretation exactly as saved.
        set('nl4InterpretationHeadline',row.headline||`NL4 model: Arsenal ${pct(snapshot.title_probability)} for the title`);
        set('nl4InterpretationStatus',row.status_label||'TITLE RACE UPDATE');
        set('nl4InterpretationSummary',row.summary||'');
        set('nl4InterpretationTakeaway',row.key_takeaway||'');
      }else{
        // Never attach an older interpretation to a newer model result.
        set('nl4InterpretationHeadline',`NL4 model: Arsenal ${pct(snapshot.title_probability)} for the title`);
        set('nl4InterpretationStatus','LATEST MODEL • INTERPRETATION UPDATE PENDING');
        set('nl4InterpretationSummary',
          `Arsenal's current NL4 title probability is ${pct(snapshot.title_probability)}, with ${pct(snapshot.top4_probability)} Top 4 probability, ${num(snapshot.expected_points)} expected points and an expected finish of ${num(snapshot.expected_position)}. The currently published interpretation belongs to an older model snapshot, so NL4 is not attaching it to these newer figures.`
        );
        set('nl4InterpretationTakeaway','Publish or refresh the interpretation from Admin to attach commentary to this latest model snapshot.');
      }
    }else{
      set('nl4InterpretationHeadline',row.headline||'Title Race Update');
      set('nl4InterpretationStatus',row.status_label||'NL4 MODEL');
      set('nl4InterpretationSummary',row.summary||'');
      set('nl4InterpretationTakeaway',row.key_takeaway||'');
    }

    const publishedStats=Array.isArray(row.selected_stats)&&row.selected_stats.length
      ? row.selected_stats
      : defaultStats(snapshot);

    // PUBLIC FIRST-RESPONDER RULE:
    // Any live model stat is always taken from the latest verified snapshot.
    // Published interpretation may choose which stats to show, but cannot freeze old values.
    const stats=publishedStats.map(s=>{
      const live=liveValueForPublishedLabel(s.label,snapshot);
      return live==null?s:{...s,value:live};
    });

    const statsEl=$('nl4InterpretationViewerStats');
    if(statsEl){
      statsEl.innerHTML=stats.map(s=>`<div class="viewer-stat"><span>${esc(s.label||'STAT')}</span><strong>${esc(s.value||'—')}</strong></div>`).join('');
    }

    const factors=[row.factor_1,row.factor_2,row.factor_3].filter(Boolean);
    const factorEl=$('nl4InterpretationFactors');
    if(factorEl){
      factorEl.innerHTML=factors.map(x=>`<div class="factor">${esc(x)}</div>`).join('');
      factorEl.style.display=factors.length?'grid':'none';
    }
    const d=row.published_at?new Date(row.published_at):null;
    set('nl4InterpretationPublished',d&&!Number.isNaN(d.getTime())?`Published by NL4 Admin • ${d.toLocaleString()}`:'Published by NL4 Admin');
  }else if(snapshot){
    set('nl4InterpretationHeadline',`NL4 model: Arsenal ${pct(snapshot.title_probability)} for the title`);
    set('nl4InterpretationStatus','LATEST SAVED MODEL');
    set('nl4InterpretationSummary',`The latest saved NL4 Model gives Arsenal a ${pct(snapshot.title_probability)} title probability, ${pct(snapshot.top4_probability)} Top 4 probability, ${num(snapshot.expected_points)} expected points and an expected finish of ${num(snapshot.expected_position)}.`);
    set('nl4InterpretationTakeaway','This public page reads the saved Admin Model output. It does not run the 25,000-simulation engine in the visitor’s browser.');
    const statsEl=$('nl4InterpretationViewerStats');
    if(statsEl)statsEl.innerHTML=defaultStats(snapshot).map(s=>`<div class="viewer-stat"><span>${esc(s.label)}</span><strong>${esc(s.value)}</strong></div>`).join('');
    set('nl4InterpretationPublished','Latest saved NL4 Model snapshot');
  }
  panel.hidden=false;
}

function renderHistory(history,snapshot){
  const svg=$('publicTitleHistoryChart');
  if(!svg)return;

  if(!history.length){
    svg.innerHTML='<text x="380" y="120" text-anchor="middle" class="nl4-history-axis-text">No saved public model history yet.</text>';
    set('publicTitleHistoryLatest',snapshot?`${pct(snapshot.title_probability)} AFTER ${Number(snapshot.completed_matches)||0} MATCHES`:'PRE-SEASON BASELINE');
    return;
  }

  const W=760,H=240,L=48,R=24,T=22,B=34;
  const x=n=>L+(Math.max(0,Math.min(380,n))/380)*(W-L-R);
  const y=p=>T+(1-Math.max(0,Math.min(100,p))/100)*(H-T-B);

  let grid='';
  [0,25,50,75,100].forEach(p=>{
    const yy=y(p);
    grid+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" class="nl4-history-grid"/>`;
    grid+=`<text x="${L-8}" y="${yy+3}" text-anchor="end" class="nl4-history-axis-text">${p}%</text>`;
  });
  grid+=`<text x="${L}" y="${H-9}" class="nl4-history-axis-text">0 matches</text>`;
  grid+=`<text x="${W-R}" y="${H-9}" text-anchor="end" class="nl4-history-axis-text">380 matches</text>`;

  const pts=history.map(h=>[x(Number(h.completed_matches)||0),y(Number(h.title_probability)||0)]);
  const path=pts.map((p,i)=>`${i?'L':'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area=pts.length?`${path} L ${pts.at(-1)[0].toFixed(1)} ${y(0).toFixed(1)} L ${pts[0][0].toFixed(1)} ${y(0).toFixed(1)} Z`:'';
  const dots=history.map((h,i)=>`<circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="5" class="nl4-history-dot"><title>${Number(h.completed_matches)||0} matches • ${pct(h.title_probability)}</title></circle>`).join('');

  svg.innerHTML=`${grid}<path d="${area}" class="nl4-history-area"/><path d="${path}" class="nl4-history-line"/>${dots}`;

  const first=history[0],last=history.at(-1);
  const change=Number(last.title_probability)-Number(first.title_probability);
  set('publicTitleHistoryLatest',`${pct(last.title_probability)} AFTER ${Number(last.completed_matches)||0} MATCHES`);
  set('publicTitleHistoryChange',`Season change: ${change>=0?'+':''}${change.toFixed(1)} pts`);
  set('publicTitleHistoryNote','Saved NL4 Model forecasts from Supabase show how Arsenal’s title probability changes throughout the season.');

  const graphText=$('nl4GraphInterpretationText');
  const graphChange=$('nl4GraphInterpretationChange');
  const graphLabel=$('nl4GraphInterpretationLabel');
  const graphMeta=$('nl4GraphInterpretationMeta');
  if(graphChange)graphChange.textContent=`${change>=0?'+':''}${change.toFixed(1)} pts`;
  if(graphLabel)graphLabel.textContent='AUTOMATIC GRAPH ANALYSIS';
  if(graphText){
    const trend=change>1?'rising':change<-1?'falling':'broadly stable';
    graphText.textContent=`Arsenal's saved title probability is ${pct(last.title_probability)} after ${Number(last.completed_matches)||0} completed league matches. Compared with the first saved forecast (${pct(first.title_probability)}), the season trend is ${trend}.`;
  }
  if(graphMeta)graphMeta.textContent='Generated from saved NL4 Model history only • no public-browser simulation.';
}

async function loadAll(){
  await loadVisibility();

  // Three lightweight reads in parallel. No simulation code.
  const [snapshot,history,interpretation]=await Promise.all([
    loadLatestSnapshot(),
    loadHistory(),
    loadPublishedInterpretation()
  ]);

  renderSnapshot(snapshot);
  renderInterpretation(interpretation,snapshot);
  renderHistory(history,snapshot);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',loadAll,{once:true});
}else{
  loadAll();
}
})();