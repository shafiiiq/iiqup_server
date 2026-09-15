const PurchaseOrder = require('./purchase.model')

const badRequest = (res, message) => res.status(HTTP.BAD_REQUEST).json({ success: false, message })

const notFoundOrServerError = (res, logTag, error) => {
  logger.error(`[purchase.helper] ${logTag}:`, error)
  const status = error.message === 'Purchase Order not found' ? HTTP.NOT_FOUND : HTTP.INTERNAL_SERVER_ERROR
  res.status(status).json({ success: false, message: error.message })
}

const genericError = (res, logTag, error) => {
  logger.error(`[purchase.helper] ${logTag}:`, error)
  sendError(res, { success: false, message: error.message })
}

const buildSignatures = (signatures) => ({
  accountsDept: signatures?.accountsDept || 'ROSHAN SHA',
  purchasingManager: signatures?.purchasingManager || 'ABDUL MALIK',
  operationsManager: signatures?.operationsManager || 'SURESHKANTH',
  authorizedSignatory: signatures?.authorizedSignatory || 'AHAMMED KAMAL',
  authorizedSignatoryTitle: signatures?.authorizedSignatoryTitle || 'CEO',
})

const nextVendorCode = (lastVendorCode) => {
  const sequence = parseInt(lastVendorCode.split('-')[1]) + 1
  return `VEN-${String(sequence).padStart(3, '0')}`
}

const resolveVendorCode = async (vendorName) => {
  const existingVendor = await PurchaseOrder.findOne({
    'company.vendor': { $regex: new RegExp(`^${vendorName.trim()}$`, 'i') },
    vendorCode: { $ne: null },
  }).select('vendorCode vendorMail')

  if (existingVendor) {
    return {
      vendorCode: existingVendor.vendorCode,
      vendorMail: existingVendor.vendorMail || [],
    }
  }

  const lastVendor = await PurchaseOrder.findOne({ vendorCode: { $ne: null } })
    .sort({ createdAt: -1 })
    .select('vendorCode')

  if (!lastVendor?.vendorCode) return { vendorCode: 'VEN-001', vendorMail: null }

  return { vendorCode: nextVendorCode(lastVendor.vendorCode), vendorMail: null }
}

const calculateTotal = (items, showDiscountInTotal, discount) => {
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0)
  return showDiscountInTotal && discount ? subtotal - discount : subtotal
}

const buildSignedFields = (prefix, creds) => {
  const fields = {
    [`purchaseorderDetails.${prefix}signed`]: true,
    [`purchaseorderDetails.${prefix}authorised`]: creds.authorised,
    [`purchaseorderDetails.${prefix}approvedBy`]: creds.approvedBy,
    [`purchaseorderDetails.${prefix}approvedDate`]: creds.approvedDate || new Date().toISOString(),
  }

  if (creds.approvedFrom) fields[`purchaseorderDetails.${prefix}approvedFrom`] = creds.approvedFrom
  if (creds.approvedIP) fields[`purchaseorderDetails.${prefix}approvedIP`] = creds.approvedIP
  if (creds.approvedBDevice) fields[`purchaseorderDetails.${prefix}approvedBDevice`] = creds.approvedBDevice
  if (creds.approvedLocation) fields[`purchaseorderDetails.${prefix}approvedLocation`] = creds.approvedLocation

  return fields
}

const wrapServiceError = (serviceName, error) =>
  new Error(`[purchase.helper] ${serviceName}:${error.message}`, { cause: error })

module.exports = {
  badRequest,
  notFoundOrServerError,
  genericError,
  buildSignatures,
  resolveVendorCode,
  calculateTotal,
  buildSignedFields,
  wrapServiceError,
}