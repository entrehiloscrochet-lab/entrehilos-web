// Service Worker específico para Entre Hilos Admin
const CACHE_NAME = "eh-admin-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Pass-through de peticiones de red
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Recepción de Web Push en segundo plano (incluso con la APK/PWA cerrada)
self.addEventListener("push", (event) => {
  let payload = {
    title: "Entre Hilos Admin",
    body: "Tienes una nueva actualización en el panel.",
    url: "/admin",
    tag: "eh-admin-push",
    data: {},
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        title: parsed.title || payload.title,
        body: parsed.body || payload.body,
        url: parsed.url || "/admin",
        tag: parsed.tag || payload.tag,
        data: parsed.data || {},
      };
    } catch {
      const text = event.data.text();
      if (text) payload.body = text;
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/Favicon-EHC.png",
      badge: "/Favicon-EHC.png",
      tag: payload.tag,
      renotify: true,
      vibrate: [200, 100, 200],
      data: {
        url: payload.url,
        ...payload.data,
      },
    })
  );
});

// Manejo de clic en notificaciones del sistema
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/admin";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && client.url.includes("/admin") && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

