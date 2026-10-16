import assert from 'node:assert/strict';import * as THREE from 'three';import {createSpeciesPreview,modelSpecies} from '../assets/species-preview.js';
for(const s of ['tree','bull','glass','dart','horned',undefined,'unknown'])assert.equal(modelSpecies(s),'tree');assert.equal(modelSpecies('toad'),'toad');
const scene=new THREE.Scene(),initial=new THREE.Group(),tree=new THREE.Group(),toad=new THREE.Group();scene.add(initial);let finishTree,trees=0;
const ctrl=createSpeciesPreview({scene,initial,onChange(){},loadTree(){trees++;return new Promise(r=>finishTree=r)},loadSwamp:async()=>toad});
const late=ctrl.select('bull');await ctrl.select('toad');finishTree(tree);await late;assert.equal(ctrl.model,toad);for(const id of ['tree','glass','dart','horned',undefined]){await ctrl.select(id);assert.equal(ctrl.model,tree);assert.equal(scene.children.length,1);}assert.equal(trees,1);
await ctrl.select('toad');assert.equal(ctrl.model,toad);
const failScene=new THREE.Scene(),empty=new THREE.Group();failScene.add(empty);const fall=createSpeciesPreview({scene:failScene,initial:empty,onChange(){},loadSwamp:async()=>{throw Error('missing')},loadTree:async()=>tree});await fall.select('toad');assert.equal(fall.model,tree);
console.log('PASS: every unfinished species uses Tree Frog, Swamp Toad stays distinct, async races and load failure use no procedural character.');
