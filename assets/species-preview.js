import {createSwampFrogRig} from './swamp-frog-rig.js?v=2.6.4';
export const usesSwampFrog = species => species === 'toad';
// Each view owns its own skeleton; changing selection during a load cannot
// substitute the wrong species when that asynchronous request finishes.
export function createSpeciesPreview({scene,initial,onChange,loadSwamp=()=>createSwampFrogRig({preview:true})}) {
  let current=initial,swamp,pending,requested='tree';
  function install(next){if(next===current)return;next.rotation.y=current.rotation.y;scene.remove(current);current=next;scene.add(current);onChange(current);}
  return {get model(){return current;},async select(species){
    requested=species;
    if(!usesSwampFrog(species)){install(initial);return current;}
    if(!swamp){pending ||= loadSwamp().catch(e=>{pending=null;throw e;});swamp=await pending;}
    if(usesSwampFrog(requested))install(swamp);
    return current;
  }};
}
