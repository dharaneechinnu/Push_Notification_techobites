import ss from ''
// Convert the public key to Uint8Array
const urlBase64ToUint8Array = base64String => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

// Save the subscription to the backend
const saveSubscription = async (subscription) => {
  const response = await fetch('http://localhost:3500/save-subscription', {
      method: 'POST',
      headers: { 'Content-type': "application/json" },
      body: JSON.stringify(subscription)
  });

  return response.json();
}

// Fetch the public key from the backend
const getPublicKey = async () => {
  const response = await fetch('http://localhost:3500/vapidPublicKey');
  const data = await response.json();
  return data.publicKey; // Make sure the backend returns the public key in the `publicKey` field
}

self.addEventListener("install", (event) => {
  console.log('Service Worker installed');
  self.skipWaiting(); // Ensure the service worker takes control immediately
});

self.addEventListener("activate", async (event) => {
  console.log('Service Worker activated');

  try {
      // Fetch the public key from the backend
      const publicKey = await getPublicKey();
      console.log('Public Key:', publicKey);

      // Ensure the public key is valid before subscribing
      if (!publicKey) {
          throw new Error('Public key is missing from backend.');
      }

      // Subscribe the user to push notifications using the public key
      const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) // Use the fetched public key
      });

      // Save the subscription on the backend
      const response = await saveSubscription(subscription);
      console.log('Subscription saved:', response);
  } catch (err) {
      console.error("Failed to subscribe to push notifications:", err);
  }

  self.clients.claim(); // Take control of all clients immediately
});

self.addEventListener('push', function (event) {
  console.log('Push received:', event);

  // Default notification data
  let notificationData = {
      title: 'New Notification',
      message: 'You have a new notification'
  };

  try {
      // Attempt to parse the push notification data
      notificationData = event.data.json();
  } catch (e) {
      console.error('Error parsing push data:', e);
  }

  // Set title and options for the notification
  const title = notificationData.title || 'Notification';
  const options = {
      body: notificationData.message || 'You have a new notification',
      icon: '/notification.png', // Ensure this file exists in the public folder
      badge: '/badge.png', // Ensure this file exists in the public folder
      data: {
          url: self.location.origin // URL to redirect when the notification is clicked
      }
  };

  // Display the notification
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  console.log('Notification clicked:', event);

  // Close the notification
  event.notification.close();

  // Check if the notification has associated URL data
  if (event.notification.data && event.notification.data.url) {
      event.waitUntil(
          clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
              let client = null;

              // Find an open client (tab/window) to focus on
              for (let i = 0; i < clientList.length; i++) {
                  client = clientList[i];
                  if (client.url === event.notification.data.url && 'focus' in client) {
                      return client.focus();
                  }
              }

              // If no client is found, open a new window/tab with the URL
              if (clients.openWindow) {
                  return clients.openWindow(event.notification.data.url);
              }
          })
      );
  }
});
