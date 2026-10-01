import * as THREE from 'three';
import { createFrogKnightRig, poseFrogRigIdle, poseFrogRigAttack, resetFrogRigPose, updateFrogRigSecondary } from './assets/frog-rig.js?v=2.5.1';
import { createMeshyFrogKnightRig } from './assets/meshy-frog-rig.js?v=2.5.1';

const q = s => document.querySelector(s);
const entry = q('#entry');
const characterSelect = q('#characterSelect');
const game = q('#game');
const worldMount = q('#worldMount');
const menu = q('#menu');
const panel = q('#menuPanel');
const desktopControls = q('#desktopControls');
const mobileControls = q('#mobileControls');
const deathScreen = q('#deathScreen');
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
  knight: { label: 'Knight', blurb: 'Balanced', vitality: 2, might: 2, arcana: 2, endurance: 2, stamRegen: 1 },
  brute: { label: 'Brute', blurb: 'Higher vitality', vitality: 4, might: 2, arcana: 1, endurance: 1, stamRegen: 1 },
  caster: { label: 'Warlock', blurb: 'Brown arts / casting', vitality: 1, might: 1, arcana: 4, endurance: 2, stamRegen: 1 },
  rogue: { label: 'Rogue', blurb: 'Faster stamina recovery', vitality: 1, might: 2, arcana: 2, endurance: 3, stamRegen: 1.4 }
};

let world = null;
let state = null;
let currentTab = 'character';
let layout = localStorage.getItem('browncraft-control-layout') || (matchMedia('(max-width:760px)').matches ? 'mobile' : 'desktop');
let characters = loadCharacters();
let selectedCharacterId = characters[0]?.id || null;
let selectedDiscipline = 'knight';
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
    q('#selectedCharacterPath').textContent=`Level ${p.level} ${d.label} · ${d.blurb}`;
    q('#selectedCharacterStats').innerHTML=`<span>Fiber <b>${p.vitality}</b></span><span>Pressure <b>${p.might}</b></span><span>Brown <b>${p.arcana}</b></span><span>Gut <b>${p.endurance}</b></span>`;
  } else {
    q('#selectedCharacterName').textContent='No Wanderer Selected';
    q('#selectedCharacterPath').textContent='Create a new character to begin.';
    q('#selectedCharacterStats').innerHTML='';
  }
  preview?.setDiscipline(profile?.discipline || 'knight');
}

function openCreator(){
  if(characters.length>=MAX_CHARACTERS) return;
  selectedDiscipline='knight';
  q('#newCharacterModal').hidden=false;
  q('#newCharacterName').value='';
  document.querySelectorAll('[data-discipline]').forEach(b=>b.classList.toggle('active', b.dataset.discipline==='knight'));
  setTimeout(()=>q('#newCharacterName').focus(),50);
}
function closeCreator(){ q('#newCharacterModal').hidden=true; }
q('#newCharacterBtn').addEventListener('click',openCreator);
q('#closeCreatorBtn').addEventListener('click',closeCreator);
document.querySelectorAll('[data-discipline]').forEach(b=>b.addEventListener('click',()=>{
  selectedDiscipline=b.dataset.discipline;
  document.querySelectorAll('[data-discipline]').forEach(x=>x.classList.toggle('active',x===b));
  preview?.setDiscipline(selectedDiscipline);
}));
q('#newCharacterForm').addEventListener('submit',e=>{
  e.preventDefault();
  const name=q('#newCharacterName').value.trim(); if(!name) return;
  const id=`char-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const profile={id,name,discipline:selectedDiscipline,createdAt:Date.now()};
  characters.push(profile); persistCharacters(); selectedCharacterId=id;
  closeCreator(); renderRoster();
});
q('#deleteCharacterBtn').addEventListener('click',()=>{
  const p=selectedProfile(); if(!p) return;
  if(!confirm(`Delete ${p.name}? This removes this character's local progression.`)) return;
  characters=characters.filter(c=>c.id!==p.id); persistCharacters(); localStorage.removeItem(saveKeyFor(p.id));
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
  world.addEventListener('worldstate', e=>{ state=e.detail; renderHud(state); syncRealmMusic(state); });
  worldMount.appendChild(world);
  q('#playerName').textContent=profile.name;
  requestAnimationFrame(()=>world.resize?.());
}
function destroyWorld(){
  hideDeathScreen();
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

function openMenu(){ if(!world||state?.pootalDialog||state?.loading)return; menu.hidden=false; world.setPaused?.(true); renderMenu(); }
function closeMenu(){ menu.hidden=true; world?.setPaused?.(false); }
q('#menuBtn').addEventListener('click',openMenu); q('#resumeBtn').addEventListener('click',closeMenu);
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{ currentTab=b.dataset.tab; document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b)); renderMenu(); }));
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
  } else if(currentTab==='inventory') panel.innerHTML=`<h2>Inventory</h2><div class="sub">Carried possessions</div><div class="menu-grid"><div class="menu-row"><span>Brown Flask</span><strong>${state.flasks}</strong></div>${[['fords','Fragment of Return'],['steppe','Fragment of Pressure'],['ember','Fragment of Release']].map(([id,name])=>`<div class="menu-row"><span>${name}</span><strong>${state.pootalKeys?.[id]?'Recovered':'—'}</strong></div>`).join('')}</div>`;
  else if(currentTab==='equipment') panel.innerHTML='<h2>Equipment</h2><div class="sub">Worn and wielded</div><div class="menu-grid"><div class="menu-row"><span>Right Hand</span><strong>Rustbound Blade</strong></div><div class="menu-row"><span>Left Hand</span><strong>Wooden Guard</strong></div><div class="menu-row"><span>Body</span><strong>Bogmail</strong></div><div class="menu-row"><span>Charm</span><strong>None</strong></div></div>';
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
addEventListener('keydown',e=>{ if(e.key==='Escape'&&state?.pootalDialog){e.preventDefault();world?.act('pootal-close');return;} if(e.key==='Escape'&&!q('#newCharacterModal').hidden){closeCreator();return;} if(e.key==='Escape'&&!game.hidden){menu.hidden?openMenu():closeMenu();} });

function ensurePreview(){
  if(preview) { preview.resize(); return; }
  const host=q('#characterPreview');
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(36,1,.1,50); camera.position.set(0,1.9,6.8); camera.lookAt(0,1.35,0);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05; host.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xa8b0a0,0x1b1712,1.15)); const key=new THREE.DirectionalLight(0xffd7a0,2.3); key.position.set(-4,7,5); scene.add(key); const rim=new THREE.DirectionalLight(0x6ca9c3,1.1); rim.position.set(5,4,-4); scene.add(rim);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(2.35,48),new THREE.MeshStandardMaterial({color:0x15130f,roughness:1})); floor.rotation.x=-Math.PI/2; floor.position.y=-.7; scene.add(floor);
  let model=buildPreviewFrog(); scene.add(model);
  createMeshyFrogKnightRig({ ringColor: 0xc9a15a, preview: true }).then(imported=>{
    imported.scale.setScalar(1.12);
    imported.position.y=-.70;
    imported.rotation.y=-0.12;
    scene.remove(model);
    model=imported;
    scene.add(model);
  }).catch(err=>console.warn('Character preview is using procedural fallback.',err));
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
  preview={resize,setDiscipline(k){ const d=DISCIPLINES[k]||DISCIPLINES.knight; model.userData.aura.material.color.setHex(k==='caster'?0x6aaad3:k==='brute'?0x95513b:k==='rogue'?0x6e8557:0xc9a15a); model.userData.aura.material.opacity=k==='knight'?.18:.28; const base=model.userData.customization?.overallScale||1; model.scale.setScalar(base*(k==='brute'?1.08:k==='rogue'?.96:1)); }};
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
 const paths={portal:'<circle cx="48" cy="43" r="27"/><circle cx="48" cy="43" r="19"/><path d="M20 75h56M27 67v8m42-8v8M48 16v8M21 43h8m38 0h8M48 62v8"/>',willow:'<path d="M48 78V30m0 14L31 29m17 12 18-14M19 61V38Q19 13 48 13t29 25v23M28 66V38q0-16 20-16t20 16v28M38 61V34m20 0v27M36 79h25"/>',terraces:'<path d="M12 76h72V64H69V52H54V40H39V28H24v12H12zM12 64h57M12 52h42M24 40h15M61 32q-8-7 0-14m13 24q-8-8 0-15"/>',mushroom:'<path d="M14 48q3-26 34-26t34 26zM38 49l-5 29h30l-5-29M29 36l6-4m25 1 6 5M45 33h7M43 18q-7-7 1-14m12 14q-5-5 1-10"/>'};
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
