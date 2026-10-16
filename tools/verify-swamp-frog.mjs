import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createSwampFrogRig} from '../assets/swamp-frog-rig.js';
import {poseFrogRigWalk,poseFrogRigAttack,poseFrogRigCast,poseFrogRigDeath,resetFrogRigPose} from '../assets/frog-rig.js';
// Parse actual geometry, weights, skeleton and animations. Images are omitted in
// this Node-only structural check; appearance still requires a browser review.
globalThis.self=globalThis;
globalThis.ProgressEvent=class{constructor(type,init){Object.assign(this,{type},init);}};
const tree=process.argv.includes('--tree');
const bytes=fs.readFileSync(new URL('../assets/models/'+(tree?'tree-frog.glb':'swamp-frog.glb'),import.meta.url));
assert.equal(bytes.readUInt32LE(8),bytes.length);
const size=bytes.readUInt32LE(12),data=JSON.parse(bytes.subarray(20,20+size).toString());
const binary=bytes.subarray(28+size);
delete data.images;delete data.textures;delete data.samplers;data.materials=[{}];for(const m of data.meshes)for(const p of m.primitives)p.material=0;
data.buffers[0].uri='data:application/octet-stream;base64,'+binary.toString('base64');
const loader=new GLTFLoader();const asset=await loader.parseAsync(JSON.stringify(data),'');
GLTFLoader.prototype.loadAsync=async()=>asset;
const a=await createSwampFrogRig({species:tree?'tree':'toad'}),b=await createSwampFrogRig({species:tree?'tree':'toad'});
assert.equal(a.userData.animationNames.length,tree?17:27);assert.notEqual(a.userData.bones.hand_r,b.userData.bones.hand_r);
const origin=a.position.clone(),v=new THREE.Vector3();
for(const name of a.userData.animationNames)for(const t of [0,.25,.5,.75,1]){
 a.userData.poseNative(name,t);const mesh=a.userData.meshyMesh;
 for(let i=0;i<mesh.geometry.attributes.position.count;i+=97){mesh.getVertexPosition(i,v);assert.ok(v.toArray().every(Number.isFinite),name+' finite skin');assert.ok(v.length()<10,name+' no exploding skin');}
 assert.deepEqual(a.position.toArray(),origin.toArray());
}
for(const fn of [poseFrogRigWalk,poseFrogRigCast,poseFrogRigDeath]){resetFrogRigPose(a);fn(a,.5);}poseFrogRigAttack(a,'heavy',.4);
a.userData.syncGear({equipped:{mainHand:'rusty_sword',offhand:'wooden_guard'}});assert.ok(a.userData.weapon.visible&&a.userData.shield.visible);
a.userData.syncGear({equipped:{}});assert.ok(!a.userData.weapon.visible&&!a.userData.shield.visible);
assert.equal(a.userData.weapon.parent,a.userData.bones.hand_r);assert.equal(a.userData.shield.parent,a.userData.bones.hand_l);
console.log('PASS: actual Swamp Frog skin, 27 clips sampled, independent cloned skeletons, in-place root, pose adapters, equipment sockets and unequip visibility.');

for(const name of ['Idle_Sword','Walk','Run_Anime','Sword_Attack_RM','Spell_Simple_Idle'])for(const time of [0,.2,.4,.6,.8,1]){
 a.scale.set(1.3,1.15,.9);a.position.set(3,2,5);a.rotation.y=.7;a.userData.poseNative(name,time);
 const y=a.userData.grounding.lowestFeet();assert.ok(Math.abs(y)<1e-5,`${name}: foot height ${y}`);
}
if(!tree){a.userData.poseNative('Idle_Sword',.3);assert.equal(a.userData.activeClip,'Idle_Sword','native stance must retain priority');}
console.log('PASS: feet contact root ground plane across idle, walk, run, attack, and cast with transformed roots.');
// Independent full-skin check and optional geometry snapshot for visual review.
a.scale.set(1,1,1);a.position.set(0,0,0);a.rotation.set(0,0,0);
for(const name of ['Idle_Sword','Walk','Run_Anime'])for(const time of [0,.25,.5,.75]){a.userData.poseNative(name,time);const mesh=a.userData.meshyMesh;let lowest=Infinity;for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,v);v.applyMatrix4(mesh.matrixWorld);lowest=Math.min(lowest,v.y);}assert.ok(lowest>-.005&&lowest<.005,`${name}: full skin minimum ${lowest}`);}
if(process.argv.includes('--snapshot')){a.userData.poseNative('Idle_Sword',.25);const mesh=a.userData.meshyMesh,vertices=[];for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,v);v.applyMatrix4(mesh.matrixWorld);vertices.push(v.toArray());}fs.writeFileSync(new URL(`../../${tree?'tree':'toad'}-ground.json`,import.meta.url),JSON.stringify({vertices,indices:Array.from(mesh.geometry.index.array)}));}
console.log('PASS: complete animated body touches the ground without penetrating, independently of the foot selector.');
