'use strict';
/* ============================================================
 * state.js · 全局可变状态（单一数据源）
 * ============================================================ */
import { BASE } from './config.js';

export const state = {
  mode: 'menu',               // menu | playing | paused | levelclear | gameover
  level: 0,
  score: 0,
  hi: (function () { try { return parseInt(localStorage.getItem('tb-hi') || '0', 10) || 0; } catch (e) { return 0; } })(),
  lives: 3,
  tiles: null,                // 二维数组 [r][c]
  player: null,
  enemies: [],                // 敌军数组
  enemiesLeft: 0,             // 尚未出场的敌军数
  spawnTimer: 0,
  bullets: [],
  powerups: [],
  effects: [],                // 爆炸特效
  floats: [],                 // 飘分文字
  time: 0,                    // 全局时间（动画用）
  frozenUntil: 0,             // 时钟道具冻结结束时间
  base: { c: BASE.c, r: BASE.r, alive: true, steelUntil: 0, steelCells: [] },
  shake: 0,
  levelClearT: 0,
  killStreak: 0
};