'use strict';
/* ============================================================
 * render.js · Three.js 真 3D 渲染
 * 所有设施（墙体/钢板/水域/树林/基地金鹰/坦克/子弹）均为 3D 模型
 * 逻辑层仍使用 2D 网格坐标，此处负责映射到 3D 世界（XZ 平面）
 * ============================================================ */
import * as THREE from './vendor/three.module.js';
import { CELL, GRID, SIZE, DPR, REDUCED, T, DIRS, EAGLE, BASE, POWERUP_STYLE } from './config.js';
import { state } from './state.js';

const CO = (GRID - 1) / 2; // 网格中心偏移（13 格 → 6）

/* ============================================================
 * 坐标映射：2D 像素 / 网格 → 3D 世界
 * ============================================================ */
// 格子中心的 3D 坐标（c/r 为格子行列）
function cellX(c) { return c - CO; }
function cellZ(r) { return r - CO; }
// 连续像素 → 世界（中心点已按像素中心处理）
function pxX(x, half) { return (x + (half || 0)) / CELL - CO; }
function pxZ(y, half) { return (y + (half || 0)) / CELL - CO; }
// 坦克方向 → 绕 Y 轴旋转（模型默认朝 -Z 即“上方/远处”）
function dirYaw(dir) { return -dir * Math.PI / 2; }

/* ============================================================
 * 渲染器 / 场景 / 相机 / 灯光
 * ============================================================ */
const canvas = document.getElementById('game');
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(DPR);
  renderer.setSize(SIZE, SIZE, false);
  renderer.setClearColor(0x0b0d11, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
} catch (err) {
  renderer = null;
  console.error('[坦克大战] WebGL 初始化失败，无法启动 3D 渲染：', err);
}
// 供 main.js 判断是否需要显示回退提示
export const WEBGL_OK = !!renderer;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0d11);
scene.fog = new THREE.Fog(0x0b0d11, 18, 34);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(0, 13.5, 13.5);
camera.lookAt(0, -0.4, 0);

// —— 灯光 ——
scene.add(new THREE.HemisphereLight(0xbcd2ff, 0x1a1408, 0.55));
const ambient = new THREE.AmbientLight(0x8890aa, 0.6);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
sun.position.set(6, 15, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 50;
sun.shadow.camera.left = -10;
sun.shadow.camera.right = 10;
sun.shadow.camera.top = 10;
sun.shadow.camera.bottom = -10;
sun.shadow.bias = -0.0004;
scene.add(sun);

const fill = new THREE.DirectionalLight(0x6fb6ff, 0.5);
fill.position.set(-6, 6, -4);
scene.add(fill);

/* ============================================================
 * 容器
 * ============================================================ */
const terrainGroup = new THREE.Group();   // 地面 + 地形 + 基地（地图变更时重建）
const tankGroup = new THREE.Group();      // 坦克（缓存复用）
const fxGroup = new THREE.Group();        // 子弹 / 爆炸 / 道具 / 飘分（每帧重建）
scene.add(terrainGroup, tankGroup, fxGroup);

/* ============================================================
 * 共享资源（材质 / 几何体 / 纹理）
 * ============================================================ */
function canvasTexture(drawFn, w = 128, h = 128, repeat = null) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  drawFn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// 砖墙纹理
const brickTexture = canvasTexture((g, w, h) => {
  g.fillStyle = '#5a2c10';
  g.fillRect(0, 0, w, h);
  const rows = 4, cols = 2;
  const bh = h / rows, bwd = w / cols;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) ? 0 : bwd / 2;
    for (let c = 0; c < cols; c++) {
      const x = c * bwd + off;
      if (x >= w) continue;
      g.fillStyle = '#b86427';
      g.fillRect(x + 1.5, r * bh + 1.5, bwd - 3, bh - 3);
      g.fillStyle = 'rgba(255,205,130,0.28)';
      g.fillRect(x + 2, r * bh + 2, bwd - 4, 3);
      g.fillStyle = 'rgba(70,30,5,0.35)';
      g.fillRect(x + 2, r * bh + bh - 4, bwd - 4, 2);
    }
  }
}, 128, 128, [1, 1]);

const matBrick = new THREE.MeshStandardMaterial({ map: brickTexture, roughness: 0.9, flatShading: true });
const matSteel = new THREE.MeshStandardMaterial({ color: 0x9aa1ab, roughness: 0.35, metalness: 0.75, flatShading: true });
const matSteelDark = new THREE.MeshStandardMaterial({ color: 0x5c626c, roughness: 0.4, metalness: 0.7 });
const matWater = new THREE.MeshPhongMaterial({ color: 0x2E7ED4, transparent: true, opacity: 0.62, shininess: 80, specular: 0x9fd0ff });
const matTrunk = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.9 });
const matLeafDark = new THREE.MeshStandardMaterial({ color: 0x1E5A2C, roughness: 0.8, transparent: true, opacity: 0.55 });
const matLeafLight = new THREE.MeshStandardMaterial({ color: 0x3E9450, roughness: 0.8, transparent: true, opacity: 0.55 });
const matEagleDark = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });
const matEagleGold = new THREE.MeshStandardMaterial({ color: 0xE8B83A, roughness: 0.35, metalness: 0.55, emissive: 0x2a1c00, emissiveIntensity: 0.6 });
const matEagleWhite = new THREE.MeshStandardMaterial({ color: 0xFFF7E0, roughness: 0.3, metalness: 0.35, emissive: 0x1a1200, emissiveIntensity: 0.3 });
const matBaseRubble = new THREE.MeshStandardMaterial({ color: 0x3a1d10, roughness: 0.9, flatShading: true });

const geoBoxUnit = new THREE.BoxGeometry(1, 1, 1);

/* ---------- 坦克模型（低多边形 + 渐变/金属分件） ---------- */
const tankGeoCaches = {};
function tankGeo(w, h, d) { const k = w + '|' + h + '|' + d; return tankGeoCaches[k] || (tankGeoCaches[k] = new THREE.BoxGeometry(w, h, d)); }
function tankMatCache(color, metal, rough, emissive, ei) {
  const k = color + '|' + metal + '|' + rough + '|' + emissive;
  return new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, emissive: emissive !== undefined ? emissive : 0x000000, emissiveIntensity: ei || 1, flatShading: true });
}

function buildTank(kind) {
  const root = new THREE.Group();
  const bright = new THREE.Color(kind.color).offsetHSL(0, 0, 0.10).getHex();
  const bodyMat = tankMatCache(kind.color, 0.35, 0.45, kind.isPlayer ? 0x1a1300 : 0x000000, kind.isPlayer ? 0.5 : 0);
  const bodyTopMat = tankMatCache(bright, 0.3, 0.4, 0x000000, 0);
  const trackMat = tankMatCache(kind.dark, 0.55, 0.7, 0x000000, 0);
  const barrelMat = tankMatCache(kind.barrel, 0.55, 0.5, 0x000000, 0);

  // 履带（左右，带分段高光）
  const trackGeo = tankGeo(0.16, 0.70, 0.18);
  for (const side of [-1, 1]) {
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.position.set(side * 0.26, 0.12, 0);
    track.castShadow = true; track.receiveShadow = true;
    root.add(track);
    // 履带分段
    for (let i = 0; i < 3; i++) {
      const seg = new THREE.Mesh(tankGeo(0.18, 0.10, 0.20), tankMatCache(kind.color, 0.45, 0.6, 0x000000, 0));
      seg.position.set(side * 0.26, 0.12, -0.22 + i * 0.22);
      seg.castShadow = true;
      root.add(seg);
    }
  }
  // 车体
  const body = new THREE.Mesh(tankGeo(0.50, 0.24, 0.68), bodyMat);
  body.position.set(0, 0.30, 0);
  body.castShadow = true; body.receiveShadow = true;
  root.add(body);
  const bodyTop = new THREE.Mesh(tankGeo(0.42, 0.08, 0.56), bodyTopMat);
  bodyTop.position.set(0, 0.46, 0);
  bodyTop.castShadow = true;
  root.add(bodyTop);
  // 炮塔
  const turret = new THREE.Mesh(tankGeo(0.28, 0.13, 0.34), barrelMat);
  turret.position.set(0, 0.56, 0.02);
  turret.castShadow = true;
  root.add(turret);
  const turretCap = new THREE.Mesh(tankGeo(0.20, 0.05, 0.20), tankMatCache(kind.barrel, 0.4, 0.4, 0x000000, 0));
  turretCap.position.set(0, 0.64, 0.02);
  turretCap.castShadow = true;
  root.add(turretCap);
  // 炮管
  const barrel = new THREE.Mesh(tankGeo(0.06, 0.06, 0.42), barrelMat);
  barrel.position.set(0, 0.58, -0.36);
  barrel.castShadow = true;
  root.add(barrel);
  // 装甲坦克加装侧裙
  if (kind.id === 'armor') {
    const skirt = new THREE.Mesh(tankGeo(0.54, 0.10, 0.68), tankMatCache(kind.color, 0.4, 0.5, 0x000000, 0));
    skirt.position.set(0, 0.20, 0);
    skirt.castShadow = true;
    root.add(skirt);
  }

  // 阴影投影板（渲染坦克时切换）
  const shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.02;
  root.add(shadowDisc);

  root.userData.kind = kind;
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return root;
}

/* ---------- 砖墙 / 钢板 / 水域 / 树林 / 基地 ---------- */
function makeWall(type) {
  const g = new THREE.Group();
  if (type === T.BRICK) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.72, 0.92), matBrick);
    m.position.y = 0.36;
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  } else if (type === T.STEEL) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.90, 0.80, 0.90), matSteel);
    m.position.y = 0.40;
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    const rivetGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.05, 10);
    for (const [dx, dz] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) {
      const rv = new THREE.Mesh(rivetGeo, matSteelDark);
      rv.position.set(dx, 0.82, dz);
      rv.castShadow = true;
      g.add(rv);
    }
  } else if (type === T.WATER) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.10, 0.96), matWater);
    base.position.y = 0.05;
    base.receiveShadow = true;
    g.add(base);
    g.userData.water = true;
  }
  return g;
}

function makeTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.10, 0.5, 8), matTrunk);
  trunk.position.y = 0.25;
  trunk.castShadow = true;
  g.add(trunk);
  const crown1 = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), matLeafDark);
  crown1.position.y = 0.78;
  crown1.castShadow = true;
  g.add(crown1);
  const crown2 = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), matLeafLight);
  crown2.position.set(0.10, 0.62, 0.05);
  g.add(crown2);
  const crown3 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), matLeafDark);
  crown3.position.set(-0.10, 0.66, -0.08);
  g.add(crown3);
  g.userData.tree = true;
  return g;
}

function makeBase() {
  const g = new THREE.Group();
  // 基座
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.90, 0.16, 0.90), matSteelDark);
  plinth.position.y = 0.08;
  plinth.castShadow = true; plinth.receiveShadow = true;
  g.add(plinth);

  // 金鹰浮雕：把 16x16 像素图映射为凸起小方块
  const eagleGroup = new THREE.Group();
  const pxSize = 0.94 / 16;
  const geoPixel = new THREE.BoxGeometry(pxSize * 0.96, pxSize * 0.96, pxSize * 0.5);
  const palettes = { D: matEagleDark, G: matEagleGold, W: matEagleWhite };
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 16; c++) {
      const ch = EAGLE[r][c];
      const mat = palettes[ch];
      if (!mat) continue;
      const m = new THREE.Mesh(geoPixel, mat);
      // 像素 c 列 → X，r 行 → Y（自上而下），鹰面朝 +Z（玩家方向）
      m.position.set((c - 7.5) * pxSize, 0.16 + (15.5 - r) * pxSize, pxSize * 0.28);
      m.castShadow = true;
      eagleGroup.add(m);
    }
  }
  eagleGroup.name = 'eagle';
  g.add(eagleGroup);

  // 残骸（基地被毁后显示）
  const rubble = new THREE.Group();
  const rub = new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.18, 0.80), matBaseRubble);
  rub.position.y = 0.09;
  rub.castShadow = true;
  rubble.add(rub);
  rubble.name = 'rubble';
  rubble.visible = false;
  g.add(rubble);

  return g;
}

/* ============================================================
 * 地形 & 基地（随地图变更重建）
 * ============================================================ */
let lastTilesVersion = -1;
let baseGroup = null;
const waterMeshes = [];
const treeMeshes = [];

function rebuildTerrain() {
  // 清空
  while (terrainGroup.children.length) {
    const c = terrainGroup.children[0];
    terrainGroup.remove(c);
    disposeObject(c);
  }
  waterMeshes.length = 0;
  treeMeshes.length = 0;

  // 地面
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GRID, GRID), new THREE.MeshStandardMaterial({ color: 0x15181f, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  terrainGroup.add(ground);

  // 棋盘格纹（更立体）
  const gridLine = new THREE.GridHelper(GRID, GRID, 0x2c3a5a, 0x1b2436);
  gridLine.position.y = 0.01;
  terrainGroup.add(gridLine);

  // 地形
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const t = state.tiles[r][c];
      if (t === T.EMPTY || t === T.TREE) continue;
      const obj = makeWall(t);
      obj.position.set(cellX(c), 0, cellZ(r));
      if (t === T.WATER) waterMeshes.push({ obj, i: waterMeshes.length });
      terrainGroup.add(obj);
    }
  }

  // 树林（最后建）
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (state.tiles[r][c] !== T.TREE) continue;
      const tree = makeTree();
      tree.position.set(cellX(c) + (Math.random() - 0.5) * 0.2, 0, cellZ(r) + (Math.random() - 0.5) * 0.2);
      tree.userData.baseX = tree.position.x;
      tree.userData.baseZ = tree.position.z;
      treeMeshes.push(tree);
      terrainGroup.add(tree);
    }
  }

  // 基地
  baseGroup = makeBase();
  baseGroup.position.set(cellX(BASE.c), 0, cellZ(BASE.r));
  terrainGroup.add(baseGroup);
}

function disposeObject(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
      else o.material.dispose();
    }
  });
}

/* ============================================================
 * 坦克缓存
 * ============================================================ */
const tankMeshes = new Map(); // tank对象 -> Group

function syncTanks() {
  const want = [];
  if (state.player) want.push(state.player);
  for (const e of state.enemies) want.push(e);

  const wantSet = new Set(want);
  for (const [tank, mesh] of tankMeshes) {
    if (!wantSet.has(tank)) { tankGroup.remove(mesh); disposeObject(mesh); tankMeshes.delete(tank); }
  }

  for (const tank of want) {
    let mesh = tankMeshes.get(tank);
    if (!mesh) {
      mesh = buildTank(tank.kind);
      tankMeshes.set(tank, mesh);
      tankGroup.add(mesh);
    }
    const alive = tank.alive;
    mesh.visible = alive;
    if (!alive) continue;
    const wx = pxX(tank.x, tank.w / 2);
    const wz = pxZ(tank.y, tank.h / 2);
    mesh.position.set(wx, 0, wz);
    mesh.rotation.y = dirYaw(tank.dir);

    // 防护罩
    syncShield(mesh, tank);
    // 出生闪烁
    let flash = mesh.userData.spawnFlash;
    if (tank.spawnShield > 0 && Math.floor(tank.spawnShield * 8) % 2 === 0) {
      if (!flash) {
        flash = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }));
        flash.position.y = 0.4;
        mesh.add(flash);
        mesh.userData.spawnFlash = flash;
      }
      flash.visible = true;
    } else if (flash) flash.visible = false;
  }
}

function syncShield(mesh, tank) {
  let shield = mesh.userData.shield;
  if (tank.shield > 0) {
    if (!shield) {
      shield = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0x8FD3FF, transparent: true, opacity: 0.22, depthWrite: false }));
      shield.position.y = 0.4;
      mesh.add(shield);
      mesh.userData.shield = shield;
    }
    shield.visible = true;
    shield.rotation.y += 0.02;
  } else if (shield) shield.visible = false;
}

/* ============================================================
 * 子弹 / 爆炸 / 道具 / 飘分（每帧重建）
 * ============================================================ */
let bulletGeo = null, bulletMatP = null, bulletMatE = null;
let particleGeo = null, particleMats = [];

function clearGroup(g) {
  while (g.children.length) {
    const c = g.children[0];
    g.remove(c);
    if (c.material) c.material.dispose();
  }
}

function syncFx() {
  clearGroup(fxGroup);

  // —— 子弹（发光弹丸 + 尾迹） ——
  if (!bulletGeo) bulletGeo = new THREE.SphereGeometry(0.09, 12, 8);
  if (!bulletMatP) bulletMatP = new THREE.MeshBasicMaterial({ color: 0xFFE9A8 });
  if (!bulletMatE) bulletMatE = new THREE.MeshBasicMaterial({ color: 0xFFB3A0 });
  for (const b of state.bullets) {
    if (b.dead) continue;
    const mat = b.owner === 'p' ? bulletMatP : bulletMatE;
    const m = new THREE.Mesh(bulletGeo, mat);
    const wx = pxX(b.x - 4, 4); // b.x 为中心
    const wz = pxZ(b.y - 4, 4);
    m.position.set(wx, 0.35, wz);
    fxGroup.add(m);
    // 尾迹
    const tail = new THREE.Mesh(bulletGeo, mat);
    tail.scale.set(1, 1, 2.2);
    const d = DIRS[b.dir];
    tail.position.set(wx - d.dx * 0.16, 0.35, wz + d.dy * 0.16);
    tail.rotation.y = dirYaw(b.dir);
    fxGroup.add(tail);
  }

  // —— 爆炸火球 ——
  if (!particleGeo) particleGeo = new THREE.SphereGeometry(0.14, 10, 8);
  for (const e of state.effects) {
    const p = Math.min(1, e.t / e.dur);
    const s = (e.size / CELL) * (0.4 + 0.9 * p);
    const mat = new THREE.MeshBasicMaterial({
      color: p < 0.4 ? 0xffffff : (p < 0.7 ? 0xffd966 : 0xff7a2f),
      transparent: true, opacity: 0.9 * (1 - p), depthWrite: false
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 10), mat);
    const wx = pxX(e.x - e.size, e.size); // e.x 为中心
    const wz = pxZ(e.y - e.size, e.size);
    m.position.set(wx, s * 0.5, wz);
    fxGroup.add(m);
    mat.userData = { dispose: true };
  }

  // —— 道具（发光旋转体 + 标签） ——
  for (const pu of state.powerups) {
    if (pu.dead) continue;
    const st = POWERUP_STYLE[pu.type];
    const wx = pxX(pu.x, CELL / 2), wz = pxZ(pu.y, CELL / 2);
    const y = 0.35 + Math.sin(state.time * 3 + pu.type.length) * 0.06;

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(st.color),
      emissive: new THREE.Color(st.color), emissiveIntensity: 0.9,
      roughness: 0.3, metalness: 0.4
    });
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), mat);
    body.position.set(wx, y, wz);
    body.rotation.y = state.time * 2.2;
    body.scale.setScalar(1 + 0.06 * Math.sin(state.time * 6));
    body.castShadow = true;
    fxGroup.add(body);

    // 光环
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 8, 20),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(st.color), transparent: true, opacity: 0.5, depthWrite: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(wx, 0.05, wz);
    fxGroup.add(ring);

    // 标签（Sprite 文字）
    const label = textSprite(st.label, st.color);
    label.position.set(wx, y + 0.55, wz);
    fxGroup.add(label);
  }

  // —— 飘分文字 ——
  for (const f of state.floats) {
    const wx = pxX(f.x - 20, 20), wz = pxZ(f.y - 20, 20);
    const y = 0.5 + (1 - f.t) * 0.4;
    const label = textSprite(f.text, '#FFE9A8');
    label.position.set(wx, y, wz);
    label.material.opacity = Math.min(1, f.t * 2);
    fxGroup.add(label);
  }
}

const spriteCache = {};
function textSprite(text, color) {
  const key = text + color;
  const base = spriteCache[key];
  if (!base) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.font = 'bold 30px "Courier New", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(0,0,0,0.75)';
    g.strokeText(text, 64, 34);
    g.fillStyle = color;
    g.fillText(text, 64, 34);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    spriteCache[key] = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false });
  }
  const sp = new THREE.Sprite(spriteCache[key]);
  sp.scale.set(0.72, 0.36, 1);
  return sp;
}

/* ============================================================
 * 主渲染入口（main 每帧调用）
 * ============================================================ */
export function draw() {
  if (!renderer) return; // WebGL 不可用时跳过渲染，其余逻辑由 main 循环照常驱动
  const t = state.time;

  // 地形内容变化则重建（版本号由 map.js 在改动时递增）
  if (state.tilesVersion !== lastTilesVersion) {
    rebuildTerrain();
    lastTilesVersion = state.tilesVersion;
  }

  // 基地存活状态切换
  if (baseGroup) {
    const dead = !state.base.alive;
    baseGroup.getObjectByName('eagle').visible = !dead;
    baseGroup.getObjectByName('rubble').visible = dead;
  }

  // 水域动画
  if (!REDUCED) {
    for (const w of waterMeshes) {
      w.obj.position.y = Math.sin(t * 3 + w.i) * 0.03;
    }
    // 树微摇
    for (const tr of treeMeshes) {
      tr.rotation.z = Math.sin(t * 1.6 + tr.position.x) * 0.02;
      tr.rotation.x = Math.cos(t * 1.3 + tr.position.z) * 0.02;
    }
  }

  syncTanks();
  syncFx();

  renderer.render(scene, camera);
}