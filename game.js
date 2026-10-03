/* ============================================================
 * WEB-STRIKE 1.7 — 网页版 CS1.6 灵魂致敬原型
 * 纯 Three.js + WebAudio 合成，无任何 CS 原始资产
 * 1.7：4 张地图 / 3 种模式 / 16 种武器 / AI 难度分级 / 自定义比赛
 * ============================================================ */
(function () {
'use strict';

// ---------------- 配置（固定项） ----------------
var CFG = {
  buyTime: 5,
  roundTime: 115,
  winRounds: 5,
  botCount: 5,
  startMoney: 800,
  maxMoney: 16000,
  fov: 78,
  sens: 0.0022
};

// 玩家自定义设置（主菜单可调，localStorage 持久化）
var SET = {
  map: 0, mode: 'classic', diff: 'normal', bots: 5,
  targetC: 5, targetD: 30, roundTime: 115, money: 800,
  sens: 1, vol: 0.45
};

// AI 难度分级：命中率 / 反应 / 开火间隔 / 伤害 / 爆头率 / 移动目标命中率 / 转身速度
var DIFFS = {
  easy:   { label: '新手', hitBase: 0.22, hitFall: 60, reactA: 0.60, reactB: 1.05, gapMul: 2.3, dmgMul: 0.45, hs: 0.05, moveAcc: 0.50, turn: 6 },
  normal: { label: '普通', hitBase: 0.32, hitFall: 65, reactA: 0.42, reactB: 0.85, gapMul: 1.8, dmgMul: 0.60, hs: 0.08, moveAcc: 0.62, turn: 8 },
  hard:   { label: '困难', hitBase: 0.44, hitFall: 75, reactA: 0.28, reactB: 0.55, gapMul: 1.5, dmgMul: 0.75, hs: 0.12, moveAcc: 0.75, turn: 11 },
  expert: { label: '精英', hitBase: 0.56, hitFall: 90, reactA: 0.16, reactB: 0.38, gapMul: 1.3, dmgMul: 0.90, hs: 0.18, moveAcc: 0.88, turn: 14 }
};

var MODES = {
  classic: { label: '经典歼灭', desc: '回合制 5v5：购买装备、逐回合歼灭敌人，先赢下目标回合数获胜。' },
  tdm:     { label: '团队死斗', desc: '阵亡 3 秒后重新部署，B 键随时购买，先达到击杀目标的队伍获胜（限时 6 分钟）。' },
  gg:      { label: '军备竞赛', desc: '每次击杀升级下一把武器，走完整个军备链并用小刀完成最后一杀者获胜。' }
};

// 军备竞赛武器链：击杀一次升一级，最后一级用刀完成击杀获胜
var GG_LADDER = ['glock', 'usp', 'deagle', 'mp5', 'p90', 'famas', 'ak', 'm4', 'xm1014', 'scout', 'awp', 'knife'];

var WEAPONS = {
  usp:    { name: 'USP',        cat: 'pistol', slot: 2, dmg: 30,  headMul: 4, interval: 0.17,  auto: false, mag: 12,  reserve: 48,  reload: 2.1, spread: 0.009,  recoil: 0.010, price: 500,  zoom: 1, snd: 'pistol',  speedMul: 1 },
  glock:  { name: 'Glock-18',   cat: 'pistol', slot: 2, dmg: 26,  headMul: 4, interval: 0.15,  auto: false, mag: 20,  reserve: 80,  reload: 2.0, spread: 0.010,  recoil: 0.008, price: 400,  zoom: 1, snd: 'pistol',  speedMul: 1 },
  deagle: { name: '沙漠之鹰',   cat: 'pistol', slot: 2, dmg: 53,  headMul: 4, interval: 0.30,  auto: false, mag: 7,   reserve: 35,  reload: 2.2, spread: 0.012,  recoil: 0.028, price: 700,  zoom: 1, snd: 'deagle',  speedMul: 1 },
  mp5:    { name: 'MP5',        cat: 'smg',    slot: 1, dmg: 24,  headMul: 4, interval: 0.085, auto: true,  mag: 30,  reserve: 120, reload: 2.3, spread: 0.012,  recoil: 0.009, price: 1500, zoom: 1, snd: 'smg',     speedMul: 1.05 },
  p90:    { name: 'P90',        cat: 'smg',    slot: 1, dmg: 22,  headMul: 4, interval: 0.07,  auto: true,  mag: 50,  reserve: 100, reload: 2.8, spread: 0.014,  recoil: 0.008, price: 2350, zoom: 1, snd: 'smg',     speedMul: 1.05 },
  galil:  { name: 'Galil',      cat: 'rifle',  slot: 1, dmg: 29,  headMul: 4, interval: 0.10,  auto: true,  mag: 35,  reserve: 105, reload: 2.5, spread: 0.013,  recoil: 0.014, price: 2000, zoom: 1, snd: 'rifle',   speedMul: 1 },
  famas:  { name: 'FAMAS',      cat: 'rifle',  slot: 1, dmg: 30,  headMul: 4, interval: 0.095, auto: true,  mag: 25,  reserve: 90,  reload: 2.4, spread: 0.012,  recoil: 0.013, price: 2250, zoom: 1, snd: 'rifle',   speedMul: 1 },
  ak:     { name: 'AK-47',      cat: 'rifle',  slot: 1, dmg: 33,  headMul: 4, interval: 0.10,  auto: true,  mag: 30,  reserve: 90,  reload: 2.5, spread: 0.011,  recoil: 0.015, price: 2500, zoom: 1, snd: 'rifle',   speedMul: 1 },
  m4:     { name: 'M4A1',       cat: 'rifle',  slot: 1, dmg: 31,  headMul: 4, interval: 0.09,  auto: true,  mag: 30,  reserve: 90,  reload: 2.4, spread: 0.0095, recoil: 0.013, price: 3100, zoom: 1, snd: 'rifle',   speedMul: 1 },
  aug:    { name: 'AUG',        cat: 'rifle',  slot: 1, dmg: 32,  headMul: 4, interval: 0.09,  auto: true,  mag: 30,  reserve: 90,  reload: 2.6, spread: 0.010,  recoil: 0.013, price: 3300, zoom: 2, snd: 'rifle',   speedMul: 1 },
  sg552:  { name: 'SG552',      cat: 'rifle',  slot: 1, dmg: 33,  headMul: 4, interval: 0.09,  auto: true,  mag: 30,  reserve: 90,  reload: 2.6, spread: 0.010,  recoil: 0.014, price: 3300, zoom: 2, snd: 'rifle',   speedMul: 1 },
  scout:  { name: 'SSG-08',     cat: 'sniper', slot: 1, dmg: 78,  headMul: 3, interval: 1.1,   auto: false, mag: 10,  reserve: 30,  reload: 2.7, spread: 0.0015, recoil: 0.035, price: 2750, zoom: 2.5, snd: 'sniper', speedMul: 1.1, unscoped: 0.06 },
  awp:    { name: 'AWP',        cat: 'sniper', slot: 1, dmg: 115, headMul: 2, interval: 1.45,  auto: false, mag: 10,  reserve: 30,  reload: 3.1, spread: 0.0012, recoil: 0.05,  price: 4750, zoom: 4, snd: 'sniper',  speedMul: 0.85, unscoped: 0.10 },
  g3:     { name: 'G3SG1',      cat: 'sniper', slot: 1, dmg: 85,  headMul: 2.5, interval: 0.35, auto: true, mag: 20, reserve: 60,  reload: 3.0, spread: 0.0025, recoil: 0.04,  price: 5000, zoom: 3, snd: 'sniper',  speedMul: 0.9, unscoped: 0.09 },
  xm1014: { name: 'XM1014',     cat: 'heavy',  slot: 1, dmg: 16,  headMul: 3, interval: 0.35,  auto: true,  mag: 7,   reserve: 32,  reload: 3.4, spread: 0.045,  recoil: 0.02,  price: 3000, zoom: 1, snd: 'shotgun', speedMul: 0.95, pellets: 6 },
  m249:   { name: 'M249',       cat: 'heavy',  slot: 1, dmg: 27,  headMul: 3, interval: 0.075, auto: true,  mag: 100, reserve: 200, reload: 4.2, spread: 0.017,  recoil: 0.011, price: 5750, zoom: 1, snd: 'rifle',   speedMul: 0.88 },
  knife:  { name: '战术刀',     cat: 'melee',  slot: 3, melee: true, dmg: 55, headMul: 1, backstab: 195, range: 2.3, interval: 0.55, auto: false, mag: 0, reserve: 0, reload: 0, spread: 0, recoil: 0, price: 0, zoom: 1, snd: 'knife', speedMul: 1.08 }
};

var BOT_NAMES = ['Vladimir', 'Boris', 'Snake', 'Ghost', 'Reaper', 'Wolf', 'Havoc', 'Blade', 'Cobra'];
var CT_NAMES = ['Sarge', 'Doc', 'Recon', 'Eagle', 'Frost', 'Bull', 'Hawk', 'Ivy', 'Duke'];

function loadSettings() {
  try {
    var s = JSON.parse(localStorage.getItem('webstrike_set') || '{}');
    if (typeof s.map === 'number' && s.map >= 0 && s.map < MAPS.length) SET.map = s.map;
    if (MODES[s.mode]) SET.mode = s.mode;
    if (DIFFS[s.diff]) SET.diff = s.diff;
    if (s.bots >= 2 && s.bots <= 9) SET.bots = s.bots;
    if ([3, 5, 8, 16].indexOf(s.targetC) >= 0) SET.targetC = s.targetC;
    if ([15, 30, 50, 100].indexOf(s.targetD) >= 0) SET.targetD = s.targetD;
    if ([75, 90, 115, 150, 999].indexOf(s.roundTime) >= 0) SET.roundTime = s.roundTime;
    if ([800, 2000, 4000, 8000, 16000].indexOf(s.money) >= 0) SET.money = s.money;
    if (typeof s.sens === 'number' && s.sens > 0) SET.sens = s.sens;
    if (typeof s.vol === 'number' && s.vol >= 0 && s.vol <= 1) SET.vol = s.vol;
  } catch (e) {}
}

function saveSettings() {
  try { localStorage.setItem('webstrike_set', JSON.stringify(SET)); } catch (e) {}
}

// ---------------- 全局状态 ----------------
var G = {
  state: 'menu',   // menu | buytime | live | roundend | matchend
  mode: 'classic',
  ct: 0, t: 0,     // 经典模式回合比分
  ctK: 0, tK: 0,   // 团队死斗击杀数
  round: 0, target: 5,
  stateT: 0, roundT: 0,
  pendingEnd: null,
  viewDist: 55,
  paused: false,   // Esc/失焦暂停：冻结模拟
  frozen: false    // #shot 调试：冻结 AI
};

var P = {
  pos: null, vel: null,
  yaw: 0, pitch: 0,
  hp: 100, armor: 0, helmet: false, money: CFG.startMoney,
  grounded: true, crouch: false, dead: false,
  weapons: {}, cur: 'usp',
  bloom: 0, lastShot: 0, reloading: 0, switching: 0,
  scoped: false, stepT: 0, kills: 0,
  recP: 0, recY: 0, swing: 0,
  ggTier: 0, respawnT: 0
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
var ambLight, sunLight;
var SHOT_MATCH = /^#shot(\d)?$/.exec(location.hash);
var SHOT_DEBUG = !!SHOT_MATCH;
var SHOT_MAP = SHOT_MATCH && SHOT_MATCH[1] ? +SHOT_MATCH[1] : 0;

function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9db8cf);
  scene.fog = new THREE.Fog(0xa8b4ab, 40, 150);

  camera = new THREE.PerspectiveCamera(CFG.fov, innerWidth / innerHeight, 0.08, 300);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  document.body.appendChild(renderer.domElement);

  ambLight = new THREE.AmbientLight(0xfff2dd, 0.45);
  scene.add(ambLight);
  sunLight = new THREE.DirectionalLight(0xffe9c4, 1.05);
  sunLight.position.set(40, 70, 25);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -60; sunLight.shadow.camera.right = 60;
  sunLight.shadow.camera.top = 60; sunLight.shadow.camera.bottom = -60;
  sunLight.shadow.camera.far = 200;
  scene.add(sunLight);

  flashLight = new THREE.PointLight(0xffc866, 0, 9);
  scene.add(flashLight);

  addEventListener('resize', function () {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

// ---------------- 地图系统 ----------------
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
var botSpawns = [];     // T 方出生点
var ctSpawns = [];      // CT 方出生点（[0] 为玩家出生点）
var playerSpawn = new THREE.Vector3(0, 0, 42);

var C_SAND = 0xc7a86b, C_WALL = 0xb59a62, C_WALL2 = 0x9d8a5f,
    C_WOOD = 0x8a6d3f, C_WOOD2 = 0x74552c, C_METAL = 0x707070;

function groundPlane(size, col, patchDefs, patchCols) {
  var ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
    new THREE.MeshLambertMaterial({ color: col }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  if (!patchDefs) return;
  for (var pi = 0; pi < patchDefs.length; pi++) {
    var pd = patchDefs[pi];
    var patch = new THREE.Mesh(new THREE.PlaneGeometry(pd[2], pd[3]),
      new THREE.MeshLambertMaterial({ color: patchCols[pi % patchCols.length] }));
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(pd[0], 0.012 + pi * 0.001, pd[1]);
    patch.receiveShadow = true;
    scene.add(patch);
  }
}

function outerWalls(half, h, col) {
  solid(0, -half, half * 2, h, 1, col);
  solid(0, half, half * 2, h, 1, col);
  solid(-half, 0, 1, h, half * 2, col);
  solid(half, 0, 1, h, half * 2, col);
}

// 地图 1：沙城废墟（经典中路 / A / B 三线）
function buildDust() {
  groundPlane(104, C_SAND, [
    [-20, 20, 26, 18], [22, 12, 20, 24], [0, -30, 30, 16],
    [-30, -20, 18, 20], [12, 38, 24, 14], [-38, 40, 14, 12], [36, -40, 16, 12]
  ], [0xb0966a, 0xcbb27c, 0xa8905c]);

  outerWalls(51, 5, C_WALL);

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

  ctSpawns = [
    [0, 42], [-4, 42], [4, 42], [-10, 45], [10, 45], [-16, 40], [16, 40]
  ].map(function (a) { return new THREE.Vector3(a[0], 0, a[1]); });
}

// 地图 2：砖巷小镇（红砖窄巷，近距离遭遇战）
function buildBrick() {
  var C_BGROUND = 0x8f7a5c, C_BRICK = 0x9a5b43, C_BRICK2 = 0x7d4a38,
      C_WOODD = 0x5f462c, C_PLAST = 0x6a6a62;

  groundPlane(92, C_BGROUND, [
    [-18, 18, 20, 16], [16, -14, 18, 20], [0, -28, 22, 14], [-30, -8, 14, 16]
  ], [0x84714f, 0x9a8563, 0x7c6b4e]);

  outerWalls(46, 5.5, C_BRICK);

  // 中街：喷泉 + 低墙 + 短隔墙
  solid(0, 2, 3.2, 1.1, 3.2, C_BRICK2);
  solid(0, -12, 5, 1.2, 1.2, C_WOODD);
  solid(-2, 14, 1.2, 2.8, 10, C_BRICK2);
  solid(6, 10, 1.2, 2.8, 8, C_BRICK2);

  // 左巷 S 形隔墙（香蕉道）
  solid(-16, 16, 1.2, 3.2, 16, C_BRICK);
  solid(-26, 6, 12, 3.2, 1.2, C_BRICK);
  solid(-16, -6, 1.2, 3.2, 14, C_BRICK);
  solid(-26, -14, 12, 3.2, 1.2, C_BRICK);

  // 右侧公寓体块 + 巷道墙
  solid(18, 12, 12, 4, 10, C_BRICK2);
  solid(30, -4, 10, 3.4, 12, C_BRICK2);
  solid(18, -18, 1.2, 3.2, 14, C_BRICK);

  // 散落箱子
  solid(-8, -2, 1.2, 1.2, 1.2, C_WOODD);
  solid(8, -6, 1, 1, 1, C_WOODD);
  solid(-22, -28, 1.6, 1.1, 1.6, C_WOODD);
  solid(24, -32, 2, 1, 2, C_PLAST);
  solid(-34, 20, 1, 1, 1, C_WOODD);
  solid(34, 24, 1.2, 0.7, 1.2, C_PLAST);

  waypoints = [
    [0, 30], [0, 8], [0, -8], [0, -28],
    [-20, 22], [-24, 6], [-20, -10], [-26, -28],
    [20, 22], [26, 0], [20, -14], [24, -34],
    [-36, 0], [36, -6], [0, -40]
  ].map(function (a) { return new THREE.Vector3(a[0], 0, a[1]); });

  botSpawns = [[-4, -40], [4, -40], [-22, -42], [22, -42], [0, -36]]
    .map(function (a) { return new THREE.Vector3(a[0], 0, a[1]); });

  ctSpawns = [[0, 40], [-4, 40], [4, 40], [-10, 42], [10, 42], [-16, 38], [16, 38]]
    .map(function (a) { return new THREE.Vector3(a[0], 0, a[1]); });
}

// 地图 3：雪夜仓库（夜战室内，货架巷战）
function buildWh() {
  var C_FLOOR = 0x4a4f55, C_CRATE = 0x5a6168, C_CRATE2 = 0x6e7681,
      C_SHELF = 0x3c4046, C_RUST = 0x7a5a40;

  groundPlane(88, C_FLOOR, [
    [-16, 10, 24, 18], [14, -12, 20, 22], [0, 30, 26, 12]
  ], [0x43484e, 0x51565c, 0x3e4348]);

  outerWalls(44, 6, C_SHELF);

  // 三排货架（各留门洞）
  solid(-22, 13, 1.2, 3, 30, C_SHELF);
  solid(-22, -19, 1.2, 3, 22, C_SHELF);
  solid(0, -8, 1.2, 3, 26, C_SHELF);
  solid(0, 16, 1.2, 3, 16, C_SHELF);
  solid(22, 12, 1.2, 3, 26, C_SHELF);
  solid(22, -18, 1.2, 3, 24, C_SHELF);

  // 中央托盘堆（可跳上）
  solid(0, 2, 2.2, 1.1, 2.2, C_CRATE);
  solid(2.4, 2, 1.2, 0.6, 1.2, C_CRATE2);

  // 双层箱堆
  solid(-12, 24, 1.6, 1.6, 1.6, C_CRATE);
  solid(-12, 24, 1.4, 1.4, 1.4, C_CRATE2, 1.6);
  solid(12, -26, 1.6, 1.6, 1.6, C_CRATE);
  solid(12, -26, 1.4, 1.4, 1.4, C_RUST, 1.6);
  solid(-30, -30, 2, 1.1, 2, C_CRATE);
  solid(30, 28, 2, 1.1, 2, C_CRATE);
  solid(-8, -34, 1, 1, 1, C_CRATE2);
  solid(8, 34, 1, 1, 1, C_CRATE2);
  solid(30, -6, 1.2, 0.7, 1.2, C_CRATE2);

  waypoints = [
    [0, 34], [0, 6.5], [-22, -5], [22, -3.5],
    [-12, -26], [12, -26], [-34, 10], [34, 10],
    [-10, 20], [10, -10], [-30, -30], [30, 30], [0, -36]
  ].map(function (a) { return new THREE.Vector3(a[0], 0, a[1]); });

  botSpawns = [[-4, -38], [4, -38], [-24, -40], [24, -40], [0, -34]]
    .map(function (a) { return new THREE.Vector3(a[0], 0, a[1]); });

  ctSpawns = [[0, 38], [-4, 38], [4, 38], [-10, 40], [10, 40], [-18, 36], [18, 36]]
    .map(function (a) { return new THREE.Vector3(a[0], 0, a[1]); });
}

// 地图 4：远射靶场（开阔三车道 + 侧翼高台，狙击乐土）
function buildAim() {
  var C_AIM = 0x97a08c, C_WALLA = 0x8d947f, C_CONC = 0x9aa0a8;

  groundPlane(124, C_AIM, [
    [-30, 20, 30, 22], [28, -18, 26, 24], [0, -36, 34, 16], [-40, -24, 18, 18]
  ], [0x8d967e, 0xa2ab95, 0x87906f]);

  outerWalls(62, 4.5, C_WALLA);

  // 两条纵向长墙形成三车道（中央留门洞）
  solid(-20, -22, 1.2, 3.4, 40, C_WALLA);
  solid(-20, 22, 1.2, 3.4, 40, C_WALLA);
  solid(20, -22, 1.2, 3.4, 40, C_WALLA);
  solid(20, 22, 1.2, 3.4, 40, C_WALLA);

  // 中路低矮掩体（蹲射位）
  solid(0, 16, 6, 1.1, 1.2, C_CONC);
  solid(0, -16, 6, 1.1, 1.2, C_CONC);
  solid(-8, 0, 1.2, 1.1, 6, C_CONC);
  solid(8, 0, 1.2, 1.1, 6, C_CONC);

  // 两侧高台（跳跃可上，狙击位）
  solid(-46, 0, 12, 1.2, 12, C_CONC);
  solid(46, 0, 12, 1.2, 12, C_CONC);
  solid(-46, -4, 1.4, 1.1, 1.4, C_WALLA, 1.2);
  solid(46, 4, 1.4, 1.1, 1.4, C_WALLA, 1.2);

  // 散箱
  solid(-34, -34, 1.6, 1.1, 1.6, C_WALLA);
  solid(34, 34, 1.6, 1.1, 1.6, C_WALLA);
  solid(0, 40, 2.4, 1.2, 2.4, C_WALLA);
  solid(0, -40, 2.4, 1.2, 2.4, C_WALLA);

  waypoints = [
    [0, 30], [0, 10], [0, -10], [0, -30],
    [-32, 20], [-32, -20], [-52, 10], [-52, -10],
    [32, 20], [32, -20], [52, 10], [52, -10],
    [-10, 34], [10, -34]
  ].map(function (a) { return new THREE.Vector3(a[0], 0, a[1]); });

  botSpawns = [[-6, -56], [6, -56], [-30, -58], [30, -58], [0, -52]]
    .map(function (a) { return new THREE.Vector3(a[0], 0, a[1]); });

  ctSpawns = [[0, 56], [-6, 56], [6, 56], [-16, 58], [16, 58], [-30, 52], [30, 52]]
    .map(function (a) { return new THREE.Vector3(a[0], 0, a[1]); });
}

var MAPS = [
  { name: '沙城废墟', sky: 0x9db8cf, fogCol: 0xa8b4ab, fogNear: 40, fogFar: 150, ambCol: 0xfff2dd, ambI: 0.45, sunCol: 0xffe9c4, sunI: 1.05, viewDist: 55, build: buildDust },
  { name: '砖巷小镇', sky: 0xb59a8a, fogCol: 0x9a8578, fogNear: 26, fogFar: 95,  ambCol: 0xffe0c0, ambI: 0.42, sunCol: 0xffd2a0, sunI: 0.95, viewDist: 48, build: buildBrick },
  { name: '雪夜仓库', sky: 0x0d1218, fogCol: 0x0c1014, fogNear: 20, fogFar: 85,  ambCol: 0x99a8c8, ambI: 0.42, sunCol: 0x8fa8d0, sunI: 0.7, viewDist: 46, build: buildWh },
  { name: '远射靶场', sky: 0xcfd8e2, fogCol: 0xc4ccd4, fogNear: 50, fogFar: 170, ambCol: 0xffffff, ambI: 0.55, sunCol: 0xfff6e0, sunI: 1.1,  viewDist: 80, build: buildAim }
];

// 递归释放一个对象子树的 GPU 资源（three.js 的 remove 不会自动释放显存）
function disposeDeep(o) {
  for (var i = 0; i < o.children.length; i++) disposeDeep(o.children[i]);
  if (o.geometry && o.geometry.dispose) o.geometry.dispose();
  var m = o.material;
  if (!m) return;
  if (m.length !== undefined) { for (var k = 0; k < m.length; k++) m[k].dispose(); }
  else m.dispose();
}

// 重建整张地图：清空上一张的静态物体（保留相机与灯光）
function clearWorld() {
  clearFx(); // 粒子/曳光先出场景（其几何体与材质为全局共享，只清引用不 dispose）
  for (var i = scene.children.length - 1; i >= 0; i--) {
    var o = scene.children[i];
    if (o === camera || o === ambLight || o === sunLight || o === flashLight) continue;
    scene.remove(o);
    disposeDeep(o);
  }
  solids = [];
}

function buildMapWorld(idx) {
  clearWorld();
  var m = MAPS[idx] || MAPS[0];
  scene.background = new THREE.Color(m.sky);
  scene.fog = new THREE.Fog(m.fogCol, m.fogNear, m.fogFar);
  ambLight.color.setHex(m.ambCol);
  ambLight.intensity = m.ambI;
  sunLight.color.setHex(m.sunCol);
  sunLight.intensity = m.sunI;
  waypoints = []; botSpawns = []; ctSpawns = [];
  m.build();
  G.viewDist = m.viewDist;
  playerSpawn = ctSpawns[0].clone();
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
    master.gain.value = SET.vol;
    master.connect(AC.destination);
    var len = AC.sampleRate;
    noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}

function applyVolume() { if (master) master.gain.value = SET.vol; }

var GUN_SND = {
  pistol:  { dur: 0.18, v: 0.55, f0: 2400, o: 200 },
  deagle:  { dur: 0.30, v: 0.95, f0: 1300, o: 140 },
  smg:     { dur: 0.13, v: 0.50, f0: 2800, o: 230 },
  rifle:   { dur: 0.22, v: 0.75, f0: 1600, o: 130 },
  shotgun: { dur: 0.42, v: 1.00, f0: 900,  o: 90 },
  sniper:  { dur: 0.55, v: 1.00, f0: 800,  o: 100 }
};

function playGun(kind, vol) {
  if (!AC) return;
  var k = GUN_SND[kind] || GUN_SND.rifle;
  var t = AC.currentTime;
  var V = vol * k.v;
  var src = AC.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.7 + Math.random() * 0.3;
  var f = AC.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(k.f0, t);
  f.frequency.exponentialRampToValueAtTime(200, t + k.dur);
  var g = AC.createGain();
  g.gain.setValueAtTime(V, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + k.dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, Math.random() * 0.3); src.stop(t + k.dur + 0.05);
  // 低频 punch
  var o = AC.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(k.o, t);
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

function clearFx() {
  for (var i = parts.length - 1; i >= 0; i--) scene.remove(parts[i].m);
  parts = [];
  for (var j = tracers.length - 1; j >= 0; j--) {
    scene.remove(tracers[j].line);
    tracers[j].line.geometry.dispose();
  }
  tracers = [];
}

function muzzleFlash(worldPos) {
  flashLight.position.copy(worldPos);
  flashLight.intensity = 2.4; // 主循环内按帧衰减，避免 setTimeout 与暂停/多枪互相干扰
}

// ---------------- 视角模型（枪） ----------------
function buildViewModel(key) {
  if (vmGun) { vmRoot.remove(vmGun); disposeDeep(vmGun); }
  vmGun = new THREE.Group();
  var dark = new THREE.MeshLambertMaterial({ color: 0x2b2b2b });
  var wood = new THREE.MeshLambertMaterial({ color: 0x6b4a26 });
  var green = new THREE.MeshLambertMaterial({ color: 0x3d5233 });
  var steel = new THREE.MeshLambertMaterial({ color: 0x9aa0a8 });
  var black = new THREE.MeshLambertMaterial({ color: 0x1d1d1f });
  var plastic = new THREE.MeshLambertMaterial({ color: 0x33363a });

  function part(w, h, d, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    vmGun.add(m);
    return m;
  }

  function setMuzzle(x, y, z) {
    muzzle = new THREE.Object3D();
    muzzle.position.set(x, y, z);
  }

  if (key === 'usp') {
    part(0.07, 0.09, 0.24, dark, 0, 0, -0.05);
    part(0.05, 0.05, 0.10, dark, 0, 0.015, -0.20);
    part(0.06, 0.12, 0.07, dark, 0, -0.09, 0.05);
    setMuzzle(0, 0.01, -0.28);
  } else if (key === 'glock') {
    part(0.07, 0.08, 0.22, black, 0, 0.01, -0.04);
    part(0.055, 0.05, 0.09, black, 0, 0.02, -0.18);
    part(0.06, 0.11, 0.07, plastic, 0, -0.08, 0.05);
    setMuzzle(0, 0.01, -0.26);
  } else if (key === 'deagle') {
    part(0.075, 0.10, 0.26, steel, 0, 0.01, -0.05);
    part(0.06, 0.06, 0.11, steel, 0, 0.02, -0.21);
    part(0.065, 0.12, 0.075, black, 0, -0.09, 0.06);
    setMuzzle(0, 0.02, -0.30);
  } else if (key === 'mp5') {
    part(0.07, 0.11, 0.42, black, 0, 0, -0.12);
    part(0.045, 0.045, 0.18, black, 0, 0.01, -0.40);
    part(0.05, 0.18, 0.07, black, 0, -0.13, -0.02);
    part(0.06, 0.09, 0.14, black, 0, -0.02, 0.14);
    setMuzzle(0, 0.01, -0.52);
  } else if (key === 'p90') {
    part(0.10, 0.10, 0.50, plastic, 0, 0, -0.10);
    part(0.08, 0.03, 0.30, dark, 0, 0.065, -0.05);
    part(0.04, 0.04, 0.14, black, 0, 0.01, -0.42);
    setMuzzle(0, 0.01, -0.52);
  } else if (key === 'galil') {
    part(0.08, 0.12, 0.52, dark, 0, 0, -0.14);
    part(0.05, 0.06, 0.22, wood, 0, 0.02, -0.48);
    part(0.06, 0.15, 0.08, dark, 0, -0.12, -0.06);
    part(0.06, 0.10, 0.14, dark, 0, -0.03, 0.18);
    setMuzzle(0, 0.02, -0.62);
  } else if (key === 'famas') {
    part(0.09, 0.13, 0.55, plastic, 0, 0, -0.10);
    part(0.03, 0.06, 0.20, plastic, 0, 0.10, -0.20);
    part(0.04, 0.04, 0.18, black, 0, 0.01, -0.45);
    setMuzzle(0, 0.01, -0.58);
  } else if (key === 'aug') {
    part(0.09, 0.13, 0.50, green, 0, 0, -0.10);
    part(0.05, 0.05, 0.16, dark, 0, 0.10, -0.15);
    part(0.04, 0.04, 0.16, black, 0, 0.01, -0.42);
    part(0.05, 0.10, 0.08, green, 0, -0.12, -0.02);
    setMuzzle(0, 0.01, -0.55);
  } else if (key === 'sg552') {
    part(0.08, 0.12, 0.48, dark, 0, 0, -0.10);
    part(0.05, 0.05, 0.14, black, 0, 0.10, -0.12);
    part(0.05, 0.14, 0.07, black, 0, -0.12, -0.04);
    setMuzzle(0, 0.01, -0.52);
  } else if (key === 'scout') {
    part(0.06, 0.09, 0.70, green, 0, 0, -0.22);
    part(0.045, 0.045, 0.22, black, 0, 0.085, -0.12);
    part(0.05, 0.09, 0.14, green, 0, -0.02, 0.20);
    setMuzzle(0, 0, -0.68);
  } else if (key === 'awp') {
    part(0.07, 0.11, 0.80, green, 0, 0, -0.25);
    part(0.05, 0.05, 0.30, dark, 0, 0.09, -0.15);
    part(0.06, 0.10, 0.16, green, 0, -0.08, 0.12);
    part(0.05, 0.09, 0.12, dark, 0, -0.02, 0.22);
    setMuzzle(0, 0, -0.70);
  } else if (key === 'g3') {
    part(0.075, 0.11, 0.72, dark, 0, 0, -0.24);
    part(0.05, 0.05, 0.26, black, 0, 0.09, -0.18);
    part(0.055, 0.10, 0.16, dark, 0, -0.08, 0.14);
    part(0.05, 0.09, 0.14, wood, 0, -0.02, 0.26);
    setMuzzle(0, 0, -0.72);
  } else if (key === 'xm1014') {
    part(0.06, 0.08, 0.62, black, 0, 0.02, -0.18);
    part(0.05, 0.05, 0.30, dark, 0, -0.045, -0.30);
    part(0.07, 0.10, 0.18, plastic, 0, -0.02, 0.16);
    setMuzzle(0, 0.03, -0.55);
  } else if (key === 'm249') {
    part(0.09, 0.13, 0.58, dark, 0, 0, -0.16);
    part(0.05, 0.05, 0.30, black, 0, 0.02, -0.55);
    part(0.14, 0.12, 0.18, dark, 0, -0.13, -0.02);
    setMuzzle(0, 0.02, -0.72);
  } else if (key === 'knife') {
    var blade = new THREE.MeshLambertMaterial({ color: 0xb8bcc4 });
    part(0.045, 0.07, 0.14, dark, 0, -0.05, 0.08);
    part(0.02, 0.055, 0.34, blade, 0, 0.02, -0.12);
    part(0.05, 0.02, 0.08, dark, 0, 0.055, 0.01);
    setMuzzle(0, 0.02, -0.32);
  } else { // ak / m4
    var bodyMat = key === 'ak' ? wood : dark;
    part(0.08, 0.12, 0.55, bodyMat, 0, 0, -0.15);
    part(0.05, 0.06, 0.25, dark, 0, 0.02, -0.50);
    part(0.06, 0.16, 0.08, dark, 0, -0.12, -0.08);
    part(0.06, 0.10, 0.14, bodyMat, 0, -0.03, 0.18);
    setMuzzle(0, 0.02, -0.65);
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

// bot 配枪：按难度与阵营分层，难度越高枪越好（狙击每种最多一把）
function pickBotGun(team, i) {
  if (G.mode === 'gg') return GG_LADDER[0];
  var d = SET.diff, pool;
  if (d === 'easy') {
    pool = team === 't' ? ['usp', 'deagle', 'mp5', 'galil'] : ['usp', 'deagle', 'mp5', 'famas'];
  } else if (d === 'normal') {
    pool = team === 't' ? ['deagle', 'mp5', 'galil', 'ak'] : ['deagle', 'mp5', 'famas', 'm4'];
  } else if (d === 'hard') {
    pool = team === 't' ? ['galil', 'ak', 'sg552', 'ak', 'awp'] : ['famas', 'm4', 'aug', 'm4', 'g3'];
  } else {
    pool = team === 't' ? ['ak', 'sg552', 'galil', 'ak', 'awp', 'ak'] : ['m4', 'aug', 'sg552', 'm4', 'g3', 'm4'];
  }
  return pool[i % pool.length];
}

function addBot(team, spawn, name, idx) {
  var mesh = buildBotMesh(team);
  mesh.position.copy(spawn);
  scene.add(mesh);
  bots.push({
    name: name, team: team, hp: 100, alive: true,
    pos: mesh.position, yaw: team === 'ct' ? 0 : Math.PI,
    speed: 3.3 + Math.random() * 0.5,
    gun: pickBotGun(team, idx || 0),
    tier: 0,
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
  var n = CFG.botCount;
  var nt = BOT_NAMES.slice();
  for (var i = 0; i < n; i++) {
    var ni = Math.floor(Math.random() * nt.length);
    addBot('t', botSpawns[i % botSpawns.length], nt.splice(ni, 1)[0] || ('T-' + i), i);
  }
  // n-1 名 CT 队友（玩家补足第 n 人），跳过 ctSpawns[0]（玩家出生点）
  var nc = CT_NAMES.slice();
  for (var j = 1; j <= n - 1; j++) {
    var nj = Math.floor(Math.random() * nc.length);
    addBot('ct', ctSpawns[j % ctSpawns.length], nc.splice(nj, 1)[0] || ('CT-' + j), j);
  }
}

function clearBots() {
  for (var i = 0; i < bots.length; i++) {
    scene.remove(bots[i].mesh);
    disposeDeep(bots[i].mesh);
  }
  bots = [];
}

function botEye(b) { return b.pos.y + 1.55; }

// 选最近的可见敌人（玩家或敌方 bot）
function pickTarget(b) {
  var best = null, bestD = G.viewDist;
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
    if (b.dieT > 3) {
      if (G.mode === 'classic') { scene.remove(m); disposeDeep(m); b.gone = true; }
      else respawnBot(b);
    }
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
        var D0 = DIFFS[SET.diff];
        b.reactT = now + D0.reactA + Math.random() * (D0.reactB - D0.reactA);
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
  var D = DIFFS[SET.diff];

  var moveX = 0, moveZ = 0, wantSpeed = 0;

  if (b.state === 'combat' && b.lastSeen) {
    var tp = tgt ? (tgt.player ? P.pos : tgt.ref.pos) : b.lastSeen;
    var dx = tp.x - b.pos.x, dz = tp.z - b.pos.z;
    var dist = Math.sqrt(dx * dx + dz * dz) || 1;
    var ndx = dx / dist, ndz = dz / dist;

    // 面向目标（转身速度随难度提升）
    var targetYaw = Math.atan2(-dx, -dz);
    var dy = targetYaw - b.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    b.yaw += dy * Math.min(1, dt * D.turn);

    if (b.gun === 'knife') {
      // 军备竞赛最终级：持刀全速冲锋近战
      moveX = ndx; moveZ = ndz;
      wantSpeed = b.speed;
      if (tgt && dist < 2.3 && now > b.reactT && now - b.lastShot > 0.9) {
        b.lastShot = now;
        if (dist < 12) swingSound();
        if (Math.random() < 0.75) {
          if (tgt.player) {
            stabSound();
            damagePlayer(60, b.name, 't', '战术刀', b);
          } else {
            spawnBlood(new THREE.Vector3(tgt.ref.pos.x, tgt.ref.pos.y + 1.1, tgt.ref.pos.z));
            damageBot(tgt.ref, 100, b.name, b.team, '战术刀', b);
          }
        }
      }
    } else {
      var wd = WEAPONS[b.gun];
      // 距离管理 + 横移（狙击手保持距离，只横移）
      b.strafeT -= dt;
      if (b.strafeT <= 0) {
        b.strafe = Math.random() < 0.5 ? -1 : 1;
        b.strafeT = 0.8 + Math.random() * 1.2;
      }
      var fwd = 0;
      if (tgt) {
        if (wd.cat === 'sniper') { if (dist > 26) fwd = 1; }
        else if (dist > 14) fwd = 1;
        else if (dist < 5) fwd = -0.7;
      }
      var rx = -ndz * b.strafe, rz = ndx * b.strafe;
      moveX = ndx * fwd + rx * 0.8;
      moveZ = ndz * fwd + rz * 0.8;
      wantSpeed = b.speed * 0.8;

      // 开火（开火间隔随武器与难度变化）
      if (tgt && now > b.reactT && now - b.lastShot > b.nextGap) {
        b.lastShot = now;
        b.nextGap = Math.max(0.12, wd.interval * D.gapMul) + Math.random() * 0.18;
        botShoot(b, tgt, dist, now);
      }
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

function botShoot(b, tgt, dist, now) {
  var wd = WEAPONS[b.gun];
  var ox = b.pos.x - Math.sin(b.yaw) * 0.4, oy = b.pos.y + 1.1, oz = b.pos.z - Math.cos(b.yaw) * 0.4;
  // 音量按与玩家的距离衰减
  var pdx = P.pos.x - ox, pdz = P.pos.z - oz;
  var pd = Math.sqrt(pdx * pdx + pdz * pdz);
  playGun(wd.snd, Math.max(0.06, 1 - pd / 55) * 0.7);
  muzzleFlash(new THREE.Vector3(ox, oy, oz));
  // 广播枪声（吸引敌方 bot）
  G.heardPos = { pos: b.pos.clone(), t: now, byTeam: b.team };

  var isP = tgt.player;
  var tx, ty, tz;
  if (isP) { tx = P.pos.x; ty = P.pos.y + eyeHeight() - 0.25; tz = P.pos.z; }
  else { tx = tgt.ref.pos.x; ty = tgt.ref.pos.y + 1.0; tz = tgt.ref.pos.z; }

  var D = DIFFS[SET.diff];
  var moving = isP ? (P.moveSpeed > 1.5) : true;
  var acc = D.hitBase * (1 - dist / D.hitFall);
  if (acc < 0.04) acc = 0.04;
  if (moving) acc *= D.moveAcc;
  if (isP && P.crouch) acc *= 0.9;
  if (wd.cat === 'sniper') acc *= dist > 22 ? 1.5 : 0.6;   // 狙击 bot 远距离更准
  if (wd.pellets) acc *= dist < 9 ? 1.7 : 0.35;            // 霰弹 bot 只在近距离有威胁

  var hit = Math.random() < acc && (!isP || !P.dead);
  if (!hit) {
    tx += (Math.random() - 0.5) * 2.4;
    ty += (Math.random() - 0.5) * 1.6;
    tz += (Math.random() - 0.5) * 2.4;
  }
  spawnTracer(new THREE.Vector3(ox, oy, oz), new THREE.Vector3(tx, ty, tz),
    b.team === 't' ? 0xffb0a0 : 0xa0c8ff);

  if (hit) {
    var dmg = wd.dmg * D.dmgMul * (0.85 + Math.random() * 0.3);
    if (Math.random() < D.hs) {
      dmg *= 2.2; // 爆头
      if (isP && P.helmet) dmg *= 0.6; // 头盔减免爆头伤害
    }
    if (isP) damagePlayer(dmg, b.name, b.team, wd.name, b);
    else damageBot(tgt.ref, dmg, b.name, b.team, wd.name, b);
  }
}

function damageBot(v, dmg, srcName, srcTeam, wpn, srcBot) {
  if (!v.alive) return;
  v.hp -= dmg;
  spawnBlood(new THREE.Vector3(v.pos.x, v.pos.y + 1.1, v.pos.z));
  if (v.hp <= 0) killBot(v, { player: false, name: srcName, team: srcTeam, bot: srcBot || null }, wpn);
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
  P.respawnT = 0;
  vmRoot.visible = true;
  refillAmmo();
  updateScopeUI();
}

function refillAmmo() {
  for (var k in P.weapons) {
    P.weapons[k].ammo = WEAPONS[k].mag;
    P.weapons[k].reserve = WEAPONS[k].reserve;
  }
}

function eyeHeight() { return P.crouch ? 1.05 : 1.62; }
function playerHeight() { return P.crouch ? 1.15 : 1.75; }

// 重生点：选离所有存活敌人最远的点
function bestSpawnPoint(list, team) {
  var best = list[0], bestScore = -1;
  for (var i = 0; i < list.length; i++) {
    var sp = list[i];
    var minD = 1e9;
    for (var j = 0; j < bots.length; j++) {
      var o = bots[j];
      if (!o.alive || o.team === team) continue;
      var dx = o.pos.x - sp.x, dz = o.pos.z - sp.z;
      var d = dx * dx + dz * dz;
      if (d < minD) minD = d;
    }
    if (team === 't' && !P.dead) {
      var px = P.pos.x - sp.x, pz = P.pos.z - sp.z;
      var pd = px * px + pz * pz;
      if (pd < minD) minD = pd;
    }
    if (minD > bestScore) { bestScore = minD; best = sp; }
  }
  return best;
}

function respawnBot(b) {
  var list = b.team === 't' ? botSpawns : ctSpawns;
  b.pos.copy(bestSpawnPoint(list, b.team));
  b.hp = 100; b.alive = true;
  b.state = 'patrol';
  b.wp = waypoints[Math.floor(Math.random() * waypoints.length)];
  b.dieT = 0; b.tgt = null; b.lastSeen = null; b.loseT = 0;
  b.reactT = 0; b.stuckT = 0; b.evadeT = 0;
  b.perceptT = clock.elapsedTime + Math.random() * PERCEPT;
  b.yaw = b.team === 'ct' ? 0 : Math.PI;
  b.mesh.rotation.x = 0;
  b.mesh.position.y = 0;
  if (G.mode === 'gg') b.gun = GG_LADDER[Math.min(b.tier, GG_LADDER.length - 1)];
}

function respawnPlayer() {
  var sp = bestSpawnPoint(ctSpawns, 'ct');
  P.pos.copy(sp);
  P.pos.y = 0;
  P.vel.set(0, 0, 0);
  P.yaw = Math.atan2(sp.x, sp.z); // 面向场地中心
  P.pitch = 0;
  P.hp = 100; P.dead = false; P.respawnT = 0;
  P.bloom = 0; P.recP = 0; P.recY = 0;
  P.reloading = 0; P.switching = 0;
  refillAmmo();
  vmRoot.visible = true;
  el.hint.style.opacity = 0;
  hintText = '';
  updateScopeUI();
  banner('重新部署', '', 1000);
}

function updatePlayer(dt) {
  if (P.dead) return;
  var speedBase = P.crouch ? 1.6 : 4.4;
  if (P.scoped) speedBase *= 0.55;
  if (keys['ShiftLeft'] || keys['ShiftRight']) speedBase = 2.2; // 静步
  speedBase *= (curDef().speedMul || 1);                        // 重武器移速惩罚

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

function damagePlayer(dmg, src, srcTeam, wpn, srcBot) {
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
    if (G.mode === 'gg' && srcBot) ggBotAdvance(srcBot);
    if (G.mode === 'tdm') G.tK++;
    if (G.mode === 'classic') {
      banner('你已阵亡', '观战队友视角 · 回合继续', 3000);
    } else {
      P.respawnT = 3;
      banner('阵亡', '3 秒后重新部署', 1800);
    }
    setScope(false);
    el.crosshair.style.display = 'none';
    vmRoot.visible = false;
    checkEnd();
  }
}

// ---------------- 射击 ----------------
function curWpn() { return P.weapons[P.cur]; }
function curDef() { return WEAPONS[P.cur]; }

function spreadEff() {
  var d = curDef();
  var s = (d.unscoped && !P.scoped) ? d.unscoped : d.spread;
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

  var o = camera.position;
  var mw = new THREE.Vector3();
  muzzle.getWorldPosition(mw);

  // 射线（霰弹枪多弹丸，聚合结算；只命中敌方 T，友军不挡子弹）
  var pellets = d.pellets || 1;
  var baseDir = new THREE.Vector3();
  camera.getWorldDirection(baseDir);
  var right = new THREE.Vector3().crossVectors(baseDir, new THREE.Vector3(0, 1, 0)).normalize();
  var up = new THREE.Vector3().crossVectors(right, baseDir).normalize();
  var sEff = spreadEff();

  var hitBots = [], tracerN = 0;
  for (var pi = 0; pi < pellets; pi++) {
    var dir = baseDir.clone();
    var spr = sEff * (pellets > 1 ? 1.6 : 1);
    var ang = Math.random() * Math.PI * 2;
    var rad = Math.sqrt(Math.random()) * spr;
    dir.addScaledVector(right, Math.cos(ang) * rad).addScaledVector(up, Math.sin(ang) * rad).normalize();

    var tWall = rayWalls(o.x, o.y, o.z, dir.x, dir.y, dir.z, 120);
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
    if (tracerN < 3) { spawnTracer(mw, hitPoint, 0xffe0a0); tracerN++; }
    if (bestBot) {
      // 同一 bot 的多颗弹丸伤害聚合
      var agg = null;
      for (var h = 0; h < hitBots.length; h++) if (hitBots[h].bot === bestBot) { agg = hitBots[h]; break; }
      if (!agg) { agg = { bot: bestBot, dmg: 0, head: false }; hitBots.push(agg); }
      agg.dmg += d.dmg * (bestHead ? d.headMul : 1);
      if (bestHead) agg.head = true;
    } else if (bestT < 120 && (pellets === 1 || pi === 0)) {
      spawnSpark(hitPoint);
    }
  }

  // 枪口特效 + 声音
  muzzleFlash(mw);
  playGun(d.snd, 1);

  // 广播枪声位置 → 敌方 bot 听到
  G.heardPos = { pos: P.pos.clone(), t: now, byTeam: 'ct' };

  // 结算
  for (var hi = 0; hi < hitBots.length; hi++) {
    var hb = hitBots[hi];
    spawnBlood(new THREE.Vector3(hb.bot.pos.x, hb.bot.pos.y + 1.1, hb.bot.pos.z));
    hb.bot.hp -= hb.dmg;
    hitMark(hb.head);
    if (hb.head) blip(1500, 0.07, 0.25);
    else blip(1050, 0.05, 0.18);
    if (hb.bot.hp <= 0 && hb.bot.alive) {
      killBot(hb.bot, { player: true, name: '你', team: 'ct' }, d.name, hb.head);
    }
  }

  // AWP 开枪后自动退镜
  if (P.cur === 'awp' && P.scoped) setScope(false);
}

function addMoney(n) { P.money = Math.min(CFG.maxMoney, P.money + n); }

// 击杀 bot 结算（玩家或 bot 为击杀者）
function killBot(v, killer, wpnName, special) {
  v.alive = false;
  v.dieT = 0;
  killFeed(killer.name, killer.team, v.name, 't', wpnName || 'AK-47', special);
  if (killer.player) {
    addMoney(300);
    P.kills++;
    if (G.mode === 'tdm') G.ctK++;
    if (G.mode === 'gg') ggPlayerAdvance();
    blip(600, 0.12, 0.2, 'sine');
  } else if (killer.bot) {
    if (G.mode === 'tdm') { if (killer.team === 'ct') G.ctK++; else G.tK++; }
    if (G.mode === 'gg') ggBotAdvance(killer.bot);
  }
  checkEnd();
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
    if (bestBot.hp <= 0 && bestBot.alive) {
      killBot(bestBot, { player: true, name: '你', team: 'ct' }, d.name, behind ? '背刺' : false);
    }
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

function slotKey(s) {
  for (var k in P.weapons) if (WEAPONS[k].slot === s) return k;
  return null;
}

function switchTo(key) {
  if (!key || !P.weapons[key] || P.cur === key || G.state === 'menu') return;
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
function applySettings() {
  CFG.roundTime = SET.roundTime;
  CFG.botCount = SET.bots;
  CFG.startMoney = SET.money;
  CFG.winRounds = SET.targetC;
  G.target = G.mode === 'tdm' ? SET.targetD : SET.targetC;
}

function startMatch() {
  G.mode = SET.mode;
  applySettings();
  G.ct = 0; G.t = 0; G.ctK = 0; G.tK = 0; G.round = 0;
  G.pendingEnd = null;
  P.money = G.mode === 'gg' ? 0 : CFG.startMoney;
  P.kills = 0; P.armor = 0; P.helmet = false; P.ggTier = 0; P.respawnT = 0;
  P.weapons = G.mode === 'gg'
    ? { glock: mkWpn('glock'), knife: mkWpn('knife') }
    : { usp: mkWpn('usp'), knife: mkWpn('knife') };
  P.cur = G.mode === 'gg' ? 'glock' : 'usp';
  buildMapWorld(SET.map);
  buildViewModel(P.cur);
  el.killfeed.innerHTML = '';
  hudPrev = {};
  if (G.mode === 'classic') startRound();
  else startSkirmish();
}

function startRound() {
  G.round++;
  clearBots();
  clearFx();
  resetPlayerForRound();
  spawnTeams();
  G.state = 'buytime';
  G.stateT = CFG.buyTime;
  G.roundT = CFG.roundTime;
  banner('第 ' + G.round + ' 回合', '按 B 打开购买菜单 · 准备接敌', 2400);
  setHint('按 B 打开购买菜单');
  el.buymenu.style.display = 'none';
  buyOpen = false;
  buyCat = null;
}

// 死斗 / 军备竞赛开局
function startSkirmish() {
  clearBots();
  clearFx();
  resetPlayerForRound();
  spawnTeams();
  G.state = 'live';
  G.roundT = G.mode === 'tdm' ? 360 : Infinity;
  if (G.mode === 'tdm') {
    banner('团队死斗', '先取 ' + G.target + ' 杀 · 按 B 随时购买', 2600);
    setHint('按 B 打开购买菜单（随时可买）');
  } else {
    banner('军备竞赛', '当前武器：' + WEAPONS[GG_LADDER[0]].name + ' · 击杀升级', 2600);
    setHint('');
  }
  el.buymenu.style.display = 'none';
  buyOpen = false;
  buyCat = null;
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
  if (G.ct >= CFG.winRounds || G.t >= CFG.winRounds) G.pendingEnd = G.ct >= CFG.winRounds ? 'ct' : 't';
}

function matchEnd(win, reason) {
  G.state = 'matchend';
  var score;
  if (G.mode === 'classic') score = '最终比分 CT ' + G.ct + ' : ' + G.t + ' T';
  else if (G.mode === 'tdm') score = '最终比分 CT ' + G.ctK + ' : ' + G.tK + ' T';
  else score = '共击杀 ' + P.kills + ' 名敌人';
  banner(win ? '比赛胜利！' : '比赛结束', (reason ? reason + ' · ' : '') + score + ' · 点击屏幕重新开始', 999999);
  blip(win ? 700 : 220, 0.4, 0.22, win ? 'sine' : 'sawtooth');
  document.exitPointerLock && document.exitPointerLock();
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

function checkEnd() {
  if (G.state !== 'live') return;
  if (G.mode === 'classic') { checkRoundWin(); return; }
  if (G.mode === 'tdm') {
    if (G.ctK >= G.target) matchEnd(true, '达到击杀目标');
    else if (G.tK >= G.target) matchEnd(false, '敌方达到击杀目标');
  }
}

// 军备竞赛：玩家升级
function ggPlayerAdvance() {
  P.ggTier++;
  if (P.ggTier >= GG_LADDER.length) { matchEnd(true, '完成军备竞赛'); return; }
  var g = GG_LADDER[P.ggTier];
  P.weapons = {};
  P.weapons[g] = mkWpn(g);
  P.weapons.knife = mkWpn('knife');
  P.cur = g;
  buildViewModel(g);
  setScope(false);
  blip(900, 0.15, 0.2, 'sine');
  banner('军备升级', WEAPONS[g].name + ' · 第 ' + (P.ggTier + 1) + ' / ' + GG_LADDER.length + ' 级', 1500);
}

function ggBotAdvance(b) {
  b.tier++;
  if (b.tier >= GG_LADDER.length) { matchEnd(false, '敌方完成军备竞赛'); return; }
  b.gun = GG_LADDER[b.tier];
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
    if (G.mode === 'classic') {
      G.roundT -= dt;
      if (G.roundT <= 0) {
        var a = countAlive();
        endRound(a.c >= a.t ? 'ct' : 't', '时间耗尽');
      }
    } else if (G.mode === 'tdm') {
      G.roundT -= dt;
      if (G.roundT <= 0) matchEnd(G.ctK >= G.tK, '时间到');
    }
    // 军备竞赛无时限
  } else if (G.state === 'roundend') {
    G.stateT -= dt;
    if (G.stateT <= 0 && G.state !== 'matchend') {
      if (G.pendingEnd) {
        var win = G.pendingEnd === 'ct';
        G.pendingEnd = null;
        matchEnd(win);
      } else {
        startRound();
      }
    }
  }
}

// ---------------- 购买 ----------------
var BUY_CATS = [
  // 分类与槽位号沿用 CS1.6 原版编号：B→1→2 = USP，B→4→2 = AK-47，B→3→3 = MP5……
  // 原版有而本作未收录的枪（P228/M3/MAC-10 等）不占显示位，编号保留空缺
  { label: '手枪', items: [
    { slot: 1, key: 'glock' },
    { slot: 2, key: 'usp' },
    { slot: 4, key: 'deagle' }
  ] },
  { label: '霰弹枪', items: [
    { slot: 2, key: 'xm1014' }
  ] },
  { label: '微型冲锋枪', items: [
    { slot: 3, key: 'mp5' },
    { slot: 5, key: 'p90' }
  ] },
  // 原版步枪分类按阵营区分（T: B42=AK-47 / CT: B42=M4A1）；本作玩家为 CT 但不限购，
  // 按 T 系原版槽位排 1-6（B42=AK-47），CT 专属步枪顺延 7-9
  { label: '步枪', items: [
    { slot: 1, key: 'galil', tag: 'T' },
    { slot: 2, key: 'ak', tag: 'T' },
    { slot: 3, key: 'scout' },
    { slot: 4, key: 'sg552', tag: 'T' },
    { slot: 5, key: 'awp' },
    { slot: 6, key: 'g3' },
    { slot: 7, key: 'famas', tag: 'CT' },
    { slot: 8, key: 'm4', tag: 'CT' },
    { slot: 9, key: 'aug', tag: 'CT' }
  ] },
  { label: '机关枪', items: [
    { slot: 1, key: 'm249' }
  ] },
  { label: '主武器弹药', items: [
    { slot: 1, key: 'ammoP', name: '主武器弹药 · 补满', price: 60, unit: '匣' }
  ] },
  { label: '副武器弹药', items: [
    { slot: 1, key: 'ammoS', name: '副武器弹药 · 补满', price: 25, unit: '匣' }
  ] },
  { label: '装备', items: [
    { slot: 1, key: 'armor', name: '防弹衣', price: 650 },
    { slot: 2, key: 'helmet', name: '防弹衣+头盔', price: 1000 }
  ] }
];

var buyOpen = false;
var buyCat = null;
var hintText = ''; // hint 当前文本缓存（避免每帧读写 DOM）

function setHint(t) {
  hintText = t;
  el.hint.textContent = t;
}

function canBuy() {
  if (G.mode === 'classic') return G.state === 'buytime';
  if (G.mode === 'tdm') return G.state === 'live' && !P.dead;
  return false; // 军备竞赛不可购买
}

function toggleBuy() {
  if (!canBuy()) return;
  buyOpen = !buyOpen;
  if (buyOpen) { buyCat = null; buyRender(); }
  el.buymenu.style.display = buyOpen ? 'block' : 'none';
}

function buyRender() {
  var h = '<h3>购买装备 · $' + P.money + '</h3>';
  var i, it, wd;
  if (buyCat === null) {
    for (i = 0; i < BUY_CATS.length; i++) {
      h += '<div class="item"><span><span class="k">' + (i + 1) + '</span><b>' + BUY_CATS[i].label + '</b></span><span class="price">›</span></div>';
    }
    h += '<div class="close">按数字进入分类 · 按 B 关闭</div>';
  } else {
    var cat = BUY_CATS[buyCat];
    for (i = 0; i < cat.items.length; i++) {
      it = cat.items[i];
      wd = WEAPONS[it.key];
      var name = wd ? wd.name : it.name;
      var price = wd ? wd.price : it.price;
      var priceTxt = (!wd && it.unit) ? '$' + price + '/' + it.unit : '$' + price;
      var owned = '';
      if (wd) owned = P.weapons[it.key] ? ' <span style="color:#8f825f">已装备</span>' : '';
      else if (it.key === 'armor') owned = P.armor >= 100 ? ' <span style="color:#8f825f">已装备</span>' : '';
      else if (it.key === 'helmet') owned = (P.armor >= 100 && P.helmet) ? ' <span style="color:#8f825f">已装备</span>' : '';
      h += '<div class="item"><span><span class="k">' + it.slot + '</span><b>' + name + '</b>' +
        (it.tag ? ' <span style="color:#8f825f">[' + it.tag + ']</span>' : '') + owned +
        '</span><span class="price">' + priceTxt + '</span></div>';
    }
    h += '<div class="close">按数字购买 · 按 0 返回上级 · 按 B 关闭</div>';
  }
  h += '<div id="buymsg"></div>';
  el.buymenu.innerHTML = h;
  el.buymsg = document.getElementById('buymsg');
}

function buyItem(catIdx, slot) {
  var items = BUY_CATS[catIdx].items, it = null;
  for (var i = 0; i < items.length; i++) if (items[i].slot === slot) { it = items[i]; break; }
  if (!it) return;
  if (it.key === 'ammoP' || it.key === 'ammoS') { buyAmmo(it.key === 'ammoP' ? 1 : 2, it.price); return; }
  var wd = WEAPONS[it.key];
  if (!wd) {
    // 装备：防弹衣 / 防弹衣+头盔
    if (it.key === 'helmet') {
      if (P.armor >= 100 && P.helmet) { flashBuyMsg('装备已满'); return; }
      if (P.money < it.price) { blip(180, 0.15, 0.2); flashBuyMsg('金钱不足'); return; }
      P.armor = 100;
      P.helmet = true;
      P.money -= it.price;
    } else {
      if (P.armor >= 100) { flashBuyMsg('护甲已满'); return; }
      if (P.money < it.price) { blip(180, 0.15, 0.2); flashBuyMsg('金钱不足'); return; }
      P.armor = 100;
      P.money -= it.price;
    }
  } else {
    if (P.money < wd.price) { blip(180, 0.15, 0.2); flashBuyMsg('金钱不足'); return; }
    // 替换同槽位
    for (var k in P.weapons) if (WEAPONS[k].slot === wd.slot && k !== it.key) delete P.weapons[k];
    P.weapons[it.key] = mkWpn(it.key);
    switchTo(it.key);
    P.money -= wd.price;
  }
  buyRender();
  blip(880, 0.08, 0.2, 'sine');
  flashBuyMsg('已购买');
}

// 弹药补给：按弹匣匣数计价，一次补满备弹
function buyAmmo(slot, boxPrice) {
  var k = slotKey(slot);
  if (!k) { flashBuyMsg(slot === 1 ? '没有主武器' : '没有副武器'); return; }
  var w = P.weapons[k], d = WEAPONS[k];
  var boxes = Math.ceil((d.reserve - w.reserve) / d.mag);
  if (boxes <= 0) { flashBuyMsg('备弹已满'); return; }
  var cost = boxes * boxPrice;
  if (P.money < cost) { blip(180, 0.15, 0.2); flashBuyMsg('金钱不足'); return; }
  w.reserve = d.reserve;
  P.money -= cost;
  buyRender();
  blip(880, 0.08, 0.2, 'sine');
  flashBuyMsg('已购买 · -$' + cost);
}

var buyMsgT = null;
function flashBuyMsg(t) {
  if (!el.buymsg) return;
  el.buymsg.textContent = t;
  el.buymsg.style.opacity = 1;
  if (buyMsgT) clearTimeout(buyMsgT);
  buyMsgT = setTimeout(function () { if (el.buymsg) el.buymsg.style.opacity = 0; }, 1200);
}

// ---------------- HUD ----------------
var el = {};
function cacheEls() {
  ['hp', 'hpbar', 'armor', 'helm', 'ammo', 'wpnname', 'money', 'score', 'timer', 'alive', 'crosshair',
   'hitmarker', 'killfeed', 'banner', 'bannersub', 'menu', 'hud', 'pause', 'dmgvig',
   'buymenu', 'hint', 'scope', 'opts', 'modedesc', 'pausemenu'].forEach(function (id) {
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
  if (hudPrev.armor !== P.armor || hudPrev.helmet !== P.helmet) {
    hudPrev.armor = P.armor;
    hudPrev.helmet = P.helmet;
    el.armor.textContent = Math.ceil(P.armor);
    el.helm.textContent = P.helmet ? ' +盔' : '';
  }
  var w = curWpn(), d = curDef();
  var ammoTxt = d.melee ? '— 刀 —' :
    (P.reloading > 0 ? '换弹中…' : (w.ammo + ' / ' + w.reserve));
  if (hudPrev.ammo !== ammoTxt) { hudPrev.ammo = ammoTxt; el.ammo.textContent = ammoTxt; }
  if (hudPrev.wpn !== d.name) { hudPrev.wpn = d.name; el.wpnname.textContent = d.name; }
  var moneyTxt = G.mode === 'gg' ? '军备竞赛' : '$' + P.money;
  if (hudPrev.money !== moneyTxt) { hudPrev.money = moneyTxt; el.money.textContent = moneyTxt; }
  var scoreTxt;
  if (G.mode === 'gg') scoreTxt = '军备 ' + (P.ggTier + 1) + '/' + GG_LADDER.length;
  else if (G.mode === 'tdm') scoreTxt = 'CT ' + G.ctK + ' : ' + G.tK + ' T';
  else scoreTxt = 'CT ' + G.ct + ' : ' + G.t + ' T';
  if (hudPrev.score !== scoreTxt) { hudPrev.score = scoreTxt; el.score.textContent = scoreTxt; }
  var timeTxt;
  if (G.state === 'buytime') timeTxt = '购买 ' + Math.ceil(G.stateT);
  else if (G.state === 'live') timeTxt = isFinite(G.roundT) ? fmtTime(G.roundT) : '--:--';
  else timeTxt = '0:00';
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
  var hintOn = G.state === 'buytime' && !buyOpen && !!hintText;
  if (hudPrev.hint !== hintOn) { hudPrev.hint = hintOn; el.hint.style.opacity = hintOn ? 1 : 0; }
}

// ---------------- 主菜单（自定义比赛） ----------------
var MENU_ROWS = [
  { k: 'map', label: '地图', opts: function () { var a = [], i; for (i = 0; i < MAPS.length; i++) a.push(i); return a; }, fmt: function (v) { return MAPS[v].name; } },
  { k: 'mode', label: '游戏模式', opts: ['classic', 'tdm', 'gg'], fmt: function (v) { return MODES[v].label; } },
  { k: 'diff', label: '敌人难度', opts: ['easy', 'normal', 'hard', 'expert'], fmt: function (v) { return DIFFS[v].label; } },
  { k: 'bots', label: '队伍规模', opts: [2, 3, 4, 5, 6, 7, 8, 9], fmt: function (v) { return v + ' v ' + v; } },
  { k: 'targetC', label: '胜利回合', opts: [3, 5, 8, 16], fmt: function (v) { return v + ' 回合'; }, visible: function () { return SET.mode === 'classic'; } },
  { k: 'targetD', label: '击杀目标', opts: [15, 30, 50, 100], fmt: function (v) { return v + ' 杀'; }, visible: function () { return SET.mode === 'tdm'; } },
  { k: 'roundTime', label: '回合限时', opts: [75, 90, 115, 150, 999], fmt: function (v) { return v === 999 ? '不限制' : v + ' 秒'; }, visible: function () { return SET.mode === 'classic'; } },
  { k: 'money', label: '起始金钱', opts: [800, 2000, 4000, 8000, 16000], fmt: function (v) { return '$' + v; }, visible: function () { return SET.mode !== 'gg'; } },
  { k: 'sens', label: '鼠标灵敏度', opts: [0.5, 0.75, 1, 1.25, 1.5, 2], fmt: function (v) { return v + 'x'; } },
  { k: 'vol', label: '音量', opts: [0, 0.25, 0.45, 0.7, 1], fmt: function (v) { return v === 0 ? '静音' : Math.round(v * 100) + '%'; } }
];

function renderMenu() {
  var host = el.opts;
  host.innerHTML = '';
  for (var i = 0; i < MENU_ROWS.length; i++) {
    var r = MENU_ROWS[i];
    if (r.visible && !r.visible()) continue;
    var vals = typeof r.opts === 'function' ? r.opts() : r.opts;
    var idx = vals.indexOf(SET[r.k]);
    if (idx < 0) idx = 0;
    var row = document.createElement('div');
    row.className = 'orow';
    row.innerHTML = '<span class="lbl">' + r.label + '</span>' +
      '<span class="arr" data-k="' + r.k + '" data-d="-1">‹</span>' +
      '<span class="val">' + r.fmt(vals[idx]) + '</span>' +
      '<span class="arr" data-k="' + r.k + '" data-d="1">›</span>';
    host.appendChild(row);
  }
  el.modedesc.textContent = MODES[SET.mode].desc;
}

function initMenu() {
  el.opts.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains('arr')) return;
    var k = t.getAttribute('data-k'), d = +(t.getAttribute('data-d'));
    var r = null;
    for (var i = 0; i < MENU_ROWS.length; i++) if (MENU_ROWS[i].k === k) { r = MENU_ROWS[i]; break; }
    if (!r) return;
    var vals = typeof r.opts === 'function' ? r.opts() : r.opts;
    var idx = vals.indexOf(SET[k]);
    if (idx < 0) idx = 0;
    SET[k] = vals[(idx + d + vals.length) % vals.length];
    saveSettings();
    if (k === 'vol') applyVolume();
    renderMenu();
  });
  renderMenu();
}

function toMenu() {
  G.state = 'menu';
  G.paused = false;
  G.pendingEnd = null;
  if (document.exitPointerLock) document.exitPointerLock();
  clearBots();
  clearFx();
  el.hud.style.display = 'none';
  el.pause.style.display = 'none';
  el.menu.style.display = 'flex';
  el.banner.parentNode.style.opacity = 0;
  el.scope.style.display = 'none';
  el.killfeed.innerHTML = '';
  el.hint.style.opacity = 0;
  hintText = '';
  buyOpen = false;
  renderMenu();
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
    if (!buyOpen) {
      if (e.code === 'Digit1') switchTo(slotKey(1));
      if (e.code === 'Digit2') switchTo(slotKey(2));
      if (e.code === 'Digit3') switchTo('knife');
    }
    if (buyOpen && e.code.indexOf('Digit') === 0) {
      var n = parseInt(e.code.slice(5), 10);
      if (n === 0 && buyCat !== null) { buyCat = null; buyRender(); }
      else if (buyCat === null) { if (n >= 1 && n <= BUY_CATS.length) { buyCat = n - 1; buyRender(); } }
      else buyItem(buyCat, n); // n = 原版槽位号（B→4→2 = AK-47）
    }
    if (e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', function (e) { keys[e.code] = false; });

  addEventListener('mousedown', function (e) {
    if (G.state === 'menu' || G.state === 'matchend') return;
    if (!document.pointerLockElement) return;
    if (e.button === 0) mouseDown = true;
    if (e.button === 2 && curDef().zoom > 1) setScope(!P.scoped);
  });
  addEventListener('mouseup', function (e) {
    if (e.button === 0) mouseDown = false;
  });
  addEventListener('contextmenu', function (e) { e.preventDefault(); });

  addEventListener('mousemove', function (e) {
    if (!document.pointerLockElement || P.dead) return;
    // 开镜灵敏度按倍率缩放（4x ≈ 0.3x，2x ≈ 0.6x）
    var zoomS = P.scoped ? Math.min(1, Math.max(0.18, 1.2 / curDef().zoom)) : 1;
    var s = CFG.sens * SET.sens * zoomS;
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

function primaryKey() { return slotKey(1); }

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
    frame(dt, now);
  }

  renderer.render(scene, camera);
}

// 模拟帧（渲染除外）：供 tick 与调试步进 WSDBG.step 复用
function frame(dt, now) {
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
      // 死斗 / 军备竞赛：倒计时后重新部署
      if (G.mode !== 'classic' && G.state === 'live') {
        P.respawnT -= dt;
        var ht = '重新部署 ' + Math.max(0, P.respawnT).toFixed(1) + ' 秒';
        if (hintText !== ht) { setHint(ht); el.hint.style.opacity = 1; }
        if (P.respawnT <= 0) respawnPlayer();
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
      // 清理消失尸体（仅经典模式：死斗模式尸体 3 秒后重生）
      for (var j = bots.length - 1; j >= 0; j--) if (bots[j].gone) bots.splice(j, 1);
    }
    updateRound(dt);
    updateParts(dt);
    updateTracers(dt);
    updateHUD();
}

// 半自动开火边沿
addEventListener('mousedown', function (e) {
  if (e.button !== 0 || !document.pointerLockElement) return;
  if (G.state !== 'live' || P.dead) return;
  if (!curDef().auto) tryFire(clock.elapsedTime);
});

// ---------------- 启动 ----------------
function start() {
  loadSettings();
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
  buildMapWorld(SET.map);
  initFx();
  cacheEls();
  initMenu();

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
  el.pausemenu.addEventListener('click', function (e) {
    e.stopPropagation();
    toMenu();
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
    spawnTeams();
    G.state = 'live';
    G.frozen = true;
    camera.position.set(0, 1.62, 20);
    camera.rotation.set(0, Math.PI, 0);
    P.pos.set(0, 0, 20);
  }

  tick();
}

// 调试句柄（自动化测试 / 控制台调参用）
var dbgT = 0;
window.WSDBG = {
  G: G, P: P, SET: SET, WEAPONS: WEAPONS, MAPS: MAPS, MODES: MODES, DIFFS: DIFFS, GG_LADDER: GG_LADDER,
  getBots: function () { return bots; },
  startMatch: startMatch,
  toMenu: toMenu,
  step: function (dt) { dt = dt || 0.016; dbgT += dt; frame(dt, dbgT); },
  killAllT: function () {
    for (var i = bots.length - 1; i >= 0; i--) {
      var b = bots[i];
      if (b.team === 't' && b.alive) {
        b.hp = 0;
        killBot(b, { player: true, name: '你', team: 'ct' }, '调试', false);
      }
    }
  },
  hurt: function (n) { damagePlayer(n || 55, '调试', 't', '调试'); }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}

})();
