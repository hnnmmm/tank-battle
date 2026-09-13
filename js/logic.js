'use strict';
/* ============================================================
 * logic.js · 游戏逻辑：实体更新、碰撞、AI、道具、关卡流程
 * 只负责修改 state 与触发音效，UI 显示交由 hud.js
 * ============================================================ */
import { CELL, GRID, DIRS, MAPS, SPAWN_PTS, PLAYER_SPAWNS, BASE, PLAYER_KIND, ENEMY_KINDS, POWERUP_STYLE } from './config.js';
import { state } from './state.js';
import { SOUND, initAudio } from './audio.js';
import { keys } from './input.js';
import { buildMap, tileAt, removeTile, solidForTank, fortifyBase, unfortifyBase } from './map.js';

/* ---------- 工具函数 ---------- */
function rand(a, b) { return a + Math.random() * (b - a); }
function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function rectHitRect(x, y, w, h, rx, ry, rw, rh) {
  return x < rx + rw && x + w > rx && y < ry + rh && y + h > ry;
}
function addScore(n, x, y) {
  state.score += n;
  if (state.score > state.hi) {
    state.hi = state.score;
    try { localStorage.setItem('tb-hi', String(state.hi)); } catch (e) { /* ignore */ }
  }
  if (x !== undefined) {
    state.floats.push({ x: x + CELL / 2, y: y, text: '+' + n, t: 1 });
  }
}
function boom(x, y, size, dur) {
  state.effects.push({ x, y, size: size || 30, t: 0, dur: dur || 0.4 });
}
function shake(amount) { state.shake = Math.max(state.shake, amount); }

/* ---------- 移动与碰撞 ---------- */
function canMove(tank, nx, ny) {
  const m = 3; // 内缩边距，便于穿行窄道
  const pts = [
    [nx + m, ny + m], [nx + tank.w - m, ny + m],
    [nx + m, ny + tank.h - m], [nx + tank.w - m, ny + tank.h - m]
  ];
  for (const [px, py] of pts) {
    if (solidForTank(Math.floor(px / CELL), Math.floor(py / CELL))) return false;
  }
  const others = tank.isPlayer ? state.enemies : [state.player, ...state.enemies];
  for (const o of others) {
    if (!o || o === tank || !o.alive || o.respawnT > 0) continue;
    if (aabb({ x: nx, y: ny, w: tank.w, h: tank.h }, o)) return false;
  }
  return true;
}
function tryMove(tank, dx, dy, step) {
  const nx = tank.x + dx * step;
  const ny = tank.y + dy * step;
  // 逐轴移动，避免卡角
  if (dx !== 0 && canMove(tank, nx, tank.y)) tank.x = nx;
  else if (dx !== 0) tank.x = Math.round(tank.x / 4) * 4;
  if (dy !== 0 && canMove(tank, tank.x, ny)) tank.y = ny;
  else if (dy !== 0) tank.y = Math.round(tank.y / 4) * 4;
}

/* ---------- 开火 ---------- */
function bulletSpeed(tank) {
  if (tank.isPlayer) return tank.power >= 1 ? 430 : 300;
  return tank.kind.id === 'power' ? 500 : 320;
}
function fire(tank) {
  const cx = tank.x + tank.w / 2;
  const cy = tank.y + tank.h / 2;
  const off = tank.w / 2 + 6;
  state.bullets.push({
    x: cx + DIRS[tank.dir].dx * off,
    y: cy + DIRS[tank.dir].dy * off,
    dir: tank.dir,
    speed: bulletSpeed(tank),
    owner: tank.isPlayer ? 'p' : 'e',
    w: 8, h: 8,
    dead: false,
    pierce: tank.isPlayer && tank.power >= 3,
    from: tank.isPlayer ? null : tank
  });
  if (tank.isPlayer) tank.flashT = 0.06;
  SOUND.shoot();
}
function playerBullets() { return state.bullets.filter(b => b.owner === 'p' && !b.dead).length; }
function enemyBullets(e) { return state.bullets.filter(b => b.owner === 'e' && !b.dead && b.from === e).length; }

/* ---------- 子弹更新 ---------- */
function updateBullets(dt) {
  const baseRect = { x: BASE.c * CELL, y: BASE.r * CELL, w: CELL, h: CELL };
  for (const b of state.bullets) {
    if (b.dead) continue;
    const step = b.speed * dt;
    b.x += DIRS[b.dir].dx * step;
    b.y += DIRS[b.dir].dy * step;

    // 命中基地
    if (state.base.alive && rectHitRect(b.x - 4, b.y - 4, 8, 8, baseRect.x, baseRect.y, CELL, CELL)) {
      b.dead = true;
      destroyBase();
      continue;
    }
    // 命中地形
    const fx = b.x + DIRS[b.dir].dx * 5;
    const fy = b.y + DIRS[b.dir].dy * 5;
    const cc = Math.floor(fx / CELL), cr = Math.floor(fy / CELL);
    if (cc < 0 || cr < 0 || cc >= GRID || cr >= GRID) { b.dead = true; continue; }
    const t = tileAt(cc, cr);
    if (t === 1 /* BRICK */) {
      removeTile(cc, cr);
      b.dead = true;
      boom(cc * CELL + CELL / 2, cr * CELL + CELL / 2, 18, 0.2);
      SOUND.brick();
      continue;
    }
    if (t === 2 /* STEEL */) {
      if (b.pierce) removeTile(cc, cr);
      b.dead = true;
      boom(cc * CELL + CELL / 2, cr * CELL + CELL / 2, 14, 0.15);
      SOUND.steel();
      continue;
    }
    // 命中坦克
    if (b.owner === 'p') {
      for (const e of state.enemies) {
        if (!e.alive || e.respawnT > 0) continue;
        if (rectHitRect(b.x - 4, b.y - 4, 8, 8, e.x, e.y, e.w, e.h)) {
          b.dead = true;
          e.hp -= 1;
          boom(e.x + e.w / 2, e.y + e.h / 2, 16, 0.2);
          if (e.hp <= 0) killEnemy(e);
          else SOUND.steel();
          break;
        }
      }
    } else {
      const p = state.player;
      if (p && p.alive && p.respawnT <= 0 && rectHitRect(b.x - 4, b.y - 4, 8, 8, p.x, p.y, p.w, p.h)) {
        b.dead = true;
        hitPlayer();
      }
    }
  }
  state.bullets = state.bullets.filter(b => !b.dead);
}

/* ---------- 玩家 ---------- */
function spawnPlayer(idx) {
  const sp = PLAYER_SPAWNS[idx % PLAYER_SPAWNS.length];
  state.player = {
    x: sp.c * CELL + 2, y: sp.r * CELL + 2, w: 36, h: 36,
    dir: 0, kind: PLAYER_KIND, isPlayer: true, alive: true,
    power: 0, shield: 3, respawnT: 0, flashT: 0, shootCd: 0,
    spawnShield: 0
  };
}
function hitPlayer() {
  const p = state.player;
  if (p.shield > 0 || p.respawnT > 0) return;
  boom(p.x + p.w / 2, p.y + p.h / 2, 44, 0.55);
  SOUND.explode();
  shake(4);
  state.lives -= 1;
  p.alive = false;
  p.respawnT = 1.2;
}
function updatePlayer(dt) {
  const p = state.player;
  if (!p) return;
  if (p.flashT > 0) p.flashT -= dt;
  if (!p.alive) {
    p.respawnT -= dt;
    if (p.respawnT <= 0) {
      if (state.lives > 0) { spawnPlayer(0); SOUND.start(); }
      else { gameOver(); }
    }
    return;
  }
  if (p.shield > 0) p.shield -= dt;
  if (p.shootCd > 0) p.shootCd -= dt;
  let dx = 0, dy = 0;
  if (keys.up) dy = -1; else if (keys.down) dy = 1;
  if (keys.left) dx = -1; else if (keys.right) dx = 1;
  if (dx !== 0 || dy !== 0) {
    p.dir = dx === 1 ? 1 : dx === -1 ? 3 : dy === -1 ? 0 : 2;
    tryMove(p, dx, dy, p.kind.speed * dt);
  }
  const maxBullets = p.power >= 2 ? 2 : 1;
  if (keys.fire && p.shootCd <= 0 && playerBullets() < maxBullets) {
    fire(p);
    p.shootCd = p.power >= 1 ? 0.13 : 0.26;
  }
}

/* ---------- 敌军 ---------- */
function enemyRoll(level) {
  const r = Math.random();
  if (level <= 1) return r < 0.72 ? 0 : (r < 0.95 ? 1 : 2);
  if (level <= 2) return r < 0.50 ? 0 : (r < 0.80 ? 1 : (r < 0.95 ? 2 : 3));
  if (level <= 4) return r < 0.34 ? 0 : (r < 0.62 ? 1 : (r < 0.84 ? 2 : 3));
  return r < 0.16 ? 0 : (r < 0.46 ? 1 : (r < 0.72 ? 2 : 3));
}
function spawnEnemy() {
  for (const pt of SPAWN_PTS) {
    const x = pt.c * CELL + 2, y = pt.r * CELL + 2;
    const probe = { x, y, w: 36, h: 36, alive: true, respawnT: 0, isPlayer: false };
    let blocked = false;
    for (const e of state.enemies) {
      if (e.alive && aabb(probe, e)) { blocked = true; break; }
    }
    if (state.player && state.player.alive && aabb(probe, state.player)) blocked = true;
    if (blocked) continue;
    const ki = enemyRoll(state.level);
    const kind = ENEMY_KINDS[ki];
    const speedMul = 1 + Math.min(0.6, state.level * 0.06);
    state.enemies.push({
      x, y, w: 36, h: 36, dir: 2, kind, isPlayer: false,
      alive: true, hp: kind.hp, spawnShield: 1.2,
      changeT: rand(0.6, 2), shootCd: rand(1.2, 3), respawnT: 0,
      speed: kind.speed * speedMul
    });
    return;
  }
  state.spawnTimer = 0.4; // 出生点被占，稍后再试
}
function updateSpawn(dt) {
  if (state.enemiesLeft <= 0) return;
  const active = state.enemies.filter(e => e.alive).length;
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0 && active < 4) {
    spawnEnemy();
    state.spawnTimer = state.level >= 4 ? 1.7 : 2.3;
  }
}
function enemyDirBias(e) {
  const p = state.player;
  const tgt = p && p.alive ? { x: p.x, y: p.y } : { x: BASE.c * CELL, y: BASE.r * CELL };
  const r = Math.random();
  if (r < 0.4) {
    const dc = Math.floor((e.x + e.w / 2) / CELL) - Math.floor(tgt.x / CELL);
    const dr = Math.floor((e.y + e.h / 2) / CELL) - Math.floor(tgt.y / CELL);
    if (Math.abs(dc) > Math.abs(dr)) return dc > 0 ? 3 : 1;
    return dr > 0 ? 0 : 2;
  }
  if (r < 0.65) {
    const dr = e.y - (BASE.r * CELL);
    const dc = e.x - (BASE.c * CELL);
    if (Math.abs(dc) > Math.abs(dr)) return dc > 0 ? 3 : 1;
    return dr > 0 ? 0 : 2;
  }
  return Math.floor(Math.random() * 4);
}
function aligned(e, p) {
  const ec = e.x + e.w / 2, er = e.y + e.h / 2;
  const pc = p.x + p.w / 2, pr = p.y + p.h / 2;
  const dc = Math.round(Math.abs(ec - pc) / CELL);
  const dr = Math.round(Math.abs(er - pr) / CELL);
  return (dc === 0 || dr === 0) && (dc + dr) <= 6;
}
function alignedBase(e) {
  const ec = Math.floor((e.x + e.w / 2) / CELL);
  const er = Math.floor((e.y + e.h / 2) / CELL);
  const dc = Math.abs(ec - BASE.c);
  const dr = Math.abs(er - BASE.r);
  return (dc === 0 || dr === 0) && (dc + dr) <= 5;
}
function updateEnemy(e, dt) {
  if (!e.alive || e.respawnT > 0) return;
  if (e.spawnShield > 0) e.spawnShield -= dt;
  if (state.time < state.frozenUntil) return; // 时钟冻结
  e.shootCd -= dt;
  e.changeT -= dt;
  const d = DIRS[e.dir];
  const before = { x: e.x, y: e.y };
  tryMove(e, d.dx, d.dy, e.speed * dt);
  const stuck = e.x === before.x && e.y === before.y;
  if (stuck || e.changeT <= 0) {
    e.dir = enemyDirBias(e);
    e.changeT = stuck ? 0.35 : rand(0.8, 2.4);
  }
  const p = state.player;
  if (e.shootCd <= 0 && enemyBullets(e) < 1) {
    let wantFire = false;
    if (p && p.alive && aligned(e, p)) wantFire = true;
    else if (alignedBase(e)) wantFire = true;
    if (wantFire || Math.random() < 0.06) {
      if (wantFire && p && p.alive) {
        const ec = e.x + e.w / 2, er = e.y + e.h / 2;
        const pc = p.x + p.w / 2, pr = p.y + p.h / 2;
        e.dir = Math.abs(ec - pc) > Math.abs(er - pr) ? (ec > pc ? 3 : 1) : (er > pr ? 0 : 2);
      }
      fire(e);
      e.shootCd = rand(1.2, 3.2) - Math.min(0.9, state.level * 0.08);
      e.shootCd = Math.max(0.6, e.shootCd);
    }
  }
}
function killEnemy(e) {
  e.alive = false;
  state.enemiesLeft -= 1;
  addScore(e.kind.score, e.x, e.y);
  boom(e.x + e.w / 2, e.y + e.h / 2, 44, 0.5);
  SOUND.explode();
  if (e.kind.id === 'armor') shake(5);
  if (Math.random() < 0.13 && state.powerups.length < 2) {
    const types = ['star', 'star', 'grenade', 'helmet', 'tank', 'shovel', 'clock'];
    state.powerups.push({
      x: e.x, y: e.y, type: types[Math.floor(Math.random() * types.length)], t: 10
    });
  }
  if (state.enemiesLeft <= 0) {
    state.mode = 'levelclear';
    state.levelClearT = 2.6;
    SOUND.levelOk();
  }
}

/* ---------- 道具 ---------- */
function applyPowerup(pu) {
  const p = state.player;
  switch (pu.type) {
    case 'star':
      if (p) p.power = Math.min(3, p.power + 1);
      break;
    case 'grenade':
      for (const e of state.enemies) {
        if (e.alive) { e.alive = false; addScore(e.kind.score, e.x, e.y); boom(e.x + e.w / 2, e.y + e.h / 2, 40, 0.45); }
      }
      SOUND.bigBang();
      shake(6);
      break;
    case 'helmet':
      if (p) p.shield = 10;
      break;
    case 'tank':
      state.lives = Math.min(9, state.lives + 1);
      break;
    case 'shovel':
      fortifyBase();
      break;
    case 'clock':
      state.frozenUntil = state.time + 8;
      break;
  }
  SOUND.powerup();
}
function updatePowerups(dt) {
  for (const pu of state.powerups) {
    pu.t -= dt;
    if (pu.t <= 0) { pu.dead = true; continue; }
    const p = state.player;
    if (p && p.alive && rectHitRect(p.x, p.y, p.w, p.h, pu.x, pu.y, CELL, CELL)) {
      applyPowerup(pu);
      pu.dead = true;
      state.floats.push({ x: pu.x + CELL / 2, y: pu.y, text: POWERUP_STYLE[pu.type].name, t: 1.2 });
    }
  }
  state.powerups = state.powerups.filter(pu => !pu.dead);
}

/* ---------- 基地 ---------- */
function destroyBase() {
  if (!state.base.alive) return;
  state.base.alive = false;
  boom(BASE.c * CELL + CELL / 2, BASE.r * CELL + CELL / 2, 70, 0.9);
  SOUND.baseDown();
  shake(8);
  state.lives = 0;
  gameOver();
}

/* ---------- 特效更新 ---------- */
function updateFx(dt) {
  for (const e of state.effects) e.t += dt;
  state.effects = state.effects.filter(e => e.t < e.dur);
  for (const f of state.floats) { f.t -= dt; f.y -= 22 * dt; }
  state.floats = state.floats.filter(f => f.t > 0);
}

/* ---------- 关卡流程 ---------- */
function startLevel(level) {
  state.level = level;
  state.mode = 'playing';
  state.enemies = [];
  state.bullets = [];
  state.powerups = [];
  state.effects = [];
  state.floats = [];
  state.frozenUntil = 0;
  state.enemiesLeft = 20;
  state.spawnTimer = 1.2;
  buildMap(MAPS[level % MAPS.length]);
  if (!state.player || !state.player.alive) spawnPlayer(0);
  else {
    state.player.x = PLAYER_SPAWNS[0].c * CELL + 2;
    state.player.y = PLAYER_SPAWNS[0].r * CELL + 2;
    state.player.dir = 0;
    state.player.shield = 3;
  }
}
function gameOver() {
  state.mode = 'gameover';
  if (state.score > state.hi) {
    state.hi = state.score;
    try { localStorage.setItem('tb-hi', String(state.hi)); } catch (e) { /* ignore */ }
  }
  SOUND.bigBang();
}
function startGame() {
  initAudio();
  SOUND.start();
  state.lives = 3;
  state.score = 0;
  state.player = null;
  startLevel(0);
}

/* ---------- 高层操作（供输入/UI 回调） ---------- */
export function primaryAction() {
  initAudio();
  if (state.mode === 'paused') state.mode = 'playing';
  else if (state.mode === 'menu' || state.mode === 'gameover') startGame();
}
export function togglePause() {
  if (state.mode === 'playing') state.mode = 'paused';
  else if (state.mode === 'paused') state.mode = 'playing';
}

/* ---------- 每帧更新 ---------- */
export function update(dt) {
  state.time += dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 20);
  if (state.mode === 'playing') {
    updatePlayer(dt);
    for (const e of state.enemies) updateEnemy(e, dt);
    updateBullets(dt);
    updateSpawn(dt);
    updatePowerups(dt);
    unfortifyBase();
  } else if (state.mode === 'levelclear') {
    state.levelClearT -= dt;
    if (state.levelClearT <= 0) startLevel(state.level + 1);
  }
  updateFx(dt);
}