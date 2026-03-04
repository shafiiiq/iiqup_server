// models/lpo.model.js
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Reusable Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const documentFileSchema = new mongoose.Schema(
  {
    fileName:     { type: String },
    originalName: { type: String },
    filePath:     { type: String },
    fileSize:     { type: Number },
    mimeType:     { type: String },
    uploadDate:   { type: Date, default: Date.now },
    type:         { type: String, enum: ['image', 'document'] },
    url:          { type: String },
  },
  { _id: false },
);

const lpoItemSchema = new mongoose.Schema(
  {
    id:          { type: Number, required: true },
    description: { type: String, required: true },
    quantity:    { type: Number, required: true },
    unitPrice:   { type: Number, required: true },
    totalPrice:  { type: Number, required: true },
  },
  { _id: false },
);

const approvalTrailSchema = new mongoose.Schema(
  {
    approvedBy:   { type: String },
    role:         { type: String },
    approvalDate: { type: Date, default: Date.now },
    comments:     { type: String },
    action:       { type: String, enum: ['approved', 'rejected', 'forwarded', 'uploaded'] },
    attachments:  { type: [documentFileSchema], default: [] },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// LPO Approval Signature Sub-schema (reused per role)
// ─────────────────────────────────────────────────────────────────────────────

const lpoSignatureSchema = (extraFields = {}) =>
  new mongoose.Schema(
    {
      signed:           { type: Boolean, default: false },
      authorised:       { type: Boolean, default: false },
      approvedBy:       { type: String                  },
      approvedDate:     { type: String                  },
      approvedFrom:     { type: String                  },
      approvedIP:       { type: String                  },
      approvedDevice:   { type: String                  },
      approvedLocation: { type: String                  },
      ...extraFields,
    },
    { _id: false },
  );

// ─────────────────────────────────────────────────────────────────────────────
// LPO Tracking Sub-schema
// ─────────────────────────────────────────────────────────────────────────────

const lpoTrackingSchema = new mongoose.Schema(
  {
    // Identity
    lpoId:       { type: String },
    lpoRef:      { type: String },
    description: { type: String },
    createdBy:   { type: String },
    createdDate: { type: Date, default: Date.now },
    htmlContent: { type: String },

    // Amendment
    isAmendment:   { type: Boolean, default: false },
    amendmentDate: { type: String,  default: null  },

    // Uploaded File
    lpoFile: {
      fileName:     { type: String },
      originalName: { type: String },
      filePath:     { type: String },
      mimeType:     { type: String },
      uploadDate:   { type: Date   },
    },
    uploadedBy:   { type: String },
    uploadedDate: { type: Date   },

    // Approval Dates
    purchaseApprovalDate: { type: Date },
    accountsApprovalDate: { type: Date },
    managerApprovalDate:  { type: Date },
    ceoApprovalDate:      { type: Date },
    mdApprovalDate:       { type: Date },

    // Lifecycle
    status: {
      type:    String,
      enum:    ['created', 'uploaded', 'purchase_approved', 'accounts_approved', 'manager_approved', 'ceo_approved', 'md_approved', 'items_procured', 'amended'],
      default: 'created',
    },

    // Role Signatures
    PMR:      lpoSignatureSchema(),
    MANAGER:  lpoSignatureSchema(),
    ACCOUNTS: lpoSignatureSchema(),
    CEO:      lpoSignatureSchema(),
    MD:       lpoSignatureSchema(),
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// Amendment Sub-schema
// ─────────────────────────────────────────────────────────────────────────────

const amendmentSchema = new mongoose.Schema(
  {
    amendmentDate:             { type: Date, default: Date.now },
    amendedBy:                 { type: String                  },
    amendedTotalAmount:        { type: Number                  },
    amendedDiscount:           { type: Number                  },
    amendedQuoteNo:            { type: String                  },
    amendedRequestText:        { type: String                  },
    reason:                    { type: String                  },
    amendedItems:              { type: [lpoItemSchema], default: []   },
    amendedEquipments:         { type: [String],        default: []   },
    amendedTermsAndConditions: { type: [String],        default: []   },
    amendedCompany: {
      vendor:      { type: String },
      attention:   { type: String },
      designation: { type: String },
    },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Schema
// ─────────────────────────────────────────────────────────────────────────────

const lpoSchema = new mongoose.Schema(
  {
    // Identity
    lpoRef:     { type: String, required: true, unique: true },
    date:       { type: String, required: true               },
    lpoCounter: { type: Number, required: true               },
    complaintId: { type: String, default: null               },

    // Equipment & Work
    equipments:  { type: [String], required: true },
    workingHrs:  { type: String                   },
    runningKm:   { type: String                   },
    quoteNo:     { type: String                   },
    requestText: { type: String                   },

    // Vendor
    company: {
      vendor:      { type: String, required: true },
      attention:   { type: String, required: true },
      designation: { type: String, required: true },
    },
    vendorCode: { type: String, default: null, trim: true },
    vendorMail: { type: String, default: null, trim: true },

    // Line Items & Totals
    items:              { type: [lpoItemSchema], default: []  },
    totalAmount:        { type: Number                        },
    totalDiscountAmount: { type: Number                       },
    discount:           { type: Number                        },
    showDiscountInTotal: { type: Boolean, default: false      },

    // Terms & Notes
    termsAndConditions: {
      type:    [String],
      default: [
        'Terms & Conditions',
        'Payment will be made within 90 days from the day of submission of invoice',
      ],
    },
    note: {
      type:    String,
      default: 'The LPO copy should be submitted along with the invoice every month for the payment process.',
    },

    // Signatories
    signatures: {
      accountsDept:             { type: String, default: 'ROSHAN SHA'      },
      purchasingManager:        { type: String, default: 'ABDUL MALIK'     },
      operationsManager:        { type: String, default: 'SURESHKANTH'     },
      authorizedSignatory:      { type: String, default: 'AHAMMED KAMAL'   },
      authorizedSignatoryTitle: { type: String, enum: ['CEO', 'MANAGING DIRECTOR'], default: 'CEO' },
    },

    // Sign Flags
    pmSigned:       { type: Boolean, required: true, default: false },
    accountsSigned: { type: Boolean, required: true, default: false },
    managerSigned:  { type: Boolean, required: true, default: false },
    ceoSigned:      { type: Boolean, required: true, default: false },

    // Flags
    isAmendmented: { type: Boolean, default: false },
    normalLPO:     { type: Boolean, default: false },

    // Relations
    amendments:    { type: [amendmentSchema],  default: [] },
    lpoDetails:    { type: lpoTrackingSchema               },
    approvalTrail: { type: [approvalTrailSchema], default: [] },

    // Workflow
    workflowStatus: {
      type:    String,
      enum:    ['lpo_created', 'lpo_uploaded', 'lpo_amended', 'purchase_approved', 'accounts_approved', 'manager_approved', 'md_approved', 'ceo_approved', 'items_available'],
      default: 'lpo_created',
    },
  },
  {
    timestamps: true,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

lpoSchema.index({ lpoRef:    1  });
lpoSchema.index({ createdAt: -1 });

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('LPO', lpoSchema);