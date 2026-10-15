import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSpeciesPreview,usesSwampFrog} from '../assets/species-preview.js';
assert.equal(usesSwampFrog('toad'),true);for(const id of ['tree','bull','glass','dart','horned',undefined])assert.equal(usesSwampFrog(id),false);
const scene=new THREE.Scene(),initial=new THREE.Group(),native=new THREE.Group();scene.add(initial);let resolve;let loads=0,changes=0;
const ctrl=createSpeciesPreview({scene,initial,onChange(){changes++;},loadSwamp(){loads++;return new Promise(r=>resolve=r);}});
const request=ctrl.select('toad');await ctrl.select('tree');resolve(native);await request;assert.equal(ctrl.model,initial,'late load must respect latest selection');
await ctrl.select('toad');assert.equal(ctrl.model,native);await ctrl.select('bull');assert.equal(ctrl.model,initial);await ctrl.select('toad');assert.equal(ctrl.model,native);assert.equal(loads,1);assert.equal(scene.children.length,1);assert.equal(changes,3);
console.log('PASS: Swamp Toad-only routing, asynchronous selection race, cached switching and single visible model.');
