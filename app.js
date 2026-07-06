'use strict';

const PADS = [
  { id: 'crash', key: 'A', keyCode: 'a', label: 'Crash' },
  { id: 'hihat', key: 'S', keyCode: 's', label: 'Hi-Hat' },
  { id: 'openhat', key: 'D', keyCode: 'd', label: 'Open Hat' },
  { id: 'ride', key: 'F', keyCode: 'f', label: 'Ride' },
  { id: 'kick', key: 'J', keyCode: 'j', label: 'Kick' },
  { id: 'snare', key: 'K', keyCode: 'k', label: 'Snare' },
  { id: 'tom', key: 'L', keyCode: 'l', label: 'Tom' },
  { id: 'floor', key: ';', keyCode: ';', label: 'Floor' }
];

const STEP_MS = 700;

// Weighted so a Simon-says sequence reads like an actual drum groove instead
// of uniform noise: kick/snare/hihat form the rhythmic backbone and show up
// often, toms are occasional fills, crash/ride are rare accents. Never
// repeats the immediately previous hit, which is what made short random
// runs feel like a stutter instead of a groove.
const PAD_WEIGHTS = { kick: 3, snare: 3, hihat: 3, tom: 1.4, floor: 1.4, openhat: 1, ride: 1, crash: 0.6 };

const STATUS_TEXT = {
  idle: 'PRESS FOLLOW TO START',
  showing: 'WATCH...',
  listening: 'YOUR TURN',
  gameover: '✕ WRONG — TRY AGAIN'
};

const scene = document.querySelector('.scene');
const padGrid = document.querySelector('.pad-grid');
const screenRoundEl = document.querySelector('.screen-round-value');
const screenBestEl = document.querySelector('.screen-best-value');
const screenStatusEl = document.querySelector('.screen-status');
const playBtn = document.querySelector('.play-btn');

const keyMap = {};
PADS.forEach(p => { keyMap[p.keyCode] = p.id; });
keyMap[' '] = 'kick';
const held = {};

const state = { round: 0, best: 0, playing: false, phase: 'idle' };
let sequence = [];
let playerIndex = 0;

// ── DOM setup ────────────────────────────────────────────────
PADS.forEach(p => {
  const pad = document.createElement('div');
  pad.className = 'pad';
  pad.dataset.pad = p.id;
  pad.dataset.key = p.keyCode;
  pad.innerHTML =
    '<div class="pad-top">' +
      '<span class="pad-key">' + p.key + '</span>' +
      '<span class="pad-led"></span>' +
    '</div>' +
    '<div class="pad-circle-wrap">' +
      '<div class="pad-circle">' +
        '<div class="pad-noise"></div>' +
        '<div class="pad-glow"></div>' +
      '</div>' +
    '</div>' +
    '<div class="pad-label">' + p.label + '</div>';
  padGrid.appendChild(pad);
});

function accentColor() {
  return getComputedStyle(scene).getPropertyValue('--accent').trim() || '#34e2e8';
}

function render() {
  screenRoundEl.textContent = state.round;
  screenBestEl.textContent = state.best;
  screenStatusEl.textContent = STATUS_TEXT[state.phase] || '';
  screenStatusEl.classList.toggle('is-listening', state.phase === 'listening');
  screenStatusEl.classList.toggle('is-gameover', state.phase === 'gameover');
  playBtn.textContent = state.playing ? '■ STOP' : '▶ FOLLOW';
  playBtn.classList.toggle('is-playing', state.playing);
}

function setState(patch) {
  Object.assign(state, patch);
  render();
}

// ── Input ────────────────────────────────────────────────────
function onKey(e) {
  const k = e.key.toLowerCase();
  const id = keyMap[k];
  if (!id) return;
  e.preventDefault();
  if (held[k]) return;
  held[k] = true;
  hit(id, 'key');
  if (state.phase === 'listening') judgeSimon(id);
}
function onKeyUp(e) {
  const k = e.key.toLowerCase();
  if (k in held) held[k] = false;
}
function onPointer(e) {
  const t = e.target.closest('[data-pad]');
  if (!t) return;
  hit(t.dataset.pad, 'mouse');
  if (state.phase === 'listening') judgeSimon(t.dataset.pad);
}

function hit(id, src) {
  ensureAudio();
  playSound(id, src === 'key' ? 1 : 0.85);
  flash(id);
}

function flash(id) {
  const pad = scene.querySelector('[data-pad="' + id + '"]');
  if (!pad) return;
  const glow = pad.querySelector('.pad-glow');
  const zone = glow ? glow.parentElement : null;
  const led = pad.querySelector('.pad-led');
  const acc = accentColor();
  pad.style.transition = 'none';
  pad.style.transform = 'translateY(3px)';
  pad.style.boxShadow = '0 0 0 4px ' + acc + ', 0 0 30px 4px ' + acc + ', 0 10px 18px rgba(0,0,0,.55)';
  if (zone) { zone.style.transition = 'none'; zone.style.transform = 'scale(.94)'; }
  if (glow) { glow.style.transition = 'none'; glow.style.opacity = '1'; }
  if (led) { led.style.background = acc; led.style.boxShadow = '0 0 10px ' + acc + ', 0 0 0 1px rgba(0,0,0,.4)'; }
  void pad.offsetWidth; // force the browser to commit/paint the bright frame above before animating it away below
  requestAnimationFrame(() => {
    pad.style.transition = 'transform .18s cubic-bezier(.2,.8,.3,1), box-shadow .4s ease';
    pad.style.transform = 'translateY(0)';
    pad.style.boxShadow = '0 10px 18px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.09), inset 0 -14px 26px rgba(0,0,0,.5)';
    if (zone) { zone.style.transition = 'transform .18s cubic-bezier(.2,.8,.3,1)'; zone.style.transform = 'scale(1)'; }
    if (glow) { glow.style.opacity = '0'; }
    if (led) {
      led.style.background = 'color-mix(in srgb, ' + acc + ' 38%, #0a0c0f)';
      led.style.boxShadow = '0 0 0 1px rgba(0,0,0,.5)';
    }
  });
}

// ── Simon Says memory game ──────────────────────────────────
function togglePlay() { state.playing ? stopGame() : startGame(); }

function startGame() {
  ensureAudio();
  sequence = [];
  for (let i = 0; i < 3; i++) sequence.push(weightedPad());
  playerIndex = 0;
  setState({ playing: true, round: 3, phase: 'showing' });
  setTimeout(playSequence, 400);
}
function stopGame() {
  setState({ playing: false, phase: 'idle' });
}

function weightedPad() {
  const last = sequence.length ? sequence[sequence.length - 1] : null;
  const pool = PADS.filter(p => p.id !== last);
  const total = pool.reduce((sum, p) => sum + PAD_WEIGHTS[p.id], 0);
  let r = Math.random() * total;
  for (const p of pool) {
    r -= PAD_WEIGHTS[p.id];
    if (r <= 0) return p.id;
  }
  return pool[pool.length - 1].id;
}

function playSequence() {
  if (!state.playing) return;
  setState({ phase: 'showing' });
  sequence.forEach((id, i) => {
    setTimeout(() => { if (state.playing) hit(id, 'auto'); }, i * STEP_MS);
  });
  setTimeout(() => {
    if (!state.playing) return;
    playerIndex = 0;
    setState({ phase: 'listening' });
  }, sequence.length * STEP_MS + 250);
}

function judgeSimon(id) {
  if (id === sequence[playerIndex]) {
    playerIndex++;
    if (playerIndex >= sequence.length) {
      const completed = sequence.length;
      setState({ round: completed + 1, best: Math.max(state.best, completed), phase: 'showing' });
      sequence.push(weightedPad());
      setTimeout(playSequence, 700);
    }
  } else {
    setState({ playing: false, phase: 'gameover' });
  }
}

// ── Audio synthesis ─────────────────────────────────────────
let ctx, master, noise;

function ensureAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
    noise = makeNoise();
  }
  if (ctx.state === 'suspended') ctx.resume();
}
function makeNoise() {
  const len = Math.floor(ctx.sampleRate);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
function noiseSource() {
  const s = ctx.createBufferSource();
  s.buffer = noise;
  return s;
}
function env(node, t, peak, dur) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  node.connect(g);
  g.connect(master);
  return g;
}

function playSound(id, vel) {
  const t = ctx.currentTime;
  switch (id) {
    case 'kick': {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.12);
      env(o, t, 1.1 * vel, 0.42); o.start(t); o.stop(t + 0.45);
      const c = noiseSource(); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
      c.connect(hp); env(hp, t, 0.3 * vel, 0.03); c.start(t); c.stop(t + 0.04);
      break;
    }
    case 'snare': {
      const s = noiseSource(); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500;
      s.connect(hp); env(hp, t, 0.85 * vel, 0.2); s.start(t); s.stop(t + 0.22);
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(118, t + 0.1);
      env(o, t, 0.5 * vel, 0.12); o.start(t); o.stop(t + 0.13);
      break;
    }
    case 'hihat': {
      const s = noiseSource(); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 8200;
      s.connect(hp); env(hp, t, 0.4 * vel, 0.045); s.start(t); s.stop(t + 0.06);
      break;
    }
    case 'openhat': {
      const s = noiseSource(); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7200;
      s.connect(hp); env(hp, t, 0.4 * vel, 0.34); s.start(t); s.stop(t + 0.36);
      break;
    }
    case 'ride': {
      const s = noiseSource(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5400; bp.Q.value = 1.4;
      s.connect(bp); env(bp, t, 0.3 * vel, 0.5); s.start(t); s.stop(t + 0.52);
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 520;
      env(o, t, 0.12 * vel, 0.24); o.start(t); o.stop(t + 0.26);
      break;
    }
    case 'crash': {
      const s = noiseSource(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 4200; bp.Q.value = 0.5;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
      s.connect(bp); bp.connect(hp); env(hp, t, 0.5 * vel, 0.9); s.start(t); s.stop(t + 0.95);
      break;
    }
    case 'tom': return playTom(vel, 200, 0.36);
    case 'floor': return playTom(vel, 120, 0.46);
  }
}
function playTom(vel, f, dur) {
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.5, t + dur * 0.8);
  env(o, t, 0.9 * vel, dur); o.start(t); o.stop(t + dur + 0.02);
}

// ── Wire up ──────────────────────────────────────────────────
window.addEventListener('keydown', onKey);
window.addEventListener('keyup', onKeyUp);
scene.addEventListener('pointerdown', onPointer);
playBtn.addEventListener('click', togglePlay);
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
