/* service worker：让页面断网也能打开，改了代码又不用折腾
   页面本身走「网络优先」——打开一次就是最新的，只有断网才用上一次的兜底；
   图标、清单这些不常变的走「先给缓存、后台更新」。
   原来页面也走缓存优先，结果改完代码关掉重开还是旧的，得靠清缓存才能看到新版 */
const CACHE = 'meals-v4';
const ASSETS = ['./', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* 逐个加，某一个失败不至于让整个安装挂掉 */
      return Promise.all(ASSETS.map(function (u) {
        return c.add(u).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* 页面：先问网络。拿到就顺手存一份；断网才回落到上一次的页面，
     这样早上急着看吃什么不会因为没网打不开 */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (r) {
        if (r && r.ok) {
          const cp = r.clone();
          caches.open(CACHE).then(function (c) { c.put('./', cp); }).catch(function () {});
        }
        return r;
      }).catch(function () {
        return caches.match('./').then(function (hit) {
          if (hit) return hit;
          return new Response('断网了，而且这台设备上还没存过页面。连上网打开一次就好。',
            { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      const fresh = fetch(req).then(function (r) {
        if (r && r.ok) {
          const cp = r.clone();
          caches.open(CACHE).then(function (c) { c.put(req, cp); }).catch(function () {});
        }
        return r;
      }).catch(function () { return hit; });

      if (hit) return hit;
      return fresh;
    })
  );
});
