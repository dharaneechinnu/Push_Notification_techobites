const mongoose = require('mongoose');

// Subscription Schema
const subscriptionSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
    unique: true, // Ensure that each student can only have one subscription
  },
  subscription: {
    type: Object,
    required: true, // Store the entire push subscription object
  },
  dateSubscribed: {
    type: Date,
    default: Date.now, // Store the date of subscription
  }
});

// Create the model for subscriptions
const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;
