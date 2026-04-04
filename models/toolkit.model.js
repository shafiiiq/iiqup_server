// models/toolkit.model.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const toolkitHistorySchema = new mongoose.Schema(
  {
    action:        { type: String, enum: ['added', 'updated', 'reduced', 'initial'] },
    previousStock: { type: Number, default: 0  },
    newStock:      { type: Number              },
    changeAmount:  { type: Number              },
    reason:        { type: String, default: '' },
    updatedBy:     { type: String, default: 'System' },
    person:        { type: String              },
    personId:      { type: String              },
    timestamp:     { type: Date, default: Date.now },
    assignedDate:  { type: Date, default: Date.now },
  },
  { _id: false },
);

const variantSchema = new mongoose.Schema(
  {
    // Attributes
    size:  { type: String, trim: true },
    color: { type: String, trim: true },

    // Stock
    stockCount:    { type: Number, min: 0, default: 0 },
    minStockLevel: { type: Number, min: 1, default: 5 },
    status:        { type: String, enum: ['available', 'low', 'out'], default: 'available' },
    inuse:         { type: Boolean, default: false },

    // Timestamps
    firstAddedDate:  { type: Date, default: Date.now },
    lastUpdatedDate: { type: Date, default: Date.now },

    // History
    stockHistory: { type: [toolkitHistorySchema], default: [] },
  },
  { _id: true },
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const toolkitSchema = new mongoose.Schema(
  {
    // Identity
    name: { type: String, trim: true, unique: true },
    type: { type: String, trim: true               },

    // Stock Summary
    totalStock:    { type: Number, default: 0 },
    overallStatus: { type: String, enum: ['available', 'low', 'out'], default: 'available' },

    // Variants
    variants: { type: [variantSchema], default: [] },
  },
  {
    timestamps: true,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────

toolkitSchema.pre('save', function (next) { 
  this.variants.forEach(variant => {
    if      (variant.stockCount <= 0)                    variant.status = 'out';
    else if (variant.stockCount < variant.minStockLevel) variant.status = 'low';
    else                                                 variant.status = 'available';
    variant.lastUpdatedDate = Date.now();
  });

  this.totalStock = this.variants.reduce((sum, v) => sum + v.stockCount, 0);

  if      (this.totalStock <= 0)                                    this.overallStatus = 'out';
  else if (this.variants.some(v => v.status === 'low'))             this.overallStatus = 'low';
  else                                                              this.overallStatus = 'available';

  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('Toolkit', toolkitSchema);