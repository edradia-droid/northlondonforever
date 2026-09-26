(function(){
'use strict';
const db=()=>window.nl4Supabase;
const p=new URLSearchParams(location.search);
let idx=Number(p.get('match'));
if(!Number.isInteger(idx)||idx<0||idx>7)idx=0;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eventLabels={goal:'GOAL',assist:'ASSIST',yellow_card:'YELLOW CARD',red_card:'RED CARD',own_goal:'OWN GOAL'};

function setOfficialCrests(row,home,away){
  const homeImg=document.getElementById('homeLogo');
  const awayImg=document.getElementById('awayLogo');
  if(homeImg&&row?.home_crest_url){homeImg.src=row.home_crest_url;homeImg.alt=home+' crest';homeImg.style.display='';}
  if(awayImg&&row?.away_crest_url){awayImg.src=row.away_crest_url;awayImg.alt=away+' crest';awayImg.style.display='';}
}

function renderStats(f,home,away){
  const stats=[['Possession',f.home_possession,f.away_possession,'%'],['Shots',f.home_shots,f.away_shots,''],['Shots on target',f.home_shots_on_target,f.away_shots_on_target,''],['Corners',f.home_corners,f.away_corners,''],['Corner goals',f.home_corner_goals,f.away_corner_goals,''],['Fouls',f.home_fouls,f.away_fouls,''],['Offsides',f.home_offsides,f.away_offsides,''],['Saves',f.home_saves,f.away_saves,'']].filter(x=>x[1]!=null||x[2]!=null);
  const box=document.getElementById('statisticsBox'); if(!box)return;
  if(!stats.length){box.className='empty';box.textContent="Both teams' match statistics will appear here when recorded.";return;}
  box.className='';box.innerHTML=`<div class="stats-head"><strong>${esc(home)}</strong><span>STAT</span><strong>${esc(away)}</strong></div><div class="stats-list">${stats.map(x=>`<div class="stat-row"><strong>${x[1]??'—'}${x[1]!=null?x[3]:''}</strong><span>${esc(x[0])}</span><strong>${x[2]??'—'}${x[2]!=null?x[3]:''}</strong></div>`).join('')}</div>`;
}

function renderEvents(events,home,away){
  const box=document.getElementById('eventsBox');if(!box)return;
  if(!events.length){box.className='empty';box.textContent='Goals, assists, cards and own goals for both teams will appear here when recorded.';return;}
  box.className='events-list';
  box.innerHTML=events.map(event=>{const minute=event.minute==null?'—':`${event.minute}${event.stoppage_minute?`+${event.stoppage_minute}`:''}'`;const type=eventLabels[event.event_type]||String(event.event_type||'EVENT').replaceAll('_',' ').toUpperCase();const team=event.team_name||'—';let relation='';if(event.related_player_name)relation=event.event_type==='goal'?` • Assist: ${esc(event.related_player_name)}`:` • Related: ${esc(event.related_player_name)}`;const side=team===home?'HOME':team===away?'AWAY':'';const cls=String(event.event_type||'').replaceAll('_','-');return `<div class="event-row ${esc(cls)}"><span class="event-minute">${minute}</span><div class="event-main"><strong>${esc(event.player_name||'Unknown player')}</strong><small>${esc(team)}${side?` • ${side}`:''}${relation}</small></div><span class="event-type">${esc(type)}</span></div>`;}).join('');
}

const shirtColours={Arsenal:['#d8001f','#f4f4f4'],Napoli:['#1498d4','#0873ad'],Lille:['#d7193f','#102d61'],'Bayern München':['#dc052d','#f5f5f5'],'Slavia Praha':['#d71920','#f5f5f5'],'Borussia Dortmund':['#fdeb0a','#111111'],'Real Madrid':['#f5f5f5','#d9b44a'],'Real Betis':['#159447','#f5f5f5'],Sabah:['#203b89','#e01e35']};
function balancedProbability(a,b,isHome){const rate=(x,n)=>n?Number(x||0)/n:0,clamp=(x,min,max)=>Math.max(min,Math.min(max,x));const strength=t=>{const mp=Number(t.matches)||0;if(!mp)return 0;const ppm=rate(t.points,mp)/3,win=rate(t.wins,mp),gd=rate(Number(t.goals_for)-Number(t.goals_against),mp),sot=rate(t.shots_on_target,mp),poss=rate(t.possession_total,mp)/100,eff=Number(t.shots)?Number(t.goals_for)/Number(t.shots):0;return .32*ppm+.18*win+.15*(.5+.5*Math.tanh(gd/2))+.14*clamp(sot/8,0,1)+.08*clamp(poss,0,1)+.08*clamp(eff/.2,0,1)};const delta=(strength(a)-strength(b))+(isHome?.08:-.08),home=100/(1+Math.exp(-3.2*delta));return [Math.round(clamp(home,8,92)),0];}
function renderComparison(rows,home,away,isHome){const empty=name=>({team_name:name,matches:0,wins:0,draws:0,losses:0,goals_for:0,goals_against:0,points:0,possession_total:0,shots:0,shots_on_target:0,corners:0,corner_goals:0,fouls:0,offsides:0,saves:0,yellow_cards:0,red_cards:0});const h=rows.find(x=>x.team_name===home)||empty(home),a=rows.find(x=>x.team_name===away)||empty(away),avg=(x,k,d=1)=>x.matches?(Number(x[k])/Number(x.matches)).toFixed(d):'0.0';const metrics=[['Matches','matches'],['Wins','wins'],['Draws','draws'],['Losses','losses'],['Goals for','goals_for'],['Goals against','goals_against'],['Goal difference',x=>Number(x.goals_for)-Number(x.goals_against)],['Points','points'],['Avg possession',x=>avg(x,'possession_total')+'%'],['Shots','shots'],['Shots on target','shots_on_target'],['Corners','corners'],['Corner goals','corner_goals'],['Fouls','fouls'],['Offsides','offsides'],['Saves','saves'],['Yellow / red',x=>`${x.yellow_cards} / ${x.red_cards}`]];const get=(x,k)=>typeof k==='function'?k(x):x[k];let [hp]=balancedProbability(h,a,isHome);const ap=100-hp,hc=shirtColours[home]||['#3454a5','#16264f'],ac=shirtColours[away]||['#b18b32','#3a2c12'];return `<div class="ucl-comparison"><div class="comparison-title"><small>2026/27 CHAMPIONS LEAGUE</small><p>Side-by-side season performance</p></div><div class="comparison-table-wrap"><table class="comparison-table"><thead><tr><th>METRIC</th><th>${esc(home)}</th><th>${esc(away)}</th></tr></thead><tbody>${metrics.map(m=>`<tr><th>${m[0]}</th><td>${get(h,m[1])}</td><td>${get(a,m[1])}</td></tr>`).join('')}</tbody></table></div><div class="probability-card" style="--home-primary:${hc[0]};--home-secondary:${hc[1]};--away-primary:${ac[0]};--away-secondary:${ac[1]}"><div class="probability-heading"><strong>Win Probability</strong><small>Balanced from points, form, goal difference, shooting, possession and home advantage</small></div><div class="probability-names"><span>${esc(home)}</span><span>${esc(away)}</span></div><div class="probability-track" role="img" aria-label="${esc(home)} ${hp} percent, ${esc(away)} ${ap} percent"><div class="probability-side probability-home" style="width:${hp}%"><strong>${hp}%</strong></div><div class="probability-side probability-away" style="width:${ap}%"><strong>${ap}%</strong></div></div><p class="probability-note">Model estimate based only on the UCL table above—not a guarantee.</p></div></div>`;}

async function load(){
  const client=db();if(!client)return;
  const {data:f,error}=await client.from('fixtures').select('*').eq('season','2026/27').eq('competition','UEFA Champions League').eq('matchday',idx+1).maybeSingle();
  if(error||!f){if(error)console.warn(error);return;}
  const home=f.home_team||(f.is_home?'Arsenal':f.opponent),away=f.away_team||(f.is_home?f.opponent:'Arsenal');

  if(f.external_fixture_id){
    const {data:crestRow,error:crestError}=await client.from('ucl_matches').select('home_crest_url,away_crest_url').eq('season','2026/27').eq('external_match_id',String(f.external_fixture_id)).maybeSingle();
    if(crestError)console.warn('NL4 UCL crests:',crestError);else setOfficialCrests(crestRow,home,away);
  }

  const status=String(f.status||'scheduled').toLowerCase(),complete=['fulltime','finished','ft','aet','pen'].includes(status);
  document.getElementById('title').innerHTML=`${esc(home)} <span class="vs-word">vs</span> ${esc(away)}`;document.getElementById('homeTeam').textContent=home;document.getElementById('awayTeam').textContent=away;document.getElementById('venue').textContent=f.venue||'TBC';document.getElementById('matchday').textContent='Matchday '+(f.matchday||idx+1);
  const d=new Date(f.kickoff_at);if(!Number.isNaN(d.getTime())){document.getElementById('date').textContent=d.toLocaleDateString([],{day:'2-digit',month:'short',year:'numeric'});document.getElementById('time').textContent=d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
  const statusEl=document.getElementById('status');statusEl.textContent=complete?'FULL TIME':status==='live'?'LIVE':'SCHEDULED';statusEl.className='pill'+(complete?' fulltime':status==='live'?' live':'');
  const score=document.getElementById('score'),mc=document.getElementById('matchCentre'),detailParts=[];
  if(complete&&f.arsenal_score!=null&&f.opponent_score!=null){const hs=f.is_home?f.arsenal_score:f.opponent_score,as=f.is_home?f.opponent_score:f.arsenal_score;score.textContent=hs+' – '+as;document.getElementById('kickoff').textContent='FULL TIME';document.getElementById('predictionLink').style.display='none';detailParts.push(`<div><span>Full-time</span><strong>${esc(home)} ${hs} – ${as} ${esc(away)}</strong></div>`);if(f.halftime_arsenal_score!=null&&f.halftime_opponent_score!=null){const hh=f.is_home?f.halftime_arsenal_score:f.halftime_opponent_score,ha=f.is_home?f.halftime_opponent_score:f.halftime_arsenal_score;detailParts.push(`<div><span>Half-time</span><strong>${hh} – ${ha}</strong></div>`);}}else if(!Number.isNaN(d.getTime()))document.getElementById('kickoff').textContent=d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  if(f.referee)detailParts.push(`<div><span>Referee</span><strong>${esc(f.referee)}</strong></div>`);if(f.attendance!=null)detailParts.push(`<div><span>Attendance</span><strong>${Number(f.attendance).toLocaleString()}</strong></div>`);if(f.added_time!=null)detailParts.push(`<div><span>Added time</span><strong>+${Number(f.added_time)} minutes</strong></div>`);if(f.man_of_the_match)detailParts.push(`<div><span>Man of the Match</span><strong>${esc(f.man_of_the_match)}</strong></div>`);if(detailParts.length){mc.className='result-summary';mc.innerHTML=detailParts.join('');}
  renderStats(f,home,away);

  const [{data:events,error:eventsError},{data:lineups,error:lineupsError},{data:teamTotals,error:teamTotalsError},{data:comparison,error:comparisonError}]=await Promise.all([client.from('match_events').select('*').eq('fixture_id',f.id).order('minute',{ascending:true,nullsFirst:false}).order('stoppage_minute',{ascending:true,nullsFirst:false}),client.from('match_lineups').select('*').eq('fixture_id',f.id).order('is_starter',{ascending:false}).order('minute_on'),client.from('ucl_team_stats').select('*').eq('season','2026/27').in('team_name',[home,away]),client.from('ucl_match_comparisons').select('home_stats,away_stats').eq('fixture_id',f.id).maybeSingle()]);
  if(eventsError){console.warn('NL4 UCL match events:',eventsError);const box=document.getElementById('eventsBox');if(box){box.className='empty';box.textContent='Match events could not be loaded.';}}else renderEvents(events||[],home,away);
  const lineupBox=document.getElementById('clStartingXI');
  // Matchday 1 uses the permanent HTML lineup. Do not let the async UCL data refresh rewrite it.
  if(idx===0){
    const formationEl=document.getElementById('clFormation'); if(formationEl) formationEl.textContent='4-3-3';
    const matchup=document.getElementById('clLineupMatch'); if(matchup) matchup.textContent=`${home} VS ${away}`;
    const venueEl=document.getElementById('clLineupVenue'); if(venueEl) venueEl.textContent=f.venue||'VENUE TBC';
    // Matchday 1 substitutions are refreshed from Supabase so unused players cannot inherit old minute ranges.
    const md1Subs=(lineups||[]).filter(x=>/arsenal/i.test(String(x.team_name||''))&&!x.is_starter);
    const md1SubBox=document.getElementById('clSubstitutes');
    if(md1SubBox) md1SubBox.innerHTML=md1Subs.length?md1Subs.map(row=>{
      const key=normalizeName(String(row.player_name||'')),unused=Number(row.minute_on||0)===0;
      const on=unused?'UNUSED':`<span class="cl-pl-in">↑</span> ON ${row.minute_on}'`;
      const off=!unused&&row.minute_off!=null?` • OFF ${row.minute_off}'`:'';
      const incoming=esc(row.player_name),outgoing='';return `<div class="cl-pl-sub"><div><strong>${outgoing}${incoming}</strong><small>${esc(on+off)}</small></div></div>`;
    }).join(''):'<div class="empty">No substitutions recorded.</div>';
  } else {

  const arsenalTeam = /arsenal/i.test(home) ? home : (/arsenal/i.test(away) ? away : 'Arsenal');
  const lineupRows=(lineups||[]).filter(x=>/arsenal/i.test(String(x.team_name||'')) || String(x.team_name||'')===arsenalTeam);
  if(lineupBox){
    const starters=lineupRows.filter(x=>x.is_starter);
    const subs=lineupRows.filter(x=>!x.is_starter);
    const normalizeName=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[øØ]/g,'o').replace(/[đĐ]/g,'d').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ').toLowerCase();
    const shirts={
      'david raya':1,'william saliba':2,'cristhian mosquera':3,'ben white':4,'piero hincapie':5,'gabriel magalhaes':6,
      'bukayo saka':7,'martin odegaard':8,'gabriel jesus':9,'eberechi eze':10,'gabriel martinelli':11,'jurrien timber':12,
      'kepa arrizabalaga':13,'viktor gyokeres':14,'christian norgaard':16,'christos tzolis':17,'noni madueke':20,
      'ethan nwaneri':22,'mikel merino':23,'reiss nelson':24,'kai havertz':29,'illan meslier':30,'riccardo calafiori':33,
      'tommy setford':35,'martin zubimendi':36,'bruno guimaraes':39,'declan rice':41,'myles lewis-skelly':49,'max dowman':56,
      'ezri konsa':15
    };
    const imageAliases={'odegaard':'martin odegaard','martin ødegaard':'martin odegaard','martin odegaard':'martin odegaard'};
    const images={
      'david raya':'assets/player-cutouts/player-01.png','kepa arrizabalaga':'assets/player-cutouts/player-02.png','illan meslier':'assets/player-cutouts/player-03.png','tommy setford':'assets/player-cutouts/player-04.png',
      'william saliba':'assets/player-cutouts/player-05.png','cristhian mosquera':'assets/player-cutouts/player-06.png','ben white':'assets/player-cutouts/player-07.png','piero hincapie':'assets/player-cutouts/player-08.png',
      'gabriel magalhaes':'assets/player-cutouts/player-09.png','jurrien timber':'assets/player-cutouts/player-10.png','ezri konsa':'assets/player-cutouts/player-11.png','riccardo calafiori':'assets/player-cutouts/player-12.png',
      'declan rice':'assets/player-cutouts/player-13.png','bruno guimaraes':'assets/player-cutouts/player-14.png','martin odegaard':'assets/player-cutouts/player-15.png','martin zubimendi':'assets/player-cutouts/player-16.png',
      'mikel merino':'assets/player-cutouts/player-17.png','myles lewis-skelly':'assets/player-cutouts/player-18.png','eberechi eze':'assets/player-cutouts/player-19.png','ethan nwaneri':'assets/player-cutouts/player-20.png',
      'max dowman':'assets/player-cutouts/player-21.png','christos tzolis':'assets/player-cutouts/player-22.png','bukayo saka':'assets/player-cutouts/player-23.png','noni madueke':'assets/player-cutouts/player-24.png',
      'kai havertz':'assets/player-cutouts/player-25.png','viktor gyokeres':'assets/player-cutouts/player-26.png'
    };
    const slots={
      'GK':[50,89],'LB':[13,72],'LCB':[36,74],'CB':[50,74],'RCB':[64,74],'RB':[87,72],
      'LWB':[10,57],'RWB':[90,57],'DM':[50,58],'LDM':[35,59],'RDM':[65,59],'LM':[11,45],
      'LCM':[34,47],'CM':[50,47],'RCM':[66,47],'RM':[89,45],'LAM':[27,34],'CAM':[50,33],
      'RAM':[73,34],'AM':[50,33],'LW':[12,20],'RW':[88,20],'ST':[50,15],'LST':[35,18],'RST':[65,18]
    };
    const formationSlots={
      '4-3-3':['GK','LB','LCB','RCB','RB','LCM','CM','RCM','LW','ST','RW'],
      '4-2-3-1':['GK','LB','LCB','RCB','RB','LDM','RDM','LW','CAM','RW','ST'],
      '4-4-2':['GK','LB','LCB','RCB','RB','LM','LCM','RCM','RM','LST','RST'],
      '3-4-3':['GK','LCB','CB','RCB','LM','LCM','RCM','RM','LW','ST','RW'],
      '3-5-2':['GK','LCB','CB','RCB','LWB','LCM','CM','RCM','RWB','LST','RST'],
      '4-1-4-1':['GK','LB','LCB','RCB','RB','DM','LM','LCM','RCM','RM','ST'],
      '4-5-1':['GK','LB','LCB','RCB','RB','LDM','RDM','LW','CAM','RW','ST']
    };
    const formation=String(starters[0]?.formation||'').trim() && formationSlots[String(starters[0]?.formation).trim()] ? String(starters[0].formation).trim() : '4-3-3';
    const template=formationSlots[formation];
    const used=new Set();
    const roleOverride={'david raya':'GK','martin odegaard':'CAM','ben white':'RB','cristhian mosquera':'RCB','ezri konsa':'RCB','gabriel magalhaes':'LCB','riccardo calafiori':'LB','declan rice':'LDM','myles lewis-skelly':'RDM','martin odegaard':'CAM','bukayo saka':'RW','christos tzolis':'LW','kai havertz':'ST'};
    const resolved=starters.map((row,index)=>{
      const key=normalizeName(row.player_name);
      let requested=String(row.pitch_slot||'').trim().toUpperCase();
      const position=String(row.position||'').trim().toUpperCase();
      if(requested==='AM')requested='CAM';if(requested==='LAM')requested='LW';if(requested==='RAM')requested='RW';
      if(!template.includes(requested))requested=roleOverride[key]||position;
      if(!template.includes(requested) && Number.isInteger(Number(row.pitch_slot))) requested=template[Number(row.pitch_slot)-1];
      if(!template.includes(requested)||used.has(requested)) requested=template.find(x=>!used.has(x))||template[index]||'CM';
      used.add(requested);return requested;
    });
    const outgoing=new Map((lineups||[]).filter(x=>x.is_starter&&x.minute_off!=null).map(x=>[normalizeName(x.player_name),Number(x.minute_off)]));
    const markings='<span class="cl-pl-box top"></span><span class="cl-pl-goal top"></span><span class="cl-pl-box bottom"></span><span class="cl-pl-goal bottom"></span>';
    const figures=starters.length?starters.map((row,index)=>{
      const slot=resolved[index],
        xy=slots[slot]||slots.CM,
        name=String(row.player_name||'Arsenal'),
        rawKey=normalizeName(name),
        key=imageAliases[rawKey]||rawKey,
        image=images[key],
        shirt=shirts[key]??'',
        off=outgoing.get(rawKey)||outgoing.get(key);
      const photo=image
        ? `<img class="kit-player-photo" src="${esc(image)}" alt="${esc(name)}" loading="eager" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${esc(image)}'">`
        : '';
      return `<div class="player-marker" style="--x:${xy[0]}%;--y:${xy[1]}%;--depth:${(.78+(xy[1]/100)*.24).toFixed(2)}" title="${esc(name)} • #${esc(shirt)}">
        <span class="player-ground-shadow"></span>
        <div class="kit-player">${photo}</div>
        <span class="player-name">${esc(name)}${off!=null?`<span class="cl-pl-off">↓ ${esc(off)}'</span>`:''}</span>
      </div>`;
    }).join(''):'<div class="cl-pl-empty">Starting XI has not been announced yet.</div>';
    // Matchday 1 has a verified local-image fallback in the HTML. Keep it in place so a later async refresh cannot replace the visible player photos.
    const hasStaticPhotoFallback=idx===0 && lineupBox.querySelector('.kit-player-photo');
    if(!hasStaticPhotoFallback) lineupBox.innerHTML=markings+figures;
    const formationEl=document.getElementById('clFormation');if(formationEl)formationEl.textContent=starters.length?formation:'TBC';
    const matchup=document.getElementById('clLineupMatch');if(matchup)matchup.textContent=`${home} VS ${away}`;
    const venueEl=document.getElementById('clLineupVenue');if(venueEl)venueEl.textContent=f.venue||'VENUE TBC';
    const subBox=document.getElementById('clSubstitutes');
    if(subBox)subBox.innerHTML=subs.length?subs.map(row=>{
      const rawKey=normalizeName(row.player_name),key=imageAliases[rawKey]||rawKey,img=images[key],unused=Number(row.minute_on||0)===0,on=unused?'UNUSED':`ON ${row.minute_on}'`,off=!unused&&row.minute_off!=null?` • OFF ${row.minute_off}'`:'';
      const incoming=esc(row.player_name),outgoing='';return `<div class="cl-pl-sub">${img?`<img src="${esc(img)}" alt="${esc(row.player_name)}" loading="eager">`:''}<div><strong>${outgoing}${incoming}</strong><small>${esc(on+off)}</small></div></div>`;
    }).join(''):'<div class="empty">No substitutions recorded.</div>';
  }
  }

  const totalsBox=document.getElementById('teamTotalsBox');if(teamTotalsError||comparisonError)totalsBox.textContent='UCL season totals could not be loaded.';else if(!(teamTotals||[]).length){totalsBox.className='empty';totalsBox.textContent='Team totals will appear after a completed match.';}else{const rows=[...(teamTotals||[])],apply=(name,override)=>{if(!override)return;const i=rows.findIndex(x=>x.team_name===name);if(i>=0)rows[i]={...rows[i],...override,team_name:name};else rows.push({...override,team_name:name})};apply(home,comparison?.home_stats);apply(away,comparison?.away_stats);totalsBox.className='';totalsBox.innerHTML=renderComparison(rows,home,away,true);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();