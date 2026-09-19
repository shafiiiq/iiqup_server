const express = require('express')
const multer = require('multer')
const controller = require('./backcharge.controller')
const statisticsController = require('./backcharge.statistics.controller')
const { paginationMiddleware } = require('../../middlewares/pagination.middleware')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

router.get('/get-backcharge-reports', paginationMiddleware, controller.getAllBackchargeReports)
router.get('/get-backcharge/:id', controller.getBackchargeById)
router.get('/get-backcharge-by-ref/:refNo', controller.getBackchargeByRefNo)
router.get('/check-latest-backcharge-ref', controller.getLatestBackchargeRef)
router.post('/add-backcharge', controller.addBackcharge)
router.put('/update-backcharge/:id', controller.updateBackcharge)
router.delete('/delete-backcharge/:id', controller.deleteBackcharge)

router.get('/stats/totals', statisticsController.getBackchargeTotals)
router.get('/stats/summary', statisticsController.getBackchargeSummary)
router.get('/stats/series', statisticsController.getBackchargeSeries)
router.get('/stats/growth', statisticsController.getBackchargeGrowth)

router.post('/send-via-email', upload.single('pdf'), controller.sendBackchargeToEmail)
router.put('/update-supplier-email/:supplierCode', controller.updateSupplierEmail)

router.get('/equipment/search', controller.searchEquipmentByPlate)
router.get('/suppliers/search', controller.searchSuppliers)
router.get('/sites/search', controller.searchSites)

router.post('/sign/:refNo(*)', controller.signBackcharge)
router.post('/pending-signatures', controller.getPendingSignatures)
router.post('/who-signed', controller.getSignedByUser)

module.exports = router