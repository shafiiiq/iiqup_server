const mongoose = require('mongoose')

const documentFileSchema = new mongoose.Schema(
  {
    fileName: { type: String },
    originalName: { type: String },
    filePath: { type: String },
    mimeType: { type: String },
    uploadUrl: { type: String },
    uploadDate: { type: Date, default: Date.now },
    generatedFor: { type: String, default: null },
  },
  { _id: false }
)

const columnSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ['text', 'number', 'calculated'], default: 'text' },
    deletable: { type: Boolean, default: true },
  },
  { _id: false }
)

const customFieldSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, default: '' },
    value: { type: String, default: '' },
  },
  { _id: false }
)

const amendmentSchema = new mongoose.Schema(
  {
    amendmentDate: { type: Date, default: Date.now },
    amendedBy: { type: String },
    reason: { type: String },
    amendedItems: { type: [Object], default: [] },
    amendedColumns: { type: [columnSchema], default: [] },
    amendedCompany: {
      vendor: { type: String },
      attention: { type: String },
      designation: { type: String },
    },
    amendedLocation: { type: String },
    amendedCustomFields: { type: [customFieldSchema], default: [] },
    amendedRequestText: { type: String },
    amendedNoticeText: { type: String },
    amendedPriceStatementText: { type: String },
    amendedContactText: { type: String },
    amendedTermsAndConditions: { type: [String], default: [] },
    amendedDiscount: { type: Number },
    amendedTotalAmount: { type: Number },
    amendedManualTotal: { type: Number },
    amendedShowTotalRow: { type: Boolean },
  },
  { _id: false }
)

const quotationSchema = new mongoose.Schema(
  {
    quotationRef: { type: String, required: true, unique: true },
    date: { type: String, required: true },
    quotationCounter: { type: Number, required: true },
    complaintId: { type: String, default: null },

    requestText: { type: String },
    noticeText: { type: String },
    priceStatementText: { type: String },
    contactText: { type: String },

    company: {
      vendor: { type: String, required: true },
      attention: { type: String, required: true },
      designation: { type: String, required: true },
    },
    location: { type: String, default: '' },
    customFields: { type: [customFieldSchema], default: [] },
    vendorCode: { type: String, default: null, trim: true },
    vendorMail: { type: [String], default: [] },

    columns: { type: [columnSchema], default: [] },
    items: { type: [Object], default: [] },

    discount: { type: Number, default: 0 },
    showDiscountInTotal: { type: Boolean, default: true },
    totalAmount: { type: Number },
    totalDiscountAmount: { type: Number },
    manualTotal: { type: Number, default: null },
    showTotalRow: { type: Boolean, default: true },

    termsAndConditions: { type: [String], default: [] },

    signatures: {
      authorizedSignatory: { type: String, default: 'AHAMMED KAMAL' },
      authorizedSignatoryTitle: {
        type: String,
        enum: ['CEO', 'MANAGING DIRECTOR'],
        default: 'CEO',
      },
    },

    authorizedSigned: { type: Boolean, default: false },
    signature: {
      signed: { type: Boolean, default: false },
      approvedBy: { type: String },
      approvedDate: { type: String },
      approvedFrom: { type: String },
      approvedIP: { type: String },
      approvedDevice: { type: String },
      approvedLocation: { type: String },
    },

    isAmendmented: { type: Boolean, default: false },
    amendments: { type: [amendmentSchema], default: [] },

    quotationFile: { type: documentFileSchema, default: null },
    status: { type: String, enum: ['draft', 'sent'], default: 'draft' },
  },
  { timestamps: true }
)

quotationSchema.index({ createdAt: -1 })

module.exports = mongoose.model('quotations', quotationSchema)