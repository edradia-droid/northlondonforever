/* NL4 Record Room • visible bulk shared hydration v2 */
(function(){
  'use strict';
  if(window.__NL4_RR_SHARED_HYDRATE_V2__) return;
  window.__NL4_RR_SHARED_HYDRATE_V2__=true;
  const SEASON='2026/27';
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const norm=v=>String(v||'').trim();
  let running=false,lastRun=0;

  function status(text,ok=false){
    let el=document.getElementById('rrSharedSyncStatus');
    if(!el){
      el=document.createElement('span');
      el.id='rrSharedSyncStatus';
      el.style.cssText='display:inline-flex;align-items:center;min-height:34px;padding:6px 10px;border:1px solid rgba(255,255,255,.22);border-radius:8px;font-size:12px;font-weight:800;letter-spacing:.02em;white-space:nowrap';
      const host=document.querySelector('.admin-record-actions')||document.querySelector('.admin-bar')||document.querySelector('header')||document.body;
      host.appendChild(el);
    }
    el.textContent=text;
    el.style.color=ok?'#49d17d':'#ffb347';
  }

  function fixtureRecord(team,f){
    if(!db?.[team]) return null;
    db[team].fixtureData=db[team].fixtureData||{};
    let s=db[team].fixtureData[f.id];
    if(!s&&typeof fixtureStore==='function') s=fixtureStore(team,f.id);
    if(!s){
      s={homeScore:null,awayScore:null,homeLineup:Array(11).fill(''),awayLineup:Array(11).fill(''),homeSubs:[],awaySubs:[],events:[],manOfTheMatch:'',matchDetails:{},stats:{}};
      db[team].fixtureData[f.id]=s;
    }
    return s;
  }

  function applyPlayers(rows){
    (rows||[]).forEach(r=>{
      const club=db?.[r.club]; if(!club)return;
      const p=(club.players||[]).find(x=>norm(x.name).toLowerCase()===norm(r.player_name).toLowerCase());
      if(!p)return;
      Object.assign(p,{appearances:Number(r.appearances)||0,starts:Number(r.starts)||0,minutes:Number(r.minutes)||0,goals:Number(r.goals)||0,assists:Number(r.assists)||0,cleanSheets:Number(r.clean_sheets)||0,yellowCards:Number(r.yellow_cards)||0,redCards:Number(r.red_cards)||0,mom:Number(r.man_of_the_match)||0,shots:Number(r.shots)||0,shotsOnTarget:Number(r.shots_on_target)||0,chancesCreated:Number(r.chances_created)||0,tackles:Number(r.tackles)||0,interceptions:Number(r.interceptions)||0,saves:Number(r.saves)||0});
    });
  }

  function byMatch(rows){
    const m=new Map();
    (rows||[]).forEach(r=>{const a=m.get(r.match_id)||[];a.push(r);m.set(r.match_id,a);});
    return m;
  }

  async function hydrate(force=true){
    if(running)return {available:false,busy:true};
    running=true;
    try{
      for(let i=0;i<80&&(typeof ALL_FIXTURES==='undefined'||typeof db==='undefined'||!window.nl4Supabase);i++) await wait(100);
      if(typeof ALL_FIXTURES==='undefined'||typeof db==='undefined'||!window.nl4Supabase){status('SHARED SYNC • PAGE NOT READY');return {available:false};}
      status('SHARED SYNC • LOADING…');
      const c=window.nl4Supabase;
      const session=await c.auth.getSession();
      if(session.error||!session.data?.session){status('SHARED SYNC • ADMIN LOGIN REQUIRED');return {available:false,error:session.error||new Error('No Supabase session')};}
      const admin=await c.from('admins').select('user_id').eq('user_id',session.data.session.user.id).maybeSingle();
      if(admin.error||!admin.data){status('SHARED SYNC • ADMIN ACCESS REQUIRED');return {available:false,error:admin.error||new Error('Not admin')};}

      const [matches,details,stats,lineups,subs,events,players]=await Promise.all([
        c.from('premier_league_matches').select('id,matchday,home_team,away_team,home_score,away_score,status').eq('season',SEASON).eq('status','fulltime').not('home_score','is',null).not('away_score','is',null),
        c.from('record_room_match_details').select('*'),
        c.from('record_room_match_stats').select('*'),
        c.from('record_room_lineups').select('*'),
        c.from('record_room_substitutions').select('*'),
        c.from('record_room_events').select('*'),
        c.from('record_room_players').select('*').eq('season',SEASON)
      ]);
      const failed=[matches,details,stats,lineups,subs,events,players].find(x=>x.error);
      if(failed){console.warn('[NL4 Record Room] Bulk hydration failed:',failed.error);status('SHARED SYNC • READ FAILED');return {available:false,error:failed.error};}

      const dMap=new Map((details.data||[]).map(x=>[x.match_id,x]));
      const sMap=new Map((stats.data||[]).map(x=>[x.match_id,x]));
      const lMap=byMatch(lineups.data),subMap=byMatch(subs.data),eMap=byMatch(events.data);
      let imported=0;
      (matches.data||[]).forEach(match=>{
        const f=ALL_FIXTURES.find(x=>x.home===match.home_team&&x.away===match.away_team&&Number(x.mw)===Number(match.matchday));
        if(!f)return;
        const d=dMap.get(match.id)||{},st=sMap.get(match.id)||{},ls=lMap.get(match.id)||[],ss=subMap.get(match.id)||[],es=eMap.get(match.id)||[];
        const homeXI=ls.filter(x=>x.team_name===f.home&&x.is_starter).sort((a,b)=>(Number(a.pitch_slot)||99)-(Number(b.pitch_slot)||99)).map(x=>x.player_name);
        const awayXI=ls.filter(x=>x.team_name===f.away&&x.is_starter).sort((a,b)=>(Number(a.pitch_slot)||99)-(Number(b.pitch_slot)||99)).map(x=>x.player_name);
        const mapSubs=team=>ss.filter(x=>x.team_name===team).map(x=>({out:x.player_out,in:x.player_in,outMin:Number(x.minute)||0,inMin:Number(x.minute)||0}));
        const mappedEvents=es.map(x=>({type:x.event_type==='yellow_card'?'yellow':x.event_type==='red_card'?'red':'goal',player:`${x.team_name}|||${x.player_name}`,assist:x.related_player_name?`${x.team_name}|||${x.related_player_name}`:'',minute:Number(x.minute)||0}));
        const motmTeam=d.man_of_the_match?((ls.find(x=>norm(x.player_name).toLowerCase()===norm(d.man_of_the_match).toLowerCase())||{}).team_name||''):'';
        [f.home,f.away].forEach(team=>{
          const r=fixtureRecord(team,f);if(!r)return;
          r.homeScore=Number(match.home_score);r.awayScore=Number(match.away_score);
          r.homeLineup=[...homeXI,...Array(Math.max(0,11-homeXI.length)).fill('')].slice(0,11);
          r.awayLineup=[...awayXI,...Array(Math.max(0,11-awayXI.length)).fill('')].slice(0,11);
          r.homeSubs=mapSubs(f.home);r.awaySubs=mapSubs(f.away);r.events=mappedEvents;
          r.manOfTheMatch=d.man_of_the_match?`${motmTeam}|||${d.man_of_the_match}`:'';
          r.matchDetails=Object.assign({},r.matchDetails||{},{referee:d.referee||'',venue:d.venue||'',attendance:d.attendance??'',halftimeHomeScore:d.halftime_home_score??'',halftimeAwayScore:d.halftime_away_score??'',addedTime:d.added_time??0});
          r.stats=Object.assign({},r.stats||{},{possession:{h:Number(st.home_possession)||0,a:Number(st.away_possession)||0},shots:{h:Number(st.home_shots)||0,a:Number(st.away_shots)||0},sot:{h:Number(st.home_shots_on_target)||0,a:Number(st.away_shots_on_target)||0},corners:{h:Number(st.home_corners)||0,a:Number(st.away_corners)||0},cornerGoals:{h:Number(st.home_corner_goals)||0,a:Number(st.away_corner_goals)||0},fouls:{h:Number(st.home_fouls)||0,a:Number(st.away_fouls)||0},offsides:{h:Number(st.home_offsides)||0,a:Number(st.away_offsides)||0},saves:{h:Number(st.home_saves)||0,a:Number(st.away_saves)||0}});
        });
        f.homeScore=Number(match.home_score);f.awayScore=Number(match.away_score);imported++;
      });
      applyPlayers(players.data||[]);
      try{if(typeof TEAMS!=='undefined'&&typeof recalculateClubStatsFromFixtures==='function')TEAMS.forEach(t=>recalculateClubStatsFromFixtures(t));}catch(e){console.warn(e);}
      try{if(typeof persist==='function')persist();if(typeof render==='function')render();}catch(e){console.warn(e);}
      lastRun=Date.now();
      status(`SHARED SYNC • ${imported} MATCHES LOADED`,true);
      console.log(`[NL4 Record Room] Bulk shared hydration loaded ${imported} matches.`);
      return {available:true,imported};
    }finally{running=false;}
  }

  function refreshShared(){if(Date.now()-lastRun<1500)return;setTimeout(()=>hydrate(true),150);}
  window.NL4RecordRoomBulkHydrate=hydrate;
  const start=()=>setTimeout(()=>hydrate(true),500);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.addEventListener('pageshow',refreshShared);
  window.addEventListener('focus',refreshShared);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshShared();});
})();