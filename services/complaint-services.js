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
  static async assignMechanic(complaintId, mechanicsArray, assignedBy) {
    try {
      const assignedDate = new Date();

      // Prepare mechanics data for database
      const mechanicsData = mechanicsArray.map(m => ({
        mechanicId: m.mechanicId,
        mechanicName: m.mechanicName,
        assignedBy: assignedBy,
        assignedDate: assignedDate
      }));

      // Get mechanic names for notification
      const mechanicNames = mechanicsArray.map(m => m.mechanicName).join(', ');

      const complaint = await Complaint.findByIdAndUpdate(
        complaintId,
        {
          assignedMechanic: mechanicsData, // Now an array
          workflowStatus: 'assigned_to_mechanic',
          $push: {
            approvalTrail: {
              approvedBy: assignedBy,
              role: 'MAINTENANCE_HEAD',
              action: 'forwarded',
              comments: `Assigned to ${mechanicsArray.length} mechanic(s): ${mechanicNames}`
            }
          }
        },
        { new: true }
      );

      if (!complaint) {
        throw { status: 404, message: 'Complaint not found' };
      }

      // Update all mechanics status to 'engaged'
      const mechanicUpdatePromises = mechanicsArray.map(m =>
        Mechanic.findOneAndUpdate(
          { userId: m.mechanicId },
          { status: 'engaged' },
          { new: true }
        )
      );

      await Promise.all(mechanicUpdatePromises);

      const equipment = await Equipment.findOne({ regNo: complaint.regNo });

      // Notify about assignment
      const notificationTitle = mechanicsArray.length === 1
        ? `Hamsa assigned - ${mechanicNames} to ${complaint.regNo}`
        : `Hamsa assigned - ${mechanicsArray.length} mechanics to ${complaint.regNo}`;

      const notificationDescription = mechanicsArray.length === 1
        ? `Hamsa assigned - ${mechanicNames} to ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo} for complaint rectification.`
        : `Hamsa assigned - ${mechanicsArray.length} mechanics (${mechanicNames}) to ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo} for complaint rectification.`;

      const notificationAlert = await createNotification({
        title: notificationTitle,
        description: notificationDescription,
        priority: "high",
        sourceId: 'job_assignment-annoucement',
        recipient: JSON.parse(process.env.OFFICE_HERO),
        time: new Date(),
      });

      await PushNotificationService.sendGeneralNotification(
        JSON.parse(process.env.OFFICE_HERO),
        notificationTitle,
        notificationDescription,
        'high',
        'normal',
        notificationAlert.data._id.toString()
      );

      return {
        status: 200,
        message: `${mechanicsArray.length} mechanic(s) assigned successfully`,
        data: complaint
      };
    } catch (error) {
      console.error('Error assigning mechanics:', error);
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
      const mechanicNames = complaint.assignedMechanic && complaint.assignedMechanic.length > 0
        ? complaint.assignedMechanic.map(m => m.mechanicName).join(', ')
        : 'Mechanic';

      const notification = await createNotification({
        title: `Mechanic Item Request - ${complaint.regNo}`,
        description: `${mechanicNames} needs items for ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo}. Request: ${requestData.requestText}`,
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
        `${mechanicNames} needs items for ${complaint.regNo}`,
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

  static async forwardToWorkshopWithoutLPO(complaintId, approvedBy, comments = '') {
    try {
      // Prepare update object
      const updateObj = {
        'mechanicRequests.$[].status': 'approved_by_maintenance',
        workflowStatus: 'sent_to_workshop_without_lpo'
      };

      // Prepare approval trail entry
      const approvalTrailEntry = {
        approvedBy: approvedBy,
        role: 'MAINTENANCE_HEAD',
        action: 'approved',
        comments: comments || 'Approved and forwarded to workshop manager and purchase manager'
      };

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

      const notification = await createNotification({
        title: `Approval Needed! - ${equipment.machine} - ${equipment.regNo}`,
        description: `Hamza requested : ${comments}`,
        priority: "high",
        sourceId: 'wihtout_lpo_request',
        recipient: JSON.parse(process.env.OFFICE_MAIN),
        time: new Date(),
        navigateTo: `/(screens)/assignMechanic/${complaint._id}`,
        navigateText: `Approve`,
        directApproval: true,
        approvalPort: `complaints/approve-item/without-lpo/${complaint._id}`,
        navigteToId: complaint._id,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        JSON.parse(process.env.OFFICE_MAIN),
        `Approval Needed! - ${equipment.machine} - ${equipment.regNo}`,
        `Hamza requested : ${comments}`,
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

  static async approveItemWithoutLPO(complaintId, approvedBy) {
    try {
      const existingComplaint = await Complaint.findById(complaintId);

      if (!existingComplaint) {
        throw { status: 404, message: 'Complaint not found' };
      }

      const validStatuses = ['sent_to_workshop_without_lpo'];
      if (!validStatuses.includes(existingComplaint.workflowStatus)) {
        throw {
          status: 400,
          message: `Already Approved`
        };
      }

      // Prepare update object
      const updateObj = {
        workflowStatus: 'approved_without_lpo'
      };

      // Prepare approval trail entry
      const approvalTrailEntry = {
        approvedBy: approvedBy,
        role: 'PURCHASE_MANAGER',
        action: 'approved',
      };

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

      // Notify WORKSHOP_MANAGER
      const notification = await createNotification({
        title: `Item Approved - ${equipment.machine} - ${equipment.regNo}`,
        description: `Hamza requested item is approved by purchase manager of ${equipment.machine} - ${equipment.regNo}`,
        priority: "high",
        sourceId: 'approved_wihtout_lpo_request',
        recipient: JSON.parse(process.env.OFFICE_MAIN),
        time: new Date(),
      });

      await PushNotificationService.sendGeneralNotification(
        JSON.parse(process.env.OFFICE_MAIN),
        `Item Approved - ${equipment.machine} - ${equipment.regNo}`,
        `Hamza requested item is approved by purchase manager of ${equipment.machine} - ${equipment.regNo}`,
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

      console.log("lpo", lpo.lpoRef);


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
        recipient: JSON.parse(process.env.OFFICE_MAIN),
        time: new Date(),
        navigateTo: `/(screens)/purchaseManagerSign/${complaint._id}`,
        navigateText: `View and Sign`,
        navigteToId: complaint._id,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        JSON.parse(process.env.OFFICE_MAIN),
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

  static async uploadLPOForComplaint(complaintId, lpoFileData, uploadedBy, lpoRef, description, isAmendment = false) {
    try {
      const complaint = await Complaint.findById(complaintId);

      if (!complaint) {
        const error = new Error('Complaint not found');
        error.status = 404;
        throw error;
      }

      // For amendment, allow from various approved statuses
      const validStatuses = isAmendment
        ? ['lpo_uploaded', 'purchase_approved', 'accounts_approved', 'manager_approved', 'ceo_approved', 'md_approved', 'completed', 'items_available']
        : ['lpo_created', 'sent_to_workshop'];

      console.log("complaint.workflowStatus", complaint.workflowStatus)

      if (!validStatuses.includes(complaint.workflowStatus)) {
        const error = new Error(`Invalid workflow status for LPO ${isAmendment ? 'amendment' : 'upload'}`);
        error.status = 400;
        throw error;
      }

      const updateData = {
        workflowStatus: isAmendment ? 'lpo_amended' : 'lpo_uploaded',
        updatedAt: new Date()
      };

      updateData['lpoDetails.lpoFile'] = lpoFileData;
      updateData['lpoDetails.lpoRef'] = lpoRef;
      updateData['lpoDetails.description'] = description || '';
      updateData['lpoDetails.uploadedBy'] = uploadedBy;
      updateData['lpoDetails.uploadedDate'] = new Date();
      updateData['lpoDetails.status'] = 'uploaded';

      // Set amendment fields
      if (isAmendment) {
        updateData['lpoDetails.isAmendment'] = true;
        updateData['lpoDetails.amendmentDate'] = new Date().toLocaleDateString('en-GB');

        // Reset all approval flags for re-signing
        updateData['lpoDetails.PMRsigned'] = false;
        updateData['lpoDetails.PMRauthorised'] = false;
        updateData['lpoDetails.MANAGERsigned'] = false;
        updateData['lpoDetails.MANAGERauthorised'] = false;
        updateData['lpoDetails.ACCOUNTSsigned'] = false;
        updateData['lpoDetails.ACCOUNTSauthorised'] = false;
        updateData['lpoDetails.CEOsigned'] = false;
        updateData['lpoDetails.CEOauthorised'] = false;
        updateData['lpoDetails.MDsigned'] = false;
        updateData['lpoDetails.MDauthorised'] = false;
        updateData['lpoDetails.status'] = 'amended';
      }

      const approvalEntry = {
        approvedBy: uploadedBy,
        role: 'WORKSHOP_MANAGER',
        approvalDate: new Date(),
        comments: isAmendment
          ? `LPO amendment uploaded: ${lpoRef}`
          : `LPO document uploaded: ${lpoRef}`,
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

      // Notify relevant parties
      const notificationTitle = isAmendment
        ? `LPO Amendment Approval Needed - ${lpoRef}`
        : `LPO Approval Needed - ${lpoRef}`;

      const notificationDescription = isAmendment
        ? `LPO has been amended for complaint ${complaint.regNo}. LPO Ref: ${lpoRef}. Purchase Manager Approval Needed! Please review and approve the amendment.`
        : `New LPO created for complaint ${complaint.regNo}. LPO Ref: ${lpoRef}. Purchase Manager Approval Needed! Please review and approve.`;

      const notification = await createNotification({
        title: notificationTitle,
        description: notificationDescription,
        priority: "high",
        sourceId: 'lpo_approval',
        recipient: JSON.parse(process.env.OFFICE_HERO),
        time: new Date(),
        navigateTo: `/(screens)/purchaseManagerSign/${complaint._id}`,
        navigateText: `View and Sign`,
        navigteToId: complaint._id,
        hasButton: true
      });


      await PushNotificationService.sendGeneralNotification(
        JSON.parse(process.env.OFFICE_HERO),
        notificationTitle,
        notificationDescription,
        'high',
        'normal',
        notification.data._id.toString()
      );

      return {
        status: 202,
        message: isAmendment
          ? 'LPO amendment uploaded successfully and sent for re-approval'
          : 'LPO uploaded successfully and sent to PURCHASE_MANAGER for approval',
        data: updatedComplaint
      };
    } catch (error) {
      console.error('Error in uploadLPOForComplaint service:', error);
      throw error;
    }
  }

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

      const validStatuses = ['lpo_uploaded', 'lpo_amended'];
      if (!validStatuses.includes(existingComplaint.workflowStatus)) {
        throw {
          status: 400,
          message: `Invalid workflow status. Expected 'lpo_uploaded' or 'lpo_amended', got '${existingComplaint.workflowStatus}'`
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

      let title, description
      const lpoData = await LPO.findById(complaint.lpoDetails.lpoId)

      if (lpoData.isAmendmented) {
        title = `Amendment! MANAGER Approval Needed - LPO ${complaint.lpoDetails.lpoRef}`
        description = `Purchace Manager signed and approved amendment LPO for complaint ${complaint.regNo}. Manager approval needed.`
      } else {
        title = `MANAGER Approval Needed - LPO ${complaint.lpoDetails.lpoRef}`
        description = `Purchace Manager signed and approved LPO for complaint ${complaint.regNo}. Manager approval needed.`
      }

      const notification = await createNotification({
        title: title,
        description: title,
        priority: "high",
        sourceId: 'accounts_approval',
        recipient: JSON.parse(process.env.OFFICE_HERO),
        time: new Date(),
        navigateTo: `/(screens)/managerSign/${complaint._id}`,
        navigateText: `View and Sign`,
        navigteToId: complaint._id,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        JSON.parse(process.env.OFFICE_HERO),
        title,
        description,
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

      let target, screen, title, description, source
      // Update LPO with managerSigned: true
      if (complaint.lpoDetails && complaint.lpoDetails.lpoId) {
        await LPO.updateOne(
          { _id: complaint.lpoDetails.lpoId },
          { managerSigned: true }
        );
      }

      if (complaint.lpoDetails && complaint.lpoDetails.lpoId) {
        const lpoData = await LPO.findById(complaint.lpoDetails.lpoId)

        if (lpoData.signatures.authorizedSignatoryTitle === 'CEO' && !lpoData.isAmendmented) {
          target = process.env.CEO
          screen = `/(screens)/ceoSign/${complaint._id}`
          title = `CEO Approval Needed - LPO ${complaint.lpoDetails.lpoRef}`
          description = `Manager ${approvedCreds?.signed ? 'signed and ' : ''}approved LPO for complaint ${complaint.regNo}. CEO approval needed.`
          source = 'ceo_approval'

        } else if (lpoData.signatures.authorizedSignatoryTitle === 'MANAGING DIRECTOR' && !lpoData.isAmendmented) {
          target = process.env.MD
          screen = `/(screens)/mdSign/${complaint._id}`
          title = `MD Approval Needed - LPO ${complaint.lpoDetails.lpoRef}`
          description = `Manager ${approvedCreds?.signed ? 'signed and ' : ''}approved LPO for complaint ${complaint.regNo}. MD approval needed.`
          source = 'md_approval'

        } else if (lpoData.signatures.authorizedSignatoryTitle === 'CEO' && lpoData.isAmendmented) {
          target = process.env.CEO
          screen = `/(screens)/ceoSign/${complaint._id}`
          title = `Amendment! CEO Approval Needed - LPO ${complaint.lpoDetails.lpoRef}`
          description = `Manager ${approvedCreds?.signed ? 'signed and ' : ''}approved amendment LPO for complaint ${complaint.regNo}. CEO approval needed.`
          source = 'ceo_approval'

        } else if (lpoData.signatures.authorizedSignatoryTitle === 'MANAGING DIRECTOR' && lpoData.isAmendmented) {
          target = process.env.MD
          screen = `/(screens)/mdSign/${complaint._id}`
          title = `Amendment! MD Approval Needed - LPO ${complaint.lpoDetails.lpoRef}`
          description = `Manager ${approvedCreds?.signed ? 'signed and ' : ''}approved amendment LPO for complaint ${complaint.regNo}. MD approval needed.`
          source = 'md_approval'

        } else {
          // Only throw if it's neither CEO nor MANAGING DIRECTOR
          throw { status: 404, message: 'Invalid auth position' }
        }
      }

      const notification = await createNotification({
        title: title,
        description: description,
        priority: "high",
        sourceId: source,
        recipient: JSON.parse(process.env.OFFICE_HERO),
        time: new Date(),
        navigateTo: screen,
        navigateText: `View and Sign`,
        navigteToId: complaint._id,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        JSON.parse(process.env.OFFICE_HERO),
        title,
        description,
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

      let title, description
      const lpoData = await LPO.findById(complaint.lpoDetails.lpoId)

      console.log(lpoData)

      const isAmendment = lpoData.isAmendmented
      const isCEO = lpoData.signatures.authorizedSignatoryTitle === 'CEO'
      const signatoryTitle = isCEO ? 'CEO' : 'MD'

      const prefix = isAmendment ? 'Amendment! ' : ''
      title = `${prefix}ACCOUNTS Approval Needed - LPO ${complaint.lpoDetails.lpoRef}`
      description = `${signatoryTitle} signed and approved ${isAmendment ? 'amendment ' : ''}LPO for complaint ${complaint.regNo}. ACCOUNTS approval needed.`

      const notification = await createNotification({
        title: title,
        description: description,
        priority: "high",
        sourceId: 'final_approval',
        recipient: JSON.parse(process.env.OFFICE_HERO),
        time: new Date(),
        navigateTo: `/(screens)/accountsSign/${complaint._id}`,
        navigateText: `View and Sign`,
        navigteToId: complaint._id,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        JSON.parse(process.env.OFFICE_HERO),
        title,
        description,
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

      let title, description
      const lpoData = await LPO.findById(complaint.lpoDetails.lpoId)

      if (lpoData.isAmendmented) {
        title = `Amendment! Approved - LPO ${complaint.lpoDetails.lpoRef}`
        description = `Accounts approved amendment LPO for complaint ${complaint.regNo}. Items can now be procured.`
      } else {
        title = `Approved - LPO ${complaint.lpoDetails.lpoRef}`
        description = `Accounts approved LPO for complaint ${complaint.regNo}. Items can now be procured.`
      }

      const notification = await createNotification({
        title: title,
        description: description,
        priority: "high",
        sourceId: 'manager_approval',
        recipient: JSON.parse(process.env.OFFICE_MAIN),
        time: new Date(),
        navigateTo: `/(screens)/signedLpo/${complaint._id}`,
        navigateText: `View the item required`,
        navigteToId: complaint._id,
        hasButton: true
      });

      await PushNotificationService.sendGeneralNotification(
        JSON.parse(process.env.OFFICE_MAIN),
        title,
        description,
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

      const mechanic = await Mechanic.findOne({ userId: complaint.assignedMechanic.mechanicId })
      const uniqueCode = mechanic.uniqueCode

      // Notify mechanic that items are ready
      const notification = await createNotification({
        title: `Items Ready - ${complaint.regNo}`,
        description: `All requested items are now available. Mechanic ${mechanic.name} can start working on ${complaint.regNo}.`,
        priority: "high",
        sourceId: 'items_ready',
        recipient: JSON.parse(process.env.OFFICE_HERO),
        time: new Date(),
      });

      await PushNotificationService.sendGeneralNotification(
        JSON.parse(process.env.OFFICE_HERO),
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

      if (complaint.assignedMechanic && complaint.assignedMechanic.length > 0) {
        const mechanicIds = complaint.assignedMechanic.map(m => m.mechanicId);

        await Mechanic.updateMany(
          { userId: { $in: mechanicIds } },
          { $set: { status: 'available' } }
        );
      }

      await createNotification({
        title: `Work Completed - ${complaint.regNo}`,
        description: `${mechanic} completed work on ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo}. Equipment ready to work.`,
        priority: "medium",
        sourceId: 'work_completed',
        recipient: JSON.parse(process.env.OFFICE_HERO),
        time: new Date()
      });

      await PushNotificationService.sendGeneralNotification(
        JSON.parse(process.env.OFFICE_HERO),
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
      const result = await Complaint.find({}).sort({ createdAt: -1 });
      return {
        status: 200,
        data: result
      }
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
      const mechanic = await Mechanic.findOne({ email });

      if (!mechanic) {
        throw new Error('Mechanic not found');
      }

      // Now search in the array of assigned mechanics
      const data = await Complaint.find({
        'assignedMechanic': {
          $elemMatch: { mechanicId: mechanic.userId }
        }
      }).sort({ createdAt: -1 });

      return data;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ComplaintService;