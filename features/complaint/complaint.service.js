const logger = require('#shared/logger/logger');

const { AppError } = require('#shared/errors/error.http');
const HTTP = require('#shared/response/response.status')
// services/complaint.service.js
const Complaint = require('./complaint.model');
const Equipment = require('../equipment/equipment.model');
const { mobilizationModel } = require('../equipment/mobilization/mobilization.model');
const PurchaseOrder = require('../order/purchase/purchase.model');
const Mechanic = require('#features/user/mechanic/mechanic.model');
const { createNotification } = require('#core/notification/notification.service');
const PushNotificationService = require('#core/notification/notification.push');
const wsUtils = require('#core/socket/socket.io');
const dashboardServices = require('#features/dashboard/dashboard.service');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a complaint ID string based on current date/time and today's complaint count.
 * Format: DDMMYYHHMM(AM/PM)CP{count}
 * @returns {Promise<string>}
 */
const generateComplaintId = async () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);

  let hours = now.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const fmtHours = String(hours).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0
  );
  const endOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59
  );

  const todayCount = await Complaint.countDocuments({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });

  return `${day}${month}${year}${fmtHours}${minutes}${ampm}CP${todayCount + 1}`;
};

/**
 * Builds a mobilization record object for equipment status changes.
 * @param {object} equipment
 * @param {string} previousStatus
 * @param {string} newStatus
 * @param {string} remarks
 * @returns {object}
 */
const buildMobilizationRecord = (
  equipment,
  previousStatus,
  newStatus,
  remarks
) => {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  let operatorName = null;
  if (equipment.certificationBody?.length > 0) {
    const last =
      equipment.certificationBody[equipment.certificationBody.length - 1];
    operatorName = typeof last === 'object' ? last.operatorName : last;
  }

  return {
    equipmentId: equipment._id,
    regNo: equipment.regNo,
    machine: equipment.machine,
    action: 'status_changed',
    previousStatus,
    newStatus,
    site:
      equipment.site?.length > 0
        ? equipment.site[equipment.site.length - 1]
        : 'Workshop',
    operator: operatorName,
    withOperator: !!operatorName,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    date: now,
    time,
    remarks,
    status: newStatus,
  };
};

/**
 * Creates a DB notification and sends a push notification.
 * @param {object} notificationPayload
 * @param {string|Array} pushTarget
 * @param {string} pushTitle
 * @param {string} pushBody
 * @param {string} priority
 */
const notify = async (
  notificationPayload,
  pushTarget,
  pushTitle,
  pushBody,
  priority = 'high'
) => {
  const notification = await createNotification(notificationPayload);
  await PushNotificationService.sendGeneralNotification(
    pushTarget,
    pushTitle,
    pushBody,
    priority,
    'normal',
    notification.data._id.toString()
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new complaint, changes equipment status to maintenance, creates mobilization record.
 * @param {object} complaint
 * @returns {Promise<object>}
 */
const createComplaint = async (complaint) => {
  try {
    const equipment = await Equipment.findOne({ regNo: complaint.regNo });
    if (!equipment)
      throw {
        status: HTTP.NOT_FOUND,
        message: `Equipment with regNo ${complaint.regNo} not found`,
      };

    const previousStatus = equipment.status;
    const complaintId = await generateComplaintId();

    const complaintData = await new Complaint({
      ...complaint,
      complaintId,
      workflowStatus: 'registered',
      status: 'pending',
      previousEquipmentStatus: previousStatus,
    }).save();

    await Equipment.findOneAndUpdate(
      { regNo: complaint.regNo },
      { status: 'maintenance', lastMaintenanceDate: new Date() },
      { new: true }
    );

    await MobilizationModel.create(
      buildMobilizationRecord(
        equipment,
        previousStatus,
        'maintenance',
        `Equipment moved to maintenance due to complaint registration. Complaint ID: ${complaintData.complaintId}. Remarks: ${complaint.remarks || 'No remarks provided'}`
      )
    );

    const staffHero = JSON.parse(process.env.STAFF_HERO);
    await notify(
      {
        title: `New Complaint Registered - ${complaint.regNo}`,
        description: `${complaint.name} registered complaint for ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo}. Equipment status changed from ${previousStatus} to Maintenance. Please assign a mechanic.`,
        priority: 'high',
        sourceId: complaintData._id,
        recipient: staffHero,
        time: new Date(),
        navigateTo: `/(mechanics)/assign/${complaintData._id}`,
        navigateText: 'Assign Mechanic',
        navigteToId: complaintData._id,
        hasButton: true,
      },
      staffHero,
      `New Complaint - ${complaint.regNo}`,
      `New complaint needs mechanic assignment. Equipment ${complaint.regNo} is now in Maintenance.`
    );

    return complaintData;
  } catch (error) {
    logger.error('[ComplaintService] createComplaint:', error);
    throw error;
  }
};

/**
 * Assigns one or more mechanics to a complaint (Step 2 — MAINTENANCE_HEAD).
 * @param {string} complaintId
 * @param {Array}  mechanicsArray
 * @param {string} assignedBy
 * @returns {Promise<object>}
 */
const assignMechanic = async (complaintId, mechanicsArray, assignedBy) => {
  try {
    const assignedDate = new Date();
    const mechanicsData = mechanicsArray.map((m) => ({
      mechanicId: m.mechanicId,
      mechanicName: m.mechanicName,
      assignedBy,
      assignedDate,
    }));
    const mechanicNames = mechanicsArray.map((m) => m.mechanicName).join(', ');

    const complaint = await Complaint.findByIdAndUpdate(
      complaintId,
      {
        assignedMechanic: mechanicsData,
        workflowStatus: 'assigned_to_mechanic',
        $push: {
          approvalTrail: {
            approvedBy: assignedBy,
            role: 'MAINTENANCE_HEAD',
            action: 'forwarded',
            comments: `Assigned to ${mechanicsArray.length} mechanic(s): ${mechanicNames}`,
          },
        },
      },
      { new: true }
    );
    if (!complaint) throw new AppError('Complaint not found', HTTP.NOT_FOUND);

    await Promise.all(
      mechanicsArray.map((m) =>
        Mechanic.findOneAndUpdate(
          { userId: m.mechanicId },
          { status: 'engaged' },
          { new: true }
        )
      )
    );

    const equipment = await Equipment.findOne({ regNo: complaint.regNo });
    const notificationTitle =
      mechanicsArray.length === 1
        ? `Hamsa assigned - ${mechanicNames} to ${complaint.regNo}`
        : `Hamsa assigned - ${mechanicsArray.length} mechanics to ${complaint.regNo}`;
    const notificationDesc =
      mechanicsArray.length === 1
        ? `Hamsa assigned - ${mechanicNames} to ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo} for complaint rectification.`
        : `Hamsa assigned - ${mechanicsArray.length} mechanics (${mechanicNames}) to ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo} for complaint rectification.`;

    const staffHero = JSON.parse(process.env.STAFF_HERO);
    await notify(
      {
        title: notificationTitle,
        description: notificationDesc,
        priority: 'high',
        sourceId: 'job_assignment-annoucement',
        recipient: staffHero,
        time: new Date(),
      },
      staffHero,
      notificationTitle,
      notificationDesc
    );

    return {
      status: HTTP.OK,
      message: `${mechanicsArray.length} mechanic(s) assigned successfully`,
      data: complaint,
    };
  } catch (error) {
    logger.error('[ComplaintService] assignMechanic:', error);
    throw error;
  }
};

/*
 * Mechanic submits an item/tool request (Step 3).
 * @param {string} complaintId
 * @param {object} requestData
 * @param {string} mechanicId
 * @returns {Promise<object>}
 */
const mechanicRequestItems = async (complaintId, requestData, mechanicId) => {
  try {
    const complaint = await Complaint.findByIdAndUpdate(
      complaintId,
      {
        $push: {
          mechanicRequests: {
            requestText: requestData.requestText,
            audioFile: requestData.audioFile || null,
            status: 'pending',
          },
        },
        workflowStatus: 'mechanic_requested',
      },
      { new: true }
    );
    if (!complaint) throw { status: HTTP.NOT_FOUND, message: 'Complaint not found' };

    const equipment = await Equipment.findOne({ regNo: complaint.regNo });
    const mechanicNames =
      complaint.assignedMechanic?.length > 0
        ? complaint.assignedMechanic.map((m) => m.mechanicName).join(', ')
        : 'Mechanic';

    const staffHero = JSON.parse(process.env.STAFF_HERO);
    await notify(
      {
        title: `Mechanic Item Request - ${complaint.regNo}`,
        description: `${mechanicNames} needs items for ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo}. Request: ${requestData.requestText}`,
        priority: 'high',
        sourceId: 'mechanic_request',
        recipient: staffHero,
        time: new Date(),
        navigateTo: `/(mechanics)/assign/${complaint._id}`,
        navigateText: 'View mechanic request',
        navigteToId: complaint._id,
        hasButton: true,
      },
      staffHero,
      'Mechanic Item Request',
      `${mechanicNames} needs items for ${complaint.regNo}`
    );

    return {
      status: HTTP.OK,
      message: 'Item request submitted successfully',
      data: complaint,
    };
  } catch (error) {
    logger.error('[ComplaintService] mechanicRequestItems:', error);
    throw error;
  }
};

/**
 * MAINTENANCE_HEAD forwards complaint to WORKSHOP_MANAGER with optional attachments (Step 4).
 * @param {string}     complaintId
 * @param {string}     approvedBy
 * @param {string}     comments
 * @param {Array|null} documentsWithUploadData
 * @returns {Promise<object>}
 */
const forwardToWorkshop = async (
  complaintId,
  approvedBy,
  comments = '',
  documentsWithUploadData = null
) => {
  try {
    const approvalEntry = {
      approvedBy,
      role: 'MAINTENANCE_HEAD',
      action: 'approved',
      comments: comments || 'Approved and forwarded to workshop manager',
    };

    const updateObj = {
      'mechanicRequests.$[].status': 'approved_by_maintenance',
      workflowStatus: 'sent_to_workshop',
    };

    if (documentsWithUploadData?.length > 0) {
      const attachmentDocs = documentsWithUploadData.map((doc) => ({
        fileName: doc.fileName,
        originalName: doc.originalName,
        filePath: doc.filePath,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        type: doc.type,
        uploadDate: doc.uploadDate,
      }));
      approvalEntry.attachments = attachmentDocs;
      updateObj.$push = {
        attachments: { $each: attachmentDocs },
        approvalTrail: approvalEntry,
      };
    } else {
      updateObj.$push = { approvalTrail: approvalEntry };
    }

    const complaint = await Complaint.findByIdAndUpdate(
      complaintId,
      updateObj,
      { new: true }
    );
    if (!complaint) throw { status: HTTP.NOT_FOUND, message: 'Complaint not found' };

    const equipment = await Equipment.findOne({ regNo: complaint.regNo });
    const lastRequest =
      complaint.mechanicRequests[complaint.mechanicRequests.length - 1];
    let notificationMsg = `Please create PurchaseOrder for ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo}. Items needed: ${lastRequest.requestText}`;
    let pushBody = `Create PurchaseOrder for ${complaint.regNo} - Items needed by mechanic`;

    if (documentsWithUploadData?.length > 0) {
      notificationMsg += `. ${documentsWithUploadData.length} supporting document(s) attached.`;
      pushBody += ` (${documentsWithUploadData.length} attachments)`;
    }

    const staffMain = JSON.parse(process.env.STAFF_MAIN);
    await notify(
      {
        title: `Create PurchaseOrder Request - ${complaint.regNo}`,
        description: notificationMsg,
        priority: 'high',
        sourceId: 'purchaseorder_request',
        recipient: staffMain,
        time: new Date(),
        navigateTo: `/(workflow)/quotation/${complaint._id}`,
        navigateText: `View Hamza's request`,
        navigteToId: complaint._id,
        hasButton: true,
      },
      staffMain,
      'PurchaseOrder Creation Request',
      pushBody
    );

    return complaint;
  } catch (error) {
    logger.error('[ComplaintService] forwardToWorkshop:', error);
    throw error;
  }
};

/**
 * MAINTENANCE_HEAD forwards complaint to WORKSHOP_MANAGER without requiring an PurchaseOrder.
 * @param {string} complaintId
 * @param {string} approvedBy
 * @param {string} comments
 * @returns {Promise<object>}
 */
const forwardToWorkshopWithoutPurchaseOrder = async (
  complaintId,
  approvedBy,
  comments = ''
) => {
  try {
    const complaint = await Complaint.findByIdAndUpdate(
      complaintId,
      {
        'mechanicRequests.$[].status': 'approved_by_maintenance',
        workflowStatus: 'sent_to_workshop_without_purchaseorder',
        $push: {
          approvalTrail: {
            approvedBy,
            role: 'MAINTENANCE_HEAD',
            action: 'approved',
            comments:
              comments ||
              'Approved and forwarded to workshop manager and purchase manager',
          },
        },
      },
      { new: true }
    );
    if (!complaint) throw { status: HTTP.NOT_FOUND, message: 'Complaint not found' };

    const equipment = await Equipment.findOne({ regNo: complaint.regNo });
    const title = `Approval Needed! - ${equipment.machine} - ${equipment.regNo}`;
    const body = `Hamza requested : ${comments}`;
    const staffMain = JSON.parse(process.env.STAFF_MAIN);

    await notify(
      {
        title,
        description: body,
        priority: 'high',
        sourceId: 'wihtout_purchaseorder_request',
        recipient: staffMain,
        time: new Date(),
        navigateTo: `/(mechanics)/assign/${complaint._id}`,
        navigateText: 'Approve',
        directApproval: true,
        approvalPort: `complaints/approve-item/without-purchaseorder/${complaint._id}`,
        navigteToId: complaint._id,
        hasButton: true,
      },
      staffMain,
      title,
      body
    );

    return complaint;
  } catch (error) {
    logger.error('[ComplaintService] forwardToWorkshopWithoutPurchaseOrder:', error);
    throw error;
  }
};

/**
 * Approves an item request that was submitted without an PurchaseOrder.
 * @param {string} complaintId
 * @param {string} approvedBy
 * @returns {Promise<object>}
 */
const approveItemWithoutPurchaseOrder = async (complaintId, approvedBy) => {
  try {
    const existing = await Complaint.findById(complaintId);
    if (!existing) throw { status: HTTP.NOT_FOUND, message: 'Complaint not found' };
    if (existing.workflowStatus !== 'sent_to_workshop_without_purchaseorder')
      throw { status: HTTP.BAD_REQUEST, message: 'Already Approved' };

    const complaint = await Complaint.findByIdAndUpdate(
      complaintId,
      {
        workflowStatus: 'approved_without_purchaseorder',
        $push: {
          approvalTrail: {
            approvedBy,
            role: 'PURCHASE_MANAGER',
            action: 'approved',
          },
        },
      },
      { new: true }
    );
    if (!complaint) throw { status: HTTP.NOT_FOUND, message: 'Complaint not found' };

    const equipment = await Equipment.findOne({ regNo: complaint.regNo });
    const title = `Item Approved - ${equipment.machine} - ${equipment.regNo}`;
    const body = `Hamza requested item is approved by purchase manager of ${equipment.machine} - ${equipment.regNo}`;
    const staffMain = JSON.parse(process.env.STAFF_MAIN);

    await notify(
      {
        title,
        description: body,
        priority: 'high',
        sourceId: 'approved_wihtout_purchaseorder_request',
        recipient: staffMain,
        time: new Date(),
      },
      staffMain,
      title,
      body
    );

    return complaint;
  } catch (error) {
    logger.error('[ComplaintService] approveItemWithoutPurchaseOrder:', error);
    throw error;
  }
};

/**
 * WORKSHOP_MANAGER links an PurchaseOrder to the complaint (Step 5).
 * @param {string} complaintId
 * @param {object} purchaseorderData
 * @param {string} createdBy
 * @returns {Promise<object>}
 */
const createPurchaseOrderForComplaint = async (complaintId, purchaseorderData, createdBy) => {
  try {
    const purchaseorder = await PurchaseOrder.findOne({ purchaseorderRef: purchaseorderData.purchaseorderRef });

    const complaint = await Complaint.findByIdAndUpdate(
      complaintId,
      {
        purchaseorderDetails: {
          purchaseorderId: purchaseorder._id,
          purchaseorderRef: purchaseorder.purchaseorderRef,
          createdBy,
          status: 'created',
        },
        workflowStatus: 'purchaseorder_created',
        $push: {
          approvalTrail: {
            approvedBy: createdBy,
            role: 'WORKSHOP_MANAGER',
            action: 'approved',
            comments: `PurchaseOrder created ${purchaseorder.purchaseorderRef}`,
          },
        },
      },
      { new: true }
    );
    if (!complaint) throw { status: HTTP.NOT_FOUND, message: 'Complaint not found' };

    const staffMain = JSON.parse(process.env.STAFF_MAIN);
    const title = `PurchaseOrder ${purchaseorder.purchaseorderRef} Created`;
    const body = `PurchaseOrder ${purchaseorder.purchaseorderRef} is created for complaint with ${complaint.regNo}, Await until purchaseorder is uploaded`;

    await notify(
      {
        title,
        description: body,
        priority: 'high',
        sourceId: 'purchaseorder_approval',
        recipient: staffMain,
        time: new Date(),
      },
      staffMain,
      title,
      body
    );

    return {
      status: HTTP.OK,
      message: 'PurchaseOrder created successfully',
      data: { complaint, purchaseorder },
    };
  } catch (error) {
    logger.error('[ComplaintService] createPurchaseOrderForComplaint:', error);
    throw error;
  }
};

/**
 * Uploads (or amends) the PurchaseOrder document for a complaint.
 * @param {string}  complaintId
 * @param {object}  purchaseorderFileData
 * @param {string}  uploadedBy
 * @param {string}  purchaseorderRef
 * @param {string}  description
 * @param {boolean} isAmendment
 * @returns {Promise<object>}
 */
const uploadPurchaseOrderForComplaint = async (
  complaintId,
  purchaseorderFileData,
  uploadedBy,
  purchaseorderRef,
  description,
  isAmendment = false
) => {
  try {
    const complaint = await Complaint.findById(complaintId);
    if (!complaint)
      throw Object.assign(new Error('Complaint not found'), { status: HTTP.NOT_FOUND });

    const validStatuses = isAmendment
      ? [
          'purchaseorder_uploaded',
          'purchase_manager_approved',
          'accounts_approved',
          'operation_manager_approved',
          'ceo_approved',
          'md_approved',
          'completed',
          'items_available',
        ]
      : ['purchaseorder_created', 'sent_to_workshop'];

    if (!validStatuses.includes(complaint.workflowStatus)) {
      throw Object.assign(
        new Error(
          `Invalid workflow status for PurchaseOrder ${isAmendment ? 'amendment' : 'upload'}`
        ),
        { status: HTTP.BAD_REQUEST }
      );
    }

    const updateData = {
      workflowStatus: isAmendment ? 'purchaseorder_amended' : 'purchaseorder_uploaded',
      updatedAt: new Date(),
      'purchaseorderDetails.purchaseorderFile': purchaseorderFileData,
      'purchaseorderDetails.purchaseorderRef': purchaseorderRef,
      'purchaseorderDetails.description': description || '',
      'purchaseorderDetails.uploadedBy': uploadedBy,
      'purchaseorderDetails.uploadedDate': new Date(),
      'purchaseorderDetails.status': isAmendment ? 'amended' : 'uploaded',
    };

    if (isAmendment) {
      Object.assign(updateData, {
        'purchaseorderDetails.isAmendment': true,
        'purchaseorderDetails.amendmentDate': new Date().toLocaleDateString('en-GB'),
        'purchaseorderDetails.PMRsigned': false,
        'purchaseorderDetails.PMRauthorised': false,
        'purchaseorderDetails.MANAGERsigned': false,
        'purchaseorderDetails.MANAGERauthorised': false,
        'purchaseorderDetails.ACCOUNTSsigned': false,
        'purchaseorderDetails.ACCOUNTSauthorised': false,
        'purchaseorderDetails.CEOsigned': false,
        'purchaseorderDetails.CEOauthorised': false,
        'purchaseorderDetails.MDsigned': false,
        'purchaseorderDetails.MDauthorised': false,
      });
    }

    updateData.$push = {
      approvalTrail: {
        approvedBy: uploadedBy,
        role: 'WORKSHOP_MANAGER',
        approvalDate: new Date(),
        comments: isAmendment
          ? `PurchaseOrder amendment uploaded: ${purchaseorderRef}`
          : `PurchaseOrder document uploaded: ${purchaseorderRef}`,
        action: 'uploaded',
      },
    };

    const updatedComplaint = await Complaint.findByIdAndUpdate(
      complaintId,
      updateData,
      { new: true, runValidators: true }
    );

    const notificationTitle = isAmendment
      ? `PurchaseOrder Amendment Approval Needed - ${purchaseorderRef}`
      : `PurchaseOrder Approval Needed - ${purchaseorderRef}`;
    const notificationDesc = isAmendment
      ? `PurchaseOrder has been amended for complaint ${complaint.regNo}. PurchaseOrder Ref: ${purchaseorderRef}. Purchase Manager Approval Needed! Please review and approve the amendment.`
      : `New PurchaseOrder created for complaint ${complaint.regNo}. PurchaseOrder Ref: ${purchaseorderRef}. Purchase Manager Approval Needed! Please review and approve.`;

    const staffHero = JSON.parse(process.env.STAFF_HERO);
    await notify(
      {
        title: notificationTitle,
        description: notificationDesc,
        priority: 'high',
        sourceId: 'purchaseorder_approval',
        recipient: staffHero,
        time: new Date(),
        navigateTo: `/(signature)/pm/${complaint._id}`,
        navigateText: 'View and Sign',
        navigteToId: complaint._id,
        hasButton: true,
      },
      staffHero,
      notificationTitle,
      notificationDesc
    );

    return {
      status: 202,
      message: isAmendment
        ? 'PurchaseOrder amendment uploaded successfully and sent for re-approval'
        : 'PurchaseOrder uploaded successfully and sent to PURCHASE_MANAGER for approval',
      data: updatedComplaint,
    };
  } catch (error) {
    logger.error('[ComplaintService] uploadPurchaseOrderForComplaint:', error);
    throw error;
  }
};

/**
 * PURCHASE_MANAGER approves (and optionally signs) the PurchaseOrder (Step 6).
 * @param {string} complaintId
 * @param {object} approvalData
 * @returns {Promise<object>}
 */
const purchaseApproval = async (complaintId, approvalData) => {
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
      approvedLocation,
    } = approvalData;

    const existing = await Complaint.findById(complaintId);
    if (!existing) throw { status: HTTP.NOT_FOUND, message: 'Complaint not found' };
    if (!['purchaseorder_uploaded', 'purchaseorder_amended'].includes(existing.workflowStatus)) {
      throw {
        status: HTTP.BAD_REQUEST,
        message: `Invalid workflow status. Expected 'purchaseorder_uploaded' or 'purchaseorder_amended', got '${existing.workflowStatus}'`,
      };
    }

    const updateFields = {
      'purchaseorderDetails.purchaseApprovalDate': new Date(),
      'purchaseorderDetails.status': 'purchase_manager_approved',
      workflowStatus: 'purchase_manager_approved',
      $push: {
        approvalTrail: {
          approvedBy,
          role: 'PURCHASE_MANAGER',
          action: 'approved',
          comments: comments || 'Purchase approved',
        },
      },
    };

    if (signed) {
      Object.assign(updateFields, {
        'purchaseorderDetails.PMRsigned': true,
        'purchaseorderDetails.PMRauthorised': authorised,
        'purchaseorderDetails.PMRapprovedBy': approvedBy,
        'purchaseorderDetails.PMRapprovedDate': approvedDate || new Date().toISOString(),
        ...(approvedFrom && { 'purchaseorderDetails.PMRapprovedFrom': approvedFrom }),
        ...(approvedIP && { 'purchaseorderDetails.PMRapprovedIP': approvedIP }),
        ...(approvedBDevice && {
          'purchaseorderDetails.PMRapprovedBDevice': approvedBDevice,
        }),
        ...(approvedLocation && {
          'purchaseorderDetails.PMRapprovedLocation': approvedLocation,
        }),
      });
    }

    const complaint = await Complaint.findByIdAndUpdate(
      complaintId,
      updateFields,
      { new: true }
    );
    if (!complaint)
      throw { status: HTTP.NOT_FOUND, message: 'Failed to update complaint' };

    if (complaint.purchaseorderDetails?.purchaseorderId)
      await PurchaseOrder.updateOne(
        { _id: complaint.purchaseorderDetails.purchaseorderId },
        { pmSigned: true }
      );

    const purchaseorderData = await PurchaseOrder.findById(complaint.purchaseorderDetails.purchaseorderId);
    const prefix = purchaseorderData.isAmendmented ? 'Amendment! ' : '';
    const title = `${prefix}MANAGER Approval Needed - PurchaseOrder ${complaint.purchaseorderDetails.purchaseorderRef}`;
    const description = purchaseorderData.isAmendmented
      ? `Purchace Manager signed and approved amendment PurchaseOrder for complaint ${complaint.regNo}. Manager approval needed.`
      : `Purchace Manager signed and approved PurchaseOrder for complaint ${complaint.regNo}. Manager approval needed.`;

    const staffHero = JSON.parse(process.env.STAFF_HERO);
    await notify(
      {
        title,
        description,
        priority: 'high',
        sourceId: 'accounts_approval',
        recipient: staffHero,
        time: new Date(),
        navigateTo: `/(signature)/op/${complaint._id}`,
        navigateText: 'View and Sign',
        navigteToId: complaint._id,
        hasButton: true,
      },
      staffHero,
      title,
      description
    );

    return {
      status: HTTP.OK,
      message: `Purchase Manager approval ${signed ? 'and signing ' : ''}completed successfully`,
      data: complaint,
      signed,
      authorised,
    };
  } catch (error) {
    logger.error('[ComplaintService] purchaseApproval:', error);
    throw error;
  }
};

/**
 * MANAGER approves (and optionally signs) the PurchaseOrder, then routes to CEO or MD (Step 7).
 * @param {string} complaintId
 * @param {string} approvedBy
 * @param {string} comments
 * @param {object} approvedCreds
 * @returns {Promise<object>}
 */
const managerApproval = async (
  complaintId,
  approvedBy,
  comments = '',
  approvedCreds
) => {
  try {
    const updateFields = {
      'purchaseorderDetails.managerApprovalDate': new Date(),
      'purchaseorderDetails.status': 'operation_manager_approved',
      workflowStatus: 'operation_manager_approved',
      $push: {
        approvalTrail: {
          approvedBy,
          role: 'MANAGER',
          action: 'approved',
          comments: comments || 'MANAGER approved',
        },
      },
    };

    if (approvedCreds?.signed) {
      Object.assign(updateFields, {
        'purchaseorderDetails.MANAGERsigned': true,
        'purchaseorderDetails.MANAGERauthorised': approvedCreds.authorised,
        'purchaseorderDetails.MANAGERapprovedBy': approvedCreds.approvedBy,
        'purchaseorderDetails.MANAGERapprovedDate':
          approvedCreds.approvedDate || new Date().toISOString(),
        ...(approvedCreds.approvedFrom && {
          'purchaseorderDetails.MANAGERapprovedFrom': approvedCreds.approvedFrom,
        }),
        ...(approvedCreds.approvedIP && {
          'purchaseorderDetails.MANAGERapprovedIP': approvedCreds.approvedIP,
        }),
        ...(approvedCreds.approvedBDevice && {
          'purchaseorderDetails.MANAGERapprovedBDevice': approvedCreds.approvedBDevice,
        }),
        ...(approvedCreds.approvedLocation && {
          'purchaseorderDetails.MANAGERapprovedLocation': approvedCreds.approvedLocation,
        }),
      });
    }

    const complaint = await Complaint.findByIdAndUpdate(
      complaintId,
      updateFields,
      { new: true }
    );
    if (!complaint) throw { status: HTTP.NOT_FOUND, message: 'Complaint not found' };

    if (complaint.purchaseorderDetails?.purchaseorderId)
      await PurchaseOrder.updateOne(
        { _id: complaint.purchaseorderDetails.purchaseorderId },
        { managerSigned: true }
      );

    const purchaseorderData = await PurchaseOrder.findById(complaint.purchaseorderDetails.purchaseorderId);
    const isAmendment = purchaseorderData.isAmendmented;
    const sigTitle = purchaseorderData.signatures.authorizedSignatoryTitle;
    const isCEO = sigTitle === 'CEO';
    const isMD = sigTitle === 'MANAGING DIRECTOR';

    if (!isCEO && !isMD)
      throw { status: HTTP.NOT_FOUND, message: 'Invalid auth position' };

    const prefix = isAmendment ? 'Amendment! ' : '';
    const target = isCEO ? process.env.CEO : process.env.MD;
    const screen = isCEO
      ? `/(signature)/ceo/${complaint._id}`
      : `/(signature)/ceo/${complaint._id}`;
    const roleLabel = isCEO ? 'CEO' : 'MD';
    const source = isCEO ? 'ceo_approval' : 'md_approval';
    const title = `${prefix}${roleLabel} Approval Needed - PurchaseOrder ${complaint.purchaseorderDetails.purchaseorderRef}`;
    const description = `Manager ${approvedCreds?.signed ? 'signed and ' : ''}approved ${isAmendment ? 'amendment ' : ''}PurchaseOrder for complaint ${complaint.regNo}. ${roleLabel} approval needed.`;

    const staffHero = JSON.parse(process.env.STAFF_HERO);
    await notify(
      {
        title,
        description,
        priority: 'high',
        sourceId: source,
        recipient: staffHero,
        time: new Date(),
        navigateTo: screen,
        navigateText: 'View and Sign',
        navigteToId: complaint._id,
        hasButton: true,
      },
      staffHero,
      title,
      description
    );

    return {
      status: HTTP.OK,
      message: 'MANAGER approval completed',
      data: complaint,
    };
  } catch (error) {
    logger.error('[ComplaintService] managerApproval:', error);
    throw error;
  }
};

/**
 * CEO or MD approves (and optionally signs) the PurchaseOrder, then routes to ACCOUNTS (Step 8).
 * @param {string} complaintId
 * @param {string} approvedBy
 * @param {string} comments
 * @param {object} approvedCreds
 * @param {string} authUser - 'CEO' | 'MD'
 * @returns {Promise<object>}
 */
const ceoApproval = async (
  complaintId,
  approvedBy,
  comments = '',
  approvedCreds,
  authUser
) => {
  try {
    const approverType = authUser === 'MD' ? 'MD' : 'CEO';
    const approvalStatus = `${approverType.toLowerCase()}_approved`;

    const updateFields = {
      [`purchaseorderDetails.${approverType.toLowerCase()}ApprovalDate`]: new Date(),
      'purchaseorderDetails.status': approvalStatus,
      workflowStatus: approvalStatus,
      $push: {
        approvalTrail: {
          approvedBy,
          role: approverType,
          action: 'approved',
          comments: comments || `${approverType} approved`,
        },
      },
    };

    if (approvedCreds?.signed) {
      Object.assign(updateFields, {
        [`purchaseorderDetails.${approverType}signed`]: true,
        [`purchaseorderDetails.${approverType}authorised`]: approvedCreds.authorised,
        [`purchaseorderDetails.${approverType}approvedBy`]: approvedCreds.approvedBy,
        [`purchaseorderDetails.${approverType}approvedDate`]:
          approvedCreds.approvedDate || new Date().toISOString(),
        ...(approvedCreds.approvedFrom && {
          [`purchaseorderDetails.${approverType}approvedFrom`]:
            approvedCreds.approvedFrom,
        }),
        ...(approvedCreds.approvedIP && {
          [`purchaseorderDetails.${approverType}approvedIP`]: approvedCreds.approvedIP,
        }),
        ...(approvedCreds.approvedBDevice && {
          [`purchaseorderDetails.${approverType}approvedBDevice`]:
            approvedCreds.approvedBDevice,
        }),
        ...(approvedCreds.approvedLocation && {
          [`purchaseorderDetails.${approverType}approvedLocation`]:
            approvedCreds.approvedLocation,
        }),
      });
    }

    const complaint = await Complaint.findByIdAndUpdate(
      complaintId,
      updateFields,
      { new: true }
    );
    if (!complaint) throw { status: HTTP.NOT_FOUND, message: 'Complaint not found' };

    if (complaint.purchaseorderDetails?.purchaseorderId) {
      await PurchaseOrder.updateOne(
        { _id: complaint.purchaseorderDetails.purchaseorderId },
        approverType === 'MD' ? { mdSigned: true } : { ceoSigned: true }
      );
    }

    const purchaseorderData = await PurchaseOrder.findById(complaint.purchaseorderDetails.purchaseorderId);
    const isAmendment = purchaseorderData.isAmendmented;
    const sigLabel =
      purchaseorderData.signatures.authorizedSignatoryTitle === 'CEO' ? 'CEO' : 'MD';
    const prefix = isAmendment ? 'Amendment! ' : '';
    const title = `${prefix}ACCOUNTS Approval Needed - PurchaseOrder ${complaint.purchaseorderDetails.purchaseorderRef}`;
    const description = `${sigLabel} signed and approved ${isAmendment ? 'amendment ' : ''}PurchaseOrder for complaint ${complaint.regNo}. ACCOUNTS approval needed.`;

    const staffHero = JSON.parse(process.env.STAFF_HERO);
    await notify(
      {
        title,
        description,
        priority: 'high',
        sourceId: 'final_approval',
        recipient: staffHero,
        time: new Date(),
        navigateTo: `/(signature)/accounts/${complaint._id}`,
        navigateText: 'View and Sign',
        navigteToId: complaint._id,
        hasButton: true,
      },
      staffHero,
      title,
      description
    );

    return {
      status: HTTP.OK,
      message: `${approverType} approval completed`,
      data: complaint,
    };
  } catch (error) {
    logger.error(
      `[ComplaintService] ceoApproval (${authUser || 'CEO'}):`,
      error
    );
    throw error;
  }
};

/**
 * ACCOUNTS approves (and optionally signs) the PurchaseOrder — final approval step (Step 9).
 * @param {string} complaintId
 * @param {string} approvedBy
 * @param {string} comments
 * @param {object} approvedCreds
 * @returns {Promise<object>}
 */
const accountsApproval = async (
  complaintId,
  approvedBy,
  comments = '',
  approvedCreds
) => {
  try {
    const updateFields = {
      'purchaseorderDetails.accountsApprovalDate': new Date(),
      'purchaseorderDetails.status': 'accounts_approved',
      workflowStatus: 'accounts_approved',
      $push: {
        approvalTrail: {
          approvedBy,
          role: 'ACCOUNTS',
          action: 'approved',
          comments: comments || 'ACCOUNTS approved',
        },
      },
    };

    if (approvedCreds?.signed) {
      Object.assign(updateFields, {
        'purchaseorderDetails.ACCOUNTSsigned': true,
        'purchaseorderDetails.ACCOUNTSauthorised': approvedCreds.authorised,
        'purchaseorderDetails.ACCOUNTSapprovedBy': approvedCreds.approvedBy,
        'purchaseorderDetails.ACCOUNTSapprovedDate':
          approvedCreds.approvedDate || new Date().toISOString(),
        ...(approvedCreds.approvedFrom && {
          'purchaseorderDetails.ACCOUNTSapprovedFrom': approvedCreds.approvedFrom,
        }),
        ...(approvedCreds.approvedIP && {
          'purchaseorderDetails.ACCOUNTSapprovedIP': approvedCreds.approvedIP,
        }),
        ...(approvedCreds.approvedBDevice && {
          'purchaseorderDetails.ACCOUNTSapprovedBDevice': approvedCreds.approvedBDevice,
        }),
        ...(approvedCreds.approvedLocation && {
          'purchaseorderDetails.ACCOUNTSapprovedLocation': approvedCreds.approvedLocation,
        }),
      });
    }

    const complaint = await Complaint.findByIdAndUpdate(
      complaintId,
      updateFields,
      { new: true }
    );
    if (!complaint) throw { status: HTTP.NOT_FOUND, message: 'Complaint not found' };

    if (complaint.purchaseorderDetails?.purchaseorderId)
      await PurchaseOrder.updateOne(
        { _id: complaint.purchaseorderDetails.purchaseorderId },
        { accountsSigned: true }
      );

    const purchaseorderData = await PurchaseOrder.findById(complaint.purchaseorderDetails.purchaseorderId);
    const prefix = purchaseorderData.isAmendmented ? 'Amendment! ' : '';
    const title = `${prefix}Approved - PurchaseOrder ${complaint.purchaseorderDetails.purchaseorderRef}`;
    const description = `Accounts approved ${purchaseorderData.isAmendmented ? 'amendment ' : ''}PurchaseOrder for complaint ${complaint.regNo}. Items can now be procured.`;

    const staffMain = JSON.parse(process.env.STAFF_MAIN);
    await notify(
      {
        title,
        description,
        priority: 'high',
        sourceId: 'manager_approval',
        recipient: staffMain,
        time: new Date(),
        navigateTo: `/(workflow)/purchaseorder/${complaint._id}`,
        navigateText: 'View the item required',
        navigteToId: complaint._id,
        hasButton: true,
      },
      staffMain,
      title,
      description
    );

    return {
      status: HTTP.OK,
      message: 'ACCOUNTS approval completed',
      data: complaint,
    };
  } catch (error) {
    logger.error('[ComplaintService] accountsApproval:', error);
    throw error;
  }
};

/**
 * Marks items as procured and available for the mechanic (Step 10).
 * @param {string} complaintId
 * @param {string} markedBy
 * @returns {Promise<object>}
 */
const markItemsAvailable = async (complaintId, markedBy) => {
  try {
    const complaint = await Complaint.findByIdAndUpdate(
      complaintId,
      {
        'purchaseorderDetails.status': 'items_procured',
        workflowStatus: 'items_available',
        $push: {
          approvalTrail: {
            approvedBy: markedBy,
            role: 'PROCUREMENT',
            action: 'approved',
            comments: 'Items procured and available',
          },
        },
      },
      { new: true }
    );
    if (!complaint) throw { status: HTTP.NOT_FOUND, message: 'Complaint not found' };

    const staffHero = JSON.parse(process.env.STAFF_HERO);
    await notify(
      {
        title: `Items Ready - ${complaint.regNo}`,
        description: `All requested items are now available for ${complaint.regNo}.`,
        priority: 'high',
        sourceId: 'items_ready',
        recipient: staffHero,
        time: new Date(),
      },
      staffHero,
      'Items Ready',
      `Items available for ${complaint.regNo}. You can start working now.`
    );

    return {
      status: HTTP.OK,
      message: 'Items marked as available',
      data: complaint,
    };
  } catch (error) {
    logger.error('[ComplaintService] markItemsAvailable:', error);
    throw error;
  }
};

/**
 * Mechanic uploads solution files and marks the complaint as completed (Step 11).
 * @param {string} complaintId
 * @param {Array}  filesData
 * @param {string} regNo
 * @param {string} mechanic
 * @param {string} remarks
 * @returns {Promise<object>}
 */
const addSolutionToComplaint = async (
  complaintId,
  filesData,
  regNo,
  mechanic,
  remarks = ''
) => {
  try {
    const existing = await Complaint.findById(complaintId);
    if (!existing) throw { status: HTTP.NOT_FOUND, message: 'Complaint not found' };

    const solutionFiles = filesData.map((file) => ({
      fileName: file.fileName,
      originalName: file.originalName,
      filePath: file.filePath,
      mimeType: file.mimeType,
      type: file.type,
      url: file.filePath,
      uploadDate: new Date(),
      ...(file.type === 'video' && file.duration
        ? { duration: file.duration }
        : {}),
    }));

    const updateData = {
      $push: {
        solutions: { $each: solutionFiles },
        approvalTrail: {
          approvedBy: mechanic,
          role: 'MECHANIC',
          action: 'approved',
          comments: remarks || 'Work completed successfully',
        },
      },
      $set: {
        status: 'resolved',
        workflowStatus: 'completed',
        updatedAt: new Date(),
        ...(remarks ? { rectificationRemarks: remarks } : {}),
      },
    };

    const complaint = await Complaint.findByIdAndUpdate(
      complaintId,
      updateData,
      { new: true }
    );
    const equipment = await Equipment.findOne({ regNo: complaint.regNo });
    const restoredStatus =
      existing.previousEquipmentStatus === 'maintenance'
        ? 'active'
        : existing.previousEquipmentStatus || 'active';

    await Equipment.findOneAndUpdate(
      { regNo: complaint.regNo },
      { status: restoredStatus, lastCompletedMaintenanceDate: new Date() },
      { new: true }
    );

    await MobilizationModel.create(
      buildMobilizationRecord(
        equipment,
        'maintenance',
        restoredStatus,
        `Maintenance completed by ${mechanic}. Equipment status changed to ${restoredStatus}. Complaint ID: ${existing.complaintId}. ${remarks || 'Equipment ready for operation.'}`
      )
    );

    if (complaint.assignedMechanic?.length > 0) {
      await Mechanic.updateMany(
        {
          userId: { $in: complaint.assignedMechanic.map((m) => m.mechanicId) },
        },
        { $set: { status: 'available' } }
      );
    }

    const staffHero = JSON.parse(process.env.STAFF_HERO);
    await notify(
      {
        title: `Work Completed - ${complaint.regNo}`,
        description: `${mechanic} completed work on ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo}. Equipment is now ${restoredStatus} and ready for operation.`,
        priority: 'medium',
        sourceId: 'work_completed',
        recipient: staffHero,
        time: new Date(),
      },
      staffHero,
      `Work Completed - ${complaint.regNo}`,
      `${mechanic} completed work on ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo}. Equipment is now ${restoredStatus}.`,
      'medium'
    );

    return {
      status: HTTP.OK,
      message: 'Work completed successfully',
      data: complaint,
    };
  } catch (error) {
    logger.error('[ComplaintService] addSolutionToComplaint:', error);
    throw error;
  }
};

const { paginate } = require('#shared/pagination/pagination')

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all complaints for a given uniqueCode.
 * @param {string} uniqueCode
 * @param {object} pagination
 * @returns {Promise<object>}
 */
const getComplaintsByUser = async (uniqueCode, pagination) => {
  try {
    return await paginate(
      Complaint,
      { uniqueCode },
      pagination,
      { sort: { createdAt: -1 } }
    );
  } catch (error) {
    logger.error('[ComplaintService] getComplaintsByUser:', error);
    throw error;
  }
};

/**
 * Returns a single complaint by ID.
 * @param {string} id
 * @returns {Promise<object>}
 */
const getComplaintById = async (id) => {
  try {
    return await Complaint.findById(id);
  } catch (error) {
    logger.error('[ComplaintService] getComplaintById:', error);
    throw error;
  }
};

/**
 * Returns all complaints sorted by creation date descending.
 * @param {object} pagination
 * @returns {Promise<object>}
 */
const getFullComplaints = async (pagination) => {
  try {
    return await paginate(Complaint, {}, pagination, { sort: { createdAt: -1 } });
  } catch (error) {
    logger.error('[ComplaintService] getFullComplaints:', error);
    throw error;
  }
};

/**
 * Returns complaints filtered by workflow status.
 * @param {string} workflowStatus
 * @param {object} pagination
 * @returns {Promise<object>}
 */
const getComplaintsByStatus = async (workflowStatus, pagination) => {
  try {
    return await paginate(
      Complaint,
      { workflowStatus },
      pagination,
      { sort: { createdAt: -1 } }
    );
  } catch (error) {
    logger.error('[ComplaintService] getComplaintsByStatus:', error);
    throw error;
  }
};

/**
 * Returns complaints assigned to a mechanic by their email.
 * @param {string} email
 * @param {object} pagination
 * @returns {Promise<object>}
 */
const getComplaintsByMechanic = async (email, pagination) => {
  try {
    const mechanic = await Mechanic.findOne({ email });
    if (!mechanic) throw new Error('Mechanic not found');

    return await paginate(
      Complaint,
      {
        assignedMechanic: { $elemMatch: { mechanicId: mechanic.userId } },
      },
      pagination,
      { sort: { createdAt: -1 } }
    );
  } catch (error) {
    logger.error('[ComplaintService] getComplaintsByMechanic:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  createComplaint,
  assignMechanic,
  mechanicRequestItems,
  forwardToWorkshop,
  forwardToWorkshopWithoutPurchaseOrder,
  approveItemWithoutPurchaseOrder,
  createPurchaseOrderForComplaint,
  uploadPurchaseOrderForComplaint,
  purchaseApproval,
  managerApproval,
  ceoApproval,
  accountsApproval,
  markItemsAvailable,
  addSolutionToComplaint,
  getComplaintsByUser,
  getComplaintById,
  getFullComplaints,
  getComplaintsByStatus,
  getComplaintsByMechanic,
};
