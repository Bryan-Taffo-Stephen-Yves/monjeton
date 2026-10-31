// Gestion des notifications push de Mon Jeton.
//
// Ce fichier n'est PAS un service worker à part : il est chargé (importScripts)
// par le service worker principal /sw.js que génère vite-plugin-pwa au build.
// Avant, il s'appelait lui-même /sw.js et le build l'écrasait : les push
// arrivaient sur le téléphone mais rien ne les affichait.

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_e) {
    payload = { title: "Mon Jeton", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Mon Jeton";
  const options = {
    body: payload.body || "N'oublie pas de noter tes dépenses du jour.",
    icon: payload.icon || "/pwa-icon-192.png",
    badge: payload.badge || "/notification-badge-96.png",
    data: { url: payload.url || "/new-transaction" },
    tag: payload.tag || "daily-reminder",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
