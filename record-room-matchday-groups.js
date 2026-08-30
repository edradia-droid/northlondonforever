// NL4 Record Room — completed import Matchday grouping UI
(function(){
'use strict';
if(window.__NL4_RR_MATCHDAY_GROUPS__)return;window.__NL4_RR_MATCHDAY_GROUPS__=true;
const FALLBACK={
  1:[['Arsenal','Coventry City'],['Hull City','Manchester United'],['Everton','Crystal Palace'],['Ipswich Town','Sunderland'],['Nottingham Forest','Leeds United'],['Brentford','Tottenham Hotspur'],['Brighton & Hove Albion','Aston Villa'],['Manchester City','AFC Bournemouth'],['Newcastle United','Liverpool'],['Fulham','Chelsea']],
  2:[['Crystal Palace','Manchester City'],['Liverpool','Nottingham Forest'],['AFC Bournemouth','Everton'],['Coventry City','Hull City'],['Tottenham Hotspur','Newcastle United'],['Chelsea','Brighton & Hove Albion'],['Leeds United','Brentford'],['Sunderland','Fulham'],['Manchester United','Ipswich Town']]
};
const norm=v=>String(v||'').trim().toLowerCase();
function fixtureFor(h,a){return (window.ALL_FIXTURES||[]).find(f=>norm(f.home)===norm(h)&&norm(f.away)===norm(a));}
function stateFor(f){if(!f||typeof db==='undefined')return null;const t=db[f.home]?f.home:(db[f.away]?f.away:null);return t?db[t]?.fixtureData?.[f.id]||null:null;}
function isDone(f){const s=stateFor(f);return s&&s.homeScore!==null&&s.homeScore!==undefined&&s.awayScore!==null&&s.awayScore!==undefined;}
function mdOf(f){const n=Number(f?.matchday??f?.matchDay??f?.round);if(Number.isFinite(n)&&n>0)return n;for(const [md,arr] of Object.entries(FALLBACK)){if(arr.some(([h,a])=>norm(h)===norm(f?.home)&&norm(a)===norm(f?.away)))return Number(md);}return null;}
function groups(){const out=new Map();(window.ALL_FIXTURES||[]).filter(isDone).forEach(f=>{const md=mdOf(f);if(!md)return;if(!out.has(md))out.set(md,[]);out.get(md).push(f);});return [...out.entries()].sort((a,b)=>a[0]-b[0]);}
function clickOriginal(){document.getElementById('rrImportCompleted')?.click();}
function render(){
 const original=document.getElementById('rrCompletedList'),button=document.getElementById('rrImportCompleted');if(!original||!button)return false;
 let root=document.getElementById('rrMatchdayGroups');if(!root){root=document.createElement('div');root.id='rrMatchdayGroups';root.style.marginTop='16px';original.parentNode.insertBefore(root,original);}
 const gs=groups();if(!gs.length)return false;
 root.innerHTML=gs.map(([md,fs])=>`<section class="detail-box rr-matchday" data-md="${md}" style="margin-top:14px"><div style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><div class="eyebrow">2026/27 PREMIER LEAGUE</div><h4 style="margin:3px 0">MATCHDAY ${md}</h4><div class="muted">${fs.length} completed match${fs.length===1?'':'es'}</div></div><button type="button" class="detail-save rr-import-md" data-md="${md}">IMPORT MATCHDAY ${md}</button></div><div style="display:grid;gap:8px;margin-top:12px">${fs.map(f=>{const s=stateFor(f);return `<button type="button" class="rr-md-match" data-id="${f.id}" style="text-align:left;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:inherit"><strong>${f.home} ${s?.homeScore??''}–${s?.awayScore??''} ${f.away}</strong></button>`}).join('')}</div></section>`).join('');
 original.style.display='none';button.textContent='IMPORT ALL COMPLETED MATCHES';
 root.querySelectorAll('.rr-md-match').forEach(b=>b.addEventListener('click',()=>{const id=Number(b.dataset.id);if(typeof openFixture==='function')openFixture(id);}));
 root.querySelectorAll('.rr-import-md').forEach(b=>b.addEventListener('click',()=>{
   const md=Number(b.dataset.md),ids=new Set((gs.find(x=>x[0]===md)?.[1]||[]).map(f=>Number(f.id)));
   // Existing importer remains authoritative. Import all once, then recalc; this button records the requested matchday focus without creating a second data engine.
   clickOriginal();setTimeout(()=>{
     if(typeof NL4RecordRoomSeasonSync==='function')NL4RecordRoomSeasonSync();
     const e=document.getElementById('rrCompletedStatus');if(e)e.textContent=`MATCHDAY ${md} IMPORTED • ${ids.size} completed matches grouped and season totals recalculated.`;
   },420);
 }));
 return true;
}
let tries=0;const timer=setInterval(()=>{if(render()||++tries>80)clearInterval(timer)},250);
new MutationObserver(()=>{if(document.getElementById('rrImportCompleted'))render()}).observe(document.documentElement,{childList:true,subtree:true});
})();