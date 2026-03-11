const STATIC_CACHE = 'rpt-portal-static-v4';
const RUNTIME_CACHE = 'rpt-portal-runtime-v4';
const API_CACHE = 'rpt-portal-api-v4';

const STATIC_ASSETS = [
  '/',
  '/PWA',
  '/manifest.json',
  '/favicon.ico',
  '/icon512_rounded.png',
  '/icon512_maskable.png',
  '/offline.html'
];

const cacheResponse = async (cacheName, request, response) => {
  if (!response || response.status !== 200) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
};

const networkFirst = async (request, cacheName, fallbackUrl) => {
  try {
    const response = await fetch(request);
    if (fallbackUrl && request.mode === 'navigate' && response.status >= 500) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    await cacheResponse(cacheName, request, response);
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) return caches.match(fallbackUrl);
    throw error;
  }
};

const staleWhileRevalidate = async (request, cacheName) => {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      cacheResponse(cacheName, request, response);
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.map((cacheName) => {
        if (![STATIC_CACHE, RUNTIME_CACHE, API_CACHE].includes(cacheName)) {
          return caches.delete(cacheName);
        }
        return Promise.resolve();
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, STATIC_CACHE, '/offline.html'));
    return;
  }

  if (url.pathname.startsWith('/api/assessments')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (
    url.pathname.startsWith('/_next/') ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image'
  ) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
