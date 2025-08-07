const mongoose = require('mongoose');

const Schema = mongoose.Schema;

// Define the stock history schema for tracking all stock changes
const StockHistorySchema = new Schema({
  action: {
    type: String,
    enum: ['added', 'updated', 'reduced', 'initial'],
  },
  previousStock: {
    type: Number,
    default: 0
  },
  newStock: {
    type: Number,
  },
  changeAmount: {
    type: Number,
  },
  reason: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: String,
    default: 'System'
  }
});

// Define the variant schema for different sizes/colors
const VariantSchema = new Schema({
  size: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    trim: true
  },
  stockCount: {
    type: Number,
    min: 0,
    default: 0
  },
  minStockLevel: {
    type: Number,
    min: 1,
    default: 5
  },
  status: {
    type: String,
    enum: ['available', 'low', 'out'],
    default: 'available'
  },
  inuse: {
    type: Boolean,
    default: false
  },
  firstAddedDate: {
    type: Date,
    default: Date.now
  },
  lastUpdatedDate: {
    type: Date,
    default: Date.now
  },
  stockHistory: [StockHistorySchema] // Track all stock changes
});

// Define the main toolkit schema
const ToolkitSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Equipment name is required'],
    trim: true,
    unique: true // Ensure unique names
  },
  type: {
    type: String,
    required: [true, 'Equipment type is required'],
    trim: true
  },
  variants: [VariantSchema], // Array of variants
  totalStock: {
    type: Number,
    default: 0
  },
  overallStatus: {
    type: String,
    enum: ['available', 'low', 'out'],
    default: 'available'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to update status based on stock levels
ToolkitSchema.pre('save', function (next) {
  // Calculate status for each variant
  this.variants.forEach(variant => {
    if (variant.stockCount <= 0) {
      variant.status = 'out';
    } else if (variant.stockCount < variant.minStockLevel) {
      variant.status = 'low';
    } else {
      variant.status = 'available';
    }
    
    // Update last updated date
    variant.lastUpdatedDate = Date.now();
  });

  // Calculate total stock
  this.totalStock = this.variants.reduce((total, variant) => total + variant.stockCount, 0);

  // Calculate overall status
  if (this.totalStock <= 0) {
    this.overallStatus = 'out';
  } else if (this.variants.some(variant => variant.status === 'low')) {
    this.overallStatus = 'low';
  } else {
    this.overallStatus = 'available';
  }

  // Update the updatedAt field
  this.updatedAt = Date.now();

  next();
});

// Create and export the model
const Toolkit = mongoose.model('Toolkit', ToolkitSchema);
module.exports = Toolkit;