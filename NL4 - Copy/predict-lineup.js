/* NL4 Fan Predicted XI */
(function(){
  const db = window.nl4Supabase || window.supabaseClient || window.db || null;
  const params = new URLSearchParams(location.search);
  const fixtureRef = params.get('fixture') || '';

  const PITCH_COORDS = {
    GK:[50,89],
    LB:[13,72], LCB:[36,74], CB:[50,74], RCB:[64,74], RB:[87,72],
    LWB:[10,57], RWB:[90,57],
    DM:[50,58], LDM:[35,59], RDM:[65,59],
    LM:[11,45], LCM:[34,47], CM:[50,47], RCM:[66,47], RM:[89,45],
    LAM:[27,34], CAM:[50,33], RAM:[73,34],
    LW:[12,20], RW:[88,20], ST:[50,15], LST:[35,18], RST:[65,18]
  };
  const FORMATIONS = {
    '4-3-3':['GK','LB','LCB','RCB','RB','LCM','CM','RCM','LW','ST','RW'],
    '4-2-3-1':['GK','LB','LCB','RCB','RB','LDM','RDM','LAM','CAM','RAM','ST'],
    '4-4-2':['GK','LB','LCB','RCB','RB','LM','LCM','RCM','RM','LST','RST'],
    '3-4-3':['GK','LCB','CB','RCB','LM','LCM','RCM','RM','LW','ST','RW'],
    '3-5-2':['GK','LCB','CB','RCB','LWB','LCM','CM','RCM','RWB','LST','RST'],
    '4-1-4-1':['GK','LB','LCB','RCB','RB','DM','LM','LCM','RCM','RM','ST']
  };

  const els = {
    formation: document.getElementById('formationSelect'),
    kit: document.getElementById('kitSelect'),
    badge: document.getElementById('formationBadge'),
    pitch: document.getElementById('predictionPitch'),
    grid: document.getElementById('playerGrid'),
    pickerTitle: document.getElementById('pickerTitle'),
    count: document.getElementById('selectionCount'),
    subsText: document.getElementById('predictionSubs'),
    substituteSelect: document.getElementById('substituteSelect'),
    addSubstitute: document.getElementById('addSubstituteBtn'),
    selectedSubs: document.getElementById('selectedSubs'),
    subCount: document.getElementById('subCount'),
    matchup: document.getElementById('predictionMatchup'),
    venue: document.getElementById('predictionVenue'),
    clear: document.getElementById('clearPredictionBtn'),
    download: document.getElementById('downloadPredictionBtn'),
    board: document.getElementById('predictionExport'),
    playerSelect: document.getElementById('playerSelect'),
    addSelected: document.getElementById('addSelectedPlayerBtn'),
    playerLoadStatus: document.getElementById('playerLoadStatus'),
    submitLineup: document.getElementById('submitLineupPredictionBtn'),
    submitScore: document.getElementById('submitScorePredictionBtn'),
    submitBoth: document.getElementById('submitBothPredictionBtn'),
    lineupStatus: document.getElementById('submitLineupStatus'),
    scoreStatus: document.getElementById('submitScoreStatus'),
    bothStatus: document.getElementById('submitBothStatus'),
    communityGrid: document.getElementById('communityXiGrid'),
    communityCount: document.getElementById('communitySubmissionCount'),
    communityFormation: document.getElementById('communityFormationText'),
    homeScore: document.getElementById('predictedHomeScore'),
    awayScore: document.getElementById('predictedAwayScore'),
    scoreHomeTeam: document.getElementById('scoreHomeTeam'),
    scoreAwayTeam: document.getElementById('scoreAwayTeam'),
    scoreProbabilityList: document.getElementById('scoreProbabilityList'),
    scoreProbabilityVotes: document.getElementById('scoreProbabilityVotes')
  };

  let players = [];
  let activeSlot = 'GK';
  let selected = {};
  let substitutes = [];
  let resolvedFixtureId = null;
  let fixtureKickoff = null;
  let fixtureStatus = 'scheduled';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  function storageKey(){
    return `nl4-fan-xi:${fixtureRef || 'general'}`;
  }

  function save(){
    localStorage.setItem(storageKey(), JSON.stringify({
      formation: els.formation.value,
      kit: els.kit ? els.kit.value : 'home',
      selected,
      substitutes,
      predictedHomeScore: els.homeScore ? els.homeScore.value : '',
      predictedAwayScore: els.awayScore ? els.awayScore.value : ''
    }));
  }

  function restore(){
    try{
      const data = JSON.parse(localStorage.getItem(storageKey()) || 'null');
      if (!data) return;
      if (FORMATIONS[data.formation]) els.formation.value = data.formation;
      if (els.kit && ['home','away'].includes(data.kit)) els.kit.value = data.kit;
      selected = data.selected && typeof data.selected === 'object' ? data.selected : {};
      substitutes = Array.isArray(data.substitutes) ? data.substitutes.slice(0,9) : [];
      if (els.homeScore && data.predictedHomeScore !== undefined) els.homeScore.value = data.predictedHomeScore;
      if (els.awayScore && data.predictedAwayScore !== undefined) els.awayScore.value = data.predictedAwayScore;
    }catch(_){}
  }

  function initials(name){
    return String(name || 'A').trim().split(/\s+/).slice(0,2).map(x => x[0] || '').join('').toUpperCase();
  }

  function playerId(p){
    return String(p.id ?? p.name ?? '');
  }

  function currentSlots(){
    return FORMATIONS[els.formation.value] || FORMATIONS['4-3-3'];
  }

  function normalizeSelectionForFormation(){
    const valid = new Set(currentSlots());
    Object.keys(selected).forEach(slot => {
      if (!valid.has(slot)) delete selected[slot];
    });
  }

  function applyKitTheme(){
    const kit = els.kit && els.kit.value === 'away' ? 'away' : 'home';
    if (els.board){
      els.board.classList.toggle('kit-home', kit === 'home');
      els.board.classList.toggle('kit-away', kit === 'away');
      els.board.dataset.kit = kit;
    }
  }

  function renderPitch(){
    applyKitTheme();
    normalizeSelectionForFormation();
    els.badge.textContent = els.formation.value;

    const markings = `
      <span class="penalty-box top"></span><span class="goal-box top"></span>
      <span class="penalty-box bottom"></span><span class="goal-box bottom"></span>
      <span class="centre-spot"></span>`;

    const slotHtml = currentSlots().map(slot => {
      const [x,y] = PITCH_COORDS[slot] || PITCH_COORDS.CM;
      const p = selected[slot] || null;
      const number = p && (p.shirt_number ?? p.shirt ?? '');
      const name = p ? p.name : 'Choose player';
      const visual = p
        ? (p.image_url
            ? `<img class="player-pitch-photo" src="${esc(p.image_url)}" alt="${esc(p.name)}" crossorigin="anonymous" referrerpolicy="no-referrer">`
            : `<span class="player-pitch-placeholder">${esc(initials(p.name))}</span>`)
        : `<span class="player-pitch-placeholder">+</span>`;

      return `<div class="fan-slot" style="--x:${x}%;--y:${y}%">
        <button type="button" class="slot-button" data-slot="${esc(slot)}" aria-label="${esc(slot)} ${esc(name)}">
          ${visual}
          <span class="slot-name ${p ? '' : 'slot-hint'}">${esc(name)}</span>
        </button>
      </div>`;
    }).join('');

    els.pitch.innerHTML = markings + slotHtml;
    updateSummary();
    renderPlayers();
    save();
  }

  function updateSummary(){
    const picks = currentSlots().map(slot => selected[slot]).filter(Boolean);
    els.count.textContent = `${picks.length} / 11 selected`;

    if (els.subsText){
      els.subsText.textContent = substitutes.length
        ? substitutes.map(p => p.name).join(', ')
        : 'No substitutes selected';
    }

    if (els.subCount){
      els.subCount.textContent = `${substitutes.length} / 9 substitutes selected`;
    }
  }

  function selectedIds(){
    return new Set([
      ...Object.values(selected).filter(Boolean).map(playerId),
      ...substitutes.filter(Boolean).map(playerId)
    ]);
  }

  function renderPlayers(){
    populatePlayerSelect();
    if (!players.length){
      els.grid.innerHTML = '<div class="picker-message">No Arsenal players are available yet.</div>';
      return;
    }
    const used = selectedIds();
    els.grid.innerHTML = players.map(p => {
      const id = playerId(p);
      const already = used.has(id) && (!activeSlot || playerId(selected[activeSlot] || {}) !== id);
      const image = p.image_url
        ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy" referrerpolicy="no-referrer">`
        : `<span class="player-avatar">${esc(initials(p.name))}</span>`;
      return `<button type="button" class="player-pick ${already ? 'selected' : ''}" data-player-id="${esc(id)}" ${already ? 'disabled' : ''}>
        ${image}
        <span><strong>${esc(p.name)}</strong><small>${esc(p.position || 'Arsenal Player')}</small></span>
        <span class="num">#${esc(p.shirt_number ?? '—')}</span>
      </button>`;
    }).join('');
  }

  function populatePlayerSelect(){
    if (!els.playerSelect) return;
    const used = selectedIds();
    const currentId = activeSlot && selected[activeSlot] ? playerId(selected[activeSlot]) : '';
    els.playerSelect.innerHTML = '<option value="">Choose Arsenal player…</option>' + players.map(p => {
      const id = playerId(p);
      const disabled = used.has(id) && id !== currentId;
      const number = (p.shirt_number !== undefined && p.shirt_number !== null && p.shirt_number !== '') ? p.shirt_number : '—';
      return `<option value="${esc(id)}" ${disabled ? 'disabled' : ''}>#${esc(number)} — ${esc(p.name)}${p.position ? ` (${esc(p.position)})` : ''}</option>`;
    }).join('');
  }

  function populateSubstituteSelect(){
    if (!els.substituteSelect) return;

    const used = selectedIds();
    els.substituteSelect.innerHTML =
      '<option value="">Choose substitute player…</option>' +
      players.map(p => {
        const id = playerId(p);
        const disabled = used.has(id) || substitutes.length >= 9;
        const number =
          (p.shirt_number !== undefined && p.shirt_number !== null && p.shirt_number !== '')
            ? p.shirt_number
            : '—';

        return `<option value="${esc(id)}" ${disabled ? 'disabled' : ''}>#${esc(number)} — ${esc(p.name)}</option>`;
      }).join('');
  }

  function renderSubstitutes(){
    if (els.selectedSubs){
      if (!substitutes.length){
        els.selectedSubs.innerHTML = '<span class="picker-message">No substitutes selected yet.</span>';
      } else {
        els.selectedSubs.innerHTML = substitutes.map(p => `
          <span class="sub-chip">
            ${esc(p.name)}
            <button type="button" data-remove-sub="${esc(playerId(p))}" aria-label="Remove ${esc(p.name)}">×</button>
          </span>
        `).join('');
      }
    }

    updateSummary();
    populateSubstituteSelect();
    populatePlayerSelect();
    renderPlayers();
    save();
  }

  async function loadPlayers(){
    const merged = new Map();

    function addPlayer(raw){
      if (!raw) return;
      const name = String(raw.name || raw.player_name || '').trim();
      if (!name) return;

      const key = name.toLowerCase();
      const current = merged.get(key) || {};

      merged.set(key, {
        id: current.id ?? raw.id ?? name,
        name,
        position: current.position || raw.position || '',
        image_url: current.image_url || raw.image_url || '',
        shirt_number:
          current.shirt_number !== undefined && current.shirt_number !== null && current.shirt_number !== ''
            ? current.shirt_number
            : (raw.shirt_number ?? '')
      });
    }

    try{
      if (els.playerSelect){
        els.playerSelect.innerHTML = '<option value="">Loading Arsenal players…</option>';
      }

      if (db && typeof db.from === 'function'){
        // Main players table. Keep this query conservative so one missing optional
        // column cannot stop the whole player picker.
        let main = await db
          .from('players')
          .select('id,name,image_url,shirt_number')
          .order('name',{ascending:true});

        if (!main.error){
          (main.data || []).forEach(addPlayer);
        } else {
          console.warn('Fan XI main players query:', main.error.message);
        }

        // Current Premier League squad/stats table.
        // These are the columns already used by match-details.html in this project.
        let stats = await db
          .from('premier_league_player_stats')
          .select('id,player_name,image_url')
          .order('player_name',{ascending:true});

        if (!stats.error){
          (stats.data || []).forEach(addPlayer);
        } else {
          console.warn('Fan XI stats players query:', stats.error.message);
        }
      }

      // NL4Data fallback.
      if (!merged.size && window.NL4Data && typeof window.NL4Data.players === 'function'){
        try{
          const data = await window.NL4Data.players();
          (data || []).forEach(addPlayer);
        }catch(fallbackError){
          console.warn('Fan XI NL4Data fallback:', fallbackError.message);
        }
      }

      players = [...merged.values()].sort((a,b) =>
        String(a.name || '').localeCompare(String(b.name || ''))
      );

      if (!players.length){
        els.grid.innerHTML = '<div class="picker-message">No Arsenal players were returned. Check that players exist in the players or premier_league_player_stats table.</div>';
        if (els.playerLoadStatus) els.playerLoadStatus.textContent = '0 players available';
        if (els.playerSelect){
          els.playerSelect.innerHTML = '<option value="">No players found</option>';
          if (els.substituteSelect) els.substituteSelect.innerHTML = '<option value="">No players found</option>';
        }
        return;
      }

      populatePlayerSelect();
      populateSubstituteSelect();
      renderPlayers();
      renderSubstitutes();

      // Make the first position immediately ready.
      if (!activeSlot){
        activeSlot = currentSlots()[0];
      }
      els.pickerTitle.textContent = `Choose ${activeSlot}`;

      if (els.playerLoadStatus) els.playerLoadStatus.textContent = `${players.length} Arsenal players available`;
      console.log(`NL4 Fan XI: ${players.length} players loaded`, players);
    }catch(error){
      console.error('Fan XI players could not load:', error);
      if (els.playerLoadStatus) els.playerLoadStatus.textContent = 'Player list could not load';
      els.grid.innerHTML = `<div class="picker-message">Could not load Arsenal players: ${esc(error.message || 'Unknown error')}</div>`;
      if (els.playerSelect){
        els.playerSelect.innerHTML = '<option value="">Could not load players</option>';
        if (els.substituteSelect) els.substituteSelect.innerHTML = '<option value="">Could not load players</option>';
      }
    }
  }

  function voterKey(){
    const keyName = 'nl4-fan-voter-key';
    let key = localStorage.getItem(keyName);
    if (!key){
      key = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : `fan-${Date.now()}-${Math.random().toString(36).slice(2,12)}`;
      localStorage.setItem(keyName,key);
    }
    return key;
  }

  function predictionsOpen(){
    if (!resolvedFixtureId) return false;
    const closedStatuses = new Set(['live','1h','ht','2h','et','fulltime','finished','ft','aet','pen','played']);
    if (closedStatuses.has(String(fixtureStatus || '').toLowerCase())) return false;
    if (fixtureKickoff && new Date(fixtureKickoff).getTime() <= Date.now()) return false;
    return true;
  }

  function starterPayload(){
    return currentSlots().map(slot => {
      const p = selected[slot];
      if (!p) return null;
      return {
        slot,
        player_id: p.id ?? null,
        player_name: p.name,
        shirt_number: p.shirt_number ?? null
      };
    }).filter(Boolean);
  }

  function substitutePayload(){
    return substitutes.map(p => ({
      player_id:p.id ?? null,
      player_name:p.name,
      shirt_number:p.shirt_number ?? null
    }));
  }

  async function loadScoreProbabilities(){
    if (!resolvedFixtureId || !db || typeof db.rpc !== 'function') return;
    try{
      const {data,error} = await db.rpc('get_fan_score_probabilities',{
        p_fixture_id:resolvedFixtureId
      });
      if (error) throw error;
      const rows=data || [];
      const total=rows.length ? Number(rows[0].total_votes || 0) : 0;
      if (els.scoreProbabilityVotes){
        els.scoreProbabilityVotes.textContent=`${total} vote${total===1?'':'s'}`;
      }
      if (!els.scoreProbabilityList) return;
      els.scoreProbabilityList.innerHTML=rows.length
        ? rows.slice(0,8).map(row=>`
          <div class="score-probability-row">
            <div class="score-probability-score">
              ${esc(row.predicted_home_score)} – ${esc(row.predicted_away_score)}
              <span class="score-probability-votes">${esc(row.votes)} vote${Number(row.votes)===1?'':'s'}</span>
            </div>
            <div class="score-probability-track"><div class="score-probability-fill" style="width:${Math.max(0,Math.min(100,Number(row.probability)||0))}%"></div></div>
            <div class="score-probability-value">${esc(row.probability)}%</div>
          </div>`).join('')
        : '<p class="community-note">Score probabilities will appear after fans submit predictions.</p>';
    }catch(error){
      console.warn('Score probabilities unavailable:',error.message);
    }
  }

  async function loadCommunityXI(){
    if (!resolvedFixtureId || !db || typeof db.rpc !== 'function') return;
    try{
      const { data, error } = await db.rpc('get_most_selected_xi',{
        p_fixture_id: resolvedFixtureId
      });
      if (error) throw error;
      const rows = data || [];
      const total = rows.length ? Number(rows[0].total_submissions || 0) : 0;
      const formation = rows.length ? rows[0].formation : '';

      if (els.communityCount){
        els.communityCount.textContent = `${total} prediction${total === 1 ? '' : 's'}`;
      }
      if (els.communityFormation){
        els.communityFormation.textContent = rows.length
          ? `Most popular formation: ${formation}. Each percentage shows selection within fans who chose that formation.`
          : 'The community XI will appear after fans submit predictions.';
      }
      if (els.communityGrid){
        els.communityGrid.innerHTML = rows.length
          ? rows.map(row => `<div class="community-player">
              <small>${esc(row.slot)}</small>
              <b>${esc(row.player_name)}</b>
              <span>${esc(row.votes)} vote${Number(row.votes) === 1 ? '' : 's'} • ${esc(row.percentage)}%</span>
            </div>`).join('')
          : '';
      }
    }catch(error){
      console.warn('Most Selected XI unavailable:', error.message);
    }
  }

  function setPredictionStatus(el,message,type=''){
    if (!el) return;
    el.textContent=message;
    el.className=`submit-status ${type}`.trim();
  }

  function validScore(){
    const h=Number(els.homeScore?.value), a=Number(els.awayScore?.value);
    return els.homeScore?.value!=='' && els.awayScore?.value!=='' &&
      Number.isInteger(h) && Number.isInteger(a) && h>=0 && a>=0 && h<=30 && a<=30;
  }

  async function submitPredictionMode(mode){
    if (!db || typeof db.rpc!=='function'){
      setPredictionStatus(mode==='lineup'?els.lineupStatus:mode==='score'?els.scoreStatus:els.bothStatus,'Supabase is not available.','error');
      return;
    }
    if (!resolvedFixtureId){ alert('This fixture could not be identified.'); return; }
    if (!predictionsOpen()){ alert('Predictions are closed because this match has started.'); return; }

    const needsLineup=mode==='lineup'||mode==='both';
    const needsScore=mode==='score'||mode==='both';
    const starters=starterPayload();

    if (needsLineup && starters.length!==11){
      alert('Complete all 11 Starting XI positions to submit a lineup prediction.');
      return;
    }
    if (needsScore && !validScore()){
      alert('Enter your predicted score for both teams.');
      return;
    }

    const button=mode==='lineup'?els.submitLineup:mode==='score'?els.submitScore:els.submitBoth;
    const status=mode==='lineup'?els.lineupStatus:mode==='score'?els.scoreStatus:els.bothStatus;
    if(button) button.disabled=true;
    setPredictionStatus(status,'Submitting…');

    try{
      const {error}=await db.rpc('submit_fan_prediction',{
        p_fixture_id:resolvedFixtureId,
        p_voter_key:voterKey(),
        p_mode:mode,
        p_formation:needsLineup?els.formation.value:null,
        p_kit:needsLineup?(els.kit?els.kit.value:'home'):null,
        p_starters:needsLineup?starters:[],
        p_substitutes:needsLineup?substitutePayload():[],
        p_home_score:needsScore?Number(els.homeScore.value):null,
        p_away_score:needsScore?Number(els.awayScore.value):null
      });
      if(error) throw error;

      const label=mode==='lineup'?'Lineup prediction submitted.':mode==='score'?'Score prediction submitted.':'Both predictions submitted.';
      setPredictionStatus(status,label+' You can update it before kickoff.','success');
      if(button) button.textContent=mode==='lineup'?'UPDATE LINEUP':mode==='score'?'UPDATE SCORE':'UPDATE BOTH';
      await loadCommunityXI();
      await loadScoreProbabilities();
    }catch(error){
      console.error('Prediction submission failed:',error);
      setPredictionStatus(status,error.message||'Could not submit prediction.','error');
    }finally{
      if(button) button.disabled=!predictionsOpen();
    }
  }

  async function loadFixture(){
    if (!fixtureRef || !db || typeof db.from !== 'function') return;
    try{
      const fields = 'id,external_fixture_id,opponent,home_team,away_team,is_home,venue,kickoff_at,status';
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(fixtureRef);
      let req = db.from('fixtures').select(fields);
      const result = isUuid
        ? await req.eq('id',fixtureRef).maybeSingle()
        : await req.eq('external_fixture_id',fixtureRef).maybeSingle();
      if (result.error) throw result.error;
      const f = result.data;
      if (!f) return;
      resolvedFixtureId = f.id;
      fixtureKickoff = f.kickoff_at || null;
      fixtureStatus = f.status || 'scheduled';
      [els.submitLineup,els.submitScore,els.submitBoth].forEach(btn=>{
        if(btn) btn.disabled=!predictionsOpen();
      });
      await loadCommunityXI();
      await loadScoreProbabilities();
      const home = f.home_team || (f.is_home ? 'Arsenal' : f.opponent);
      const away = f.away_team || (f.is_home ? f.opponent : 'Arsenal');
      els.matchup.textContent = `${home} VS ${away}`.toUpperCase();
      els.venue.textContent = (f.venue || 'VENUE TBC').toUpperCase();
    }catch(error){
      console.warn('Fan XI fixture header unavailable:', error.message);
    }
  }

  els.pitch.addEventListener('click', e => {
    const btn = e.target.closest('.slot-button');
    if (!btn) return;
    activeSlot = btn.dataset.slot;
    els.pickerTitle.textContent = `Choose ${activeSlot}`;
    populatePlayerSelect();
    renderPlayers();
    document.querySelector('.picker')?.scrollIntoView({behavior:'smooth',block:'start'});
  });

  els.grid.addEventListener('click', e => {
    const btn = e.target.closest('.player-pick');
    if (!btn || btn.disabled) return;
    if (!activeSlot){
      els.pickerTitle.textContent = 'Choose a position on the pitch first';
      return;
    }
    const p = players.find(x => playerId(x) === btn.dataset.playerId);
    if (!p) return;
    selected[activeSlot] = {
      id:p.id ?? p.name,
      name:p.name,
      position:p.position || '',
      image_url:p.image_url || '',
      shirt_number:p.shirt_number ?? ''
    };
    activeSlot = null;
    els.pickerTitle.textContent = 'Select another position';
    renderPitch();
  });

  if (els.addSelected){
    els.addSelected.addEventListener('click', () => {
      if (!activeSlot){
        activeSlot = currentSlots()[0];
        els.pickerTitle.textContent = `Choose ${activeSlot}`;
      }
      const id = els.playerSelect ? els.playerSelect.value : '';
      if (!id){
        alert('Choose a player first.');
        return;
      }
      const p = players.find(x => playerId(x) === id);
      if (!p) return;
      selected[activeSlot] = {
        id:p.id ?? p.name,
        name:p.name,
        position:p.position || '',
        image_url:p.image_url || '',
        shirt_number:p.shirt_number ?? ''
      };
      const slots = currentSlots();
      const idx = slots.indexOf(activeSlot);
      activeSlot = slots[Math.min(idx + 1, slots.length - 1)] || slots[0];
      els.pickerTitle.textContent = `Choose ${activeSlot}`;
      renderPitch();
    });
  }

  if (els.addSubstitute){
    els.addSubstitute.addEventListener('click', () => {
      if (substitutes.length >= 9){
        alert('You can choose up to 9 substitutes.');
        return;
      }

      const id = els.substituteSelect ? els.substituteSelect.value : '';
      if (!id){
        alert('Choose a substitute player first.');
        return;
      }

      const used = selectedIds();
      if (used.has(id)){
        alert('That player is already in your Starting XI or substitutes.');
        return;
      }

      const p = players.find(x => playerId(x) === id);
      if (!p) return;

      substitutes.push({
        id:p.id ?? p.name,
        name:p.name,
        position:p.position || '',
        image_url:p.image_url || '',
        shirt_number:p.shirt_number ?? ''
      });

      renderSubstitutes();
    });
  }

  if (els.selectedSubs){
    els.selectedSubs.addEventListener('click', e => {
      const btn = e.target.closest('[data-remove-sub]');
      if (!btn) return;

      const id = btn.dataset.removeSub;
      substitutes = substitutes.filter(p => playerId(p) !== id);
      renderSubstitutes();
    });
  }

  if (els.kit){
    els.kit.addEventListener('change', () => {
      applyKitTheme();
      save();
    });
  }

  els.formation.addEventListener('change', () => {
    activeSlot = currentSlots()[0];
    els.pickerTitle.textContent = `Choose ${activeSlot}`;
    renderPitch();
  });

  els.clear.addEventListener('click', () => {
    if (!confirm('Clear your predicted XI and substitutes?')) return;
    selected = {};
    substitutes = [];
    activeSlot = null;
    localStorage.removeItem(storageKey());
    renderPitch();
    renderSubstitutes();
  });

  els.download.addEventListener('click', async () => {
    const picks = currentSlots().map(slot => selected[slot]).filter(Boolean);
    if (picks.length !== 11){
      alert('Select all 11 players before downloading your predicted lineup.');
      return;
    }
    if (typeof window.html2canvas !== 'function'){
      alert('The photo exporter could not load.');
      return;
    }
    const oldTitle = els.download.title;
    els.download.disabled = true;
    els.download.title = 'Creating photo…';
    let host = null;
    try{
      host = document.createElement('div');
      host.style.position = 'fixed';
      host.style.left = '-100000px';
      host.style.top = '0';
      host.style.width = `${Math.max(els.board.scrollWidth, els.board.getBoundingClientRect().width)}px`;
      host.style.background = '#050607';
      const clone = els.board.cloneNode(true);
      clone.classList.add('prediction-export-clone');
      clone.classList.toggle('kit-home', els.kit?.value !== 'away');
      clone.classList.toggle('kit-away', els.kit?.value === 'away');
      clone.querySelectorAll('#downloadPredictionBtn').forEach(n => n.remove());

      // html2canvas can lose repeating/gradient pitch backgrounds on a detached clone.
      // Force the exported clone to retain the same green striped football pitch.
      const exportPitch = clone.querySelector('.football-pitch');
      if (exportPitch) {
        exportPitch.style.backgroundColor = '#278b43';
        exportPitch.style.backgroundImage =
          'linear-gradient(180deg, rgba(255,255,255,.05), transparent 18%), ' +
          'repeating-linear-gradient(0deg, #30994c 0%, #30994c 10%, #278b43 10%, #278b43 20%)';
      }
      host.appendChild(clone);
      document.body.appendChild(host);
      const canvas = await html2canvas(clone,{
        backgroundColor:'#050607',scale:Math.min(2,window.devicePixelRatio||1.5),useCORS:true,allowTaint:false,logging:false
      });
      const link = document.createElement('a');
      const fixtureName = (els.matchup.textContent || 'arsenal-fan-xi').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase();
      link.download = `${fixtureName}-fan-predicted-xi.png`;
      link.href = canvas.toDataURL('image/png',1);
      document.body.appendChild(link); link.click(); link.remove();
    }catch(error){
      console.error(error);
      alert('Could not create the predicted lineup photo.');
    }finally{
      if (host) host.remove();
      els.download.disabled = false;
      els.download.title = oldTitle;
    }
  });

  els.submitLineup?.addEventListener('click',()=>submitPredictionMode('lineup'));
  els.submitScore?.addEventListener('click',()=>submitPredictionMode('score'));
  els.submitBoth?.addEventListener('click',()=>submitPredictionMode('both'));
  els.homeScore?.addEventListener('input',save);
  els.awayScore?.addEventListener('input',save);

  restore();
  activeSlot = currentSlots()[0];
  els.pickerTitle.textContent = `Choose ${activeSlot}`;
  renderPitch();
  loadFixture();
  loadPlayers();
})();