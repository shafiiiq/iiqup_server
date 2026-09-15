const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const documentModel = require('./document.model');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { putObject, deleteObject } = require('#core/s3/s3.config');
const { paginate } = require('#shared/pagination/pagination');
const PushNotificationService = require('#core/notification/notification.push');
const wsUtils = require('#core/socket/socket.io');
const dashboardServices = require('#features/dashboard/dashboard.service');
const {
  formatDate,
  formatTimestampForFilename,
  resolveSourceAndBuildS3Key,
  resolveSourceDisplayName,
  downloadPdfBufferFromS3,
  uploadPdfBytesToS3,
} = require('./document.helper');

const saveDocument = async (sourceId, sourceType, documentType, file, description, category, date, expiry) => {
  try {
    const extension = path.extname(file.fileName);
    const finalFilename = `${documentType}-${formatTimestampForFilename()}${extension}`;

    const { sourceData, s3Key, sourceModel } = await resolveSourceAndBuildS3Key(sourceId, sourceType, documentType, finalFilename);

    const uploadUrl = await putObject(file.fileName, s3Key, file.mimeType);

    let document = await documentModel.findOne({ SourceId: sourceId, documentType });

    if (!document) {
      document = new documentModel({
        SourceId: sourceId,
        documentType,
        description,
        category,
        files: [],
        documentSource: [{ source: sourceType, sourceId, sourceModel }],
      });
    }

    const formattedDate = date ? formatDate(date) : null;
    const formattedExpiry = expiry ? formatDate(expiry) : null;

    if (!formattedDate || !formattedExpiry) {
      throw new Error('Date and expiry are required and must be valid dates');
    }

    document.files.push({
      date: formattedDate,
      expiry: formattedExpiry,
      filename: finalFilename,
      path: s3Key,
      mimetype: file.mimeType || file.fileName.split('.').pop(),
    });

    const sourceDisplayName = resolveSourceDisplayName(sourceType, sourceData);
    const notificationMessage = `Document ${documentType} is uploaded for ${sourceDisplayName} (${sourceType}), Now you can access new one`;

    notifyUsers(null, {
      priority: 'high',
      title: 'New document added',
      description: notificationMessage,
      priority: 'high',
      type: 'normal',
      sourceId: 'documents',
      time: new Date(),
    })

    dashboardServices.clearDashboardCache();
    wsUtils.dispatchDashboardUpdate('documents');

    await document.save();

    return {
      status: HTTP.OK,
      message: 'Document uploaded successfully',
      uploadUrl,
      finalFilename,
      s3Key,
      document,
    };
  } catch (error) {
    logger.error('[document.service] saveDocument', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to save document', error: error.message };
  }
};

const renameFile = async (documentId, newFileName) => {
  try {
    const document = await documentModel.findOne({ 'files._id': documentId });
    if (!document) return { status: HTTP.NOT_FOUND, message: 'Document not found' };

    const file = document.files.find((f) => f._id.toString() === documentId);
    if (!file) return { status: HTTP.NOT_FOUND, message: 'File not found' };

    file.displayFileName = newFileName;
    await document.save();

    return {
      status: HTTP.OK,
      message: 'File renamed successfully',
      file: { _id: file._id, displayFileName: file.displayFileName, filename: file.filename },
    };
  } catch (error) {
    logger.error('[document.service] renameFile', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to rename file', error: error.message };
  }
};

const deleteDocument = async (documentId) => {
  try {
    const document = await documentModel.findOne({ 'files._id': documentId });
    if (!document) return { status: HTTP.NOT_FOUND, message: 'Document not found' };

    const file = document.files.find((f) => f._id.toString() === documentId);
    if (!file) return { status: HTTP.NOT_FOUND, message: 'File not found' };

    try {
      await deleteObject(file.path);
    } catch (s3Error) {
      logger.error('[document.service] deleteDocument S3 delete failed', s3Error);
    }

    document.files = document.files.filter((f) => f._id.toString() !== documentId);

    if (document.files.length === 0) {
      await documentModel.findByIdAndDelete(document._id);
    } else {
      await document.save();
    }

    const sourceType = document.documentSource[0]?.source;
    let sourceDisplayName = document.SourceId;

    try {
      const { sourceData } = await resolveSourceAndBuildS3Key(document.SourceId, sourceType, 'temp', 'temp.pdf');
      sourceDisplayName = resolveSourceDisplayName(sourceType, sourceData);
    } catch (lookupError) {
      logger.error('[document.service] deleteDocument source lookup failed', lookupError);
    }

    const notificationMessage = `Document ${file.filename} was deleted for ${sourceDisplayName} (${sourceType})`;

    notifyUsers(null, {
      priority: 'high',
      title: 'Document deleted',
      description: notificationMessage,
      priority: 'normal',
      type: 'normal',
      sourceId: 'documents',
      time: new Date(),
    })

    return {
      status: HTTP.OK,
      message: 'Document deleted successfully',
      deletedFile: { filename: file.filename, path: file.path },
    };
  } catch (error) {
    logger.error('[document.service] deleteDocument', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to delete document', error: error.message };
  }
};

const getDocumentsBySource = async (sourceType, sourceId, pagination) => {
  try {
    const { sourceData } = await resolveSourceAndBuildS3Key(sourceId, sourceType, 'temp', 'temp.pdf');
    if (!sourceData) return { status: HTTP.NOT_FOUND, message: `${sourceType} not found` };

    const result = await paginate(
      documentModel,
      { SourceId: sourceId, 'documentSource.source': sourceType },
      pagination,
      { sort: { createdAt: -1 } }
    );

    return { status: HTTP.OK, data: result.data, pagination: result.pagination };
  } catch (error) {
    logger.error('[document.service] getDocumentsBySource', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to retrieve documents', error: error.message };
  }
};

const getAllDocuments = async (pagination) => {
  try {
    const result = await paginate(documentModel, {}, pagination, { sort: { createdAt: -1 } });
    return { status: HTTP.OK, data: result.data, pagination: result.pagination };
  } catch (error) {
    logger.error('[document.service] getAllDocuments', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to retrieve documents', error: error.message };
  }
};

const getAllDocumentTypes = async (pagination) => {
  try {
    const result = await paginate(documentModel, {}, pagination, { sort: { createdAt: -1 }, projection: 'documentType' });
    return { status: HTTP.OK, data: result.data, pagination: result.pagination };
  } catch (error) {
    logger.error('[document.service] getAllDocumentTypes', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to retrieve documents', error: error.message };
  }
};

const getDocumentFileById = async (documentId) => {
  try {
    const document = await documentModel.findOne({ 'files._id': documentId });
    if (!document) return { status: HTTP.NOT_FOUND, message: 'Document not found' };

    const file = document.files.find((f) => f._id.toString() === documentId);
    if (!file) return { status: HTTP.NOT_FOUND, message: 'File not found' };

    return {
      status: HTTP.OK,
      document: {
        filePath: file.path,
        filename: file.filename,
        mimetype: file.mimetype,
        sourceId: document.SourceId,
        documentType: document.documentType,
        sourceType: document.documentSource[0]?.source,
      },
    };
  } catch (error) {
    logger.error('[document.service] getDocumentFileById', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to retrieve document', error: error.message };
  }
};

const mergePDFs = async (sourceId, sourceType, documentIds, category, documentType) => {
  try {
    const { sourceModel } = await resolveSourceAndBuildS3Key(sourceId, sourceType, 'temp', 'temp.pdf');

    const mergedPdf = await PDFDocument.create();

    const documentsData = await Promise.all(
      documentIds.map(async (fileId) => {
        const document = await documentModel.findOne({ 'files._id': fileId });
        if (!document) throw new Error(`Document with file ID ${fileId} not found`);

        const file = document.files.find((f) => f._id.toString() === fileId);
        if (!file) throw new Error(`File ${fileId} not found in document`);

        if (!file.mimetype.includes('pdf')) {
          throw new Error(`File ${file.filename} is not a PDF. Only PDFs can be merged.`);
        }

        return { file, document };
      })
    );

    for (const { file } of documentsData) {
      try {
        const pdfBuffer = await downloadPdfBufferFromS3(file.path);
        const pdf = await PDFDocument.load(pdfBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      } catch (error) {
        logger.error(`[document.service] mergePDFs processing ${file.filename}`, error);
        throw new Error(`Failed to process ${file.filename}: ${error.message}`);
      }
    }

    const mergedPdfBytes = await mergedPdf.save();
    const mergedFilename = `${documentType}-merged-${formatTimestampForFilename()}.pdf`;

    const { s3Key } = await resolveSourceAndBuildS3Key(sourceId, sourceType, documentType, mergedFilename);

    await uploadPdfBytesToS3(mergedPdfBytes, s3Key);

    let document = await documentModel.findOne({ SourceId: sourceId, documentType });

    if (!document) {
      document = new documentModel({
        SourceId: sourceId,
        documentType,
        description: `Merged PDF created from ${documentIds.length} documents`,
        category,
        files: [],
        documentSource: [{ source: sourceType, sourceId, sourceModel }],
      });
    }

    const fileDates = documentsData.map((entry) => entry.file.date).filter(Boolean);
    const fileExpiries = documentsData.map((entry) => entry.file.expiry).filter(Boolean);
    const earliestDate = fileDates.length > 0 ? fileDates.sort()[0] : formatDate(new Date());
    const latestExpiry = fileExpiries.length > 0 ? fileExpiries.sort().reverse()[0] : formatDate(new Date());

    document.files.push({
      date: earliestDate,
      expiry: latestExpiry,
      filename: mergedFilename,
      path: s3Key,
      mimetype: 'application/pdf',
    });

    notifyUsers(null, {
      priority: 'high',
      title: 'PDFs Merged',
      description: `${documentIds.length} PDFs merged successfully for ${sourceType}`,
      priority: 'normal',
      type: 'normal',
      sourceId: 'documents',
      time: new Date(),
    })

    await document.save();

    return {
      status: HTTP.OK,
      message: 'PDFs merged successfully',
      document: {
        filename: mergedFilename,
        path: s3Key,
        pageCount: mergedPdf.getPageCount(),
        mergedFrom: documentIds.length,
      },
    };
  } catch (error) {
    logger.error('[document.service] mergePDFs', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to merge PDFs', error: error.message };
  }
};

const splitPDF = async (sourceId, sourceType, documentId, splitOptions, category) => {
  try {
    const { sourceModel } = await resolveSourceAndBuildS3Key(sourceId, sourceType, 'temp', 'temp.pdf');

    const document = await documentModel.findOne({ 'files._id': documentId });
    if (!document) return { status: HTTP.NOT_FOUND, message: 'Document not found' };

    const file = document.files.find((f) => f._id.toString() === documentId);
    if (!file) return { status: HTTP.NOT_FOUND, message: 'File not found' };
    if (!file.mimetype.includes('pdf')) return { status: HTTP.BAD_REQUEST, message: 'Only PDF files can be split' };

    const pdfBuffer = await downloadPdfBufferFromS3(file.path);
    const pdf = await PDFDocument.load(pdfBuffer);
    const totalPages = pdf.getPageCount();

    const { pages, splitType } = splitOptions;
    let pagesToExtract = [];

    if (splitType === 'specific') {
      pagesToExtract = pages.filter((page) => page > 0 && page <= totalPages);
    } else if (splitType === 'range') {
      pages.forEach(([start, end]) => {
        for (let page = start; page <= end && page <= totalPages; page++) pagesToExtract.push(page);
      });
    } else if (splitType === 'every') {
      const pageSize = pages[0] || 1;
      for (let page = 1; page <= totalPages; page += pageSize) pagesToExtract.push(page);
    } else {
      return { status: HTTP.BAD_REQUEST, message: 'Invalid split type. Use: specific, range, or every' };
    }

    if (pagesToExtract.length === 0) return { status: HTTP.BAD_REQUEST, message: 'No valid pages to extract' };

    const splitDocuments = [];

    if (splitType === 'every') {
      const pageSize = pages[0] || 1;

      for (let start = 0; start < totalPages; start += pageSize) {
        const newPdf = await PDFDocument.create();
        const endPage = Math.min(start + pageSize, totalPages);

        for (let pageIndex = start; pageIndex < endPage; pageIndex++) {
          const [copiedPage] = await newPdf.copyPages(pdf, [pageIndex]);
          newPdf.addPage(copiedPage);
        }

        const pdfBytes = await newPdf.save();
        const splitFilename = `${document.documentType}-split-${start + 1}-to-${endPage}-${formatTimestampForFilename()}.pdf`;
        const { s3Key } = await resolveSourceAndBuildS3Key(sourceId, sourceType, document.documentType, splitFilename);

        await uploadPdfBytesToS3(pdfBytes, s3Key);

        splitDocuments.push({
          filename: splitFilename,
          path: s3Key,
          pages: `${start + 1}-${endPage}`,
          pageCount: newPdf.getPageCount(),
        });
      }
    } else {
      const newPdf = await PDFDocument.create();
      const pageIndices = pagesToExtract.map((page) => page - 1);
      const copiedPages = await newPdf.copyPages(pdf, pageIndices);

      copiedPages.forEach((page) => newPdf.addPage(page));

      const pdfBytes = await newPdf.save();
      const splitFilename = `${document.documentType}-split-pages-${pagesToExtract.join('-')}-${formatTimestampForFilename()}.pdf`;
      const { s3Key } = await resolveSourceAndBuildS3Key(sourceId, sourceType, document.documentType, splitFilename);

      await uploadPdfBytesToS3(pdfBytes, s3Key);

      splitDocuments.push({
        filename: splitFilename,
        path: s3Key,
        pages: pagesToExtract.join(', '),
        pageCount: newPdf.getPageCount(),
      });
    }

    for (const splitDoc of splitDocuments) {
      let doc = await documentModel.findOne({ SourceId: sourceId, documentType: `${document.documentType} (Split)` });

      if (!doc) {
        doc = new documentModel({
          SourceId: sourceId,
          documentType: `${document.documentType} (Split)`,
          description: `Split from ${file.filename}`,
          category: category || document.category,
          files: [],
          documentSource: [{ source: sourceType, sourceId, sourceModel }],
        });
      }

      doc.files.push({
        date: file.date,
        expiry: file.expiry,
        filename: splitDoc.filename,
        path: splitDoc.path,
        mimetype: 'application/pdf',
      });

      await doc.save();
    }

    await PushNotificationService.sendGeneralNotification(
      process.env.SUPER_ADMIN,
      'PDF Split',
      `PDF split into ${splitDocuments.length} document(s) for ${sourceType}`,
      'normal',
      'normal'
    );

    return {
      status: HTTP.OK,
      message: 'PDF split successfully',
      documents: splitDocuments,
      totalSplits: splitDocuments.length,
    };
  } catch (error) {
    logger.error('[document.service] splitPDF', error);
    return { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to split PDF', error: error.message };
  }
};

module.exports = {
  saveDocument,
  renameFile,
  deleteDocument,
  getDocumentsBySource,
  getAllDocuments,
  getAllDocumentTypes,
  getDocumentFileById,
  mergePDFs,
  splitPDF,
};