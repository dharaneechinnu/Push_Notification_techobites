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
  
  // Save subscription to server
  const saveSubscription = async (subscription) => {
    const response = await fetch('http://localhost:3500/subscribe', {
        method: 'POST',
        headers: { 'Content-type': "application/json" },
        body: JSON.stringify({ subscription }) 
    });
  
    return response.json();
  }
  
  // Fetch the public key from the backend
  const getPublicKey = async () => {
    const response = await fetch('http://localhost:3500/vapidPublicKey');
    const data = await response.json();
    return data.publicKey;
  }
  
  self.addEventListener("install", event => {
    console.log('Service Worker installed');
    event.waitUntil(self.skipWaiting());
  });
  
  self.addEventListener("activate", event => {
    console.log('Service Worker activated');
    event.waitUntil(self.clients.claim());
  });
  
  // CRITICAL: This is the event that actually displays the notification
  self.addEventListener('push', event => {
    console.log('Push received with data:', event.data);
    
    if (!event.data) {
      console.warn('Push event has no data');
      return;
    }
    
    // Try to get the data in different formats
    let notificationData;
    
    try {
      notificationData = event.data.json();
      console.log('Successfully parsed JSON data:', notificationData);
    } catch (e) {
      console.log('Could not parse JSON, trying text:', e);
      const text = event.data.text();
      try {
        notificationData = JSON.parse(text);
      } catch (err) {
        console.log('Could not parse text as JSON either, using raw text');
        notificationData = {
          title: 'New Notification',
          message: text || 'You have a new notification'
        };
      }
    }
    
    const title = notificationData.title || 'Notification';
    const message = notificationData.message || notificationData.body || 'You have a new notification';
    
    const options = {
      body: message,
      icon: '/notification.png',
      badge: '/badge.png',
      vibrate: [100, 50, 100],
      requireInteraction: true,
      data: {
        url: notificationData.url || self.location.origin,
        dateOfArrival: Date.now(),
        primaryKey: Math.random().toString(36).substring(2)
      },
      actions: [
        {
          action: 'open',
          title: 'Open App'
        }
      ]
    };
    
    console.log('Preparing to show notification:', { title, options });
    
    // Use event.waitUntil to keep the service worker running until the notification is shown
    event.waitUntil(
      // This line actually creates and displays the Chrome notification
      self.registration.showNotification(title, options)
      .then(() => {
        console.log('✅ Notification shown successfully');
      })
      .catch(error => {
        console.error('❌ Error showing notification:', error);
      })
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