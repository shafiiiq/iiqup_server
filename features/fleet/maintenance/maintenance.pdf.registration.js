const { registerPdfSource } = require('#core/pdf/document.pdf.registry')
const { bindDocumentPdf } = require('#core/pdf/document.pdf.binding')
const { buildDocumentPdfVersion } = require('#core/pdf/document.pdf.version')
const Maintenance = require('./maintenance.model')
const { resolveEffectiveContent } = require('./maintenance.content')
const { buildMaintenanceDocumentPath } = require('./maintenance.pdf')

const MAINTENANCE_PDF_SOURCE_KEY = 'maintenance'

const buildMaintenancePdfVersion = (maintenance) =>
  buildDocumentPdfVersion({
    content: resolveEffectiveContent(maintenance),
    revision: maintenance.revision || 0,
    supervisorSigned: maintenance.supervisorSigned,
  })

registerPdfSource(MAINTENANCE_PDF_SOURCE_KEY, {
  model: Maintenance,
  referenceField: '_id',
  s3Prefix: 'maintenance/reports',
  buildVersion: buildMaintenancePdfVersion,
  buildRenderPath: (maintenance) => buildMaintenanceDocumentPath(String(maintenance._id)),
})

const maintenancePdf = bindDocumentPdf(MAINTENANCE_PDF_SOURCE_KEY)

module.exports = { MAINTENANCE_PDF_SOURCE_KEY, maintenancePdf }