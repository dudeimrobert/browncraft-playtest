import {createSwampFrogRig} from './swamp-frog-rig.js?v=2.6.9';
export const usesSwampFrog = species => species === 'toad';
export const modelSpecies = species => usesSwampFrog(species) ? 'toad' : 'tree';
export const usesImportedFrog = () => true;
export function createSpeciesPreview({scene,initial,onChange,loadSwamp=()=>createSwampFrogRig({preview:true,species:'toad'}),loadTree=()=>createSwampFrogRig({preview:true,species:'tree'})}) {
 let current=initial,requested;const models=new Map(),pending=new Map();
 function install(next){if(next===current)return;next.rotation.y=current.rotation.y;scene.remove(current);current=next;scene.add(current);onChange(current);}
 async function load(kind){if(!pending.has(kind))pending.set(kind,(kind==='toad'?loadSwamp:loadTree)().catch(e=>{pending.delete(kind);throw e;}));return pending.get(kind);}
 return {get model(){return current;},async select(species){
  const kind=modelSpecies(species);requested=kind;
  if(!models.has(kind)){let model;try{model=await load(kind);}catch(e){if(kind!=='toad')throw e;model=await load('tree');}models.set(kind,model);}
  if(requested===kind)install(models.get(kind));return current;
 }};
}
