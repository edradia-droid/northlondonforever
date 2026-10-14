(function(){
'use strict';
const db=window.nl4Supabase,$=id=>document.getElementById(id);
async function loadArsenalOverview(){
 if(!db)return;
 const result=await db.from('ucl_standings').select('position,team_name,played,wins,draws,losses,goals_for,goals_against,goal_difference,points,source_updated_at').eq('season','2026/27').eq('stage','league-phase').eq('source','BSD');
 if(result.error){console.warn('NL4 UCL overview standings:',result.error);return;}
 const rows=result.data||[];
 const names=new Set(rows.map(r=>String(r.team_name||'').trim().toLowerCase()));
 let valid=rows.length===36&&names.size===36;
 for(const r of rows){
  const fields=['position','played','wins','draws','losses','goals_for','goals_against','goal_difference','points'];
  if(!fields.every(k=>r[k]!==null&&r[k]!==undefined&&Number.isFinite(Number(r[k])))){valid=false;break;}
  if(Number(r.played)!==Number(r.wins)+Number(r.draws)+Number(r.losses)||Number(r.points)!==Number(r.wins)*3+Number(r.draws)||Number(r.goal_difference)!==Number(r.goals_for)-Number(r.goals_against)){valid=false;break;}
 }
 if(!valid){const status=document.querySelector('.ucl-table-status');if(status)status.textContent='Standings temporarily withheld: source data failed validation.';return;}
 const a=rows.find(r=>/arsenal/i.test(String(r.team_name||'')));if(!a)return;
 const values={uclPosition:a.position,uclPoints:a.points,uclPlayed:a.played,uclWins:a.wins,uclGoals:a.goals_for,uclGoalDiff:(Number(a.goal_difference)>0?'+':'')+a.goal_difference};
 Object.entries(values).forEach(([id,v])=>{const el=$(id);if(el)el.textContent=String(v);});
 const status=document.querySelector('.ucl-table-status'),last=rows.map(r=>r.source_updated_at).filter(Boolean).sort().pop();
 if(status)status.textContent=last?'Validated BSD table • updated '+new Date(last).toLocaleString():'Validated BSD table.';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadArsenalOverview,{once:true});else loadArsenalOverview();
})();