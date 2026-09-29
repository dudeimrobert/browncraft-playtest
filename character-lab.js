import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  createFrogKnightRig, FROG_KNIGHT_DEFAULTS, loadFrogKnightCustomization, saveFrogKnightCustomization, clearFrogKnightCustomization,
  applyFrogKnightCustomization, getFrogKnightCustomization, setFrogRigWireframe, setFrogRigOrganicOnly, setFrogRigSkinWeightDebug,
  resetFrogRigPose, poseFrogRigIdle, poseFrogRigWalk, poseFrogRigBlock, poseFrogRigAttack, poseFrogRigCast,
  poseFrogRigFlask, poseFrogRigDodge, poseFrogRigHit, poseFrogRigDeath, updateFrogRigSecondary
} from './assets/frog-rig.js';

const q=s=>document.querySelector(s);
const mount=q('#labViewport'), body=q('#inspectorBody'), toast=q('#toast');
const saved=loadFrogKnightCustomization();
let params={...saved};
let currentTab='anatomy';
let playing=true, loop=true, speed=1, progress=0, animClock=0, last=performance.now()/1000;
let animation='idle';
let activePreset='Game Current';
const LOCAL_PRESETS_KEY='browncraft-character-lab-presets-v1';

const PARAMS={
  anatomy:[
    ['Overall Scale','overallScale',.75,1.35,.01],['Torso Width','torsoWidth',.70,1.40,.01],['Torso Depth','torsoDepth',.72,1.38,.01],['Shoulder Width','shoulderWidth',.72,1.50,.01],
    ['Arm Length','armLength',.72,1.35,.01],['Arm Thickness','armThickness',.68,1.42,.01],['Leg Length','legLength',.72,1.38,.01],['Leg Thickness','legThickness',.70,1.45,.01],['Stance Width','stanceWidth',.70,1.55,.01],
    ['Head Width','headWidth',.72,1.42,.01],['Head Height','headHeight',.72,1.30,.01],['Head Depth','headDepth',.72,1.42,.01],['Muzzle Scale','muzzleScale',.65,1.48,.01],
    ['Eye Size','eyeSize',.60,1.55,.01],['Eye Spacing','eyeSpacing',.70,1.42,.01],['Cheek Fullness','cheekSize',.65,1.55,.01],['Throat Size','throatSize',.60,1.65,.01],['Belly Fullness','bellySize',.72,1.45,.01],['Foot Size','footSize',.70,1.70,.01],['Toe Splay','toeSplay',.35,1.85,.01]
  ],
  armor:[
    ['Armor Bulk','armorBulk',.70,1.45,.01],['Pauldron Scale','pauldronScale',.60,1.55,.01],['Greave Bulk','greaveBulk',.68,1.48,.01],['Tasset Length','tassetLength',.60,1.55,.01],
    ['Cloak Width','cloakWidth',.65,1.50,.01],['Cloak Length','cloakLength',.60,1.60,.01],['Sword Length','swordLength',.65,1.50,.01],['Sword Bulk','swordBulk',.65,1.40,.01],['Shield Scale','shieldScale',.65,1.50,.01]
  ],
  materials:[
    ['Steel Roughness','steelRoughness',.18,.92,.01],['Steel Metalness','steelMetalness',.18,.95,.01],['Frog Roughness','frogRoughness',.18,.95,.01],['Frog Wetness','frogWetness',0,.55,.01]
  ]
};
const COLORS=[['Steel','steelColor'],['Dark Steel','steelDarkColor'],['Frog Skin','frogColor'],['Belly / Throat','bellyColor'],['Leather','leatherColor'],['Cloak','cloakColor']];

const BUILT_INS={
  'Default':{...FROG_KNIGHT_DEFAULTS},
  'Fun Frog':{...FROG_KNIGHT_DEFAULTS,overallScale:.98,headWidth:1.14,headHeight:.95,headDepth:1.08,muzzleScale:.98,eyeSize:1.16,eyeSpacing:1.07,cheekSize:1.14,throatSize:1.18,bellySize:1.09,torsoWidth:1.08,torsoDepth:1.04,shoulderWidth:1.04,armLength:.97,legLength:.93,legThickness:1.10,stanceWidth:1.13,footSize:1.30,toeSplay:1.28,armorBulk:.97,pauldronScale:.90,greaveBulk:.96,tassetLength:.94,cloakWidth:1.03,cloakLength:1.02,swordLength:.96,shieldScale:.94,frogRoughness:.48,frogWetness:.28},
  'Portfolio Match':{...FROG_KNIGHT_DEFAULTS,headWidth:1.08,headHeight:.92,headDepth:1.08,muzzleScale:1.06,eyeSize:.92,eyeSpacing:1.03,cheekSize:.92,throatSize:1.04,bellySize:1.00,shoulderWidth:1.13,torsoWidth:1.07,armThickness:1.06,legThickness:1.08,footSize:1.15,toeSplay:.92,armorBulk:1.08,pauldronScale:1.13,cloakLength:1.09,swordLength:1.04,shieldScale:.96,frogRoughness:.61,frogWetness:.14},
  'Bog Bulwark':{...FROG_KNIGHT_DEFAULTS,overallScale:1.06,headWidth:1.08,shoulderWidth:1.26,torsoWidth:1.20,torsoDepth:1.15,armThickness:1.18,legThickness:1.22,stanceWidth:1.16,footSize:1.22,armorBulk:1.22,pauldronScale:1.30,greaveBulk:1.18,shieldScale:1.28,swordBulk:1.10,cloakWidth:1.12,cloakLength:.92},
  'Marsh Duelist':{...FROG_KNIGHT_DEFAULTS,overallScale:.97,headWidth:.96,torsoWidth:.88,torsoDepth:.90,shoulderWidth:1.03,armLength:1.10,armThickness:.87,legLength:1.10,legThickness:.88,stanceWidth:.90,footSize:1.05,armorBulk:.88,pauldronScale:.82,greaveBulk:.90,tassetLength:.85,cloakWidth:.86,cloakLength:1.18,swordLength:1.19,swordBulk:.86,shieldScale:.78},
  'Ancient Toad Knight':{...FROG_KNIGHT_DEFAULTS,overallScale:1.10,headWidth:1.28,headHeight:.88,headDepth:1.18,muzzleScale:1.24,eyeSize:.86,eyeSpacing:1.12,cheekSize:1.10,throatSize:1.30,bellySize:1.12,torsoWidth:1.14,torsoDepth:1.18,shoulderWidth:1.16,armLength:.93,armThickness:1.12,legLength:.90,legThickness:1.14,stanceWidth:1.24,footSize:1.34,toeSplay:1.25,armorBulk:1.12,pauldronScale:1.10,cloakWidth:1.12,cloakLength:.92}
};

function loadLocalPresets(){ try{return JSON.parse(localStorage.getItem(LOCAL_PRESETS_KEY)||'{}')||{};}catch(_){return{};} }
function saveLocalPresets(v){ localStorage.setItem(LOCAL_PRESETS_KEY,JSON.stringify(v)); }
let localPresets=loadLocalPresets();

// Three.js studio
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x090b09);
scene.fog=new THREE.Fog(0x090b09,8,16);
const camera=new THREE.PerspectiveCamera(34,1,.05,50); camera.position.set(4.5,2.45,5.7);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.12; mount.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.dampingFactor=.065; controls.target.set(0,1.55,0); controls.minDistance=3.2; controls.maxDistance=9; controls.maxPolarAngle=Math.PI*.53;
scene.add(new THREE.HemisphereLight(0xc8d5bc,0x211a14,1.55));
const key=new THREE.DirectionalLight(0xffe5b0,3.1); key.position.set(4,7,5); key.castShadow=true; key.shadow.mapSize.set(1024,1024); scene.add(key);
const fill=new THREE.DirectionalLight(0x7799a8,1.1); fill.position.set(-5,4,2); scene.add(fill);
const rim=new THREE.DirectionalLight(0xd6a055,1.2); rim.position.set(1,4,-5); scene.add(rim);
const floor=new THREE.Mesh(new THREE.CircleGeometry(4.4,64),new THREE.MeshStandardMaterial({color:0x151813,roughness:1,metalness:0})); floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);
const grid=new THREE.GridHelper(8,16,0x75603b,0x252a22); grid.position.y=.006; grid.material.transparent=true; grid.material.opacity=.18; scene.add(grid);

const model=createFrogKnightRig({preview:true,useSavedCustomization:false,customization:params});
model.position.y=.03; scene.add(model);
model.userData.ring.visible=false;

function resize(){ const r=mount.getBoundingClientRect(); renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false); camera.aspect=r.width/Math.max(1,r.height); camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(mount); resize();

const DURATION={idle:4,walk:1.1,run:.78,combatIdle:3,block:2.4,light:.46,heavy:1.0,cast:.72,flask:.9,dodge:.55,hit:.48,death:1.35};
const CONTINUOUS=new Set(['idle','walk','run','combatIdle','block']);
function applyAnimation(name,t,clock){
  resetFrogRigPose(model);
  switch(name){
    case 'idle': poseFrogRigIdle(model,clock,1,false); break;
    case 'walk': poseFrogRigIdle(model,clock,.45,false); poseFrogRigWalk(model,clock,1,false); break;
    case 'run': poseFrogRigIdle(model,clock,.35,false); poseFrogRigWalk(model,clock*1.35,1.34,false); break;
    case 'combatIdle': poseFrogRigIdle(model,clock,1,true); break;
    case 'block': poseFrogRigBlock(model,clock,1); break;
    case 'light': poseFrogRigAttack(model,'light',t); break;
    case 'heavy': poseFrogRigAttack(model,'heavy',t); break;
    case 'cast': poseFrogRigCast(model,t); break;
    case 'flask': poseFrogRigFlask(model,t); break;
    case 'dodge': poseFrogRigDodge(model,t); break;
    case 'hit': poseFrogRigHit(model,t,1); break;
    case 'death': poseFrogRigDeath(model,t); break;
  }
}

function animate(nowMs){
  requestAnimationFrame(animate); const now=nowMs/1000,dt=Math.min(.05,Math.max(0,now-last)); last=now;
  const dur=DURATION[animation]||1;
  if(playing){
    animClock+=dt*speed;
    if(CONTINUOUS.has(animation)) progress=(animClock%dur)/dur;
    else { progress+=dt*speed/dur; if(progress>=1){ if(loop){progress%=1;animClock=0;} else {progress=1;playing=false;syncPlayButton();} } }
  }
  const poseClock=playing?animClock:progress*dur;
  applyAnimation(animation,progress,poseClock);
  const move=animation==='walk'?1:animation==='run'?1.45:0;
  const action=['light','heavy','cast','dodge','hit'].includes(animation)?1:0;
  updateFrogRigSecondary(model,playing?dt:0,{move,action,time:poseClock});
  if(q('#turntableToggle').checked) model.rotation.y+=dt*.35;
  controls.update(); renderer.render(scene,camera);
  q('#timeline').value=progress; q('#timeLabel').textContent=`${(progress*dur).toFixed(2)}s`; q('#durationLabel').textContent=CONTINUOUS.has(animation)?'loop':`${dur.toFixed(2)}s`;
  const info=countModel(); q('#viewportStats').textContent=`Bones ${info.bones} · Meshes ${info.meshes} · Triangles ${info.tris.toLocaleString()} · Draws ${renderer.info.render.calls}`;
}
requestAnimationFrame(animate);

let countCache=null;
function countModel(){ if(countCache)return countCache; let bones=0,meshes=0,tris=0; model.traverse(o=>{if(o.isBone)bones++;if(o.isMesh){meshes++;const g=o.geometry;if(g?.index)tris+=g.index.count/3;else if(g?.attributes?.position)tris+=g.attributes.position.count/3;}}); return countCache={bones,meshes,tris:Math.round(tris)}; }
function toastMsg(msg){ toast.textContent=msg; toast.hidden=false; clearTimeout(toast._t); toast._t=setTimeout(()=>toast.hidden=true,1800); }
function applyParams(){ applyFrogKnightCustomization(model,params); activePreset='Custom'; renderInspector(); }
function valueText(key,v){ if(key.includes('Roughness')||key.includes('Metalness'))return Number(v).toFixed(2); return `${Number(v).toFixed(2)}×`; }

function renderControls(list){ return list.map(([label,key,min,max,step])=>`<div class="control-row"><label for="p-${key}">${label}</label><input id="p-${key}" data-param="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${params[key]}"><output>${valueText(key,params[key])}</output></div>`).join(''); }
function renderInspector(){
  if(currentTab==='anatomy') body.innerHTML=`<div class="section-title"><strong>Anatomy & Proportions</strong><span>Rig-safe</span></div><p class="subnote">These controls preserve shoulder, elbow, wrist, hip, knee and ankle pivots while changing segment proportions.</p>${renderControls(PARAMS.anatomy)}`;
  if(currentTab==='armor') body.innerHTML=`<div class="section-title"><strong>Armor & Equipment</strong><span>Layered geometry</span></div><p class="subnote">Push the silhouette without replacing the procedural hero. Armor is still attached to the live animation rig.</p>${renderControls(PARAMS.armor)}`;
  if(currentTab==='materials') body.innerHTML=`<div class="section-title"><strong>Surface Materials</strong><span>Runtime PBR</span></div>${renderControls(PARAMS.materials)}<div class="section-title" style="margin-top:15px"><strong>Palette</strong><span>Live</span></div>${COLORS.map(([label,key])=>`<div class="control-row color-row"><label>${label}</label><input data-color="${key}" type="color" value="${params[key]}"><output>${params[key]}</output></div>`).join('')}`;
  if(currentTab==='presets'){
    const all={...BUILT_INS,'Game Current':loadFrogKnightCustomization(),...localPresets};
    body.innerHTML=`<div class="section-title"><strong>Model Presets</strong><span>${Object.keys(all).length} available</span></div><p class="subnote">Presets only change the lab until you choose <b>Apply to Game</b>.</p><div class="preset-grid">${Object.entries(all).map(([name,data])=>`<div class="preset-card ${name===activePreset?'active':''}"><header><strong>${name}</strong><button data-preset="${name.replace(/"/g,'&quot;')}">Load</button></header><p>${presetDescription(name)}</p>${!(name in BUILT_INS)&&name!=='Game Current'?`<button class="danger" data-delete-preset="${name.replace(/"/g,'&quot;')}">Delete</button>`:''}</div>`).join('')}</div><input id="presetName" class="preset-name" placeholder="Name this variation"><div class="mini-actions"><button id="savePresetBtn">Save Preset</button><button id="copyJsonBtn">Copy JSON</button><button id="pasteJsonBtn" class="wide">Paste / Import JSON</button><button id="clearGameBtn" class="wide danger">Clear Applied Game Customization</button></div>`;
  }
  bindInspector();
}
function presetDescription(name){ return ({'Default':'Alpha 1.8 cohesive procedural construction with neutral proportions.','Fun Frog':'Frog-first hero: larger expressive eyes, broader feet, squat springy stance and lighter silhouette.','Portfolio Match':'Closer to the darker, grounded proportions and armor weight of the supplied character portfolio.','Bog Bulwark':'Heavy armor, wider stance and shield-first tank proportions.','Marsh Duelist':'Longer, leaner limbs and lighter equipment silhouette.','Ancient Toad Knight':'Older, squat, broad frog anatomy with heavier feet.','Game Current':'The customization currently applied to normal Browncraft gameplay.'}[name]||'Saved local Character Lab variation.'); }
function bindInspector(){
  body.querySelectorAll('[data-param]').forEach(el=>el.addEventListener('input',()=>{ params[el.dataset.param]=Number(el.value); el.nextElementSibling.textContent=valueText(el.dataset.param,params[el.dataset.param]); applyFrogKnightCustomization(model,params); activePreset='Custom'; }));
  body.querySelectorAll('[data-color]').forEach(el=>el.addEventListener('input',()=>{params[el.dataset.color]=el.value;el.nextElementSibling.textContent=el.value;applyFrogKnightCustomization(model,params);activePreset='Custom';}));
  body.querySelectorAll('[data-preset]').forEach(btn=>btn.addEventListener('click',()=>{const name=btn.dataset.preset;const all={...BUILT_INS,'Game Current':loadFrogKnightCustomization(),...localPresets};params={...FROG_KNIGHT_DEFAULTS,...all[name]};activePreset=name;applyFrogKnightCustomization(model,params);renderInspector();toastMsg(`${name} loaded`);}));
  body.querySelectorAll('[data-delete-preset]').forEach(btn=>btn.addEventListener('click',()=>{delete localPresets[btn.dataset.deletePreset];saveLocalPresets(localPresets);renderInspector();}));
  q('#savePresetBtn')?.addEventListener('click',()=>{const name=q('#presetName').value.trim();if(!name)return toastMsg('Name the preset first');localPresets[name]={...params};saveLocalPresets(localPresets);activePreset=name;renderInspector();toastMsg('Preset saved locally');});
  q('#copyJsonBtn')?.addEventListener('click',async()=>{await navigator.clipboard.writeText(JSON.stringify(params,null,2));toastMsg('Customization JSON copied');});
  q('#pasteJsonBtn')?.addEventListener('click',()=>{const raw=prompt('Paste Frog Knight customization JSON');if(!raw)return;try{params={...FROG_KNIGHT_DEFAULTS,...JSON.parse(raw)};applyFrogKnightCustomization(model,params);activePreset='Imported';renderInspector();toastMsg('JSON imported');}catch(_){toastMsg('Invalid JSON');}});
  q('#clearGameBtn')?.addEventListener('click',()=>{clearFrogKnightCustomization();toastMsg('Game customization cleared');renderInspector();});
}
renderInspector();

q('.inspector-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;currentTab=b.dataset.tab;q('.inspector-tabs').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));renderInspector();});
q('#resetBtn').addEventListener('click',()=>{params={...FROG_KNIGHT_DEFAULTS};activePreset='Default';applyFrogKnightCustomization(model,params);renderInspector();toastMsg('Lab reset to default');});
q('#applyGameBtn').addEventListener('click',()=>{saveFrogKnightCustomization(params);activePreset='Game Current';toastMsg('Applied to Browncraft hero');if(currentTab==='presets')renderInspector();});

q('#animationSelect').addEventListener('change',e=>{animation=e.target.value;progress=0;animClock=0;playing=true;syncPlayButton();});
q('#playPauseBtn').addEventListener('click',()=>{playing=!playing;syncPlayButton();});
q('#loopToggle').addEventListener('change',e=>loop=e.target.checked);
q('#speedRange').addEventListener('input',e=>{speed=Number(e.target.value);q('#speedOut').textContent=`${speed.toFixed(2)}×`;});
q('#timeline').addEventListener('input',e=>{progress=Number(e.target.value);playing=false;syncPlayButton();});
function syncPlayButton(){q('#playPauseBtn').textContent=playing?'Pause':'Play';}
q('#skeletonToggle').addEventListener('change',e=>model.userData.skeletonHelper.visible=e.target.checked);
q('#wireframeToggle').addEventListener('change',e=>setFrogRigWireframe(model,e.target.checked));
q('#organicToggle').addEventListener('change',e=>{ if(q('#weightsToggle').checked){ q('#weightsToggle').checked=false; setFrogRigSkinWeightDebug(model,false); } setFrogRigOrganicOnly(model,e.target.checked); });
q('#weightsToggle').addEventListener('change',e=>{ if(e.target.checked && q('#organicToggle').checked){ q('#organicToggle').checked=false; setFrogRigOrganicOnly(model,false); } setFrogRigSkinWeightDebug(model,e.target.checked); });

const views={front:[0,2.15,6],three:[4.4,2.35,5.1],side:[6,2.15,0],back:[0,2.15,-6]};
document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>{const p=views[btn.dataset.view];camera.position.set(...p);controls.target.set(0,1.55,0);controls.update();model.rotation.y=0;}));
q('#snapshotBtn').addEventListener('click',()=>{renderer.render(scene,camera);const a=document.createElement('a');a.download=`frog-knight-${Date.now()}.png`;a.href=renderer.domElement.toDataURL('image/png');a.click();toastMsg('Snapshot saved');});
