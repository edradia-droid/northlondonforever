(function(){
'use strict';

// ADMIN MODEL ONLY. This script never runs on the public Premier League page.
const path=(location.pathname||'').toLowerCase();
const bodyText=(document.body?.textContent||'').toUpperCase();
if(!path.includes('admin-model') && !bodyText.includes('ADMIN MODEL')) return;

const SEASON='2026/27';
const CACHE_KEY='nl4_admin_model_top4_interpretation_'+SEASON;

function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function ordinal(n){return n===1?'1ST':n===2?'2ND':n===3?'3RD':`${n}TH`;}
function readCache(){try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'null')}catch(_){return null}}
function writeCache(x){try{localStorage.setItem(CACHE_KEY,JSON.stringify(x))}catch(_){}}

function installStyles(){
  if(document.getElementById('nl4-admin-top4-interpretation-style')) return;
  const s=document.createElement('style'); s.id='nl4-admin-top4-interpretation-style';
  s.textContent=`
  #nl4AdminTop4Interpretation{margin:16px 0;padding:15px;border:1px solid rgba(216,173,69,.24);border-radius:16px;background:linear-gradient(145deg,#111,#090909);color:#ddd}
  #nl4AdminTop4Interpretation .head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
  #nl4AdminTop4Interpretation .label{color:#d8ad45;font-size:8px;font-weight:1000;letter-spacing:.8px}
  #nl4AdminTop4Interpretation h3{margin:4px 0 0;color:#fff;font-size:17px}
  #nl4AdminTop4Interpretation .status{color:#d8ad45;font-size:8px;font-weight:1000;text-align:right}
  #nl4AdminTop4Interpretation .summary{font-size:10px;line-height:1.65;color:#bbb;margin:12px 0 0}
  #nl4AdminTop4Interpretation .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}
  #nl4AdminTop4Interpretation .card{border:1px solid rgba(255,255,255,.08);border-radius:12px;background:#101010;padding:12px}
  #nl4AdminTop4Interpretation .card.rising{border-color:rgba(111,213,142,.3)}
  #nl4AdminTop4Interpretation .card.falling{border-color:rgba(255,113,133,.3)}
  #nl4AdminTop4Interpretation .rank{color:#d8ad45;font-size:7px;font-weight:1000;letter-spacing:.7px}
  #nl4AdminTop4Interpretation .clubline{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-top:3px}
  #nl4AdminTop4Interpretation .clubline strong{color:#fff;font-size:14px}
  #nl4AdminTop4Interpretation .prob{color:#fff;font-size:16px;font-weight:1000}
  #nl4AdminTop4Interpretation .move{display:inline-block;margin-top:8px;font-size:9px;font-weight:1000;color:#d8ad45}
  #nl4AdminTop4Interpretation .rising .move{color:#6fd58e} #nl4AdminTop4Interpretation .falling .move{color:#ff7185}
  #nl4AdminTop4Interpretation .beforeafter{display:grid;grid-template-columns:1fr auto 1fr;gap:7px;align-items:center;margin-top:9px}
  #nl4AdminTop4Interpretation .box{padding:8px;border-radius:9px;background:#0b0b0b;border:1px solid rgba(255,255,255,.06)}
  #nl4AdminTop4Interpretation .box span{display:block;color:#666;font-size:6px;font-weight:1000} #nl4AdminTop4Interpretation .box b{display:block;color:#fff;font-size:14px;margin-top:2px}
  #nl4AdminTop4Interpretation .match{margin:10px 0 0;color:#ddd;font-size:9px;font-weight:850;line-height:1.45}
  #nl4AdminTop4Interpretation .analysis{margin:6px 0 0;color:#888;font-size:8px;line-height:1.6}
  #nl4AdminTop4Interpretation .note{margin:12px 0 0;padding-top:10px;border-top:1px solid rgba(255,255,255,.06);color:#666;font-size:7px;line-height:1.55}
  @media(max-width:720px){#nl4AdminTop4Interpretation .head{flex-direction:column}#nl4AdminTop4Interpretation .status{text-align:left}#nl4AdminTop4Interpretation .grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(s);
}

function ensurePanel(){
  return document.getElementById('nl4AdminTop4Interpretation');
}

function parseProbabilityRows(){
  const table=document.getElementById('titleProbabilityTable');
  if(!table) return [];
  return [...table.querySelectorAll('.nl4-title-probability-row')].map(row=>{
    const clubEl=row.querySelector('.nl4-title-team b');
    const titleEl=row.querySelector('.nl4-title-cell.title');
    const club=(clubEl?.childNodes?.[0]?.textContent||clubEl?.textContent||'').trim();
    const m=(titleEl?.textContent||'').match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
    return club&&m?{club,titleProb:Number(m[1])}:null;
  }).filter(Boolean).sort((a,b)=>b.titleProb-a.titleProb||a.club.localeCompare(b.club));
}

let cachedResults=null;
let cachedResultsAt=0;

async function loadResults(){
  if(cachedResults && (Date.now()-cachedResultsAt)<30000) return cachedResults;

  const db=window.nl4Supabase||window.supabaseClient||window.NL4_SUPABASE||window.supabaseDb||window.db;
  if(!db||typeof db.from!=='function') return [];
  try{
    const [a,b]=await Promise.all([
      db.from('fixtures').select('home_team,away_team,arsenal_score,opponent_score,status,kickoff_at,matchday,competition,season,updated_at').eq('season',SEASON).eq('competition','Premier League'),
      db.from('premier_league_matches').select('home_team,away_team,home_score,away_score,status,kickoff_at,matchday,season,updated_at').eq('season',SEASON)
    ]);
    const out=[];
    (b.data||[]).forEach(r=>{if(String(r.status||'').toLowerCase().includes('full')||String(r.status||'').toLowerCase().includes('finish'))out.push({home:r.home_team,away:r.away_team,hs:Number(r.home_score),as:Number(r.away_score),kickoff_at:r.kickoff_at,matchday:r.matchday,updated_at:r.updated_at})});
    (a.data||[]).forEach(r=>{
      const done=String(r.status||'').toLowerCase().includes('full')||String(r.status||'').toLowerCase().includes('finish'); if(!done)return;
      const home=r.home_team||'Arsenal',away=r.away_team||'';
      const hs=Number(r.arsenal_score),as=Number(r.opponent_score);
      if(Number.isFinite(hs)&&Number.isFinite(as)) out.push({home,away,hs,as,kickoff_at:r.kickoff_at,matchday:r.matchday,updated_at:r.updated_at});
    });
    const seen=new Set();
    cachedResults=out.filter(r=>{
      const k=[r.home,r.away,r.hs,r.as,r.kickoff_at||r.matchday].join('|');
      if(seen.has(k))return false;
      seen.add(k);
      return true;
    });
    cachedResultsAt=Date.now();
    return cachedResults;
  }catch(_){return cachedResults||[]}
}
function latest(club,results){return [...results].sort((x,y)=>(new Date(y.kickoff_at||y.updated_at||0)-new Date(x.kickoff_at||x.updated_at||0))||Number(y.matchday||0)-Number(x.matchday||0)).find(r=>r.home===club||r.away===club)||null}
function info(club,r){if(!r)return null;const home=r.home===club,gf=home?r.hs:r.as,ga=home?r.as:r.hs,opp=home?r.away:r.home;return {noun:gf>ga?'win':gf===ga?'draw':'defeat',text:`${club} ${gf>ga?'beat':gf===ga?'drew with':'lost to'} ${opp} ${gf}–${ga}.`}}

async function render(){
  installStyles(); const panel=ensurePanel(); if(!panel)return;
  const rows=parseProbabilityRows();
  if(rows.length<4){
    const status=document.getElementById('nl4AdminTop4Status');
    const summary=document.getElementById('nl4AdminTop4Summary');
    if(status)status.textContent=`WAITING FOR ADMIN MODEL • ${rows.length}/4 TEAMS READ`;
    if(summary)summary.textContent='The Top 4 panel is connected. Waiting for at least four title-probability rows from the Admin Model.';
    return;
  }
  const top4=rows.slice(0,4), results=await loadResults();
  const completedCount=results.length; const prev=readCache();
  const comparable=prev&&Number(prev.completedCount)<completedCount;
  const pm=new Map((prev?.rows||[]).map(x=>[x.club,x]));
  const grid=document.getElementById('nl4AdminTop4Grid'), status=document.getElementById('nl4AdminTop4Status'), summary=document.getElementById('nl4AdminTop4Summary');
  const movements=[];
  grid.innerHTML=top4.map((t,i)=>{const old=comparable?pm.get(t.club):null,before=old?Number(old.titleProb):null,delta=before==null?null:t.titleProb-before,r=latest(t.club,results),ri=info(t.club,r);if(delta!=null)movements.push({club:t.club,delta});const cls=delta==null||Math.abs(delta)<.05?'steady':delta>0?'rising':'falling';const badge=delta==null?'BASELINE':Math.abs(delta)<.05?'→ 0.0 pts':delta>0?`↑ +${delta.toFixed(1)} pts`:`↓ ${delta.toFixed(1)} pts`;let analysis;if(delta==null)analysis=`${ri?`The latest ${ri.noun} is the newest match signal for ${t.club}. `:''}This is the first comparable Admin Model state stored for this contender, so no previous probability is invented.`;else if(Math.abs(delta)<.05)analysis=`After ${ri?`the latest ${ri.noun} and `:''}the full league state was re-simulated, ${t.club}'s title probability stayed effectively flat.`;else analysis=`${ri?`The latest ${ri.noun} affected ${t.club}'s own points and strength path. `:''}After every league result and remaining fixture was re-simulated, their title probability ${delta>0?'increased':'decreased'} by ${Math.abs(delta).toFixed(1)} percentage points.`;return `<article class="card ${cls}"><span class="rank">${ordinal(i+1)} • TITLE PROBABILITY</span><div class="clubline"><strong>${esc(t.club)}</strong><b class="prob">${t.titleProb.toFixed(1)}%</b></div><span class="move">${badge}</span>${before!=null?`<div class="beforeafter"><div class="box"><span>PREVIOUS ADMIN MODEL</span><b>${before.toFixed(1)}%</b></div><div>→</div><div class="box"><span>CURRENT ADMIN MODEL</span><b>${t.titleProb.toFixed(1)}%</b></div></div>`:''}<p class="match">${ri?esc(ri.text):'No completed league result found for this club.'}</p><p class="analysis">${esc(analysis)}</p></article>`}).join('');
  if(comparable){const up=movements.filter(x=>x.delta>.05),down=movements.filter(x=>x.delta<-.05),flat=movements.filter(x=>Math.abs(x.delta)<=.05);const parts=[];if(up.length)parts.push(up.map(x=>`${x.club} gained ${x.delta.toFixed(1)} pts`).join(', '));if(down.length)parts.push(down.map(x=>`${x.club} lost ${Math.abs(x.delta).toFixed(1)} pts`).join(', '));if(flat.length)parts.push(`${flat.map(x=>x.club).join(', ')} stayed flat`);summary.textContent=`Admin Model top four: ${top4.map((t,i)=>`${i+1}. ${t.club} ${t.titleProb.toFixed(1)}%`).join(' • ')}. Since the previous Admin Model state, ${parts.join('; ')||'the race was broadly stable'}. The match notes show each contender's latest direct result signal; the probability change is the combined model effect of the full league state.`;status.textContent=`${completedCount-Number(prev.completedCount)} NEW RESULT${completedCount-Number(prev.completedCount)===1?'':'S'} • COMPARED`;}
  else{summary.textContent=`Admin Model top four: ${top4.map((t,i)=>`${i+1}. ${t.club} ${t.titleProb.toFixed(1)}%`).join(' • ')}. This state has been saved as the Admin Model comparison baseline. Exact increase/decrease will appear after the next result-state change.`;status.textContent='TOP FOUR IDENTIFIED • ADMIN BASELINE SAVED';}
  writeCache({completedCount,rows:rows.map(x=>({club:x.club,titleProb:x.titleProb})),savedAt:new Date().toISOString()});
}

let renderTimer=null;
let lastRenderedTableHTML='';

function scheduleRender(delay=120){
  clearTimeout(renderTimer);
  renderTimer=setTimeout(()=>{
    const table=document.getElementById('titleProbabilityTable');
    const signature=table?.innerHTML||'';
    if(!signature || signature===lastRenderedTableHTML) return;
    lastRenderedTableHTML=signature;
    render();
  },delay);
}

document.addEventListener('DOMContentLoaded',()=>{
  const table=document.getElementById('titleProbabilityTable');
  if(!table) return;

  const observer=new MutationObserver((mutations)=>{
    if(!mutations.some(m=>m.type==='childList')) return;
    scheduleRender(180);
  });
  observer.observe(table,{childList:true,subtree:false});

  // One initial read after the core model has had time to render.
  scheduleRender(900);
});

window.addEventListener('load',()=>scheduleRender(300));
})();
