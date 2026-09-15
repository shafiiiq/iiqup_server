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

const approvalTrailSchema = new mongoose.Schema(
  {
    approvedBy: { type: String },
    role: { type: String },
    approvalDate: { type: Date, default: Date.now },
    comments: { type: String },
    action: { type: String, enum: ['approved', 'rejected', 'forwarded', 'uploaded', 'signed', 'override_signed'] },
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

const amendmentSchema = new mongoose.Schema(
  {
    amendmentDate: { type: Date, default: Date.now },
    amendedBy: { type: String },
    reason: { type: String },
    amendedItems: { type: [mongoose.Schema.Types.Mixed], default: [] },
    amendedColumns: { type: [columnSchema], default: [] },
    amendedCompany: {
      vendor: { type: String },
      attention: { type: String },
      designation: { type: String },
    },
    amendedQuoteNo: { type: String },
    amendedRequestText: { type: String },
    amendedTermsAndConditions: { type: [String], default: [] },
    amendedDiscount: { type: Number },
    amendedTotalAmount: { type: Number },
  },
  { _id: false }
)

const hireOrderSchema = new mongoose.Schema(
  {
    hireOrderRef: { type: String, required: true, unique: true },
    date: { type: String, required: true },
    hireOrderCounter: { type: Number },
    complaintId: { type: String, default: null },

    company: {
      vendor: { type: String, required: true },
      attention: { type: String, required: true },
      designation: { type: String, required: true },
    },
    vendorCode: { type: String, default: null, trim: true },
    vendorMail: { type: [String], default: [] },

    quoteNo: { type: String },
    requestText: { type: String },
    columns: { type: [columnSchema], default: [] },
    items: { type: [mongoose.Schema.Types.Mixed], default: [] },
    totalAmount: { type: Number },
    discount: { type: Number, default: 0 },
    showDiscountInTotal: { type: Boolean, default: false },
    totalDiscountAmount: { type: Number },

    termsAndConditions: {
      type: [String],
      default: [
        'Terms & Conditions',
        'Payment will be made within 90 days from the day of submission of invoice',
      ],
    },

    signatures: {
      accountsDept: { type: String, default: 'ROSHAN SHA' },
      purchasingManager: { type: String, default: 'ABDUL MALIK' },
      operationsManager: { type: String, default: 'SURESHKANTH' },
      authorizedSignatory: { type: String, default: 'AHAMMED KAMAL' },
      authorizedSignatoryTitle: {
        type: String,
        enum: ['CEO', 'MANAGING DIRECTOR'],
        default: 'CEO',
      },
    },

    pmSigned: { type: Boolean, default: false },
    accountsSigned: { type: Boolean, default: false },
    managerSigned: { type: Boolean, default: false },
    ceoSigned: { type: Boolean, default: false },

    hireOrderDetails: { type: mongoose.Schema.Types.Mixed, default: {} },

    isAmendmented: { type: Boolean, default: false },
    amendments: { type: [amendmentSchema], default: [] },
    approvalTrail: { type: [approvalTrailSchema], default: [] },

    hireOrderFile: { type: documentFileSchema, default: null },

    workflowStatus: {
      type: String,
      enum: [
        'hire_order_created',
        'hire_order_uploaded',
        'hire_order_amended',
        'manager_approved',
        'purchase_approved',
        'accounts_approved',
        'ceo_approved',
        'md_approved',
        'items_available',
      ],
      default: 'hire_order_created',
    },
  },
  { timestamps: true }
)

hireOrderSchema.index({ hireOrderRef: 1 })
hireOrderSchema.index({ createdAt: -1 })

module.exports = mongoose.model('hireorders', hireOrderSchema)