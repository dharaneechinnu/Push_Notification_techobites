import logo from '../src/Assets/logo.webp'

self.addEventListener('push', (event) => {
  if (event.data) {
      const data = event.data.json();
      console.log('Push event received:', data);

      self.registration.showNotification(data.title, {
          body: data.message,
          icon: {logo},
          badge: {logo},
          vibrate: [200, 100, 200],
          data: { url: data.url } // Open URL when clicked
      });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data.url || '/';
  event.waitUntil(
      clients.openWindow(urlToOpen)
  );
});
