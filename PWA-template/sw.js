/* Bitcoin PWA Template - Service Worker
 * - Precache app shell
 * - Cache-first for same-origin documents/scripts/styles/images
 * - Network-only for cross-origin (external APIs)
 * - Navigation fallback to index.html when offline
 */

const CACHE = 'btc-pwa-shell-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './main.js',
  './manifest.json',
  // Add icons here in future if you include them in ./icons/
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Non-GET: just pass-through
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Cross-origin: network-only (avoid caching sensitive or rate-limited responses)
  if (!sameOrigin) {
    event.respondWith(fetch(request).catch(() => new Response('Offline', { status: 503 })));
    return;
  }

  // Navigation requests: try network, fall back to cache, then to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(request);
        // Optionally update cache for HTML
        const cache = await caches.open(CACHE);
        cache.put(request, res.clone());
        return res;
      } catch (e) {
        const cache = await caches.open(CACHE);
        return (await cache.match(request)) || (await cache.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Static assets: cache-first
  const dest = request.destination;
  if (['script', 'style', 'image', 'font', 'document'].includes(dest)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const res = await fetch(request);
        // Only cache OK responses
        if (res && res.ok) cache.put(request, res.clone());
        return res;
      } catch (e) {
        // Fallback to cached index for document; otherwise error
        if (dest === 'document') return (await cache.match('./index.html')) || Response.error();
        return Response.error();
      }
    })());
    return;
  }

  // Default: network
  event.respondWith(fetch(request));
});
