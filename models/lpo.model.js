const mongoose = require('mongoose');

const documentFileSchema = new mongoose.Schema({
  fileName: { type: String, },
  originalName: { type: String, },
  filePath: { type: String, },
  fileSize: { type: Number, },
  mimeType: { type: String, },
  uploadDate: { type: Date, default: Date.now },
  type: { type: String, enum: ['image', 'document'], },
  url: { type: String, },
});

const lpoTrackingSchema = new mongoose.Schema({
  lpoId: { type: String }, // Reference to LPO model
  lpoRef: { type: String },
  description: { type: String }, // Description of LPO
  createdBy: { type: String }, // WORKSHOP_MANAGER
  createdDate: { type: Date, default: Date.now },

  htmlContent: { type: String },

  isAmendment: {
    type: Boolean,
    default: false
  },
  amendmentDate: {
    type: String,
    default: null
  },

  // Add LPO file information
  lpoFile: {
    fileName: { type: String },
    originalName: { type: String },
    filePath: { type: String },
    mimeType: { type: String },
    uploadDate: { type: Date }
  },
  uploadedBy: { type: String }, // Who uploaded the LPO file
  uploadedDate: { type: Date },

  purchaseApprovalDate: { type: Date },
  accountsApprovalDate: { type: Date },
  managerApprovalDate: { type: Date },
  ceoApprovalDate: { type: Date },
  status: {
    type: String,
    enum: ['created', 'uploaded', 'purchase_approved', 'accounts_approved', 'manager_approved', 'ceo_approved', 'md_approved', 'items_procured', 'amended'],
    default: 'created'
  },
  // PMR fields
  PMRsigned: {
    type: Boolean,
    default: false
  },
  PMRauthorised: {
    type: Boolean,
    default: false
  },
  PMRapprovedBy: {
    type: String,
  },
  PMRapprovedDate: {
    type: String,
  },
  PMRapprovedFrom: {
    type: String,
  },
  PMRapprovedIP: {
    type: String,
  },
  PMRapprovedBDevice: {
    type: String,
  },
  PMRapprovedLocation: {
    type: String,
  },

  // MANAGER fields
  MANAGERsigned: {
    type: Boolean,
    default: false
  },
  MANAGERauthorised: {
    type: Boolean,
    default: false
  },
  MANAGERapprovedBy: {
    type: String,
  },
  MANAGERapprovedDate: {
    type: String,
  },
  MANAGERapprovedFrom: {
    type: String,
  },
  MANAGERapprovedIP: {
    type: String,
  },
  MANAGERapprovedBDevice: {
    type: String,
  },
  MANAGERapprovedLocation: {
    type: String,
  },

  // ACCOUTNS fields
  ACCOUNTSsigned: {
    type: Boolean,
    default: false
  },
  ACCOUNTSauthorised: {
    type: Boolean,
    default: false
  },
  ACCOUNTSapprovedBy: {
    type: String,
  },
  ACCOUNTSapprovedDate: {
    type: String,
  },
  ACCOUNTSapprovedFrom: {
    type: String,
  },
  ACCOUNTSapprovedIP: {
    type: String,
  },
  ACCOUNTSapprovedBDevice: {
    type: String,
  },
  ACCOUNTSapprovedLocation: {
    type: String,
  },

  // CEO fields
  CEOsigned: {
    type: Boolean,
    default: false
  },
  CEOauthorised: {
    type: Boolean,
    default: false
  },
  CEOapprovedBy: {
    type: String,
  },
  CEOapprovedDate: {
    type: String,
  },
  CEOapprovedFrom: {
    type: String,
  },
  CEOapprovedIP: {
    type: String,
  },
  CEOapprovedBDevice: {
    type: String,
  },
  CEOapprovedLocation: {
    type: String,
  },

  // MD fields
  // MD fields
  MDsigned: {
    type: Boolean,
    default: false
  },
  MDauthorised: {
    type: Boolean,
    default: false
  },
  MDapprovedBy: {
    type: String,
  },
  MDapprovedDate: {
    type: String,
  },
  MDapprovedFrom: {
    type: String,
  },
  MDapprovedIP: {
    type: String,
  },
  MDapprovedBDevice: {
    type: String,
  },
  MDapprovedLocation: {
    type: String,
  },

  mdApprovalDate: { type: Date },
});

const lpoSchema = new mongoose.Schema({
  lpoRef: {
    type: String,
    required: true,
    unique: true
  },
  date: {
    type: String,
    required: true
  },
  equipments: [{
    type: String,
    required: true
  }],
  workingHrs: {
    type: String,
  },
  runningKm: {
    type: String,
  },
  quoteNo: {
    type: String,
  },
  requestText: {
    type: String,
  },
  company: {
    vendor: {
      type: String,
      required: true
    },
    attention: {
      type: String,
      required: true
    },
    designation: {
      type: String,
      required: true
    }
  },
  items: [{
    id: {
      type: Number,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    unitPrice: {
      type: Number,
      required: true
    },
    totalPrice: {
      type: Number,
      required: true
    }
  }],
  totalAmount: {
    type: Number,
  },
  totalDiscountAmount: {
    type: Number,
  },
  discount: {
    type: Number,
  },
  showDiscountInTotal: {
    type: Boolean,
    default: false
  },
  termsAndConditions: {
    type: [String],
    default: [
      'Terms & Conditions',
      'Payment will be made within 90 days from the day of submission of invoice'
    ]
  },
  note: {
    type: String,
    default: 'The LPO copy should be submitted along with the invoice every month for the payment process.'
  },
  signatures: {
    accountsDept: {
      type: String,
      default: 'ROSHAN SHA'
    },
    purchasingManager: {
      type: String,
      default: 'ABDUL MALIK'
    },
    operationsManager: {
      type: String,
      default: 'SURESHKANTH'
    },
    authorizedSignatory: {
      type: String,
      default: 'AHAMMED KAMAL'
    },
    authorizedSignatoryTitle: {
      type: String,
      enum: ['CEO', 'MANAGING DIRECTOR'],
      default: 'CEO'
    }
  },
  lpoCounter: {
    type: Number,
    required: true
  },
  pmSigned: {
    type: Boolean,
    required: true,
    default: false
  },
  accountsSigned: {
    type: Boolean,
    required: true,
    default: false
  },
  managerSigned: {
    type: Boolean,
    required: true,
    default: false
  },
  ceoSigned: {
    type: Boolean,
    required: true,
    default: false
  },
  complaintId: {
    type: String,
    default: null
  },
  isAmendmented: {
    type: Boolean,
    default: false
  },
  normalLPO: {
    type: Boolean,
    default: false
  },
  amendments: [{
    amendmentDate: {
      type: Date,
      default: Date.now
    },
    amendedBy: {
      type: String
    },
    amendedItems: [{
      id: {
        type: Number,
        required: true
      },
      description: {
        type: String,
        required: true
      },
      quantity: {
        type: Number,
        required: true
      },
      unitPrice: {
        type: Number,
        required: true
      },
      totalPrice: {
        type: Number,
        required: true
      }
    }],
    amendedTotalAmount: {
      type: Number
    },
    amendedDiscount: {
      type: Number
    },
    amendedCompany: {
      vendor: String,
      attention: String,
      designation: String
    },
    amendedEquipments: [String],
    amendedQuoteNo: String,
    amendedRequestText: String,
    amendedTermsAndConditions: [String],
    reason: {
      type: String
    }
  }],
  lpoDetails: lpoTrackingSchema,
  workflowStatus: {
    type: String,
    enum: [
      'lpo_created',          // LPO created by workshop manager
      'lpo_uploaded',         // LPO uploaded by workshop manager
      'lpo_amended',          // LPO amended by workshop manager
      'purchase_approved',    // Approved by purchase manager
      'accounts_approved',    // Approved by accounts
      'manager_approved',     // Approved by manager
      'md_approved',          // Approved by md
      'ceo_approved',         // Approved by CEO
      'items_available',      // Items available for mechanic
    ],
    default: 'lpo_created'
  },
  approvalTrail: [{
    approvedBy: { type: String },
    role: { type: String },
    approvalDate: { type: Date, default: Date.now },
    comments: { type: String },
    action: { type: String, enum: ['approved', 'rejected', 'forwarded', 'uploaded'] },
    attachments: [documentFileSchema] // Documents attached with this approval
  }],
}, {
  timestamps: true
});

// Index for faster queries
lpoSchema.index({ lpoRef: 1 });
lpoSchema.index({ createdAt: -1 });

module.exports = mongoose.model('LPO', lpoSchema);