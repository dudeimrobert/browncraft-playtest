export const REALMS = [
  {id:'hearth',name:"A’jol",icon:'portal',subtitle:'Where all life began'},
  {id:'fords',name:'Weeping Fjarts',icon:'willow',boss:'Mournwillow, the Weeping Warden',model:'guardianFords',hp:360,damage:[18,24],key:'Fragment of Return',subtitle:'The drowned woodland',dialogue:'Turn back. You are not yet ready to be returned.'},
  {id:'steppe',name:'Assfall Steppes',icon:'terraces',boss:'Vuldross the Burdened',model:'guardianSteppe',hp:520,damage:[22,30],key:'Fragment of Pressure',subtitle:'The steaming terraces',dialogue:'Leave now. The pressure beneath you has already begun to rise.'},
  {id:'ember',name:'Emberpood',icon:'mushroom',boss:'Cindergut, Keeper of the Last Flame',model:'guardianEmber',hp:700,damage:[26,35],key:'Fragment of Release',subtitle:'The burning fungal wilds',dialogue:'Too late. Turn back while there is still a world behind you.'}
];
export const realmInfo=id=>REALMS.find(r=>r.id===id);
export function normalizeProgress(data={}){
 const bossKills={},pootalKeys={};
 for(const r of REALMS.slice(1)){bossKills[r.id]=data.bossKills?.[r.id]===true;pootalKeys[r.id]=bossKills[r.id]&&data.pootalKeys?.[r.id]===true;}
 // Migrate the earlier single-boss save format without losing earned progress.
 if(!data.bossKills && data.bossDefeated){bossKills.fords=true;pootalKeys.fords=true;}
 return {bossKills,pootalKeys};
}
export function realmUnlocked(id,keys={}){const i=REALMS.findIndex(r=>r.id===id);return i>=0&&(i<2||REALMS.slice(1,i).every(r=>keys[r.id]===true));}
export function canTraverse(from,to,keys={}){
 return from!==to&&realmUnlocked(from,keys)&&realmUnlocked(to,keys)&&(from==='hearth'||to==='hearth');
}
export function realmChoices(from,keys={}){return REALMS.map(r=>({...r,available:canTraverse(from,r.id,keys),reason:r.id===from?'You are here':!realmUnlocked(r.id,keys)?`Requires ${REALMS[REALMS.indexOf(r)-1].key}`:from!=='hearth'&&r.id!=='hearth'?'Travel through A’jol':r.id==='hearth'?'Return waypoint ready':'Waypoint ready'}));}
