const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the ChecklistItem Schema
const ChecklistItemSchema = new Schema({
  id: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['✓', '✗', '--', ''], // Valid status values
    default: ''
  }
});

// Define the main ServiceReport Schema
const ServiceReportSchema = new Schema({
  serviceHrs: {
    type: String,
    required: true
  },
  regNo: {  // Change from equipmentNo to regNo since your data uses regNo
    type: String,
    required: true,
    index: true // Index for faster queries
  },
  nextServiceHrs: {
    type: String,
    required: true
  },
  machine: {
    type: String,
    required: true
  },
  mechanics: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true,
  },
  operatorName: {
    type: String,
    required: true
  },
  remarks: {
    type: String,
    default: ''
  },
  serviceType: {
    type: String,
  },
  checklistItems: [ChecklistItemSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create and export the model (this is what was missing)
module.exports = mongoose.model('ServiceReport', ServiceReportSchema);