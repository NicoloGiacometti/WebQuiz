/* ══════════════════════════════════════════════════════════════
   Service worker — studio offline.
   Strategia: stale-while-revalidate sui file locali dell'app.
   • primo caricamento online  → mette in cache tutto
   • caricamenti successivi     → serve dalla cache (istantaneo)
                                  e aggiorna in background
   • offline                    → funziona comunque
   Quando modifichi index.html o i file delle domande, alza
   CACHE_VERSION: il vecchio contenuto viene buttato.
══════════════════════════════════════════════════════════════ */
var CACHE_VERSION = 'quiz-v5';

var PRECACHE = [
  './',
  './index.html',
  './editor.html',
  './manifest.json',
  './data/index.json',
  './data/antropologia.json',
  './data/psicologia.json',
  './data/storiapedagogia.json',
  './data/fondamenti-pedagogici.json',
  './games/memory.html',
  './games/bubblepop.html',
  './games/acquario.html',
  './games/sassocartaforbice.html',
  './games/stellecadenti.html'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function (c) {
      // addAll fallisce tutto se un file manca: li aggiungo uno a uno
      return Promise.all(PRECACHE.map(function (u) {
        return c.add(u).catch(function () { /* file assente: ignora */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_VERSION) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  // Solo risorse dello stesso origin: i font Google e altro passano diretti
  if (url.origin !== self.location.origin) return;

  /* I file delle domande vanno NETWORK-FIRST: dopo una modifica
     dall'editor devono comparire subito, non al giro dopo.
     Offline si ricade sulla copia in cache. */
  if (url.pathname.indexOf('/data/') !== -1) {
    e.respondWith(
      caches.open(CACHE_VERSION).then(function (cache) {
        return fetch(req).then(function (res) {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        }).catch(function () {
          return cache.match(req).then(function (c) { return c || Response.error(); });
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.match(req).then(function (cached) {
        var network = fetch(req).then(function (res) {
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(req, res.clone());
          }
          return res;
        }).catch(function () {
          // offline: se non c'è cache e stavamo navigando, torna la home
          return cached || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error());
        });
        return cached || network;
      });
    })
  );
});
