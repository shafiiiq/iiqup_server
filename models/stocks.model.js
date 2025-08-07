const mongoose = require('mongoose');

// Stock Movement Schema for tracking individual transactions
const stockMovementSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  time: {
    type: String,
    required: true,
    default: () => new Date().toLocaleTimeString()
  },
  type: {
    type: String,
    required: true,
    enum: ['add', 'deduct', 'initial', 'adjustment'],
    default: 'add'
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  previousQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  newQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  equipmentName: {
    type: String,
    required: function () {
      return this.type === 'deduct';
    }
  },
  equipmentNumber: {
    type: String,
    required: function () {
      return this.type === 'deduct';
    }
  },
  mechanicName: {
    type: String,
    required: function () {
      return this.type === 'deduct';
    }
  },
  mechanicEmployeeId: {
    type: String,
    required: function () {
      return this.type === 'deduct';
    }
  },
  // Additional tracking information
  reason: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Assuming you have a User model
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  _id: true // Each movement gets its own ID
});

// Main Stock Schema
const stockSchema = new mongoose.Schema({
  // Basic stock information
  product: {
    type: String,
    required: true,
    trim: true
  },
  
  type: {
    type: String,
    trim: true
  },

  description: {
    type: String,
    trim: true
  },

  serialNumber: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },

  // Current stock information
  stockCount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },

  // Pricing information
  rate: {
    type: Number,
    required: true,
    min: 0
  },

  // Stock thresholds
  minThreshold: {
    type: Number,
    required: true,
    min: 0,
    default: 5
  },
  maxThreshold: {
    type: Number,
    required: true,
    min: 0,
    default: 100
  },

  // Unit of measurement
  unit: {
    type: String,
    required: true,
    default: 'pcs'
  },

  // Stock status (computed field)
  status: {
    type: String,
    enum: ['in_stock', 'low_stock', 'out_of_stock'],
    default: 'in_stock'
  },

  // Category and classification
  category: {
    type: String,
    trim: true
  },
  subCategory: {
    type: String,
    trim: true
  },

  equipments: {
    type: [String],  // Array of strings for equipment names
    default: []
  },
  // Location information
  location: {
    type: String,
    trim: true
  },
  warehouse: {
    type: String,
    trim: true
  },

  // Stock movements array - This tracks all stock changes
  movements: [stockMovementSchema],

  // Computed fields
  totalValue: {
    type: Number,
    default: 0
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },

  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better query performance
stockSchema.index({ product: 1 });
stockSchema.index({ serialNumber: 1 });
stockSchema.index({ status: 1 });
stockSchema.index({ category: 1, subCategory: 1 });
stockSchema.index({ equipmentId: 1 });
stockSchema.index({ 'movements.date': -1 });
stockSchema.index({ 'movements.equipmentId': 1 });
stockSchema.index({ 'movements.mechanicId': 1 });
stockSchema.index({ 'movements.type': 1 });

// Pre-save middleware to update computed fields
stockSchema.pre('save', function (next) {
  this.updatedAt = Date.now();

  // Update stock status based on current quantity
  if (this.stockCount === 0) {
    this.status = 'out_of_stock';
  } else if (this.stockCount <= this.minThreshold) {
    this.status = 'low_stock';
  } else {
    this.status = 'in_stock';
  }

  // Calculate total value
  this.totalValue = this.rate * this.stockCount;

  next();
});

// Static method to find stocks by status
stockSchema.statics.findByStatus = function (status) {
  return this.find({ status: status, isDeleted: false });
};

// Static method to find low stock items
stockSchema.statics.findLowStock = function () {
  return this.find({
    $or: [
      { status: 'low_stock' },
      { status: 'out_of_stock' }
    ],
    isDeleted: false
  });
};

// Static method to find stocks by equipment
stockSchema.statics.findByEquipment = function (equipmentId) {
  return this.find({
    'movements.equipmentId': equipmentId,
    isDeleted: false
  });
};

// Static method to get stock movements for a specific equipment
stockSchema.statics.getMovementsByEquipment = function (equipmentId) {
  return this.aggregate([
    { $match: { isDeleted: false } },
    { $unwind: '$movements' },
    { $match: { 'movements.equipmentId': new mongoose.Types.ObjectId(equipmentId) } },
    { $sort: { 'movements.date': -1 } },
    {
      $group: {
        _id: '$_id',
        product: { $first: '$product' },
        movements: { $push: '$movements' }
      }
    }
  ]);
};

// Static method to get stock movements for a specific mechanic
stockSchema.statics.getMovementsByMechanic = function (mechanicId) {
  return this.aggregate([
    { $match: { isDeleted: false } },
    { $unwind: '$movements' },
    { $match: { 'movements.mechanicId': new mongoose.Types.ObjectId(mechanicId) } },
    { $sort: { 'movements.date': -1 } },
    {
      $group: {
        _id: '$_id',
        product: { $first: '$product' },
        movements: { $push: '$movements' }
      }
    }
  ]);
};

// Instance method to add stock movement
stockSchema.methods.addMovement = function (movementData) {
  const previousQuantity = this.stockCount;
  const newQuantity = movementData.type === 'add'
    ? previousQuantity + movementData.quantity
    : previousQuantity - movementData.quantity;

  const movement = {
    ...movementData,
    previousQuantity,
    newQuantity: Math.max(0, newQuantity),
    date: movementData.date || new Date(),
    time: movementData.time || new Date().toLocaleTimeString()
  };

  this.movements.push(movement);
  this.stockCount = Math.max(0, newQuantity);

  return this.save();
};

// Instance method to get recent movements
stockSchema.methods.getRecentMovements = function (limit = 10) {
  return this.movements
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
};

// Instance method to get movements by type
stockSchema.methods.getMovementsByType = function (type) {
  return this.movements.filter(movement => movement.type === type);
};

// Instance method to calculate total deductions for an equipment
stockSchema.methods.getTotalDeductionsForEquipment = function (equipmentId) {
  return this.movements
    .filter(movement =>
      movement.type === 'deduct' &&
      movement.equipmentId &&
      movement.equipmentId.toString() === equipmentId.toString()
    )
    .reduce((total, movement) => total + movement.quantity, 0);
};

// Instance method to get total value
stockSchema.methods.getTotalValue = function () {
  return this.rate * this.stockCount;
};

// Virtual for stock age
stockSchema.virtual('age').get(function () {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24)); // Age in days
});

// Virtual for latest movement - FIXED: Added missing closing parenthesis
stockSchema.virtual('latestMovement').get(function () {
  if (this.movements.length === 0) return null;
  return this.movements.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
});

const Stock = mongoose.model('Stock', stockSchema);

module.exports = Stock;