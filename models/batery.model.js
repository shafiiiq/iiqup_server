const mongoose = require('mongoose');

const BatteryHistory = new mongoose.Schema({
    date: {
        type: Date,
        required: true
    },
    batteryModel: {
        type: String,
        required: true
    },
    equipment: {
        type: String,
        required: true
    },
    equipmentNo: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    operator: {
        type: String,
        required: true
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
    timestamps: true // Adds createdAt and updatedAt fields automatically
});

module.exports = mongoose.model('BatteryHistory', BatteryHistory); 