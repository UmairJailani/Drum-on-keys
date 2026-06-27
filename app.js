'use strict';

const sounds = {
  w: new Audio('sounds/tom-1.mp3'),
  a: new Audio('sounds/tom-2.mp3'),
  s: new Audio('sounds/tom-3.mp3'),
  d: new Audio('sounds/tom-4.mp3'),
  j: new Audio('sounds/snare.mp3'),
  k: new Audio('sounds/crash.mp3'),
  l: new Audio('sounds/kick-bass.mp3'),
};

const pieces = document.querySelectorAll('.piece:not(.deco)');

const keyMap = {};
pieces.forEach(p => { keyMap[p.dataset.key] = p; });

function hit(piece) {
  const sound = sounds[piece.dataset.key];
  if (!sound) return;

  sound.currentTime = 0;
  sound.play().catch(() => {});

  // Reset animation by removing class, force reflow, re-add
  piece.classList.remove('hit');
  void piece.offsetWidth;
  piece.classList.add('hit');

  // Remove after animation completes
  const dur = piece.dataset.type === 'cymbal' ? 520 : 200;
  setTimeout(() => piece.classList.remove('hit'), dur);
}

pieces.forEach(p => {
  p.addEventListener('mousedown', () => hit(p));
  p.addEventListener('touchstart', e => { e.preventDefault(); hit(p); }, { passive: false });
});

document.addEventListener('keydown', e => {
  if (e.repeat) return;
  const p = keyMap[e.key.toLowerCase()];
  if (p) hit(p);
});
