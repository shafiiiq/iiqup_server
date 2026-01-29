const documentModel = require('../models/document.model');
const equipmentModel = require('../models/equip.model');
const operatorModel = require('../models/operator.model');
const mechanicModel = require('../models/mechanic.model');
const userModel = require('../models/user.model');
const path = require('path');
const { createNotification } = require('../utils/notification-jobs');
const PushNotificationService = require('../utils/push-notification-jobs');
const { putObject, getObjectUrl, deleteObject } = require('../s3bucket/s3.bucket');
const { PDFDocument } = require('pdf-lib');

const formatDate = (date) => {
  if (!date) return null;

  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-');
    return `${day}-${month}-${year}`;
  }
  const dateObj = date instanceof Date ? date : new Date(date + 'T00:00:00');

  if (isNaN(dateObj.getTime())) {
    return null;
  }

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${day}-${month}-${year}`;
};

const formatDateTime = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear().toString().slice(-2);

  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';

  hours = hours % 12;
  hours = hours ? hours : 12;
  hours = String(hours).padStart(2, '0');

  return `${day}-${month}-${year}-${hours}${minutes}${ampm}`;
};

// Helper function to get source details and generate S3 key
const getSourceDetailsAndKey = async (sourceId, sourceType, documentType, finalFilename) => {
  let sourceData = null;
  let s3Key = '';
  let sourceModel = '';

  switch (sourceType) {
    case 'equipment':
      console.log("sourceId", sourceId);
      
      sourceData = await equipmentModel.findById(sourceId);
      if (!sourceData) {
        throw new Error('Equipment not found');
      }
      s3Key = `equipment-documents/${sourceData.regNo}/${documentType}/${finalFilename}`;
      sourceModel = 'Equipment Model';
      break;

    case 'operator':
      sourceData = await operatorModel.findById(sourceId);
      if (!sourceData) {
        throw new Error('Operator not found');
      }
      s3Key = `operator-documents/${sourceData.qatarId}/${documentType}/${finalFilename}`;
      sourceModel = 'Operator Model';
      break;

    case 'mechanic':
      sourceData = await mechanicModel.findById(sourceId);
      if (!sourceData) {
        throw new Error('Mechanic not found');
      }
      s3Key = `mechanic-documents/${sourceData.email}/${sourceData._id}/${documentType}/${finalFilename}`;
      sourceModel = 'Mechanic Model';
      break;

    case 'office-staff':
      sourceData = await userModel.findById(sourceId);
      if (!sourceData) {
        throw new Error('Office staff not found');
      }
      s3Key = `office-documents/${sourceData.email}/${sourceData._id}/${documentType}/${finalFilename}`;
      sourceModel = 'Office Model';
      break;

    default:
      throw new Error('Invalid source type');
  }

  return { sourceData, s3Key, sourceModel };
};

// Helper function to download PDF from S3
const downloadPDFFromS3 = async (s3Key) => {
  try {
    const url = await getObjectUrl(s3Key, false);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error('Error downloading PDF from S3:', err);
    throw new Error(`Failed to download PDF: ${err.message}`);
  }
};

// Helper function to upload PDF to S3
const uploadPDFToS3 = async (pdfBytes, s3Key, mimeType = 'application/pdf') => {
  try {
    // Step 1: Get presigned URL
    const uploadUrl = await putObject('merged.pdf', s3Key, mimeType);

    // Step 2: Actually upload the PDF bytes to S3 using the presigned URL
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: pdfBytes,
      headers: {
        'Content-Type': mimeType
      }
    });

    if (!uploadResponse.ok) {
      throw new Error(`S3 upload failed with status: ${uploadResponse.status}`);
    }

    console.log('Successfully uploaded PDF to S3:', s3Key);
    return uploadUrl;
  } catch (err) {
    console.error('Error uploading PDF to S3:', err);
    throw new Error(`Failed to upload PDF: ${err.message}`);
  }
};

module.exports = {
  saveDocument: async (sourceId, sourceType, documentType, file, description, category, date, expiry) => {
    try {
      // Generate filename
      const ext = path.extname(file.fileName);
      const finalFilename = `${documentType}-${formatDateTime()}${ext}`;

      // Get source details and S3 key
      const { sourceData, s3Key, sourceModel } = await getSourceDetailsAndKey(
        sourceId,
        sourceType,
        documentType,
        finalFilename
      );

      // Get presigned URL for upload
      const uploadUrl = await putObject(file.fileName, s3Key, file.mimeType);

      // Find or create document
      let document = await documentModel.findOne({
        SourceId: sourceId,
        documentType
      });

      if (!document) {
        document = new documentModel({
          SourceId: sourceId,
          documentType,
          description,
          category,
          files: [],
          documentSource: [{
            source: sourceType,
            sourceId: sourceId,
            sourceModel: sourceModel
          }]
        });
      }

      // Validate and format dates
      const formattedDate = date ? formatDate(date) : null;
      const formattedExpiry = expiry ? formatDate(expiry) : null;

      if (!formattedDate || !formattedExpiry) {
        throw new Error('Date and expiry are required and must be valid dates');
      }

      // Add file
      document.files.push({
        date: formattedDate,
        expiry: formattedExpiry,
        filename: finalFilename,
        path: s3Key,
        mimetype: file.mimeType || file.fileName.split('.').pop()
      });

      // Create notification
      let sourceIdentifier = '';
      switch (sourceType) {
        case 'equipment':
          sourceIdentifier = sourceData.regNo;
          break;
        case 'operator':
          sourceIdentifier = sourceData.name;
          break;
        case 'mechanic':
          sourceIdentifier = sourceData.name;
          break;
        case 'office-staff':
          sourceIdentifier = sourceData.name;
          break;
      }

      const notification = await createNotification({
        title: `New document added`,
        description: `Document ${documentType} is uploaded for ${sourceIdentifier} (${sourceType}), Now you can access new one`,
        priority: "high",
        sourceId: 'from applications',
        time: new Date()
      });

      await PushNotificationService.sendGeneralNotification(
        null,
        `New document added`,
        `Document ${documentType} is uploaded for ${sourceIdentifier} (${sourceType}), Now you can access new one`,
        'high',
        'normal',
        notification.data._id.toString()
      );

      await document.save();

      return {
        status: 200,
        message: 'Document uploaded successfully',
        uploadUrl: uploadUrl,
        finalFilename: finalFilename,
        s3Key: s3Key,
        document: document
      };
    } catch (err) {
      console.error('Error in saveDocument:', err);
      return {
        status: 500,
        message: 'Failed to save document',
        error: err.message
      };
    }
  },

  getDocuments: async (sourceType, sourceId) => {
    try {
      // Verify source exists
      const { sourceData } = await getSourceDetailsAndKey(sourceId, sourceType, 'temp', 'temp.pdf');

      if (!sourceData) {
        return {
          status: 404,
          message: `${sourceType} not found`
        };
      }

      // Get documents
      const documents = await documentModel.find({
        SourceId: sourceId,
        'documentSource.source': sourceType
      });

      return {
        status: 200,
        documents: documents
      };
    } catch (err) {
      console.error('Error in getDocuments:', err);
      return {
        status: 500,
        message: 'Failed to retrieve documents',
        error: err.message
      };
    }
  },

  getAllDocuments: async () => {
    try {
      const documents = await documentModel.find({});
      return {
        status: 200,
        documents: documents
      };
    } catch (err) {
      console.error('Error in getAllDocuments:', err);
      return {
        status: 500,
        message: 'Failed to retrieve documents',
        error: err.message
      };
    }
  },

  getAllDocumentsTypes: async () => {
    try {
      const documents = await documentModel.find({}).select('documentType');
      return {
        status: 200,
        documents: documents
      };
    } catch (err) {
      console.error('Error in getAllDocumentsTypes:', err);
      return {
        status: 500,
        message: 'Failed to retrieve documents',
        error: err.message
      };
    }
  },

  getDocumentById: async (documentId) => {
    try {
      const document = await documentModel.findOne({
        'files._id': documentId
      });

      if (!document) {
        return {
          status: 404,
          message: 'Document not found'
        };
      }

      const file = document.files.find(f => f._id.toString() === documentId);

      if (!file) {
        return {
          status: 404,
          message: 'File not found'
        };
      }

      return {
        status: 200,
        document: {
          filePath: file.path,
          filename: file.filename,
          mimetype: file.mimetype,
          sourceId: document.SourceId,
          documentType: document.documentType,
          sourceType: document.documentSource[0]?.source
        }
      };
    } catch (err) {
      console.error('Error in getDocumentById:', err);
      return {
        status: 500,
        message: 'Failed to retrieve document',
        error: err.message
      };
    }
  },

  mergePDFs: async (sourceId, sourceType, documentIds, category, documentType) => {
    try {
      // Verify source exists
      const { sourceData, sourceModel } = await getSourceDetailsAndKey(
        sourceId,
        sourceType,
        'temp',
        'temp.pdf'
      );

      // Create merged PDF
      const mergedPdf = await PDFDocument.create();

      // Fetch all documents
      const documentPromises = documentIds.map(async (docId) => {
        const document = await documentModel.findOne({ 'files._id': docId });

        if (!document) {
          throw new Error(`Document with file ID ${docId} not found`);
        }

        const file = document.files.find(f => f._id.toString() === docId);

        if (!file) {
          throw new Error(`File ${docId} not found in document`);
        }

        if (!file.mimetype.includes('pdf')) {
          throw new Error(`File ${file.filename} is not a PDF. Only PDFs can be merged.`);
        }

        return { file, document };
      });

      const documentsData = await Promise.all(documentPromises);

      // Merge PDFs
      for (const { file } of documentsData) {
        try {
          const pdfBuffer = await downloadPDFFromS3(file.path);
          const pdf = await PDFDocument.load(pdfBuffer);
          const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          copiedPages.forEach((page) => {
            mergedPdf.addPage(page);
          });
        } catch (err) {
          console.error(`Error processing file ${file.filename}:`, err);
          throw new Error(`Failed to process ${file.filename}: ${err.message}`);
        }
      }

      // Save merged PDF
      const mergedPdfBytes = await mergedPdf.save();

      // Generate filename and S3 key
      const mergedFilename = `${documentType}-merged-${formatDateTime()}.pdf`;
      const { s3Key } = await getSourceDetailsAndKey(
        sourceId,
        sourceType,
        documentType,
        mergedFilename
      );

      // Upload to S3
      const uploadUrl = await uploadPDFToS3(mergedPdfBytes, s3Key);

      // Save to database
      let document = await documentModel.findOne({
        SourceId: sourceId,
        documentType
      });

      if (!document) {
        document = new documentModel({
          SourceId: sourceId,
          documentType,
          description: `Merged PDF created from ${documentIds.length} documents`,
          category,
          files: [],
          documentSource: [{
            source: sourceType,
            sourceId: sourceId,
            sourceModel: sourceModel
          }]
        });
      }

      // Get dates
      const dates = documentsData.map(d => d.file.date).filter(Boolean);
      const expiries = documentsData.map(d => d.file.expiry).filter(Boolean);
      const earliestDate = dates.length > 0 ? dates.sort()[0] : formatDate(new Date());
      const latestExpiry = expiries.length > 0 ? expiries.sort().reverse()[0] : formatDate(new Date());

      document.files.push({
        date: earliestDate,
        expiry: latestExpiry,
        filename: mergedFilename,
        path: s3Key,
        mimetype: 'application/pdf'
      });

      await PushNotificationService.sendGeneralNotification(
        process.env.SUPER_ADMIN,
        `PDFs Merged`,
        `${documentIds.length} PDFs merged successfully for ${sourceType}`,
        'normal',
        'normal'
      );

      await document.save();

      return {
        status: 200,
        message: 'PDFs merged successfully',
        uploadUrl: uploadUrl,
        document: {
          filename: mergedFilename,
          path: s3Key,
          pageCount: mergedPdf.getPageCount(),
          mergedFrom: documentIds.length
        }
      };

    } catch (err) {
      console.error('Error in mergePDFs:', err);
      return {
        status: 500,
        message: 'Failed to merge PDFs',
        error: err.message
      };
    }
  },

  splitPDF: async (sourceId, sourceType, documentId, splitOptions, category) => {
    try {
      // Verify source exists
      const { sourceData, sourceModel } = await getSourceDetailsAndKey(
        sourceId,
        sourceType,
        'temp',
        'temp.pdf'
      );

      // Find document
      const document = await documentModel.findOne({ 'files._id': documentId });

      if (!document) {
        return {
          status: 404,
          message: 'Document not found'
        };
      }

      const file = document.files.find(f => f._id.toString() === documentId);

      if (!file) {
        return {
          status: 404,
          message: 'File not found'
        };
      }

      if (!file.mimetype.includes('pdf')) {
        return {
          status: 400,
          message: 'Only PDF files can be split'
        };
      }

      // Download and load PDF
      const pdfBuffer = await downloadPDFFromS3(file.path);
      const pdf = await PDFDocument.load(pdfBuffer);
      const totalPages = pdf.getPageCount();

      // Process split options
      const { pages, splitType } = splitOptions;
      let pagesToExtract = [];

      if (splitType === 'specific') {
        pagesToExtract = pages.filter(p => p > 0 && p <= totalPages);
      } else if (splitType === 'range') {
        pages.forEach(range => {
          const [start, end] = range;
          for (let i = start; i <= end && i <= totalPages; i++) {
            pagesToExtract.push(i);
          }
        });
      } else if (splitType === 'every') {
        const pageSize = pages[0] || 1;
        for (let i = 1; i <= totalPages; i += pageSize) {
          pagesToExtract.push(i);
        }
      } else {
        return {
          status: 400,
          message: 'Invalid split type. Use: specific, range, or every'
        };
      }

      if (pagesToExtract.length === 0) {
        return {
          status: 400,
          message: 'No valid pages to extract'
        };
      }

      // Create split PDFs
      const splitDocuments = [];

      if (splitType === 'every') {
        const pageSize = pages[0] || 1;
        for (let i = 0; i < totalPages; i += pageSize) {
          const newPdf = await PDFDocument.create();
          const endPage = Math.min(i + pageSize, totalPages);

          for (let pageNum = i; pageNum < endPage; pageNum++) {
            const [copiedPage] = await newPdf.copyPages(pdf, [pageNum]);
            newPdf.addPage(copiedPage);
          }

          const pdfBytes = await newPdf.save();
          const splitFilename = `${document.documentType}-split-${i + 1}-to-${endPage}-${formatDateTime()}.pdf`;

          const { s3Key } = await getSourceDetailsAndKey(
            sourceId,
            sourceType,
            document.documentType,
            splitFilename
          );

          await uploadPDFToS3(pdfBytes, s3Key);

          splitDocuments.push({
            filename: splitFilename,
            path: s3Key,
            pages: `${i + 1}-${endPage}`,
            pageCount: newPdf.getPageCount()
          });
        }
      } else {
        const newPdf = await PDFDocument.create();
        const pageIndices = pagesToExtract.map(p => p - 1);
        const copiedPages = await newPdf.copyPages(pdf, pageIndices);
        copiedPages.forEach((page) => {
          newPdf.addPage(page);
        });

        const pdfBytes = await newPdf.save();
        const splitFilename = `${document.documentType}-split-pages-${pagesToExtract.join('-')}-${formatDateTime()}.pdf`;

        const { s3Key } = await getSourceDetailsAndKey(
          sourceId,
          sourceType,
          document.documentType,
          splitFilename
        );

        await uploadPDFToS3(pdfBytes, s3Key);

        splitDocuments.push({
          filename: splitFilename,
          path: s3Key,
          pages: pagesToExtract.join(', '),
          pageCount: newPdf.getPageCount()
        });
      }

      // Save split documents
      const savedDocuments = [];

      for (const splitDoc of splitDocuments) {
        let doc = await documentModel.findOne({
          SourceId: sourceId,
          documentType: `${document.documentType} (Split)`
        });

        if (!doc) {
          doc = new documentModel({
            SourceId: sourceId,
            documentType: `${document.documentType} (Split)`,
            description: `Split from ${file.filename}`,
            category: category || document.category,
            files: [],
            documentSource: [{
              source: sourceType,
              sourceId: sourceId,
              sourceModel: sourceModel
            }]
          });
        }

        doc.files.push({
          date: file.date,
          expiry: file.expiry,
          filename: splitDoc.filename,
          path: splitDoc.path,
          mimetype: 'application/pdf'
        });

        await doc.save();
        savedDocuments.push(doc);
      }

      await PushNotificationService.sendGeneralNotification(
        process.env.SUPER_ADMIN,
        `PDF Split`,
        `PDF split into ${splitDocuments.length} document(s) for ${sourceType}`,
        'normal',
        'normal'
      );

      return {
        status: 200,
        message: 'PDF split successfully',
        documents: splitDocuments,
        totalSplits: splitDocuments.length
      };

    } catch (err) {
      console.error('Error in splitPDF:', err);
      return {
        status: 500,
        message: 'Failed to split PDF',
        error: err.message
      };
    }
  },
  renameFile: async (documentId, newFileName) => {
    try {
      // Find document containing the file
      const document = await documentModel.findOne({
        'files._id': documentId
      });

      if (!document) {
        return {
          status: 404,
          message: 'Document not found'
        };
      }

      // Find the specific file
      const file = document.files.find(f => f._id.toString() === documentId);

      if (!file) {
        return {
          status: 404,
          message: 'File not found'
        };
      }

      // Update displayFileName
      file.displayFileName = newFileName;

      // Save document
      await document.save();

      return {
        status: 200,
        message: 'File renamed successfully',
        file: {
          _id: file._id,
          displayFileName: file.displayFileName,
          filename: file.filename
        }
      };

    } catch (err) {
      console.error('Error in renameFile:', err);
      return {
        status: 500,
        message: 'Failed to rename file',
        error: err.message
      };
    }
  },
  deleteDocument: async (documentId) => {
    try {
      // Find document containing the file
      const document = await documentModel.findOne({
        'files._id': documentId
      });

      if (!document) {
        return {
          status: 404,
          message: 'Document not found'
        };
      }

      // Find the specific file
      const file = document.files.find(f => f._id.toString() === documentId);

      if (!file) {
        return {
          status: 404,
          message: 'File not found'
        };
      }

      // Delete from S3
      try {
        await deleteObject(file.path);
      } catch (s3Error) {
        console.error('Error deleting from S3:', s3Error);
        // Continue with DB deletion even if S3 deletion fails
      }

      // Remove file from document
      document.files = document.files.filter(f => f._id.toString() !== documentId);

      // If no files left, delete the entire document
      if (document.files.length === 0) {
        await documentModel.findByIdAndDelete(document._id);
      } else {
        await document.save();
      }

      // Get source identifier for notification
      let sourceIdentifier = '';
      const sourceType = document.documentSource[0]?.source;

      try {
        const { sourceData } = await getSourceDetailsAndKey(
          document.SourceId,
          sourceType,
          'temp',
          'temp.pdf'
        );

        switch (sourceType) {
          case 'equipment':
            sourceIdentifier = sourceData.regNo;
            break;
          case 'operator':
          case 'mechanic':
          case 'office-staff':
            sourceIdentifier = sourceData.name;
            break;
        }
      } catch (err) {
        sourceIdentifier = document.SourceId;
      }

      // Create notification
      const notification = await createNotification({
        title: `Document deleted`,
        description: `Document ${file.filename} was deleted for ${sourceIdentifier} (${sourceType})`,
        priority: "normal",
        sourceId: 'from applications',
        time: new Date()
      });

      await PushNotificationService.sendGeneralNotification(
        null,
        `Document deleted`,
        `Document ${file.filename} was deleted for ${sourceIdentifier} (${sourceType})`,
        'normal',
        'normal',
        notification.data._id.toString()
      );

      return {
        status: 200,
        message: 'Document deleted successfully',
        deletedFile: {
          filename: file.filename,
          path: file.path
        }
      };

    } catch (err) {
      console.error('Error in deleteDocument:', err);
      return {
        status: 500,
        message: 'Failed to delete document',
        error: err.message
      };
    }
  }
};