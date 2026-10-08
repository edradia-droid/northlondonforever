(function(){
  const formations={
    '4-3-3':[['GK',50,90],['LB',15,72],['LCB',38,72],['RCB',62,72],['RB',85,72],['LCM',27,49],['CM',50,52],['RCM',73,49],['LW',18,23],['ST',50,17],['RW',82,23]],
    '4-2-3-1':[['GK',50,90],['LB',15,72],['LCB',38,72],['RCB',62,72],['RB',85,72],['LDM',38,56],['RDM',62,56],['LAM',20,34],['CAM',50,31],['RAM',80,34],['ST',50,15]],
    '4-4-2':[['GK',50,90],['LB',15,72],['LCB',38,72],['RCB',62,72],['RB',85,72],['LM',15,47],['LCM',38,50],['RCM',62,50],['RM',85,47],['LST',38,20],['RST',62,20]],
    '3-4-3':[['GK',50,90],['LCB',27,72],['CB',50,74],['RCB',73,72],['LWB',14,49],['LCM',39,50],['RCM',61,50],['RWB',86,49],['LW',20,22],['ST',50,17],['RW',80,22]],
    '3-5-2':[['GK',50,90],['LCB',27,72],['CB',50,74],['RCB',73,72],['LWB',14,50],['LCM',34,51],['CAM',50,38],['RCM',66,51],['RWB',86,50],['LST',39,19],['RST',61,19]],
    '4-1-4-1':[['GK',50,90],['LB',15,72],['LCB',38,72],['RCB',62,72],['RB',85,72],['DM',50,59],['LM',16,42],['LCM',38,43],['RCM',62,43],['RM',84,42],['ST',50,16]]
  };
  /*
   * Shared NL4 prediction configuration.
   * Competition pages can load this same prediction UI with a different
   * competition key without duplicating the prediction engine.
   */
  const params=new URLSearchParams(location.search);
  const fixtureRef=params.get('fixture') || '';
  const competition=(params.get('competition') || 'pl').toLowerCase();
  const predictionConfig=(window.NL4_PREDICTION_CONFIG?.[competition]) || window.NL4_PREDICTION_CONFIG.pl;
  let fixtureUuid=null;
  let players=[];
  let db=null;

  // Persist the fan's working lineup locally, per fixture.
  // This is a draft only: it does not submit anything to Supabase.
  const draftStorageKey=()=>`nl4-predict-lineup-draft:${fixtureRef || 'general'}`;

  function saveDraft(){
    try{
      const starters={};
      document.querySelectorAll('[data-slot]').forEach(select=>{
        const value=String(select.value || '').trim();
        if(value) starters[select.dataset.slot]=value;
      });
      const substitutes=[...document.querySelectorAll('[data-sub]:checked')]
        .map(input=>String(input.value || '').trim())
        .filter(Boolean);

      localStorage.setItem(draftStorageKey(),JSON.stringify({
        version:1,
        formation:document.getElementById('formation')?.value || '4-3-3',
        displayMode:document.getElementById('displayMode')?.value || 'photos',
        kit:document.getElementById('kit')?.value || 'home',
        starters,
        substitutes,
        savedAt:new Date().toISOString()
      }));
    }catch(error){
      console.warn('NL4 lineup draft could not be saved:',error);
    }
  }

  function loadDraft(){
    try{
      const raw=localStorage.getItem(draftStorageKey());
      if(!raw) return null;
      const data=JSON.parse(raw);
      return data && typeof data==='object' ? data : null;
    }catch(error){
      console.warn('NL4 lineup draft could not be restored:',error);
      return null;
    }
  }

  function restoreDraft(){
    const draft=loadDraft();
    if(!draft) return false;

    if(formations[draft.formation]){
      document.getElementById('formation').value=draft.formation;
    }
    if(['photos','initials'].includes(draft.displayMode)){
      displayMode=draft.displayMode;
    }
    if(['home','away'].includes(draft.kit)){
      document.getElementById('kit').value=draft.kit;
      document.body.dataset.kit=draft.kit;
    }

    // renderPitch() creates the slot selectors, so restore their values after it runs.
    renderPitch();
    const starterMap=draft.starters && typeof draft.starters==='object' ? draft.starters : {};
    document.querySelectorAll('[data-slot]').forEach(select=>{
      select.value=starterMap[select.dataset.slot] || '';
    });

    renderSubs();

    const substituteSet=new Set(
      Array.isArray(draft.substitutes) ? draft.substitutes.map(norm) : []
    );
    document.querySelectorAll('[data-sub]').forEach(input=>{
      input.checked=substituteSet.has(norm(input.value));
    });

    applyDisplayMode();
    updateDownloadSubs();
    saveDraft();
    return true;
  }
  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function voterKey(){
    let k=localStorage.getItem('nl4_fan_voter_key');
    if(!k){k='fan_'+(crypto.randomUUID?crypto.randomUUID():Date.now()+'_'+Math.random().toString(36).slice(2));localStorage.setItem('nl4_fan_voter_key',k);}
    return k;
  }
  function options(){
    return '<option value="">Choose player</option>'+players.map(p=>`<option value="${esc(p.name)}">${esc(p.name)} • ${esc(p.pos)}</option>`).join('');
  }
  function initials(name){
    return String(name||'').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase() || '?';
  }
  const PLAYER_PHOTOS = {
    "david raya martin":"assets/player-cutouts/player-01.png","david raya":"assets/player-cutouts/player-01.png","raya":"assets/player-cutouts/player-01.png",
    "kepa arrizabalaga revuelta":"assets/player-cutouts/player-02.png","kepa arrizabalaga":"assets/player-cutouts/player-02.png","arrizabalaga":"assets/player-cutouts/player-02.png",
    "illan meslier":"assets/player-cutouts/player-03.png","meslier":"assets/player-cutouts/player-03.png",
    "tommy setford":"assets/player-cutouts/player-04.png",
    "william saliba":"assets/player-cutouts/player-05.png","saliba":"assets/player-cutouts/player-05.png",
    "cristhian mosquera":"assets/player-cutouts/player-06.png","mosquera":"assets/player-cutouts/player-06.png",
    "benjamin white":"assets/player-cutouts/player-07.png","ben white":"assets/player-cutouts/player-07.png","white":"assets/player-cutouts/player-07.png",
    "piero hincapie":"assets/player-cutouts/player-08.png","hincapie":"assets/player-cutouts/player-08.png",
    "gabriel dos santos magalhaes":"assets/player-cutouts/player-09.png","gabriel magalhaes":"assets/player-cutouts/player-09.png","gabriel":"assets/player-cutouts/player-09.png",
    "jurrien timber":"assets/player-cutouts/player-10.png","jurriën timber":"assets/player-cutouts/player-10.png","j timber":"assets/player-cutouts/player-10.png",
    "ezri konsa ngoyo":"assets/player-cutouts/player-11.png","ezri konsa":"assets/player-cutouts/player-11.png","konsa":"assets/player-cutouts/player-11.png",
    "riccardo calafiori":"assets/player-cutouts/player-12.png","calafiori":"assets/player-cutouts/player-12.png",
    "declan rice":"assets/player-cutouts/player-13.png","rice":"assets/player-cutouts/player-13.png",
    "bruno guimaraes rodriguez moura":"assets/player-cutouts/player-14.png","bruno guimaraes":"assets/player-cutouts/player-14.png","bruno g":"assets/player-cutouts/player-14.png",
    "martin odegaard":"assets/player-cutouts/odegaard-transparent.png",
    "martin zubimendi ibanez":"assets/player-cutouts/player-16.png","martin zubimendi":"assets/player-cutouts/player-16.png","zubimendi":"assets/player-cutouts/player-16.png",
    "mikel merino zazon":"assets/player-cutouts/player-17.png","mikel merino":"assets/player-cutouts/player-17.png","merino":"assets/player-cutouts/player-17.png",
    "myles lewis skelly":"assets/player-cutouts/player-18.png","lewis skelly":"assets/player-cutouts/player-18.png",
    "eberechi eze":"assets/player-cutouts/player-19.png","eze":"assets/player-cutouts/player-19.png",
    "ethan nwaneri":"assets/player-cutouts/player-20.png","nwaneri":"assets/player-cutouts/player-20.png",
    "max dowman":"assets/player-cutouts/player-21.png","dowman":"assets/player-cutouts/player-21.png",
    "christos tzolis":"assets/player-cutouts/player-22.png","tzolis":"assets/player-cutouts/player-22.png",
    "bukayo saka":"assets/player-cutouts/player-23.png","saka":"assets/player-cutouts/player-23.png",
    "noni madueke":"assets/player-cutouts/player-24.png","madueke":"assets/player-cutouts/player-24.png",
    "kai havertz":"assets/player-cutouts/player-25.png","havertz":"assets/player-cutouts/player-25.png",
    "viktor gyokeres":"assets/player-cutouts/player-26.png","gyokeres":"assets/player-cutouts/player-26.png"
  };
  function norm(value){return String(value||'').toLowerCase().replace(/\u00f8/g,'o').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();}
  function seedPlayersFromAuthoritativeSquad(){
    const squad=window.NL4_FINAL_PL_SQUADS?.Arsenal;
    if(!Array.isArray(squad)||!squad.length)return false;
    players=squad.map(p=>{
      const name=String(p.name||'').trim();
      return {name,pos:String(p.position||'Player'),webName:String(p.webName||'').trim(),feedName:name,image_url:playerPhotoUrl({name,webName:p.webName,feedName:name})};
    }).filter(p=>p.name);
    return players.length>0;
  }
  function playerPhotoUrl(player){
    const keyCandidates=[player?.name,player?.webName,player?.feedName].filter(Boolean).map(norm);
    const file=keyCandidates.map(k=>PLAYER_PHOTOS[k]).find(Boolean);
    return file ? new URL(file,document.baseURI).href : '';
  }
  function renderPitch(){
    const slots=formations[document.getElementById('formation').value]||formations['4-3-3'];
    const pitch=document.getElementById('pitch');
    pitch.innerHTML='<span class="goal top" aria-hidden="true"></span><span class="goal bottom" aria-hidden="true"></span><span class="circle"></span><span class="box top"></span><span class="box bottom"></span><span class="goal-area top"></span><span class="goal-area bottom"></span><span class="penalty-arc top"></span><span class="penalty-arc bottom"></span>'+
      slots.map(([slot,x,y])=>`<label class="slot" style="left:${x}%;top:${y}%">
        <div class="shirt" data-player-visual><span class="player-photo placeholder">+</span></div>
        <div class="slot-name">${esc(slot)}</div>
        <select class="screen-only" data-slot="${esc(slot)}">${options()}</select>
        <div class="export-player-name export-only" data-export-name>SELECT PLAYER</div>
      </label>`).join('');

    // renderPitch rebuilds the pitch HTML, so the watermark must be rebuilt
    // here as well. Keeping it in this function prevents formation changes,
    // draft restoration, or refresh initialization from removing it.
    pitch.insertAdjacentHTML('afterbegin',
      '<span class="pitch-watermark-wrap" aria-hidden="true">'+
        '<span class="pitch-watermark-fallback">NL4</span>'+
        '<img class="pitch-watermark" src="https://i.postimg.cc/GhGgj8G7/75c7b198-597a-4288-abae-723c809c34fa.png" alt="" aria-hidden="true" draggable="false" onload="this.closest(\'.pitch-watermark-wrap\').classList.add(\'has-logo\')" onerror="this.style.display=\'none\'">'+
      '</span>'
    );
  }
  function findPlayer(name){
    const target=norm(name);
    return players.find(p=>norm(p.name)===target) || null;
  }
  let displayMode=localStorage.getItem('nl4_predict_lineup_display_mode') || 'photos';
  function applyDisplayMode(){
    const control=document.getElementById('displayMode');
    if(control)control.value=displayMode;
    document.body.dataset.lineupDisplay=displayMode;
    document.querySelectorAll('[data-slot]').forEach(select=>updatePlayerVisual(select));
    renderSubs();
  }
  function updatePlayerVisual(select){
    const slot=select.closest('.slot');
    if(!slot)return;
    const visual=slot.querySelector('[data-player-visual]');
    const exportName=slot.querySelector('[data-export-name]');
    const player=findPlayer(select.value);
    const localPhoto=playerPhotoUrl(player);
    const imageSrc=localPhoto || player?.image_url || '';
    if(visual){
      if(displayMode==='initials'){
        visual.innerHTML=player ? `<span class="player-initials" aria-label="${esc(player.name)} initials">${esc(initials(player.name))}</span>` : '<span class="player-photo placeholder">+</span>';
      }else{
        visual.innerHTML=imageSrc
          ? `<img class="player-photo${norm(player.name)==="martin odegaard"?" odegaard-photo":""}" src="${esc(imageSrc)}" alt="${esc(player.name)}" referrerpolicy="no-referrer" loading="eager" decoding="async" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'player-photo placeholder',textContent:'${esc(initials(player.name))}'}))">`
          : `<span class="player-photo placeholder">${esc(initials(player?.name))}</span>`;
      }
    }
    if(exportName) exportName.textContent=player?.name || 'SELECT PLAYER';
    const selectedPhoto=slot.querySelector('[data-selected-player-photo]');
    if(selectedPhoto) selectedPhoto.innerHTML=imageSrc
      ? `<img class="selected-player-photo${norm(player.name)==="martin odegaard"?" odegaard-photo":""}" src="${esc(imageSrc)}" alt="${esc(player.name)}" referrerpolicy="no-referrer" loading="eager" decoding="async">`
      : (player ? `<span class="selected-player-photo placeholder">${esc(initials(player.name))}</span>` : '');
  }
  function starterNamesSet(){
    return new Set([...document.querySelectorAll('[data-slot]')]
      .map(select=>norm(select.value))
      .filter(Boolean));
  }
  function selectedSubNamesSet(){
    return new Set([...document.querySelectorAll('[data-sub]:checked')]
      .map(input=>norm(input.value))
      .filter(Boolean));
  }
  function renderSubs(){
    const starters=starterNamesSet();
    const previouslySelected=selectedSubNamesSet();
    document.getElementById('subs').innerHTML=players
      .filter(p=>!starters.has(norm(p.name)))
      .map(p=>{
        const src=playerPhotoUrl(p) || p.image_url || '';
        const checked=previouslySelected.has(norm(p.name)) ? ' checked' : '';
        const photo=displayMode==='initials'
          ? `<span class="sub-initials" aria-label="${esc(p.name)} initials">${esc(initials(p.name))}</span>`
          : (src
            ? `<img class="sub-photo${norm(p.name)==='martin odegaard'?' odegaard-photo':''}" src="${esc(src)}" alt="${esc(p.name)}" referrerpolicy="no-referrer" loading="eager" decoding="async" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'sub-photo placeholder',textContent:'${esc(initials(p.name))}'}))">`
            : `<span class="sub-photo placeholder">${esc(initials(p.name))}</span>`);
        return `<label class="sub">
          <input type="checkbox" value="${esc(p.name)}" data-sub${checked}>
          ${photo}
          <span class="sub-info"><span class="sub-name">${esc(p.name)}</span><span class="sub-pos">${esc(p.pos)}</span></span>
        </label>`;
      }).join('');
  }
  function setMsg(id,text,good=false){
    const e=document.getElementById(id); e.textContent=text; e.className='msg '+(good?'good':'bad');
  }

  // Seed the selector immediately from the authoritative squad.
  seedPlayersFromAuthoritativeSquad();
  renderPitch();
  renderSubs();
  const kitControl=document.getElementById('kit');
  document.body.dataset.kit=kitControl?.value==='away'?'away':'home';
  applyDisplayMode();
  const initialFormation=document.getElementById('downloadFormation');
  if(initialFormation)initialFormation.textContent=document.getElementById('formation').value;
  updateDownloadSubs?.();

  async function waitForDb(){
    for(let i=0;i<40;i++){
      if(window.nl4Supabase && typeof window.nl4Supabase.from==='function') return window.nl4Supabase;
      await new Promise(r=>setTimeout(r,100));
    }
    return null;
  }

  async function init(){
    const boot=document.getElementById('bootStatus') || {textContent:'',className:''};
    if(!fixtureRef){boot.textContent='ERROR • fixture ID missing from URL';boot.className='status bad';return;}
    db=await waitForDb();
    if(!db){boot.textContent='SUPABASE CLIENT NOT FOUND • check supabase-client.js';boot.className='status bad';return;}
    boot.textContent='SUPABASE CONNECTED • resolving fixture';boot.className='status good';

    const isUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(fixtureRef);
    const baseQuery=db.from('fixtures')
      .select('id,external_fixture_id,home_team,away_team,is_home,opponent,kickoff_at,status,is_published');

    const fixtureRes=isUuid
      ? await baseQuery.eq('id',fixtureRef).maybeSingle()
      : await baseQuery.eq('external_fixture_id',fixtureRef).maybeSingle();

    if(fixtureRes.error || !fixtureRes.data){
      boot.textContent='FIXTURE LOAD FAILED • '+(fixtureRes.error?.message||'not found');boot.className='status bad';return;
    }

    const f=fixtureRes.data;
    fixtureUuid=f.id;
    restoreScorePredictionLock();
    const home=f.home_team||(f.is_home?'Arsenal':f.opponent)||'Home', away=f.away_team||(f.is_home?f.opponent:'Arsenal')||'Away';
    document.getElementById('heading').textContent=`${home} vs ${away}`;
    document.getElementById('homeTeam').textContent=home; document.getElementById('awayTeam').textContent=away;
    const fixtureDate=new Date(f.kickoff_at).toLocaleString();
    document.getElementById('meta').textContent=fixtureDate;
    const dlFixture=document.getElementById('downloadFixture');
    const dlMeta=document.getElementById('downloadMeta');
    if(dlFixture) dlFixture.textContent=`${home} vs ${away}`;
    if(dlMeta) dlMeta.textContent=fixtureDate;

    const squadSource=window[predictionConfig.squadGlobal];
    let squadFeed=squadSource?.Arsenal;

    // Champions League player pool is sourced from the existing BSD-derived
    // UCL player statistics table. Carabao uses the shared current Arsenal
    // squad feed; no competition player list is hardcoded here.
    if((!Array.isArray(squadFeed)||!squadFeed.length) && predictionConfig.key==='cl'){
      const uclSquadResult=await db.from('ucl_player_stats')
        .select('player_name,position')
        .eq('season','2026/27')
        .eq('team_name','Arsenal')
        .order('player_name');
      if(uclSquadResult.error){
        boot.textContent='AUTHORITATIVE ARSENAL CHAMPIONS LEAGUE SQUAD FEED UNAVAILABLE';
        boot.className='status bad';
        return;
      }
      squadFeed=(uclSquadResult.data||[]).map(player=>({
        name:player.player_name,
        webName:player.player_name,
        position:player.position||'',
        number:null,
        fplId:null
      }));
    }

    if(!Array.isArray(squadFeed)||!squadFeed.length){
      boot.textContent=`AUTHORITATIVE ARSENAL ${predictionConfig.name.toUpperCase()} SQUAD FEED UNAVAILABLE`;
      boot.className='status bad';
      return;
    }

    const norm=value=>String(value||'').toLowerCase().replace(/[ø]/g,'o').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
    const identityTokens=value=>norm(value).split(' ').filter(Boolean);
    const sameIdentity=(a,b)=>{
      if(!a||!b)return false;
      if(a===b)return true;
      const aa=identityTokens(a),bb=identityTokens(b);
      if(!aa.length||!bb.length)return false;
      const sa=new Set(aa),sb=new Set(bb);
      const overlap=aa.filter(x=>sb.has(x)).length;
      const surname=aa[aa.length-1]===bb[bb.length-1];
      const first=aa[0]===bb[0];
      const surnameOnly=(aa.length===1||bb.length===1)&&surname;
      return (surname&&first)||(surname&&overlap>=2)||surnameOnly||(overlap>=2&&Math.min(sa.size,sb.size)<=2);
    };
    const findStat=(feedPlayer,rows)=>{
      const targets=[feedPlayer.name,feedPlayer.webName].filter(Boolean).map(norm);
      for(const target of targets){
        const hit=rows.find(row=>[row.player_name,row.name].filter(Boolean).map(norm).includes(target));
        if(hit)return hit;
      }
      for(const target of targets){
        const hit=rows.find(row=>[row.player_name,row.name].filter(Boolean).some(name=>sameIdentity(target,norm(name))));
        if(hit)return hit;
      }
      return null;
    };

    const squadRes=await db.from('premier_league_player_stats')
      .select('player_name,position,image_url')
      .eq('season','2026/27')
      .order('player_name');
    // Player selection must remain available from the authoritative squad feed even
    // if the optional stats enrichment query is unavailable.
    if(squadRes.error){
      console.warn('Optional player-stats enrichment unavailable:',squadRes.error.message);
    }
    const rows=squadRes.data||[];
    // The authoritative squad feed is the source of selectable players.
    // Stats rows are used when available for position/image metadata, but a missing
    // stats row must never remove a registered Arsenal player from the selector.
    players=squadFeed.map(feedPlayer=>{
      const stat=findStat(feedPlayer,rows);
      const playerName=String(feedPlayer.name||stat?.player_name||'').trim();
      return {
        name:playerName,
        pos:String(stat?.position||feedPlayer.position||'Player'),
        webName:String(feedPlayer.webName||stat?.player_name||'').trim(),
        feedName:playerName,
        image_url:playerPhotoUrl({
          name:playerName,
          webName:feedPlayer.webName,
          feedName:playerName
        }) || String(stat?.image_url||'').trim()
      };
    }).filter(player=>player.name);

    // The authoritative squad is now available. Restore the draft AFTER rendering
    // the player selectors, otherwise the async squad load would overwrite it.
    const restoredDraft=restoreDraft();
    if(!restoredDraft){
      renderPitch();
      renderSubs();
      applyDisplayMode();
    }
    boot.textContent=`READY • ${players.length} current ${predictionConfig.name} squad players loaded • fixture resolved`;
    boot.className='status good';

    const closed=new Date(f.kickoff_at)<=new Date() || ['live','1h','ht','2h','et','fulltime','finished','ft','aet','pen','played'].includes(String(f.status||'').toLowerCase());
    if(closed){document.getElementById('saveScore').disabled=true;document.getElementById('saveLineup').disabled=true;setMsg('scoreMsg','Predictions are closed.');setMsg('lineupMsg','Predictions are closed.');}
  }

  document.getElementById('displayMode').addEventListener('change',e=>{
    displayMode=e.target.value==='initials'?'initials':'photos';
    localStorage.setItem('nl4_predict_lineup_display_mode',displayMode);
    applyDisplayMode();
    saveDraft();
  });
  document.getElementById('kit').addEventListener('change',e=>{
    document.body.dataset.kit=e.target.value==='away'?'away':'home';
    applyDisplayMode();
    saveDraft();
  });
  document.getElementById('formation').addEventListener('change',()=>{
    /*
     * Changing formation rebuilds the pitch selectors. Preserve the user's
     * selected players while changing only their available positions.
     */
    const previousSelections=[...document.querySelectorAll('[data-slot]')]
      .map(select=>({
        slot:select.dataset.slot,
        player:String(select.value||'').trim()
      }))
      .filter(item=>item.player);

    renderPitch();

    const newSlots=[...document.querySelectorAll('[data-slot]')];
    /*
     * Do not call the fixture-local norm() helper here. It is declared inside
     * init(), so using it from this event handler would throw after renderPitch()
     * and leave the newly-created selectors empty.
     */
    const playerKey=value=>String(value||'').trim().toLowerCase();

    const bySlot=new Map(previousSelections.map(item=>[item.slot,item.player]));
    const used=new Set();

    // Keep players in the same semantic slot where that slot still exists.
    newSlots.forEach(select=>{
      const player=bySlot.get(select.dataset.slot);
      if(player && !used.has(playerKey(player))){
        select.value=player;
        used.add(playerKey(player));
      }
    });

    // If the new formation has different slot names, keep every remaining
    // selected player by carrying them into the remaining empty positions.
    const remaining=previousSelections
      .map(item=>item.player)
      .filter(player=>!used.has(playerKey(player)));

    newSlots.forEach(select=>{
      if(select.value) return;
      const next=remaining.find(player=>!used.has(playerKey(player)));
      if(!next) return;
      select.value=next;
      used.add(playerKey(next));
    });

    newSlots.forEach(select=>updatePlayerVisual(select));
    renderSubs();
    applyDisplayMode();
    updateDownloadSubs();
    saveDraft();

    const f=document.getElementById('downloadFormation');
    if(f)f.textContent=document.getElementById('formation').value;
  });
  document.getElementById('pitch').addEventListener('change',e=>{
    if(e.target.matches('[data-slot]')){
      updatePlayerVisual(e.target);
      renderSubs();
      updateDownloadSubs();
      saveDraft();
    }
  });
  function updateDownloadSubs(){
    const checked=[...document.querySelectorAll('[data-sub]:checked')].map(x=>x.value);
    const el=document.getElementById('downloadSubs');
    if(el) el.textContent=checked.length
      ? checked.join(' • ')
      : 'No substitutes selected yet.';
  }

  document.getElementById('subs').addEventListener('change',()=>{
    const checked=[...document.querySelectorAll('[data-sub]:checked')];
    if(checked.length>9){
      checked.at(-1).checked=false;
      setMsg('lineupMsg','Maximum 9 substitutes.');
    }
    updateDownloadSubs();
    saveDraft();
  });

  function scoreLockKey(){
    return fixtureUuid ? `nl4-score-prediction:${fixtureUuid}` : null;
  }
  function lockScorePredictionUI(homeScore=null,awayScore=null){
    const btn=document.getElementById('saveScore');
    const hs=document.getElementById('homeScore');
    const as=document.getElementById('awayScore');
    if(hs)hs.disabled=true;
    if(as)as.disabled=true;
    if(btn){btn.disabled=true;btn.textContent='Score Prediction Submitted';}
    const suffix=(homeScore!==null && awayScore!==null) ? ` • ${homeScore}-${awayScore}` : '';
    setMsg('scoreMsg',`SAVED ✓ One score prediction allowed for this fixture${suffix}.`,true);
  }
  function restoreScorePredictionLock(){
    const key=scoreLockKey();
    if(!key)return;
    try{
      const saved=JSON.parse(localStorage.getItem(key)||'null');
      if(saved)lockScorePredictionUI(saved.home,saved.away);
    }catch(_){}
  }

  document.getElementById('saveScore').addEventListener('click',async()=>{
    if(!db){setMsg('scoreMsg','Supabase is not connected.');return;}
    if(!fixtureUuid){setMsg('scoreMsg','Fixture has not resolved to a Supabase UUID yet.');return;}
    const hs=Number(document.getElementById('homeScore').value), as=Number(document.getElementById('awayScore').value);
    setMsg('scoreMsg','Saving score prediction…');
    const {data,error}=await db.rpc('submit_fan_prediction',{
      p_fixture_id:fixtureUuid,p_voter_key:voterKey(),p_mode:'score',p_formation:null,p_kit:null,
      p_starters:[],p_substitutes:[],p_home_score:hs,p_away_score:as
    });
    if(error){
      if(String(error.message||'').toLowerCase().includes('already submitted a score prediction')){
        lockScorePredictionUI();
        return;
      }
      return setMsg('scoreMsg','SAVE FAILED • '+error.message);
    }
    try{
      const key=scoreLockKey();
      if(key)localStorage.setItem(key,JSON.stringify({home:hs,away:as,savedAt:new Date().toISOString()}));
    }catch(_){}
    lockScorePredictionUI(hs,as);
    console.log('NL4 score prediction saved',data);
  });

  document.getElementById('saveLineup').addEventListener('click',async()=>{
    if(!db){setMsg('lineupMsg','Supabase is not connected.');return;}
    if(!fixtureUuid){setMsg('lineupMsg','Fixture has not resolved to a Supabase UUID yet.');return;}
    const starters=[...document.querySelectorAll('[data-slot]')].map(s=>({slot:s.dataset.slot,player_name:s.value.trim()}));
    if(starters.some(x=>!x.player_name)) return setMsg('lineupMsg','Choose all 11 starters first.');
    if(new Set(starters.map(x=>x.player_name.toLowerCase())).size!==11) return setMsg('lineupMsg','Each starter must be a different player.');
    saveDraft();
    const subs=[...document.querySelectorAll('[data-sub]:checked')].map(x=>x.value);
    const starterSet=new Set(starters.map(x=>x.player_name.toLowerCase()));
    if(subs.some(x=>starterSet.has(x.toLowerCase()))) return setMsg('lineupMsg','A starter cannot also be a substitute.');
    setMsg('lineupMsg','Saving lineup prediction…');
    const {data,error}=await db.rpc('submit_fan_prediction',{
      p_fixture_id:fixtureUuid,p_voter_key:voterKey(),p_mode:'lineup',
      p_formation:document.getElementById('formation').value,p_kit:document.getElementById('kit').value,
      p_starters:starters,p_substitutes:subs.map(player_name=>({player_name})),p_home_score:null,p_away_score:null
    });
    if(error) return setMsg('lineupMsg','SAVE FAILED • '+error.message);
    setMsg('lineupMsg','SAVED ✓ Lineup prediction sent to Admin Fan Predictions.',true);
    console.log('NL4 lineup prediction saved',data);
  });

  async function downloadPredictedLineup(){
    const btn=document.getElementById('downloadPredictionBtn');
    const board=document.getElementById('lineupDownloadArea');
    if(!btn||!board)return;
    if(typeof window.html2canvas!=='function'){
      alert('The download tool could not load. Check your internet connection and try again.');
      return;
    }

    const starters=[...document.querySelectorAll('[data-slot]')];
    if(starters.some(s=>!s.value.trim())){
      alert('Choose all 11 starting players before downloading your predicted XI.');
      return;
    }

    const oldText=btn.textContent;
    btn.disabled=true;
    btn.textContent='…';

    let captureState=null;
    try{
      /*
       * The live DOM is now the ONLY source for the downloaded image.
       * We do not clone, resize, transform or re-layout the pitch.
       * html2canvas captures the exact element currently visible to the user.
       */
      const liveRect=board.getBoundingClientRect();
      if(liveRect.width<=0||liveRect.height<=0){
        throw new Error('The visible lineup board has no measurable size.');
      }

      const isMobile=window.matchMedia('(max-width:520px)').matches;

      // On mobile, capture the REAL board at the full viewport width.
      // The board is restored immediately after capture, so the live page
      // does not remain changed.
      const originalBoardStyle=isMobile ? {
        width:board.style.width,
        maxWidth:board.style.maxWidth,
        minWidth:board.style.minWidth,
        marginLeft:board.style.marginLeft,
        marginRight:board.style.marginRight,
        position:board.style.position,
        left:board.style.left
      } : null;

      if(isMobile){
        board.style.width='100vw';
        board.style.maxWidth='100vw';
        board.style.minWidth='100vw';
        board.style.marginLeft='calc((100% - 100vw) / 2)';
        board.style.marginRight='0';
        board.style.position='relative';
        board.style.left='0';
      }

      // Temporarily hide only controls that must not appear in the download.
      captureState={
        controls:[],
        exportOnly:[],
        scrollX:window.scrollX,
        scrollY:window.scrollY,
        originalBoardStyle
      };

      board.querySelectorAll('select,input,button,.screen-only').forEach(el=>{
        captureState.controls.push({el,display:el.style.display});
        el.style.display='none';
      });

      // Show the already-rendered export names without changing pitch geometry.
      board.querySelectorAll('.export-only').forEach(el=>{
        captureState.exportOnly.push({el,display:el.style.display});
        el.style.display='block';
      });

      // Ensure export names reflect the actual live selections.
      const liveSlots=[...board.querySelectorAll('.slot')];
      liveSlots.forEach(slot=>{
        const selected=slot.querySelector('[data-slot]')?.value?.trim()||'';
        const target=slot.querySelector('[data-export-name]');
        if(target) target.textContent=selected;
      });

      // Wait for all visible board images to be ready before capture.
      const images=[...board.querySelectorAll('img')];
      await Promise.all(images.map(img=>{
        if(img.complete){
          return img.decode ? img.decode().catch(()=>{}) : Promise.resolve();
        }
        return new Promise(resolve=>{
          const done=()=>resolve();
          img.addEventListener('load',done,{once:true});
          img.addEventListener('error',done,{once:true});
        });
      }));

      /*
       * Capture the REAL live board dimensions. No custom width, height,
       * transform, viewport width, clone, or export layout is supplied.
       */
      const pixelRatio=Math.min(2,Math.max(1,window.devicePixelRatio||1.5));
      const canvas=await html2canvas(board,{
        backgroundColor:'#080808',
        scale:pixelRatio,
        useCORS:true,
        allowTaint:false,
        logging:false
      });

      // The board was already captured at the correct viewport width.
      // Do not apply a second bitmap stretch.
      const downloadCanvas=canvas;

      const fixture=(document.getElementById('downloadFixture')?.textContent||'arsenal-predicted-xi')
        .replace(/[^A-Za-z0-9\-]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase();

      const link=document.createElement('a');
      link.download=(fixture || 'arsenal-predicted-xi')+'-my-predicted-xi.png';
      link.href=downloadCanvas.toDataURL('image/png',1);
      document.body.appendChild(link);
      link.click();
      link.remove();
    }catch(err){
      console.error('Predicted lineup download failed:',err);
      alert('Could not create your predicted lineup image. Please try again.');
    }finally{
      if(captureState){
        captureState.controls.forEach(item=>item.el.style.display=item.display);
        captureState.exportOnly.forEach(item=>item.el.style.display=item.display);
        if(captureState.originalBoardStyle){
          const s=captureState.originalBoardStyle;
          board.style.width=s.width;
          board.style.maxWidth=s.maxWidth;
          board.style.minWidth=s.minWidth;
          board.style.marginLeft=s.marginLeft;
          board.style.marginRight=s.marginRight;
          board.style.position=s.position;
          board.style.left=s.left;
        }
        window.scrollTo(captureState.scrollX,captureState.scrollY);
      }
      btn.disabled=false;
      btn.textContent=oldText;
    }
  }

  document.getElementById('downloadPredictionBtn')?.addEventListener('click',downloadPredictedLineup);

  window.addEventListener('pagehide',saveDraft);
  window.addEventListener('beforeunload',saveDraft);

  init().catch(err=>{const boot=document.getElementById('bootStatus');if(boot){boot.textContent='PAGE ERROR • '+err.message;boot.className='status bad';}console.error(err);});
})();
