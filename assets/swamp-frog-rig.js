import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
const sources=new Map();

export async function createSwampFrogRig({ringColor=0xc9a15a,preview=false,species='toad'}={}) {
  const file=species==='tree'?'tree-frog.glb':'swamp-frog.glb';
  if(!sources.has(file))sources.set(file,new GLTFLoader().loadAsync('./assets/models/'+file).catch(e=>{sources.delete(file);throw e;}));
  const gltf=await sources.get(file), body=clone(gltf.scene), root=new THREE.Group();
  root.name=species==='tree'?'tree_frog_hero':'swamp_frog_hero'; root.add(body);
  const bones={}; let mesh;
  body.traverse(o=>{if(o.isBone)bones[o.name]=o;if(o.isMesh){mesh ||= o;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();}});
  if(!mesh?.isSkinnedMesh || !bones.hand_r || !bones.hand_l)throw new Error('Swamp Frog requires its supplied skin and hand bones');
  const mixer=new THREE.AnimationMixer(body), clips=new Map();
  for(const original of gltf.animations){const clip=original.clone();clip.tracks=clip.tracks.filter(t=>t.name!=='root.position');clips.set(clip.name,clip);}
  // Prefer the bind-pose retargeted Tree clips on Swamp Toad; retain originals.
  const preferred=name=>clips.get('Tree_'+name)||clips.get(name);
  const aliases={Sword_Attack_RM:'Sword_Attack',Jump_2:'Jump_Start'};
  let active;
  function pose(name,time,loop=false){const clip=preferred(aliases[name]||name)||preferred('Idle_Sword');if(!clip)return;if(active?.getClip()!==clip){active?.stop();active=mixer.clipAction(clip);active.play();}active.time=loop?((time%clip.duration)+clip.duration)%clip.duration:THREE.MathUtils.clamp(time,0,1)*Math.max(0,clip.duration-.00001);mixer.update(0);root.updateMatrixWorld(true);}
  const skeletonHelper=new THREE.SkeletonHelper(body);skeletonHelper.visible=false;root.add(skeletonHelper);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.50,.62,36),new THREE.MeshBasicMaterial({color:ringColor,transparent:true,opacity:preview?.16:.34,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.035;root.add(ring);
  const weapon=new THREE.Group(),shield=new THREE.Group();weapon.name='weapon_socket_r';shield.name='shield_socket_l';bones.hand_r.add(weapon);bones.hand_l.add(shield);
  const steel=new THREE.MeshStandardMaterial({color:0x8c8270,metalness:.65,roughness:.55}),wood=new THREE.MeshStandardMaterial({color:0x62432b,roughness:.85});
  const blade=new THREE.Mesh(new THREE.BoxGeometry(.07,.75,.035),steel);blade.position.y=.47;weapon.add(blade);
  const hilt=new THREE.Mesh(new THREE.BoxGeometry(.24,.035,.07),steel);hilt.position.y=.08;weapon.add(hilt);
  const grip=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.18,8),wood);grip.position.y=-.025;weapon.add(grip);
  const guard=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.045,12),wood);guard.rotation.x=Math.PI/2;shield.add(guard);
  weapon.rotation.z=Math.PI/2;shield.position.set(0,0,.08);
  Object.assign(root.userData,{rig:true,importedMesh:true,nativeAnimations:true,bones,meshyMesh:mesh,skeleton:mesh.skeleton,skeletonHelper,poseRest(){active?.stop();active=null;mesh.skeleton.pose();root.updateMatrixWorld(true);},ring,aura:ring,weapon,shield,customization:{overallScale:1},modelSource:file,poseNative:pose,animationNames:[...clips.keys()],syncGear(gear){weapon.visible=!!gear?.equipped?.mainHand;shield.visible=!!gear?.equipped?.offhand;}});
  pose('Idle_Sword',0,true);
  return root;
}
