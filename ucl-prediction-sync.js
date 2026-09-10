(function(){
'use strict';
const params=new URLSearchParams(location.search);
let idx=Number(params.get('match'));
if(!Number.isInteger(idx)||idx<0||idx>7) idx=0;
const matchday=idx+1;
const db=()=>window.nl4Supabase;

function voterKey(){
  let key=localStorage.getItem('nl4_fan_voter_key');
  if(!key){
    key=(crypto.randomUUID?crypto.randomUUID():'fan-'+Date.now()+'-'+Math.random().toString(36).slice(2));
    localStorage.setItem('nl4_fan_voter_key',key);
  }
  return key;
}
function message(id,text,bad=false){
  const el=document.getElementById(id); if(!el)return;
  el.textContent=text; el.style.color=bad?'#ff8d8d':'#94dca3';
}
async function fixture(){
  const client=db();
  if(!client) throw new Error('Supabase is not connected. Refresh the page and try again.');
  const {data,error}=await client.from('fixtures')
    .select('id,status,kickoff_at,opponent,is_home,competition,season,matchday')
    .eq('season','2026/27')
    .eq('competition','UEFA Champions League')
    .eq('matchday',matchday)
    .single();
  if(error) throw error;
  if(!data) throw new Error('Champions League fixture is not connected to NL4 Admin.');
  return data;
}
function closed(f){
  return (f.kickoff_at&&new Date(f.kickoff_at)<=new Date()) || ['live','fulltime','finished','ft','played','aet','pen'].includes(String(f.status||'').toLowerCase());
}
async function submitScore(){
  const btn=document.getElementById('saveScore');
  try{
    btn.disabled=true; message('scoreMsg','Saving score prediction to NL4 Admin…');
    const f=await fixture();
    if(closed(f)) throw new Error('Predictions are closed for this match.');
    const hs=Number(document.getElementById('homeScore').value), as=Number(document.getElementById('awayScore').value);
    if(!Number.isInteger(hs)||!Number.isInteger(as)||hs<0||as<0||hs>30||as>30) throw new Error('Enter a valid score between 0 and 30.');
    const {data,error}=await db().rpc('submit_fan_prediction',{
      p_fixture_id:f.id,p_voter_key:voterKey(),p_mode:'score',p_formation:null,p_kit:null,
      p_starters:[],p_substitutes:[],p_home_score:hs,p_away_score:as
    });
    if(error) throw error;
    if(!data) throw new Error('NL4 did not confirm the prediction save.');
    message('scoreMsg','Score prediction saved to Admin Fan Predictions ✓');
  }catch(e){
    console.error('[NL4 UCL score prediction]',e);
    message('scoreMsg','SAVE FAILED • '+(e?.message||'Could not save prediction.'),true);
    btn.disabled=false;
  }
}
async function submitLineup(){
  const btn=document.getElementById('saveLineup');
  try{
    const selects=[...document.querySelectorAll('.slot select')];
    const names=selects.map(s=>s.value).filter(Boolean);
    if(names.length!==11) throw new Error('Select all 11 starting players before saving.');
    if(new Set(names.map(x=>x.toLowerCase())).size!==11) throw new Error('Each starter must be a different player.');
    const subs=[...document.querySelectorAll('#subs input:checked')].map(x=>x.value);
    const starterSet=new Set(names.map(x=>x.toLowerCase()));
    if(subs.some(x=>starterSet.has(x.toLowerCase()))) throw new Error('A starter cannot also be a substitute.');
    btn.disabled=true; message('lineupMsg','Saving Champions League lineup to NL4 Admin…');
    const f=await fixture();
    if(closed(f)) throw new Error('Predictions are closed for this match.');
    const starters=selects.map(s=>({slot:s.closest('.slot')?.dataset.position||s.getAttribute('aria-label')||'',player_name:s.value}));
    const substitutes=subs.map(player_name=>({player_name}));
    const {data,error}=await db().rpc('submit_fan_prediction',{
      p_fixture_id:f.id,p_voter_key:voterKey(),p_mode:'lineup',
      p_formation:document.getElementById('formation').value,p_kit:document.getElementById('kit').value,
      p_starters:starters,p_substitutes:substitutes,p_home_score:null,p_away_score:null
    });
    if(error) throw error;
    if(!data) throw new Error('NL4 did not confirm the lineup save.');
    message('lineupMsg','Champions League lineup saved to Admin Fan Predictions ✓');
  }catch(e){
    console.error('[NL4 UCL lineup prediction]',e);
    message('lineupMsg','SAVE FAILED • '+(e?.message||'Could not save lineup prediction.'),true);
    btn.disabled=false;
  }
}
function hook(){
  const score=document.getElementById('saveScore'),lineup=document.getElementById('saveLineup');
  if(!score||!lineup) return setTimeout(hook,100);
  // Replace the local-only handlers. A success message now appears only after Supabase confirms the write.
  score.onclick=submitScore;
  lineup.onclick=submitLineup;
  fixture().then(f=>{
    if(closed(f)){
      score.disabled=true; lineup.disabled=true;
      score.title=lineup.title='Predictions closed';
      message('scoreMsg','Predictions are closed for this match.',true);
      message('lineupMsg','Predictions are closed for this match.',true);
    }
  }).catch(e=>console.error('[NL4 UCL fixture resolution]',e));
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',hook,{once:true}); else hook();
})();