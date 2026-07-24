const CACHE_VERSION = 'v1';
const CACHE_STATIC = `me-static-${CACHE_VERSION}`;
const CACHE_IMAGES = `me-images-${CACHE_VERSION}`;
const CACHE_HTML = `me-html-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/static/index.html',
  '/static/offline.html',
  '/static/css/style.css',
  '/static/js/app.js',
  '/static/js/api.js',
  '/static/js/auth.js',
  '/static/js/ui.js',
  '/static/js/pwa.js',
  '/static/manifest.json',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
  '/static/icons/maskable-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith('me-') && 
              cacheName !== CACHE_STATIC && 
              cacheName !== CACHE_IMAGES && 
              cacheName !== CACHE_HTML) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. API Requests -> Network Only
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Images -> Stale While Revalidate
  if (event.request.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) {
    event.respondWith(
      caches.open(CACHE_IMAGES).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }).catch(() => null);
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 3. HTML / Navigation -> Network First
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request).then(async (networkResponse) => {
        const cache = await caches.open(CACHE_HTML);
        cache.put(event.request, networkResponse.clone());
        return networkResponse;
      }).catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;
        
        // Return offline page
        const offlineCache = await caches.open(CACHE_STATIC);
        return offlineCache.match('/static/offline.html');
      })
    );
    return;
  }

  // 4. Static Assets (CSS, JS, Fonts) -> Cache First
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(async (networkResponse) => {
        // Cache new static assets
        if (event.request.destination === 'style' || 
            event.request.destination === 'script' || 
            event.request.destination === 'font') {
          const cache = await caches.open(CACHE_STATIC);
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(() => {
         // ignore failure for missing static assets
         return new Response('', {status: 404});
      });
    })
  );
});