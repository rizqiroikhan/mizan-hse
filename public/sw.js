const CACHE = 'mizan-shell-v6';
const APP_SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/app.js?v=3', '/db.js', '/icon.svg', '/manifest.webmanifest'];
const IMMUTABLE = new Set(['/icon.svg']);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => /^mizan-shell-v\\d+$/.test(key) && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname === '/sw.js' || url.pathname.startsWith('/api/')) return;
  const immutable = IMMUTABLE.has(url.pathname);
  event.respondWith(
    (immutable ? caches.match(event.request).then((cached) => cached || fetch(event.request)) : fetch(event.request))
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/').then((shell) => shell || Response.error()))),
  );
});
