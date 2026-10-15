import data from './item-data.js';
export const STAT_KEYS=['DEF','ATK','BRC','HP','STA','EVA','CRIT'];
export const SLOTS={head:'Head',chest:'Chest',legs:'Legs',hands:'Hands',feet:'Feet',shoulders:'Shoulders',back:'Back',neck:'Neck',ring_1:'Ring I',ring_2:'Ring II',belt:'Belt',mainHand:'Main Hand',offhand:'Offhand',accessory:'Legacy Accessory'};
const ICON={armor:'♜',weapon:'⚔',offhand:'⬟',accessory:'✦',consumable:'◒',material:'❖',junk:'◇',quest:'✧'};
const slotName=s=>s==='main_hand'?'mainHand':s==='off_hand'?'offhand':s;
export const CATALOG=data.items.map(row=>({...row,slot:slotName(row.equip_slot),icon:ICON[row.category]||'◇',stat:STAT_KEYS.filter(k=>row.stats[k]).map(k=>`${row.stats[k]>0?'+':''}${row.stats[k]} ${k}`).join(', ')||'No flat stat bonus'}));
export const ITEM_BY_ID=Object.fromEntries(CATALOG.map(i=>[i.id,i]));
export function occupiedSlots(item,slot=item?.slot){if(!item||!slot)return[];if(['two_hand','dual_wield'].includes(item.slot))return['mainHand','offhand'];return[slot];}
export function equip(data,itemId,registry,level=1,preferredSlot){
 const item=registry[itemId],index=data.inventory.indexOf(itemId);if(!item?.slot||index<0||level<(item.level_required||1))return false;
 let slot=item.slot;if(slot==='ring')slot=preferredSlot==='ring_2'?'ring_2':!data.equipped.ring_1?'ring_1':!data.equipped.ring_2?'ring_2':'ring_1';if(['two_hand','dual_wield'].includes(slot))slot='mainHand';if(!SLOTS[slot])return false;
 const incoming=occupiedSlots(item,slot);data.inventory.splice(index,1);
 for(const [oldSlot,id]of Object.entries(data.equipped)){if(occupiedSlots(registry[id],oldSlot).some(s=>incoming.includes(s))){data.inventory.push(id);delete data.equipped[oldSlot];}}
 data.equipped[slot]=itemId;return true;
}
export function unequip(data,itemId,slot){if(data.equipped[slot]!==itemId)return false;delete data.equipped[slot];data.inventory.push(itemId);return true;}
export function equipmentStats(data,registry){const stats=Object.fromEntries(STAT_KEYS.map(k=>[k,0]));for(const id of Object.values(data?.equipped||{}))for(const k of STAT_KEYS)stats[k]+=Number(registry[id]?.stats?.[k]||0);return stats;}
export function stackRows(ids,registry){const rows=[];for(const id of ids){const item=registry[id];if(!item){rows.push({id,count:1});continue;}const row=item.stackable&&rows.find(r=>r.id===id&&r.count<(item.max_stack||1));if(row)row.count++;else rows.push({id,count:1});}return rows;}
export function rollLoot({level=1,elite=false,rng=Math.random}={}){
 const pools=elite?['elite_enemy','enemy','common_enemy']:['common_enemy','enemy'];const eligible=CATALOG.filter(i=>i.rarity!=='quest'&&i.category!=='quest'&&i.level_required<=level&&i.loot_pools.some(p=>pools.includes(p)));
 const weights={common:60,uncommon:28,rare:10,epic:1.8,legendary:.2};const groups=Object.entries(weights).filter(([rarity])=>eligible.some(i=>i.rarity===rarity));const total=groups.reduce((s,[,w])=>s+w,0);if(!total)return null;let roll=rng()*total;let rarity=groups.at(-1)[0];for(const [r,w]of groups){roll-=w;if(roll<0){rarity=r;break;}}const choices=eligible.filter(i=>i.rarity===rarity);return choices[Math.min(choices.length-1,Math.floor(rng()*choices.length))];
}
export const formatStats=stats=>STAT_KEYS.filter(k=>stats[k]).map(k=>`${k} ${stats[k]>0?'+':''}${stats[k]}`).join(' · ')||'No flat bonuses';
export function itemDescription(item){return `${item.stat||''}${item.level_required?' · Level '+item.level_required:''}${item.effects?.length?' · Planned effects (inactive): '+item.effects.join('; '):''}`;}
