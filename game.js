/* ============================================================
 * WEB-STRIKE 1.6 — 网页版 CS1.6 灵魂致敬原型
 * 纯 Three.js + WebAudio 合成，无任何 CS 原始资产
 * ============================================================ */
(function () {
'use strict';

// ---------------- 配置 ----------------
var CFG = {
  roundTime: 115,
  buyTime: 5,
  winRounds: 5,          // 抢 5
  botCount: 5,
  startMoney: 800,
  maxMoney: 16000,
  fov: 78,
  sens: 0.0022
};

var WEAPONS = {
  usp:   { name: 'USP',    slot: 2, dmg: 30,  headMul: 4, interval: 0.17, auto: false, mag: 12, reserve: 48, reload: 2.1, spread: 0.009, recoil: 0.010, price: 0,    zoom: 1, snd: 'pistol' },
  ak:    { name: 'AK-47',  slot: 1, dmg: 33,  headMul: 4, interval: 0.10, auto: true,  mag: 30, reserve: 90, reload: 2.5, spread: 0.013, recoil: 0.015, price: 2500, zoom: 1, snd: 'rifle'  },
  m4:    { name: 'M4A1',   slot: 1, dmg: 31,  headMul: 4, interval: 0.09, auto: true,  mag: 30, reserve: 90, reload: 2.4, spread: 0.011, recoil: 0.013, price: 3100, zoom: 1, snd: 'rifle'  },
  awp:   { name: 'AWP',    slot: 1, dmg: 115, headMul: 2, interval: 1.45, auto: false, mag: 10, reserve: 30, reload: 3.1, spread: 0.0012,recoil: 0.05,  price: 4750, zoom: 4, snd: 'sniper', unscoped: 0.10 },
  knife: { name: '战术刀', slot: 3, melee: true, dmg: 55, backstab: 195, range: 2.3, interval: 0.55, auto: false, mag: 0, reserve: 0, reload: 0, spread: 0, recoil: 0, price: 0, zoom: 1, snd: 'knife' }
};

var BOT_NAMES = ['Vladimir', 'Boris', 'Snake', 'Ghost', 'Reaper', 'Wolf', 'Havoc', 'Blade'];
var CT_NAMES = ['Sarge', 'Doc', 'Recon', 'Eagle', 'Frost', 'Bull'];

// ---------------- 全局状态 ----------------
var G = {
  state: 'menu',   // menu | buytime | live | roundend | matchend
  ct: 0, t: 0, round: 0,
  stateT: 0, roundT: CFG.roundTime,
  paused: false,   // Esc/失焦暂停：冻结模拟
  frozen: false    // #shot 调试：冻结 AI
};

var P = {
  pos: null, vel: null,
  yaw: 0, pitch: 0,
  hp: 100, armor: 0, money: CFG.startMoney,
  grounded: true, crouch: false, dead: false,
  weapons: {}, cur: 'usp',
  bloom: 0, lastShot: 0, reloading: 0, switching: 0,
  scoped: false, stepT: 0, kills: 0,
  recP: 0, recY: 0, swing: 0
};

function mkWpn(key) {
  var d = WEAPONS[key];
  return { key: key, ammo: d.mag, reserve: d.reserve };
}

// ---------------- Three 基础 ----------------
var scene, camera, renderer, clock;
var solids = [];        // {min:{x,y,z}, max:{x,y,z}}
var bots = [];
var parts = [];         // 粒子 {m, v, life, maxLife}
var tracers = [];       // {line, life}
var vmRoot, vmGun, muzzle, flashLight;
var SHOT_DEBUG = (location.hash === '#shot');

function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9db8cf);
  scene.fog = new THREE.Fog(0xa8b4ab, 40, 125);

  camera = new THREE.PerspectiveCamera(CFG.fov, innerWidth / innerHeight, 0.08, 300);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  document.body.appendChild(renderer.domElement);

  var amb = new THREE.AmbientLight(0xfff2dd, 0.45);
  scene.add(amb);
  var sun = new THREE.DirectionalLight(0xffe9c4, 1.05);
  sun.position.set(40, 70, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
  sun.shadow.camera.far = 200;
  scene.add(sun);

  flashLight = new THREE.PointLight(0xffc866, 0, 9);
  scene.add(flashLight);

  addEventListener('resize', function () {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

// ---------------- 地图 ----------------
function box(w, h, d, color, x, y, z, ry) {
  var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color: color }));
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  return m;
}

// 实心障碍（渲染 + 碰撞登记）。cx,cz 为中心，y0 到底部，h 高。
function solid(cx, cz, w, h, d, color, y0) {
  y0 = y0 || 0;
  box(w, h, d, color, cx, y0 + h / 2, cz);
  solids.push({
    min: { x: cx - w / 2, y: y0, z: cz - d / 2 },
    max: { x: cx + w / 2, y: y0 + h, z: cz + d / 2 }
  });
}

var waypoints = [];
var botSpawns = [];
var playerSpawn = new THREE.Vector3(0, 0, 42);

var C_SAND = 0xc7a86b, C_WALL = 0xb59a62, C_WALL2 = 0x9d8a5f,
    C_WOOD = 0x8a6d3f, C_WOOD2 = 0x74552c, C_METAL = 0x707070;

function buildMap() {
  // 地面（主层 + 色差斑块增加层次）
  var ground = new THREE.Mesh(new THREE.PlaneGeometry(104, 104),
    new THREE.MeshLambertMaterial({ color: C_SAND }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  var patchCols = [0xb0966a, 0xcbb27c, 0xa8905c];
  var patchDefs = [
    [-20, 20, 26, 18], [22, 12, 20, 24], [0, -30, 30, 16],
    [-30, -20, 18, 20], [12, 38, 24, 14], [-38, 40, 14, 12], [36, -40, 16, 12]
  ];
  for (var pi = 0; pi < patchDefs.length; pi++) {
    var pd = patchDefs[pi];
    var patch = new THREE.Mesh(new THREE.PlaneGeometry(pd[2], pd[3]),
      new THREE.MeshLambertMaterial({ color: patchCols[pi % patchCols.length] }));
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(pd[0], 0.012 + pi * 0.001, pd[1]);
    patch.receiveShadow = true;
    scene.add(patch);
  }

  // 外墙
  solid(0, -50, 102, 5, 1, C_WALL);
  solid(0, 50, 102, 5, 1, C_WALL);
  solid(-50, 0, 1, 5, 102, C_WALL);
  solid(50, 0, 1, 5, 102, C_WALL);

  // 中路两侧墙（corridor x -5.5..5.5）
  solid(-6, 0, 1, 3.5, 30, C_WALL2);
  solid(6, 0, 1, 3.5, 30, C_WALL2);

  // 中门双扇
  solid(-2.6, 0, 3.2, 3, 0.8, C_WOOD);
  solid(2.6, 0, 3.2, 3, 0.8, C_WOOD);

  // 中路箱子
  solid(0, 8, 1.7, 1.1, 1.7, C_WOOD);
  solid(2.2, 5, 1, 1, 1, C_WOOD2);
  solid(-2.5, -7, 1, 1, 1, C_WOOD2);
  solid(0.6, -7.5, 1.1, 0.5, 1.1, C_METAL);

  // 中路尽头大箱（XBOX）
  solid(0, -20, 2.4, 1.2, 2.4, C_WOOD);
  solid(-1.8, -19, 1, 1, 1, C_WOOD2);

  // A 道隔墙（门洞 z -2..4）
  solid(-15, -16, 1, 3.5, 28, C_WALL2);
  solid(-15, 12, 1, 3.5, 16, C_WALL2);
  // A 道箱子
  solid(-25, 5, 1, 1, 1, C_WOOD2);
  solid(-30, -15, 1.3, 1.2, 1.3, C_WOOD);
  solid(-25, -38, 2.2, 1, 2.2, C_METAL);
  solid(-35, -30, 1, 1, 1, C_WOOD2);
  solid(-20, -34, 1, 0.6, 1, C_WOOD2);

  // B 道隔墙（门洞 z -8..-6）
  solid(15, -19, 1, 3.5, 22, C_WALL2);
  solid(15, 7, 1, 3.5, 26, C_WALL2);
  // B 道箱子
  solid(25, -5, 1, 1, 1, C_WOOD2);
  solid(30, -25, 1.3, 1.2, 1.3, C_WOOD);
  solid(25, -38, 2.2, 1, 2.2, C_METAL);
  solid(35, -32, 1, 1, 1, C_WOOD2);

  // CT / T 出生区散箱
  solid(-8, 38, 1, 1, 1, C_WOOD2);
  solid(8, 44, 1.2, 1.2, 1.2, C_WOOD);
  solid(-5, -44, 1, 1, 1, C_WOOD2);
  solid(12, -42, 1, 1, 1, C_WOOD2);
  solid(-12, -40, 1.4, 0.7, 1.4, C_METAL);

  waypoints = [
    [0, 30], [0, 12], [0, -10], [0, -30],
    [-25, 15], [-25, 1], [-25, -20], [-25, -38],
    [25, 15], [25, -7], [25, -20], [25, -38],
    [-40, 0], [40, -10], [0, -44], [-10, -25], [10, -25]
  ].map(function (a) { return new THREE.Vector3(a[0], 0, a[1]); });

  botSpawns = [
    [-4, -42], [4, -42], [-25, -44], [25, -44], [0, -38]
  ].map(function (a) { return new THREE.Vector3(a[0], 0, a[1]); });
}

// ---------------- 碰撞 ----------------
function hitSolid(x, z, footY, headY, r) {
  for (var i = 0; i < solids.length; i++) {
    var s = solids[i];
    if (x + r > s.min.x && x - r < s.max.x &&
        z + r > s.min.z && z - r < s.max.z &&
        footY < s.max.y - 0.001 && headY > s.min.y) return s;
  }
  return null;
}

// 带滑墙的水平移动；返回是否被卡住（用于 bot 避障）
function moveXZ(ent, dx, dz, r, height) {
  var stuck = false;
  var nx = ent.pos.x + dx;
  if (!hitSolid(nx, ent.pos.z, ent.pos.y + 0.05, ent.pos.y + height, r)) ent.pos.x = nx;
  else stuck = true;
  var nz = ent.pos.z + dz;
  if (!hitSolid(ent.pos.x, nz, ent.pos.y + 0.05, ent.pos.y + height, r)) ent.pos.z = nz;
  else stuck = true;
  return stuck;
}

// 射线 vs AABB（slab），返回 t 或 -1
function rayAABB(ox, oy, oz, dx, dy, dz, mn, mx) {
  var tmin = 0, tmax = Infinity, a, o, d, lo, hi, t1, t2;
  for (a = 0; a < 3; a++) {
    o = a === 0 ? ox : (a === 1 ? oy : oz);
    d = a === 0 ? dx : (a === 1 ? dy : dz);
    lo = a === 0 ? mn.x : (a === 1 ? mn.y : mn.z);
    hi = a === 0 ? mx.x : (a === 1 ? mx.y : mx.z);
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return -1;
    } else {
      t1 = (lo - o) / d; t2 = (hi - o) / d;
      if (t1 > t2) { var tt = t1; t1 = t2; t2 = tt; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  var lx = cx - ox, ly = cy - oy, lz = cz - oz;
  var tca = lx * dx + ly * dy + lz * dz;
  var d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  var r2 = r * r;
  if (d2 > r2) return -1;
  var thc = Math.sqrt(r2 - d2);
  var t = tca - thc;
  return t > 0 ? t : -1;
}

// 最近墙体命中距离
function rayWalls(ox, oy, oz, dx, dy, dz, maxT) {
  var best = maxT || Infinity;
  for (var i = 0; i < solids.length; i++) {
    var t = rayAABB(ox, oy, oz, dx, dy, dz, solids[i].min, solids[i].max);
    if (t > 0.01 && t < best) best = t;
  }
  // 地面
  if (dy < -1e-6) {
    var tg = -oy / dy;
    if (tg > 0.01 && tg < best) best = tg;
  }
  return best;
}

// 视线检测：a -> b 是否无遮挡
function hasLOS(ax, ay, az, bx, by, bz) {
  var dx = bx - ax, dy = by - ay, dz = bz - az;
  var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist < 0.001) return true;
  dx /= dist; dy /= dist; dz /= dist;
  return rayWalls(ax, ay, az, dx, dy, dz, dist) >= dist - 0.15;
}

// ---------------- 音频（全合成） ----------------
var AC = null, master = null, noiseBuf = null;

function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain();
    master.gain.value = 0.45;
    master.connect(AC.destination);
    var len = AC.sampleRate;
    noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}

function playGun(kind, vol) {
  if (!AC) return;
  var t = AC.currentTime;
  var dur = kind === 'sniper' ? 0.55 : (kind === 'rifle' ? 0.22 : 0.18);
  var V = vol * (kind === 'sniper' ? 1.0 : (kind === 'rifle' ? 0.75 : 0.55));
  var src = AC.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.7 + Math.random() * 0.3;
  var f = AC.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(kind === 'sniper' ? 800 : (kind === 'rifle' ? 1600 : 2400), t);
  f.frequency.exponentialRampToValueAtTime(200, t + dur);
  var g = AC.createGain();
  g.gain.setValueAtTime(V, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.05);
  // 低频 punch
  var o = AC.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(kind === 'pistol' ? 200 : 130, t);
  o.frequency.exponentialRampToValueAtTime(50, t + 0.07);
  var g2 = AC.createGain();
  g2.gain.setValueAtTime(V * 0.5, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  o.connect(g2); g2.connect(master);
  o.start(t); o.stop(t + 0.1);
}

function blip(freq, dur, vol, type) {
  if (!AC) return;
  var t = AC.currentTime;
  var o = AC.createOscillator();
  o.type = type || 'square';
  o.frequency.value = freq;
  var g = AC.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noiseTick(vol, freq, dur) {
  if (!AC) return;
  var t = AC.currentTime;
  var src = AC.createBufferSource();
  src.buffer = noiseBuf;
  var f = AC.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
  var g = AC.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}

function stepSound() { noiseTick(0.10, 500 + Math.random() * 200, 0.07); }
function swingSound() {
  if (!AC) return;
  var t = AC.currentTime;
  var src = AC.createBufferSource();
  src.buffer = noiseBuf;
  var f = AC.createBiquadFilter();
  f.type = 'bandpass'; f.Q.value = 2;
  f.frequency.setValueAtTime(2600, t);
  f.frequency.exponentialRampToValueAtTime(700, t + 0.16);
  var g = AC.createGain();
  g.gain.setValueAtTime(0.28, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, Math.random() * 0.4); src.stop(t + 0.2);
}
function stabSound() {
  noiseTick(0.5, 320, 0.12);
  blip(150, 0.1, 0.3, 'sawtooth');
}
function reloadSound() {
  noiseTick(0.25, 1800, 0.06);
  setTimeout(function () { noiseTick(0.25, 1200, 0.06); }, 350);
  setTimeout(function () { noiseTick(0.3, 900, 0.08); }, 900);
}

// ---------------- 特效 ----------------
var bloodGeo, bloodMat, flashMat;

function initFx() {
  bloodGeo = new THREE.SphereGeometry(0.045, 5, 4);
  bloodMat = new THREE.MeshBasicMaterial({ color: 0xa31212 });
  flashMat = new THREE.MeshBasicMaterial({
    color: 0xffd27a, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
}

function spawnBlood(p) {
  for (var i = 0; i < 7; i++) {
    var m = new THREE.Mesh(bloodGeo, bloodMat);
    m.position.copy(p);
    scene.add(m);
    parts.push({
      m: m,
      v: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5 + 0.5, (Math.random() - 0.5) * 3),
      life: 0.45, maxLife: 0.45
    });
  }
}

function spawnSpark(p) {
  for (var i = 0; i < 4; i++) {
    var m = new THREE.Mesh(bloodGeo, flashMat);
    m.scale.setScalar(0.6);
    m.position.copy(p);
    scene.add(m);
    parts.push({
      m: m,
      v: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4),
      life: 0.2, maxLife: 0.2
    });
  }
}

function updateParts(dt) {
  for (var i = parts.length - 1; i >= 0; i--) {
    var p = parts[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(p.m);
      parts.splice(i, 1);
      continue;
    }
    p.v.y -= 12 * dt;
    p.m.position.addScaledVector(p.v, dt);
    p.m.scale.setScalar(Math.max(0.05, p.life / p.maxLife));
  }
}

var tracerMats = {};
function tracerMat(color) {
  if (!tracerMats[color]) {
    tracerMats[color] = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.85 });
  }
  return tracerMats[color];
}

function spawnTracer(a, b, color) {
  var g = new THREE.BufferGeometry().setFromPoints([a, b]);
  var line = new THREE.Line(g, tracerMat(color || 0xffe0a0)); // 材质全局共享，回收时只 dispose 几何体
  scene.add(line);
  tracers.push({ line: line, life: 0.07 });
}

function updateTracers(dt) {
  for (var i = tracers.length - 1; i >= 0; i--) {
    var t = tracers[i];
    t.life -= dt;
    if (t.life <= 0) {
      scene.remove(t.line);
      t.line.geometry.dispose();
      tracers.splice(i, 1);
    }
  }
}

function muzzleFlash(worldPos) {
  flashLight.position.copy(worldPos);
  flashLight.intensity = 2.4; // 主循环内按帧衰减，避免 setTimeout 与暂停/多枪互相干扰
}

// ---------------- 视角模型（枪） ----------------
function buildViewModel(key) {
  if (vmGun) { vmRoot.remove(vmGun); }
  vmGun = new THREE.Group();
  var dark = new THREE.MeshLambertMaterial({ color: 0x2b2b2b });
  var wood = new THREE.MeshLambertMaterial({ color: 0x6b4a26 });
  var green = new THREE.MeshLambertMaterial({ color: 0x3d5233 });

  function part(w, h, d, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    vmGun.add(m);
    return m;
  }

  if (key === 'usp') {
    part(0.07, 0.09, 0.24, dark, 0, 0, -0.05);
    part(0.05, 0.05, 0.10, dark, 0, 0.015, -0.20);
    part(0.06, 0.12, 0.07, dark, 0, -0.09, 0.05);
    muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.01, -0.28);
  } else if (key === 'awp') {
    part(0.07, 0.11, 0.80, green, 0, 0, -0.25);
    part(0.05, 0.05, 0.30, dark, 0, 0.09, -0.15);   // 镜
    part(0.06, 0.10, 0.16, green, 0, -0.08, 0.12);  // 握把
    part(0.05, 0.09, 0.12, dark, 0, -0.02, 0.22);   // 枪托
    muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0, -0.70);
  } else if (key === 'knife') {
    var blade = new THREE.MeshLambertMaterial({ color: 0xb8bcc4 });
    part(0.045, 0.07, 0.14, dark, 0, -0.05, 0.08);   // 刀柄
    part(0.02, 0.055, 0.34, blade, 0, 0.02, -0.12);  // 刀身
    part(0.05, 0.02, 0.08, dark, 0, 0.055, 0.01);    // 护手
    muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.02, -0.32);
  } else { // ak / m4
    var bodyMat = key === 'ak' ? wood : dark;
    part(0.08, 0.12, 0.55, bodyMat, 0, 0, -0.15);
    part(0.05, 0.06, 0.25, dark, 0, 0.02, -0.50);   // 枪管
    part(0.06, 0.16, 0.08, dark, 0, -0.12, -0.08);  // 弹匣
    part(0.06, 0.10, 0.14, bodyMat, 0, -0.03, 0.18);// 枪托
    muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.02, -0.65);
  }
  vmGun.add(muzzle);
  vmRoot.add(vmGun);
  vmRoot.position.set(0.26, -0.24, -0.5);
  vmRoot.rotation.set(0, 0, 0);
}

// ---------------- Bot ----------------
function buildBotMesh(team) {
  var g = new THREE.Group();
  var uni = new THREE.MeshLambertMaterial({ color: team === 'ct' ? 0x3a506b : 0x5f6b3a });
  var skin = new THREE.MeshLambertMaterial({ color: 0xc9a06c });
  var dark = new THREE.MeshLambertMaterial({ color: 0x222222 });
  var hat = new THREE.MeshLambertMaterial({ color: team === 'ct' ? 0x1c2733 : 0x222222 });

  function part(w, h, d, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  }
  part(0.22, 0.55, 0.24, dark, -0.14, 0.28, 0);   // 左腿
  part(0.22, 0.55, 0.24, dark, 0.14, 0.28, 0);    // 右腿
  part(0.62, 0.75, 0.32, uni, 0, 0.95, 0);        // 躯干
  part(0.30, 0.30, 0.30, skin, 0, 1.55, 0);       // 头
  part(0.34, 0.12, 0.34, hat, 0, 1.72, 0);        // 头巾/头盔
  part(0.09, 0.11, 0.65, dark, 0.2, 1.05, -0.3);  // 枪
  return g;
}

var PERCEPT = 0.13;   // 感知节流（秒）：目标搜索按 bot 相位错开降频，战斗瞄准仍逐帧

function addBot(team, spawn, name) {
  var mesh = buildBotMesh(team);
  mesh.position.copy(spawn);
  scene.add(mesh);
  bots.push({
    name: name, team: team, hp: 100, alive: true,
    pos: mesh.position, yaw: team === 'ct' ? 0 : Math.PI,
    speed: 3.3 + Math.random() * 0.5,
    state: 'patrol',
    wp: waypoints[Math.floor(Math.random() * waypoints.length)],
    reactT: 0, lastShot: -9, nextGap: 0.3,
    loseT: 0, strafe: 1, strafeT: 0, lastSeen: null,
    mesh: mesh, dieT: 0,
    stuckT: 0, evadeT: 0, evadeYaw: 0,
    perceptT: Math.random() * PERCEPT, tgt: null
  });
}

function spawnTeams() {
  clearBots();
  var nt = BOT_NAMES.slice();
  for (var i = 0; i < CFG.botCount; i++) {
    var ni = Math.floor(Math.random() * nt.length);
    addBot('t', botSpawns[i % botSpawns.length], nt.splice(ni, 1)[0] || ('T-' + i));
  }
  // 4 名 CT 队友（玩家是第 5 人）
  var ctSp = [[-4, 42], [4, 42], [-10, 45], [10, 45]];
  var nc = CT_NAMES.slice();
  for (var j = 0; j < 4; j++) {
    var nj = Math.floor(Math.random() * nc.length);
    addBot('ct', new THREE.Vector3(ctSp[j][0], 0, ctSp[j][1]), nc.splice(nj, 1)[0] || ('CT-' + j));
  }
}

function clearBots() {
  for (var i = 0; i < bots.length; i++) scene.remove(bots[i].mesh);
  bots = [];
}

function botEye(b) { return b.pos.y + 1.55; }

// 选最近的可见敌人（玩家或敌方 bot）
function pickTarget(b) {
  var best = null, bestD = 48;
  if (b.team === 't' && !P.dead) {
    var dx = P.pos.x - b.pos.x, dz = P.pos.z - b.pos.z;
    var d = Math.sqrt(dx * dx + dz * dz);
    if (d < bestD && hasLOS(b.pos.x, botEye(b), b.pos.z, P.pos.x, P.pos.y + eyeHeight(), P.pos.z)) {
      best = { player: true, d: d };
      bestD = d;
    }
  }
  for (var i = 0; i < bots.length; i++) {
    var o = bots[i];
    if (!o.alive || o.team === b.team) continue;
    var ox = o.pos.x - b.pos.x, oz = o.pos.z - b.pos.z;
    var od = Math.sqrt(ox * ox + oz * oz);
    if (od < bestD && hasLOS(b.pos.x, botEye(b), b.pos.z, o.pos.x, o.pos.y + 1.0, o.pos.z)) {
      best = { player: false, ref: o, d: od };
      bestD = od;
    }
  }
  return best;
}

function updateBot(b, dt, now) {
  var m = b.mesh;
  if (!b.alive) {
    b.dieT += dt;
    var k = Math.min(1, b.dieT / 0.35);
    m.rotation.x = -Math.PI / 2 * k;
    m.position.y = 0.1 * k;
    if (b.dieT > 3) { scene.remove(m); b.gone = true; }
    return;
  }
  if (G.state === 'buytime') return;

  // 感知（节流 + 相位错开；命中/开火决策用上次感知结果，误差 ≤ 一个周期）
  if (now >= b.perceptT) {
    b.perceptT = now + PERCEPT;
    var seen = pickTarget(b);
    if (seen) {
      if (b.state !== 'combat') {
        b.state = 'combat';
        b.reactT = now + 0.45 + Math.random() * 0.5;
      }
      b.loseT = 0;
      b.lastSeen = seen.player ? P.pos.clone() : seen.ref.pos.clone();
      b.tgt = seen;
    } else {
      b.tgt = null;
      if (b.state === 'combat') {
        b.loseT += PERCEPT;
        if (b.loseT > 2) { b.state = 'patrol'; b.lastSeen = null; }
      }
    }
  }
  var tgt = b.tgt;

  var moveX = 0, moveZ = 0, wantSpeed = 0;

  if (b.state === 'combat' && b.lastSeen) {
    var tp = tgt ? (tgt.player ? P.pos : tgt.ref.pos) : b.lastSeen;
    var dx = tp.x - b.pos.x, dz = tp.z - b.pos.z;
    var dist = Math.sqrt(dx * dx + dz * dz) || 1;
    var ndx = dx / dist, ndz = dz / dist;

    // 面向目标
    var targetYaw = Math.atan2(-dx, -dz);
    var dy = targetYaw - b.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    b.yaw += dy * Math.min(1, dt * 8);

    // 距离管理 + 横移
    b.strafeT -= dt;
    if (b.strafeT <= 0) {
      b.strafe = Math.random() < 0.5 ? -1 : 1;
      b.strafeT = 0.8 + Math.random() * 1.2;
    }
    var fwd = 1;
    if (tgt) {
      if (dist > 14) fwd = 1;
      else if (dist < 5) fwd = -0.7;
      else fwd = 0;
    }
    var rx = -ndz * b.strafe, rz = ndx * b.strafe;
    moveX = ndx * fwd + rx * 0.8;
    moveZ = ndz * fwd + rz * 0.8;
    wantSpeed = b.speed * 0.8;

    // 开火
    if (tgt && now > b.reactT && now - b.lastShot > b.nextGap) {
      b.lastShot = now;
      b.nextGap = 0.20 + Math.random() * 0.18;
      botShoot(b, tgt, dist);
    }
  } else {
    // 巡逻：听到敌方枪声则靠近
    var wpT = b.wp;
    if (G.heardPos && G.heardPos.byTeam !== b.team && now - G.heardPos.t < 6) wpT = G.heardPos.pos;
    var tx = wpT.x - b.pos.x, tz = wpT.z - b.pos.z;
    var td = Math.sqrt(tx * tx + tz * tz);
    if (td < 1.2) {
      b.wp = waypoints[Math.floor(Math.random() * waypoints.length)];
      if (G.heardPos && wpT === G.heardPos.pos) G.heardPos = null;
    } else {
      moveX = tx / td; moveZ = tz / td;
      wantSpeed = b.speed;
      b.yaw = Math.atan2(-moveX, -moveZ);
    }
  }

  // 卡死检测 → 随机转向
  var mv = Math.sqrt(moveX * moveX + moveZ * moveZ);
  if (mv > 0.01 && wantSpeed > 0) {
    moveX /= mv; moveZ /= mv;
    var ox = b.pos.x, oz = b.pos.z;
    moveXZ(b, moveX * wantSpeed * dt, moveZ * wantSpeed * dt, 0.35, 1.7);
    var moved = Math.sqrt((b.pos.x - ox) * (b.pos.x - ox) + (b.pos.z - oz) * (b.pos.z - oz));
    if (moved < wantSpeed * dt * 0.25) b.stuckT += dt; else b.stuckT = 0;
    if (b.stuckT > 0.5) {
      b.evadeT = 0.9;
      b.evadeYaw = b.yaw + (Math.random() < 0.5 ? 1 : -1) * (1.2 + Math.random());
      b.stuckT = 0;
      if (b.state === 'patrol') b.wp = waypoints[Math.floor(Math.random() * waypoints.length)];
    }
  }
  if (b.evadeT > 0) {
    b.evadeT -= dt;
    moveXZ(b, -Math.sin(b.evadeYaw) * wantSpeed * dt, -Math.cos(b.evadeYaw) * wantSpeed * dt, 0.35, 1.7);
  }

  // bot 间排斥
  for (var i = 0; i < bots.length; i++) {
    var o = bots[i];
    if (o === b || !o.alive) continue;
    var sx = b.pos.x - o.pos.x, sz = b.pos.z - o.pos.z;
    var sd = Math.sqrt(sx * sx + sz * sz);
    if (sd < 0.75 && sd > 0.001) {
      b.pos.x += (sx / sd) * (0.75 - sd) * 0.5;
      b.pos.z += (sz / sd) * (0.75 - sd) * 0.5;
    }
  }

  m.rotation.y = b.yaw;
}

function botShoot(b, tgt, dist) {
  var ox = b.pos.x - Math.sin(b.yaw) * 0.4, oy = b.pos.y + 1.1, oz = b.pos.z - Math.cos(b.yaw) * 0.4;
  // 音量按与玩家的距离衰减
  var pdx = P.pos.x - ox, pdz = P.pos.z - oz;
  var pd = Math.sqrt(pdx * pdx + pdz * pdz);
  playGun('rifle', Math.max(0.06, 1 - pd / 55) * 0.7);
  muzzleFlash(new THREE.Vector3(ox, oy, oz));
  // 广播枪声（吸引敌方 bot）
  G.heardPos = { pos: b.pos.clone(), t: clock.elapsedTime, byTeam: b.team };

  var isP = tgt.player;
  var tx, ty, tz;
  if (isP) { tx = P.pos.x; ty = P.pos.y + eyeHeight() - 0.25; tz = P.pos.z; }
  else { tx = tgt.ref.pos.x; ty = tgt.ref.pos.y + 1.0; tz = tgt.ref.pos.z; }

  var moving = isP ? (P.moveSpeed > 1.5) : true;
  var hitP = 0.36 * (1 - dist / 60) * (moving ? 0.65 : 1) + 0.05;
  if (isP && P.crouch) hitP *= 1.1;

  var hit = Math.random() < hitP && (!isP || !P.dead);
  if (!hit) {
    tx += (Math.random() - 0.5) * 2.4;
    ty += (Math.random() - 0.5) * 1.6;
    tz += (Math.random() - 0.5) * 2.4;
  }
  spawnTracer(new THREE.Vector3(ox, oy, oz), new THREE.Vector3(tx, ty, tz),
    b.team === 't' ? 0xffb0a0 : 0xa0c8ff);

  if (hit) {
    var dmg = 9 + Math.random() * 9;
    if (Math.random() < 0.08) dmg *= 3; // 爆头
    var botGun = b.team === 't' ? 'AK-47' : 'M4A1';
    if (isP) damagePlayer(dmg, b.name, b.team, botGun);
    else damageBot(tgt.ref, dmg, b.name, b.team, botGun);
  }
}

function damageBot(v, dmg, srcName, srcTeam, wpn) {
  if (!v.alive) return;
  v.hp -= dmg;
  spawnBlood(new THREE.Vector3(v.pos.x, v.pos.y + 1.1, v.pos.z));
  if (v.hp <= 0) {
    v.alive = false;
    v.dieT = 0;
    killFeed(srcName, srcTeam, v.name, v.team, wpn || 'AK-47', false);
    checkRoundWin();
  }
}

// ---------------- 玩家 ----------------
function resetPlayerForRound() {
  P.pos.copy(playerSpawn);
  P.pos.y = 0;
  P.vel.set(0, 0, 0);
  P.yaw = 0; P.pitch = 0;
  P.hp = 100; P.dead = false;
  P.bloom = 0; P.reloading = 0; P.switching = 0;
  P.scoped = false;
  P.recP = 0; P.recY = 0; P.swing = 0;
  vmRoot.visible = true;
  // 弹药补满（爽快优先）
  for (var k in P.weapons) {
    P.weapons[k].ammo = WEAPONS[k].mag;
    P.weapons[k].reserve = WEAPONS[k].reserve;
  }
  updateScopeUI();
}

function eyeHeight() { return P.crouch ? 1.05 : 1.62; }
function playerHeight() { return P.crouch ? 1.15 : 1.75; }

function updatePlayer(dt) {
  if (P.dead) return;
  var speedBase = P.crouch ? 1.6 : 4.4;
  if (P.scoped) speedBase *= 0.55;
  if (keys['ShiftLeft'] || keys['ShiftRight']) speedBase = 2.2; // 静步

  var fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  var rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  var mx = 0, mz = 0;
  if (keys['KeyW']) { mx += fx; mz += fz; }
  if (keys['KeyS']) { mx -= fx; mz -= fz; }
  if (keys['KeyD']) { mx += rx; mz += rz; }
  if (keys['KeyA']) { mx -= rx; mz -= rz; }
  var ml = Math.sqrt(mx * mx + mz * mz);
  var moving = ml > 0.01;
  if (moving) {
    mx /= ml; mz /= ml;
    moveXZ(P, mx * speedBase * dt, mz * speedBase * dt, 0.35, playerHeight());
    // 脚步声
    P.stepT -= dt * (speedBase > 3 ? 1 : 0.55);
    if (P.stepT <= 0 && P.grounded) {
      if (speedBase > 3) stepSound();
      P.stepT = 0.38;
    }
  }
  P.moveSpeed = moving ? speedBase : 0;

  // 蹲（起身前查头顶净空，防止在低矮障碍下卡进几何体）
  var wantCrouch = !!(keys['ControlLeft'] || keys['KeyC']);
  if (!wantCrouch && P.crouch &&
      hitSolid(P.pos.x, P.pos.z, P.pos.y + 0.05, P.pos.y + 1.75, 0.35)) {
    wantCrouch = true;
  }
  P.crouch = wantCrouch;

  // 跳
  if (keys['Space'] && P.grounded) {
    P.vel.y = 7.4;
    P.grounded = false;
  }

  // 垂直
  P.vel.y -= 21 * dt;
  var ny = P.pos.y + P.vel.y * dt;
  P.grounded = false;
  if (ny <= 0) { ny = 0; P.vel.y = 0; P.grounded = true; }
  for (var i = 0; i < solids.length; i++) {
    var s = solids[i];
    if (P.pos.x + 0.35 > s.min.x && P.pos.x - 0.35 < s.max.x &&
        P.pos.z + 0.35 > s.min.z && P.pos.z - 0.35 < s.max.z) {
      if (P.pos.y >= s.max.y - 0.05 && ny < s.max.y && P.vel.y <= 0) {
        ny = s.max.y; P.vel.y = 0; P.grounded = true;
      }
    }
  }
  P.pos.y = ny;

  // 相机（叠加后坐弹跳偏移）
  camera.position.set(P.pos.x, P.pos.y + eyeHeight(), P.pos.z);
  camera.rotation.y = P.yaw + P.recY;
  camera.rotation.x = P.pitch + P.recP;

  // 后坐弹跳自动回位 + 扩散快速衰减
  var rec = Math.min(1, dt * 8);
  P.recP += (0 - P.recP) * rec;
  P.recY += (0 - P.recY) * rec;
  P.bloom = Math.max(0, P.bloom - dt * 0.05);
}

function damagePlayer(dmg, src, srcTeam, wpn) {
  if (P.dead || G.state !== 'live') return;
  if (P.armor > 0) {
    var absorbed = Math.min(P.armor, dmg * 0.5);
    P.armor -= absorbed;
    dmg -= absorbed * 0.6;
  }
  P.hp -= dmg;
  dmgFlash();
  if (P.hp <= 0) {
    P.hp = 0;
    P.dead = true;
    killFeed(src, srcTeam || 't', '你', 'ct', wpn || 'AK-47', false);
    banner('你已阵亡', '观战队友视角 · 回合继续', 3000);
    setScope(false);
    el.crosshair.style.display = 'none';
    vmRoot.visible = false;
    checkRoundWin();
  }
}

// ---------------- 射击 ----------------
function curWpn() { return P.weapons[P.cur]; }
function curDef() { return WEAPONS[P.cur]; }

function spreadEff() {
  var d = curDef();
  var s = (P.cur === 'awp' && !P.scoped) ? d.unscoped : d.spread;
  s += P.bloom;
  if (P.moveSpeed > 1) s *= 1.9;
  if (!P.grounded) s *= 2.6;
  if (P.crouch) s *= 0.65;
  if (P.scoped) s *= 0.25;
  return s;
}

function tryFire(now) {
  if (G.state !== 'live' || P.dead || P.reloading > 0 || P.switching > 0) return;
  var d = curDef(), w = curWpn();
  if (now - P.lastShot < d.interval) return;
  if (d.melee) { meleeAttack(d, now); return; }
  if (w.ammo <= 0) {
    blip(300, 0.05, 0.15);
    startReload();
    P.lastShot = now;
    return;
  }
  P.lastShot = now;
  w.ammo--;

  // 后坐：视角弹跳（随后自动回位）+ bloom 扩散
  P.recP = Math.min(0.09, P.recP + d.recoil * (0.75 + Math.random() * 0.4));
  P.recY += (Math.random() - 0.5) * d.recoil * 0.3;
  P.bloom = Math.min(0.022, P.bloom + d.recoil * 0.16);

  // 视角模型后座
  vmRoot.position.z += 0.06;
  vmRoot.rotation.x += 0.05;

  // 射线
  var dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  var sEff = spreadEff();
  var right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  var up = new THREE.Vector3().crossVectors(right, dir).normalize();
  var ang = Math.random() * Math.PI * 2;
  var rad = Math.sqrt(Math.random()) * sEff;
  dir.addScaledVector(right, Math.cos(ang) * rad).addScaledVector(up, Math.sin(ang) * rad).normalize();

  var o = camera.position;
  var tWall = rayWalls(o.x, o.y, o.z, dir.x, dir.y, dir.z, 120);

  // vs bots（只命中敌方 T，友军不挡子弹）
  var bestT = tWall, bestBot = null, bestHead = false;
  for (var i = 0; i < bots.length; i++) {
    var b = bots[i];
    if (!b.alive || b.team !== 't') continue;
    var th = raySphere(o.x, o.y, o.z, dir.x, dir.y, dir.z, b.pos.x, b.pos.y + 1.55, b.pos.z, 0.26);
    if (th > 0 && th < bestT) { bestT = th; bestBot = b; bestHead = true; continue; }
    var tb = rayAABB(o.x, o.y, o.z, dir.x, dir.y, dir.z,
      { x: b.pos.x - 0.34, y: b.pos.y, z: b.pos.z - 0.34 },
      { x: b.pos.x + 0.34, y: b.pos.y + 1.38, z: b.pos.z + 0.34 });
    if (tb > 0 && tb < bestT) { bestT = tb; bestBot = b; bestHead = false; }
  }

  var hitPoint = new THREE.Vector3(o.x + dir.x * bestT, o.y + dir.y * bestT, o.z + dir.z * bestT);

  // 枪口特效（世界坐标）
  var mw = new THREE.Vector3();
  muzzle.getWorldPosition(mw);
  muzzleFlash(mw);
  spawnTracer(mw, hitPoint, 0xffe0a0);
  playGun(d.snd, 1);

  // 广播枪声位置 → 敌方 bot 听到
  G.heardPos = { pos: P.pos.clone(), t: now, byTeam: 'ct' };

  if (bestBot) {
    spawnBlood(hitPoint);
    var dmg = d.dmg * (bestHead ? d.headMul : 1);
    bestBot.hp -= dmg;
    hitMark(bestHead);
    if (bestHead) blip(1500, 0.07, 0.25);
    else blip(1050, 0.05, 0.18);
    if (bestBot.hp <= 0 && bestBot.alive) creditKill(bestBot, d.name, bestHead);
  } else if (bestT < 120) {
    spawnSpark(hitPoint);
  }

  // AWP 开枪后自动退镜
  if (P.cur === 'awp' && P.scoped) setScope(false);
}

function addMoney(n) { P.money = Math.min(CFG.maxMoney, P.money + n); }

// 击杀结算（枪/刀通用）
function creditKill(b, wpnName, special) {
  b.alive = false;
  b.dieT = 0;
  addMoney(300);
  P.kills++;
  killFeed('你', 'ct', b.name, 't', wpnName, special);
  blip(600, 0.12, 0.2, 'sine');
  checkRoundWin();
}

// 近战攻击（战术刀）
function meleeAttack(d, now) {
  P.lastShot = now;
  P.swing = 0.3;
  swingSound();

  var dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  var o = camera.position;
  var tWall = rayWalls(o.x, o.y, o.z, dir.x, dir.y, dir.z, d.range);

  var bestT = tWall, bestBot = null;
  for (var i = 0; i < bots.length; i++) {
    var b = bots[i];
    if (!b.alive || b.team !== 't') continue;
    var th = raySphere(o.x, o.y, o.z, dir.x, dir.y, dir.z, b.pos.x, b.pos.y + 1.55, b.pos.z, 0.3);
    if (th > 0 && th < bestT) { bestT = th; bestBot = b; continue; }
    var tb = rayAABB(o.x, o.y, o.z, dir.x, dir.y, dir.z,
      { x: b.pos.x - 0.38, y: b.pos.y, z: b.pos.z - 0.38 },
      { x: b.pos.x + 0.38, y: b.pos.y + 1.38, z: b.pos.z + 0.38 });
    if (tb > 0 && tb < bestT) { bestT = tb; bestBot = b; }
  }

  if (bestBot) {
    // 背刺判定：站在目标背后（目标前向与"目标→玩家"方向相反）
    var bf = { x: -Math.sin(bestBot.yaw), z: -Math.cos(bestBot.yaw) };
    var vx = P.pos.x - bestBot.pos.x, vz = P.pos.z - bestBot.pos.z;
    var vl = Math.sqrt(vx * vx + vz * vz) || 1;
    var behind = (bf.x * vx + bf.z * vz) / vl < -0.35;
    var hitPoint = new THREE.Vector3(o.x + dir.x * bestT, o.y + dir.y * bestT, o.z + dir.z * bestT);
    spawnBlood(hitPoint);
    stabSound();
    hitMark(behind);
    bestBot.hp -= behind ? d.backstab : d.dmg;
    G.heardPos = { pos: P.pos.clone(), t: now, byTeam: 'ct' };
    if (bestBot.hp <= 0 && bestBot.alive) creditKill(bestBot, d.name, behind ? '背刺' : false);
  } else if (tWall < d.range) {
    var wp = new THREE.Vector3(o.x + dir.x * tWall, o.y + dir.y * tWall, o.z + dir.z * tWall);
    spawnSpark(wp);
    noiseTick(0.2, 2500, 0.06);
  }
}

function startReload() {
  var w = curWpn(), d = curDef();
  if (d.melee) return;
  if (P.reloading > 0 || w.ammo >= d.mag || w.reserve <= 0) return;
  P.reloading = d.reload;
  reloadSound();
}

function finishReload() {
  var w = curWpn(), d = curDef();
  var need = d.mag - w.ammo;
  var take = Math.min(need, w.reserve);
  w.ammo += take;
  w.reserve -= take;
}

function switchTo(key) {
  if (!P.weapons[key] || P.cur === key || G.state === 'menu') return;
  P.cur = key;
  P.reloading = 0;
  P.switching = 0.28;
  buildViewModel(key);
  setScope(false);
  blip(800, 0.04, 0.12);
}

function setScope(on) {
  P.scoped = on;
  updateScopeUI();
}

function updateScopeUI() {
  el.scope.style.display = P.scoped ? 'block' : 'none';
  el.crosshair.style.display = P.scoped ? 'none' : 'block';
  camera.fov = P.scoped ? CFG.fov / curDef().zoom : CFG.fov;
  camera.updateProjectionMatrix();
  if (vmGun) vmGun.visible = !P.scoped;
}

// ---------------- 回合 / 比赛 ----------------
function startMatch() {
  G.ct = 0; G.t = 0; G.round = 0;
  P.money = CFG.startMoney;
  P.kills = 0;
  P.armor = 0;
  P.weapons = { usp: mkWpn('usp'), knife: mkWpn('knife') };
  P.cur = 'usp';
  buildViewModel('usp');
  startRound();
}

function startRound() {
  G.round++;
  clearBots();
  // 清粒子/曳光
  for (var i = parts.length - 1; i >= 0; i--) scene.remove(parts[i].m);
  parts = [];
  resetPlayerForRound();
  spawnTeams();
  G.state = 'buytime';
  G.stateT = CFG.buyTime;
  G.roundT = CFG.roundTime;
  banner('第 ' + G.round + ' 回合', '按 B 打开购买菜单 · 准备接敌', 2400);
  el.buymenu.style.display = 'none';
  buyOpen = false;
}

function endRound(winner, reason) {
  if (G.state === 'roundend' || G.state === 'matchend') return;
  G.state = 'roundend';
  G.stateT = 3.2;
  if (winner === 'ct') {
    G.ct++;
    addMoney(1400);
    banner('回合胜利', reason + ' · +$1400', 2800);
    blip(700, 0.3, 0.2, 'sine');
  } else {
    G.t++;
    addMoney(900);
    banner('回合失败', reason + ' · +$900', 2800);
    blip(220, 0.4, 0.25, 'sawtooth');
  }
  if (G.ct >= CFG.winRounds || G.t >= CFG.winRounds) {
    setTimeout(function () {
      G.state = 'matchend';
      var win = G.ct > G.t;
      banner(win ? '比赛胜利！' : '比赛结束', '最终比分 CT ' + G.ct + ' : ' + G.t + ' T · 点击屏幕重新开始', 999999);
      document.exitPointerLock && document.exitPointerLock();
    }, 3000);
  }
}

function countAlive() {
  var t = 0, c = P.dead ? 0 : 1;
  for (var i = 0; i < bots.length; i++) {
    var b = bots[i];
    if (b.alive) { if (b.team === 't') t++; else c++; }
  }
  return { t: t, c: c };
}

function checkRoundWin() {
  if (G.state !== 'live') return;
  var a = countAlive();
  if (a.t === 0) endRound('ct', '全歼敌方');
  else if (a.c === 0) endRound('t', 'CT 方全灭');
}

function updateRound(dt) {
  if (G.state === 'buytime') {
    G.stateT -= dt;
    if (G.stateT <= 0) {
      G.state = 'live';
      banner('行动开始', '歼灭所有敌人', 1600);
      if (buyOpen) { buyOpen = false; el.buymenu.style.display = 'none'; }
    }
  } else if (G.state === 'live') {
    G.roundT -= dt;
    if (G.roundT <= 0) {
      var a = countAlive();
      endRound(a.c >= a.t ? 'ct' : 't', '时间耗尽');
    }
  } else if (G.state === 'roundend') {
    G.stateT -= dt;
    if (G.stateT <= 0 && G.state !== 'matchend') startRound();
  }
}

// ---------------- 购买 ----------------
var buyOpen = false;
function toggleBuy() {
  if (G.state !== 'buytime') return;
  buyOpen = !buyOpen;
  el.buymenu.style.display = buyOpen ? 'block' : 'none';
}

function buy(idx) {
  if (G.state !== 'buytime') return;
  var item = null;
  if (idx === 1) item = { key: 'ak', cost: WEAPONS.ak.price };
  if (idx === 2) item = { key: 'm4', cost: WEAPONS.m4.price };
  if (idx === 3) item = { key: 'awp', cost: WEAPONS.awp.price };
  if (idx === 4) item = { key: 'armor', cost: 650 };
  if (!item) return;
  if (P.money < item.cost) { blip(180, 0.15, 0.2); flashBuyMsg('金钱不足'); return; }
  if (item.key === 'armor') {
    if (P.armor >= 100) { flashBuyMsg('护甲已满'); return; }
    P.armor = 100;
  } else {
    // 替换同槽位
    for (var k in P.weapons) if (WEAPONS[k].slot === 1) delete P.weapons[k];
    P.weapons[item.key] = mkWpn(item.key);
    switchTo(item.key);
  }
  P.money -= item.cost;
  blip(880, 0.08, 0.2, 'sine');
  flashBuyMsg('已购买');
}

var buyMsgT = null;
function flashBuyMsg(t) {
  el.buymsg.textContent = t;
  el.buymsg.style.opacity = 1;
  if (buyMsgT) clearTimeout(buyMsgT);
  buyMsgT = setTimeout(function () { el.buymsg.style.opacity = 0; }, 1200);
}

// ---------------- HUD ----------------
var el = {};
function cacheEls() {
  ['hp', 'hpbar', 'armor', 'ammo', 'money', 'score', 'timer', 'alive', 'crosshair',
   'hitmarker', 'killfeed', 'banner', 'bannersub', 'menu', 'hud', 'pause', 'dmgvig',
   'buymenu', 'buymsg', 'hint', 'scope'].forEach(function (id) {
    el[id] = document.getElementById(id);
  });
}

var bannerT = null;
function banner(main, sub, ms) {
  el.banner.textContent = main;
  el.bannersub.textContent = sub || '';
  el.banner.parentNode.style.opacity = 1;
  if (bannerT) clearTimeout(bannerT);
  if (ms < 99999) {
    bannerT = setTimeout(function () {
      el.banner.parentNode.style.opacity = 0;
    }, ms);
  }
}

function killFeed(killer, kTeam, victim, vTeam, wpn, special) {
  var tag = special === true ? ' ·爆头' : (special ? ' ·' + special : '');
  var div = document.createElement('div');
  div.className = 'kf';
  div.innerHTML = '<span class="' + (kTeam === 'ct' ? 'kfc' : 'kft') + '">' + killer +
    '</span> [' + wpn + tag + '] <span class="' +
    (vTeam === 'ct' ? 'kfc' : 'kft') + '">' + victim + '</span>';
  el.killfeed.appendChild(div);
  setTimeout(function () {
    div.style.opacity = 0;
    setTimeout(function () { div.remove(); }, 500);
  }, 4000);
}

var hmT = null;
function hitMark(head) {
  el.hitmarker.style.opacity = 1;
  el.hitmarker.style.color = head ? '#ff4b3e' : '#fff';
  if (hmT) clearTimeout(hmT);
  hmT = setTimeout(function () { el.hitmarker.style.opacity = 0; }, 90);
}

var dmgT = null;
function dmgFlash() {
  el.dmgvig.style.opacity = 0.55;
  if (dmgT) clearTimeout(dmgT);
  dmgT = setTimeout(function () { el.dmgvig.style.opacity = 0; }, 180);
}

function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
}

var hudPrev = {};
function updateHUD() {
  var hp = Math.ceil(P.hp);
  if (hudPrev.hp !== hp) {
    hudPrev.hp = hp;
    el.hp.textContent = hp;
    el.hpbar.style.width = Math.max(0, P.hp) + '%';
    el.hpbar.style.background = P.hp > 50 ? '#7fd65a' : (P.hp > 25 ? '#e8c33a' : '#e84a3a');
  }
  if (hudPrev.armor !== P.armor) {
    hudPrev.armor = P.armor;
    el.armor.textContent = Math.ceil(P.armor);
  }
  var w = curWpn(), d = curDef();
  var ammoTxt = d.melee ? '— 刀 —' :
    (P.reloading > 0 ? '换弹中…' : (w.ammo + ' / ' + w.reserve));
  if (hudPrev.ammo !== ammoTxt) { hudPrev.ammo = ammoTxt; el.ammo.textContent = ammoTxt; }
  if (hudPrev.money !== P.money) { hudPrev.money = P.money; el.money.textContent = '$' + P.money; }
  var scoreTxt = 'CT ' + G.ct + ' : ' + G.t + ' T';
  if (hudPrev.score !== scoreTxt) { hudPrev.score = scoreTxt; el.score.textContent = scoreTxt; }
  var timeTxt = G.state === 'buytime' ? '购买 ' + Math.ceil(G.stateT) :
    (G.state === 'live' ? fmtTime(G.roundT) : fmtTime(0));
  if (hudPrev.timer !== timeTxt) { hudPrev.timer = timeTxt; el.timer.textContent = timeTxt; }
  var av = countAlive();
  var aliveTxt = '存活 ' + av.c + 'v' + av.t;
  if (hudPrev.alive !== aliveTxt) { hudPrev.alive = aliveTxt; el.alive.textContent = aliveTxt; }
  // 准星扩散（静止时数值不变，跳过写入）
  var gap = Math.min(34, 5 + spreadEff() * 1400);
  if (hudPrev.gap === undefined || Math.abs(gap - hudPrev.gap) > 0.25) {
    hudPrev.gap = gap;
    el.crosshair.style.setProperty('--gap', gap + 'px');
  }
  var hintOn = G.state === 'buytime' && !buyOpen;
  if (hudPrev.hint !== hintOn) { hudPrev.hint = hintOn; el.hint.style.opacity = hintOn ? 1 : 0; }
}

// ---------------- 输入 ----------------
var keys = {};
var mouseDown = false;

function initInput() {
  // 失焦清键：防止 Alt+Tab 后按键状态卡死
  addEventListener('blur', function () {
    keys = {};
    mouseDown = false;
  });

  addEventListener('keydown', function (e) {
    if (G.paused) return;
    keys[e.code] = true;
    if (e.code === 'KeyR') startReload();
    if (e.code === 'KeyB') toggleBuy();
    if (e.code === 'Digit1' && !buyOpen) switchTo(primaryKey());
    if (e.code === 'Digit2' && !buyOpen) switchTo('usp');
    if (e.code === 'Digit3' && !buyOpen) switchTo('knife');
    if (buyOpen && e.code.indexOf('Digit') === 0) {
      var n = parseInt(e.code.slice(5), 10);
      if (n >= 1 && n <= 4) buy(n);
    }
    if (e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', function (e) { keys[e.code] = false; });

  addEventListener('mousedown', function (e) {
    if (G.state === 'menu' || G.state === 'matchend') return;
    if (!document.pointerLockElement) return;
    if (e.button === 0) mouseDown = true;
    if (e.button === 2 && P.cur === 'awp') setScope(!P.scoped);
  });
  addEventListener('mouseup', function (e) {
    if (e.button === 0) mouseDown = false;
  });
  addEventListener('contextmenu', function (e) { e.preventDefault(); });

  addEventListener('mousemove', function (e) {
    if (!document.pointerLockElement || P.dead) return;
    var s = CFG.sens * (P.scoped ? 0.5 : 1);
    P.yaw -= e.movementX * s;
    P.pitch -= e.movementY * s;
    P.pitch = Math.max(-1.55, Math.min(1.55, P.pitch));
  });

  document.addEventListener('pointerlockchange', function () {
    var locked = !!document.pointerLockElement;
    var inGame = G.state === 'live' || G.state === 'buytime' || G.state === 'roundend';
    G.paused = !locked && inGame;
    el.pause.style.display = G.paused ? 'flex' : 'none';
    if (G.paused) {
      keys = {};
      mouseDown = false;
    } else if (clock) {
      clock.getDelta(); // 丢弃暂停期间累积的时间差
    }
  });
}

function primaryKey() {
  for (var k in P.weapons) if (WEAPONS[k].slot === 1) return k;
  return 'usp';
}

function lockPointer() {
  var c = renderer.domElement;
  if (!c.requestPointerLock) return;
  try {
    var p = c.requestPointerLock();
    if (p && p.catch) p.catch(function () {}); // 浏览器会拒绝退出后过快的重锁，静默即可
  } catch (e) {}
}

// ---------------- 主循环 ----------------
function tick() {
  requestAnimationFrame(tick);
  var dt = Math.min(0.05, clock.getDelta());
  var now = clock.elapsedTime;

  // 枪口灯按帧衰减（不依赖定时器，暂停时自然熄灭）
  flashLight.intensity = Math.max(0, flashLight.intensity - dt * 55);

  if (G.state !== 'menu' && G.state !== 'matchend' && !G.paused) {
    updatePlayer(dt);

    // 阵亡后：观战存活队友视角，队友全灭则俯瞰战场
    if (P.dead) {
      var spec = null;
      for (var si = 0; si < bots.length; si++) {
        if (bots[si].team === 'ct' && bots[si].alive) { spec = bots[si]; break; }
      }
      if (spec) {
        camera.position.set(
          spec.pos.x - Math.sin(spec.yaw) * 0.3,
          spec.pos.y + 1.6,
          spec.pos.z - Math.cos(spec.yaw) * 0.3);
        camera.rotation.y = spec.yaw;
        camera.rotation.x = 0;
      } else {
        camera.position.set(0, 34, 24);
        camera.lookAt(0, 0, -12);
      }
    }

    // 开火
    var d = curDef();
    if (mouseDown && (d.auto || now - P.lastShot > d.interval)) {
      if (d.auto) tryFire(now);
    }
    // 半自动在 mousedown 边沿触发（见下）
    if (P.reloading > 0) {
      P.reloading -= dt;
      vmRoot.position.y = -0.24 - 0.15 * Math.min(1, P.reloading);
      vmRoot.rotation.z = 0.5 * Math.min(1, P.reloading);
      if (P.reloading <= 0) { finishReload(); vmRoot.rotation.z = 0; }
    }
    if (P.switching > 0) {
      P.switching -= dt;
      vmRoot.position.y = -0.24 - 0.2 * (P.switching / 0.28);
    }
    // 视角模型弹簧恢复
    vmRoot.position.z += (-0.5 - vmRoot.position.z) * Math.min(1, dt * 12);
    vmRoot.position.y += (-0.24 - vmRoot.position.y) * Math.min(1, dt * 6);
    vmRoot.rotation.x += (0 - vmRoot.rotation.x) * Math.min(1, dt * 10);

    // 挥刀动画（覆盖弹簧位置）
    if (P.swing > 0) {
      P.swing -= dt;
      var sw = Math.sin((1 - Math.max(0, P.swing) / 0.3) * Math.PI);
      vmRoot.rotation.z = -1.1 * sw;
      vmRoot.rotation.x = -0.35 * sw;
      vmRoot.position.x = 0.26 - 0.28 * sw;
    } else {
      vmRoot.position.x += (0.26 - vmRoot.position.x) * Math.min(1, dt * 8);
      vmRoot.rotation.z += (0 - vmRoot.rotation.z) * Math.min(1, dt * 8);
    }

    if (!G.frozen) {
      for (var i = 0; i < bots.length; i++) updateBot(bots[i], dt, now);
      // 清理消失尸体
      for (var j = bots.length - 1; j >= 0; j--) if (bots[j].gone) bots.splice(j, 1);
    }
    updateRound(dt);
    updateParts(dt);
    updateTracers(dt);
    updateHUD();
  }

  renderer.render(scene, camera);
}

// 半自动开火边沿
addEventListener('mousedown', function (e) {
  if (e.button !== 0 || !document.pointerLockElement) return;
  if (G.state !== 'live' || P.dead) return;
  if (!curDef().auto) tryFire(clock.elapsedTime);
});

// ---------------- 启动 ----------------
function start() {
  try {
    initThree();
  } catch (e) {
    var msg = document.createElement('div');
    msg.style.cssText = 'position:fixed;inset:0;z-index:99;display:flex;align-items:center;' +
      'justify-content:center;color:#e8c33a;background:#0a0a0a;text-align:center;' +
      'font:15px/1.8 Consolas,monospace;padding:24px;';
    msg.textContent = '初始化失败：当前浏览器不支持或已禁用 WebGL，无法进入战场。';
    document.body.appendChild(msg);
    return;
  }
  buildMap();
  initFx();
  cacheEls();

  vmRoot = new THREE.Group();
  camera.add(vmRoot);
  buildViewModel('usp');

  P.pos = new THREE.Vector3().copy(playerSpawn);
  P.vel = new THREE.Vector3();
  P.weapons = { usp: mkWpn('usp'), knife: mkWpn('knife') };

  initInput();
  clock = new THREE.Clock();

  el.menu.querySelector('button').addEventListener('click', function () {
    initAudio();
    el.menu.style.display = 'none';
    el.hud.style.display = 'block';
    startMatch();
    lockPointer();
  });
  el.pause.addEventListener('click', function () {
    lockPointer();
  });
  // 比赛结束点击重开
  addEventListener('mousedown', function () {
    if (G.state === 'matchend') {
      el.banner.parentNode.style.opacity = 0;
      startMatch();
      lockPointer();
    }
  });

  if (SHOT_DEBUG) {
    // 无头截图模式：直接进场景，冻结 AI
    G.frozen = true;
    el.menu.style.display = 'none';
    el.hud.style.display = 'block';
    P.weapons = { usp: mkWpn('usp'), ak: mkWpn('ak'), knife: mkWpn('knife') };
    P.cur = 'knife';
    buildViewModel('knife');
    startRound();
    G.state = 'live';
    G.frozen = true;
    camera.position.set(0, 1.62, 20);
    camera.rotation.set(0, Math.PI, 0);
    P.pos.set(0, 0, 20);
  }

  tick();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}

})();
