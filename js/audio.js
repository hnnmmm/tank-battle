'use strict';
/* ============================================================
 * audio.js · Web Audio 程序合成音效
 * ============================================================ */
let audioCtx = null;
let muted = (function () { try { return localStorage.getItem('tb-muted') === '1'; } catch (e) { return false; } })();

export function isMuted() { return muted; }

export function initAudio() {
  if (muted) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { /* 无音频环境忽略 */ }
}

function beep(freq, dur, type, vol, slideTo) {
  if (muted || !audioCtx || audioCtx.state !== 'running') return;
  try {
    const t0 = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 30), t0 + dur);
    const v = vol || 0.22;
    g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  } catch (e) { /* ignore */ }
}

export const SOUND = {
  shoot:    () => beep(760, 0.07, 'square', 0.12, 420),
  brick:    () => beep(220, 0.05, 'square', 0.10, 140),
  steel:    () => beep(1400, 0.05, 'square', 0.08, 900),
  explode:  () => beep(200, 0.32, 'sawtooth', 0.25, 40),
  bigBang:  () => beep(160, 0.5, 'sawtooth', 0.30, 30),
  powerup:  () => { beep(523, 0.09, 'square', 0.16); setTimeout(() => beep(784, 0.14, 'square', 0.16), 90); },
  baseDown: () => beep(320, 0.9, 'sawtooth', 0.30, 40),
  levelOk:  () => { [392, 523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, 0.12, 'square', 0.16), i * 110)); },
  start:    () => { beep(440, 0.1, 'square', 0.16); setTimeout(() => beep(660, 0.16, 'square', 0.16), 110); }
};

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('tb-muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
  if (!muted) initAudio();
  return muted;
}
