const mongoose = require('mongoose');

const mediaFileSchema = new mongoose.Schema({
  fileName: { type: String, required: false },
  originalName: { type: String, required: false },
  filePath: { type: String, required: false },
  fileSize: { type: Number, required: false },
  mimeType: { type: String, required: false },
  fieldName: { type: String, required: false },
  uploadDate: { type: Date, default: Date.now },
  type: { type: String, enum: ['photo', 'video'], required: false },
  url: { type: String, required: false },
  duration: { type: Number }, // Only for videos
});

const solutionFileSchema = new mongoose.Schema({
  fileName: { type: String, required: false },
  originalName: { type: String, required: false },
  filePath: { type: String, required: false },
  fileSize: { type: Number, required: false },
  mimeType: { type: String, required: false },
  fieldName: { type: String, required: false },
  uploadDate: { type: Date, default: Date.now },
  type: { type: String, enum: ['photo', 'video'], required: false },
  url: { type: String, required: false },
  duration: { type: Number }, // Only for videos
});

const complaintSchema = new mongoose.Schema({
  uniqueCode: { type: String, required: true },
  regNo: { type: String },
  brand: { type: String },
  machine: { type: String },
  mechanic: { type: String },
  name: { type: String },
  mediaFiles: [mediaFileSchema],
  solutions: [solutionFileSchema], // Add this line
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'resolved', 'rejected'],
    default: 'pending'
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Complaint = mongoose.model('Complaint', complaintSchema);

module.exports = Complaint;