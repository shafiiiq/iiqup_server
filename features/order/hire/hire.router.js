const express = require('express')
const router = express.Router()
const multer = require('multer')
const controller = require('./hire.controller')
const { paginationMiddleware } = require('#middlewares/pagination.middleware')

const upload = multer({ storage: multer.memoryStorage() })

router.get('/get-all-hire-orders', paginationMiddleware, controller.getAllHireOrders)
router.get('/company-details', controller.getCompanyDetails)
router.get('/check-latest-hire-order-ref', controller.getLatestHireOrderRef)
router.get('/get-hire-order-by-ref/:refNo(*)', controller.getHireOrderByRef)

router.post('/add-hire-order', controller.addHireOrder)
router.post('/upload-hire-order', controller.uploadHireOrder)
router.post('/sign/:refNo(*)', controller.signHireOrder)
router.post('/pending-signatures', controller.getPendingSignatures)
router.post('/who-signed', controller.getSignedByUser)

router.put('/update-hire-order/:refNo(*)', controller.updateHireOrder)
router.delete('/delete-hire-order/:refNo', controller.deleteHireOrder)

router.post(
  '/send-via-email',
  upload.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'attachments', maxCount: 10 },
  ]),
  controller.sendHireOrderViaEmail
)

module.exports = router