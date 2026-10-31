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
    data: { url: payload.url || "/transactions/new" },
    tag: payload.tag || "daily-reminder",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.url) || "/";
  const targetUrl = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const client = clients.find((c) => c.url.startsWith(self.location.origin));
      if (client) {
        // On ramène l'app au premier plan puis on ouvre la bonne page.
        // navigate() échoue si la fenêtre n'est pas encore contrôlée par ce
        // service worker : dans ce cas on ouvre une fenêtre neuve.
        await client.focus();
        try {
          await client.navigate(targetUrl);
          return;
        } catch (_e) {
          // on tente openWindow ci-dessous
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
    })()
  );
});
