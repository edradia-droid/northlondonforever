// NL4 Record Room — MW3 player participation reconciliation
// Ensures imported lineups/substitutions are represented in the player directory,
// then rebuilds fixture-derived season stats without touching unrelated features.
(function(){
'use strict';
if(window.__NL4_MW3_PLAYER_RECONCILE_V1__) return;
window.__NL4_MW3_PLAYER_RECONCILE_V1__=true;
const VERSION='20260908-mw3-player-reconcile-v1';
const IDS=[22,23,24,25,26,27,28,29,30];
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[Øø]/g,'o').replace(/[Đđ]/g,'d').replace(/[Łł]/g,'l').replace(/ß/g,'ss').replace(/[’‘`]/g,"'").toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const clone=v=>JSON.parse(JSON.stringify(v));
const blank=(name,position='Unknown',number=null)=>({name,position,number,appearances:0,starts:0,minutes:0,goals:0,assists:0,cleanSheets:0,yellowCards:0,redCards:0,mom:0,shots:0,shotsOnTarget:0,chancesCreated:0,tackles:0,interceptions:0,saves:0});
function split(v){const p=String(v||'').split('|||');return {team:p[0]||'',name:p.slice(1).join('|||')||''};}
function fixture(id){return typeof ALL_FIXTURES!=='undefined'?ALL_FIXTURES.find(f=>Number(f.id)===Number(id)):null;}
function recordFor(f){
 if(!f||typeof db==='undefined')return null;
 const a=db?.[f.home]?.fixtureData?.[f.id],b=db?.[f.away]?.fixtureData?.[f.id];
 if(a&&b){return String(a.updatedAt||'')>=String(b.updatedAt||'')?a:b;}
 return a||b||null;
}
function directoryPlayer(team,name){
 const key=norm(name); if(!key)return null;
 const pools=[];
 try{if(typeof TEAM_ROSTERS!=='undefined'&&Array.isArray(TEAM_ROSTERS[team]))pools.push(...TEAM_ROSTERS[team]);}catch(_){}
 try{if(typeof PLAYER_DIRECTORY!=='undefined'&&Array.isArray(PLAYER_DIRECTORY[String(team).toLowerCase()]))pools.push(...PLAYER_DIRECTORY[String(team).toLowerCase()]);}catch(_){}
 let hit=pools.find(p=>norm(p?.name)===key);if(hit)return hit;
 const last=key.split(' ').pop(); const bySurname=pools.filter(p=>norm(p?.name).split(' ').pop()===last);
 return bySurname.length===1?bySurname[0]:null;
}
function ensurePlayer(team,name){
 if(!team||!name||typeof db==='undefined'||!db?.[team])return null;
 db[team].players=Array.isArray(db[team].players)?db[team].players:[];
 const key=norm(name); let p=db[team].players.find(x=>norm(x?.name)===key);if(p)return p;
 const ref=directoryPlayer(team,name); if(ref){
   p=blank(ref.name||name,ref.position||'Unknown',ref.number??null);
 } else {
   p=blank(name,'Unknown',null);
 }
 db[team].players.push(p);
 return p;
}
function participantNames(f,rec,side){
 const team=side==='home'?f.home:f.away, names=[];
 (rec?.[side+'Lineup']||[]).filter(Boolean).forEach(n=>names.push(n));
 (rec?.[side+'Subs']||[]).forEach(s=>{if(s?.out)names.push(s.out);if(s?.in)names.push(s.in);});
 (rec?.events||[]).forEach(e=>{const who=split(e?.player);if(who.team===team&&who.name&&!/\(own goal\)/i.test(who.name))names.push(who.name);const a=split(e?.assist);if(a.team===team&&a.name)names.push(a.name);});
 const motm=split(rec?.manOfTheMatch);if(motm.team===team&&motm.name)names.push(motm.name);
 return [...new Set(names)];
}
function mirror(f,rec){
 [f.home,f.away].forEach(team=>{if(!db?.[team])return;db[team].fixtureData=db[team].fixtureData||{};db[team].fixtureData[f.id]=clone(rec);});
}
function recalcTeam(team){
 try{if(typeof recalculatePlayerStatsFromFixtures==='function')recalculatePlayerStatsFromFixtures(team);}catch(e){console.warn('[NL4 MW3] player recalc failed',team,e);}
 try{window.NL4RecordRoomPlayerMatchStats?.aggregateTeam?.(team);}catch(e){console.warn('[NL4 MW3] advanced recalc failed',team,e);}
 try{if(typeof recalculateClubStatsFromFixtures==='function')recalculateClubStatsFromFixtures(team);}catch(e){console.warn('[NL4 MW3] club recalc failed',team,e);}
}
function apply(){
 if(typeof db==='undefined'||typeof ALL_FIXTURES==='undefined')return false;
 const touched=new Set(),missing=[];
 IDS.forEach(id=>{
   const f=fixture(id),rec=recordFor(f);if(!f||!rec||rec.homeScore==null||rec.awayScore==null){missing.push(id);return;}
   mirror(f,rec);
   participantNames(f,rec,'home').forEach(name=>ensurePlayer(f.home,name));
   participantNames(f,rec,'away').forEach(name=>ensurePlayer(f.away,name));
   touched.add(f.home);touched.add(f.away);
   rec.playerParticipationVerified=true;
   rec.playerParticipationVerifiedVersion=VERSION;
   rec.updatedAt=new Date().toISOString();
   mirror(f,rec);
 });
 touched.forEach(recalcTeam);
 try{window.NL4RecordRoomGoalkeeperSaves?.recalcAll?.();}catch(_){}
 try{window.NL4FinalSquadHistorySync?.syncAll?.();}catch(_){}
 try{if(typeof persist==='function')persist();}catch(e){console.warn('[NL4 MW3] persist failed',e);}
 try{if(typeof render==='function')render();}catch(_){}
 try{window.NL4RecordRoomArsenalPublicSync?.queue?.(120);}catch(_){}
 window.dispatchEvent(new CustomEvent('nl4:record-room-mw3-player-reconciled',{detail:{version:VERSION,fixtures:IDS.length-missing.length,missing,touched:[...touched]}}));
 console.info('[NL4 Record Room] MW3 player participation reconciled', {fixtures:IDS.length-missing.length,missing,touched:[...touched]});
 return missing.length===0;
}
function run(){if(!apply())setTimeout(apply,900);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
window.NL4RecordRoomMW3PlayerReconcile={apply,version:VERSION};
})();