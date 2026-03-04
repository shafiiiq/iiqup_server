// models/attendance.model.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const attendanceSchema = new mongoose.Schema(
  {
    // System Identity
    originalId: { type: Number, required: true, unique: true },
    pin:        { type: String, required: true               },
    empName:    { type: String, required: true               },

    // Punch Data
    punchTime:     { type: String, required: true },
    punchDateTime: { type: Date,   required: true },
    punchType:     { type: String, enum: ['IN', 'OUT', 'UNKNOWN'], default: 'UNKNOWN' },
    state:         { type: String, default: '255'      },
    workCode:      { type: String, default: '0'        },
    photo:         { type: String, default: ''         },
    location:      { type: String, default: 'Auto add' },

    // Time Tracking
    dateOnly:   { type: String, required: true }, // YYYY-MM-DD
    timeOnly:   { type: String, required: true }, // HH:MM:SS
    weekNumber: { type: Number, required: true },
    monthYear:  { type: String, required: true }, // YYYY-MM
    year:       { type: Number, required: true },

    // Processing Flags
    isProcessed:      { type: Boolean, default: false },
    notificationSent: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

// Single-field
attendanceSchema.index({ originalId:    1  });
attendanceSchema.index({ punchDateTime: -1 });
attendanceSchema.index({ dateOnly:      1  });
attendanceSchema.index({ monthYear:     1  });
attendanceSchema.index({ year:          1  });

// Compound
attendanceSchema.index({ pin:        1, dateOnly: 1 });
attendanceSchema.index({ weekNumber: 1, year:     1 });

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('Attendance', attendanceSchema);