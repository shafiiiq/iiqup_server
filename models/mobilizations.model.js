const mongoose = require('mongoose');

const mobilizationSchema = new mongoose.Schema({
  equipmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Equipments',
    required: true
  },
  regNo: {
    type: String,
    required: true
  },
  machine: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: ['mobilized', 'demobilized', 'status_changed']  // ✅ ADD status_changed
  },
  previousStatus: {
    type: String,
    enum: ['active', 'idle', 'maintenance', 'loading', 'going']
  },
  newStatus: {
    type: String,
    enum: ['active', 'idle', 'maintenance', 'loading', 'going']
  },
  site: {
    type: String,
    required: function () {
      return this.action === 'mobilized';
    }
  },
  operator: {
    type: String,
    required: function () {
      return this.action === 'mobilized' && this.withOperator === true;
    }
  },
  withOperator: {
    type: Boolean,
    required: true,
    default: false
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  time: {
    type: String,
    required: true
  },
  remarks: {
    type: String,
    default: ""
  },
  status: {
    type: String,
    required: true,
    enum: ['active', 'idle', 'maintenance', 'loading', 'going'],
    default: function () {
      return this.action === 'mobilized' ? 'active' : 'idle';
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
mobilizationSchema.index({ equipmentId: 1 });
mobilizationSchema.index({ regNo: 1 });
mobilizationSchema.index({ action: 1 });
mobilizationSchema.index({ site: 1 });
mobilizationSchema.index({ status: 1 });
mobilizationSchema.index({ date: -1 });
mobilizationSchema.index({ year: -1, month: -1 });

// Compound index for common queries
mobilizationSchema.index({ equipmentId: 1, action: 1, date: -1 });
mobilizationSchema.index({ site: 1, status: 1 });

// Create the model
module.exports = mongoose.model('Mobilization', mobilizationSchema);