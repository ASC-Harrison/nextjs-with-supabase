self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-first (no caching). This avoids “home screen uses old code”.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
