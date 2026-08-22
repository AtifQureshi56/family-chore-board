/*
 * Minimal service worker.
 *
 * Its job is installability, not offline caching. This board is a live view of a
 * shared database: a cached page that quietly shows yesterday's chores is worse
 * than a page that plainly fails to load. So every navigation and every API call
 * goes to the network first, and the cache holds only the static shell assets
 * that cannot go stale.
 */
const VERSION = 'chore-board-v1';
const SHELL = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never touch anything that writes - server actions are POSTs.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Static icons may come from the cache; everything else is network-first so the
  // board is never silently stale.
  if (url.pathname.startsWith('/icons/')) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
    return;
  }

  event.respondWith(
    fetch(request).catch(() =>
      caches.match(request).then(
        (hit) =>
          hit ||
          new Response(
            '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
              '<body style="font-family:system-ui;text-align:center;padding:3rem">' +
              '<h1 style="font-size:2rem">No connection</h1>' +
              '<p style="color:#64748b;font-size:1.1rem">The chore board needs the internet. ' +
              'Check the wifi and try again.</p>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
          ),
      ),
    ),
  );
});
