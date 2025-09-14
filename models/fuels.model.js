const mongoose = require('mongoose');

// Define the fuel transaction schema
const fuelTransactionSchema = new mongoose.Schema({
  financialAccountNumber: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  financialAccountName: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  customerNumber: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  beneficiaryName: {
    type: String,
    required: true,
    trim: true
  },
  beneficiaryNumber: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  stationName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  productName: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    enum: ['GOLD 95', 'GOLD 91', 'DIESEL', 'PREMIUM'] // Add more fuel types as needed
  },
  licensePlate: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    index: true
  },
  transactionDate: {
    type: Date,
    required: true,
    index: true
  },
  invoiceMonth: {
    type: Date,
    required: true,
    index: true
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(v) {
        return v > 0;
      },
      message: 'Unit price must be greater than 0'
    }
  },
  liter: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(v) {
        return v > 0;
      },
      message: 'Liter amount must be greater than 0'
    }
  },
  totalLiter: {
    type: Number,
    required: true,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(v) {
        // Validate that totalAmount approximately equals unitPrice * liter
        const calculatedAmount = this.unitPrice * this.liter;
        return Math.abs(v - calculatedAmount) < 0.01; // Allow small floating point differences
      },
      message: 'Total amount should equal unit price multiplied by liters'
    }
  },
  totalAmountSum: {
    type: Number,
    required: true,
    min: 0
  },
  totalRows: {
    type: Number,
    required: true,
    min: 1
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
  collection: 'fuels'
});

// Create compound indexes for common queries
fuelTransactionSchema.index({ transactionDate: -1, stationName: 1 });
fuelTransactionSchema.index({ customerNumber: 1, transactionDate: -1 });
fuelTransactionSchema.index({ licensePlate: 1, transactionDate: -1 });
fuelTransactionSchema.index({ invoiceMonth: 1, customerNumber: 1 });

// Virtual for formatted transaction date
fuelTransactionSchema.virtual('formattedTransactionDate').get(function() {
  return this.transactionDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Virtual for total cost calculation verification
fuelTransactionSchema.virtual('calculatedTotal').get(function() {
  return parseFloat((this.unitPrice * this.liter).toFixed(2));
});

// Instance method to check if transaction is recent (within last 30 days)
fuelTransactionSchema.methods.isRecent = function() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return this.transactionDate >= thirtyDaysAgo;
};

// Static method to find transactions by station
fuelTransactionSchema.statics.findByStation = function(stationName, startDate, endDate) {
  const query = { stationName: new RegExp(stationName, 'i') };
  
  if (startDate && endDate) {
    query.transactionDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.find(query).sort({ transactionDate: -1 });
};

// Static method to get monthly summary by customer
fuelTransactionSchema.statics.getMonthlyCustomerSummary = function(customerNumber, year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  return this.aggregate([
    {
      $match: {
        customerNumber: customerNumber,
        transactionDate: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$productName',
        totalLiters: { $sum: '$liter' },
        totalAmount: { $sum: '$totalAmount' },
        transactionCount: { $sum: 1 },
        avgUnitPrice: { $avg: '$unitPrice' }
      }
    }
  ]);
};

// Pre-save middleware for data formatting
fuelTransactionSchema.pre('save', function(next) {
  // Ensure license plate is uppercase and trimmed
  if (this.licensePlate) {
    this.licensePlate = this.licensePlate.toString().trim().toUpperCase();
  }
  
  // Ensure account name is uppercase
  if (this.financialAccountName) {
    this.financialAccountName = this.financialAccountName.toString().trim().toUpperCase();
  }
  
  // Ensure product name is uppercase
  if (this.productName) {
    this.productName = this.productName.toString().trim().toUpperCase();
  }
  
  next();
});

// Create and export the model
const Fuels = mongoose.model('Fuels', fuelTransactionSchema);

module.exports = Fuels;