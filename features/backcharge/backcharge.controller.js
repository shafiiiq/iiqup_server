const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const { sendSuccess, sendError } = require('#shared/response/response.sender')
const backchargeService = require('./backcharge.service')
const { sendBackchargeViaEmail } = require('./backcharge.email')

const httpError = (message, status) => Object.assign(new Error(message), { status })

const handleRoute = (logTag, handler) => async (req, res) => {
  try {
    const { message, data, ...rest } = await handler(req)
    sendSuccess(res, { success: true, message, data, ...rest })
  } catch (error) {
    logger.error(`[Backcharge] ${logTag}:`, error)
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message })
  }
}

const requireMinLength = (value, min, fieldLabel) => {
  if (!value || value.length < min) throw httpError(`${fieldLabel} must be at least ${min} characters`, HTTP.BAD_REQUEST)
}

const getAllBackchargeReports = handleRoute('getAllBackchargeReports', async (req) => {
  const result = await backchargeService.getAllBackchargeReports(req.pagination)
  return { message: 'Backcharge reports retrieved successfully', data: result.data, pagination: result.pagination }
})

const getBackchargeById = handleRoute('getBackchargeById', async (req) => {
  const report = await backchargeService.getBackchargeById(req.params.id)
  if (!report) throw httpError('Backcharge report not found', HTTP.NOT_FOUND)
  return { message: 'Backcharge report retrieved successfully', data: report }
})

const getBackchargeByReportNo = handleRoute('getBackchargeByReportNo', async (req) => {
  const report = await backchargeService.getBackchargeByReportNo(req.params.reportNo)
  if (!report) throw httpError('Backcharge report not found', HTTP.NOT_FOUND)
  return { message: 'Backcharge report retrieved successfully', data: report }
})

const getBackchargeByRefNo = handleRoute('getBackchargeByRefNo', async (req) => {
  const report = await backchargeService.getBackchargeByRefNo(req.params.refNo)
  if (!report) throw httpError('Backcharge report not found', HTTP.NOT_FOUND)
  return { message: 'Backcharge report retrieved successfully', data: report }
})

const addBackcharge = handleRoute('addBackcharge', async (req) => {
  const { refNo, equipmentType, plateNo } = req.body
  if (!refNo || !equipmentType || !plateNo) {
    throw httpError('Ref number, equipment type, and plate number are required', HTTP.BAD_REQUEST)
  }

  const existing = await backchargeService.getBackchargeByRefNo(refNo)
  if (existing) throw httpError('Backcharge report with this ref number already exists', HTTP.BAD_REQUEST)

  const data = await backchargeService.addBackcharge(req.body)
  return { message: 'Backcharge report created successfully', data }
})

const sendBackchargeToEmail = handleRoute('sendBackchargeToEmail', async (req) => {
  const { email, recipientName, supplierName, equipment, refNo } = req.body
  const pdfFile = req.file
  if (!email || !pdfFile) throw httpError('Email and PDF are required', HTTP.BAD_REQUEST)

  if (refNo) {
    const doc = await backchargeService.getBackchargeByRefNo(refNo)
    if (doc?.supplierCode) await backchargeService.saveSupplierEmail(doc.supplierCode, email)
  }

  const attachment = {
    content: pdfFile.buffer,
    filename: pdfFile.originalname || 'backcharge.pdf',
    mimeType: 'application/pdf',
  }

  const data = await sendBackchargeViaEmail(email, supplierName || '', recipientName || '', [attachment], equipment)
  return { data }
})

const updateSupplierEmail = handleRoute('updateSupplierEmail', async (req) => {
  const { supplierCode } = req.params
  const { email } = req.body
  if (!email || !email.includes('@')) throw httpError('Valid email required', HTTP.BAD_REQUEST)

  const result = await backchargeService.saveSupplierEmail(supplierCode, email)
  return { message: `Email updated for all records with supplier code ${supplierCode}`, modifiedCount: result.modifiedCount }
})

const updateBackcharge = handleRoute('updateBackcharge', async (req) => {
  const report = await backchargeService.updateBackcharge(req.params.id, req.body)
  if (!report) throw httpError('Backcharge report not found', HTTP.NOT_FOUND)
  return { message: 'Backcharge report updated successfully', data: report }
})

const deleteBackcharge = handleRoute('deleteBackcharge', async (req) => {
  const report = await backchargeService.deleteBackcharge(req.params.id)
  if (!report) throw httpError('Backcharge report not found', HTTP.NOT_FOUND)
  return { message: 'Backcharge report deleted successfully' }
})

const getLatestBackchargeRef = handleRoute('getLatestBackchargeRef', async () => {
  const latestNumber = await backchargeService.getLatestBackchargeRef()
  return { message: 'Latest backcharge reference retrieved successfully', data: { latestNumber } }
})

const searchEquipmentByPlate = handleRoute('searchEquipmentByPlate', async (req) => {
  requireMinLength(req.query.plateNo, 2, 'Plate number')
  const data = await backchargeService.searchEquipmentByPlate(req.query.plateNo)
  return { message: 'Equipment search completed', data }
})

const searchSuppliers = handleRoute('searchSuppliers', async (req) => {
  requireMinLength(req.query.name, 2, 'Supplier name')
  const data = await backchargeService.searchSuppliers(req.query.name)
  return { message: 'Supplier search completed', data }
})

const searchSites = handleRoute('searchSites', async (req) => {
  requireMinLength(req.query.location, 2, 'Site location')
  const data = await backchargeService.searchSites(req.query.location)
  return { message: 'Site search completed', data }
})

const signBackcharge = async (req, res) => {
  try {
    const { refNo } = req.params
    const { uniqueCode, signedDate, signedFrom, override = false, signedIP, signedDevice, signedLocation } = req.body

    if (!uniqueCode) return res.status(HTTP.BAD_REQUEST).json({ success: false, message: 'uniqueCode is required' })
    if (!signedDate || !signedFrom) return sendError(res, { success: false, message: 'signedDate and signedFrom are required' })

    const result = await backchargeService.signBackcharge(refNo, {
      uniqueCode,
      signedDate,
      signedFrom,
      override,
      signedIP,
      signedDevice,
      signedLocation,
    })

    if (result.requireOverride) {
      return sendError(res, {
        success: false,
        requireOverride: true,
        unsignedAbove: result.unsignedAbove,
        message: result.message,
      })
    }

    sendSuccess(res, result)
  } catch (error) {
    logger.error('[Backcharge] signBackcharge:', error)
    sendError(res, { success: false, message: error.message || 'Failed to sign backcharge' })
  }
}

const getPendingSignatures = handleRoute('getPendingSignatures', async (req) => {
  const { uniqueCode } = req.body
  if (!uniqueCode) throw httpError('uniqueCode is required', HTTP.BAD_REQUEST)

  const pending = await backchargeService.getPendingSignatures(uniqueCode)
  return { message: 'Pending signatures retrieved successfully', data: pending, count: pending.length }
})

const getSignedByUser = handleRoute('getSignedByUser', async (req) => {
  const { uniqueCode } = req.body
  if (!uniqueCode) throw httpError('uniqueCode is required', HTTP.BAD_REQUEST)

  const signed = await backchargeService.getSignedByUser(uniqueCode)
  return { message: 'Signed documents retrieved successfully', data: signed, count: signed.length }
})

module.exports = {
  getAllBackchargeReports,
  getBackchargeById,
  getBackchargeByReportNo,
  getBackchargeByRefNo,
  addBackcharge,
  sendBackchargeToEmail,
  updateSupplierEmail,
  updateBackcharge,
  deleteBackcharge,
  getLatestBackchargeRef,
  searchEquipmentByPlate,
  searchSuppliers,
  searchSites,
  signBackcharge,
  getPendingSignatures,
  getSignedByUser,
}