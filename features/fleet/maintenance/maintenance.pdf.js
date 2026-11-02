const sanitizeFileNamePart = (value) =>
  String(value || '').replace(/[^\x20-\x7E]/g, '').replace(/[\\/:*?"<>|]/g, '').trim()

const buildMaintenanceFileName = (maintenance) =>
  `Maintenance-${sanitizeFileNamePart(maintenance.regNo)}-${sanitizeFileNamePart(maintenance.serviceType)}-${sanitizeFileNamePart(maintenance.date)}.pdf`

const buildMaintenanceDocumentPath = (maintenanceId) => `/maintenance/report/${maintenanceId}`

module.exports = { buildMaintenanceFileName, buildMaintenanceDocumentPath }