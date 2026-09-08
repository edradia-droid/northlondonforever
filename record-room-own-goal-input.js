// NL4 Record Room — own-goal event input helper
// DOM-level implementation: works even when Record Room functions are script-local.
(function(){
'use strict';
if(window.__NL4_RECORD_ROOM_OWN_GOAL_DOM__)return;
window.__NL4_RECORD_ROOM_OWN_GOAL_DOM__=true;

const OWN='own_goal';
const split=value=>{const p=String(value||'').split('|||');return {team:p.shift()||'',name:p.join('|||')||''};};

function ensureOption(select){
  if(!select||select.dataset.ownGoalReady==='1')return;
  if(![...select.options].some(o=>o.value===OWN)){
    const option=document.createElement('option');
    option.value=OWN;option.textContent='Own Goal';
    const goal=[...select.options].find(o=>o.value==='goal');
    if(goal?.nextSibling)select.insertBefore(option,goal.nextSibling);else select.appendChild(option);
  }
  select.dataset.ownGoalReady='1';
}

function teamsFromPlayerSelect(row){
  const select=row.querySelector('.event-player');
  const teams=[];
  [...(select?.options||[])].forEach(o=>{
    const t=split(o.value).team;
    if(t&&!teams.includes(t))teams.push(t);
  });
  return teams;
}

function setAssistState(row){
  const type=row.querySelector('.event-type');
  const assist=row.querySelector('.event-assist');
  if(!type||!assist)return;
  const own=type.value===OWN;
  if(own){assist.value='';assist.disabled=true;assist.title='Own goals do not receive an assist';}
  else{assist.disabled=false;assist.title='';}
}

function prepareOwnGoalForNativeSave(row){
  const type=row.querySelector('.event-type');
  const player=row.querySelector('.event-player');
  const assist=row.querySelector('.event-assist');
  if(type?.value!==OWN||!player?.value)return null;
  const scorer=split(player.value);
  const teams=teamsFromPlayerSelect(row);
  const beneficiary=teams.find(t=>t!==scorer.team)||'';
  if(!beneficiary||!scorer.name)return null;

  const original={type:type.value,player:player.value,assist:assist?.value||''};
  const canonical=`${beneficiary}|||Own Goal (${scorer.name})`;
  let option=[...player.options].find(o=>o.value===canonical);
  if(!option){
    option=document.createElement('option');
    option.value=canonical;
    option.textContent=`Own Goal (${scorer.name}) — ${beneficiary}`;
    option.dataset.nl4OwnGoalTemp='1';
    player.appendChild(option);
  }
  player.value=canonical;
  type.value='goal';
  if(assist){assist.value='';assist.disabled=false;}
  return ()=>{
    type.value=OWN;
    player.value=original.player;
    if(assist){assist.value='';assist.disabled=true;}
    [...player.options].filter(o=>o.dataset.nl4OwnGoalTemp==='1').forEach(o=>o.remove());
  };
}

function patchRows(root=document){
  root.querySelectorAll?.('.event-row .event-type').forEach(select=>{
    ensureOption(select);
    setAssistState(select.closest('.event-row'));
  });
}

// Keep every newly rendered event row patched, including rows added after opening a fixture.
const observer=new MutationObserver(mutations=>{
  for(const m of mutations){
    m.addedNodes.forEach(node=>{
      if(node.nodeType!==1)return;
      if(node.matches?.('.event-row,.event-type')||node.querySelector?.('.event-type'))patchRows(node.matches?.('.event-row')?node.parentElement||node:node);
    });
  }
});

function start(){
  patchRows(document);
  observer.observe(document.documentElement,{childList:true,subtree:true});
}

// UI behavior for Own Goal.
document.addEventListener('change',e=>{
  const type=e.target.closest?.('.event-type');
  if(!type)return;
  ensureOption(type);
  setAssistState(type.closest('.event-row'));
},true);

// Native Record Room collectEvents() is local to record-room.html.
// Immediately before its save handler runs, temporarily convert Own Goal rows
// into the canonical legacy shape it already understands: type=goal and
// player="beneficiary|||Own Goal (opposition scorer)". Player-stat rebuilds therefore
// do not award a normal goal to the own-goal scorer and no assist is recorded.
document.addEventListener('click',e=>{
  const button=e.target.closest?.('button');
  if(!button)return;
  const isSave=button.classList.contains('detail-save')||/SAVE MATCH DETAILS/i.test(button.textContent||'');
  if(!isSave)return;
  const restores=[];
  document.querySelectorAll('#eventRows .event-row').forEach(row=>{
    const restore=prepareOwnGoalForNativeSave(row);
    if(restore)restores.push(restore);
  });
  if(restores.length)setTimeout(()=>restores.forEach(fn=>{try{fn();}catch(_){}}),0);
},true);

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.NL4RecordRoomOwnGoalInput={patchRows,version:'20260908-dom-v2'};
})();