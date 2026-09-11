// Spillover offline support.
// The page itself is fetched network-first, so an update you upload is live on the very next
// launch rather than the one after it. Icons, the manifest and fonts stay cache-first (they
// almost never change), and everything falls back to the cache when there is no network.
const CACHE = 'spillover-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !isFont) return;

  // The game is one HTML file, so that file is the whole update. Go to the network for it first
  // and fall back to the cache only when the network cannot answer. cache: 'no-store' keeps the
  // browser's own HTTP cache from handing back the copy we are trying to replace.
  const isShell = req.mode === 'navigate' ||
    (url.origin === location.origin && /(^|\/)(index\.html)?$/.test(url.pathname));
  if (isShell){
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(req.url, { cache: 'no-store', credentials: 'same-origin' });
        if (fresh && fresh.ok){
          cache.put('./index.html', fresh.clone());
          return fresh;
        }
        throw new Error('bad status ' + (fresh && fresh.status));
      } catch (err){
        return (await cache.match(req, { ignoreSearch: true })) ||
               (await cache.match('./index.html')) ||
               Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = (await cache.match(req, { ignoreSearch: true })) ||
                   (req.mode === 'navigate' ? await cache.match('./index.html') : undefined);
    const network = fetch(req)
      .then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; })
      .catch(() => cached);
    e.waitUntil(network.then(() => {}, () => {}));
    if (cached) return cached;
    // Offline with nothing cached: the fetch rejected and there is no fallback, so say so
    // properly instead of handing respondWith an undefined.
    return (await network) || Response.error();
  })());
});
