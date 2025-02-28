const express = require('express');
const bodyParser = require('body-parser');
const webPush = require('web-push');
const app = express();
const PORT = process.env.PORT || 3500;

app.use(bodyParser.json());

let subscriptions = [];

const vapidKeys = webPush.generateVAPIDKeys();

webPush.setVapidDetails(
  'mailto:dharaneedharanchinnusamy@gmail.com',  
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

app.post('/subscribe', (req, res) => {
  const subscription = req.body;

  if (!subscription || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
    return res.status(400).json({ error: 'Invalid subscription data' });
  }

  subscriptions.push(subscription);
  console.log('New subscription added:', subscription);

  res.status(201).json({ message: 'Subscription successful' });
});

app.post('/sendNotification', (req, res) => {
  const { studentIds, title, message } = req.body;

  if (!studentIds || !title || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const selectedSubscriptions = subscriptions.filter(sub => studentIds.includes(sub.studentId));

  if (selectedSubscriptions.length === 0) {
    return res.status(404).json({ error: 'No subscriptions found for the specified student IDs' });
  }

  const payload = JSON.stringify({ title, message });

  const notificationPromises = selectedSubscriptions.map(sub => {
    const pushOptions = {
      TTL: 60 * 60, 
      vapidDetails: {
        subject: 'mailto:your-email@example.com', 
        publicKey: vapidKeys.publicKey,
        privateKey: vapidKeys.privateKey,
      },
    };

    return webPush.sendNotification(sub, payload, pushOptions)
      .then(response => {
        console.log('Notification sent:', response);
      })
      .catch(err => {
        console.error('Error sending notification:', err);
      });
  });

  Promise.all(notificationPromises)
    .then(() => {
      res.status(200).json({ message: 'Notifications sent successfully!' });
    })
    .catch(err => {
      console.error('Error occurred during notification sending:', err);
      res.status(500).json({ error: 'An error occurred while sending notifications. Please try again later.' });
    });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
