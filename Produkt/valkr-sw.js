/* VALKR Service Worker.
   Zweck: die Zusage „works offline" im Access-Tab wahr machen. Bis hierher war
   das eine Werbeaussage ohne Technik dahinter.

   Strategie: Netz zuerst, Cache als Rueckfall.
   Online liefert immer die frische Datei und legt sie nebenbei in den Cache.
   Ohne Netz kommt die letzte gesehene Fassung. Damit gibt es kein
   „haengt fuer immer auf einer alten Version", der klassische Service-Worker-
   Fehler, den man hinterher nur noch mit Anleitung aus dem Browser bekommt.

   Der Cache-Name traegt die Hub-Version. Neue Version -> neuer Cache ->
   der alte wird beim Aktivieren geloescht. */
var CACHE = 'valkr-v9.9';
var ASSETS = [
  './valkr-hub.html',
  './valkr-identity.html',
  './valkr-manifest.json',
  './valkr-icon.svg',
  './valkr-icon-180.png',
  './valkr-icon-192.png',
  './valkr-icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      /* addAll bricht ab, sobald eine Datei fehlt -- deshalb einzeln, damit
         ein fehlendes Cover nicht die ganze Installation kippt. */
      .then(function (c) {
        return Promise.all(ASSETS.map(function (u) {
          return c.add(u).catch(function () { return null; });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  /* Nur eigene Herkunft. Fremde Adressen gehen uns nichts an. */
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        /* Navigation ohne Treffer: Hub ausliefern, sonst sieht der Nutzer
           die Dinosaurier-Seite obwohl die App im Cache liegt. */
        if (req.mode === 'navigate') return caches.match('./valkr-hub.html');
        return Response.error();
      });
    })
  );
});
