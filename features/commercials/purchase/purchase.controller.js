const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const { sendSuccess, sendError } = require('#shared/response/response.sender')
const { putObject } = require('#core/s3/s3.config')
const purchaseOrderService = require('./purchase.service')
const purchaseOrderQuery = require('./purchase.query')
const { DEFAULT_SIGNATURES, DEFAULT_TERMS } = require('./purchase.constant')
const { dispatchPurchaseOrderViaEmail } = require('./purchase.email')
const { buildPurchaseOrderFileName, buildPurchaseOrderFileRecord } = require('./purchase.pdf')
const { purchaseOrderPdf } = require('./purchase.pdf.registration')
const { readRequestedPdfVersion } = require('#core/pdf/document.pdf.version')
const { purchaseOrderActivity } = require('./purchase.activity')
const { DOCUMENT_ACTIVITY_TYPE } = require('#core/document/document.activity.constant')
const { PURCHASE_ORDER_ACTIVITY_SOURCE_KEY } = require('./purchase.activity.registration')
const { notifyDocumentTasksChanged } = require('#core/document/document.task.notification')
const { markDocumentEmailedToSupplier } = require('#core/document/document.supplier.email.service')

const badRequest = (res, message) => res.status(HTTP.BAD_REQUEST).json({ success: false, message })

const notFoundOrServerError = (res, logTag, error) => {
  logger.error(`[purchase.controller] ${logTag}:`, error)
  const status = error.message === 'Purchase Order not found' ? HTTP.NOT_FOUND : HTTP.INTERNAL_SERVER_ERROR
  res.status(status).json({ success: false, message: error.message })
}

const genericError = (res, logTag, error) => {
  logger.error(`[purchase.controller] ${logTag}:`, error)
  sendError(res, { success: false, message: error.message })
}

const createPurchaseOrder = async (req, res) => {
  try {
    const purchaseorderData = req.body

    if (!purchaseorderData.purchaseorderRef || !purchaseorderData.date || !purchaseorderData.equipments || !purchaseorderData.quoteNo) {
      return badRequest(res, 'Missing required fields: purchaseorderRef, date, equipments, quoteNo')
    }

    if (!purchaseorderData.company?.vendor || !purchaseorderData.company?.attention || !purchaseorderData.company?.designation) {
      return badRequest(res, 'Missing required company fields: vendor, attention, designation')
    }

    if (!purchaseorderData.items || !Array.isArray(purchaseorderData.items) || purchaseorderData.items.length === 0) {
      return badRequest(res, 'items array is required and cannot be empty')
    }

    if (!purchaseorderData.purchaseorderCounter) purchaseorderData.purchaseorderCounter = await purchaseOrderQuery.getNextPurchaseOrderCounter()

    if (purchaseorderData.paymentTerms && Array.isArray(purchaseorderData.paymentTerms)) {
      const filteredTerms = purchaseorderData.paymentTerms.filter((term) => term.trim() !== '')
      purchaseorderData.termsAndConditions = ['Terms & Conditions', ...filteredTerms]
    } else {
      purchaseorderData.termsAndConditions = DEFAULT_TERMS
    }

    if (!purchaseorderData.signatures) purchaseorderData.signatures = DEFAULT_SIGNATURES

    purchaseorderData.isAmendmented = false
    purchaseorderData.amendments = []

    const purchaseorder = await purchaseOrderService.createPurchaseOrder(purchaseorderData)
    purchaseOrderPdf.requestInBackground({ documentId: purchaseorder.purchaseorderRef, user: req.user })
    purchaseOrderActivity.announceCreated({ document: purchaseorder, actorUniqueCode: req.user?.uniqueCode })

    sendSuccess(res, { success: true, message: 'Purchase Order created successfully', data: purchaseorder })
  } catch (error) {
    genericError(res, 'createPurchaseOrder', error)
  }
}

const getPurchaseOrders = async (req, res) => {
  try {
    const result = await purchaseOrderQuery.getPurchaseOrders(req.pagination)

    sendSuccess(res, {
      success: true,
      message: 'PurchaseOrders retrieved successfully',
      data: result.data,
      pagination: result.pagination,
      count: result.data.length,
    })
  } catch (error) {
    genericError(res, 'getPurchaseOrders', error)
  }
}

const getPurchaseOrderByRef = async (req, res) => {
  try {
    const rawRefNo = req.params.refNo ?? req.params[0]
    const refNo = rawRefNo ? decodeURIComponent(rawRefNo) : rawRefNo
    logger.info(`[purchase.controller] getPurchaseOrderByRef: refNo=${refNo}`)
    if (!refNo) return badRequest(res, 'Reference number is required')

    const purchaseorder = await purchaseOrderQuery.getPurchaseOrderByRef(refNo)

    sendSuccess(res, { success: true, message: 'Purchase Order retrieved successfully', data: purchaseorder })
  } catch (error) {
    notFoundOrServerError(res, 'getPurchaseOrderByRef', error)
  }
}

const updatePurchaseOrder = async (req, res) => {
  try {
    const { refNo } = req.params
    const updateData = req.body
    if (!refNo) return badRequest(res, 'Reference number is required')

    const decodedRefNo = decodeURIComponent(refNo)
    const purchaseorder = await purchaseOrderService.updatePurchaseOrder(decodedRefNo, updateData)
    purchaseOrderPdf.requestInBackground({ documentId: decodedRefNo, user: req.user })
    notifyDocumentTasksChanged({ sourceKey: PURCHASE_ORDER_ACTIVITY_SOURCE_KEY, documentId: decodedRefNo })
    purchaseOrderActivity.announceActivity({
      document: purchaseorder,
      actorUniqueCode: req.user?.uniqueCode,
      activityType: updateData.isAmendmented ? DOCUMENT_ACTIVITY_TYPE.AMENDED : DOCUMENT_ACTIVITY_TYPE.EDITED,
    })

    sendSuccess(res, {
      success: true,
      message: updateData.isAmendmented ? 'Purchase Order amended successfully' : 'Purchase Order updated successfully',
      data: purchaseorder,
    })
  } catch (error) {
    notFoundOrServerError(res, 'updatePurchaseOrder', error)
  }
}

const deletePurchaseOrder = async (req, res) => {
  try {
    const { refNo } = req.params
    if (!refNo) return badRequest(res, 'Reference number is required')

    const purchaseorder = await purchaseOrderService.deletePurchaseOrder(refNo)

    sendSuccess(res, { success: true, message: 'Purchase Order deleted successfully', data: purchaseorder })
  } catch (error) {
    notFoundOrServerError(res, 'deletePurchaseOrder', error)
  }
}

const getCompanyDetails = async (req, res) => {
  try {
    const companyDetails = await purchaseOrderQuery.getAllCompanyDetails()

    sendSuccess(res, {
      success: true,
      message: 'Company details retrieved successfully',
      data: companyDetails,
      count: companyDetails.length,
    })
  } catch (error) {
    genericError(res, 'getCompanyDetails', error)
  }
}

const getPurchaseOrdersByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    if (!startDate || !endDate) return badRequest(res, 'startDate and endDate are required')

    const purchaseorders = await purchaseOrderQuery.getPurchaseOrdersByDateRange(startDate, endDate)

    sendSuccess(res, { success: true, message: 'PurchaseOrders retrieved successfully', data: purchaseorders, count: purchaseorders.length })
  } catch (error) {
    genericError(res, 'getPurchaseOrdersByDateRange', error)
  }
}

const getPurchaseOrdersByCompany = async (req, res) => {
  try {
    const { vendorName } = req.params
    if (!vendorName) return badRequest(res, 'Vendor name is required')

    const purchaseorders = await purchaseOrderQuery.getPurchaseOrdersByCompany(vendorName)

    sendSuccess(res, { success: true, message: 'PurchaseOrders retrieved successfully', data: purchaseorders, count: purchaseorders.length })
  } catch (error) {
    genericError(res, 'getPurchaseOrdersByCompany', error)
  }
}

const getPurchaseOrderOfEquipment = async (req, res) => {
  try {
    const { regNo } = req.params
    if (!regNo) return badRequest(res, 'Registration number is required')

    const purchaseorders = await purchaseOrderQuery.getPurchaseOrderOfEquipment(regNo)

    sendSuccess(res, {
      success: true,
      message: `PurchaseOrders for registration number ${regNo} retrieved successfully`,
      data: purchaseorders,
    })
  } catch (error) {
    genericError(res, 'getPurchaseOrderOfEquipment', error)
  }
}

const getPurchaseOrderOfStocks = async (req, res) => {
  try {
    const purchaseorders = await purchaseOrderQuery.getPurchaseOrderOfStocks()
    sendSuccess(res, { success: true, message: 'Stock PurchaseOrders retrieved successfully', data: purchaseorders })
  } catch (error) {
    genericError(res, 'getPurchaseOrderOfStocks', error)
  }
}

const getPurchaseOrdersOfEquipments = async (req, res) => {
  try {
    const purchaseorders = await purchaseOrderQuery.getPurchaseOrdersOfEquipments()
    sendSuccess(res, { success: true, message: 'All equipment PurchaseOrders retrieved successfully', data: purchaseorders })
  } catch (error) {
    genericError(res, 'getPurchaseOrdersOfEquipments', error)
  }
}

const getLatestPurchaseOrder = async (req, res) => {
  try {
    const latestPurchaseOrder = await purchaseOrderQuery.getLatestPurchaseOrder()
    sendSuccess(res, { success: true, message: 'Latest Purchase Order retrieved successfully', data: latestPurchaseOrder || null })
  } catch (error) {
    genericError(res, 'getLatestPurchaseOrder', error)
  }
}

const getLatestPurchaseOrderRefNo = async (req, res) => {
  try {
    const latestRef = await purchaseOrderQuery.getLatestPurchaseOrderRefNo()
    sendSuccess(res, {
      success: true,
      message: 'Latest Purchase Order reference retrieved successfully',
      data: { latestRef: latestRef || 'No Purchase Order found' },
    })
  } catch (error) {
    genericError(res, 'getLatestPurchaseOrderRefNo', error)
  }
}

const getQuotationUploadUrl = async (req, res) => {
  try {
    const { fileName, purchaseorderRef, contentType } = req.body
    if (!fileName || !purchaseorderRef) return badRequest(res, 'fileName and purchaseorderRef are required')

    const mimeType = contentType || 'application/octet-stream'
    const s3Key = `purchaseorders/${purchaseorderRef}/quotations/${Date.now()}-${fileName}`
    const uploadUrl = await putObject(fileName, s3Key, mimeType)

    sendSuccess(res, {
      success: true,
      uploadUrl,
      data: { fileName, originalName: fileName, filePath: s3Key, mimeType, uploadDate: new Date() },
    })
  } catch (error) {
    genericError(res, 'getQuotationUploadUrl', error)
  }
}

const uploadPurchaseOrder = async (req, res) => {
  try {
    const { uploadedBy, purchaseorderRef, description, fileName, isAmendment } = req.body
    if (!uploadedBy || !purchaseorderRef) return badRequest(res, 'uploadedBy and purchaseorderRef are required')

    const amendmentSuffix = isAmendment ? '-amendment' : ''
    const finalFilename = fileName || `purchaseorder-${purchaseorderRef}${amendmentSuffix}-${Date.now()}.pdf`
    const s3Key = `purchaseorders/${purchaseorderRef}/${finalFilename}`
    const uploadUrl = await putObject(finalFilename, s3Key, 'application/pdf')

    const purchaseorderFileData = {
      fileName: finalFilename,
      originalName: finalFilename,
      filePath: s3Key,
      mimeType: 'application/pdf',
      uploadUrl,
      uploadDate: new Date(),
    }

    const result = await purchaseOrderService.uploadPurchaseOrder(purchaseorderFileData, uploadedBy, purchaseorderRef, description, isAmendment)

    sendSuccess(res, {
      success: true,
      message: `Pre-signed URL generated successfully${isAmendment ? ' (Amendment)' : ''}`,
      uploadUrl,
      data: { purchaseorder: result, uploadData: purchaseorderFileData },
    })
  } catch (error) {
    logger.error('[purchase.controller] uploadPurchaseOrder:', error)
    sendError(res, { success: false, message: error.message || 'Failed to upload Purchase Order' })
  }
}

const getPendingSignatures = async (req, res) => {
  try {
    const { uniqueCode } = req.body
    if (!uniqueCode) return badRequest(res, 'uniqueCode is required')

    const pending = await purchaseOrderQuery.getPendingSignatures(uniqueCode)

    sendSuccess(res, {
      success: true,
      message: 'Pending Purchase Order signatures retrieved successfully',
      data: pending,
      count: pending.length,
    })
  } catch (error) {
    genericError(res, 'getPendingSignatures', error)
  }
}

const checkWhoSignedPurchaseOrder = async (req, res) => {
  try {
    const { uniqueCode } = req.body
    if (!uniqueCode) return badRequest(res, 'uniqueCode is required')

    const signed = await purchaseOrderQuery.checkWhoSignedPurchaseOrder(uniqueCode)

    sendSuccess(res, {
      success: true,
      message: 'Signed PurchaseOrders retrieved successfully',
      data: signed,
      count: signed.length,
    })
  } catch (error) {
    genericError(res, 'checkWhoSignedPurchaseOrder', error)
  }
}

const sendPurchaseOrderViaEmail = async (req, res) => {
  try {
    const { emails: rawEmails, recipientName, vendorName, equipment, purchaseorderRef } = req.body
    const emails = typeof rawEmails === 'string' ? JSON.parse(rawEmails) : rawEmails
    const pdfFile = req.files?.pdf?.[0]
    const extraFiles = req.files?.attachments || []

    if (!emails?.length || !pdfFile) return badRequest(res, 'At least one email and PDF are required')

    const cleanEquipment = equipment
      ? equipment.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim()
      : ''

    if (purchaseorderRef) {
      const doc = await purchaseOrderQuery.getPurchaseOrderByRef(purchaseorderRef)
      if (doc?.vendorCode) await purchaseOrderService.sendPurchaseOrderViaEmail(doc.vendorCode, emails)
    }

    const attachmentsList = [
      { content: pdfFile.buffer, filename: pdfFile.originalname || 'purchaseorder.pdf', mimeType: 'application/pdf' },
      ...extraFiles.map((f) => ({
        content: f.buffer,
        filename: f.originalname || 'attachment',
        mimeType: f.mimetype || 'application/octet-stream',
      })),
    ]

    const result = await dispatchPurchaseOrderViaEmail(emails, vendorName || '', recipientName || '', attachmentsList, cleanEquipment)

    if (purchaseorderRef) await markDocumentEmailedToSupplier({ sourceKey: PURCHASE_ORDER_ACTIVITY_SOURCE_KEY, documentId: purchaseorderRef })

    sendSuccess(res, { success: true, data: result })
  } catch (error) {
    genericError(res, 'sendPurchaseOrderViaEmail', error)
  }
}

const updateVendorEmail = async (req, res) => {
  try {
    const { vendorCode } = req.params
    const { email } = req.body
    if (!email || !email.includes('@')) return badRequest(res, 'Valid email required')

    const result = await purchaseOrderService.sendPurchaseOrderViaEmail(vendorCode, [email])

    sendSuccess(res, {
      success: true,
      message: `Email updated for vendor code ${vendorCode}`,
      modifiedCount: result.modifiedCount,
    })
  } catch (error) {
    genericError(res, 'updateVendorEmail', error)
  }
}

const downloadPurchaseOrder = async (req, res) => {
  try {
    logger.info('[purchase.controller] downloadPurchaseOrder: request received', new Date().toISOString())
    const rawRefNo = req.params.refNo ?? req.params[0]
    const refNo = rawRefNo ? decodeURIComponent(rawRefNo) : rawRefNo
    if (!refNo) return badRequest(res, 'Reference number is required')

    const isAmendment = req.query.amendment === 'true'

    const purchaseorder = await purchaseOrderQuery.getPurchaseOrderByRef(refNo)
    const fileName = buildPurchaseOrderFileName(purchaseorder, { isAmendment })

    const pdfBytes = await purchaseOrderPdf.read({
      documentId: refNo,
      user: req.user,
      version: readRequestedPdfVersion(req.query.version),
    })
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': pdfBytes.length,
    })
    res.end(pdfBytes)
    logger.info('[purchase.controller] downloadPurchaseOrder: request received', new Date().toISOString())
  } catch (error) {
    notFoundOrServerError(res, 'downloadPurchaseOrder', error)
  }
}

const submitPurchaseOrder = async (req, res) => {
  try {
    const rawRefNo = req.params.refNo ?? req.params[0]
    const refNo = rawRefNo ? decodeURIComponent(rawRefNo) : rawRefNo
    if (!refNo) return badRequest(res, 'Reference number is required')

    const { uploadedBy, description, isAmendment } = req.body

    const purchaseorder = await purchaseOrderQuery.getPurchaseOrderByRef(refNo)
    const fileName = buildPurchaseOrderFileName(purchaseorder, { isAmendment })

    const storedPdf = await purchaseOrderPdf.ensure({ documentId: refNo, user: req.user })
    const purchaseorderFileData = buildPurchaseOrderFileRecord(fileName, storedPdf)

    const result = await purchaseOrderService.uploadPurchaseOrder(
      purchaseorderFileData,
      uploadedBy || req.user?.name || 'WORKSHOP_MANAGER',
      refNo,
      description,
      isAmendment
    )

    purchaseOrderActivity.announceActivity({
      document: result.data,
      actorUniqueCode: req.user?.uniqueCode,
      activityType: DOCUMENT_ACTIVITY_TYPE.SUBMITTED,
    })
    notifyDocumentTasksChanged({ sourceKey: PURCHASE_ORDER_ACTIVITY_SOURCE_KEY, documentId: refNo })
    sendSuccess(res, { success: true, message: result.message, data: result.data })
  } catch (error) {
    logger.error('[purchase.controller] submitPurchaseOrder:', error)
    sendError(res, { success: false, message: error.message || 'Failed to submit Purchase Order' })
  }
}

const emailPurchaseOrder = async (req, res) => {
  try {
    const rawRefNo = req.params.refNo ?? req.params[0]
    const refNo = rawRefNo ? decodeURIComponent(rawRefNo) : rawRefNo
    if (!refNo) return badRequest(res, 'Reference number is required')

    const { emails: rawEmails, recipientName, vendorName, equipment } = req.body
    const emails = typeof rawEmails === 'string' ? JSON.parse(rawEmails) : rawEmails
    if (!emails?.length) return badRequest(res, 'At least one email is required')

    const extraFiles = req.files?.attachments || []

    const purchaseorder = await purchaseOrderQuery.getPurchaseOrderByRef(refNo)
    const fileName = buildPurchaseOrderFileName(purchaseorder)
    const pdfBuffer = await purchaseOrderPdf.read({ documentId: refNo, user: req.user })

    if (purchaseorder?.vendorCode) await purchaseOrderService.sendPurchaseOrderViaEmail(purchaseorder.vendorCode, emails)

    const cleanEquipment = equipment
      ? equipment.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim()
      : ''

    const attachmentsList = [
      { content: pdfBuffer, filename: fileName, mimeType: 'application/pdf' },
      ...extraFiles.map((f) => ({
        content: f.buffer,
        filename: f.originalname || 'attachment',
        mimeType: f.mimetype || 'application/octet-stream',
      })),
    ]

    const result = await dispatchPurchaseOrderViaEmail(emails, vendorName || '', recipientName || '', attachmentsList, cleanEquipment)

    await markDocumentEmailedToSupplier({ sourceKey: PURCHASE_ORDER_ACTIVITY_SOURCE_KEY, documentId: refNo })

    sendSuccess(res, { success: true, data: result })
  } catch (error) {
    genericError(res, 'emailPurchaseOrder', error)
  }
}

module.exports = {
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderByRef,
  updatePurchaseOrder,
  deletePurchaseOrder,
  getCompanyDetails,
  getPurchaseOrdersByDateRange,
  getPurchaseOrdersByCompany,
  getPurchaseOrderOfEquipment,
  getPurchaseOrderOfStocks,
  getPurchaseOrdersOfEquipments,
  getLatestPurchaseOrder,
  getLatestPurchaseOrderRefNo,
  getQuotationUploadUrl,
  uploadPurchaseOrder,
  getPendingSignatures,
  checkWhoSignedPurchaseOrder,
  sendPurchaseOrderViaEmail,
  updateVendorEmail,
  downloadPurchaseOrder,
  submitPurchaseOrder,
  emailPurchaseOrder,
}