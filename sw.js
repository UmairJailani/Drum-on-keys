const CACHE = 'drumkit-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './sounds/crash.mp3',
  './sounds/kick-bass.mp3',
  './sounds/snare.mp3',
  './sounds/tom-1.mp3',
  './sounds/tom-2.mp3',
  './sounds/tom-3.mp3',
  './sounds/tom-4.mp3',
];

self.addEventListener('install', e =>
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  )
);

self.addEventListener('activate', e =>
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
);

self.addEventListener('fetch', e =>
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  )
);
