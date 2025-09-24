// models/Backcharge.js
const mongoose = require('mongoose');

const sparePartSchema = new mongoose.Schema({
    description: {
        type: String,
        default: ''
    },
    qty: {
        type: String,
        default: ''
    },
    cost: {
        type: String,
        default: ''
    },
    total: {
        type: String,
        default: ''
    }
}, { _id: false });

const textLineSchema = new mongoose.Schema({
    lineNumber: {
        type: Number,
        required: true
    },
    text: {
        type: String,
        required: true
    }
}, { _id: false });

const multiLineTextSchema = new mongoose.Schema({
    combinedText: {
        type: String,
        default: ''
    },
    lines: [textLineSchema]
}, { _id: false });

const costSummarySchema = new mongoose.Schema({
    sparePartsCost: {
        type: Number,
        default: 0
    },
    labourCharges: {
        type: Number,
        default: 0
    },
    totalCost: {
        type: Number,
        default: 0
    },
    approvedDeduction: {
        type: Number,
        default: 0
    }
}, { _id: false });

const signatureSchema = new mongoose.Schema({
    workshopManager: {
        type: String,
        default: 'Firoz Khan'
    },
    purchaseManager: {
        type: String,
        default: 'Abdul Malik'
    },
    operationsManager: {
        type: String,
        default: 'Suresh Kanth'
    },
    authorizedSignatory: {
        type: String,
        default: 'Ahammed Kamal'
    }
}, { _id: false });

const backchargeSchema = new mongoose.Schema({
    reportNo: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    refNo: {
        type: String,
        default: 'ATE193-09-25',
        trim: true
    },
    equipmentType: {
        type: String,
        required: true,
        trim: true
    },
    plateNo: {
        type: String,
        required: true,
        trim: true
    },
    model: {
        type: String,
        required: true,
        trim: true
    },
    supplierName: {
        type: String,
        required: true,
        trim: true
    },
    contactPerson: {
        type: String,
        required: true,
        trim: true
    },
    siteLocation: {
        type: String,
        required: true,
        trim: true
    },
    date: {
        type: String,
        required: true
    },

    // Scope of work with multi-line support
    scopeOfWork: {
        type: multiLineTextSchema,
        required: true
    },

    // Workshop comments/work summary with multi-line support
    workshopComments: {
        type: multiLineTextSchema,
        required: true
    },

    // Spare parts table data
    sparePartsTable: {
        type: [sparePartSchema],
        default: []
    },

    // Cost summary
    costSummary: {
        type: costSummarySchema,
        required: true
    },

    // Authorization signatures
    signatures: {
        type: signatureSchema,
        default: () => ({})
    },

    // Additional metadata
    status: {
        type: String,
        enum: ['draft', 'submitted', 'approved', 'rejected', 'processed'],
        default: 'draft'
    },

    createdBy: {
        type: String,
        default: 'System'
    },

    approvedBy: {
        type: String,
        default: null
    },

    approvedAt: {
        type: Date,
        default: null
    },
    notes: {
        type: String,
        default: ''
    },
    isSigned: {
        type: Boolean,
        default: false
    },
    isMailed: {
        type: Boolean,
        default: false
    },
    attachments: [{
        filename: String,
        originalName: String,
        path: String,
        size: Number,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for getting first line of scope of work
backchargeSchema.virtual('scopeOfWorkLine1').get(function () {
    if (this.scopeOfWork && this.scopeOfWork.lines && this.scopeOfWork.lines.length > 0) {
        return this.scopeOfWork.lines.find(line => line.lineNumber === 1)?.text || '';
    }
    return '';
});

// Virtual for getting second line of scope of work
backchargeSchema.virtual('scopeOfWorkLine2').get(function () {
    if (this.scopeOfWork && this.scopeOfWork.lines && this.scopeOfWork.lines.length > 1) {
        return this.scopeOfWork.lines.find(line => line.lineNumber === 2)?.text || '';
    }
    return '';
});

// Virtual for getting first line of workshop comments
backchargeSchema.virtual('workshopCommentsLine1').get(function () {
    if (this.workshopComments && this.workshopComments.lines && this.workshopComments.lines.length > 0) {
        return this.workshopComments.lines.find(line => line.lineNumber === 1)?.text || '';
    }
    return '';
});

// Virtual for getting second line of workshop comments
backchargeSchema.virtual('workshopCommentsLine2').get(function () {
    if (this.workshopComments && this.workshopComments.lines && this.workshopComments.lines.length > 1) {
        return this.workshopComments.lines.find(line => line.lineNumber === 2)?.text || '';
    }
    return '';
});

// Virtual for formatted date
backchargeSchema.virtual('formattedDate').get(function () {
    if (this.date) {
        const date = new Date(this.date);
        return date.toLocaleDateString('en-GB');
    }
    return '';
});

// Virtual for total deduction percentage
backchargeSchema.virtual('deductionPercentage').get(function () {
    if (this.costSummary && this.costSummary.totalCost > 0) {
        return ((this.costSummary.approvedDeduction / this.costSummary.totalCost) * 100).toFixed(2);
    }
    return 0;
});

// Indexes for better query performance
backchargeSchema.index({ reportNo: 1 });
backchargeSchema.index({ equipmentType: 1 });
backchargeSchema.index({ supplierName: 1 });
backchargeSchema.index({ status: 1 });
backchargeSchema.index({ createdAt: -1 });
backchargeSchema.index({ date: 1 });
backchargeSchema.index({ 'costSummary.totalCost': 1 });

// Pre-save middleware
backchargeSchema.pre('save', function (next) {
    // Update the combined text fields when saving
    if (this.scopeOfWork && this.scopeOfWork.lines) {
        this.scopeOfWork.combinedText = this.scopeOfWork.lines
            .sort((a, b) => a.lineNumber - b.lineNumber)
            .map(line => line.text)
            .join(' ');
    }

    if (this.workshopComments && this.workshopComments.lines) {
        this.workshopComments.combinedText = this.workshopComments.lines
            .sort((a, b) => a.lineNumber - b.lineNumber)
            .map(line => line.text)
            .join(' ');
    }

    next();
});

// Static methods for common queries
backchargeSchema.statics.findByReportNo = function (reportNo) {
    return this.findOne({ reportNo });
};

backchargeSchema.statics.findByEquipmentType = function (equipmentType) {
    return this.find({ equipmentType: new RegExp(equipmentType, 'i') });
};

backchargeSchema.statics.findBySupplier = function (supplierName) {
    return this.find({ supplierName: new RegExp(supplierName, 'i') });
};

backchargeSchema.statics.findByStatus = function (status) {
    return this.find({ status });
};

backchargeSchema.statics.findByDateRange = function (startDate, endDate) {
    return this.find({
        createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        }
    });
};

// Instance methods
backchargeSchema.methods.approve = function (approvedBy) {
    this.status = 'approved';
    this.approvedBy = approvedBy;
    this.approvedAt = new Date();
    return this.save();
};

backchargeSchema.methods.reject = function (rejectedBy, reason) {
    this.status = 'rejected';
    this.approvedBy = rejectedBy;
    this.approvedAt = new Date();
    this.notes = reason || this.notes;
    return this.save();
};

backchargeSchema.methods.submit = function () {
    this.status = 'submitted';
    return this.save();
};

const Backcharge = mongoose.model('Backcharge', backchargeSchema);

module.exports = Backcharge;