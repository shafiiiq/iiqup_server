const Complaint = require('../models/complaint.model');
const Equipment = require('../models/equip.model');
const { getFileDuration } = require('../utils/complaint-helper');
const { createNotification } = require('../utils/notification-jobs'); // Import notification service
const PushNotificationService = require('../utils/push-notification-jobs');

class ComplaintService {
  static async createComplaint(complaint) {
    try {

      // Get equipment details
      const equipment = await Equipment.findOne({ regNo: complaint.regNo });

      const complaintDateToSave = new Complaint(complaint)
      await complaintDateToSave.save();

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
      return complaintDateToSave;

    } catch (error) {
      console.error('Error creating complaint:', error);
      throw error;
    }
  }

  static async addSolutionToComplaint(complaintId, filesData, regNo, mechanic) {
    try {
      // Process all solution files
      const solutionFiles = await Promise.all(filesData.map(async (file) => {
        const fileData = {
          fileName: file.fileName,
          originalName: file.originalName,
          filePath: file.filePath,
          mimeType: file.mimeType,
          type: file.type,
          url: file.filePath,
          uploadDate: new Date()
        };

        if (file.type === 'video' && file.duration) {
          fileData.duration = file.duration;
        }

        return fileData;
      }));

      // Update complaint with solution files
      const complaint = await Complaint.findByIdAndUpdate(
        complaintId,
        {
          $push: { solutions: { $each: solutionFiles } },
          $set: {
            status: 'resolved',
            updatedAt: new Date(),
            mechanic: mechanic
          }
        },
        { new: true }
      );

      if (!complaint) {
        throw { status: 404, message: 'Complaint not found' };
      }

      const equipment = await Equipment.findOne({ regNo: complaint.regNo });

      await createNotification({
        title: `Complaint Rectified - ${complaint.regNo}`,
        description: `${mechanic} rectified complaint for ${equipment.brand} ${equipment.machine} - ${complaint.regNo} Equipment ready to work`,
        priority: "high",
        sourceId: 'from applications',
        time: new Date()
      });

      await PushNotificationService.sendGeneralNotification(
        null,
        `Complaint Rectified - ${complaint.regNo}`,
        `${mechanic} rectified complaint for ${equipment.brand} ${equipment.machine} - ${complaint.regNo}, Equipment ready to work`,
        'high',
        'normal'
      );

      return {
        status: 200,
        message: 'Solution added successfully',
        data: complaint
      };

    } catch (error) {
      console.error('Error in addSolutionToComplaint:', error);
      throw {
        status: error.status || 500,
        message: error.message || 'Failed to add solution'
      };
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