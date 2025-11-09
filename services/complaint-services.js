const Complaint = require('../models/complaint.model');
const Equipment = require('../models/equip.model');
const lpoModel = require('../models/lpo.model');
const LPO = require('../models/lpo.model');
const Mechanic = require('../models/mechanic.model');
const { getFileDuration } = require('../utils/complaint-helper');
const { createNotification } = require('../utils/notification-jobs');
const PushNotificationService = require('../utils/push-notification-jobs');

class ComplaintService {
  // Step 1: Register complaint and notify MAINTENANCE_HEAD
  static async createComplaint(complaint) {
    try {
      const equipment = await Equipment.findOne({ regNo: complaint.regNo });

      // Generate unique complaint ID
      const complaintId = await this.generateComplaintId();

      const complaintData = new Complaint({
        ...complaint,
        complaintId: complaintId,
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
        recipient: JSON.parse(process.env.OFFICE_HERO),
        time: new Date(),
        navigateTo: `/(screens)/assignMechanic/${complaintData._id}`,
        navigateText: 'Assign Mechanic',
        navigteToId: complaintData._id,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        JSON.parse(process.env.OFFICE_HERO),
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

  static async generateComplaintId() {
    const now = new Date();

    // Format date components
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);

    // Format time components
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12; // Convert to 12-hour format
    const formattedHours = String(hours).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    // Get start and end of today for counting
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Count complaints created today
    const todayCount = await Complaint.countDocuments({
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });

    // Increment count for this new complaint
    const complaintNumber = todayCount + 1;

    // Build complaint ID: DDMMYYHHMM(AM/PM)CP{count}
    const complaintId = `${day}${month}${year}${formattedHours}${minutes}${ampm}CP${complaintNumber}`;

    return complaintId;
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

      const mechanic = await Mechanic.findOneAndUpdate(
        { userId: mechanicData.userId },
        { status: 'engaged' },            
        { new: true }              
      );

      console.log("mechanic", mechanic);


      const equipment = await Equipment.findOne({ regNo: complaint.regNo });

      // Notify assigned mechanic
      const notificationAlert = await createNotification({
        title: `Hamsa assigned - ${mechanicData.mechanicName} to ${complaint.regNo}`,
        description: `Hamsa assigned - ${mechanicData.mechanicName} to ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo} for complaint rectification.`,
        priority: "high",
        sourceId: 'job_assignment-annoucement',
        recipient: JSON.parse(process.env.OFFICE_HERO),
        time: new Date(),
      });

      await PushNotificationService.sendGeneralNotification(
        JSON.parse(process.env.OFFICE_HERO),
        `Hamsa assigned - ${mechanicData.mechanicName} to ${complaint.regNo}`,
        `Hamsa assigned - ${mechanicData.mechanicName} to ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo} for complaint rectification.`,
        'high',
        'normal',
        notificationAlert.data._id.toString()
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
        recipient: JSON.parse(process.env.OFFICE_HERO),
        time: new Date(),
        navigateTo: `/(screens)/assignMechanic/${complaint._id}`,
        navigateText: 'View mechanic request',
        navigteToId: complaint._id,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        JSON.parse(process.env.OFFICE_HERO),
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
        recipient: JSON.parse(process.env.OFFICE_MAIN),
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
        JSON.parse(process.env.OFFICE_MAIN),
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

      if (!complaint) {
        throw { status: 404, message: 'Complaint not found' };
      }

      // Notify PURCHASE_MANAGER
      const notification = await createNotification({
        title: `LPO ${lpo.lpoRef} Created`,
        description: `LPO ${lpo.lpoRef} is created for complaint with ${complaint.regNo}, Await until lpo is uploaded`,
        priority: "high",
        sourceId: 'lpo_approval',
        recipient: [process.env.PURCHASE_MANAGER, process.env.ACCOUNTANT, process.env.MANAGER, process.env.CEO, process.env.MD, process.env.ASARU, process.env.CHARISHMA],
        time: new Date(),
        navigateTo: `/(screens)/purchaseManagerSign/${complaint._id}`,
        navigateText: `View and Sign`,
        navigteToId: complaint._id,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        [process.env.PURCHASE_MANAGER, process.env.ACCOUNTANT, process.env.MANAGER, process.env.CEO, process.env.MD, process.env.ASARU, process.env.CHARISHMA],
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
      const complaint = await Complaint.findById(complaintId);

      if (!complaint) {
        const error = new Error('Complaint not found');
        error.status = 404;
        throw error;
      }

      if (complaint.workflowStatus !== 'lpo_created' && complaint.workflowStatus !== 'sent_to_workshop') {
        const error = new Error('Invalid workflow status for LPO upload');
        error.status = 400;
        throw error;
      }

      const updateData = {
        workflowStatus: 'lpo_uploaded',
        updatedAt: new Date()
      };

      updateData['lpoDetails.lpoFile'] = lpoFileData;
      updateData['lpoDetails.lpoRef'] = lpoRef;
      updateData['lpoDetails.description'] = description || '';
      updateData['lpoDetails.uploadedBy'] = uploadedBy;
      updateData['lpoDetails.uploadedDate'] = new Date();
      updateData['lpoDetails.status'] = 'uploaded';

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

      // Notify PM
      const notification = await createNotification({
        title: `LPO Approval Needed - ${lpoRef}`,
        description: `New LPO created for complaint ${complaint.regNo}. LPO Ref: ${lpoRef}. Please review and approve.`,
        priority: "high",
        sourceId: 'lpo_approval',
        recipient: [process.env.PURCHASE_MANAGER, process.env.ACCOUNTANT, process.env.MANAGER, process.env.CEO, process.env.MD, process.env.ASARU, process.env.CHARISHMA],
        time: new Date(),
        navigateTo: `/(screens)/purchaseManagerSign/${complaint._id}`,
        navigateText: `View and Sign`,
        navigteToId: complaint._id,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        [process.env.PURCHASE_MANAGER, process.env.ACCOUNTANT, process.env.MANAGER, process.env.CEO, process.env.MD, process.env.ASARU, process.env.CHARISHMA],
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
  // After purchaseApproval
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

      const existingComplaint = await Complaint.findById(complaintId);

      if (!existingComplaint) {
        throw { status: 404, message: 'Complaint not found' };
      }

      if (existingComplaint.workflowStatus !== 'lpo_uploaded') {
        throw {
          status: 400,
          message: `Invalid workflow status. Expected 'lpo_uploaded', got '${existingComplaint.workflowStatus}'`
        };
      }

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

      // Update LPO with pmSigned: true
      if (complaint.lpoDetails && complaint.lpoDetails.lpoId) {
        await LPO.updateOne(
          { _id: complaint.lpoDetails.lpoId },
          { pmSigned: true }
        );
      }

      const notification = await createNotification({
        title: `ACCOUNTS Approval Needed - LPO ${complaint.lpoDetails.lpoRef}`,
        description: `Purchase manager ${signed ? 'signed and ' : ''}approved LPO for complaint ${complaint.regNo}. ACCOUNTS approval needed.`,
        priority: "high",
        sourceId: 'accounts_approval',
        recipient: process.env.ACCOUNTS,
        time: new Date(),
        navigateTo: `/(screens)/accountsSign/${complaint._id}`,
        navigateText: `View and Sign`,
        navigteToId: complaint._id,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        process.env.ACCOUNTS,
        `ACCOUNTS Approval Needed`,
        `ACCOUNTS approval needed for LPO ${complaint.lpoDetails.lpoRef}`,
        'high',
        'normal',
        notification.data._id.toString()
      );

      return {
        status: 200,
        message: `Purchase Manager approval ${signed ? 'and signing ' : ''}completed successfully`,
        data: complaint,
        signed: signed,
        authorised: authorised
      };
    } catch (error) {
      console.error('Error in purchase approval:', error);
      throw error;
    }
  }

  // After accountsApproval
  static async accountsApproval(complaintId, approvedBy, comments = '', approvedCreds) {
    try {
      const updateFields = {
        'lpoDetails.accountsApprovalDate': new Date(),
        'lpoDetails.status': 'accounts_approved',
        'workflowStatus': 'accounts_approved',
        $push: {
          approvalTrail: {
            approvedBy: approvedBy,
            role: 'ACCOUNTS',
            action: 'approved',
            comments: comments || 'ACCOUNTS approved'
          }
        }
      };

      if (approvedCreds && approvedCreds.signed) {
        updateFields['lpoDetails.ACCOUNTSsigned'] = true;
        updateFields['lpoDetails.ACCOUNTSauthorised'] = approvedCreds.authorised;
        updateFields['lpoDetails.ACCOUNTSapprovedBy'] = approvedCreds.approvedBy;
        updateFields['lpoDetails.ACCOUNTSapprovedDate'] = approvedCreds.approvedDate || new Date().toISOString();

        if (approvedCreds.approvedFrom) updateFields['lpoDetails.ACCOUNTSapprovedFrom'] = approvedCreds.approvedFrom;
        if (approvedCreds.approvedIP) updateFields['lpoDetails.ACCOUNTSapprovedIP'] = approvedCreds.approvedIP;
        if (approvedCreds.approvedBDevice) updateFields['lpoDetails.ACCOUNTSapprovedBDevice'] = approvedCreds.approvedBDevice;
        if (approvedCreds.approvedLocation) updateFields['lpoDetails.ACCOUNTSapprovedLocation'] = approvedCreds.approvedLocation;
      }

      const complaint = await Complaint.findByIdAndUpdate(
        complaintId,
        updateFields,
        { new: true }
      );

      if (!complaint) {
        throw { status: 404, message: 'Complaint not found' };
      }

      // Update LPO with accountsSigned: true
      if (complaint.lpoDetails && complaint.lpoDetails.lpoId) {
        await LPO.updateOne(
          { _id: complaint.lpoDetails.lpoId },
          { accountsSigned: true }
        );
      }

      const notification = await createNotification({
        title: `MANAGER Approval Needed - LPO ${complaint.lpoDetails.lpoRef}`,
        description: `Accounts ${approvedCreds?.signed ? 'signed and ' : ''}approved LPO for complaint ${complaint.regNo}. Manager approval needed.`,
        priority: "high",
        sourceId: 'manager_approval',
        recipient: process.env.MANAGER,
        time: new Date(),
        navigateTo: `/(screens)/managerSign/${complaint._id}`,
        navigateText: `View the item required`,
        navigteToId: complaint._id,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        process.env.MANAGER,
        `MANAGER Approval Needed - LPO ${complaint.lpoDetails.lpoRef}`,
        `Accounts ${approvedCreds?.signed ? 'signed and ' : ''}approved LPO for complaint ${complaint.regNo}. Manager approval needed.`,
        'high',
        'normal',
        notification.data._id.toString()
      );

      return {
        status: 200,
        message: 'ACCOUNTS approval completed',
        data: complaint
      };
    } catch (error) {
      console.error('Error in ACCOUNTS approval:', error);
      throw error;
    }
  }

  // After managerApproval
  static async managerApproval(complaintId, approvedBy, comments = '', approvedCreds) {
    try {
      const updateFields = {
        'lpoDetails.managerApprovalDate': new Date(),
        'lpoDetails.status': 'manager_approved',
        'workflowStatus': 'manager_approved',
        $push: {
          approvalTrail: {
            approvedBy: approvedBy,
            role: 'MANAGER',
            action: 'approved',
            comments: comments || 'MANAGER approved'
          }
        }
      };

      if (approvedCreds && approvedCreds.signed) {
        updateFields['lpoDetails.MANAGERsigned'] = true;
        updateFields['lpoDetails.MANAGERauthorised'] = approvedCreds.authorised;
        updateFields['lpoDetails.MANAGERapprovedBy'] = approvedCreds.approvedBy;
        updateFields['lpoDetails.MANAGERapprovedDate'] = approvedCreds.approvedDate || new Date().toISOString();

        if (approvedCreds.approvedFrom) updateFields['lpoDetails.MANAGERapprovedFrom'] = approvedCreds.approvedFrom;
        if (approvedCreds.approvedIP) updateFields['lpoDetails.MANAGERapprovedIP'] = approvedCreds.approvedIP;
        if (approvedCreds.approvedBDevice) updateFields['lpoDetails.MANAGERapprovedBDevice'] = approvedCreds.approvedBDevice;
        if (approvedCreds.approvedLocation) updateFields['lpoDetails.MANAGERapprovedLocation'] = approvedCreds.approvedLocation;
      }

      const complaint = await Complaint.findByIdAndUpdate(
        complaintId,
        updateFields,
        { new: true }
      );

      if (!complaint) {
        throw { status: 404, message: 'Complaint not found' };
      }

      let target, screen
      // Update LPO with managerSigned: true
      if (complaint.lpoDetails && complaint.lpoDetails.lpoId) {
        await LPO.updateOne(
          { _id: complaint.lpoDetails.lpoId },
          { managerSigned: true }
        );
      }

      if (complaint.lpoDetails && complaint.lpoDetails.lpoId) {
        const lpoData = await Complaint.findById(complaint.lpoDetails.lpoId)
        if (lpoData.signatures.authorizedSignatoryTitle === 'CEO') {
          target = process.env.CEO
          screen = `/(screens)/ceoSign/${complaint._id}`
        }

        if (lpoData.signatures.authorizedSignatoryTitle === 'MD') {
          target = process.env.MD
          screen = `/(screens)/mdSign/${complaint._id}`
        }
        throw { status: 404, message: 'Invalid auth position' };
      }

      const notification = await createNotification({
        title: `CEO Approval Needed - LPO ${complaint.lpoDetails.lpoRef}`,
        description: `Manager ${approvedCreds?.signed ? 'signed and ' : ''}approved LPO for complaint ${complaint.regNo}. CEO approval needed.`,
        priority: "high",
        sourceId: 'ceo_approval',
        recipient: target,
        time: new Date(),
        navigateTo: `/(screens)/ceoSign/${complaint._id}`,
        navigateText: `View the item required`,
        navigteToId: complaint._id,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        [process.env.CEO],
        `CEO Approval Needed - LPO ${complaint.lpoDetails.lpoRef}`,
        `Manager ${approvedCreds?.signed ? 'signed and ' : ''}approved LPO for complaint ${complaint.regNo}. CEO approval needed.`,
        'high',
        'normal',
        notification.data._id.toString()
      );

      return {
        status: 200,
        message: 'MANAGER approval completed',
        data: complaint
      };
    } catch (error) {
      console.error('Error in MANAGER approval:', error);
      throw error;
    }
  }

  // After ceoApproval
  static async ceoApproval(complaintId, approvedBy, comments = '', approvedCreds, authUser) {
    try {
      // Determine if it's MD or CEO
      const approverType = authUser === 'MD' ? 'MD' : 'CEO';
      const approvalStatus = `${approverType.toLowerCase()}_approved`;

      const updateFields = {
        [`lpoDetails.${approverType.toLowerCase()}ApprovalDate`]: new Date(),
        'lpoDetails.status': approvalStatus,
        'workflowStatus': approvalStatus,
        $push: {
          approvalTrail: {
            approvedBy: approvedBy,
            role: approverType,
            action: 'approved',
            comments: comments || `${approverType} approved`
          }
        }
      };

      if (approvedCreds && approvedCreds.signed) {
        updateFields[`lpoDetails.${approverType}signed`] = true;
        updateFields[`lpoDetails.${approverType}authorised`] = approvedCreds.authorised;
        updateFields[`lpoDetails.${approverType}approvedBy`] = approvedCreds.approvedBy;
        updateFields[`lpoDetails.${approverType}approvedDate`] = approvedCreds.approvedDate || new Date().toISOString();

        if (approvedCreds.approvedFrom) updateFields[`lpoDetails.${approverType}approvedFrom`] = approvedCreds.approvedFrom;
        if (approvedCreds.approvedIP) updateFields[`lpoDetails.${approverType}approvedIP`] = approvedCreds.approvedIP;
        if (approvedCreds.approvedBDevice) updateFields[`lpoDetails.${approverType}approvedBDevice`] = approvedCreds.approvedBDevice;
        if (approvedCreds.approvedLocation) updateFields[`lpoDetails.${approverType}approvedLocation`] = approvedCreds.approvedLocation;
      }

      const complaint = await Complaint.findByIdAndUpdate(
        complaintId,
        updateFields,
        { new: true }
      );

      if (!complaint) {
        throw { status: 404, message: 'Complaint not found' };
      }

      // Update LPO with dynamic field
      if (complaint.lpoDetails && complaint.lpoDetails.lpoId) {
        const lpoUpdateField = approverType === 'MD' ? { mdSigned: true } : { ceoSigned: true };
        await LPO.updateOne(
          { _id: complaint.lpoDetails.lpoId },
          lpoUpdateField
        );
      }

      const notification = await createNotification({
        title: `Approved - LPO ${complaint.lpoDetails.lpoRef}`,
        description: `${approverType} approved LPO for complaint ${complaint.regNo}. Items can now be procured.`,
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
        `${approverType} approved LPO for complaint ${complaint.regNo}. Items can now be procured.`,
        'high',
        'normal',
        notification.data._id.toString()
      );

      return {
        status: 200,
        message: `${approverType} approval completed`,
        data: complaint
      };
    } catch (error) {
      console.error(`Error in ${authUser || 'CEO'} approval:`, error);
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

      const mechanic = await Mechanic.findById(complaint.assignedMechanic.mechanicId)
      const uniqueCode = mechanic.uniqueCode

      // Notify mechanic that items are ready
      const notification = await createNotification({
        title: `Items Ready - ${complaint.regNo}`,
        description: `All requested items are now available. You can start working on ${complaint.regNo}.`,
        priority: "high",
        sourceId: 'items_ready',
        recipient: uniqueCode,
        time: new Date(),
        navigateTo: `/(screens)/mehanicsJobs/${complaint._id}`,
        navigateText: `Complete and send video`,
        navigteToId: complaint._id,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        uniqueCode,
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
      const equipment = await Equipment.findOne({ regNo: complaint.regNo });

      const mechanic = await Mechanic.findOneAndUpdate(
        mechanicData.userId,
        {
          status: 'available'
        }
      )

      await createNotification({
        title: `Work Completed - ${complaint.regNo}`,
        description: `${mechanic} completed work on ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo}. Equipment ready to work.`,
        priority: "medium",
        sourceId: 'work_completed',
        recipient: null,
        time: new Date()
      });

      await PushNotificationService.sendGeneralNotification(
        [proces.env.MAINTENANCE_HEAD, process.env.WORKSHOP_MANAGER,
        process.env.PURCHASE_MANAGER,
        process.env.ACCOUNTANT, process.env.CEO,
        process.env.MD,
        ],
        `Work Completed - ${complaint.regNo}`,
        `${mechanic} completed work on ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo}. Equipment ready to work.`,
        'medium',
        'normal'
      );

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
  static async getComplaintsByMechanic(email) {
    try {
      const mechanic = await Mechanic.findOne({ email })
      const data = await Complaint.find({
        'assignedMechanic.mechanicId': mechanic.userId
      }).sort({ createdAt: -1 });
      return data
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ComplaintService;