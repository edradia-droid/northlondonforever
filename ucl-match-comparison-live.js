(function(){
'use strict';
const db=()=>window.nl4Supabase;
const p=new URLSearchParams(location.search);
let idx=Number(p.get('match'));
if(!Number.isInteger(idx)||idx<0||idx>7)idx=0;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const aliases={
  'Arsenal':'Arsenal','Arsenal FC':'Arsenal',
  'SSC Napoli':'Napoli','Napoli':'Napoli',
  'Lille OSC':'Lille','Lille':'Lille',
  'FC Bayern München':'Bayern München','Bayern München':'Bayern München','Bayern Munich':'Bayern München',
  'SK Slavia Praha':'Slavia Praha','Slavia Praha':'Slavia Praha','Slavia Prague':'Slavia Praha',
  'Real Madrid CF':'Real Madrid','Real Madrid':'Real Madrid',
  'Real Betis Balompié':'Real Betis','Real Betis':'Real Betis',
  'Sabah FK':'Sabah','Sabah':'Sabah',
  'Borussia Dortmund':'Borussia Dortmund'
};
const clean=n=>aliases[String(n||'').trim()]||String(n||'').replace(/\s+(FC|AFC)$/i,'').trim();
const key=n=>clean(n).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const colours={Arsenal:['#d8001f','#f4f4f4'],Napoli:['#1498d4','#0873ad'],Lille:['#d7193f','#102d61'],'Bayern München':['#dc052d','#f5f5f5'],'Slavia Praha':['#d71920','#f5f5f5'],'Borussia Dortmund':['#fdeb0a','#111111'],'Real Madrid':['#f5f5f5','#d9b44a'],'Real Betis':['#159447','#f5f5f5'],Sabah:['#203b89','#e01e35']};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

function findByTeam(rows,name){const k=key(name);return (rows||[]).find(r=>key(r.team_name)===k)||null;}
function mergedRow(name,standing,supp){
  return {
    team_name:clean(name),
    position:standing?.position??null,
    matches:Number(standing?.played??supp?.matches??0),
    wins:Number(standing?.wins??supp?.wins??0),
    draws:Number(standing?.draws??supp?.draws??0),
    losses:Number(standing?.losses??supp?.losses??0),
    goals_for:Number(standing?.goals_for??supp?.goals_for??0),
    goals_against:Number(standing?.goals_against??supp?.goals_against??0),
    goal_difference:Number(standing?.goal_difference??((standing?.goals_for??supp?.goals_for??0)-(standing?.goals_against??supp?.goals_against??0))),
    points:Number(standing?.points??supp?.points??0),
    possession_total:Number(supp?.possession_total??0),shots:Number(supp?.shots??0),shots_on_target:Number(supp?.shots_on_target??0),corners:Number(supp?.corners??0),corner_goals:Number(supp?.corner_goals??0),fouls:Number(supp?.fouls??0),offsides:Number(supp?.offsides??0),saves:Number(supp?.saves??0),yellow_cards:Number(supp?.yellow_cards??0),red_cards:Number(supp?.red_cards??0)
  };
}
function strength(t){
  const mp=Math.max(1,Number(t.matches)||0);
  const ppg=(Number(t.points)||0)/(mp*3);
  const wr=(Number(t.wins)||0)/mp;
  const gdpg=(Number(t.goal_difference)||0)/mp;
  const gfpg=(Number(t.goals_for)||0)/mp;
  const pos=t.position?clamp((37-Number(t.position))/36,0,1):.5;
  return .34*ppg+.20*wr+.18*(.5+.5*Math.tanh(gdpg/2))+.13*clamp(gfpg/3,0,1)+.15*pos;
}
function probability(home,away){
  const delta=strength(home)-strength(away)+.07;
  const hp=100/(1+Math.exp(-3.0*delta));
  return Math.round(clamp(hp,10,90));
}
function avg(x,k,d=1){return x.matches?(Number(x[k]||0)/Number(x.matches)).toFixed(d):'0.0';}
function html(home,away,h,a){
  const metrics=[['Table position',x=>x.position??'—'],['Matches','matches'],['Wins','wins'],['Draws','draws'],['Losses','losses'],['Goals for','goals_for'],['Goals against','goals_against'],['Goal difference',x=>(x.goal_difference>0?'+':'')+x.goal_difference],['Points','points']];
  const supplemental=[['Avg possession',x=>x.possession_total?avg(x,'possession_total')+'%':'—'],['Shots',x=>x.shots||'—'],['Shots on target',x=>x.shots_on_target||'—'],['Corners',x=>x.corners||'—'],['Fouls',x=>x.fouls||'—'],['Offsides',x=>x.offsides||'—'],['Saves',x=>x.saves||'—']];
  const get=(x,k)=>typeof k==='function'?k(x):x[k];
  const hp=probability(h,a),ap=100-hp,hc=colours[clean(home)]||['#3454a5','#16264f'],ac=colours[clean(away)]||['#b18b32','#3a2c12'];
  const extraAvailable=[h.possession_total,h.shots,h.shots_on_target,h.corners,h.fouls,h.offsides,h.saves,a.possession_total,a.shots,a.shots_on_target,a.corners,a.fouls,a.offsides,a.saves].some(Number);
  const rows=[...metrics,...(extraAvailable?supplemental:[])];
  return `<div class="ucl-comparison" data-live-ucl-comparison="1"><div class="comparison-title"><small>LIVE API-BACKED • 2026/27 CHAMPIONS LEAGUE</small><p>Table data syncs from football-data.org after each UCL update${extraAvailable?' • detailed NL4 stats supplement the table':''}.</p></div><div class="comparison-table-wrap"><table class="comparison-table"><thead><tr><th>METRIC</th><th>${esc(clean(home))}</th><th>${esc(clean(away))}</th></tr></thead><tbody>${rows.map(m=>`<tr><th>${esc(m[0])}</th><td>${esc(get(h,m[1]))}</td><td>${esc(get(a,m[1]))}</td></tr>`).join('')}</tbody></table></div><div class="probability-card" style="--home-primary:${hc[0]};--home-secondary:${hc[1]};--away-primary:${ac[0]};--away-secondary:${ac[1]}"><div class="probability-heading"><strong>Win Probability</strong><small>Calculated from live UCL position, points per game, wins, goal difference, scoring rate and home advantage.</small></div><div class="probability-names"><span>${esc(clean(home))}</span><span>${esc(clean(away))}</span></div><div class="probability-track" role="img" aria-label="${esc(clean(home))} ${hp} percent, ${esc(clean(away))} ${ap} percent"><div class="probability-side probability-home" style="width:${hp}%"><strong>${hp}%</strong></div><div class="probability-side probability-away" style="width:${ap}%"><strong>${ap}%</strong></div></div><p class="probability-note">Updates automatically from the synced Champions League table. This is an NL4 estimate, not betting advice.</p></div></div>`;
}
function keepLive(box,markup){
  let restoring=false;
  const apply=()=>{
    if(restoring)return;
    if(!box.querySelector('[data-live-ucl-comparison="1"]')){
      restoring=true;
      box.className='';
      box.innerHTML=markup;
      restoring=false;
    }
  };
  apply();
  const observer=new MutationObserver(()=>apply());
  observer.observe(box,{childList:true,subtree:true,characterData:true});
  setTimeout(apply,250);
  setTimeout(apply,750);
  setTimeout(apply,1500);
}
async function load(){
  const client=db();if(!client)return;
  const box=document.getElementById('teamTotalsBox');if(!box)return;
  const {data:f,error}=await client.from('fixtures').select('matchday,home_team,away_team,is_home,opponent').eq('season','2026/27').eq('competition','UEFA Champions League').eq('matchday',idx+1).maybeSingle();
  if(error||!f){if(error)console.warn('NL4 UCL fixture comparison:',error);return;}
  const home=f.home_team||(f.is_home?'Arsenal':f.opponent),away=f.away_team||(f.is_home?f.opponent:'Arsenal');
  const [{data:standings,error:se},{data:supp,error:ue}]=await Promise.all([
    client.from('ucl_standings').select('position,team_name,played,wins,draws,losses,goals_for,goals_against,goal_difference,points').eq('season','2026/27'),
    client.from('ucl_team_stats').select('*').eq('season','2026/27')
  ]);
  if(se){console.warn('NL4 UCL live comparison standings:',se);box.textContent='Live Champions League table could not be loaded.';return;}
  if(ue)console.warn('NL4 UCL supplemental stats:',ue);
  const hs=findByTeam(standings,home),as=findByTeam(standings,away),hu=findByTeam(supp,home),au=findByTeam(supp,away);
  if(!hs||!as){
    console.warn('NL4 UCL comparison team match missing',{home,away,homeKey:key(home),awayKey:key(away),homeFound:!!hs,awayFound:!!as});
    box.className='empty';
    box.textContent='Live Champions League comparison is waiting for both teams in the synced table.';
    return;
  }
  const h=mergedRow(home,hs,hu),a=mergedRow(away,as,au);
  keepLive(box,html(home,away,h,a));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(load,80));else setTimeout(load,80);
})();
