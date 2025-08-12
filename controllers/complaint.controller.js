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

      // Create complaint document (without saving yet)
      const complaintData = {
        uniqueCode,
        regNo: regNo || 'no-reg',
        name: name || 'no-name',
        mediaFiles: filesWithUploadData,
        status: 'pending'
      };

      const result = await ComplaintService.createComplaint(complaintData)

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
      // Handle file upload
      uploadSolutionFiles(req, res, async (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: err.message });
          } else {
            return res.status(400).json({ error: err.message });
          }
        }

        if (!req.files || req.files.length === 0) {
          return res.status(400).json({ error: 'At least one solution file is required' });
        }

        try {
          const complaint = await ComplaintService.addSolutionToComplaint(
            req.params.complaintId,
            req.files,
            req.body.regNo,
            req.body.mechanic
          );
          res.status(200).json(complaint);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
    } catch (error) {
      next(error);
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