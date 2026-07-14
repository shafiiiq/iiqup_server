const mongoose = require('mongoose');

const documentFileSchema = new mongoose.Schema(
  {
    fileName: { type: String },
    originalName: { type: String },
    filePath: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadDate: { type: Date, default: Date.now },
    type: { type: String, enum: ['image', 'document'] },
    url: { type: String },
  },
  { _id: false },
);

const hireOrderItemSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true },
  },
  { _id: false, strict: false },
);

const approvalTrailSchema = new mongoose.Schema(
  {
    approvedBy: { type: String },
    role: { type: String },
    approvalDate: { type: Date, default: Date.now },
    comments: { type: String },
    action: { type: String, enum: ['approved', 'rejected', 'forwarded', 'uploaded'] },
    attachments: { type: [documentFileSchema], default: [] },
  },
  { _id: false },
);

const hireOrderSchema = new mongoose.Schema(
  {
    hireOrderRef: { type: String, required: true, unique: true },
    date: { type: String, required: true },
    complaintId: { type: String, default: null },

    company: {
      vendor: { type: String, required: true },
      attention: { type: String, required: true },
      designation: { type: String, required: true },
    },
    vendorMail: { type: [String], default: [] },

    quoteNo: { type: String },
    requestText: { type: String },
    columns: { type: [mongoose.Schema.Types.Mixed], default: [] },
    items: { type: [hireOrderItemSchema], default: [] },
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
    note: {
      type: String,
      default: 'The hire order copy should be submitted along with the invoice every month for the payment process.',
    },

    signatures: {
      accountsDept: { type: String, default: 'ROSHAN SHA' },
      purchasingManager: { type: String, default: 'ABDUL MALIK' },
      operationsManager: { type: String, default: 'SURESHKANTH' },
      authorizedSignatory: { type: String, default: 'AHAMMED KAMAL' },
      authorizedSignatoryTitle: { type: String, enum: ['CEO', 'MANAGING DIRECTOR'], default: 'CEO' },
    },

    pmSigned: { type: Boolean, default: false },
    accountsSigned: { type: Boolean, default: false },
    managerSigned: { type: Boolean, default: false },
    ceoSigned: { type: Boolean, default: false },

    isAmendmented: { type: Boolean, default: false },
    amendments: { type: [mongoose.Schema.Types.Mixed], default: [] },
    approvalTrail: { type: [approvalTrailSchema], default: [] },

    workflowStatus: {
      type: String,
      enum: ['hire_order_created', 'hire_order_uploaded', 'hire_order_amended', 'purchase_approved', 'accounts_approved', 'manager_approved', 'md_approved', 'ceo_approved', 'items_available'],
      default: 'hire_order_created',
    },
  },
  { timestamps: true },
);

hireOrderSchema.index({ hireOrderRef: 1 });
hireOrderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('HireOrder', hireOrderSchema);
