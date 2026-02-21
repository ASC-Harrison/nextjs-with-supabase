self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-first (no caching)
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
