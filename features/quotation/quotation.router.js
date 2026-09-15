const express = require('express')
const multer = require('multer')
const controller = require('./quotation.controller')
const { paginationMiddleware } = require('#middlewares/pagination.middleware')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

router.post('/', controller.createQuotation)
router.get('/', paginationMiddleware, controller.getQuotations)
router.get('/company-details', controller.getCompanyDetails)
router.get('/by-date', controller.getQuotationsByDateRange)
router.get('/by-company/:vendorName', controller.getQuotationsByCompany)
router.get('/latest', controller.getLatestQuotation)
router.get('/latest-refno', controller.getLatestQuotationRefNo)

router.get('/pdf/download/:refNo(*)', controller.downloadQuotation)
router.post('/pdf/submit/:refNo(*)', controller.submitQuotation)
router.post('/sign/:refNo(*)', controller.signQuotationDocument)
router.post(
  '/pdf/email/:refNo(*)',
  upload.fields([{ name: 'attachments', maxCount: 10 }]),
  controller.emailQuotation
)

router.get('/:refNo(*)', controller.getQuotationByRef)
router.put('/:refNo(*)', controller.updateQuotation)
router.delete('/:refNo', controller.deleteQuotation)

router.post(
  '/send-via-email',
  upload.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'attachments', maxCount: 10 },
  ]),
  controller.sendQuotationViaEmail
)
router.put('/vendor-email/:vendorCode', controller.updateVendorEmail)

module.exports = router