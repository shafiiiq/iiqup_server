const { registerPdfSource } = require('#core/pdf/document.pdf.registry')
const { bindDocumentPdf } = require('#core/pdf/document.pdf.binding')
const { buildDocumentPdfVersion } = require('#core/pdf/document.pdf.version')
const Backcharge = require('./backcharge.model')
const { resolveEffectiveContent } = require('./backcharge.content')
const { buildBackchargeDocumentPath } = require('./backcharge.pdf')

const BACKCHARGE_PDF_SOURCE_KEY = 'backcharge'

const buildBackchargePdfVersion = (backcharge) =>
  buildDocumentPdfVersion({
    content: resolveEffectiveContent(backcharge),
    authorizedSignatoryName: backcharge.signatures?.authorizedSignatory?.authorizedSignatoryName,
    signedState: {
      workshopManager: backcharge.signatures?.workshopManager?.signed,
      purchaseManager: backcharge.signatures?.purchaseManager?.signed,
      operationsManager: backcharge.signatures?.operationsManager?.signed,
      authorizedSignatory: backcharge.signatures?.authorizedSignatory?.signed,
    },
  })

registerPdfSource(BACKCHARGE_PDF_SOURCE_KEY, {
  model: Backcharge,
  referenceField: 'refNo',
  s3Prefix: 'backcharges',
  buildVersion: buildBackchargePdfVersion,
  buildRenderPath: (backcharge) => buildBackchargeDocumentPath(backcharge.refNo),
})

const backchargePdf = bindDocumentPdf(BACKCHARGE_PDF_SOURCE_KEY)

module.exports = { BACKCHARGE_PDF_SOURCE_KEY, backchargePdf }