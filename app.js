import {CATALOG,ITEM_BY_ID,SLOTS,equip as equipItem,unequip as unequipItem,equipmentStats,stackRows,rollLoot,formatStats,itemDescription,occupiedSlots} from './assets/items.js?v=2.6.7';
import { createSpeciesPreview } from './assets/species-preview.js?v=2.6.7';
import { createSwampFrogRig } from './assets/swamp-frog-rig.js?v=2.6.7';
import * as THREE from 'three';
import { createFrogKnightRig, poseFrogRigIdle, poseFrogRigAttack, resetFrogRigPose, updateFrogRigSecondary } from './assets/frog-rig.js?v=2.6.7';
import { createMeshyFrogKnightRig } from './assets/meshy-frog-rig.js?v=2.6.7';

const q = s => document.querySelector(s);
const entry = q('#entry');
const characterSelect = q('#characterSelect');
const game = q('#game');
const worldMount = q('#worldMount');
const menu = q('#menu');
const panel = q('#menuPanel');
const bag=q('#bag'), bagGrid=q('#bagGrid'), bagTooltip=q('#bagTooltip');
let bagSignature='';
function carriedItems(s){
  const profile=selectedProfile(),gear=getGear(profile);
  const items=[...getCollectedLoot().map(row=>({...row,type:'Loot material',details:row.description||'Recovered from a corpse.',flavor:'Scavenged from the realms.'})),{icon:'◒',name:'Brown Flask',type:'Consumable',details:`${s.flasks} / ${s.flasksMax} charges`,flavor:'A little courage for the road.'}];
  for(const {id,count} of stackRows(gear?.inventory||[],GEAR)){const item=GEAR[id];if(item)items.push({id,...item,count,type:item.rarity?`${item.rarity} · ${item.category}`:'Unequipped gear',details:itemDescription(item),flavor:item.slot?'Click to equip.':'Carried item · scripted effects inactive'});else items.push({id:null,name:id,icon:'◇',count,type:'Saved item',details:'Unrecognized saved item retained.',flavor:''});}
  for(const [id,name,flavor] of [['fords','Fragment of Return','The first thread of the greater mystery.'],['steppe','Fragment of Pressure','A weight held inside the Brown.'],['ember','Fragment of Release','A spark awaiting its purpose.']])if(s.pootalKeys?.[id])items.push({icon:'✦',name,type:'Quest item',details:'Recovered',flavor});
  return items;
}
function hideBagTooltip(){bagTooltip.hidden=true;}
function positionBagTooltip(e){const x=Math.min(e.clientX+18,innerWidth-bagTooltip.offsetWidth-12),y=Math.min(e.clientY+18,innerHeight-bagTooltip.offsetHeight-12);bagTooltip.style.left=Math.max(8,x)+'px';bagTooltip.style.top=Math.max(8,y)+'px';}
const SLOT_ICON={shoulders:'♜',back:'▥',neck:'✦',ring_1:'◌',ring_2:'◌',belt:'═',head:'♜',chest:'▥',legs:'▤',hands:'✥',feet:'♧',accessory:'✦',mainHand:'⚔',offhand:'⬟'};
let equipmentViewer=null;
function createEquipmentViewer(){
  if(equipmentViewer)return equipmentViewer;
  const host=q('#equipmentCharacterViewer');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.1,50);
  camera.position.set(0,1.8,7.6);camera.lookAt(0,1.25,0);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.setClearColor(0x000000,0);host.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xb6c5a4,0x1b1a14,1.5));const lamp=new THREE.DirectionalLight(0xffd7a3,2.5);lamp.position.set(-3,6,5);scene.add(lamp);
  let model=buildPreviewFrog();scene.add(model);
  let viewerProfile;
  const speciesViewer=createSpeciesPreview({scene,initial:model,onChange(m){model=m;equipmentViewer?.sync(viewerProfile);}});
  let drag=false,last=0,spin=0.003;
  renderer.domElement.addEventListener('pointerdown',e=>{drag=true;last=e.clientX;renderer.domElement.setPointerCapture(e.pointerId)});
  renderer.domElement.addEventListener('pointermove',e=>{if(drag){const dx=e.clientX-last;last=e.clientX;model.rotation.y+=dx*.012;spin=dx*.001;}});
  renderer.domElement.addEventListener('pointerup',()=>drag=false);
  renderer.domElement.addEventListener('pointercancel',()=>drag=false);
  function resize(){const r=host.getBoundingClientRect();if(r.width&&r.height){renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}}
  new ResizeObserver(resize).observe(host);
  let time=0;function loop(){requestAnimationFrame(loop);if(!bag.hidden){time+=.016;if(!drag)model.rotation.y+=spin;resetFrogRigPose(model);poseFrogRigIdle(model,time,1,false);updateFrogRigSecondary(model,.016,{move:0,action:0,time});renderer.render(scene,camera);}}loop();
  equipmentViewer={sync(profile){viewerProfile=profile;speciesViewer.select(profile?.appearance?.frog).catch(e=>console.error('Swamp Toad equipment model failed',e));const f=FROGS[profile?.appearance?.frog]||FROGS.tree;const a=profile?.appearance||{};const base=model.userData.customization?.overallScale||1;model.scale.set(base*1.12*f.scale*f.wide*(Number(a.build||100)/100),base*1.12*f.scale*(.93+.07*(Number(a.head||110)/110)),base*1.12*f.scale*(Number(a.build||100)/100));if(model.userData.materials?.frog?.color)model.userData.materials.frog.color.set(a.color||f.color);if(model.userData.materials?.belly?.color)model.userData.materials.belly.color.set(a.color||f.color).lerp(new THREE.Color('#d1c5a1'),.55);if(model.userData.nativeAnimations)model.userData.syncGear(getGear(profile));else applyPreviewStarterVisuals(model,profile?.discipline||'knight');resize();}};
  return equipmentViewer;
}
function renderBag(){
  if(bag.hidden||!state)return;
  const profile=selectedProfile(),gear=getGear(profile),items=carriedItems(state);
  const signature=JSON.stringify({items,gear,profile:profile?.id,croaks:getCroaks()});if(signature===bagSignature)return;bagSignature=signature;
  q('#equipmentCharacterLabel').textContent=`${profile?.name||'Wanderer'} · ${DISCIPLINES[profile?.discipline]?.label||'Knight'} · ${FROGS[profile?.appearance?.frog]?.label||'Tree Frog'}`;
  const slotMarkup=slot=>{const itemId=gear?.equipped?.[slot],item=GEAR[itemId];const reserved=slot==='offhand'&&occupiedSlots(GEAR[gear?.equipped?.mainHand]).length===2;return `<button class="equipment-slot" data-unequip-slot="${slot}" ${item?'':'disabled'} title="${item?'Unequip '+esc(item.name):'Empty '+GEAR_SLOTS[slot]}"><span class="slot-icon">${item?.icon||SLOT_ICON[slot]}</span><span class="slot-name">${GEAR_SLOTS[slot]}</span><span class="slot-item">${item?esc(item.name):reserved?'Both hands occupied':'Empty'}</span></button>`};
  q('#equipmentSlotsLeft').innerHTML=['head','chest','legs','shoulders','back','belt'].map(slotMarkup).join('');
  q('#equipmentSlotsRight').innerHTML=['hands','feet','neck','ring_1','ring_2','accessory'].map(slotMarkup).join('');
  q('#equipmentWeapons').innerHTML=['mainHand','offhand'].map(slotMarkup).join('');
  bag.querySelectorAll('[data-unequip-slot]').forEach(btn=>btn.addEventListener('click',()=>{const slot=btn.dataset.unequipSlot,id=getGear(selectedProfile())?.equipped?.[slot];if(id)transferGear(selectedProfile(),id,'equipment',slot);}));
  const bonus=gearBonuses(profile);q('#equipmentBonusLine').textContent=`${formatStats(equipmentStats(gear,GEAR))} · Starter: Fiber +${bonus.vitality} · Pressure +${bonus.might} · Brown +${bonus.arcana} · Gut +${bonus.endurance}`;
  bagGrid.innerHTML=Array.from({length:Math.max(30,items.length)},(_,i)=>items[i]?`<button class="bag-slot filled" data-slot="${i}" data-rarity="${items[i].rarity||'common'}" aria-label="${esc(items[i].name)}"><span>${items[i].icon||'◈'}</span>${items[i].name==='Brown Flask'?`<em>${state.flasks}</em>`:items[i].count>1?`<em>${items[i].count}</em>`:''}<small>${esc(items[i].name)}</small></button>`:'<div class="bag-slot empty" aria-hidden="true"></div>').join('');
  bagGrid.querySelectorAll('[data-slot]').forEach(slot=>{const item=items[Number(slot.dataset.slot)];const show=e=>{bagTooltip.innerHTML=`<strong>${esc(item.name)}</strong><small>${esc(item.type)}</small><p>${esc(item.details)}</p><i>${esc(item.flavor)}</i>`;bagTooltip.hidden=false;const r=slot.getBoundingClientRect();positionBagTooltip(e.clientX===undefined?{clientX:r.right,clientY:r.top}:e)};slot.addEventListener('pointerenter',show);slot.addEventListener('pointermove',positionBagTooltip);slot.addEventListener('pointerleave',hideBagTooltip);slot.addEventListener('focus',show);slot.addEventListener('blur',hideBagTooltip);if(item.id)slot.addEventListener('click',()=>{hideBagTooltip();transferGear(selectedProfile(),item.id,'inventory')});});
  renderWallet();
  createEquipmentViewer().sync(profile);
}
function openBag(){if(!world||game.hidden||state?.loading||state?.mode==='dead'||state?.pootalDialog)return;if(!menu.hidden)closeMenu();bag.hidden=false;world.setPaused?.(true);bagSignature='';renderBag();q('#bagClose').focus();}
function closeBag(){if(bag.hidden)return;bag.hidden=true;hideBagTooltip();world?.setPaused?.(false);}
q('#bagClose').addEventListener('click',closeBag);
// 2.6.5 — Croaks wallet and character-bound corpse rewards.
const croakKey=profile=>`browncraft-croaks-v1-${profile?.id||'guest'}`;
const lootBagKey=profile=>`browncraft-loot-items-v1-${profile?.id||'guest'}`;
const corpseRewards=new Map();
let openCorpseId=null;
const getCroaks=()=>Math.max(0,Number(localStorage.getItem(croakKey(selectedProfile()))||0)||0);
const walletParts=amount=>({gold:Math.floor(amount/100),silver:Math.floor(amount%100/10),copper:amount%10});
const getCollectedLoot=()=>{try{const v=JSON.parse(localStorage.getItem(lootBagKey(selectedProfile()))||'[]');return Array.isArray(v)?v:[]}catch{return[]}};
const saveCollectedLoot=items=>localStorage.setItem(lootBagKey(selectedProfile()),JSON.stringify(items));
function renderWallet(){const el=q('#croaksWallet');if(!el)return;const c=walletParts(getCroaks());el.innerHTML=[['gold',c.gold],['silver',c.silver],['copper',c.copper]].map(([k,n])=>`<div class="croak-unit" title="${k} Croaks"><i class="croak-dot ${k}"></i><strong>${n.toLocaleString()}</strong><small>${k}</small></div>`).join('');}
function makeCorpseRewards(info){
  // Roll once at death: reopening never re-rolls.
  const total=info.boss?100+Math.floor(Math.random()*101):1+Math.floor(Math.random()*80);
  const item=Math.random()<(info.boss?1:0.6)?rollLoot({level:world?.state?.level||1,elite:!!info.boss}):null;
  const rows=[{id:'croaks',kind:'currency',name:'Croaks',amount:total},...(item?[{id:item.id,kind:'item',name:item.name,icon:item.icon,description:itemDescription(item),amount:1}]:[])];
  corpseRewards.set(info.enemyId,{name:info.name,rows});
}
function croakVisual(amount){const p=walletParts(amount);const denomination=p.gold?'100':p.silver?'10':'1';const units=p.gold||p.silver||p.copper;const shape=units>=50?'Stack':units>=10?'LoosePile':'';return `assets/croaks/Croaks_${denomination}${shape?'_'+shape:''}.png`;}
function renderLoot(){
  const modal=q('#corpseLoot');if(modal.hidden||!openCorpseId)return;
  const corpse=corpseRewards.get(openCorpseId);if(!corpse){closeLoot();return;}
  q('#corpseLootName').textContent=corpse.name;
  q('#corpseLootRows').innerHTML=corpse.rows.map((entry,i)=>`<div class="corpse-loot-row"><div class="corpse-loot-icon">${entry.kind==='currency'?`<img src="${croakVisual(entry.amount)}" alt="Croaks" loading="lazy">`:esc(entry.icon||'◈')}</div><div class="corpse-loot-desc"><strong>${esc(entry.name)}</strong><small>${entry.kind==='currency'?esc(entry.amount+' Croaks · '+(walletParts(entry.amount).gold?'Gold':walletParts(entry.amount).silver?'Silver':'Copper')+' denomination'):esc(entry.description||'Loot item')}</small></div><button data-take="${i}" aria-label="Take ${esc(entry.name)}">Take</button></div>`).join('')||'<p class="corpse-empty">Nothing remains.</p>';
  modal.querySelectorAll('[data-take]').forEach(b=>b.onclick=()=>takeCorpseRow(Number(b.dataset.take)));
  q('#corpseLootAll').disabled=!corpse.rows.length;
}
function takeCorpseRow(index){
  const corpse=corpseRewards.get(openCorpseId);if(!corpse)return;
  const row=corpse.rows[index];if(!row)return;
  if(row.kind==='currency')localStorage.setItem(croakKey(selectedProfile()),String(getCroaks()+row.amount));
  else if(ITEM_BY_ID[row.id]){const gear=getGear(selectedProfile());gear.inventory.push(row.id);saveGear(selectedProfile(),gear);}else {const items=getCollectedLoot();items.push({...row});saveCollectedLoot(items);}
  corpse.rows.splice(index,1);bagSignature='';renderWallet();
  if(!bag.hidden)renderBag();
  if(!corpse.rows.length){world?.markCorpseLooted(openCorpseId);corpseRewards.delete(openCorpseId);closeLoot();}else renderLoot();
}
function openLoot(info){
  if(game.hidden||state?.mode==='dead'||state?.loading)return;
  if(!corpseRewards.has(info.enemyId))makeCorpseRewards(info);
  if(!bag.hidden)closeBag();if(!menu.hidden)closeMenu();
  openCorpseId=info.enemyId;q('#corpseLoot').hidden=false;world?.setPaused?.(true);renderLoot();q('#corpseLootAll').focus();
}
function closeLoot(){const panel=q('#corpseLoot');if(panel.hidden)return;panel.hidden=true;openCorpseId=null;world?.setPaused?.(false);}
q('#corpseLootClose').onclick=closeLoot;
q('#corpseLootAll').onclick=()=>{const corpse=corpseRewards.get(openCorpseId);if(!corpse)return;while(corpseRewards.has(openCorpseId)&&corpse.rows.length)takeCorpseRow(0);};

const desktopControls = q('#desktopControls');
const mobileControls = q('#mobileControls');
const deathScreen = q('#deathScreen');
const guardianVictory=q('#guardianVictory');
let guardianVictoryTimer=null;
function hideGuardianVictory(){clearTimeout(guardianVictoryTimer);guardianVictory.classList.remove('visible');guardianVictory.hidden=true;}
function showGuardianVictory({name,access}){hideGuardianVictory();q('#guardianVictoryName').textContent=name;q('#guardianVictoryAccess').textContent='• Access to '+access+' obtained';guardianVictory.hidden=false;requestAnimationFrame(()=>guardianVictory.classList.add('visible'));guardianVictoryTimer=setTimeout(hideGuardianVictory,4200);}
const deathContinueBtn = q('#deathContinueBtn');
const deathQuitBtn = q('#deathQuitBtn');
const loginBgVideos = [q('#loginBgVideoA'), q('#loginBgVideoB')].filter(Boolean);
const LOGIN_BG_VIDEO = './assets/login-bg-video.mp4';

function initLoginBackgroundVideo(){
  if (loginBgVideos.length < 2) return;
  const overlap = 1.15;
  let activeIndex = 0;
  let swapping = false;

  async function crossfadeToNext(){
    if (swapping) return;
    swapping = true;
    const current = loginBgVideos[activeIndex];
    const next = loginBgVideos[1 - activeIndex];
    try {
      next.currentTime = 0;
      await next.play();
    } catch (_) {
      swapping = false;
      return;
    }
    next.classList.add('active');
    current.classList.remove('active');
    activeIndex = 1 - activeIndex;
    setTimeout(() => {
      current.pause();
      current.currentTime = 0;
      swapping = false;
    }, Math.max(500, overlap * 1000 + 120));
  }

  loginBgVideos.forEach((video, index) => {
    video.src = LOGIN_BG_VIDEO;
    video.loop = false;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('webkit-playsinline', 'true');
    video.addEventListener('timeupdate', () => {
      if (index !== activeIndex || swapping) return;
      const duration = video.duration || 20;
      if (duration - video.currentTime <= overlap) crossfadeToNext();
    });
    video.addEventListener('ended', () => {
      if (index === activeIndex) crossfadeToNext();
    });
  });

  const kick = () => loginBgVideos[activeIndex]?.play().catch(() => {});
  loginBgVideos[0].addEventListener('canplay', kick, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) loginBgVideos.forEach(v => v.pause());
    else kick();
  });
  entry.addEventListener('pointerdown', kick, { passive: true });
  entry.addEventListener('keydown', kick);
  kick();
}

initLoginBackgroundVideo();

const CHAR_KEY = 'browncraft-alpha11-characters';
const LEGACY_SAVE = 'browncraft-build05-progress';
const MAX_CHARACTERS = 8;
const DISCIPLINES = {
  knight: { label: 'Knight', blurb: 'Steel and steadfast guard', vitality: 2, might: 2, arcana: 2, endurance: 2, stamRegen: 1 },
  caster: { label: 'Warlock', blurb: 'Forbidden Brown arts', vitality: 1, might: 1, arcana: 4, endurance: 2, stamRegen: 1 },
  rogue: { label: 'Rogue', blurb: 'Speed and precision', vitality: 1, might: 2, arcana: 2, endurance: 3, stamRegen: 1.4 },
  shaman: { label: 'Shaman', blurb: 'Primal rites and renewal', vitality: 2, might: 1, arcana: 3, endurance: 2, stamRegen: 1.12 }
};
const FROGS = {
  tree:{label:'Tree Frog',scale:1,wide:.94,color:'#789c55'},
  bull:{label:'Bullfrog',scale:1.1,wide:1.12,color:'#6f8650'},
  dart:{label:'Dart Frog',scale:.89,wide:.94,color:'#389cbd'},
  horned:{label:'Horned Frog',scale:.98,wide:1.2,color:'#aaa054'},
  glass:{label:'Glass Frog',scale:.95,wide:.88,color:'#9bbc98'},
  toad:{label:'Swamp Toad',scale:1.04,wide:1.15,color:'#857050'}
};
const LEGACY_GEAR = {
  rusty_sword:{name:'Rusty Sword',slot:'mainHand',stat:'Pressure +1',bonus:{might:1},icon:'⚔'},
  wooden_guard:{name:'Wooden Guard',slot:'offhand',stat:'Fiber +1',bonus:{vitality:1},icon:'⬟'},
  worn_tunic:{name:'Worn Tunic',slot:'chest',stat:'Fiber +1',bonus:{vitality:1},icon:'▤'},
  warped_wand:{name:'Warped Wand',slot:'mainHand',stat:'Brown +1',bonus:{arcana:1},icon:'✧'},
  faded_robe:{name:'Faded Robe',slot:'chest',stat:'Brown +1',bonus:{arcana:1},icon:'▥'},
  dull_dagger:{name:'Dull Dagger',slot:'mainHand',stat:'Pressure +1',bonus:{might:1},icon:'⚔'},
  patched_vest:{name:'Patched Vest',slot:'chest',stat:'Gut +1',bonus:{endurance:1},icon:'▤'},
  branch_staff:{name:'Carved Branch',slot:'mainHand',stat:'Brown +1',bonus:{arcana:1},icon:'☘'},
  moss_wrap:{name:'Mossbound Wrap',slot:'chest',stat:'Fiber +1',bonus:{vitality:1},icon:'▤'},
  cracked_helm:{name:'Cracked Helm',slot:'head',stat:'Fiber +1',bonus:{vitality:1},icon:'♜'},
  mossy_boots:{name:'Mossy Boots',slot:'feet',stat:'Gut +1',bonus:{endurance:1},icon:'♧'}
};
const GEAR={...LEGACY_GEAR,...ITEM_BY_ID};
const GEAR_SLOTS=SLOTS;
const STARTER_GEAR={
  knight:{mainHand:'rusty_sword',offhand:'wooden_guard',chest:'worn_tunic'},
  caster:{mainHand:'warped_wand',chest:'faded_robe'},
  rogue:{mainHand:'dull_dagger',chest:'patched_vest'},
  shaman:{mainHand:'branch_staff',chest:'moss_wrap'}
};
const gearKeyFor=id=>`browncraft-gear-v1:${id}`;
function getGear(profile){if(!profile)return null;let data;try{data=JSON.parse(localStorage.getItem(gearKeyFor(profile.id))||'null')}catch{};return data&&typeof data==='object'&&Array.isArray(data.inventory)&&data.equipped?data:{equipped:{...STARTER_GEAR[profile.discipline]||STARTER_GEAR.knight},inventory:[]};}
function saveGear(profile,data){localStorage.setItem(gearKeyFor(profile.id),JSON.stringify(data));}
function transferGear(profile,itemId,source,slot){
 const data=getGear(profile),item=GEAR[itemId];if(!data||!item)return false;
 const level=state&&world?.profile?.id===profile.id?state.level:progressFor(profile).level;
 const ok=source==='inventory'?equipItem(data,itemId,GEAR,level):unequipItem(data,itemId,slot||Object.keys(data.equipped).find(s=>data.equipped[s]===itemId));
 if(!ok){world?.say?.(item.slot?`Requires level ${item.level_required||1}.`:'This item is carried in your bag. Its effects are not active yet.');return false;}
 saveGear(profile,data);updateGearOnWorld(profile);return true;
}
function gearBonuses(profile){const bonuses={vitality:0,might:0,arcana:0,endurance:0};Object.values(getGear(profile)?.equipped||{}).forEach(id=>{Object.entries(GEAR[id]?.bonus||{}).forEach(([key,value])=>bonuses[key]+=value)});return bonuses;}
function updateGearOnWorld(profile){if(world&&profile?.id===selectedProfile()?.id){world.characterGear=getGear(profile);world.characterItemStats=equipmentStats(world.characterGear,GEAR);world.characterLegacyBonuses=gearBonuses(profile);world.applyDerivedStats(false);world.emit();world.dispatchEvent(new CustomEvent('character-gear-changed',{detail:world.characterGear}));}bagSignature='';if(!menu.hidden)renderMenu();if(!bag.hidden)renderBag();}


let world = null;
let state = null;
let currentTab = 'character';
let layout = localStorage.getItem('browncraft-control-layout') || (matchMedia('(max-width:760px)').matches ? 'mobile' : 'desktop');
let characters = loadCharacters();
let selectedCharacterId = characters[0]?.id || null;
let selectedDiscipline = 'knight';
let selectedFrog = 'tree';
let preview = null;
let authMode = 'guest';
let skeletonDebug = false;
let deathRevealTimer = null;

function hideDeathScreen(){
  clearTimeout(deathRevealTimer); deathRevealTimer = null;
  deathScreen.classList.remove('visible','ready');
  deathScreen.hidden = true;
  deathContinueBtn.disabled = false;
  deathQuitBtn.disabled = false;
}

function showDeathScreen(){
  if(!deathScreen.hidden) return;
  deathScreen.hidden = false;
  deathContinueBtn.disabled = true;
  deathQuitBtn.disabled = true;
  requestAnimationFrame(()=>requestAnimationFrame(()=>deathScreen.classList.add('visible')));
  deathRevealTimer = setTimeout(()=>{
    deathScreen.classList.add('ready');
    deathContinueBtn.disabled = false;
    deathQuitBtn.disabled = false;
    deathContinueBtn.focus();
  }, 1450);
}

const SOUND_KEY = 'browncraft-sound-enabled';
const titleMusic = new Audio('./assets/an-intro.mp3');
titleMusic.loop = true;
titleMusic.preload = 'auto';
titleMusic.volume = 0.0;
let soundEnabled = localStorage.getItem(SOUND_KEY) !== '0';
let audioUnlocked = false;
let audioFadeRaf = null;

const REALM_TRACK_PATHS = {
  hearth: './assets/music/ajol.mp3',
  fords: './assets/music/weeping-fjarts.mp3',
  steppe: './assets/music/assfall-steppe.mp3',
  ember: './assets/music/emberpood.mp3',
  stillwater: './assets/music/ol-mudds-melody.mp3',
  boss1: './assets/music/boss-battle-1.mp3',
  boss2: './assets/music/boss-battle-2.mp3'
};
const realmMusic = new Audio();
realmMusic.loop = true;
realmMusic.preload = 'none';
realmMusic.volume = 0;
let activeRealmTrack = null;
let realmAudioUnlocked = false;
let realmSwitchToken = 0;
let lastMusicState = { zone: null, boss: false };

function fadeRealmVolume(target, ms = 650){
  const token = ++realmSwitchToken;
  const start = realmMusic.volume;
  const t0 = performance.now();
  return new Promise(resolve => {
    const tick = now => {
      if(token !== realmSwitchToken){ resolve(false); return; }
      const k = Math.max(0, Math.min(1, (now - t0) / Math.max(1, ms)));
      realmMusic.volume = start + (target - start) * k;
      if(k < 1) requestAnimationFrame(tick);
      else { resolve(true); }
    };
    requestAnimationFrame(tick);
  });
}

async function primeRealmMusic(key = 'hearth'){
  if(!soundEnabled || !REALM_TRACK_PATHS[key]) return;
  const token = ++realmSwitchToken;
  try {
    activeRealmTrack = key;
    realmMusic.src = REALM_TRACK_PATHS[key];
    realmMusic.currentTime = 0;
    realmMusic.volume = 0.001;
    await realmMusic.play();
    if(token !== realmSwitchToken) return;
    realmAudioUnlocked = true;
  } catch (_) {
    realmAudioUnlocked = false;
  }
}

async function switchRealmMusic(key, { restart = false } = {}){
  if(!soundEnabled || !key || !REALM_TRACK_PATHS[key]) return;
  const same = activeRealmTrack === key && realmMusic.src.includes(REALM_TRACK_PATHS[key].split('/').pop());
  if(same && !realmMusic.paused){
    fadeRealmVolume(key.startsWith('boss') ? 0.5 : 0.38, 500);
    return;
  }
  const myToken = ++realmSwitchToken;
  if(!realmMusic.paused && realmMusic.volume > 0.01){
    const start = realmMusic.volume;
    const t0 = performance.now();
    await new Promise(resolve => {
      const tick = now => {
        if(myToken !== realmSwitchToken){ resolve(false); return; }
        const k = Math.max(0, Math.min(1, (now - t0) / 360));
        realmMusic.volume = start * (1 - k);
        if(k < 1) requestAnimationFrame(tick); else resolve(true);
      };
      requestAnimationFrame(tick);
    });
    if(myToken !== realmSwitchToken) return;
  }
  activeRealmTrack = key;
  realmMusic.src = REALM_TRACK_PATHS[key];
  if(restart) realmMusic.currentTime = 0;
  realmMusic.volume = 0.001;
  try {
    await realmMusic.play();
    realmAudioUnlocked = true;
    const target = key.startsWith('boss') ? 0.5 : 0.38;
    const start = realmMusic.volume;
    const t0 = performance.now();
    const token = realmSwitchToken;
    const tick = now => {
      if(token !== realmSwitchToken) return;
      const k = Math.max(0, Math.min(1, (now - t0) / 700));
      realmMusic.volume = start + (target - start) * k;
      if(k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  } catch (_) {
    realmAudioUnlocked = false;
  }
}

function stopRealmMusic(){
  const token = ++realmSwitchToken;
  activeRealmTrack = null;
  lastMusicState = { zone: null, boss: false };
  if(!realmMusic.paused){
    const start = realmMusic.volume;
    const t0 = performance.now();
    const tick = now => {
      if(token !== realmSwitchToken) return;
      const k = Math.max(0, Math.min(1, (now - t0) / 300));
      realmMusic.volume = start * (1 - k);
      if(k < 1) requestAnimationFrame(tick);
      else if(token === realmSwitchToken) { realmMusic.pause(); realmMusic.removeAttribute('src'); realmMusic.load(); }
    };
    requestAnimationFrame(tick);
  } else if(token === realmSwitchToken) {
    realmMusic.removeAttribute('src');
    realmMusic.load();
  }
}

function syncRealmMusic(s){
  if(!s || game.hidden || !soundEnabled) return;
  const boss = !!s.bossBattle;
  const zone = s.zone || 'hearth';
  const changed = zone !== lastMusicState.zone || boss !== lastMusicState.boss;
  if(!changed) return;
  const enteringBoss = boss && !lastMusicState.boss;
  lastMusicState = { zone, boss };
  if(boss) switchRealmMusic('boss1', { restart: enteringBoss });
  else switchRealmMusic(zone);
}

function setMusicVolume(target, ms = 450, pauseAtEnd = false){
  cancelAnimationFrame(audioFadeRaf);
  const start = titleMusic.volume;
  const t0 = performance.now();
  const tick = now => {
    const k = Math.max(0, Math.min(1, (now - t0) / Math.max(1, ms)));
    titleMusic.volume = start + (target - start) * k;
    if(k < 1) audioFadeRaf = requestAnimationFrame(tick);
    else if(pauseAtEnd && target <= 0.001) titleMusic.pause();
  };
  audioFadeRaf = requestAnimationFrame(tick);
}

function updateSoundButton(){
  const btn = q('#soundBtn');
  if(!btn) return;
  btn.dataset.on = soundEnabled ? '1' : '0';
  btn.textContent = `Sound · ${soundEnabled ? 'On' : 'Off'}`;
}

async function startTitleMusic(){
  if(!soundEnabled) return;
  try {
    if(titleMusic.paused) await titleMusic.play();
    audioUnlocked = true;
    setMusicVolume(0.46, 650);
  } catch (_) {
    // Browsers may reject play() until a user gesture. unlockTitleAudio handles that path.
  }
}

function stopTitleMusic(){
  if(titleMusic.paused) return;
  setMusicVolume(0, 500, true);
}

function unlockTitleAudio(){
  if(audioUnlocked || !soundEnabled) return;
  startTitleMusic();
}

function toggleSound(){
  soundEnabled = !soundEnabled;
  localStorage.setItem(SOUND_KEY, soundEnabled ? '1' : '0');
  updateSoundButton();
  if(soundEnabled) {
    if(!entry.hidden || !characterSelect.hidden) startTitleMusic();
    else if(!game.hidden && state) { lastMusicState = { zone: null, boss: false }; if(realmMusic.paused) primeRealmMusic(state.bossBattle ? 'boss1' : (state.zone || 'hearth')).then(()=>syncRealmMusic(state)); else syncRealmMusic(state); }
  } else {
    stopTitleMusic();
    stopRealmMusic();
  }
}

updateSoundButton();
entry.addEventListener('pointerdown', unlockTitleAudio, {passive:true});
entry.addEventListener('keydown', unlockTitleAudio);
characterSelect.addEventListener('pointerdown', unlockTitleAudio, {passive:true});
characterSelect.addEventListener('keydown', unlockTitleAudio);

const pct = (v,m) => `${Math.max(0,Math.min(100,m? v/m*100:0))}%`;
const saveKeyFor = id => `browncraft-alpha11-progress:${id}`;
const esc = s => String(s ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

function loadCharacters(){
  try {
    let list = JSON.parse(localStorage.getItem(CHAR_KEY) || '[]');
    if (!Array.isArray(list)) list = [];
    if (!list.length) {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_SAVE) || 'null');
      if (legacy) {
        const id = `wanderer-${Date.now()}`;
        const profile = { id, name:'The Wanderer', discipline:'knight', createdAt:Date.now() };
        list.push(profile);
        localStorage.setItem(CHAR_KEY, JSON.stringify(list));
        localStorage.setItem(saveKeyFor(id), JSON.stringify({...legacy, characterName:profile.name, discipline:'knight'}));
      }
    }
    return list.slice(0, MAX_CHARACTERS);
  } catch (_) { return []; }
}
function persistCharacters(){ localStorage.setItem(CHAR_KEY, JSON.stringify(characters)); }
function selectedProfile(){ return characters.find(c=>c.id===selectedCharacterId) || null; }
function progressFor(profile){
  if(!profile) return null;
  const d = DISCIPLINES[profile.discipline] || DISCIPLINES.knight;
  try {
    const s = JSON.parse(localStorage.getItem(saveKeyFor(profile.id)) || 'null');
    return {
      level:s?.level || 1, xp:s?.xp || 0,
      vitality:s?.vitality || d.vitality, might:s?.might || d.might,
      arcana:s?.arcana || d.arcana, endurance:s?.endurance || d.endurance,
      bossDefeated:!!s?.bossDefeated
    };
  } catch (_) { return {level:1,xp:0,vitality:d.vitality,might:d.might,arcana:d.arcana,endurance:d.endurance}; }
}

function showOnly(section){
  entry.hidden = section !== 'entry';
  characterSelect.hidden = section !== 'characters';
  game.hidden = section !== 'game';
  document.body.classList.toggle('in-game', section === 'game');
  if(section !== 'game') hideDeathScreen();
}
function openCharacterSelect(){
  stopRealmMusic();
  destroyWorld();
  showOnly('characters');
  renderRoster();
  ensurePreview();
  const prof=selectedProfile();preview?.setDiscipline(prof?.discipline||'knight');preview?.setFrog(prof?.appearance||{frog:'tree',head:110,build:100,color:FROGS.tree.color});
  if(soundEnabled && audioUnlocked) startTitleMusic();
}
function beginSession(mode){ authMode = mode; openCharacterSelect(); }
q('#guestBtn').addEventListener('click', ()=>beginSession('guest'));
q('#loginBtn').addEventListener('click', ()=>beginSession('account'));
q('#characterLogoutBtn').addEventListener('click', logout);
q('#soundBtn')?.addEventListener('click', e => {
  e.stopPropagation();
  toggleSound();
});
function logout(){
  stopRealmMusic();
  destroyWorld();
  showOnly('entry');
  if(soundEnabled && audioUnlocked) startTitleMusic();
}

function renderRoster(){
  const list = q('#characterList');
  q('#rosterCount').textContent = `${characters.length} / ${MAX_CHARACTERS}`;
  if (!characters.length) {
    list.innerHTML = `<button class="empty-character" id="emptyCreate" type="button"><strong>No wanderers yet</strong><small>Create a character to begin.</small></button>`;
    q('#emptyCreate').onclick = openCreator;
    selectedCharacterId = null;
  } else {
    if (!characters.some(c=>c.id===selectedCharacterId)) selectedCharacterId = characters[0].id;
    list.innerHTML = characters.map(c => {
      const p=progressFor(c), d=DISCIPLINES[c.discipline]||DISCIPLINES.knight;
      return `<button class="character-row ${c.id===selectedCharacterId?'active':''}" data-character="${c.id}" type="button"><span class="portrait-glyph">◈</span><span><strong>${esc(c.name)}</strong><small>Level ${p.level} · ${d.label}</small></span><em>${p.bossDefeated?'Warden Felled':'A’jol'}</em></button>`;
    }).join('');
    list.querySelectorAll('[data-character]').forEach(b=>b.addEventListener('click',()=>{ selectedCharacterId=b.dataset.character; renderRoster(); }));
  }
  const profile=selectedProfile();
  q('#enterRealmBtn').disabled=!profile;
  q('#deleteCharacterBtn').disabled=!profile;
  q('#newCharacterBtn').disabled=characters.length>=MAX_CHARACTERS;
  if(profile){
    const p=progressFor(profile), d=DISCIPLINES[profile.discipline]||DISCIPLINES.knight;
    q('#selectedCharacterName').textContent=profile.name;
    q('#selectedCharacterPath').textContent=`Level ${p.level} ${FROGS[profile.appearance?.frog]?.label||'Tree Frog'} ${d.label} · ${d.blurb}`;
    q('#selectedCharacterStats').innerHTML=`<span>Fiber <b>${p.vitality}</b></span><span>Pressure <b>${p.might}</b></span><span>Brown <b>${p.arcana}</b></span><span>Gut <b>${p.endurance}</b></span>`;
  } else {
    q('#selectedCharacterName').textContent='No Wanderer Selected';
    q('#selectedCharacterPath').textContent='Create a new character to begin.';
    q('#selectedCharacterStats').innerHTML='';
  }
  preview?.setDiscipline(profile?.discipline || 'knight');
  preview?.setFrog(profile?.appearance || {frog:'tree',head:110,build:100,color:FROGS.tree.color});
}

function openCreator(){
  if(characters.length>=MAX_CHARACTERS) return;
  selectedDiscipline='knight';
  selectedFrog='tree';
  q('#frogHead').value=110;q('#frogBuild').value=100;q('#frogColor').value=FROGS.tree.color;
  q('#frogHeadOut').textContent='110%';q('#frogBuildOut').textContent='100%';
  document.querySelectorAll('[data-frog]').forEach(b=>b.classList.toggle('active',b.dataset.frog==='tree'));
  preview?.setFrog(currentCreatorAppearance());preview?.setDiscipline('knight');
  q('#newCharacterModal').hidden=false;
  q('#creatorPreviewMount').appendChild(q('#characterPreview'));
  preview?.resize();updateCreatorPreviewLabel();
  q('#newCharacterName').value='';
  document.querySelectorAll('[data-discipline]').forEach(b=>b.classList.toggle('active', b.dataset.discipline==='knight'));
  setTimeout(()=>q('#newCharacterName').focus(),50);
}
function closeCreator(){ q('#newCharacterModal').hidden=true; q('.character-stage').prepend(q('#characterPreview')); preview?.resize(); renderRoster(); }
function updateCreatorPreviewLabel(){q('#creatorPreviewLabel').textContent=`${FROGS[selectedFrog]?.label||'Tree Frog'} · ${DISCIPLINES[selectedDiscipline]?.label||'Knight'}`;}
q('#newCharacterBtn').addEventListener('click',openCreator);
q('#closeCreatorBtn').addEventListener('click',closeCreator);
document.querySelectorAll('[data-discipline]').forEach(b=>b.addEventListener('click',()=>{
  selectedDiscipline=b.dataset.discipline;
  document.querySelectorAll('[data-discipline]').forEach(x=>x.classList.toggle('active',x===b));
  preview?.setDiscipline(selectedDiscipline);updateCreatorPreviewLabel();
}));
function currentCreatorAppearance(){return {frog:selectedFrog,head:Number(q('#frogHead').value),build:Number(q('#frogBuild').value),color:q('#frogColor').value};}
document.querySelectorAll('[data-frog]').forEach(b=>b.addEventListener('click',()=>{selectedFrog=b.dataset.frog;document.querySelectorAll('[data-frog]').forEach(x=>x.classList.toggle('active',x===b));q('#frogColor').value=FROGS[selectedFrog].color;preview?.setFrog(currentCreatorAppearance());updateCreatorPreviewLabel();}));
['frogHead','frogBuild','frogColor'].forEach(id=>q('#'+id).addEventListener('input',()=>{q('#frogHeadOut').textContent=q('#frogHead').value+'%';q('#frogBuildOut').textContent=q('#frogBuild').value+'%';preview?.setFrog(currentCreatorAppearance());updateCreatorPreviewLabel();}));
q('#newCharacterForm').addEventListener('submit',e=>{
  e.preventDefault();
  const name=q('#newCharacterName').value.trim(); if(!name) return;
  const id=`char-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const profile={id,name,discipline:selectedDiscipline,appearance:{frog:selectedFrog,head:Number(q('#frogHead').value),build:Number(q('#frogBuild').value),color:q('#frogColor').value},createdAt:Date.now()};
  saveGear(profile,getGear(profile));
  characters.push(profile); persistCharacters(); selectedCharacterId=id;
  closeCreator(); renderRoster();
});
q('#deleteCharacterBtn').addEventListener('click',()=>{
  const p=selectedProfile(); if(!p) return;
  if(!confirm(`Delete ${p.name}? This removes this character's local progression.`)) return;
  characters=characters.filter(c=>c.id!==p.id); persistCharacters(); localStorage.removeItem(saveKeyFor(p.id)); localStorage.removeItem(gearKeyFor(p.id));
  selectedCharacterId=characters[0]?.id||null; renderRoster();
});
q('#enterRealmBtn').addEventListener('click',()=>{ const p=selectedProfile(); if(p) startGame(p); });

function startGame(profile){
  stopTitleMusic();
  stopRealmMusic();
  if(soundEnabled) primeRealmMusic('hearth');
  showOnly('game');
  hideDeathScreen();
  destroyWorld();
  world=document.createElement('world-3d');
  world.id='world';
  world.characterProfile={...profile, ...(DISCIPLINES[profile.discipline]||DISCIPLINES.knight)};
  world.characterGear=getGear(profile);
  world.characterItemStats=equipmentStats(world.characterGear,GEAR);
  world.characterLegacyBonuses=gearBonuses(profile);
  hideGuardianVictory();
  world.addEventListener('guardian-slay',e=>showGuardianVictory(e.detail));
  world.addEventListener('corpse-created',e=>makeCorpseRewards(e.detail));
  world.addEventListener('corpse-loot',e=>openLoot(e.detail));
  world.addEventListener('worldstate', e=>{ state=e.detail; renderHud(state); syncRealmMusic(state); });
  worldMount.appendChild(world);
  q('#playerName').textContent=profile.name;
  requestAnimationFrame(()=>world.resize?.());
}
function destroyWorld(){
  hideDeathScreen();
  closeLoot();corpseRewards.clear();
  if(world){ try{ world.setPaused?.(true); world.remove(); }catch(_){} world=null; state=null; }
  worldMount.innerHTML=''; menu.hidden=true;
}

function applyLayout(){
  const mobile = layout === 'mobile';
  desktopControls.hidden = mobile; mobileControls.hidden = !mobile;
  if (innerWidth <= 760) { desktopControls.hidden = true; mobileControls.hidden = false; }
}
applyLayout();

function renderHud(s){
  renderPootalDialog(s);
  renderBossDialog(s);
  if(s.mode === 'dead') showDeathScreen();
  q('#levelLabel').textContent = `Lv ${s.level}`;
  q('#playerName').textContent = s.characterName || selectedProfile()?.name || 'The Wanderer';
  q('#hpBar').style.width = pct(s.hp,s.hpMax); q('#hpText').textContent = `${Math.ceil(s.hp)} / ${s.hpMax}`;
  q('#stamBar').style.width = pct(s.stam,s.stamMax); q('#stamText').textContent = `${Math.ceil(s.stam)} / ${s.stamMax}`;
  q('#brownBar').style.width = pct(s.focus,s.focusMax); q('#brownText').textContent = `${Math.ceil(s.focus)} / ${s.focusMax}`;
  q('#xpText').textContent = `${s.xp} / ${s.xpNext}`;
  q('#regionName').textContent = s.zoneName || 'A’jol'; q('#modeLabel').textContent = String(s.mode || 'roam').toUpperCase();
  q('#objectiveText').textContent = s.objective || ''; q('#logText').textContent = s.log || '';
  const th=q('#targetHud');
  if(s.target?.hpMax&&!s.bossHud){ th.hidden=false; q('#targetName').textContent=s.target.name||'Enemy'; q('#targetText').textContent=`${Math.ceil(s.target.hp)} / ${s.target.hpMax}`; q('#targetBar').style.width=pct(s.target.hp,s.target.hpMax); } else th.hidden=true;
  const bh=q('#bossHud');bh.hidden=!s.bossHud;game.classList.toggle('boss-active',!!s.bossHud);
  if(s.bossHud){q('#bossHudName').textContent=s.bossHud.name;q('#bossHudStatus').textContent=s.bossHud.status||'';q('#bossHudBar').style.width=pct(s.bossHud.hp,s.bossHud.hpMax);q('#bossHudText').textContent=`${Math.ceil(s.bossHud.hp)} / ${s.bossHud.hpMax}`;}
  const knight=s.discipline==='knight', guard=s.spell==='guard', mend=s.spell==='mend';
  q('#spellName').textContent=knight?(guard?'Brown Shield':'Fart Charge'):(mend?'Brown Mend':'Brown Bolt');
  q('#spellIcon').innerHTML=(knight?guard:mend)?'<svg viewBox="0 0 48 48"><path d="M12 27v-9a3 3 0 0 1 6 0v7-12a3 3 0 0 1 6 0v12-9a3 3 0 0 1 6 0v10-6a3 3 0 0 1 6 0v11c0 8-5 13-13 13h-2c-5 0-9-3-12-7l-4-6a3 3 0 0 1 5-4l2 2Z"/><path class="accent" d="M36 4v12M30 10h12"/></svg>':'<svg viewBox="0 0 48 48"><path d="m43 5-12 36-7-14-14-7L43 5Z"/><path class="accent" d="m24 27 9-9M9 31l-5 5M15 35l-5 8"/></svg>';
  document.querySelectorAll('[data-spell-label]').forEach((el,i)=>el.textContent=i?knight?(guard?'Shield':'Charge'):(mend?'Mend':'Bolt'):knight?(guard?'Brown Shield':'Fart Charge'):(mend?'Brown Mend':'Brown Bolt'));
  document.querySelectorAll('[data-act="cast"]').forEach(el=>el.setAttribute('aria-label',`Use ${knight?(guard?'Brown Shield':'Fart Charge'):(mend?'Brown Mend':'Brown Bolt')}`));
  const ib=q('#interactBtn');
  ib.hidden=!s.interact;
  ib.textContent=s.interact?`${s.interact.verb||'Interact'} ${s.interact.name||''}`.trim():'Interact';
  ib.classList.toggle('pootal-cta',s.interact?.id==='portal');
  if(!menu.hidden) renderMenu();
  if(!bag.hidden) renderBag();
}

deathContinueBtn.addEventListener('click', async()=>{
  if(!world || state?.mode !== 'dead') return;
  deathContinueBtn.disabled = true; deathQuitBtn.disabled = true;
  deathContinueBtn.textContent = 'Returning to A’jol…';
  const returned = await world.respawnAtAjol?.();
  deathContinueBtn.textContent = 'Continue at A’jol';
  if(returned) hideDeathScreen();
  else { deathContinueBtn.disabled = false; deathQuitBtn.disabled = false; }
});
deathQuitBtn.addEventListener('click',()=>{
  if(state?.mode !== 'dead') return;
  openCharacterSelect();
});

function openMenu(){ if(!world||state?.pootalDialog||state?.loading)return; closeBag();menu.hidden=false; world.setPaused?.(true); renderMenu(); }
function closeMenu(){ menu.hidden=true; world?.setPaused?.(false); }
q('#menuBtn').addEventListener('click',openMenu); q('#resumeBtn').addEventListener('click',closeMenu);
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{ if(b.dataset.tab==='inventory'||b.dataset.tab==='equipment'){openBag();return;} currentTab=b.dataset.tab; document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b)); renderMenu(); }));
function renderMenu(){
  if(!state){ panel.innerHTML='<h2>Loading</h2><div class="sub">The Brown is gathering…</div>'; return; }
  const label={vitality:'Fiber',might:'Pressure',arcana:'Brown',endurance:'Gut'};
  const d=DISCIPLINES[state.discipline]||DISCIPLINES.knight;
  if(currentTab==='character'){
    panel.innerHTML=`<h2>${esc(state.characterName||'Character')}</h2><div class="sub">${d.label} origin · Level ${state.level}</div><div class="menu-grid">
      <div class="menu-row"><div><span>Fiber</span><small>Health · resilience</small></div><strong>${state.vitality}</strong></div>
      <div class="menu-row"><div><span>Pressure</span><small>Weapon damage · stagger</small></div><strong>${state.might}</strong></div>
      <div class="menu-row"><div><span>Brown</span><small>Brown Reserve · abilities</small></div><strong>${state.arcana}</strong></div>
      <div class="menu-row"><div><span>Gut</span><small>Stamina · guard · dodge</small></div><strong>${state.endurance}</strong></div>
      <div class="menu-row"><div><span>Brown Essence</span><small>Current / next deepening</small></div><strong>${state.xp} / ${state.xpNext}</strong></div>
      <div class="menu-row"><div><span>Attunement</span><small>Next growth at A’jol Brownwell</small></div><strong>${label[state.growthFocus]}</strong></div>
    </div><div class="growth-buttons">${['vitality','might','arcana','endurance'].map(k=>`<button data-growth="${k}" class="${state.growthFocus===k?'active':''}">${label[k]}</button>`).join('')}</div>`;
    panel.querySelectorAll('[data-growth]').forEach(b=>b.addEventListener('click',()=>world?.act?.(`growthset:${b.dataset.growth}`)));
  } else if(currentTab==='inventory') {
    const profile=selectedProfile(),g=getGear(profile);
    panel.innerHTML=`<h2>Inventory</h2><div class="sub">Items carried but not equipped</div><div class="menu-grid">${(g?.inventory||[]).map((id,i)=>GEAR[id]?`<div class="menu-row"><div><span>${esc(GEAR[id].name)}</span><small>${esc(itemDescription(GEAR[id]))} · ${esc(GEAR_SLOTS[GEAR[id].slot])}</small></div>${GEAR[id].slot?`<button class="equip-item-action" data-equip-idx="${i}">Equip</button>`:'<span>Carried</span>'}</div>`:'').join('')||'<div class="menu-row">Your bag is empty. Explore for equipment.</div>'}<div class="menu-row"><span>Brown Flask</span><strong>${state.flasks}</strong></div>${[['fords','Fragment of Return'],['steppe','Fragment of Pressure'],['ember','Fragment of Release']].map(([id,name])=>`<div class="menu-row"><span>${name}</span><strong>${state.pootalKeys?.[id]?'Recovered':'—'}</strong></div>`).join('')}</div>`;
    panel.querySelectorAll('[data-equip-idx]').forEach(btn=>btn.onclick=()=>transferGear(profile,g.inventory[Number(btn.dataset.equipIdx)],'inventory'));
  } else if(currentTab==='equipment') {
    const profile=selectedProfile(),g=getGear(profile),bonus=gearBonuses(profile);
    panel.innerHTML=`<h2>Equipment</h2><div class="sub">Worn and wielded · catalog equipment</div><div class="equipment-statline">Gear bonuses: Fiber +${bonus.vitality} · Pressure +${bonus.might} · Brown +${bonus.arcana} · Gut +${bonus.endurance} · ${formatStats(equipmentStats(g,GEAR))}</div><div class="menu-grid">${Object.entries(GEAR_SLOTS).map(([slot,label])=>{const id=g?.equipped?.[slot],item=GEAR[id];return `<div class="menu-row"><div><span>${label}</span><small>${item?esc(item.name)+' · '+esc(item.stat):'Empty'}</small></div>${item?`<button class="equip-item-action" data-unequip="${slot}">Unequip</button>`:''}</div>`}).join('')}</div>`;
    panel.querySelectorAll('[data-unequip]').forEach(btn=>btn.onclick=()=>transferGear(profile,g.equipped[btn.dataset.unequip],'equipment',btn.dataset.unequip));
  }
  else {
    panel.innerHTML=`<h2>Settings</h2><div class="sub">System and controls</div>
      <div class="setting-line"><div><strong>Control Layout</strong><small>Desktop keeps the screen clean; Mobile restores the movement wheel.</small></div><select id="layoutSelect"><option value="desktop">Desktop</option><option value="mobile">Mobile</option></select></div>
      <div class="setting-line"><div><strong>Music</strong><small>Area themes and battle music.</small></div><button id="musicToggleBtn" class="system-action">${soundEnabled?'On':'Off'}</button></div>
      <div class="setting-line"><div><strong>Targeting</strong><small>Click an enemy to lock on. Click it again or empty ground to release.</small></div><span>Manual</span></div>
      <div class="setting-line"><div><strong>Rig Debug</strong><small>Show the procedural Frog Knight bone hierarchy in the realm.</small></div><button id="rigDebugBtn" class="system-action">${skeletonDebug?'On':'Off'}</button></div>
      <div class="setting-line"><div><strong>Character</strong><small>Return to your roster without ending the session.</small></div><button id="switchCharacterBtn" class="system-action">Character Select</button></div>
      <div class="setting-line danger-line"><div><strong>Session</strong><small>Return to the Browncraft title screen.</small></div><button id="logoutMenuBtn" class="system-action">Log Out</button></div>`;
    const sel=panel.querySelector('#layoutSelect'); sel.value=layout; sel.addEventListener('change',()=>{layout=sel.value; localStorage.setItem('browncraft-control-layout',layout); applyLayout();});
    const musicBtn=panel.querySelector('#musicToggleBtn'); if(musicBtn) musicBtn.onclick=()=>{ toggleSound(); renderMenu(); };
    const rigBtn=panel.querySelector('#rigDebugBtn'); if(rigBtn) rigBtn.onclick=()=>{ skeletonDebug=!skeletonDebug; world?.setSkeletonDebug?.(skeletonDebug); renderMenu(); };
    panel.querySelector('#switchCharacterBtn').onclick=()=>{ closeMenu(); openCharacterSelect(); };
    panel.querySelector('#logoutMenuBtn').onclick=()=>{ closeMenu(); logout(); };
  }
}

document.querySelectorAll('[data-act]').forEach(b=>b.addEventListener('click',()=>world?.act?.(b.dataset.act)));
document.querySelectorAll('[data-block]').forEach(b=>{ b.addEventListener('pointerdown',()=>world?.setBlock?.(true)); ['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,()=>world?.setBlock?.(false))); });
q('#interactBtn').addEventListener('click',()=>world?.act?.('interact'));
const pad=q('#movePad'), knob=q('#moveKnob'); let pid=null;
function moveFromEvent(e){ if(!world)return; const r=pad.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.34,m=Math.hypot(dx,dy)||1,k=Math.min(1,max/m),x=dx/max*k,y=dy/max*k; knob.style.transform=`translate(${x*max}px,${y*max}px)`; world.setMove?.(x,y); }
pad.addEventListener('pointerdown',e=>{pid=e.pointerId;pad.setPointerCapture(pid);moveFromEvent(e)}); pad.addEventListener('pointermove',e=>{if(e.pointerId===pid)moveFromEvent(e)}); function endPad(e){if(pid!==null&&e.pointerId===pid){pid=null;knob.style.transform='';world?.setMove?.(0,0)}} pad.addEventListener('pointerup',endPad); pad.addEventListener('pointercancel',endPad);
addEventListener('resize',applyLayout);
addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;if(e.key.toLowerCase()==='b'&&!game.hidden&&q('#corpseLoot').hidden){e.preventDefault();bag.hidden?openBag():closeBag();return;}if(e.key==='Escape'&&!q('#corpseLoot').hidden){e.preventDefault();closeLoot();return;}if(e.key==='Escape'&&!bag.hidden){e.preventDefault();closeBag();return;} if(e.key==='Escape'&&state?.pootalDialog){e.preventDefault();world?.act('pootal-close');return;} if(e.key==='Escape'&&!q('#newCharacterModal').hidden){closeCreator();return;} if(e.key==='Escape'&&!game.hidden){menu.hidden?openMenu():closeMenu();} });

function applyPreviewStarterVisuals(model,discipline){
  // Temporary, class-specific visual identifiers. Replace with rig-bound class armor GLBs later.
  const old=model.getObjectByName('placeholderClassGear');if(old){model.remove(old);old.traverse(o=>{o.geometry?.dispose?.();if(o.material?.dispose)o.material.dispose();});}
  const group=new THREE.Group();group.name='placeholderClassGear';
  const hues={knight:0xa79a7c,caster:0x715b8e,rogue:0x536751,shaman:0x807250};
  const mat=new THREE.MeshStandardMaterial({color:hues[discipline]||hues.knight,roughness:.9,metalness:discipline==='knight'?.3:0});
  const geometry=new THREE.TorusGeometry(.26,.047,8,20);const ring=new THREE.Mesh(geometry,mat);ring.rotation.x=Math.PI/2;ring.position.set(0,.16,0);group.add(ring);
  const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.10),new THREE.MeshStandardMaterial({color:discipline==='caster'?0xb286ec:discipline==='shaman'?0x9ac97c:discipline==='rogue'?0x819e6b:0xc4b286,emissive:discipline==='caster'?0x302044:0x12100a}));gem.position.set(0,.16,.3);group.add(gem);
  model.add(group);
}
function ensurePreview(){
  if(preview) { preview.resize(); return; }
  const host=q('#characterPreview');
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(36,1,.1,50); camera.position.set(0,1.9,6.8); camera.lookAt(0,1.35,0);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05; host.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xa8b0a0,0x1b1712,1.15)); const key=new THREE.DirectionalLight(0xffd7a0,2.3); key.position.set(-4,7,5); scene.add(key); const rim=new THREE.DirectionalLight(0x6ca9c3,1.1); rim.position.set(5,4,-4); scene.add(rim);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(2.35,48),new THREE.MeshStandardMaterial({color:0x15130f,roughness:1})); floor.rotation.x=-Math.PI/2; floor.position.y=-.7; scene.add(floor);
  let model=buildPreviewFrog(); scene.add(model);
  let creatorAppearance={frog:'tree',head:110,build:100,color:FROGS.tree.color},creatorDiscipline='knight';
  const speciesCreator=createSpeciesPreview({scene,initial:model,onChange(m){model=m;applyFrog(creatorAppearance);preview?.setDiscipline(creatorDiscipline);}});
  let dragging=false,lastX=0,velocity=.002;
  renderer.domElement.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;renderer.domElement.setPointerCapture(e.pointerId)}); renderer.domElement.addEventListener('pointermove',e=>{if(!dragging)return; const dx=e.clientX-lastX;lastX=e.clientX;model.rotation.y+=dx*.01;velocity=dx*.001}); renderer.domElement.addEventListener('pointerup',()=>dragging=false);
  function resize(){const r=host.getBoundingClientRect(); if(!r.width||!r.height)return; renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
  new ResizeObserver(resize).observe(host); resize();
  let t=0; function loop(){
    requestAnimationFrame(loop); t+=.016;
    if(!dragging){ model.rotation.y+=velocity; velocity*=.96; if(Math.abs(velocity)<.0012)velocity=.0012; }
    model.position.y=(model.userData.importedMesh?-.70:0)+Math.sin(t*1.7)*.012;
    resetFrogRigPose(model);
    const cycle=t%7.2;
    if(cycle>5.65 && cycle<6.45) poseFrogRigAttack(model,'light',(cycle-5.65)/.80);
    else poseFrogRigIdle(model,t,1,false);
    updateFrogRigSecondary(model,.016,{move:0,action:(cycle>5.65&&cycle<6.45)?1:0,time:t});
    renderer.render(scene,camera);
  } loop();
  function applyFrog(cfg){
    creatorAppearance=cfg||creatorAppearance;
    speciesCreator.select(creatorAppearance.frog).catch(e=>console.error('Swamp Toad creation model failed',e));
    const f=FROGS[cfg?.frog]||FROGS.tree;
    const head=(Number(cfg?.head)||110)/110,build=(Number(cfg?.build)||100)/100;
    const base=model.userData.customization?.overallScale||1;
    model.scale.set(base*1.12*f.scale*f.wide*build,base*1.12*f.scale*(.93+.07*head),base*1.12*f.scale*build);
    const materials=model.userData.materials;
    if(materials?.frog?.color)materials.frog.color.set(cfg?.color||f.color);
    if(materials?.belly?.color)materials.belly.color.set(cfg?.color||f.color).lerp(new THREE.Color('#d1c5a1'),.55);
  }
  preview={resize,setDiscipline(k){creatorDiscipline=k;const aura=model.userData.aura;if(aura?.material?.color){aura.material.color.setHex(k==='caster'?0x6aaad3:k==='shaman'?0x8ab879:k==='rogue'?0x6e8557:0xc9a15a);aura.material.opacity=k==='knight'?.18:.28;}if(model.userData.nativeAnimations)model.userData.syncGear({equipped:{}});else applyPreviewStarterVisuals(model,k);},setFrog:applyFrog};
  applyFrog({frog:'tree',head:110,build:100,color:FROGS.tree.color});
}
function buildPreviewFrog(){
  const g = createFrogKnightRig({ ringColor: 0xc9a15a, preview: true });
  g.scale.setScalar((g.userData.customization?.overallScale || 1) * 1.12);
  g.rotation.y = -0.12;
  return g;
}

renderRoster();

// Native modal dialogue: traps focus and keeps all game controls inert while open.
const pootalDialog=document.createElement('dialog');pootalDialog.className='pootal-dialog';
pootalDialog.setAttribute('aria-labelledby','pootalTitle');pootalDialog.setAttribute('aria-describedby','pootalMessage');
pootalDialog.innerHTML='<button class="pootal-close" aria-label="Close realm selection">×</button><p class="pootal-eyebrow">THE ANCIENT WAYPOINTS</p><h2 id="pootalTitle">Traverse the Brown</h2><p id="pootalMessage"></p><div class="pootal-realms"></div><p class="pootal-footnote">Sigils awaken waypoints permanently. Every return leads through A’jol.</p>';
document.body.appendChild(pootalDialog);
const realmIcon=kind=>{
 const paths={portal:'<circle cx="48" cy="43" r="27"/><circle cx="48" cy="43" r="19"/><path d="M20 75h56M27 67v8m42-8v8M48 16v8M21 43h8m38 0h8M48 62v8"/>',willow:'<path d="M48 78V30m0 14L31 29m17 12 18-14M19 61V38Q19 13 48 13t29 25v23M28 66V38q0-16 20-16t20 16v28M38 61V34m20 0v27M36 79h25"/>',terraces:'<path d="M12 76h72V64H69V52H54V40H39V28H24v12H12zM12 64h57M12 52h42M24 40h15M61 32q-8-7 0-14m13 24q-8-8 0-15"/>',bazaar:'<path d="M10 71h76M18 66V34h60v32M18 34l9-14h42l9 14M30 66V45h16v21M57 46h12v11H57zM25 77h46"/>',mushroom:'<path d="M14 48q3-26 34-26t34 26zM38 49l-5 29h30l-5-29M29 36l6-4m25 1 6 5M45 33h7M43 18q-7-7 1-14m12 14q-5-5 1-10"/>'};
 return `<svg viewBox="0 0 96 96" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${paths[kind]||paths.portal}</svg>`;
};
let pootalSignature='';
function renderPootalDialog(s){
 const data=s.pootalDialog;
 if(!data){if(pootalDialog.open)pootalDialog.close();pootalSignature='';return;}
 const signature=JSON.stringify(data);
 if(signature!==pootalSignature){
  pootalSignature=signature;pootalDialog.querySelector('#pootalMessage').textContent=data.message;
  pootalDialog.querySelector('.pootal-realms').innerHTML=data.choices.map(r=>`<button class="realm-card ${r.available?'awakened':'sealed'}" data-realm="${r.id}" ${r.available?'':'disabled'}>${realmIcon(r.icon)}<strong>${esc(r.name)}</strong><small>${esc(r.subtitle)}</small><span>${esc(r.reason)}</span></button>`).join('');
 }
 if(!pootalDialog.open)pootalDialog.showModal();
}
pootalDialog.querySelector('.pootal-close').addEventListener('click',()=>world?.act('pootal-close'));
pootalDialog.addEventListener('cancel',e=>{e.preventDefault();world?.act('pootal-close');});
pootalDialog.addEventListener('click',e=>{const b=e.target.closest('[data-realm]');if(b&&!b.disabled)world?.act('pootal:'+b.dataset.realm);});

const bossDialog=document.createElement('dialog');bossDialog.className='boss-dialog';
bossDialog.innerHTML='<p class="boss-eyebrow">REALM GUARDIAN</p><h2></h2><blockquote></blockquote><button type="button">Face the Guardian</button>';
document.body.appendChild(bossDialog);
function renderBossDialog(s){
 const data=s.bossDialog;if(!data){if(bossDialog.open)bossDialog.close();return;}
 bossDialog.querySelector('h2').textContent=data.name;bossDialog.querySelector('blockquote').textContent=`“${data.line}”`;
 if(!bossDialog.open)bossDialog.showModal();
}
bossDialog.querySelector('button').addEventListener('click',()=>world?.act('boss-intro-close'));
bossDialog.addEventListener('cancel',e=>{e.preventDefault();world?.act('boss-intro-close');});

// Read-only catalog: discovery does not grant items or alter character saves.
const catalogDialog=document.createElement('dialog');catalogDialog.className='catalog-dialog';catalogDialog.setAttribute('aria-labelledby','catalogTitle');
catalogDialog.innerHTML='<header><div><small>BROWNCRAFT FIELD GUIDE</small><h2 id="catalogTitle">Item catalog</h2></div><button id="catalogClose" aria-label="Close item catalog">×</button></header><p>Flat equipment stats are active. Special effects, sets, consumable actions, and fitted armor visuals are pending.</p><label>Search items <input id="catalogSearch" type="search" placeholder="Name, rarity, or category"></label><small id="catalogCount"></small><div id="catalogRows"></div>';
document.body.appendChild(catalogDialog);
function renderCatalog(){const term=catalogDialog.querySelector('input').value.trim().toLowerCase();const rows=CATALOG.filter(i=>`${i.name} ${i.rarity} ${i.category} ${i.slot||''}`.toLowerCase().includes(term));catalogDialog.querySelector('#catalogCount').textContent=`${rows.length} of ${CATALOG.length} items`;catalogDialog.querySelector('#catalogRows').innerHTML=rows.map(i=>`<article data-rarity="${i.rarity}"><strong>${i.icon} ${esc(i.name)}</strong><small>${esc(i.rarity)} · ${esc(i.category)} · ${esc(i.slot||'Carried item')} · Level ${i.level_required}</small><p>${esc(i.stat)}</p>${i.effects.length?`<p class="pending-effects">Planned effects (inactive): ${esc(i.effects.join('; '))}</p>`:''}<small>${esc(i.loot_pools.join(' · '))}</small></article>`).join('');}
q('#itemCatalogBtn').onclick=()=>{hideBagTooltip();renderCatalog();catalogDialog.showModal();catalogDialog.querySelector('input').focus();};
catalogDialog.querySelector('#catalogClose').onclick=()=>catalogDialog.close();catalogDialog.querySelector('input').oninput=renderCatalog;
catalogDialog.addEventListener('keydown',e=>e.stopPropagation());
