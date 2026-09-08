(() => {
'use strict';
const ARSENAL='Arsenal';
const CANON='Martin Ødegaard';
const key=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[Øø]/g,'o').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const isOdegaard=v=>key(v)==='martin odegaard'||key(v)==='odegaard';
function canonName(v){return isOdegaard(v)?CANON:v;}
function canonEventValue(v){
  const parts=String(v||'').split('|||');
  if(parts.length<2)return v;
  const team=parts.shift()||'';
  const name=parts.join('|||');
  return `${team}|||${canonName(name)}`;
}
function canonicalize(){
  try{
    if(typeof db==='undefined'||!db?.[ARSENAL])return false;
    const fixtures=db[ARSENAL].fixtureData||{};
    let changed=false;
    Object.values(fixtures).forEach(s=>{
      if(!s)return;
      ['homeLineup','awayLineup'].forEach(k=>{
        if(!Array.isArray(s[k]))return;
        s[k]=s[k].map(v=>{const next=canonName(v);if(next!==v)changed=true;return next;});
      });
      ['homeSubs','awaySubs'].forEach(k=>{
        if(!Array.isArray(s[k]))return;
        s[k].forEach(r=>{
          if(!r)return;
          const out=canonName(r.out), inn=canonName(r.in);
          if(out!==r.out){r.out=out;changed=true;}
          if(inn!==r.in){r.in=inn;changed=true;}
        });
      });
      if(Array.isArray(s.events))s.events.forEach(ev=>{
        if(!ev)return;
        const p=canonEventValue(ev.player),a=canonEventValue(ev.assist);
        if(p!==ev.player){ev.player=p;changed=true;}
        if(a!==ev.assist){ev.assist=a;changed=true;}
      });
      if(s.manOfTheMatch){const m=canonEventValue(s.manOfTheMatch);if(m!==s.manOfTheMatch){s.manOfTheMatch=m;changed=true;}}
    });
    if(changed){
      try{if(typeof persist==='function')persist();}catch(_){}
    }
    try{if(typeof recalculatePlayerStatsFromFixtures==='function')recalculatePlayerStatsFromFixtures(ARSENAL);}catch(e){console.warn('[NL4] Ødegaard canonical recalculation failed',e);}
    try{if(typeof persist==='function')persist();if(typeof render==='function')render();}catch(_){}
    window.NL4RecordRoomArsenalPublicSync?.hydrateFromSupabase?.();
    return true;
  }catch(err){console.warn('[NL4] Ødegaard fixture canonicalization failed',err);return false;}
}
window.NL4RecordRoomOdegaardCanonicalize={run:canonicalize};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(canonicalize,0),{once:true});else setTimeout(canonicalize,0);
[250,1000,2500].forEach(ms=>setTimeout(canonicalize,ms));
window.addEventListener('nl4:record-room-saved',()=>setTimeout(canonicalize,0));
})();