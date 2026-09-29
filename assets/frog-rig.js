import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;
const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = v => { v = clamp01(v); return v * v * (3 - 2 * v); };
const smoother = v => { v = clamp01(v); return v*v*v*(v*(v*6-15)+10); };
const lerp = (a,b,t) => a + (b-a)*t;

function seeded(seed=1){
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function surfaceTexture(kind, size=256){
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const rnd = seeded(kind.split('').reduce((a,ch)=>a+ch.charCodeAt(0)*17, 71));
  x.fillStyle = '#c8c8c8';
  x.fillRect(0,0,size,size);

  if(kind === 'mail'){
    x.fillStyle = '#525252'; x.fillRect(0,0,size,size);
    x.strokeStyle = '#c9c9c9'; x.lineWidth = 1.2;
    const r = 5.2;
    for(let yy=-r; yy<size+r; yy+=8.6){
      const row = Math.round(yy/8.6);
      for(let xx=-r; xx<size+r; xx+=10.4){
        x.beginPath(); x.arc(xx + (row&1?5.2:0), yy, r, .15*Math.PI, 1.85*Math.PI); x.stroke();
      }
    }
  } else if(kind === 'frog' || kind === 'belly'){
    x.fillStyle = kind === 'frog' ? '#78845d' : '#96917a'; x.fillRect(0,0,size,size);
    for(let i=0;i<550;i++){
      const rr = 1 + rnd()*4.5;
      const hue = kind === 'frog' ? (rnd()>.5?'#566344':'#9b9b6b') : (rnd()>.5?'#74715f':'#aaa58a');
      x.globalAlpha = .08 + rnd()*.18; x.fillStyle = hue;
      x.beginPath(); x.ellipse(rnd()*size,rnd()*size,rr,rr*(.5+rnd()),rnd()*TAU,0,TAU); x.fill();
    }
    x.globalAlpha = 1;
  } else if(kind === 'cloth'){
    x.fillStyle = '#7a7a7a'; x.fillRect(0,0,size,size);
    x.globalAlpha=.22; x.strokeStyle='#d3d3d3'; x.lineWidth=.5;
    for(let i=0;i<size;i+=3){ x.beginPath(); x.moveTo(i,0); x.lineTo(i,size); x.stroke(); }
    x.strokeStyle='#383838';
    for(let i=0;i<size;i+=4){ x.beginPath(); x.moveTo(0,i); x.lineTo(size,i); x.stroke(); }
    x.globalAlpha=1;
  } else if(kind === 'leather'){
    x.fillStyle='#8a8178'; x.fillRect(0,0,size,size);
    for(let i=0;i<420;i++){
      x.globalAlpha=.08+rnd()*.2; x.fillStyle=rnd()>.5?'#4e4944':'#d1c5b7';
      x.fillRect(rnd()*size,rnd()*size,.5+rnd()*2.4,.5+rnd()*1.4);
    }
    x.globalAlpha=1;
  } else {
    // Steel: mottling, pits, scratches and rust specks. Kept subtle so it reads at gameplay scale.
    x.fillStyle = kind === 'steelDark' ? '#8c8c8c' : '#b0b0b0'; x.fillRect(0,0,size,size);
    for(let i=0;i<500;i++){
      const v = Math.floor(70+rnd()*150); x.globalAlpha=.04+rnd()*.11;
      x.fillStyle=`rgb(${v},${v},${v})`; x.fillRect(rnd()*size,rnd()*size,1+rnd()*3,1+rnd()*3);
    }
    x.globalAlpha=.26; x.strokeStyle='#343434'; x.lineWidth=.6;
    for(let i=0;i<36;i++){
      const sx=rnd()*size, sy=rnd()*size, len=5+rnd()*22;
      x.beginPath(); x.moveTo(sx,sy); x.lineTo(sx+Math.cos(rnd()*TAU)*len,sy+Math.sin(rnd()*TAU)*len); x.stroke();
    }
    x.globalAlpha=.34; x.fillStyle='#6d3e21';
    for(let i=0;i<65;i++){ const r=.4+rnd()*1.8; x.beginPath(); x.arc(rnd()*size,rnd()*size,r,0,TAU); x.fill(); }
    x.globalAlpha=1;
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(kind==='mail'?3:2, kind==='mail'?3:2);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeMaterials(){
  const steelTex=surfaceTexture('steel'), steelDarkTex=surfaceTexture('steelDark');
  const mailTex=surfaceTexture('mail'), leatherTex=surfaceTexture('leather'), clothTex=surfaceTexture('cloth');
  const frogTex=surfaceTexture('frog'), bellyTex=surfaceTexture('belly');
  return {
    steel: new THREE.MeshStandardMaterial({color:0x807a70,map:steelTex,bumpMap:steelTex,bumpScale:.028,roughness:.48,metalness:.64}),
    steelDark: new THREE.MeshStandardMaterial({color:0x55534e,map:steelDarkTex,bumpMap:steelDarkTex,bumpScale:.035,roughness:.59,metalness:.54}),
    mail: new THREE.MeshStandardMaterial({color:0x343532,map:mailTex,bumpMap:mailTex,bumpScale:.09,roughness:.76,metalness:.48}),
    leather: new THREE.MeshStandardMaterial({color:0x4b392a,map:leatherTex,bumpMap:leatherTex,bumpScale:.035,roughness:.9,metalness:.03}),
    cloth: new THREE.MeshStandardMaterial({color:0x1b1b1a,map:clothTex,bumpMap:clothTex,bumpScale:.025,roughness:1,metalness:0,side:THREE.DoubleSide}),
    frog: new THREE.MeshPhysicalMaterial({color:0xffffff,map:frogTex,bumpMap:frogTex,bumpScale:.045,roughness:.55,metalness:0,clearcoat:.20,clearcoatRoughness:.36}),
    belly: new THREE.MeshPhysicalMaterial({color:0xffffff,map:bellyTex,bumpMap:bellyTex,bumpScale:.032,roughness:.67,metalness:0,clearcoat:.10,clearcoatRoughness:.48}),
    eye: new THREE.MeshPhysicalMaterial({color:0xb88327,roughness:.10,metalness:.10,clearcoat:1,clearcoatRoughness:.035,emissive:0x2a1702,emissiveIntensity:.18}),
    irisRing: new THREE.MeshPhysicalMaterial({color:0x5b3510,roughness:.20,metalness:.22,clearcoat:.72,clearcoatRoughness:.10}),
    pupil: new THREE.MeshPhysicalMaterial({color:0x040504,roughness:.06,clearcoat:1,clearcoatRoughness:.015}),
    blade: new THREE.MeshStandardMaterial({color:0xb9b8b2,map:steelTex,bumpMap:steelTex,bumpScale:.015,roughness:.25,metalness:.82}),
    rust: new THREE.MeshStandardMaterial({color:0x5d341f,roughness:.82,metalness:.25}),
    mouth: new THREE.MeshStandardMaterial({color:0x15130f,roughness:1}),
  };
}


export const FROG_CUSTOMIZATION_KEY = 'browncraft-frog-customization-v2';
const FROG_CUSTOMIZATION_LEGACY_KEY = 'browncraft-frog-customization-v1';
export const FROG_KNIGHT_DEFAULTS = Object.freeze({
  overallScale: 1,
  torsoWidth: 1.04, torsoDepth: 1.02, shoulderWidth: 1.02,
  armLength: .98, armThickness: 1, legLength: .96, legThickness: 1.05, stanceWidth: 1.08,
  headWidth: 1.08, headHeight: .97, headDepth: 1.04, muzzleScale: .98,
  eyeSize: 1.10, eyeSpacing: 1.04, cheekSize: 1.08, throatSize: 1.10, bellySize: 1.05, footSize: 1.18, toeSplay: 1.15,
  armorBulk: .98, pauldronScale: .93, greaveBulk: .98, tassetLength: .96,
  cloakWidth: 1, cloakLength: 1,
  swordLength: .98, swordBulk: 1, shieldScale: .96,
  steelRoughness: .48, steelMetalness: .64, frogRoughness: .52, frogWetness: .24,
  steelColor: '#807a70', steelDarkColor: '#55534e', frogColor: '#ffffff',
  bellyColor: '#ffffff', leatherColor: '#4b392a', cloakColor: '#1b1b1a'
});

export function loadFrogKnightCustomization(){
  try {
    const raw = localStorage.getItem(FROG_CUSTOMIZATION_KEY);
    if(raw) return { ...FROG_KNIGHT_DEFAULTS, ...JSON.parse(raw) };
    const legacy = localStorage.getItem(FROG_CUSTOMIZATION_LEGACY_KEY);
    return legacy ? { ...FROG_KNIGHT_DEFAULTS, ...JSON.parse(legacy) } : { ...FROG_KNIGHT_DEFAULTS };
  } catch (_) { return { ...FROG_KNIGHT_DEFAULTS }; }
}

export function saveFrogKnightCustomization(params){
  try { localStorage.setItem(FROG_CUSTOMIZATION_KEY, JSON.stringify({ ...FROG_KNIGHT_DEFAULTS, ...params })); return true; }
  catch (_) { return false; }
}

export function clearFrogKnightCustomization(){
  try { localStorage.removeItem(FROG_CUSTOMIZATION_KEY); localStorage.removeItem(FROG_CUSTOMIZATION_LEGACY_KEY); } catch (_) {}
}

function attach(parent, mesh, pos=[0,0,0], rot=[0,0,0], scale=[1,1,1], shadow=true){
  mesh.position.set(...pos); mesh.rotation.set(...rot); mesh.scale.set(...scale);
  if(shadow){ mesh.castShadow=true; mesh.receiveShadow=true; }
  parent.add(mesh); return mesh;
}
function bone(name,parent,pos=[0,0,0]){ const b=new THREE.Bone(); b.name=name; b.position.set(...pos); parent.add(b); return b; }
function cyl(length,rt,rb,material,segments=20){ const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,length,segments),material); m.position.y=-length/2; return m; }
function cap(length,r,material,scale=[1,1,1]){ const m=new THREE.Mesh(new THREE.CapsuleGeometry(r,length,8,16),material); m.position.y=-length/2; m.scale.set(...scale); return m; }
function band(parent,y,r,t,material){ return attach(parent,new THREE.Mesh(new THREE.TorusGeometry(r,t,8,28),material),[0,y,0],[Math.PI/2,0,0]); }
function rivet(parent,pos,material,r=.027){ return attach(parent,new THREE.Mesh(new THREE.SphereGeometry(r,7,5),material),pos); }

function armorLimb(parent,length,top,bottom,materials,{bands=2,dark=false}={}){
  const main=cyl(length,top,bottom,dark?materials.steelDark:materials.steel,20); parent.add(main);
  for(let i=1;i<=bands;i++) band(parent,-length*(i/(bands+1)),lerp(top,bottom,i/(bands+1))*1.01,.018,materials.steelDark);
  return main;
}

function makeTatteredPanel(width,height,material,notches=5){
  const sh=new THREE.Shape(); sh.moveTo(-width/2,height/2); sh.lineTo(width/2,height/2); sh.lineTo(width/2,-height/2+.04);
  const seg=width/notches;
  for(let i=0;i<=notches;i++){
    const x=width/2-i*seg;
    const y=-height/2 + (i%2===0?.02:.09) + (i===Math.floor(notches/2)?.08:0);
    sh.lineTo(x,y);
  }
  sh.lineTo(-width/2,height/2);
  const geo=new THREE.ShapeGeometry(sh,6);
  const mesh=new THREE.Mesh(geo,material); mesh.castShadow=true; return mesh;
}

function buildSword(m){
  const sword=new THREE.Group(); sword.name='weapon_socket_r';
  const grip=attach(sword,new THREE.Mesh(new THREE.CylinderGeometry(.052,.056,.3,10),m.leather),[0,0,.13],[Math.PI/2,0,0]);
  band(grip,0,.058,.014,m.steelDark);
  attach(sword,new THREE.Mesh(new THREE.SphereGeometry(.075,10,8),m.steelDark),[0,0,-.045]);
  attach(sword,new THREE.Mesh(new THREE.BoxGeometry(.48,.055,.075),m.steelDark),[0,0,.31],[0,0,.02]);
  attach(sword,new THREE.Mesh(new THREE.BoxGeometry(.08,.105,.12),m.steelDark),[-.21,0,.31],[0,0,.25]);
  attach(sword,new THREE.Mesh(new THREE.BoxGeometry(.08,.105,.12),m.steelDark),[.21,0,.31],[0,0,-.25]);
  const blade=attach(sword,new THREE.Mesh(new THREE.BoxGeometry(.095,.036,1.54),m.blade),[0,0,1.105]);
  attach(sword,new THREE.Mesh(new THREE.BoxGeometry(.018,.041,1.30),m.steelDark),[0,.021,1.05],[],[1,1,1],false);
  const tip=attach(sword,new THREE.Mesh(new THREE.ConeGeometry(.067,.29,4),m.blade),[0,0,2.02],[Math.PI/2,Math.PI/4,0]);
  const trail=new THREE.Mesh(new THREE.PlaneGeometry(.74,1.84),new THREE.MeshBasicMaterial({color:0xead29b,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
  trail.position.set(0,.02,1.12); trail.rotation.x=Math.PI/2; sword.add(trail); sword.userData.trail=trail;
  return sword;
}

function buildShield(m){
  const holder=new THREE.Group(); holder.name='shield_socket_l';
  const disc=attach(holder,new THREE.Mesh(new THREE.CylinderGeometry(.53,.53,.095,18),m.leather),[0,0,0],[0,0,Math.PI/2]);
  const face=attach(holder,new THREE.Mesh(new THREE.CylinderGeometry(.48,.48,.102,18),m.steelDark),[.005,0,0],[0,0,Math.PI/2]);
  const rim=attach(holder,new THREE.Mesh(new THREE.TorusGeometry(.50,.032,7,28),m.steel),[.062,0,0],[0,Math.PI/2,0]);
  attach(holder,new THREE.Mesh(new THREE.SphereGeometry(.115,12,9),m.steel),[.075,0,0],[0,0,0],[.55,1,1]);
  for(let i=0;i<8;i++){ const a=i/8*TAU; rivet(holder,[.075,Math.cos(a)*.39,Math.sin(a)*.39],m.rust,.025); }
  holder.rotation.set(0,-.1,.06); return holder;
}

function mouthCurve(material){
  const pts=[];
  for(let i=0;i<=16;i++){
    const u=i/16, x=lerp(-.34,.34,u), y=-.052+Math.pow((u-.5)*2,2)*.030;
    pts.push(new THREE.Vector3(x,y,.413));
  }
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),24,.008,5,false),material);
}

function addWeb(parent,material,left=true){
  const sign=left?1:1;
  const sh=new THREE.Shape(); sh.moveTo(-.12,0); sh.lineTo(0,.13); sh.lineTo(.12,0); sh.lineTo(0,-.02); sh.closePath();
  const mesh=new THREE.Mesh(new THREE.ShapeGeometry(sh),material); mesh.rotation.x=-Math.PI/2; mesh.position.set(0,-.055,.24); mesh.scale.set(1,.85,1); mesh.castShadow=true; parent.add(mesh);
}


function roundedBox(w,h,d,r,material,segments=5){
  return new THREE.Mesh(new RoundedBoxGeometry(w,h,d,segments,r),material);
}

function makeFrogHeadGeometry(){
  const g=new THREE.SphereGeometry(.50,40,28);
  const p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    let x=p.getX(i), y=p.getY(i), z=p.getZ(i);
    const nx=x/.50, ny=y/.50, nz=z/.50;
    // Broad, low skull with a gentle forward muzzle built into the same surface.
    x*=1.27; y*=.80; z*=1.04;
    const front=Math.max(0,nz);
    const muzzleBand=Math.exp(-Math.pow((ny+.18)/.52,2))*Math.pow(front,1.7);
    z += .115*muzzleBand;
    x *= 1 + .10*muzzleBand;
    // Slight temple/cheek breadth keeps the silhouette frog-first from 3/4 views.
    const cheek=Math.exp(-Math.pow((ny+.04)/.50,2))*Math.pow(front,.85);
    x *= 1 + .035*cheek;
    // Flatten the crown a touch instead of a perfectly spherical cranium.
    if(y>.22) y -= (y-.22)*.18;
    p.setXYZ(i,x,y,z);
  }
  g.computeVertexNormals();
  return g;
}

function makeFrogBellyGeometry(){
  const g=new THREE.SphereGeometry(.50,32,24);
  const p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    let x=p.getX(i), y=p.getY(i), z=p.getZ(i);
    const ny=y/.50, nz=z/.50;
    x*=.90; y*=1.18; z*=.78;
    // Softer belly projection toward the front; narrower through the waist.
    z += Math.max(0,nz)*.07*(1-Math.abs(ny)*.45);
    x *= 1 - Math.max(0,-ny)*.08;
    p.setXYZ(i,x,y,z);
  }
  g.computeVertexNormals();
  return g;
}

function makeFootPadGeometry(material){
  const sh=new THREE.Shape();
  sh.moveTo(-.24,-.10); sh.bezierCurveTo(-.34,.03,-.36,.24,-.25,.39);
  sh.bezierCurveTo(-.12,.48,.12,.48,.25,.39); sh.bezierCurveTo(.36,.24,.34,.03,.24,-.10);
  sh.bezierCurveTo(.10,-.17,-.10,-.17,-.24,-.10); sh.closePath();
  const geo=new THREE.ExtrudeGeometry(sh,{depth:.095,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.028,bevelThickness:.025,curveSegments:12});
  geo.center(); geo.rotateX(-Math.PI/2);
  const mesh=new THREE.Mesh(geo,material); mesh.castShadow=true; mesh.receiveShadow=true; return mesh;
}


function makeSkinnedChain(root,skeleton,chain,radii,material,{ringsPerLink=4,radialSegments=18,name='organic_skin'}={}){
  root.updateMatrixWorld(true);
  const centers=chain.map(b=>root.worldToLocal(b.getWorldPosition(new THREE.Vector3()).clone()));
  const vertices=[], skinIndices=[], skinWeights=[], indices=[], shapeMeta=[];
  const ringCount=(chain.length-1)*ringsPerLink+1;
  const ringData=[];
  for(let r=0;r<ringCount;r++){
    const globalT=r/(ringCount-1);
    const f=globalT*(chain.length-1);
    const seg=Math.min(chain.length-2,Math.floor(f));
    const t=seg===chain.length-1?0:f-seg;
    const center=centers[seg].clone().lerp(centers[seg+1],t);
    const rx=lerp(radii[seg][0],radii[seg+1][0],t);
    const rz=lerp(radii[seg][1],radii[seg+1][1],t);
    const ia=skeleton.bones.indexOf(chain[seg]), ib=skeleton.bones.indexOf(chain[seg+1]);
    ringData.push({center,rx,rz,ia,ib,t});
    for(let j=0;j<radialSegments;j++){
      const a=j/radialSegments*TAU;
      const dx=Math.cos(a)*rx, dz=Math.sin(a)*rz;
      vertices.push(center.x+dx,center.y,center.z+dz);
      skinIndices.push(ia,ib,0,0); skinWeights.push(1-t,t,0,0);
      shapeMeta.push(center.x,center.z,dx,dz);
    }
  }
  for(let r=0;r<ringCount-1;r++) for(let j=0;j<radialSegments;j++){
    const n=(j+1)%radialSegments, a=r*radialSegments+j,b=r*radialSegments+n,c=(r+1)*radialSegments+j,d=(r+1)*radialSegments+n;
    indices.push(a,c,b,b,c,d);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndices,4));
  geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeights,4));
  geo.setIndex(indices); geo.computeVertexNormals(); geo.computeBoundingSphere();
  const mesh=new THREE.SkinnedMesh(geo,material); mesh.name=name; mesh.castShadow=true; mesh.receiveShadow=true; mesh.frustumCulled=false;
  mesh.userData.shapeMeta=new Float32Array(shapeMeta); mesh.userData.radialSegments=radialSegments; mesh.userData.ringCount=ringCount;
  root.add(mesh); mesh.bind(skeleton); mesh.normalizeSkinWeights();
  return mesh;
}

function reshapeSkinnedChain(mesh,xMul=1,zMul=1){
  const meta=mesh?.userData?.shapeMeta, pos=mesh?.geometry?.attributes?.position; if(!meta||!pos)return;
  for(let i=0;i<pos.count;i++){
    const o=i*4, cx=meta[o],cz=meta[o+1],dx=meta[o+2],dz=meta[o+3];
    pos.setX(i,cx+dx*xMul); pos.setZ(i,cz+dz*zMul);
  }
  pos.needsUpdate=true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere();
}

export function createFrogKnightRig({ringColor=0xc9a15a,preview=false,useSavedCustomization=true,customization=null}={}){
  const root=new THREE.Group(); root.name='frog_knight_procedural_hero';
  const m=makeMaterials();

  // --- Skeleton: humanoid-compatible pivots with frog proportions ---
  const rigRoot=bone('root',root,[0,.64,0]);
  const pelvis=bone('pelvis',rigRoot,[0,.56,0]);
  const spine1=bone('spine_01',pelvis,[0,.38,0]);
  const spine2=bone('spine_02',spine1,[0,.42,0]);
  const chest=bone('chest',spine2,[0,.32,0]);
  const neck=bone('neck',chest,[0,.34,0]);
  const head=bone('head',neck,[0,.27,0]);
  const jaw=bone('jaw',head,[0,-.17,.13]);

  const clavicleL=bone('clavicle_L',chest,[-.39,.14,0]);
  const upperArmL=bone('upperArm_L',clavicleL,[-.19,0,0]);
  const forearmL=bone('forearm_L',upperArmL,[0,-.47,0]);
  const handL=bone('hand_L',forearmL,[0,-.39,0]);
  const clavicleR=bone('clavicle_R',chest,[.39,.14,0]);
  const upperArmR=bone('upperArm_R',clavicleR,[.19,0,0]);
  const forearmR=bone('forearm_R',upperArmR,[0,-.47,0]);
  const handR=bone('hand_R',forearmR,[0,-.39,0]);

  const thighL=bone('thigh_L',pelvis,[-.255,-.10,0]);
  const shinL=bone('shin_L',thighL,[0,-.51,0]);
  const footL=bone('foot_L',shinL,[0,-.445,.035]);
  const toeL=bone('toe_L',footL,[0,-.025,.30]);
  const thighR=bone('thigh_R',pelvis,[.255,-.10,0]);
  const shinR=bone('shin_R',thighR,[0,-.51,0]);
  const footR=bone('foot_R',shinR,[0,-.445,.035]);
  const toeR=bone('toe_R',footR,[0,-.025,.30]);

  const cloak1=bone('cloak_01',chest,[0,.12,-.31]);
  const cloak2=bone('cloak_02',cloak1,[0,-.44,-.015]);
  const cloak3=bone('cloak_03',cloak2,[0,-.47,-.012]);
  const cloak4=bone('cloak_04',cloak3,[0,-.45,-.008]);

  // --- Frog anatomy under the armor: smoother, overlapping organic masses ---
  const bellyCore=attach(spine1,new THREE.Mesh(makeFrogBellyGeometry(),m.belly),[0,.10,.005],[0,0,0],[1.02,.96,.92]);
  const neckCore=attach(neck,new THREE.Mesh(new THREE.SphereGeometry(.34,28,20),m.frog),[0,.015,0],[0,0,0],[1.30,.78,.98]);
  const shoulderFleshL=attach(clavicleL,new THREE.Mesh(new THREE.SphereGeometry(.19,24,16),m.frog),[-.08,-.04,.01],[0,0,0],[1.25,.92,1.08]);
  const shoulderFleshR=attach(clavicleR,new THREE.Mesh(new THREE.SphereGeometry(.19,24,16),m.frog),[.08,-.04,.01],[0,0,0],[1.25,.92,1.08]);

  // --- Torso armor: layered breastplate, gorget, belt and tassets ---
  attach(spine2,new THREE.Mesh(new THREE.SphereGeometry(.56,32,20,0,TAU,0,Math.PI*.74),m.steel),[0,.08,.02],[0,0,0],[1.02,.9,.68]);
  attach(spine2,new THREE.Mesh(new RoundedBoxGeometry(.10,.76,.60,5,.035),m.steelDark),[0,.04,.035]);
  attach(chest,new THREE.Mesh(new RoundedBoxGeometry(.92,.24,.54,6,.055),m.steelDark),[0,-.10,.015],[.04,0,0]);
  const gorget=attach(neck,new THREE.Mesh(new THREE.TorusGeometry(.34,.055,8,22),m.steelDark),[0,-.16,0],[Math.PI/2,0,0],[1.18,1,.88]);
  for(let i=0;i<5;i++) rivet(spine2,[lerp(-.34,.34,i/4),.27,.34],m.rust,.025);
  // diagonal leather baldric + waist belt
  attach(spine2,new THREE.Mesh(new THREE.BoxGeometry(.12,.88,.055),m.leather),[-.12,.04,.36],[0,0,-.56]);
  attach(pelvis,new THREE.Mesh(new THREE.TorusGeometry(.39,.052,8,22),m.leather),[0,.08,.02],[Math.PI/2,0,0],[1.08,1,.92]);
  attach(pelvis,new THREE.Mesh(new RoundedBoxGeometry(.16,.13,.08,4,.025),m.steelDark),[0,.08,.39]);
  attach(pelvis,new THREE.Mesh(new THREE.CylinderGeometry(.43,.48,.61,18,1,true),m.mail),[0,-.22,.02]);
  const tassets=[];
  [-.26,0,.26].forEach((x,i)=>tassets.push(attach(pelvis,new THREE.Mesh(new RoundedBoxGeometry(.22,.40,.11,5,.035),i===1?m.steel:m.steelDark),[x,-.14,.30],[.08*(i-1),0,0])));

  // --- Head: one cohesive frog-first cranium with expressive eyes and a softer heroic face ---
  const skull=attach(head,new THREE.Mesh(makeFrogHeadGeometry(),m.frog),[0,.025,0]);
  // A very shallow lip/muzzle volume softens the face without reading as a second disconnected sphere.
  const muzzle=attach(head,new THREE.Mesh(new THREE.SphereGeometry(.30,30,20),m.frog),[0,-.105,.285],[0,0,0],[1.28,.38,.50]);
  const jawShell=attach(jaw,new THREE.Mesh(new THREE.SphereGeometry(.35,30,20),m.belly),[0,-.020,.095],[0,0,0],[1.30,.52,.90]);
  const throat=attach(jaw,new THREE.Mesh(new THREE.SphereGeometry(.27,28,18),m.belly),[0,-.225,.015],[0,0,0],[1.18,.70,.86]);
  const cheekL=attach(head,new THREE.Mesh(new THREE.SphereGeometry(.15,24,16),m.frog),[-.30,-.075,.20],[0,0,0],[1.25,.62,.78]);
  const cheekR=attach(head,new THREE.Mesh(new THREE.SphereGeometry(.15,24,16),m.frog),[.30,-.075,.20],[0,0,0],[1.25,.62,.78]);
  attach(head,mouthCurve(m.mouth),[0,-.08,.015]);
  [-.105,.105].forEach(x=>attach(head,new THREE.Mesh(new THREE.SphereGeometry(.024,12,8),m.mouth),[x,.045,.465]));
  const eyelids=[], eyeSockets=[], eyes=[], pupils=[], irisRings=[];
  [-.315,.315].forEach((x,idx)=>{
    const socket=attach(head,new THREE.Mesh(new THREE.SphereGeometry(.195,28,20),m.frog),[x,.305,.018],[0,0,0],[1.08,.96,.99]);
    const eye=attach(head,new THREE.Mesh(new THREE.SphereGeometry(.118,28,20),m.eye),[x,.315,.155]);
    const ring=attach(head,new THREE.Mesh(new THREE.TorusGeometry(.057,.011,8,24),m.irisRing),[x,.315,.257],[0,0,0]);
    const pupil=attach(head,new THREE.Mesh(new THREE.SphereGeometry(.054,20,14),m.pupil),[x,.316,.245],[0,0,0],[.72,1.20,.50]);
    const lid=attach(head,new THREE.Mesh(new THREE.SphereGeometry(.125,24,14,0,TAU,0,Math.PI*.48),m.frog),[x,.377,.165],[Math.PI,0,0],[1.04,.63,1.04]);
    // Low brow ridge gives expression without making him permanently angry.
    attach(head,new THREE.Mesh(new THREE.CapsuleGeometry(.038,.16,6,12),m.frog),[x,.425,.075],[0,0,idx===0?-.35:.35],[1.0,.75,1.0]);
    eyeSockets.push(socket); eyes.push(eye); pupils.push(pupil); eyelids.push(lid); irisRings.push(ring);
  });

  // --- Shoulders: layered pauldrons inspired by the reference portfolio ---
  function pauldron(parent,side){
    const sx=side<0?-1:1;
    for(let i=0;i<3;i++){
      attach(parent,new THREE.Mesh(new THREE.SphereGeometry(.265-i*.024,24,16,0,TAU,0,Math.PI*.55),i===1?m.steelDark:m.steel),[sx*(.03+i*.035),-.055-i*.085,0],[0,0,sx*(.06+i*.03)],[1.42,.65,1.13]);
    }
    for(let i=0;i<3;i++) rivet(parent,[sx*(.15+i*.07),.03,.19],m.rust,.022);
  }
  pauldron(clavicleL,-1); pauldron(clavicleR,1);

  // --- Arms: each piece pivots at the real shoulder/elbow/wrist bone ---
  armorLimb(upperArmL,.43,.125,.145,m,{bands:2,dark:true});
  armorLimb(upperArmR,.43,.125,.145,m,{bands:2,dark:true});
  // Organic elbow volume beneath the cop prevents the limb from visually separating at deep bends.
  attach(forearmL,new THREE.Mesh(new THREE.SphereGeometry(.128,22,14),m.frog),[0,.012,.01],[0,0,0],[1.02,.92,1.02]);
  attach(forearmR,new THREE.Mesh(new THREE.SphereGeometry(.128,22,14),m.frog),[0,.012,.01],[0,0,0],[1.02,.92,1.02]);
  // Elbow cops sit on forearm origin so the bend reads as an actual joint.
  attach(forearmL,new THREE.Mesh(new THREE.SphereGeometry(.145,22,14),m.steelDark),[0,-.015,.055],[0,0,0],[1.05,.72,1.16]);
  attach(forearmR,new THREE.Mesh(new THREE.SphereGeometry(.145,22,14),m.steelDark),[0,-.015,.055],[0,0,0],[1.05,.72,1.16]);
  armorLimb(forearmL,.35,.115,.09,m,{bands:3}); armorLimb(forearmR,.35,.115,.09,m,{bands:3});
  attach(handL,roundedBox(.19,.18,.20,.035,m.steelDark),[0,-.04,.015],[.02,0,0]);
  attach(handR,roundedBox(.19,.18,.20,.035,m.steelDark),[0,-.04,.015],[.02,0,0]);
  attach(handL,new THREE.Mesh(new THREE.SphereGeometry(.11,11,8),m.frog),[0,-.105,.055],[0,0,0],[1,.72,1.1]);
  attach(handR,new THREE.Mesh(new THREE.SphereGeometry(.11,11,8),m.frog),[0,-.105,.055],[0,0,0],[1,.72,1.1]);

  // --- Legs: frog stance under plate, with visible knee and ankle articulation ---
  armorLimb(thighL,.49,.16,.145,m,{bands:1,dark:true}); armorLimb(thighR,.49,.16,.145,m,{bands:1,dark:true});
  attach(shinL,new THREE.Mesh(new THREE.SphereGeometry(.145,22,14),m.frog),[0,.015,.02],[0,0,0],[1.04,.90,1.04]);
  attach(shinR,new THREE.Mesh(new THREE.SphereGeometry(.145,22,14),m.frog),[0,.015,.02],[0,0,0],[1.04,.90,1.04]);
  attach(shinL,new THREE.Mesh(new THREE.SphereGeometry(.17,22,14),m.steelDark),[0,-.01,.08],[0,0,0],[1.12,.72,1.18]);
  attach(shinR,new THREE.Mesh(new THREE.SphereGeometry(.17,22,14),m.steelDark),[0,-.01,.08],[0,0,0],[1.12,.72,1.18]);
  armorLimb(shinL,.44,.145,.105,m,{bands:3}); armorLimb(shinR,.44,.145,.105,m,{bands:3});
  const footPadL=attach(footL,makeFootPadGeometry(m.frog),[0,-.075,.16],[0,0,0],[1.02,.88,1.02]);
  const footPadR=attach(footR,makeFootPadGeometry(m.frog),[0,-.075,.16],[0,0,0],[1.02,.88,1.02]);
  addWeb(footL,m.frog,true); addWeb(footR,m.frog,false);
  [-.105,0,.105].forEach((x,i)=>{
    const z=.11+(i===1?.035:0);
    attach(toeL,new THREE.Mesh(new THREE.CapsuleGeometry(.032,.18,7,12),m.frog),[x,-.03,z],[Math.PI/2,(i-1)*.10,0],[1,1,1]);
    attach(toeR,new THREE.Mesh(new THREE.CapsuleGeometry(.032,.18,7,12),m.frog),[x,-.03,z],[Math.PI/2,(i-1)*.10,0],[1,1,1]);
  });

  // --- Articulated cloak: four rigid cloth sections on a spring-driven chain ---
  const cloakMeshes=[];
  [[1.46,.48,cloak1],[1.34,.50,cloak2],[1.19,.49,cloak3],[1.02,.45,cloak4]].forEach(([w,h,b],i)=>{
    const panel=makeTatteredPanel(w,h,m.cloth,6-i);
    attach(b,panel,[0,-h*.45,-.02],[0,0,0]); cloakMeshes.push(panel);
  });

  const sword=buildSword(m); sword.position.set(0,-.08,.035); sword.rotation.set(-.34,0,0); handR.add(sword); upperArmR.userData.trail=sword.userData.trail;
  const shield=buildShield(m); shield.position.set(-.02,-.08,.07); handL.add(shield);

  const ring=new THREE.Mesh(new THREE.RingGeometry(.69,.87,36),new THREE.MeshBasicMaterial({color:ringColor,transparent:true,opacity:preview?.17:.34,side:THREE.DoubleSide,depthWrite:false}));
  ring.rotation.x=-Math.PI/2; ring.position.y=.045; root.add(ring);

  const bones={rigRoot,pelvis,spine1,spine2,chest,neck,head,jaw,clavicleL,upperArmL,forearmL,handL,clavicleR,upperArmR,forearmR,handR,thighL,shinL,footL,toeL,thighR,shinR,footR,toeR,cloak1,cloak2,cloak3,cloak4};
  const skeleton=new THREE.Skeleton(Object.values(bones));
  const helper=new THREE.SkeletonHelper(rigRoot); helper.visible=false; root.add(helper);

  // Neutral stance is slightly crouched and asymmetric: less mannequin, more wary wanderer.
  upperArmR.rotation.set(-.22,.02,.08); forearmR.rotation.set(-.20,0,.02); handR.rotation.set(.02,0,0);
  upperArmL.rotation.set(-.04,0,-.04); forearmL.rotation.set(-.12,0,0);
  thighL.rotation.set(-.055,0,.035); thighR.rotation.set(-.055,0,-.035); shinL.rotation.x=.09; shinR.rotation.x=.09;
  footL.rotation.x=-.045; footR.rotation.x=-.045;
  cloak1.rotation.x=.07; cloak2.rotation.x=.06; cloak3.rotation.x=.05; cloak4.rotation.x=.04;
  chest.rotation.x=-.015; head.rotation.x=.015;

  // --- Smooth skinned organic underbody ---
  // Armor remains rigid, but the frog anatomy beneath it is genuinely weighted to the same bones.
  // This lets elbows, knees, shoulders and the torso bend without opening action-figure gaps.
  root.updateMatrixWorld(true);
  skeleton.calculateInverses();
  const skinTorso=makeSkinnedChain(root,skeleton,[pelvis,spine1,spine2,chest,neck],[[.31,.23],[.38,.27],[.43,.30],[.44,.30],[.28,.22]],m.belly,{ringsPerLink:5,radialSegments:22,name:'frog_skin_torso'});
  const skinArmL=makeSkinnedChain(root,skeleton,[upperArmL,forearmL,handL],[[.125,.115],[.112,.105],[.095,.09]],m.frog,{ringsPerLink:5,radialSegments:18,name:'frog_skin_arm_L'});
  const skinArmR=makeSkinnedChain(root,skeleton,[upperArmR,forearmR,handR],[[.125,.115],[.112,.105],[.095,.09]],m.frog,{ringsPerLink:5,radialSegments:18,name:'frog_skin_arm_R'});
  const skinLegL=makeSkinnedChain(root,skeleton,[thighL,shinL,footL],[[.158,.145],[.142,.132],[.112,.105]],m.frog,{ringsPerLink:5,radialSegments:20,name:'frog_skin_leg_L'});
  const skinLegR=makeSkinnedChain(root,skeleton,[thighR,shinR,footR],[[.158,.145],[.142,.132],[.112,.105]],m.frog,{ringsPerLink:5,radialSegments:20,name:'frog_skin_leg_R'});
  const skinMeshes={torso:skinTorso,armL:skinArmL,armR:skinArmR,legL:skinLegL,legR:skinLegR};
  bellyCore.visible=false;

  const neutralRot={}, neutralPos={};
  for(const [name,b] of Object.entries(bones)){
    neutralRot[name]=[b.rotation.x,b.rotation.y,b.rotation.z]; neutralPos[name]=[b.position.x,b.position.y,b.position.z];
  }
  const neutralExtras={weapon:[sword.rotation.x,sword.rotation.y,sword.rotation.z],shield:[shield.rotation.x,shield.rotation.y,shield.rotation.z]};

  const customBase={ bonePos:{}, directMeshes:{}, special:{} };
  for(const [name,b] of Object.entries(bones)){
    customBase.bonePos[name]=[b.position.x,b.position.y,b.position.z];
    customBase.directMeshes[name]=b.children.filter(o=>o.isMesh).map(mesh=>({mesh,pos:[mesh.position.x,mesh.position.y,mesh.position.z],scale:[mesh.scale.x,mesh.scale.y,mesh.scale.z]}));
  }
  const specialList={skull,muzzle,jawShell,throat,cheekL,cheekR,bellyCore,neckCore,shoulderFleshL,shoulderFleshR,footPadL,footPadR,sword,shield};
  for(const [name,obj] of Object.entries(specialList)) customBase.special[name]={pos:[obj.position.x,obj.position.y,obj.position.z],scale:[obj.scale.x,obj.scale.y,obj.scale.z]};
  customBase.special.eyes=[...eyeSockets,...eyes,...pupils,...eyelids].map(obj=>({obj,pos:[obj.position.x,obj.position.y,obj.position.z],scale:[obj.scale.x,obj.scale.y,obj.scale.z]}));
  customBase.special.tassets=tassets.map(obj=>({obj,pos:[obj.position.x,obj.position.y,obj.position.z],scale:[obj.scale.x,obj.scale.y,obj.scale.z]}));
  customBase.special.cloakMeshes=cloakMeshes.map(obj=>({obj,pos:[obj.position.x,obj.position.y,obj.position.z],scale:[obj.scale.x,obj.scale.y,obj.scale.z]}));

  Object.assign(root.userData,{
    rig:true,bones,skeleton,skeletonHelper:helper,materials:m,arm:upperArmR,leftArm:upperArmL,weapon:sword,shield,ring,aura:ring,
    torso:chest,breast:spine2,head,jaw,throat,cloak:cloak1,cloakBones:[cloak1,cloak2,cloak3,cloak4],legs:[thighL,thighR],
    shoulders:[clavicleL,clavicleR],mailSkirt:pelvis,neutralRot,neutralPos,baseNeutralPos:JSON.parse(JSON.stringify(neutralPos)),neutralExtras,eyelids,
    eyeSockets,eyes,pupils,irisRings,skull,muzzle,jawShell,throat,cheekL,cheekR,bellyCore,neckCore,footPadL,footPadR,tassets,cloakMeshes,customBase,
    skinMeshes,secondary:{cloak:[0,0,0,0],vel:[0,0,0,0],blink:0,lastBlink:0},
  });
  const initial=customization || (useSavedCustomization ? loadFrogKnightCustomization() : FROG_KNIGHT_DEFAULTS);
  applyFrogKnightCustomization(root,initial);
  return root;
}


export function applyFrogKnightCustomization(model,input={}){
  if(!model?.userData?.customBase) return;
  const p={...FROG_KNIGHT_DEFAULTS,...input};
  const u=model.userData, cb=u.customBase, bones=u.bones, mats=u.materials;
  u.customization={...p};
  model.scale.setScalar(p.overallScale);

  // Restore the construction baseline first so every slider is deterministic.
  for(const [name,b] of Object.entries(bones)){
    const bp=cb.bonePos[name];
    if(bp){ b.position.set(bp[0],bp[1],bp[2]); u.neutralPos[name]=[bp[0],bp[1],bp[2]]; }
    for(const item of cb.directMeshes[name]||[]){
      item.mesh.position.set(...item.pos); item.mesh.scale.set(...item.scale);
    }
  }
  for(const group of [cb.special.eyes,cb.special.tassets,cb.special.cloakMeshes]) for(const item of group||[]){ item.obj.position.set(...item.pos); item.obj.scale.set(...item.scale); }
  for(const [name,base] of Object.entries(cb.special)){
    if(!base || Array.isArray(base) || !base.scale) continue; const obj=u[name]; if(obj){ obj.position.set(...base.pos); obj.scale.set(...base.scale); }
  }

  const meshScale=(name,sx=1,sy=1,sz=1,scalePosY=false)=>{
    for(const item of cb.directMeshes[name]||[]){
      item.mesh.scale.set(item.scale[0]*sx,item.scale[1]*sy,item.scale[2]*sz);
      item.mesh.position.set(item.pos[0]*sx,scalePosY?item.pos[1]*sy:item.pos[1],item.pos[2]*sz);
    }
  };
  const setBonePos=(name,xMul=1,yMul=1,zMul=1)=>{ const bp=cb.bonePos[name],b=bones[name]; if(!bp||!b)return; b.position.set(bp[0]*xMul,bp[1]*yMul,bp[2]*zMul); u.neutralPos[name]=[b.position.x,b.position.y,b.position.z]; };

  // Torso and stance. Meshes change without stretching the animation skeleton unnecessarily.
  meshScale('spine1',p.torsoWidth,1,p.torsoDepth);
  meshScale('spine2',p.torsoWidth*p.armorBulk,1,p.torsoDepth*p.armorBulk);
  meshScale('chest',p.torsoWidth*p.armorBulk,1,p.torsoDepth*p.armorBulk);
  setBonePos('clavicleL',p.shoulderWidth,1,1); setBonePos('clavicleR',p.shoulderWidth,1,1);
  setBonePos('thighL',p.stanceWidth,1,1); setBonePos('thighR',p.stanceWidth,1,1);

  // Arms: preserve real elbow/wrist pivots while changing segment proportions.
  for(const side of ['L','R']){
    meshScale(`upperArm${side}`,p.armThickness,p.armLength,p.armThickness,true);
    meshScale(`forearm${side}`,p.armThickness,p.armLength,p.armThickness,true);
    meshScale(`hand${side}`,p.armThickness,1,p.armThickness);
    setBonePos(`forearm${side}`,1,p.armLength,1);
    setBonePos(`hand${side}`,1,p.armLength,1);
  }
  // Legs keep knee and ankle pivots at the ends of the newly-sized segments.
  for(const side of ['L','R']){
    meshScale(`thigh${side}`,p.legThickness,p.legLength,p.legThickness,true);
    meshScale(`shin${side}`,p.legThickness*p.greaveBulk,p.legLength,p.legThickness*p.greaveBulk,true);
    setBonePos(`shin${side}`,1,p.legLength,1);
    setBonePos(`foot${side}`,1,p.legLength,1);
    meshScale(`foot${side}`,p.footSize,1,p.footSize);
    meshScale(`toe${side}`,p.footSize,1,p.footSize,true);
    setBonePos(`toe${side}`,1,1,p.footSize);
  }
  // Toe splay is a visual-only frog characteristic; it does not alter the locomotion pivots.
  for(const side of ['L','R']){
    for(const item of cb.directMeshes[`toe${side}`]||[]){
      const x=item.mesh.position.x;
      item.mesh.rotation.y=(x<-.04?-1:x>.04?1:0)*.10*p.toeSplay;
    }
  }

  // Smooth skinned anatomy follows the same bone proportions while retaining organic volume.
  if(u.skinMeshes){
    reshapeSkinnedChain(u.skinMeshes.torso,p.torsoWidth*p.bellySize,p.torsoDepth*p.bellySize);
    reshapeSkinnedChain(u.skinMeshes.armL,p.armThickness,p.armThickness);
    reshapeSkinnedChain(u.skinMeshes.armR,p.armThickness,p.armThickness);
    reshapeSkinnedChain(u.skinMeshes.legL,p.legThickness,p.legThickness);
    reshapeSkinnedChain(u.skinMeshes.legR,p.legThickness,p.legThickness);
  }

  // Head/frog anatomy.
  meshScale('head',p.headWidth,p.headHeight,p.headDepth);
  meshScale('jaw',p.headWidth,p.headHeight,p.headDepth);
  setBonePos('jaw',1,p.headHeight,p.headDepth);
  if(u.muzzle){ const b=cb.special.muzzle; u.muzzle.scale.set(b.scale[0]*p.headWidth*p.muzzleScale,b.scale[1]*p.headHeight*p.muzzleScale,b.scale[2]*p.headDepth*p.muzzleScale); u.muzzle.position.set(b.pos[0],b.pos[1]*p.headHeight,b.pos[2]*p.headDepth); }
  if(u.throat){ const b=cb.special.throat; u.throat.scale.set(b.scale[0]*p.headWidth*p.throatSize,b.scale[1]*p.headHeight*p.throatSize,b.scale[2]*p.headDepth*p.throatSize); }
  for(const name of ['cheekL','cheekR']){ const obj=u[name],b=cb.special[name]; if(obj&&b) obj.scale.set(b.scale[0]*p.headWidth*p.cheekSize,b.scale[1]*p.headHeight*p.cheekSize,b.scale[2]*p.headDepth*p.cheekSize); }
  if(u.bellyCore){ const b=cb.special.bellyCore; u.bellyCore.scale.set(b.scale[0]*p.torsoWidth*p.bellySize,b.scale[1]*p.bellySize,b.scale[2]*p.torsoDepth*p.bellySize); }
  for(const item of cb.special.eyes||[]){
    const obj=item.obj, isEyePart=Math.abs(item.pos[0])>.2;
    obj.position.set(item.pos[0]*p.headWidth*p.eyeSpacing,item.pos[1]*p.headHeight,item.pos[2]*p.headDepth);
    obj.scale.set(item.scale[0]*p.eyeSize,item.scale[1]*p.eyeSize,item.scale[2]*p.eyeSize);
  }

  // Armor-specific controls. Clavicle meshes are the layered pauldrons.
  meshScale('clavicleL',p.pauldronScale,p.pauldronScale,p.pauldronScale);
  meshScale('clavicleR',p.pauldronScale,p.pauldronScale,p.pauldronScale);
  for(const item of cb.special.tassets||[]){ item.obj.scale.y=item.scale[1]*p.tassetLength; item.obj.position.y=item.pos[1] - (p.tassetLength-1)*.12; }
  for(const item of cb.special.cloakMeshes||[]){ item.obj.scale.x=item.scale[0]*p.cloakWidth; item.obj.scale.y=item.scale[1]*p.cloakLength; item.obj.position.y=item.pos[1]*p.cloakLength; }

  // Equipment.
  if(u.weapon){ const b=cb.special.sword; u.weapon.scale.set(b.scale[0]*p.swordBulk,b.scale[1]*p.swordBulk,b.scale[2]*p.swordLength); }
  if(u.shield){ const b=cb.special.shield; u.shield.scale.set(b.scale[0]*p.shieldScale,b.scale[1]*p.shieldScale,b.scale[2]*p.shieldScale); }

  // Materials.
  mats.steel.color.set(p.steelColor); mats.steel.roughness=p.steelRoughness; mats.steel.metalness=p.steelMetalness;
  mats.steelDark.color.set(p.steelDarkColor); mats.steelDark.roughness=Math.min(1,p.steelRoughness+.11); mats.steelDark.metalness=Math.max(0,p.steelMetalness-.10);
  mats.frog.color.set(p.frogColor); mats.frog.roughness=p.frogRoughness; mats.frog.clearcoat=p.frogWetness; mats.belly.color.set(p.bellyColor); mats.belly.clearcoat=Math.min(.22,p.frogWetness*.55);
  mats.leather.color.set(p.leatherColor); mats.cloth.color.set(p.cloakColor);

  // Store post-customization eye positions so autonomous gaze never accumulates drift.
  for(const pupil of u.pupils||[]) pupil.userData.gazeBase=pupil.position.clone();
  model.updateMatrixWorld(true);
}

export function getFrogKnightCustomization(model){ return { ...(model?.userData?.customization || FROG_KNIGHT_DEFAULTS) }; }

export function setFrogRigWireframe(model,on=false){
  const seen=new Set();
  model?.traverse(o=>{ if(!o.isMesh)return; const list=Array.isArray(o.material)?o.material:[o.material]; for(const m of list){ if(!m||seen.has(m))continue; seen.add(m); if('wireframe' in m)m.wireframe=!!on; } });
}

export function setFrogRigOrganicOnly(model,on=false){
  if(!model?.userData?.materials)return;
  const mats=model.userData.materials;
  const organic=new Set([mats.frog,mats.belly,mats.eye,mats.irisRing,mats.pupil,mats.mouth]);
  model.traverse(o=>{
    if(!o.isMesh)return;
    if(on){ if(o.userData._organicPrevVisible===undefined)o.userData._organicPrevVisible=o.visible; o.visible=o.isSkinnedMesh||organic.has(o.material); }
    else if(o.userData._organicPrevVisible!==undefined){ o.visible=o.userData._organicPrevVisible; delete o.userData._organicPrevVisible; }
  });
}

export function setFrogRigSkinWeightDebug(model,on=false){
  if(!model)return;
  model.traverse(o=>{
    if(!o.isMesh)return;
    if(on){
      if(o.userData._weightPrevVisible===undefined)o.userData._weightPrevVisible=o.visible;
      if(!o.isSkinnedMesh){ o.visible=false; return; }
      o.visible=true;
      if(!o.userData._weightMaterial){
        const g=o.geometry, si=g.attributes.skinIndex, sw=g.attributes.skinWeight;
        const colors=new Float32Array(g.attributes.position.count*3); const c=new THREE.Color();
        for(let i=0;i<g.attributes.position.count;i++){
          let best=0,boneIndex=si.getX(i);
          for(let k=0;k<4;k++){
            const w=k===0?sw.getX(i):k===1?sw.getY(i):k===2?sw.getZ(i):sw.getW(i);
            const bi=k===0?si.getX(i):k===1?si.getY(i):k===2?si.getZ(i):si.getW(i);
            if(w>best){best=w;boneIndex=bi;}
          }
          c.setHSL((boneIndex*.137)%1,.78,.56); colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
        }
        g.setAttribute('color',new THREE.BufferAttribute(colors,3));
        o.userData._weightMaterial=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide});
      }
      if(!o.userData._weightOriginalMaterial)o.userData._weightOriginalMaterial=o.material;
      o.material=o.userData._weightMaterial;
    } else {
      if(o.userData._weightOriginalMaterial){o.material=o.userData._weightOriginalMaterial;delete o.userData._weightOriginalMaterial;}
      if(o.userData._weightPrevVisible!==undefined){o.visible=o.userData._weightPrevVisible;delete o.userData._weightPrevVisible;}
    }
  });
}

function boneOffset(model,name,x=0,y=0,z=0,weight=1){
  if(model?.userData?.importedMesh)weight*=name.startsWith('upperArm')?.82:name.startsWith('forearm')?.75:1;
  const b=model?.userData?.bones?.[name], n=model?.userData?.neutralRot?.[name]; if(!b||!n)return;
  b.rotation.set(n[0]+x*weight,n[1]+y*weight,n[2]+z*weight);
}
function boneAdd(model,name,x=0,y=0,z=0,weight=1){ if(model?.userData?.importedMesh)weight*=name.startsWith('upperArm')?.82:name.startsWith('forearm')?.75:1; const b=model?.userData?.bones?.[name]; if(!b)return; b.rotation.x+=x*weight;b.rotation.y+=y*weight;b.rotation.z+=z*weight; }
function bonePos(model,name,x=0,y=0,z=0,weight=1){
  const b=model?.userData?.bones?.[name], n=model?.userData?.neutralPos?.[name]; if(!b||!n)return;
  b.position.set(n[0]+x*weight,n[1]+y*weight,n[2]+z*weight);
}
function extraOffset(model,name,x=0,y=0,z=0,weight=1){
  const o=model?.userData?.[name], n=model?.userData?.neutralExtras?.[name]; if(!o||!n)return;
  o.rotation.set(n[0]+x*weight,n[1]+y*weight,n[2]+z*weight);
}

export function resetFrogRigPose(model){
  const bones=model?.userData?.bones, nr=model?.userData?.neutralRot, np=model?.userData?.neutralPos; if(!bones||!nr||!np)return;
  for(const [name,b] of Object.entries(bones)){
    const r=nr[name],p=np[name]; b.rotation.set(r[0],r[1],r[2]); b.position.set(p[0],p[1],p[2]);
  }
  const ex=model.userData.neutralExtras;
  if(ex?.weapon) model.userData.weapon.rotation.set(...ex.weapon);
  if(ex?.shield) model.userData.shield.rotation.set(...ex.shield);
}

export function poseFrogRigIdle(model,time=0,amount=1,fighting=false){
  const breath=Math.sin(time*1.65), slow=Math.sin(time*.72), pulse=Math.sin(time*3.3);
  bonePos(model,'rigRoot',0,breath*.010*amount,0);
  boneOffset(model,'pelvis',0,slow*.015,-slow*.009,amount);
  boneOffset(model,'spine1',breath*.015,slow*.010,0,amount);
  boneOffset(model,'spine2',breath*.018,-slow*.018,0,amount);
  boneOffset(model,'chest',breath*.012,-slow*.022,slow*.009,amount);
  boneOffset(model,'neck',-breath*.008,slow*.014,0,amount);
  boneOffset(model,'head',-breath*.014,slow*.028,-slow*.018,amount);
  boneOffset(model,'jaw',.018 + pulse*.012,0,0,amount);
  if(fighting){
    boneAdd(model,'thighL',-.10,0,.025,amount); boneAdd(model,'thighR',-.10,0,-.025,amount);
    boneAdd(model,'shinL',.18,0,0,amount); boneAdd(model,'shinR',.18,0,0,amount);
    boneAdd(model,'upperArmL',-.52,.08,-.24,amount); boneAdd(model,'forearmL',-.60,.18,0,amount);
    boneAdd(model,'upperArmR',-.28,-.05,.16,amount); boneAdd(model,'forearmR',-.34,0,.05,amount);
    extraOffset(model,'shield',0,-.18,-.12,amount); extraOffset(model,'weapon',-.08,.05,0,amount);
  }
}

export function poseFrogRigWalk(model,time=0,strength=1,fighting=false){
  const speed=fighting?8.9:10.6, ph=time*speed;
  const s=Math.sin(ph), c=Math.cos(ph), leftLift=Math.max(0,-s), rightLift=Math.max(0,s);
  const stride=(fighting?.34:.48)*strength;
  bonePos(model,'rigRoot',0,(.015+Math.abs(s)*.035)*strength,0);
  boneAdd(model,'pelvis',-.025*Math.abs(s)*strength,s*.06*strength,s*.035*strength);
  boneAdd(model,'spine1',.02*Math.abs(s)*strength,-s*.045*strength,0);
  boneAdd(model,'spine2',0,-s*.075*strength,-s*.018*strength);
  boneAdd(model,'chest',-.025*Math.abs(s)*strength,-s*.095*strength,-s*.025*strength);
  boneAdd(model,'head',.012*Math.abs(s)*strength,s*.038*strength,s*.016*strength);

  boneAdd(model,'thighL',s*stride,0,.025*strength); boneAdd(model,'thighR',-s*stride,0,-.025*strength);
  boneAdd(model,'shinL',leftLift*.64*strength,0,0); boneAdd(model,'shinR',rightLift*.64*strength,0,0);
  boneAdd(model,'footL',(-s*.16-leftLift*.10)*strength,0,0); boneAdd(model,'footR',(s*.16-rightLift*.10)*strength,0,0);
  boneAdd(model,'toeL',leftLift*.22*strength,0,0); boneAdd(model,'toeR',rightLift*.22*strength,0,0);

  if(fighting){
    boneAdd(model,'upperArmL',-.48+s*.05,.08,-.22, strength); boneAdd(model,'forearmL',-.55,.18,0,strength);
    boneAdd(model,'upperArmR',-.32+s*.06,-.04,.15,strength); boneAdd(model,'forearmR',-.36,0,.05,strength);
    extraOffset(model,'shield',0,-.18,-.12,strength);
  } else {
    boneAdd(model,'clavicleL',0,0,-s*.045*strength); boneAdd(model,'clavicleR',0,0,s*.045*strength);
    boneAdd(model,'upperArmL',-s*.27*strength,0,0); boneAdd(model,'forearmL',Math.max(0,s)*-.18*strength,0,0);
    boneAdd(model,'upperArmR',s*.23*strength,0,0); boneAdd(model,'forearmR',Math.max(0,-s)*-.20*strength,0,0);
  }
}

export function poseFrogRigBlock(model,time=0,amount=1){
  const breathe=Math.sin(time*2)*.025;
  boneAdd(model,'pelvis',-.10,0,.03,amount); boneAdd(model,'spine1',.02,-.08,0,amount); boneAdd(model,'chest',-.12,-.14,.03,amount);
  boneAdd(model,'thighL',-.18,0,.05,amount); boneAdd(model,'thighR',-.15,0,-.05,amount); boneAdd(model,'shinL',.30,0,0,amount); boneAdd(model,'shinR',.27,0,0,amount);
  boneAdd(model,'clavicleL',0,.08,-.22,amount); boneAdd(model,'upperArmL',-1.10,.18,-.48,amount); boneAdd(model,'forearmL',-1.08,.36,.12,amount); boneAdd(model,'handL',-.08,.12,-.08,amount);
  extraOffset(model,'shield',-.06,-.38,-.22,amount);
  boneAdd(model,'upperArmR',-.50,-.05,.20,amount); boneAdd(model,'forearmR',-.40,0,.08,amount); boneAdd(model,'handR',0,.05,.08,amount);
  boneAdd(model,'head',.01,.10,breathe,amount);
}

// Keyframed attack poses. Values are additive Euler offsets from the neutral rig.
const LIGHT_FRAMES=[
  {t:0, p:{}},
  {t:.18,p:{pelvis:[-.06,-.13,.03],spine2:[-.03,-.18,0],chest:[-.05,-.34,.06],clavicleR:[0,-.12,.22],upperArmR:[-1.02,-.28,.58],forearmR:[-.78,.05,.14],handR:[-.08,-.16,.12],upperArmL:[-.28,.05,-.16],forearmL:[-.34,.15,0],thighR:[-.12,0,-.05],shinR:[.20,0,0],weapon:[-.14,-.10,0],shield:[0,-.12,-.10]}},
  {t:.37,p:{pelvis:[-.05,.22,-.03],spine2:[.02,.28,0],chest:[.03,.50,-.10],clavicleR:[0,.22,-.20],upperArmR:[-.34,.46,-.82],forearmR:[-.20,.18,-.24],handR:[.10,.34,-.18],upperArmL:[-.16,.03,-.20],forearmL:[-.30,.12,0],thighL:[-.10,0,.04],shinL:[.16,0,0],weapon:[.10,.34,-.08],shield:[0,-.14,-.12]}},
  {t:.62,p:{pelvis:[-.03,.30,-.04],spine2:[.01,.34,0],chest:[.08,.57,-.14],clavicleR:[0,.28,-.30],upperArmR:[.18,.52,-.98],forearmR:[.06,.28,-.32],handR:[.08,.40,-.22],upperArmL:[-.12,0,-.12],forearmL:[-.22,.08,0],weapon:[.18,.46,-.10]}},
  {t:.82,p:{pelvis:[0,.10,0],spine2:[0,.12,0],chest:[.02,.18,-.03],upperArmR:[-.10,.16,-.30],forearmR:[-.16,.08,-.10],handR:[0,.10,-.06],upperArmL:[-.08,0,-.06],forearmL:[-.14,.04,0]}},
  {t:1,p:{}}
];
const HEAVY_FRAMES=[
  {t:0,p:{}},
  {t:.24,p:{pelvis:[-.16,-.14,0],spine1:[-.06,-.10,0],spine2:[-.10,-.22,0],chest:[-.15,-.30,.03],clavicleR:[-.08,-.12,.24],upperArmR:[-1.55,-.18,.30],forearmR:[-1.20,.02,.12],handR:[-.22,-.12,.02],upperArmL:[-.36,.05,-.18],forearmL:[-.50,.20,0],thighL:[-.20,0,.05],thighR:[-.19,0,-.05],shinL:[.35,0,0],shinR:[.33,0,0],weapon:[-.28,-.12,0],shield:[-.05,-.18,-.10]}},
  {t:.39,p:{pelvis:[-.20,-.20,0],spine1:[-.10,-.14,0],spine2:[-.16,-.30,0],chest:[-.22,-.36,0],clavicleR:[-.14,-.18,.12],upperArmR:[-2.00,-.15,.08],forearmR:[-1.48,0,.06],handR:[-.32,-.12,0],upperArmL:[-.42,.04,-.20],forearmL:[-.58,.18,0],thighL:[-.25,0,.05],thighR:[-.23,0,-.05],shinL:[.42,0,0],shinR:[.40,0,0],weapon:[-.36,-.08,0],shield:[-.08,-.22,-.12]}},
  {t:.46,p:{pelvis:[-.18,.16,.01],spine1:[.10,.14,0],spine2:[.18,.22,0],chest:[.28,.30,-.04],clavicleR:[.08,.18,-.14],upperArmR:[.38,.22,-.18],forearmR:[-.12,.04,-.08],handR:[.20,.20,-.08],upperArmL:[-.22,0,-.18],forearmL:[-.34,.12,0],thighL:[-.28,0,.04],thighR:[-.26,0,-.04],shinL:[.44,0,0],shinR:[.42,0,0],weapon:[.30,.24,-.04],shield:[-.04,-.20,-.10]}},
  {t:.64,p:{pelvis:[-.12,.24,0],spine1:[.08,.18,0],spine2:[.14,.28,0],chest:[.22,.38,-.06],upperArmR:[.54,.28,-.26],forearmR:[.10,.12,-.12],handR:[.18,.24,-.10],upperArmL:[-.14,0,-.10],forearmL:[-.24,.08,0],weapon:[.38,.30,-.06]}},
  {t:.86,p:{pelvis:[-.04,.06,0],spine2:[.02,.08,0],chest:[.05,.10,0],upperArmR:[-.04,.08,-.12],forearmR:[-.10,.04,-.04],handR:[0,.04,-.03]}},
  {t:1,p:{}}
];

function sampleFrames(frames,t){
  t=clamp01(t); let a=frames[0],b=frames[frames.length-1];
  for(let i=0;i<frames.length-1;i++){ if(t>=frames[i].t&&t<=frames[i+1].t){a=frames[i];b=frames[i+1];break;} }
  const u=smoother((t-a.t)/Math.max(.0001,b.t-a.t));
  const keys=new Set([...Object.keys(a.p),...Object.keys(b.p)]); const out={};
  for(const k of keys){ const av=a.p[k]||[0,0,0],bv=b.p[k]||[0,0,0]; out[k]=[lerp(av[0],bv[0],u),lerp(av[1],bv[1],u),lerp(av[2],bv[2],u)]; }
  return out;
}
function applyFramePose(model,p,weight=1){
  for(const [name,v] of Object.entries(p)){
    if(name==='weapon'||name==='shield') extraOffset(model,name,v[0],v[1],v[2],weight);
    else boneOffset(model,name,v[0],v[1],v[2],weight);
  }
}

export function poseFrogRigAttack(model,kind='light',normalizedTime=0){
  const frames=kind==='heavy'?HEAVY_FRAMES:LIGHT_FRAMES; applyFramePose(model,sampleFrames(frames,normalizedTime),1);
  // Keep the non-weapon foot planted by subtly sinking the root through impact.
  const hit=kind==='heavy'?.46:.37; const impact=Math.exp(-Math.pow((normalizedTime-hit)/.085,2));
  bonePos(model,'rigRoot',0,-impact*(kind==='heavy'?.075:.035),0);
  boneAdd(model,'jaw',impact*.035,0,0);
}

export function poseFrogRigCast(model,t=0){
  const k=smooth(t), pulse=Math.sin(clamp01(t)*Math.PI);
  boneAdd(model,'pelvis',-.08,-.08,0); boneAdd(model,'spine2',-.08,-.12,0); boneAdd(model,'chest',-.12,-.18,0);
  boneAdd(model,'upperArmR',-1.05,-.25,.36); boneAdd(model,'forearmR',-1.00,.10,.16); boneAdd(model,'handR',-.22,.18,.10); extraOffset(model,'weapon',-.25,.10,0);
  boneAdd(model,'upperArmL',-.72,.32,-.48); boneAdd(model,'forearmL',-.75,.46,.10); boneAdd(model,'handL',-.12,.20,-.10); extraOffset(model,'shield',0,-.42,-.22);
  boneAdd(model,'head',-.05,.10,0); bonePos(model,'rigRoot',0,pulse*.035,0); boneAdd(model,'jaw',pulse*.04,0,0);
}

export function poseFrogRigFlask(model,t=0){
  const pulse=Math.sin(clamp01(t)*Math.PI);
  boneAdd(model,'chest',-.05,-.14,.02); boneAdd(model,'head',.08,.12,0);
  boneAdd(model,'upperArmR',-.72,-.18,.26); boneAdd(model,'forearmR',-1.48,.10,.12); boneAdd(model,'handR',-.28,.08,-.08); extraOffset(model,'weapon',-.18,.18,.08);
  boneAdd(model,'upperArmL',-.22,.04,-.12); boneAdd(model,'forearmL',-.32,.12,0); boneAdd(model,'jaw',pulse*.055,0,0);
}

export function poseFrogRigDodge(model,t=0){
  t=clamp01(t); const compress=Math.sin(t*Math.PI), tuck=Math.sin(clamp01(t*1.35)*Math.PI);
  bonePos(model,'rigRoot',0,-compress*.16,0); boneAdd(model,'pelvis',-.42*compress,0,.08*compress); boneAdd(model,'spine1',.20*compress,0,-.04*compress); boneAdd(model,'chest',.36*compress,0,-.08*compress); boneAdd(model,'head',-.24*compress,0,.10*compress);
  boneAdd(model,'thighL',-.62*tuck,0,.10); boneAdd(model,'thighR',-.56*tuck,0,-.10); boneAdd(model,'shinL',.92*tuck,0,0); boneAdd(model,'shinR',.84*tuck,0,0); boneAdd(model,'footL',-.30*tuck,0,0); boneAdd(model,'footR',-.26*tuck,0,0);
  boneAdd(model,'upperArmL',-.72,0,-.30); boneAdd(model,'forearmL',-.78,.12,0); boneAdd(model,'upperArmR',-.82,0,.28); boneAdd(model,'forearmR',-.76,-.10,0);
}

export function poseFrogRigHit(model,t=0,severity=1){
  const k=Math.sin(clamp01(t)*Math.PI)*severity;
  boneAdd(model,'pelvis',-.08*k,-.22*k,.08*k); boneAdd(model,'spine1',.08*k,.16*k,-.06*k); boneAdd(model,'spine2',.12*k,.30*k,-.12*k); boneAdd(model,'chest',.16*k,.38*k,-.16*k); boneAdd(model,'head',-.12*k,-.24*k,.18*k);
  boneAdd(model,'upperArmL',.12*k,0,-.28*k); boneAdd(model,'upperArmR',.18*k,0,.32*k); boneAdd(model,'forearmL',-.18*k,0,0); boneAdd(model,'forearmR',-.22*k,0,0);
}

export function poseFrogRigDeath(model,t=0){
  t=clamp01(t); const k=smoother(t);
  bonePos(model,'rigRoot',0,-.34*k,0);
  boneAdd(model,'pelvis',-.42*k,.18*k,.92*k); boneAdd(model,'spine1',.18*k,-.12*k,.30*k); boneAdd(model,'spine2',.26*k,-.16*k,.38*k); boneAdd(model,'chest',.32*k,-.20*k,.46*k); boneAdd(model,'head',-.24*k,.10*k,-.34*k);
  boneAdd(model,'thighL',-.48*k,0,.24*k); boneAdd(model,'thighR',-.34*k,0,-.14*k); boneAdd(model,'shinL',.66*k,0,0); boneAdd(model,'shinR',.52*k,0,0);
  boneAdd(model,'upperArmL',.32*k,0,-.58*k); boneAdd(model,'forearmL',-.44*k,.10*k,0); boneAdd(model,'upperArmR',.22*k,0,.64*k); boneAdd(model,'forearmR',-.52*k,-.10*k,0);
  extraOffset(model,'weapon',.26*k,.20*k,-.18*k); extraOffset(model,'shield',-.16*k,-.22*k,.28*k);
}

export function updateFrogRigSecondary(model,dt,{move=0,action=0,time=0}={}){
  const b=model?.userData?.bones, s=model?.userData?.secondary; if(!b||!s)return;
  const targets=[.025,.045,.065,.085].map((base,i)=>base + move*(.07+i*.035) + action*(.035+i*.025) + Math.sin(time*(2.0+i*.16)+i*.7)*(.008+i*.004));
  const names=['cloak1','cloak2','cloak3','cloak4'];
  for(let i=0;i<4;i++){
    const stiffness=20-i*2.5, damping=7-i*.6;
    s.vel[i] += (targets[i]-s.cloak[i])*stiffness*dt;
    s.vel[i] *= Math.exp(-damping*dt); s.cloak[i] += s.vel[i]*dt;
    b[names[i]].rotation.x += s.cloak[i];
  }
  // Low-cost autonomous blink; eyelid shells compress over the eye instead of needing blendshapes.
  const lids=model.userData.eyelids||[];
  const cycle=(time+1.1)%4.8; const blink=cycle<.14?Math.sin((cycle/.14)*Math.PI):0;
  for(const lid of lids){ lid.scale.y=.65 + blink*.43; lid.position.z=.165 + blink*.018; }

  // Frog-specific secondary life: throat respiration and small independent eye attention shifts.
  const throat=model.userData.throat;
  const params=model.userData.customization||FROG_KNIGHT_DEFAULTS;
  if(throat && model.userData.customBase?.special?.throat){
    const base=model.userData.customBase.special.throat.scale;
    const inhale=.5+.5*Math.sin(time*1.45);
    const actionPulse=Math.max(0,action)*.035;
    const k=1 + inhale*.055 + actionPulse;
    throat.scale.set(base[0]*params.headWidth*params.throatSize*(1+k*.010),base[1]*params.headHeight*params.throatSize*k,base[2]*params.headDepth*params.throatSize*(1+k*.018));
  }
  const gazeX=Math.sin(time*.37)*.010 + Math.sin(time*.13)*.006;
  const gazeY=Math.sin(time*.29)*.004;
  for(const pupil of model.userData.pupils||[]){
    const base=pupil.userData.gazeBase||pupil.position;
    const sign=base.x<0?-1:1;
    pupil.position.x = base.x + gazeX*.15*sign;
    pupil.position.y = base.y + gazeY;
    pupil.position.z = base.z;
  }
}
