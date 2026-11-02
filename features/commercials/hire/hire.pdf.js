const sanitizeFileNamePart = (value) =>
  String(value || '').replace(/[^\x20-\x7E]/g, '').replace(/[\\/:*?"<>|]/g, '').trim()

const buildHireOrderFileName = (hireOrder) =>
  `HireOrder-${hireOrder.hireOrderCounter || ''}-${sanitizeFileNamePart(hireOrder.company?.vendor)}.pdf`

const buildHireOrderDocumentPath = (refNo) => `/order/hire/report/${encodeURIComponent(refNo)}`

module.exports = { buildHireOrderFileName, buildHireOrderDocumentPath }