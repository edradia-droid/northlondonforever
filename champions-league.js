const logoBase='https://media.api-sports.io/football/teams/';
const teamLogos={
  'Arsenal':42,'Aston Villa':66,'Atlético de Madrid':530,'Barcelona':529,'Bayern München':157,'Bodø/Glimt':413,
  'Borussia Dortmund':165,'Club Brugge':569,'Como':895,'Fenerbahçe':611,'Feyenoord':234,'Galatasaray':645,
  'Inter':505,'LASK':575,'Leipzig':173,'Lens':116,'Lille':79,'Liverpool':40,'Manchester City':50,'Manchester United':33,
  'Napoli':492,'Paris Saint-Germain':85,'Porto':212,'PSV Eindhoven':197,'Real Betis':543,'Real Madrid':541,'Roma':497,
  'Sabah':563,'Shakhtar Donetsk':550,'Slavia Praha':560,'Slovan Bratislava':656,'Sporting CP':228,'Stuttgart':172,
  'Viking':327,'Villarreal':533,'AEK Athens':1026
};

const arsenalFixtures = [
  {date:'09 SEP 2026',opponent:'Napoli',venue:'AWAY',match:'Napoli vs Arsenal',md:'MD1',time:'21:00 CET',status:'scheduled',homeScore:null,awayScore:null},
  {date:'13 OCT 2026',opponent:'Lille',venue:'HOME',match:'Arsenal vs Lille',md:'MD2',time:'21:00 CET',status:'scheduled',homeScore:null,awayScore:null},
  {date:'21 OCT 2026',opponent:'Bayern München',venue:'AWAY',match:'Bayern München vs Arsenal',md:'MD3',time:'21:00 CET',status:'scheduled',homeScore:null,awayScore:null},
  {date:'04 NOV 2026',opponent:'Slavia Praha',venue:'AWAY',match:'Slavia Praha vs Arsenal',md:'MD4',time:'21:00 CET',status:'scheduled',homeScore:null,awayScore:null},
  {date:'24 NOV 2026',opponent:'Borussia Dortmund',venue:'HOME',match:'Arsenal vs Borussia Dortmund',md:'MD5',time:'21:00 CET',status:'scheduled',homeScore:null,awayScore:null},
  {date:'09 DEC 2026',opponent:'Real Madrid',venue:'HOME',match:'Arsenal vs Real Madrid',md:'MD6',time:'21:00 CET',status:'scheduled',homeScore:null,awayScore:null},
  {date:'20 JAN 2027',opponent:'Real Betis',venue:'AWAY',match:'Real Betis vs Arsenal',md:'MD7',time:'21:00 CET',status:'scheduled',homeScore:null,awayScore:null},
  {date:'27 JAN 2027',opponent:'Sabah',venue:'HOME',match:'Arsenal vs Sabah',md:'MD8',time:'21:00 CET',status:'scheduled',homeScore:null,awayScore:null}
];

const teams = [
 'Arsenal','Aston Villa','Atlético de Madrid','Barcelona','Bayern München','Bodø/Glimt','Borussia Dortmund','Club Brugge','Como','Fenerbahçe','Feyenoord','Galatasaray','Inter','LASK','Leipzig','Lens','Lille','Liverpool','Manchester City','Manchester United','Napoli','Paris Saint-Germain','Porto','PSV Eindhoven','Real Betis','Real Madrid','Roma','Sabah','Shakhtar Donetsk','Slavia Praha','Slovan Bratislava','Sporting CP','Stuttgart','Viking','Villarreal','AEK Athens'
];

const results = [
 ['AEK Athens','LASK',1,0],
 ['Club Brugge','Aston Villa',2,3],
 ['Borussia Dortmund','Villarreal',3,2],
 ['Porto','Manchester City',0,2],
 ['Lille','Real Betis',2,3],
 ['Real Madrid','Inter',2,1]
];

function logo(team){
  const id=teamLogos[team];
  return id ? `<img class="team-logo" src="${logoBase}${id}.png" alt="${team} crest" loading="lazy" onerror="this.style.display='none'">` : `<span class="club-dot">${team.slice(0,3).toUpperCase()}</span>`;
}

function fixtureState(fixture){
  const s=String(fixture.status||'scheduled').toLowerCase();
  const hasScore=Number.isFinite(fixture.homeScore)&&Number.isFinite(fixture.awayScore);
  if(['fulltime','ft','aet','pen'].includes(s)||hasScore)return{label:'FULL TIME',completed:true,live:false};
  if(['live','1h','ht','2h','et'].includes(s))return{label:'LIVE',completed:false,live:true};
  return{label:'SCHEDULED',completed:false,live:false};
}

function buildStandings(){
  const stats = Object.fromEntries(teams.map(team => [team,{team,p:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0}]));
  results.forEach(([home,away,h,a])=>{
    const H=stats[home], A=stats[away];
    H.p++; A.p++; H.gf+=h; H.ga+=a; A.gf+=a; A.ga+=h;
    H.gd=H.gf-H.ga; A.gd=A.gf-A.ga;
    if(h>a){H.w++;H.pts+=3;A.l++;} else if(h<a){A.w++;A.pts+=3;H.l++;} else {H.d++;A.d++;H.pts++;A.pts++;}
  });
  return Object.values(stats).sort((a,b)=>b.pts-a.pts || b.gd-a.gd || b.gf-a.gf || a.team.localeCompare(b.team));
}

function renderFixtures(){
  const el=document.getElementById('arsenalUclFixtures');
  el.innerHTML=arsenalFixtures.map((fixture,i)=>{
    const {date,opponent,venue,match,md,time}=fixture;
    const home=venue==='HOME';
    const left=home?'Arsenal':opponent;
    const right=home?opponent:'Arsenal';
    const state=fixtureState(fixture);
    const centre=state.completed
      ? `<span>FULL TIME</span><strong class="ucl-score">${fixture.homeScore}–${fixture.awayScore}</strong><small>Champions League</small>`
      : state.live
        ? `<span>LIVE</span><strong class="ucl-score">${Number.isFinite(fixture.homeScore)?fixture.homeScore:0}–${Number.isFinite(fixture.awayScore)?fixture.awayScore:0}</strong><small>Champions League</small>`
        : `<span>${time}</span><strong>VS</strong><small>Champions League</small>`;
    return `<article class="ucl-fixture ${home?'arsenal-home':''}${state.completed?' completed':''}">
      <div class="fixture-top"><span>${md} • ${date}</span><span class="fixture-status${state.completed?' fulltime':''}${state.live?' live':''}">${state.label}</span></div>
      <div class="fixture-match">
        <div class="fixture-team">${logo(left)}<b>${left}</b><small>${home?'HOME':'AWAY'}</small></div>
        <div class="fixture-centre">${centre}</div>
        <div class="fixture-team">${logo(right)}<b>${right}</b><small>${home?'AWAY':'HOME'}</small></div>
      </div>
      <div class="fixture-bottom ucl-fixture-bottom">
        <div class="ucl-fixture-caption"><span>${match}</span><span>2026/27</span></div>
        <div class="ucl-fixture-actions">
          ${state.completed?'':`<a class="ucl-action ucl-action-predict" href="champions-league-prediction.html?match=${i}">Match Prediction</a>`}
          <a class="ucl-action ucl-action-details" href="champions-league-match-details.html?match=${i}">More Details →</a>
        </div>
      </div>
    </article>`;
  }).join('');
}

function renderTable(){
  const body=document.getElementById('uclTableBody');
  body.innerHTML=buildStandings().map((row,i)=>`<tr class="${row.team==='Arsenal'?'arsenal-row':''}">
    <td>${i+1}</td><td class="club-cell"><div class="club-wrap">${logo(row.team)}<span>${row.team}</span></div></td>
    <td>${row.p}</td><td>${row.w}</td><td>${row.d}</td><td>${row.l}</td><td>${row.gf}</td><td>${row.ga}</td><td>${row.gd>0?'+':''}${row.gd}</td><td>${row.pts}</td>
  </tr>`).join('');
}

function installFixtureActionStyles(){
  if(document.getElementById('uclFixtureActionStyles')) return;
  const style=document.createElement('style');
  style.id='uclFixtureActionStyles';
  style.textContent=`
    .ucl-fixture-bottom{display:block!important;padding-top:13px!important}
    .ucl-fixture-caption{display:flex;justify-content:space-between;gap:12px;align-items:center}
    .ucl-fixture-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px}
    .ucl-action{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:8px 11px;border-radius:9px;text-decoration:none;font-size:9px;font-weight:1000;letter-spacing:.45px;transition:transform .18s ease,background .18s ease,border-color .18s ease}
    .ucl-action:hover{transform:translateY(-1px)}
    .ucl-action-predict{background:#d8ad45;color:#101018;border:1px solid #d8ad45}
    .ucl-action-predict:hover{background:#e7c362}
    .ucl-action-details{background:rgba(216,173,69,.06);color:#d8ad45;border:1px solid rgba(216,173,69,.38)}
    .ucl-action-details:hover{background:rgba(216,173,69,.12);border-color:rgba(216,173,69,.65)}
    .fixture-status.fulltime{color:#8df0b2}.fixture-status.live{color:#ff8fa0}.ucl-fixture.completed{border-color:rgba(80,220,135,.24)}.fixture-centre .ucl-score{border-color:rgba(127,215,255,.48);color:#fff;font-size:20px;letter-spacing:1px}
    @media(max-width:600px){.ucl-fixture-actions{gap:6px}.ucl-action{flex:1 1 calc(50% - 3px);padding:8px 6px;font-size:8px}.ucl-fixture-caption{font-size:9px}}
  `;
  document.head.appendChild(style);
}

document.addEventListener('DOMContentLoaded',()=>{installFixtureActionStyles();renderFixtures();renderTable();});
