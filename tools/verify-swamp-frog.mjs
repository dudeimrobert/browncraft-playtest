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
const bytes=fs.readFileSync(new URL('../assets/models/swamp-frog.glb',import.meta.url));
assert.equal(bytes.readUInt32LE(8),bytes.length);
const size=bytes.readUInt32LE(12),data=JSON.parse(bytes.subarray(20,20+size).toString());
const binary=bytes.subarray(28+size);
delete data.images;delete data.textures;delete data.samplers;data.materials=[{}];for(const m of data.meshes)for(const p of m.primitives)p.material=0;
data.buffers[0].uri='data:application/octet-stream;base64,'+binary.toString('base64');
const loader=new GLTFLoader();const asset=await loader.parseAsync(JSON.stringify(data),'');
GLTFLoader.prototype.loadAsync=async()=>asset;
const a=await createSwampFrogRig(),b=await createSwampFrogRig();
assert.equal(a.userData.animationNames.length,10);assert.notEqual(a.userData.bones.hand_r,b.userData.bones.hand_r);
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
console.log('PASS: actual Swamp Frog skin, 10 clips sampled, independent cloned skeletons, in-place root, pose adapters, equipment sockets and unequip visibility.');
