// public/sw.js
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method === "GET") {
    try {
      const url = new URL(request.url);
      const isInventorySheetRead = url.pathname.includes("/rest/v1/building_inventory_sheet_view");

      if (isInventorySheetRead) {
        event.respondWith(
          fetch("/api/inventory-sheet-cache", { cache: "default" }).then((response) => {
            if (response.ok) return response;
            return fetch(request);
          }).catch(() => fetch(request)),
        );
        return;
      }
    } catch {}
  }

  event.respondWith(fetch(request));
});
