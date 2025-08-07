const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['leave', 'loan'],
    required: true
  },
  // Leave application fields
  startDate: {
    type: Date,
    required: function() {
      return this.type === 'leave' && this.leaveSubType !== 'monthly';
    }
  },
  endDate: {
    type: Date,
    required: function() {
      return this.type === 'leave' && this.leaveSubType === 'annual';
    }
  },
  reason: {
    type: String,
    required: function() {
      return this.type === 'leave';
    }
  },
  leaveType: {
    type: String,
    enum: ['paid', 'unpaid', 'sick', 'emergency'],
    required: function() {
      return this.type === 'leave';
    }
  },
  leaveSubType: {
    type: String,
    enum: ['annual', 'monthly'],
    required: function() {
      return this.type === 'leave' && this.leaveType === 'paid';
    }
  },
  leaveDays: {
    type: Number // Calculated number of leave days
  },
  // Loan application fields
  amount: {
    type: Number,
    required: function() {
      return this.type === 'loan';
    }
  },
  repaymentMonths: {
    type: Number,
    required: function() {
      return this.type === 'loan';
    }
  },
  purpose: {
    type: String,
    required: function() {
      return this.type === 'loan';
    }
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  // Additional tracking fields
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectedReason: {
    type: String
  },
  // Priority field for emergency leaves
  priority: {
    type: String,
    enum: ['normal', 'high', 'urgent'],
    default: function() {
      return this.leaveType === 'emergency' ? 'urgent' : 'normal';
    }
  },
  // Comments from admin/HR
  adminComments: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for better query performance
applicationSchema.index({ userId: 1, type: 1, status: 1 });
applicationSchema.index({ userId: 1, leaveType: 1, startDate: 1 });
applicationSchema.index({ status: 1, createdAt: -1 });

// Virtual to check if leave is current or upcoming
applicationSchema.virtual('isCurrentOrUpcoming').get(function() {
  if (this.type !== 'leave') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(this.endDate || this.startDate) >= today;
});

// Pre-save middleware to set priority based on leave type
applicationSchema.pre('save', function(next) {
  if (this.type === 'leave') {
    if (this.leaveType === 'emergency') {
      this.priority = 'urgent';
    }
    
    // Calculate leave days
    if (this.leaveSubType === 'annual' && this.startDate && this.endDate) {
      this.leaveDays = calculateLeaveDays(this.startDate, this.endDate);
    } else if (this.leaveSubType === 'monthly' && this.startDate) {
      this.leaveDays = 1; // Monthly leave is always 1 day
      this.endDate = this.startDate; // Set end date same as start date
    }
  }
  next();
});

// Helper function to calculate leave days between two dates
function calculateLeaveDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const timeDiff = end.getTime() - start.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both dates
}

module.exports = mongoose.model('Application', applicationSchema);