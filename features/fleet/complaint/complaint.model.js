const mongoose = require('mongoose');
const { documentViewSchema } = require('#core/document/document.actor.schema');
const {
  COMPLAINT_STATUS,
  COMPLAINT_WORKFLOW_STATUS,
  COMPLAINT_MEDIA_TYPE,
} = require('./complaint.constant');

const mediaFileSchema = new mongoose.Schema({
  fileName: { type: String },
  originalName: { type: String },
  filePath: { type: String },
  fileSize: { type: Number },
  mimeType: { type: String },
  uploadDate: { type: Date, default: Date.now },
  type: { type: String, enum: Object.values(COMPLAINT_MEDIA_TYPE) },
  duration: { type: Number },
});

const complaintSchema = new mongoose.Schema({
  uniqueCode: { type: String, required: true },
  complaintId: { type: String, unique: true },
  regNo: { type: String },
  brand: { type: String },
  machine: { type: String },
  name: { type: String },
  remarks: { type: String, default: '' },
  mediaFiles: [mediaFileSchema],

  rectificationRemarks: { type: String, default: '' },
  rectifiedBy: { type: String, default: '' },
  rectifiedAt: { type: Date, default: null },
  solutions: [mediaFileSchema],

  previousEquipmentStatus: { type: String },

  viewedBy: { type: [documentViewSchema], default: [] },

  workflowStatus: {
    type: String,
    enum: Object.values(COMPLAINT_WORKFLOW_STATUS),
    default: COMPLAINT_WORKFLOW_STATUS.REGISTERED,
  },

  status: {
    type: String,
    enum: Object.values(COMPLAINT_STATUS),
    default: COMPLAINT_STATUS.PENDING,
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

complaintSchema.index({ regNo: 1, createdAt: -1 });
complaintSchema.index({ uniqueCode: 1, createdAt: -1 });

complaintSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Complaint', complaintSchema);