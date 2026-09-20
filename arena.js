const DATA={formation:"4-3-3",starters:[{name:"David Raya",number:1,pos:"GK",x:0,y:-38},{name:"Jurriën Timber",number:12,pos:"RB",x:30,y:-22},{name:"Ezri Konsa",number:15,pos:"CB",x:10,y:-27},{name:"Gabriel",number:6,pos:"CB",x:-10,y:-27},{name:"Riccardo Calafiori",number:33,pos:"LB",x:-30,y:-22},{name:"Declan Rice",number:41,pos:"DM",x:0,y:-2},{name:"Bruno Guimarães",number:39,pos:"CM",x:24,y:2},{name:"Martin Ødegaard",number:8,pos:"CM",x:-24,y:2},{name:"Bukayo Saka",number:7,pos:"RW",x:30,y:30},{name:"Christos Tzolis",number:17,pos:"LW",x:-30,y:30},{name:"Kai Havertz",number:29,pos:"ST",x:0,y:34}],bench:[{name:"Kepa Arrizabalaga",number:13,pos:"GK"},{name:"Piero Hincapié",number:5,pos:"DEF"},{name:"Eberechi Eze",number:10,pos:"MID"},{name:"Viktor Gyökeres",number:14,pos:"FWD"},{name:"Noni Madueke",number:20,pos:"FWD"},{name:"Mikel Merino",number:23,pos:"MID"},{name:"Martín Zubimendi",number:36,pos:"MID"},{name:"Myles Lewis-Skelly",number:49,pos:"DEF"},{name:"Max Dowman",number:56,pos:"FWD"}],substitutions:[]};

const root=document.querySelector("#scene");
const staticArena=document.querySelector("#staticArena");
const staticPitch=document.querySelector(".static-pitch");
let renderer=null;

function selectPlayer(player){
  document.querySelectorAll(".player-row").forEach(row=>row.classList.toggle("selected", row.dataset.player===player.name));
  const existing=document.querySelector("#playerFocus");
  if(existing) existing.remove();
  const card=document.createElement("div"); card.id="playerFocus"; card.className="player-focus";
  card.innerHTML="<span>#"+player.number+" · "+player.pos+"</span><strong>"+player.name+"</strong><small>"+DATA.formation+" · Arsenal XI</small>";
  document.querySelector(".arena-shell").appendChild(card);
}

function fillLists(){
  document.querySelector("#formation").textContent=DATA.formation;
  const list=document.querySelector("#lineupList"); list.innerHTML="";
  DATA.starters.forEach(p=>{const e=document.createElement("div");e.className="player-row";e.dataset.player=p.name;e.innerHTML='<div class="player-main"><span class="num">'+p.number+'</span><div><div class="name">'+p.name+'</div><div class="pos">'+p.pos+'</div></div></div>';list.appendChild(e);e.onclick=()=>selectPlayer(p)});
  const bench=document.querySelector("#benchList"); bench.innerHTML="";
  DATA.bench.forEach(p=>{const e=document.createElement("div");e.className="player-row";e.dataset.player=p.name;e.innerHTML='<div class="player-main"><span class="num">'+p.number+'</span><div><div class="name">'+p.name+'</div><div class="pos">'+p.pos+'</div></div></div><span class="badge">BENCH</span>';bench.appendChild(e);e.onclick=()=>selectPlayer(p)});
}
fillLists();

function initCssFallback(){
  if(staticArena) staticArena.style.display="grid";
  document.querySelectorAll(".fallback-message,.arena-fallback").forEach(e=>e.remove());
  let scale=1;
  const apply=angle=>{if(staticPitch) staticPitch.style.transform="perspective(1000px) rotateX("+angle+"deg) scale("+scale+")"};
  document.querySelector("#zoomIn").onclick=()=>{scale=Math.min(1.25,scale+.08);apply(52)};
  document.querySelector("#zoomOut").onclick=()=>{scale=Math.max(.82,scale-.08);apply(52)};
  document.querySelector("#resetCamera").onclick=()=>{scale=1;apply(52)};
  document.querySelectorAll("[data-camera]").forEach(b=>b.onclick=()=>apply(b.dataset.camera==="top"?18:b.dataset.camera==="tactical"?42:52));
}
if(typeof THREE==="undefined"){
  initCssFallback();
}else{
  try{
    renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance",alpha:false});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    const rect=root.getBoundingClientRect(); renderer.setSize(Math.max(1,rect.width),Math.max(1,rect.height),false);
    renderer.shadowMap.enabled=true; renderer.outputColorSpace=THREE.SRGBColorSpace; root.appendChild(renderer.domElement);
    if(staticArena) staticArena.style.display="grid";
  }catch(error){ initCssFallback(); renderer=null; }

  if(renderer){
    const scene=new THREE.Scene(); scene.background=new THREE.Color(0x020a06); scene.fog=new THREE.Fog(0x020a06,90,190);
    const camera=new THREE.PerspectiveCamera(42,root.clientWidth/root.clientHeight,.1,500); camera.position.set(0,78,92);
    scene.add(new THREE.HemisphereLight(0xffffff,0x183126,2.2));
    const key=new THREE.DirectionalLight(0xffffff,3.2); key.position.set(-30,70,25); key.castShadow=true; scene.add(key);
    const group=new THREE.Group(); scene.add(group);
    const field=new THREE.Mesh(new THREE.PlaneGeometry(68,105),new THREE.MeshStandardMaterial({color:0x0d5b31,roughness:.9})); field.rotation.x=-Math.PI/2; field.receiveShadow=true; group.add(field);
    const line=(w,h,x,z)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.72,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set(x,.025,z);group.add(m)};
    line(64,.16,0,-52.5);line(64,.16,0,52.5);line(.16,105,-34,0);line(.16,105,34,0);line(64,.16,0,0);
    const circle=new THREE.Mesh(new THREE.RingGeometry(9.1,9.25,96),new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,transparent:true,opacity:.72}));circle.rotation.x=-Math.PI/2;circle.position.y=.03;group.add(circle);
    const playerMeshes=[];
    const textureLoader=new THREE.TextureLoader();
    textureLoader.setCrossOrigin("anonymous");

    function addGroundShadow(g){
      const shadow=new THREE.Mesh(
        new THREE.CircleGeometry(2.2,32),
        new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.28,depthWrite:false})
      );
      shadow.rotation.x=-Math.PI/2;
      shadow.position.y=.04;
      shadow.scale.set(1,.55,1);
      g.add(shadow);
    }

    function addFallbackPlayer(p,g){
      const body=new THREE.Mesh(new THREE.CapsuleGeometry(1.55,3.8,6,12),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.5}));
      body.position.y=3.2; body.castShadow=true; g.add(body);
      const shirt=new THREE.Mesh(new THREE.CylinderGeometry(1.62,1.55,2.6,16),new THREE.MeshStandardMaterial({color:0xb5000d,roughness:.5}));
      shirt.position.y=4; shirt.castShadow=true; g.add(shirt);
      const head=new THREE.Mesh(new THREE.SphereGeometry(1.02,16,12),new THREE.MeshStandardMaterial({color:0xc98765,roughness:.8}));
      head.position.y=6.2; head.castShadow=true; g.add(head);
      addGroundShadow(g);
    }

    function addImagePlayer(p,g,url){
      const photo=document.createElement("img");
      photo.className="arena-photo-player";
      photo.alt=p.name;
      photo.title=p.name;
      photo.draggable=false;
      photo.src=url;
      photo.onload=()=>{
        photo.style.left=(50+(p.x/60)*42)+"%";
        photo.style.top=(50-(p.y/72)*43)+"%";
        photo.style.height=(p.pos==="GK"?"92px":"108px");
        photo.dataset.player=p.name;
        photo.addEventListener("click",()=>selectPlayer(p));
        staticPitch.appendChild(photo);
        addGroundShadow(g);
      };
      photo.onerror=()=>addFallbackPlayer(p,g);
    }

    const normalizeArtworkName=value=>String(value||"")
      .replace(/[Øø]/g,"o")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .replace(/[^a-z0-9]+/gi,"")
      .toLowerCase();

    const artworkCache=new Map();

    async function resolvePlayerRender(p){
      const key=normalizeArtworkName(p.name);
      if(artworkCache.has(key)) return artworkCache.get(key);
      try{
        const q=encodeURIComponent(p.name.replace(/\s+/g,"_"));
        const res=await fetch("https://www.thesportsdb.com/api/v1/json/123/searchplayers.php?p="+q,{cache:"no-store"});
        if(!res.ok) throw new Error("player artwork lookup failed");
        const json=await res.json();
        const players=json.player||[];
        const player=players.find(x=>normalizeArtworkName(x.strPlayer)===key && String(x.strTeam||"").toLowerCase()==="arsenal")
          || players.find(x=>normalizeArtworkName(x.strPlayer)===key)
          || players.find(x=>String(x.strTeam||"").toLowerCase()==="arsenal");
        const url=player && (player.strRender || player.strCutout || player.strThumb || null);
        artworkCache.set(key,url);
        return url;
      }catch(error){
        artworkCache.set(key,null);
        return null;
      }
    }

    async function createPlayer(p){
      const g=new THREE.Group();
      g.userData.player=p;
      g.position.set(p.x,0,p.y);
      group.add(g);
      playerMeshes.push(g);

      const url=await resolvePlayerRender(p);
      if(url) addImagePlayer(p,g,url);
      else addFallbackPlayer(p,g);
    }

    DATA.starters.forEach(p=>createPlayer(p));    const raycaster=new THREE.Raycaster();const pointer=new THREE.Vector2();
    renderer.domElement.addEventListener("pointerdown",event=>{const r=renderer.domElement.getBoundingClientRect();pointer.x=((event.clientX-r.left)/r.width)*2-1;pointer.y=-((event.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(playerMeshes,true)[0];if(hit){let o=hit.object;while(o.parent&& !o.userData.player)o=o.parent; if(o.userData.player){selectPlayer(o.userData.player);playerMeshes.forEach(m=>m.scale.setScalar(m===o?1.12:1));}}});
    const setCamera=mode=>{if(mode==="top")camera.position.set(0,125,.1);else if(mode==="tactical")camera.position.set(0,70,118);else camera.position.set(0,55,92)};
    document.querySelectorAll("[data-camera]").forEach(b=>b.onclick=()=>setCamera(b.dataset.camera));document.querySelector("#resetCamera").onclick=()=>setCamera("broadcast");document.querySelector("#zoomIn").onclick=()=>camera.position.multiplyScalar(.9);document.querySelector("#zoomOut").onclick=()=>camera.position.multiplyScalar(1.1);
    addEventListener("resize",()=>{const w=Math.max(1,root.clientWidth),h=Math.max(1,root.clientHeight);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)});
    (function animate(){requestAnimationFrame(animate);renderer.render(scene,camera)})();
  }
}