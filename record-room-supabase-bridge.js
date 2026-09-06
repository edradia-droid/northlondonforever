/* NL4 Record Room • localStorage ↔ Supabase bridge
 * Keeps the existing Record Room calculations/UI intact and mirrors approved
 * admin records into the dedicated Record Room tables.
 */
(function(){
  'use strict';
  const SEASON='2026/27';
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const rr=()=>window.NL4RecordRoomSupabase;
  const norm=v=>String(v||'').trim();
  const split=v=>{const p=String(v||'').split('|||');return {team:norm(p[0]),name:norm(p.slice(1).join('|||'))};};
  const nullableNumber=v=>(v===null||v===undefined||v==='')?null:Number(v);

  function playerRows(){
    const rows=[];
    if(typeof TEAMS==='undefined'||typeof db==='undefined') return rows;
    TEAMS.forEach(club=>(db[club]?.players||[]).forEach(p=>rows.push({
      season:SEASON,club,player_name:p.name,position:p.position||null,shirt_number:p.number??null,
      appearances:Number(p.appearances)||0,starts:Number(p.starts)||0,minutes:Number(p.minutes)||0,
      goals:Number(p.goals)||0,assists:Number(p.assists)||0,clean_sheets:Number(p.cleanSheets)||0,
      yellow_cards:Number(p.yellowCards)||0,red_cards:Number(p.redCards)||0,
      man_of_the_match:Number(p.mom)||0,shots:Number(p.shots)||0,
      shots_on_target:Number(p.shotsOnTarget)||0,chances_created:Number(p.chancesCreated)||0,
      tackles:Number(p.tackles)||0,interceptions:Number(p.interceptions)||0,saves:Number(p.saves)||0
    })));
    return rows;
  }

  async function mirrorPlayers(){
    const api=rr(); if(!api) return {available:false};
    const result=await api.savePlayers(playerRows());
    if(!result.available) console.warn('[NL4 Record Room] Player mirror stayed on local fallback.');
    return result;
  }

  async function resolveMatch(f){
    const client=window.nl4Supabase;
    if(!client||!f) return null;
    const q=await client.from('premier_league_matches').select('id,home_team,away_team,matchday,kickoff_at')
      .eq('season',SEASON).eq('home_team',f.home).eq('away_team',f.away).limit(2);
    if(q.error||!q.data?.length) return null;
    if(q.data.length===1) return q.data[0];
    return q.data.find(x=>Number(x.matchday)===Number(f.mw))||q.data[0];
  }

  function lineupRows(f,s){
    const rows=[];
    const add=(team,lineup,subs)=>{
      const subByOut=new Map((subs||[]).map(x=>[norm(x.out).toLowerCase(),x]));
      (lineup||[]).filter(Boolean).forEach((name,i)=>{
        const sub=subByOut.get(norm(name).toLowerCase());
        rows.push({team_name:team,player_name:name,is_starter:true,minute_on:0,
          minute_off:sub&&Number.isFinite(Number(sub.outMin))?Number(sub.outMin):null,pitch_slot:String(i+1)});
      });
      (subs||[]).filter(x=>x.in).forEach(x=>rows.push({team_name:team,player_name:x.in,is_starter:false,
        minute_on:Number.isFinite(Number(x.inMin))?Number(x.inMin):(Number(x.outMin)||0),minute_off:null}));
    };
    add(f.home,s.homeLineup,s.homeSubs); add(f.away,s.awayLineup,s.awaySubs); return rows;
  }

  function substitutionRows(f,s){
    const rows=[];
    const add=(team,subs)=>(subs||[]).forEach(x=>{if(x.out&&x.in)rows.push({team_name:team,player_out:x.out,player_in:x.in,minute:Number(x.inMin??x.outMin)||0});});
    add(f.home,s.homeSubs); add(f.away,s.awaySubs); return rows;
  }

  function eventRows(s){
    return (s.events||[]).map(ev=>{
      const who=split(ev.player),helper=split(ev.assist);
      return {team_name:who.team,event_type:ev.type==='yellow'?'yellow_card':ev.type==='red'?'red_card':'goal',
        player_name:who.name,related_player_name:helper.name||null,minute:Number(ev.minute)||0};
    }).filter(x=>x.team_name&&x.player_name);
  }

  function matchPayload(f,s){
    const motm=split(s.manOfTheMatch);
    const st=s.stats||{}, md=s.matchDetails||{}, val=(k,side)=>Number(st?.[k]?.[side])||0;
    return {
      details:{
        referee:norm(md.referee)||null,venue:norm(md.venue)||null,attendance:nullableNumber(md.attendance),
        man_of_the_match:motm.name||null,halftime_home_score:nullableNumber(md.halftimeHomeScore),
        halftime_away_score:nullableNumber(md.halftimeAwayScore),added_time:Math.max(0,Math.min(30,Number(md.addedTime)||0)),
        source:'NL4 Record Room',source_updated_at:new Date().toISOString()
      },
      stats:{home_possession:val('possession','h'),away_possession:val('possession','a'),home_shots:val('shots','h'),away_shots:val('shots','a'),
        home_shots_on_target:val('sot','h'),away_shots_on_target:val('sot','a'),home_corners:val('corners','h'),away_corners:val('corners','a'),
        home_corner_goals:val('cornerGoals','h'),away_corner_goals:val('cornerGoals','a'),home_fouls:val('fouls','h'),away_fouls:val('fouls','a'),
        home_offsides:val('offsides','h'),away_offsides:val('offsides','a'),home_saves:val('saves','h'),away_saves:val('saves','a')},
      lineups:lineupRows(f,s),substitutions:substitutionRows(f,s),events:eventRows(s)
    };
  }

  function savedFixtureFor(f){
    return db?.[f.home]?.fixtureData?.[f.id] || db?.[f.away]?.fixtureData?.[f.id] || null;
  }

  async function mirrorFixture(f,s){
    const match=await resolveMatch(f);
    if(!match){console.warn('[NL4 Record Room] Could not resolve Supabase match',f);return {available:false};}
    return rr().saveMatch(match.id,matchPayload(f,s));
  }

  async function mirrorOpenFixture(){
    if(typeof ALL_FIXTURES==='undefined'||typeof db==='undefined') return;
    const box=document.getElementById('fixtureDetail');
    const localId=Number(box?.dataset?.fixtureId); if(!Number.isFinite(localId)) return;
    const f=ALL_FIXTURES.find(x=>Number(x.id)===localId); if(!f) return;
    const s=savedFixtureFor(f); if(!s) return;
    const result=await mirrorFixture(f,s);
    const state=document.getElementById('fixtureSaveState');
    if(result.available){
      await mirrorPlayers();
      if(state){state.style.color='#49d17d';state.textContent='SUPABASE CONFIRMED';setTimeout(()=>{if(state)state.textContent='';},3000);}
    }else if(state){state.style.color='#ffb347';state.textContent='LOCAL SAVED • SUPABASE NOT CONFIRMED';}
  }

  function hasMeaningfulLocalData(){
    if(typeof TEAMS==='undefined'||typeof db==='undefined') return false;
    return TEAMS.some(team=>{
      const players=db[team]?.players||[];
      if(players.some(p=>['appearances','starts','minutes','goals','assists','yellowCards','redCards','mom','shots','shotsOnTarget','chancesCreated','tackles','interceptions','saves'].some(k=>(Number(p[k])||0)>0))) return true;
      return Object.values(db[team]?.fixtureData||{}).some(s=>s&&(
        s.homeScore!=null||s.awayScore!=null||(s.homeLineup||[]).some(Boolean)||(s.awayLineup||[]).some(Boolean)||
        (s.homeSubs||[]).length||(s.awaySubs||[]).length||(s.events||[]).length||norm(s.manOfTheMatch)||
        Object.values(s.matchDetails||{}).some(v=>v!==null&&v!==undefined&&v!=='')
      ));
    });
  }

  async function pushAllCurrent(){
    if(typeof ALL_FIXTURES==='undefined'||typeof db==='undefined') return {available:false,error:new Error('Record Room data unavailable')};
    const api=rr(); if(!api) return {available:false,error:new Error('Supabase bridge unavailable')};
    const ready=await api.probe(); if(!ready.available) return ready;
    const playerResult=await mirrorPlayers();
    if(!playerResult.available) return playerResult;
    let saved=0,failed=0;
    for(const f of ALL_FIXTURES){
      const s=savedFixtureFor(f);
      if(!s) continue;
      const meaningful=s.homeScore!=null||s.awayScore!=null||(s.homeLineup||[]).some(Boolean)||(s.awayLineup||[]).some(Boolean)||
        (s.homeSubs||[]).length||(s.awaySubs||[]).length||(s.events||[]).length||norm(s.manOfTheMatch)||
        Object.values(s.matchDetails||{}).some(v=>v!==null&&v!==undefined&&v!=='');
      if(!meaningful) continue;
      const result=await mirrorFixture(f,s);
      if(result.available)saved++;else failed++;
    }
    console.log(`[NL4 Record Room] Full local push finished: ${saved} matches saved, ${failed} failed.`);
    return {available:failed===0,saved,failed};
  }

  function importPlayers(rows){
    if(!rows?.length||typeof db==='undefined') return;
    rows.forEach(r=>{
      if(!db[r.club]) return;
      const p=(db[r.club].players||[]).find(x=>norm(x.name).toLowerCase()===norm(r.player_name).toLowerCase());
      if(!p) return;
      Object.assign(p,{appearances:r.appearances||0,starts:r.starts||0,minutes:r.minutes||0,goals:r.goals||0,assists:r.assists||0,
        cleanSheets:r.clean_sheets||0,yellowCards:r.yellow_cards||0,redCards:r.red_cards||0,mom:r.man_of_the_match||0,shots:r.shots||0,
        shotsOnTarget:r.shots_on_target||0,chancesCreated:r.chances_created||0,tackles:r.tackles||0,interceptions:r.interceptions||0,saves:r.saves||0});
    });
  }

  function ensureFixtureRecord(team,f){
    if(!db?.[team]) return null;
    db[team].fixtureData=db[team].fixtureData||{};
    if(!db[team].fixtureData[f.id]&&typeof fixtureStore==='function') return fixtureStore(team,f.id);
    if(!db[team].fixtureData[f.id]) db[team].fixtureData[f.id]={homeScore:null,awayScore:null,homeLineup:Array(11).fill(''),awayLineup:Array(11).fill(''),homeSubs:[],awaySubs:[],events:[],stats:{}};
    return db[team].fixtureData[f.id];
  }

  function applySharedMatch(f,match,row){
    const d=row.details||{},st=row.stats||{},lineups=row.lineups||[],subs=row.substitutions||[],events=row.events||[];
    const homeStarters=lineups.filter(x=>x.team_name===f.home&&x.is_starter).sort((a,b)=>(Number(a.pitch_slot)||99)-(Number(b.pitch_slot)||99)).map(x=>x.player_name);
    const awayStarters=lineups.filter(x=>x.team_name===f.away&&x.is_starter).sort((a,b)=>(Number(a.pitch_slot)||99)-(Number(b.pitch_slot)||99)).map(x=>x.player_name);
    const mapSubs=team=>subs.filter(x=>x.team_name===team).map(x=>({out:x.player_out,in:x.player_in,outMin:Number(x.minute)||0,inMin:Number(x.minute)||0}));
    const mappedEvents=events.map(x=>({type:x.event_type==='yellow_card'?'yellow':x.event_type==='red_card'?'red':'goal',player:`${x.team_name}|||${x.player_name}`,assist:x.related_player_name?`${x.team_name}|||${x.related_player_name}`:'',minute:Number(x.minute)||0}));
    [f.home,f.away].forEach(team=>{
      const s=ensureFixtureRecord(team,f); if(!s)return;
      s.homeScore=match.home_score;s.awayScore=match.away_score;
      s.homeLineup=[...homeStarters,...Array(Math.max(0,11-homeStarters.length)).fill('')].slice(0,11);
      s.awayLineup=[...awayStarters,...Array(Math.max(0,11-awayStarters.length)).fill('')].slice(0,11);
      s.homeSubs=mapSubs(f.home);s.awaySubs=mapSubs(f.away);s.events=mappedEvents;
      s.manOfTheMatch=d.man_of_the_match?`${d.man_of_the_match===null?'':((lineups.find(x=>x.player_name===d.man_of_the_match)||{}).team_name||'')}|||${d.man_of_the_match}`:'';
      s.matchDetails=Object.assign({},s.matchDetails||{},{referee:d.referee||'',venue:d.venue||'',attendance:d.attendance??'',halftimeHomeScore:d.halftime_home_score??'',halftimeAwayScore:d.halftime_away_score??'',addedTime:d.added_time??0});
      s.stats=Object.assign({},s.stats||{},{
        possession:{h:Number(st.home_possession)||0,a:Number(st.away_possession)||0},shots:{h:Number(st.home_shots)||0,a:Number(st.away_shots)||0},
        sot:{h:Number(st.home_shots_on_target)||0,a:Number(st.away_shots_on_target)||0},corners:{h:Number(st.home_corners)||0,a:Number(st.away_corners)||0},
        cornerGoals:{h:Number(st.home_corner_goals)||0,a:Number(st.away_corner_goals)||0},fouls:{h:Number(st.home_fouls)||0,a:Number(st.away_fouls)||0},
        offsides:{h:Number(st.home_offsides)||0,a:Number(st.away_offsides)||0},saves:{h:Number(st.home_saves)||0,a:Number(st.away_saves)||0}
      });
    });
    f.homeScore=match.home_score;f.awayScore=match.away_score;
  }

  async function hydrateFromSupabase(){
    const client=window.nl4Supabase,api=rr();
    if(!client||!api||typeof ALL_FIXTURES==='undefined'||typeof db==='undefined') return {available:false};
    const matches=await client.from('premier_league_matches').select('id,matchday,home_team,away_team,home_score,away_score,status').eq('season',SEASON).eq('status','fulltime').not('home_score','is',null).not('away_score','is',null);
    if(matches.error)return {available:false,error:matches.error};
    let imported=0;
    for(const match of matches.data||[]){
      const f=ALL_FIXTURES.find(x=>x.home===match.home_team&&x.away===match.away_team&&Number(x.mw)===Number(match.matchday));
      if(!f)continue;
      const loaded=await api.loadMatch(match.id);
      if(!loaded.available)continue;
      applySharedMatch(f,match,loaded.data||{});imported++;
    }
    const players=await api.loadPlayers(SEASON);
    if(players.available&&players.data?.length)importPlayers(players.data);
    try{if(typeof TEAMS!=='undefined'&&typeof recalculateClubStatsFromFixtures==='function')TEAMS.forEach(team=>recalculateClubStatsFromFixtures(team));}catch(e){console.warn(e);}
    try{if(typeof persist==='function')persist();if(typeof render==='function')render();}catch(e){console.warn(e);}
    console.log(`[NL4 Record Room] Hydrated ${imported} completed matches from shared Supabase.`);
    return {available:true,imported};
  }

  function addPushButton(){
    const actions=document.querySelector('.admin-record-actions');
    if(!actions||document.getElementById('rrPushSupabase')) return;
    const b=document.createElement('button');
    b.id='rrPushSupabase';b.type='button';b.textContent='PUSH LOCAL TO SUPABASE';
    b.title='Uploads the current browser Record Room data to the shared Supabase tables.';
    b.style.borderColor='rgba(73,209,125,.55)';b.style.color='#49d17d';
    b.addEventListener('click',async()=>{
      if(b.disabled)return;b.disabled=true;b.textContent='PUSHING TO SUPABASE…';
      try{const result=await pushAllCurrent();if(result.available)b.textContent=`SUPABASE SAVED • ${result.saved} MATCHES`;else if(result.error){b.textContent='SUPABASE NOT READY • RETRY';console.warn('[NL4 Record Room] Push unavailable:',result.error);}else b.textContent=`PUSH PARTIAL • ${result.saved||0} SAVED / ${result.failed||0} FAILED`;}
      catch(error){console.warn('[NL4 Record Room] Full push failed:',error);b.textContent='PUSH FAILED • RETRY';}
      finally{setTimeout(()=>{b.disabled=false;b.textContent='PUSH LOCAL TO SUPABASE';},5000);}
    });
    actions.insertBefore(b,document.getElementById('recordRoomLogout')||null);
  }

  addPushButton();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addPushButton,{once:true});

  async function boot(){
    addPushButton();
    for(let i=0;i<40&&!rr();i++) await wait(100);
    addPushButton();
    if(!rr()) return;
    const ready=await rr().probe(); if(!ready.available) return;
    if(!hasMeaningfulLocalData()) await hydrateFromSupabase();
    else console.log('[NL4 Record Room] Kept populated local state; shared hydration skipped.');
    document.getElementById('savePlayer')?.addEventListener('click',()=>setTimeout(mirrorPlayers,0));
    document.addEventListener('click',e=>{if(e.target?.closest?.('.detail-save'))setTimeout(mirrorOpenFixture,140);});
    window.NL4RecordRoomPushAll=pushAllCurrent;window.NL4RecordRoomHydrate=hydrateFromSupabase;
    console.log('[NL4 Record Room] Supabase bridge active');
  }
  boot().catch(err=>console.warn('[NL4 Record Room] Bridge fallback:',err));
})();