const DATA={formation:"4-3-3",starters:[
{name:"David Raya",number:22,pos:"GK",x:0,y:-38},{name:"Ben White",number:4,pos:"RB",x:30,y:-22},{name:"William Saliba",number:2,pos:"CB",x:10,y:-27},{name:"Gabriel",number:6,pos:"CB",x:-10,y:-27},{name:"Riccardo Calafiori",number:33,pos:"LB",x:-30,y:-22},{name:"Martin Ødegaard",number:8,pos:"CM",x:24,y:2},{name:"Declan Rice",number:41,pos:"DM",x:0,y:-2},{name:"Mikel Merino",number:23,pos:"CM",x:-24,y:2},{name:"Bukayo Saka",number:7,pos:"RW",x:30,y:30},{name:"Viktor Gyökeres",number:14,pos:"ST",x:0,y:34},{name:"Gabriel Martinelli",number:11,pos:"LW",x:-30,y:30}],bench:[
{name:"Kepa Arrizabalaga",number:13,pos:"GK"},{name:"Jurrien Timber",number:12,pos:"DEF"},{name:"Piero Hincapié",number:5,pos:"DEF"},{name:"Martin Zubimendi",number:36,pos:"MID"},{name:"Eberechi Eze",number:10,pos:"MID"},{name:"Noni Madueke",number:20,pos:"FWD"}],substitutions:[]};

const root=document.querySelector("#scene");
let renderer;

try{
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance",alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  const rect=root.getBoundingClientRect();
  renderer.setSize(Math.max(1,rect.width),Math.max(1,rect.height),false);
  renderer.shadowMap.enabled=true;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  root.appendChild(renderer.domElement);

  const staticArena=document.querySelector("#staticArena");
  if(staticArena) staticArena.style.display="none";
}catch(error){
  console.error("NL4 3D Arena WebGL initialization failed:",error);

  // The HTML/CSS pitch is already the complete fallback.
  // Do not create a second fallback pitch on top of it.
  // Keep the UI (formation, camera controls and player lists) visible.
  const staticArena=document.querySelector("#staticArena");
  if(staticArena) staticArena.style.display="grid";

  // Stop here because Three.js cannot create a WebGL context.
  // The dependency-free CSS 3D pitch remains visible instead.
  fillLists();
  document.querySelectorAll("[data-camera]").forEach(b=>b.onclick=()=>{});
  const reset=document.querySelector("#resetCamera");
  const zoomIn=document.querySelector("#zoomIn");
  const zoomOut=document.querySelector("#zoomOut");
  if(reset) reset.onclick=()=>{};
  if(zoomIn) zoomIn.onclick=()=>{};
  if(zoomOut) zoomOut.onclick=()=>{};
  throw new Error("WEBGL_UNAVAILABLE");
}

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x020a06);
scene.fog=new THREE.Fog(0x020a06,90,190);

const camera=new THREE.PerspectiveCamera(42,root.clientWidth/root.clientHeight,.1,500);
camera.position.set(0,78,92);

scene.add(new THREE.HemisphereLight(0xffffff,0x183126,2.2));
const key=new THREE.DirectionalLight(0xffffff,3.2);
key.position.set(-30,70,25);
key.castShadow=true;
scene.add(key);

const group=new THREE.Group();
scene.add(group);

const field=new THREE.Mesh(
  new THREE.PlaneGeometry(68,105),
  new THREE.MeshStandardMaterial({color:0x0d5b31,roughness:.9})
);
field.rotation.x=-Math.PI/2;
field.receiveShadow=true;
group.add(field);

function line(w,h,x,z){
  const m=new THREE.Mesh(
    new THREE.PlaneGeometry(w,h),
    new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.72,side:THREE.DoubleSide})
  );
  m.rotation.x=-Math.PI/2;
  m.position.set(x,.025,z);
  group.add(m);
}
line(64,.16,0,-52.5);
line(64,.16,0,52.5);
line(.16,105,-34,0);
line(.16,105,34,0);
line(64,.16,0,0);

const circle=new THREE.Mesh(
  new THREE.RingGeometry(9.1,9.25,96),
  new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,transparent:true,opacity:.72})
);
circle.rotation.x=-Math.PI/2;
circle.position.y=.03;
group.add(circle);

const players=new Map();

function makePlayer(p){
  const g=new THREE.Group();
  const body=new THREE.Mesh(
    new THREE.CapsuleGeometry(1.55,3.8,6,12),
    new THREE.MeshStandardMaterial({color:0xffffff,roughness:.5})
  );
  body.position.y=3.2;
  body.castShadow=true;
  g.add(body);

  const shirt=new THREE.Mesh(
    new THREE.CylinderGeometry(1.62,1.55,2.6,16),
    new THREE.MeshStandardMaterial({color:0xb5000d,roughness:.5})
  );
  shirt.position.y=4;
  shirt.castShadow=true;
  g.add(shirt);

  const head=new THREE.Mesh(
    new THREE.SphereGeometry(1.02,16,12),
    new THREE.MeshStandardMaterial({color:0xc98765,roughness:.8})
  );
  head.position.y=6.2;
  head.castShadow=true;
  g.add(head);

  g.position.set(p.x,0,p.y);
  g.userData=p;
  group.add(g);
  players.set(p.name,g);
}

DATA.starters.forEach(makePlayer);

function fillLists(){
  document.querySelector("#formation").textContent=DATA.formation;

  const list=document.querySelector("#lineupList");
  list.innerHTML="";
  DATA.starters.forEach(p=>{
    const e=document.createElement("div");
    e.className="player-row";
    e.innerHTML='<div class="player-main"><span class="num">'+p.number+'</span><div><div class="name">'+p.name+'</div><div class="pos">'+p.pos+'</div></div></div>';
    e.onclick=()=>select(p.name,e);
    list.appendChild(e);
  });

  const bench=document.querySelector("#benchList");
  bench.innerHTML="";
  DATA.bench.forEach(p=>{
    const e=document.createElement("div");
    e.className="player-row";
    e.innerHTML='<div class="player-main"><span class="num">'+p.number+'</span><div><div class="name">'+p.name+'</div><div class="pos">'+p.pos+'</div></div></div><span class="badge">BENCH</span>';
    bench.appendChild(e);
  });
}

function select(name,e){
  document.querySelectorAll(".player-row").forEach(x=>x.classList.remove("selected"));
  e.classList.add("selected");
  const p=players.get(name);
  if(p) camera.position.set(p.position.x+34,48,p.position.z+42);
}

fillLists();

function setCamera(mode){
  if(mode==="top") camera.position.set(0,125,.1);
  else if(mode==="tactical") camera.position.set(0,70,118);
  else camera.position.set(0,55,92);
}

document.querySelectorAll("[data-camera]").forEach(b=>b.onclick=()=>setCamera(b.dataset.camera));
document.querySelector("#resetCamera").onclick=()=>setCamera("broadcast");
document.querySelector("#zoomIn").onclick=()=>camera.position.multiplyScalar(.9);
document.querySelector("#zoomOut").onclick=()=>camera.position.multiplyScalar(1.1);

addEventListener("resize",()=>{
  const w=Math.max(1,root.clientWidth),h=Math.max(1,root.clientHeight);
  camera.aspect=w/h;
  camera.updateProjectionMatrix();
  if(renderer) renderer.setSize(w,h,false);
});

(function animate(){
  requestAnimationFrame(animate);
  if(renderer) renderer.render(scene,camera);
})();