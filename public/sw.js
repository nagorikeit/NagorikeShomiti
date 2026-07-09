// Progressive Web App Service Worker for Remix: নগরীক সমিতি
const CACHE_NAME = "nagarika-samity-v1";
const OFFLINE_URL = "/index.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([OFFLINE_URL]).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-first strategy to ensure real-time Firestore data and updates are never stale
self.addEventListener("fetch", (event) => {
  // Only handle GET requests and exclude Firestore/Authentication calls
  if (
    event.request.method !== "GET" ||
    event.request.url.includes("firestore.googleapis.com") ||
    event.request.url.includes("identitytoolkit.googleapis.com") ||
    event.request.url.includes("/api/")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If we get a valid response, return it
        if (response && response.status === 200) {
          return response;
        }
        return response;
      })
      .catch(() => {
        // Offline fallback
        return caches.match(OFFLINE_URL).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response("Offline mode active. Please connect to the internet.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        });
      })
  );
});
