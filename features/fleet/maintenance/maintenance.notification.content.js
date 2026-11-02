const DETAIL_FIELDS = [
  { key: 'serviceType', label: 'Service Type' },
  { key: 'date', label: 'Date' },
  { key: 'operator', label: 'Operator' },
  { key: 'mechanics', label: 'Mechanics' },
  { key: 'serviceHrs', label: 'Service Hrs' },
  { key: 'nextServiceHrs', label: 'Next Service Hrs' },
  { key: 'tyreModel', label: 'Tyre Model' },
  { key: 'tyreNumber', label: 'Tyre Number' },
  { key: 'batteryModel', label: 'Battery Model' },
  { key: 'remarks', label: 'Remarks' },
];

const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';

const buildEquipmentLine = (maintenance) =>
  hasValue(maintenance.equipment)
    ? `${maintenance.regNo} - ${String(maintenance.equipment).trim()}`
    : String(maintenance.regNo);

const buildMaintenanceNotificationTitle = (maintenance) => `New ${maintenance.serviceType} maintenance record`;

const buildMaintenanceNotificationBody = (maintenance) => {
  const headerLines = [];
  if (hasValue(maintenance.location)) headerLines.push(`At ${String(maintenance.location).trim()}`);
  headerLines.push(buildEquipmentLine(maintenance));

  const detailLines = DETAIL_FIELDS.filter(({ key }) => hasValue(maintenance[key])).map(
    ({ key, label }) => `${label}: ${String(maintenance[key]).trim()}`
  );

  return [...headerLines, ...detailLines].join('\n');
};

const buildMaintenanceNotificationAttachments = (maintenance) =>
  (maintenance.attachments || []).map((attachment) => ({
    filePath: attachment.s3Key,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
  }));

module.exports = {
  buildMaintenanceNotificationTitle,
  buildMaintenanceNotificationBody,
  buildMaintenanceNotificationAttachments,
};