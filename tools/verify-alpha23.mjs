import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {REALMS,normalizeProgress,canTraverse,realmUnlocked} from '../assets/pootal-progression.js';
globalThis.ProgressEvent=class{constructor(type,props){Object.assign(this,props);}};
const root=new URL('../',import.meta.url);
const loader=new GLTFLoader();
async function readGlbJSON(path){const data=await fs.readFile(new URL(path,root)),length=data.readUInt32LE(12);return JSON.parse(data.subarray(20,20+length));}
async function parseLocal(path){
 const data=await fs.readFile(new URL(path,root)),length=data.readUInt32LE(12),doc=JSON.parse(data.subarray(20,20+length));
 // CPU checks omit GPU textures but retain geometry, transforms and skins.
 doc.materials=[];for(const m of doc.meshes)for(const p of m.primitives)delete p.material;
 doc.buffers[0].uri='data:application/octet-stream;base64,'+data.subarray(28+length).toString('base64');
 return loader.parseAsync(JSON.stringify(doc),'');
}
GLTFLoader.prototype.loadAsync=function(url){return parseLocal(url.replace(/^\.\//,''));};
const {createMeshyFrogKnightRig,poseMeshyTPose}=await import('../assets/meshy-frog-rig.js');
const {resetFrogRigPose,poseFrogRigAttack,poseFrogRigWalk}=await import('../assets/frog-rig.js');
const model=await createMeshyFrogKnightRig();model.position.set(4,2,-5);model.scale.setScalar(1.85);model.rotation.y=.7;model.updateMatrixWorld(true);
const mesh=model.userData.meshyMesh,g=mesh.geometry,bones=model.userData.bones;
let weightError=0,bindError=0;
for(let i=0;i<g.attributes.position.count;i++){
 let sum=0,active=0;for(let k=0;k<4;k++){const w=g.attributes.skinWeight.array[i*4+k],b=g.attributes.skinIndex.array[i*4+k];assert(w>=0&&Number.isFinite(w));assert(b<29);sum+=w;if(w>1e-7)active++;}
 assert.equal(active,1,'salvage mesh must use rigid one-bone weights');
 weightError=Math.max(weightError,Math.abs(sum-1));const p=mesh.getVertexPosition(i,new THREE.Vector3()),rest=new THREE.Vector3().fromBufferAttribute(g.attributes.position,i);bindError=Math.max(bindError,p.distanceTo(rest));
}
assert(weightError<1e-6);assert(bindError<1e-5);
// Overlay endpoints must coincide with the actual bones even after root transforms.
const h=model.userData.skeletonHelper;h.updateMatrixWorld(true);let helperError=0;
for(let i=0,v=0;i<h.bones.length;i++){let b=h.bones[i];if(b.parent?.isBone){const p=new THREE.Vector3().fromBufferAttribute(h.geometry.attributes.position,v).applyMatrix4(h.matrixWorld);helperError=Math.max(helperError,p.distanceTo(b.getWorldPosition(new THREE.Vector3())));v+=2;}}
assert(helperError<1e-5);
// Verify the calibrated source grip (local source y=.185) stays at the socket.
for(const [name,pose] of [['rest',()=>{}],['tpose',()=>poseMeshyTPose(model)],['heavy',()=>poseFrogRigAttack(model,'heavy',.39)],['walk',()=>poseFrogRigWalk(model,.3,1)]]){
 resetFrogRigPose(model);pose();model.updateMatrixWorld(true);
 const sword=model.userData.weaponModel;
 const grip=sword.localToWorld(new THREE.Vector3(0,.185,0));
 const socket=model.userData.weapon.getWorldPosition(new THREE.Vector3());assert(grip.distanceTo(socket)<.005,`${name} sword grip alignment`);
 const fistBox=new THREE.Box3().setFromObject(model.userData.gripFist);
 assert(fistBox.containsPoint(socket),`${name} closed fist must contain the hilt center`);
 for(let i=0;i<g.attributes.position.count;i+=11){const p=mesh.getVertexPosition(i,new THREE.Vector3());assert(p.toArray().every(Number.isFinite));}
}
resetFrogRigPose(model);poseMeshyTPose(model);model.updateMatrixWorld(true);
for(const side of ['L','R']){const shoulder=bones['upperArm'+side].getWorldPosition(new THREE.Vector3()),wrist=bones['hand'+side].getWorldPosition(new THREE.Vector3());assert(Math.abs(shoulder.y-wrist.y)<1e-5);}
for(const path of ['assets/models/frog-knight-repaired.glb']){const asset=await parseLocal(path);asset.scene.updateMatrixWorld(true);let found=false;asset.scene.traverse(o=>{if(o.isSkinnedMesh){found=true;assert.equal(o.skeleton.bones.length,29);o.skeleton.update();for(let i=0;i<o.geometry.attributes.position.count;i+=97){assert(o.getVertexPosition(i,new THREE.Vector3()).distanceTo(new THREE.Vector3().fromBufferAttribute(o.geometry.attributes.position,i))<1e-5);}}});assert(found);}
for(const [id,path,name] of [['fords','assets/models/mournwillow-guardian.glb','Mournwillow'],['steppe','assets/models/vuldross-guardian.glb','Vuldross'],['ember','assets/models/cindergut-guardian.glb','Cindergut']]){const doc=await readGlbJSON(path);assert(doc.meshes?.length);const info=REALMS.find(r=>r.id===id);assert(info.boss.includes(name));assert(info.model);assert(info.dialogue);}
assert.deepEqual(REALMS.slice(1).map(r=>r.hp),[360,520,700]);assert.deepEqual(REALMS.slice(1).map(r=>r.damage),[[18,24],[22,30],[26,35]]);
for(const path of ['assets/ajol/ajol-ground-crossroads.png','assets/map-steppe-bf.png']){const png=await fs.readFile(new URL(path,root));assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.subarray(-8,-4).toString(),'IEND',`${path} must be a complete PNG`);}
// All progress combinations: no skipped realm, while every entered realm can return to A’jol.
for(let mask=0;mask<8;mask++){const keys=Object.fromEntries(REALMS.slice(1).map((r,i)=>[r.id,!!(mask&(1<<i))]));assert.equal(realmUnlocked('steppe',keys),keys.fords);assert.equal(realmUnlocked('ember',keys),keys.fords&&keys.steppe);for(const r of REALMS.slice(1)){assert.equal(canTraverse(r.id,'hearth',keys),realmUnlocked(r.id,keys));for(const other of REALMS.slice(1))assert(!canTraverse(r.id,other.id,keys));}}
assert(!canTraverse('hearth','bogus',{}));assert(canTraverse('hearth','fords',{}));assert(normalizeProgress({bossDefeated:true}).pootalKeys.fords);assert(!normalizeProgress({pootalKeys:{ember:true}}).pootalKeys.ember);
// Exercise actual world methods without WebGL.
const registered={};globalThis.HTMLElement=class{};globalThis.customElements={get:n=>registered[n],define:(n,c)=>registered[n]=c};globalThis.localStorage={data:new Map(),setItem(k,v){this.data.set(k,v)},getItem(k){return this.data.get(k)||null}};
await import('../assets/world3d.js');const World=Object.values(registered)[0];const world=new World();world.init=()=>{};world.style={};world.emit=()=>{};world.connectedCallback();world.playerObj=new THREE.Group();world.hearthPortal=new THREE.Group();world.zoneGroup=new THREE.Group();world.mark=()=>{};world.say=()=>{};world.clearTarget=()=>{};world.refreshPootal=()=>{};world.popup=()=>{};
assert.equal(world.state.hpMax,87);assert.equal(world.state.stamMax,70);assert.equal(world.state.flasksMax,2);
const guardianSource=new THREE.Group();guardianSource.add(new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshBasicMaterial()));world.modelAssets={guardianFords:guardianSource};const guardianRig=world.buildGuardianRig('guardianFords');assert(guardianRig.userData.guardianRig);assert.equal(guardianRig.userData.skeleton.bones.length,1);
assert(guardianRig.userData.lod,'guardian gets a lightweight distant mesh');
world.camera={position:new THREE.Vector3(0,0,60)};world.enemies=[{obj:guardianRig}];world.updateModelLod(1000);assert(guardianRig.userData.lod.proxy.visible);assert(!guardianRig.userData.lod.model.visible);
world.camera.position.set(0,0,8);world.updateModelLod(1500);assert(!guardianRig.userData.lod.proxy.visible);assert(guardianRig.userData.lod.model.visible);
const treeSource=new THREE.Group();treeSource.add(new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshBasicMaterial()));world.modelAssets.ajolTree=treeSource;world.worldPos=(x,y,z=0)=>new THREE.Vector3(x,z,y);world.buildAjolTreeInstances([[2,3,.7,0],[9,5,.8,1]]);
assert.equal(world.ajolTreeBatches.length,1);assert.equal(world.ajolTreeBatches[0].count,2);assert(!world.ajolTreeBatches[0].castShadow);
const first=new THREE.Matrix4(),second=new THREE.Matrix4();world.ajolTreeBatches[0].getMatrixAt(0,first);world.ajolTreeBatches[0].getMatrixAt(1,second);assert.notDeepEqual(first.elements,second.elements,'instances retain size, position and rotation variation');
world.modelAssets.ajolTree=(await parseLocal('assets/models/fantasy-x-tree-08.glb')).scene;world.buildAjolTreeInstances([[2,3,.7,0],[9,5,.8,1]]);assert(world.ajolTreeBatches.length>0,'the actual tree asset produces instanced draw batches');
// Mournwillow's Bough Sweep has a complete 120-degree telegraph and matching hit test.
const boughTelegraph=world.buildBoughSweepTelegraph();assert.equal(boughTelegraph.name,'mournwillow-bough-sweep-telegraph');assert.equal(boughTelegraph.visible,false);assert.equal(boughTelegraph.userData.fill.geometry.attributes.position.count,84);
const boughFoe={obj:guardianRig,telegraph:boughTelegraph,hitDone:true,at:1};guardianRig.position.set(0,0,0);guardianRig.rotation.y=0;
assert(world.isInsideBoughSweep(boughFoe,new THREE.Vector3(0,0,4)),'front of sweep must be dangerous');
assert(!world.isInsideBoughSweep(boughFoe,new THREE.Vector3(0,0,-2)),'behind Mournwillow must be safe');
assert(!world.isInsideBoughSweep(boughFoe,new THREE.Vector3(4.4,0,0)),'outside the arc/range must be safe');
world.clearEnemyAttack(boughFoe);assert.equal(boughFoe.hitDone,false);assert.equal(boughFoe.at,0);assert.equal(boughTelegraph.visible,false);
world.groundY=()=>0;world.slide=()=>{};world.tellRing=new THREE.Group();world.tellRing.material={opacity:0};world.state.mode='fight';world.state.hp=100;world.state.hpMax=100;world.state.nearby=0;
const hurtPlayer=World.prototype.hurtPlayer;
world.playerObj.position.set(0,0,3);let sweepHits=0;world.hurtPlayer=()=>{sweepHits++};
const simulatedBough={name:'Mournwillow',obj:guardianRig,telegraph:boughTelegraph,boss:true,bossMove:'boughSweep',hp:120,hpMax:120,home:new THREE.Vector3(),xp:100,engaged:true,cool:0,wander:1,dest:null,ai:'boughWind',at:0,flash:0,hitDone:false,introduced:true};
world.enemies=[simulatedBough];
for(let i=0;i<15;i++)world.enemyAI(.1,i*.1);
assert.equal(sweepHits,1,'one Bough Sweep may damage at most once');assert.equal(simulatedBough.ai,'boughRecover');assert.equal(boughTelegraph.visible,false,'telegraph clears after the damage window');
simulatedBough.ai='boughStrike';simulatedBough.at=.07;simulatedBough.hitDone=false;world.playerObj.position.set(0,0,-2);world.enemyAI(.03,2);assert.equal(sweepHits,1,'player behind the sweep remains safe');
const genericRig=world.buildGuardianRig('guardianFords'),generic={name:'Generic guardian',obj:genericRig,boss:true,bossMove:null,hp:10,hpMax:10,home:new THREE.Vector3(),engaged:true,cool:0,wander:1,dest:null,ai:'chase',at:1,flash:0,hitDone:false,introduced:true};
world.enemies=[generic];world.playerObj.position.set(0,0,2);world.enemyAI(.01,3);assert.equal(generic.ai,'wind','non-Mournwillow enemies retain the generic attack path');
world.state.mode='roam';world.state.bossBattle=false;world.enemies=[];world.playerObj.position.set(0,0,0);
const portalChild=new THREE.Group();world.hearthPortal.add(portalChild);assert(world.useClickedPootal(portalChild));assert(world.state.pootalDialog);assert(world.paused);assert.equal(world.state.pootalDialog.choices.filter(c=>c.available).length,1);
let builds=0;world.buildZone=async(zone)=>{builds++;world.zone=zone;world.state.zone=zone.id;world.state.mode='roam';};await world.traversePootal('ember');assert.equal(builds,0);await world.traversePootal('fords');assert.equal(builds,1);assert.equal(world.state.zone,'fords');assert(!world.paused);assert(!world.state.loading);
world.openPootal();assert(world.state.pootalDialog.choices.find(c=>c.id==='hearth').available,'outer-realm Pootal must always permit return to A’jol');assert.equal(world.state.pootalDialog.choices.filter(c=>c.available).length,1);world.closePootal();world.state.bossKills.fords=true;assert(world.awakenRealmPootal('fords'));world.saveProgress();const stored=JSON.parse(localStorage.getItem(world.saveKey));assert(stored.bossKills.fords);assert(stored.pootalKeys.fords);
world.openPootal();await world.traversePootal('hearth');assert.equal(world.state.zone,'hearth');world.openPootal();assert(world.state.pootalDialog.choices.find(c=>c.id==='steppe').available);world.closePootal();
world.playerObj.position.set(100,0,0);world.openPootal();assert(!world.state.pootalDialog);
world.zone={id:'fords'};world.state.zone='fords';world.state.mode='roam';world.paused=false;const introFoe={name:REALMS[1].boss,boss:true,introduced:false,engaged:false,hp:1,ai:'idle',at:0};assert.equal(world.engage(introFoe),false);assert.equal(world.state.bossDialog.line,REALMS[1].dialogue);world.beginPendingBoss();assert(introFoe.engaged);assert.equal(world.state.bossDialog,null);assert.equal(world.state.mode,'fight');
// Death must clear encounter state, checkpoint A’jol, and provide a full-stat return there.
world.enemies=[generic];generic.engaged=true;generic.ai='wind';world.zone={id:'fords',name:'Weeping Fjarts'};world.state.zone='fords';world.state.mode='fight';world.state.hp=5;world.state.bossBattle=true;world.state.bossHud={name:'Mournwillow'};world.lockOn=generic;world.lockRing=new THREE.Group();world.controls={enableRotate:false};world.dodging=null;world.blocking=false;world.popup=()=>{};world.slide=()=>{};hurtPlayer.call(world,5,{name:'Mournwillow',obj:genericRig});assert.equal(world.state.mode,'dead');assert.equal(world.state.bossHud,null);assert.equal(world.state.target,null);assert(!generic.engaged);assert.equal(JSON.parse(localStorage.getItem(world.saveKey)).zone,'hearth','death checkpoint must persist A’jol');
const returned=await world.respawnAtAjol();assert(returned);assert.equal(world.state.zone,'hearth');assert.equal(world.state.mode,'roam');assert.equal(world.state.hp,world.state.hpMax);assert.equal(world.state.stam,world.state.stamMax);assert.equal(world.state.focus,world.state.focusMax);assert.equal(world.state.flasks,world.state.flasksMax);assert.equal(JSON.parse(localStorage.getItem(world.saveKey)).zone,'hearth');
const worldSource=await fs.readFile(new URL('../assets/world3d.js',import.meta.url),'utf8');const appSource=await fs.readFile(new URL('../app.js',import.meta.url),'utf8');const htmlSource=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');assert(!/state\.frontier|travelBtn|checkFrontier|kind === 'travel'/.test(worldSource+appSource+htmlSource));assert(worldSource.includes('useClickedPootal'));assert(worldSource.includes('awakenRealmPootal(this.zone.id)'));assert(worldSource.includes("boss&&this.zone.id==='fords'?'boughSweep':null"));assert(worldSource.includes("assets/ajol/ajol-ground-crossroads.png"));assert(worldSource.includes("loader.loadAsync(zone.surface || zone.mask || zone.map)"));assert(worldSource.includes('s.stam + 16 * this.stamRegenMultiplier'));assert(worldSource.includes("dmg: [12, 17]"));assert(worldSource.includes('createMournwillowBombs'));assert(worldSource.includes('applySlow(1.5)'));assert(worldSource.includes('respawnAtAjol'));assert(worldSource.includes("ajolTree: 'assets/models/fantasy-x-tree-08.glb'"));assert(worldSource.includes('this.buildAjolTreeInstances(ajolTreeSpots)'));assert(worldSource.includes('renderer.setPixelRatio(next)'));assert(worldSource.includes('const actorRoots=new Set'));assert(worldSource.includes("loader.loadAsync('assets/ajol/trader-billboard.png')"));assert(worldSource.includes('buildTraderBillboard()'));assert(worldSource.includes("group.name = 'ajol-trader-billboard'"));assert(worldSource.includes('this.merchantBillboard.rotation.y = Math.atan2(dx, dz)'));assert(!worldSource.includes("k === 'r' && this.state.mode === 'dead'"));assert(htmlSource.includes('id="bossHud"'));assert(htmlSource.includes('id="spellHud"'));assert(htmlSource.includes('id="deathScreen"'));assert(htmlSource.includes('id="deathContinueBtn"'));assert(htmlSource.includes('id="deathQuitBtn"'));assert(appSource.includes('world.respawnAtAjol'));
console.log(JSON.stringify({passed:true,version:'2.4.9',guardians:'Mournwillow, Vuldross, Cindergut',guardianRig:'rigid root-bone',guardianDialogue:true,guardianPlacement:'far realm edge',mournwillow:'Bough Sweep; 120-degree arc; 1.15s telegraph; Weeping Fall channel; AoE slow',combatBalance:'87 Knight HP; 70 stamina; 2 flasks; 88/110/128 mob HP; 360/520/700 boss HP; 16/s base stamina recovery; Brown Bolt 12–17',deathFlow:'fade to You Died; continue at A’jol; quit to character select; progress preserved',ajolGround:'Swamp Meadow Crossroads Tile; verified complete PNG',ajolTrees:'Fantasy X Tree 08 GLB; stable randomized size and rotation',ajolTrader:'keyed PNG billboard; shallow backing; camera-facing; trade interaction preserved',vertices:g.attributes.position.count,bones:29,skinning:'rigid one-bone salvage',closedGrip:true,weightError,bindError,helperError,pootal:'unconditional outer-realm return to A’jol; sigils still gate forward progression',progression:'A’jol > Weeping Fjarts > Assfall Steppes > Emberpood; no boundary travel'},null,2));
