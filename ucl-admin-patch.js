(function(){
'use strict';

const UCL=new Set(['Napoli','Lille','Bayern München','Slavia Praha','Borussia Dortmund','Real Madrid','Real Betis','Sabah']);

function ensureNav(){
  const nav=document.querySelector('#adminView .side-nav')||document.querySelector('.side-nav');
  if(!nav) return setTimeout(ensureNav,250);

  // Remove any stale Champions League launch card/button from Fan Predictions.
  document.querySelectorAll('#uclAdminLaunch,[data-ucl-admin-launch],a[href="champions-league-admin.html"]').forEach(el=>{
    if(el.id==='uclAdminNavLink') return;
    if(el.closest('.side-nav')) return;
    const launch=el.closest('#uclAdminLaunch,[data-ucl-admin-launch]');
    (launch||el).remove();
  });

  if(!document.getElementById('uclAdminNavLink')){
    const link=document.createElement('a');
    link.id='uclAdminNavLink';
    link.className='nav-link';
    link.href='champions-league-admin.html';
    link.textContent='Champions League';

    const links=[...nav.querySelectorAll('.nav-link')];
    const premierLeagueLink=links.find(a=>/premier league/i.test(a.textContent||''));
    if(premierLeagueLink) premierLeagueLink.insertAdjacentElement('afterend',link);
    else nav.appendChild(link);
  }
}

function installPredictionSplit(){
  const list=document.getElementById('fanPredictionFixtureList');
  if(!list) return setTimeout(installPredictionSplit,250);

  function classifyCard(card){
    const competition=(card.dataset.competition||'').toLowerCase();
    if(competition.includes('champions')) return 'ucl';
    const title=card.querySelector('h3')?.textContent||'';
    return [...UCL].some(team=>title.includes(team)) ? 'ucl' : 'pl';
  }

  function split(){
    // Remove stale launch every pass in case an old cached script injected it later.
    document.querySelectorAll('#uclAdminLaunch,[data-ucl-admin-launch]').forEach(el=>el.remove());
    document.querySelectorAll('#fanPredictionsPanel a[href="champions-league-admin.html"]').forEach(el=>el.remove());

    const rawCards=[...list.querySelectorAll('.fan-prediction-card')];
    if(!rawCards.length && !document.getElementById('fanPredictionsPremierLeague')) return;

    let pl=document.getElementById('fanPredictionsPremierLeague');
    let ucl=document.getElementById('fanPredictionsChampionsLeague');

    if(!pl||!ucl){
      const existingCards=[...rawCards];
      list.innerHTML='';

      pl=document.createElement('section');
      pl.id='fanPredictionsPremierLeague';
      pl.innerHTML='<div class="fan-competition-heading" style="margin:4px 0 12px;padding:12px 0 9px;border-bottom:1px solid rgba(255,255,255,.12)"><p class="eyebrow">PREMIER LEAGUE</p><h3 style="margin:4px 0 0">Premier League Fan Predictions</h3></div><div class="fan-prediction-fixtures" data-pl-holder></div>';

      ucl=document.createElement('section');
      ucl.id='fanPredictionsChampionsLeague';
      ucl.style.marginTop='30px';
      ucl.innerHTML='<div class="fan-competition-heading" style="margin:4px 0 12px;padding:12px 0 9px;border-bottom:1px solid rgba(127,215,255,.28)"><p class="eyebrow" style="color:#7fd7ff">CHAMPIONS LEAGUE</p><h3 style="margin:4px 0 0">Champions League Fan Predictions</h3></div><div class="fan-prediction-fixtures" data-ucl-holder></div>';

      // Fixed order: Premier League first, Champions League second.
      list.append(pl,ucl);
      rawCards.splice(0,rawCards.length,...existingCards);
    } else {
      // Re-enforce the requested order even after refresh/re-render.
      if(pl.nextElementSibling!==ucl){ list.append(pl,ucl); }
    }

    const ph=pl.querySelector('[data-pl-holder]');
    const uh=ucl.querySelector('[data-ucl-holder]');
    if(!ph||!uh) return;

    rawCards.forEach(card=>{
      (classifyCard(card)==='ucl'?uh:ph).appendChild(card);
    });

    if(!ph.querySelector('.fan-prediction-card')) ph.innerHTML='<p class="muted">No Premier League fixtures loaded yet.</p>';
    if(!uh.querySelector('.fan-prediction-card')) uh.innerHTML='<p class="muted">No Champions League fixtures loaded yet.</p>';
  }

  let busy=false;
  new MutationObserver(()=>{
    if(busy)return;
    busy=true;
    setTimeout(()=>{try{split()}finally{busy=false}},60);
  }).observe(list,{childList:true,subtree:true});

  [0,300,800,1600,3000].forEach(ms=>setTimeout(split,ms));
}

function boot(){ensureNav();installPredictionSplit();}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();