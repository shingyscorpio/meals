/* service worker：让页面断网也能打开，第二次启动不用等网络
   策略是先给缓存、后台顺便更新（stale-while-revalidate）——
   早上急着看吃什么时，不用等网络转圈 */
const CACHE = 'meals-v3';
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
      return fresh.then(function (r) {
        return r || caches.match('./');
      });
    })
  );
});
