/* Service Worker — Assistant Pédagogique
   Rôle : rendre l'application installable (PWA) et utilisable hors-ligne,
   sans jamais servir une page figée/obsolète qui pourrait faire planter
   l'application après une mise à jour.

   Stratégie volontairement simple et sûre :
   - La page principale (navigation) est TOUJOURS demandée sur le réseau
     en priorité ; le cache ne sert que de secours si le réseau est
     indisponible (mode avion, zone sans réseau).
   - Les autres fichiers (manifeste, icônes) sont mis en cache au premier
     chargement et resservis depuis le cache ensuite.
   - Le nom du cache change à chaque nouvelle version déployée, ce qui
     supprime automatiquement l'ancien cache : aucune version périmée ne
     peut rester coincée sur l'appareil d'un enseignant.
*/

const VERSION = "v1";
const CACHE_NAME = "assistant-pedagogique-" + VERSION;
const FICHIERS_A_METTRE_EN_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FICHIERS_A_METTRE_EN_CACHE).catch(() => {
        // Si un fichier manque, on ne bloque pas l'installation du SW pour autant.
      });
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((noms) => {
      return Promise.all(
        noms
          .filter((nom) => nom !== CACHE_NAME)
          .map((nom) => caches.delete(nom))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const requete = event.request;

  // Uniquement les requêtes GET du même site ; on laisse tout le reste
  // (appels aux API IA type Gemini, etc.) passer directement au réseau.
  if (requete.method !== "GET" || new URL(requete.url).origin !== self.location.origin) {
    return;
  }

  // Navigation (ouverture/rechargement de la page) : réseau en priorité,
  // secours sur le cache uniquement si le réseau échoue.
  if (requete.mode === "navigate") {
    event.respondWith(
      fetch(requete)
        .then((reponse) => {
          const copie = reponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(requete, copie));
          return reponse;
        })
        .catch(() => caches.match(requete).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // Autres fichiers statiques : cache en priorité, réseau en secours.
  event.respondWith(
    caches.match(requete).then((reponseEnCache) => {
      return (
        reponseEnCache ||
        fetch(requete).then((reponse) => {
          const copie = reponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(requete, copie));
          return reponse;
        })
      );
    })
  );
});
