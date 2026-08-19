(function(){
'use strict';

const SEASON='2026/27';
const CACHE_KEY='nl4_public_model_full_state_'+SEASON;
let lastRenderedSignature='';

function esc(s){
  return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function ordinal(n){return n===1?'1ST':n===2?'2ND':n===3?'3RD':`${n}TH`;}
function readCache(){
  try{
    const x=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
    return x&&Array.isArray(x.rows)?x:null;
  }catch(_){return null;}
}
function writeCache(state){
  try{
    localStorage.setItem(CACHE_KEY,JSON.stringify({
      season:state.season,
      completedCount:Number(state.completedCount)||0,
      generatedAt:state.generatedAt||new Date().toISOString(),
      rows:(state.rows||[]).map(x=>({
        club:x.club,
        titleProb:Number(x.titleProb||0),
        expectedPoints:Number(x.expectedPoints||0),
        expectedPosition:Number(x.expectedPosition||0)
      }))
    }));
  }catch(_){}
}
function latestResultFor(club,results){
  const ordered=(results||[]).slice().sort((a,b)=>{
    const ta=new Date(a.kickoff_at||a.updated_at||0).getTime()||0;
    const tb=new Date(b.kickoff_at||b.updated_at||0).getTime()||0;
    if(ta!==tb)return ta-tb;
    return Number(a.matchday||0)-Number(b.matchday||0);
  });
  return [...ordered].reverse().find(r=>r.home===club||r.away===club)||null;
}
function resultInfo(club,r){
  if(!r)return null;
  const home=r.home===club;
  const gf=home?Number(r.home_score):Number(r.away_score);
  const ga=home?Number(r.away_score):Number(r.home_score);
  const opp=home?r.away:r.home;
  const outcome=gf>ga?'beat':gf===ga?'drew with':'lost to';
  const noun=gf>ga?'win':gf===ga?'draw':'defeat';
  const signal=gf>ga?'positive':gf===ga?'neutral':'negative';
  return {gf,ga,opp,outcome,noun,signal,text:`${club} ${outcome} ${opp} ${gf}–${ga}.`};
}
function movementClass(delta){
  if(delta==null||Math.abs(delta)<0.05)return 'steady';
  return delta>0?'rising':'falling';
}
function movementBadge(delta){
  if(delta==null)return 'BASELINE';
  if(Math.abs(delta)<0.05)return '→ 0.0 pts';
  return delta>0?`↑ +${delta.toFixed(1)} pts`:`↓ ${delta.toFixed(1)} pts`;
}
function analysisText(team,delta,info){
  if(delta==null){
    if(info){
      const direction=info.signal==='positive'?'positive':info.signal==='negative'?'negative':'mixed';
      return `The latest ${info.noun} is the newest club-specific ${direction} match signal in the Public Model. This browser has no earlier full 20-team probability state for ${team.club}, so NL4 does not invent a previous percentage.`;
    }
    return `NL4 has no earlier full 20-team probability state for ${team.club} in this browser, so no historical movement is invented.`;
  }

  const abs=Math.abs(delta);
  if(Math.abs(delta)<0.05){
    if(info){
      return `The ${info.noun} entered the model as ${info.signal==='positive'?'positive':info.signal==='negative'?'negative':'neutral'} club evidence, but after all Premier League results and remaining fixtures were re-simulated, ${team.club}'s title probability stayed effectively unchanged.`;
    }
    return `${team.club}'s title probability stayed effectively unchanged after the latest full-league re-simulation.`;
  }

  const verb=delta>0?'increased':'decreased';
  const titlePath=delta>0?'strengthened':'weakened';
  if(info){
    return `The ${info.noun} ${titlePath} ${team.club}'s own points/form path. After the model also accounted for every other league result and the remaining fixtures, their title probability ${verb} by ${abs.toFixed(1)} percentage points.`;
  }
  return `After the complete league state and remaining fixture path were re-simulated, ${team.club}'s title probability ${verb} by ${abs.toFixed(1)} percentage points.`;
}

function render(state){
  if(!state||!Array.isArray(state.rows)||!state.rows.length)return;
  const host=document.getElementById('nl4PublicTop4List');
  const summary=document.getElementById('nl4PublicTop4Summary');
  const status=document.getElementById('nl4PublicTop4Status');
  if(!host)return;

  const signature=`${state.completedCount}|`+state.rows
    .slice().sort((a,b)=>String(a.club).localeCompare(String(b.club)))
    .map(x=>`${x.club}:${Number(x.titleProb||0).toFixed(3)}`).join('|');
  if(signature===lastRenderedSignature)return;
  lastRenderedSignature=signature;

  const ranked=state.rows.slice().sort((a,b)=>{
    const d=Number(b.titleProb||0)-Number(a.titleProb||0);
    return Math.abs(d)>1e-12?d:String(a.club).localeCompare(String(b.club));
  });
  const top4=ranked.slice(0,4);

  const previous=readCache();
  const previousRows=new Map((previous?.rows||[]).map(x=>[x.club,x]));
  const hasComparable=previous &&
    Number(previous.completedCount)!==Number(state.completedCount) &&
    Number(previous.completedCount)<Number(state.completedCount);

  const movements=[];
  host.innerHTML=top4.map((team,index)=>{
    const prev=hasComparable?previousRows.get(team.club):null;
    const before=prev?Number(prev.titleProb):null;
    const current=Number(team.titleProb||0);
    const delta=before==null?null:current-before;
    const info=resultInfo(team.club,latestResultFor(team.club,state.results));
    if(delta!=null)movements.push({club:team.club,delta});

    return `<article class="nl4-public-top4-card ${movementClass(delta)}">
      <div class="nl4-public-top4-card-head">
        <div>
          <span class="nl4-public-top4-rank">${ordinal(index+1)} • TITLE PROBABILITY</span>
          <strong>${esc(team.club)}</strong>
        </div>
        <div class="nl4-public-top4-current">${current.toFixed(1)}%</div>
      </div>
      <span class="nl4-public-top4-move">${movementBadge(delta)}</span>
      ${before!=null?`<div class="nl4-public-top4-prob-grid">
        <div class="nl4-public-top4-prob"><span>PREVIOUS PUBLIC MODEL</span><strong>${before.toFixed(1)}%</strong></div>
        <div class="nl4-public-top4-arrow">→</div>
        <div class="nl4-public-top4-prob"><span>CURRENT PUBLIC MODEL</span><strong>${current.toFixed(1)}%</strong></div>
      </div>`:''}
      <p class="nl4-public-top4-match">${info?esc(info.text):'No completed league result for this club was found.'}</p>
      <p class="nl4-public-top4-analysis">${esc(analysisText(team,delta,info))}</p>
    </article>`;
  }).join('');

  if(hasComparable){
    const rises=movements.filter(x=>x.delta>.05).sort((a,b)=>b.delta-a.delta);
    const falls=movements.filter(x=>x.delta<-.05).sort((a,b)=>a.delta-b.delta);
    const flat=movements.filter(x=>Math.abs(x.delta)<=.05);
    const parts=[];
    if(rises.length)parts.push(rises.map(x=>`${x.club} gained ${x.delta.toFixed(1)} pts`).join(', '));
    if(falls.length)parts.push(falls.map(x=>`${x.club} lost ${Math.abs(x.delta).toFixed(1)} pts`).join(', '));
    if(flat.length)parts.push(`${flat.map(x=>x.club).join(', ')} stayed effectively flat`);
    if(summary){
      summary.textContent=`The current Public Model ranks ${top4.map((t,i)=>`${i+1}. ${t.club} ${Number(t.titleProb||0).toFixed(1)}%`).join(' • ')}. Since the previous full model state, ${parts.join('; ') || 'the top four were broadly stable'}. Each club's latest match is shown below; the probability movement is the net result after all league matches and the remaining fixture path were re-simulated.`;
    }
    if(status)status.textContent=`${Math.max(0,Number(state.completedCount)-Number(previous.completedCount))} NEW LEAGUE RESULT${Math.max(0,Number(state.completedCount)-Number(previous.completedCount))===1?'':'S'} • MOVEMENT COMPARED`;
  }else{
    if(summary){
      summary.textContent=`The current Public Model ranks ${top4.map((t,i)=>`${i+1}. ${t.club} ${Number(t.titleProb||0).toFixed(1)}%`).join(' • ')}. NL4 has saved this full 20-team probability state as the comparison baseline. Exact increase/decrease for all four will appear after the next result-state change.`;
    }
    if(status)status.textContent='TOP FOUR IDENTIFIED • BASELINE SAVED';
  }

  // Update the main interpretation summary only if it still contains the old
  // "unsupported rival probabilities" disclaimer. We do not overwrite Admin custom text.
  const mainSummary=document.getElementById('nl4InterpretationSummary');
  if(mainSummary && /does not infer unsupported rival probabilities/i.test(mainSummary.textContent||'')){
    const arsenal=ranked.find(x=>x.club==='Arsenal');
    const lead=top4[0];
    const top4Sentence=top4.map((t,i)=>`${i+1}. ${t.club} ${Number(t.titleProb||0).toFixed(1)}%`).join(' • ');
    const original=(mainSummary.textContent||'').replace(/\s*This interpretation describes[\s\S]*?unsupported rival probabilities\.\s*/i,' ').trim();
    mainSummary.textContent=`${original} The live Public Model title-race ranking is ${top4Sentence}. ${lead.club} currently holds the highest simulated title probability${arsenal?`; Arsenal are ${Number(arsenal.titleProb||0).toFixed(1)}%`:''}. The top-four interpretation below analyzes each contender's latest match signal and measured probability movement when a comparable prior full-model state exists.`;
  }

  writeCache(state);
}

document.addEventListener('nl4:public-model-state',e=>render(e.detail));
if(window.NL4_PUBLIC_MODEL_STATE)render(window.NL4_PUBLIC_MODEL_STATE);

// public-model.js may finish after title-probability.js. Retry from the read-only global
// without touching the model calculations.
let tries=0;
const timer=setInterval(()=>{
  tries++;
  if(window.NL4_PUBLIC_MODEL_STATE)render(window.NL4_PUBLIC_MODEL_STATE);
  if(tries>60)clearInterval(timer);
},500);

})();
