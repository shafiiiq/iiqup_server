// models/equipment.model.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const certificationBodySchema = new mongoose.Schema(
  {
    operatorName: { type: String, default: 'Not Assigned' },
    operatorId:   { type: String, default: 'Not Assigned' },
    assignedAt:   { type: Date,   default: Date.now        },
  },
  { _id: false },
);

const rentRateSchema = new mongoose.Schema(
  {
    basis:    { type: String, enum: ['daily', 'hourly', 'monthly'], default: 'daily' },
    rate:     { type: Number, default: 0 },
    currency: { type: String, default: 'QAR' },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const equipmentSchema = new mongoose.Schema(
  {
    // Identity
    id:     { type: Number, required: true, unique: true },
    machine: { type: String, required: true               },
    regNo:   { type: String, required: true               },
    brand:   { type: String, required: true               },
    year:    { type: Number, required: true               },
    company: { type: String, required: true, default: 'ATE' },

    // Certification & Compliance
    coc:               { type: String, default: '' },
    istimaraExpiry:    { type: String, default: '' },
    insuranceExpiry:   { type: String, default: '' },
    tpcExpiry:         { type: String, default: '' },

    // Ownership & Deployment
    hired:     { type: Boolean, required: true, default: false },
    hiredFrom: { type: String,  default: ''                    },
    rentRate:  { type: rentRateSchema, default: null },
    outside:   { type: Boolean, required: true, default: false },
    certificationBody: { type: [certificationBodySchema], default: [] },
    lastCertificationBody: { type: [certificationBodySchema], default: [] },
    site: { type: [String], default: [] },
    lastSite:     { type: [String], default: [] },
    location:     { type: String, default: null },
    lastLocation: { type: [String], default: [] },

    // Lifecycle
    status: { type: String, required: true },
  },
  {
    timestamps: true, // Manages createdAt + updatedAt automatically
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

// Single-field
equipmentSchema.index({ machine: 1 });
equipmentSchema.index({ regNo:   1 });
equipmentSchema.index({ brand:   1 });
equipmentSchema.index({ year:   -1 });
equipmentSchema.index({ status:  1 });
equipmentSchema.index({ site:    1 });
equipmentSchema.index({ hired:   1 });

// Compound
equipmentSchema.index({ hired: 1, year: -1, createdAt: -1 });

// Full-text search
equipmentSchema.index({
  machine: 'text',
  regNo:   'text',
  brand:   'text',
  company: 'text',
});

// Nested field lookups
equipmentSchema.index({ 'certificationBody.operatorId':   1 });
equipmentSchema.index({ 'certificationBody.operatorName': 1 });

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('Equipments', equipmentSchema);