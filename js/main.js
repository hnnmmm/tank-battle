'use strict';
/* ============================================================
 * main.js · 入口：装配各模块、绑定 UI、启动主循环
 * ============================================================ */
import { MAPS } from './config.js';
import { state } from './state.js';
import { buildMap } from './map.js';
import { update, togglePause, primaryAction } from './logic.js';
import { draw } from './render.js';
import { updateHUD, showOverlay, tickOverlay, syncMuteUI } from './hud.js';
import { toggleMute } from './audio.js';
import { initInput } from './input.js';

function setupUI() {
  document.getElementById('muteBtn').addEventListener('click', () => { toggleMute(); syncMuteUI(); });
  document.getElementById('startBtn').addEventListener('click', primaryAction);
  initInput({
    onPrimary: primaryAction,
    onPause: togglePause,
    onMute: () => { toggleMute(); syncMuteUI(); }
  });
  syncMuteUI();
}

/* ---------- 初始化 ---------- */
window.__state = state; // 调试用：暴露状态以便排查
buildMap(MAPS[0]);
state.player = null;
setupUI();
showOverlay('menu');
updateHUD();

/* ---------- 主循环 ---------- */
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  update(dt);
  draw();
  updateHUD();
  tickOverlay();
}
requestAnimationFrame(loop);