'use strict';
/* ============================================================
 * hud.js · HUD 数值 / 覆盖层（菜单/暂停/通关/结束） / 静音 UI
 * ============================================================ */
import { state } from './state.js';
import { isMuted } from './audio.js';

const overlayEl = document.getElementById('overlay');
const ovTitle = overlayEl.querySelector('.ov-title');
const ovSub = overlayEl.querySelector('.ov-sub');
const ovScore = overlayEl.querySelector('.ov-score');
const startBtn = document.getElementById('startBtn');

function tankIconSVG(color, dark) {
  return '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">'
    + '<rect x="3" y="4" width="12" height="9" fill="' + color + '" stroke="#000" stroke-width="1"/>'
    + '<rect x="7" y="1" width="4" height="3" fill="' + color + '" stroke="#000" stroke-width="1"/>'
    + '<rect x="0" y="4" width="3" height="9" fill="' + dark + '"/>'
    + '<rect x="15" y="4" width="3" height="9" fill="' + dark + '"/>'
    + '</svg>';
}

export function updateHUD() {
  document.getElementById('score').textContent = String(state.score).padStart(6, '0');
  document.getElementById('hiScore').textContent = String(state.hi).padStart(6, '0');
  document.getElementById('level').textContent = state.level + 1;
  document.getElementById('enemies').textContent = state.enemiesLeft;

  const lr = document.getElementById('livesRow');
  lr.innerHTML = '';
  const showLives = Math.max(0, state.lives);
  for (let i = 0; i < showLives; i++) lr.insertAdjacentHTML('beforeend', tankIconSVG('#E8B83A', '#8a6d14'));

  const ei = document.getElementById('enemyIcons');
  ei.innerHTML = '';
  const n = Math.min(state.enemiesLeft, 20);
  for (let i = 0; i < n; i++) ei.insertAdjacentHTML('beforeend', tankIconSVG('#8f939c', '#4a4e57'));
  if (state.enemiesLeft > 20) {
    ei.insertAdjacentHTML('beforeend', '<span style="color:#7d8494;font-size:11px">×' + state.enemiesLeft + '</span>');
  }
}

export function showOverlay(mode) {
  overlayEl.classList.remove('hidden');
  startBtn.style.display = 'block';
  if (mode === 'menu') {
    ovTitle.textContent = '坦克大战';
    ovSub.innerHTML = '敌军坦克即将来袭。<br>守住中央<b>基地</b>（金鹰），击毁全部敌军即过关。<br>方向键 / <b>WASD</b> 移动 · 空格 / <b>J</b> 开火 · <b>P</b> 暂停 · <b>M</b> 静音';
    ovScore.textContent = state.hi > 0 ? '最高分 ' + String(state.hi).padStart(6, '0') : '';
    startBtn.textContent = '开 始 游 戏';
  } else if (mode === 'paused') {
    ovTitle.textContent = '暂 停';
    ovSub.innerHTML = '按 <b>P</b> 或点击下方按钮继续';
    ovScore.textContent = '';
    startBtn.textContent = '继 续';
  } else if (mode === 'levelclear') {
    ovTitle.textContent = '本 关 通 过';
    ovSub.innerHTML = '第 ' + (state.level + 1) + ' 关敌军已全部消灭';
    ovScore.textContent = '得分 ' + String(state.score).padStart(6, '0');
    startBtn.style.display = 'none';
  } else if (mode === 'gameover') {
    ovTitle.textContent = '游 戏 结 束';
    ovSub.innerHTML = '基地失守 / 生命耗尽。<br>得分 <b>' + String(state.score).padStart(6, '0') + '</b> · 最高分 <b>' + String(state.hi).padStart(6, '0') + '</b>';
    ovScore.textContent = '';
    startBtn.textContent = '再 来 一 局';
  }
}

export function hideOverlay() { overlayEl.classList.add('hidden'); }

// 根据 state.mode 变化自动切换覆盖层（由主循环每帧调用）
let lastMode = state.mode;
export function tickOverlay() {
  if (state.mode === lastMode) return;
  lastMode = state.mode;
  if (state.mode === 'menu' || state.mode === 'paused' || state.mode === 'levelclear' || state.mode === 'gameover') {
    showOverlay(state.mode);
  } else {
    hideOverlay();
  }
}

export function syncMuteUI() {
  const btn = document.getElementById('muteBtn');
  btn.textContent = isMuted() ? '音效：关' : '音效：开';
  btn.setAttribute('aria-pressed', String(isMuted()));
}