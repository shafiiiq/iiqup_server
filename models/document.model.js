const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  regNo: {
    type: String,
    trim: true
  },
  SourceId: {
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
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  files: [{
    date: {
      type: String,
    },
    expiry: {
      type: String,
    },
    filename: {
      type: String,
    },
    displayFileName: {
      type: String,
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
  }],
  documentSource: [{
    source: {
      type: String,
      enum: ['office-staff', 'mechanic', 'operator', 'equipment']
    },
    sourceId: {
      type: String,
    },
    sourceModel: {
      enum: ['Office Model', 'Mechanic Model', 'Opertor Model', 'Equipment Model']
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