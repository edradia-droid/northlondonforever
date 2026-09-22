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
      // A full XI means Lineup is empty. Any stale lineup entries are moved to Substitute.
      if(arenaField.length>=11&&arenaLineup.length){arenaBench.push(...arenaLineup);arenaLineup=[];}
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
let fieldDragA=null,fieldClickBlockA=0;
function fieldPointerDownA(img,ev){
  if(ev.button!==undefined&&ev.button!==0)return;
  const p=arenaField.find(x=>x.name===img.dataset.playerName);if(!p||img.dataset.artMode!==playerView)return;
  fieldDragA={name:p.name,id:ev.pointerId,startX:ev.clientX,startY:ev.clientY,moved:false};
  img.setPointerCapture?.(ev.pointerId);
  ev.preventDefault();ev.stopPropagation();
}
function fieldPointerMoveA(img,ev){
  if(!fieldDragA||fieldDragA.id!==ev.pointerId)return;
  const dx=Math.abs(ev.clientX-fieldDragA.startX),dy=Math.abs(ev.clientY-fieldDragA.startY);
  if(!fieldDragA.moved&&dx+dy<5)return;
  fieldDragA.moved=true;ev.preventDefault();ev.stopPropagation();
  const layer=document.querySelector("#staticArena .static-art-layer"),r=layer?.getBoundingClientRect();if(!r)return;
  const p=arenaField.find(x=>x.name===fieldDragA.name);if(!p)return;
  const x=clampA(((ev.clientX-r.left)/r.width)*100),y=clampA(((ev.clientY-r.top)/r.height)*100);
  p.displayX=x;p.displayY=y;p.x=(x-50)*2;p.y=(y-50)*-2;
  document.querySelectorAll('#staticArena .static-art[data-field-slot="'+CSS.escape(p.fieldSlot)+'"]').forEach(el=>{
    el.style.setProperty("left",x+"%","important");el.style.setProperty("top",y+"%","important");
  });
}
function fieldPointerUpA(img,ev){
  if(!fieldDragA||fieldDragA.id!==ev.pointerId)return;
  const d={...fieldDragA};fieldDragA=null;
  try{img.releasePointerCapture?.(ev.pointerId)}catch(e){}
  if(d.moved){fieldClickBlockA=Date.now()+180;saveA();ev.preventDefault();ev.stopPropagation();}
}
function bindFieldA(){
  document.querySelectorAll("#staticArena .static-art").forEach(img=>{
    if(img.dataset.fieldBound==="1")return;
    img.dataset.fieldBound="1";
    img.addEventListener("pointerdown",e=>fieldPointerDownA(img,e));
    img.addEventListener("pointermove",e=>fieldPointerMoveA(img,e));
    img.addEventListener("pointerup",e=>fieldPointerUpA(img,e));
    img.addEventListener("pointercancel",e=>fieldPointerUpA(img,e));
    img.addEventListener("click",e=>{
      e.preventDefault();e.stopPropagation();
      if(Date.now()<fieldClickBlockA)return;
      if(img.dataset.artMode!==playerView)return;
      const p=arenaField.find(x=>x.name===img.dataset.playerName);if(!p)return;
      const old=document.querySelector("#playerFocus");if(old)old.remove();
      const c=document.createElement("div");c.id="playerFocus";c.className="player-focus field-player-focus";
      c.innerHTML="<span>#"+p.number+" · "+p.pos+"</span><strong>"+p.name+"</strong><small>ON FIELD · DRAG TO REPOSITION</small><div class=\"field-return-actions\"><button data-ret=\"lineup\">Return to Lineup</button><button data-ret=\"substitute\">Send to Substitute</button></div>";
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
  e.draggable=false;
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
  // Pool-to-pool dragging is intentionally disabled. Lineup and Substitute are separate pools.
}
function movePoolA(name,from,to){/* Intentionally locked: players cannot be dragged directly between Lineup and Substitute. */}
function replaceA(name,type,i){
  const pi=poolA(type).findIndex(x=>x.name===name);if(pi<0||!arenaField[i])return;
  const incoming=poolA(type)[pi],out=arenaField[i],pos=fieldPosA(out),slot=out.fieldSlot;
  // The outgoing pitch player takes the exact list position of the incoming player.
  poolA(type).splice(pi,1);
  poolA(type).splice(pi,0,{...out,displayX:undefined,displayY:undefined});
  arenaField[i]=fieldA(incoming,pos,slot);
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
  // Lineup <-> Substitute is locked. These lists are not drop targets.
  box.addEventListener("dragover",e=>{e.preventDefault();box.classList.remove("pool-drop-hover")});
  box.addEventListener("dragleave",e=>box.classList.remove("pool-drop-hover"));
  box.addEventListener("drop",e=>{e.preventDefault();box.classList.remove("pool-drop-hover")});
}
function enableArenaPlayerDragging(){/* Field players are intentionally locked. */ }
function applySavedPlayerPositions(){/* V2 owns field positions. */ }

loadA();assignSlotsA();rebuildA();renderStaticPlayerPhotos().then(()=>syncFieldA());

const arenaSetPlayerView=setPlayerView;
setPlayerView=function(view){arenaSetPlayerView(view);setTimeout(()=>syncFieldA(),0)};
