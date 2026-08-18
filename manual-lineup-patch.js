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
    #nl4ManualPitch{position:relative;width:min(100%,620px);aspect-ratio:72/104;margin:auto;overflow:hidden;border:2px solid #fff;border-radius:12px;background:repeating-linear-gradient(0deg,#30994c 0 10%,#278b43 10% 20%);touch-action:none;user-select:none;-webkit-user-select:none}
    #nl4ManualPitch:before{content:"";position:absolute;left:0;right:0;top:50%;height:2px;background:#fff}#nl4ManualPitch:after{content:"";position:absolute;left:50%;top:50%;width:24%;aspect-ratio:1;border:2px solid #fff;border-radius:50%;transform:translate(-50%,-50%)}
    #nl4ManualPitch .box{position:absolute;left:22%;right:22%;height:15%;border:2px solid rgba(255,255,255,.9);pointer-events:none}.box.top{top:-2px}.box.bottom{bottom:-2px}
    .nl4-manual-player{position:absolute;left:var(--x);top:var(--y);transform:translate(-50%,-50%);width:76px;display:grid;justify-items:center;cursor:grab;touch-action:none;z-index:10}.nl4-manual-player.dragging{cursor:grabbing;z-index:50}
    .nl4-manual-shirt{width:42px;height:48px;border-radius:8px 8px 12px 12px;background:linear-gradient(90deg,#fff 0 18%,#d6001f 18% 82%,#fff 82%);border:1px solid rgba(255,255,255,.8);box-shadow:0 8px 12px rgba(0,0,0,.38);display:grid;place-items:center;color:#fff;font-size:16px;font-weight:1000;text-shadow:0 1px 2px #000}.nl4-manual-name{margin-top:3px;max-width:76px;padding:3px 5px;border-radius:6px;background:rgba(0,0,0,.75);color:#fff;font-size:8px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    @media(max-width:560px){#nl4ManualLineupPatch{padding:10px}.nl4-manual-player{width:62px}.nl4-manual-shirt{width:35px;height:41px;font-size:14px}.nl4-manual-name{max-width:62px;font-size:7px}}
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
      <div id="nl4ManualPitch"><span class="box top"></span><span class="box bottom"></span></div><div id="nl4ManualStatus" class="ml-status">Open a match to load its starters.</div>`;
    list.parentNode.insertBefore(box,list);
    document.getElementById('nl4ManualArrange').addEventListener('click',autoArrange);
    document.getElementById('nl4ManualReload').addEventListener('click',load);
    document.getElementById('nl4ManualFormation').addEventListener('change',render);
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
    render(); status(`${rows.filter(r=>r.is_starter).length} starter(s) loaded — drag to position.`);
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
