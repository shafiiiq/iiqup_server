const Complaint = require('../models/complaint.model');
const Equipment = require('../models/equip.model');
const { getFileDuration } = require('../utils/complaint-helper');
const { createNotification } = require('../utils/notification-jobs'); // Import notification service
const PushNotificationService = require('../utils/push-notification-jobs');
const {putObject} = require('../s3bucket/s3.bucket')
const path = require('path');

class ComplaintService {
  static async createComplaint(complaint) {
    try {
     
      // Get equipment details
      const equipment = await Equipment.findOne({ regNo: complaint.regNo });

      // Create notifications
      await createNotification({
        title: `New Complaint - ${complaint.regNo}`,
        description: `${complaint.name} registered complaint for ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo}`,
        priority: "high",
        sourceId: 'from applications',
        time: new Date()
      });

      await PushNotificationService.sendGeneralNotification(
        null, // broadcast to all users
        `New Complaint - ${complaint.regNo}`,
        `${complaint.name} registered complaint for ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo}`,
        'high',
        'normal'
      );

      await complaint.save();
      return complaint;
    } catch (error) {
      console.error('Error creating complaint:', error);
      throw error;
    }
  }

  static async addSolutionToComplaint(complaintId, files, regNo, mechanic) {
    try {
      // Process all solution files
      const solutionFiles = await Promise.all(files.map(async (file) => {
        // Convert backslashes to forward slashes for consistency
        const filePath = file.path.replace(/\\/g, '/');

        // Remove 'public' prefix from path to create URL
        const urlPath = filePath.replace('public', '');

        // Determine file type (photo or video)
        const fileType = file.mimetype.startsWith('video/') ? 'video' : 'photo';

        // Base file data
        const fileData = {
          fileName: file.filename,
          originalName: file.originalname,
          filePath: urlPath,
          fileSize: file.size,
          mimeType: file.mimetype,
          fieldName: file.fieldname,
          type: fileType,
          url: urlPath,
          uploadDate: new Date()
        };

        // Add duration for video files
        if (fileType === 'video') {
          fileData.duration = await getFileDuration(file.path);
        }

        return fileData;
      }));

      // Update complaint with solution files
      const complaint = await Complaint.findByIdAndUpdate(
        complaintId,
        {
          $push: { solutions: { $each: solutionFiles } },
          $set: { status: 'resolved', updatedAt: new Date(), mechanic: mechanic }
        },
        { new: true }
      );

      if (!complaint) {
        throw new Error('Complaint not found');
      }

      const equipment = await Equipment.findOne({ regNo: complaint.regNo })

      await createNotification({
        title: `Complaint Rectified - ${complaint.regNo}`,
        description: `${mechanic} is rectified complaint for ${equipment.brand} ${equipment.machine} - ${complaint.regNo} Equipment ready to work`,
        priority: "high",
        sourceId: 'from applications',
        time: new Date()
      });

      await PushNotificationService.sendGeneralNotification(
        null, // broadcast to all users
        `Complaint Rectified - ${complaint.regNo}`, //title
        `${mechanic} is rectified complaint for ${equipment.brand} ${equipment.machine} - ${complaint.regNo}, Equipment ready to work`, //decription
        'high', //priority
        'normal' // type
      );

      return complaint;
    } catch (error) {
      console.error('Error adding solution:', error);
      throw error;
    }
  }

  static async getComplaintsByUser(uniqueCode) {
    try {
      return await Complaint.find({ uniqueCode }).sort({ createdAt: -1 });
    } catch (error) {
      throw error;
    }
  }

  static async getComplaintById(id) {
    try {
      return await Complaint.findById(id);
    } catch (error) {
      throw error;
    }
  }

  static async getFullComplaints() {
    try {
      return await Complaint.find({});
    } catch (error) {
      throw error;
    }
  }
}



module.exports = ComplaintService;