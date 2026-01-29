const mongoose = require('mongoose');

const mediaFileSchema = new mongoose.Schema({
  fileName: { type: String, },
  originalName: { type: String, },
  filePath: { type: String, },
  fileSize: { type: Number, },
  mimeType: { type: String, },
  fieldName: { type: String, },
  uploadDate: { type: Date, default: Date.now },
  type: { type: String, enum: ['photo', 'video'], },
  url: { type: String, },
  duration: { type: Number }, // Only for videos
});

const solutionFileSchema = new mongoose.Schema({
  fileName: { type: String, },
  originalName: { type: String, },
  filePath: { type: String, },
  fileSize: { type: Number, },
  mimeType: { type: String, },
  fieldName: { type: String, },
  uploadDate: { type: Date, default: Date.now },
  type: { type: String, enum: ['photo', 'video'], },
  url: { type: String, },
  duration: { type: Number }, // Only for videos
});

// New schema for document attachments
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

// New schema for mechanic requests
const mechanicRequestSchema = new mongoose.Schema({
  requestText: { type: String },
  audioFile: {
    fileName: { type: String },
    filePath: { type: String },
    duration: { type: Number }
  },
  requestDate: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['pending', 'approved_by_maintenance', 'sent_to_workshop', 'lpo_created', 'approved_by_purchase', 'approved_by_ceo', 'items_available'],
    default: 'pending'
  }
});

// New schema for LPO tracking
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

const complaintSchema = new mongoose.Schema({
  uniqueCode: { type: String, required: true },
  complaintId: { type: String, unique: true },
  regNo: { type: String },
  brand: { type: String },
  machine: { type: String },
  name: { type: String },
  remarks: { type: String, default: '' },
  rectificationRemarks: { type: String, default: '' },
  mediaFiles: [mediaFileSchema],

  // Assignment tracking
  assignedMechanic: [{
    mechanicId: { type: String },
    mechanicName: { type: String },
    assignedBy: { type: String }, // MAINTENANCE_HEAD
    assignedDate: { type: Date }
  }],

  // Mechanic requests for items/tools
  mechanicRequests: [mechanicRequestSchema],

  // LPO tracking
  lpoDetails: lpoTrackingSchema,

  // Solutions (when work is completed)
  solutions: [solutionFileSchema],

  // Document attachments for maintenance requests
  attachments: [documentFileSchema],

  // Workflow status
  workflowStatus: {
    type: String,
    enum: [
      'registered',           // Initial registration
      'assigned_to_mechanic', // Assigned to mechanic
      'mechanic_requested',   // Mechanic requested items
      'maintenance_approved', // Maintenance head approved request
      'sent_to_workshop',     // Sent to workshop manager
      'sent_to_workshop_without_lpo',     // Sent to workshop manager without lpo
      'approved_without_lpo',     // Approved without lpo
      'lpo_created',          // LPO created by workshop manager
      'lpo_uploaded',         // LPO uploaded by workshop manager
      'lpo_amended',          // LPO amended by workshop manager
      'purchase_approved',    // Approved by purchase manager
      'accounts_approved',    // Approved by accounts
      'manager_approved',     // Approved by manager
      'md_approved',          // Approved by md
      'ceo_approved',         // Approved by CEO
      'items_available',      // Items available for mechanic
      'work_in_progress',     // Mechanic started work
      'completed'             // Work completed
    ],
    default: 'registered'
  },

  // Legacy status for backward compatibility
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'resolved', 'rejected'],
    default: 'pending'
  },

  // Approval trail
  approvalTrail: [{
    approvedBy: { type: String },
    role: { type: String },
    approvalDate: { type: Date, default: Date.now },
    comments: { type: String },
    action: { type: String, enum: ['approved', 'rejected', 'forwarded', 'uploaded'] },
    attachments: [documentFileSchema] // Documents attached with this approval
  }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Update timestamp on save
complaintSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const Complaint = mongoose.model('Complaint', complaintSchema);
module.exports = Complaint;