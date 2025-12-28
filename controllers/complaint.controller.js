const ComplaintService = require('../services/complaint-services');
const { uploadMediaFiles } = require('../multer/complaint-upload');
const { uploadSolutionFiles } = require('../multer/solution-upload');
const multer = require('multer');
const path = require('path');
const { putObject } = require('../s3bucket/s3.bucket');
const Mechanic = require('../models/mechanic.model');

class ComplaintController {
  // Step 1: Register complaint (unchanged but now only notifies MAINTENANCE_HEAD)
  static async registerComplaint(req, res) {
    try {
      const { regNo, name, uniqueCode, files } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({
          status: 400,
          message: 'At least one media file is required'
        });
      }

      const isVideoFile = (mimeType, fileName) => {
        if (mimeType) {
          const normalizedMimeType = mimeType.toLowerCase();
          if (normalizedMimeType === 'video' || normalizedMimeType.startsWith('video/')) {
            return true;
          }
        }

        if (fileName) {
          const ext = path.extname(fileName).toLowerCase();
          const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv', '.flv', '.m4v', '.3gp', '.mkv'];
          return videoExtensions.includes(ext);
        }

        return false;
      };

      // Generate upload URLs for each file
      const uploadData = await Promise.all(
        files.map(async (file) => {
          const ext = path.extname(file.fileName);
          const finalFilename = `${regNo || 'no-reg'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`;
          const s3Key = `complaints/${regNo || 'no-reg'}/${uniqueCode}/complaint-${uniqueCode}-${finalFilename}`;

          // Get presigned upload URL
          const uploadUrl = await putObject(
            file.fileName,
            s3Key,
            file.mimeType
          );

          const isVideo = isVideoFile(file.mimeType, file.fileName);

          return {
            fileName: finalFilename,
            originalName: file.fileName,
            filePath: s3Key,
            mimeType: file.mimeType,
            type: isVideo ? 'video' : 'photo',
            uploadUrl: uploadUrl, // This is what the frontend expects
            uploadDate: new Date()
          };
        })
      );

      // Create complaint record
      const complaintData = {
        uniqueCode,
        regNo: regNo || 'no-reg',
        name: name || 'no-name',
        mediaFiles: uploadData.map(item => ({
          fileName: item.fileName,
          originalName: item.originalName,
          filePath: item.filePath,
          mimeType: item.mimeType,
          type: item.type,
          uploadDate: item.uploadDate
        }))
      };

      const result = await ComplaintService.createComplaint(complaintData);

      // Return response in the format expected by frontend
      res.status(202).json({
        status: 202,
        message: 'Complaint registered successfully. MAINTENANCE_HEAD has been notified.',
        data: {
          complaint: result,
          uploadData: uploadData // Array of objects with uploadUrl property
        }
      });
    } catch (error) {
      console.error('Error registering complaint:', error);
      res.status(500).json({
        status: 500,
        message: 'Failed to register complaint',
        error: error.message
      });
    }
  }

  // Step 2: MAINTENANCE_HEAD assigns mechanic
  static async assignMechanic(req, res) {
    try {
      const { complaintId } = req.params;
      const { mechanics, assignedBy } = req.body; // Changed from single to array

      // Validate input
      if (!mechanics || !Array.isArray(mechanics) || mechanics.length === 0) {
        return res.status(400).json({
          status: 400,
          message: 'mechanics array is required and must contain at least one mechanic'
        });
      }

      if (!assignedBy) {
        return res.status(400).json({
          status: 400,
          message: 'assignedBy is required'
        });
      }

      // Validate each mechanic object
      for (const mechanic of mechanics) {
        if (!mechanic.mechanicId || !mechanic.mechanicName) {
          return res.status(400).json({
            status: 400,
            message: 'Each mechanic must have mechanicId and mechanicName'
          });
        }
      }

      const result = await ComplaintService.assignMechanic(
        complaintId,
        mechanics,
        assignedBy
      );

      res.status(200).json(result);
    } catch (error) {
      console.error('Error assigning mechanics:', error);
      res.status(error.status || 500).json({
        status: error.status || 500,
        message: error.message || 'Failed to assign mechanics'
      });
    }
  }

  // Step 3: Mechanic requests items
  static async mechanicRequestItems(req, res) {
    try {
      const { complaintId } = req.params;
      const { requestText, audioFile, mechanicId } = req.body;

      if (!requestText && !audioFile) {
        return res.status(400).json({
          status: 400,
          message: 'Either requestText or audioFile is required'
        });
      }

      let audioFileData = null;
      if (audioFile) {
        // Handle audio file upload to S3
        const ext = path.extname(audioFile.fileName);
        const finalFilename = `audio-${complaintId}-${Date.now()}${ext}`;
        const s3Key = `complaint-audio/${complaintId}/${finalFilename}`;

        const uploadUrl = await putObject(
          audioFile.fileName,
          s3Key,
          audioFile.mimeType
        );

        audioFileData = {
          fileName: finalFilename,
          filePath: s3Key,
          duration: audioFile.duration || 0,
          uploadUrl: uploadUrl
        };
      }

      const result = await ComplaintService.mechanicRequestItems(
        complaintId,
        { requestText, audioFile: audioFileData },
        mechanicId
      );

      res.status(200).json({
        ...result,
        uploadData: audioFileData ? [audioFileData] : []
      });
    } catch (error) {
      console.error('Error in mechanic request:', error);
      res.status(error.status || 500).json({
        status: error.status || 500,
        message: error.message || 'Failed to submit request'
      });
    }
  }

  // Step 4: MAINTENANCE_HEAD forwards to WORKSHOP_MANAGER
  static async forwardToWorkshop(req, res) {
    try {
      const { complaintId } = req.params;
      const { approvedBy, comments, documents } = req.body;

      if (!approvedBy) {
        return res.status(400).json({
          status: 400,
          message: 'approvedBy is required'
        });
      }

      // If documents are provided, generate upload URLs
      let documentsWithUploadData = null;
      if (documents && documents.length > 0) {
        documentsWithUploadData = await Promise.all(
          documents.map(async (document, index) => { // Add index here
            const ext = path.extname(document.fileName);
            const finalFilename = `${approvedBy}-${Date.now()}-${index}${ext}`; // Add index to filename
            const s3Key = `complaints/${complaintId}/attachments/forward-to-workshop-${finalFilename}`;

            const uploadUrl = await putObject(
              document.fileName,
              s3Key,
              document.mimeType
            );

            const isImageFile = (mimeType) => {
              return mimeType && mimeType.startsWith('image/');
            };

            return {
              fileName: finalFilename,
              originalName: document.fileName,
              filePath: s3Key,
              fileSize: document.size,
              mimeType: document.mimeType,
              type: isImageFile(document.mimeType) ? 'image' : 'document',
              uploadDate: new Date(),
              uploadUrl: uploadUrl
            };
          })
        );
      }

      const result = await ComplaintService.forwardToWorkshop(
        complaintId,
        approvedBy,
        comments,
        documentsWithUploadData
      );

      // Prepare response
      const response = {
        status: 200,
        message: 'Request forwarded to workshop manager',
        data: result
      };

      // If documents were uploaded, include upload URLs
      if (documentsWithUploadData) {
        response.data = {
          complaint: result,
          uploadData: documentsWithUploadData.map(doc => ({
            uploadUrl: doc.uploadUrl,
            key: doc.filePath,
            fileName: doc.fileName,
            originalName: doc.originalName
          }))
        };
      }

      res.status(200).json(response);
    } catch (error) {
      console.error('Error forwarding to workshop:', error);
      res.status(error.status || 500).json({
        status: error.status || 500,
        message: error.message || 'Failed to forward to workshop'
      });
    }
  }

  static async forwardToWorkshopWithoutLPO(req, res) {
    try {
      const { complaintId } = req.params;
      const { approvedBy, comments } = req.body;

      if (!approvedBy) {
        return res.status(400).json({
          status: 400,
          message: 'approvedBy is required'
        });
      }

      const result = await ComplaintService.forwardToWorkshopWithoutLPO(
        complaintId,
        approvedBy,
        comments,
      );

      // Prepare response
      const response = {
        status: 200,
        message: 'Request forwarded to workshop manager',
        data: result
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error forwarding to workshop:', error);
      res.status(error.status || 500).json({
        status: error.status || 500,
        message: error.message || 'Failed to forward to workshop'
      });
    }
  }

  static async approveItemWithoutLPO(req, res) {
    try {
      const { complaintId } = req.params;
      const { approvedBy } = req.body;

      if (!approvedBy) {
        return res.status(400).json({
          status: 400,
          message: 'approvedBy is required'
        });
      }

      const result = await ComplaintService.approveItemWithoutLPO(
        complaintId,
        approvedBy,
      );

      // Prepare response
      const response = {
        status: 200,
        message: 'Request forwarded to workshop manager',
        data: result
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error forwarding to workshop:', error);
      res.status(error.status || 500).json({
        status: error.status || 500,
        message: error.message || 'Failed to forward to workshop'
      });
    }
  }

  // Step 5: WORKSHOP_MANAGER creates LPO
  static async createLPOForComplaint(req, res) {
    try {
      const { complaintId } = req.params;
      const { lpoData, createdBy } = req.body;

      if (!lpoData || !createdBy) {
        return res.status(400).json({
          status: 400,
          message: 'lpoData and createdBy are required'
        });
      }

      const result = await ComplaintService.createLPOForComplaint(
        complaintId,
        lpoData,
        createdBy
      );

      res.status(200).json(result);
    } catch (error) {
      console.error('Error creating LPO:', error);
      res.status(error.status || 500).json({
        status: error.status || 500,
        message: error.message || 'Failed to create LPO'
      });
    }
  }

  static async uploadLPOForComplaint(req, res) {
    try {
      const { complaintId } = req.params;
      const { uploadedBy, lpoRef, description, fileName, isAmendment } = req.body;

      if (!uploadedBy || !lpoRef) {
        return res.status(400).json({
          status: 400,
          message: 'uploadedBy and lpoRef are required'
        });
      }

      const amendmentSuffix = isAmendment ? '-amendment' : '';
      const finalFilename = fileName || `lpo-${complaintId}${amendmentSuffix}-${Date.now()}.pdf`;
      const s3Key = `complaint-lpos/${complaintId}/${finalFilename}`;

      // Generate pre-signed URL for S3 upload
      const uploadUrl = await putObject(
        finalFilename, 
        s3Key,
        'application/pdf',
      );

      const lpoFileData = {
        fileName: finalFilename,
        originalName: finalFilename,
        filePath: s3Key,
        mimeType: 'application/pdf',
        uploadUrl: uploadUrl,
        uploadDate: new Date()
      };

      const result = await ComplaintService.uploadLPOForComplaint(
        complaintId,
        lpoFileData,
        uploadedBy,
        lpoRef,
        description,
        isAmendment
      );

      res.status(200).json({
        status: 200,
        message: `Pre-signed URL generated successfully ${isAmendment ? '(Amendment)' : ''}`,
        uploadUrl: uploadUrl,
        data: {
          complaint: result,
          uploadData: lpoFileData
        }
      });

    } catch (error) {
      console.error('Error uploading LPO:', error);
      res.status(error.status || 500).json({
        status: error.status || 500,
        message: error.message || 'Failed to upload LPO'
      });
    }
  }

  // Step 6: PURCHASE_MANAGER approves
  static async purchaseApproval(req, res) {
    try {
      const { complaintId } = req.params;
      const {
        approvedBy,
        comments,
        signed,
        authorised,
        approvedDate,
        approvedFrom,
        approvedIP,
        approvedBDevice,
        approvedLocation
      } = req.body;

      if (!approvedBy) {
        return res.status(400).json({
          status: 400,
          message: 'approvedBy is required'
        });
      }

      // Validate required signing fields if signed is true
      if (signed && (!approvedDate || !approvedFrom)) {
        return res.status(400).json({
          status: 400,
          message: 'approvedDate and approvedFrom are required for signing'
        });
      }

      const result = await ComplaintService.purchaseApproval(
        complaintId,
        {
          approvedBy,
          comments,
          signed: signed || false,
          authorised: authorised || false,
          approvedDate,
          approvedFrom,
          approvedIP,
          approvedBDevice,
          approvedLocation
        }
      );

      res.status(200).json(result);
    } catch (error) {
      console.error('Error in purchase approval:', error);
      res.status(error.status || 500).json({
        status: error.status || 500,
        message: error.message || 'Failed to approve purchase'
      });
    }
  }

  // Step 7: CEO final approval
  static async managerApproval(req, res) {
    try {
      const { complaintId } = req.params;
      const {
        approvedBy,
        comments,
        signed,
        authorised,
        approvedDate,
        approvedFrom,
        approvedIP,
        approvedBDevice,
        approvedLocation
      } = req.body;

      if (!approvedBy) {
        return res.status(400).json({
          status: 400,
          message: 'approvedBy is required'
        });
      }

      const approvedCreds = {
        signed: signed || false,
        authorised: authorised || false,
        approvedDate,
        approvedFrom,
        approvedIP,
        approvedBDevice,
        approvedLocation,
        approvedBy,
      }

      const result = await ComplaintService.managerApproval(
        complaintId,
        approvedBy,
        comments,
        approvedCreds
      );

      res.status(200).json(result);
    } catch (error) {
      console.error('Error in CEO approval:', error);
      res.status(error.status || 500).json({
        status: error.status || 500,
        message: error.message || 'Failed to get CEO approval'
      });
    }
  }


  // Step 7: CEO final approval
  static async ceoApproval(req, res) {
    try {
      const { complaintId } = req.params;
      const {
        approvedBy,
        comments,
        signed,
        authorised,
        approvedDate,
        approvedFrom,
        approvedIP,
        approvedBDevice,
        approvedLocation,
        authUser
      } = req.body;

      if (!approvedBy) {
        return res.status(400).json({
          status: 400,
          message: 'approvedBy is required'
        });
      }

      const approvedCreds = {
        signed: signed || false,
        authorised: authorised || false,
        approvedDate,
        approvedFrom,
        approvedIP,
        approvedBDevice,
        approvedLocation,
        approvedBy,
      }

      const result = await ComplaintService.ceoApproval(
        complaintId,
        approvedBy,
        comments,
        approvedCreds,
        authUser
      );

      res.status(200).json(result);
    } catch (error) {
      console.error('Error in CEO approval:', error);
      res.status(error.status || 500).json({
        status: error.status || 500,
        message: error.message || 'Failed to get CEO approval'
      });
    }
  }

  static async accountsApproval(req, res) {
    try {
      const { complaintId } = req.params;
      const {
        approvedBy,
        comments,
        signed,
        authorised,
        approvedDate,
        approvedFrom,
        approvedIP,
        approvedBDevice,
        approvedLocation
      } = req.body;

      if (!approvedBy) {
        return res.status(400).json({
          status: 400,
          message: 'approvedBy is required'
        });
      }

      const approvedCreds = {
        signed: signed || false,
        authorised: authorised || false,
        approvedDate,
        approvedFrom,
        approvedIP,
        approvedBDevice,
        approvedLocation,
        approvedBy,
      }

      const result = await ComplaintService.accountsApproval(
        complaintId,
        approvedBy,
        comments,
        approvedCreds
      );

      res.status(200).json(result);
    } catch (error) {
      console.error('Error in CEO approval:', error);
      res.status(error.status || 500).json({
        status: error.status || 500,
        message: error.message || 'Failed to get CEO approval'
      });
    }
  }

  // Step 8: Mark items as available
  static async markItemsAvailable(req, res) {
    try {
      const { complaintId } = req.params;
      const { markedBy } = req.body;

      if (!markedBy) {
        return res.status(400).json({
          status: 400,
          message: 'markedBy is required'
        });
      }

      const result = await ComplaintService.markItemsAvailable(
        complaintId,
        markedBy
      );

      res.status(200).json(result);
    } catch (error) {
      console.error('Error marking items available:', error);
      res.status(error.status || 500).json({
        status: error.status || 500,
        message: error.message || 'Failed to mark items as available'
      });
    }
  }

  // Step 9: Mechanic completes work (updated)
  static async addSolution(req, res, next) {
    try {
      const { complaintId } = req.params;
      const { regNo, mechanic, files } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({
          status: 400,
          error: 'At least one solution file is required'
        });
      }

      const filesWithUploadData = await Promise.all(
        files.map(async (file) => {
          const ext = path.extname(file.fileName);
          const finalFilename = `${complaintId}-${Date.now()}${ext}`;
          const s3Key = `complaint-solutions/${complaintId}/${finalFilename}`;

          const uploadUrl = await putObject(
            file.fileName,
            s3Key,
            file.mimeType
          );

          return {
            fileName: finalFilename,
            originalName: file.fileName,
            filePath: s3Key,
            mimeType: file.mimeType,
            type: file.mimeType.startsWith('video/') ? 'video' : 'photo',
            uploadUrl: uploadUrl,
            uploadDate: new Date()
          };
        })
      );

      const result = await ComplaintService.addSolutionToComplaint(
        complaintId,
        filesWithUploadData,
        regNo,
        mechanic
      );

      res.status(200).json({
        status: 200,
        message: 'Work completed successfully. All stakeholders have been notified.',
        data: {
          complaint: result.data,
          uploadData: filesWithUploadData
        }
      });

    } catch (error) {
      console.error('Error in addSolution:', error);
      res.status(error.status || 500).json({
        status: error.status || 500,
        error: error.message || 'Internal server error'
      });
    }
  }

  // Existing methods (unchanged)
  static async getUserComplaints(req, res, next) {
    try {
      const { uniqueCode } = req.params;
      const complaints = await ComplaintService.getComplaintsByUser(uniqueCode);
      res.json(complaints);
    } catch (error) {
      next(error);
    }
  }

  static async getComplaintDetails(req, res, next) {
    try {
      const { id } = req.params;
      const complaint = await ComplaintService.getComplaintById(id);

      if (!complaint) {
        return res.status(404).json({ error: 'Complaint not found' });
      }

      res.json(complaint);
    } catch (error) {
      next(error);
    }
  }

  static async getAllComplaints(req, res, next) {
    try {
      const complaint = await ComplaintService.getFullComplaints();

      if (!complaint) {
        return res.status(404).json({ error: 'Complaints not found' });
      }

      res.json(complaint);
    } catch (error) {
      next(error);
    }
  }

  // New methods for workflow management
  static async getComplaintsByStatus(req, res) {
    try {
      const { status } = req.params;
      const complaints = await ComplaintService.getComplaintsByStatus(status);
      res.json({
        status: 200,
        data: complaints
      });
    } catch (error) {
      console.error('Error getting complaints by status:', error);
      res.status(500).json({
        status: 500,
        message: 'Failed to get complaints',
        error: error.message
      });
    }
  }

  static async getMechanicComplaints(req, res) {
    try {
      const { email } = req.body;

      const complaints = await ComplaintService.getComplaintsByMechanic(email);
      res.json({
        status: 200,
        data: complaints
      });
    } catch (error) {
      console.error('Error getting mechanic complaints:', error);
      res.status(500).json({
        status: 500,
        message: 'Failed to get mechanic complaints',
        error: error.message
      });
    }
  }
}

module.exports = ComplaintController;