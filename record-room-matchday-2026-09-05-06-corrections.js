// NL4 MW3 correction: Manchester City v Coventry late warm-up change.
(function(){
'use strict';
const VERSION='20260908-mw3-city-warmup-v1';
const ID=26,HOME='Manchester City',AWAY='Coventry City';
const clone=v=>JSON.parse(JSON.stringify(v));
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[Øø]/g,'o').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function loadScriptOnce(file,key,version){
 if(key&&window[key])return;
 if([...document.scripts].some(s=>String(s.src||'').includes(file)))return;
 const s=document.createElement('script');s.src=`${file}?v=${version}-${Date.now()}`;s.async=false;s.onerror=()=>console.error('[NL4 Record Room] Failed to load',file);document.head.appendChild(s);
}
function loadOwnGoalInput(){loadScriptOnce('record-room-own-goal-input.js','NL4RecordRoomOwnGoalInput','20260908-own-goal3');}
function loadSupabaseAuthority(){loadScriptOnce('record-room-supabase-authority.js','NL4RecordRoomSupabaseAuthority','20260908-supabase-authority1');}
loadOwnGoalInput();loadSupabaseAuthority();
function resolve(team,name){const ps=(typeof db!=='undefined'&&db?.[team]?.players)||[];return ps.find(p=>norm(p.name)===norm(name))?.name||name;}
function apply(){
 if(typeof db==='undefined'||!db?.[HOME]||!db?.[AWAY])return false;
 const current=db[HOME]?.fixtureData?.[ID]||db[AWAY]?.fixtureData?.[ID];if(!current)return false;
 if(current.cityWarmupCorrectionVersion===VERSION)return true;
 const r=clone(current);
 r.homeLineup=(r.homeLineup||[]).map(n=>norm(n)==='nico o reilly'?resolve(HOME,'Enzo Fernandez'):n);
 r.homeSubs=(r.homeSubs||[]).filter(s=>!(norm(s.out)==='ayyoub bouaddi'&&norm(s.in)==='enzo fernandez'));
 r.homeSubs.push({out:resolve(HOME,'Enzo Fernandez'),outMin:76,in:resolve(HOME,'Ayyoub Bouaddi'),inMin:76});
 r.matchDetails=r.matchDetails||{};
 r.matchDetails.notes=(r.matchDetails.notes||'')+' Confirmed late team change: Nico O’Reilly withdrew injured in the warm-up; Enzo Fernández started and was replaced by Ayyoub Bouaddi at 76 minutes.';
 r.cityWarmupCorrectionVersion=VERSION;r.updatedAt=new Date().toISOString();
 [HOME,AWAY].forEach(t=>{db[t].fixtureData=db[t].fixtureData||{};db[t].fixtureData[ID]=clone(r);});
 [HOME,AWAY].forEach(t=>{try{if(typeof recalculatePlayerStatsFromFixtures==='function')recalculatePlayerStatsFromFixtures(t);}catch(e){console.warn('[NL4 MW3] City correction player recalc failed',t,e);}});
 [HOME,AWAY].forEach(t=>{try{if(typeof recalculateClubStatsFromFixtures==='function')recalculateClubStatsFromFixtures(t);}catch(e){console.warn('[NL4 MW3] City correction club recalc failed',t,e);}});
 try{if(typeof persist==='function')persist();if(typeof render==='function')render();}catch(_){}
 console.info('[NL4 Record Room] Corrected Manchester City warm-up XI change');return true;
}
function run(){loadOwnGoalInput();loadSupabaseAuthority();if(!apply())setTimeout(apply,1200);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
window.NL4RecordRoomMW3CityCorrection={apply,version:VERSION};
})();