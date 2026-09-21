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
  try{
    const res=await fetch("./player-assets/manifest.json?v=20260921-22",{cache:"no-store"});
    if(!res.ok) return {};
    return await res.json();
  }catch(e){ return {}; }
}

async function loadLiveArtwork(player){
  try{
    const q=encodeURIComponent(player.name.replace(/\s+/g,"_"));
    const res=await fetch("https://www.thesportsdb.com/api/v1/json/123/searchplayers.php?p="+q,{cache:"no-store"});
    if(!res.ok) return null;
    const json=await res.json();
    const key=normalizeArtworkName(player.name);
    const list=Array.isArray(json.player)?json.player:[];
    const found=list.find(x=>normalizeArtworkName(x.strPlayer)===key && String(x.strTeam||"").trim().toLowerCase()==="arsenal");
    if(!found) return null;
    return {full:found.strCutout||null,half:found.strRender||null};
  }catch(e){ return null; }
}

async function renderStaticPlayerPhotos(){
  if(!staticPitch) return;
  staticPitch.querySelectorAll(".arena-player-hit").forEach(el=>el.remove());
  const manifest=await loadArtworkManifest();

  for(const p of DATA.starters){
    let artwork=manifest[normalizeArtworkName(p.name)];

    // Accept the legacy half-body manifest entries that are plain image paths.
    // They are the dedicated Player Render assets, not thumbnails.
    if(playerView==="half" && typeof artwork==="string"){
      artwork={half:artwork};
    }

    // Older full-body manifests used generated keys, so also resolve by sourceName.
    if((!artwork || typeof artwork!=="object" || !artwork[playerView]) && playerView==="full"){
      const wanted=normalizeArtworkName(p.name);
      const match=Object.values(manifest).find(value =>
        value && typeof value==="object" &&
        normalizeArtworkName(value.sourceName)===wanted &&
        value.full
      );
      if(match) artwork=match;
    }

    if(!artwork || typeof artwork!=="object" || !artwork[playerView]){
      artwork=await loadLiveArtwork(p);
    }

    const url=artwork && typeof artwork==="object" ? artwork[playerView] : null;
    if(!url) continue;

    const hit=document.createElement("button");
    hit.type="button"; hit.className="arena-player-hit";
    hit.setAttribute("aria-label","Select "+p.name); hit.title=p.name; hit.dataset.player=p.name;
    hit.style.left=(50+(p.x/48)*44)+"%";
    hit.style.top=(50-(p.y/58)*42)+"%";

    const photo=document.createElement("img");
    photo.className="arena-photo-player"; photo.alt=""; photo.draggable=false;
    photo.loading="eager"; photo.src=url;
    photo.style.height=playerView==="full"?"250px":"145px";
    photo.style.left="50%"; photo.style.top="100%"; photo.style.pointerEvents="none";

    hit.appendChild(photo);
    hit.style.pointerEvents="auto";
    hit.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();selectPlayer(p);});
    staticPitch.appendChild(hit);
  }
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
