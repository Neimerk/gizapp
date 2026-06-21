// BrasUX Push Notification Handler
// Importado pelo Service Worker gerado pelo vite-plugin-pwa

self.addEventListener("push", function (event) {
  if (!event.data) return;

  var data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: "BrasUX", body: event.data.text(), url: "/" };
  }

  var title   = data.title  || "BrasUX Shopping";
  var options = {
    body:    data.body   || "",
    icon:    "/logo-brasux.webp",
    badge:   "/logo-brasux.webp",
    vibrate: [200, 100, 200],
    tag:     data.tag    || "brasux-notification",
    renotify: true,
    data:    { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (windowClients) {
        for (var i = 0; i < windowClients.length; i++) {
          var client = windowClients[i];
          if (client.url === url && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
