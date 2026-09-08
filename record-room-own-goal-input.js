// NL4 Record Room — own-goal event input helper
// Adds an Own Goal selector without changing the canonical saved goal-event shape.
(function(){
'use strict';
if(window.__NL4_RECORD_ROOM_OWN_GOAL_INPUT__)return;
window.__NL4_RECORD_ROOM_OWN_GOAL_INPUT__=true;

const escHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const splitPerson=value=>{const parts=String(value||'').split('|||');return {team:parts.shift()||'',name:parts.join('|||')||''};};
const ownGoalName=name=>{const m=String(name||'').match(/^Own Goal \((.+)\)$/i);return m?m[1]:'';};

function otherTeam(f,team){return team===f.home?f.away:team===f.away?f.home:'';}

function install(){
  if(typeof window.eventRowHtml!=='function' || typeof window.collectEvents!=='function')return false;
  if(window.eventRowHtml.__nl4OwnGoalPatched)return true;

  const originalEventRowHtml=window.eventRowHtml;
  window.eventRowHtml=function(f,r={}){
    const saved=splitPerson(r.player);
    const savedOwnScorer=ownGoalName(saved.name);
    const isOwnGoal=!!savedOwnScorer || r.ownGoal===true || r.type==='own_goal';
    const scorerTeam=isOwnGoal?otherTeam(f,saved.team):'';
    const selectedScorer=isOwnGoal&&savedOwnScorer?`${scorerTeam}|||${savedOwnScorer}`:(r.player||'');
    const all=[
      ...(typeof teamPlayers==='function'?teamPlayers(f.home):[]).map(p=>({...p,team:f.home})),
      ...(typeof teamPlayers==='function'?teamPlayers(f.away):[]).map(p=>({...p,team:f.away}))
    ];
    const options='<option value="">Player…</option>'+all.map(p=>{
      const value=`${p.team}|||${p.name}`;
      return `<option value="${escHtml(value)}" ${value===selectedScorer?'selected':''}>${escHtml(p.name)} — ${escHtml(p.team)}</option>`;
    }).join('');
    const assist='<option value="">No assist / N/A</option>'+all.map(p=>{
      const value=`${p.team}|||${p.name}`;
      return `<option value="${escHtml(value)}" ${!isOwnGoal&&value===r.assist?'selected':''}>${escHtml(p.name)} — ${escHtml(p.team)}</option>`;
    }).join('');
    const type=isOwnGoal?'own_goal':(r.type||'goal');
    return `<div class="event-row">
      <select class="event-type"><option ${type==='goal'?'selected':''} value="goal">Goal</option><option ${type==='own_goal'?'selected':''} value="own_goal">Own Goal</option><option ${type==='yellow'?'selected':''} value="yellow">Yellow card</option><option ${type==='red'?'selected':''} value="red">Red card</option></select>
      <input class="event-min" type="number" min="0" max="120" placeholder="MIN" value="${r.minute??''}">
      <select class="event-player">${options}</select>
      <select class="event-assist assist-select" ${isOwnGoal?'disabled':''}>${assist}</select>
      <button class="remove-row" type="button" onclick="this.parentElement.remove()">×</button>
    </div>`;
  };
  window.eventRowHtml.__nl4OwnGoalPatched=true;
  try{eventRowHtml=window.eventRowHtml;}catch(_){ }

  window.collectEvents=function(){
    const detail=document.getElementById('fixtureDetail');
    const id=Number(detail?.dataset?.fixtureId);
    const fixtures=(typeof ALL_FIXTURES!=='undefined'?ALL_FIXTURES:window.ALL_FIXTURES)||[];
    const f=fixtures.find(x=>Number(x.id)===id);
    return [...document.querySelectorAll('#eventRows .event-row')].map(row=>{
      const selectedType=row.querySelector('.event-type')?.value||'goal';
      const minuteValue=row.querySelector('.event-min')?.value??'';
      const selectedPlayer=row.querySelector('.event-player')?.value||'';
      const selectedAssist=row.querySelector('.event-assist')?.value||'';
      if(selectedType==='own_goal'&&f&&selectedPlayer){
        const scorer=splitPerson(selectedPlayer);
        const beneficiary=otherTeam(f,scorer.team);
        return {
          type:'goal',
          minute:minuteValue===''?null:(typeof n==='function'?n(minuteValue):Number(minuteValue)),
          player:beneficiary?`${beneficiary}|||Own Goal (${scorer.name})`:`${scorer.team}|||Own Goal (${scorer.name})`,
          assist:''
        };
      }
      return {
        type:selectedType,
        minute:minuteValue===''?null:(typeof n==='function'?n(minuteValue):Number(minuteValue)),
        player:selectedPlayer,
        assist:selectedType==='goal'?selectedAssist:''
      };
    }).filter(r=>r.player);
  };
  try{collectEvents=window.collectEvents;}catch(_){ }

  document.addEventListener('change',event=>{
    const select=event.target.closest?.('.event-type');
    if(!select)return;
    const row=select.closest('.event-row');
    const assist=row?.querySelector('.event-assist');
    if(!assist)return;
    if(select.value==='own_goal'){
      assist.value='';
      assist.disabled=true;
    }else{
      assist.disabled=false;
    }
  });

  const openId=Number(document.getElementById('fixtureDetail')?.dataset?.fixtureId);
  if(Number.isFinite(openId)&&document.getElementById('fixtureDetail')?.classList.contains('open')&&typeof window.openFixture==='function'){
    try{window.openFixture(openId);}catch(_){ }
  }
  return true;
}

let tries=0;
const timer=setInterval(()=>{
  tries++;
  if(install()||tries>80)clearInterval(timer);
},100);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();