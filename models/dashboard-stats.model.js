const mongoose = require('mongoose');

const dashboardStatsSchema = new mongoose.Schema({
  period: {
    type: String,
    required: true,
    enum: ['daily', 'weekly', 'monthly', 'yearly']
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  stats: {
    serviceHistory: { type: Number, default: 0 },
    serviceReports: { type: Number, default: 0 },
    maintenanceHistory: { type: Number, default: 0 },
    tyreHistory: { type: Number, default: 0 },
    batteryHistory: { type: Number, default: 0 },
    equipment: { type: Number, default: 0 },
    stocks: { type: Number, default: 0 },
    toolkit: { type: Number, default: 0 },
    complaints: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  computedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for fast queries
dashboardStatsSchema.index({ period: 1, date: -1 });

module.exports = mongoose.model('DashboardStats', dashboardStatsSchema);