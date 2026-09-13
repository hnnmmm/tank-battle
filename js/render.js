'use strict';
/* ============================================================
 * render.js · Canvas 2D 渲染（伪 3D：斜面高光、投影、辉光、渐变）
 * ============================================================ */
import { CELL, GRID, SIZE, DPR, REDUCED, T, DIRS, EAGLE, BASE, POWERUP_STYLE } from './config.js';
import { state } from './state.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = SIZE * DPR;
canvas.height = SIZE * DPR;

/* ---------- 工具 ---------- */
function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function cellRect(c, r) { return { x: c * CELL, y: r * CELL }; }

// 颜色明暗调节（hex -> 变亮/变暗）
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r * f)));
  g = Math.max(0, Math.min(255, Math.round(g * f)));
  b = Math.max(0, Math.min(255, Math.round(b * f)));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// 圆角矩形路径
function rounded(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 投影（soft，向下向右偏移）
function dropShadow(x, y, w, h, alpha) {
  ctx.fillStyle = 'rgba(0,0,0,' + (alpha || 0.35) + ')';
  rounded(ctx, x + 3, y + 5, w, h, 6);
  ctx.fill();
}

// 斜面高光（上/左亮，下/右暗）
function bevel(x, y, w, h, light, dark) {
  if (light) { ctx.fillStyle = light; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y, 2, h); }
  if (dark) { ctx.fillStyle = dark; ctx.fillRect(x, y + h - 2, w, 2); ctx.fillRect(x + w - 2, y, 2, h); }
}

/* ---------- 棋盘地面 + 网格 + 暗角 ---------- */
function drawGround(t) {
  px(ctx, 0, 0, SIZE, SIZE, '#0b0d11');
  // 网格
  ctx.strokeStyle = 'rgba(120,160,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= GRID; i++) {
    ctx.beginPath();
    ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, SIZE);
    ctx.moveTo(0, i * CELL); ctx.lineTo(SIZE, i * CELL);
    ctx.stroke();
  }
  // 暗角
  const v = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.3, SIZE / 2, SIZE / 2, SIZE * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

/* ---------- 砖墙（3D） ---------- */
function drawBrick(ctx, x, y) {
  dropShadow(x, y, CELL - 2, CELL - 2);
  px(ctx, x, y, CELL, CELL, '#5a2c10'); // 灰缝底色
  const fill = '#b86427', light = '#eaa15a', dark = '#6f360f';
  // 2x2 砖块，带斜面
  const bricks = [[2, 2, 17, 17], [21, 2, 17, 17], [2, 21, 17, 16], [21, 21, 17, 16]];
  for (const [bx, by, bw, bh] of bricks) {
    px(ctx, x + bx, y + by, bw, bh, fill);
    bevel(x + bx, y + by, bw, bh, light, dark);
    // 顶部小亮点
    px(ctx, x + bx + 4, y + by + 3, 6, 4, 'rgba(255,220,170,0.35)');
  }
}

/* ---------- 钢板（金属 3D） ---------- */
function drawSteel(ctx, x, y) {
  dropShadow(x, y, CELL - 2, CELL - 2);
  const g = ctx.createLinearGradient(x, y, x + CELL, y + CELL);
  g.addColorStop(0, '#e8ecf2');
  g.addColorStop(0.5, '#aab0ba');
  g.addColorStop(1, '#676c76');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, CELL, CELL);
  bevel(x, y, CELL, CELL, 'rgba(255,255,255,0.6)', 'rgba(0,0,0,0.38)');
  // 铆钉
  const rivets = [[7, 7], [29, 7], [7, 29], [29, 29]];
  for (const [rx, ry] of rivets) {
    px(ctx, x + rx, y + ry, 5, 5, '#7a7e87');
    px(ctx, x + rx + 1, y + ry + 1, 2, 2, 'rgba(255,255,255,0.7)');
  }
  // 中央横槽
  px(ctx, x + 4, y + 18, CELL - 8, 3, 'rgba(0,0,0,0.25)');
  px(ctx, x + 4, y + 18, CELL - 8, 1, 'rgba(255,255,255,0.35)');
}

/* ---------- 水域（动态水波） ---------- */
function drawWater(ctx, x, y, frame) {
  const g = ctx.createLinearGradient(x, y, x, y + CELL);
  g.addColorStop(0, '#2E7ED4');
  g.addColorStop(0.55, '#1B4E8A');
  g.addColorStop(1, '#0f2f55');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, CELL, CELL);
  const off = frame ? 5 : 0;
  for (let i = 0; i < 4; i++) {
    const yy = y + 5 + i * 8;
    px(ctx, x + ((off + i * 7) % 30), yy, 12, 3, 'rgba(255,255,255,0.28)');
    px(ctx, x + ((off + i * 9 + 14) % 32), yy + 4, 9, 2, 'rgba(140,200,255,0.4)');
  }
}

/* ---------- 树林（半透明遮挡，带投影与摇曳） ---------- */
function drawTree(ctx, x, y, t) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x + CELL / 2, y + CELL / 2 + 7, 17, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  const greens = ['#1E5A2C', '#2E7D3F', '#3E9450', '#55A863'];
  for (let i = 0; i < 10; i++) {
    const sway = REDUCED ? 0 : Math.sin(t * 1.8 + i) * 1.3;
    const gx = x + 4 + ((i * 19) % 32) + sway;
    const gy = y + 4 + ((i * 13) % 32);
    const r = 4 + (i % 3);
    ctx.fillStyle = greens[i % 4];
    ctx.beginPath();
    ctx.arc(gx, gy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#6fc77a';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(x + 3 + (i * 8) % 32, y + 4 + (i * 11) % 32, 5, 4);
  }
}

/* ---------- 基地（金鹰） ---------- */
function drawBase(ctx, t) {
  const bx = BASE.c * CELL, by = BASE.r * CELL;
  if (!state.base.alive) {
    px(ctx, bx, by, CELL, CELL, '#3a1d10');
    px(ctx, bx + 4, by + 24, 32, 4, '#A65A1E');
    px(ctx, bx + 10, by + 28, 6, 6, '#C87932');
    return;
  }
  dropShadow(bx, by, CELL - 2, CELL - 2, 0.3);
  const s = 2; // 16x16 像素图放大 2 倍 = 32px，居中于格
  const ox = bx + (CELL - 32) / 2, oy = by + (CELL - 32) / 2;
  const map = { D: '#1a1a1a', G: '#E8B83A', W: '#FFF7E0', '.': null };
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 16; c++) {
      const col = map[EAGLE[r][c]];
      if (col) px(ctx, ox + c * s, oy + r * s, s, s, col);
    }
  }
  px(ctx, bx, by + CELL - 4, CELL, 4, '#1a1a1a');
  // 加固时的蓝色高光
  if (state.base.steelUntil > state.time) {
    ctx.strokeStyle = '#7CC4FF';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx + 1, by + 1, CELL - 2, CELL - 2);
  }
}

/* ---------- 坦克（3D 立体） ---------- */
function drawTankBody(ctx, x, y, w, h, kind) {
  const s = w / 12;                       // 12x12 像素网格
  const bodyTop = shade(kind.color, 1.28);
  const bodyBot = shade(kind.color, 0.78);
  // 履带（左右两列，带分段高光）
  px(ctx, x, y + 1 * s, 2 * s, 10 * s, kind.dark);
  px(ctx, x + 10 * s, y + 1 * s, 2 * s, 10 * s, kind.dark);
  for (let i = 0; i < 4; i++) {
    const ty = y + (1.5 + i * 2.4) * s;
    px(ctx, x, ty, 2 * s, s, kind.color);
    px(ctx, x + 10 * s, ty, 2 * s, s, kind.color);
  }
  // 车身（上亮下暗的纵向渐变）
  const bg = ctx.createLinearGradient(0, y + 2 * s, 0, y + 10 * s);
  bg.addColorStop(0, bodyTop);
  bg.addColorStop(1, bodyBot);
  ctx.fillStyle = bg;
  ctx.fillRect(x + 2 * s, y + 2 * s, 8 * s, 8 * s);
  px(ctx, x + 2 * s, y + 2 * s, 8 * s, 2 * s, 'rgba(255,255,255,0.32)');
  px(ctx, x + 2 * s, y + 8 * s, 8 * s, 2 * s, 'rgba(0,0,0,0.25)');
  // 炮塔（渐变 + 高光 + 中缝）
  const tg = ctx.createLinearGradient(0, y + 4 * s, 0, y + 8 * s);
  tg.addColorStop(0, shade(kind.barrel, 1.25));
  tg.addColorStop(1, kind.barrel);
  ctx.fillStyle = tg;
  ctx.fillRect(x + 4 * s, y + 4 * s, 4 * s, 4 * s);
  px(ctx, x + 4 * s, y + 4 * s, 4 * s, 1.5 * s, 'rgba(255,255,255,0.28)');
  px(ctx, x + 5 * s, y + 4 * s, 2 * s, 4 * s, kind.dark);
}
function drawTank(ctx, tank) {
  const kind = tank.kind;
  const w = tank.w, h = tank.h;
  // 地面投影（未旋转，向下偏移）
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(tank.x + w / 2, tank.y + h / 2 + 3, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(tank.x + w / 2, tank.y + h / 2);
  ctx.rotate(tank.dir * Math.PI / 2);
  ctx.translate(-w / 2, -h / 2);
  drawTankBody(ctx, 0, 0, w, h, kind);
  // 炮管（朝上，带高光）
  px(ctx, w / 2 - 1.5, 0, 3, 6, kind.barrel);
  px(ctx, w / 2 - 1.5, 0, 1, 6, 'rgba(255,255,255,0.3)');
  ctx.restore();

  // 防护罩（辉光虚线）
  if (tank.shield > 0) {
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#8FD3FF';
    ctx.shadowColor = '#8FD3FF';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    ctx.strokeRect(tank.x - 1, tank.y - 1, w + 2, h + 2);
    ctx.restore();
  }
  // 出生闪烁
  if (tank.spawnShield > 0 && Math.floor(tank.spawnShield * 8) % 2 === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(tank.x, tank.y, w, h);
  }
  // 玩家开火闪光
  if (tank.isPlayer && tank.flashT > 0) {
    const fx = tank.x + w / 2 + DIRS[tank.dir].dx * w / 2;
    const fy = tank.y + h / 2 + DIRS[tank.dir].dy * h / 2;
    ctx.save();
    ctx.shadowColor = '#FFE9A8';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#FFE9A8';
    ctx.beginPath();
    ctx.arc(fx, fy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ---------- 子弹（辉光弹丸） ---------- */
function drawBullets(ctx) {
  for (const b of state.bullets) {
    const col = b.owner === 'p' ? '#FFE9A8' : '#FFB3A0';
    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur = 9;
    const g = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, 7);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ---------- 爆炸特效（火球光晕） ---------- */
function drawEffects(ctx) {
  for (const e of state.effects) {
    const p = e.t / e.dur;
    const size = e.size * (0.3 + 0.9 * p);
    ctx.save();
    ctx.globalAlpha = 1 - p;
    const g = ctx.createRadialGradient(e.x, e.y, 1, e.x, e.y, size / 2);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.3, '#ffd966');
    g.addColorStop(0.7, '#ff7a2f');
    g.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(e.x, e.y, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ---------- 道具（玻璃质感 + 辉光 + 脉动） ---------- */
function drawPowerups(ctx) {
  for (const pu of state.powerups) {
    const st = POWERUP_STYLE[pu.type];
    if (Math.floor(pu.t * 4) % 2 === 0) continue;
    const pulse = 1 + 0.06 * Math.sin(pu.t * 6);
    const cw = CELL * pulse;
    const ox = pu.x + (CELL - cw) / 2;
    const oy = pu.y + (CELL - cw) / 2;
    ctx.save();
    ctx.shadowColor = st.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#0e1014';
    rounded(ctx, ox, oy, cw, cw, 5);
    ctx.fill();
    ctx.strokeStyle = st.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = st.color;
    ctx.font = 'bold ' + Math.round(15 * pulse) + 'px "Courier New",monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(st.label, pu.x + CELL / 2, pu.y + CELL / 2 + 1);
  }
}

/* ---------- 飘分文字（辉光） ---------- */
function drawFloats(ctx) {
  for (const f of state.floats) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.t * 2);
    ctx.shadowColor = '#FFE9A8';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#FFE9A8';
    ctx.font = 'bold 13px "Courier New",monospace';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }
}

/* ---------- 主渲染 ---------- */
export function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const frame = REDUCED ? 0 : Math.floor(state.time * 3) % 2;
  drawGround(frame);
  ctx.save();
  if (state.shake > 0.3) {
    ctx.translate(
      Math.round((Math.random() - 0.5) * state.shake * 2),
      Math.round((Math.random() - 0.5) * state.shake * 2)
    );
  }
  // 地形（树林最后画，盖住坦克）
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const t = state.tiles[r][c];
      if (t === T.EMPTY || t === T.TREE) continue;
      const x = c * CELL, y = r * CELL;
      if (t === T.BRICK) drawBrick(ctx, x, y);
      else if (t === T.STEEL) drawSteel(ctx, x, y);
      else if (t === T.WATER) drawWater(ctx, x, y, frame);
    }
  }
  drawBase(ctx, frame);
  drawPowerups(ctx);
  for (const e of state.enemies) if (e.alive) drawTank(ctx, e);
  if (state.player && state.player.alive) drawTank(ctx, state.player);
  drawBullets(ctx);
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (state.tiles[r][c] === T.TREE) drawTree(ctx, c * CELL, r * CELL, state.time);
    }
  }
  drawEffects(ctx);
  drawFloats(ctx);
  ctx.restore();
}