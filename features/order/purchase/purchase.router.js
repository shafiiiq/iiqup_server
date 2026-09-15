const express = require('express')
const multer = require('multer')
const controller = require('./purchase.controller')
const statisticsController = require('./purchase.statistics.controller')
const { paginationMiddleware } = require('#middlewares/pagination.middleware')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

router.get('/', paginationMiddleware, controller.getPurchaseOrders)
router.post('/', controller.createPurchaseOrder)
router.get('/company-details', controller.getCompanyDetails)
router.get('/by-date', controller.getPurchaseOrdersByDateRange)
router.get('/by-company/:vendorName', controller.getPurchaseOrdersByCompany)
router.get('/equipment/:regNo', controller.getPurchaseOrderOfEquipment)
router.get('/of-stock', controller.getPurchaseOrderOfStocks)
router.get('/equipments', controller.getPurchaseOrdersOfEquipments)
router.get('/latest', controller.getLatestPurchaseOrder)
router.get('/latest-refno', controller.getLatestPurchaseOrderRefNo)

router.get('/stats/totals', statisticsController.getPurchaseOrderTotals)
router.get('/stats/summary', statisticsController.getPurchaseOrderSummary)
router.get('/stats/series', statisticsController.getPurchaseOrderSeries)
router.get('/stats/growth', statisticsController.getPurchaseOrderGrowth)

router.post('/get-quotation-upload-url', controller.getQuotationUploadUrl)
router.post('/upload', controller.uploadPurchaseOrder)
router.post('/sign/:purchaseorderRef(*)', controller.signPurchaseOrderDocument)
router.post('/pending-signatures', controller.getPendingSignatures)
router.post('/who-signed', controller.checkWhoSignedPurchaseOrder)

router.get('/pdf/download/:refNo(*)', controller.downloadPurchaseOrder)
router.post('/pdf/submit/:refNo(*)', controller.submitPurchaseOrder)
router.post(
  '/pdf/email/:refNo(*)',
  upload.fields([{ name: 'attachments', maxCount: 10 }]),
  controller.emailPurchaseOrder
)

router.get('/:refNo(*)', controller.getPurchaseOrderByRef)
router.put('/:refNo(*)', controller.updatePurchaseOrder)
router.delete('/:refNo', controller.deletePurchaseOrder)

router.post(
  '/send-via-email',
  upload.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'attachments', maxCount: 10 },
  ]),
  controller.sendPurchaseOrderViaEmail
)
router.put('/vendor-email/:vendorCode', controller.updateVendorEmail)

module.exports = router