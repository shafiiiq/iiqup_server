const ComplaintService = require('../services/complaint-services');
const { uploadMediaFiles } = require('../multer/complaint-upload');
const { uploadSolutionFiles } = require('../multer/solution-upload');
const multer = require('multer');

class ComplaintController {
  static async registerComplaint(req, res, next) {
    try {
      // Handle file upload
      uploadMediaFiles(req, res, async (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: err.message });
          } else {
            return res.status(400).json({ error: err.message });
          }
        }

        if (!req.files || req.files.length === 0) {
          return res.status(400).json({ error: 'At least one media file is required' });
        }

        try {
          const complaint = await ComplaintService.createComplaint(req.body, req.files);
          res.status(201).json(complaint);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
    } catch (error) {
      next(error);
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