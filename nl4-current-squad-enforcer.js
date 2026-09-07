(() => {
'use strict';
const FINAL=window.NL4_FINAL_PL_SQUADS||{};
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const zeros=(name,position='Midfielder',number=null)=>({name,position,number,appearances:0,starts:0,minutes:0,goals:0,assists:0,cleanSheets:0,yellowCards:0,redCards:0,mom:0,shots:0,shotsOnTarget:0,chancesCreated:0,tackles:0,interceptions:0,saves:0});
const tokens=v=>new Set(norm(v).split(' ').filter(Boolean));
function score(a,b){
  const A=norm(a),B=norm(b);if(!A||!B)return 0;if(A===B)return 100;
  const at=tokens(a),bt=tokens(b);let overlap=0;at.forEach(t=>{if(bt.has(t))overlap++});
  if(overlap>=2)return 80+overlap;
  if((A.includes(B)||B.includes(A))&&Math.min(A.length,B.length)>=5)return 70;
  return 0;
}
function matchCurrent(feedPlayer,existing,used){
  let best=null,bestScore=0;
  for(const p of existing||[]){
    if(used?.has(p))continue;
    const s=Math.max(score(feedPlayer.name,p.name),score(feedPlayer.webName,p.name));
    if(s>bestScore){bestScore=s;best=p;}
  }
  return bestScore>=70?best:null;
}
function displayName(feedPlayer,old){
  if(old?.name)return old.name;
  const w=String(feedPlayer.webName||'').trim();
  if(w && w.length>2 && !/^[A-Z]\./.test(w))return w;
  return feedPlayer.name;
}
function fixtureHistoricalNames(team){
  const out=new Set();
  const rrDb=(typeof db!=='undefined'&&db)||window.db;
  const fd=rrDb?.[team]?.fixtureData||{};
  const evPerson=v=>{const parts=String(v||'').split('|||');return {team:parts.shift()||'',name:parts.join('|||')}};
  Object.values(fd).forEach(s=>{
    ['homeLineup','awayLineup'].forEach(k=>(Array.isArray(s?.[k])?s[k]:[]).forEach(n=>n&&out.add(n)));
    ['homeSubs','awaySubs'].forEach(k=>(Array.isArray(s?.[k])?s[k]:[]).forEach(r=>{if(r?.out)out.add(r.out);if(r?.in)out.add(r.in)}));
    (Array.isArray(s?.events)?s.events:[]).forEach(ev=>{const p=evPerson(ev?.player),a=evPerson(ev?.assist);if(p.team===team&&p.name)out.add(p.name);if(a.team===team&&a.name)out.add(a.name)});
    const m=evPerson(s?.manOfTheMatch);if(m.team===team&&m.name)out.add(m.name);
  });
  return out;
}
function enforceRecordRoom(){
  const rrDb=(typeof db!=='undefined'&&db)||window.db;
  const rrTeams=(typeof TEAMS!=='undefined'&&TEAMS)||window.TEAMS;
  const rrRosters=(typeof TEAM_ROSTERS!=='undefined'&&TEAM_ROSTERS)||window.TEAM_ROSTERS;
  const rrDirectory=(typeof PLAYER_DIRECTORY!=='undefined'&&PLAYER_DIRECTORY)||window.PLAYER_DIRECTORY;
  if(!rrDb||!Array.isArray(rrTeams))return false;
  for(const team of rrTeams){
    const feed=FINAL[team];if(!Array.isArray(feed)||!feed.length||!rrDb[team])continue;
    const existing=Array.isArray(rrDb[team].players)?rrDb[team].players:[];
    const used=new Set();const current=[];
    for(const f of feed){
      const old=matchCurrent(f,existing,used);if(old)used.add(old);
      const name=displayName(f,old);
      current.push({...zeros(name,f.position||'Midfielder',f.number??null),...(old||{}),name,position:f.position||old?.position||'Midfielder',number:old?.number??f.number??null,current:true,historical:false,finalName:f.name,webName:f.webName,fplId:f.fplId});
    }
    const currentNorm=new Set(current.map(p=>norm(p.name)));
    const archive=[...(Array.isArray(rrDb[team].historicalPlayers)?rrDb[team].historicalPlayers:[])];
    existing.forEach(p=>{if(p?.name&&!used.has(p)&&!currentNorm.has(norm(p.name))&&!archive.some(h=>norm(h.name)===norm(p.name)))archive.push({...p,current:false,historical:true})});
    fixtureHistoricalNames(team).forEach(name=>{if(!currentNorm.has(norm(name))&&!archive.some(h=>norm(h.name)===norm(name)))archive.push({...zeros(name),current:false,historical:true})});
    rrDb[team].historicalPlayers=archive;
    rrDb[team].players=current;
    if(rrRosters)rrRosters[team]=current.map(p=>({name:p.name,position:p.position,number:p.number}));
    if(rrDirectory)rrDirectory[norm(team)]=current.map(p=>({name:p.name,position:p.position,number:p.number}));
  }
  try{
    window.teamPlayers=team=>(rrDb?.[team]?.players||[]);
    window.rosterForTeam=team=>(rrDb?.[team]?.players||[]).map(p=>({...p}));
    teamPlayers=window.teamPlayers;rosterForTeam=window.rosterForTeam;
  }catch(_){ }
  const selectedOption=(team,selected='')=>{
    const players=rrDb?.[team]?.players||[];let found=false;
    let html='<option value="">Select player…</option>'+players.map(p=>{const hit=p.name===selected;found=found||hit;return `<option value="${esc(p.name)}" ${hit?'selected':''}>${p.number?`#${p.number} • `:''}${esc(p.name)}</option>`}).join('');
    if(selected&&!found)html+=`<option value="${esc(selected)}" selected>Saved • ${esc(selected)}</option>`;
    return html;
  };
  try{window.playerOptions=(team,selected='')=>selectedOption(team,selected);playerOptions=window.playerOptions;}catch(_){ }
  try{if(typeof window.persist==='function')window.persist();else if(typeof persist==='function')persist();}catch(_){ }
  const marker=document.getElementById('buildMarker');if(marker)marker.textContent='BUILD V34 • STABLE AUTHORITY • MOBILE + PC • MATCH METADATA RESTORED • HISTORY PRESERVED';
  return true;
}

function toLocalDateTimeValue(value){
  if(!value)return '';
  const d=new Date(value);if(Number.isNaN(d.getTime()))return '';
  const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,16);
}
function installRecordRoomMatchMeta(){
  if(!document.getElementById('recordRoomPage')||window.__nl4RecordRoomMetaInstalled)return false;
  const originalOpen=window.openFixture;
  const originalSave=window.saveFixtureDetails;
  if(typeof originalOpen!=='function'||typeof originalSave!=='function')return false;
  window.__nl4RecordRoomMetaInstalled=true;

  if(!document.getElementById('nl4-record-room-meta-style')){
    const style=document.createElement('style');style.id='nl4-record-room-meta-style';style.textContent=`
      .rr-match-meta{margin-top:15px;border:1px solid rgba(216,173,69,.20);border-radius:16px;background:#10100d;padding:14px}
      .rr-match-meta h4{margin:0 0 10px;font-size:13px}.rr-match-meta-grid{display:grid;grid-template-columns:repeat(5,minmax(130px,1fr));gap:9px}
      .rr-match-meta .field{min-width:0}.rr-match-meta input,.rr-match-meta select{width:100%;min-width:0}
      @media(max-width:1000px){.rr-match-meta-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:620px){.rr-match-meta{padding:12px}.rr-match-meta-grid{grid-template-columns:1fr}.rr-match-meta input,.rr-match-meta select{font-size:16px}}
    `;document.head.appendChild(style);
  }

  window.openFixture=function(id){
    originalOpen.call(this,id);
    try{
      const team=(window.teamSelect||document.getElementById('teamSelect'))?.value;
      const fixtures=(typeof ALL_FIXTURES!=='undefined'&&ALL_FIXTURES)||window.ALL_FIXTURES||[];
      const f=fixtures.find(x=>Number(x.id)===Number(id));
      const store=(typeof fixtureStore==='function'?fixtureStore:window.fixtureStore);
      if(!team||!f||typeof store!=='function')return;
      const s=store(team,id);s.matchMeta=s.matchMeta||{};
      const box=document.getElementById('fixtureDetail');
      const scoreBox=box?.querySelector('.detail-box');if(!box||!scoreBox)return;
      const kickoff=s.matchMeta.kickoff||f.kickoff||'';
      const html=`<div class="rr-match-meta" id="rrMatchMeta"><h4>Match information</h4><div class="rr-match-meta-grid">
        <div class="field"><label>KICKOFF</label><input id="detailKickoff" type="datetime-local" value="${esc(toLocalDateTimeValue(kickoff))}"></div>
        <div class="field"><label>VENUE / STADIUM</label><input id="detailVenue" type="text" placeholder="Stadium" value="${esc(s.matchMeta.venue||'')}"></div>
        <div class="field"><label>REFEREE</label><input id="detailReferee" type="text" placeholder="Referee" value="${esc(s.matchMeta.referee||'')}"></div>
        <div class="field"><label>ATTENDANCE</label><input id="detailAttendance" type="number" min="0" placeholder="Attendance" value="${s.matchMeta.attendance??''}"></div>
        <div class="field"><label>MATCH STATUS</label><select id="detailMatchStatus"><option value="scheduled" ${s.matchMeta.status==='scheduled'?'selected':''}>Scheduled</option><option value="live" ${s.matchMeta.status==='live'?'selected':''}>Live</option><option value="full-time" ${s.matchMeta.status==='full-time'?'selected':''}>Full time</option><option value="postponed" ${s.matchMeta.status==='postponed'?'selected':''}>Postponed</option></select></div>
      </div></div>`;
      scoreBox.insertAdjacentHTML('beforebegin',html);
    }catch(err){console.error('[NL4 Record Room] Match metadata render failed:',err);}
  };

  window.saveFixtureDetails=function(){
    try{
      const team=document.getElementById('teamSelect')?.value;
      const id=Number(document.getElementById('fixtureDetail')?.dataset.fixtureId);
      const store=(typeof fixtureStore==='function'?fixtureStore:window.fixtureStore);
      if(team&&Number.isFinite(id)&&typeof store==='function'){
        const s=store(team,id);s.matchMeta=s.matchMeta||{};
        const kickoff=document.getElementById('detailKickoff')?.value||'';
        s.matchMeta.kickoff=kickoff?new Date(kickoff).toISOString():'';
        s.matchMeta.venue=document.getElementById('detailVenue')?.value.trim()||'';
        s.matchMeta.referee=document.getElementById('detailReferee')?.value.trim()||'';
        const attendance=document.getElementById('detailAttendance')?.value;
        s.matchMeta.attendance=attendance===''?null:Math.max(0,Number(attendance)||0);
        s.matchMeta.status=document.getElementById('detailMatchStatus')?.value||'scheduled';
      }
    }catch(err){console.error('[NL4 Record Room] Match metadata capture failed:',err);}
    return originalSave.apply(this,arguments);
  };
  try{openFixture=window.openFixture;saveFixtureDetails=window.saveFixtureDetails;}catch(_){ }
  return true;
}

function renderEplArsenal(){
  const body=document.getElementById('arsenalPlayerStatsBody');const feed=FINAL.Arsenal;
  if(!body||!Array.isArray(feed)||!feed.length)return false;
  const oldRows=[...body.querySelectorAll('tr')].map(tr=>({tr,name:tr.dataset.player||tr.querySelector('strong')?.textContent?.trim()||'',position:tr.dataset.position||tr.querySelector('small')?.textContent?.trim()||'',number:tr.querySelector('.pl-player-number')?.textContent?.trim()||'—'}));
  const used=new Set();
  const statsFor=row=>{if(!row)return Array(15).fill('0');const cells=[...row.tr.querySelectorAll('td')].slice(1);return cells.map(td=>td.textContent.trim()||'0').concat(Array(15).fill('0')).slice(0,15)};
  const rows=feed.map(f=>{
    let best=null,bestS=0;for(const r of oldRows){if(used.has(r))continue;const s=Math.max(score(f.name,r.name),score(f.webName,r.name));if(s>bestS){bestS=s;best=r;}}
    if(bestS<70)best=null;if(best)used.add(best);
    const name=displayName(f,best);const position=f.position||best?.position||'Midfielder';const number=(best?.number&&best.number!=='—')?best.number:(f.number??'—');const vals=statsFor(best);
    const keys=['appearances','starts','minutes','goals','assists','clean_sheets','yellow_cards','red_cards','man_of_the_match','shots','shots_on_target','chances_created','tackles','interceptions','saves'];
    return `<tr data-player="${esc(name)}" data-position="${esc(position)}" data-final-name="${esc(f.name)}" data-web-name="${esc(f.webName||'')}"><td class="player-cell"><div class="pl-player-name"><span class="pl-player-number">${esc(number)}</span><span><strong>${esc(name)}</strong><small>${esc(position)}</small></span></div></td>${keys.map((k,i)=>`<td${k==='goals'||k==='assists'?' class="pl-stat-hot"':''} data-stat="${k}">${esc(vals[i]??0)}</td>`).join('')}</tr>`;
  });
  body.innerHTML=rows.join('');
  const note=document.querySelector('#arsenalPlayerStats .pl-table-note');if(note)note.textContent='ARSENAL ONLY • CURRENT POST-WINDOW SQUAD';
  const p=document.querySelector('#arsenalPlayerStats .pl-player-stats-toolbar p');if(p)p.textContent='Current registered Arsenal Premier League squad after the summer transfer window. Departed players remain only in historical match records.';
  return true;
}
function install(){
  if(document.getElementById('recordRoomPage')){
    enforceRecordRoom();installRecordRoomMatchMeta();
    setTimeout(()=>{enforceRecordRoom();installRecordRoomMatchMeta();try{if(typeof render==='function')render()}catch(_){}},50);
    setTimeout(()=>{enforceRecordRoom();installRecordRoomMatchMeta();try{if(typeof render==='function')render()}catch(_){}},500);
    window.addEventListener('focus',()=>{enforceRecordRoom();installRecordRoomMatchMeta();try{if(typeof render==='function')render()}catch(_){}});
  }
  if(document.getElementById('arsenalPlayerStats')){
    renderEplArsenal();setTimeout(renderEplArsenal,100);setTimeout(renderEplArsenal,800);
    window.addEventListener('focus',renderEplArsenal);
  }
}
window.NL4CurrentSquadEnforcer={enforceRecordRoom,renderEplArsenal,install,installRecordRoomMatchMeta};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();