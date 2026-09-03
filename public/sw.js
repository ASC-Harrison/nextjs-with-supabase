// public/sw.js
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text?.() || "A restock was requested." };
  }

  const title = data.title || "🔔 Restock Requested";
  const options = {
    body: data.body || "A restock request needs attention.",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: data.tag || "restock-request",
    renotify: true,
    data: { url: data.url || "/restock-requests" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification?.data?.url || "/restock-requests";
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
