// models/stock.model.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const stockMovementSchema = new mongoose.Schema(
  {
    // Timing
    date: { type: Date,   required: true, default: Date.now                        },
    time: { type: String, required: true, default: () => new Date().toLocaleTimeString() },

    // Movement
    type:             { type: String, required: true, enum: ['add', 'deduct', 'initial', 'adjustment'], default: 'add' },
    quantity:         { type: Number, required: true, min: 0 },
    previousQuantity: { type: Number, required: true, min: 0 },
    newQuantity:      { type: Number, required: true, min: 0 },

    // Deduction Context (required when type === 'deduct')
    equipmentName:      { type: String, required: function () { return this.type === 'deduct'; } },
    equipmentNumber:    { type: String, required: function () { return this.type === 'deduct'; } },
    mechanicName:       { type: String, required: function () { return this.type === 'deduct'; } },
    mechanicEmployeeId: { type: String, required: function () { return this.type === 'deduct'; } },

    // Notes
    reason:    { type: String, trim: true },
    notes:     { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true },
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const stockSchema = new mongoose.Schema(
  {
    // Identity
    product:      { type: String, required: true, trim: true },
    serialNumber: { type: String, required: true, trim: true, unique: true },
    type:         { type: String, trim: true },
    description:  { type: String, trim: true },
    category:     { type: String, trim: true },
    subCategory:  { type: String, trim: true },

    // Stock Levels
    stockCount:   { type: Number, required: true, min: 0, default: 0   },
    minThreshold: { type: Number, required: true, min: 0, default: 5   },
    maxThreshold: { type: Number, required: true, min: 0, default: 100 },
    totalValue:   { type: Number, default: 0                           },
    status:       { type: String, enum: ['in_stock', 'low_stock', 'out_of_stock'], default: 'in_stock' },

    // Pricing & Units
    rate: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, default: 'pcs' },

    // Location
    location:   { type: String, trim: true },
    warehouse:  { type: String, trim: true },
    equipments: { type: [String], default: [] },

    // Movements
    movements: { type: [stockMovementSchema], default: [] },

    // Soft Delete
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

stockSchema.index({ product:               1  });
stockSchema.index({ serialNumber:          1  });
stockSchema.index({ status:                1  });
stockSchema.index({ 'movements.date':      -1 });
stockSchema.index({ 'movements.type':      1  });
stockSchema.index({ 'movements.equipmentId': 1 });
stockSchema.index({ 'movements.mechanicId':  1 });
stockSchema.index({ category: 1, subCategory: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// Virtuals
// ─────────────────────────────────────────────────────────────────────────────

stockSchema.virtual('age').get(function () {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

stockSchema.virtual('latestMovement').get(function () {
  if (!this.movements.length) return null;
  return this.movements.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
});

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────

stockSchema.pre('save', function (next) {
  if      (this.stockCount === 0)                  this.status = 'out_of_stock';
  else if (this.stockCount <= this.minThreshold)   this.status = 'low_stock';
  else                                             this.status = 'in_stock';

  this.totalValue = this.rate * this.stockCount;
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Statics
// ─────────────────────────────────────────────────────────────────────────────

stockSchema.statics.findByStatus    = function (status)      { return this.find({ status, isDeleted: false }); };
stockSchema.statics.findByEquipment = function (equipmentId) { return this.find({ 'movements.equipmentId': equipmentId, isDeleted: false }); };

stockSchema.statics.findLowStock = function () {
  return this.find({ status: { $in: ['low_stock', 'out_of_stock'] }, isDeleted: false });
};

const movementsPipeline = (matchField, id) => [
  { $match: { isDeleted: false } },
  { $unwind: '$movements' },
  { $match: { [matchField]: new mongoose.Types.ObjectId(id) } },
  { $sort:  { 'movements.date': -1 } },
  { $group: { _id: '$_id', product: { $first: '$product' }, movements: { $push: '$movements' } } },
];

stockSchema.statics.getMovementsByEquipment = function (equipmentId) { return this.aggregate(movementsPipeline('movements.equipmentId', equipmentId)); };
stockSchema.statics.getMovementsByMechanic  = function (mechanicId)  { return this.aggregate(movementsPipeline('movements.mechanicId',  mechanicId));  };

// ─────────────────────────────────────────────────────────────────────────────
// Instance Methods
// ─────────────────────────────────────────────────────────────────────────────

stockSchema.methods.addMovement = function (movementData) {
  const previousQuantity = this.stockCount;
  const newQuantity      = movementData.type === 'add'
    ? previousQuantity + movementData.quantity
    : previousQuantity - movementData.quantity;

  this.movements.push({
    ...movementData,
    previousQuantity,
    newQuantity:  Math.max(0, newQuantity),
    date:         movementData.date || new Date(),
    time:         movementData.time || new Date().toLocaleTimeString(),
  });

  this.stockCount = Math.max(0, newQuantity);
  return this.save();
};

stockSchema.methods.getRecentMovements             = function (limit = 10)  { return this.movements.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, limit); };
stockSchema.methods.getMovementsByType             = function (type)         { return this.movements.filter(m => m.type === type); };
stockSchema.methods.getTotalValue                  = function ()             { return this.rate * this.stockCount; };
stockSchema.methods.getTotalDeductionsForEquipment = function (equipmentId)  {
  return this.movements
    .filter(m => m.type === 'deduct' && m.equipmentId?.toString() === equipmentId.toString())
    .reduce((total, m) => total + m.quantity, 0);
};

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('Stock', stockSchema);