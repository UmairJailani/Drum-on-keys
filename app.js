'use strict';

// ── Audio ──────────────────────────────────────────────────
const SOUNDS = {};
['crash', 'kick-bass', 'snare', 'tom-1', 'tom-2', 'tom-3', 'tom-4'].forEach(name => {
  SOUNDS[name] = new Audio(`sounds/${name}.mp3`);
});

function playSound(name) {
  const a = SOUNDS[name];
  if (!a) return;
  a.currentTime = 0;
  a.play().catch(() => {});
}

// ── Hit ────────────────────────────────────────────────────
const HIT_MS = 110;

function hitPad(pad) {
  playSound(pad.dataset.sound);

  pad.classList.remove('hit');
  void pad.offsetWidth; // force reflow so animation restarts on rapid hits
  pad.classList.add('hit');

  clearTimeout(pad._t);
  pad._t = setTimeout(() => pad.classList.remove('hit'), HIT_MS);
}

// ── Keyboard ───────────────────────────────────────────────
const keyMap = {};
document.querySelectorAll('.pad').forEach(p => { keyMap[p.dataset.key] = p; });

document.addEventListener('keydown', e => {
  if (e.repeat) return;
  const pad = keyMap[e.key.toLowerCase()];
  if (pad) hitPad(pad);
});

// ── Pointer events (mouse + stylus + multi-touch) ──────────
// setPointerCapture lets each finger own its pad independently
document.querySelectorAll('.pad').forEach(pad => {
  pad.addEventListener('pointerdown', e => {
    e.preventDefault();
    pad.setPointerCapture(e.pointerId);
    hitPad(pad);
  }, { passive: false });
});

// ── Service worker ─────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ── PWA install prompt ─────────────────────────────────────
let deferredPrompt = null;
const installBtn = document.getElementById('install-btn');

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});

installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.hidden = true;
});

window.addEventListener('appinstalled', () => { installBtn.hidden = true; });
