const mongoose = require('mongoose');

const replacementSchema = new mongoose.Schema({
    equipmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Equipments',
        required: true
    },
    regNo: {
        type: String,
        required: true
    },
    machine: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    month: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    year: {
        type: Number,
        required: true
    },
    time: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true,
        enum: ['idle', 'active'],
        default: 'active'
    },
    type: {
        type: String,
        required: true,
        enum: ['operator', 'site', 'equipment']
    },
    // Operator replacement fields
    currentOperator: {
        type: String,
        required: function () {
            return this.type === 'operator';
        }
    },
    replacedOperator: {
        type: String,
        required: function () {
            return this.type === 'operator';
        }
    },
    currentOperatorId: {
        type: String,
        required: function () {
            return this.type === 'operator';
        }
    },
    replacedOperatorId: {
        type: String,
        required: function () {
            return this.type === 'operator';
        }
    },
    // Site replacement fields
    currentSite: {
        type: String,
        required: function () {
            return this.type === 'site';
        }
    },
    replacedSite: {
        type: String,
        required: function () {
            return this.type === 'site';
        }
    },
    replacedEquipmentId: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Equipments',
        required: function () {
            return this.type === 'equipment';
        }
    },
    remarks: {
        type: String,
        default: ""
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for better query performance
replacementSchema.index({ equipmentId: 1 });
replacementSchema.index({ regNo: 1 });
replacementSchema.index({ type: 1 });
replacementSchema.index({ status: 1 });
replacementSchema.index({ date: -1 });
replacementSchema.index({ year: -1, month: -1 });

// Type-specific indexes
replacementSchema.index({ currentOperator: 1, type: 1 });
replacementSchema.index({ replacedOperator: 1, type: 1 });
replacementSchema.index({ currentSite: 1, type: 1 });
replacementSchema.index({ replacedSite: 1, type: 1 });
replacementSchema.index({ currentEquipmentId: 1, type: 1 });
replacementSchema.index({ replacedEquipmentId: 1, type: 1 });

// Compound index for common queries
replacementSchema.index({ equipmentId: 1, type: 1, date: -1 });

// Create the model
module.exports = mongoose.model('Replacement', replacementSchema);