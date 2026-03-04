// models/fuel.model.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const fuelTransactionSchema = new mongoose.Schema(
  {
    // Account Details
    financialAccountNumber: { type: String, required: true, trim: true, uppercase: true },
    financialAccountName:   { type: String, required: true, trim: true, uppercase: true },
    customerName:           { type: String, required: true, trim: true                  },
    customerNumber:         { type: String, required: true, trim: true                  },

    // Beneficiary
    beneficiaryName:   { type: String, required: true, trim: true },
    beneficiaryNumber: { type: String, required: true, trim: true },

    // Transaction Details
    stationName:  { type: String, required: true, trim: true                  },
    licensePlate: { type: String, required: true, trim: true, uppercase: true },
    productName:  {
      type:      String,
      required:  true,
      trim:      true,
      uppercase: true,
      enum:      ['GOLD 95', 'GOLD 91', 'DIESEL', 'PREMIUM'],
    },

    // Dates
    transactionDate: { type: Date, required: true },
    invoiceMonth:    { type: Date, required: true },

    // Amounts
    unitPrice: {
      type:     Number,
      required: true,
      min:      0,
      validate: { validator: (v) => v > 0, message: 'Unit price must be greater than 0' },
    },
    liter: {
      type:     Number,
      required: true,
      min:      0,
      validate: { validator: (v) => v > 0, message: 'Liter amount must be greater than 0' },
    },
    totalLiter: { type: Number, required: true, min: 0 },
    totalAmount: {
      type:     Number,
      required: true,
      min:      0,
      validate: {
        validator: function (v) {
          return Math.abs(v - this.unitPrice * this.liter) < 0.01;
        },
        message: 'Total amount should equal unit price multiplied by liters',
      },
    },
    totalAmountSum: { type: Number, required: true, min: 0 },
    totalRows:      { type: Number, required: true, min: 1 },
  },
  {
    timestamps: true,
    collection: 'fuels',
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

// Single-field
fuelTransactionSchema.index({ financialAccountNumber: 1  });
fuelTransactionSchema.index({ customerNumber:         1  });
fuelTransactionSchema.index({ beneficiaryNumber:      1  });
fuelTransactionSchema.index({ stationName:            1  });
fuelTransactionSchema.index({ licensePlate:           1  });
fuelTransactionSchema.index({ transactionDate:        -1 });
fuelTransactionSchema.index({ invoiceMonth:           1  });

// Compound
fuelTransactionSchema.index({ transactionDate: -1, stationName:    1 });
fuelTransactionSchema.index({ customerNumber:   1, transactionDate: -1 });
fuelTransactionSchema.index({ licensePlate:     1, transactionDate: -1 });
fuelTransactionSchema.index({ invoiceMonth:     1, customerNumber:  1  });

// ─────────────────────────────────────────────────────────────────────────────
// Virtuals
// ─────────────────────────────────────────────────────────────────────────────

fuelTransactionSchema.virtual('formattedTransactionDate').get(function () {
  return this.transactionDate.toLocaleDateString('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
});

fuelTransactionSchema.virtual('calculatedTotal').get(function () {
  return parseFloat((this.unitPrice * this.liter).toFixed(2));
});

// ─────────────────────────────────────────────────────────────────────────────
// Instance Methods
// ─────────────────────────────────────────────────────────────────────────────

fuelTransactionSchema.methods.isRecent = function () {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return this.transactionDate >= thirtyDaysAgo;
};

// ─────────────────────────────────────────────────────────────────────────────
// Statics
// ─────────────────────────────────────────────────────────────────────────────

fuelTransactionSchema.statics.findByStation = function (stationName, startDate, endDate) {
  const query = { stationName: new RegExp(stationName, 'i') };

  if (startDate && endDate) {
    query.transactionDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  return this.find(query).sort({ transactionDate: -1 });
};

fuelTransactionSchema.statics.getMonthlyCustomerSummary = function (customerNumber, year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate   = new Date(year, month, 0, 23, 59, 59);

  return this.aggregate([
    { $match: { customerNumber, transactionDate: { $gte: startDate, $lte: endDate } } },
    {
      $group: {
        _id:              '$productName',
        totalLiters:      { $sum: '$liter'        },
        totalAmount:      { $sum: '$totalAmount'  },
        transactionCount: { $sum: 1               },
        avgUnitPrice:     { $avg: '$unitPrice'    },
      },
    },
  ]);
};

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────

fuelTransactionSchema.pre('save', function (next) {
  if (this.licensePlate)        this.licensePlate        = this.licensePlate.toString().trim().toUpperCase();
  if (this.financialAccountName) this.financialAccountName = this.financialAccountName.toString().trim().toUpperCase();
  if (this.productName)         this.productName         = this.productName.toString().trim().toUpperCase();
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('Fuels', fuelTransactionSchema);