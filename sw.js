/*
 * Service worker — Assistant Pédagogique (Registre d'appel)
 *
 * Stratégie volontairement simple, adaptée à une appli en un seul fichier
 * HTML mise à jour régulièrement :
 *  - index.html : toujours tenté en réseau d'abord (pour avoir la dernière
 *    version dès qu'il y a du réseau), avec repli sur la version en cache
 *    si hors-ligne. Pas besoin de changer CACHE_NAME à chaque mise à jour.
 *  - manifest.json + icônes : cache d'abord (changent rarement), avec
 *    repli réseau si absents du cache.
 *  - Tout le reste (API, Firebase, etc.) : laissé au réseau, jamais mis en
 *    cache par ce service worker.
 */

const CACHE_NAME = "apg-cache-v1";
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function estPageHTML(request) {
  return (
    request.mode === "navigate" ||
    (request.method === "GET" &&
      request.headers.get("accept") &&
      request.headers.get("accept").includes("text/html"))
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // ne touche pas Firebase/API externes

  // Page principale : réseau d'abord, repli sur le cache hors-ligne.
  if (estPageHTML(request)) {
    event.respondWith(
      fetch(request)
        .then((reponse) => {
          const copie = reponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copie));
          return reponse;
        })
        .catch(() =>
          caches.match(request).then((reponse) => reponse || caches.match("./index.html"))
        )
    );
    return;
  }

  // Manifest, icônes, autres fichiers statiques du même site : cache d'abord.
  event.respondWith(
    caches.match(request).then((reponse) => {
      if (reponse) return reponse;
      return fetch(request).then((reponseReseau) => {
        const copie = reponseReseau.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copie));
        return reponseReseau;
      });
    })
  );
});
