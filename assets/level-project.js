import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
export const REALM_IDS=['hearth','fords','stillwater','steppe','ember'];
export const emptyProject=()=>({format:'browncraft-level-project',schema:1,baseVersion:'2.5.7',title:'My Browncraft world',notes:'',realms:{},assets:{}});
export function validateProject(p){
 if(!p||p.format!=='browncraft-level-project'||p.schema!==1||p.baseVersion!=='2.5.7'||!p.realms||!p.assets)throw Error('Choose a Browncraft map project for the 2.5.7 baseline.');
 if(Object.keys(p.realms).some(id=>!REALM_IDS.includes(id)))throw Error('Unknown realm in project.');
 for(const a of Object.values(p.assets))if(!a.procedural && !a.instances && (typeof a.data!=='string'||!a.data.startsWith('data:model/gltf-binary;base64,')||a.data.length>140000000))throw Error('Models must be embedded GLB files under 100 MB.');
 for(const a of Object.values(p.assets))if(a.procedural && (!a.object?.object || !a.object?.metadata))throw Error('Invalid procedural model.');
 for(const a of Object.values(p.assets))if(a.instances && (a.source!=='ajolTree'||!Array.isArray(a.matrices)||a.matrices.length>100||a.matrices.some(m=>!Array.isArray(m)||m.length!==16||m.some(n=>!Number.isFinite(n)))))throw Error('Invalid tree assembly.');
 for(const r of Object.values(p.realms)){
  if(!Array.isArray(r.objects)||r.objects.length>5000)throw Error('Invalid object list.');
  for(const o of r.objects){
   if(typeof o.id!=='string'||typeof o.name!=='string')throw Error('Invalid object identifier.');
   if(![o.position,o.rotation,o.scale].every(v=>Array.isArray(v)&&v.length===3&&v.every(x=>Number.isFinite(x)&&Math.abs(x)<10000)))throw Error('Invalid transform.');
   if(o.scale.some(x=>x<=0))throw Error('Object scales must be positive.');
   if(o.color!=null&&!/^#[\da-f]{6}$/i.test(o.color))throw Error('Invalid color.');
   if(o.asset&&!p.assets[o.asset]&&!BUILTINS.includes(o.asset))throw Error('Missing model asset.');
  }
  if(r.collision&&(!Array.isArray(r.collision)||r.collision.some(c=>!Array.isArray(c)||c.length!==3||!Number.isInteger(c[0])||!Number.isInteger(c[1])||typeof c[2]!=='boolean')))throw Error('Invalid collision cells.');
 }
 return p;
}
export const BUILTINS=['ajolTree','willow','mushroom','fountain','rock','ruin'];
const mats=o=>{const out=[];o.traverse(n=>{if(n.isMesh)out.push(...(Array.isArray(n.material)?n.material:[n.material]));});return out;};
function transform(o){return {position:o.position.toArray(),rotation:[o.rotation.x,o.rotation.y,o.rotation.z],scale:o.scale.toArray()};}
function colorObject(root,color){root.traverse(n=>{if(n.isMesh&&n.material){if(!n.userData.editorOwnMaterial){n.material=Array.isArray(n.material)?n.material.map(m=>m.clone()):n.material.clone();n.userData.editorOwnMaterial=true;}for(const m of Array.isArray(n.material)?n.material:[n.material])if(m.color)m.color.set(color);}});}
export function captureLevel(w){
 const companionSet=new Set(w.zoneGroup.children.flatMap(o=>o.userData.editorCompanions||[]));
 const seen=new Map();const unique=id=>{const n=seen.get(id)||0;seen.set(id,n+1);return `${id}:${n}`;};
 const entries=[], actors=new Map((w.enemies||[]).map(e=>[e.obj,e]));let serial=0;
 const treeBatches=w.zoneGroup.children.filter(o=>/^ajol-tree-\d+$/.test(o.name));
 for(const o of w.zoneGroup.children){
  const index=serial++;
  if(treeBatches.includes(o)){if(o!==treeBatches[0])continue;for(let slot=0;slot<o.count;slot++){
   const originals=treeBatches.map(b=>{const m=new THREE.Matrix4();b.getMatrixAt(slot,m);return m;});
   const proxy=new THREE.Object3D();originals[0].decompose(proxy.position,proxy.quaternion,proxy.scale);proxy.rotation.setFromQuaternion(proxy.quaternion);proxy.scale.set(1,1,1);proxy.updateMatrix();
   entries.push({id:`tree:${slot}`,name:`A’jol tree ${slot+1}`,obj:proxy,batches:treeBatches,slot,originals,base:proxy.matrix.clone(),kind:'Tree',protected:false,visible:true});
  }continue;}
  if(companionSet.has(o)||o===w.playerObj||(w.enemies||[]).some(e=>e.telegraph===o)||o===w.shieldVisual||o.isLight||o.isSprite||o.isPoints||['terrain','terrain-ajol-stitched','water','distant-land','distant-rim'].includes(o.name)||o===w.water||o===w.terrain||actors.get(o)?.telegraph===o)continue;
  if(o.isInstancedMesh){for(let slot=0;slot<o.count;slot++){const m=new THREE.Matrix4();o.getMatrixAt(slot,m);const proxy=new THREE.Object3D();m.decompose(proxy.position,proxy.quaternion,proxy.scale);entries.push({id:`instance:${o.name||o.geometry.type}:${slot}`,name:`${o.name||'Instanced scenery'} ${slot+1}`,obj:proxy,batches:[o],slot,originals:[m.clone()],base:m.clone(),kind:'Scenery',visible:true});}continue;}
  const interact=w.interactables?.find(i=>i.obj===o),enemy=actors.get(o);
  const name=interact?(interact.id==='portal'?'Pootal':interact.name.replace(/^the /,'')):enemy?enemy.name:o.name||`Scenery ${index+1}`;
  const hasMesh=mats(o).length>0;if(!hasMesh)continue;
  const id=interact?`landmark:${interact.id}`:enemy?`actor:${enemy.name}`:unique(`scenery:${o.name||o.geometry?.type||'group'}:${o.position.toArray().map(n=>n.toFixed(3)).join(',')}`);
  entries.push({id,name,obj:o,kind:interact?'Landmark':enemy?(enemy.boss?'Guardian':'Enemy'):'Scenery',protected:!!interact||!!enemy,enemy,visible:true});
 }
 for(const entry of entries){entry.obj.updateMatrix();entry.initial=serializeEntry(entry);entry.initialColors=mats(entry.obj).map(m=>m.color?.clone());entry.companions=entry.obj.userData.editorCompanions||[];entry.companionBase=entry.obj.matrix.clone();entry.companionMatrices=entry.companions.map(o=>{o.updateMatrix();return o.matrix.clone();});}
 w.levelEntries=entries;return entries;
}
export function serializeEntry(e){return {id:e.id,name:e.name,...transform(e.obj),color:e.color||null,hidden:e.visible===false,locked:!!e.locked,...(e.asset?{asset:e.asset}:{})};}
export function syncEntry(w,e){
 w._editorNeedsRender=true;
 e.obj.updateMatrix();
 if(e.companions?.length){const delta=e.obj.matrix.clone().multiply(e.companionBase.clone().invert());e.companions.forEach((o,i)=>{const m=delta.clone().multiply(e.companionMatrices[i]);m.decompose(o.position,o.quaternion,o.scale);});}
 if(e.batches){const delta=e.obj.matrix.clone().multiply(e.base.clone().invert());e.batches.forEach((b,i)=>{const m=e.visible===false?new THREE.Matrix4().makeScale(0,0,0):delta.clone().multiply(e.originals[i]);b.setMatrixAt(e.slot,m);b.setColorAt(e.slot,new THREE.Color(e.color||'#ffffff'));b.instanceColor.needsUpdate=true;b.instanceMatrix.needsUpdate=true;b.computeBoundingSphere();});}
 else{e.obj.visible=e.visible!==false;if(e.color)colorObject(e.obj,e.color);else if(e.initialColors)mats(e.obj).forEach((m,i)=>{if(m.color&&e.initialColors[i])m.color.copy(e.initialColors[i]);});}
 if(e.enemy)e.enemy.home.copy(e.obj.position);
 if(e.obj===w.hearthPortal){w.pootalTile=w.tileAt(e.obj.position);}
}
export function setEntry(w,e,data){e.obj.position.fromArray(data.position);e.obj.rotation.set(...data.rotation);e.obj.scale.fromArray(data.scale);e.name=data.name;e.visible=!data.hidden;e.locked=!!data.locked;e.color=data.color||null;syncEntry(w,e);}
export async function createAssetObject(w,asset,project){
 if(BUILTINS.includes(asset)){
  if(asset==='rock')return new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:0x6b6355,roughness:1}));
  if(asset==='ruin')return new THREE.Mesh(new THREE.BoxGeometry(.6,3,.6),new THREE.MeshStandardMaterial({color:0x777164,roughness:1}));
  const model=w.cloneModelAsset(asset,asset==='ajolTree'?6:asset==='willow'?7:asset==='mushroom'?3:5.6);if(!model)throw Error('This built-in model did not load.');return model;
 }
 const a=project.assets[asset];if(!a)throw Error('Model missing from project.');
 if(a.procedural && a.object) return new THREE.ObjectLoader().parse(a.object);
 if(a.instances){const group=new THREE.Group(),pieces=[];w.modelAssets[a.source]?.traverse(o=>{if(o.isMesh)pieces.push(o);});if(pieces.length!==a.matrices.length)throw Error('Tree model does not match this project.');pieces.forEach((piece,i)=>{const materials=(Array.isArray(piece.material)?piece.material:[piece.material]).map(m=>{const c=m.clone();c.color.multiply(new THREE.Color(0xb29b83));return c;});const mesh=new THREE.Mesh(piece.geometry,Array.isArray(piece.material)?materials:materials[0]);new THREE.Matrix4().fromArray(a.matrices[i]).decompose(mesh.position,mesh.quaternion,mesh.scale);mesh.userData.modelAsset=a.source;mesh.receiveShadow=true;group.add(mesh);});return group;}
 const gltf=await new GLTFLoader().loadAsync(a.data);const root=gltf.scene;
 const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3());const factor=4/Math.max(size.y,size.x,size.z,.001);root.scale.setScalar(factor);box.setFromObject(root);root.position.y-=box.min.y;
 const group=new THREE.Group();group.add(root);group.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;}});return group;
}
export async function applyProject(w,p){
 const realm=p.realms[w.zone.id];w.levelCollision=new Map((realm?.collision||[]).map(([x,y,blocked])=>[`${x},${y}`,blocked]));if(!realm)return;
 const map=new Map(w.levelEntries.map(e=>[e.id,e]));
 for(const data of realm.objects){let e=map.get(data.id);if(!e&&data.asset){const obj=await createAssetObject(w,data.asset,p);obj.name=data.name;w.zoneGroup.add(obj);e={id:data.id,name:data.name,obj,asset:data.asset,kind:'Added model',visible:true};w.levelEntries.push(e);}if(e){setEntry(w,e,data);if(!e.initial)e.initial=serializeEntry(e);}}
}
export async function loadProject(){
 try{if(new URLSearchParams(location.search).has('levelPreview')){const raw=sessionStorage.getItem('browncraft-preview-project');if(raw)return validateProject(JSON.parse(raw));}
 const response=await fetch('./assets/level-layout.json');if(response.ok)return validateProject(await response.json());}catch(e){console.warn('Map project could not load',e);}return emptyProject();
}
