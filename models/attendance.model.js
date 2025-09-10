const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  // Original system data
  originalId: {
    type: Number,
    required: true,
    unique: true
  },
  pin: {
    type: String,
    required: true
  },
  empName: {
    type: String,
    required: true
  },
  punchTime: {
    type: String,
    required: true
  },
  punchDateTime: {
    type: Date,
    required: true
  },
  state: {
    type: String,
    default: "255"
  },
  workCode: {
    type: String,
    default: "0"
  },
  photo: {
    type: String,
    default: ""
  },
  location: {
    type: String,
    default: "Auto add"
  },
  
  // Additional tracking fields
  punchType: {
    type: String,
    enum: ['IN', 'OUT', 'UNKNOWN'],
    default: 'UNKNOWN'
  },
  isProcessed: {
    type: Boolean,
    default: false
  },
  notificationSent: {
    type: Boolean,
    default: false
  },
  
  // Time tracking
  dateOnly: {
    type: String, // YYYY-MM-DD format
    required: true
  },
  timeOnly: {
    type: String, // HH:MM:SS format
    required: true
  },
  weekNumber: {
    type: Number,
    required: true
  },
  monthYear: {
    type: String, // YYYY-MM format
    required: true
  },
  year: {
    type: Number,
    required: true
  }
}, {
  timestamps: true // createdAt, updatedAt
});

// Indexes for efficient queries
attendanceSchema.index({ pin: 1, dateOnly: 1 });
attendanceSchema.index({ originalId: 1 });
attendanceSchema.index({ punchDateTime: -1 });
attendanceSchema.index({ dateOnly: 1 });
attendanceSchema.index({ monthYear: 1 });
attendanceSchema.index({ year: 1 });
attendanceSchema.index({ weekNumber: 1, year: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);