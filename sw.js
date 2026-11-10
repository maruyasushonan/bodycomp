const CACHE = 'bodycomp-v99-sync-safe';
const OFFLINE_ASSETS = ['./', './index.html'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(OFFLINE_ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE && key.startsWith('bodycomp-')).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Supabase等の外部APIやPOSTは絶対にキャッシュ／HTMLフォールバックしない。
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) caches.open(CACHE).then(cache => cache.put('./index.html', response.clone())).catch(() => {});
        return response;
      }).catch(async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match('./index.html')) || Response.error();
      })
    );
    return;
  }

  // 同一オリジンの静的アセットだけをキャッシュする。JSON/APIリクエストには適用しない。
  event.respondWith(
    fetch(request).then(response => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
      }
      return response;
    }).catch(async () => (await caches.match(request)) || Response.error())
  );
});
