const mongoose = require('mongoose');

// Student Schema
const studentSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
});

const Student = mongoose.model('Student', studentSchema);
module.exports = Student;
