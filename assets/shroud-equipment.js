import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import supportBySpecies from './shroud-support.js?v=2.6.9';
const sources=new Map();
export const SHROUD_ITEM_ID='BC-ARM-0041';
// One fitted mesh per body. All instances share geometry/textures but own cloth bones.
export async function attachShroud({body,bodyMesh,species}){
 const url='./assets/models/shroud-raccoon-'+species+'.glb';
 if(!sources.has(url))sources.set(url,new GLTFLoader().loadAsync(url).catch(e=>{sources.delete(url);throw e;}));
 const asset=await sources.get(url);let template;asset.scene.traverse(o=>{if(o.isSkinnedMesh)template=o;});
 if(!template)throw new Error('Shroud asset has no skinned mesh');
 const originals=new Map(bodyMesh.skeleton.bones.map(b=>[b.name,b])),mapped=new Map(originals),cloth=[];
 for(const b of template.skeleton.bones){if(!b.name.startsWith('shroud_cape_'))continue;const parent=mapped.get(b.parent.name);if(!parent)throw new Error('Missing shroud parent '+b.parent.name);const copy=new THREE.Bone();copy.name=b.name;copy.position.copy(b.position);copy.quaternion.copy(b.quaternion);copy.scale.copy(b.scale);parent.add(copy);mapped.set(b.name,copy);cloth.push({bone:copy,rest:copy.quaternion.clone(),position:copy.position.clone()});}
 const skeleton=new THREE.Skeleton(template.skeleton.bones.map(b=>{const mappedBone=mapped.get(b.name);if(!mappedBone)throw new Error('Incompatible frog joint '+b.name);return mappedBone;}),template.skeleton.boneInverses.map(m=>m.clone()));
 const materials=(Array.isArray(template.material)?template.material:[template.material]).map(m=>m.clone());
 materials.forEach(m=>{m.side=THREE.DoubleSide;if(m.map)m.map.colorSpace=THREE.SRGBColorSpace;});
 const mesh=new THREE.SkinnedMesh(template.geometry,Array.isArray(template.material)?materials:materials[0]);mesh.name='Shroud_of_the_Raccoon_equipped';mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.visible=false;mesh.userData.itemId=SHROUD_ITEM_ID;
 // Preserve the supplied inverse bind matrices; recomputing them in an idle pose breaks fitting.
 body.add(mesh);mesh.bind(skeleton,template.bindMatrix);mesh.position.copy(template.position);mesh.quaternion.copy(template.quaternion);mesh.scale.copy(template.scale);
 const delta=new THREE.Quaternion(),axis=new THREE.Vector3(1,0,0);
 const point=new THREE.Vector3(),inverse=new THREE.Matrix4(),direction=new THREE.Vector3();
 // Conservative sample of lower cloth for a lightweight floor constraint.
 const support=supportBySpecies[species];
 return {mesh,cloth,skeleton,update(name,time){const moving=/Walk|Run/.test(name),attack=/Sword.*(Attack|Regular)/.test(name);for(let i=0;i<cloth.length;i++){const angle=(moving?.055:attack?.035:.012)*Math.sin(time*(moving?5:2)+i*.55)+i*.012;delta.setFromAxisAngle(axis,angle);cloth[i].bone.quaternion.copy(cloth[i].rest).multiply(delta);cloth[i].bone.position.copy(cloth[i].position);}},ground(root){if(!mesh.visible)return;root.updateMatrixWorld(true);inverse.copy(root.matrixWorld).invert();let min=Infinity;for(const i of support){mesh.getVertexPosition(i,point);point.applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);min=Math.min(min,point.y);}if(min<.025){const lift=.03-min;point.set(0,0,0).applyMatrix4(root.matrixWorld);direction.set(0,lift,0).applyMatrix4(root.matrixWorld).sub(point);inverse.copy(cloth[0].bone.parent.matrixWorld).invert();point.set(0,0,0).applyMatrix4(inverse);direction.applyMatrix4(inverse).sub(point);cloth[0].bone.position.add(direction);root.updateMatrixWorld(true);}}};
}
