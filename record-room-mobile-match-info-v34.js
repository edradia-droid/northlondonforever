(() => {
'use strict';
if (window.__NL4_RR_MOBILE_MATCH_INFO_V34__) return;
window.__NL4_RR_MOBILE_MATCH_INFO_V34__ = true;

function loadOnce(src){
  const base=src.split('?')[0];
  const existing=[...document.scripts].find(s=>(s.getAttribute('src')||'').split('?')[0]===base);
  if(existing) return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=src;
    s.onload=resolve;
    s.onerror=()=>reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}

function waitForRecordRoom(max=40){
  return new Promise(resolve=>{
    let tries=0;
    const tick=()=>{
      if(typeof ALL_FIXTURES!=='undefined'&&typeof db!=='undefined') return resolve(true);
      if(++tries>=max) return resolve(false);
      setTimeout(tick,100);
    };
    tick();
  });
}

async function syncCompletedResults(){
  const ready=await waitForRecordRoom();
  const client=window.nl4Supabase;
  if(!ready||!client) return;
  const q=await client.from('premier_league_matches')
    .select('matchday,home_team,away_team,status,home_score,away_score,kickoff_at')
    .eq('season','2026/27')
    .eq('status','fulltime')
    .not('home_score','is',null)
    .not('away_score','is',null);
  if(q.error){console.warn('[NL4 Record Room] Shared result sync failed:',q.error);return;}
  let changed=0;
  (q.data||[]).forEach(row=>{
    const f=ALL_FIXTURES.find(x=>x.home===row.home_team&&x.away===row.away_team&&Number(x.mw)===Number(row.matchday));
    if(!f) return;
    const hs=Number(row.home_score),as=Number(row.away_score);
    if(!Number.isFinite(hs)||!Number.isFinite(as)) return;
    f.homeScore=hs;f.awayScore=as;
    [f.home,f.away].forEach(team=>{
      if(!db?.[team]) return;
      let rec=db[team].fixtureData?.[f.id];
      if(!rec&&typeof fixtureStore==='function') rec=fixtureStore(team,f.id);
      if(!rec){db[team].fixtureData=db[team].fixtureData||{};rec=db[team].fixtureData[f.id]={homeScore:null,awayScore:null};}
      if(rec.homeScore!==hs||rec.awayScore!==as) changed++;
      rec.homeScore=hs;rec.awayScore=as;
    });
  });
  const teams=typeof TEAMS!=='undefined'?TEAMS:[];
  teams.forEach(team=>{try{if(typeof recalculateClubStatsFromFixtures==='function')recalculateClubStatsFromFixtures(team);}catch(_){}});
  try{if(typeof persist==='function')persist();}catch(_){ }
  try{if(typeof render==='function')render();}catch(_){ }
  console.log(`[NL4 Record Room] Shared completed results synced: ${q.data?.length||0} matches, ${changed} fixture records updated.`);
}

function startSharedSync(){
  if(window.__NL4_RR_SHARED_SYNC_LOADING__) return;
  window.__NL4_RR_SHARED_SYNC_LOADING__=true;
  loadOnce('record-room-supabase.js?v=20260906-shared1')
    .then(()=>loadOnce('record-room-supabase-bridge.js?v=20260906-shared1'))
    .then(()=>syncCompletedResults())
    .catch(err=>{window.__NL4_RR_SHARED_SYNC_LOADING__=false;console.warn('[NL4 Record Room] Shared Supabase sync failed to load:',err);});
}

function forceVisible(){
  const box=document.getElementById('fixtureDetail');
  if(!box || !box.classList.contains('open')) return;
  try{window.NL4RecordRoomMatchInfo?.inject?.();}catch(_){ }
  try{window.NL4RecordRoomMatchInfo?.restoreSavedSelections?.();}catch(_){ }
  const panel=document.getElementById('rrMatchInfoBox');
  if(panel){
    panel.style.setProperty('display','block','important');
    panel.style.setProperty('visibility','visible','important');
    panel.style.setProperty('opacity','1','important');
    panel.style.setProperty('width','100%','important');
    panel.style.setProperty('max-width','none','important');
    panel.style.setProperty('position','relative','important');
    panel.style.setProperty('overflow','visible','important');
    panel.style.setProperty('content-visibility','visible','important');
  }
}

function schedule(){[0,40,120,260,520,900].forEach(ms=>setTimeout(forceVisible,ms));}

document.addEventListener('click',e=>{
  const btn=e.target.closest('.fixture-open');
  if(btn) schedule();
},true);

document.addEventListener('touchend',e=>{
  const btn=e.target.closest?.('.fixture-open');
  if(btn) schedule();
},true);

const start=()=>{
  startSharedSync();
  const box=document.getElementById('fixtureDetail');
  if(box){
    new MutationObserver(schedule).observe(box,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-fixture-id']});
  }
  window.addEventListener('pageshow',()=>{schedule();syncCompletedResults();});
  window.addEventListener('focus',syncCompletedResults);
  window.addEventListener('orientationchange',schedule);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){schedule();syncCompletedResults();}});
  schedule();
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
