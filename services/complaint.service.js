// services/complaint.service.js
const Complaint          = require('../models/complaint.model');
const Equipment          = require('../models/equipment.model');
const MobilizationModel  = require('../models/mobilizations.model');
const LPO                = require('../models/lpo.model');
const Mechanic           = require('../models/mechanic.model');
const { createNotification }  = require('./notification.service');
const PushNotificationService = require('../push/notification.push');
const { default: wsUtils } = require('../sockets/websocket.js');
const analyser = require('../analyser/dashboard.analyser');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a complaint ID string based on current date/time and today's complaint count.
 * Format: DDMMYYHHMM(AM/PM)CP{count}
 * @returns {Promise<string>}
 */
const generateComplaintId = async () => {
  const now  = new Date();
  const day   = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year  = String(now.getFullYear()).slice(-2);

  let hours      = now.getHours();
  const ampm     = hours >= 12 ? 'PM' : 'AM';
  hours          = hours % 12 || 12;
  const fmtHours = String(hours).padStart(2, '0');
  const minutes  = String(now.getMinutes()).padStart(2, '0');

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const todayCount = await Complaint.countDocuments({ createdAt: { $gte: startOfDay, $lte: endOfDay } });

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
const buildMobilizationRecord = (equipment, previousStatus, newStatus, remarks) => {
  const now  = new Date();
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  let operatorName = null;
  if (equipment.certificationBody?.length > 0) {
    const last   = equipment.certificationBody[equipment.certificationBody.length - 1];
    operatorName = typeof last === 'object' ? last.operatorName : last;
  }

  return {
    equipmentId:    equipment._id,
    regNo:          equipment.regNo,
    machine:        equipment.machine,
    action:         'status_changed',
    previousStatus,
    newStatus,
    site:           equipment.site?.length > 0 ? equipment.site[equipment.site.length - 1] : 'Workshop',
    operator:       operatorName,
    withOperator:   !!operatorName,
    month:          now.getMonth() + 1,
    year:           now.getFullYear(),
    date:           now,
    time,
    remarks,
    status:         newStatus,
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
const notify = async (notificationPayload, pushTarget, pushTitle, pushBody, priority = 'high') => {
  const notification = await createNotification(notificationPayload);
  await PushNotificationService.sendGeneralNotification(
    pushTarget, pushTitle, pushBody, priority, 'normal',
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
    if (!equipment) throw { status: 404, message: `Equipment with regNo ${complaint.regNo} not found` };

    const previousStatus = equipment.status;
    const complaintId    = await generateComplaintId();

    const complaintData = await new Complaint({
      ...complaint,
      complaintId,
      workflowStatus:          'registered',
      status:                  'pending',
      previousEquipmentStatus: previousStatus,
    }).save();

    await Equipment.findOneAndUpdate(
      { regNo: complaint.regNo },
      { status: 'maintenance', lastMaintenanceDate: new Date() },
      { new: true }
    );

    await MobilizationModel.create(buildMobilizationRecord(
      equipment, previousStatus, 'maintenance',
      `Equipment moved to maintenance due to complaint registration. Complaint ID: ${complaintData.complaintId}. Remarks: ${complaint.remarks || 'No remarks provided'}`
    ));

    const officeHero = JSON.parse(process.env.OFFICE_HERO);
    await notify(
      {
        title:        `New Complaint Registered - ${complaint.regNo}`,
        description:  `${complaint.name} registered complaint for ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo}. Equipment status changed from ${previousStatus} to Maintenance. Please assign a mechanic.`,
        priority:     'high',
        sourceId:     complaintData._id,
        recipient:    officeHero,
        time:         new Date(),
        navigateTo:   `/(mechanics)/assign/${complaintData._id}`,
        navigateText: 'Assign Mechanic',
        navigteToId:  complaintData._id,
        hasButton:    true,
      },
      officeHero,
      `New Complaint - ${complaint.regNo}`,
      `New complaint needs mechanic assignment. Equipment ${complaint.regNo} is now in Maintenance.`
    );

    return complaintData;
  } catch (error) {
    console.error('[ComplaintService] createComplaint:', error);
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
    const assignedDate  = new Date();
    const mechanicsData = mechanicsArray.map(m => ({ mechanicId: m.mechanicId, mechanicName: m.mechanicName, assignedBy, assignedDate }));
    const mechanicNames = mechanicsArray.map(m => m.mechanicName).join(', ');

    const complaint = await Complaint.findByIdAndUpdate(
      complaintId,
      {
        assignedMechanic: mechanicsData,
        workflowStatus:   'assigned_to_mechanic',
        $push: { approvalTrail: { approvedBy: assignedBy, role: 'MAINTENANCE_HEAD', action: 'forwarded', comments: `Assigned to ${mechanicsArray.length} mechanic(s): ${mechanicNames}` } }
      },
      { new: true }
    );
    if (!complaint) throw { status: 404, message: 'Complaint not found' };

    await Promise.all(mechanicsArray.map(m =>
      Mechanic.findOneAndUpdate({ userId: m.mechanicId }, { status: 'engaged' }, { new: true })
    ));

    const equipment         = await Equipment.findOne({ regNo: complaint.regNo });
    const notificationTitle = mechanicsArray.length === 1
      ? `Hamsa assigned - ${mechanicNames} to ${complaint.regNo}`
      : `Hamsa assigned - ${mechanicsArray.length} mechanics to ${complaint.regNo}`;
    const notificationDesc  = mechanicsArray.length === 1
      ? `Hamsa assigned - ${mechanicNames} to ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo} for complaint rectification.`
      : `Hamsa assigned - ${mechanicsArray.length} mechanics (${mechanicNames}) to ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo} for complaint rectification.`;

    const officeHero = JSON.parse(process.env.OFFICE_HERO);
    await notify(
      { title: notificationTitle, description: notificationDesc, priority: 'high', sourceId: 'job_assignment-annoucement', recipient: officeHero, time: new Date() },
      officeHero, notificationTitle, notificationDesc
    );

    return { status: 200, message: `${mechanicsArray.length} mechanic(s) assigned successfully`, data: complaint };
  } catch (error) {
    console.error('[ComplaintService] assignMechanic:', error);
    throw error;
  }
};

/**
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
        $push: { mechanicRequests: { requestText: requestData.requestText, audioFile: requestData.audioFile || null, status: 'pending' } },
        workflowStatus: 'mechanic_requested'
      },
      { new: true }
    );
    if (!complaint) throw { status: 404, message: 'Complaint not found' };

    const equipment     = await Equipment.findOne({ regNo: complaint.regNo });
    const mechanicNames = complaint.assignedMechanic?.length > 0
      ? complaint.assignedMechanic.map(m => m.mechanicName).join(', ')
      : 'Mechanic';

    const officeHero = JSON.parse(process.env.OFFICE_HERO);
    await notify(
      {
        title:        `Mechanic Item Request - ${complaint.regNo}`,
        description:  `${mechanicNames} needs items for ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo}. Request: ${requestData.requestText}`,
        priority:     'high',
        sourceId:     'mechanic_request',
        recipient:    officeHero,
        time:         new Date(),
        navigateTo:   `/(mechanics)/assign/${complaint._id}`,
        navigateText: 'View mechanic request',
        navigteToId:  complaint._id,
        hasButton:    true,
      },
      officeHero, 'Mechanic Item Request', `${mechanicNames} needs items for ${complaint.regNo}`
    );

    return { status: 200, message: 'Item request submitted successfully', data: complaint };
  } catch (error) {
    console.error('[ComplaintService] mechanicRequestItems:', error);
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
const forwardToWorkshop = async (complaintId, approvedBy, comments = '', documentsWithUploadData = null) => {
  try {
    const approvalEntry = {
      approvedBy,
      role:     'MAINTENANCE_HEAD',
      action:   'approved',
      comments: comments || 'Approved and forwarded to workshop manager',
    };

    const updateObj = { 'mechanicRequests.$[].status': 'approved_by_maintenance', workflowStatus: 'sent_to_workshop' };

    if (documentsWithUploadData?.length > 0) {
      const attachmentDocs = documentsWithUploadData.map(doc => ({
        fileName: doc.fileName, originalName: doc.originalName, filePath: doc.filePath,
        fileSize: doc.fileSize, mimeType: doc.mimeType, type: doc.type, uploadDate: doc.uploadDate,
      }));
      approvalEntry.attachments = attachmentDocs;
      updateObj.$push = { attachments: { $each: attachmentDocs }, approvalTrail: approvalEntry };
    } else {
      updateObj.$push = { approvalTrail: approvalEntry };
    }

    const complaint = await Complaint.findByIdAndUpdate(complaintId, updateObj, { new: true });
    if (!complaint) throw { status: 404, message: 'Complaint not found' };

    const equipment       = await Equipment.findOne({ regNo: complaint.regNo });
    const lastRequest     = complaint.mechanicRequests[complaint.mechanicRequests.length - 1];
    let   notificationMsg = `Please create LPO for ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo}. Items needed: ${lastRequest.requestText}`;
    let   pushBody        = `Create LPO for ${complaint.regNo} - Items needed by mechanic`;

    if (documentsWithUploadData?.length > 0) {
      notificationMsg += `. ${documentsWithUploadData.length} supporting document(s) attached.`;
      pushBody        += ` (${documentsWithUploadData.length} attachments)`;
    }

    const officeMain = JSON.parse(process.env.OFFICE_MAIN);
    await notify(
      { title: `Create LPO Request - ${complaint.regNo}`, description: notificationMsg, priority: 'high', sourceId: 'lpo_request', recipient: officeMain, time: new Date(), navigateTo: `/(workflow)/quotation/${complaint._id}`, navigateText: `View Hamza's request`, navigteToId: complaint._id, hasButton: true },
      officeMain, 'LPO Creation Request', pushBody
    );

    return complaint;
  } catch (error) {
    console.error('[ComplaintService] forwardToWorkshop:', error);
    throw error;
  }
};

/**
 * MAINTENANCE_HEAD forwards complaint to WORKSHOP_MANAGER without requiring an LPO.
 * @param {string} complaintId
 * @param {string} approvedBy
 * @param {string} comments
 * @returns {Promise<object>}
 */
const forwardToWorkshopWithoutLPO = async (complaintId, approvedBy, comments = '') => {
  try {
    const complaint = await Complaint.findByIdAndUpdate(
      complaintId,
      {
        'mechanicRequests.$[].status': 'approved_by_maintenance',
        workflowStatus: 'sent_to_workshop_without_lpo',
        $push: { approvalTrail: { approvedBy, role: 'MAINTENANCE_HEAD', action: 'approved', comments: comments || 'Approved and forwarded to workshop manager and purchase manager' } }
      },
      { new: true }
    );
    if (!complaint) throw { status: 404, message: 'Complaint not found' };

    const equipment  = await Equipment.findOne({ regNo: complaint.regNo });
    const title      = `Approval Needed! - ${equipment.machine} - ${equipment.regNo}`;
    const body       = `Hamza requested : ${comments}`;
    const officeMain = JSON.parse(process.env.OFFICE_MAIN);

    await notify(
      { title, description: body, priority: 'high', sourceId: 'wihtout_lpo_request', recipient: officeMain, time: new Date(), navigateTo: `/(mechanics)/assign/${complaint._id}`, navigateText: 'Approve', directApproval: true, approvalPort: `complaints/approve-item/without-lpo/${complaint._id}`, navigteToId: complaint._id, hasButton: true },
      officeMain, title, body
    );

    return complaint;
  } catch (error) {
    console.error('[ComplaintService] forwardToWorkshopWithoutLPO:', error);
    throw error;
  }
};

/**
 * Approves an item request that was submitted without an LPO.
 * @param {string} complaintId
 * @param {string} approvedBy
 * @returns {Promise<object>}
 */
const approveItemWithoutLPO = async (complaintId, approvedBy) => {
  try {
    const existing = await Complaint.findById(complaintId);
    if (!existing) throw { status: 404, message: 'Complaint not found' };
    if (existing.workflowStatus !== 'sent_to_workshop_without_lpo') throw { status: 400, message: 'Already Approved' };

    const complaint = await Complaint.findByIdAndUpdate(
      complaintId,
      { workflowStatus: 'approved_without_lpo', $push: { approvalTrail: { approvedBy, role: 'PURCHASE_MANAGER', action: 'approved' } } },
      { new: true }
    );
    if (!complaint) throw { status: 404, message: 'Complaint not found' };

    const equipment  = await Equipment.findOne({ regNo: complaint.regNo });
    const title      = `Item Approved - ${equipment.machine} - ${equipment.regNo}`;
    const body       = `Hamza requested item is approved by purchase manager of ${equipment.machine} - ${equipment.regNo}`;
    const officeMain = JSON.parse(process.env.OFFICE_MAIN);

    await notify({ title, description: body, priority: 'high', sourceId: 'approved_wihtout_lpo_request', recipient: officeMain, time: new Date() }, officeMain, title, body);

    return complaint;
  } catch (error) {
    console.error('[ComplaintService] approveItemWithoutLPO:', error);
    throw error;
  }
};

/**
 * WORKSHOP_MANAGER links an LPO to the complaint (Step 5).
 * @param {string} complaintId
 * @param {object} lpoData
 * @param {string} createdBy
 * @returns {Promise<object>}
 */
const createLPOForComplaint = async (complaintId, lpoData, createdBy) => {
  try {
    const lpo = await LPO.findOne({ lpoRef: lpoData.lpoRef });

    const complaint = await Complaint.findByIdAndUpdate(
      complaintId,
      {
        lpoDetails:     { lpoId: lpo._id, lpoRef: lpo.lpoRef, createdBy, status: 'created' },
        workflowStatus: 'lpo_created',
        $push: { approvalTrail: { approvedBy: createdBy, role: 'WORKSHOP_MANAGER', action: 'approved', comments: `LPO created ${lpo.lpoRef}` } }
      },
      { new: true }
    );
    if (!complaint) throw { status: 404, message: 'Complaint not found' };

    const officeMain = JSON.parse(process.env.OFFICE_MAIN);
    const title      = `LPO ${lpo.lpoRef} Created`;
    const body       = `LPO ${lpo.lpoRef} is created for complaint with ${complaint.regNo}, Await until lpo is uploaded`;

    await notify({ title, description: body, priority: 'high', sourceId: 'lpo_approval', recipient: officeMain, time: new Date() }, officeMain, title, body);

    return { status: 200, message: 'LPO created successfully', data: { complaint, lpo } };
  } catch (error) {
    console.error('[ComplaintService] createLPOForComplaint:', error);
    throw error;
  }
};

/**
 * Uploads (or amends) the LPO document for a complaint.
 * @param {string}  complaintId
 * @param {object}  lpoFileData
 * @param {string}  uploadedBy
 * @param {string}  lpoRef
 * @param {string}  description
 * @param {boolean} isAmendment
 * @returns {Promise<object>}
 */
const uploadLPOForComplaint = async (complaintId, lpoFileData, uploadedBy, lpoRef, description, isAmendment = false) => {
  try {
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) throw Object.assign(new Error('Complaint not found'), { status: 404 });

    const validStatuses = isAmendment
      ? ['lpo_uploaded', 'purchase_approved', 'accounts_approved', 'manager_approved', 'ceo_approved', 'md_approved', 'completed', 'items_available']
      : ['lpo_created', 'sent_to_workshop'];

    if (!validStatuses.includes(complaint.workflowStatus)) {
      throw Object.assign(new Error(`Invalid workflow status for LPO ${isAmendment ? 'amendment' : 'upload'}`), { status: 400 });
    }

    const updateData = {
      workflowStatus:              isAmendment ? 'lpo_amended' : 'lpo_uploaded',
      updatedAt:                   new Date(),
      'lpoDetails.lpoFile':        lpoFileData,
      'lpoDetails.lpoRef':         lpoRef,
      'lpoDetails.description':    description || '',
      'lpoDetails.uploadedBy':     uploadedBy,
      'lpoDetails.uploadedDate':   new Date(),
      'lpoDetails.status':         isAmendment ? 'amended' : 'uploaded',
    };

    if (isAmendment) {
      Object.assign(updateData, {
        'lpoDetails.isAmendment':        true,
        'lpoDetails.amendmentDate':      new Date().toLocaleDateString('en-GB'),
        'lpoDetails.PMRsigned':          false,
        'lpoDetails.PMRauthorised':      false,
        'lpoDetails.MANAGERsigned':      false,
        'lpoDetails.MANAGERauthorised':  false,
        'lpoDetails.ACCOUNTSsigned':     false,
        'lpoDetails.ACCOUNTSauthorised': false,
        'lpoDetails.CEOsigned':          false,
        'lpoDetails.CEOauthorised':      false,
        'lpoDetails.MDsigned':           false,
        'lpoDetails.MDauthorised':       false,
      });
    }

    updateData.$push = {
      approvalTrail: { approvedBy: uploadedBy, role: 'WORKSHOP_MANAGER', approvalDate: new Date(), comments: isAmendment ? `LPO amendment uploaded: ${lpoRef}` : `LPO document uploaded: ${lpoRef}`, action: 'uploaded' }
    };

    const updatedComplaint = await Complaint.findByIdAndUpdate(complaintId, updateData, { new: true, runValidators: true });

    const notificationTitle = isAmendment ? `LPO Amendment Approval Needed - ${lpoRef}` : `LPO Approval Needed - ${lpoRef}`;
    const notificationDesc  = isAmendment
      ? `LPO has been amended for complaint ${complaint.regNo}. LPO Ref: ${lpoRef}. Purchase Manager Approval Needed! Please review and approve the amendment.`
      : `New LPO created for complaint ${complaint.regNo}. LPO Ref: ${lpoRef}. Purchase Manager Approval Needed! Please review and approve.`;

    const officeHero = JSON.parse(process.env.OFFICE_HERO);
    await notify(
      { title: notificationTitle, description: notificationDesc, priority: 'high', sourceId: 'lpo_approval', recipient: officeHero, time: new Date(), navigateTo: `/(signature)/pm/${complaint._id}`, navigateText: 'View and Sign', navigteToId: complaint._id, hasButton: true },
      officeHero, notificationTitle, notificationDesc
    );

    return {
      status:  202,
      message: isAmendment ? 'LPO amendment uploaded successfully and sent for re-approval' : 'LPO uploaded successfully and sent to PURCHASE_MANAGER for approval',
      data:    updatedComplaint,
    };
  } catch (error) {
    console.error('[ComplaintService] uploadLPOForComplaint:', error);
    throw error;
  }
};

/**
 * PURCHASE_MANAGER approves (and optionally signs) the LPO (Step 6).
 * @param {string} complaintId
 * @param {object} approvalData
 * @returns {Promise<object>}
 */
const purchaseApproval = async (complaintId, approvalData) => {
  try {
    const { approvedBy, comments = '', signed = false, authorised = false, approvedDate, approvedFrom, approvedIP, approvedBDevice, approvedLocation } = approvalData;

    const existing = await Complaint.findById(complaintId);
    if (!existing) throw { status: 404, message: 'Complaint not found' };
    if (!['lpo_uploaded', 'lpo_amended'].includes(existing.workflowStatus)) {
      throw { status: 400, message: `Invalid workflow status. Expected 'lpo_uploaded' or 'lpo_amended', got '${existing.workflowStatus}'` };
    }

    const updateFields = {
      'lpoDetails.purchaseApprovalDate': new Date(),
      'lpoDetails.status':               'purchase_approved',
      workflowStatus:                    'purchase_approved',
      $push: { approvalTrail: { approvedBy, role: 'PURCHASE_MANAGER', action: 'approved', comments: comments || 'Purchase approved' } }
    };

    if (signed) {
      Object.assign(updateFields, {
        'lpoDetails.PMRsigned':       true,
        'lpoDetails.PMRauthorised':   authorised,
        'lpoDetails.PMRapprovedBy':   approvedBy,
        'lpoDetails.PMRapprovedDate': approvedDate || new Date().toISOString(),
        ...(approvedFrom     && { 'lpoDetails.PMRapprovedFrom':     approvedFrom }),
        ...(approvedIP       && { 'lpoDetails.PMRapprovedIP':       approvedIP }),
        ...(approvedBDevice  && { 'lpoDetails.PMRapprovedBDevice':  approvedBDevice }),
        ...(approvedLocation && { 'lpoDetails.PMRapprovedLocation': approvedLocation }),
      });
    }

    const complaint = await Complaint.findByIdAndUpdate(complaintId, updateFields, { new: true });
    if (!complaint) throw { status: 404, message: 'Failed to update complaint' };

    if (complaint.lpoDetails?.lpoId) await LPO.updateOne({ _id: complaint.lpoDetails.lpoId }, { pmSigned: true });

    const lpoData   = await LPO.findById(complaint.lpoDetails.lpoId);
    const prefix    = lpoData.isAmendmented ? 'Amendment! ' : '';
    const title     = `${prefix}MANAGER Approval Needed - LPO ${complaint.lpoDetails.lpoRef}`;
    const description = lpoData.isAmendmented
      ? `Purchace Manager signed and approved amendment LPO for complaint ${complaint.regNo}. Manager approval needed.`
      : `Purchace Manager signed and approved LPO for complaint ${complaint.regNo}. Manager approval needed.`;

    const officeHero = JSON.parse(process.env.OFFICE_HERO);
    await notify(
      { title, description, priority: 'high', sourceId: 'accounts_approval', recipient: officeHero, time: new Date(), navigateTo: `/(signature)/op/${complaint._id}`, navigateText: 'View and Sign', navigteToId: complaint._id, hasButton: true },
      officeHero, title, description
    );

    return { status: 200, message: `Purchase Manager approval ${signed ? 'and signing ' : ''}completed successfully`, data: complaint, signed, authorised };
  } catch (error) {
    console.error('[ComplaintService] purchaseApproval:', error);
    throw error;
  }
};

/**
 * MANAGER approves (and optionally signs) the LPO, then routes to CEO or MD (Step 7).
 * @param {string} complaintId
 * @param {string} approvedBy
 * @param {string} comments
 * @param {object} approvedCreds
 * @returns {Promise<object>}
 */
const managerApproval = async (complaintId, approvedBy, comments = '', approvedCreds) => {
  try {
    const updateFields = {
      'lpoDetails.managerApprovalDate': new Date(),
      'lpoDetails.status':              'manager_approved',
      workflowStatus:                   'manager_approved',
      $push: { approvalTrail: { approvedBy, role: 'MANAGER', action: 'approved', comments: comments || 'MANAGER approved' } }
    };

    if (approvedCreds?.signed) {
      Object.assign(updateFields, {
        'lpoDetails.MANAGERsigned':       true,
        'lpoDetails.MANAGERauthorised':   approvedCreds.authorised,
        'lpoDetails.MANAGERapprovedBy':   approvedCreds.approvedBy,
        'lpoDetails.MANAGERapprovedDate': approvedCreds.approvedDate || new Date().toISOString(),
        ...(approvedCreds.approvedFrom     && { 'lpoDetails.MANAGERapprovedFrom':     approvedCreds.approvedFrom }),
        ...(approvedCreds.approvedIP       && { 'lpoDetails.MANAGERapprovedIP':       approvedCreds.approvedIP }),
        ...(approvedCreds.approvedBDevice  && { 'lpoDetails.MANAGERapprovedBDevice':  approvedCreds.approvedBDevice }),
        ...(approvedCreds.approvedLocation && { 'lpoDetails.MANAGERapprovedLocation': approvedCreds.approvedLocation }),
      });
    }

    const complaint = await Complaint.findByIdAndUpdate(complaintId, updateFields, { new: true });
    if (!complaint) throw { status: 404, message: 'Complaint not found' };

    if (complaint.lpoDetails?.lpoId) await LPO.updateOne({ _id: complaint.lpoDetails.lpoId }, { managerSigned: true });

    const lpoData     = await LPO.findById(complaint.lpoDetails.lpoId);
    const isAmendment = lpoData.isAmendmented;
    const sigTitle    = lpoData.signatures.authorizedSignatoryTitle;
    const isCEO       = sigTitle === 'CEO';
    const isMD        = sigTitle === 'MANAGING DIRECTOR';

    if (!isCEO && !isMD) throw { status: 404, message: 'Invalid auth position' };

    const prefix      = isAmendment ? 'Amendment! ' : '';
    const target      = isCEO ? process.env.CEO : process.env.MD;
    const screen      = isCEO ? `/(signature)/ceo/${complaint._id}` : `/(signature)/ceo/${complaint._id}`;
    const roleLabel   = isCEO ? 'CEO' : 'MD';
    const source      = isCEO ? 'ceo_approval' : 'md_approval';
    const title       = `${prefix}${roleLabel} Approval Needed - LPO ${complaint.lpoDetails.lpoRef}`;
    const description = `Manager ${approvedCreds?.signed ? 'signed and ' : ''}approved ${isAmendment ? 'amendment ' : ''}LPO for complaint ${complaint.regNo}. ${roleLabel} approval needed.`;

    const officeHero  = JSON.parse(process.env.OFFICE_HERO);
    await notify(
      { title, description, priority: 'high', sourceId: source, recipient: officeHero, time: new Date(), navigateTo: screen, navigateText: 'View and Sign', navigteToId: complaint._id, hasButton: true },
      officeHero, title, description
    );

    return { status: 200, message: 'MANAGER approval completed', data: complaint };
  } catch (error) {
    console.error('[ComplaintService] managerApproval:', error);
    throw error;
  }
};

/**
 * CEO or MD approves (and optionally signs) the LPO, then routes to ACCOUNTS (Step 8).
 * @param {string} complaintId
 * @param {string} approvedBy
 * @param {string} comments
 * @param {object} approvedCreds
 * @param {string} authUser - 'CEO' | 'MD'
 * @returns {Promise<object>}
 */
const ceoApproval = async (complaintId, approvedBy, comments = '', approvedCreds, authUser) => {
  try {
    const approverType   = authUser === 'MD' ? 'MD' : 'CEO';
    const approvalStatus = `${approverType.toLowerCase()}_approved`;

    const updateFields = {
      [`lpoDetails.${approverType.toLowerCase()}ApprovalDate`]: new Date(),
      'lpoDetails.status': approvalStatus,
      workflowStatus:      approvalStatus,
      $push: { approvalTrail: { approvedBy, role: approverType, action: 'approved', comments: comments || `${approverType} approved` } }
    };

    if (approvedCreds?.signed) {
      Object.assign(updateFields, {
        [`lpoDetails.${approverType}signed`]:       true,
        [`lpoDetails.${approverType}authorised`]:   approvedCreds.authorised,
        [`lpoDetails.${approverType}approvedBy`]:   approvedCreds.approvedBy,
        [`lpoDetails.${approverType}approvedDate`]: approvedCreds.approvedDate || new Date().toISOString(),
        ...(approvedCreds.approvedFrom     && { [`lpoDetails.${approverType}approvedFrom`]:     approvedCreds.approvedFrom }),
        ...(approvedCreds.approvedIP       && { [`lpoDetails.${approverType}approvedIP`]:       approvedCreds.approvedIP }),
        ...(approvedCreds.approvedBDevice  && { [`lpoDetails.${approverType}approvedBDevice`]:  approvedCreds.approvedBDevice }),
        ...(approvedCreds.approvedLocation && { [`lpoDetails.${approverType}approvedLocation`]: approvedCreds.approvedLocation }),
      });
    }

    const complaint = await Complaint.findByIdAndUpdate(complaintId, updateFields, { new: true });
    if (!complaint) throw { status: 404, message: 'Complaint not found' };

    if (complaint.lpoDetails?.lpoId) {
      await LPO.updateOne({ _id: complaint.lpoDetails.lpoId }, approverType === 'MD' ? { mdSigned: true } : { ceoSigned: true });
    }

    const lpoData     = await LPO.findById(complaint.lpoDetails.lpoId);
    const isAmendment = lpoData.isAmendmented;
    const sigLabel    = lpoData.signatures.authorizedSignatoryTitle === 'CEO' ? 'CEO' : 'MD';
    const prefix      = isAmendment ? 'Amendment! ' : '';
    const title       = `${prefix}ACCOUNTS Approval Needed - LPO ${complaint.lpoDetails.lpoRef}`;
    const description = `${sigLabel} signed and approved ${isAmendment ? 'amendment ' : ''}LPO for complaint ${complaint.regNo}. ACCOUNTS approval needed.`;

    const officeHero = JSON.parse(process.env.OFFICE_HERO);
    await notify(
      { title, description, priority: 'high', sourceId: 'final_approval', recipient: officeHero, time: new Date(), navigateTo: `/(signature)/accounts/${complaint._id}`, navigateText: 'View and Sign', navigteToId: complaint._id, hasButton: true },
      officeHero, title, description
    );

    return { status: 200, message: `${approverType} approval completed`, data: complaint };
  } catch (error) {
    console.error(`[ComplaintService] ceoApproval (${authUser || 'CEO'}):`, error);
    throw error;
  }
};

/**
 * ACCOUNTS approves (and optionally signs) the LPO — final approval step (Step 9).
 * @param {string} complaintId
 * @param {string} approvedBy
 * @param {string} comments
 * @param {object} approvedCreds
 * @returns {Promise<object>}
 */
const accountsApproval = async (complaintId, approvedBy, comments = '', approvedCreds) => {
  try {
    const updateFields = {
      'lpoDetails.accountsApprovalDate': new Date(),
      'lpoDetails.status':               'accounts_approved',
      workflowStatus:                    'accounts_approved',
      $push: { approvalTrail: { approvedBy, role: 'ACCOUNTS', action: 'approved', comments: comments || 'ACCOUNTS approved' } }
    };

    if (approvedCreds?.signed) {
      Object.assign(updateFields, {
        'lpoDetails.ACCOUNTSsigned':       true,
        'lpoDetails.ACCOUNTSauthorised':   approvedCreds.authorised,
        'lpoDetails.ACCOUNTSapprovedBy':   approvedCreds.approvedBy,
        'lpoDetails.ACCOUNTSapprovedDate': approvedCreds.approvedDate || new Date().toISOString(),
        ...(approvedCreds.approvedFrom     && { 'lpoDetails.ACCOUNTSapprovedFrom':     approvedCreds.approvedFrom }),
        ...(approvedCreds.approvedIP       && { 'lpoDetails.ACCOUNTSapprovedIP':       approvedCreds.approvedIP }),
        ...(approvedCreds.approvedBDevice  && { 'lpoDetails.ACCOUNTSapprovedBDevice':  approvedCreds.approvedBDevice }),
        ...(approvedCreds.approvedLocation && { 'lpoDetails.ACCOUNTSapprovedLocation': approvedCreds.approvedLocation }),
      });
    }

    const complaint = await Complaint.findByIdAndUpdate(complaintId, updateFields, { new: true });
    if (!complaint) throw { status: 404, message: 'Complaint not found' };

    if (complaint.lpoDetails?.lpoId) await LPO.updateOne({ _id: complaint.lpoDetails.lpoId }, { accountsSigned: true });

    const lpoData     = await LPO.findById(complaint.lpoDetails.lpoId);
    const prefix      = lpoData.isAmendmented ? 'Amendment! ' : '';
    const title       = `${prefix}Approved - LPO ${complaint.lpoDetails.lpoRef}`;
    const description = `Accounts approved ${lpoData.isAmendmented ? 'amendment ' : ''}LPO for complaint ${complaint.regNo}. Items can now be procured.`;

    const officeMain = JSON.parse(process.env.OFFICE_MAIN);
    await notify(
      { title, description, priority: 'high', sourceId: 'manager_approval', recipient: officeMain, time: new Date(), navigateTo: `/(workflow)/lpo/${complaint._id}`, navigateText: 'View the item required', navigteToId: complaint._id, hasButton: true },
      officeMain, title, description
    );

    return { status: 200, message: 'ACCOUNTS approval completed', data: complaint };
  } catch (error) {
    console.error('[ComplaintService] accountsApproval:', error);
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
        'lpoDetails.status': 'items_procured',
        workflowStatus:      'items_available',
        $push: { approvalTrail: { approvedBy: markedBy, role: 'PROCUREMENT', action: 'approved', comments: 'Items procured and available' } }
      },
      { new: true }
    );
    if (!complaint) throw { status: 404, message: 'Complaint not found' };

    const officeHero = JSON.parse(process.env.OFFICE_HERO);
    await notify(
      { title: `Items Ready - ${complaint.regNo}`, description: `All requested items are now available for ${complaint.regNo}.`, priority: 'high', sourceId: 'items_ready', recipient: officeHero, time: new Date() },
      officeHero, 'Items Ready', `Items available for ${complaint.regNo}. You can start working now.`
    );

    return { status: 200, message: 'Items marked as available', data: complaint };
  } catch (error) {
    console.error('[ComplaintService] markItemsAvailable:', error);
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
const addSolutionToComplaint = async (complaintId, filesData, regNo, mechanic, remarks = '') => {
  try {
    const existing = await Complaint.findById(complaintId);
    if (!existing) throw { status: 404, message: 'Complaint not found' };

    const solutionFiles = filesData.map(file => ({
      fileName:     file.fileName,
      originalName: file.originalName,
      filePath:     file.filePath,
      mimeType:     file.mimeType,
      type:         file.type,
      url:          file.filePath,
      uploadDate:   new Date(),
      ...(file.type === 'video' && file.duration ? { duration: file.duration } : {}),
    }));

    const updateData = {
      $push: {
        solutions:     { $each: solutionFiles },
        approvalTrail: { approvedBy: mechanic, role: 'MECHANIC', action: 'approved', comments: remarks || 'Work completed successfully' }
      },
      $set: {
        status:         'resolved',
        workflowStatus: 'completed',
        updatedAt:      new Date(),
        ...(remarks ? { rectificationRemarks: remarks } : {}),
      }
    };

    const complaint      = await Complaint.findByIdAndUpdate(complaintId, updateData, { new: true });
    const equipment      = await Equipment.findOne({ regNo: complaint.regNo });
    const restoredStatus = existing.previousEquipmentStatus === 'maintenance' ? 'active' : (existing.previousEquipmentStatus || 'active');

    await Equipment.findOneAndUpdate(
      { regNo: complaint.regNo },
      { status: restoredStatus, lastCompletedMaintenanceDate: new Date() },
      { new: true }
    );

    await MobilizationModel.create(buildMobilizationRecord(
      equipment, 'maintenance', restoredStatus,
      `Maintenance completed by ${mechanic}. Equipment status changed to ${restoredStatus}. Complaint ID: ${existing.complaintId}. ${remarks || 'Equipment ready for operation.'}`
    ));

    if (complaint.assignedMechanic?.length > 0) {
      await Mechanic.updateMany(
        { userId: { $in: complaint.assignedMechanic.map(m => m.mechanicId) } },
        { $set: { status: 'available' } }
      );
    }

    const officeHero = JSON.parse(process.env.OFFICE_HERO);
    await notify(
      { title: `Work Completed - ${complaint.regNo}`, description: `${mechanic} completed work on ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo}. Equipment is now ${restoredStatus} and ready for operation.`, priority: 'medium', sourceId: 'work_completed', recipient: officeHero, time: new Date() },
      officeHero, `Work Completed - ${complaint.regNo}`, `${mechanic} completed work on ${equipment?.brand || 'unknown'} ${equipment?.machine || 'equipment'} - ${complaint.regNo}. Equipment is now ${restoredStatus}.`, 'medium'
    );

    return { status: 200, message: 'Work completed successfully', data: complaint };
  } catch (error) {
    console.error('[ComplaintService] addSolutionToComplaint:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all complaints for a given uniqueCode.
 * @param {string} uniqueCode
 * @returns {Promise<Array>}
 */
const getComplaintsByUser = async (uniqueCode) => {
  try {
    return await Complaint.find({ uniqueCode }).sort({ createdAt: -1 });
  } catch (error) {
    console.error('[ComplaintService] getComplaintsByUser:', error);
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
    console.error('[ComplaintService] getComplaintById:', error);
    throw error;
  }
};

/**
 * Returns all complaints sorted by creation date descending.
 * @returns {Promise<object>}
 */
const getFullComplaints = async () => {
  try {
    const result = await Complaint.find({}).sort({ createdAt: -1 });
    return { status: 200, data: result };
  } catch (error) {
    console.error('[ComplaintService] getFullComplaints:', error);
    throw error;
  }
};

/**
 * Returns complaints filtered by workflow status.
 * @param {string} workflowStatus
 * @returns {Promise<Array>}
 */
const getComplaintsByStatus = async (workflowStatus) => {
  try {
    return await Complaint.find({ workflowStatus }).sort({ createdAt: -1 });
  } catch (error) {
    console.error('[ComplaintService] getComplaintsByStatus:', error);
    throw error;
  }
};

/**
 * Returns complaints assigned to a mechanic by their email.
 * @param {string} email
 * @returns {Promise<Array>}
 */
const getComplaintsByMechanic = async (email) => {
  try {    
    const mechanic = await Mechanic.findOne({ email }); 
    if (!mechanic) throw new Error('Mechanic not found');

    return await Complaint.find({ assignedMechanic: { $elemMatch: { mechanicId: mechanic.userId } } }).sort({ createdAt: -1 });
  } catch (error) {
    console.error('[ComplaintService] getComplaintsByMechanic:', error);
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
  forwardToWorkshopWithoutLPO,
  approveItemWithoutLPO,
  createLPOForComplaint,
  uploadLPOForComplaint,
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