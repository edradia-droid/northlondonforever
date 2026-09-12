(function(){
  'use strict';
  const API='https://vrjxejuyiynllygiozhs.supabase.co/rest/v1/fixtures?select=matchday,home_team,away_team,home_crest_url,away_crest_url&season=eq.2026%2F27&competition=eq.UEFA%20Champions%20League&order=matchday.asc';
  const KEY='sb_publishable__esNlSYCC7dc4Cbn1yFZ4w_ttag7wqw';
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+(fc|afc)$/,'').replace(/[^a-z0-9]+/g,' ').trim();
  let rows=[];

  function replaceTeam(teamEl, teamName, crest){
    if(!teamEl||!crest)return;
    const label=teamEl.querySelector('b');
    if(!label||norm(label.textContent)!==norm(teamName))return;
    let img=teamEl.querySelector('img.team-logo');
    const fallback=teamEl.querySelector('.club-dot');
    if(!img){
      img=document.createElement('img');
      img.className='team-logo';
      img.loading='lazy';
      img.alt=`${teamName} crest`;
      if(fallback) fallback.replaceWith(img); else teamEl.insertBefore(img,label);
    }
    img.style.display='';
    img.onerror=function(){ this.style.display='none'; };
    if(img.src!==crest) img.src=crest;
  }

  function apply(){
    const cards=[...document.querySelectorAll('#arsenalUclFixtures .ucl-fixture')];
    if(!cards.length||!rows.length)return;
    cards.forEach((card,index)=>{
      const mdText=card.querySelector('.fixture-top span')?.textContent||'';
      const md=Number((mdText.match(/MD\s*(\d+)/i)||[])[1])||index+1;
      const row=rows.find(r=>Number(r.matchday)===md);
      if(!row)return;
      const teams=card.querySelectorAll('.fixture-team');
      replaceTeam(teams[0],row.home_team,row.home_crest_url);
      replaceTeam(teams[1],row.away_team,row.away_crest_url);
    });
  }

  async function load(){
    try{
      const res=await fetch(API,{headers:{apikey:KEY}});
      if(!res.ok)throw new Error(`crest query ${res.status}`);
      rows=await res.json();
      apply();
      const root=document.getElementById('arsenalUclFixtures');
      if(root){
        const observer=new MutationObserver(()=>apply());
        observer.observe(root,{childList:true,subtree:true});
        setTimeout(()=>observer.disconnect(),8000);
      }
      [250,700,1500,3000].forEach(ms=>setTimeout(apply,ms));
    }catch(e){ console.warn('NL4 UCL crest sync:',e); }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
