/* VALKR -- Abschaltung des oeffentlichen Offline-Caches.
   Die App ist seit 2026-09-13 nicht mehr oeffentlich. Wer sie frueher ueber GitHub Pages
   geoeffnet oder installiert hat, hat den alten Service Worker samt vollstaendiger
   App-Kopie im Browser -- der liefert sie weiter aus, auch wenn die Datei online fehlt.
   Browser pruefen beim naechsten Oeffnen, ob sich valkr-sw.js geaendert hat. Dann greift
   dieser Worker: alle Caches loeschen, sich selbst abmelden, offene Fenster neu laden.
   Danach kommt die Seite aus dem Netz -- und dort gibt es sie nicht mehr.
   Wird von scripts/publish-site.sh als Produkt/valkr-sw.js veroeffentlicht. */
self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll({ type: 'window', includeUncontrolled: true }); })
      .then(function (list) { list.forEach(function (c) { if ('navigate' in c) c.navigate(c.url); }); })
  );
});

/* Kein fetch-Handler: nichts mehr aus dem Cache ausliefern. */
