(() => {
'use strict';
const SEASON='2026/27';
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const toks=v=>new Set(norm(v).split(' ').filter(Boolean));
const overlap=(a,b)=>{const A=toks(a),B=toks(b);let c=0;A.forEach(x=>{if(B.has(x))c++});return c};
const STAT_KEYS=['appearances','starts','minutes','goals','assists','clean_sheets','yellow_cards','red_cards','man_of_the_match','shots','shots_on_target','chances_created','tackles','interceptions','saves'];

function setTeam(k,v){document.querySelectorAll(`[data-team-stat="${k}"]`).forEach(e=>e.textContent=v)}
function setAvg(k,t,m){document.querySelectorAll(`[data-team-avg="${k}"]`).forEach(e=>e.textContent=`${m?(n(t)/m).toFixed(1):'0.0'} / match`)}
function renderTeam(r){
  if(!r)return;const m=n(r.matches);
  setTeam('matches',m);setTeam('possession',`${n(r.avg_possession).toFixed(1)}%`);setTeam('shots',n(r.total_shots));setTeam('shots_on_target',n(r.shots_on_target));setTeam('corners',n(r.corners));setTeam('corner_goals',n(r.corner_goals));setTeam('fouls',n(r.fouls));setTeam('offsides',n(r.offsides));setTeam('yellow_cards',n(r.yellow_cards));setTeam('red_cards',n(r.red_cards));
  setAvg('shots',r.total_shots,m);setAvg('shots_on_target',r.shots_on_target,m);setAvg('corners',r.corners,m);setAvg('fouls',r.fouls,m);setAvg('offsides',r.offsides,m);
  const s=document.getElementById('arsenalTeamSeasonStatsStatus');if(s)s.textContent='LIVE • SYNCHRONIZED FROM ARSENAL RECORD ROOM';
}
function findBody(){return document.getElementById('arsenalPlayerStatsBody')||document.querySelector('#arsenalPlayerStats tbody')||document.querySelector('[data-arsenal-player-stats] tbody')}

function staticSquadSnapshot(){
  const body=findBody();if(!body)return[];
  return [...body.querySelectorAll('tr')].map(tr=>({
    name:tr.dataset.player||tr.querySelector('td strong')?.textContent?.trim()||'',
    position:tr.dataset.position||tr.querySelector('td small')?.textContent?.trim()||'Midfielder',
    number:tr.querySelector('.pl-player-number')?.textContent?.trim()||'',
    row:tr
  })).filter(p=>p.name);
}
const INITIAL_SQUAD=staticSquadSnapshot();
function matchInitial(finalPlayer,available){
  const full=norm(finalPlayer.name),web=norm(finalPlayer.webName);let best=null,score=0;
  for(const p of available){
    const pn=norm(p.name);let s=0;
    if(pn===full)s=100;
    else if(web&&pn===web)s=96;
    else if(web&&pn.split(' ').includes(web))s=90;
    else {const o=overlap(finalPlayer.name,p.name);if(o>=2)s=75+o;else if(o===1&&pn.split(' ').length===1)s=55;}
    if(s>score){score=s;best=p;}
  }
  return score>=70?best:null;
}
function rowHtml(p){
  const aliases=[p.name,p.finalName,p.webName].filter(Boolean).map(norm).filter(Boolean).join('|');
  const cells=STAT_KEYS.map(k=>`<td${k==='goals'||k==='assists'?' class="pl-stat-hot"':''} data-stat="${k}">0</td>`).join('');
  return `<tr data-player="${esc(p.name)}" data-position="${esc(p.position)}" data-aliases="${esc(aliases)}"><td class="player-cell"><div class="pl-player-name"><span class="pl-player-number">${esc(p.number||'—')}</span><span><strong>${esc(p.name)}</strong><small>${esc(p.position)}</small></span></div></td>${cells}</tr>`;
}
function renderCurrentArsenalSquad(){
  const body=findBody(),feed=window.NL4_FINAL_PL_SQUADS?.Arsenal;
  if(!body||!Array.isArray(feed)||!feed.length)return false;
  const available=[...INITIAL_SQUAD];const current=[];
  feed.forEach(f=>{
    const old=matchInitial(f,available);
    if(old)available.splice(available.indexOf(old),1);
    current.push({
      name:old?.name||f.name,
      finalName:f.name,
      webName:f.webName,
      position:old?.position||f.position||'Midfielder',
      number:(old?.number&&old.number!=='—')?old.number:(f.number??'—')
    });
  });
  body.innerHTML=current.map(rowHtml).join('');
  const note=document.querySelector('#arsenalPlayerStats .pl-table-note');if(note)note.textContent='ARSENAL • CURRENT POST-WINDOW SQUAD • LIVE FROM SUPABASE';
  const toolbar=document.querySelector('#arsenalPlayerStats .pl-player-stats-toolbar p');if(toolbar)toolbar.textContent='Current registered Arsenal Premier League squad after the summer transfer window, with live season contributions.';
  document.querySelectorAll('#arsenalPlayerStats .pl-player-filter').forEach(btn=>{if(btn.classList.contains('active'))btn.click?.();});
  return true;
}
function rowForStat(body,name){
  const target=norm(name);if(!target)return null;
  const rows=[...body.querySelectorAll('tr')];
  let row=rows.find(tr=>norm(tr.dataset.player)===target);if(row)return row;
  row=rows.find(tr=>(tr.dataset.aliases||'').split('|').includes(target));if(row)return row;
  let best=null,bestScore=0;
  for(const tr of rows){
    const aliases=[tr.dataset.player,...(tr.dataset.aliases||'').split('|')].filter(Boolean);
    for(const a of aliases){const o=overlap(target,a);const s=o>=2?70+o:(norm(a).includes(target)||target.includes(norm(a))?60:0);if(s>bestScore){bestScore=s;best=tr;}}
  }
  return bestScore>=70?best:null;
}
function renderPlayers(rows){
  const body=findBody();if(!body||!rows?.length)return;
  rows.forEach(p=>{
    const tr=rowForStat(body,p.player_name);if(!tr)return;
    const vals=[p.appearances,p.starts,p.minutes,p.goals,p.assists,p.clean_sheets,p.yellow_cards,p.red_cards,p.man_of_the_match,p.shots,p.shots_on_target,p.chances_created,p.tackles,p.interceptions,p.saves];
    const cells=tr.querySelectorAll('td');vals.forEach((v,i)=>{if(cells[i+1])cells[i+1].textContent=n(v)});
  });
  const s=document.getElementById('arsenalPlayerStatsStatus');if(s)s.textContent='LIVE • CURRENT SQUAD SYNCHRONIZED FROM ARSENAL RECORD ROOM';
}
async function refresh(){
  renderCurrentArsenalSquad();
  const c=window.nl4Supabase;if(!c)return;
  const [t,p]=await Promise.all([c.from('record_room_arsenal_team_stats').select('*').eq('season',SEASON).maybeSingle(),c.from('premier_league_player_stats').select('*').eq('season',SEASON).order('player_name')]);
  if(t.error)console.error('[NL4] Record Room team read failed:',t.error);else renderTeam(t.data);
  if(p.error)console.error('[NL4] Record Room player read failed:',p.error);else renderPlayers(p.data||[]);
}
window.NL4PremierLeagueRecordRoomSync={refresh,renderCurrentArsenalSquad};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(refresh,100),{once:true});else setTimeout(refresh,100);
window.addEventListener('nl4:player-stats-synced',refresh);window.addEventListener('focus',refresh);
})();