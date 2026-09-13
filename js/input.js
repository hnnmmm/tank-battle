'use strict';
/* ============================================================
 * input.js · 键盘与触屏输入，映射到 keys & 高层回调
 * ============================================================ */
import { initAudio } from './audio.js';

// 当前按下的方向/开火状态
export const keys = { up: false, down: false, left: false, right: false, fire: false };

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'fire', KeyJ: 'fire'
};
const PREVENT = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

/**
 * 初始化输入。回调由 main.js 注入，避免模块间循环依赖。
 * @param {{onPrimary:Function, onPause:Function, onMute:Function}} handlers
 */
export function initInput(handlers) {
  window.addEventListener('keydown', e => {
    const k = KEYMAP[e.code];
    if (k) {
      keys[k] = true;
      if (PREVENT.includes(e.code)) e.preventDefault();
      initAudio();
    }
    if (e.code === 'Enter') { initAudio(); handlers.onPrimary(); }
    if (e.code === 'KeyP') handlers.onPause();
    if (e.code === 'KeyM') handlers.onMute();
  });

  window.addEventListener('keyup', e => {
    const k = KEYMAP[e.code];
    if (k) keys[k] = false;
  });

  // 触屏虚拟按键
  const touchPad = document.getElementById('touchPad');
  if (touchPad && window.matchMedia && matchMedia('(pointer: coarse)').matches) {
    touchPad.classList.add('visible');
  }
  if (touchPad) {
    const TOUCHMAP = { up: 'up', down: 'down', left: 'left', right: 'right', fire: 'fire' };
    for (const btn of touchPad.querySelectorAll('button')) {
      const k = TOUCHMAP[btn.getAttribute('data-k')];
      if (!k) continue;
      const on = ev => { ev.preventDefault(); keys[k] = true; btn.classList.add('pressed'); initAudio(); };
      const off = ev => { ev.preventDefault(); keys[k] = false; btn.classList.remove('pressed'); };
      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off);
      btn.addEventListener('pointerleave', off);
      btn.addEventListener('contextmenu', ev => ev.preventDefault());
    }
  }
}
