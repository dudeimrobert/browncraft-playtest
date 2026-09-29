import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_URL = './assets/models/frog-knight-repaired.glb';
const SWORD_URL = './assets/models/wood-sword.glb';
let sourcePromise = null;
let swordPromise = null;

function bone(name, parent, pos=[0,0,0]){
  const b = new THREE.Bone(); b.name = name; b.position.set(...pos); parent.add(b); return b;
}

async function getSourceAsset(){
  if(!sourcePromise){
    sourcePromise = new GLTFLoader().loadAsync(MODEL_URL).then(gltf=>{
      gltf.scene.updateMatrixWorld(true);
      const parts=[],materials=[];
      gltf.scene.traverse(o=>{if(o.isMesh){
        const g=o.geometry.clone().applyMatrix4(o.matrixWorld);
        if(!g.attributes.normal)g.computeVertexNormals();
        parts.push(g);materials.push(o.material.clone());
      }});
      if(!parts.length)throw new Error('Repaired Frog Knight GLB contains no mesh.');
      const geometry=mergeGeometries(parts,true);geometry.computeBoundingBox();
      const material=materials;
      const mats=Array.isArray(material)?material:[material];
      mats.forEach(m=>{
        if(m.map) m.map.colorSpace=THREE.SRGBColorSpace;
        m.side=THREE.DoubleSide;
      });
      return {geometry,material};
    });
  }
  const src=await sourcePromise;
  return {
    geometry:src.geometry.clone(),
    material:Array.isArray(src.material)?src.material.map(m=>m.clone()):src.material.clone()
  };
}

async function getSwordAsset(){
  if(!swordPromise){
    swordPromise = new GLTFLoader().loadAsync(SWORD_URL).then(gltf=>{
      const root=gltf.scene || gltf.scenes?.[0];
      if(!root) throw new Error('Wood sword GLB contains no scene.');
      root.traverse(o=>{
        if(o.isMesh){
          o.castShadow=true; o.receiveShadow=true;
          const mats=Array.isArray(o.material)?o.material:[o.material];
          mats.forEach(m=>{ if(m?.map) m.map.colorSpace=THREE.SRGBColorSpace; });
        }
      });
      return root;
    });
  }
  return (await swordPromise).clone(true);
}

// Coordinates are measured in the uploaded Frog Knight rest model.
// +Y = up, +Z = forward, +X = character right.
const P={"rigRoot": [0, -0.95, 0], "pelvis": [0, -0.18, -0.015], "spine1": [0, 0.02, -0.025], "spine2": [0, 0.2, -0.035], "chest": [0, 0.38, -0.055], "neck": [0, 0.51, 0.025], "head": [0, 0.71, 0.13], "jaw": [0, 0.54, 0.22], "clavicleL": [-0.23, 0.43, -0.055], "upperArmL": [-0.35, 0.42, -0.025], "forearmL": [-0.43, 0.15, 0.035], "handL": [-0.455, -0.12, 0.105], "clavicleR": [0.23, 0.43, -0.055], "upperArmR": [0.35, 0.42, -0.025], "forearmR": [0.43, 0.15, 0.035], "handR": [0.455, -0.12, 0.105], "thighL": [-0.21, -0.25, -0.015], "shinL": [-0.255, -0.55, -0.005], "footL": [-0.3, -0.835, 0.06], "toeL": [-0.39, -0.895, 0.24], "thighR": [0.21, -0.25, -0.015], "shinR": [0.255, -0.55, -0.005], "footR": [0.3, -0.835, 0.06], "toeR": [0.39, -0.895, 0.24], "cloak1": [0, 0.43, -0.24], "cloak2": [0, 0.1, -0.31], "cloak3": [0, -0.23, -0.33], "cloak4": [0, -0.57, -0.32], "weapon": [0.455, -0.195, 0.115]};
const TPOSE={"upperArmL": [-0.0, -0.13035232937209965, -0.5865854821744484, 0.7993283069736976], "forearmL": [0.014191260813118844, -0.03916774166608076, -0.08923317448440925, 0.9951391544405979], "upperArmR": [-0.0, 0.13035232937209965, 0.5865854821744484, 0.7993283069736976], "forearmR": [0.014191260813118844, 0.03916774166608076, 0.08923317448440925, 0.9951391544405979]};
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];

function buildSkeleton(root){
  const rigRoot=bone('root',root,P.rigRoot);
  const pelvis=bone('pelvis',rigRoot,sub(P.pelvis,P.rigRoot));
  const spine1=bone('spine_01',pelvis,sub(P.spine1,P.pelvis));
  const spine2=bone('spine_02',spine1,sub(P.spine2,P.spine1));
  const chest=bone('chest',spine2,sub(P.chest,P.spine2));
  const neck=bone('neck',chest,sub(P.neck,P.chest));
  const head=bone('head',neck,sub(P.head,P.neck));
  const jaw=bone('jaw',head,sub(P.jaw,P.head));

  const clavicleL=bone('clavicle_L',chest,sub(P.clavicleL,P.chest));
  const upperArmL=bone('upperArm_L',clavicleL,sub(P.upperArmL,P.clavicleL));
  const forearmL=bone('forearm_L',upperArmL,sub(P.forearmL,P.upperArmL));
  const handL=bone('hand_L',forearmL,sub(P.handL,P.forearmL));
  const clavicleR=bone('clavicle_R',chest,sub(P.clavicleR,P.chest));
  const upperArmR=bone('upperArm_R',clavicleR,sub(P.upperArmR,P.clavicleR));
  const forearmR=bone('forearm_R',upperArmR,sub(P.forearmR,P.upperArmR));
  const handR=bone('hand_R',forearmR,sub(P.handR,P.forearmR));

  const thighL=bone('thigh_L',pelvis,sub(P.thighL,P.pelvis));
  const shinL=bone('shin_L',thighL,sub(P.shinL,P.thighL));
  const footL=bone('foot_L',shinL,sub(P.footL,P.shinL));
  const toeL=bone('toe_L',footL,sub(P.toeL,P.footL));
  const thighR=bone('thigh_R',pelvis,sub(P.thighR,P.pelvis));
  const shinR=bone('shin_R',thighR,sub(P.shinR,P.thighR));
  const footR=bone('foot_R',shinR,sub(P.footR,P.shinR));
  const toeR=bone('toe_R',footR,sub(P.toeR,P.footR));

  const cloak1=bone('cloak_01',chest,sub(P.cloak1,P.chest));
  const cloak2=bone('cloak_02',cloak1,sub(P.cloak2,P.cloak1));
  const cloak3=bone('cloak_03',cloak2,sub(P.cloak3,P.cloak2));
  const cloak4=bone('cloak_04',cloak3,sub(P.cloak4,P.cloak3));
  const weaponBone=bone('weapon_socket_r',handR,sub(P.weapon,P.handR));

  const bones={rigRoot,pelvis,spine1,spine2,chest,neck,head,jaw,clavicleL,upperArmL,forearmL,handL,clavicleR,upperArmR,forearmR,handR,thighL,shinL,footL,toeL,thighR,shinR,footR,toeR,cloak1,cloak2,cloak3,cloak4};
  const skeletonBones=[...Object.values(bones),weaponBone];
  return {bones,weaponBone,skeletonBones};
}

async function attachSword(weaponBone){
  const sword=await getSwordAsset();
  sword.name='wood_sword_equipped';
  sword.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(sword);
  const size=box.getSize(new THREE.Vector3());
  const targetLength=.98;
  const sc=targetLength/Math.max(.001,size.y);
  sword.scale.multiplyScalar(sc);
  sword.updateMatrixWorld(true);
  const b2=new THREE.Box3().setFromObject(sword);
  const c=b2.getCenter(new THREE.Vector3());
  sword.position.x-=c.x;
  sword.position.z-=c.z;
  sword.position.y-=(.185 * sc);
  sword.traverse(o=>{
    if(o.isMesh){
      o.castShadow=true; o.receiveShadow=true; o.userData.equipment='wood-sword';
      const mats=Array.isArray(o.material)?o.material:[o.material];
      mats.forEach(m=>{if(m?.map)m.map.colorSpace=THREE.SRGBColorSpace;});
    }
  });
  weaponBone.add(sword);
  return sword;
}

function attachClosedSwordGrip(weaponBone){
  const grip=new THREE.Group();
  grip.name='closed_right_hand_grip';
  const leather=new THREE.MeshStandardMaterial({color:0x282018,roughness:.88,metalness:.08});
  const steel=new THREE.MeshStandardMaterial({color:0x57483a,roughness:.48,metalness:.62});

  // The weapon socket is the measured center of the hilt. Build the fist around
  // that point so the palm, fingers and weapon can never drift apart.
  const palm=new THREE.Mesh(new THREE.SphereGeometry(.092,14,10),leather);
  palm.scale.set(.92,1.22,.78);palm.position.set(0,0,-.047);grip.add(palm);
  const cuff=new THREE.Mesh(new THREE.CylinderGeometry(.083,.112,.15,12),steel);
  cuff.position.y=.115;grip.add(cuff);
  for(let i=0;i<4;i++){
    const finger=new THREE.Mesh(new THREE.TorusGeometry(.047,.018,7,12,Math.PI*1.62),leather);
    finger.rotation.x=Math.PI/2;finger.rotation.z=-Math.PI*.3;
    finger.position.set(0,-.058+i*.038,.004);grip.add(finger);
  }
  const thumb=new THREE.Mesh(new THREE.CapsuleGeometry(.022,.085,5,8),leather);
  thumb.rotation.z=-1.02;thumb.rotation.x=.32;thumb.position.set(.052,.015,.025);grip.add(thumb);
  const knuckleBand=new THREE.Mesh(new THREE.BoxGeometry(.145,.028,.038),steel);
  knuckleBand.position.set(0,-.018,.056);knuckleBand.rotation.z=.04;grip.add(knuckleBand);
  grip.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  weaponBone.add(grip);
  return grip;
}

export async function createMeshyFrogKnightRig({ringColor=0xc9a15a,preview=false}={}){
  const root=new THREE.Group(); root.name='frog_knight_textured_hero';
  const content=new THREE.Group(); content.name='frog_model_space'; content.position.y=.9512; root.add(content);
  const {geometry,material}=await getSourceAsset();
  const {bones,weaponBone,skeletonBones}=buildSkeleton(content);
  if(!geometry.attributes.skinIndex || !geometry.attributes.skinWeight) throw new Error('Repaired asset is missing baked skin weights.');
  const mesh=new THREE.SkinnedMesh(geometry,material); mesh.name='Frog_Knight_Textured_Skinned'; mesh.castShadow=true; mesh.receiveShadow=true; content.add(mesh);
  root.updateMatrixWorld(true);
  const skeleton=new THREE.Skeleton(skeletonBones); skeleton.calculateInverses(); mesh.bind(skeleton,mesh.matrixWorld);
  // A single hero must remain visible during poses outside its rest bounds.
  mesh.frustumCulled=false;

  // Separate sword asset: held by the right-hand socket in a passive, blade-down ready stance.
  weaponBone.rotation.set(2.90,-.04,-.16);
  const swordModel=await attachSword(weaponBone);
  const gripFist=attachClosedSwordGrip(weaponBone);

  const ring=new THREE.Mesh(new THREE.RingGeometry(.50,.62,36),new THREE.MeshBasicMaterial({color:ringColor,transparent:true,opacity:preview?.16:.34,side:THREE.DoubleSide,depthWrite:false}));
  ring.rotation.x=-Math.PI/2; ring.position.y=.035; root.add(ring);
  const helper=new THREE.SkeletonHelper(root); helper.matrix=new THREE.Matrix4(); helper.visible=false; root.add(helper);
  const shield=new THREE.Group(); bones.handL.add(shield);
  const weapon=weaponBone;

  const neutralRot={},neutralPos={};
  for(const [name,b] of Object.entries(bones)){neutralRot[name]=[b.rotation.x,b.rotation.y,b.rotation.z];neutralPos[name]=[b.position.x,b.position.y,b.position.z];}
  const neutralExtras={weapon:[weapon.rotation.x,weapon.rotation.y,weapon.rotation.z],shield:[0,0,0]};
  Object.assign(root.userData,{
    rig:true, importedMesh:true, texturedHero:true, rigidSalvage:true, separateWeapon:true, modelSource:'frog_knight_rigid_repaired + wood_sword', bones,skeleton,skeletonHelper:helper,weapon,weaponModel:swordModel,gripFist,shield,ring,aura:ring,arm:bones.upperArmR,leftArm:bones.upperArmL,
    torso:bones.chest,breast:bones.spine2,head:bones.head,jaw:bones.jaw,cloak:bones.cloak1,cloakBones:[bones.cloak1,bones.cloak2,bones.cloak3,bones.cloak4],legs:[bones.thighL,bones.thighR],
    neutralRot,neutralPos,neutralExtras,secondary:{cloak:[0,0,0,0],vel:[0,0,0,0],blink:0,lastBlink:0},eyelids:[],pupils:[],customization:{overallScale:1},meshyMesh:mesh
  });
  return root;
}

export function setMeshyWireframe(model,on){
  model?.traverse?.(o=>{
    if(o.isMesh && o!==model.userData.ring){
      const mats=Array.isArray(o.material)?o.material:[o.material];
      mats.forEach(m=>{ if(m) m.wireframe=!!on; });
    }
  });
}

// Inspection view uses a separate unlit material; original PBR material is preserved.
export function setMeshyWeightView(model,on){
  const mesh=model?.userData.meshyMesh;if(!mesh)return;
  if(!mesh.userData.pbrMaterial)mesh.userData.pbrMaterial=mesh.material;
  if(on && !mesh.userData.weightMaterial){
    const g=mesh.geometry, ids=g.attributes.skinIndex, weights=g.attributes.skinWeight;
    const colors=new Float32Array(ids.count*3), color=new THREE.Color();
    for(let i=0;i<ids.count;i++){
      let r=0,gc=0,b=0;
      for(let k=0;k<4;k++){color.setHSL((ids.array[i*4+k]*.618034)%1,.68,.52);const w=weights.array[i*4+k];r+=color.r*w;gc+=color.g*w;b+=color.b*w;}
      colors.set([r,gc,b],i*3);
    }
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));
    mesh.userData.weightMaterial=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide});
  }
  mesh.material=on?mesh.userData.weightMaterial:mesh.userData.pbrMaterial;
}

export function poseMeshyTPose(model){
  for(const [name,q] of Object.entries(TPOSE))model.userData.bones[name]?.quaternion.fromArray(q);
}
