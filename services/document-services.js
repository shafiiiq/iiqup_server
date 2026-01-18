const documentModel = require('../models/document.model');
const path = require('path');
const fs = require('fs');
const { createNotification } = require('../utils/notification-jobs'); // Import notification service
const PushNotificationService = require('../utils/push-notification-jobs');
const { putObject, getObjectUrl } = require('../s3bucket/s3.bucket')
const { PDFDocument } = require('pdf-lib');

const formatDate = (date) => {
  if (!date) return null;

  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-');
    return `${day}-${month}-${year}`;
  }
  const dateObj = date instanceof Date ? date : new Date(date + 'T00:00:00'); // Add time to avoid timezone issues

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
    const uploadUrl = await putObject('merged.pdf', s3Key, mimeType);
    return uploadUrl;
  } catch (err) {
    console.error('Error uploading PDF to S3:', err);
    throw new Error(`Failed to upload PDF: ${err.message}`);
  }
};

module.exports = {
  saveDocument: async (regNo, documentType, file, description, category, date, expiry) => {
    try {
      // Generate S3 key (path)
      const ext = path.extname(file.fileName);
      const finalFilename = `${regNo}-${documentType}-${formatDateTime()}${ext}`;
      const s3Key = `documents/${regNo}/${documentType}/${finalFilename}`;

      // Get presigned URL for upload
      const uploadUrl = await putObject(file.fileName, s3Key, file.mimeType);

      let document = await documentModel.findOne({ regNo, documentType });

      if (!document) {
        document = new documentModel({
          regNo,
          documentType,
          description,
          category,
          files: []
        });
      }

      // Validate and format dates - ensure they're not undefined
      const formattedDate = date ? formatDate(date) : null;
      const formattedExpiry = expiry ? formatDate(expiry) : null;

      // Check if required fields are present after formatting
      if (!formattedDate || !formattedExpiry) {
        throw new Error('Date and expiry are required and must be valid dates');
      }

      document.files.push({
        date: formattedDate,
        expiry: formattedExpiry,
        filename: finalFilename,
        path: s3Key,
        mimetype: file.mimeType || file.fileName.split('.').pop()
      });

      const notification = await createNotification({
        title: `New document added`,
        description: `Document ${documentType} is uploaded for ${regNo}, Now you can access new one`,
        priority: "high",
        sourceId: 'from applications',
        time: new Date()
      });

      await PushNotificationService.sendGeneralNotification(
        null, // broadcast to all users
        `New document added`, //title
        `Document ${documentType} is uploaded for ${regNo}, Now you can access new one`, //description
        'high', //priority
        'normal', // type 
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

  getDocuments: async (regNo) => {
    try {
      const documents = await documentModel.find({ regNo });
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
      console.error('Error in getDocuments:', err);
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
      console.error('Error in getDocuments:', err);
      return {
        status: 500,
        message: 'Failed to retrieve documents',
        error: err.message
      };
    }
  },

  // NEW: Get document by file ID
  getDocumentById: async (documentId) => {
    try {
      // Find document that contains the file with this ID
      const document = await documentModel.findOne({
        'files._id': documentId
      });

      if (!document) {
        return {
          status: 404,
          message: 'Document not found'
        };
      }

      // Find the specific file within the document
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
          regNo: document.regNo,
          documentType: document.documentType
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

  mergePDFs: async (regNo, documentIds, category, documentType) => {
    try {
      // 1. Create a new PDF document
      const mergedPdf = await PDFDocument.create();

      // 2. Fetch all documents and their files
      const documentPromises = documentIds.map(async (docId) => {
        const document = await documentModel.findOne({ 'files._id': docId });

        if (!document) {
          throw new Error(`Document with file ID ${docId} not found`);
        }

        const file = document.files.find(f => f._id.toString() === docId);

        if (!file) {
          throw new Error(`File ${docId} not found in document`);
        }

        // Check if it's a PDF
        if (!file.mimetype.includes('pdf')) {
          throw new Error(`File ${file.filename} is not a PDF. Only PDFs can be merged.`);
        }

        return { file, document };
      });

      const documentsData = await Promise.all(documentPromises);

      // 3. Download and merge all PDFs
      for (const { file } of documentsData) {
        try {
          // Download PDF from S3
          const pdfBuffer = await downloadPDFFromS3(file.path);

          // Load the PDF
          const pdf = await PDFDocument.load(pdfBuffer);

          // Copy all pages from this PDF to merged PDF
          const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          copiedPages.forEach((page) => {
            mergedPdf.addPage(page);
          });
        } catch (err) {
          console.error(`Error processing file ${file.filename}:`, err);
          throw new Error(`Failed to process ${file.filename}: ${err.message}`);
        }
      }

      // 4. Save the merged PDF
      const mergedPdfBytes = await mergedPdf.save();

      // 5. Generate filename and S3 key
      const mergedFilename = `${regNo}-${documentType}-merged-${formatDateTime()}.pdf`;
      const s3Key = `documents/${regNo}/${documentType}/${mergedFilename}`;

      // 6. Upload merged PDF to S3
      const uploadUrl = await uploadPDFToS3(mergedPdfBytes, s3Key);

      // 7. Save to database
      let document = await documentModel.findOne({ regNo, documentType });

      if (!document) {
        document = new documentModel({
          regNo,
          documentType,
          description: `Merged PDF created from ${documentIds.length} documents`,
          category,
          files: []
        });
      }

      // Get earliest date and latest expiry from merged documents
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

      // Create notification
      // const notification = await createNotification({
      //   title: `PDFs Merged`,
      //   description: `${documentIds.length} PDFs merged successfully for ${regNo}`,
      //   priority: "normal",
      //   sourceId: 'from applications',
      //   target: JSON.parse(process.env.OFFICE_MAIN),
      //   time: new Date()
      // });

      await PushNotificationService.sendGeneralNotification(
        process.env.SUPER_ADMIN,
        `PDFs Merged`,
        `${documentIds.length} PDFs merged successfully for ${regNo}`,
        'normal',
        'normal',
        notification.data._id.toString()
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

  // Split PDF Service
  splitPDF: async (regNo, documentId, splitOptions, category) => {
    try {
      // 1. Find the document
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

      // Check if it's a PDF
      if (!file.mimetype.includes('pdf')) {
        return {
          status: 400,
          message: 'Only PDF files can be split'
        };
      }

      // 2. Download PDF from S3
      const pdfBuffer = await downloadPDFFromS3(file.path);

      // 3. Load the PDF
      const pdf = await PDFDocument.load(pdfBuffer);
      const totalPages = pdf.getPageCount();

      // 4. Validate page numbers
      const { pages, splitType } = splitOptions;

      // splitType can be: 'specific' (specific pages), 'range' (page ranges), 'every' (split every N pages)
      let pagesToExtract = [];

      if (splitType === 'specific') {
        // Specific pages: [1, 3, 5]
        pagesToExtract = pages.filter(p => p > 0 && p <= totalPages);
      } else if (splitType === 'range') {
        // Range: [[1,3], [5,7]] - extract pages 1-3 and 5-7
        pages.forEach(range => {
          const [start, end] = range;
          for (let i = start; i <= end && i <= totalPages; i++) {
            pagesToExtract.push(i);
          }
        });
      } else if (splitType === 'every') {
        // Split every N pages: pages = 2 means [1-2], [3-4], [5-6]...
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

      // 5. Create split PDFs
      const splitDocuments = [];

      if (splitType === 'every') {
        // Split into multiple PDFs
        const pageSize = pages[0] || 1;
        for (let i = 0; i < totalPages; i += pageSize) {
          const newPdf = await PDFDocument.create();
          const endPage = Math.min(i + pageSize, totalPages);

          for (let pageNum = i; pageNum < endPage; pageNum++) {
            const [copiedPage] = await newPdf.copyPages(pdf, [pageNum]);
            newPdf.addPage(copiedPage);
          }

          const pdfBytes = await newPdf.save();
          const splitFilename = `${regNo}-${document.documentType}-split-${i + 1}-to-${endPage}-${formatDateTime()}.pdf`;
          const s3Key = `documents/${regNo}/${document.documentType}/${splitFilename}`;

          // Upload to S3
          await uploadPDFToS3(pdfBytes, s3Key);

          splitDocuments.push({
            filename: splitFilename,
            path: s3Key,
            pages: `${i + 1}-${endPage}`,
            pageCount: newPdf.getPageCount()
          });
        }
      } else {
        // Single PDF with selected pages
        const newPdf = await PDFDocument.create();

        // Convert 1-based page numbers to 0-based indices
        const pageIndices = pagesToExtract.map(p => p - 1);

        const copiedPages = await newPdf.copyPages(pdf, pageIndices);
        copiedPages.forEach((page) => {
          newPdf.addPage(page);
        });

        const pdfBytes = await newPdf.save();
        const splitFilename = `${regNo}-${document.documentType}-split-pages-${pagesToExtract.join('-')}-${formatDateTime()}.pdf`;
        const s3Key = `documents/${regNo}/${document.documentType}/${splitFilename}`;

        // Upload to S3
        await uploadPDFToS3(pdfBytes, s3Key);

        splitDocuments.push({
          filename: splitFilename,
          path: s3Key,
          pages: pagesToExtract.join(', '),
          pageCount: newPdf.getPageCount()
        });
      }

      // 6. Save all split documents to database
      const savedDocuments = [];

      for (const splitDoc of splitDocuments) {
        let doc = await documentModel.findOne({
          regNo,
          documentType: `${document.documentType} (Split)`
        });

        if (!doc) {
          doc = new documentModel({
            regNo,
            documentType: `${document.documentType} (Split)`,
            description: `Split from ${file.filename}`,
            category: category || document.category,
            files: []
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

      // Create notification
      // const notification = await createNotification({
      //   title: `PDF Split`,
      //   description: `PDF split into ${splitDocuments.length} document(s) for ${regNo}`,
      //   priority: "normal",
      //   sourceId: 'from applications',
      //   target: JSON.parse(process.env.OFFICE_MAIN),
      //   time: new Date()
      // });

      await PushNotificationService.sendGeneralNotification(
        process.env.SUPER_ADMIN,
        `PDF Split`,
        `PDF split into ${splitDocuments.length} document(s) for ${regNo}`,
        'normal',
        'normal',
        notification.data._id.toString()
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
  }
};