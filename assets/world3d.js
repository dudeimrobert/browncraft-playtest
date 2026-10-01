import { REALMS, realmInfo, normalizeProgress, realmChoices, canTraverse, realmUnlocked } from './pootal-progression.js?v=2.5.1';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createFrogKnightRig, poseFrogRigIdle, poseFrogRigWalk, poseFrogRigBlock, poseFrogRigAttack, poseFrogRigCast, poseFrogRigFlask, poseFrogRigDodge, poseFrogRigHit, updateFrogRigSecondary, resetFrogRigPose } from './frog-rig.js?v=2.5.1';
import { createMeshyFrogKnightRig } from './meshy-frog-rig.js?v=2.5.1';

const TILE = 2;
const DEFAULT_COLS = 30, DEFAULT_ROWS = 53;
const GROUND = 0, PATH = 1, WATER = 2, ROCK = 3;

const ROAM_SPEED = 9, FIGHT_SPEED = 6.2, ENEMY_SPEED = 3.4;
const AGGRO = 9, LEASH = 26;

const BOUGH_SWEEP = {
  windup: 1.15,
  strike: 0.24,
  recovery: 0.82,
  range: 4.35,
  halfArc: Math.PI / 3,
  damage: [18, 24]
};

const ATT = {
  light: { cost: 15, hit: 0.17, end: 0.46, dmg: [8, 12], reach: 3.1, arc: 1.5, swing: 1 },
  heavy: { cost: 32, hit: 0.46, end: 1.0, dmg: [19, 27], reach: 3.6, arc: 1.9, swing: 1.5 }
};
const SPELLS = {
  bolt: { key: 'bolt', name: 'Brown Bolt', cost: 22, cast: 0.5, dmg: [12, 17] },
  mend: { key: 'mend', name: 'Brown Mend', cost: 30, cast: 0.62, heal: 24 }
};
const SPELL_ORDER = ['bolt', 'mend'];
const KNIGHT_SKILLS = ['charge', 'guard'];
const KNIGHT_CHARGE = { key:'charge', name:'Fart Charge', cost:22, cast:0.48, dmg:[17,24] };
const KNIGHT_GUARD = { key:'guard', name:'Brown Shield', cost:30, cast:0.4 };
const FLASK = { heal: 34, time: 0.9, max: 2 };
const SAVE_PREFIX = 'browncraft-alpha11-progress:';
const GROWTH = ['vitality', 'might', 'arcana', 'endurance'];
const GROWTH_LABEL = { vitality: 'Fiber', might: 'Pressure', arcana: 'Brown', endurance: 'Gut' };
const XP_BASE = 100, XP_STEP = 60;

const INTERACT_RADIUS = 3.6;
const ZONES = {
  hearth: {
    id: 'hearth', name: "A'jol", mood: 'dusk', mask: 'assets/map-hearth-bf.png', surface: 'assets/ajol/ajol-ground-crossroads.png',
    blurb: 'A drowned frontier shrine where the paths of The Brown first gather. Rest here, or don\'t — the realm keeps no clock.',
    foes: [], hp: 0, safe: true, cols: 34, rows: 34
  },
  fords: {
    id: 'fords', name: 'Weeping Fjarts', mood: 'dusk', mask: 'assets/map-fords-bf.png', surface: 'assets/ground-swamp.png',
    blurb: 'A willow-choked wetland where amber sap weeps from old trees and every crossing feels remembered.',
    foes: ['Ash Revenant', 'Mire Stalker', 'Bone Suppliant', 'Hollow Warden'],
    hp: 88, damage: [12,18], cols: 34, rows: 34
  },
  steppe: {
    id: 'steppe', name: 'Assfall Steppes', mood: 'overcast', mask: 'assets/map-steppe-bf.png', surface: 'assets/map-steppe-bf.png',
    blurb: 'Terraced badlands of mineral pools and rising steam. The earth here exhales in slow, hot breaths.',
    foes: ['Cinder Warden', 'Pale Drifter', 'Kiln Thrall', 'Ash-Choked Knight'],
    hp: 110, damage: [15,21], cols: 34, rows: 34
  },
  ember: {
    id: 'ember', name: 'Emberpood', mood: 'night', mask: 'assets/map-ember-bf.png', surface: 'assets/ground-ember.png',
    blurb: 'Charred fungal wilds lit by volcanic glow. Huge ember-caps bloom where the ground split open.',
    foes: ['Smouldering Hound', 'Coalwright', 'Root Suppliant', 'The Long Ember'],
    hp: 128, damage: [18,25], cols: 34, rows: 34
  }
};

function classify(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const sat = mx === 0 ? 0 : (mx - mn) / mx;
  const lum = (r * 0.3 + g * 0.6 + b * 0.1) / 255;
  if (b > r * 1.12 && b > 60) return WATER;
  if (lum > 0.78 && b >= r * 0.98) return WATER;
  if (sat < 0.22 && lum < 0.46) return ROCK;
  if (r > b * 1.45 && r > g * 0.98) return PATH;
  return GROUND;
}
const rnd = (a, b) => a + Math.random() * (b - a);

class World3D extends HTMLElement {
  connectedCallback() {
    if (this._boot) return;
    this._boot = true;
    this.style.cssText = 'display:block;position:absolute;inset:0;width:100%;height:100%';
    this.profile = this.characterProfile || { id: 'guest', name: 'The Wanderer', discipline: 'knight', vitality: 2, might: 2, arcana: 2, endurance: 2, stamRegen: 1 };
    this.saveKey = SAVE_PREFIX + (this.profile.id || 'guest');
    this.stamRegenMultiplier = this.profile.stamRegen || 1;
    this.state = {
      mode: 'roam', hp: 100, hpMax: 100, stam: 100, stamMax: 100, focus: 60, focusMax: 60,
      target: null, enemies: 0, nearby: 0, blocking: false, flash: 0,
      flasks: FLASK.max, flasksMax: FLASK.max, spell: 'charge', shield: 0, paused: false,
      zone: 'hearth', zoneName: ZONES.hearth.name, loading: null, level: 1, xp: 0, xpNext: XP_BASE,
      growthFocus: 'vitality', vitality: this.profile.vitality || 2, might: this.profile.might || 2, arcana: this.profile.arcana || 2, endurance: this.profile.endurance || 2,
      characterName: this.profile.name || 'The Wanderer', discipline: this.profile.discipline || 'knight',
      attackPower: 1, magicPower: 1, bossDefeated: false, bossBattle: false, bossHud: null, slowed: false, objective: 'Enter the Weeping Fjarts and survive your first hunt.',
      bossKills: {}, pootalKeys: {}, pootalDialog: null, bossDialog: null, interact: null,
      log: `You wake at A'jol, ${this.profile.name || 'wanderer'}. Where all life begins — or began.`
    };
    this.move = { x: 0, y: 0 };
    this.keys = {};
    this.blocking = false;
    this.popups = [];
    this.interactables = [];
    this.zone = ZONES.hearth;
    this.loadProgress();
    this.applyDerivedStats(true);
    if (this.state.discipline === 'knight') { if (!KNIGHT_SKILLS.includes(this.state.spell)) this.state.spell = 'charge'; }
    else if (!SPELL_ORDER.includes(this.state.spell)) this.state.spell='bolt';
    this.init();
  }

  disconnectedCallback() {
    cancelAnimationFrame(this._raf);
    if (this._ro) this._ro.disconnect();
    removeEventListener('keydown', this._keyDown);
    removeEventListener('keyup', this._keyUp);
    if (this.renderer?.domElement && this._pointerDown) this.renderer.domElement.removeEventListener('pointerdown', this._pointerDown);
    if (this.renderer?.domElement && this._pointerUp) this.renderer.domElement.removeEventListener('pointerup', this._pointerUp);
    if (this.renderer) this.renderer.dispose();
  }

  emit() {
    this._dirty = false;
    this.dispatchEvent(new CustomEvent('worldstate', { detail: { ...this.state } }));
  }
  mark() { this._dirty = true; }
  say(msg) { this.state.log = msg; this.emit(); }

  async init() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0f0c);
    scene.fog = new THREE.Fog(0x121410, 42, 118);
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 400);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    // Bound fill-rate on high-DPI displays; adjust slowly from observed frame times.
    this._renderScale = Math.min(window.devicePixelRatio || 1, 1.25);
    renderer.setPixelRatio(this._renderScale);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    this.appendChild(renderer.domElement);
    this.renderer = renderer;

    const controls = new OrbitControls(this.camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 10;
    controls.maxDistance = 24;
    controls.minPolarAngle = 0.4;
    controls.maxPolarAngle = 1.05;
    controls.rotateSpeed = 0.6;
    this.controls = controls;

    scene.add(new THREE.HemisphereLight(0x8fa6b8, 0x2a2417, 0.55));
    const sun = new THREE.DirectionalLight(0xffd9a0, 1.7);
    sun.position.set(-28, 40, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(768, 768);
    Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 70, bottom: -70, far: 160 });
    sun.shadow.bias = -0.0007;
    scene.add(sun);
    this.sun = sun;

    this.gltfLoader = new GLTFLoader();
    this.modelAssets = {};
    this.textureAssets = {};
    await Promise.all([this.loadModelAssets(), this.loadTextureAssets()]);

    this.buildMarkers();
    await this.buildZone(this.zone,'pootal');

    this.resize();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(this);
    this.bindInput();
    this.bindTargeting();
    this.emit();

    let last = performance.now();
    let frameSeconds = 0, frameCount = 0;
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (dt < 0.1 && !document.hidden) {
        frameSeconds += dt; frameCount++;
        if (frameSeconds >= 2 && frameCount >= 20) {
          const fps = frameCount / frameSeconds;
          const ceiling = Math.min(window.devicePixelRatio || 1, 1.25);
          const next = Math.max(0.75, Math.min(ceiling, this._renderScale + (fps < 48 ? -0.1 : fps > 57 ? 0.05 : 0)));
          if (Math.abs(next - this._renderScale) > 0.01) {
            this._renderScale = next;
            renderer.setPixelRatio(next);
          }
          frameSeconds = 0; frameCount = 0;
        }
      }
      this._t = (this._t || 0) + dt;
      this.update(dt, this._t);
      controls.update();
      this.updateModelLod(now);
      renderer.render(scene, this.camera);
    };
    loop();
  }

  async loadModelAssets() {
    const specs = {
      willow: 'assets/models/willow_tree_optimized.glb',
      ajolTree: 'assets/models/fantasy-x-tree-08.glb',
      fountain: 'assets/models/fountain.glb',
      mushroom: 'assets/models/ember-mushroom.glb',
      guardianFords: 'assets/models/mournwillow-guardian.glb',
      guardianSteppe: 'assets/models/vuldross-guardian.glb',
      guardianEmber: 'assets/models/cindergut-guardian.glb'
    };
    await Promise.all(Object.entries(specs).map(async ([key, url]) => {
      try {
        const gltf = await this.gltfLoader.loadAsync(url);
        let root = gltf.scene || gltf.scenes?.[0];
        if (!root) return;
        if (key === 'mushroom') root = root.getObjectByName('Mushroom') || root;
        const mushroomCap = key === 'mushroom' ? new THREE.MeshStandardMaterial({
          name: 'Emberpood Mushroom Cap', color: 0x5d2418, roughness: 0.72, metalness: 0.02,
          emissive: 0x631600, emissiveIntensity: 0.88
        }) : null;
        const mushroomStalk = key === 'mushroom' ? new THREE.MeshStandardMaterial({
          name: 'Emberpood Mushroom Stalk', color: 0x3b3028, roughness: 0.96, metalness: 0.0,
          emissive: 0x180803, emissiveIntensity: 0.22
        }) : null;
        root.traverse(o => {
          if (o.isMesh) {
            o.castShadow = key !== 'mushroom';
            o.receiveShadow = true;
            if (key === 'mushroom') {
              if (/cap/i.test(o.name || '')) o.material = mushroomCap;
              else if (/stalk/i.test(o.name || '')) o.material = mushroomStalk;
              else o.material = mushroomStalk;
            } else if (o.material) {
              const mats = Array.isArray(o.material) ? o.material : [o.material];
              mats.forEach(m => { if (m.map) m.map.colorSpace = THREE.SRGBColorSpace; });
            }
          }
        });
        this.modelAssets[key] = root;
      } catch (err) {
        console.warn(`Browncraft: optional model failed to load: ${key}`, err);
      }
    }));
  }

  async loadTextureAssets() {
    try {
      const loader = new THREE.TextureLoader();
      const source = await loader.loadAsync('assets/ajol/trader-billboard.png');
      const image = source.image;
      const colorCanvas = document.createElement('canvas');
      colorCanvas.width = image.naturalWidth || image.width;
      colorCanvas.height = image.naturalHeight || image.height;
      const colorCtx = colorCanvas.getContext('2d', { willReadFrequently: true });
      colorCtx.drawImage(image, 0, 0);
      const colorData = colorCtx.getImageData(0, 0, colorCanvas.width, colorCanvas.height);
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = colorCanvas.width;
      maskCanvas.height = colorCanvas.height;
      const maskCtx = maskCanvas.getContext('2d');
      const maskData = maskCtx.createImageData(maskCanvas.width, maskCanvas.height);
      for (let i = 0; i < colorData.data.length; i += 4) {
        const r = colorData.data[i], g = colorData.data[i + 1], b = colorData.data[i + 2];
        const hi = Math.max(r, g, b), lo = Math.min(r, g, b);
        const neutral = hi - lo < 18;
        const light = (r * 0.3 + g * 0.59 + b * 0.11);
        let alpha = colorData.data[i + 3];
        if (neutral && light >= 205) alpha = 0;
        else if (neutral && light > 180) alpha = Math.round(alpha * (205 - light) / 25);
        colorData.data[i + 3] = alpha;
        maskData.data[i] = maskData.data[i + 1] = maskData.data[i + 2] = 255;
        maskData.data[i + 3] = alpha;
      }
      colorCtx.putImageData(colorData, 0, 0);
      maskCtx.putImageData(maskData, 0, 0);
      const color = new THREE.CanvasTexture(colorCanvas);
      const mask = new THREE.CanvasTexture(maskCanvas);
      for (const texture of [color, mask]) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
      }
      source.dispose();
      this.textureAssets.trader = { color, mask, aspect: colorCanvas.width / colorCanvas.height };
    } catch (err) {
      console.warn('Browncraft: trader billboard texture failed to load', err);
    }
  }

  cloneModelAsset(key, targetSize, opts = {}) {
    const source = this.modelAssets?.[key];
    if (!source) return null;
    const obj = source.clone(true);
    obj.traverse(o => { if (o.isMesh) { o.castShadow = key !== 'willow' || /bark/i.test(o.material?.name || ''); o.receiveShadow = true; o.userData.modelAsset = key; if(key==='willow'){const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(m){m.metalness=0;m.roughness=/bark/i.test(m.name)?1:.85;}}} } });
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const measure = opts.axis === 'y' ? size.y : Math.max(size.x, size.y, size.z);
    const scale = targetSize / Math.max(0.0001, measure);
    obj.scale.setScalar(scale);
    obj.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(obj);
    const center = scaledBox.getCenter(new THREE.Vector3());
    obj.position.x -= center.x;
    obj.position.z -= center.z;
    obj.position.y -= scaledBox.min.y;
    obj.userData.assetKey = key;
    return obj;
  }

  buildGuardianRig(key) {
    const model=this.cloneModelAsset(key,3.7,{axis:'y'});if(!model)return null;
    const rig=new THREE.Group(),rootBone=new THREE.Bone();rootBone.name=`${key}-root`;
    rootBone.add(model);rig.add(rootBone);
    const attackPivot=new THREE.Group();attackPivot.name=`${key}-attack-pivot`;rig.add(attackPivot);
    const ring=this.actorRing(0xd9752b);ring.scale.setScalar(1.65);rig.add(ring);
    rig.userData.rig=true;rig.userData.guardianRig=true;rig.userData.bones={root:rootBone};rig.userData.skeleton=new THREE.Skeleton([rootBone]);rig.userData.arm=attackPivot;rig.userData.ring=ring;
    rig.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;o.userData.modelAsset=key;}});
    // Distant guardians use a cheap silhouette; the full imported mesh remains
    // available at combat distance and all combat/animation objects stay intact.
    const proxy=new THREE.Group();
    const mat=new THREE.MeshStandardMaterial({color:key==='guardianEmber'?0x783b29:key==='guardianSteppe'?0x5e4a39:0x403d35,roughness:1,flatShading:true});
    const body=new THREE.Mesh(new THREE.ConeGeometry(.9,2.7,6),mat);body.position.y=1.4;proxy.add(body);
    const head=new THREE.Mesh(new THREE.IcosahedronGeometry(.55,0),mat);head.position.y=3;proxy.add(head);
    proxy.visible=false;rootBone.add(proxy);
    rig.userData.lod={model,proxy};
    return rig;
  }

  buildBoughSweepTelegraph() {
    const segments=28,positions=[];
    for(let i=0;i<segments;i++){
      const a0=-BOUGH_SWEEP.halfArc+(i/segments)*BOUGH_SWEEP.halfArc*2;
      const a1=-BOUGH_SWEEP.halfArc+((i+1)/segments)*BOUGH_SWEEP.halfArc*2;
      positions.push(0,0,0,Math.sin(a0)*BOUGH_SWEEP.range,0,Math.cos(a0)*BOUGH_SWEEP.range,Math.sin(a1)*BOUGH_SWEEP.range,0,Math.cos(a1)*BOUGH_SWEEP.range);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    const fill=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xd65b2f,transparent:true,opacity:.32,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
    const edgePoints=[new THREE.Vector3(0,.012,0)];
    for(let i=0;i<=segments;i++){const a=-BOUGH_SWEEP.halfArc+(i/segments)*BOUGH_SWEEP.halfArc*2;edgePoints.push(new THREE.Vector3(Math.sin(a)*BOUGH_SWEEP.range,.012,Math.cos(a)*BOUGH_SWEEP.range));}
    edgePoints.push(new THREE.Vector3(0,.012,0));
    const edge=new THREE.Line(new THREE.BufferGeometry().setFromPoints(edgePoints),new THREE.LineBasicMaterial({color:0xffb04d,transparent:true,opacity:.9,depthWrite:false}));
    const group=new THREE.Group();group.name='mournwillow-bough-sweep-telegraph';group.add(fill,edge);group.visible=false;group.userData.fill=fill;group.userData.edge=edge;
    return group;
  }

  isInsideBoughSweep(foe,point) {
    const offset=new THREE.Vector3().subVectors(point,foe.obj.position).setY(0);
    const distance=offset.length();
    if(distance>BOUGH_SWEEP.range||distance<.05)return false;
    const forward=new THREE.Vector3(Math.sin(foe.obj.rotation.y),0,Math.cos(foe.obj.rotation.y));
    return forward.dot(offset.normalize())>=Math.cos(BOUGH_SWEEP.halfArc);
  }

  updateBoughTelegraph(foe,progress=0,striking=false) {
    const telegraph=foe.telegraph;if(!telegraph)return;
    telegraph.visible=true;
    telegraph.position.copy(foe.obj.position).setY(this.groundY(foe.obj.position)+.12);
    telegraph.rotation.y=foe.obj.rotation.y;
    const pulse=.78+.22*Math.sin(progress*Math.PI*6);
    telegraph.userData.fill.material.opacity=(striking?.5:.24+.16*progress)*pulse;
    telegraph.userData.edge.material.opacity=striking?1:.55+.4*progress;
  }

  clearEnemyAttack(foe) {
    foe.hitDone=false;foe.at=0;
    if(foe.telegraph)foe.telegraph.visible=false;
    this.clearMournwillowBombs(foe);
    const root=foe.obj?.userData?.bones?.root;if(root){root.rotation.x=0;root.rotation.y=0;}
  }

  createMournwillowBombs(foe) {
    this.clearMournwillowBombs(foe);
    const group=new THREE.Group();group.name='mournwillow-weeping-fall';group.userData.zones=[];
    const positions=[];
    const player=this.playerObj.position;
    positions.push(new THREE.Vector3(player.x+rnd(-.8,.8),0,player.z+rnd(-.8,.8)));
    for(let i=1;i<7;i++){
      let point=null;
      for(let tries=0;tries<12&&!point;tries++){
        const angle=rnd(0,Math.PI*2),radius=rnd(2.4,8.2);
        const candidate=new THREE.Vector3(foe.obj.position.x+Math.cos(angle)*radius,0,foe.obj.position.z+Math.sin(angle)*radius);
        if(this.freeAt(candidate.x,candidate.z))point=candidate;
      }
      positions.push(point||foe.obj.position.clone());
    }
    for(const point of positions){
      const fill=new THREE.Mesh(new THREE.CircleGeometry(1.45,32),new THREE.MeshBasicMaterial({color:0xb8582d,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
      const edge=new THREE.Mesh(new THREE.RingGeometry(1.24,1.48,32),new THREE.MeshBasicMaterial({color:0xffb35d,transparent:true,opacity:.72,depthWrite:false,side:THREE.DoubleSide}));
      fill.rotation.x=edge.rotation.x=-Math.PI/2;fill.position.copy(point).setY(this.groundY(point)+.1);edge.position.copy(fill.position).setY(fill.position.y+.012);
      group.add(fill,edge);group.userData.zones.push({fill,edge,point:fill.position.clone()});
    }
    this.zoneGroup.add(group);foe.bombField=group;foe.channelDuration=rnd(3,5);foe.impactDone=false;
    return group;
  }

  updateMournwillowBombs(foe,progress,impact=false) {
    const field=foe.bombField;if(!field)return;
    field.userData.zones.forEach((zone,index)=>{
      const pulse=.82+.18*Math.sin(progress*Math.PI*8+index);
      zone.fill.material.opacity=(impact?.62:.12+.3*progress)*pulse;
      zone.edge.material.opacity=impact?1:.5+.48*progress;
      const scale=impact?1.16:Math.max(.35,.65+.35*progress);zone.fill.scale.setScalar(scale);zone.edge.scale.setScalar(scale);
    });
  }

  clearMournwillowBombs(foe) {
    const field=foe?.bombField;if(!field)return;
    field.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});
    field.removeFromParent();foe.bombField=null;foe.impactDone=false;
  }

  // ---------- terrain ----------
  buildGrid(img) {
    const cv = document.createElement('canvas');
    cv.width = this.cols * 4; cv.height = this.rows * 4;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0, cv.width, cv.height);
    const px = cx.getImageData(0, 0, cv.width, cv.height).data;

    this.type = new Uint8Array(this.cols * this.rows);
    this.height = new Float32Array(this.cols * this.rows);
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
        const i = (((y * 4 + sy) * cv.width) + x * 4 + sx) * 4;
        r += px[i]; g += px[i + 1]; b += px[i + 2];
      }
      r /= 16; g /= 16; b /= 16;
      const t = classify(r, g, b), k = y * this.cols + x;
      this.type[k] = t;
      this.height[k] = t === WATER ? -1.25 : t === ROCK ? 1.15 : t === PATH ? -0.12 : 0.35;
    }
    for (let pass = 0; pass < 2; pass++) {
      const out = Float32Array.from(this.height);
      for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
        let sum = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
          sum += this.height[ny * this.cols + nx]; n++;
        }
        out[y * this.cols + x] = sum / n;
      }
      this.height = out;
    }
  }

  walkable(x, y) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return false;
    const t = this.type[y * this.cols + x];
    return t === GROUND || t === PATH;
  }

  hAt(x, y) {
    const cx = Math.min(this.cols - 1, Math.max(0, x)), cy = Math.min(this.rows - 1, Math.max(0, y));
    const x0 = Math.floor(cx), y0 = Math.floor(cy);
    const x1 = Math.min(this.cols - 1, x0 + 1), y1 = Math.min(this.rows - 1, y0 + 1);
    const fx = cx - x0, fy = cy - y0;
    const a = this.height[y0 * this.cols + x0], b = this.height[y0 * this.cols + x1];
    const c = this.height[y1 * this.cols + x0], d = this.height[y1 * this.cols + x1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }

  worldPos(x, y, lift = 0) {
    return new THREE.Vector3((x + 0.5) * TILE - this.w / 2, this.hAt(x, y) + lift, (y + 0.5) * TILE - this.h / 2);
  }
  gridOf(vx, vz) { return { x: (vx + this.w / 2) / TILE - 0.5, y: (vz + this.h / 2) / TILE - 0.5 }; }
  tileAt(v) { return { x: Math.floor((v.x + this.w / 2) / TILE), y: Math.floor((v.z + this.h / 2) / TILE) }; }
  freeAt(vx, vz) { const t = this.tileAt({ x: vx, z: vz }); return this.walkable(t.x, t.y); }
  groundY(v) { const g = this.gridOf(v.x, v.z); return this.hAt(g.x, g.y); }

  slide(obj, dir, dist) {
    const p = obj.position;
    const nx = p.x + dir.x * dist, nz = p.z + dir.z * dist;
    if (this.freeAt(nx, p.z)) p.x = nx;
    if (this.freeAt(p.x, nz)) p.z = nz;
  }

  buildAjolTerrain(atlas) {
    const geo = new THREE.PlaneGeometry(this.w, this.h, this.cols * 3, this.rows * 3);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const g = this.gridOf(pos.getX(i), pos.getZ(i));
      pos.setY(i, this.hAt(g.x, g.y));
    }
    geo.computeVertexNormals();

    atlas.color.colorSpace = THREE.SRGBColorSpace;
    atlas.color.wrapS = atlas.color.wrapT = THREE.ClampToEdgeWrapping;
    if(atlas.normal){atlas.normal.colorSpace = THREE.NoColorSpace;atlas.normal.wrapS = atlas.normal.wrapT = THREE.ClampToEdgeWrapping;}
    if(atlas.bump){atlas.bump.colorSpace = THREE.NoColorSpace;atlas.bump.wrapS = atlas.bump.wrapT = THREE.ClampToEdgeWrapping;}
    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    atlas.color.anisotropy = Math.min(aniso, 12);
    if(atlas.normal)atlas.normal.anisotropy = Math.min(aniso, 8);
    if(atlas.bump)atlas.bump.anisotropy = Math.min(aniso, 8);

    const mat = new THREE.MeshStandardMaterial({
      map: atlas.color,
      normalMap: atlas.normal || null,
      normalScale: new THREE.Vector2(0.62, 0.62),
      bumpMap: atlas.bump || null,
      bumpScale: atlas.bump ? 0.16 : 0,
      roughness: 0.9,
      metalness: 0.015,
      color: 0xffffff
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'terrain-ajol-stitched';
    mesh.receiveShadow = true;
    this.zoneGroup.add(mesh);
    this.terrain = mesh;

    const under = new THREE.Mesh(
      new THREE.PlaneGeometry(this.w, this.h, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x0d140f, roughness: 1 })
    );
    under.rotation.x = -Math.PI / 2;
    under.position.y = -1.45;
    this.zoneGroup.add(under);

    const skirt = new THREE.Mesh(
      new THREE.BoxGeometry(this.w, 8, this.h),
      new THREE.MeshStandardMaterial({ color: 0x1a1611, roughness: 1 })
    );
    skirt.position.y = -5.2;
    skirt.receiveShadow = true;
    this.zoneGroup.add(skirt);
  }

  buildTerrain(surfaceTex) {
    const geo = new THREE.PlaneGeometry(this.w, this.h, this.cols * 3, this.rows * 3);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const g = this.gridOf(p.getX(i), p.getZ(i));
      p.setY(i, this.hAt(g.x, g.y));
    }
    geo.computeVertexNormals();

    const tex = surfaceTex.clone();
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(2.4, this.cols / 7.5), Math.max(2.4, this.rows / 7.5));
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    tex.needsUpdate = true;

    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: this.zone.id === 'ember' ? 0.92 : 0.97,
      metalness: 0.03,
      color: this.zone.id === 'ember' ? 0xf4e4d8 : this.zone.id === 'steppe' ? 0xf4ecd7 : 0xffffff
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'terrain';
    mesh.receiveShadow = true;
    this.zoneGroup.add(mesh);
    this.terrain = mesh;

    const under = new THREE.Mesh(
      new THREE.PlaneGeometry(this.w, this.h, 1, 1),
      new THREE.MeshStandardMaterial({ color: this.zone.id === 'ember' ? 0x140d0a : this.zone.id === 'steppe' ? 0x2f241c : 0x0d140f, roughness: 1 })
    );
    under.rotation.x = -Math.PI / 2;
    under.position.y = -1.45;
    this.zoneGroup.add(under);

    const skirt = new THREE.Mesh(new THREE.BoxGeometry(this.w, 8, this.h), new THREE.MeshStandardMaterial({ color: 0x1a1611, roughness: 1 }));
    skirt.position.y = -5.2;
    skirt.receiveShadow = true;
    this.zoneGroup.add(skirt);
  }

  buildWater() {
    const geo = new THREE.PlaneGeometry(this.w, this.h, 72, 72);
    geo.rotateX(-Math.PI / 2);
    const palettes = {
      hearth: { color: 0x27494a, emissive: 0x163334, opacity: 0.72 },
      fords: { color: 0x31595b, emissive: 0x183739, opacity: 0.78 },
      steppe: { color: 0x6f5532, emissive: 0x2a1c10, opacity: 0.54 },
      ember: { color: 0x2a1a14, emissive: 0x3b160a, opacity: 0.62 }
    }[this.zone.id] || { color: 0x183e3f, emissive: 0x102021, opacity: 0.66 };
    const mat = new THREE.MeshPhysicalMaterial({
      color: palettes.color,
      emissive: palettes.emissive,
      emissiveIntensity: this.zone.id === 'ember' ? 0.32 : 0.12,
      transparent: true,
      opacity: palettes.opacity,
      roughness: this.zone.id === 'steppe' ? 0.3 : 0.18,
      metalness: 0.05,
      clearcoat: 0.72,
      clearcoatRoughness: 0.22,
      transmission: 0.04,
      side: THREE.DoubleSide
    });
    const water = new THREE.Mesh(geo, mat);
    water.name = 'water';
    water.position.y = -0.42;
    water.receiveShadow = true;
    this.zoneGroup.add(water);
    this.water = water;
    this.waterBase = Float32Array.from(geo.attributes.position.array);
  }

  buildRealmHorizon() {
    // Shared instanced terrain surrounds the unwalkable edges of each realm.
    const colors={hearth:[0x242c22,0x333b2c],fords:[0x202f2c,0x344038],steppe:[0x554534,0x6d5941],ember:[0x291b18,0x483028]}[this.zone.id];
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(this.w+110,this.h+110),new THREE.MeshBasicMaterial({color:colors[0],side:THREE.DoubleSide}));
    floor.name='distant-land';floor.rotation.x=-Math.PI/2;floor.position.y=-1.8;this.zoneGroup.add(floor);
    const rim=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshStandardMaterial({color:colors[1],roughness:1,flatShading:true}),64);
    rim.name='distant-rim';rim.castShadow=false;rim.receiveShadow=false;
    const m=new THREE.Matrix4(),q=new THREE.Quaternion(),pos=new THREE.Vector3(),scale=new THREE.Vector3(),axis=new THREE.Vector3(0,1,0);
    for(let i=0;i<64;i++){
      const side=Math.floor(i/16),v=-0.54+(i%16)*1.08/15,r=((i*811+side*131)%17)/17,offset=2.8+r*3;
      pos.set(side===0?-this.w/2-offset:side===1?this.w/2+offset:v*this.w,-0.2+r*0.7,side===2?-this.h/2-offset:side===3?this.h/2+offset:v*this.h);
      scale.set(3.3+r*2.5,2.1+r*2.6,3.4+r*2.8);q.setFromAxisAngle(axis,r*6.28);m.compose(pos,q,scale);rim.setMatrixAt(i,m);
    }
    rim.instanceMatrix.needsUpdate=true;rim.computeBoundingSphere();this.zoneGroup.add(rim);
  }

  buildProps() {
    const rockSpots = [], groundSpots = [], pathSpots = [], waterEdge = [];
    for (let y = 1; y < this.rows - 1; y++) for (let x = 1; x < this.cols - 1; x++) {
      const t = this.type[y * this.cols + x];
      if (t === ROCK && (x * 7 + y * 3) % 3 === 0) rockSpots.push([x, y]);
      if ((t === GROUND || t === PATH) && ((x * 19 + y * 23) % 17 === 0)) groundSpots.push([x, y]);
      if (t === PATH && ((x * 13 + y * 9) % 11 === 0)) pathSpots.push([x, y]);
      if ((t === GROUND || t === PATH)) {
        const nearWater = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => this.type[(y+dy)*this.cols + (x+dx)] === WATER);
        if (nearWater && ((x * 11 + y * 7) % 5 === 0)) waterEdge.push([x,y]);
      }
    }

    const stoneMat = new THREE.MeshStandardMaterial({ color: this.zone.id === 'steppe' ? 0x7e6c5b : this.zone.id === 'ember' ? 0x4a3d36 : 0x56564f, roughness: 0.98, flatShading: true });
    const count = Math.min(rockSpots.length, 220);
    const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), stoneMat, count);
    rocks.name = 'boulders'; rocks.castShadow = false; rocks.receiveShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < count; i++) {
      const [x, y] = rockSpots[i];
      const r = ((x * 92821 + y * 68917) % 1000) / 1000;
      const sc = 0.38 + r * 1.35;
      e.set(r * 2.2, r * 6, r * 1.4); q.setFromEuler(e);
      m.compose(this.worldPos(x, y, -0.2), q, new THREE.Vector3(sc * 1.25, sc * 0.72, sc));
      rocks.setMatrixAt(i, m);
    }
    this.zoneGroup.add(rocks);

    const groundLimit = this.zone.id === 'hearth' ? 40 : this.zone.id === 'fords' ? 58 : 62;
    const ajolTreeSpots=[];
    for (let i = 0; i < Math.min(groundSpots.length, groundLimit); i++) {
      const [x,y] = groundSpots[i];
      const r = ((x*811 + y*131) % 1000) / 1000;
      if (this.zone.id === 'fords') {
        // Mature willows favor saturated ground but stay clear enough for traversal/readability.
        if (r > 0.72 && i % 3 === 0) this.placeWillowModel(x, y, 0.72 + r * 0.58);
        else if (r > 0.42) this.willowTree(x, y, 0.62 + r * 0.62);
        else if (r > 0.2) this.rootMound(x, y, 0.56 + r * 0.52);
        else this.mushroomCluster(x, y, 0.52 + r * 0.42, false);
      } else if (this.zone.id === 'hearth') {
        if (r > 0.66) ajolTreeSpots.push([x,y,r,i]);
        else if (r > 0.34) this.rootMound(x, y, 0.55 + r * 0.5);
        else this.mushroomCluster(x, y, 0.52 + r * 0.4, false);
      } else if (this.zone.id === 'steppe') {
        if (r > 0.55) this.mesaPillar(x, y, 0.75 + r * 0.85);
        else if (r > 0.3) this.dryShrub(x, y, 0.6 + r * 0.55);
        else this.steamVent(x, y, 0.65 + r * 0.5);
      } else {
        // Keep Emberpood's center readable. Imported mushrooms are concentrated into the outer corners below.
        if (r > 0.56) this.charredSpire(x, y, 0.82 + r * 1.18);
        else if (r > 0.23) this.lavaVent(x, y, 0.65 + r * 0.48);
        else this.dryShrub(x, y, 0.45 + r * 0.34);
      }
    }
    if (ajolTreeSpots.length) this.buildAjolTreeInstances(ajolTreeSpots);
    if (this.zone.id === 'ember' && this.modelAssets?.mushroom) this.buildEmberMushroomGroves();
    waterEdge.slice(0, this.zone.id === 'fords' ? 54 : 38).forEach(([x,y],i) => {
      const n = ((i * 37) % 50) / 100;
      this.reedClump(x,y,0.7 + n);
      if ((i % 3) === 0 && this.zone.id !== 'steppe' && this.zone.id !== 'ember') this.lilyPatch(x, y, 0.7 + n);
    });
    if (this.zone.id === 'fords' && this.modelAssets?.willow) {
      const picked = [];
      for (const [x,y] of waterEdge) {
        if (picked.length >= 8) break;
        if ((x * 17 + y * 13) % 4 !== 0) continue;
        if (picked.some(([px,py]) => Math.hypot(px-x, py-y) < 5.2)) continue;
        picked.push([x,y]);
        const r = ((x * 97 + y * 53) % 100) / 100;
        this.placeWillowModel(x, y, 0.82 + r * 0.48);
      }
    }
    pathSpots.slice(0, this.zone.id === 'fords' ? 12 : 8).forEach(([x,y],i) => {
      if (this.zone.id === 'fords' || this.zone.id === 'hearth') this.ruinMarker(x, y, 0.8 + (i % 4) * 0.12);
      else if (this.zone.id === 'steppe' && i % 2 === 0) this.ruinMarker(x, y, 0.78 + (i % 5) * 0.1, true);
    });
    this.buildAmbientParticles();
  }

  placeEmberMushroomModel(x, y, targetHeight=3, seed=0) {
    const mushroom = this.cloneModelAsset('mushroom', targetHeight, { axis: 'y' });
    if (!mushroom) return null;
    const pos = this.worldPos(x, y, 0.015);
    mushroom.position.add(pos);
    mushroom.rotation.y = ((seed * 73 + x * 31 + y * 47) % 360) * Math.PI / 180;
    const widthVariation = 0.90 + ((seed * 19 + x * 7 + y * 11) % 24) / 100;
    mushroom.scale.x *= widthVariation;
    mushroom.scale.z *= 0.92 + ((seed * 13 + x * 5 + y * 17) % 20) / 100;
    mushroom.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = targetHeight >= 5.8;
      o.receiveShadow = true;
      o.userData.modelAsset = 'mushroom';
    });
    mushroom.userData.emberMushroom = true;
    mushroom.userData.targetHeight = targetHeight;
    this.zoneGroup.add(mushroom);
    return mushroom;
  }

  buildEmberMushroomGroves() {
    const depthX = Math.max(9, Math.floor(this.cols * 0.31));
    const depthY = Math.max(9, Math.floor(this.rows * 0.31));
    const corners = [
      {x0:1,x1:depthX,y0:1,y1:depthY,seed:11},
      {x0:this.cols-depthX-1,x1:this.cols-2,y0:1,y1:depthY,seed:23},
      {x0:1,x1:depthX,y0:this.rows-depthY-1,y1:this.rows-2,seed:37},
      {x0:this.cols-depthX-1,x1:this.cols-2,y0:this.rows-depthY-1,y1:this.rows-2,seed:53}
    ];
    for (const corner of corners) {
      const candidates=[];
      for(let y=corner.y0;y<=corner.y1;y++) for(let x=corner.x0;x<=corner.x1;x++) {
        const t=this.type[y*this.cols+x];
        if(t===WATER || t===PATH) continue;
        const hash=(x*92821+y*68917+corner.seed*811)%10000;
        candidates.push({x,y,hash});
      }
      candidates.sort((a,b)=>a.hash-b.hash);
      const chosen=[];
      for(const c of candidates){
        if(chosen.length>=7) break;
        const minSpace=chosen.length===0?4.5:2.6;
        if(chosen.some(p=>Math.hypot(p.x-c.x,p.y-c.y)<minSpace)) continue;
        chosen.push(c);
      }
      chosen.forEach((c,i)=>{
        let height;
        if(i===0) height=10.5 + ((c.hash+corner.seed)%31)/10;       // 10.5–13.5: landmark giant
        else if(i<=2) height=5.2 + ((c.hash+i*17)%22)/10;          // 5.2–7.3: major cluster
        else height=2.2 + ((c.hash+i*29)%23)/10;                  // 2.2–4.4: supporting mushrooms
        this.placeEmberMushroomModel(c.x,c.y,height,corner.seed+i*7);
      });
    }
  }

  placeWillowModel(x, y, scale=1) {
    const tree = this.cloneModelAsset('willow', 6.8 * scale, { axis: 'y' });
    if (!tree) return this.willowTree(x, y, scale);
    const pos = this.worldPos(x, y, 0.01);
    tree.position.add(pos);
    tree.rotation.y = ((x * 29 + y * 41) % 360) * Math.PI / 180;
    this.zoneGroup.add(tree);
    return tree;
  }

  placeAjolTreeModel(x, y, sizeSeed=0.5, index=0) {
    // Stable pseudo-random variation keeps A'jol visually varied without trees
    // changing size or orientation every time the realm is rebuilt.
    const hash = (x * 92821 + y * 68917 + index * 811) >>> 0;
    const heightVariation = 5.1 + (((hash % 1000) / 999) * 2.9); // 5.1–8.0 world units
    const tree = this.cloneModelAsset('ajolTree', heightVariation, { axis: 'y' });
    if (!tree) return this.willowTree(x, y, 0.55 + sizeSeed * 0.58);
    tree.position.add(this.worldPos(x, y, 0.01));
    tree.rotation.y = (((hash >>> 3) % 360) * Math.PI) / 180;
    const widthX = 0.91 + (((hash >>> 7) % 18) / 100);
    const widthZ = 0.91 + (((hash >>> 12) % 18) / 100);
    tree.scale.x *= widthX;
    tree.scale.z *= widthZ;
    tree.traverse(o=>{if(o.isMesh){o.material=(Array.isArray(o.material)?o.material:[o.material]).map(source=>{const mat=source.clone();mat.color.multiply(new THREE.Color(0xb29b83));if(mat.emissive)mat.emissive.multiplyScalar(0.55);return mat;});if(o.material.length===1)o.material=o.material[0];}});
    tree.userData.ajolTree = true;
    tree.userData.targetHeight = heightVariation;
    this.zoneGroup.add(tree);
    return tree;
  }

  buildAjolTreeInstances(spots) {
    const prototype = this.cloneModelAsset('ajolTree', 1, {axis:'y'});
    if (!prototype) {
      spots.forEach(([x,y,r,i]) => this.placeAjolTreeModel(x,y,r,i));
      return;
    }
    prototype.updateMatrixWorld(true);
    const pieces=[];
    prototype.traverse(o=>{if(o.isMesh) pieces.push(o);});
    const batches=pieces.map((piece,index)=>{
      const materials=(Array.isArray(piece.material)?piece.material:[piece.material]).map(source=>{
        const mat=source.clone();
        mat.color.multiply(new THREE.Color(0xb29b83));
        if (mat.emissive) mat.emissive.multiplyScalar(0.55);
        mat.needsUpdate=true;
        return mat;
      });
      const batch=new THREE.InstancedMesh(piece.geometry,Array.isArray(piece.material)?materials:materials[0],spots.length);
      batch.name=`ajol-tree-${index}`;
      batch.userData.modelAsset='ajolTree';
      batch.userData.ajolTintMaterial=true;
      batch.castShadow=false;
      batch.receiveShadow=true;
      this.zoneGroup.add(batch);
      return batch;
    });
    const transform=new THREE.Matrix4(),instance=new THREE.Matrix4();
    const rotation=new THREE.Quaternion(),euler=new THREE.Euler();
    spots.forEach(([x,y,r,i],slot)=>{
      const hash=(x*92821+y*68917+i*811)>>>0;
      const height=5.1+(hash%1000)/999*2.9;
      euler.set(0,((hash>>>3)%360)*Math.PI/180,0);
      rotation.setFromEuler(euler);
      transform.compose(this.worldPos(x,y,0.01),rotation,new THREE.Vector3(
        height*(.91+((hash>>>7)%18)/100),height,height*(.91+((hash>>>12)%18)/100)));
      pieces.forEach((piece,j)=>{
        instance.multiplyMatrices(transform,piece.matrixWorld);
        batches[j].setMatrixAt(slot,instance);
      });
    });
    batches.forEach(batch=>{batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();});
    this.ajolTreeBatches=batches;
  }

  willowTree(x, y, scale=1) {
    const g = new THREE.Group();
    const bark = new THREE.MeshStandardMaterial({ color: 0x3c3126, roughness: 1, flatShading: true });
    const moss = new THREE.MeshStandardMaterial({ color: 0x515b33, roughness: 1, flatShading: true, side: THREE.DoubleSide });
    const amber = new THREE.MeshStandardMaterial({ color: 0xd8a45b, emissive: 0xb56f1f, emissiveIntensity: 0.8, roughness: 0.35 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.62,4.2,8), bark); trunk.position.y=2.05; trunk.castShadow=true; trunk.rotation.z=(Math.random()-.5)*0.12; g.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 10), bark); crown.scale.set(1.3,0.85,1.1); crown.position.set(0,4.35,0); crown.castShadow=true; g.add(crown);
    for (let i=0;i<5;i++) {
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.15,1.35,6), bark);
      root.position.set((i-2)*0.28,0.45, (i%2?0.25:-0.2));
      root.rotation.z = (i-2) * 0.4; root.rotation.x = (i%2?1:-1) * 0.18;
      root.castShadow = true; g.add(root);
    }
    const strands = [];
    for (let i=0;i<14;i++) {
      const fr = new THREE.Mesh(new THREE.PlaneGeometry(0.22 + Math.random()*0.12, 1.5 + Math.random()*1.8), moss);
      fr.position.set(Math.cos(i/14*Math.PI*2)*0.85, 3.45 - Math.random()*0.2, Math.sin(i/14*Math.PI*2)*0.75);
      fr.rotation.y = Math.random()*Math.PI;
      fr.rotation.z = (Math.random()-.5)*0.14;
      fr.castShadow = true; g.add(fr); strands.push(fr);
      if (i % 4 === 0) {
        const sap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), amber);
        sap.scale.y = 1.4; sap.position.set(fr.position.x + (Math.random()-.5)*0.08, fr.position.y - fr.geometry.parameters.height * 0.52, fr.position.z);
        g.add(sap);
      }
    }
    g.userData.fronds = strands;
    g.position.copy(this.worldPos(x,y)); g.scale.setScalar(scale); this.zoneGroup.add(g); return g;
  }

  rootMound(x, y, scale=1) {
    const g = new THREE.Group();
    const bark = new THREE.MeshStandardMaterial({ color: 0x45362a, roughness: 1, flatShading: true });
    const soil = new THREE.MeshStandardMaterial({ color: 0x4f4a34, roughness: 1, flatShading: true });
    const base = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), soil); base.scale.set(1.4,0.7,1.1); base.position.y=0.22; g.add(base);
    for (let i=0;i<4;i++) { const root = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.12,1.2,6), bark); root.position.set((Math.random()-.5)*0.6,0.38,(Math.random()-.5)*0.6); root.rotation.z=(Math.random()-.5)*1.2; root.rotation.y=Math.random()*Math.PI; root.castShadow=true; g.add(root); }
    g.position.copy(this.worldPos(x,y)); g.scale.setScalar(scale); this.zoneGroup.add(g);
  }

  reedClump(x,y,scale=1) {
    const g=new THREE.Group(); const mat=new THREE.MeshStandardMaterial({color:this.zone.id==='steppe'?0x98855f:0x7f8450,roughness:1,side:THREE.DoubleSide});
    for(let i=0;i<7;i++){ const r=new THREE.Mesh(new THREE.PlaneGeometry(0.12,1.5+Math.random()*0.8),mat); r.position.set((Math.random()-.5)*0.55,0.75,(Math.random()-.5)*0.55); r.rotation.y=Math.random()*Math.PI; r.rotation.z=(Math.random()-.5)*0.18; g.add(r); }
    g.position.copy(this.worldPos(x,y,0.02)); g.scale.setScalar(scale); this.zoneGroup.add(g);
  }

  lilyPatch(x,y,scale=1) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b7e3c, roughness: 0.95, side: THREE.DoubleSide });
    for (let i=0;i<4 + Math.floor(Math.random()*4);i++) {
      const d = new THREE.Mesh(new THREE.CircleGeometry(0.18 + Math.random()*0.15, 12), mat);
      d.rotation.x = -Math.PI / 2; d.position.set((Math.random()-.5)*0.9, -0.1 + Math.random()*0.02, (Math.random()-.5)*0.9); g.add(d);
    }
    g.position.copy(this.worldPos(x,y,-0.2)); g.scale.setScalar(scale); this.zoneGroup.add(g);
  }

  mushroomCluster(x,y,scale=1,glow=false) {
    const g=new THREE.Group();
    for (let i=0;i<2 + Math.floor(Math.random()*3);i++) {
      const h = 0.4 + Math.random()*0.45;
      const stem=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.1,h,8),new THREE.MeshStandardMaterial({color:0x8d7d69,roughness:0.95})); stem.position.set((Math.random()-.5)*0.35,h/2,(Math.random()-.5)*0.35); g.add(stem);
      const capMat=new THREE.MeshStandardMaterial({color:this.zone.id==='ember'?0xa75128:0x7f5a3d,roughness:.78,emissive:glow?0x351408:0x000000,emissiveIntensity:glow?.55:0});
      const a=new THREE.Mesh(new THREE.SphereGeometry(.22 + Math.random()*0.18,10,8,0,Math.PI*2,0,Math.PI*.55),capMat); const b=a.clone(); a.position.copy(stem.position).add(new THREE.Vector3(-.08,h*.55,0)); b.position.copy(stem.position).add(new THREE.Vector3(.08,h*.55,0)); a.scale.set(1.05,.7,1);b.scale.set(1.05,.7,1); g.add(a,b);
    }
    g.position.copy(this.worldPos(x,y));g.scale.setScalar(scale);this.zoneGroup.add(g);
  }

  emberFungus(x,y,scale=1) {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.28,1.4,10), new THREE.MeshStandardMaterial({ color: 0x5f4332, roughness: 0.9 }));
    stem.position.y = 0.72; stem.castShadow = true; g.add(stem);
    const mat = new THREE.MeshStandardMaterial({ color: 0xa7522a, roughness: 0.5, emissive: 0xff5f1e, emissiveIntensity: 0.85 });
    const left = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), mat);
    const right = left.clone(); left.position.set(-0.34,1.55,0); right.position.set(0.34,1.55,0); left.scale.set(1.08,0.72,1); right.scale.set(1.08,0.72,1); left.castShadow = true; right.castShadow = true; g.add(left,right);
    g.position.copy(this.worldPos(x,y)); g.scale.setScalar(scale); this.zoneGroup.add(g);
  }

  charredSpire(x,y,scale=1) {
    const mat=new THREE.MeshStandardMaterial({color:0x2b2927,roughness:1,flatShading:true}); const g=new THREE.Group();
    const t=new THREE.Mesh(new THREE.CylinderGeometry(.12,.34,3.2,6),mat);t.position.y=1.6;t.castShadow=true;g.add(t);
    for(let i=0;i<2;i++){const b=new THREE.Mesh(new THREE.CylinderGeometry(.05,.09,1.3,5),mat);b.position.set(0,2.45,0);b.rotation.z=(i?1:-1)*.75;g.add(b)}
    g.position.copy(this.worldPos(x,y));g.scale.setScalar(scale);this.zoneGroup.add(g);
  }

  mesaPillar(x,y,scale=1) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x826347, roughness: 0.98, flatShading: true });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.54,1.4,7), mat); base.position.y = 0.7; base.castShadow = true; g.add(base);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.58,0.62,0.4,9), new THREE.MeshStandardMaterial({ color: 0xa37b52, roughness: 0.92 })); top.position.y = 1.58; top.castShadow = true; g.add(top);
    g.position.copy(this.worldPos(x,y)); g.scale.setScalar(scale); this.zoneGroup.add(g);
  }

  dryShrub(x,y,scale=1) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xa08b4d, roughness: 1, side: THREE.DoubleSide });
    for (let i=0;i<5;i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35 + Math.random()*0.25), mat);
      p.position.set((Math.random()-.5)*0.3,0.18,(Math.random()-.5)*0.3); p.rotation.y=Math.random()*Math.PI; p.rotation.z=(Math.random()-.5)*0.8; g.add(p);
    }
    g.position.copy(this.worldPos(x,y)); g.scale.setScalar(scale); this.zoneGroup.add(g);
  }

  ruinMarker(x,y,scale=1,steppe=false) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: steppe ? 0x8a7a66 : 0x5d5a53, roughness: 1, flatShading: true });
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.42,1.8,0.42), mat); shaft.position.y = 0.92; shaft.castShadow = true; g.add(shaft);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.56,0.18,0.56), mat); cap.position.y = 1.84; g.add(cap);
    g.position.copy(this.worldPos(x,y)); g.scale.setScalar(scale); this.zoneGroup.add(g);
  }

  steamVent(x,y,scale=1) {
    const g = new THREE.Group();
    const pit = new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.5,0.22,12), new THREE.MeshStandardMaterial({ color: 0x8f6b46, roughness: 0.9 }));
    pit.position.y = 0.05; g.add(pit);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.32, 16), new THREE.MeshStandardMaterial({ color: 0xc48a53, emissive: 0x8b5a26, emissiveIntensity: 0.4, side: THREE.DoubleSide }));
    pool.rotation.x = -Math.PI/2; pool.position.y = 0.17; g.add(pool);
    g.position.copy(this.worldPos(x,y)); g.scale.setScalar(scale); this.zoneGroup.add(g);
  }

  lavaVent(x,y,scale=1) {
    const g = new THREE.Group();
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.45,0.36,8), new THREE.MeshStandardMaterial({ color: 0x362720, roughness: 1 })); rock.position.y = 0.18; g.add(rock);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), new THREE.MeshStandardMaterial({ color: 0xff7a30, emissive: 0xff6a21, emissiveIntensity: 1.4, side: THREE.DoubleSide })); glow.rotation.x = -Math.PI/2; glow.position.y = 0.38; g.add(glow);
    g.position.copy(this.worldPos(x,y)); g.scale.setScalar(scale); this.zoneGroup.add(g);
  }

  buildAmbientParticles() {
    this.ambientFX=[];
    const n=this.zone.id==='hearth'?34:52;
    for(let i=0;i<n;i++){
      const color = this.zone.id==='ember'?0xff8b4a:this.zone.id==='steppe'?0xd7c2a2:0xe0c278;
      const mat=new THREE.SpriteMaterial({color,transparent:true,opacity:this.zone.id==='steppe'?.2:.5,depthWrite:false});
      const sp=new THREE.Sprite(mat);sp.scale.set(this.zone.id==='steppe'?0.22:0.16, this.zone.id==='steppe'?0.22:0.16, 1);
      sp.position.set(rnd(-this.w*.42,this.w*.42),rnd(.7,5.5),rnd(-this.h*.42,this.h*.42));
      this.zoneGroup.add(sp);this.ambientFX.push({sp,phase:rnd(0,6.28),speed:rnd(.2,.6),kind:'mote'});
    }
    this.mistFX=[];
    const mistCount = this.zone.id === 'ember' ? 8 : 14;
    for (let i=0;i<mistCount;i++) {
      const mat = new THREE.SpriteMaterial({ color: this.zone.id === 'ember' ? 0x6e4b3f : 0xe6e9df, transparent: true, opacity: this.zone.id === 'steppe' ? 0.08 : 0.12, depthWrite: false });
      const sp = new THREE.Sprite(mat);
      const sc = this.zone.id === 'hearth' || this.zone.id === 'fords' ? rnd(4.5, 8.5) : rnd(3.6, 6.5);
      sp.scale.set(sc, sc * 0.55, 1);
      sp.position.set(rnd(-this.w*.46,this.w*.46), rnd(0.5,2.3), rnd(-this.h*.46,this.h*.46));
      this.zoneGroup.add(sp);
      this.mistFX.push({ sp, phase: rnd(0, 6.28), speed: rnd(0.08, 0.2) });
    }
  }

  // ---------- hearth crossroads set-dressing ----------
  addInteract(id, name, verb, obj, radius, action) {
    this.interactables.push({ id, name, verb, obj, radius, action, cool: 0 });
  }

  simpleTree(x, y, scale) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x3a2c20, roughness: 1 }));
    trunk.position.y = 0.8; trunk.castShadow = true; g.add(trunk);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.1, 7), new THREE.MeshStandardMaterial({ color: 0x2d3a22, roughness: 0.95 }));
    canopy.position.y = 2.2; canopy.castShadow = true; g.add(canopy);
    g.scale.setScalar(scale || 1);
    g.position.copy(this.worldPos(x, y));
    this.zoneGroup.add(g);
    return g;
  }

  buildHearthFeatures() {
    const at = (fx, fy) => this.nearestWalkable(Math.round(this.cols * fx), Math.round(this.rows * fy)) || { x: Math.round(this.cols * fx), y: Math.round(this.rows * fy) };

    // The authored crossroads texture centers the shrine near its Pootal approach.
    const cPos = at(0.5, 0.50);
    const fountainGroup = new THREE.Group();
    const fountainModel = this.cloneModelAsset('fountain', 5.6);
    if (fountainModel) {
      fountainModel.rotation.y = Math.PI * 0.08;
      fountainGroup.add(fountainModel);
    } else {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.7, 0.55, 18), new THREE.MeshStandardMaterial({ color: 0x575249, roughness: 0.92 }));
      base.position.y = 0.27; base.castShadow = true; base.receiveShadow = true; fountainGroup.add(base);
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.44, 1.8, 12), new THREE.MeshStandardMaterial({ color: 0x635e54, roughness: 0.88 }));
      column.position.y = 1.18; column.castShadow = true; fountainGroup.add(column);
    }
    const waterGlow = new THREE.Mesh(new THREE.CircleGeometry(1.42, 32), new THREE.MeshPhysicalMaterial({ color: 0x557f83, emissive: 0x244a50, emissiveIntensity: 0.58, transparent: true, opacity: 0.68, roughness: 0.16, clearcoat: 0.55, side: THREE.DoubleSide }));
    waterGlow.rotation.x = -Math.PI / 2; waterGlow.position.y = 0.42; fountainGroup.add(waterGlow);
    const glow = new THREE.PointLight(0x73c8d2, 1.55, 9); glow.position.y = 1.35; fountainGroup.add(glow);
    fountainGroup.position.copy(this.worldPos(cPos.x, cPos.y));
    fountainGroup.userData.glow = glow;
    fountainGroup.userData.waterGlow = waterGlow;
    this.zoneGroup.add(fountainGroup);
    this.hearthCrystal = fountainGroup;
    this.addInteract('crystal', 'the Brownwell fountain', 'Commune with', fountainGroup, 4.1, () => this.levelUp());

    const mPos = at(0.22, 0.42);
    const merchant = this.buildTraderBillboard();
    merchant.position.copy(this.worldPos(mPos.x, mPos.y));
    this.zoneGroup.add(merchant);
    this.merchantBillboard = merchant;
    const stall = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 1.4), new THREE.MeshStandardMaterial({ color: 0x6b5a3f, roughness: 0.9 })); top.position.y = 1.5; top.castShadow = true; stall.add(top);
    [-0.95,0.95].forEach(dx => { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.09,1.5,6), new THREE.MeshStandardMaterial({ color: 0x5d4c34, roughness: 1 })); post.position.set(dx,0.75,-0.5); post.castShadow = true; stall.add(post); });
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.2), new THREE.MeshStandardMaterial({ color: 0x625739, roughness: 1, side: THREE.DoubleSide })); cloth.position.set(0,1.15,0.22); cloth.rotation.x = -0.2; stall.add(cloth);
    stall.position.copy(merchant.position).add(new THREE.Vector3(-1.5,0,0)); this.zoneGroup.add(stall);
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 1 }));
    bag.scale.set(1, 1.2, 0.9); bag.position.copy(merchant.position).add(new THREE.Vector3(0.8, 0.5, 0.05)); bag.castShadow = true; this.zoneGroup.add(bag);
    this.addInteract('merchant', 'the merchant', 'Trade with', merchant, 3.6, () => this.tradeWithMerchant());

    const tPos = at(0.23, 0.2);
    const tentOrigin = this.worldPos(tPos.x, tPos.y);
    const tent = new THREE.Group();
    const teepee = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2.1, 4), new THREE.MeshStandardMaterial({ color: 0x736751, roughness: 1 })); teepee.rotation.y = Math.PI / 4; teepee.position.y = 1.05; teepee.castShadow = true; tent.add(teepee);
    const entrance = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), new THREE.MeshStandardMaterial({ color: 0x473a2c, side: THREE.DoubleSide })); entrance.position.set(0,0.72,1.12); tent.add(entrance);
    tent.position.copy(tentOrigin); this.zoneGroup.add(tent);
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.55, 8), new THREE.MeshStandardMaterial({ color: 0xd94f2b, emissive: 0xd94f2b, emissiveIntensity: 2.4 }));
    fire.position.copy(tentOrigin).add(new THREE.Vector3(1.8, 0.28, 0.6)); this.zoneGroup.add(fire);
    const fireLight = new THREE.PointLight(0xd9752b, 1.8, 8); fireLight.position.copy(fire.position).add(new THREE.Vector3(0, 0.45, 0)); this.zoneGroup.add(fireLight);
    this.addInteract('tent', 'the rest tent', 'Rest at', tent, 3.6, () => this.restAtTent());

    const dPositions = [at(0.26, 0.72), at(0.36, 0.76)];
    dPositions.forEach(dp => {
      const dummy = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.7, 6), new THREE.MeshStandardMaterial({ color: 0x6b5a3f, roughness: 1 })); post.position.y = 0.85; dummy.add(post);
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0x9c8a5f, roughness: 1 })); torso.position.y = 1.55; dummy.add(torso);
      const arms = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.3, 6), new THREE.MeshStandardMaterial({ color: 0x6b5a3f, roughness: 1 })); arms.rotation.z = Math.PI / 2; arms.position.y = 1.75; dummy.add(arms);
      dummy.position.copy(this.worldPos(dp.x, dp.y)); dummy.castShadow = true; this.zoneGroup.add(dummy);
    });

    const aPos = at(0.74, 0.74);
    const anvilOrigin = this.worldPos(aPos.x, aPos.y);
    const forgeBox = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 1.2), new THREE.MeshStandardMaterial({ color: 0x3a3630, roughness: 0.9 })); forgeBox.position.copy(anvilOrigin).add(new THREE.Vector3(-1.7, 0.55, 0)); forgeBox.castShadow = true; this.zoneGroup.add(forgeBox);
    const coals = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.16, 0.54), new THREE.MeshStandardMaterial({ color: 0xd9752b, emissive: 0xd94f2b, emissiveIntensity: 2.6 })); coals.position.copy(forgeBox.position).add(new THREE.Vector3(0, 0.6, 0)); this.zoneGroup.add(coals);
    const forgeLight = new THREE.PointLight(0xd9752b, 2.1, 8); forgeLight.position.copy(coals.position).add(new THREE.Vector3(0, 0.5, 0)); this.zoneGroup.add(forgeLight);
    const anvilBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.4 })); anvilBase.position.copy(anvilOrigin).add(new THREE.Vector3(0, 0.25, 0)); anvilBase.castShadow = true; this.zoneGroup.add(anvilBase);
    const anvilTop = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.28, 0.44), new THREE.MeshStandardMaterial({ color: 0x232323, roughness: 0.4, metalness: 0.6 })); anvilTop.position.copy(anvilOrigin).add(new THREE.Vector3(0, 0.62, 0)); anvilTop.castShadow = true; this.zoneGroup.add(anvilTop);
    this.addInteract('anvil', 'the anvil', 'Work', anvilBase, 3.4, () => this.workAnvil());

    this.buildPootal(.5,.14);
  }

  buildTraderBillboard() {
    const asset = this.textureAssets?.trader;
    if (!asset) {
      const fallback = this.figure(0x8a6a44, 0x5c4a30, 0x8fae7a, 0xe7c98a, 0x7a6248);
      fallback.scale.setScalar(1.1);
      fallback.userData.arm.rotation.x = -0.9;
      return fallback;
    }
    const group = new THREE.Group();
    group.name = 'ajol-trader-billboard';
    const height = 3.65, width = height * asset.aspect;
    const geometry = new THREE.PlaneGeometry(width, height);
    const backMaterial = new THREE.MeshBasicMaterial({ map: asset.mask, color: 0x3b2619, transparent: true, alphaTest: 0.06, side: THREE.DoubleSide });
    [-0.09, -0.045].forEach((z, i) => {
      const backing = new THREE.Mesh(geometry, backMaterial);
      backing.position.set(i ? 0.035 : -0.035, height * 0.5, z);
      backing.userData.modelAsset = 'traderBillboard';
      group.add(backing);
    });
    const front = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: asset.color, transparent: true, alphaTest: 0.045, side: THREE.DoubleSide }));
    front.position.y = height * 0.5;
    front.castShadow = true;
    front.userData.modelAsset = 'traderBillboard';
    group.add(front);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.55, 32), new THREE.MeshBasicMaterial({ color: 0x15100b, transparent: true, opacity: 0.3, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1.85, 0.62, 1);
    shadow.position.set(-0.65, 0.025, 0);
    group.add(shadow);
    group.userData.billboard = true;
    group.userData.displayHeight = height;
    return group;
  }

  buildPootal(fx=.5,fy=.86) {
    const pPos=this.nearestWalkable(Math.round(this.cols*fx),Math.round(this.rows*fy)) || this.spawn;
    const portalGroup = new THREE.Group();
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x595349, roughness: 0.95, flatShading: true });
    const arch = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.55, 12, 32), ringMat); arch.position.y = 3.0; arch.castShadow = true; portalGroup.add(arch);
    for (let i=0;i<8;i++) { const rune = new THREE.Mesh(new THREE.BoxGeometry(0.24,0.32,0.16), new THREE.MeshStandardMaterial({ color: 0x7a7468, emissive: 0x6cc4ff, emissiveIntensity: 0.28, roughness: 0.7 })); const a = i/8*Math.PI*2; rune.position.set(Math.cos(a)*2.55,3.0+Math.sin(a)*2.55,0); rune.lookAt(new THREE.Vector3(0,3,0)); portalGroup.add(rune); }
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.05, 40), new THREE.MeshStandardMaterial({ color: 0x4c7481, emissive: 0x7bcff6, emissiveIntensity: 1.6, transparent: true, opacity: 0.92, side: THREE.DoubleSide })); disc.position.y = 3.0; portalGroup.add(disc);
    const inner = new THREE.Mesh(new THREE.RingGeometry(1.75, 1.96, 32), new THREE.MeshStandardMaterial({ color: 0xc9dce8, emissive: 0x8edcff, emissiveIntensity: 0.65, side: THREE.DoubleSide })); inner.rotation.x = 0; inner.position.y = 3.0; portalGroup.add(inner);
    const portalLight = new THREE.PointLight(0x92d9ff, 3.4, 16); portalLight.position.set(0, 3.0, 0); portalGroup.add(portalLight);
    [-2.6, 2.6].forEach(dx => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 6.0, 8), ringMat); pillar.position.set(dx, 3.0, 0); pillar.castShadow = true; portalGroup.add(pillar);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.86,0.3,0.86), ringMat); cap.position.set(dx,6.05,0); portalGroup.add(cap);
    });
    portalGroup.position.copy(this.worldPos(pPos.x, pPos.y));
    portalGroup.userData.isPootal = true;
    portalGroup.userData.disc = disc;
    portalGroup.userData.inner = inner;
    this.zoneGroup.add(portalGroup);
    this.hearthPortal = portalGroup;
    this.pootalTile=pPos;
    this.addInteract('portal', '', 'Traverse the Brown', portalGroup, 8.0, () => this.openPootal());
    this.refreshPootal();
  }

  xpForLevel(level = this.state.level) { return XP_BASE + Math.max(0, level - 1) * XP_STEP; }

  applyDerivedStats(refill = false) {
    const s = this.state;
    const hp = 75 + (s.vitality - 1) * 12 + (s.level - 1) * 3;
    const stam = 60 + (s.endurance - 1) * 10 + (s.level - 1) * 2;
    const focus = 60 + (s.arcana - 1) * 14 + (s.level - 1) * 2;
    s.hpMax = hp; s.stamMax = stam; s.focusMax = focus;
    s.attackPower = 1 + (s.might - 1) * 0.13;
    s.magicPower = 1 + (s.arcana - 1) * 0.15;
    s.xpNext = this.xpForLevel(s.level);
    if (refill) { s.hp = hp; s.stam = stam; s.focus = focus; }
    else { s.hp = Math.min(s.hp, hp); s.stam = Math.min(s.stam, stam); s.focus = Math.min(s.focus, focus); }
  }

  levelUp() {
    const s = this.state;
    if (s.xp < s.xpNext) {
      this.say(`The Brownwell is quiet. ${s.xp}/${s.xpNext} Brown Essence gathered. Defeat foes in the Weeping Fjarts.`);
      return;
    }
    s.xp -= s.xpNext;
    s.level += 1;
    s[s.growthFocus] += 1;
    this.applyDerivedStats(true);
    this.popup('level ' + s.level, '#6cc4ff', this.playerObj.position);
    this.say(`The Brownwell answers. Level ${s.level} — ${GROWTH_LABEL[s.growthFocus]} deepens.`);
    this.saveProgress();
    this.emit();
  }

  cycleGrowthFocus() {
    const i = GROWTH.indexOf(this.state.growthFocus);
    this.state.growthFocus = GROWTH[(i + 1) % GROWTH.length];
    this.say(`The Brownwell is attuned to ${GROWTH_LABEL[this.state.growthFocus]}. Your next deepening will strengthen it.`);
    this.saveProgress();
  }

  awardXP(amount, reason) {
    const s = this.state;
    s.xp += amount;
    this.popup('+' + amount + ' Brown Essence', '#c9a15a', this.playerObj.position);
    const ready = s.xp >= s.xpNext;
    s.objective = ready ? `Return to A'jol and commune with the crystal.` : s.objective;
    this.state.log = `${reason || 'Victory'} — ${amount} Brown Essence gathered.${ready ? " The Brownwell at A'jol is calling." : ''}`;
    this.saveProgress();
    this.emit();
  }

  saveProgress(overrides = {}) {
    try {
      const s = this.state;
      localStorage.setItem(this.saveKey, JSON.stringify({ characterName:s.characterName, discipline:s.discipline, level:s.level, xp:s.xp, growthFocus:s.growthFocus, vitality:s.vitality, might:s.might, arcana:s.arcana, endurance:s.endurance, bossDefeated:s.bossDefeated, bossKills:s.bossKills, pootalKeys:s.pootalKeys, zone:s.zone, ...overrides }));
    } catch (_) {}
  }

  loadProgress() {
    try {
      const d = JSON.parse(localStorage.getItem(this.saveKey) || 'null');
      if (!d) return;
      for (const k of ['level','xp','vitality','might','arcana','endurance']) if (Number.isFinite(d[k])) this.state[k] = Math.max(k === 'xp' ? 0 : 1, d[k]);
      if (GROWTH.includes(d.growthFocus)) this.state.growthFocus = d.growthFocus;
      Object.assign(this.state,normalizeProgress(d));
      this.state.bossDefeated = !!this.state.bossKills.fords;
      if(ZONES[d.zone]&&realmUnlocked(d.zone,this.state.pootalKeys)){this.zone=ZONES[d.zone];this.state.zone=d.zone;this.state.zoneName=this.zone.name;}
    } catch (_) {}
  }

  tradeWithMerchant() {
    if (this.state.flasks >= this.state.flasksMax) { this.say('"Full up already," the merchant grunts. "Come back thirsty."'); return; }
    this.state.flasks = this.state.flasksMax;
    this.popup('restocked', '#f0d9a8', this.playerObj.position);
    this.say('The merchant tops off your flasks for a coin you don\u2019t remember paying.');
    this.emit();
  }

  restAtTent() {
    this.rest();
  }

  workAnvil() {
    this.say('The anvil rings under an idle hammer \u2014 you have nothing worth upgrading yet.');
  }

  refreshPootal() {
    if(!this.hearthPortal)return;
    const active=true;
    const {disc,inner}=this.hearthPortal.userData;
    disc.material.color.setHex(active?0x59321c:0x201c18);
    disc.material.emissive.setHex(0xb87b39);disc.material.emissiveIntensity=active?1.3:.06;
    inner.material.color.setHex(0xcaa66b);inner.material.emissive.setHex(0xb47b3f);inner.material.emissiveIntensity=active?.7:.06;
    this.hearthPortal.traverse(o=>{if(o.isPointLight){o.color.setHex(0xd4a366);o.intensity=active?2.8:.15;}});
  }

  atPootal(){return this.hearthPortal&&this.playerObj?.position.distanceTo(this.hearthPortal.position)<8.0;}
  useClickedPootal(object){
    let node=object;
    while(node&&node!==this.hearthPortal)node=node.parent;
    if(!this.hearthPortal||node!==this.hearthPortal)return false;
    this.clearTarget();
    if(this.atPootal())this.openPootal();else this.say('Move closer to the Pootal to traverse The Brown.');
    return true;
  }
  openPootal(){
    if(!this.atPootal()||this.paused||this._travelling||this.state.mode!=='roam'||this.act_||this.dodging)return;
    const message=this.zone.id==='hearth'?'Choose a realm. The Brown remembers every passage.':`Return to A’jol at any time. Defeat ${realmInfo(this.zone.id).boss} to recover its sigil and unlock the next passage.`;
    this.state.pootalDialog={from:this.zone.id,title:'Traverse the Brown',message,choices:realmChoices(this.zone.id,this.state.pootalKeys)};
    this.setPaused(true);
  }
  closePootal(){if(this._travelling)return;this.state.pootalDialog=null;this.setPaused(false);}

  awakenRealmPootal(id=this.zone.id){
    if(id==='hearth'||!this.state.bossKills[id]||this.state.pootalKeys[id])return false;
    const info=realmInfo(id);if(!info)return false;
    this.state.pootalKeys[id]=true;
    this.refreshPootal();this.saveProgress();
    const next=REALMS[REALMS.findIndex(r=>r.id===id)+1];
    this.state.objective=next?`Return to A’jol through the awakened Pootal. ${next.name} is now unlocked.`:'All three sigils are yours. Return to A’jol through the awakened Pootal.';
    this.popup(`${info.key} claimed`, '#d7a55b', this.playerObj.position);
    this.state.log=`${info.boss} falls. The ${info.key} awakens this Pootal${next?` and unlocks ${next.name} from A’jol`:''}.`;
    this.emit();return true;
  }

  updateInteract() {
    if (!this.interactables.length) { if (this.state.interact) { this.state.interact = null; this.mark(); } return; }
    const p = this.playerObj.position;
    let best = null, bd = Infinity;
    for (const it of this.interactables) {
      const d = p.distanceTo(it.obj.position);
      if (d < it.radius && d < bd) { bd = d; best = it; }
    }
    const cur = this.state.interact;
    if ((best && best.id) !== (cur && cur.id)) {
      this.state.interact = best ? { id: best.id, name: best.name, verb: best.verb } : null;
      this.mark();
    }
  }

  interactAt() {
    if (this.state.mode === 'dead' || this.state.mode === 'fight') return;
    const it = this.interactables.find(i => i.id === (this.state.interact && this.state.interact.id));
    if (it) it.action();
  }

  figure(bodyColor, cloakColor, ringColor, eye, bladeColor, kind='wanderer') {
    if (kind === 'frog') return this.buildFrogKnight(ringColor);
    if (kind === 'enemy') return this.buildEnemyFigure(bodyColor, cloakColor, ringColor, eye, bladeColor);
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 6, 16), new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.7 }));
    body.position.y = 1.05; body.castShadow = true; g.add(body);
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.78, 1.5, 18, 1, true), new THREE.MeshStandardMaterial({ color: cloakColor, roughness: 0.85, side: THREE.DoubleSide }));
    cloak.position.y = 0.9; cloak.castShadow = true; g.add(cloak);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.6 })); head.position.y = 1.86; head.castShadow = true; g.add(head);
    const arm = this.weaponArm(bladeColor); g.add(arm); g.userData.arm=arm;
    const ring=this.actorRing(ringColor);g.add(ring);g.userData.ring=ring;return g;
  }

  actorRing(color){ const ring=new THREE.Mesh(new THREE.RingGeometry(.62,.82,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.36,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.06;return ring; }
  weaponArm(bladeColor){ const arm=new THREE.Group();arm.position.set(.5,1.22,.06);const hilt=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.48,8),new THREE.MeshStandardMaterial({color:0x4b3524,roughness:.75}));hilt.rotation.x=Math.PI/2;hilt.position.z=.08;arm.add(hilt);const blade=new THREE.Mesh(new THREE.BoxGeometry(.12,.06,1.8),new THREE.MeshStandardMaterial({color:bladeColor,roughness:.28,metalness:.68}));blade.position.z=.95;blade.castShadow=true;arm.add(blade);const trail=new THREE.Mesh(new THREE.PlaneGeometry(.6,1.55),new THREE.MeshBasicMaterial({color:0xe4c98f,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));trail.position.set(0,.02,.95);trail.rotation.x=Math.PI/2;arm.add(trail);arm.userData.trail=trail;arm.rotation.x=-.35;return arm; }

  async buildFrogKnight(ringColor){
    try {
      const rig = await createMeshyFrogKnightRig({ ringColor });
      rig.userData.visualRoot = rig;
      return rig;
    } catch (err) {
      console.warn('Meshy Frog Knight failed to load; falling back to procedural hero.', err);
      const rig = createFrogKnightRig({ ringColor });
      rig.userData.visualRoot = rig;
      return rig;
    }
  }

  buildEnemyFigure(bodyColor, cloakColor, ringColor, eye, bladeColor){
    const g=new THREE.Group();
    const cardboard=new THREE.MeshStandardMaterial({color:0xc6a171,roughness:.95,flatShading:true});
    const trim=new THREE.MeshStandardMaterial({color:0x6e4c36,roughness:.92,flatShading:true});
    const spectral=new THREE.MeshStandardMaterial({color:0xa7efff,emissive:0x7be5ff,emissiveIntensity:1.15,transparent:true,opacity:.78});
    const capeMat=new THREE.MeshStandardMaterial({color:0x6b2730,roughness:1,side:THREE.DoubleSide});
    const core=new THREE.Mesh(new THREE.SphereGeometry(.34,16,12),spectral); core.scale.set(1.0,1.55,1.0); core.position.set(0,1.0,0); g.add(core);
    const helm = new THREE.Mesh(new THREE.BoxGeometry(.62,.72,.5), cardboard); helm.position.set(0,2.0,0); helm.castShadow=true; g.add(helm);
    const helmTop = new THREE.Mesh(new THREE.BoxGeometry(.32,.2,.36), cardboard); helmTop.position.set(0,2.45,-0.02); helmTop.rotation.z = -0.1; helmTop.castShadow=true; g.add(helmTop);
    [-.12,0,.12].forEach(x=>{ const slit=new THREE.Mesh(new THREE.BoxGeometry(.06,.32,.04), new THREE.MeshStandardMaterial({color:0x16110d,roughness:1})); slit.position.set(x,2.0,.27); g.add(slit); });
    const chest=new THREE.Mesh(new THREE.BoxGeometry(.85,.86,.38), cardboard); chest.position.set(0,1.38,0); chest.rotation.z = 0.02; chest.castShadow=true; g.add(chest);
    const shoulderL=new THREE.Mesh(new THREE.SphereGeometry(.22,10,8,0,Math.PI*2,0,Math.PI*.55), cardboard); shoulderL.scale.set(1.6,.8,1.2); shoulderL.position.set(-.46,1.6,0); g.add(shoulderL);
    const shoulderR=shoulderL.clone(); shoulderR.position.x=.46; g.add(shoulderR);
    const cape=new THREE.Mesh(new THREE.ConeGeometry(.54,1.1,12,1,true), capeMat); cape.position.set(0,1.32,-.12); cape.rotation.x=.1; g.add(cape);
    const waist=new THREE.Mesh(new THREE.BoxGeometry(.44,.22,.26), trim); waist.position.set(0,.78,0); g.add(waist);
    const hips=[]; [-.18,.18].forEach(x=>{const part=new THREE.Mesh(new THREE.BoxGeometry(.18,.28,.14), cardboard); part.position.set(x,.48,0); g.add(part); hips.push(part);});
    const limbs=[];
    [[-.58,1.15,0.08], [.58,1.15,0.08]].forEach((v,idx)=>{ const arm=new THREE.Mesh(new THREE.BoxGeometry(.16,.46,.16), cardboard); arm.position.set(v[0],v[1],v[2]); arm.rotation.z = idx===0?0.22:-0.12; g.add(arm); limbs.push(arm); });
    [[-.16,.0,0.02],[.16,.0,0.02]].forEach(v=>{ const leg=new THREE.Mesh(new THREE.BoxGeometry(.16,.42,.16), cardboard); leg.position.set(v[0],v[1],v[2]); g.add(leg); limbs.push(leg); });
    const aura = new THREE.Mesh(new THREE.TorusGeometry(.55,.1,8,20), spectral); aura.rotation.x = Math.PI / 2; aura.position.y = 1.0; g.add(aura);
    const arm=this.weaponArm(0xd6d1cc); arm.position.set(.62,1.15,.1); g.add(arm); g.userData.arm=arm;
    const ring=this.actorRing(ringColor);g.add(ring);g.userData.ring=ring;
    g.userData.floatParts=[helm,helmTop,chest,shoulderL,shoulderR,waist,...hips,...limbs,arm,cape,aura];
    g.userData.core=core;
    return g;
  }

  async buildActors(fromDir) {
    let best = null, bd = 1e9;
    let tx = this.cols * 0.6, ty = this.rows * 0.52;
    if (fromDir === 'north') { tx = this.cols * 0.5; ty = 4; }
    else if (fromDir === 'south') { tx = this.cols * 0.5; ty = this.rows - 5; }
    else if (fromDir === 'west') { tx = 4; ty = this.rows * 0.5; }
    else if (fromDir === 'east') { tx = this.cols - 5; ty = this.rows * 0.5; }
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      if (this.type[y * this.cols + x] !== PATH) continue;
      const d = (x - tx) ** 2 + (y - ty) ** 2;
      if (d < bd) { bd = d; best = { x, y }; }
    }
    this.spawn = best || this.nearestWalkable(Math.round(tx), Math.round(ty)) || { x: 15, y: 26 };
    this.playerObj = await this.buildFrogKnight(0xc9a15a);
    this.playerObj.name = 'wanderer';
    // Keep the Frog Knight readable without overpowering mobs or scenery.
    this.playerObj.scale.setScalar(1.15 * (this.playerObj.userData.customization?.overallScale || 1));
    this.playerObj.position.copy(this.worldPos(this.spawn.x, this.spawn.y));
    this.zoneGroup.add(this.playerObj);

    this.enemies = [];
    const seeds = this.zone.safe ? [] : [[0.3, 0.24], [0.72, 0.76], [0.52, 0.4], [0.34, 0.66], ...(!this.state.bossKills[this.zone.id] ? [[0.52, 0.16]] : [])];
    const names = this.zone.foes;
    const foeHp = this.zone.hp;
    seeds.forEach((sd, i) => {
      const t = this.nearestWalkable(Math.round(this.cols * sd[0]), Math.round(this.rows * sd[1]));
      if (!t) return;
      const boss = i === 4;
      const bossInfo=realmInfo(this.zone.id);
      const obj = boss?(this.buildGuardianRig(bossInfo.model)||this.figure(0x3d332c,0x2a1e1e,0xb2422f,0xb2422f,0x6b4a3a,'enemy')):this.figure(0x3d332c, 0x2a1e1e, 0xb2422f, 0xb2422f, 0x6b4a3a, 'enemy');
      obj.scale.setScalar(1.2);
      obj.position.copy(this.worldPos(t.x, t.y));
      this.zoneGroup.add(obj);
      const hp = boss ? bossInfo.hp : foeHp;
      if (boss) { obj.scale.setScalar(1.72); obj.userData.ring.material.color.setHex(0xd9752b); const bossLight=new THREE.PointLight(0x8b3a22,1.6,9); bossLight.position.y=3.1; obj.add(bossLight); }
      const enemy={
        name: boss ? bossInfo.boss : names[i % names.length], obj, hp, hpMax: hp, home: this.worldPos(t.x, t.y),
        xp: boss ? 175 : 35, boss,
        damage: boss ? bossInfo.damage : this.zone.damage,
        bossMove: boss&&this.zone.id==='fords'?'boughSweep':null,
        engaged: false, cool: 0, wander: rnd(0, 3), dest: null,
        ai: 'idle', at: 0, flash: 0, hitDone: false, introduced:false
      };
      if(enemy.bossMove==='boughSweep'){enemy.telegraph=this.buildBoughSweepTelegraph();this.zoneGroup.add(enemy.telegraph);}
      this.enemies.push(enemy);
    });
    this.state.enemies = this.enemies.filter(e=>e.hp>0).length;

    const d = 30;
    this.camera.position.copy(this.playerObj.position).add(new THREE.Vector3(0, d * 0.74, d * 0.72));
    this.controls.target.copy(this.playerObj.position).add(new THREE.Vector3(0, 1.3, 0));
  }

  async buildZone(zone, fromDir) {
    if (this.zoneGroup) {
      this.scene.remove(this.zoneGroup);
      this.zoneGroup.traverse(o => {
        if (o.isInstancedMesh) o.dispose();
        if (o.userData.ajolTintMaterial) (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());
        if (o.geometry && !o.userData.modelAsset) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
          if (m.map && m.map !== this._tex && !o.userData.modelAsset) m.map.dispose();
          if (m.normalMap && !o.userData.modelAsset) m.normalMap.dispose();
          if (m.bumpMap && !o.userData.modelAsset) m.bumpMap.dispose();
          if (!o.userData.modelAsset) m.dispose();
        });
      });
    }
    this.zone = zone;
    this.cols = zone.cols || DEFAULT_COLS;
    this.rows = zone.rows || DEFAULT_ROWS;
    this.w = this.cols * TILE;
    this.h = this.rows * TILE;
    this.zoneGroup = new THREE.Group();
    this.zoneGroup.name = 'zone-' + zone.id;
    this.scene.add(this.zoneGroup);

    const loader = new THREE.TextureLoader();
    const maskTex = await loader.loadAsync(zone.mask || zone.map);
    maskTex.colorSpace = THREE.SRGBColorSpace;
    maskTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this._tex = maskTex;

    this.buildGrid(maskTex.image);
    if (zone.id === 'hearth') {
      // Keep the collision mask independent from the authored A'jol ground art.
      const color = await loader.loadAsync(zone.surface || zone.mask || zone.map);
      this.buildAjolTerrain({ color });
    } else {
      const surfaceTex = await loader.loadAsync(zone.surface || zone.mask || zone.map);
      surfaceTex.colorSpace = THREE.SRGBColorSpace;
      surfaceTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      this.buildTerrain(surfaceTex);
    }
    this.buildWater();
    this.buildRealmHorizon();
    this.buildProps();
    await this.buildActors(fromDir);
    this.interactables = [];this.hearthPortal=null;this.hearthCrystal=null;this.merchantBillboard=null;this.state.interact=null;
    if (zone.id === 'hearth') this.buildHearthFeatures();else this.buildPootal();
    // Leave character shadows intact, but exclude all static props and portal
    // details from the expensive second (shadow-map) render pass.
    const actorRoots=new Set([this.playerObj,...this.enemies.map(e=>e.obj)]);
    this.zoneGroup.traverse(o=>{
      if (!o.isMesh) return;
      let parent=o;
      while (parent && !actorRoots.has(parent)) parent=parent.parent;
      if (!parent) o.castShadow=false;
    });
    if(fromDir==='pootal'){const t=this.nearestWalkable(this.pootalTile.x,this.pootalTile.y+2)||this.pootalTile;this.spawn=t;this.playerObj.position.copy(this.worldPos(t.x,t.y));}

    this._mood = null;
    this.setMood(zone.mood);
    if (zone.id === 'ember') {
      const fillA = new THREE.PointLight(0xff7a42, 1.35, 34, 2); fillA.position.set(-this.w * 0.22, 6, -this.h * 0.12); this.zoneGroup.add(fillA);
      const fillB = new THREE.PointLight(0xffad6a, 1.0, 30, 2); fillB.position.set(this.w * 0.25, 5, this.h * 0.18); this.zoneGroup.add(fillB);
      const fillC = new THREE.PointLight(0x8f6b78, 0.7, 40, 2); fillC.position.set(0, 10, 0); this.zoneGroup.add(fillC);
    }
    this.state.zone = zone.id;
    this.state.zoneName = zone.name;
    if (zone.id === 'hearth') {
      this.state.hp=this.state.hpMax; this.state.stam=this.state.stamMax; this.state.focus=this.state.focusMax;
      this.state.flasks=this.state.flasksMax; this.state.shield=0; this.shieldT=0;
    }
    this.state.objective=zone.id==='hearth'?'Approach or select the Pootal to choose your next realm.':`Defeat ${realmInfo(zone.id).boss} to claim its sigil. You may return to A’jol through the Pootal at any time.`;
    this.lockOn = null;
    this.lockRing.visible = false;
    this.tellRing.material.opacity = 0;
    this.controls.enableRotate = true;
    this.state.mode = 'roam';
    this.state.bossBattle = false;
    this.state.target = null;
    this.recenter();
    this.emit();
  }

  async traversePootal(next){
    if(!this.state.pootalDialog||!this.atPootal()||this._travelling||this.state.mode!=='roam'||!canTraverse(this.zone.id,next,this.state.pootalKeys))return;
    const previous=this.zone,zone=ZONES[next];this._travelling=true;
    this.state.pootalDialog=null;this.state.loading={name:zone.name,blurb:zone.blurb,from:previous.name};this.setPaused(true);
    try{
      await this.buildZone(zone,'pootal');
      this.state.log=zone.blurb;
      this.state.objective=next==='hearth'?'Approach or select the Pootal to choose your next realm.':`Defeat ${realmInfo(next).boss} to claim its sigil. You may return to A’jol through the Pootal at any time.`;
      this.saveProgress();
    }catch(error){
      console.error('Pootal travel failed',error);
      try{await this.buildZone(previous,'pootal');}catch(recovery){console.error('Pootal recovery failed',recovery);}
      this.state.log='The passage faltered. Please retry; your sigils are safe.';
    }finally{this.state.loading=null;this._travelling=false;this.setPaused(false);}
  }

  nearestWalkable(x, y) {
    for (let r = 0; r < 20; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (this.walkable(x + dx, y + dy)) return { x: x + dx, y: y + dy };
    }
    return null;
  }

  buildMarkers() {
    const lock = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.15, 40),
      new THREE.MeshBasicMaterial({ color: 0xb2422f, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false })
    );
    lock.rotation.x = -Math.PI / 2;
    lock.visible = false;
    this.scene.add(lock);
    this.lockRing = lock;

    const tell = new THREE.Mesh(
      new THREE.RingGeometry(1.3, 2.4, 44),
      new THREE.MeshBasicMaterial({ color: 0xd94f2b, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    tell.rotation.x = -Math.PI / 2;
    this.scene.add(tell);
    this.tellRing = tell;

    this.bolt = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x6cc4ff, emissiveIntensity: 3 })
    );
    this.bolt.visible = false;
    this.scene.add(this.bolt);
    this.boltLight = new THREE.PointLight(0x6cc4ff, 0, 12);
    this.scene.add(this.boltLight);
  }

  popup(text, color, pos) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    const cx = cv.getContext('2d');
    cx.font = 'bold 74px Georgia, serif';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.lineWidth = 8; cx.strokeStyle = 'rgba(0,0,0,0.85)';
    cx.strokeText(text, 128, 64);
    cx.fillStyle = color;
    cx.fillText(text, 128, 64);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
    sp.scale.set(3, 1.5, 1);
    sp.position.copy(pos).add(new THREE.Vector3(rnd(-0.4, 0.4), 2.4, 0));
    this.scene.add(sp);
    this.popups.push({ sp, life: 0 });
  }

  // ---------- engage / disengage ----------
  engage(foe) {
    if(foe.boss&&!foe.introduced){
      foe.introduced=true;this.pendingBoss=foe;this.state.bossBattle=true;
      this.state.bossDialog={name:foe.name,line:realmInfo(this.zone.id).dialogue};
      this.setPaused(true);return false;
    }
    foe.engaged = true;
    foe.ai = 'chase';
    foe.at = 0;
    if (foe.boss && !this.state.bossBattle) this.state.bossBattle = true;
    if (this.state.mode !== 'fight') {
      this.state.mode = 'fight';
      this.state.log = `${foe.name} comes at you. Click an enemy to focus your guard.`;
      this.emit();
    } else this.mark();
    return true;
  }

  beginPendingBoss(){
    const foe=this.pendingBoss;this.pendingBoss=null;this.state.bossDialog=null;
    if(!foe||foe.hp<=0){this.setPaused(false);return;}
    foe.engaged=true;foe.ai='chase';foe.at=0;this.state.bossBattle=true;this.state.mode='fight';
    this.state.log=`${foe.name} bars your path.`;this.setPaused(false);
  }

  selectTarget(foe) {
    if (!foe || foe.hp <= 0) { this.clearTarget(); return; }
    if (this.lockOn === foe) { this.clearTarget(); return; }
    if (!foe.engaged&&!this.engage(foe)) return;
    this.lockOn = foe;
    this.controls.enableRotate = false;
    this.lockRing.visible = true;
    this.state.target = { name: foe.name, hp: foe.hp, hpMax: foe.hpMax };
    this.state.log = `Focused on ${foe.name}.`;
    this.emit();
  }

  clearTarget() {
    this.lockOn = null;
    this.lockRing.visible = false;
    this.state.target = null;
    this.controls.enableRotate = true;
    this.mark();
  }

  bindTargeting() {
    const canvas = this.renderer.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down = null;
    this._pointerDown = ev => { if (ev.button !== 0) return; down = { x: ev.clientX, y: ev.clientY }; };
    this._pointerUp = ev => {
      if (!down || this.paused || ev.button !== 0) { down = null; return; }
      const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y); down = null;
      if (moved > 6) return;
      const r = canvas.getBoundingClientRect();
      ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, this.camera);
      const candidates = [...(this.hearthPortal?[this.hearthPortal]:[]), ...(this.enemies?.filter(e => e.hp > 0).map(e => e.obj) || [])];
      const hits = ray.intersectObjects(candidates, true);
      if (!hits.length) { this.clearTarget(); return; }
      let hitObj=hits[0].object;
      if(this.useClickedPootal(hitObj))return;
      let obj = hitObj, foe = null;
      while (obj && !foe) { foe = this.enemies.find(e => e.obj === obj) || null; obj = obj.parent; }
      if (foe) this.selectTarget(foe); else this.clearTarget();
    };
    canvas.addEventListener('pointerdown', this._pointerDown);
    canvas.addEventListener('pointerup', this._pointerUp);
  }

  disengage(msg) {
    this.state.mode = 'roam';
    this.state.bossBattle = false;
    this.state.bossHud = null;
    this.state.target = null;
    this.state.log = msg;
    this.lockOn = null;
    this.blocking = false;
    this.state.blocking = false;
    this.controls.enableRotate = true;
    this.lockRing.visible = false;
    this.tellRing.material.opacity = 0;
    this.enemies.forEach(e => { this.clearEnemyAttack(e);e.engaged = false; e.ai = 'idle'; if (e.hp > 0) e.cool = 6; });
    this.emit();
  }

  foes() { return this.enemies.filter(e => e.hp > 0 && e.engaged); }

  pickLock(dir) {
    const live = this.enemies.filter(e => e.hp > 0 && e.obj.position.distanceTo(this.playerObj.position) < 18).sort((a,b)=>a.obj.position.distanceTo(this.playerObj.position)-b.obj.position.distanceTo(this.playerObj.position));
    if (!live.length) { this.clearTarget(); return; }
    const i = live.indexOf(this.lockOn);
    this.selectTarget(live[(i + (dir || 1) + live.length) % live.length]);
  }

  // ---------- player actions ----------
  canAct() {
    return this.state.mode === 'fight' && this.state.hp > 0 && !this.act_ && !this.dodging && !this.stagger;
  }

  strike(kind) {
    if (this.state.mode !== 'fight') { this.say('Nothing here to strike.'); return; }
    if (!this.canAct()) return;
    const a = ATT[kind];
    if (this.state.stam < a.cost) { this.say('Winded — let your breath return.'); return; }
    this.state.stam -= a.cost;
    this.stamHold = 0.55;
    this.act_ = { kind, t: 0, done: false };
    if (this.lockOn) this.faceObj(this.playerObj, this.lockOn.obj.position);
    this.mark();
  }

  cast() {
    if (this.state.mode !== 'fight' || this.act_ || this.dodging || this.stagger || this.state.hp <= 0) return;
    const knight = this.state.discipline === 'knight';
    const sp = knight ? (this.state.spell === 'guard' ? KNIGHT_GUARD : KNIGHT_CHARGE) : (SPELLS[this.state.spell] || SPELLS.bolt);
    const selfCast = sp.key === 'guard' || !!sp.heal;
    if (!selfCast && (!this.lockOn || this.lockOn.hp <= 0)) { this.say('Select an enemy first.'); return; }
    if (this.state.focus < sp.cost) { this.say('Your Brown Reserve is spent.'); return; }
    this.state.focus -= sp.cost;
    this.act_ = { kind:'spell', spell:sp, t:0, done:false, foe:selfCast?null:this.lockOn };
    if (!selfCast && this.lockOn) this.faceObj(this.playerObj,this.lockOn.obj.position);
    this.mark();
  }

  dodge() {
    if (this.state.hp <= 0 || this.dodging || this.stagger) return;
    if (this.state.stam < 22) { this.say('No breath left to roll.'); return; }
    this.state.stam -= 22;
    this.stamHold = 0.5;
    const dir = this.inputDir();
    if (!dir.lengthSq()) {
      dir.copy(this.playerObj.getWorldDirection(new THREE.Vector3())).multiplyScalar(-1).setY(0).normalize();
    }
    this.dodging = { t: 0, dir };
    this.act_ = null;
    this.mark();
  }

  setBlock(on) {
    if (this.state.mode !== 'fight' || this.stagger) { this.blocking = false; this.state.blocking = false; return; }
    this.blocking = !!on && this.state.stam > 0;
    this.state.blocking = this.blocking;
    this.mark();
  }

  hurtPlayer(dmg, from) {
    if (this.dodging && this.dodging.t < 0.3) { this.popup('miss', '#e7e0d0', this.playerObj.position); return; }
    let taken = dmg;
    if (this.blocking) {
      taken = Math.max(1, Math.round(dmg * 0.25));
      this.state.stam = Math.max(0, this.state.stam - 26);
      this.stamHold = 0.7;
      if (this.state.stam === 0) {
        this.stagger = 0.9;
        this.blocking = false;
        this.state.blocking = false;
        this.popup('guard broken', '#d94f2b', this.playerObj.position);
      }
    }
    if (this.state.shield > 0) {
      const absorbed=Math.min(this.state.shield, Math.ceil(taken*0.65));
      this.state.shield-=absorbed; taken-=absorbed;
      this.popup(`shield ${absorbed}`, '#cfa974', this.playerObj.position);
    }
    this.state.hp = Math.max(0, this.state.hp - taken);
    this.state.flash = (this.state.flash || 0) + 1;
    this.playerHitT = 0.22;
    this.cameraKick = Math.max(this.cameraKick || 0, this.blocking ? 0.09 : 0.18);
    this.popup('-' + taken, '#e06a4d', this.playerObj.position);
    if (from) this.slide(this.playerObj, new THREE.Vector3().subVectors(this.playerObj.position, from.obj.position).setY(0).normalize(), 0.3);
    if (this.state.hp === 0) {
      this.state.shield=0; this.shieldT=0;
      this.state.mode = 'dead';
      this.state.log = 'Your light goes out. A’jol calls you home.';
      this.state.target = null;
      this.state.bossBattle = false;
      this.state.bossHud = null;
      this.state.blocking = false;
      this.state.slowed = false;
      this.state.pootalDialog = null;
      this.state.bossDialog = null;
      this.pendingBoss = null;
      this.act_ = null;
      this.dodging = null;
      this.stagger = 0;
      this.slowT = 0;
      this.blocking = false;
      this.move = { x: 0, y: 0 };
      this.keys = {};
      this.lockOn = null;
      this.lockRing.visible = false;
      this.tellRing.material.opacity = 0;
      this.controls.enableRotate = true;
      this.enemies.forEach(e=>{ this.clearEnemyAttack(e); e.engaged=false; e.ai='idle'; });
      // A later quit/reload must never place a dead character back in the fatal realm.
      this.saveProgress({zone:'hearth'});
    } else {
      this.state.log = `${from ? from.name : 'Something'} lands a blow for ${taken}.`;
    }
    this.emit();
  }

  applySlow(seconds=1.5) {
    this.slowT=Math.max(this.slowT||0,seconds);
    this.state.slowed=true;
    this.popup('slowed','#8ec6b7',this.playerObj.position);
    this.mark();
  }

  hurtFoe(foe, dmg, label) {
    if(foe.hp<=0)return;
    foe.hp = Math.max(0, foe.hp - dmg);
    foe.flash = 0.3;
    foe.staggerT = 0.24;
    this.hitStop = Math.max(this.hitStop || 0, 0.045);
    this.cameraKick = Math.max(this.cameraKick || 0, 0.16);
    this.popup(String(dmg), label || '#f0d9a8', foe.obj.position);
    this.slide(foe.obj, new THREE.Vector3().subVectors(foe.obj.position, this.playerObj.position).setY(0).normalize(), 0.35);
    if (foe.hp === 0) {
      this.clearEnemyAttack(foe);
      foe.deathT = 0;
      foe.engaged = false;
      this.state.enemies = this.enemies.filter(e => e.hp > 0).length;
      if (foe.boss) {
        this.state.bossKills[this.zone.id]=true;
        this.state.bossDefeated=!!this.state.bossKills.fords;
        this.awakenRealmPootal(this.zone.id);
        this.state.bossBattle = false;
      }
      this.awardXP(foe.xp || 25, `${foe.name} falls`);
      if(foe.boss){this.state.objective='Return to A’jol through the awakened Pootal.';this.saveProgress();}
      if (this.lockOn === foe) this.clearTarget();
      if (!this.foes().length) { this.disengage(foe.boss ? `${foe.name} collapses. The ${realmInfo(this.zone.id).key} is yours; the Pootal awakens.` : `${foe.name} falls apart into ash. The Weeping Fjarts fall quiet.`); return; }
    }
    this.mark();
  }

  inputDir() {
    const k = this.keys;
    let ix = this.move.x, iy = this.move.y;
    if (k.a || k.ArrowLeft) ix -= 1;
    if (k.d || k.ArrowRight) ix += 1;
    if (k.w || k.ArrowUp) iy -= 1;
    if (k.s || k.ArrowDown) iy += 1;
    const mag = Math.hypot(ix, iy);
    const out = new THREE.Vector3();
    if (mag < 0.1) return out;
    const n = mag > 1 ? 1 / mag : 1;
    const fwd = new THREE.Vector3().subVectors(this.controls.target, this.camera.position).setY(0);
    if (!fwd.lengthSq()) return out;
    fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    return out.addScaledVector(fwd, -iy * n).addScaledVector(right, ix * n).normalize().multiplyScalar(Math.min(1, mag));
  }

  faceObj(obj, pos) {
    const d = new THREE.Vector3().subVectors(pos, obj.position);
    obj.rotation.y = Math.atan2(d.x, d.z);
  }

  setPaused(on) {
    this.paused = !!on;
    this.state.paused = this.paused;
    if (this.paused) { this.move = { x: 0, y: 0 }; this.keys = {}; this.setBlock(false); }
    this.emit();
  }

  swapSpell() {
    const order=this.state.discipline==='knight'?KNIGHT_SKILLS:SPELL_ORDER;
    const i=order.indexOf(this.state.spell);
    this.state.spell=order[(i+1)%order.length];
    this.say(`You turn your mind to ${this.state.discipline==='knight'?(this.state.spell==='guard'?KNIGHT_GUARD:KNIGHT_CHARGE).name:SPELLS[this.state.spell].name}.`);
  }

  drink() {
    if (this.state.mode === 'dead') return;
    if (this.act_ || this.dodging || this.stagger) return;
    if (this.state.flasks <= 0) { this.say('The flask is dry. Rest to fill it.'); return; }
    if (this.state.hp >= this.state.hpMax) { this.say('You are whole. Save the draught.'); return; }
    this.state.flasks -= 1;
    this.act_ = { kind: 'flask', t: 0, done: false };
    this.blocking = false;
    this.state.blocking = false;
    this.mark();
  }

  setMove(x, y) {
    const m = Math.hypot(x, y);
    this.move = m > 1 ? { x: x / m, y: y / m } : { x, y };
  }

  act(kind) {
    if(kind==='boss-intro-close'){this.beginPendingBoss();return;}
    if(kind==='pootal-close'){this.closePootal();return;}
    if(kind?.startsWith('pootal:')){this.traversePootal(kind.slice(7));return;}
    if(this._travelling||this.state.pootalDialog||(this.paused&&!kind?.startsWith('growthset:')))return;
    if (kind === 'light' || kind === 'heavy') this.strike(kind);
    else if (kind === 'cast') this.cast();
    else if (kind === 'spellswap') this.swapSpell();
    else if (kind === 'flask') this.drink();
    else if (kind === 'rest') this.rest();
    else if (kind === 'dodge') this.dodge();
    else if (kind === 'switch') this.pickLock(1);
    else if (kind === 'interact') this.interactAt();
    else if (kind === 'reset') this.reset();
    else if (kind === 'recenter') this.recenter();
    else if (kind === 'growth') this.cycleGrowthFocus();
    else if (kind && kind.startsWith('growthset:')) { const k = kind.split(':')[1]; if (GROWTH.includes(k)) { this.state.growthFocus = k; this.say(`The Brownwell is attuned to ${GROWTH_LABEL[k]}.`); this.saveProgress(); this.emit(); } }
  }

  setSkeletonDebug(on) {
    if (this.playerObj?.userData?.skeletonHelper) this.playerObj.userData.skeletonHelper.visible = !!on;
  }

  recenter() {
    const t = this.playerObj.position.clone().add(new THREE.Vector3(0, 1.3, 0));
    this.controls.target.copy(t);
    this.camera.position.copy(t).add(new THREE.Vector3(0, 0.85, 0.7).normalize().multiplyScalar(19));
  }

  reset() {
    Object.assign(this.state, {
      mode: 'roam', hp: this.state.hpMax, stam: this.state.stamMax, focus: this.state.focusMax,
      target: null, blocking: false, flasks: this.state.flasksMax, bossBattle: false, bossHud: null, slowed: false
    });
    this.act_ = null; this.dodging = null; this.stagger = 0; this.blocking = false; this.slowT=0;
    this.lockOn = null;
    this.lockRing.visible = false;
    this.tellRing.material.opacity = 0;
    this.controls.enableRotate = true;
    this.playerObj.position.copy(this.worldPos(this.spawn.x, this.spawn.y));
    this.enemies.forEach(e => {
      if (e.boss && this.state.bossKills[this.zone.id]) { e.hp = 0; e.obj.visible = false; return; }
      this.clearEnemyAttack(e);e.hp = e.hpMax; e.engaged = false; e.ai = 'idle'; e.cool = 5; e.dest = null;
      e.obj.visible = true; e.obj.position.copy(e.home); e.obj.rotation.x = 0; e.obj.rotation.z = 0; e.obj.scale.setScalar(e.boss ? 1.72 : 1.2);
      e.obj.userData.arm.rotation.x = -0.35;
    });
    this.state.enemies = this.enemies.filter(e=>e.hp>0).length;
    this.say('You wake again at the crossroads.');
  }

  async respawnAtAjol() {
    if (this.state.mode !== 'dead' || this._travelling) return false;
    this._travelling = true;
    this.state.loading = { name: ZONES.hearth.name, blurb: ZONES.hearth.blurb, from: this.zone.name };
    try {
      await this.buildZone(ZONES.hearth, 'pootal');
      Object.assign(this.state, {
        mode: 'roam', hp: this.state.hpMax, stam: this.state.stamMax, focus: this.state.focusMax,
        flasks: this.state.flasksMax, target: null, blocking: false, bossBattle: false,
        bossHud: null, slowed: false, pootalDialog: null, bossDialog: null
      });
      this.act_ = null; this.dodging = null; this.stagger = 0; this.slowT = 0; this.blocking = false;
      this.state.log = 'You wake again at A’jol. The Brown has not finished with you.';
      this.state.objective = 'Approach or select the Pootal to choose your next realm.';
      this.saveProgress({zone:'hearth'});
      return true;
    } catch (error) {
      console.error('Respawn at A’jol failed', error);
      this.state.shield=0; this.shieldT=0;
      this.state.mode = 'dead';
      this.state.log = 'The way back to A’jol faltered. Try again.';
      return false;
    } finally {
      this.state.loading = null;
      this._travelling = false;
      this.paused = false;
      this.state.paused = false;
      this.emit();
    }
  }

  rest() {
    if (this.state.mode === 'fight') { this.say('Not while something is still swinging at you.'); return; }
    this.state.hp = this.state.hpMax;
    this.state.stam = this.state.stamMax;
    this.state.focus = this.state.focusMax;
    this.state.flasks = this.state.flasksMax;
    this.slowT=0;this.state.slowed=false;
    this.enemies.forEach(e => {
      if (e.boss && this.state.bossKills[this.zone.id]) { e.hp = 0; e.obj.visible = false; return; }
      this.clearEnemyAttack(e);e.hp = e.hpMax; e.engaged = false; e.ai = 'idle'; e.cool = 5; e.dest = null;
      e.obj.visible = true; e.obj.position.copy(e.home); e.obj.rotation.x = 0; e.obj.rotation.z = 0; e.obj.scale.setScalar(e.boss ? 1.72 : 1.2);
      e.obj.userData.arm.rotation.x = -0.35;
    });
    this.state.enemies = this.enemies.filter(e=>e.hp>0).length;
    this.say('You kneel a while. The fords stir back to life around you.');
  }

  setMood(m) {
    if (!this.scene || this._mood === m) return;
    this._mood = m;
    const P = {
      dusk: { fog: 0x101710, sun: 0xffcc82, si: 1.85, hemi: 0x8da48b, hi: 0.74, exp: 1.02, pos: [-30, 42, 14] },
      overcast: { fog: 0x292625, sun: 0xd8c4a0, si: 1.15, hemi: 0xb0a998, hi: 0.84, exp: 0.98, pos: [-8, 58, 18] },
      night: { fog: 0x18110f, sun: 0xffb07d, si: 1.2, hemi: 0x795548, hi: 0.82, exp: 1.12, pos: [20, 38, -18] }
    }[m];
    if (!P) return;
    this.scene.background.setHex(P.fog);
    this.scene.fog.color.setHex(P.fog);
    this.scene.fog.near = this.zone.id === 'fords' ? 28 : 38;
    this.scene.fog.far = this.zone.id === 'fords' ? 92 : 118;
    this.sun.color.setHex(P.sun);
    this.sun.intensity = P.si;
    this.sun.position.set(...P.pos);
    const hemi = this.scene.children.find(c => c.isHemisphereLight);
    if (hemi) { hemi.color.setHex(P.hemi); hemi.intensity = P.hi; }
    this.renderer.toneMappingExposure = P.exp;
  }

  // ---------- input ----------
  bindInput() {
    this._keyDown = ev => {
      const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
      if (this.keys[k]) return;
      this.keys[k] = true;
      if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab'].includes(k)) ev.preventDefault();
      if (this.paused) return;
      if (this.state.mode === 'dead') return;
      if (k === '1' || k === 'j') this.strike('light');
      else if (k === '2' || k === 'k') this.strike('heavy');
      else if (k === 'q') this.cast();
      else if (k === 'e') this.swapSpell();
      else if (k === 'f' || k === '3') this.drink();
      else if (k === 'x') this.interactAt();
      else if (k === ' ') this.dodge();
      else if (k === 'Shift') this.setBlock(true);
      else if (k === 'Tab') this.pickLock(1);
    };
    this._keyUp = ev => {
      const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
      this.keys[k] = false;
      if (k === 'Shift') this.setBlock(false);
    };
    addEventListener('keydown', this._keyDown);
    addEventListener('keyup', this._keyUp);
  }

  resize() {
    const w = this.clientWidth, h = this.clientHeight;
    if (!w || !h || w < 4 || h < 4) { requestAnimationFrame(() => this.resize()); return; }
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------- per-frame ----------
  updateModelLod(now) {
    if (now - (this._lastLodCheck || 0) < 250) return;
    this._lastLodCheck=now;
    for (const foe of this.enemies || []) {
      const lod=foe.obj?.userData?.lod;
      if (!lod || !foe.obj.visible) continue;
      const distance=foe.obj.position.distanceTo(this.camera.position);
      const far=distance>(lod.proxy.visible?25:29);
      lod.model.visible=!far;
      lod.proxy.visible=far;
    }
  }

  update(dt, time) {
    const wp = this.water.geometry.attributes.position;
    for (let i = 0; i < wp.count; i++) {
      const bx = this.waterBase[i * 3], bz = this.waterBase[i * 3 + 2];
      wp.setY(i, Math.sin(time * 1.6 + bx * 0.5 + bz * 0.35) * 0.09 + Math.cos(time * 1.2 + bx * 0.15) * 0.03);
    }
    wp.needsUpdate = true;
    if (this.water && this.water.material) { this.water.material.opacity = (this.zone.id === 'steppe' ? 0.52 : this.zone.id === 'ember' ? 0.62 : 0.74) + Math.sin(time * 0.55) * 0.03; }
    if (this.ambientFX) this.ambientFX.forEach((f,i)=>{ f.sp.position.y += Math.sin(time*f.speed+f.phase)*0.0018; f.sp.material.opacity = (this.zone.id === 'steppe' ? 0.08 : 0.16) + (Math.sin(time*(0.8+f.speed)+f.phase)+1)*0.18; });
    if (this.mistFX) this.mistFX.forEach((m,i)=>{ m.sp.position.x += Math.sin(time*m.speed+m.phase)*0.002; m.sp.position.z += Math.cos(time*m.speed*0.8+m.phase)*0.002; m.sp.material.opacity = (this.zone.id === 'steppe' ? 0.04 : 0.08) + (Math.sin(time*m.speed+m.phase)+1)*0.025; });
    if (this.merchantBillboard?.userData?.billboard) {
      const dx = this.camera.position.x - this.merchantBillboard.position.x;
      const dz = this.camera.position.z - this.merchantBillboard.position.z;
      this.merchantBillboard.rotation.y = Math.atan2(dx, dz);
    }

    if ((this.hitStop || 0) > 0) { this.hitStop = Math.max(0, this.hitStop - dt); this.updateCamera(dt * 0.2); this.updatePopups(dt * 0.2); return; }
    if (this.paused) { this.updatePopups(dt); this.updateCamera(dt); return; }
    const dead = this.state.mode === 'dead';
    if((this.slowT||0)>0){this.slowT=Math.max(0,this.slowT-dt);if(this.slowT===0){this.state.slowed=false;this.mark();}}
    if (!dead) {
      this.movePlayer(dt, time);
      this.playerAction(dt);
      if (this.playerObj?.userData?.rig) {
        const moveAmount = Math.min(1, this.inputDir().length());
        updateFrogRigSecondary(this.playerObj, dt, { move: moveAmount, action: this.act_ ? 1 : 0, time });
      }
      this.regen(dt);
      this.updateInteract();
    }
    if (this.hearthCrystal) {
      if (this.hearthCrystal.userData.waterGlow) {
        this.hearthCrystal.userData.waterGlow.material.emissiveIntensity = 0.48 + Math.sin(time * 1.7) * 0.13;
        this.hearthCrystal.userData.waterGlow.rotation.z = time * 0.05;
      }
      if (this.hearthCrystal.userData.glow) this.hearthCrystal.userData.glow.intensity = 1.35 + Math.sin(time * 2.0) * 0.32;
    }
    if (this.hearthPortal) {
      this.hearthPortal.userData.disc.material.emissiveIntensity = 1.35 + Math.sin(time*3)*.3;
      this.hearthPortal.userData.disc.rotation.z = time * 0.12;
      this.hearthPortal.userData.inner.rotation.z = time * 0.2;
    }
    this.updateBolt(dt);
    if (!dead) {
    }
    this.enemyAI(dt, time);
    this.updateCamera(dt);
    this.updatePopups(dt);

    // lock-on marker + target plate
    if (this.lockOn && this.lockOn.hp > 0) {
      this.lockRing.visible = true;
      this.lockRing.position.copy(this.lockOn.obj.position).setY(this.groundY(this.lockOn.obj.position) + 0.1);
      this.lockRing.material.opacity = 0.5 + Math.sin(time * 4) * 0.22;
      const t = this.state.target;
      if (!t || t.name !== this.lockOn.name || t.hp !== this.lockOn.hp) {
        this.state.target = { name: this.lockOn.name, hp: this.lockOn.hp, hpMax: this.lockOn.hpMax };
        this.mark();
      }
    } else {
      this.lockRing.visible = false;
      if (this.state.target) { this.state.target = null; this.mark(); }
    }

    this.playerObj.userData.ring.material.opacity = this.state.mode === 'fight' ? 0.6 : 0.35;
    this.sun.target = this.playerObj;

    this._emitT = (this._emitT || 0) + dt;
    if (this._dirty && this._emitT > 0.09) { this._emitT = 0; this.emit(); }
  }

  movePlayer(dt, time) {
    const p = this.playerObj.position;
    const fighting = this.state.mode === 'fight';
    const rigged = !!(this.playerObj.userData.rig && this.playerObj.userData.bones);

    if (this.stagger > 0) {
      this.stagger = Math.max(0, this.stagger - dt);
      const hitT = 1 - this.stagger / 0.9;
      if (rigged) { resetFrogRigPose(this.playerObj); poseFrogRigHit(this.playerObj, hitT, 1.0); }
      this.playerObj.rotation.z = Math.sin(this.stagger * 30) * 0.12;
      if (this.stagger === 0) { this.playerObj.rotation.z = 0; if (rigged) resetFrogRigPose(this.playerObj); this.mark(); }
    } else if ((this.playerHitT || 0) > 0) {
      this.playerHitT = Math.max(0, this.playerHitT - dt);
      const hitT = 1 - this.playerHitT / 0.22;
      if (rigged) { resetFrogRigPose(this.playerObj); poseFrogRigHit(this.playerObj, hitT, .65); }
      this.playerObj.rotation.z = Math.sin(this.playerHitT * 28) * 0.09;
      if (this.playerHitT === 0) { this.playerObj.rotation.z = 0; if (rigged) resetFrogRigPose(this.playerObj); }
    } else if (this.dodging) {
      this.dodging.t += dt;
      const k = Math.max(0, 1 - this.dodging.t / 0.35);
      this.slide(this.playerObj, this.dodging.dir, 16 * k * dt);
      const nt = Math.min(1, this.dodging.t / 0.42);
      const dk = Math.sin(Math.min(1, this.dodging.t / 0.35) * Math.PI);
      if (rigged) {
        resetFrogRigPose(this.playerObj);
        poseFrogRigDodge(this.playerObj, nt);
        this.playerObj.rotation.z = Math.sin(nt * Math.PI) * .42;
      } else {
        this.playerObj.rotation.x = dk * 0.5;
      }
      if (this.dodging.t > 0.42) {
        this.dodging = null; this.playerObj.rotation.x = 0; this.playerObj.rotation.z = 0;
        if (rigged) resetFrogRigPose(this.playerObj);
      }
    } else {
      const dir = this.inputDir();
      const speed = fighting ? FIGHT_SPEED : ROAM_SPEED;
      if (dir.lengthSq() > 0.01) {
        this.slide(this.playerObj, dir, speed * dt * (this.blocking ? 0.45 : 1) * (this.act_ ? 0.25 : 1) * (this.slowT>0 ? .5 : 1));
        if (fighting && this.lockOn && this.lockOn.hp > 0) this.faceObj(this.playerObj, this.lockOn.obj.position);
        else this.playerObj.rotation.y = Math.atan2(dir.x, dir.z);
        p.y = this.groundY(p) + Math.abs(Math.sin(time * 9)) * 0.045;
      } else {
        if (fighting && this.lockOn && this.lockOn.hp > 0) this.faceObj(this.playerObj, this.lockOn.obj.position);
        p.y = this.groundY(p) + Math.sin(time * 1.6) * 0.015;
      }
    }
    p.y = Math.max(p.y, this.groundY(p));

    const parts = this.playerObj.userData;
    const moving = this.inputDir().lengthSq() > 0.01 && !this.dodging && !this.stagger;
    if (rigged) {
      // Locomotion is a full skeletal pose; actions are applied afterward in playerAction().
      if (!this.act_ && !this.dodging && !this.stagger && !(this.playerHitT > 0)) {
        resetFrogRigPose(this.playerObj);
        if (moving) poseFrogRigWalk(this.playerObj, time, this.blocking ? .48 : 1, fighting && !this.blocking);
        else poseFrogRigIdle(this.playerObj, time, 1, fighting && !this.blocking);
        if (this.blocking) poseFrogRigBlock(this.playerObj, time, 1);
      }
    } else {
      const gait = Math.sin(time * (fighting ? 9.5 : 11.5));
      if (parts.legs) parts.legs.forEach((foot,i)=>{ foot.position.z = 0.28 + gait * (i ? -1 : 1) * (moving ? 0.11 : 0.015); foot.position.y = -0.62 + Math.max(0, gait * (i ? -1 : 1)) * (moving ? 0.06 : 0); });
      if (parts.torso) { parts.torso.rotation.z = moving ? gait * 0.025 : Math.sin(time*1.4)*0.008; parts.torso.rotation.x = this.blocking ? -0.1 : 0; }
      if (parts.breast) parts.breast.rotation.y = moving ? gait * 0.035 : Math.sin(time*1.1)*0.01;
      if (parts.shield) { parts.shield.rotation.y = this.blocking ? -0.42 : 0; parts.shield.position.z = this.blocking ? 0.42 : 0.14; }
      if (parts.leftArm) parts.leftArm.rotation.x = this.blocking ? -0.65 : (moving ? gait * 0.16 : 0);
      if (parts.head) parts.head.rotation.z = Math.sin(time * 1.2) * 0.02;
      if (parts.cloak) parts.cloak.rotation.z = Math.sin(time * 2.1) * 0.04;
      if (parts.mailSkirt) parts.mailSkirt.rotation.y = Math.sin(time * 1.4) * 0.02;
      const arm = parts.arm;
      if (!this.act_) arm.rotation.x = this.blocking ? -1.35 : -0.35;
    }
  }

  playerAction(dt) {
    const a = this.act_;
    if (!a) return;
    a.t += dt;
    const parts = this.playerObj.userData;
    const rigged = !!(parts.rig && parts.bones);
    const arm = parts.arm;
    const torso = parts.torso;
    const breast = parts.breast;
    const shield = parts.shield;
    const trail = arm?.userData?.trail;
    if (trail) trail.material.opacity = 0;

    if (a.kind === 'flask') {
      const nt = Math.min(1, a.t / FLASK.time);
      if (rigged) { resetFrogRigPose(this.playerObj); poseFrogRigFlask(this.playerObj, nt); }
      else {
        arm.rotation.x = -0.35 - Math.sin(nt * Math.PI) * 0.5;
        if (torso) torso.rotation.x = -0.04 * Math.sin(nt * Math.PI);
      }
      if (!a.done && a.t >= FLASK.time * 0.72) {
        a.done = true;
        const gain = Math.min(FLASK.heal, this.state.hpMax - this.state.hp);
        this.state.hp += gain;
        this.popup('+' + Math.round(gain), '#f0d9a8', this.playerObj.position);
        this.state.log = `You drain the flask — ${Math.round(gain)} mended. ${this.state.flasks} left.`;
        this.emit();
      }
      if (a.t > FLASK.time) {
        this.act_ = null;
        if (rigged) resetFrogRigPose(this.playerObj); else { arm.rotation.x = -0.35; if (torso) torso.rotation.x=0; }
      }
    } else if (a.kind === 'spell') {
      const sp = a.spell || SPELLS.bolt;
      const nt = Math.min(1, a.t / Math.max(.001, sp.cast));
      if (rigged) { resetFrogRigPose(this.playerObj); poseFrogRigCast(this.playerObj, nt); }
      else {
        arm.rotation.x = -1.5 + Math.sin((a.t / sp.cast) * Math.PI) * 0.4;
        if (torso) torso.rotation.x = -0.08 - Math.sin(nt*Math.PI)*0.08;
        if (shield) shield.position.x = -0.92;
      }
      if (sp.key==='charge' && a.t>=0.12 && a.t<=sp.cast+0.12) {
        const direction=new THREE.Vector3(Math.sin(this.playerObj.rotation.y),0,Math.cos(this.playerObj.rotation.y));
        this.slide(this.playerObj,direction,Math.min(dt,0.04)*16);
        const foe=a.foe;
        if (!a.done && foe?.hp>0 && foe.obj.position.distanceTo(this.playerObj.position)<2.8) {
          a.done=true; this.hurtFoe(foe,Math.round(rnd(...sp.dmg)*this.state.attackPower),'#cfa974');
          this.popup('FART CHARGE','#cfa974',this.playerObj.position);
        }
      }
      if (!a.done && a.t >= sp.cast) {
        a.done = true;
        if (sp.key==='guard') {
          this.state.shield=Math.min(Math.round(this.state.hpMax*0.30),Math.max(0,this.state.shield)+Math.round(this.state.hpMax*0.30));
          this.shieldT=8; this.state.log='Brown Shield absorbs 65% of incoming damage, up to 30% of maximum health, for 8 seconds.';this.mark();
        } else if (sp.key==='charge') {
          this.state.log='The charge missed.';this.mark();
        } else if (sp.heal) {
          const gain = Math.min(Math.round(sp.heal * this.state.magicPower), this.state.hpMax - this.state.hp);
          this.state.hp += gain;
          this.popup('+' + Math.round(gain), '#9fd8ff', this.playerObj.position);
          this.state.log = gain > 0 ? `Mending light knits your wounds for ${Math.round(gain)}.` : 'The light finds nothing to mend.';
          this.emit();
        } else {
          const foe = a.foe && a.foe.hp > 0 ? a.foe : this.foes()[0];
          if (foe) {
            this.boltFly = { from: this.playerObj.position.clone().setY(this.playerObj.position.y + 1.4), foe, t: 0 };
            this.bolt.visible = true;
          }
        }
      }
      if (a.t > sp.cast + 0.35) {
        this.act_ = null;
        if (rigged) resetFrogRigPose(this.playerObj); else { arm.rotation.x=-0.35; if(torso)torso.rotation.x=0; if(shield)shield.position.x=-.84; }
      }
    } else {
      const P = ATT[a.kind];
      const k = Math.min(1, a.t / P.end);
      const wind = P.hit / P.end;
      if (rigged) {
        resetFrogRigPose(this.playerObj);
        poseFrogRigAttack(this.playerObj, a.kind, k);
      } else {
        const strikePhase = k < wind ? k / wind : (k - wind) / Math.max(.001,1-wind);
        arm.rotation.x = k < wind ? -0.35 - strikePhase * 1.5 : -1.85 + strikePhase * (1.5 + P.swing);
        arm.rotation.z = k < wind ? -0.18 * strikePhase : 0.48 * Math.sin(strikePhase * Math.PI);
        if (torso) { torso.rotation.y = k < wind ? -0.28 * strikePhase : 0.36 * Math.sin(strikePhase * Math.PI); torso.rotation.x = a.kind === 'heavy' ? -0.12 * Math.sin(k*Math.PI) : -0.05 * Math.sin(k*Math.PI); }
        if (breast) breast.rotation.y = torso ? torso.rotation.y * 0.65 : 0;
        if (shield) shield.position.x = -0.82 - (a.kind === 'heavy' ? 0.12 : 0.04) * Math.sin(k*Math.PI);
      }
      if (trail && k >= wind*.72 && k <= Math.min(1, wind + (a.kind==='heavy'?.38:.32))) trail.material.opacity = a.kind === 'heavy' ? .42 : .28;
      if (!a.lunged && a.t >= P.hit * .82) {
        a.lunged = true;
        const fwdStep = new THREE.Vector3(Math.sin(this.playerObj.rotation.y),0,Math.cos(this.playerObj.rotation.y));
        this.slide(this.playerObj, fwdStep, a.kind === 'heavy' ? .48 : .27);
      }
      if (!a.done && a.t >= P.hit) {
        a.done = true;
        const fwd = new THREE.Vector3(Math.sin(this.playerObj.rotation.y), 0, Math.cos(this.playerObj.rotation.y));
        let hit = false;
        for (const e of this.foes()) {
          const to = new THREE.Vector3().subVectors(e.obj.position, this.playerObj.position).setY(0);
          if (to.length() > P.reach) continue;
          if (to.normalize().angleTo(fwd) > P.arc / 2 + 0.35) continue;
          const dmg = Math.round(rnd(P.dmg[0], P.dmg[1]) * this.state.attackPower);
          this.hurtFoe(e, dmg);
          hit = true;
          if (e.ai === 'wind' && a.kind === 'heavy') { e.ai = 'recover'; e.at = 0; this.popup('stagger', '#f0d9a8', e.obj.position); }
        }
        if (!hit) this.state.log = 'Your blade cuts empty air.';
        this.mark();
      }
      if (a.t >= P.end) {
        this.act_ = null;
        if (rigged) resetFrogRigPose(this.playerObj);
        else { arm.rotation.x=-0.35; arm.rotation.z=0; if(torso){torso.rotation.x=0;torso.rotation.y=0;} if(breast)breast.rotation.y=0; }
        if (trail) trail.material.opacity=0;
      }
    }
  }

  updateBolt(dt) {
    if (!this.boltFly) return;
    const b = this.boltFly;
    b.t += dt;
    const to = b.foe.obj.position.clone().setY(b.foe.obj.position.y + 1.2);
    this.bolt.position.lerpVectors(b.from, to, Math.min(1, b.t / 0.45));
    this.boltLight.position.copy(this.bolt.position);
    this.boltLight.intensity = 8;
    if (b.t >= 0.45) {
      if (b.foe.hp > 0) this.hurtFoe(b.foe, Math.round(rnd(SPELLS.bolt.dmg[0], SPELLS.bolt.dmg[1]) * this.state.magicPower), '#9fd8ff');
      this.bolt.visible = false;
      this.boltLight.intensity = 0;
      this.boltFly = null;
    }
  }

  regen(dt) {
    const s = this.state;
    this.stamHold = Math.max(0, (this.stamHold || 0) - dt);
    if (!this.blocking && this.stamHold === 0 && s.stam < s.stamMax) {
      s.stam = Math.min(s.stamMax, s.stam + 16 * this.stamRegenMultiplier * dt);
      this.mark();
    }
    if (this.blocking) {
      s.stam = Math.max(0, s.stam - 7 * dt);
      if (s.stam === 0) { this.blocking = false; s.blocking = false; }
      this.mark();
    }
    if (s.focus < s.focusMax) { s.focus = Math.min(s.focusMax, s.focus + 3.4 * dt); this.mark(); }
    if (s.mode === 'roam' && s.hp < s.hpMax) { s.hp = Math.min(s.hpMax, s.hp + 0.5 * dt); this.mark(); }
    if (this.shieldT > 0) { this.shieldT=Math.max(0,this.shieldT-dt); if (!this.shieldT) {s.shield=0;this.mark();} }
  }

  enemyAI(dt, time) {
    const p = this.playerObj.position;
    let near = 0;
    let tell = 0;

    for (const e of this.enemies) {
      if (e.hp <= 0) {
        if (e.obj.visible) {
          e.deathT = (e.deathT || 0) + dt;
          const k = Math.min(1, e.deathT / 0.62);
          e.obj.rotation.z = k * 1.15;
          e.obj.position.y = this.groundY(e.obj.position) - k * 0.45;
          e.obj.scale.setScalar((e.boss ? 1.72 : 1.2) * (1 - k * 0.22));
          if (e.obj.userData.core) e.obj.userData.core.material.opacity = Math.max(0, .78 * (1-k));
          if (k >= 1) e.obj.visible = false;
        }
        continue;
      }
      if ((e.staggerT || 0) > 0) { e.staggerT = Math.max(0,e.staggerT-dt); e.obj.rotation.z = Math.sin(e.staggerT*36)*0.16; }
      else e.obj.rotation.z *= 0.82;
      if (e.flash > 0) {
        e.flash = Math.max(0, e.flash - dt);
        const baseScale = e.boss ? 1.72 : 1.2;
        e.obj.scale.setScalar(baseScale * (1 + e.flash * 0.38));
      } else {
        e.obj.scale.setScalar(e.boss ? 1.72 : 1.2);
      }
      e.cool = Math.max(0, e.cool - dt);
      const to = new THREE.Vector3().subVectors(p, e.obj.position).setY(0);
      const d = to.length();
      if (d < AGGRO * 1.5) near++;

      if (!e.engaged) {
        if (d < AGGRO && e.cool === 0 && this.state.mode !== 'dead') { this.engage(e); }
        else {
          e.wander -= dt;
          if (!e.dest && e.wander <= 0) {
            e.wander = rnd(2, 5);
            const t = new THREE.Vector3(e.home.x + rnd(-6, 6), 0, e.home.z + rnd(-6, 6));
            if (this.freeAt(t.x, t.z)) e.dest = t;
          }
          if (e.dest) {
            const td = new THREE.Vector3().subVectors(e.dest, e.obj.position).setY(0);
            if (td.length() < 0.3) e.dest = null;
            else {
              td.normalize();
              this.slide(e.obj, td, 2.2 * dt);
              e.obj.rotation.y = Math.atan2(td.x, td.z);
            }
          }
        }
      } else if (this.state.mode === 'dead') {
        this.clearEnemyAttack(e);
        e.obj.rotation.y = Math.atan2(to.x, to.z);
      } else {
        if (d > LEASH) { this.clearEnemyAttack(e);e.engaged = false; e.ai = 'idle'; e.cool = 4; continue; }
        e.at += dt;
        if(!['boughWind','boughStrike','boughRecover','bombChannel','bombDrop','bombRecover'].includes(e.ai))e.obj.rotation.y = Math.atan2(to.x, to.z);
        const arm = e.obj.userData.arm;

        if (e.ai === 'chase') {
          arm.rotation.x = -0.35;
          e.obj.rotation.x = Math.sin(time*4 + e.home.x)*0.025;
          const attackRange=e.bossMove==='boughSweep'?3.7:2.5;
          if (d > attackRange) {
            to.normalize();
            const strafe = Math.sin(time * 0.8 + e.hpMax) * 0.25;
            const side = new THREE.Vector3(-to.z, 0, to.x).multiplyScalar(strafe);
            this.slide(e.obj, to.clone().add(side).normalize(), ENEMY_SPEED * dt);
          } else if (e.at > rnd(0.25, 0.55)) {
            if(e.bossMove==='boughSweep'){
              e.attackCycle=(e.attackCycle||0)+1;
              e.ai=e.attackCycle%3===0?'bombChannel':'boughWind';
              if(e.ai==='bombChannel')this.createMournwillowBombs(e);
            }else e.ai='wind';
            e.at = 0; e.hitDone = false;
          }
        } else if(e.ai==='boughWind'){
          const k=Math.min(1,e.at/BOUGH_SWEEP.windup);
          arm.rotation.x=-.35-k*1.25;e.obj.rotation.x=-.1*k;
          this.updateBoughTelegraph(e,k,false);
          if(e.at>=BOUGH_SWEEP.windup){e.ai='boughStrike';e.at=0;}
        } else if(e.ai==='boughStrike'){
          const k=Math.min(1,e.at/BOUGH_SWEEP.strike);
          arm.rotation.x=-1.6+k*2.15;e.obj.rotation.x=.12*Math.sin(k*Math.PI);
          this.updateBoughTelegraph(e,k,true);
          if(!e.hitDone&&e.at>=.08){
            e.hitDone=true;
            if(this.isInsideBoughSweep(e,p))this.hurtPlayer(Math.round(rnd(...BOUGH_SWEEP.damage)),e);
            else this.popup('whiff','#948d7c',e.obj.position);
          }
          if(e.at>=BOUGH_SWEEP.strike){e.ai='boughRecover';e.at=0;if(e.telegraph)e.telegraph.visible=false;}
        } else if(e.ai==='boughRecover'){
          const k=Math.min(1,e.at/BOUGH_SWEEP.recovery);
          arm.rotation.x=.55-k*.9;e.obj.rotation.x*=.82;
          if(e.at>=BOUGH_SWEEP.recovery){this.clearEnemyAttack(e);e.ai='chase';}
        } else if(e.ai==='bombChannel'){
          const k=Math.min(1,e.at/e.channelDuration);
          arm.rotation.x=-.35-k*.9;e.obj.rotation.x=-.06*Math.sin(k*Math.PI);
          this.updateMournwillowBombs(e,k,false);
          if(e.at>=e.channelDuration){e.ai='bombDrop';e.at=0;}
        } else if(e.ai==='bombDrop'){
          const k=Math.min(1,e.at/.48);this.updateMournwillowBombs(e,k,true);
          if(!e.impactDone&&e.at>=.16){
            e.impactDone=true;
            const hit=e.bombField?.userData.zones.some(zone=>new THREE.Vector3().subVectors(p,zone.point).setY(0).length()<=1.48);
            if(hit){
              const dodged=this.dodging&&this.dodging.t<.3;
              this.hurtPlayer(Math.round(rnd(8,12)),e);
              if(!dodged&&this.state.hp>0)this.applySlow(1.5);
            }
          }
          if(e.at>=.48){e.ai='bombRecover';e.at=0;}
        } else if(e.ai==='bombRecover'){
          arm.rotation.x=.55-e.at*.6;
          if(e.at>=.9){this.clearEnemyAttack(e);e.ai='chase';}
        } else if (e.ai === 'wind') {
          arm.rotation.x = -0.35 - (e.at / 0.62) * 1.6;
          e.obj.rotation.x = -Math.min(.24, e.at * .34);
          tell = Math.max(tell, e.at / 0.62);
          this.tellRing.position.copy(e.obj.position).setY(this.groundY(e.obj.position) + 0.12);
          if (e.at >= 0.62) { e.ai = 'strike'; e.at = 0; }
        } else if (e.ai === 'strike') {
          arm.rotation.x = -1.95 + (e.at / 0.16) * 2.6;
          e.obj.rotation.x = 0.18 - Math.min(.4,e.at*1.9);
          if (e.at < .12 && d > 1.2) this.slide(e.obj, to.clone().normalize(), ENEMY_SPEED * 1.4 * dt);
          if (!e.hitDone && e.at > 0.09) {
            e.hitDone = true;
            const now = new THREE.Vector3().subVectors(p, e.obj.position).setY(0).length();
            if (now < 3.3) this.hurtPlayer(Math.round(rnd(...(e.damage||[12,18]))), e);
            else this.popup('whiff', '#948d7c', e.obj.position);
          }
          if (e.at >= 0.2) { e.ai = 'recover'; e.at = 0; }
        } else if (e.ai === 'recover') {
          arm.rotation.x = 0.6 - (e.at / 0.75) * 0.95;
          e.obj.rotation.x *= 0.82;
          if (e.at < 0.3 && d < 2.2) this.slide(e.obj, to.clone().normalize().multiplyScalar(-1), 2.6 * dt);
          if (e.at >= rnd(0.7, 1.05)) { e.ai = 'chase'; e.at = 0; }
        }
        e.obj.userData.ring.material.opacity = e.ai === 'wind' ? 0.85 : 0.45;
      }
      e.obj.position.y = this.groundY(e.obj.position) + Math.sin(time * 1.4 + e.home.x) * (e.boss ? 0.12 : 0.08);
      if (e.obj.userData.floatParts) {
        e.obj.userData.floatParts.forEach((part, idx) => {
          part.position.y += Math.sin(time * (1.7 + idx * 0.05) + idx) * 0.002;
          part.rotation.z += Math.sin(time * 0.7 + idx) * 0.0008;
        });
      }
      if (e.obj.userData.core) {
        e.obj.userData.core.material.opacity = 0.66 + (Math.sin(time * 3 + e.home.x) + 1) * 0.08;
      }
      if(e.obj.userData.guardianRig){
        const root=e.obj.userData.bones.root;
        root.position.y=Math.sin(time*1.15+e.home.x)*.045;
        root.rotation.z=Math.sin(time*.72+e.home.z)*.018;
        root.rotation.x=e.ai==='wind'?-.08*Math.min(1,e.at/.62):e.ai==='strike'?.12:e.ai==='boughWind'?-.1*Math.min(1,e.at/BOUGH_SWEEP.windup):e.ai==='boughStrike'?.1:e.ai==='bombChannel'?-.08:0;
        root.rotation.y=e.ai==='boughWind'?-.55*Math.min(1,e.at/BOUGH_SWEEP.windup):e.ai==='boughStrike'?-.55+1.1*Math.min(1,e.at/BOUGH_SWEEP.strike):e.ai==='boughRecover'?.55*(1-Math.min(1,e.at/BOUGH_SWEEP.recovery)):0;
      }
    }

    const activeBoss = this.enemies.find(e => e.boss && e.hp > 0 && e.engaged);
    const bossActive = !!activeBoss;
    const bossStatus=activeBoss?.ai==='bombChannel'?`CHANNELING · WEEPING FALL ${Math.max(0,activeBoss.channelDuration-activeBoss.at).toFixed(1)}s`:activeBoss?.ai==='boughWind'?'BOUGH SWEEP':null;
    const bossHud=activeBoss?{name:activeBoss.name,hp:activeBoss.hp,hpMax:activeBoss.hpMax,status:bossStatus}:null;
    if (bossActive !== this.state.bossBattle || JSON.stringify(bossHud)!==JSON.stringify(this.state.bossHud)) { this.state.bossBattle = bossActive; this.state.bossHud=bossHud; this.mark(); }
    this.tellRing.material.opacity = tell > 0 ? 0.25 + tell * 0.5 : 0;
    this.tellRing.scale.setScalar(tell > 0 ? 0.6 + tell * 0.5 : 0.6);
    if (near !== this.state.nearby) { this.state.nearby = near; this.mark(); }
    if (this.state.mode === 'fight' && !this.foes().length) this.disengage('Nothing left standing. The road is yours.');
  }

  updateCamera(dt) {
    const p = this.playerObj.position;
    const k = 1 - Math.pow(0.0015, dt);
    if (this.state.mode === 'fight' && this.lockOn && this.lockOn.hp > 0) {
      const foe = this.lockOn.obj.position;
      const mid = new THREE.Vector3().addVectors(p, foe).multiplyScalar(0.5).setY(p.y + 1.5);
      const back = new THREE.Vector3().subVectors(p, foe).setY(0).normalize();
      const dist = Math.min(9.5, 5.5 + p.distanceTo(foe) * 0.4);
      const want = p.clone().add(back.multiplyScalar(dist)).setY(p.y + 4.4);
      this.camera.position.lerp(want, k * 0.75);
      this.controls.target.lerp(mid, k);
    } else {
      this.controls.target.lerp(p.clone().add(new THREE.Vector3(0, 1.3, 0)), k);
    }
    if ((this.cameraKick || 0) > 0) {
      this.cameraKick = Math.max(0, this.cameraKick - dt * 2.8);
      const amount = this.cameraKick * 0.18;
      this.camera.position.x += (Math.random() - .5) * amount;
      this.camera.position.y += (Math.random() - .5) * amount * .65;
    }
  }

  updatePopups(dt) {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const q = this.popups[i];
      q.life += dt;
      q.sp.position.y += dt * 2.1;
      q.sp.material.opacity = Math.max(0, 1 - q.life / 0.85);
      if (q.life > 0.85) {
        this.scene.remove(q.sp);
        q.sp.material.map.dispose();
        q.sp.material.dispose();
        this.popups.splice(i, 1);
      }
    }
  }
}

if (!customElements.get('world-3d')) customElements.define('world-3d', World3D);
