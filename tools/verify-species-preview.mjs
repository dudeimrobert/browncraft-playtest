import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSpeciesPreview,usesSwampFrog} from '../assets/species-preview.js';
assert.equal(usesSwampFrog('toad'),true);for(const id of ['tree','bull','glass','dart','horned',undefined])assert.equal(usesSwampFrog(id),false);
const scene=new THREE.Scene(),initial=new THREE.Group(),native=new THREE.Group();scene.add(initial);let resolve;let loads=0,changes=0;
const ctrl=createSpeciesPreview({scene,initial,onChange(){changes++;},loadTree:async()=>new THREE.Group(),loadSwamp(){loads++;return new Promise(r=>resolve=r);}});
const request=ctrl.select('toad');await ctrl.select('bull');resolve(native);await request;assert.equal(ctrl.model,initial,'late load must respect latest selection');
await ctrl.select('toad');assert.equal(ctrl.model,native);await ctrl.select('bull');assert.equal(ctrl.model,initial);await ctrl.select('toad');assert.equal(ctrl.model,native);assert.equal(loads,1);assert.equal(scene.children.length,1);assert.equal(changes,3);
console.log('PASS: Swamp Toad-only routing, asynchronous selection race, cached switching and single visible model.');

const treeScene=new THREE.Scene(),base=new THREE.Group(),treeModel=new THREE.Group(),toadModel=new THREE.Group();treeScene.add(base);let finishTree;
const species=createSpeciesPreview({scene:treeScene,initial:base,onChange(){},loadTree:()=>new Promise(r=>finishTree=r),loadSwamp:async()=>toadModel});
const late=species.select('tree');await species.select('toad');finishTree(treeModel);await late;assert.equal(species.model,toadModel);await species.select('tree');assert.equal(species.model,treeModel);await species.select('glass');assert.equal(species.model,base);assert.equal(treeScene.children.length,1);
console.log('PASS: Tree Frog / Swamp Toad route independently; late Tree load cannot replace Toad.');
