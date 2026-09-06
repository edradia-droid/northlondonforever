/* NL4 Record Room • fresh-browser shared hydration trigger */
(function(){
  'use strict';
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  function hasRealLocalRecordRoomData(){
    if(typeof TEAMS==='undefined'||typeof db==='undefined') return false;
    return TEAMS.some(team=>{
      const players=db[team]?.players||[];
      if(players.some(p=>['appearances','starts','minutes','goals','assists','yellowCards','redCards','mom','shots','shotsOnTarget','chancesCreated','tackles','interceptions','saves'].some(k=>(Number(p[k])||0)>0))) return true;
      return Object.values(db[team]?.fixtureData||{}).some(s=>s&&(
        (s.homeLineup||[]).some(Boolean)||(s.awayLineup||[]).some(Boolean)||(s.homeSubs||[]).length||(s.awaySubs||[]).length||
        (s.events||[]).length||String(s.manOfTheMatch||'').trim()||
        Object.values(s.stats||{}).some(v=>v&&typeof v==='object'&&((Number(v.h)||0)!==0||(Number(v.a)||0)!==0))||
        Object.values(s.matchDetails||{}).some(v=>v!==null&&v!==undefined&&v!=='')
      ));
    });
  }
  async function run(){
    for(let i=0;i<80&&!window.NL4RecordRoomHydrate;i++) await wait(100);
    if(!window.NL4RecordRoomHydrate) return;
    if(hasRealLocalRecordRoomData()) return;
    console.log('[NL4 Record Room] Fresh browser detected; forcing shared Supabase hydration.');
    const result=await window.NL4RecordRoomHydrate();
    console.log('[NL4 Record Room] Fresh-browser hydration result:',result);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,250),{once:true});else setTimeout(run,250);
})();