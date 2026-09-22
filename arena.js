const DATA={formation:"4-3-3",starters:[{name:"David Raya",number:1,pos:"GK",x:0,y:-46},{name:"Jurriën Timber",number:12,pos:"RB",x:40,y:-25},{name:"Ezri Konsa",number:15,pos:"CB",x:14,y:-29},{name:"Gabriel",number:6,pos:"CB",x:-14,y:-29},{name:"Riccardo Calafiori",number:33,pos:"LB",x:-40,y:-25},{name:"Declan Rice",number:41,pos:"DM",x:0,y:-2},{name:"Bruno Guimarães",number:39,pos:"CM",x:34,y:2},{name:"Martin Ødegaard",number:8,pos:"CM",x:-34,y:2},{name:"Bukayo Saka",number:7,pos:"RW",x:42,y:35},{name:"Christos Tzolis",number:17,pos:"LW",x:-42,y:35},{name:"Kai Havertz",number:29,pos:"ST",x:0,y:43}],bench:[{name:"William Saliba",number:2,pos:"DEF"},{name:"Cristhian Mosquera",number:3,pos:"DEF"},{name:"Ben White",number:4,pos:"DEF"},{name:"Piero Hincapié",number:5,pos:"DEF"},{name:"Eberechi Eze",number:10,pos:"MID"},{name:"Kepa Arrizabalaga",number:13,pos:"GK"},{name:"Viktor Gyökeres",number:14,pos:"FWD"},{name:"Noni Madueke",number:20,pos:"FWD"},{name:"Mikel Merino",number:23,pos:"MID"},{name:"Illan Meslier",number:30,pos:"GK"},{name:"Martín Zubimendi",number:36,pos:"MID"},{name:"Myles Lewis-Skelly",number:49,pos:"DEF"},{name:"Max Dowman",number:56,pos:"FWD"},{name:"Marli Salmon",number:89,pos:"DEF"}]};

const staticPitch=document.querySelector(".static-pitch");
const staticArena=document.querySelector("#staticArena");
let playerView="full";
let cameraMode="broadcast";
let zoom=1;

const normalizeArtworkName=value=>String(value||"")
  .replace(/[Øø]/g,"o")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"")
  .replace(/[^a-z0-9]+/gi,"")
  .toLowerCase();

function selectPlayer(player){
  document.querySelectorAll(".player-row").forEach(row=>row.classList.toggle("selected",row.dataset.player===player.name));
  const old=document.querySelector("#playerFocus"); if(old) old.remove();
  const card=document.createElement("div");
  card.id="playerFocus"; card.className="player-focus";
  card.innerHTML="<span>#"+player.number+" · "+player.pos+"</span><strong>"+player.name+"</strong><small>"+DATA.formation+" · Arsenal XI</small>";
  document.querySelector(".arena-shell").appendChild(card);
}

function fillLists(){
  const formation=document.querySelector("#formation"); if(formation) formation.textContent=DATA.formation;
  const list=document.querySelector("#lineupList"); if(list) {
    list.innerHTML="";
    DATA.starters.forEach(p=>{
      const e=document.createElement("div"); e.className="player-row"; e.dataset.player=p.name;
      e.innerHTML='<div class="player-main"><span class="num">'+p.number+'</span><div><div class="name">'+p.name+'</div><div class="pos">'+p.pos+'</div></div></div>';
      e.onclick=()=>selectPlayer(p); list.appendChild(e);
    });
  }
  const bench=document.querySelector("#benchList"); if(bench){
    bench.innerHTML="";
    DATA.bench.forEach(p=>{
      const e=document.createElement("div"); e.className="player-row"; e.dataset.player=p.name;
      e.innerHTML='<div class="player-main"><span class="num">'+p.number+'</span><div><div class="name">'+p.name+'</div><div class="pos">'+p.pos+'</div></div></div><span class="badge">BENCH</span>';
      e.onclick=()=>selectPlayer(p); bench.appendChild(e);
    });
  }
}

async function loadArtworkManifest(){
  // The deployment embeds the verified manifest before arena.js loads.
  // Runtime fetch is only a fallback, so artwork cannot disappear because
  // the Pages asset request is delayed, cached, or blocked.
  if(window.ARENA_ARTWORK_MANIFEST && typeof window.ARENA_ARTWORK_MANIFEST==="object"){
    return window.ARENA_ARTWORK_MANIFEST;
  }
  try{
    const res=await fetch("./player-assets/manifest.json?v=20260921-53",{cache:"no-store"});
    if(!res.ok) return {};
    return await res.json();
  }catch(e){ return {}; }
}

function artworkPathForView(artwork){
  if(!artwork || typeof artwork!=="object") return null;
  // Authoritative mapping: Full Body = dedicated full asset; Half Body = restored dedicated half-body asset.
  const url=playerView==="full"?artwork.full:artwork.half;
  if(typeof url!=="string") return null;

  // Full Body can only load the full package; Half Body can only load the dedicated half-body package.
  const expected=playerView==="full"?/-full\.(png|jpe?g|webp)$/i:/-half\.(png|jpe?g|webp)$/i;
  return expected.test(url) ? url : null;
}

let artworkRenderVersion=0;

async function renderStaticPlayerPhotos(){
  if(!staticPitch) return;

  staticPitch.classList.toggle("view-full",playerView==="full");
  staticPitch.classList.toggle("view-half",playerView==="half");

  // Paint the HTML-bound image URLs immediately. Do NOT wait for manifest.json;
  // a slow/missing manifest must never leave the Arena blank.
  const images=document.querySelectorAll("#staticArena .static-art");
  images.forEach(img=>{
    const active=img.dataset.artMode===playerView;
    img.style.display=active ? "block" : "none";
    img.style.visibility=active ? "visible" : "hidden";
    img.style.opacity=active ? "1" : "0";
    img.loading="eager";
    img.decoding="async";
  });

  let manifest={};
  try { manifest=await loadArtworkManifest(); } catch(e) { manifest={}; }

  images.forEach(img=>{
    const key=img.dataset.artKey;
    const mode=img.dataset.artMode;
    const boundAsset=img.dataset.boundAsset || img.getAttribute("src") || "";
    const manifestEntry=manifest && manifest[key] ? manifest[key] : null;
    const localAsset=img.dataset.localSrc || (manifestEntry ? manifestEntry[mode] : "") || "";
    const manifestAsset=manifestEntry ? manifestEntry[mode] : "";
    const remoteAsset=manifestEntry ? manifestEntry["remote"+(mode==="full"?"Full":"Half")] : "";
    const asset=boundAsset || manifestAsset || remoteAsset;
    const active=mode===playerView;

    // Never create fake player boxes. The real PNG is the only player visual.
    img.style.position="absolute";
    img.style.pointerEvents="none";
    img.style.zIndex="10000";
    img.style.visibility=active && asset ? "visible" : "hidden";
    img.style.opacity=active && asset ? "1" : "0";
    img.style.display=active && asset ? "block" : "none";

    if(asset && img.getAttribute("src")!==asset) img.setAttribute("src",asset);

    img.loading="eager";
    img.decoding="sync";
    img.setAttribute("fetchpriority","high");

    const oldFallback=img.parentElement && img.parentElement.querySelector('.mobile-art-fallback[data-for="'+key+'"]');
    if(oldFallback) oldFallback.remove();

    img.onerror=()=>{
      const current=img.getAttribute("src")||"";
      const bound=img.dataset.boundAsset || "";
      if(localAsset && current!==localAsset && !img.dataset.localRetry){
        img.dataset.localRetry="1";
        img.setAttribute("src",localAsset);
        return;
      }
      if(bound && current!==bound && !img.dataset.boundRetry){
        img.dataset.boundRetry="1";
        img.setAttribute("src",bound);
        return;
      }
      if(remoteAsset && current!==remoteAsset && !img.dataset.remoteRetry){
        img.dataset.remoteRetry="1";
        img.setAttribute("src",remoteAsset);
        return;
      }
      if(current && !img.dataset.cacheRetry){
        img.dataset.cacheRetry="1";
        img.setAttribute("src",current+(current.includes("?")?"&":"?")+"retry=20260921-55");
        return;
      }
      // Keep the real-image element present; never replace it with a fake tag/number box.
      img.style.display="block";
      img.style.visibility="visible";
      img.style.opacity="0";
    };

    img.onload=()=>{
      if(img.dataset.artMode===playerView){
        img.style.display="block";
        img.style.visibility="visible";
        img.style.opacity="1";
      }
    };

    if(active && asset){
      img.style.display="block";
      img.style.visibility="visible";
      img.style.opacity="1";
    }

    const oldLabel=img.parentElement && img.parentElement.querySelector('.mobile-player-label[data-for="'+key+'"]');
    if(oldLabel) oldLabel.remove();
  });
}

function applyCamera(){
  if(!staticPitch) return;
  staticPitch.classList.remove("camera-broadcast","camera-top","camera-tactical");
  staticPitch.classList.add("camera-"+cameraMode);
  staticPitch.style.setProperty("--arena-scale",String(zoom));
}

function setCamera(mode){
  cameraMode=mode==="top"?"top":mode==="tactical"?"tactical":"broadcast";
  applyCamera();
}

function setZoom(delta){
  zoom=Math.max(.82,Math.min(1.22,zoom+delta));
  applyCamera();
}

function setPlayerView(view){
  playerView=view==="half"?"half":"full";
  if(staticPitch){
    staticPitch.classList.toggle("view-full",playerView==="full");
    staticPitch.classList.toggle("view-half",playerView==="half");
  }
  document.querySelectorAll("[data-player-view]").forEach(b=>b.classList.toggle("active",b.dataset.playerView===playerView));
  renderStaticPlayerPhotos();
}

if(staticArena) staticArena.style.display="grid";

document.querySelectorAll("[data-player-view]").forEach(b=>b.addEventListener("click",()=>setPlayerView(b.dataset.playerView)));
document.querySelectorAll("[data-camera]").forEach(b=>b.addEventListener("click",()=>setCamera(b.dataset.camera)));

const reset=document.querySelector("#resetCamera"); if(reset) reset.onclick=()=>{zoom=1;setCamera("broadcast");};
const zoomIn=document.querySelector("#zoomIn"); if(zoomIn) zoomIn.onclick=()=>setZoom(.08);
const zoomOut=document.querySelector("#zoomOut"); if(zoomOut) zoomOut.onclick=()=>setZoom(-.08);

setCamera("broadcast");
setPlayerView("full");
renderStaticPlayerPhotos();



/* NL4 ARENA PLAYER STATE V2
   FIELD = active and locked.
   LINEUP = available players.
   SUBSTITUTE = bench/available players.
   A player exists in exactly one state at a time. */
const ARENA_STATE_KEY="nl4-arena-state-v2";
const ARENA_LEGACY_POSITION_KEY="nl4-arena-player-positions-v1";
let arenaField=[];
let arenaLineup=[];
let arenaBench=[];
let arenaDrag=null;
let arenaDragGhost=null;
let arenaArtworkCache={};

function arenaKey(name){ return normalizeArtworkName(name); }
function copyPlayer(p){ return {...p}; }
function clampPercent(value,min=0,max=100){ return Math.max(min,Math.min(max,value)); }

function defaultFieldPosition(name){
  const key=arenaKey(name);
  const img=document.querySelector('#staticArena .static-art-full[data-art-key="'+key+'"]');
  const left=img ? parseFloat(img.style.left || getComputedStyle(img).left) : 50;
  const top=img ? parseFloat(img.style.top || getComputedStyle(img).top) : 50;
  return {
    x:clampPercent(Number.isFinite(left)?left:50),
    y:clampPercent(Number.isFinite(top)?top:50)
  };
}

function legacyFieldPosition(name){
  try{
    const saved=JSON.parse(localStorage.getItem(ARENA_LEGACY_POSITION_KEY)||"{}");
    const full=saved[arenaKey(name)+"__full"];
    if(full && Number.isFinite(full.x) && Number.isFinite(full.y)){
      return {x:clampPercent(full.x),y:clampPercent(full.y)};
    }
  }catch(e){}
  return null;
}

function playerToField(p,pos){
  const x=clampPercent(pos?.x ?? 50), y=clampPercent(pos?.y ?? 50);
  return {...copyPlayer(p),x:(x-50)*2,y:(y-50)*-2,displayX:x,displayY:y};
}

function fieldDisplayPosition(p){
  return {
    x:clampPercent(Number.isFinite(p.displayX)?p.displayX:50),
    y:clampPercent(Number.isFinite(p.displayY)?p.displayY:50)
  };
}

function saveArenaState(){
  try{
    localStorage.setItem(ARENA_STATE_KEY,JSON.stringify({
      field:arenaField,
      lineup:arenaLineup,
      substitute:arenaBench
    }));
  }catch(e){}
}

function normalizePoolPlayer(p){
  const q=copyPlayer(p);
  delete q.displayX; delete q.displayY;
  return q;
}

function loadArenaState(){
  const defaults=DATA.starters.map(p=>{
    const saved=legacyFieldPosition(p.name);
    return playerToField(p,saved || defaultFieldPosition(p.name));
  });
  arenaField=defaults;
  arenaLineup=[];
  arenaBench=DATA.bench.map(copyPlayer);

  try{
    const saved=JSON.parse(localStorage.getItem(ARENA_STATE_KEY)||"null");
    if(saved && Array.isArray(saved.field) && Array.isArray(saved.lineup) && Array.isArray(saved.substitute)){
      const known=new Map([...DATA.starters,...DATA.bench].map(p=>[p.name,p]));
      const seen=new Set();
      const cleanField=[];
      saved.field.forEach(p=>{
        if(!p || !known.has(p.name) || seen.has(p.name)) return;
        seen.add(p.name);
        const base=known.get(p.name);
        const pos=Number.isFinite(p.displayX)&&Number.isFinite(p.displayY)
          ? {x:p.displayX,y:p.displayY}
          : {x:clampPercent(50+(Number(p.x)||0)/2),y:clampPercent(50-(Number(p.y)||0)/2)};
        cleanField.push(playerToField({...base,...p},pos));
      });
      const cleanLineup=[];
      const cleanBench=[];
      for(const p of saved.lineup){
        if(!p || !known.has(p.name) || seen.has(p.name)) continue;
        seen.add(p.name); cleanLineup.push(normalizePoolPlayer({...known.get(p.name),...p}));
      }
      for(const p of saved.substitute){
        if(!p || !known.has(p.name) || seen.has(p.name)) continue;
        seen.add(p.name); cleanBench.push(normalizePoolPlayer({...known.get(p.name),...p}));
      }
      // Any roster player missing from the saved state is returned to Substitute.
      known.forEach((base,name)=>{
        if(!seen.has(name)) cleanBench.push(copyPlayer(base));
      });
      arenaField=cleanField;
      arenaLineup=cleanLineup;
      arenaBench=cleanBench;
    }
  }catch(e){}

  saveArenaState();
}

function activeFieldPlayer(name){
  return arenaField.find(p=>p.name===name)||null;
}

function poolFor(type){
  return type==="lineup"?arenaLineup:arenaBench;
}

function removeFromPool(type,name){
  const pool=poolFor(type);
  const i=pool.findIndex(p=>p.name===name);
  return i>=0 ? pool.splice(i,1)[0] : null;
}

function addToPool(type,p){
  if(!p || activeFieldPlayer(p.name) || arenaLineup.some(x=>x.name===p.name) || arenaBench.some(x=>x.name===p.name)) return;
  poolFor(type).push(normalizePoolPlayer(p));
}

function artworkUrlForPlayer(p){
  const key=arenaKey(p.name);
  const entry=window.ARENA_ARTWORK_MANIFEST && window.ARENA_ARTWORK_MANIFEST[key];
  if(entry){
    const local=playerView==="half"?entry.half:entry.full;
    if(typeof local==="string" && local) return local;
  }
  return arenaArtworkCache[key]?.[playerView] || arenaArtworkCache[key]?.full || arenaArtworkCache[key]?.half || "";
}

async function fetchPoolArtwork(p){
  const key=arenaKey(p.name);
  const existing=artworkUrlForPlayer(p);
  if(existing){ arenaArtworkCache[key] ||= {}; arenaArtworkCache[key][playerView]=existing; return existing; }
  if(arenaArtworkCache[key]?.loading) return arenaArtworkCache[key]?.full || "";
  arenaArtworkCache[key] ||= {};
  arenaArtworkCache[key].loading=true;
  try{
    const res=await fetch("https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p="+encodeURIComponent(p.name));
    const data=await res.json();
    const players=Array.isArray(data?.player)?data.player:[];
    const hit=players.find(x=>String(x.strTeam||"").toLowerCase().includes("arsenal")) || players[0];
    if(hit){
      arenaArtworkCache[key].full=hit.strRender || hit.strCutout || hit.strThumb || "";
      arenaArtworkCache[key].half=hit.strCutout || hit.strRender || hit.strThumb || "";
    }
  }catch(e){}
  arenaArtworkCache[key].loading=false;
  return artworkUrlForPlayer(p);
}

function makePoolRow(p,type){
  const e=document.createElement("div");
  e.className="player-row pool-player-row";
  e.dataset.player=p.name;
  e.dataset.pool=type;
  e.innerHTML=
    '<div class="player-main"><img class="pool-player-image" alt="" draggable="false"><span class="num">'+p.number+
    '</span><div><div class="name">'+p.name+'</div><div class="pos">'+p.pos+
    '</div></div></div><span class="badge">'+(type==="lineup"?"LINEUP":"SUB")+'</span>';
  const img=e.querySelector(".pool-player-image");
  const setImage=url=>{
    if(!url) return;
    img.src=url; e.dataset.dragSrc=url;
  };
  setImage(artworkUrlForPlayer(p));
  if(!img.src || !img.getAttribute("src")) fetchPoolArtwork(p).then(setImage);
  img.onerror=()=>{ img.style.visibility="hidden"; };
  e.addEventListener("click",()=>selectPlayer(p));
  enablePoolPointerDrag(e,p,type);
  return e;
}

function rebuildLineupLists(){
  const list=document.querySelector("#lineupList");
  const bench=document.querySelector("#benchList");
  if(list){
    list.innerHTML="";
    if(!arenaLineup.length){
      const empty=document.createElement("div");
      empty.className="pool-empty";
      empty.textContent="No players in lineup";
      list.appendChild(empty);
    }else{
      arenaLineup.forEach(p=>list.appendChild(makePoolRow(p,"lineup")));
    }
    enablePoolDropZone(list,"lineup");
  }
  if(bench){
    bench.innerHTML="";
    arenaBench.forEach(p=>bench.appendChild(makePoolRow(p,"substitute")));
    if(!arenaBench.length){
      const empty=document.createElement("div");
      empty.className="pool-empty";
      empty.textContent="No substitutes";
      bench.appendChild(empty);
    }
    enablePoolDropZone(bench,"substitute");
  }
  updateFieldArtwork();
  preloadPoolArtwork();
}

function preloadPoolArtwork(){
  [...arenaLineup,...arenaBench].forEach(p=>fetchPoolArtwork(p).then(url=>{
    if(!url) return;
    document.querySelectorAll('.pool-player-row[data-player="'+CSS.escape(p.name)+'"] .pool-player-image').forEach(img=>{
      if(!img.src || img.naturalWidth===0) img.src=url;
      img.closest(".pool-player-row")?.setAttribute("data-drag-src",url);
    });
  }));
}

function updateFieldArtwork(){
  const visible=document.querySelectorAll("#staticArena .static-art");
  visible.forEach(img=>{
    const key=img.dataset.artKey;
    const player=activeFieldPlayer(Object.keys({}).find(()=>false)) || null;
    img.style.pointerEvents="auto";
    img.style.cursor="default";
    img.setAttribute("draggable","false");
  });

  const activeKeys=new Set(arenaField.map(p=>arenaKey(p.name)));
  visible.forEach(img=>{
    const key=img.dataset.artKey;
    const mode=img.dataset.artMode;
    const player=arenaField.find(p=>arenaKey(p.name)===key);
    const active=!!player && mode===playerView;
    img.style.display=active?"block":"none";
    img.style.visibility=active?"visible":"hidden";
    img.style.opacity=active?"1":"0";
    img.style.pointerEvents=active?"auto":"none";
    img.style.cursor=active?"default":"";
    if(player){
      const pos=fieldDisplayPosition(player);
      img.style.setProperty("left",pos.x+"%","important");
      img.style.setProperty("top",pos.y+"%","important");
    }
  });
  // Old field image elements are repurposed by substitutions; their art key must
  // always match the player occupying that field slot.
  arenaField.forEach(p=>{
    const key=arenaKey(p.name);
    const pair=document.querySelectorAll("#staticArena .static-art[data-field-slot='"+CSS.escape(p.fieldSlot||"")+"']");
    if(pair.length){
      pair.forEach(img=>img.dataset.artKey=key);
    }
  });
}

function getFieldSlots(){
  const slots=[];
  document.querySelectorAll("#staticArena .static-art-full").forEach(img=>{
    const key=img.dataset.artKey;
    const slot=img.dataset.fieldSlot || key;
    if(!slots.some(x=>x.slot===slot)){
      const half=document.querySelector('#staticArena .static-art-half[data-art-key="'+key+'"]');
      slots.push({slot,key,full:img,half});
    }
  });
  return slots;
}

function assignFieldSlots(){
  const slots=getFieldSlots();
  arenaField.forEach((p,i)=>{
    if(p.fieldSlot) return;
    const original=slots.find(s=>s.key===arenaKey(p.name));
    if(original) p.fieldSlot=original.slot;
    else if(slots[i]) p.fieldSlot=slots[i].slot;
  });
}

function setSlotPlayer(slot,p){
  const full=slot.full, half=slot.half;
  const key=arenaKey(p.name);
  [full,half].forEach(img=>{
    if(!img) return;
    img.dataset.artKey=key;
    img.dataset.playerName=p.name;
    img.setAttribute("draggable","false");
    img.style.pointerEvents=img.dataset.artMode===playerView?"auto":"none";
  });
  const fullLocal=window.ARENA_ARTWORK_MANIFEST?.[key]?.full;
  const halfLocal=window.ARENA_ARTWORK_MANIFEST?.[key]?.half;
  if(full && fullLocal) full.src=fullLocal;
  if(half && halfLocal) half.src=halfLocal;
  if(!fullLocal || !halfLocal){
    fetchPoolArtwork(p).then(url=>{
      if(full && !fullLocal && url && playerView==="full") full.src=url;
      if(half && !halfLocal && url && playerView==="half") half.src=url;
    });
  }
}

function findSlotForPlayer(p){
  const slots=getFieldSlots();
  return slots.find(s=>s.slot===p.fieldSlot) || slots.find(s=>s.key===arenaKey(p.name)) || slots[0];
}

function updateFieldSlotBindings(){
  const slots=getFieldSlots();
  arenaField.forEach(p=>{
    const slot=findSlotForPlayer(p);
    if(!slot) return;
    p.fieldSlot=slot.slot;
    setSlotPlayer(slot,p);
    const pos=fieldDisplayPosition(p);
    [slot.full,slot.half].forEach(img=>{
      if(!img) return;
      img.style.setProperty("left",pos.x+"%","important");
      img.style.setProperty("top",pos.y+"%","important");
      img.style.pointerEvents=img.dataset.artMode===playerView?"auto":"none";
      img.style.cursor="default";
    });
  });
}

function renderState(){
  assignFieldSlots();
  updateFieldSlotBindings();
  rebuildLineupLists();
  saveArenaState();
  renderStaticPlayerPhotos();
}

function nearestFieldIndex(clientX,clientY){
  const layer=document.querySelector("#staticArena .static-art-layer");
  if(!layer || !arenaField.length) return -1;
  const rect=layer.getBoundingClientRect();
  let best=-1,bestD=Infinity;
  arenaField.forEach((p,i)=>{
    const pos=fieldDisplayPosition(p);
    const px=rect.left+(pos.x/100)*rect.width;
    const py=rect.top+(pos.y/100)*rect.height;
    const d=(clientX-px)**2+(clientY-py)**2;
    if(d<bestD){bestD=d;best=i;}
  });
  return best;
}

function highlightFieldTarget(index){
  document.querySelectorAll("#staticArena .static-art").forEach(img=>img.classList.remove("drop-target"));
  if(index<0) return;
  const p=arenaField[index];
  document.querySelectorAll('#staticArena .static-art[data-art-key="'+CSS.escape(arenaKey(p.name))+'"]').forEach(img=>{
    if(img.dataset.artMode===playerView) img.classList.add("drop-target");
  });
}

function clearDragVisuals(){
  document.querySelector("#staticArena")?.classList.remove("pool-drag-ready","pool-drag-hover");
  document.querySelector("#lineupList")?.classList.remove("pool-drop-hover");
  document.querySelector("#benchList")?.classList.remove("pool-drop-hover");
  document.querySelectorAll("#staticArena .drop-target").forEach(img=>img.classList.remove("drop-target"));
}

function createDragGhost(e,p){
  if(arenaDragGhost) arenaDragGhost.remove();
  const ghost=document.createElement("img");
  ghost.className="arena-drag-ghost";
  ghost.alt="";
  ghost.draggable=false;
  const src=e.dataset.dragSrc || e.querySelector(".pool-player-image")?.src || artworkUrlForPlayer(p);
  if(src) ghost.src=src;
  const w=Math.max(64,Math.min(112,e.querySelector(".pool-player-image")?.getBoundingClientRect().width*1.9 || 88));
  ghost.style.width=w+"px";
  document.body.appendChild(ghost);
  arenaDragGhost=ghost;
  moveDragGhost(e._arenaLastPointerX||0,e._arenaLastPointerY||0);
}

function moveDragGhost(x,y){
  if(!arenaDragGhost) return;
  arenaDragGhost.style.left=(x+14)+"px";
  arenaDragGhost.style.top=(y+14)+"px";
}

function startPoolDrag(e,p,type,event){
  if(event.button!==undefined && event.button!==0) return;
  arenaDrag={name:p.name,type,pointerId:event.pointerId,moved:false};
  e._arenaLastPointerX=event.clientX; e._arenaLastPointerY=event.clientY;
  e.setPointerCapture?.(event.pointerId);
  e.classList.add("dragging");
}

function updatePoolDrag(e,event){
  if(!arenaDrag || arenaDrag.pointerId!==event.pointerId) return;
  e._arenaLastPointerX=event.clientX; e._arenaLastPointerY=event.clientY;
  const dx=Math.abs(event.movementX||0),dy=Math.abs(event.movementY||0);
  if(!arenaDrag.moved && dx+dy>=3){
    arenaDrag.moved=true;
    createDragGhost(e,arenaField.find(p=>p.name===arenaDrag.name)||poolFor(arenaDrag.type).find(p=>p.name===arenaDrag.name)||{name:arenaDrag.name});
    document.querySelector("#staticArena")?.classList.add("pool-drag-ready");
  }
  if(!arenaDrag.moved) return;
  event.preventDefault();
  moveDragGhost(event.clientX,event.clientY);
  const layer=document.querySelector("#staticArena .static-art-layer");
  if(!layer) return;
  const rect=layer.getBoundingClientRect();
  const inPitch=event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom;
  document.querySelector("#staticArena")?.classList.toggle("pool-drag-hover",inPitch);
  highlightFieldTarget(inPitch?nearestFieldIndex(event.clientX,event.clientY):-1);
  document.querySelector("#lineupList")?.classList.remove("pool-drop-hover");
  document.querySelector("#benchList")?.classList.remove("pool-drop-hover");
  if(!inPitch){
    const under=document.elementFromPoint(event.clientX,event.clientY)?.closest(".lineup-list,.bench-list");
    if(under) under.classList.add("pool-drop-hover");
  }
}

function finishPoolDrag(e,event){
  if(!arenaDrag || arenaDrag.pointerId!==event.pointerId) return;
  const drag={...arenaDrag};
  arenaDrag=null;
  e.classList.remove("dragging");
  if(arenaDragGhost){arenaDragGhost.remove();arenaDragGhost=null;}
  clearDragVisuals();
  try{e.releasePointerCapture?.(event.pointerId);}catch(err){}
  if(!drag.moved) return;

  const layer=document.querySelector("#staticArena .static-art-layer");
  const rect=layer?.getBoundingClientRect();
  const inPitch=!!rect&&event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom;
  if(inPitch){
    const targetIndex=nearestFieldIndex(event.clientX,event.clientY);
    if(targetIndex>=0) replaceFieldPlayer(drag.name,drag.type,targetIndex);
    return;
  }
  const target= document.elementFromPoint(event.clientX,event.clientY)?.closest("#lineupList,#benchList");
  if(target) moveBetweenPools(drag.name,drag.type,target.id==="lineupList"?"lineup":"substitute");
}

function enablePoolPointerDrag(e,p,type){
  e.draggable=true;
  e.addEventListener("dragstart",event=>{
    event.dataTransfer.effectAllowed="move";
    event.dataTransfer.setData("application/x-nl4-pool-type",type);
    event.dataTransfer.setData("text/plain",p.name);
    const src=e.dataset.dragSrc || e.querySelector(".pool-player-image")?.src;
    if(src){
      const ghost=new Image(); ghost.src=src;
      try{event.dataTransfer.setDragImage(ghost,40,40);}catch(err){}
    }
    document.querySelector("#staticArena")?.classList.add("pool-drag-ready");
  });
  e.addEventListener("dragend",()=>clearDragVisuals());
  
  e.style.touchAction="none";
  e.addEventListener("pointerdown",event=>startPoolDrag(e,p,type,event));
  e.addEventListener("pointermove",event=>updatePoolDrag(e,event));
  const finish=event=>finishPoolDrag(e,event);
  e.addEventListener("pointerup",finish);
  e.addEventListener("pointercancel",finish);
}

function moveBetweenPools(name,from,to){
  if(from===to) return;
  const player=removeFromPool(from,name);
  if(!player) return;
  addToPool(to,player);
  renderState();
}

function replaceFieldPlayer(incomingName,sourceType,targetIndex){
  const incoming=removeFromPool(sourceType,incomingName);
  if(!incoming || !arenaField[targetIndex]){
    if(incoming) addToPool(sourceType,incoming);
    return;
  }
  const outgoing=arenaField[targetIndex];
  const pos=fieldDisplayPosition(outgoing);
  const slot=outgoing.fieldSlot;
  const replacement=playerToField(incoming,pos);
  replacement.fieldSlot=slot;
  arenaField[targetIndex]=replacement;
  addToPool(sourceType,outgoing);
  renderState();
}

function returnFieldPlayer(name,targetPool){
  const idx=arenaField.findIndex(p=>p.name===name);
  if(idx<0) return;
  const [out]=arenaField.splice(idx,1);
  addToPool(targetPool,out);
  renderState();
}

function showFieldPlayerControls(p){
  const old=document.querySelector("#playerFocus"); if(old) old.remove();
  const card=document.createElement("div");
  card.id="playerFocus";
  card.className="player-focus field-player-focus";
  card.innerHTML="<span>#"+p.number+" · "+p.pos+"</span><strong>"+p.name+
    "</strong><small>ON FIELD · POSITION LOCKED</small><div class=\"field-return-actions\">"+
    "<button type=\"button\" data-return=\"lineup\">Return to Lineup</button>"+
    "<button type=\"button\" data-return=\"substitute\">Send to Substitute</button></div>";
  document.querySelector(".arena-shell")?.appendChild(card);
  card.querySelectorAll("[data-return]").forEach(btn=>btn.addEventListener("click",()=>returnFieldPlayer(p.name,btn.dataset.return)));
}

function bindFieldClicks(){
  document.querySelectorAll("#staticArena .static-art").forEach(img=>{
    if(img.dataset.fieldClickReady==="1") return;
    img.dataset.fieldClickReady="1";
    img.addEventListener("click",event=>{
      event.preventDefault(); event.stopPropagation();
      if(img.dataset.artMode!==playerView) return;
      const p=activeFieldPlayer(img.dataset.playerName||"");
      if(p) showFieldPlayerControls(p);
    });
  });
}

function enablePoolDropZone(container,type){
  if(!container || container.dataset.dropReady==="1") return;
  container.dataset.dropReady="1";
  ["dragover","dragenter"].forEach(evt=>container.addEventListener(evt,e=>{
    e.preventDefault(); container.classList.add("pool-drop-hover");
  }));
  ["dragleave","drop"].forEach(evt=>container.addEventListener(evt,e=>{
    if(evt==="dragleave" && container.contains(e.relatedTarget)) return;
    container.classList.remove("pool-drop-hover");
  }));
  container.addEventListener("drop",e=>{
    e.preventDefault();
    const from=e.dataTransfer?.getData("application/x-nl4-pool-type");
    const name=e.dataTransfer?.getData("text/plain");
    if(from&&name) moveBetweenPools(name,from,type);
  });
}

loadArenaState();
assignFieldSlots();
bindFieldClicks();
rebuildLineupLists();
updateFieldSlotBindings();
renderStaticPlayerPhotos();


/* ===== ARENA PLAYER STATE V2 — authoritative interaction layer ===== */
const ARENA_STATE_V2="nl4-arena-state-v2";
let arenaField=[],arenaLineup=[],arenaBench=[],arenaDrag=null,arenaGhost=null,arenaArtCache={};

const akey=n=>normalizeArtworkName(n);
const clampA=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
const poolA=t=>t==="lineup"?arenaLineup:arenaBench;

function defaultApos(name){
  const el=document.querySelector('#staticArena .static-art-full[data-art-key="'+akey(name)+'"]');
  const x=el?parseFloat(el.style.left):50,y=el?parseFloat(el.style.top):50;
  return {x:clampA(Number.isFinite(x)?x:50),y:clampA(Number.isFinite(y)?y:50)};
}
function fieldA(p,pos,slot){
  const q={...p,displayX:clampA(pos.x),displayY:clampA(pos.y)};
  q.x=(q.displayX-50)*2;q.y=(q.displayY-50)*-2;
  if(slot) q.fieldSlot=slot;
  return q;
}
function fieldPosA(p){return {x:clampA(Number.isFinite(Number(p.displayX))?Number(p.displayX):50),y:clampA(Number.isFinite(Number(p.displayY))?Number(p.displayY):50)}}
function saveA(){
  try{localStorage.setItem(ARENA_STATE_V2,JSON.stringify({field:arenaField,lineup:arenaLineup,substitute:arenaBench}))}catch(e){}
}
function loadA(){
  arenaField=DATA.starters.map(p=>fieldA({...p},defaultApos(p.name)));
  arenaLineup=[];
  arenaBench=DATA.bench.map(p=>({...p}));
  try{
    const s=JSON.parse(localStorage.getItem(ARENA_STATE_V2)||"null");
    if(s&&Array.isArray(s.field)&&Array.isArray(s.lineup)&&Array.isArray(s.substitute)){
      const all=new Map([...DATA.starters,...DATA.bench].map(p=>[p.name,p])),seen=new Set(),f=[],l=[],b=[];
      s.field.forEach(p=>{if(!all.has(p.name)||seen.has(p.name))return;seen.add(p.name);f.push(fieldA({...all.get(p.name),...p},fieldPosA(p),p.fieldSlot))});
      s.lineup.forEach(p=>{if(!all.has(p.name)||seen.has(p.name))return;seen.add(p.name);l.push({...all.get(p.name),...p})});
      s.substitute.forEach(p=>{if(!all.has(p.name)||seen.has(p.name))return;seen.add(p.name);b.push({...all.get(p.name),...p})});
      all.forEach((p,n)=>{if(!seen.has(n))b.push({...p})});
      arenaField=f;arenaLineup=l;arenaBench=b;
    }
  }catch(e){}
  saveA();
}
function assignSlotsA(){
  const slots=[...document.querySelectorAll("#staticArena .static-art-full")];
  slots.forEach((el,i)=>el.dataset.fieldSlot=el.dataset.fieldSlot||("slot-"+i));
  const halves=[...document.querySelectorAll("#staticArena .static-art-half")];
  halves.forEach((el,i)=>el.dataset.fieldSlot=el.dataset.fieldSlot||("slot-"+i));
  arenaField.forEach((p,i)=>{
    if(p.fieldSlot)return;
    const hit=slots.find(el=>el.dataset.artKey===akey(p.name));
    p.fieldSlot=hit?.dataset.fieldSlot||("slot-"+i);
  });
}
function slotA(p){
  const all=[...document.querySelectorAll("#staticArena .static-art-full")];
  return all.find(el=>el.dataset.fieldSlot===p.fieldSlot)||all.find(el=>el.dataset.artKey===akey(p.name));
}
function artworkA(p){
  const e=window.ARENA_ARTWORK_MANIFEST?.[akey(p.name)];
  return e?.[playerView]||e?.full||e?.half||arenaArtCache[akey(p.name)]?.[playerView]||arenaArtCache[akey(p.name)]?.full||"";
}
async function fetchArtA(p){
  const k=akey(p.name),known=artworkA(p);
  if(known)return known;
  arenaArtCache[k]??={};
  if(arenaArtCache[k].loading)return "";
  arenaArtCache[k].loading=true;
  try{
    const r=await fetch("https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p="+encodeURIComponent(p.name));
    const d=await r.json(),hit=(d.player||[]).find(x=>String(x.strTeam||"").toLowerCase().includes("arsenal"))||(d.player||[])[0];
    if(hit){arenaArtCache[k].full=hit.strRender||hit.strCutout||hit.strThumb||"";arenaArtCache[k].half=hit.strCutout||hit.strRender||hit.strThumb||""}
  }catch(e){}
  arenaArtCache[k].loading=false;
  return artworkA(p);
}
function syncFieldA(){
  assignSlotsA();
  document.querySelectorAll("#staticArena .static-art").forEach(img=>{
    img.style.pointerEvents="none";img.style.cursor="default";img.draggable=false;
    const p=arenaField.find(x=>x.fieldSlot===img.dataset.fieldSlot);
    const active=!!p&&img.dataset.artMode===playerView;
    if(p){
      const pos=fieldPosA(p);
      img.dataset.artKey=akey(p.name);img.dataset.playerName=p.name;
      img.style.setProperty("left",pos.x+"%","important");img.style.setProperty("top",pos.y+"%","important");
      img.style.display=active?"block":"none";img.style.visibility=active?"visible":"hidden";img.style.opacity=active?"1":"0";
      img.style.pointerEvents=active?"auto":"none";
      if(active) img.style.cursor="default";
      const local=window.ARENA_ARTWORK_MANIFEST?.[akey(p.name)]?.[img.dataset.artMode];
      if(local&&img.src!==new URL(local,location.href).href)img.src=local;
    }else{
      img.style.display="none";img.style.visibility="hidden";img.style.opacity="0";
    }
  });
  bindFieldA();
}
function bindFieldA(){
  document.querySelectorAll("#staticArena .static-art").forEach(img=>{
    if(img.dataset.fieldBound==="1")return;img.dataset.fieldBound="1";
    img.addEventListener("click",e=>{
      e.preventDefault();e.stopPropagation();
      if(img.dataset.artMode!==playerView)return;
      const p=arenaField.find(x=>x.name===img.dataset.playerName);if(!p)return;
      const old=document.querySelector("#playerFocus");if(old)old.remove();
      const c=document.createElement("div");c.id="playerFocus";c.className="player-focus field-player-focus";
      c.innerHTML="<span>#"+p.number+" · "+p.pos+"</span><strong>"+p.name+"</strong><small>ON FIELD · POSITION LOCKED</small><div class=\"field-return-actions\"><button data-ret=\"lineup\">Return to Lineup</button><button data-ret=\"substitute\">Send to Substitute</button></div>";
      document.querySelector(".arena-shell")?.appendChild(c);
      c.querySelectorAll("[data-ret]").forEach(b=>b.onclick=()=>returnA(p.name,b.dataset.ret));
    });
  });
}
function poolRowA(p,type){
  const e=document.createElement("div");e.className="player-row pool-player-row";e.dataset.player=p.name;e.dataset.pool=type;
  e.innerHTML='<div class="player-main"><img class="pool-player-image" alt="" draggable="false"><span class="num">'+p.number+'</span><div><div class="name">'+p.name+'</div><div class="pos">'+p.pos+'</div></div></div><span class="badge">'+(type==="lineup"?"LINEUP":"SUB")+"</span>";
  const im=e.querySelector(".pool-player-image"),set=u=>{if(u){im.src=u;e.dataset.dragSrc=u;im.style.visibility="visible"}};
  set(artworkA(p));fetchArtA(p).then(set);
  im.onerror=()=>im.style.visibility="hidden";
  e.onclick=()=>{if(!arenaDrag?.moved)selectPlayer(p)};
  e.addEventListener("pointerdown",ev=>startA(e,p,type,ev));
  e.addEventListener("pointermove",ev=>moveA(e,ev));
  e.addEventListener("pointerup",ev=>endA(e,ev));e.addEventListener("pointercancel",ev=>endA(e,ev));
  e.draggable=true;
  e.addEventListener("dragstart",ev=>{ev.dataTransfer.effectAllowed="move";ev.dataTransfer.setData("application/x-nl4-pool-type",type);ev.dataTransfer.setData("text/plain",p.name);const s=e.dataset.dragSrc||im.src;if(s){const g=new Image();g.src=s;try{ev.dataTransfer.setDragImage(g,32,32)}catch(x){}}});
  return e;
}
function rebuildA(){
  const l=document.querySelector("#lineupList"),b=document.querySelector("#benchList");
  if(l){l.innerHTML="";if(!arenaLineup.length){l.innerHTML='<div class="pool-empty">No players in lineup</div>'}else arenaLineup.forEach(p=>l.appendChild(poolRowA(p,"lineup")));dropA(l,"lineup")}
  if(b){b.innerHTML="";arenaBench.forEach(p=>b.appendChild(poolRowA(p,"substitute")));if(!arenaBench.length)b.innerHTML='<div class="pool-empty">No substitutes</div>';dropA(b,"substitute")}
  syncFieldA();saveA();
}
function ghostA(e,p,x,y){
  if(arenaGhost)arenaGhost.remove();arenaGhost=document.createElement("img");arenaGhost.className="arena-drag-ghost";arenaGhost.src=e.dataset.dragSrc||e.querySelector("img")?.src||artworkA(p);arenaGhost.draggable=false;document.body.appendChild(arenaGhost);arenaGhost.style.left=(x+12)+"px";arenaGhost.style.top=(y+12)+"px";
}
function clearA(){document.querySelector("#staticArena")?.classList.remove("pool-drag-ready","pool-drag-hover");document.querySelectorAll(".pool-drop-hover,.drop-target").forEach(x=>x.classList.remove("pool-drop-hover","drop-target"));if(arenaGhost){arenaGhost.remove();arenaGhost=null}}
function startA(e,p,type,ev){if(ev.button!==undefined&&ev.button!==0)return;arenaDrag={name:p.name,type,id:ev.pointerId,moved:false};e.setPointerCapture?.(ev.pointerId);e.dataset.x=ev.clientX;e.dataset.y=ev.clientY}
function moveA(e,ev){
  if(!arenaDrag||arenaDrag.id!==ev.pointerId)return;
  const dx=Math.abs(ev.clientX-(+e.dataset.x||ev.clientX)),dy=Math.abs(ev.clientY-(+e.dataset.y||ev.clientY));
  if(!arenaDrag.moved&&dx+dy>=5){arenaDrag.moved=true;const p=poolA(arenaDrag.type).find(x=>x.name===arenaDrag.name);ghostA(e,p,ev.clientX,ev.clientY);document.querySelector("#staticArena")?.classList.add("pool-drag-ready")}
  if(!arenaDrag.moved)return;ev.preventDefault();if(arenaGhost){arenaGhost.style.left=(ev.clientX+12)+"px";arenaGhost.style.top=(ev.clientY+12)+"px"}
  const layer=document.querySelector("#staticArena .static-art-layer"),r=layer?.getBoundingClientRect();if(!r)return;
  const inside=ev.clientX>=r.left&&ev.clientX<=r.right&&ev.clientY>=r.top&&ev.clientY<=r.bottom;
  document.querySelector("#staticArena")?.classList.toggle("pool-drag-hover",inside);
  document.querySelectorAll(".drop-target").forEach(x=>x.classList.remove("drop-target"));
  if(inside){const i=nearestA(ev.clientX,ev.clientY);if(i>=0){const p=arenaField[i];document.querySelectorAll('#staticArena .static-art[data-player-name="'+CSS.escape(p.name)+'"]').forEach(x=>x.classList.add("drop-target"))}}
  document.querySelectorAll("#lineupList,#benchList").forEach(x=>x.classList.remove("pool-drop-hover"));
  if(!inside){const z=document.elementFromPoint(ev.clientX,ev.clientY)?.closest("#lineupList,#benchList");if(z)z.classList.add("pool-drop-hover")}
}
function nearestA(x,y){
  const r=document.querySelector("#staticArena .static-art-layer")?.getBoundingClientRect();if(!r)return-1;let bi=-1,bd=1e99;
  arenaField.forEach((p,i)=>{const q=fieldPosA(p),px=r.left+r.width*q.x/100,py=r.top+r.height*q.y/100,d=(x-px)**2+(y-py)**2;if(d<bd){bd=d;bi=i}});return bi;
}
function endA(e,ev){
  if(!arenaDrag||arenaDrag.id!==ev.pointerId)return;const d={...arenaDrag};arenaDrag=null;clearA();try{e.releasePointerCapture?.(ev.pointerId)}catch(x){}
  if(!d.moved)return;
  const r=document.querySelector("#staticArena .static-art-layer")?.getBoundingClientRect();
  if(r&&ev.clientX>=r.left&&ev.clientX<=r.right&&ev.clientY>=r.top&&ev.clientY<=r.bottom){const i=nearestA(ev.clientX,ev.clientY);if(i>=0)replaceA(d.name,d.type,i);return}
  const z=document.elementFromPoint(ev.clientX,ev.clientY)?.closest("#lineupList,#benchList");if(z)movePoolA(d.name,d.type,z.id==="lineupList"?"lineup":"substitute");
}
function movePoolA(name,from,to){if(from===to)return;const p=poolA(from).findIndex(x=>x.name===name);if(p<0)return;const q=poolA(from).splice(p,1)[0];poolA(to).push(q);rebuildA()}
function replaceA(name,type,i){
  const pi=poolA(type).findIndex(x=>x.name===name);if(pi<0||!arenaField[i])return;
  const incoming=poolA(type).splice(pi,1)[0],out=arenaField[i],pos=fieldPosA(out),slot=out.fieldSlot;
  arenaField[i]=fieldA(incoming,pos,slot);poolA(type).push({...out,displayX:undefined,displayY:undefined});
  const art=artworkA(incoming);if(art)syncIncomingA(incoming,art);else fetchArtA(incoming).then(u=>syncIncomingA(incoming,u));
  rebuildA();
}
function syncIncomingA(p,url){
  const key=akey(p.name),cache=arenaArtCache[key]||{};
  document.querySelectorAll('#staticArena .static-art[data-field-slot="'+CSS.escape(p.fieldSlot)+'"]').forEach(img=>{
    img.dataset.artKey=key;img.dataset.playerName=p.name;
    const u=cache[img.dataset.artMode]||url;
    if(u)img.src=u;
  });syncFieldA()
}
function returnA(name,to){
  const i=arenaField.findIndex(p=>p.name===name);if(i<0)return;const p=arenaField.splice(i,1)[0];poolA(to).push({...p,displayX:undefined,displayY:undefined});rebuildA()
}
function dropA(box,type){
  if(box.dataset.dropReady==="1")return;box.dataset.dropReady="1";
  box.addEventListener("dragover",e=>{e.preventDefault();box.classList.add("pool-drop-hover")});
  box.addEventListener("dragleave",e=>{if(!box.contains(e.relatedTarget))box.classList.remove("pool-drop-hover")});
  box.addEventListener("drop",e=>{e.preventDefault();box.classList.remove("pool-drop-hover");const from=e.dataTransfer.getData("application/x-nl4-pool-type"),name=e.dataTransfer.getData("text/plain");if(from&&name)movePoolA(name,from,type)});
}
function enableArenaPlayerDragging(){/* Field players are intentionally locked. */ }
function applySavedPlayerPositions(){/* V2 owns field positions. */ }

loadA();assignSlotsA();rebuildA();renderStaticPlayerPhotos().then(()=>syncFieldA());
