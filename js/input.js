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

  // 触屏：虚拟摇杆 + 开火按钮
  const touchPad = document.getElementById('touchPad');
  const joystick = document.getElementById('joystick');
  const stick = document.getElementById('stick');
  const fireBtn = document.getElementById('fireBtn');
  if (touchPad && window.matchMedia && matchMedia('(pointer: coarse)').matches) {
    touchPad.classList.add('visible');
  }

  if (fireBtn) {
    const on = ev => { ev.preventDefault(); keys.fire = true; fireBtn.classList.add('pressed'); initAudio(); fireBtn.setPointerCapture(ev.pointerId); };
    const off = ev => { ev.preventDefault(); keys.fire = false; fireBtn.classList.remove('pressed'); };
    fireBtn.addEventListener('pointerdown', on);
    fireBtn.addEventListener('pointerup', off);
    fireBtn.addEventListener('pointercancel', off);
    fireBtn.addEventListener('contextmenu', ev => ev.preventDefault());
  }

  if (joystick && stick) {
    const RADIUS = 36;   // 摇杆头最大偏移半径（px）
    const TH = 10;       // 方向触发死区（px）
    let jid = null, jcx = 0, jcy = 0;

    const setDirs = (dx, dy) => {
      keys.up = dy < -TH;
      keys.down = dy > TH;
      keys.left = dx < -TH;
      keys.right = dx > TH;
    };
    const place = (dx, dy) => {
      const len = Math.hypot(dx, dy);
      const cl = len > RADIUS ? RADIUS / len : 1;
      stick.style.transform = `translate(${dx * cl}px, ${dy * cl}px)`;
    };

    joystick.addEventListener('pointerdown', e => {
      e.preventDefault(); initAudio();
      jid = e.pointerId;
      joystick.setPointerCapture(e.pointerId);
      const r = joystick.getBoundingClientRect();
      jcx = r.left + r.width / 2;
      jcy = r.top + r.height / 2;
      const dx = e.clientX - jcx, dy = e.clientY - jcy;
      place(dx, dy); setDirs(dx, dy);
      joystick.classList.add('active');
    });
    joystick.addEventListener('pointermove', e => {
      if (jid === null || e.pointerId !== jid) return;
      const dx = e.clientX - jcx, dy = e.clientY - jcy;
      place(dx, dy); setDirs(dx, dy);
    });
    const endJoystick = e => {
      if (jid === null || e.pointerId !== jid) return;
      jid = null;
      keys.up = keys.down = keys.left = keys.right = false;
      stick.style.transform = 'translate(0, 0)';
      joystick.classList.remove('active');
    };
    joystick.addEventListener('pointerup', endJoystick);
    joystick.addEventListener('pointercancel', endJoystick);
  }
}
