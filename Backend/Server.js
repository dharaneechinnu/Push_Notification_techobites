require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const webPush = require('web-push');

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

// VAPID Keys for Web Push Notifications
const vapidKeys = webPush.generateVAPIDKeys();
webPush.setVapidDetails('mailto:your-email@example.com', vapidKeys.publicKey, vapidKeys.privateKey);

// 🔹 Send VAPID Public Key to Frontend
app.get('/vapidPublicKey', (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/register', async (req, res) => {
    const { studentId, password } = req.body;
  
    if (!studentId || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }
  
    const hashedPassword = await bcrypt.hash(password, 10);
  
    try {
      // Ensure the studentId is unique
      const existingStudent = await Student.findOne({ studentId });
      if (existingStudent) {
        return res.status(400).json({ error: "Student ID already exists" });
      }
  
      const newStudent = new Student({ studentId, password: hashedPassword });
      await newStudent.save();
      res.status(201).json({ message: "Student registered successfully" });
    } catch (error) {
      console.log("Error registering student:", error);
      res.status(500).json({ error: "Error registering student" });
    }
  });
  
// 🔹 Student Login
app.post('/login', async (req, res) => {
    try {
        const { studentId, password } = req.body;

    const student = await Student.findOne({ studentId });
    if (!student) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ studentId }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: "Login successful", token });
    } catch (error) {
        console.log("errro",error)
        res.status(500).json({ error: "Error login student" });
    }
    
});

// 🔹 Student Push Notification Subscription
app.post('/subscribe', async (req, res) => {
    const { studentId, subscription } = req.body;

    if (!studentId || !subscription) return res.status(400).json({ error: "Missing studentId or subscription" });

    try {
        await Subscription.findOneAndUpdate({ studentId }, { subscription }, { upsert: true });
        res.status(200).json({ message: "Subscription successful" });
    } catch (error) {
        res.status(500).json({ error: "Error saving subscription" });
    }
});

// 🔹 Admin Send Notification
app.post('/sendNotification', async (req, res) => {
    const { studentIds, title, message } = req.body;

    if (!studentIds || !title || !message) {
        return res.status(400).json({ error: "All fields are required" });
    }

    const subscriptions = await Subscription.find({ studentId: { $in: studentIds } });

    if (!subscriptions.length) {
        return res.status(404).json({ error: "No subscriptions found" });
    }

    const payload = JSON.stringify({ title, message });

    subscriptions.forEach(sub => {
        webPush.sendNotification(sub.subscription, payload).catch(err => console.error("Push Error:", err));
    });

    res.status(200).json({ message: "Notifications sent successfully" });
});

// Start Server
app.listen(port, () => console.log(`🚀 Server running on http://localhost:${port}`));
