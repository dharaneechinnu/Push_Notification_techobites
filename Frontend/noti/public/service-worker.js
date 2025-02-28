// service-worker.js
self.addEventListener('push', function(event) {
    if (event.data) {
      const data = event.data.json();
      const options = {
        body: data.message,
        icon: '/notification-icon.png', // Add an icon file to your public directory
        badge: '/badge-icon.png',       // Add a badge icon file to your public directory
        vibrate: [100, 50, 100],
        data: {
          dateOfArrival: Date.now(),
          primaryKey: '1'
        },
        actions: [
          {
            action: 'view',
            title: 'View'
          }
        ]
      };
  
      event.waitUntil(
        self.registration.showNotification(data.title, options)
      );
    }
  });
  
  self.addEventListener('notificationclick', function(event) {
    event.notification.close();
  
    if (event.action === 'view') {
      // Open a specific page when the "View" action is clicked
      clients.openWindow('/dashboard');
    } else {
      // Default action when the notification itself is clicked
      clients.openWindow('/');
    }
  });