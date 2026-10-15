import {createSwampFrogRig} from './swamp-frog-rig.js?v=2.6.7';
export const usesSwampFrog = species => species === 'toad';
export const usesImportedFrog = species => species === 'toad' || species === 'tree';
export function createSpeciesPreview({scene,initial,onChange,loadSwamp=()=>createSwampFrogRig({preview:true}),loadTree=()=>createSwampFrogRig({preview:true,species:'tree'})}) {
  let current=initial,requested;
  const models=new Map(),pending=new Map();
  function install(next){if(next===current)return;next.rotation.y=current.rotation.y;scene.remove(current);current=next;scene.add(current);onChange(current);}
  return {get model(){return current;},async select(species){
    requested=species;
    if(!usesImportedFrog(species)){install(initial);return current;}
    if(!models.has(species)){
      if(!pending.has(species))pending.set(species,(species==='tree'?loadTree:loadSwamp)().catch(e=>{pending.delete(species);throw e;}));
      models.set(species,await pending.get(species));
    }
    if(requested===species)install(models.get(species));
    return current;
  }};
}
