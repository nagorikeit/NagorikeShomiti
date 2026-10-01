// Progressive Web App Service Worker for আমার সমিতি
const CACHE_NAME = "amar-somiti-v5";
const OFFLINE_URL = "/index.html";
const PRECACHE_ASSETS = [
  OFFLINE_URL,
  "/manifest.json",
  "/app_icon.png",
  "/app_icon-192.png",
  "/app_icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("Pre-cache warning:", err);
      });
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

// Push notification support
self.addEventListener("push", (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || "আমার সমিতি থেকে নতুন নোটিফিকেশন",
      icon: "/app_icon-192.png",
      badge: "/app_icon-192.png",
      data: { url: data.url || "/" }
    };
    event.waitUntil(self.registration.showNotification(data.title || "আমার সমিতি", options));
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === "/" && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(event.notification.data?.url || "/");
      }
    })
  );
});

// High-performance caching strategy
self.addEventListener("fetch", (event) => {
  try {
    const url = new URL(event.request.url);

    // Only handle GET requests of the same origin
    if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
      return;
    }

    // Cache-first / Stale-While-Revalidate for immutable hashed assets
    if (url.pathname.startsWith("/assets/") || url.pathname.endsWith(".png") || url.pathname.endsWith(".jpg") || url.pathname.endsWith(".svg")) {
      event.respondWith(
        caches.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const resClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
            }
            return networkResponse;
          }).catch(() => cached);
          return cached || fetchPromise;
        })
      );
      return;
    }

    // Network-first strategy for HTML pages and dynamic shell
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const resClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return caches.match(OFFLINE_URL);
          });
        })
    );
  } catch (err) {
    console.error("Service worker fetch interception error:", err);
  }
});
