import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createSwampFrogRig} from '../assets/swamp-frog-rig.js';
globalThis.self=globalThis;globalThis.ProgressEvent=class{constructor(t,i){Object.assign(this,i)}};
const loader=new GLTFLoader(),cache=new Map();
for(const file of ['tree-frog.glb','swamp-frog.glb','shroud-raccoon-tree.glb','shroud-raccoon-toad.glb']){
 const bytes=fs.readFileSync(new URL('../assets/models/'+file,import.meta.url)),size=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+size)),binary=bytes.subarray(28+size);delete j.images;delete j.textures;delete j.samplers;j.materials=[{}];for(const m of j.meshes)for(const p of m.primitives)p.material=0;j.buffers[0].uri='data:application/octet-stream;base64,'+binary.toString('base64');cache.set(file,await loader.parseAsync(JSON.stringify(j),''));
}
GLTFLoader.prototype.loadAsync=async url=>{const file=url.split('/').at(-1);assert(cache.has(file),file);return cache.get(file)};
for(const species of ['tree','toad']){
 const rig=await createSwampFrogRig({species}),other=await createSwampFrogRig({species});const gear={equipped:{back:'BC-ARM-0041'}};
 await rig.userData.syncGear(gear);await other.userData.syncGear(gear);const sh=rig.userData.shroud,mesh=sh.mesh;assert(mesh.visible);assert.equal(mesh.userData.itemId,'BC-ARM-0041');assert.notEqual(sh.cloth[0].bone,other.userData.shroud.cloth[0].bone);assert.equal(sh.skeleton.bones.find(b=>b.name==='head'),rig.userData.bones.head);
 const weights=mesh.geometry.attributes.skinWeight;for(let i=0;i<weights.count;i++){let sum=0;for(let k=0;k<4;k++)sum+=weights.getComponent(i,k);assert(Math.abs(sum-1)<1e-5)}
 const snapshots=[];const v=new THREE.Vector3();
 for(const name of ['Idle_Sword','Walk','Run_Anime','Sword_Attack_RM','Spell_Simple_Idle','Death_D'])for(const t of [0,.25,.5,.75]){
  rig.userData.poseNative(name,t);rig.updateMatrixWorld(true);let min=Infinity,max=-Infinity,minIndex=0;
  for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,v);assert(v.toArray().every(Number.isFinite));assert(v.length()<6,`${species} ${name} unstable vertex`);v.applyMatrix4(mesh.matrixWorld);if(v.y<min){min=v.y;minIndex=i;}max=Math.max(max,v.y)}
  if(min<-.03&&!/Death/.test(name))console.log('LOW',species,name,t,minIndex,min,Array.from({length:4},(_,k)=>[mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getComponent(minIndex,k)].name,mesh.geometry.attributes.skinWeight.getComponent(minIndex,k)]));if(!/Death/.test(name))assert(min>-.03,`${species} ${name} hem below ground ${min}`);
  if(['Idle_Sword','Walk','Sword_Attack_RM'].includes(name)&&t===.25){const sample=m=>{const verts=[];for(let i=0;i<m.geometry.attributes.position.count;i+=3){m.getVertexPosition(i,v);v.applyMatrix4(m.matrixWorld);verts.push(v.toArray())}return verts};snapshots.push({name,body:sample(rig.userData.meshyMesh),armor:sample(mesh)});}
 }
 rig.userData.syncGear({equipped:{}});assert(!mesh.visible);rig.userData.syncGear(gear);assert(mesh.visible);rig.userData.syncGear({equipped:{back:'BC-ARM-0042'}});assert(!mesh.visible);
 const race=await createSwampFrogRig({species});const ready=race.userData.syncGear(gear);race.userData.syncGear({equipped:{}});await ready;assert(!race.userData.shroud.mesh.visible);
 fs.writeFileSync(new URL('../../'+species+'-armor-snapshots.json',import.meta.url),JSON.stringify(snapshots));
 console.log('PASS',species,': normalized weights, actual animations, planted hem, independent cloth, shared body bones, equip/unequip, other back item and async race');
}
