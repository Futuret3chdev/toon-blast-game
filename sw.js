const CACHE = 'mte-pop-v12';
const ASSETS = [
  '/',
  '/index.html',
  '/auth/callback.html',
  '/css/style.css?v=12',
  '/js/config.js?v=12',
  '/js/oauth.js?v=12',
  '/js/auth.js?v=12',
  '/js/pwa.js?v=12',
  '/js/levels.js?v=12',
  '/js/audio.js?v=12',
  '/js/particles.js?v=12',
  '/js/board.js?v=12',
  '/js/game.js?v=12',
  '/manifest.json',
  '/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isScript = url.pathname.endsWith('.js');
  const isStyle = url.pathname.endsWith('.css');

  e.respondWith(
    (isScript || isStyle
      ? fetch(e.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(e.request, clone));
          }
          return res;
        }).catch(() => caches.match(e.request))
      : caches.match(e.request).then((cached) =>
          cached || fetch(e.request).then((res) => {
            if (res.ok && url.origin === self.location.origin) {
              const clone = res.clone();
              caches.open(CACHE).then((cache) => cache.put(e.request, clone));
            }
            return res;
          }).catch(() => cached)
        ))
  );
});