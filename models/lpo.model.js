const mongoose = require('mongoose');

const lpoSchema = new mongoose.Schema({
  lpoRef: {
    type: String,
    required: true,
    unique: true
  },
  date: {
    type: String,
    required: true
  },
  equipments: [{
    type: String,
    required: true
  }],
  workingHrs: {
    type: String,
  },
  runningKm: {
    type: String,
  },
  quoteNo: {
    type: String,
  },
  requestText: {
    type: String,
  },
  company: {
    vendor: {
      type: String,
      required: true
    },
    attention: {
      type: String,
      required: true
    },
    designation: {
      type: String,
      required: true
    }
  },
  items: [{
    id: {
      type: Number,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    unitPrice: {
      type: Number,
      required: true
    },
    totalPrice: {
      type: Number,
      required: true
    }
  }],
  totalAmount: {
    type: Number,
  },
  totalDiscountAmount: {
    type: Number,
  },
  termsAndConditions: {
    type: [String],
    default: [
      'Terms & Conditions',
      'Payment will be made within 90 days from the day of submission of invoice'
    ]
  },
  note: {
    type: String,
    default: 'The LPO copy should be submitted along with the invoice every month for the payment process.'
  },
  signatures: {
    accountsDept: {
      type: String,
      default: 'ROSHAN SHA'
    },
    purchasingManager: {
      type: String,
      default: 'ABDUL MALIK'
    },
    operationsManager: {
      type: String,
      default: 'SURESHKANTH'
    },
    authorizedSignatory: {
      type: String,
      default: 'AHAMMED KAMAL'
    },
    authorizedSignatoryTitle: {
      type: String,
      enum: ['CEO', 'MANAGING DIRECTOR'],
      default: 'CEO'
    }
  },
  lpoCounter: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

// Index for faster queries
lpoSchema.index({ lpoRef: 1 });
lpoSchema.index({ createdAt: -1 });

module.exports = mongoose.model('LPO', lpoSchema);