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
  { _id: false }
);

const purchaseorderItemSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true },
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
  },
  { _id: false }
);

const approvalTrailSchema = new mongoose.Schema(
  {
    approvedBy: { type: String },
    role: { type: String },
    approvalDate: { type: Date, default: Date.now },
    comments: { type: String },
    action: {
      type: String,
      enum: ['approved', 'rejected', 'forwarded', 'uploaded'],
    },
    attachments: { type: [documentFileSchema], default: [] },
  },
  { _id: false }
);

const purchaseorderSignatureSchema = (extraFields = {}) =>
  new mongoose.Schema(
    {
      signed: { type: Boolean, default: false },
      authorised: { type: Boolean, default: false },
      approvedBy: { type: String },
      approvedDate: { type: String },
      approvedFrom: { type: String },
      approvedIP: { type: String },
      approvedDevice: { type: String },
      approvedLocation: { type: String },
      ...extraFields,
    },
    { _id: false }
  );

const purchaseorderTrackingSchema = new mongoose.Schema(
  {
    purchaseorderId: { type: String },
    purchaseorderRef: { type: String },
    description: { type: String },
    createdBy: { type: String },
    createdDate: { type: Date, default: Date.now },
    htmlContent: { type: String },
    isAmendment: { type: Boolean, default: false },
    amendmentDate: { type: String, default: null },
    purchaseorderFile: {
      fileName: { type: String },
      originalName: { type: String },
      filePath: { type: String },
      mimeType: { type: String },
      uploadDate: { type: Date },
    },
    uploadedBy: { type: String },
    uploadedDate: { type: Date },
    purchaseApprovalDate: { type: Date },
    accountsApprovalDate: { type: Date },
    managerApprovalDate: { type: Date },
    ceoApprovalDate: { type: Date },
    mdApprovalDate: { type: Date },
    status: {
      type: String,
      enum: [
        'created',
        'uploaded',
        'purchase_manager_approved',
        'accounts_approved',
        'operation_manager_approved',
        'ceo_approved',
        'md_approved',
        'items_procured',
        'amended',
      ],
      default: 'created',
    },
    PMR: purchaseorderSignatureSchema(),
    MANAGER: purchaseorderSignatureSchema(),
    ACCOUNTS: purchaseorderSignatureSchema(),
    CEO: purchaseorderSignatureSchema(),
    MD: purchaseorderSignatureSchema(),
  },
  { _id: false }
);

const amendmentSchema = new mongoose.Schema(
  {
    amendmentDate: { type: Date, default: Date.now },
    amendedBy: { type: String },
    amendedTotalAmount: { type: Number },
    amendedDiscount: { type: Number },
    amendedQuoteNo: { type: String },
    amendedRequestText: { type: String },
    reason: { type: String },
    amendedItems: { type: [purchaseorderItemSchema], default: [] },
    amendedEquipments: { type: [String], default: [] },
    amendedTermsAndConditions: { type: [String], default: [] },
    amendedCompany: {
      vendor: { type: String },
      attention: { type: String },
      designation: { type: String },
    },
  },
  { _id: false }
);

const purchaseorderSchema = new mongoose.Schema(
  {
    purchaseorderRef: { type: String, required: true, unique: true },
    date: { type: String, required: true },
    purchaseorderCounter: { type: Number, required: true },
    complaintId: { type: String, default: null },
    equipments: { type: [String], required: true },
    workingHrs: { type: String },
    runningKm: { type: String },
    quoteNo: { type: String },
    requestText: { type: String },
    quotation: { type: documentFileSchema, default: null },
    company: {
      vendor: { type: String, required: true },
      attention: { type: String, required: true },
      designation: { type: String, required: true },
    },
    vendorCode: { type: String, default: null, trim: true },
    vendorMail: { type: [String], default: [] },
    items: { type: [purchaseorderItemSchema], default: [] },
    totalAmount: { type: Number },
    totalDiscountAmount: { type: Number },
    discount: { type: Number },
    showDiscountInTotal: { type: Boolean, default: false },
    termsAndConditions: {
      type: [String],
      default: [
        'Terms & Conditions',
        'Payment will be made within 90 days from the day of submission of invoice',
      ],
    },
    note: {
      type: String,
      default:
        'The Purchase Order copy should be submitted along with the invoice every month for the payment process.',
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
    pmSigned: { type: Boolean, required: true, default: false },
    accountsSigned: { type: Boolean, required: true, default: false },
    managerSigned: { type: Boolean, required: true, default: false },
    ceoSigned: { type: Boolean, required: true, default: false },
    isAmendmented: { type: Boolean, default: false },
    normalPurchaseOrder: { type: Boolean, default: false },
    amendments: { type: [amendmentSchema], default: [] },
    purchaseorderDetails: { type: purchaseorderTrackingSchema },
    approvalTrail: { type: [approvalTrailSchema], default: [] },
    workflowStatus: {
      type: String,
      enum: [
        'purchaseorder_created',
        'purchaseorder_uploaded',
        'purchaseorder_amended',
        'purchase_manager_approved',
        'accounts_approved',
        'operation_manager_approved',
        'md_approved',
        'ceo_approved',
        'items_available',
      ],
      default: 'purchaseorder_created',
    },
  },
  {
    timestamps: true,
  }
);

purchaseorderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('purchaseorders', purchaseorderSchema);