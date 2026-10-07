const CACHE_NAME = "apg-cache-v2";
const PAGE_URL = "./index.html";
const PRECACHE_URLS = [
  PAGE_URL,
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => {
        console.warn("Service worker : précache incomplète —", err);
      })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  const estNavigation = request.mode === "navigate";
  const cleCache = estNavigation ? PAGE_URL : request;

  event.respondWith(
    (async () => {
      try {
        const reponseReseau = await fetch(request);
        if (reponseReseau && reponseReseau.ok) {
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(cleCache, reponseReseau.clone());
          } catch (e) {}
        }
        return reponseReseau;
      } catch (erreurReseau) {
        try {
          const cache = await caches.open(CACHE_NAME);
          const repliCache = await cache.match(cleCache);
          if (repliCache) return repliCache;
        } catch (e) {}
        throw erreurReseau;
      }
    })()
  );
});
