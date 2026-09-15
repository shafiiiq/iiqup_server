const logger = require('#shared/logger/logger');
const { sendError } = require('#shared/response/response.sender');
const { renderPageToPdf } = require('./pdf.service');

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

module.exports = { renderPdf };
