// Rainwatch offline worker.
// Keeps the app itself (page, icons, manifest) on the phone so it opens without signal.
// Weather data is never cached here; the app saves its own last forecast.
const VERSION = 'rainwatch-v4';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './icon-maskable-512.png', './apple-touch-icon.png', './favicon.png', './badge-96.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // Cache each file on its own so one missing file does not block installation.
    await Promise.all(SHELL.map(url => fetch(url, { cache: 'no-cache' })
      .then(res => res.ok ? cache.put(url, res) : null).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            // forecasts, maps and fonts go straight to the network

  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    // The page: always try for the newest version, fall back to the saved copy offline.
    event.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res.ok) (await caches.open(VERSION)).put('./index.html', res.clone());
        return res;
      } catch (e) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }
  // Icons and manifest: saved copy first.
  event.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req)));
});

// Tapping a rain alert opens (or focuses) Rainwatch.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const scope = self.registration.scope;
    const open = all.find(c => c.url.startsWith(scope));
    if (open) return open.focus();
    return self.clients.openWindow(scope);
  })());
});
