require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const webPush = require('web-push');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3500;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URL)
    .then(() => console.log("✅ MongoDB connected"))
    .catch(err => console.log("❌ MongoDB connection error:", err));

// Models
const Student = require('./Model/Student');
const Subscription = require('./Model/subcription');

// VAPID Keys for Web Push Notifications - Use persistent keys
let vapidKeys;
const vapidKeysPath = path.join(__dirname, 'vapid-keys.json');

// Try to load existing VAPID keys
try {
    if (fs.existsSync(vapidKeysPath)) {
        // Load existing keys
        const vapidKeysData = fs.readFileSync(vapidKeysPath);
        vapidKeys = JSON.parse(vapidKeysData);
        console.log("✅ VAPID keys loaded from file",vapidKeys);
    } else {
        // Generate new keys and save them
        vapidKeys = webPush.generateVAPIDKeys();
        fs.writeFileSync(vapidKeysPath, JSON.stringify(vapidKeys));
        console.log("✅ New VAPID keys generated and saved");
    }
} catch (error) {
    console.error("❌ Error managing VAPID keys:", error);
    vapidKeys = webPush.generateVAPIDKeys(); // Fallback to generate keys in memory
}

// Configure web-push with VAPID details
webPush.setVapidDetails(
    'mailto:your-email@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

// 🔹 Send VAPID Public Key to Frontend
app.get('/vapidPublicKey', (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
});

// 🔹 Student Registration
app.post('/register', async (req, res) => {
    const { studentId, password } = req.body;
    if (!studentId || !password) return res.status(400).json({ error: "All fields are required" });

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const newStudent = new Student({ studentId, password: hashedPassword });
        await newStudent.save();
        res.status(201).json({ message: "Student registered successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error registering student" });
    }
});

// 🔹 Student Login
app.post('/login', async (req, res) => {
    const { studentId, password } = req.body;

    const student = await Student.findOne({ studentId });
    if (!student) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ studentId }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: "Login successful", token });
});

// 🔹 Get All Students (for Admin panel)
app.get('/students', async (req, res) => {
    try {
        const students = await Student.find({}, { password: 0 }); // Exclude password
        res.json(students);
    } catch (error) {
        res.status(500).json({ error: "Error fetching students" });
    }
});

// 🔹 Student Push Notification Subscription
app.post('/subscribe', async (req, res) => {
    const { studentId, subscription } = req.body;

    if (!studentId || !subscription) return res.status(400).json({ error: "Missing studentId or subscription" });

    try {
        // Save or update subscription in the database
        await Subscription.findOneAndUpdate({ studentId }, { subscription }, { upsert: true });
        res.status(200).json({ message: "Subscription successful" });
    } catch (error) {
        res.status(500).json({ error: "Error saving subscription" });
    }
});

app.post('/sendNotification', async (req, res) => {
    const { studentIds, title, message } = req.body;

    // Validate input data
    if (!studentIds || !title || !message) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        // Fetch subscriptions for the students
        const subscriptions = await Subscription.find({ studentId: { $in: studentIds } });

        if (!subscriptions || subscriptions.length === 0) {
            return res.status(404).json({ error: "No subscriptions found for the provided students" });
        }

        const payload = JSON.stringify({ title, message });

        let successfulNotifications = 0;
        let failedNotifications = 0;

        // Send notifications to each subscription
        for (const sub of subscriptions) {
            try {
                // Attempt to send push notification
                await webPush.sendNotification(sub.subscription, payload);
                successfulNotifications++;
                console.log(`Notification sent to student ID: ${sub.studentId}`);
            } catch (err) {
                // Log the error for failed notification
                console.error(`Push Error for student ID: ${sub.studentId}:`, err);
                failedNotifications++;

                // Optional: Clean up expired subscriptions
                if (err instanceof webPush.WebPushError && err.statusCode === 410) {
                    // Remove expired subscription from DB
                    await Subscription.deleteOne({ studentId: sub.studentId });
                    console.log(`Expired subscription removed for student ID: ${sub.studentId}`);
                }
            }
        }

        // Respond with success/failure counts
        res.status(200).json({
            message: `Notifications sent: ${successfulNotifications}, Failed notifications: ${failedNotifications}`
        });

    } catch (error) {
        console.error("Error sending notifications:", error);
        res.status(500).json({ error: "An error occurred while sending notifications" });
    }
});

// Start Server
app.listen(port, () => console.log(`🚀 Server running on http://localhost:${port}`));
