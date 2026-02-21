self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Always go to network (no cache)
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
