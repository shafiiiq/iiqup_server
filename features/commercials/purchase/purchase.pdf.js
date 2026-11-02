const sanitizeFileNamePart = (value) =>
  String(value || '').replace(/[^\x20-\x7E]/g, '').replace(/[\\/:*?"<>|]/g, '').trim()

const buildPurchaseOrderFileName = (purchaseorder, { isAmendment = false } = {}) => {
  const vendor = sanitizeFileNamePart(purchaseorder.company?.vendor)
  const equipment = sanitizeFileNamePart((purchaseorder.equipments || []).join(', '))
  const suffix = isAmendment ? '-amendment' : ''
  return `PurchaseOrder-${purchaseorder.purchaseorderCounter}-${vendor}-PurchaseOrder For - ${equipment}${suffix}.pdf`
}

const buildPurchaseOrderDocumentPath = (refNo, { isAmendment = false, complaintId } = {}) => {
  const encodedRef = encodeURIComponent(refNo)

  if (isAmendment) {
    return `/order/purchase/report/${encodedRef}/amendment/true/${complaintId || ''}`
  }

  if (complaintId) {
    return `/order/purchase/report/${encodedRef}/${complaintId}`
  }

  return `/order/purchase/report/${encodedRef}`
}

const buildPurchaseOrderFileRecord = (fileName, storedPdf) => ({
  fileName,
  originalName: fileName,
  filePath: storedPdf.s3Key,
  mimeType: 'application/pdf',
  uploadDate: new Date(),
})

module.exports = {
  buildPurchaseOrderFileName,
  buildPurchaseOrderDocumentPath,
  buildPurchaseOrderFileRecord,
}