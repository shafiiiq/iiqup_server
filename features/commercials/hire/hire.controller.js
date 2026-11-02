const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const { sendSuccess, sendError } = require('#shared/response/response.sender')

const hireOrderService = require('./hire.service')
const hireOrderQuery = require('./hire.query')
const hireOrderSigning = require('./hire.signing')
const authZService = require('#core/authZ/authZ.service')
const { buildHireOrderFileName } = require('./hire.pdf')
const { hireOrderPdf } = require('./hire.pdf.registration')
const { readRequestedPdfVersion } = require('#core/pdf/document.pdf.version')
const { hireOrderActivity } = require('./hire.activity')
const { DOCUMENT_ACTIVITY_TYPE } = require('#core/document/document.activity.constant')
const { dispatchPurchaseOrderViaEmail } = require('../purchase/purchase.email')
const { HIRE_ORDER_ACTIVITY_SOURCE_KEY } = require('./hire.activity.registration')
const { notifyDocumentTasksChanged } = require('#core/document/document.task.notification')
const { markDocumentEmailedToSupplier } = require('#core/document/document.supplier.email.service')
const { badRequest, notFoundOrServerError, genericError } = require('./hire.helper')

const addHireOrder = async (req, res) => {
  try {
    const hireOrderData = req.body

    if (
      !hireOrderData.hireOrderRef ||
      !hireOrderData.date ||
      !hireOrderData.company?.vendor ||
      !hireOrderData.company?.attention ||
      !hireOrderData.company?.designation
    ) {
      return badRequest(res, 'Missing required hire order fields')
    }

    if (!hireOrderData.items || !Array.isArray(hireOrderData.items) || hireOrderData.items.length === 0) {
      return badRequest(res, 'items array is required and cannot be empty')
    }

    if (!hireOrderData.columns || !Array.isArray(hireOrderData.columns) || hireOrderData.columns.length === 0) {
      return badRequest(res, 'columns array is required')
    }

    if (!hireOrderData.hireOrderCounter) {
      hireOrderData.hireOrderCounter = await hireOrderQuery.getNextHireOrderCounter()
    }

    const hireOrder = await hireOrderService.createHireOrder(hireOrderData)
    hireOrderPdf.requestInBackground({ documentId: hireOrder.hireOrderRef, user: req.user })
    hireOrderActivity.announceCreated({ document: hireOrder, actorUniqueCode: req.user?.uniqueCode })

    sendSuccess(res, { success: true, message: 'Hire order created successfully', data: hireOrder })
  } catch (error) {
    genericError(res, 'addHireOrder', error)
  }
}

const getAllHireOrders = async (req, res) => {
  try {
    const result = await hireOrderQuery.getHireOrders(req.pagination)
    sendSuccess(res, {
      success: true,
      message: 'Hire orders retrieved successfully',
      data: result.data,
      pagination: result.pagination,
      count: result.data.length,
    })
  } catch (error) {
    genericError(res, 'getAllHireOrders', error)
  }
}

const getHireOrderByRef = async (req, res) => {
  try {
    const rawRefNo = req.params.refNo ?? req.params[0]
    const refNo = rawRefNo ? decodeURIComponent(rawRefNo) : rawRefNo
    if (!refNo) return badRequest(res, 'Reference number is required')

    const hireOrder = await hireOrderQuery.getHireOrderByRef(refNo)
    sendSuccess(res, { success: true, message: 'Hire order retrieved successfully', data: hireOrder })
  } catch (error) {
    notFoundOrServerError(res, 'getHireOrderByRef', error)
  }
}

const getCompanyDetails = async (req, res) => {
  try {
    const companyDetails = await hireOrderQuery.getAllCompanyDetails()
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

const getLatestHireOrderRef = async (req, res) => {
  try {
    const latestRef = await hireOrderQuery.getLatestHireOrderRef()
    sendSuccess(res, {
      success: true,
      message: 'Latest hire order reference retrieved successfully',
      data: { latestRef: latestRef || 'No hire order found' },
    })
  } catch (error) {
    genericError(res, 'getLatestHireOrderRef', error)
  }
}

const updateHireOrder = async (req, res) => {
  try {
    const { refNo } = req.params
    const updateData = req.body
    if (!refNo) return badRequest(res, 'Reference number is required')

    const decodedRefNo = decodeURIComponent(refNo)
    const hireOrder = await hireOrderService.updateHireOrder(decodedRefNo, updateData)
    hireOrderPdf.requestInBackground({ documentId: decodedRefNo, user: req.user })
    notifyDocumentTasksChanged({ sourceKey: HIRE_ORDER_ACTIVITY_SOURCE_KEY, documentId: decodedRefNo })
    hireOrderActivity.announceActivity({
      document: hireOrder,
      actorUniqueCode: req.user?.uniqueCode,
      activityType: updateData.isAmendmented ? DOCUMENT_ACTIVITY_TYPE.AMENDED : DOCUMENT_ACTIVITY_TYPE.EDITED,
    })
    sendSuccess(res, {
      success: true,
      message: updateData.isAmendmented ? 'Hire order amended successfully' : 'Hire order updated successfully',
      data: hireOrder,
    })
  } catch (error) {
    notFoundOrServerError(res, 'updateHireOrder', error)
  }
}

const deleteHireOrder = async (req, res) => {
  try {
    const { refNo } = req.params
    if (!refNo) return badRequest(res, 'Reference number is required')

    const hireOrder = await hireOrderService.deleteHireOrder(decodeURIComponent(refNo))
    sendSuccess(res, { success: true, message: 'Hire order deleted successfully', data: hireOrder })
  } catch (error) {
    notFoundOrServerError(res, 'deleteHireOrder', error)
  }
}

const uploadHireOrder = async (req, res) => {
  try {
    const { hireOrderRef, uploadedBy, description, isAmendment } = req.body
    if (!hireOrderRef) return badRequest(res, 'hireOrderRef is required')

    const hireOrder = await hireOrderService.uploadHireOrder(
      hireOrderRef,
      uploadedBy || 'WORKSHOP_MANAGER',
      description || 'Hire order document generated from system',
      isAmendment
    )
    hireOrderActivity.announceActivity({
      document: hireOrder,
      actorUniqueCode: req.user?.uniqueCode,
      activityType: DOCUMENT_ACTIVITY_TYPE.SUBMITTED,
    })
    notifyDocumentTasksChanged({ sourceKey: HIRE_ORDER_ACTIVITY_SOURCE_KEY, documentId: hireOrderRef })
    sendSuccess(res, { success: true, message: 'Hire order sent for approval', data: hireOrder })
  } catch (error) {
    genericError(res, 'uploadHireOrder', error)
  }
}

const getPendingSignatures = async (req, res) => {
  try {
    const { uniqueCode } = req.body
    if (!uniqueCode) return badRequest(res, 'uniqueCode is required')

    const pending = await hireOrderQuery.getPendingSignatures(uniqueCode)
    sendSuccess(res, {
      success: true,
      message: 'Pending hire order signatures retrieved successfully',
      data: pending,
      count: pending.length,
    })
  } catch (error) {
    genericError(res, 'getPendingSignatures', error)
  }
}

const getSignedByUser = async (req, res) => {
  try {
    const { uniqueCode } = req.body
    if (!uniqueCode) return badRequest(res, 'uniqueCode is required')

    const signed = await hireOrderQuery.getSignedByUser(uniqueCode)
    sendSuccess(res, {
      success: true,
      message: 'Signed hire orders retrieved successfully',
      data: signed,
      count: signed.length,
    })
  } catch (error) {
    genericError(res, 'getSignedByUser', error)
  }
}

const sendHireOrderViaEmail = async (req, res) => {
  try {
    const pdfFile = req.files?.pdf?.[0]
    const attachments = req.files?.attachments || []
    const emails = JSON.parse(req.body.emails || '[]')
    const recipientName = req.body.recipientName || ''
    const vendorName = req.body.vendorName || ''
    const equipment = req.body.equipment || 'Hire Order'
    const hireOrderRef = req.body.hireOrderRef || ''

    if (!emails.length || !pdfFile) return badRequest(res, 'At least one email and PDF are required')

    if (hireOrderRef) {
      const doc = await hireOrderQuery.getHireOrderByRef(hireOrderRef)
      if (doc?.vendorCode) await hireOrderService.saveVendorEmail(doc.vendorCode, emails)
    }

    const attachmentsList = [pdfFile, ...attachments].map((file) => ({
      content: file.buffer,
      filename: file.originalname || 'attachment',
      mimeType: file.mimetype || 'application/octet-stream',
    }))

    await dispatchPurchaseOrderViaEmail(emails, vendorName, recipientName, attachmentsList, equipment)
    if (hireOrderRef) await markDocumentEmailedToSupplier({ sourceKey: HIRE_ORDER_ACTIVITY_SOURCE_KEY, documentId: hireOrderRef })

    sendSuccess(res, { success: true, message: 'Hire order sent successfully', data: { hireOrderRef } })
  } catch (error) {
    genericError(res, 'sendHireOrderViaEmail', error)
  }
}

const downloadHireOrder = async (req, res) => {
  try {
    const rawRefNo = req.params.refNo ?? req.params[0]
    const refNo = rawRefNo ? decodeURIComponent(rawRefNo) : rawRefNo
    if (!refNo) return badRequest(res, 'Reference number is required')

    const hireOrder = await hireOrderQuery.getHireOrderByRef(refNo)
    const fileName = buildHireOrderFileName(hireOrder)
    const pdfBuffer = await hireOrderPdf.read({
      documentId: refNo,
      user: req.user,
      version: readRequestedPdfVersion(req.query.version),
    })

    const pdfBytes = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': pdfBytes.length,
    })
    res.end(pdfBytes)
  } catch (error) {
    notFoundOrServerError(res, 'downloadHireOrder', error)
  }
}

module.exports = {
  downloadHireOrder,
  addHireOrder,
  getAllHireOrders,
  getHireOrderByRef,
  getCompanyDetails,
  getLatestHireOrderRef,
  updateHireOrder,
  deleteHireOrder,
  uploadHireOrder,
  getPendingSignatures,
  getSignedByUser,
  sendHireOrderViaEmail,
}