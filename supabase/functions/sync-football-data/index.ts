import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
import { corsHeaders } from 'npm:@supabase/supabase-js@2.112.3/cors';

const BSD='https://sports.bzzoiro.com/api/v2';
const BSD_LEGACY='https://sports.bzzoiro.com/api';
const LEAGUE_ID=1;
const SEASON_ID=1058;
const SEASON='2026/27';

function serverKey(){
  const raw=Deno.env.get('SUPABASE_SECRET_KEYS');
  if(raw){ try{ const p=JSON.parse(raw); if(p?.default) return p.default; }catch{} }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
}
function json(x:any,s=200){ return new Response(JSON.stringify(x),{status:s,headers:{...corsHeaders,'Content-Type':'application/json'}}); }
async function bsdLegacy(path:string,key:string){const r=await fetch(BSD_LEGACY+path,{headers:{Authorization:'Token '+key,Accept:'application/json'}});const txt=await r.text();let body:any;try{body=JSON.parse(txt)}catch{throw new Error('BSD returned non-JSON '+r.status)}if(!r.ok)throw new Error('BSD '+r.status+': '+JSON.stringify(body));return body;}
async function bsd(path:string,key:string){
  const r=await fetch(BSD+path,{headers:{Authorization:'Token '+key,Accept:'application/json'}});
  const txt=await r.text();
  let body:any; try{body=JSON.parse(txt)}catch{throw new Error('BSD returned non-JSON '+r.status)}
  if(!r.ok) throw new Error('BSD '+r.status+': '+JSON.stringify(body));
  return body;
}
// v155: BSD historical standings may be returned in `standings`.
const arr=(x:any)=>Array.isArray(x)?x:(x?.standings??x?.results??x?.events??x?.players??x?.data??x?.incidents??[]);
function seasonItems(x:any){
  if(Array.isArray(x)) return x;
  const candidates=[x?.seasons,x?.results?.seasons,x?.data?.seasons,x?.league?.seasons,x?.data,x?.results];
  for(const c of candidates) if(Array.isArray(c)) return c;
  return [];
}
const nm=(x:any)=>typeof x==='string'?x:(x?.name??x?.short_name??null);
const id=(x:any)=>x?.id??x?.event_id??x?.fixture_id??null;
const num=(x:any)=>x==null||x===''?null:Number(x);
function canonicalPlayerName(x:any){
 const s=String(x??'').trim();
 const k=s.toLowerCase();
 if(['martín zubimendi ibáñez','martin zubimendi ibanez','martín zubimendi','martin zubimendi','m. zubimendi'].includes(k)) return 'Martín Zubimendi';
 if(['m. ødegaard','m. odegaard','martin odegaard'].includes(k)) return 'Martin Ødegaard';
 if(['b. saka','bukayo saka'].includes(k)) return 'Bukayo Saka';
 if(['k. havertz','kai havertz'].includes(k)) return 'Kai Havertz';
 if(['r. calafiori','riccardo calafiori'].includes(k)) return 'Riccardo Calafiori';
 if(['d. rice','declan rice'].includes(k)) return 'Declan Rice';
 if(['b. guimaraes','bruno guimarães','bruno guimaraes'].includes(k)) return 'Bruno Guimarães';
 if(['g. magalhães','gabriel magalhães','gabriel'].includes(k)) return 'Gabriel Magalhães';
 if(['c. tzolis','christos tzolis'].includes(k)) return 'Christos Tzolis';
 return s;
}

async function syncHistoricalStandings(db:any,key:string){const seasonBody=await bsd('/leagues/'+LEAGUE_ID+'/seasons/',key),seasons=seasonItems(seasonBody).map((s:any)=>({s,start:Number(s?.start_year??s?.year??s?.season_year??0)})).filter((x:any)=>x.start>0).sort((a:any,b:any)=>b.start-a.start).slice(0,15).map((x:any)=>x.s),results:any[]=[];for(const s of seasons){const start=s?.start_year??s?.year??s?.season_year,label=start!=null?String(start)+'/'+String(Number(start)+1).slice(-2):String(s?.name??s?.season_name??''),seasonId=s?.id??s?.season_id;if(!label||!seasonId)continue;try{const rows=arr(await bsd('/leagues/'+LEAGUE_ID+'/standings/?season_id='+encodeURIComponent(seasonId),key)).map((x:any)=>({position:num(x?.position??x?.rank??x?.place),club:nm(x?.team??x?.club??null)??x?.team_name??x?.club_name??x?.name??null,played:num(x?.played??x?.matches_played??x?.games_played),wins:num(x?.wins??x?.won),draws:num(x?.draws),losses:num(x?.losses??x?.lost),goals_for:num(x?.goals_for??x?.gf??x?.goals_scored),goals_against:num(x?.goals_against??x?.ga??x?.goals_conceded),goal_difference:num(x?.goal_difference??x?.gd),points:num(x?.points??x?.pts)})).filter((x:any)=>x.position!=null&&x.club);const positions=new Set(rows.map((x:any)=>Number(x.position))),clubs=new Set(rows.map((x:any)=>String(x.club).trim().toLowerCase()));if(rows.length!==20||positions.size!==20||clubs.size!==20||[...positions].some((p:any)=>p<1||p>20))throw new Error('invalid BSD table');const old=await db.from('premier_league_standings').select('id,club').eq('season',label);if(old.error)throw old.error;if((old.data??[]).length){for(let i=0;i<(old.data??[]).length;i++){const b=await db.from('premier_league_standings').update({position:1000+i}).eq('id',(old.data??[])[i].id);if(b.error)throw b.error;}}const byClub=new Map((old.data??[]).map((x:any)=>[String(x.club).trim().toLowerCase(),x.id])),kept=new Set<string>();for(const row of rows){const data:any={season:label,position:Number(row.position),club:String(row.club).trim(),played:row.played??0,wins:row.wins??0,draws:row.draws??0,losses:row.losses??0,goals_for:row.goals_for??0,goals_against:row.goals_against??0,goal_difference:row.goal_difference??0,points:row.points??0,updated_at:new Date().toISOString()},existingId=byClub.get(data.club.toLowerCase());if(existingId){const u=await db.from('premier_league_standings').update(data).eq('id',existingId);if(u.error)throw u.error;kept.add(String(existingId));}else{const u=await db.from('premier_league_standings').insert(data).select('id').single();if(u.error)throw u.error;kept.add(String(u.data.id));}}for(const row of(old.data??[]))if(!kept.has(String(row.id))){const d=await db.from('premier_league_standings').delete().eq('id',row.id);if(d.error)throw d.error;}const arsenal=rows.find((x:any)=>/^arsenal(?: fc)?$/i.test(String(x.club).trim()));if(!arsenal)throw new Error('validated BSD table does not contain Arsenal for '+label);results.push({season:label,rows:rows.length,arsenalPosition:arsenal.position});}catch(e){results.push({season:label,error:String(e)});}}return results;}

async function syncRootPlayerStats(db:any,arsenalId:any,key:string){
  const squadBody=await bsd(`/teams/${arsenalId}/squad/`,key),squad=arr(squadBody);
  const players=squad.map((q:any)=>{const p=q?.player??q;return{id:p?.id??q?.player_id,name:canonicalPlayerName(nm(p)??q?.player_name??q?.name),position:p?.position??q?.position??null,image_url:p?.image_url??q?.image_url??null,profile_url:p?.profile_url??q?.profile_url??null};}).filter((p:any)=>p.id&&p.name);
  if(players.length<15)return 0;
  const existing=await db.from('premier_league_player_stats').select('player_name,position,image_url,profile_url,appearances,starts,minutes,clean_sheets').eq('season',SEASON);if(existing.error)throw existing.error;
  const metaRows=existing.data??[];
  const normName=(v:any)=>String(v??'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[øØ]/g,'o').replace(/[^a-z0-9]+/gi,' ').trim().toLowerCase();
  const identityMatch=(a:any,b:any)=>{
    const aa=normName(a).split(' ').filter(Boolean),bb=normName(b).split(' ').filter(Boolean);
    if(!aa.length||!bb.length)return false;
    if(aa.join(' ')===bb.join(' '))return true;
    const surname=aa[aa.length-1]===bb[bb.length-1],overlap=aa.filter(x=>bb.includes(x)).length;
    return surname&&(aa[0]===bb[0]||overlap>=2);
  };
  const metaFor=(name:any)=>metaRows.find((r:any)=>identityMatch(name,r.player_name))??null;
  const n=(...xs:any[])=>{for(const x of xs){const v=num(x);if(v!==null&&!Number.isNaN(v))return v}return 0};
  const keyOf=(s:any)=>normName(s);
  const completedForStats=await db.from('fixtures').select('external_fixture_id').eq('season',SEASON).eq('competition','Premier League').eq('status','fulltime').or('home_team.eq.Arsenal,away_team.eq.Arsenal').like('external_fixture_id','bsd:%');
  if(completedForStats.error)throw completedForStats.error;
  const canonicalEventIds=new Set((completedForStats.data??[]).map((r:any)=>String(r.external_fixture_id).replace(/^bsd:/,'')));
  const byPlayer=new Map<string,any>();
  for(const p of players){
    const rows=arr(await bsd(`/players/${p.id}/stats/?season_id=${SEASON_ID}&league_id=${LEAGUE_ID}&team_id=${arsenalId}&limit=200&offset=0`,key));
    const existingMeta=metaFor(p.name);
    const a:any={player_name:p.name,position:p.position,image_url:p.image_url,profile_url:p.profile_url,
      appearances:0,starts:0,minutes:0,
      goals:0,assists:0,clean_sheets:Number(existingMeta?.clean_sheets??0),yellow_cards:0,red_cards:0,man_of_the_match:0,shots:0,shots_on_target:0,chances_created:0,tackles:0,interceptions:0,saves:0};
    const seen=new Set<string>();
    for(const r of rows){
      const st=r?.stats??r?.statistics??r?.player_stats??r,eid=r?.event?.id??r?.event_id??r?.match_id??r?.fixture_id??null;
      // Ignore aggregate/team rows; only match-level BSD rows can contribute to PL player stats.
      if(eid==null) continue;
      const ek=String(eid);
      if(!canonicalEventIds.has(ek)) continue;
      if(seen.has(ek))continue;
      seen.add(ek);
      // Participation is NOT derived from BSD player-stat rows here.
      // It is reconciled later from confirmed match lineups so bench/aggregate rows
      // cannot create false appearances, starts or minutes.
      a.goals+=n(st?.goals,r?.goals);a.assists+=n(st?.goal_assist,st?.goal_assists,st?.assists,r?.goal_assist,r?.goal_assists,r?.assists);
      // Clean sheets are derived exclusively by syncCleanSheetsV2 from completed
      // Arsenal fixtures + confirmed lineups. BSD player-stat clean_sheets values
      // are intentionally NOT accumulated here, because they can represent a
      // different aggregation scope and can reset/contaminate the season total.
      a.yellow_cards+=n(st?.yellow_cards,st?.yellow,r?.yellow_cards);a.red_cards+=n(st?.red_cards,st?.red,r?.red_cards);
      a.man_of_the_match+=n(st?.man_of_the_match,st?.motm,r?.man_of_the_match,r?.motm);a.shots+=n(st?.shots,r?.shots);a.shots_on_target+=n(st?.shots_on_target,st?.sot,r?.shots_on_target);
      a.chances_created+=n(st?.chances_created,st?.key_passes,r?.chances_created);a.tackles+=n(st?.tackles,st?.tackles_won,r?.tackles);a.interceptions+=n(st?.interceptions,r?.interceptions);a.saves+=n(st?.saves,r?.saves);
    }
    // Do not derive appearances/starts/minutes from BSD player-stat logs.
    // Confirmed lineups are the sole source for participation reconciliation.
    byPlayer.set(keyOf(p.name),a);
  }
  const active=[...byPlayer.values()].filter((a:any)=>Number(a.appearances||0)>0);
  const completed=await db.from('fixtures').select('home_team,away_team,home_score,away_score').eq('season',SEASON).eq('competition','Premier League').eq('status','fulltime').or('home_team.eq.Arsenal,away_team.eq.Arsenal');if(completed.error)throw completed.error;
  const rows=completed.data??[],expectedGoals=rows.reduce((s:number,r:any)=>s+(String(r.home_team)==='Arsenal'?Number(r.home_score||0):Number(r.away_score||0)),0),rootGoals=[...byPlayer.values()].reduce((s:number,a:any)=>s+Number(a.goals||0),0),rootAssists=[...byPlayer.values()].reduce((s:number,a:any)=>s+Number(a.assists||0),0);
  // Guard the statistical feed itself, but never use player-stat minutes to validate participation.
  if(active.length<10||rootGoals>expectedGoals||rootAssists>rootGoals)return 0;
  const outRows:any[]=[],rrRows:any[]=[];
  for(const a of byPlayer.values()){const m=metaFor(a.player_name);outRows.push({...a,season:SEASON,position:a.position??m?.position??null,image_url:a.image_url??m?.image_url??null,profile_url:a.profile_url??m?.profile_url??null,updated_at:new Date().toISOString()});rrRows.push({season:SEASON,club:'Arsenal',player_name:a.player_name,position:a.position??m?.position??null,appearances:a.appearances,starts:a.starts,minutes:a.minutes,goals:a.goals,assists:a.assists,clean_sheets:a.clean_sheets,yellow_cards:a.yellow_cards,red_cards:a.red_cards,man_of_the_match:a.man_of_the_match,shots:a.shots,shots_on_target:a.shots_on_target,chances_created:a.chances_created,tackles:a.tackles,interceptions:a.interceptions,saves:a.saves,updated_at:new Date().toISOString()});}
  const up=await db.from('premier_league_player_stats').upsert(outRows,{onConflict:'season,player_name'});if(up.error)throw up.error;
  const ur=await db.from('record_room_players').upsert(rrRows,{onConflict:'season,club,player_name'});if(ur.error)throw ur.error;
  const keep=new Set([...byPlayer.values()].map((a:any)=>keyOf(a.player_name)));
  for(const table of ['premier_league_player_stats','record_room_players']){
    let q=db.from(table).select('player_name').eq('season',SEASON);if(table==='record_room_players')q=q.eq('club','Arsenal');const old=await q;if(old.error)throw old.error;
    for(const r of(old.data??[]).filter((r:any)=>!keep.has(keyOf(r.player_name)))){let d=db.from(table).delete().eq('season',SEASON).eq('player_name',r.player_name);if(table==='record_room_players')d=d.eq('club','Arsenal');const dr=await d;if(dr.error)throw dr.error;}
  }
  return outRows.length;
}

async function syncArsenalLineups(db:any,eventRows:any[],key:string,includeSpatial=false){const completed=eventRows.filter((e:any)=>{const home=nm(e?.home_team??e?.home??e?.teams?.home),away=nm(e?.away_team??e?.away??e?.teams?.away);const hs=num(e?.home_score??e?.score?.home??e?.scores?.home),as=num(e?.away_score??e?.score?.away??e?.scores?.away);return home&&away&&(home==='Arsenal'||away==='Arsenal')&&hs!==null&&as!==null});let synced=0,rejected=0;for(const e of completed){const eid=String(id(e));const fx=await db.from('fixtures').select('id,home_team,away_team,lineup_formation').eq('external_fixture_id','bsd:'+eid).maybeSingle();if(fx.error)throw fx.error;if(!fx.data?.id)continue;const lineupKey=key;
      let body:any=null;
      for(const path of ['/events/'+eid+'/lineups/','/matches/'+eid+'/lineups/','/fixtures/'+eid+'/lineups/']){
        try{body=await bsd(path,lineupKey);break;}catch{}
      }
      if(!body){try{body=await bsdLegacy('/events/'+eid+'/lineups/',lineupKey);}catch{}}
      if(!body)continue;const root=body?.data??body;const findFormation=(x:any,d=0):string|null=>{if(x==null||d>4)return null;if(typeof x==='string'){const s=x.trim();return /^\\d-\\d(?:-\\d){1,3}$/.test(s)?s:null;}if(Array.isArray(x)){for(const v of x){const f=findFormation(v,d+1);if(f)return f;}return null;}if(typeof x!=='object')return null;for(const k of ['formation','lineup_formation','tactical_formation','formations','home_formation','away_formation','tactics','tactical']){if(x[k]!=null){const f=findFormation(x[k],d+1);if(f)return f;}}for(const k of Object.keys(x)){const f=findFormation(x[k],d+1);if(f)return f;}return null;};let globalFormation=findFormation(root)??fx.data.lineup_formation??null;if(!globalFormation){try{const detail=await bsd('/events/'+eid+'/',key);globalFormation=findFormation(detail?.data??detail);}catch{}}const lineups=root?.lineups??root;
      const sideRows=(side:any)=>{
        const formation=side?.formation??side?.lineup_formation??side?.tactical_formation??side?.team?.formation??globalFormation??null;
        if(Array.isArray(side?.players)){
          const starters=side.players.map((x:any)=>({...x,__lineupStarter:true}));
          const bench=Array.isArray(side?.substitutes)?side.substitutes.map((x:any)=>({...x,__lineupStarter:false})):[];
          return {rows:[...starters,...bench],implicitStarter:false,formation};
        }
        for(const k of ['lineup','bench','substitutes','starting_xi','startingXI','starting_lineup','starters','starting']){
          if(Array.isArray(side?.[k])) return {rows:side[k],implicitStarter:k==='starting_xi'||k==='startingXI'||k==='starting_lineup'||k==='starters'||k==='starting',formation};
        }
        return {rows:arr(side),implicitStarter:false,formation};
      };
      const parse=(pack:any,team:string,playerProfiles:Map<string,any>)=>pack.rows.map((p:any,index:number)=>{
        const pl=p?.player??p?.player_obj??p;
        const playerId=String(pl?.id??p?.player_id??p?.id??'');
        const profile=playerProfiles.get(playerId)??null;
        const name=nm(pl)??p?.player_name??p?.name;
        const explicit=p?.__lineupStarter??p?.is_starter??p?.starter??p?.starting??p?.start??p?.isStarting??p?.starting_player;
        const starter=explicit==null?Boolean(pack.implicitStarter):Boolean(explicit);
        const on=num(p?.minute_on??p?.minute_in??p?.sub_in??p?.substituted_in_minute??p?.entry_minute??p?.statistics?.minute_on);
        const off=num(p?.minute_off??p?.minute_out??p?.sub_out??p?.substituted_out_minute??p?.exit_minute??p?.statistics?.minute_off);
        const rawTacticalPosition =
          p?.pitch_slot ??
          p?.lineup_position ??
          p?.position_detail ??
          p?.position_code ??
          p?.role ??
          p?.tactical_position ??
          p?.statistics?.position ??
          p?.statistics?.position_detail ??
          p?.statistics?.position_code ??
          p?.statistics?.role ??
          profile?.position ??
          profile?.position_code ??
          profile?.role ??
          p?.position ??
          p?.pos ??
          pl?.pitch_slot ??
          pl?.lineup_position ??
          pl?.position_detail ??
          pl?.position_code ??
          pl?.role ??
          pl?.position ??
          pl?.pos ??
          null;
        const BSD_FORMATION_ORDERS:any={'4-2-3-1':['GK','RB','RCB','LCB','LB','RDM','LDM','RW','CAM','LW','ST'],'4-3-3':['GK','RB','RCB','LCB','LB','RCM','CM','LCM','RW','ST','LW'],'4-4-2':['GK','RB','RCB','LCB','LB','RM','RCM','LCM','LM','RST','LST'],'4-1-4-1':['GK','RB','RCB','LCB','LB','DM','RM','RCM','LCM','LM','ST'],'4-5-1':['GK','RB','RCB','LCB','LB','RM','RDM','CAM','LDM','LM','ST'],'3-4-3':['GK','RCB','CB','LCB','RWB','RCM','LCM','LWB','RW','ST','LW'],'3-5-2':['GK','RCB','CB','LCB','RWB','RCM','CM','LCM','LWB','RST','LST']};
function extractPositionCandidates(x:any):any[]{const out:any[]=[];const seen=new Set<any>();const walk=(v:any,d=0)=>{if(v==null||d>4)return;if(typeof v==='string'||typeof v==='number'){out.push(v);return;}if(typeof v!=='object'||seen.has(v))return;seen.add(v);for(const k of ['tactical_position','position_detail','position_code','position_name','preferred_position','primary_position','playing_position','role','position','positions','tactical','details'])if(v[k]!=null)walk(v[k],d+1);};walk(x);return out;}
function normalizeTacticalPosition(value:any){for(const candidate of extractPositionCandidates(value)){const v=String(candidate).trim().toUpperCase().replace(/[‐-‒–—]/g,'-').replace(/\s+/g,' ');if(['RB','RIGHT BACK','RIGHT-BACK'].includes(v))return'RB';if(['LB','LEFT BACK','LEFT-BACK'].includes(v))return'LB';if(['RWB','RIGHT WING BACK','RIGHT-WING-BACK'].includes(v))return'RWB';if(['LWB','LEFT WING BACK','LEFT-WING-BACK'].includes(v))return'LWB';if(['RCB','RIGHT CENTRE-BACK','RIGHT CENTER-BACK','RIGHT CENTRE BACK','RIGHT CENTER BACK'].includes(v))return'RCB';if(['LCB','LEFT CENTRE-BACK','LEFT CENTER-BACK','LEFT CENTRE BACK','LEFT CENTER BACK'].includes(v))return'LCB';if(['CB','CENTRE-BACK','CENTER-BACK','CENTRE BACK','CENTER BACK'].includes(v))return'CB';if(['GK','G','GOALKEEPER'].includes(v))return'GK';if(['DM','CDM','DEFENSIVE MIDFIELDER'].includes(v))return'DM';if(['LDM','LEFT DM','LEFT DEFENSIVE MIDFIELDER'].includes(v))return'LDM';if(['RDM','RIGHT DM','RIGHT DEFENSIVE MIDFIELDER'].includes(v))return'RDM';if(['LM','LEFT MIDFIELDER','LEFT MIDFIELD'].includes(v))return'LM';if(['RM','RIGHT MIDFIELDER','RIGHT MIDFIELD'].includes(v))return'RM';if(['LW','LEFT WINGER','LEFT WING'].includes(v))return'LW';if(['RW','RIGHT WINGER','RIGHT WING'].includes(v))return'RW';if(['ST','STRIKER','CENTRE FORWARD','CENTER FORWARD'].includes(v))return'ST';if(['LST','LEFT STRIKER'].includes(v))return'LST';if(['RST','RIGHT STRIKER'].includes(v))return'RST';if(['CAM','AM','ATTACKING MIDFIELDER'].includes(v))return'CAM';if(['LCM','LEFT CENTRAL MIDFIELDER'].includes(v))return'LCM';if(['RCM','RIGHT CENTRAL MIDFIELDER'].includes(v))return'RCM';if(['CM','CENTRAL MIDFIELDER','CENTRE MIDFIELDER','CENTER MIDFIELDER'].includes(v))return'CM';}return null;}
function deriveFormationSlot(formation:any,index:number){const order=BSD_FORMATION_ORDERS[String(formation??'').trim()];return order&&order[index]?order[index]:null;}
const legacyNormalizeTacticalPosition=(value:any)=>{
          const v=String(value??'').trim().toUpperCase().replace(/[‐‑‒–—]/g,'-').replace(/\s+/g,' ');
          if(['RB','RIGHT BACK','RIGHT-BACK'].includes(v)) return 'RB';
          if(['LB','LEFT BACK','LEFT-BACK'].includes(v)) return 'LB';
          if(['RWB','RIGHT WING BACK','RIGHT-WING-BACK'].includes(v)) return 'RWB';
          if(['LWB','LEFT WING BACK','LEFT-WING-BACK'].includes(v)) return 'LWB';
          if(['RCB','RIGHT CENTRE-BACK','RIGHT CENTER-BACK','RIGHT CENTRE BACK','RIGHT CENTER BACK'].includes(v)) return 'RCB';
          if(['LCB','LEFT CENTRE-BACK','LEFT CENTER-BACK','LEFT CENTRE BACK','LEFT CENTER BACK'].includes(v)) return 'LCB';
          if(['CB','CENTRE-BACK','CENTER-BACK','CENTRE BACK','CENTER BACK'].includes(v)) return 'CB';
          if(['GK','G','GOALKEEPER'].includes(v)) return 'GK';
          return null;
        };
        const tacticalPosition=normalizeTacticalPosition(rawTacticalPosition) || legacyNormalizeTacticalPosition(rawTacticalPosition);
        const pitchSlot =
          p?.pitch_slot ??
          p?.grid_position ??
          p?.grid ??
          p?.slot ??
          p?.starting_position ??
          p?.starting_slot ??
          p?.statistics?.pitch_slot ??
          p?.statistics?.grid_position ??
          p?.statistics?.grid ??
          p?.statistics?.slot ??
          pl?.pitch_slot ??
          pl?.grid_position ??
          pl?.grid ??
          pl?.slot ??
          null;
        const positionX =
          p?.position_x ?? p?.x ?? p?.coordinates?.x ?? p?.location?.x ??
          p?.statistics?.position_x ?? p?.statistics?.x ?? p?.statistics?.coordinates?.x ??
          pl?.position_x ?? pl?.x ?? pl?.coordinates?.x ?? pl?.location?.x ?? null;
        const positionY =
          p?.position_y ?? p?.y ?? p?.coordinates?.y ?? p?.location?.y ??
          p?.statistics?.position_y ?? p?.statistics?.y ?? p?.statistics?.coordinates?.y ??
          pl?.position_y ?? pl?.y ?? pl?.coordinates?.y ?? pl?.location?.y ?? null;
        const lineupFormation =
          p?.formation ?? p?.lineup_formation ?? p?.tactical_formation ??
          p?.statistics?.formation ?? p?.statistics?.lineup_formation ??
          pl?.formation ?? pl?.lineup_formation ?? null;
        const resolvedFormation=lineupFormation??pack.formation??null;
        const resolvedTacticalPosition=tacticalPosition||deriveFormationSlot(resolvedFormation,index);
        return{name,player_id:playerId,starter,on,off,position:resolvedTacticalPosition,pitch_slot:pitchSlot,position_x:positionX,position_y:positionY,formation:resolvedFormation,source_order:index,team};
      }).filter((x:any)=>x.name);
      const teamKey=(value:any)=>String(value??'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9]+/gi,' ').trim().toLowerCase();
      const hasLineupShape=(value:any)=>{
        if(!value||typeof value!=='object')return false;
        return Array.isArray(value?.players)||Array.isArray(value?.lineup)||Array.isArray(value?.starting_xi)||Array.isArray(value?.startingXI)||Array.isArray(value?.starting_lineup)||Array.isArray(value?.starters)||Array.isArray(value?.starting)||Array.isArray(value?.bench)||Array.isArray(value?.substitutes);
      };
      const sideTeamName=(value:any)=>{
        if(!value||typeof value!=='object')return '';
        return value?.team_name??value?.team?.name??value?.team?.short_name??value?.name??value?.teamName??'';
      };
      const findSide=(source:any,expected:string,label:string):any=>{
        const target=teamKey(expected);
        const seen=new Set<any>();
        const walk=(value:any,depth=0):any=>{
          if(value==null||depth>7||typeof value!=='object'||seen.has(value))return null;
          seen.add(value);
          if(Array.isArray(value)){
            for(const item of value){const found=walk(item,depth+1);if(found)return found;}
            return null;
          }
          const directKeys=[label,label+'_team',label+'Team',label+'_lineup',label+'Lineup',label+'_players',label+'Players',label+'_starting_xi',label+'StartingXI'];
          for(const key of directKeys){
            if(value[key]!=null){
              const candidate=value[key];
              if(hasLineupShape(candidate)){
                const candidateName=teamKey(sideTeamName(candidate));
                // BSD's home/away container is authoritative even when its
                // team_name uses an alias that differs from NL4's fixture name.
                // Do not discard a valid side solely because of a naming variant.
                if(!candidateName||candidateName===target)return candidate;
                if(/^(home|away|home_team|away_team|home_lineup|away_lineup|home_players|away_players|home_starting_xi|away_starting_xi)$/i.test(key)){
                  return candidate;
                }
              }
              const found=walk(candidate,depth+1);if(found)return found;
            }
          }
          const candidateName=teamKey(sideTeamName(value));
          if(candidateName===target&&hasLineupShape(value))return value;
          for(const [key,child] of Object.entries(value)){
            if(/^(home|away|home_team|away_team|home_lineup|away_lineup|home_players|away_players|home_starting_xi|away_starting_xi)$/i.test(key))continue;
            if(child&&typeof child==='object'){
              const found=walk(child,depth+1);if(found)return found;
            }
          }
          return null;
        };
        return walk(source);
      };
      let homeSide=findSide(lineups,fx.data.home_team,'home')??findSide(root,fx.data.home_team,'home');
      let awaySide=findSide(lineups,fx.data.away_team,'away')??findSide(root,fx.data.away_team,'away');
      if(!homeSide||!awaySide){
        try{
          const detailBody=await bsd('/events/'+eid+'/',lineupKey);
          const detailRoot=detailBody?.data??detailBody;
          homeSide=homeSide??findSide(detailRoot,fx.data.home_team,'home');
          awaySide=awaySide??findSide(detailRoot,fx.data.away_team,'away');
        }catch(error){
          console.log('BSD_LINEUP_DETAIL_FALLBACK_FAILED',JSON.stringify({fixture:eid,error:String(error)}));
        }
      }
      const homePack=sideRows(homeSide),awayPack=sideRows(awaySide);
      const lineupPacks=[homePack,awayPack];
      const playerIds = Array.from(new Set(lineupPacks.flatMap((pack:any) =>
        pack.rows.map((p:any) => {
          const pl=p?.player??p?.player_obj??p;
          return pl?.id??p?.player_id??p?.id??null;
        }).filter(Boolean).map((x:any)=>String(x))
      )));
      const playerProfiles=new Map<string,any>();
      await Promise.all(playerIds.map(async(pid:string)=>{
        try{
          const body=await bsd('/players/'+encodeURIComponent(pid)+'/',key);
          const profile=body?.player??body;
          if(profile) playerProfiles.set(pid,profile);
        }catch(error){
          console.log('BSD_PLAYER_PROFILE_LOOKUP_FAILED',JSON.stringify({playerId:pid,error:String(error)}));
        }
      }));
      const all=[...parse(homePack,fx.data.home_team,playerProfiles),...parse(awayPack,fx.data.away_team,playerProfiles)];
      if(includeSpatial){
      // BSD average-position data is optional and only supplements the existing
      // tactical/formation pipeline when valid player coordinates are available.
      const spatialByPlayer=new Map<string,{x:number,y:number}>();
      const spatialKey=(v:any)=>String(v??'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[øØ]/g,'o').replace(/[^a-z0-9]+/gi,' ').trim().toLowerCase();
      const collectSpatial=(value:any,path:string[]=[]):void=>{
        if(value==null)return;
        if(Array.isArray(value)){for(const item of value)collectSpatial(item,path);return;}
        if(typeof value!=='object')return;
        const branch=path.some(k=>/(average|position|positional|heatmap)/i.test(k));
        if(branch){
          const sx=num(value?.x??value?.position_x??value?.avg_x??value?.average_x);
          const sy=num(value?.y??value?.position_y??value?.avg_y??value?.average_y);
          const pobj=value?.player??value?.player_obj??value?.player_data??null;
          const pid=String(value?.player_id??value?.playerId??pobj?.id??'');
          const pname=nm(pobj)??value?.player_name??value?.playerName??value?.name??null;
          if(sx!==null&&sy!==null&&sx>=0&&sx<=100&&sy>=0&&sy<=100){
            if(pid)spatialByPlayer.set('id:'+pid,{x:sx,y:sy});
            if(pname)spatialByPlayer.set('name:'+spatialKey(pname),{x:sx,y:sy});
          }
        }
        for(const [k,v] of Object.entries(value))collectSpatial(v,[...path,k]);
      };
      try{const statsBody=await bsd('/events/'+eid+'/stats/',key);collectSpatial(statsBody?.data??statsBody);}catch(error){console.log('BSD_SPATIAL_LOOKUP_FAILED',JSON.stringify({fixture:eid,error:String(error)}));}
      for(const row of all){
        const spatial=(row.player_id?spatialByPlayer.get('id:'+String(row.player_id)):null)??spatialByPlayer.get('name:'+spatialKey(row.name));
        if(spatial&&!(Number.isFinite(Number(row.position_x))&&Number.isFinite(Number(row.position_y)))){row.position_x=spatial.x;row.position_y=spatial.y;}
      }      }
      const arsenalRows=all.filter((x:any)=>x.team==='Arsenal');const homeStarters=all.filter((x:any)=>x.team===fx.data.home_team&&x.starter).length;const awayStarters=all.filter((x:any)=>x.team===fx.data.away_team&&x.starter).length;if(arsenalRows.filter((x:any)=>x.starter).length!==11||homeStarters!==11||awayStarters!==11){console.log('BSD_LINEUP_REJECT',JSON.stringify({fixture:eid,rootKeys:Object.keys(root||{}),lineupKeys:Object.keys(lineups||{}),homeKeys:Object.keys(homeSide||{}),awayKeys:Object.keys(awaySide||{}),rows:all.length,arsenalStarters:arsenalRows.filter((x:any)=>x.starter).length,homeStarters,awayStarters}));rejected++;continue;}const effectiveFormation=globalFormation??null;
// Formation is useful metadata, but it is not a prerequisite for storing a
// valid BSD XI. BSD can publish both starting XIs while leaving formation null.
// Never fabricate a formation: preserve null and let the frontend use the
// available player/tactical position data.
if(effectiveFormation){
  const formationUpdate=await db.from('fixtures').update({lineup_formation:effectiveFormation,updated_at:new Date().toISOString()}).eq('id',fx.data.id);
  if(formationUpdate.error)throw formationUpdate.error;
}const deduped=new Map<string,any>();for(const row of all){const k=String(row.team)+'|'+canonicalPlayerName(row.name).toLowerCase();if(!deduped.has(k))deduped.set(k,row);}const cleanRows=[...deduped.values()];const starterRows=cleanRows.filter((x:any)=>x.starter);const cleanHomeStarters=cleanRows.filter((x:any)=>x.team===fx.data.home_team&&x.starter).length;const cleanAwayStarters=cleanRows.filter((x:any)=>x.team===fx.data.away_team&&x.starter).length;if(cleanHomeStarters!==11||cleanAwayStarters!==11){console.log('BSD_LINEUP_REJECT_DEDUP',JSON.stringify({fixture:eid,rows:cleanRows.length,starters:starterRows.length,cleanHomeStarters,cleanAwayStarters}));rejected++;continue;}const lineupPayload=cleanRows.map((x:any)=>({fixture_id:fx.data.id,player_name:canonicalPlayerName(x.name),position:x.position,formation:x.formation??effectiveFormation,pitch_slot:x.pitch_slot,position_x:x.position_x,position_y:x.position_y,is_starter:x.starter,minute_on:x.on??0,minute_off:x.off??null,source_order:x.source_order??null,team_name:x.team,updated_at:new Date().toISOString()}));const ins=await db.from('match_lineups').upsert(lineupPayload,{onConflict:'fixture_id,team_name,player_name'});if(ins.error)throw ins.error;const validKeys=new Set(lineupPayload.map((x:any)=>String(x.team_name)+'|'+String(x.player_name).toLowerCase()));const existingAfter=await db.from('match_lineups').select('id,team_name,player_name').eq('fixture_id',fx.data.id);if(existingAfter.error)throw existingAfter.error;for(const oldRow of(existingAfter.data??[])){const key=String(oldRow.team_name)+'|'+String(oldRow.player_name).toLowerCase();if(!validKeys.has(key)){const del=await db.from('match_lineups').delete().eq('id',oldRow.id);if(del.error)throw del.error;}}synced++;}return{lineupsSynced:synced,lineupsRejected:rejected,completedArsenalMatches:completed.length};}
async function reconcileParticipationFromLineups(db:any){const fx=await db.from('fixtures').select('id').eq('season',SEASON).eq('competition','Premier League').eq('status','fulltime').or('home_team.eq.Arsenal,away_team.eq.Arsenal');if(fx.error)throw fx.error;const ids=(fx.data??[]).map((r:any)=>String(r.id));if(!ids.length)return{participationUpdated:0,coverage:false};const lu=await db.from('match_lineups').select('id,fixture_id,player_name,is_starter,minute_on,minute_off').in('fixture_id',ids).eq('team_name','Arsenal');if(lu.error)throw lu.error;const events=await db.from('match_events').select('fixture_id,minute,player_name,related_player_name,event_type,team_name').in('fixture_id',ids).eq('event_type','substitution').eq('team_name','Arsenal');if(events.error)throw events.error;const norm=(v:any)=>String(v??'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[øØ]/g,'o').replace(/[^a-z0-9]+/gi,' ').trim().toLowerCase().split(' ').filter(Boolean);const samePlayer=(a:any,b:any)=>{const ca=norm(canonicalPlayerName(a)),cb=norm(canonicalPlayerName(b));if(ca.length&&cb.length&&ca.join(' ')===cb.join(' '))return true;const aa=norm(a),bb=norm(b);if(!aa.length||!bb.length)return false;if(aa.join(' ')===bb.join(' '))return true;if(aa.length>=2&&bb.length>=2){const surname=aa[aa.length-1]===bb[bb.length-1],initial=aa[0]===bb[0];return surname&&initial;}return false};for(const ev of(events.data??[])){const rows=(lu.data??[]).filter((r:any)=>String(r.fixture_id)===String(ev.fixture_id));for(const r of rows){if(r.is_starter){r.minute_on=0;}}const incoming=rows.find((r:any)=>samePlayer(r.player_name,ev.player_name));const outgoing=rows.find((r:any)=>samePlayer(r.player_name,ev.related_player_name));const minute=num(ev.minute);if(minute===null)continue;if(incoming){const u=await db.from('match_lineups').update({is_starter:false,minute_on:minute,updated_at:new Date().toISOString()}).eq('id',incoming.id);if(u.error)throw u.error;incoming.is_starter=false;incoming.minute_on=minute;}if(outgoing){const u=await db.from('match_lineups').update({is_starter:true,minute_off:minute,updated_at:new Date().toISOString()}).eq('id',outgoing.id);if(u.error)throw u.error;outgoing.is_starter=true;outgoing.minute_off=minute;}}const byFixture=new Map<string,any[]>();for(const r of(lu.data??[])){const k=String(r.fixture_id);if(!byFixture.has(k))byFixture.set(k,[]);byFixture.get(k)!.push(r);}if(ids.some((id:string)=>((byFixture.get(id)??[]).filter((r:any)=>r.is_starter).length!==11)))return{participationUpdated:0,coverage:false,reason:'incomplete_lineup_coverage'};const agg=new Map<string,{appearances:number,starts:number,minutes:number}>();for(const rows of byFixture.values())for(const r of rows){const on=num(r.minute_on),off=num(r.minute_off),played=Boolean(r.is_starter)||((on??0)>0);if(!played)continue;const mins=Math.max(0,(off??90)-(on??0)),key=canonicalPlayerName(r.player_name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),a=agg.get(key)??{appearances:0,starts:0,minutes:0};a.appearances++;a.starts+=r.is_starter?1:0;a.minutes+=mins;agg.set(key,a);}const existing=await db.from('premier_league_player_stats').select('player_name').eq('season',SEASON);if(existing.error)throw existing.error;let updated=0;for(const r of(existing.data??[])){const key=canonicalPlayerName(r.player_name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),a=agg.get(key)??{appearances:0,starts:0,minutes:0};const u=await db.from('premier_league_player_stats').update({...a,updated_at:new Date().toISOString()}).eq('season',SEASON).eq('player_name',r.player_name);if(u.error)throw u.error;const rr=await db.from('record_room_players').update({...a,updated_at:new Date().toISOString()}).eq('season',SEASON).eq('club','Arsenal').eq('player_name',r.player_name);if(rr.error)throw rr.error;updated++;}return{participationUpdated:updated,coverage:true};}

async function syncArsenalTeamStatsCanonical(db:any){
 const {data,error}=await db.from('fixtures').select('home_team,away_team,home_score,away_score,home_possession,away_possession,home_shots,away_shots,home_shots_on_target,away_shots_on_target,home_corners,away_corners,home_fouls,away_fouls,home_offsides,away_offsides').eq('season',SEASON).eq('competition','Premier League').eq('status','fulltime').or('home_team.eq.Arsenal,away_team.eq.Arsenal');
 if(error)throw error;if(!data?.length)throw new Error('No completed Arsenal Premier League fixtures');
 const n=(v:any)=>v==null?0:Number(v),m=data.length;
 const pick=(r:any,h:any,a:any)=>r.home_team==='Arsenal'?n(r[h]):n(r[a]);
 const avg=data.reduce((s:any,r:any)=>s+pick(r,'home_possession','away_possession'),0)/m;
 const total=(h:string,a:string)=>data.reduce((s:any,r:any)=>s+pick(r,h,a),0);
 const points=data.reduce((s:any,r:any)=>{const x=pick(r,'home_score','away_score'),y=pick(r,'away_score','home_score');return s+(x>y?3:x===y?1:0)},0);
 const u=await db.from('record_room_arsenal_team_stats').upsert({season:SEASON,matches:m,avg_possession:Number(avg.toFixed(1)),total_shots:total('home_shots','away_shots'),shots_on_target:total('home_shots_on_target','away_shots_on_target'),corners:total('home_corners','away_corners'),corner_goals:0,fouls:total('home_fouls','away_fouls'),offsides:total('home_offsides','away_offsides'),points,updated_at:new Date().toISOString()},{onConflict:'season'});
 if(u.error)throw u.error;return {matches:m,avg_possession:Number(avg.toFixed(1)),total_shots:total('home_shots','away_shots'),shots_on_target:total('home_shots_on_target','away_shots_on_target'),corners:total('home_corners','away_corners'),fouls:total('home_fouls','away_fouls'),offsides:total('home_offsides','away_offsides'),points};
}
async function syncGoalkeeperSavesV2(db:any,arsenalId:any,key:string){
 const squad=arr(await bsd(`/teams/${arsenalId}/squad/`,key));
 const gks=squad.map((q:any)=>{const p=q?.player??q;return {id:p?.id,name:nm(p)??q?.player_name,position:String(p?.position??q?.position??'').toUpperCase()}}).filter((p:any)=>p.id&&p.name&&(p.position==='GK'||p.position==='G'||p.position.includes('GOALKEEPER')));
 if(!gks.length) throw new Error('BSD v2 returned no Arsenal goalkeepers');

 // BSD may return rows from other competitions even when league_id=1 is supplied.
 // Count only events that NL4 has already classified as Premier League fixtures.
 const fx=await db.from('fixtures').select('external_fixture_id').eq('season',SEASON).eq('competition','Premier League').eq('status','fulltime').or('home_team.eq.Arsenal,away_team.eq.Arsenal').like('external_fixture_id','bsd:%');
 if(fx.error) throw fx.error;
 const plEventIds=new Set((fx.data??[]).map((r:any)=>String(r.external_fixture_id).replace(/^bsd:/,'')));
 if(!plEventIds.size) throw new Error('No canonical Premier League BSD fixtures available for goalkeeper-save reconciliation');

 const results:any[]=[];
 for(const g of gks){
  const rows=arr(await bsd(`/players/${g.id}/stats/?season_id=${SEASON_ID}&team_id=${arsenalId}&league_id=${LEAGUE_ID}&limit=200&offset=0`,key));
  const seen=new Set<string>(); let saves=0,played=0,evidence=0;
  for(const r of rows){
    const eid=r?.event?.id??r?.event_id??r?.match_id??r?.fixture_id;
    if(eid==null||seen.has(String(eid))||!plEventIds.has(String(eid))) continue;
    seen.add(String(eid));
    const mins=num(r?.minutes_played??r?.minutes??r?.mins);
    if(mins!==null&&mins>0) played++;
    const sv=num(r?.saves);
    if(sv!==null&&!Number.isNaN(sv)&&sv>=0){saves+=sv;evidence++;}
  }

  // Write zero as well, so a cup-only appearance cannot leave a stale cup save.
  const u={saves,updated_at:new Date().toISOString()};
  const a=await db.from('premier_league_player_stats').update(u).eq('season',SEASON).eq('player_name',g.name);if(a.error)throw a.error;
  const b=await db.from('record_room_players').update(u).eq('season',SEASON).eq('club','Arsenal').eq('player_name',g.name);if(b.error)throw b.error;
  results.push({player:g.name,saves,played,evidence});
 }
 return results;
}


async function syncCleanSheetsV2(db:any,arsenalId:any,key:string){
  const fx=await db.from('fixtures').select('id,home_team,away_team,home_score,away_score')
    .eq('season',SEASON).eq('competition','Premier League').eq('status','fulltime');
  if(fx.error) throw fx.error;
  const cleanFixtureIds=new Set<string>();
  for(const r of (fx.data??[])){
    const hs=num(r.home_score), as=num(r.away_score);
    if(hs===null||as===null) continue;
    if((String(r.home_team)==='Arsenal'&&as===0)||(String(r.away_team)==='Arsenal'&&hs===0)) cleanFixtureIds.add(String(r.id));
  }
  if(!cleanFixtureIds.size) throw new Error('No completed Arsenal Premier League clean-sheet fixtures available');

  const coverage=await db.from('match_lineups').select('fixture_id',{count:'exact',head:false}).in('fixture_id',[...cleanFixtureIds]).eq('team_name','Arsenal');
  if(coverage.error) throw coverage.error;
  const covered=new Set((coverage.data??[]).map((r:any)=>String(r.fixture_id)));
  if(covered.size<cleanFixtureIds.size) return {cleanSheetsUpdated:0,skipped:'incomplete_lineup_coverage'};
  const lu=await db.from('match_lineups').select('fixture_id,player_name,is_starter,minute_on,minute_off')
    .in('fixture_id',[...cleanFixtureIds]);
  if(lu.error) throw lu.error;
  const eligible=new Map<string,Set<string>>();
  for(const r of (lu.data??[])){
    const on=num(r.minute_on??0);const off=num(r.minute_off??90);if(!r.is_starter&&(on===null||on<=0)) continue;const mins=off-on;
    if(mins<60||!r.player_name) continue;
    const name=String(r.player_name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[øØ]/g,'o').toLowerCase().trim();
    if(!eligible.has(name)) eligible.set(name,new Set());
    eligible.get(name)!.add(String(r.fixture_id));
  }

  const existing=await db.from('premier_league_player_stats').select('player_name').eq('season',SEASON);
  if(existing.error) throw existing.error;
  const now=new Date().toISOString(); let updated=0; const leaders:any[]=[];
  for(const row of (existing.data??[])){
    const cs=eligible.get(String(row.player_name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[øØ]/g,'o').toLowerCase().trim())?.size??0;
    const u=await db.from('premier_league_player_stats').update({clean_sheets:cs,updated_at:now}).eq('season',SEASON).eq('player_name',row.player_name);
    if(u.error) throw u.error;
    const rr=await db.from('record_room_players').update({clean_sheets:cs,updated_at:now}).eq('season',SEASON).eq('club','Arsenal').eq('player_name',row.player_name);
    if(rr.error) throw rr.error;
    updated++; if(cs>0) leaders.push({player:row.player_name,clean_sheets:cs});
  }
  return {cleanSheetsUpdated:updated,cleanSheetLeaders:leaders};
}

async function run(reqUrl=new URL('https://local.invalid')){
  const key=Deno.env.get('BSD_API_KEY'); if(!key) throw new Error('Missing BSD_API_KEY');
  const db=createClient(Deno.env.get('SUPABASE_URL')!,serverKey(),{auth:{persistSession:false,autoRefreshToken:false}});

  const teams=arr(await bsd('/teams/?name=Arsenal&limit=20&offset=0',key));
  const arsenal=teams.find((t:any)=>nm(t)==='Arsenal'||nm(t?.team)==='Arsenal')??teams[0];
  const arsenalId=id(arsenal); if(!arsenalId) throw new Error('Could not resolve Arsenal BSD team id');
  let historicalStandings:any[]=[];if(reqUrl.searchParams.get('history')==='1')historicalStandings=await syncHistoricalStandings(db,key);
  if(reqUrl.searchParams.get('lineups_only')==='1'){
    const events=arr(await bsd(`/events/?league_id=${LEAGUE_ID}&season_id=${SEASON_ID}&team_id=${arsenalId}&limit=200&offset=0`,key));
    const requestedIds=String(reqUrl.searchParams.get('event_ids')??reqUrl.searchParams.get('event_id')??'').split(',').map((v:any)=>String(v).trim()).filter(Boolean);
    let selectedEvents:any[]=events;
    if(requestedIds.length){
      selectedEvents=[];
      for(const requestedEventId of requestedIds){
        const fromList=events.find((e:any)=>String(id(e))===requestedEventId);
        if(fromList){selectedEvents.push(fromList);continue;}
        try{
          const detail=await bsd('/events/'+encodeURIComponent(requestedEventId)+'/',key);
          const eventRoot=detail?.data??detail;
          const eventObj=Array.isArray(eventRoot)?eventRoot[0]:eventRoot;
          if(eventObj)selectedEvents.push(eventObj);
        }catch(error){
          console.log('BSD_HISTORICAL_EVENT_LOOKUP_FAILED',JSON.stringify({eventId:requestedEventId,error:String(error)}));
        }
      }
    }
    const lineupResult=await syncArsenalLineups(db,selectedEvents,key,reqUrl.searchParams.get('spatial_positions')==='1');
    const participationResult=await reconcileParticipationFromLineups(db);
    return {ok:true,lineupsOnly:true,lineupResult,requestedEventIds:requestedIds,participationResult,syncedAt:new Date().toISOString()};
  }
  if(reqUrl.searchParams.get('stats_only')==='1'){const teamStatsUpdated=await syncArsenalTeamStatsCanonical(db); const lineupEvents=arr(await bsd(`/events/?league_id=${LEAGUE_ID}&season_id=${SEASON_ID}&team_id=${arsenalId}&limit=200&offset=0`,key)); const lineupResult=await syncArsenalLineups(db,lineupEvents,key,reqUrl.searchParams.get('spatial_positions')==='1'); const playerStatsUpdated=await syncRootPlayerStats(db,arsenalId,key); const participationResult=await reconcileParticipationFromLineups(db);
  const goalkeeperSavesUpdated=await syncGoalkeeperSavesV2(db,arsenalId,key);const cleanSheetResult=await syncCleanSheetsV2(db,arsenalId,key);return {ok:true,source:'BSD',season:SEASON,teamStatsUpdated,lineupResult,participationResult,playerStatsUpdated,goalkeeperSavesUpdated,cleanSheetResult,statsOnly:true,syncedAt:new Date().toISOString()};}

  const squadBody=await bsd(`/teams/${arsenalId}/squad/`,key);
  const squad=arr(squadBody);
  if(reqUrl.searchParams.get('probe_lineup')==='1') {
    const eid=reqUrl.searchParams.get('event_id');
    if(!eid) return json({ok:false,error:'event_id required'},400);
    const attempts:any[]=[];
    for(const path of ['/events/'+eid+'/lineups/','/matches/'+eid+'/lineups/','/fixtures/'+eid+'/lineups/']){
      try{const body=await bsd(path,key);attempts.push({path,status:'ok',body});}catch(e){attempts.push({path,status:'error',error:e instanceof Error?e.message:String(e)});}
    }
    try{const body=await bsdLegacy('/events/'+eid+'/lineups/',key);attempts.push({path:'/legacy/events/'+eid+'/lineups/',status:'ok',body});}catch(e){attempts.push({path:'/legacy/events/'+eid+'/lineups/',status:'error',error:e instanceof Error?e.message:String(e)});}
    const summary=attempts.map((a:any)=>{const b=a?.body;const root=b?.data??b;const lineups=root?.lineups??root;const home=lineups?.home??{};const away=lineups?.away??{};const shape=(x:any)=>Array.isArray(x)?{type:'array',count:x.length}:x&&typeof x==='object'?{type:'object',keys:Object.keys(x).slice(0,40)}:{type:typeof x};const sample=(x:any)=>Array.isArray(x)&&x.length?{keys:Object.keys(x[0]||{}).slice(0,30),first:x[0]}:null;return {path:a.path,status:a.status,error:a.error??null,root:shape(root),lineups:shape(lineups),home:shape(home),away:shape(away),homePlayers:shape(home.players),homeSubstitutes:shape(home.substitutes),awayPlayers:shape(away.players),awaySubstitutes:shape(away.substitutes),homePlayerSample:sample(home.players),awayPlayerSample:sample(away.players)};});    return {ok:true,event_id:eid,attempts:summary};
  }
  if(reqUrl.searchParams.get('probe')==='1') {
    const sample=squad.slice(0,3).map((x:any)=>({keys:Object.keys(x||{}),sample:x}));
    return {ok:true,probe:true,squadCount:squad.length,sample};
  }
  const events=arr(await bsd(`/events/?league_id=${LEAGUE_ID}&season_id=${SEASON_ID}&team_id=${arsenalId}&limit=200&offset=0`,key));
  let fixtures=0, incidents=0, statsUpdated=0;

  for(const e of events){
    const eid=String(id(e)); if(!eid) continue;
    const homeObj=e?.home_team??e?.home??e?.teams?.home;
    const awayObj=e?.away_team??e?.away??e?.teams?.away;
    const home=nm(homeObj);
    const away=nm(awayObj);
    const homeId=num(id(homeObj));
    const awayId=num(id(awayObj));
    if(!home||!away) continue;
    const isHome=home==='Arsenal';
    const opponent=isHome?away:home;
    const scoreHome=num(e?.home_score??e?.score?.home??e?.scores?.home);
    const scoreAway=num(e?.away_score??e?.score?.away??e?.scores?.away);
    const statusRaw=String(e?.status??e?.event_status??e?.state??'').toLowerCase();
    const status=statusRaw.includes('finish')||statusRaw==='ft'?'fulltime':statusRaw.includes('live')?'live':statusRaw.includes('postpon')?'postponed':statusRaw.includes('cancel')?'cancelled':'scheduled';
    const kickoff=e?.event_date??e?.start_time??e?.kickoff_at??e?.date??null;
    const row:any={
      opponent,competition:'Premier League',kickoff_at:kickoff,is_home:isHome,
      home_team:home,away_team:away,home_team_id:homeId,away_team_id:awayId,external_fixture_id:'bsd:'+eid,source:'BSD',
      season:SEASON,status,is_published:true,kickoff_confirmed:Boolean(kickoff),
      arsenal_score:isHome?scoreHome:scoreAway,opponent_score:isHome?scoreAway:scoreHome,
      home_score:scoreHome,away_score:scoreAway,source_updated_at:new Date().toISOString(),updated_at:new Date().toISOString()
    };
    const existing=await db.from('fixtures').select('id').eq('external_fixture_id','bsd:'+eid).maybeSingle();
    if(existing.error) throw existing.error;
    let fixtureId=existing.data?.id;
    if(fixtureId){
      const {error}=await db.from('fixtures').update(row).eq('id',fixtureId); if(error) throw error;
    }else{
      const {data,error}=await db.from('fixtures').insert(row).select('id').single(); if(error) throw error;
      fixtureId=data.id;
    }
    fixtures++;

    if(status==='fulltime'||status==='live'){
      const {error:oldBsdError}=await db.from('match_events').delete().eq('fixture_id',fixtureId).like('external_event_id','bsd:%');
      if(oldBsdError) throw oldBsdError;
      const inc=arr(await bsd(`/events/${eid}/incidents/`,key));
      const mapped:any[]=[];
      for(const x of inc){
        const minute=num(x?.minute); const extra=num(x?.added_time);
        const player=nm(x?.player); const team=x?.is_home===true?home:x?.is_home===false?away:null;
        if(x?.type==='goal'){
          mapped.push({
            fixture_id:fixtureId,event_type:'goal',player_name:player,team_name:team,
            minute,stoppage_minute:extra,related_player_name:nm(x?.assist),
            external_event_id:`bsd:${eid}:goal:${minute}:${x?.player_id??player}`,updated_at:new Date().toISOString()
          });
        }else if(x?.type==='card'){
          const ct=String(x?.card_type??'').toLowerCase();
          const et=ct.includes('red')?'red_card':ct.includes('yellow')?'yellow_card':null;
          if(et) mapped.push({fixture_id:fixtureId,event_type:et,player_name:player,team_name:team,minute,stoppage_minute:extra,related_player_name:null,external_event_id:`bsd:${eid}:${et}:${minute}:${x?.player_id??player}`,updated_at:new Date().toISOString()});
        }else if(x?.type==='substitution'){
          mapped.push({fixture_id:fixtureId,event_type:'substitution',player_name:nm(x?.player_in),team_name:x?.is_home===true?home:away,minute,stoppage_minute:extra,related_player_name:nm(x?.player_out),external_event_id:`bsd:${eid}:substitution:${minute}:${x?.player_in_id??nm(x?.player_in)}:${x?.player_out_id??nm(x?.player_out)}`,updated_at:new Date().toISOString()});
        }
      }
      if(mapped.length){ const {error}=await db.from('match_events').upsert(mapped,{onConflict:'external_event_id'}); if(error) throw error; incidents+=mapped.length; }
    }
  }

  // Reconcile season player statistics; lineups are accepted only with exactly 11 starters.\n  const lineupResult=await syncArsenalLineups(db,events,key);\n  const teamStatsUpdated=await syncArsenalTeamStatsCanonical(db);\n  const playerStatsUpdated=await syncRootPlayerStats(db,arsenalId,key);\n  const participationResult=await reconcileParticipationFromLineups(db);\n  const goalkeeperSavesUpdated=await syncGoalkeeperSavesV2(db,arsenalId,key);\n  const cleanSheetResult=await syncCleanSheetsV2(db,arsenalId,key);\n  return {ok:true,source:'BSD',season:SEASON,arsenalTeamId:arsenalId,fixtures,incidents,statsUpdated,teamStatsUpdated,playerStatsUpdated,lineupResult,participationResult,goalkeeperSavesUpdated,cleanSheetResult,historicalStandings,syncedAt:new Date().toISOString()};
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST') return json({error:'POST required'},405);
  try{const u=new URL(req.url);let body:any={};try{body=await req.json()}catch{}if(body?.history===true)u.searchParams.set('history','1');return json(await run(u))}catch(e){console.error('BSD_SYNC_FAILED',e);return json({ok:false,error:e instanceof Error?e.message:JSON.stringify(e)},500)}
});