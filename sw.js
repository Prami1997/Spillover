// Spillover offline support.
// The page itself is fetched network-first, so an update you upload is live on the very next
// launch rather than the one after it. Icons, the manifest and fonts stay cache-first (they
// almost never change), and everything falls back to the cache when there is no network.
const CACHE = 'spillover-v4';   // v4: the icons and the manifest colours follow the new look
const SHELL = ['./', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-192.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  // cache: 'reload' so a new cache version really goes to the network for the shell. Without it
  // the browser may hand back its own copy of the very files we are trying to replace, which is
  // how a redrawn icon ends up cached as the old one all over again.
  // One entry at a time, not addAll: addAll is all-or-nothing, so a single missing or misspelt
  // file would fail the whole install and leave the old worker in charge of the app for good -
  // the one failure the user can neither see nor clear. The page has to be there; everything
  // else is best effort, and the fetch handler goes to the network for whatever is missing.
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const grab = u => cache.add(new Request(u, { cache: 'reload' }));
    await grab('./index.html');
    await Promise.all(SHELL.filter(u => u !== './index.html').map(u => grab(u).catch(() => {})));
    await self.skipWaiting();
  })());
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

  // Two things are the update surface and both go to the network first, so a deploy is live on
  // the next launch rather than the one after it. The page, because the game is one HTML file and
  // that file is the whole update. And the manifest, because it is what the launcher reads when
  // it decides what the installed app is called and which icon it wears - served from the cache
  // it would hand a phone the old name and the old icon long after they were replaced.
  // cache: 'no-store' keeps the browser's own HTTP cache from handing back the very copy we are
  // trying to replace.
  const samePage = url.origin === location.origin && /(^|\/)(index\.html)?$/.test(url.pathname);
  const isManifest = url.origin === location.origin && /\.webmanifest$/.test(url.pathname);
  if (req.mode === 'navigate' || samePage || isManifest){
    const key = isManifest ? req.url : './index.html';
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(req.url, { cache: 'no-store', credentials: 'same-origin' });
        if (fresh && fresh.ok){
          cache.put(key, fresh.clone());
          return fresh;
        }
        throw new Error('bad status ' + (fresh && fresh.status));
      } catch (err){
        return (await cache.match(req, { ignoreSearch: true })) ||
               (await cache.match(key)) ||
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
