const { OIL_SERVICE_TYPES } = require('./maintenance.constant');

const parseRegNos = (value) =>
  value ? value.split(',').map((regNo) => regNo.trim()).filter(Boolean) : [];

const parseFilterQuery = (query) => ({
  regNos: parseRegNos(query.regNos),
  serviceType: query.serviceType || null,
  dateFilterMode: query.dateFilterMode || 'all',
  lastMonthsCount: query.lastMonthsCount ? parseInt(query.lastMonthsCount, 10) : undefined,
  customStartDate: query.customStartDate,
  customEndDate: query.customEndDate,
});

const toAttachment = (uploadSession) => ({
  sessionId: uploadSession._id.toString(),
  s3Key: uploadSession.s3Key,
  fileName: uploadSession.originalName,
  mimeType: uploadSession.mimeType,
  fileSize: uploadSession.fileSize,
});

const buildMaintenanceDocument = (shared, row, attachments) => {
  const isOilService = OIL_SERVICE_TYPES.includes(shared.serviceType);
  const isTyreService = shared.serviceType === 'tyre';
  const isBatteryService = shared.serviceType === 'battery';

  return {
    regNo: String(shared.regNo),
    serviceType: shared.serviceType,
    date: row.date,
    equipment: shared.equipment || null,
    location: shared.location || null,
    operator: shared.operator || null,
    mechanics: shared.mechanics || null,
    remarks: shared.remarks || null,

    serviceHrs: row.serviceHrs || null,
    nextServiceHrs: row.nextServiceHrs || null,
    fullService: isOilService ? Boolean(row.fullService) : false,

    oil: isOilService ? shared.oil || 'Check' : null,
    oilFilter: isOilService ? shared.oilFilter || 'Check' : null,
    fuelFilter: isOilService ? shared.fuelFilter || 'Check' : null,
    acFilter: isOilService ? shared.acFilter || 'Clean' : null,
    waterSeparator: isOilService ? shared.waterSeparator || 'Check' : null,
    airFilter: isOilService ? shared.airFilter || 'Clean' : null,

    tyreModel: isTyreService ? shared.tyreModel || null : null,
    tyreNumber: isTyreService ? shared.tyreNumber || null : null,

    batteryModel: isBatteryService ? shared.batteryModel || null : null,

    checklistItems: shared.checklistItems || [],
    attachments,
    ...(shared.complaintId ? { complaintId: shared.complaintId } : {}),
  };
};

module.exports = { parseFilterQuery, toAttachment, buildMaintenanceDocument };