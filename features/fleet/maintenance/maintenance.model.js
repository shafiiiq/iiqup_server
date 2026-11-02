const mongoose = require('mongoose');
const { buildDocumentPdfSchemaDefinition } = require('../../../core/pdf/document.pdf.schema');
const { documentViewSchema } = require('../../../core/document/document.actor.schema');
const { SERVICE_TYPES, CHECKLIST_STATUSES } = require('./maintenance.constant');

const checklistItemSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: CHECKLIST_STATUSES, default: '' },
  },
  { _id: false }
);

const attachmentSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true },
    s3Key: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
  },
  { _id: false }
);

const maintenanceSchema = new mongoose.Schema(
  {
    regNo: { type: String, required: true },
    serviceType: { type: String, required: true, enum: SERVICE_TYPES },
    date: { type: String, required: true },
    equipment: { type: String, default: null },
    location: { type: String, default: null },
    operator: { type: String, default: null },
    mechanics: { type: String, default: null },
    remarks: { type: String, default: null },

    serviceHrs: { type: String, default: null },
    nextServiceHrs: { type: String, default: null },
    fullService: { type: Boolean, default: false },
    oil: { type: String, default: null },
    oilFilter: { type: String, default: null },
    fuelFilter: { type: String, default: null },
    acFilter: { type: String, default: null },
    waterSeparator: { type: String, default: null },
    airFilter: { type: String, default: null },

    tyreModel: { type: String, default: null },
    tyreNumber: { type: String, default: null },

    batteryModel: { type: String, default: null },

    checklistItems: { type: [checklistItemSchema], default: [] },
    attachments: { type: [attachmentSchema], default: [] },
    complaintId: { type: String, default: null },
    revision: { type: Number, default: 0 },
    supervisorSigned: { type: Boolean, default: false },
    supervisorSignature: {
      signedBy: { type: String },
      signedAt: { type: String },
      ipAddress: { type: String },
      userAgent: { type: String },
    },
    pdf: buildDocumentPdfSchemaDefinition(),
    viewedBy: { type: [documentViewSchema], default: [] },
  },
  { timestamps: true }
);

maintenanceSchema.index({ regNo: 1, serviceType: 1, date: 1 }, { unique: true });
maintenanceSchema.index({ regNo: 1 });
maintenanceSchema.index({ date: 1 });

module.exports = mongoose.model('Maintenance', maintenanceSchema);