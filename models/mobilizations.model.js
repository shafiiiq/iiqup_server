// models/mobilization.model.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const EQUIPMENT_STATUSES = ['active', 'idle', 'maintenance', 'loading', 'going', 'leased'];

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const mobilizationSchema = new mongoose.Schema(
  {
    // Equipment Reference
    equipmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipments', required: true },
    regNo:       { type: String, required: true },
    machine:     { type: String, required: true },

    // Action & Status
    action: {
      type:     String,
      required: true,
      enum:     ['mobilized', 'demobilized', 'status_changed'],
    },
    previousStatus: { type: String, enum: EQUIPMENT_STATUSES },
    newStatus:      { type: String, enum: EQUIPMENT_STATUSES },
    status:         {
      type:     String,
      required: true,
      enum:     EQUIPMENT_STATUSES,
      default:  function () { return this.action === 'mobilized' ? 'active' : 'idle'; },
    },

    // Deployment
    deployType:    { type: String, enum: ['site', 'company'], default: 'site' },
    clientCompany: { type: String, default: ''                                },
    site:          {
      type:     String,
      required: function () { return this.action === 'mobilized' && this.deployType === 'site'; },
    },

    // Operator
    withOperator: { type: Boolean, required: true, default: false },
    operator:     {
      type:     String,
      required: function () { return this.action === 'mobilized' && this.withOperator === true; },
    },

    // Timing
    month:   { type: Number, required: true, min: 1, max: 12 },
    year:    { type: Number, required: true                   },
    date:    { type: Date,   required: true, default: Date.now },
    time:    { type: String, required: true                   },

    // One Day Mobilization
    isOneDayMob:   { type: Boolean, default: false },
    demobDate:     { type: Date,    default: null   },
    demobTime:     { type: String,  default: ''     },
    demobRemarks:  { type: String,  default: ''     },
    linkedMobId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Mobilization', default: null },

    // Notes
    remarks: { type: String, default: '' },
  },
  {
    timestamps: true,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

// Single-field
mobilizationSchema.index({ equipmentId: 1  });
mobilizationSchema.index({ regNo:       1  });
mobilizationSchema.index({ action:      1  });
mobilizationSchema.index({ site:        1  });
mobilizationSchema.index({ status:      1  });
mobilizationSchema.index({ date:        -1 });

// Compound
mobilizationSchema.index({ year:        -1, month:  -1  });
mobilizationSchema.index({ equipmentId:  1, action:  1, date: -1 });
mobilizationSchema.index({ site:          1, status:  1           });

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('Mobilization', mobilizationSchema);