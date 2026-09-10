(function(){
'use strict';

const UCL=new Set(['Napoli','Lille','Bayern München','Slavia Praha','Borussia Dortmund','Real Madrid','Real Betis','Sabah']);

function ensureNav(){
  const nav=document.querySelector('#adminView .side-nav')||document.querySelector('.side-nav');
  if(!nav) return setTimeout(ensureNav,250);

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

  if(!document.getElementById('nl4FanPredictionDropdownStyles')){
    const style=document.createElement('style');
    style.id='nl4FanPredictionDropdownStyles';
    style.textContent=`
      .fan-competition-section{border:1px solid rgba(255,255,255,.1);border-radius:14px;background:#0d0d0d;overflow:hidden;margin:0 0 14px}
      .fan-competition-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;background:#141414;color:#fff;border:0;cursor:pointer;text-align:left}
      .fan-competition-toggle strong{display:block;font-size:14px}
      .fan-competition-toggle small{display:block;margin-top:3px;color:#777;font-size:8px;letter-spacing:.8px;font-weight:900}
      .fan-competition-arrow{font-size:16px;transition:transform .2s ease;color:#d8ad45}
      .fan-competition-section.is-open .fan-competition-arrow{transform:rotate(180deg)}
      .fan-competition-body{display:none;padding:0 14px 14px}
      .fan-competition-section.is-open .fan-competition-body{display:block}
      #fanPredictionsChampionsLeague .fan-competition-arrow{color:#7fd7ff}
      @media(max-width:700px){.fan-competition-toggle{padding:12px}.fan-competition-body{padding:0 10px 10px}}
    `;
    document.head.appendChild(style);
  }

  function classifyCard(card){
    const competition=(card.dataset.competition||'').toLowerCase();
    if(competition.includes('champions')) return 'ucl';
    const title=card.querySelector('h3')?.textContent||'';
    return [...UCL].some(team=>title.includes(team)) ? 'ucl' : 'pl';
  }

  function makeSection(id,label,title,holderAttr,open,color){
    const section=document.createElement('section');
    section.id=id;
    section.className='fan-competition-section'+(open?' is-open':'');
    section.innerHTML=`<button class="fan-competition-toggle" type="button" aria-expanded="${open?'true':'false'}"><span><small${color?` style="color:${color}"`:''}>${label}</small><strong>${title}</strong></span><span class="fan-competition-arrow">⌄</span></button><div class="fan-competition-body"><div class="fan-prediction-fixtures" ${holderAttr}></div></div>`;
    section.querySelector('.fan-competition-toggle').addEventListener('click',()=>{
      const next=!section.classList.contains('is-open');
      section.classList.toggle('is-open',next);
      section.querySelector('.fan-competition-toggle').setAttribute('aria-expanded',String(next));
    });
    return section;
  }

  function split(){
    document.querySelectorAll('#uclAdminLaunch,[data-ucl-admin-launch]').forEach(el=>el.remove());
    document.querySelectorAll('#fanPredictionsPanel a[href="champions-league-admin.html"]').forEach(el=>el.remove());

    const rawCards=[...list.querySelectorAll('.fan-prediction-card')];
    if(!rawCards.length && !document.getElementById('fanPredictionsPremierLeague')) return;

    let pl=document.getElementById('fanPredictionsPremierLeague');
    let ucl=document.getElementById('fanPredictionsChampionsLeague');

    if(!pl||!ucl){
      const existingCards=[...rawCards];
      list.innerHTML='';
      pl=makeSection('fanPredictionsPremierLeague','PREMIER LEAGUE','Premier League Fan Predictions','data-pl-holder',false,'');
      ucl=makeSection('fanPredictionsChampionsLeague','CHAMPIONS LEAGUE','Champions League Fan Predictions','data-ucl-holder',false,'#7fd7ff');
      list.append(pl,ucl);
      rawCards.splice(0,rawCards.length,...existingCards);
    } else if(pl.nextElementSibling!==ucl){
      list.append(pl,ucl);
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