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
  ['09 SEP 2026','Napoli','AWAY','Napoli vs Arsenal','MD1','21:00 CET'],
  ['13 OCT 2026','Lille','HOME','Arsenal vs Lille','MD2','21:00 CET'],
  ['21 OCT 2026','Bayern München','AWAY','Bayern München vs Arsenal','MD3','21:00 CET'],
  ['04 NOV 2026','Slavia Praha','AWAY','Slavia Praha vs Arsenal','MD4','21:00 CET'],
  ['24 NOV 2026','Borussia Dortmund','HOME','Arsenal vs Borussia Dortmund','MD5','21:00 CET'],
  ['09 DEC 2026','Real Madrid','HOME','Arsenal vs Real Madrid','MD6','21:00 CET'],
  ['20 JAN 2027','Real Betis','AWAY','Real Betis vs Arsenal','MD7','21:00 CET'],
  ['27 JAN 2027','Sabah','HOME','Arsenal vs Sabah','MD8','21:00 CET']
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
  el.innerHTML=arsenalFixtures.map(([date,opponent,venue,match,md,time],i)=>{
    const home=venue==='HOME';
    const left=home?'Arsenal':opponent;
    const right=home?opponent:'Arsenal';
    return `<article class="ucl-fixture ${home?'arsenal-home':''}">
      <div class="fixture-top"><span>${md} • ${date}</span><span class="fixture-status">${i===0?'UPCOMING':'SCHEDULED'}</span></div>
      <div class="fixture-match">
        <div class="fixture-team">${logo(left)}<b>${left}</b><small>${home?'HOME':'AWAY'}</small></div>
        <div class="fixture-centre"><span>${time}</span><strong>VS</strong><small>Champions League</small></div>
        <div class="fixture-team">${logo(right)}<b>${right}</b><small>${home?'AWAY':'HOME'}</small></div>
      </div>
      <div class="fixture-bottom"><span>${match}</span><span>2026/27</span></div>
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

document.addEventListener('DOMContentLoaded',()=>{renderFixtures();renderTable();});
