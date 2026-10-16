// KargoHub Service Worker for Offline PWA Driver Support
const CACHE_NAME = "kargohub-v1";
const OFFLINE_URLS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg"
];

// Install: Cache core application shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old cache versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network first with Cache fallback for pages and assets
self.addEventListener("fetch", (event) => {
  // Ignore non-GET requests or chrome-extension URLs
  if (event.request.method !== "GET" || !event.request.url.startsWith("http")) {
    return;
  }

  // Bypass Firestore and external API calls from caching
  const url = new URL(event.request.url);
  if (
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("identitytoolkit.googleapis.com") ||
    url.hostname.includes("firebaseio.com")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache successful responses for next offline session
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Offline: attempt to retrieve from cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // If HTML navigation, return root app shell
        if (event.request.mode === "navigate") {
          const rootCached = await caches.match("/");
          if (rootCached) return rootCached;
        }

        return new Response("KargoHub Offline: Connection unavailable", {
          status: 503,
          headers: { "Content-Type": "text/plain" }
        });
      })
  );
});
