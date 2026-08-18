(function(){
  'use strict';
  const FORMATIONS={
    '4-3-3':[[50,91],[16,76],[37,76],[63,76],[84,76],[31,53],[50,57],[69,53],[18,24],[50,18],[82,24]],
    '4-2-3-1':[[50,91],[16,76],[37,76],[63,76],[84,76],[36,58],[64,58],[20,38],[50,35],[80,38],[50,18]],
    '4-4-2':[[50,91],[16,76],[37,76],[63,76],[84,76],[17,50],[39,52],[61,52],[83,50],[38,21],[62,21]],
    '3-4-3':[[50,91],[28,75],[50,77],[72,75],[18,53],[40,55],[60,55],[82,53],[20,23],[50,18],[80,23]],
    '3-5-2':[[50,91],[28,76],[50,78],[72,76],[14,53],[35,55],[50,48],[65,55],[86,53],[39,20],[61,20]],
    '4-1-4-1':[[50,91],[16,76],[37,76],[63,76],[84,76],[50,61],[18,43],[40,45],[60,45],[82,43],[50,18]]
  };
  let fixtureId=null, rows=[];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const db=()=>window.nl4Supabase;

  function styles(){
    if(document.getElementById('nl4-manual-lineup-patch-style')) return;
    const s=document.createElement('style'); s.id='nl4-manual-lineup-patch-style';
    s.textContent=`
    #nl4ManualLineupPatch{margin:16px 0;padding:14px;border:1px solid rgba(216,173,69,.3);border-radius:16px;background:#090909}
    #nl4ManualLineupPatch .ml-head{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
    #nl4ManualLineupPatch h4{margin:0;color:#fff;font-size:15px} #nl4ManualLineupPatch p{margin:5px 0 10px;color:#999;font-size:11px}
    #nl4ManualLineupPatch .ml-tools{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
    #nl4ManualLineupPatch select,#nl4ManualLineupPatch button{min-height:40px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#111;color:#fff;padding:8px 10px;font-weight:800}
    #nl4ManualLineupPatch button{cursor:pointer} #nl4ManualLineupPatch .ml-status{min-height:18px;color:#d8ad45;font-size:11px;font-weight:800;text-align:center;margin-top:8px}
    #nl4ManualLineupPatch .ml-sub-panel{margin-top:12px;padding:12px;border:1px solid rgba(255,255,255,.10);border-radius:12px;background:#0d0d0d}
    #nl4ManualLineupPatch .ml-bench-panel{margin-top:12px;padding:12px;border:1px solid rgba(216,173,69,.22);border-radius:12px;background:#0d0d0d}
    #nl4ManualLineupPatch .ml-bench-tools{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}
    #nl4ManualLineupPatch .ml-bench-tools label{margin:0;color:#aaa;font-size:10px}
    #nl4ManualBenchDownload{margin-top:10px;padding:9px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(0,0,0,.45)}
    #nl4ManualBenchDownload .ml-bench-title{display:block;color:#d8ad45;font-size:9px;font-weight:1000;letter-spacing:.8px;margin-bottom:7px}
    #nl4ManualBenchDownload .ml-bench-list{display:flex;gap:6px;flex-wrap:wrap}
    #nl4ManualBenchDownload .ml-bench-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 7px;border-radius:999px;background:#151515;border:1px solid rgba(255,255,255,.1);font-size:8px;color:#fff;font-weight:900}
    #nl4ManualBenchDownload .ml-bench-chip button{min-height:0;padding:0 3px;border:0;background:transparent;color:#ff7d86;font-size:11px}
    #nl4ManualLineupPatch .ml-sub-panel h5{margin:0 0 4px;color:#fff;font-size:13px}
    #nl4ManualLineupPatch .ml-sub-grid{display:grid;grid-template-columns:1fr 1fr 110px auto;gap:8px;align-items:end}
    #nl4ManualLineupPatch .ml-sub-grid label{margin:0;color:#aaa;font-size:10px}
    #nl4ManualLineupPatch .ml-sub-list{display:grid;gap:7px;margin-top:10px}
    #nl4ManualLineupPatch .ml-sub-row{display:grid;grid-template-columns:1fr auto 1fr auto;gap:8px;align-items:center;padding:8px 10px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:#111;font-size:10px}
    #nl4ManualLineupPatch .ml-sub-row b{color:#fff}.ml-sub-minute{color:#d8ad45;font-weight:900}
    #nl4ManualPitch{position:relative;width:min(100%,620px);aspect-ratio:72/104;margin:auto;overflow:hidden;border:2px solid #fff;border-radius:12px;background:repeating-linear-gradient(0deg,#30994c 0 10%,#278b43 10% 20%);touch-action:none;user-select:none;-webkit-user-select:none}
    #nl4ManualPitch:before{content:"";position:absolute;left:0;right:0;top:50%;height:2px;background:#fff}#nl4ManualPitch:after{content:"";position:absolute;left:50%;top:50%;width:24%;aspect-ratio:1;border:2px solid #fff;border-radius:50%;transform:translate(-50%,-50%)}
    #nl4ManualPitch .box{position:absolute;left:22%;right:22%;height:15%;border:2px solid rgba(255,255,255,.9);pointer-events:none}.box.top{top:-2px}.box.bottom{bottom:-2px}
    .nl4-manual-player{position:absolute;left:var(--x);top:var(--y);transform:translate(-50%,-50%);width:76px;display:grid;justify-items:center;cursor:grab;touch-action:none;z-index:10}.nl4-manual-player.dragging{cursor:grabbing;z-index:50}
    .nl4-manual-shirt{width:42px;height:48px;border-radius:8px 8px 12px 12px;background:linear-gradient(90deg,#fff 0 18%,#d6001f 18% 82%,#fff 82%);border:1px solid rgba(255,255,255,.8);box-shadow:0 8px 12px rgba(0,0,0,.38);display:grid;place-items:center;color:#fff;font-size:16px;font-weight:1000;text-shadow:0 1px 2px #000}.nl4-manual-name{margin-top:3px;max-width:76px;padding:3px 5px;border-radius:6px;background:rgba(0,0,0,.75);color:#fff;font-size:8px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    @media(max-width:560px){#nl4ManualLineupPatch{padding:10px}.nl4-manual-player{width:62px}.nl4-manual-shirt{width:35px;height:41px;font-size:14px}.nl4-manual-name{max-width:62px;font-size:7px}#nl4ManualLineupPatch .ml-sub-grid{grid-template-columns:1fr 1fr}#nl4ManualLineupPatch .ml-sub-grid button{grid-column:1/-1}#nl4ManualLineupPatch .ml-sub-row{grid-template-columns:1fr auto 1fr}#nl4ManualLineupPatch .ml-bench-tools{grid-template-columns:1fr}#nl4ManualLineupPatch .ml-bench-tools button{width:100%}}
    `; document.head.appendChild(s);
  }

  function ensureUI(){
    styles(); if(document.getElementById('nl4ManualLineupPatch')) return true;
    const list=document.getElementById('lineupList');
    const section=list?.closest('.match-admin-section') || list?.parentElement;
    if(!list||!section) return false;
    const box=document.createElement('div'); box.id='nl4ManualLineupPatch';
    box.innerHTML=`<div class="ml-head"><div><h4>Manual Touch Lineup</h4><p>Drag starters anywhere on the pitch. Positions save when you release.</p></div></div>
      <div class="ml-tools"><select id="nl4ManualFormation">${Object.keys(FORMATIONS).map(f=>`<option>${f}</option>`).join('')}</select><button type="button" id="nl4ManualArrange">Auto Arrange</button><button type="button" id="nl4ManualReload">Reload Starters</button></div>
      <div id="nl4ManualPitch"><span class="box top"></span><span class="box bottom"></span></div>

      <div id="nl4ManualBenchDownload" data-downloadable-lineup="true">
        <span class="ml-bench-title">BEFORE MATCH SUBSTITUTES</span>
        <div id="nl4ManualBenchList" class="ml-bench-list"><span style="color:#777;font-size:8px">No bench selected.</span></div>
      </div>

      <div class="ml-bench-panel">
        <h5>Before Match Subs / Bench</h5>
        <p>Select the substitutes available before kickoff. They are shown above inside the downloadable lineup area.</p>
        <div class="ml-bench-tools">
          <label>Add bench player<select id="nl4BenchPlayer"></select></label>
          <button type="button" id="nl4AddBenchPlayer">Add to Bench</button>
        </div>
      </div>

      <div class="ml-sub-panel">
        <h5>During / After Match Substitution</h5>
        <p>Record the actual change made during the match. This is separate from the pre-match bench.</p>
        <div class="ml-sub-grid">
          <label>Player OFF<select id="nl4SubOff"></select></label>
          <label>Player ON<select id="nl4SubOn"></select></label>
          <label>Minute<input id="nl4SubMinute" type="number" min="1" max="130" placeholder="67"></label>
          <button type="button" id="nl4SaveSub">Save Match Substitution</button>
        </div>
        <div id="nl4SubList" class="ml-sub-list"></div>
      </div>
      <div id="nl4ManualStatus" class="ml-status">Open a match to load its starters.</div>`;
    list.parentNode.insertBefore(box,list);
    document.getElementById('nl4ManualArrange').addEventListener('click',autoArrange);
    document.getElementById('nl4ManualReload').addEventListener('click',load);
    document.getElementById('nl4ManualFormation').addEventListener('change',render);
    document.getElementById('nl4SaveSub').addEventListener('click',saveSubstitution);
    document.getElementById('nl4AddBenchPlayer').addEventListener('click',addBenchPlayer);
    const rosterSelect=document.getElementById('lineupPlayer');
    if(rosterSelect){
      rosterSelect.addEventListener('change',()=>setTimeout(renderSubstitutions,0));
      const observer=new MutationObserver(()=>renderSubstitutions());
      observer.observe(rosterSelect,{childList:true,subtree:true});
    }
    return true;
  }
  const status=t=>{const e=document.getElementById('nl4ManualStatus'); if(e)e.textContent=t||''};
  async function load(){
    ensureUI(); if(!fixtureId){status('Open a fixture with Manage first.'); return;}
    const client=db(); if(!client){status('Supabase client not ready.');return;}
    status('Loading saved starters…');
    const {data,error}=await client.from('match_lineups').select('*').eq('fixture_id',fixtureId).order('is_starter',{ascending:false}).order('minute_on',{ascending:true});
    if(error){status('Could not load lineup: '+error.message); return;}
    rows=data||[]; const saved=rows.find(r=>r.is_starter&&r.formation)?.formation; if(saved&&FORMATIONS[saved]) document.getElementById('nl4ManualFormation').value=saved;
    render(); renderSubstitutions(); status(`${rows.filter(r=>r.is_starter).length} starter(s) loaded — drag to position.`);
  }

  function getFullPlayerOptions(){
    const source=document.getElementById('lineupPlayer');
    if(!source)return [];
    return Array.from(source.options)
      .filter(o=>o.value && !o.disabled)
      .map(o=>({value:o.value,name:(o.textContent||'').trim()}))
      .filter(o=>o.name);
  }

  function benchRows(){
    return rows.filter(r=>!r.is_starter && (!Number(r.minute_on) || Number(r.minute_on)===0));
  }

  function renderBench(){
    const select=document.getElementById('nl4BenchPlayer');
    const list=document.getElementById('nl4ManualBenchList');
    if(!select||!list)return;

    const starters=rows.filter(r=>r.is_starter);
    const bench=benchRows();
    const blocked=new Set([...starters,...bench].map(r=>String(r.player_name||'').trim().toLowerCase()));
    const roster=getFullPlayerOptions();
    const choices=roster.filter(r=>!blocked.has(String(r.name||'').trim().toLowerCase()));

    select.innerHTML='<option value="">Select bench player</option>'+choices.map(r=>`<option value="${esc(r.value)}">${esc(r.name)}</option>`).join('');
    if(!choices.length)select.innerHTML+='<option value="" disabled>No more available players</option>';

    if(!bench.length){
      list.innerHTML='<span style="color:#777;font-size:8px">No bench selected.</span>';
      return;
    }
    list.innerHTML=bench.map(r=>`<span class="ml-bench-chip">${esc(r.player_name)} <button type="button" data-remove-bench="${esc(r.id)}" aria-label="Remove ${esc(r.player_name)}">×</button></span>`).join('');
    list.querySelectorAll('[data-remove-bench]').forEach(btn=>{
      btn.addEventListener('click',()=>removeBenchPlayer(btn.dataset.removeBench));
    });
  }

  async function addBenchPlayer(){
    if(!fixtureId)return status('Open a fixture first.');
    const value=document.getElementById('nl4BenchPlayer')?.value;
    if(!value)return status('Choose a player to add to the pre-match bench.');

    const playerSelect=document.getElementById('lineupPlayer');
    const role=document.getElementById('lineupRole');
    const minuteOn=document.getElementById('lineupMinuteOn');
    const minuteOff=document.getElementById('lineupMinuteOff');
    const saveBtn=document.getElementById('saveLineupPlayerBtn');

    if(!playerSelect||!role||!minuteOn||!saveBtn)return status('Existing lineup controls are not available.');

    playerSelect.value=value;
    role.value='substitute';
    minuteOn.value=0;
    if(minuteOff)minuteOff.value='';
    status('Adding pre-match substitute…');
    saveBtn.click();
    await new Promise(resolve=>setTimeout(resolve,700));
    await load();
    status('Pre-match substitute added ✓');
  }

  async function removeBenchPlayer(id){
    if(!id||!fixtureId)return;
    const client=db(); if(!client)return status('Supabase client not ready.');
    status('Removing bench player…');
    const {error}=await client.from('match_lineups').delete().eq('id',id).eq('fixture_id',fixtureId).eq('is_starter',false);
    if(error)return status('Could not remove bench player: '+error.message);
    await load();
    status('Bench player removed ✓');
  }

  function renderSubstitutions(){
    const off=document.getElementById('nl4SubOff'), on=document.getElementById('nl4SubOn'), list=document.getElementById('nl4SubList');
    if(!off||!on||!list)return;
    const starters=rows.filter(r=>r.is_starter);
    const allSubs=rows.filter(r=>!r.is_starter);
    const bench=benchRows();
    const used=allSubs.filter(r=>Number(r.minute_on)>0);
    const starterNames=new Set(starters.map(r=>String(r.player_name||'').trim().toLowerCase()));

    off.innerHTML='<option value="">Select player off</option>'+starters.map(r=>`<option value="${esc(r.id)}">${esc(r.player_name)}</option>`).join('');

    const onChoices=[];
    const seen=new Set();

    // Bench is the preferred source for live substitutions.
    bench.forEach(r=>{
      const name=String(r.player_name||'').trim();
      const key=name.toLowerCase();
      if(!name||seen.has(key))return;
      seen.add(key);
      onChoices.push({value:'saved:'+r.id,name});
    });

    // Also allow any already-saved non-starter not currently used.
    allSubs.filter(r=>!Number(r.minute_on)).forEach(r=>{
      const name=String(r.player_name||'').trim();
      const key=name.toLowerCase();
      if(!name||seen.has(key))return;
      seen.add(key);
      onChoices.push({value:'saved:'+r.id,name});
    });

    // Fallback to the full roster if admin did not pre-select a bench.
    getFullPlayerOptions().forEach(r=>{
      const name=String(r.name||'').trim();
      const key=name.toLowerCase();
      if(!name||starterNames.has(key)||seen.has(key))return;
      seen.add(key);
      onChoices.push({value:'roster:'+r.value,name});
    });

    on.innerHTML='<option value="">Select player on</option>'+onChoices.map(r=>`<option value="${esc(r.value)}">${esc(r.name)}</option>`).join('');
    if(!onChoices.length)on.innerHTML+='<option value="" disabled>No available substitutes found</option>';

    list.innerHTML=used.length?used.map(r=>{
      const offPlayer=starters.find(s=>Number(s.minute_off)===Number(r.minute_on));
      return `<div class="ml-sub-row"><b>${esc(offPlayer?.player_name||'Player off')}</b><span>→</span><b>${esc(r.player_name)}</b><span class="ml-sub-minute">${esc(r.minute_on)}'</span></div>`;
    }).join(''):'<p style="margin:8px 0 0;color:#777;font-size:10px">No match substitutions recorded yet.</p>';

    renderBench();
  }

  async function saveSubstitution(){
    if(!fixtureId)return status('Open a fixture first.');
    const offId=document.getElementById('nl4SubOff')?.value;
    const onValue=document.getElementById('nl4SubOn')?.value;
    const minute=Number(document.getElementById('nl4SubMinute')?.value);
    if(!offId||!onValue)return status('Choose both Player OFF and Player ON.');
    if(!Number.isFinite(minute)||minute<1||minute>130)return status('Enter a valid substitution minute.');
    const client=db(); if(!client)return status('Supabase client not ready.');

    status('Saving substitution…');
    let res=await client.from('match_lineups').update({minute_off:minute,updated_at:new Date().toISOString()}).eq('id',offId).eq('fixture_id',fixtureId);
    if(res.error)return status('Could not save player off: '+res.error.message);

    if(onValue.startsWith('saved:')){
      const onId=onValue.slice(6);
      res=await client.from('match_lineups').update({minute_on:minute,is_starter:false,updated_at:new Date().toISOString()}).eq('id',onId).eq('fixture_id',fixtureId);
      if(res.error)return status('Could not save player on: '+res.error.message);
    } else if(onValue.startsWith('roster:')){
      const rosterValue=onValue.slice(7);
      const playerSelect=document.getElementById('lineupPlayer');
      const role=document.getElementById('lineupRole');
      const minuteOn=document.getElementById('lineupMinuteOn');
      const minuteOff=document.getElementById('lineupMinuteOff');
      const saveBtn=document.getElementById('saveLineupPlayerBtn');

      if(!playerSelect||!role||!minuteOn||!saveBtn){
        return status('Could not access the existing Add / Update Player controls.');
      }

      playerSelect.value=rosterValue;
      role.value='substitute';
      minuteOn.value=minute;
      if(minuteOff)minuteOff.value='';
      saveBtn.click();
      await new Promise(resolve=>setTimeout(resolve,700));
    }

    document.getElementById('nl4SubMinute').value='';
    await load();
    status(`Substitution saved at ${minute}' ✓`);
  }
  function render(){
    ensureUI(); const pitch=document.getElementById('nl4ManualPitch'); if(!pitch)return;
    pitch.querySelectorAll('.nl4-manual-player,.ml-empty').forEach(e=>e.remove());
    const starters=rows.filter(r=>r.is_starter), f=document.getElementById('nl4ManualFormation')?.value||'4-3-3', coords=FORMATIONS[f]||FORMATIONS['4-3-3'];
    if(!starters.length){const e=document.createElement('div');e.className='ml-empty';e.style.cssText='position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-weight:900;text-align:center;padding:30px';e.textContent='No saved starters found for this fixture.';pitch.appendChild(e);return;}
    starters.forEach((r,i)=>{const fallback=coords[i]||[50,50], x=Number.isFinite(Number(r.position_x))?Number(r.position_x):fallback[0], y=Number.isFinite(Number(r.position_y))?Number(r.position_y):fallback[1]; const p=document.createElement('div');p.className='nl4-manual-player';p.dataset.id=r.id;p.dataset.x=x;p.dataset.y=y;p.style.setProperty('--x',x+'%');p.style.setProperty('--y',y+'%');p.innerHTML=`<span class="nl4-manual-shirt">${esc(r.shirt_number||'•')}</span><span class="nl4-manual-name">${esc(r.player_name)}</span>`;drag(p);pitch.appendChild(p);});
  }
  function drag(p){let down=false; const pitch=()=>document.getElementById('nl4ManualPitch'); const move=e=>{if(!down)return;const r=pitch().getBoundingClientRect();let x=(e.clientX-r.left)/r.width*100,y=(e.clientY-r.top)/r.height*100;x=Math.max(7,Math.min(93,x));y=Math.max(6,Math.min(94,y));p.dataset.x=x.toFixed(2);p.dataset.y=y.toFixed(2);p.style.setProperty('--x',x+'%');p.style.setProperty('--y',y+'%');status(`Position ${x.toFixed(0)}% × ${y.toFixed(0)}%`)};
    p.addEventListener('pointerdown',e=>{down=true;p.classList.add('dragging');p.setPointerCapture?.(e.pointerId);move(e);e.preventDefault()});p.addEventListener('pointermove',move); const end=async e=>{if(!down)return;down=false;p.classList.remove('dragging');try{p.releasePointerCapture?.(e.pointerId)}catch(_){ }const client=db();const f=document.getElementById('nl4ManualFormation')?.value||null;status('Saving position…');const {error}=await client.from('match_lineups').update({position_x:Number(p.dataset.x),position_y:Number(p.dataset.y),formation:f,updated_at:new Date().toISOString()}).eq('id',p.dataset.id);status(error?'Save failed: '+error.message:'Position saved ✓');}; p.addEventListener('pointerup',end);p.addEventListener('pointercancel',end);
  }
  async function autoArrange(){if(!fixtureId)return status('Open a fixture first.');const starters=rows.filter(r=>r.is_starter);if(!starters.length)return status('No saved starters found.');const f=document.getElementById('nl4ManualFormation').value,coords=FORMATIONS[f];status('Saving arrangement…');for(let i=0;i<starters.length;i++){const [x,y]=coords[i]||[50,50];const {error}=await db().from('match_lineups').update({position_x:x,position_y:y,formation:f,updated_at:new Date().toISOString()}).eq('id',starters[i].id);if(error){status('Save failed: '+error.message);return;}}await load();status(f+' arranged and saved ✓');}

  function hook(){ensureUI(); const old=window.nl4ManageMatch; if(typeof old==='function'&&!old.__manualPatch){const wrapped=async function(id){fixtureId=id;const v=await old.apply(this,arguments);setTimeout(load,50);return v};wrapped.__manualPatch=true;window.nl4ManageMatch=wrapped;status('Manual lineup ready — open a match with Manage.');} else if(typeof old!=='function'){setTimeout(hook,250);} }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(hook,0));else setTimeout(hook,0);
})();
