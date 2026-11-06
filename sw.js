/* Service worker — Assistant Pédagogique (mode hors ligne du site web).
   Principe : « réseau d'abord » pour l'application elle-même (on a toujours la version la plus récente
   quand il y a du réseau), copie en cache en secours hors ligne. Tout le reste (version.json, appels
   aux fournisseurs d'IA, Firebase, mises à jour signées) passe SANS jamais être intercepté. */
var CACHE = "apg-shell-v1";
var COQUILLE = ["./", "index.html", "manifest.json", "icon.svg", "icon-192.png", "icon-512.png"];

self.addEventListener("install", function (ev) {
  ev.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* Chaque fichier est ajouté séparément : l'absence de l'un d'eux n'empêche pas l'installation. */
      return Promise.all(COQUILLE.map(function (u) { return c.add(u).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (ev) {
  ev.waitUntil(
    caches.keys().then(function (noms) {
      return Promise.all(noms.filter(function (n) { return n !== CACHE; }).map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (ev) {
  var req = ev.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            /* autres sites : jamais interceptés */
  if (/version\.json$/.test(url.pathname)) return;             /* contrôle des mises à jour : toujours direct */
  var base = self.location.pathname.replace(/sw\.js$/, "");
  var relatif = url.pathname.indexOf(base) === 0 ? url.pathname.slice(base.length) : url.pathname;
  var estCoquille = req.mode === "navigate" || relatif === "" || COQUILLE.indexOf(relatif) !== -1;
  if (!estCoquille) return;
  ev.respondWith(
    fetch(req).then(function (rep) {
      if (rep && rep.ok) {
        var copie = rep.clone();
        caches.open(CACHE).then(function (c) { c.put(req.mode === "navigate" ? "index.html" : req, copie); }).catch(function () {});
      }
      return rep;
    }).catch(function () {
      return caches.match(req.mode === "navigate" ? "index.html" : req).then(function (r) {
        return r || caches.match("index.html");
      });
    })
  );
});
