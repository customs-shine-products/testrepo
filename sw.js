/* ═══════════════════════════════════════════════════
   FORGE Service Worker — offline-first cache strategy
═══════════════════════════════════════════════════ */
const CACHE_NAME = 'forge-v7';
const STATIC_ASSETS = [
  './forge.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

/* External CDN assets to cache on first fetch */
const CDN_PREFETCH = [
  'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=Crimson+Pro:ital,wght@0,400;0,500;1,400&family=Fira+Code:wght@400;500&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.5.1/mammoth.browser.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
];

/* ── Install: cache static shell ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[FORGE SW] Caching app shell');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

/* ── Activate: clean old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Fetch: network-first for API calls, cache-first for assets ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept Gemini API calls — always go to network
  if (url.hostname.includes('generativelanguage.googleapis.com')) {
    return;
  }

  // For everything else: try cache first, fall back to network and cache result
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful GET responses (not opaque for CDN fonts/scripts)
        if (
          response.ok &&
          event.request.method === 'GET' &&
          (url.hostname === self.location.hostname ||
           CDN_PREFETCH.some(u => event.request.url.startsWith(u.split('?')[0])))
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback: return cached forge.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./forge.html');
        }
      });
    })
  );
});
