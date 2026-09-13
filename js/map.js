'use strict';
/* ============================================================
 * map.js · 地图构建、查询、地形碰撞、基地加固
 * ============================================================ */
import { T, GRID, CELL, BASE } from './config.js';
import { state } from './state.js';

/* ---------- 构建 ---------- */
export function buildMap(mapArr) {
  const tiles = [];
  for (let r = 0; r < GRID; r++) {
    const row = [];
    for (let c = 0; c < GRID; c++) {
      const ch = mapArr[r][c];
      row.push(ch === 'B' ? T.BRICK : ch === 'S' ? T.STEEL : ch === 'W' ? T.WATER : ch === 'T' ? T.TREE : T.EMPTY);
    }
    tiles.push(row);
  }
  state.tiles = tiles;
  state.base.alive = true;
  state.base.steelUntil = 0;
  state.base.steelCells = [];
}

export function tileAt(c, r) {
  if (c < 0 || r < 0 || c >= GRID || r >= GRID) return T.STEEL; // 边界视为钢板
  return state.tiles[r][c];
}

export function removeTile(c, r) {
  if (c >= 0 && r >= 0 && c < GRID && r < GRID) state.tiles[r][c] = T.EMPTY;
}

/* ---------- 地形碰撞（坦克是否可通过） ---------- */
export function solidForTank(c, r) {
  if (c < 0 || r < 0 || c >= GRID || r >= GRID) return true;
  const t = state.tiles[r][c];
  if (t === T.BRICK || t === T.STEEL || t === T.WATER) return true;
  if (state.base.alive && c === state.base.c && r === state.base.r) return true;
  return false;
}

/* ---------- 基地加固（铲子道具） ---------- */
export function fortifyBase() {
  const s = state.base;
  s.steelUntil = state.time + 15;
  s.steelCells = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const c = s.c + dc, r = s.r + dr;
      if (c < 0 || r < 0 || c >= GRID || r >= GRID) continue;
      if (c === s.c && r === s.r) continue;
      if (state.tiles[r][c] === T.BRICK) {
        state.tiles[r][c] = T.STEEL;
        s.steelCells.push([c, r]);
      }
    }
  }
}

export function unfortifyBase() {
  const s = state.base;
  if (state.time < s.steelUntil) return;
  if (s.steelCells.length === 0) return;
  for (const [c, r] of s.steelCells) {
    if (state.tiles[r][c] === T.STEEL) state.tiles[r][c] = T.BRICK;
  }
  s.steelCells = [];
}
