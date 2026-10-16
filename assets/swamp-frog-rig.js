import support from './ground-support.js?v=2.6.9';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import {attachShroud,SHROUD_ITEM_ID} from './shroud-equipment.js?v=2.6.9';
const sources=new Map();

export async function createSwampFrogRig({ringColor=0xc9a15a,preview=false,species='tree'}={}) {
  species=species==='toad'?'toad':'tree';
  const file=species==='toad'?'swamp-frog.glb':'tree-frog.glb';
  if(!sources.has(file))sources.set(file,new GLTFLoader().loadAsync('./assets/models/'+file).catch(e=>{sources.delete(file);throw e;}));
  const gltf=await sources.get(file), body=clone(gltf.scene), root=new THREE.Group();
  root.name=species==='tree'?'tree_frog_hero':'swamp_frog_hero'; root.add(body);
  const bones={}; let mesh;
  body.traverse(o=>{if(o.isBone)bones[o.name]=o;if(o.isMesh){mesh ||= o;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();}});
  if(!mesh?.isSkinnedMesh || !bones.hand_r || !bones.hand_l)throw new Error('Swamp Frog requires its supplied skin and hand bones');
  const mixer=new THREE.AnimationMixer(body), clips=new Map();
  for(const original of gltf.animations){const clip=original.clone();clip.tracks=clip.tracks.filter(t=>t.name!=='root.position');clips.set(clip.name,clip);}
  // Keep native clips where available; transferred clips extend the animation set.
  const preferred=name=>clips.get(name)||clips.get('Tree_'+name);
  const aliases={Sword_Attack_RM:'Sword_Attack',Jump_2:'Jump_Start'};
  let active,shroud=null,shroudPromise=null,wantsShroud=false;
  const groundMeshes=[];const groundPoint=new THREE.Vector3(),toRoot=new THREE.Matrix4();
  const originalBodyY=body.position.y;let airborneOffset=0;
  body.traverse(o=>{if(!o.isSkinnedMesh)return;const indices=[],a=o.geometry.attributes;
    const cached=support[file];if(cached?.vertexCount===a.position.count&&!o.morphTargetInfluences){groundMeshes.push({mesh:o,indices:cached.ground,full:cached.full});return;}
    const feet=new Set(o.skeleton.bones.map((b,i)=>/^(calf|foot|ball)_/.test(b.name)?i:-1));
    for(let v=0;v<a.position.count;v++){let weight=0;for(let k=0;k<4;k++)if(feet.has(a.skinIndex.getComponent(v,k)))weight+=a.skinWeight.getComponent(v,k);if(weight>.1)indices.push(v);}
    groundMeshes.push({mesh:o,indices:indices.length?indices:Array.from({length:a.position.count},(_,i)=>i)});
  });
  function lowestFeet(full=false){let y=Infinity;root.updateMatrixWorld(true);toRoot.copy(root.matrixWorld).invert();
    for(const part of groundMeshes){const m=part.mesh;const matrix=new THREE.Matrix4().multiplyMatrices(toRoot,m.matrixWorld);const selected=full?part.full:part.indices;const count=selected?selected.length:m.geometry.attributes.position.count;
      for(let n=0;n<count;n++){m.getVertexPosition(selected?selected[n]:n,groundPoint);groundPoint.applyMatrix4(matrix);y=Math.min(y,groundPoint.y);}}
    return Number.isFinite(y)?y:0;
  }
  function ground(name){body.position.y=originalBodyY;const min=lowestFeet(/Death/i.test(name));
    const air=/Jump|jump/.test(name)&&!/Land/.test(name);
    body.position.y+=air?Math.max(airborneOffset,-min):-min;
    root.updateMatrixWorld(true);
  }
  function pose(name,time,loop=false){const clip=preferred(name)||preferred(aliases[name])||preferred('Idle_Sword');if(!clip)return;
    if(active?.getClip()!==clip){active?.stop();active=mixer.clipAction(clip);active.play();}
    active.time=loop?((time%clip.duration)+clip.duration)%clip.duration:THREE.MathUtils.clamp(time,0,1)*Math.max(0,clip.duration-.00001);
    mixer.update(0);shroud?.update(clip.name,active.time);ground(clip.name);shroud?.ground(root);root.userData.activeClip=clip.name;
  }
  const skeletonHelper=new THREE.SkeletonHelper(body);skeletonHelper.visible=false;root.add(skeletonHelper);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.50,.62,36),new THREE.MeshBasicMaterial({color:ringColor,transparent:true,opacity:preview?.16:.34,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.035;root.add(ring);
  const weapon=new THREE.Group(),shield=new THREE.Group();weapon.name='weapon_socket_r';shield.name='shield_socket_l';bones.hand_r.add(weapon);bones.hand_l.add(shield);
  const steel=new THREE.MeshStandardMaterial({color:0x8c8270,metalness:.65,roughness:.55}),wood=new THREE.MeshStandardMaterial({color:0x62432b,roughness:.85});
  const blade=new THREE.Mesh(new THREE.BoxGeometry(.07,.75,.035),steel);blade.position.y=.47;weapon.add(blade);
  const hilt=new THREE.Mesh(new THREE.BoxGeometry(.24,.035,.07),steel);hilt.position.y=.08;weapon.add(hilt);
  const grip=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.18,8),wood);grip.position.y=-.025;weapon.add(grip);
  const guard=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.045,12),wood);guard.rotation.x=Math.PI/2;shield.add(guard);
  weapon.rotation.z=Math.PI/2;shield.position.set(0,0,.08);
  Object.assign(root.userData,{rig:true,importedMesh:true,nativeAnimations:true,bones,meshyMesh:mesh,skeleton:mesh.skeleton,skeletonHelper,poseRest(){active?.stop();active=null;mesh.skeleton.pose();shroud?.update('rest',0);ground('rest');},ring,aura:ring,weapon,shield,customization:{overallScale:1},modelSource:file,poseNative:pose,animationNames:[...clips.keys()],syncGear(gear){weapon.visible=!!gear?.equipped?.mainHand;shield.visible=!!gear?.equipped?.offhand;wantsShroud=gear?.equipped?.back===SHROUD_ITEM_ID;if(shroud)shroud.mesh.visible=wantsShroud;if(wantsShroud&&!shroudPromise){root.userData.shroudStatus='loading';shroudPromise=attachShroud({body,bodyMesh:mesh,species}).then(result=>{shroud=result;root.userData.shroud=result;result.mesh.visible=wantsShroud;root.userData.shroudStatus='ready';return result;}).catch(error=>{shroudPromise=null;root.userData.shroudStatus='error';console.error('Shroud equipment failed',error);throw error;});root.userData.shroudReady=shroudPromise;shroudPromise.catch(()=>{});}return shroudPromise;}});
  pose('Idle_Sword',0,true);airborneOffset=body.position.y-originalBodyY;
  root.userData.grounding={lowestFeet:()=>lowestFeet(),body,footVertices:groundMeshes.reduce((n,p)=>n+p.indices.length,0)};
  return root;
}
