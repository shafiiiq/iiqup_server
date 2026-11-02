const express = require('express')
const controller = require('./pdf.controller')

const router = express.Router()

router.post('/render', controller.renderPdf)
router.get('/documents/:sourceKey/status', controller.getDocumentPdfStatus)

module.exports = router