/* VALKR Service Worker.
   Zweck: die Zusage „works offline" im Access-Tab wahr machen. Bis hierher war
   das eine Werbeaussage ohne Technik dahinter.

   Strategie: Cache zuerst, Netz nebenher ("stale-while-revalidate").
   Die Antwort kommt sofort aus dem Cache, die frische Fassung wird im
   Hintergrund geholt und greift beim naechsten Start.
   Vorher war es umgekehrt -- Netz zuerst. Das ist zwar immer aktuell, aber
   jeder Start wartete erst auf eine Antwort aus dem Netz, obwohl die App
   vollstaendig lokal lag. Auf Mobilfunk waren das ein bis zwei Sekunden
   schwarzer Bildschirm bei jedem Oeffnen.
   Das alte Problem „haengt fuer immer auf einer alten Version" bleibt
   trotzdem geloest: der Cache-Name traegt die Version, beim Aktivieren
   fliegt alles Aeltere raus. */
var CACHE = 'valkr-v30.0';
var ASSETS = [
  './valkr-hub.html',
  './valkr-identity.html',
  './valkr-manifest.json',
  './valkr-icon.svg',
  './valkr-icon-180.png',
  './valkr-icon-192.png',
  './valkr-icon-512.png',
  './valkr-icon-mask.png'
];
/* Startbilder fuer iOS bewusst NICHT in ASSETS: neun Dateien, von denen jedes
   Geraet genau eine braucht. Sie beim Installieren alle vorzuladen kostet gut
   190 kB fuer 180 kB Ausschuss. Die eigene Datei kommt beim ersten Start ins
   Netz und liegt danach ueber die normale Regel unten im Cache. */

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

/* Klick auf einen Hinweis. data.view (von ntShow() gesetzt) sagt, welcher
   Bereich gemeint ist. Ist die App schon in einem Fenster offen, bekommt sie
   nur eine Nachricht und wird nach vorne geholt -- ein zweites Fenster waere
   verwirrend. War sie zu, oeffnet sich eines neu, die Adresse traegt das
   Ziel; app-seitig wertet das der Code beim Start aus. */
self.addEventListener('notificationclick', function (e) {
  var ziel = e.notification.data && e.notification.data.view;
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if ('focus' in c) {
          c.postMessage({view: ziel});
          return c.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(ziel ? './valkr-hub.html?view=' + ziel : './valkr-hub.html');
      }
    })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  /* Nur eigene Herkunft. Fremde Adressen gehen uns nichts an. */
  if (new URL(req.url).origin !== self.location.origin) return;

  /* Cache zuerst, Netz im Hintergrund ("stale-while-revalidate").
     Vorher wurde bei jedem Oeffnen erst das Netz abgewartet, obwohl die App
     vollstaendig im Cache lag -- auf Mobilfunk sind das schnell ein bis zwei
     Sekunden schwarzer Bildschirm. Das war der Grund, warum sich die App
     traege anfuehlte.
     Jetzt kommt die Antwort sofort aus dem Cache und die frische Fassung wird
     nebenher geholt; sie greift beim naechsten Start. Das alte Problem
     "haengt fuer immer auf einer alten Version" bleibt geloest, weil der
     Cache-Name die Version traegt und beim Aktivieren alles Aeltere fliegt. */
  /* ignoreSearch ist entscheidend: caches.match vergleicht sonst die volle
     Adresse samt "?parameter". Ein Aufruf wie valkr-hub.html?ref=tiktok
     verfehlt den Cache dann komplett und wartet erst den Netz-Fehlschlag ab
     -- gemessen 2,3 Sekunden, obwohl die Datei lokal liegt. Genau solche
     Adressen entstehen bei jedem Link aus einem sozialen Netzwerk. */
  e.respondWith(
    caches.match(req, {ignoreSearch: true}).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('./valkr-hub.html', {ignoreSearch: true});
        return Response.error();
      });
      return hit || net;
    })
  );
});
