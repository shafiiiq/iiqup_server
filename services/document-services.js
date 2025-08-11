const documentModel = require('../models/document.model');
const path = require('path');
const fs = require('fs');
const { createNotification } = require('../utils/notification-jobs'); // Import notification service
const PushNotificationService = require('../utils/push-notification-jobs');

module.exports = {
  saveDocument: async (regNo, documentType, file, description, category) => {
    try {
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

      document.files.push({
        filename: file.filename,
        path: file.path,
        mimetype: file.mimetype || file.originalname.split('.').pop() // Fallback to file extension if mimetype is not available
      });

      await createNotification({
        title: `New document added`,
        description: `Document ${documentType} is uploaded for ${regNo}, Now you can access new one`,
        priority: "high",
        sourceId: 'from applications',
        time: new Date()
      });

      await PushNotificationService.sendGeneralNotification(
        null, // broadcast to all users
        `New document added`, //title
        `Document ${documentType} is uploaded for ${regNo}, Now you can access new one`, //decription
        'high', //priority
        'normal' // type
      );

      await document.save();

      return {
        status: 200,
        message: 'Document uploaded successfully',
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
  }
};