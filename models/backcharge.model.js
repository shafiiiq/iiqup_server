// models/backcharge.model.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const sparePartSchema = new mongoose.Schema(
  {
    description: { type: String, default: '' },
    qty:         { type: String, default: '' },
    cost:        { type: String, default: '' },
    total:       { type: String, default: '' },
  },
  { _id: false }, 
);

const textLineSchema = new mongoose.Schema(
  {
    lineNumber: { type: Number, required: true },
    text:       { type: String, required: true },
  },
  { _id: false },
);

const multiLineTextSchema = new mongoose.Schema(
  {
    combinedText: { type: String, default: '' },
    lines:        { type: [textLineSchema], default: [] },
  },
  { _id: false },
);

const costSummarySchema = new mongoose.Schema(
  {
    sparePartsCost:    { type: Number, default: 0 },
    labourCharges:     { type: Number, default: 0 },
    totalCost:         { type: Number, default: 0 },
    approvedDeduction: { type: Number, default: 0 },
  },
  { _id: false },
);

const signatureSchema = new mongoose.Schema(
  {
    signed:         { type: Boolean, default: false },
    signedBy:       { type: String,  default: null  },
    signedDate:     { type: String,  default: null  },
    signedFrom:     { type: String,  default: null  },
    signedIP:       { type: String,  default: null  },
    signedDevice:   { type: String,  default: null  },
    signedLocation: { type: String,  default: null  },
  },
  { _id: false },
);

const attachmentSchema = new mongoose.Schema(
  {
    filename:     { type: String },
    originalName: { type: String },
    path:         { type: String },
    size:         { type: Number },
    uploadedAt:   { type: Date, default: Date.now },
  },
  { _id: false },
);

const approvalTrailSchema = new mongoose.Schema(
  {
    signedBy:   { type: String },
    role:       { type: String },
    action:     { type: String },
    signedDate: { type: Date,   default: Date.now },
    comments:   { type: String, default: ''       },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const backchargeSchema = new mongoose.Schema(
  {
    // Identity
    reportNo: { type: String, required: true, unique: true, trim: true         },
    refNo:    { type: String, default: 'ATE193-09-25',      trim: true         },
    date:     { type: String, required: true                                   },

    // Equipment Details
    equipmentType: { type: String, required: true, trim: true },
    plateNo:       { type: String, required: true, trim: true },
    model:         { type: String, required: true, trim: true },

    // Supplier Details
    supplierName:  { type: String, required: true, trim: true },
    supplierMail:  { type: String, default: null,  trim: true },
    supplierCode:  { type: String, default: null,  trim: true },
    contactPerson: { type: String, required: true, trim: true },
    siteLocation:  { type: String, required: true, trim: true },

    // Work Description
    scopeOfWork:      { type: multiLineTextSchema, required: true },
    workshopComments: { type: multiLineTextSchema, required: true },
    sparePartsTable:  { type: [sparePartSchema],   default: []    },
    costSummary:      { type: costSummarySchema,   required: true },

    // Lifecycle
    status: {
      type:    String,
      enum:    ['draft', 'submitted', 'approved', 'rejected', 'processed'],
      default: 'draft',
    },
    createdBy:  { type: String, default: 'System' },
    approvedBy: { type: String, default: null      },
    approvedAt: { type: Date,   default: null      },
    notes:      { type: String, default: ''        },

    // Flags
    isSigned: { type: Boolean, default: false },
    isMailed: { type: Boolean, default: false },

    // Relations
    attachments: { type: [attachmentSchema], default: [] },

    // Digital Signatures
    signatures: {
      workshopManager: {
        type: signatureSchema,
        default: () => ({}),
      },
      purchaseManager: {
        type: signatureSchema,
        default: () => ({}),
      },
      operationsManager: {
        type: signatureSchema,
        default: () => ({}),
      },
      authorizedSignatory: {
        type: new mongoose.Schema(
          {
            signed:                   { type: Boolean, default: false  },
            signedBy:                 { type: String,  default: null   },
            signedDate:               { type: String,  default: null   },
            signedFrom:               { type: String,  default: null   },
            signedIP:                 { type: String,  default: null   },
            signedDevice:             { type: String,  default: null   },
            signedLocation:           { type: String,  default: null   },
            authorizedSignatoryMode:  { type: String,  default: 'CEO'  },
            authorizedSignatoryName:  { type: String,  default: null   },
          },
          { _id: false },
        ),
        default: () => ({}),
      },
    },

    // Approval Trail
    approvalTrail: { type: [approvalTrailSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Virtuals
// ─────────────────────────────────────────────────────────────────────────────

backchargeSchema.virtual('scopeOfWorkLine1').get(function () {
  return this.scopeOfWork?.lines?.find(l => l.lineNumber === 1)?.text || '';
});

backchargeSchema.virtual('scopeOfWorkLine2').get(function () {
  return this.scopeOfWork?.lines?.find(l => l.lineNumber === 2)?.text || '';
});

backchargeSchema.virtual('workshopCommentsLine1').get(function () {
  return this.workshopComments?.lines?.find(l => l.lineNumber === 1)?.text || '';
});

backchargeSchema.virtual('workshopCommentsLine2').get(function () {
  return this.workshopComments?.lines?.find(l => l.lineNumber === 2)?.text || '';
});

backchargeSchema.virtual('formattedDate').get(function () {
  return this.date ? new Date(this.date).toLocaleDateString('en-GB') : '';
});

backchargeSchema.virtual('deductionPercentage').get(function () {
  if (!this.costSummary?.totalCost) return 0;
  return ((this.costSummary.approvedDeduction / this.costSummary.totalCost) * 100).toFixed(2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────

backchargeSchema.pre('save', function (next) {
  const buildCombined = (field) => {
    if (field?.lines?.length) {
      field.combinedText = field.lines
        .sort((a, b) => a.lineNumber - b.lineNumber)
        .map(l => l.text)
        .join(' ');
    }
  };

  buildCombined(this.scopeOfWork);
  buildCombined(this.workshopComments);

  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Statics
// ─────────────────────────────────────────────────────────────────────────────

backchargeSchema.statics.findByReportNo      = function (reportNo)      { return this.findOne({ reportNo }); };
backchargeSchema.statics.findByEquipmentType = function (equipmentType) { return this.find({ equipmentType: new RegExp(equipmentType, 'i') }); };
backchargeSchema.statics.findBySupplier      = function (supplierName)  { return this.find({ supplierName:  new RegExp(supplierName,  'i') }); };
backchargeSchema.statics.findByStatus        = function (status)        { return this.find({ status }); };
backchargeSchema.statics.findByDateRange     = function (startDate, endDate) {
  return this.find({ createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } });
};

// ─────────────────────────────────────────────────────────────────────────────
// Instance Methods
// ─────────────────────────────────────────────────────────────────────────────

backchargeSchema.methods.approve = function (approvedBy) {
  this.status     = 'approved';
  this.approvedBy = approvedBy;
  this.approvedAt = new Date();
  return this.save();
};

backchargeSchema.methods.reject = function (rejectedBy, reason) {
  this.status     = 'rejected';
  this.approvedBy = rejectedBy;
  this.approvedAt = new Date();
  this.notes      = reason || this.notes;
  return this.save();
};

backchargeSchema.methods.submit = function () {
  this.status = 'submitted';
  return this.save();
};

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

backchargeSchema.index({ reportNo:               1  });
backchargeSchema.index({ equipmentType:           1  });
backchargeSchema.index({ supplierName:            1  });
backchargeSchema.index({ status:                  1  });
backchargeSchema.index({ createdAt:               -1 });
backchargeSchema.index({ date:                    1  });
backchargeSchema.index({ 'costSummary.totalCost': 1  });

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('Backcharge', backchargeSchema);