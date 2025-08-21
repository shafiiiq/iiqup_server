const ComplaintService = require('../services/complaint-services');
const { uploadMediaFiles } = require('../multer/complaint-upload');
const { uploadSolutionFiles } = require('../multer/solution-upload');
const multer = require('multer');
const path = require('path');
const { putObject } = require('../s3bucket/s3.bucket');

class ComplaintController {
  static async registerComplaint(req, res) {
    try {
      const { regNo, name, uniqueCode, files } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({
          status: 400,
          message: 'At least one media file is required'
        });
      }

      // Helper function to determine if file is video
      const isVideoFile = (mimeType, fileName) => {
        // Check mimeType first
        if (mimeType) {
          const normalizedMimeType = mimeType.toLowerCase();
          // Handle cases like 'video', 'video/mp4', 'video/webm', etc.
          if (normalizedMimeType === 'video' || normalizedMimeType.startsWith('video/')) {
            return true;
          }
        }

        // Fallback to file extension if mimeType is not clear
        if (fileName) {
          const ext = path.extname(fileName).toLowerCase();
          const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv', '.flv', '.m4v', '.3gp', '.mkv'];
          return videoExtensions.includes(ext);
        }

        return false;
      };

      // Generate presigned URLs and return them to the client
      const filesWithUploadData = await Promise.all(
        files.map(async (file) => {
          const ext = path.extname(file.fileName);
          const finalFilename = `${regNo || 'no-reg'}-${Date.now()}${ext}`;
          const s3Key = `complaints/${regNo || 'no-reg'}/${uniqueCode}/complaint-${uniqueCode}-${finalFilename}`;

          const uploadUrl = await putObject(
            file.fileName,
            s3Key,
            file.mimeType
          );

          // Determine the correct type
          const isVideo = isVideoFile(file.mimeType, file.fileName);

          return {
            fileName: finalFilename,
            originalName: file.fileName,
            filePath: s3Key,
            mimeType: file.mimeType,
            type: isVideo ? 'video' : 'photo',
            uploadUrl: uploadUrl,
            uploadDate: new Date()
          };
        })
      );

      // Create complaint document (without saving yet)
      const complaintData = {
        uniqueCode,
        regNo: regNo || 'no-reg',
        name: name || 'no-name',
        mediaFiles: filesWithUploadData,
        status: 'pending'
      };

      const result = await ComplaintService.createComplaint(complaintData);

      res.status(200).json({
        status: 200,
        message: 'Pre-signed URLs generated',
        data: {
          complaint: complaintData,
          uploadData: filesWithUploadData
        }
      });
    } catch (error) {
      console.error('Error generating upload URLs:', error);
      res.status(500).json({
        status: 500,
        message: 'Failed to generate upload URLs',
        error: error.message
      });
    }
  }

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

      // Generate presigned URLs for each file
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

      // Call the service to update the complaint
      const result = await ComplaintService.addSolutionToComplaint(
        complaintId,
        filesWithUploadData,
        regNo,
        mechanic
      );

      // Return both the service result and upload URLs
      res.status(200).json({
        status: 200,
        message: 'Solution added successfully',
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
        return res.status(404).json({ error: 'Complaint not found' });
      }

      res.json(complaint);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ComplaintController;