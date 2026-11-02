const logger = require('#shared/logger/logger');
const { sendError } = require('#shared/response/response.sender');
const { renderPageToPdf } = require('./pdf.service');
const { checkDocumentPdfReady } = require('./document.pdf.access');

const renderPdf = async (req, res) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: 'Authentication required' });
    }

    const { path, width, height, download, fileName } = req.body;
    if (!path)
      return res
        .status(400)
        .json({ success: false, message: 'path is required' });

    const pdfBuffer = await renderPageToPdf(path, req.user, { width, height });

    res.set('Content-Type', 'application/pdf');
    res.set(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename="${fileName || 'document.pdf'}"`
    );
    return res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    logger.error('[pdf.controller] renderPdf:', error);
    return sendError(res, {
      success: false,
      message: error.message || 'Failed to render PDF',
    });
  }
};

const getDocumentPdfStatus = async (req, res) => {
  try {
    const { sourceKey } = req.params;
    const { documentId } = req.query;
    if (!documentId) {
      return res.status(400).json({ success: false, message: 'documentId is required' });
    }

    const isReady = await checkDocumentPdfReady({ sourceKey, documentId, user: req.user });
    return res.status(200).json({ success: true, data: { isReady } });
  } catch (error) {
    logger.error('[pdf.controller] getDocumentPdfStatus:', error);
    return sendError(res, { status: error.status || 500, message: error.message });
  }
};

module.exports = { renderPdf, getDocumentPdfStatus };
