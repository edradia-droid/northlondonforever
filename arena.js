const DATA={formation:"4-3-3",starters:[{name:"David Raya",number:1,pos:"GK",x:0,y:-46},{name:"Jurriën Timber",number:12,pos:"RB",x:40,y:-25},{name:"Ezri Konsa",number:15,pos:"CB",x:14,y:-29},{name:"Gabriel",number:6,pos:"CB",x:-14,y:-29},{name:"Riccardo Calafiori",number:33,pos:"LB",x:-40,y:-25},{name:"Declan Rice",number:41,pos:"DM",x:0,y:-2},{name:"Bruno Guimarães",number:39,pos:"CM",x:34,y:2},{name:"Martin Ødegaard",number:8,pos:"CM",x:-34,y:2},{name:"Bukayo Saka",number:7,pos:"RW",x:42,y:35},{name:"Christos Tzolis",number:17,pos:"LW",x:-42,y:35},{name:"Kai Havertz",number:29,pos:"ST",x:0,y:43}],bench:[{name:"Kepa Arrizabalaga",number:13,pos:"GK"},{name:"Piero Hincapié",number:5,pos:"DEF"},{name:"Eberechi Eze",number:10,pos:"MID"},{name:"Viktor Gyökeres",number:14,pos:"FWD"},{name:"Noni Madueke",number:20,pos:"FWD"},{name:"Mikel Merino",number:23,pos:"MID"},{name:"Martín Zubimendi",number:36,pos:"MID"},{name:"Myles Lewis-Skelly",number:49,pos:"DEF"},{name:"Max Dowman",number:56,pos:"FWD"}]};

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
    const res=await fetch("./player-assets/manifest.json?v=20260921-32",{cache:"no-store"});
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
  // The HTML static-art layer is the single authoritative artwork layer.
  // Bind the generated manifest directly to the existing 22 image elements.
  // This deliberately does not create another player layer.
  if(!staticPitch) return;

  staticPitch.classList.toggle("view-full",playerView==="full");
  staticPitch.classList.toggle("view-half",playerView==="half");

  const manifest=await loadArtworkManifest();
  const images=document.querySelectorAll("#staticArena .static-art");
  images.forEach(img=>{
    const key=img.dataset.artKey;
    const mode=img.dataset.artMode;
    const boundAsset=img.getAttribute("src");
    const asset=manifest && manifest[key] ? manifest[key][mode] : boundAsset;
    const active=mode===playerView;

    img.style.display=active && asset ? "block" : "none";
    if(active && asset && img.getAttribute("src")!==asset) img.setAttribute("src",asset);
    img.style.visibility=active && asset ? "visible" : "hidden";
    img.style.opacity=active && asset ? "1" : "0";
    img.style.position="absolute";
    img.style.pointerEvents="none";

    if(asset && img.getAttribute("src")!==asset){
      img.setAttribute("src",asset);
    }

    img.loading="eager";
    img.decoding="sync";
    img.setAttribute("fetchpriority","high");

    const oldFallback=img.parentElement && img.parentElement.querySelector('.mobile-art-fallback[data-for="'+key+'"]');
    if(oldFallback) oldFallback.remove();

    const showFallback=()=>{
      if(img.dataset.artMode!==playerView || !window.matchMedia("(max-width:700px)").matches) return;
      img.style.visibility="hidden";
      img.style.opacity="0";
      const fallback=document.createElement("div");
      fallback.className="mobile-art-fallback";
      fallback.dataset.for=key;
      fallback.style.left=img.style.left;
      fallback.style.top=img.style.top;
      const player=DATA.starters.find(p=>normalizeArtworkName(p.name)===key);
      fallback.innerHTML='<b>#'+(player?player.number:"")+'</b><strong>'+(player?player.name:key)+'</strong>';
      img.parentElement.appendChild(fallback);
    };

    img.onerror=showFallback;
    img.onload=()=>{
      const f=img.parentElement && img.parentElement.querySelector('.mobile-art-fallback[data-for="'+key+'"]');
      if(f) f.remove();
      if(img.dataset.artMode===playerView){
        img.style.display="block";
        img.style.visibility="visible";
        img.style.opacity="1";
      }
    };
    if(img.complete && img.naturalWidth===0) showFallback();
    if(active && asset && window.matchMedia("(max-width:700px)").matches){
      img.style.display="block";
      img.style.visibility="visible";
      img.style.opacity="1";
    }

    // Mobile presentation labels: real artwork remains the visual player,
    // labels are a separate flat layer positioned from the same artwork anchor.
    if(img.dataset.artMode===playerView){
      const oldLabel=img.parentElement && img.parentElement.querySelector('.mobile-player-label[data-for="'+key+'"]');
      if(oldLabel) oldLabel.remove();
      const player=DATA.starters.find(p=>normalizeArtworkName(p.name)===key);
      if(player && window.matchMedia("(max-width:700px)").matches){
        const label=document.createElement("div");
        label.className="mobile-player-label";
        label.dataset.for=key;
        label.style.left=img.style.left;
        label.style.top=img.style.top;
        label.innerHTML='<small>#'+player.number+' · '+player.pos+'</small><strong>'+player.name.split(" ").pop()+'</strong>';
        img.parentElement.appendChild(label);
      }
    }
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
