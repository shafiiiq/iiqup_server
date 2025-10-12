const Complaint = require('../models/complaint.model');
const Equipment = require('../models/equip.model');
const lpoModel = require('../models/lpo.model');
const LPO = require('../models/lpo.model');
const { getFileDuration } = require('../utils/complaint-helper');
const { createNotification } = require('../utils/notification-jobs');
const PushNotificationService = require('../utils/push-notification-jobs');

class ComplaintService {
  // Step 1: Register complaint and notify MAINTENANCE_HEAD
  static async createComplaint(complaint) {
    try {
      const equipment = await Equipment.findOne({ regNo: complaint.regNo });

      const complaintData = new Complaint({
        ...complaint,
        workflowStatus: 'registered',
        status: 'pending'
      });

      await complaintData.save();

      // Notify MAINTENANCE_HEAD only
      const notification = await createNotification({
        title: `New Complaint Registered - ${complaint.regNo}`,
        description: `${complaint.name} registered complaint for ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo}. Please assign a mechanic.`,
        priority: "high",
        sourceId: complaintData._id,
        recipient: process.env.MAINTENANCE_HEAD, // ✅ Single user
        time: new Date(),
        navigateTo: `/(screens)/assignMechanic/${complaintData._id}`,
        navigateText: 'Assign Mechanic',
        navigteToId: complaintData._id,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        process.env.MAINTENANCE_HEAD,
        `New Complaint - ${complaint.regNo}`,
        `New complaint needs mechanic assignment for ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'}`,
        'high',
        'normal',
        notification.data._id.toString()
      );

      return complaintData;
    } catch (error) {
      console.error('Error creating complaint:', error);
      throw error;
    }
  }

  // Step 2: MAINTENANCE_HEAD assigns mechanic
  static async assignMechanic(complaintId, mechanicData, assignedBy) {
    try {
      const complaint = await Complaint.findByIdAndUpdate(
        complaintId,
        {
          assignedMechanic: {
            mechanicId: mechanicData.mechanicId,
            mechanicName: mechanicData.mechanicName,
            assignedBy: assignedBy,
            assignedDate: new Date()
          },
          workflowStatus: 'assigned_to_mechanic',
          $push: {
            approvalTrail: {
              approvedBy: assignedBy,
              role: 'MAINTENANCE_HEAD',
              action: 'forwarded',
              comments: `Assigned to mechanic: ${mechanicData.mechanicName}`
            }
          }
        },
        { new: true }
      );

      if (!complaint) {
        throw { status: 404, message: 'Complaint not found' };
      }

      const equipment = await Equipment.findOne({ regNo: complaint.regNo });

      // Notify assigned mechanic
      const notification = await createNotification({
        title: `New Job Assigned - ${complaint.regNo}`,
        description: `You have been assigned to work on ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo}. Please check the complaint details.`,
        priority: "high",
        sourceId: 'job_assignment',
        recipient: mechanicData.mechanicId,
        time: new Date(),
        navigateTo: `/(screens)/mehanicsJobs/${complaint._id}`,
        navigateText: 'View and Do',
        navigteToId: complaint._id,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        mechanicData.mechanicId,
        `New Job Assignment`,
        `You've been assigned to work on ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo}`,
        'high',
        'normal',
        notification.data._id.toString()
      );

      return {
        status: 200,
        message: 'Mechanic assigned successfully',
        data: complaint
      };
    } catch (error) {
      console.error('Error assigning mechanic:', error);
      throw error;
    }
  }

  // Step 3: Mechanic requests items/tools
  static async mechanicRequestItems(complaintId, requestData, mechanicId) {
    try {
      const mechanicRequest = {
        requestText: requestData.requestText,
        audioFile: requestData.audioFile || null,
        status: 'pending'
      };

      const complaint = await Complaint.findByIdAndUpdate(
        complaintId,
        {
          $push: { mechanicRequests: mechanicRequest },
          workflowStatus: 'mechanic_requested'
        },
        { new: true }
      );

      if (!complaint) {
        throw { status: 404, message: 'Complaint not found' };
      }

      const equipment = await Equipment.findOne({ regNo: complaint.regNo });

      // Notify MAINTENANCE_HEAD about mechanic request
      const notification = await createNotification({
        title: `Mechanic Item Request - ${complaint.regNo}`,
        description: `${complaint.assignedMechanic.mechanicName} needs items for ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo}. Request: ${requestData.requestText}`,
        priority: "high",
        sourceId: 'mechanic_request',
        recipient: process.env.MAINTENANCE_HEAD,
        time: new Date(),
        navigateTo: `/(screens)/assignMechanic/${complaint._id}`,
        navigateText: 'View mechanic request',
        navigteToId: complaint._id,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        process.env.MAINTENANCE_HEAD,
        `Mechanic Item Request`,
        `${complaint.assignedMechanic.mechanicName} needs items for ${complaint.regNo}`,
        'high',
        'normal',
        notification.data._id.toString()
      );

      return {
        status: 200,
        message: 'Item request submitted successfully',
        data: complaint
      };
    } catch (error) {
      console.error('Error in mechanic request:', error);
      throw error;
    }
  }

  // Step 4: MAINTENANCE_HEAD forwards to WORKSHOP_MANAGER
  static async forwardToWorkshop(complaintId, approvedBy, comments = '', documentsWithUploadData = null) {
    try {
      // Prepare update object
      const updateObj = {
        'mechanicRequests.$[].status': 'approved_by_maintenance',
        workflowStatus: 'sent_to_workshop'
      };

      // Prepare approval trail entry
      const approvalTrailEntry = {
        approvedBy: approvedBy,
        role: 'MAINTENANCE_HEAD',
        action: 'approved',
        comments: comments || 'Approved and forwarded to workshop manager'
      };

      // If documents are provided, add them to attachments and approval trail
      if (documentsWithUploadData && documentsWithUploadData.length > 0) {
        const attachmentDocuments = documentsWithUploadData.map(doc => ({
          fileName: doc.fileName,
          originalName: doc.originalName,
          filePath: doc.filePath,
          fileSize: doc.fileSize,
          mimeType: doc.mimeType,
          type: doc.type,
          uploadDate: doc.uploadDate
        }));

        // Add to general attachments
        updateObj.$push = {
          attachments: { $each: attachmentDocuments }
        };

        // Add attachments to approval trail entry
        approvalTrailEntry.attachments = attachmentDocuments;
      }

      // Add approval trail entry to push operation
      if (updateObj.$push) {
        updateObj.$push.approvalTrail = approvalTrailEntry;
      } else {
        updateObj.$push = {
          approvalTrail: approvalTrailEntry
        };
      }

      const complaint = await Complaint.findByIdAndUpdate(
        complaintId,
        updateObj,
        { new: true }
      );

      if (!complaint) {
        throw { status: 404, message: 'Complaint not found' };
      }

      const equipment = await Equipment.findOne({ regNo: complaint.regNo });

      // Create notification message
      let notificationMessage = `Please create LPO for ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo}. Items needed: ${complaint.mechanicRequests[complaint.mechanicRequests.length - 1].requestText}`;

      if (documentsWithUploadData && documentsWithUploadData.length > 0) {
        notificationMessage += `. ${documentsWithUploadData.length} supporting document(s) attached.`;
      }

      // Notify WORKSHOP_MANAGER
      const notification = await createNotification({
        title: `Create LPO Request - ${complaint.regNo}`,
        description: notificationMessage,
        priority: "high",
        sourceId: 'lpo_request',
        recipient: process.env.WORKSHOP_MANAGER,
        time: new Date(),
        navigateTo: `/(screens)/QuotationRequest/${complaint._id}`,
        navigateText: `View Hamza's request`,
        navigteToId: complaint._id,
        hasButton: true
      });

      let pushNotificationBody = `Create LPO for ${complaint.regNo} - Items needed by mechanic`;
      if (documentsWithUploadData && documentsWithUploadData.length > 0) {
        pushNotificationBody += ` (${documentsWithUploadData.length} attachments)`;
      }

      await PushNotificationService.sendGeneralNotification(
        process.env.WORKSHOP_MANAGER,
        `LPO Creation Request`,
        pushNotificationBody,
        'high',
        'normal',
        notification.data._id.toString()
      );

      return complaint;
    } catch (error) {
      console.error('Error forwarding to workshop:', error);
      throw error;
    }
  }

  // Step 5: WORKSHOP_MANAGER creates LPO
  static async createLPOForComplaint(complaintId, lpoData, createdBy) {
    try {

      const lpo = await lpoModel.findOne({ lpoRef: lpoData.lpoRef })

      const complaint = await Complaint.findByIdAndUpdate(
        complaintId,
        {
          lpoDetails: {
            lpoId: lpo._id,
            lpoRef: lpo.lpoRef,
            createdBy: createdBy,
            status: 'created'
          },
          workflowStatus: 'lpo_created',
          $push: {
            approvalTrail: {
              approvedBy: createdBy,
              role: 'WORKSHOP_MANAGER',
              action: 'approved',
              comments: `LPO created ${lpo.lpoRef}`
            }
          }
        },
        { new: true }
      );

      console.log(complaint)
      console.log('complaint id', complaintId)

      if (!complaint) {
        throw { status: 404, message: 'Complaint not found' };
      }

      // Notify PURCHASE_MANAGER
      const notification = await createNotification({
        title: `LPO ${lpo.lpoRef} Created`,
        description: `LPO ${lpo.lpoRef} is created for complaint with ${complaint.regNo}, Await until lpo is uploaded`,
        priority: "high",
        sourceId: 'lpo_approval',
        recipient: process.env.PURCHASE_MANAGER,
        time: new Date(),
        navigateTo: `/(screens)/purchaseManagerSign/${complaint._id}`,
        navigateText: `View and Sign`,
        navigteToId: complaint._id,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        process.env.PURCHASE_MANAGER,
        `LPO ${lpo.lpoRef} Created`,
        `LPO ${lpo.lpoRef} is created for complaint with ${complaint.regNo}, Await until lpo is uploaded`,
        'high',
        'normal',
        notification.data._id.toString()
      );

      return {
        status: 200,
        message: 'LPO created successfully',
        data: { complaint, lpo }
      };
    } catch (error) {
      console.error('Error creating LPO:', error);
      throw error;
    }
  }

  static async uploadLPOForComplaint(complaintId, lpoFileData, uploadedBy, lpoRef, description) {
    try {
      // Find the complaint
      const complaint = await Complaint.findById(complaintId);

      if (!complaint) {
        const error = new Error('Complaint not found');
        error.status = 404;
        throw error;
      }

      // Check if complaint is in correct status to receive LPO upload
      if (complaint.workflowStatus !== 'lpo_created' && complaint.workflowStatus !== 'sent_to_workshop') {
        const error = new Error('Invalid workflow status for LPO upload');
        error.status = 400;
        throw error;
      }

      // Update the complaint with LPO file information
      const updateData = {
        workflowStatus: 'lpo_uploaded',
        updatedAt: new Date()
      };

      // Add LPO file details to lpoDetails
      updateData['lpoDetails.lpoFile'] = lpoFileData;
      updateData['lpoDetails.lpoRef'] = lpoRef;
      updateData['lpoDetails.description'] = description || '';
      updateData['lpoDetails.uploadedBy'] = uploadedBy;
      updateData['lpoDetails.uploadedDate'] = new Date();
      updateData['lpoDetails.status'] = 'uploaded';

      // Add to approval trail
      const approvalEntry = {
        approvedBy: uploadedBy,
        role: 'WORKSHOP_MANAGER',
        approvalDate: new Date(),
        comments: `LPO document uploaded: ${lpoRef}`,
        action: 'uploaded'
      };

      updateData.$push = {
        approvalTrail: approvalEntry
      };

      const updatedComplaint = await Complaint.findByIdAndUpdate(
        complaintId,
        updateData,
        { new: true, runValidators: true }
      );

      const notification = await createNotification({
        title: `LPO Approval Needed - ${lpoRef}`,
        description: `New LPO created for complaint ${complaint.regNo}. LPO Ref: ${lpoRef}. Please review and approve.`,
        priority: "high",
        sourceId: 'lpo_approval',
        recipient: process.env.PURCHASE_MANAGER,
        time: new Date(),
        navigateTo: `/(screens)/purchaseManagerSign/${complaint._id}`,
        navigateText: `View and Sign`,
        navigteToId: complaint._id,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        process.env.PURCHASE_MANAGER,
        `LPO Approval Needed`,
        `Please approve LPO ${lpoRef} for complaint ${complaint.regNo}`,
        'high',
        'normal',
        notification.data._id.toString()
      );

      return {
        status: 202,
        message: 'LPO uploaded successfully and sent to PURCHASE_MANAGER for approval',
        data: updatedComplaint
      };
    } catch (error) {
      console.error('Error in uploadLPOForComplaint service:', error);
      throw error;
    }
  }

  // Step 6: PURCHASE_MANAGER approves
  static async purchaseApproval(complaintId, approvalData) {
    try {
      const {
        approvedBy,
        comments = '',
        signed = false,
        authorised = false,
        approvedDate,
        approvedFrom,
        approvedIP,
        approvedBDevice,
        approvedLocation
      } = approvalData;

      // First, check if the complaint exists and validate workflow status
      const existingComplaint = await Complaint.findById(complaintId);

      if (!existingComplaint) {
        throw { status: 404, message: 'Complaint not found' };
      }

      // Validate workflow status
      if (existingComplaint.workflowStatus !== 'lpo_uploaded') {
        throw {
          status: 400,
          message: `Invalid workflow status. Expected 'lpo_uploaded', got '${existingComplaint.workflowStatus}'`
        };
      }

      // Prepare the update object
      const updateFields = {
        'lpoDetails.purchaseApprovalDate': new Date(),
        'lpoDetails.status': 'purchase_approved',
        workflowStatus: 'purchase_approved',
        $push: {
          approvalTrail: {
            approvedBy: approvedBy,
            role: 'PURCHASE_MANAGER',
            action: 'approved',
            comments: comments || 'Purchase approved'
          }
        }
      };

      // Add signing fields if provided
      if (signed) {
        updateFields['lpoDetails.PMRsigned'] = true;
        updateFields['lpoDetails.PMRauthorised'] = authorised;
        updateFields['lpoDetails.PMRapprovedBy'] = approvedBy;
        updateFields['lpoDetails.PMRapprovedDate'] = approvedDate || new Date().toISOString();

        if (approvedFrom) updateFields['lpoDetails.PMRapprovedFrom'] = approvedFrom;
        if (approvedIP) updateFields['lpoDetails.PMRapprovedIP'] = approvedIP;
        if (approvedBDevice) updateFields['lpoDetails.PMRapprovedBDevice'] = approvedBDevice;
        if (approvedLocation) updateFields['lpoDetails.PMRapprovedLocation'] = approvedLocation;
      }

      const complaint = await Complaint.findByIdAndUpdate(
        complaintId,
        updateFields,
        { new: true }
      );

      if (!complaint) {
        throw { status: 404, message: 'Failed to update complaint' };
      }

      // Notify CEO
      const notification = await createNotification({
        title: `CEO Approval Needed - LPO ${complaint.lpoDetails.lpoRef}`,
        description: `Purchase manager ${signed ? 'signed and ' : ''}approved LPO for complaint ${complaint.regNo}. Final CEO approval needed.`,
        priority: "high",
        sourceId: 'ceo_approval',
        recipient: process.env.CEO,
        time: new Date(),
        navigateTo: `/(screens)/ceoSign/${complaint._id}`,
        navigateText: `View and Sign`,
        navigteToId: complaint._id,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        process.env.CEO,
        `CEO Approval Needed`,
        `Final approval needed for LPO ${complaint.lpoDetails.lpoRef}`,
        'high',
        'normal',
        notification.data._id.toString()
      );

      return {
        status: 200,
        message: `Purchase approval ${signed ? 'and signing ' : ''}completed successfully`,
        data: complaint,
        signed: signed,
        authorised: authorised
      };
    } catch (error) {
      console.error('Error in purchase approval:', error);
      throw error;
    }
  }

  // Step 7: CEO final approval
  static async ceoApproval(complaintId, approvedBy, comments = '', approvedCreds) {
    try {
      const updateFields = {
        'lpoDetails.ceoApprovalDate': new Date(),
        'lpoDetails.status': 'ceo_approved',
        'workflowStatus': 'ceo_approved',
        $push: {
          approvalTrail: {
            approvedBy: approvedBy,
            role: 'CEO',
            action: 'approved',
            comments: comments || 'CEO approved'
          }
        }
      };

      // Add CEO credential fields if signed
      if (approvedCreds && approvedCreds.signed) {
        updateFields['lpoDetails.CEOsigned'] = true;
        updateFields['lpoDetails.CEOauthorised'] = approvedCreds.authorised;
        updateFields['lpoDetails.CEOapprovedBy'] = approvedCreds.approvedBy;
        updateFields['lpoDetails.CEOapprovedDate'] = approvedCreds.approvedDate || new Date().toISOString();

        if (approvedCreds.approvedFrom) updateFields['lpoDetails.CEOapprovedFrom'] = approvedCreds.approvedFrom;
        if (approvedCreds.approvedIP) updateFields['lpoDetails.CEOapprovedIP'] = approvedCreds.approvedIP;
        if (approvedCreds.approvedBDevice) updateFields['lpoDetails.CEOapprovedBDevice'] = approvedCreds.approvedBDevice;
        if (approvedCreds.approvedLocation) updateFields['lpoDetails.CEOapprovedLocation'] = approvedCreds.approvedLocation;
      }

      // Use the updateFields object in findByIdAndUpdate
      const complaint = await Complaint.findByIdAndUpdate(
        complaintId,
        updateFields,
        { new: true }
      );

      if (!complaint) {
        throw { status: 404, message: 'Complaint not found' };
      }

      const notification = await createNotification({
        title: `Approved - LPO ${complaint.lpoDetails.lpoRef}`,
        description: `CEO approved LPO for complaint ${complaint.regNo}. Items can now be procured.`,
        priority: "high",
        sourceId: 'final_approval',
        recipient: [process.env.MAINTENANCE_HEAD, process.env.JALEEL_KA],
        time: new Date(),
        navigateTo: `/(screens)/signedLpo/${complaint._id}`,
        navigateText: `View the item required`,
        navigteToId: complaint._id,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        [process.env.MAINTENANCE_HEAD, process.env.JALEEL_KA],
        `Approved - LPO ${complaint.lpoDetails.lpoRef}`,
        `CEO approved LPO for complaint ${complaint.regNo}. Items can now be procured.`,
        'high',
        'normal',
        notification.data._id.toString()
      );

      return {
        status: 200,
        message: 'CEO approval completed',
        data: complaint
      };
    } catch (error) {
      console.error('Error in CEO approval:', error);
      throw error;
    }
  }

  // Step 8: Mark items as available (by JALEEL_KA or MAINTENANCE_HEAD)
  static async markItemsAvailable(complaintId, markedBy) {
    try {
      const complaint = await Complaint.findByIdAndUpdate(
        complaintId,
        {
          'lpoDetails.status': 'items_procured',
          workflowStatus: 'items_available',
          $push: {
            approvalTrail: {
              approvedBy: markedBy,
              role: 'PROCUREMENT',
              action: 'approved',
              comments: 'Items procured and available'
            }
          }
        },
        { new: true }
      );

      if (!complaint) {
        throw { status: 404, message: 'Complaint not found' };
      }

      // Notify mechanic that items are ready
      const notification = await createNotification({
        title: `Items Ready - ${complaint.regNo}`,
        description: `All requested items are now available. You can start working on ${complaint.regNo}.`,
        priority: "high",
        sourceId: 'items_ready',
        recipient: complaint.assignedMechanic.mechanicId,
        time: new Date(),
        navigateTo: `/(screens)/mehanicsJobs/${complaint._id}`,
        navigateText: `Complete and send video`,
        navigteToId: complaint._id,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        complaint.assignedMechanic.mechanicId,
        `Items Ready`,
        `Items available for ${complaint.regNo}. You can start working now.`,
        'high',
        'normal',
        notification.data._id.toString()
      );

      return {
        status: 200,
        message: 'Items marked as available',
        data: complaint
      };
    } catch (error) {
      console.error('Error marking items available:', error);
      throw error;
    }
  }

  // Step 9: Mechanic completes work (updated version)
  static async addSolutionToComplaint(complaintId, filesData, regNo, mechanic) {
    try {
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

      console.log('Solution files to be added:', solutionFiles);

      // Use a single update operation with both $push and $set
      const complaint = await Complaint.findByIdAndUpdate(
        complaintId,
        {
          $push: {
            solutions: { $each: solutionFiles },
            approvalTrail: {
              approvedBy: mechanic,
              role: 'MECHANIC',
              action: 'approved',
              comments: 'Work completed successfully'
            }
          },
          $set: {
            status: 'resolved',
            workflowStatus: 'completed',
            updatedAt: new Date()
          }
        },
        { new: true }
      );

      if (!complaint) {
        throw { status: 404, message: 'Complaint not found' };
      }

      console.log('Updated complaint with solutions:', complaint.solutions.length);

      const equipment = await Equipment.findOne({ regNo: complaint.regNo });

      // Notify all stakeholders about completion
      const stakeholders = [
        process.env.MAINTENANCE_HEAD,
        process.env.WORKSHOP_MANAGER,
        process.env.PURCHASE_MANAGER
      ];


      await createNotification({
        title: `Work Completed - ${complaint.regNo}`,
        description: `${mechanic} completed work on ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo}. Equipment ready to work.`,
        priority: "medium",
        sourceId: 'work_completed',
        recipient: stakeholders,
        time: new Date()
      });

      // await PushNotificationService.sendGeneralNotification(
      //   stakeholder,
      //   `Work Completed`,
      //   `${complaint.regNo} work completed by ${mechanic}`,
      //   'medium',
      //   'normal'
      // );

      return {
        status: 200,
        message: 'Work completed successfully',
        data: complaint
      };
    } catch (error) {
      console.error('Error completing work:', error);
      throw error;
    }
  }

  // Existing methods (unchanged)
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
      return await Complaint.find({}).sort({ createdAt: -1 });
    } catch (error) {
      throw error;
    }
  }

  // New method to get complaints by workflow status
  static async getComplaintsByStatus(workflowStatus) {
    try {
      return await Complaint.find({ workflowStatus }).sort({ createdAt: -1 });
    } catch (error) {
      throw error;
    }
  }

  // New method to get complaints assigned to a specific mechanic
  static async getComplaintsByMechanic(mechanicId) {
    try {
      return await Complaint.find({
        'assignedMechanic.mechanicId': mechanicId
      }).sort({ createdAt: -1 });
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ComplaintService;