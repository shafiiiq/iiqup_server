const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const { sendError } = require('#shared/response/response.sender')
const HireOrder = require('./hire.model')
const { DEFAULT_SIGNATURES } = require('./hire.constant')

const badRequest = (res, message) => res.status(HTTP.BAD_REQUEST).json({ success: false, message })

const notFoundOrServerError = (res, logTag, error) => {
  logger.error(`[hire.helper] ${logTag}:`, error)
  const status = error.message === 'Hire order not found' ? HTTP.NOT_FOUND : HTTP.INTERNAL_SERVER_ERROR
  res.status(status).json({ success: false, message: error.message })
}

const genericError = (res, logTag, error) => {
  logger.error(`[hire.helper] ${logTag}:`, error)
  sendError(res, { success: false, message: error.message })
}

const buildSignatures = (signatures) => ({
  accountsDept: signatures?.accountsDept || DEFAULT_SIGNATURES.accountsDept,
  purchasingManager: signatures?.purchasingManager || DEFAULT_SIGNATURES.purchasingManager,
  operationsManager: signatures?.operationsManager || DEFAULT_SIGNATURES.operationsManager,
  authorizedSignatory: signatures?.authorizedSignatory || DEFAULT_SIGNATURES.authorizedSignatory,
  authorizedSignatoryTitle: signatures?.authorizedSignatoryTitle || DEFAULT_SIGNATURES.authorizedSignatoryTitle,
})

const nextVendorCode = (lastVendorCode) => {
  const sequence = parseInt(lastVendorCode.split('-')[1]) + 1
  return `VEN-${String(sequence).padStart(3, '0')}`
}

const resolveVendorCode = async (vendorName) => {
  const existingVendor = await HireOrder.findOne({
    'company.vendor': { $regex: new RegExp(`^${vendorName.trim()}$`, 'i') },
    vendorCode: { $ne: null },
  }).select('vendorCode vendorMail')

  if (existingVendor) {
    return { vendorCode: existingVendor.vendorCode, vendorMail: existingVendor.vendorMail || [] }
  }

  const lastVendor = await HireOrder.findOne({ vendorCode: { $ne: null } })
    .sort({ createdAt: -1 })
    .select('vendorCode')

  if (!lastVendor?.vendorCode) return { vendorCode: 'VEN-001', vendorMail: null }

  return { vendorCode: nextVendorCode(lastVendor.vendorCode), vendorMail: null }
}

const calculateTotal = (items, showDiscountInTotal, discount) => {
  const subtotal = (items || []).reduce((sum, item) => sum + (item.totalPrice || 0), 0)
  return showDiscountInTotal && discount ? subtotal - discount : subtotal
}

const resolveTotal = (items, showDiscountInTotal, discount, manualTotal) =>
  manualTotal ?? calculateTotal(items, showDiscountInTotal, discount)

const wrapServiceError = (serviceName, error) =>
  new Error(`[hire.helper] ${serviceName}:${error.message}`, { cause: error })

module.exports = {
  badRequest,
  notFoundOrServerError,
  genericError,
  buildSignatures,
  resolveVendorCode,
  calculateTotal,
  resolveTotal,
  wrapServiceError,
}