const documentModel          = require('../models/document.model');
const path                   = require('path');
const { PDFDocument }        = require('pdf-lib');
const { putObject, deleteObject } = require('../aws/s3.aws');
const { createNotification } = require('./notification.service');
const PushNotificationService = require('../push/notification.push');
const { default: wsUtils } = require('../sockets/websocket.js');
const analyser = require('../analyser/dashboard.analyser');
const {
  formatDate,
  formatDateTime,
  getSourceDetailsAndKey,
  resolveSourceIdentifier,
  downloadPDFFromS3,
  uploadPDFToS3
} = require('../helpers/document.helper');

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uploads a document file to S3 and persists its metadata in the database.
 * @param {string} sourceId
 * @param {string} sourceType
 * @param {string} documentType
 * @param {object} file
 * @param {string} description
 * @param {string} category
 * @param {string} date
 * @param {string} expiry
 * @returns {Promise<object>}
 */
const saveDocument = async (sourceId, sourceType, documentType, file, description, category, date, expiry) => {
  try {
    const ext           = path.extname(file.fileName);
    const finalFilename = `${documentType}-${formatDateTime()}${ext}`;

    const { sourceData, s3Key, sourceModel } = await getSourceDetailsAndKey(sourceId, sourceType, documentType, finalFilename);

    const uploadUrl = await putObject(file.fileName, s3Key, file.mimeType);

    let document = await documentModel.findOne({ SourceId: sourceId, documentType });

    if (!document) {
      document = new documentModel({
        SourceId: sourceId,
        documentType,
        description,
        category,
        files: [],
        documentSource: [{ source: sourceType, sourceId, sourceModel }]
      });
    }

    const formattedDate   = date   ? formatDate(date)   : null;
    const formattedExpiry = expiry ? formatDate(expiry) : null;

    if (!formattedDate || !formattedExpiry) {
      throw new Error('Date and expiry are required and must be valid dates');
    }

    document.files.push({
      date:     formattedDate,
      expiry:   formattedExpiry,
      filename: finalFilename,
      path:     s3Key,
      mimetype: file.mimeType || file.fileName.split('.').pop()
    });

    const sourceIdentifier = resolveSourceIdentifier(sourceType, sourceData);
    const notifMessage     = `Document ${documentType} is uploaded for ${sourceIdentifier} (${sourceType}), Now you can access new one`;

    const notification = await createNotification({ 
      title:    'New document added',
      description: notifMessage,
      priority: 'high',
      sourceId: 'from applications',
      time:     new Date()
    });

    await PushNotificationService.sendGeneralNotification(
      null, 'New document added', notifMessage, 'high', 'normal', notification.data._id.toString()
    );

    analyser.clearCache();
    wsUtils.sendDashboardUpdate('documents');

    await document.save();

    return { status: 200, message: 'Document uploaded successfully', uploadUrl, finalFilename, s3Key, document };
  } catch (error) {
    console.error('[DocumentService] saveDocument:', error);
    return { status: 500, message: 'Failed to save document', error: error.message };
  }
};

/**
 * Renames the display name of a specific file inside a document.
 * @param {string} documentId  The file's _id.
 * @param {string} newFileName
 * @returns {Promise<object>}
 */
const renameFile = async (documentId, newFileName) => {
  try {
    const document = await documentModel.findOne({ 'files._id': documentId });
    if (!document) return { status: 404, message: 'Document not found' };

    const file = document.files.find(f => f._id.toString() === documentId);
    if (!file) return { status: 404, message: 'File not found' };

    file.displayFileName = newFileName;
    await document.save();

    return {
      status: 200,
      message: 'File renamed successfully',
      file: { _id: file._id, displayFileName: file.displayFileName, filename: file.filename }
    };
  } catch (error) {
    console.error('[DocumentService] renameFile:', error);
    return { status: 500, message: 'Failed to rename file', error: error.message };
  }
};

/**
 * Deletes a specific file from S3 and removes it from the document record.
 * Deletes the entire document record if no files remain.
 * @param {string} documentId  The file's _id.
 * @returns {Promise<object>}
 */
const deleteDocument = async (documentId) => {
  try {
    const document = await documentModel.findOne({ 'files._id': documentId });
    if (!document) return { status: 404, message: 'Document not found' };

    const file = document.files.find(f => f._id.toString() === documentId);
    if (!file) return { status: 404, message: 'File not found' };

    try {
      await deleteObject(file.path);
    } catch (s3Error) {
      console.error('[DocumentService] deleteDocument — S3 delete failed:', s3Error);
    }

    document.files = document.files.filter(f => f._id.toString() !== documentId);

    if (document.files.length === 0) {
      await documentModel.findByIdAndDelete(document._id);
    } else {
      await document.save();
    }

    const sourceType = document.documentSource[0]?.source;
    let   sourceIdentifier = document.SourceId;

    try {
      const { sourceData } = await getSourceDetailsAndKey(document.SourceId, sourceType, 'temp', 'temp.pdf');
      sourceIdentifier     = resolveSourceIdentifier(sourceType, sourceData);
    } catch (_) { /* fallback to SourceId */ }

    const notifMessage = `Document ${file.filename} was deleted for ${sourceIdentifier} (${sourceType})`;

    const notification = await createNotification({
      title:       'Document deleted',
      description: notifMessage,
      priority:    'normal',
      sourceId:    'from applications',
      time:        new Date()
    });

    await PushNotificationService.sendGeneralNotification(
      null, 'Document deleted', notifMessage, 'normal', 'normal', notification.data._id.toString()
    );

    return {
      status: 200,
      message: 'Document deleted successfully',
      deletedFile: { filename: file.filename, path: file.path }
    };
  } catch (error) {
    console.error('[DocumentService] deleteDocument:', error);
    return { status: 500, message: 'Failed to delete document', error: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all document records belonging to a specific source.
 * @param {string} sourceType
 * @param {string} sourceId
 * @returns {Promise<object>}
 */
const getDocuments = async (sourceType, sourceId) => {
  try {
    const { sourceData } = await getSourceDetailsAndKey(sourceId, sourceType, 'temp', 'temp.pdf');
    if (!sourceData) return { status: 404, message: `${sourceType} not found` };

    const documents = await documentModel.find({ SourceId: sourceId, 'documentSource.source': sourceType });

    return { status: 200, documents };
  } catch (error) {
    console.error('[DocumentService] getDocuments:', error);
    return { status: 500, message: 'Failed to retrieve documents', error: error.message };
  }
};

/**
 * Returns all document records in the system.
 * @returns {Promise<object>}
 */
const getAllDocuments = async () => { 
  try {
    const documents = await documentModel.find({});
    return { status: 200, documents };
  } catch (error) {
    console.error('[DocumentService] getAllDocuments:', error);
    return { status: 500, message: 'Failed to retrieve documents', error: error.message };
  }
};

/**
 * Returns only the documentType field for all document records.
 * @returns {Promise<object>}
 */
const getAllDocumentsTypes = async () => {
  try {
    const documents = await documentModel.find({}).select('documentType');
    return { status: 200, documents };
  } catch (error) {
    console.error('[DocumentService] getAllDocumentsTypes:', error);
    return { status: 500, message: 'Failed to retrieve documents', error: error.message };
  }
};

/**
 * Returns metadata for a single file by its _id.
 * @param {string} documentId  The file's _id.
 * @returns {Promise<object>}
 */
const getDocumentById = async (documentId) => {
  try {
    const document = await documentModel.findOne({ 'files._id': documentId });
    if (!document) return { status: 404, message: 'Document not found' };

    const file = document.files.find(f => f._id.toString() === documentId);
    if (!file) return { status: 404, message: 'File not found' };

    return {
      status: 200,
      document: {
        filePath:     file.path,
        filename:     file.filename,
        mimetype:     file.mimetype,
        sourceId:     document.SourceId,
        documentType: document.documentType,
        sourceType:   document.documentSource[0]?.source
      }
    };
  } catch (error) {
    console.error('[DocumentService] getDocumentById:', error);
    return { status: 500, message: 'Failed to retrieve document', error: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Merges multiple PDF files into a single PDF and saves it to S3 and the database.
 * @param {string}   sourceId
 * @param {string}   sourceType
 * @param {string[]} documentIds  Array of file _ids to merge.
 * @param {string}   category
 * @param {string}   documentType
 * @returns {Promise<object>}
 */
const mergePDFs = async (sourceId, sourceType, documentIds, category, documentType) => {
  try {
    const { sourceModel } = await getSourceDetailsAndKey(sourceId, sourceType, 'temp', 'temp.pdf');

    const mergedPdf = await PDFDocument.create();

    const documentsData = await Promise.all(
      documentIds.map(async (docId) => {
        const document = await documentModel.findOne({ 'files._id': docId });
        if (!document) throw new Error(`Document with file ID ${docId} not found`);

        const file = document.files.find(f => f._id.toString() === docId);
        if (!file) throw new Error(`File ${docId} not found in document`);

        if (!file.mimetype.includes('pdf')) {
          throw new Error(`File ${file.filename} is not a PDF. Only PDFs can be merged.`);
        }

        return { file, document };
      })
    );

    for (const { file } of documentsData) {
      try {
        const pdfBuffer   = await downloadPDFFromS3(file.path);
        const pdf         = await PDFDocument.load(pdfBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach(page => mergedPdf.addPage(page));
      } catch (error) {
        console.error(`[DocumentService] mergePDFs — error processing ${file.filename}:`, error);
        throw new Error(`Failed to process ${file.filename}: ${error.message}`);
      }
    }

    const mergedPdfBytes = await mergedPdf.save();
    const mergedFilename = `${documentType}-merged-${formatDateTime()}.pdf`;

    const { s3Key } = await getSourceDetailsAndKey(sourceId, sourceType, documentType, mergedFilename);

    await uploadPDFToS3(mergedPdfBytes, s3Key);

    let document = await documentModel.findOne({ SourceId: sourceId, documentType });

    if (!document) {
      document = new documentModel({
        SourceId: sourceId,
        documentType,
        description:    `Merged PDF created from ${documentIds.length} documents`,
        category,
        files:          [],
        documentSource: [{ source: sourceType, sourceId, sourceModel }]
      });
    }

    const dates        = documentsData.map(d => d.file.date).filter(Boolean);
    const expiries     = documentsData.map(d => d.file.expiry).filter(Boolean);
    const earliestDate = dates.length   > 0 ? dates.sort()[0]           : formatDate(new Date());
    const latestExpiry = expiries.length > 0 ? expiries.sort().reverse()[0] : formatDate(new Date());

    document.files.push({
      date:     earliestDate,
      expiry:   latestExpiry,
      filename: mergedFilename,
      path:     s3Key,
      mimetype: 'application/pdf'
    });

    await PushNotificationService.sendGeneralNotification(
      process.env.SUPER_ADMIN,
      'PDFs Merged',
      `${documentIds.length} PDFs merged successfully for ${sourceType}`,
      'normal',
      'normal'
    );

    await document.save();

    return {
      status:  200,
      message: 'PDFs merged successfully',
      document: { filename: mergedFilename, path: s3Key, pageCount: mergedPdf.getPageCount(), mergedFrom: documentIds.length }
    };
  } catch (error) {
    console.error('[DocumentService] mergePDFs:', error);
    return { status: 500, message: 'Failed to merge PDFs', error: error.message };
  }
};

/**
 * Splits a PDF into one or more new PDFs based on the provided split options.
 * @param {string} sourceId
 * @param {string} sourceType
 * @param {string} documentId    The file's _id.
 * @param {object} splitOptions  { splitType: 'specific'|'range'|'every', pages: number[]|number[][] }
 * @param {string} category
 * @returns {Promise<object>}
 */
const splitPDF = async (sourceId, sourceType, documentId, splitOptions, category) => {
  try {
    const { sourceModel } = await getSourceDetailsAndKey(sourceId, sourceType, 'temp', 'temp.pdf');

    const document = await documentModel.findOne({ 'files._id': documentId });
    if (!document) return { status: 404, message: 'Document not found' };

    const file = document.files.find(f => f._id.toString() === documentId);
    if (!file)                          return { status: 404, message: 'File not found' };
    if (!file.mimetype.includes('pdf')) return { status: 400, message: 'Only PDF files can be split' };

    const pdfBuffer  = await downloadPDFFromS3(file.path);
    const pdf        = await PDFDocument.load(pdfBuffer);
    const totalPages = pdf.getPageCount();

    const { pages, splitType } = splitOptions;
    let pagesToExtract = [];

    if (splitType === 'specific') {
      pagesToExtract = pages.filter(p => p > 0 && p <= totalPages);
    } else if (splitType === 'range') {
      pages.forEach(([start, end]) => {
        for (let i = start; i <= end && i <= totalPages; i++) pagesToExtract.push(i);
      });
    } else if (splitType === 'every') {
      const pageSize = pages[0] || 1;
      for (let i = 1; i <= totalPages; i += pageSize) pagesToExtract.push(i);
    } else {
      return { status: 400, message: 'Invalid split type. Use: specific, range, or every' };
    }

    if (pagesToExtract.length === 0) return { status: 400, message: 'No valid pages to extract' };

    const splitDocuments = [];

    if (splitType === 'every') {
      const pageSize = pages[0] || 1;

      for (let i = 0; i < totalPages; i += pageSize) {
        const newPdf   = await PDFDocument.create();
        const endPage  = Math.min(i + pageSize, totalPages);

        for (let pageNum = i; pageNum < endPage; pageNum++) {
          const [copiedPage] = await newPdf.copyPages(pdf, [pageNum]);
          newPdf.addPage(copiedPage);
        }

        const pdfBytes      = await newPdf.save();
        const splitFilename = `${document.documentType}-split-${i + 1}-to-${endPage}-${formatDateTime()}.pdf`;
        const { s3Key }     = await getSourceDetailsAndKey(sourceId, sourceType, document.documentType, splitFilename);

        await uploadPDFToS3(pdfBytes, s3Key);

        splitDocuments.push({ filename: splitFilename, path: s3Key, pages: `${i + 1}-${endPage}`, pageCount: newPdf.getPageCount() });
      }
    } else {
      const newPdf       = await PDFDocument.create();
      const pageIndices  = pagesToExtract.map(p => p - 1);
      const copiedPages  = await newPdf.copyPages(pdf, pageIndices);

      copiedPages.forEach(page => newPdf.addPage(page));

      const pdfBytes      = await newPdf.save();
      const splitFilename = `${document.documentType}-split-pages-${pagesToExtract.join('-')}-${formatDateTime()}.pdf`;
      const { s3Key }     = await getSourceDetailsAndKey(sourceId, sourceType, document.documentType, splitFilename);

      await uploadPDFToS3(pdfBytes, s3Key);

      splitDocuments.push({ filename: splitFilename, path: s3Key, pages: pagesToExtract.join(', '), pageCount: newPdf.getPageCount() });
    }

    for (const splitDoc of splitDocuments) {
      let doc = await documentModel.findOne({ SourceId: sourceId, documentType: `${document.documentType} (Split)` });

      if (!doc) {
        doc = new documentModel({
          SourceId:       sourceId,
          documentType:   `${document.documentType} (Split)`,
          description:    `Split from ${file.filename}`,
          category:       category || document.category,
          files:          [],
          documentSource: [{ source: sourceType, sourceId, sourceModel }]
        });
      }

      doc.files.push({
        date:     file.date,
        expiry:   file.expiry,
        filename: splitDoc.filename,
        path:     splitDoc.path,
        mimetype: 'application/pdf'
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

    return { status: 200, message: 'PDF split successfully', documents: splitDocuments, totalSplits: splitDocuments.length };
  } catch (error) {
    console.error('[DocumentService] splitPDF:', error);
    return { status: 500, message: 'Failed to split PDF', error: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  saveDocument,
  renameFile,
  deleteDocument,
  getDocuments,
  getAllDocuments,
  getAllDocumentsTypes,
  getDocumentById,
  mergePDFs,
  splitPDF
};