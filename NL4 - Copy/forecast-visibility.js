(() => {
  'use strict';
  const SEASON='2026/27';
  const FORECAST_MARKERS=[
    'STATISTICAL TITLE FORECAST','MATCHDAY PROBABILITY TIMELINE','LIVE MATCHDAY TRACKER',
    'TRUE RESULT IMPACT','TITLE-WINNING POINTS','TITLE RACE MOMENTUM',
    'LIVE SEASON TRANSITION ENGINE','SANDBOX SNAPSHOT ENGINE','TITLE PROBABILITY HISTORY',
    'Monte Carlo Validation Dashboard','Simulation Reliability & Tail Diagnostics',
    'EARLY-SEASON INFLUENCE AUDIT','SIMULATION ENVIRONMENT REGRESSION AUDIT',
    'GOAL ENVIRONMENT TRACE','SCORING BASELINE STABILIZATION','TITLE PROBABILITY SENSITIVITY AUDIT',
    'BANKED POINTS VS EVIDENCE DECOMPOSITION','FIXTURE EXPECTATION / SURPRISE AUDIT',
    'EXPECTED RESULT VS ACTUAL RESULT AUDIT','TITLE BOUNDARY / RANK SENSITIVITY AUDIT',
    'CONTENDER DISTRIBUTION COMPRESSION AUDIT','TRANSITION SCHEDULE CONSISTENCY AUDIT',
    'MD5 TITLE SURGE DECOMPOSITION','RIVAL SHOCK SENSITIVITY AUDIT',
    'OPPONENT-NEUTRAL RIVAL SHOCK AUDIT','RIVAL SHOCK MONTE CARLO STABILITY AUDIT',
    'EXACT-PAIRING HOTFIX','FINAL SEASON CONVERGENCE'
  ];

  function db(){
    return window.nl4Supabase||window.supabaseClient||window.NL4_SUPABASE||window.supabaseDb||window.db;
  }

  function mark(){
    document.querySelectorAll('section').forEach(section=>{
      if(section.id==='nl4AdminInterpretation'){
        section.classList.add('nl4-public-interpretation-section');
        section.classList.remove('nl4-public-forecast-section');
        return;
      }
      const text=section.textContent||'';
      if(FORECAST_MARKERS.some(marker=>text.includes(marker))){
        section.classList.add('nl4-public-forecast-section');
      }
    });

    // Main generated forecast table/timeline wrappers are not all <section>.
    const table=document.getElementById('titleProbabilityTable');
    if(table){
      let node=table.parentElement;
      // Prefer the nearest large forecast card/container.
      for(let i=0;i<3 && node;i++,node=node.parentElement){
        if(node.classList && !node.classList.contains('app-shell') && node.tagName!=='MAIN'){
          node.classList.add('nl4-public-forecast-section');
        }
      }
    }
  }

  async function apply(){
    mark();
    let statisticalVisible=true,interpretationVisible=true;
    const client=db();
    if(client?.from){
      try{
        const {data,error}=await client.from('nl4_public_forecast_settings')
          .select('is_visible,interpretation_visible')
          .eq('season',SEASON).limit(1);
        if(!error && data?.length){
          statisticalVisible=data[0].is_visible!==false;
          interpretationVisible=data[0].interpretation_visible!==false;
        }else if(error){
          console.warn('NL4 forecast visibility read failed; defaulting visible.',error);
        }
      }catch(err){
        console.warn('NL4 forecast visibility read failed; defaulting visible.',err);
      }
    }
    document.body.classList.toggle('nl4-statistical-forecast-hidden',!statisticalVisible);
    document.body.classList.toggle('nl4-interpretation-forecast-hidden',!interpretationVisible);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',apply,{once:true});
  }else{
    apply();
  }
  document.addEventListener('nl4:forecast-rendered',apply);
})();