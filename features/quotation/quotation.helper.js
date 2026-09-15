
const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const { sendError } = require('#shared/response/response.sender')
const Quotation = require('./quotation.model')
const { DEFAULT_SIGNATURES } = require('./quotation.constant')

const badRequest = (res, message) => res.status(HTTP.BAD_REQUEST).json({ success: false, message })

const notFoundOrServerError = (res, logTag, error) => {
  logger.error(`[quotation.helper] ${logTag}:`, error)
  const status = error.message === 'Quotation not found' ? HTTP.NOT_FOUND : HTTP.INTERNAL_SERVER_ERROR
  res.status(status).json({ success: false, message: error.message })
}

const genericError = (res, logTag, error) => {
  logger.error(`[quotation.helper] ${logTag}:`, error)
  sendError(res, { success: false, message: error.message })
}

const buildSignatures = (signatures) => ({
  authorizedSignatory: signatures?.authorizedSignatory || DEFAULT_SIGNATURES.authorizedSignatory,
  authorizedSignatoryTitle: signatures?.authorizedSignatoryTitle || DEFAULT_SIGNATURES.authorizedSignatoryTitle,
})

const nextVendorCode = (lastVendorCode) => {
  const sequence = parseInt(lastVendorCode.split('-')[1]) + 1
  return `VEN-${String(sequence).padStart(3, '0')}`
}

const resolveVendorCode = async (vendorName) => {
  const existingVendor = await Quotation.findOne({
    'company.vendor': { $regex: new RegExp(`^${vendorName.trim()}$`, 'i') },
    vendorCode: { $ne: null },
  }).select('vendorCode vendorMail')

  if (existingVendor) {
    return { vendorCode: existingVendor.vendorCode, vendorMail: existingVendor.vendorMail || [] }
  }

  const lastVendor = await Quotation.findOne({ vendorCode: { $ne: null } })
    .sort({ createdAt: -1 })
    .select('vendorCode')

  if (!lastVendor?.vendorCode) return { vendorCode: 'VEN-001', vendorMail: null }

  return { vendorCode: nextVendorCode(lastVendor.vendorCode), vendorMail: null }
}

const itemsSubtotal = (items = []) => items.reduce((sum, item) => sum + (item.totalPrice || 0), 0)

const calculateTotal = (items, showDiscountInTotal, discount) => {
  const subtotal = itemsSubtotal(items)
  return showDiscountInTotal && discount ? subtotal - discount : subtotal
}

const wrapServiceError = (serviceName, error) =>
  new Error(`[quotation.helper] ${serviceName}:${error.message}`, { cause: error })

module.exports = {
  badRequest,
  notFoundOrServerError,
  genericError,
  buildSignatures,
  resolveVendorCode,
  itemsSubtotal,
  calculateTotal,
  wrapServiceError,
}