'use strict';
/* ============================================================
 * config.js · 常量与静态数据（无副作用）
 * 关卡地图、坦克种类、道具样式、金鹰像素图等
 * ============================================================ */

export const CELL = 40;                 // 一格像素
export const GRID = 13;                 // 13x13 网格
export const SIZE = CELL * GRID;        // 520
export const DPR = Math.min(window.devicePixelRatio || 1, 2);
export const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

// 方向：0 上 / 1 右 / 2 下 / 3 左
export const DIRS = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 }
];

// 地形类型
export const T = { EMPTY: 0, BRICK: 1, STEEL: 2, WATER: 3, TREE: 4 };

/* ---------- 关卡地图（B 砖墙 / S 钢板 / W 水域 / T 树林 / . 空地） ---------- */
export const MAPS = [
  [
    ".............",
    ".BBB....BBB..",
    ".B.B....B.B..",
    ".BBB....BBB..",
    "..TT.TTT.TT..",
    ".............",
    "...BB..BB....",
    "..B......B...",
    "...BB..BB....",
    "...WWW..WWW..",
    ".............",
    ".....BBB.....",
    ".....B.B....."
  ],
  [
    ".............",
    ".BB.BB.BB.BB.",
    ".B..B.B.B..B.",
    ".BB.BBB.BB.B.",
    ".............",
    "..T.TT.TT.T..",
    ".....BB......",
    "..SS.S..S.SS.",
    ".....BB......",
    "...W..WW..W..",
    ".............",
    ".....BBB.....",
    ".....B.B....."
  ],
  [
    ".............",
    ".B.B.BBB.B.B.",
    ".B.B.B.B.B.B.",
    ".BBB.BBB.BBB.",
    ".............",
    "..TT...TT....",
    ".SS.BBB.B.SS.",
    ".SS.B.B.B.SS.",
    ".SS.BBB.B.SS.",
    "....WWWW.....",
    ".............",
    ".....BBB.....",
    ".....B.B....."
  ]
];

export const SPAWN_PTS = [{ c: 0, r: 0 }, { c: 6, r: 0 }, { c: 12, r: 0 }];
export const PLAYER_SPAWNS = [{ c: 2, r: 12 }, { c: 10, r: 12 }];
export const BASE = { c: 6, r: 12 };

/* ---------- 坦克种类 ---------- */
export const PLAYER_KIND = { color: '#E8B83A', dark: '#8a6d14', barrel: '#6b5208', speed: 150, hp: 1, score: 0, isPlayer: true };
export const ENEMY_KINDS = [
  { id: 'basic', name: '轻型', color: '#C9CDD4', dark: '#5a5e66', barrel: '#3a3d44', speed: 78,  hp: 1, score: 100 },
  { id: 'fast',  name: '快车', color: '#B0DCE8', dark: '#4a7a8a', barrel: '#2e5561', speed: 128, hp: 1, score: 200 },
  { id: 'power', name: '重型', color: '#6E6E74', dark: '#2c2c30', barrel: '#1b1b1e', speed: 92,  hp: 1, score: 300 },
  { id: 'armor', name: '装甲', color: '#9CCB6A', dark: '#3f6a22', barrel: '#2a4a16', speed: 70,  hp: 4, score: 400 }
];

/* ---------- 道具样式 ---------- */
export const POWERUP_STYLE = {
  star:    { label: '★', color: '#FFE9A8', name: '火力升级' },
  grenade: { label: '炸', color: '#FF8A5C', name: '全屏爆破' },
  helmet:  { label: '盔', color: '#8FD3FF', name: '防护罩' },
  tank:    { label: '命', color: '#7CC46A', name: '增加生命' },
  shovel:  { label: '铲', color: '#C9CDD4', name: '加固基地' },
  clock:   { label: '钟', color: '#E8B83A', name: '冻结敌军' }
};

/* ---------- 基地（金鹰）像素图 ---------- */
export const EAGLE = [
  ".......DD.......",
  "......DGGD......",
  ".....DGGGGD.....",
  "....DGGGGGGD....",
  "....DGWGGWGD....",
  "...DGGWGGWGGD...",
  "...DGGGGGGGGD...",
  "..DGGGGGGGGGGD..",
  "..DG..GGGG..GD..",
  ".DGG..GGGG..GGD.",
  ".DGGGGGGGGGGGGD.",
  ".DGGGGGGGGGGGGD.",
  "DGGGGGGGGGGGGGGD",
  "DGGGGGGGGGGGGGGD",
  "DDDDDDDDDDDDDDDD",
  "................"
];
