const sanitizeFileNamePart = (value) =>
  String(value || '').replace(/[^\x20-\x7E]/g, '').replace(/[\\/:*?"<>|]/g, '').trim()

const buildBackchargeFileName = (backcharge) =>
  `Backcharge-${sanitizeFileNamePart(backcharge.refNo)}-${sanitizeFileNamePart(backcharge.equipmentType)}.pdf`

const buildBackchargeDocumentPath = (refNo) => `/backcharge/report/${encodeURIComponent(refNo)}`

module.exports = { buildBackchargeFileName, buildBackchargeDocumentPath }