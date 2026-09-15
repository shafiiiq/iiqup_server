const logger = require('#shared/logger/logger')
const HTTP = require('#shared/response/response.status')
const { sendSuccess, sendError } = require('#shared/response/response.sender')
const { putObject } = require('#core/s3/s3.config')
const quotationSigning = require('./quotation.signing')

const quotationService = require('./quotation.service')
const quotationQuery = require('./quotation.query')
const { sendQuotationViaEmail: sendQuotationEmail } = require('./quotation.email')
const {
  buildQuotationFileName,
  generateQuotationPdfBuffer,
  getCachedOrRenderPdf,
  uploadQuotationPdfToS3,
} = require('./quotation.pdf')
const { badRequest, notFoundOrServerError, genericError } = require('./quotation.helper')
const { DEFAULT_TERMS } = require('./quotation.constant')

const createQuotation = async (req, res) => {
  try {
    const quotationData = req.body

    if (!quotationData.date || !quotationData.company?.vendor || !quotationData.company?.attention || !quotationData.company?.designation) {
      return badRequest(res, 'Missing required fields: date, company.vendor, company.attention, company.designation')
    }

    if (!quotationData.items || !Array.isArray(quotationData.items) || quotationData.items.length === 0) {
      return badRequest(res, 'items array is required and cannot be empty')
    }

    if (!quotationData.quotationCounter) {
      quotationData.quotationCounter = await quotationQuery.getNextQuotationCounter()
    }

    if (!quotationData.termsAndConditions?.length) quotationData.termsAndConditions = DEFAULT_TERMS

    const quotation = await quotationService.createQuotation(quotationData)

    sendSuccess(res, { success: true, message: 'Quotation created successfully', data: quotation })
  } catch (error) {
    genericError(res, 'createQuotation', error)
  }
}

const getQuotations = async (req, res) => {
  try {
    const result = await quotationQuery.getQuotations(req.pagination)

    sendSuccess(res, {
      success: true,
      message: 'Quotations retrieved successfully',
      data: result.data,
      pagination: result.pagination,
      count: result.data.length,
    })
  } catch (error) {
    genericError(res, 'getQuotations', error)
  }
}

const getQuotationByRef = async (req, res) => {
  try {
    const rawRefNo = req.params.refNo ?? req.params[0]
    const refNo = rawRefNo ? decodeURIComponent(rawRefNo) : rawRefNo
    if (!refNo) return badRequest(res, 'Reference number is required')

    const quotation = await quotationQuery.getQuotationByRef(refNo)

    sendSuccess(res, { success: true, message: 'Quotation retrieved successfully', data: quotation })
  } catch (error) {
    notFoundOrServerError(res, 'getQuotationByRef', error)
  }
}

const updateQuotation = async (req, res) => {
  try {
    const { refNo } = req.params
    const updateData = req.body
    if (!refNo) return badRequest(res, 'Reference number is required')

    const decodedRefNo = decodeURIComponent(refNo)
    const quotation = await quotationService.updateQuotation(decodedRefNo, updateData)

    sendSuccess(res, {
      success: true,
      message: updateData.isAmendmented ? 'Quotation amended successfully' : 'Quotation updated successfully',
      data: quotation,
    })
  } catch (error) {
    notFoundOrServerError(res, 'updateQuotation', error)
  }
}

const deleteQuotation = async (req, res) => {
  try {
    const { refNo } = req.params
    if (!refNo) return badRequest(res, 'Reference number is required')

    const quotation = await quotationService.deleteQuotation(refNo)

    sendSuccess(res, { success: true, message: 'Quotation deleted successfully', data: quotation })
  } catch (error) {
    notFoundOrServerError(res, 'deleteQuotation', error)
  }
}

const getCompanyDetails = async (req, res) => {
  try {
    const companyDetails = await quotationQuery.getAllCompanyDetails()

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

const getQuotationsByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    if (!startDate || !endDate) return badRequest(res, 'startDate and endDate are required')

    const quotations = await quotationQuery.getQuotationsByDateRange(startDate, endDate)

    sendSuccess(res, { success: true, message: 'Quotations retrieved successfully', data: quotations, count: quotations.length })
  } catch (error) {
    genericError(res, 'getQuotationsByDateRange', error)
  }
}

const getQuotationsByCompany = async (req, res) => {
  try {
    const { vendorName } = req.params
    if (!vendorName) return badRequest(res, 'Vendor name is required')

    const quotations = await quotationQuery.getQuotationsByCompany(vendorName)

    sendSuccess(res, { success: true, message: 'Quotations retrieved successfully', data: quotations, count: quotations.length })
  } catch (error) {
    genericError(res, 'getQuotationsByCompany', error)
  }
}

const getLatestQuotation = async (req, res) => {
  try {
    const latestQuotation = await quotationQuery.getLatestQuotation()
    sendSuccess(res, { success: true, message: 'Latest Quotation retrieved successfully', data: latestQuotation || null })
  } catch (error) {
    genericError(res, 'getLatestQuotation', error)
  }
}

const getLatestQuotationRefNo = async (req, res) => {
  try {
    const latestRef = await quotationQuery.getLatestQuotationRefNo()
    sendSuccess(res, {
      success: true,
      message: 'Latest Quotation reference retrieved successfully',
      data: { latestRef: latestRef || 'No Quotation found' },
    })
  } catch (error) {
    genericError(res, 'getLatestQuotationRefNo', error)
  }
}

const downloadQuotation = async (req, res) => {
  try {
    const rawRefNo = req.params.refNo ?? req.params[0]
    const refNo = rawRefNo ? decodeURIComponent(rawRefNo) : rawRefNo
    if (!refNo) return badRequest(res, 'Reference number is required')

    const quotation = await quotationQuery.getQuotationByRef(refNo)
    const fileName = buildQuotationFileName(quotation)

    const pdfBuffer = await getCachedOrRenderPdf(quotation, refNo, req.user)

    const pdfBytes = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': pdfBytes.length,
    })
    res.end(pdfBytes)
  } catch (error) {
    notFoundOrServerError(res, 'downloadQuotation', error)
  }
}

const submitQuotation = async (req, res) => {
  try {
    const rawRefNo = req.params.refNo ?? req.params[0]
    const refNo = rawRefNo ? decodeURIComponent(rawRefNo) : rawRefNo
    if (!refNo) return badRequest(res, 'Reference number is required')

    const quotation = await quotationQuery.getQuotationByRef(refNo)
    const fileName = buildQuotationFileName(quotation)

    const pdfBuffer = await generateQuotationPdfBuffer(refNo, req.user)
    const quotationFileData = await uploadQuotationPdfToS3(pdfBuffer, refNo, fileName, {
      updatedAt: quotation.updatedAt ? quotation.updatedAt.toISOString() : null,
    })

    const updated = await quotationService.markQuotationSent(refNo, quotationFileData)

    sendSuccess(res, { success: true, message: 'Quotation marked as sent', data: updated })
  } catch (error) {
    genericError(res, 'submitQuotation', error)
  }
}

const emailQuotation = async (req, res) => {
  try {
    const rawRefNo = req.params.refNo ?? req.params[0]
    const refNo = rawRefNo ? decodeURIComponent(rawRefNo) : rawRefNo
    if (!refNo) return badRequest(res, 'Reference number is required')

    const { emails: rawEmails, recipientName, vendorName } = req.body
    const emails = typeof rawEmails === 'string' ? JSON.parse(rawEmails) : rawEmails
    if (!emails?.length) return badRequest(res, 'At least one email is required')

    const extraFiles = req.files?.attachments || []

    const quotation = await quotationQuery.getQuotationByRef(refNo)
    const fileName = buildQuotationFileName(quotation)
    const pdfBuffer = await generateQuotationPdfBuffer(refNo, req.user)

    if (quotation?.vendorCode) await quotationService.saveVendorEmail(quotation.vendorCode, emails)

    const attachmentsList = [
      { content: pdfBuffer, filename: fileName, mimeType: 'application/pdf' },
      ...extraFiles.map((f) => ({
        content: f.buffer,
        filename: f.originalname || 'attachment',
        mimeType: f.mimetype || 'application/octet-stream',
      })),
    ]

    const result = await sendQuotationEmail(emails, vendorName || quotation.company?.vendor || '', recipientName || quotation.company?.attention || '', attachmentsList)

    sendSuccess(res, { success: true, data: result })
  } catch (error) {
    genericError(res, 'emailQuotation', error)
  }
}

const sendQuotationViaEmail = async (req, res) => {
  try {
    const { emails: rawEmails, recipientName, vendorName, quotationRef } = req.body
    const emails = typeof rawEmails === 'string' ? JSON.parse(rawEmails) : rawEmails
    const pdfFile = req.files?.pdf?.[0]
    const extraFiles = req.files?.attachments || []

    if (!emails?.length || !pdfFile) return badRequest(res, 'At least one email and PDF are required')

    if (quotationRef) {
      const doc = await quotationQuery.getQuotationByRef(quotationRef)
      if (doc?.vendorCode) await quotationService.saveVendorEmail(doc.vendorCode, emails)
    }

    const attachmentsList = [
      { content: pdfFile.buffer, filename: pdfFile.originalname || 'quotation.pdf', mimeType: 'application/pdf' },
      ...extraFiles.map((f) => ({
        content: f.buffer,
        filename: f.originalname || 'attachment',
        mimeType: f.mimetype || 'application/octet-stream',
      })),
    ]

    const result = await sendQuotationEmail(emails, vendorName || '', recipientName || '', attachmentsList)

    sendSuccess(res, { success: true, data: result })
  } catch (error) {
    genericError(res, 'sendQuotationViaEmail', error)
  }
}

const updateVendorEmail = async (req, res) => {
  try {
    const { vendorCode } = req.params
    const { email } = req.body
    if (!email || !email.includes('@')) return badRequest(res, 'Valid email required')

    const result = await quotationService.saveVendorEmail(vendorCode, email)

    sendSuccess(res, {
      success: true,
      message: `Email updated for vendor code ${vendorCode}`,
      modifiedCount: result.modifiedCount,
    })
  } catch (error) {
    genericError(res, 'updateVendorEmail', error)
  }
}

const signQuotationDocument = async (req, res) => {
  try {
    const rawRefNo = req.params.refNo ?? req.params[0]
    const refNo = rawRefNo ? decodeURIComponent(rawRefNo) : rawRefNo
    const { uniqueCode, signedDate, signedFrom, signedIP, signedDevice, signedLocation } = req.body

    if (!refNo) return badRequest(res, 'Reference number is required')
    if (!uniqueCode || !signedDate || !signedFrom) {
      return badRequest(res, 'uniqueCode, signedDate, and signedFrom are required')
    }

    const result = await quotationSigning.signQuotation(refNo, {
      uniqueCode,
      signedDate,
      signedFrom,
      signedIP,
      signedDevice,
      signedLocation,
    })

    sendSuccess(res, { success: true, message: result.message, data: result.data })
  } catch (error) {
    logger.error('[quotation.controller] signQuotationDocument:', error)
    res.status(error.status || HTTP.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message || 'Signing failed' })
  }
}

module.exports = {
  createQuotation,
  getQuotations,
  getQuotationByRef,
  updateQuotation,
  deleteQuotation,
  getCompanyDetails,
  getQuotationsByDateRange,
  getQuotationsByCompany,
  getLatestQuotation,
  getLatestQuotationRefNo,
  downloadQuotation,
  submitQuotation,
  emailQuotation,
  sendQuotationViaEmail,
  updateVendorEmail,
  signQuotationDocument
}