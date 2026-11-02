const { dispatchBroadcastWebSocketEvent } = require('#core/socket/socket.io')
const { PDF_STATUS_SOCKET_EVENT } = require('./document.pdf.constant')

const notifyDocumentPdfStatus = ({ sourceKey, documentId, version, status }) =>
  dispatchBroadcastWebSocketEvent(PDF_STATUS_SOCKET_EVENT, { sourceKey, documentId, version, status })

module.exports = { notifyDocumentPdfStatus }