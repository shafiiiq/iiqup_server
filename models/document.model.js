const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  regNo: {
    type: String,
    required: true,
    trim: true
  },
  documentType: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  files: [{
    filename: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    mimetype: {
      type: String,
      required: true,
      default: 'application/octet-stream' // Fallback MIME type
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Optional: Add index for faster querying
DocumentSchema.index({ regNo: 1, documentType: 1 });

module.exports = mongoose.model('Document', DocumentSchema);