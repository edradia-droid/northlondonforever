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

fillLists();
if(staticArena) staticArena.style.display="grid";

document.querySelectorAll("[data-player-view]").forEach(b=>b.addEventListener("click",()=>setPlayerView(b.dataset.playerView)));
document.querySelectorAll("[data-camera]").forEach(b=>b.addEventListener("click",()=>setCamera(b.dataset.camera)));

const reset=document.querySelector("#resetCamera"); if(reset) reset.onclick=()=>{zoom=1;setCamera("broadcast");};
const zoomIn=document.querySelector("#zoomIn"); if(zoomIn) zoomIn.onclick=()=>setZoom(.08);
const zoomOut=document.querySelector("#zoomOut"); if(zoomOut) zoomOut.onclick=()=>setZoom(-.08);

setCamera("broadcast");
setPlayerView("full");
renderStaticPlayerPhotos();


/* DRAGGABLE ARENA PLAYERS
   Each player can be positioned independently in Full Body and Half Body.
   Positions are stored locally so the user's arrangement survives refreshes. */
const PLAYER_POSITION_STORAGE_KEY="nl4-arena-player-positions-v1";

function readPlayerPositions(){
  try{
    const raw=localStorage.getItem(PLAYER_POSITION_STORAGE_KEY);
    const parsed=raw?JSON.parse(raw):{};
    return parsed && typeof parsed==="object" ? parsed : {};
  }catch(e){ return {}; }
}

function writePlayerPositions(positions){
  try{ localStorage.setItem(PLAYER_POSITION_STORAGE_KEY,JSON.stringify(positions)); }catch(e){}
}

function playerPositionKey(img){
  return String(img.dataset.artKey||"")+"__"+String(img.dataset.artMode||playerView);
}

function clampPercent(value,min,max){
  return Math.max(min,Math.min(max,value));
}

function applySavedPlayerPositions(){
  const positions=readPlayerPositions();
  document.querySelectorAll("#staticArena .static-art").forEach(img=>{
    const saved=positions[playerPositionKey(img)];
    if(!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return;
    img.style.setProperty("left",clampPercent(saved.x,0,100)+"%","important");
    img.style.setProperty("top",clampPercent(saved.y,0,100)+"%","important");
  });
}

function enableArenaPlayerDragging(){
  const layer=document.querySelector("#staticArena .static-art-layer");
  if(!layer) return;

  applySavedPlayerPositions();

  layer.querySelectorAll(".static-art").forEach(img=>{
    if(img.dataset.dragReady==="1") return;
    img.dataset.dragReady="1";
    img.style.cursor="grab";
    img.style.touchAction="none";
    img.style.pointerEvents="auto";

    let dragging=false;
    let pointerId=null;

    img.addEventListener("pointerdown",event=>{
      if(img.dataset.artMode!==playerView) return;
      if(event.button!==undefined && event.button!==0) return;
      dragging=true;
      pointerId=event.pointerId;
      img.dataset.dragStartLeft=img.style.left || getComputedStyle(img).left;
      img.dataset.dragStartTop=img.style.top || getComputedStyle(img).top;
      img.setPointerCapture?.(pointerId);
      img.style.cursor="grabbing";
      event.preventDefault();
      event.stopPropagation();
    });

    img.addEventListener("pointermove",event=>{
      if(!dragging || event.pointerId!==pointerId) return;
      const rect=layer.getBoundingClientRect();
      if(!rect.width || !rect.height) return;

      const x=clampPercent(((event.clientX-rect.left)/rect.width)*100,0,100);
      const y=clampPercent(((event.clientY-rect.top)/rect.height)*100,0,100);

      img.style.setProperty("left",x+"%","important");
      img.style.setProperty("top",y+"%","important");
      event.preventDefault();
      event.stopPropagation();
    });

    const finishDrag=event=>{
      if(!dragging || (event && pointerId!==event.pointerId)) return;
      dragging=false;
      img.style.cursor="grab";

      const left=parseFloat(img.style.left);
      const top=parseFloat(img.style.top);
      if(Number.isFinite(left) && Number.isFinite(top)){
        const positions=readPlayerPositions();
        positions[playerPositionKey(img)]={x:clampPercent(left,0,100),y:clampPercent(top,0,100)};
        writePlayerPositions(positions);
      }
      if(pointerId!==null){
        try{ img.releasePointerCapture?.(pointerId); }catch(e){}
      }
      pointerId=null;
    };

    img.addEventListener("pointerup",finishDrag);
    img.addEventListener("pointercancel",finishDrag);

    img.addEventListener("dblclick",event=>{
      event.preventDefault();
      event.stopPropagation();
      const positions=readPlayerPositions();
      delete positions[playerPositionKey(img)];
      writePlayerPositions(positions);
      img.style.removeProperty("left");
      img.style.removeProperty("top");
    });
  });
}

const originalRenderStaticPlayerPhotos=renderStaticPlayerPhotos;
renderStaticPlayerPhotos=async function(){
  await originalRenderStaticPlayerPhotos();
  enableArenaPlayerDragging();
  applySavedPlayerPositions();
};
