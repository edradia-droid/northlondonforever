(function(){
'use strict';

const UCL=new Set(['Napoli','Lille','Bayern München','Slavia Praha','Borussia Dortmund','Real Madrid','Real Betis','Sabah']);

function install(){
  const panel=document.getElementById('fanPredictionsPanel');
  const list=document.getElementById('fanPredictionFixtureList');
  const nav=document.querySelector('#adminView .side-nav')||document.querySelector('.side-nav');

  if(!panel||!list||!nav) return setTimeout(install,300);

  // Champions League Admin belongs with the main Admin pages, not inside Fan Predictions.
  const oldLaunch=document.getElementById('uclAdminLaunch');
  if(oldLaunch) oldLaunch.remove();

  if(!document.getElementById('uclAdminNavLink')){
    const link=document.createElement('a');
    link.id='uclAdminNavLink';
    link.className='nav-link';
    link.href='champions-league-admin.html';
    link.textContent='Champions League';

    // Keep it among the competition/admin page links. Prefer placing it after
    // the Premier League navigation entry when one is available.
    const links=[...nav.querySelectorAll('.nav-link')];
    const premierLeagueLink=links.find(a=>/premier league/i.test(a.textContent||''));
    if(premierLeagueLink) premierLeagueLink.insertAdjacentElement('afterend',link);
    else nav.appendChild(link);
  }

  function split(){
    const cards=[...list.querySelectorAll('.fan-prediction-card')];
    if(!cards.length)return;

    let pl=document.getElementById('fanPredictionsPremierLeague');
    let ucl=document.getElementById('fanPredictionsChampionsLeague');

    if(!pl){
      list.innerHTML='';

      pl=document.createElement('section');
      pl.id='fanPredictionsPremierLeague';
      pl.innerHTML='<div style="margin:4px 0 12px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.1)"><p class="eyebrow">PREMIER LEAGUE</p><h3 style="margin:4px 0">Premier League Fan Predictions</h3></div><div class="fan-prediction-fixtures" data-pl-holder></div>';

      ucl=document.createElement('section');
      ucl.id='fanPredictionsChampionsLeague';
      ucl.style.marginTop='28px';
      ucl.innerHTML='<div style="margin:4px 0 12px;padding-bottom:8px;border-bottom:1px solid rgba(127,215,255,.25)"><p class="eyebrow" style="color:#7fd7ff">CHAMPIONS LEAGUE</p><h3 style="margin:4px 0">Champions League Fan Predictions</h3></div><div class="fan-prediction-fixtures" data-ucl-holder></div>';

      list.append(pl,ucl);
    }

    const ph=pl.querySelector('[data-pl-holder]');
    const uh=ucl.querySelector('[data-ucl-holder]');
    if(!ph||!uh)return;

    cards.forEach(card=>{
      const title=card.querySelector('h3')?.textContent||'';
      const isUcl=[...UCL].some(team=>title.includes(team));
      (isUcl?uh:ph).appendChild(card);
    });

    if(!uh.children.length) uh.innerHTML='<p class="muted">No Champions League fixtures loaded yet.</p>';
  }

  let busy=false;
  new MutationObserver(()=>{
    if(busy)return;
    busy=true;
    setTimeout(()=>{
      try{split()}finally{busy=false}
    },40);
  }).observe(list,{childList:true,subtree:true});

  setTimeout(split,500);
  setTimeout(split,1500);
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install);
else install();
})();