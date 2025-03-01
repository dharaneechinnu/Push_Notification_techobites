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
};

// Get the student ID from the client
const getStudentId = async () => {
try {
  const clients = await self.clients.matchAll();
  if (clients && clients.length > 0) {
    // Try to get studentId from the client
    const message = await new Promise(resolve => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = event => resolve(event.data);
      clients[0].postMessage({ type: 'GET_STUDENT_ID' }, [messageChannel.port2]);
    });
    return message.studentId;
  }
  return null;
} catch (error) {
  console.error('Error getting studentId:', error);
  return null;
}
};

// Save subscription to server
const saveSubscription = async (subscription) => {
try {
  const studentId = await getStudentId();
  
  if (!studentId) {
    console.error('No student ID available for subscription');
    return { error: 'No student ID available' };
  }
  
  const response = await fetch('http://localhost:3500/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': "application/json" },
    body: JSON.stringify({ 
      studentId: studentId,
      subscription: subscription 
    })
  });

  return response.json();
} catch (error) {
  console.error('Error saving subscription:', error);
  return { error: error.message };
}
};

// Fetch the public key from the backend
const getPublicKey = async () => {
const response = await fetch('http://localhost:3500/vapidPublicKey');
const data = await response.json();
return data.publicKey;
};

self.addEventListener("install", event => {
console.log('Service Worker installed');
event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
console.log('Service Worker activated');
event.waitUntil(self.clients.claim());
});

// Listen for messages from the client
self.addEventListener('message', event => {
console.log('Service Worker received message:', event.data);

if (event.data && event.data.type === 'STORE_STUDENT_ID') {
  self.studentId = event.data.studentId;
  console.log('Stored studentId in service worker:', self.studentId);
  
  // If we have a port to respond on, confirm receipt
  if (event.ports && event.ports[0]) {
    event.ports[0].postMessage({ success: true });
  }
}
});

self.addEventListener("push", function (event) {
  console.log('Push received with data:', event.data);

  if (!event.data) {
      console.error('No push data received');
      return;
  }

  try {
      const data = event.data.json();  // Convert to JSON
      console.log("Parsed Push Data:", data);

      self.registration.showNotification(data.title, {
          body: data.message,
      });

  } catch (error) {
      console.error("Error parsing push notification data:", error);
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
      clients.openWindow(event.notification)
  );
});


self.addEventListener('notificationclick', event => {
console.log('Notification clicked:', event);

// Close the notification
event.notification.close();

// Handle the click action
if (event.action === 'open' || !event.action) {
  const urlToOpen = event.notification.data.url || self.location.origin;
  
  // Focus or open a window with the URL
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(windowClients => {
      // Check if there is already a window/tab open with the target URL
      const client = windowClients.find(c => 
        c.url === urlToOpen && 'focus' in c
      );
      
      // If so, focus it
      if (client) {
        return client.focus();
      }
      
      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
}
});