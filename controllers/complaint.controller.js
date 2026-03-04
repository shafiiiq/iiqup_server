// controllers/complaint.controller.js
const path                   = require('path');
const ComplaintService       = require('../services/complaint.service');
const { putObject }          = require('../aws/s3.aws');
const { uploadToS3 }         = require('../services/s3.service');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;

const isVideoFile = (mimeType, fileName) => {
  if (mimeType) {
    const normalized = mimeType.toLowerCase();
    if (normalized === 'video' || normalized.startsWith('video/')) return true;
  }
  if (fileName) {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv', '.flv', '.m4v', '.3gp', '.mkv'];
    return videoExtensions.includes(path.extname(fileName).toLowerCase());
  }
  return false;
};

const uploadWithRetry = async (file, attempt = 1) => {
  try {
    await uploadToS3(file.buffer, file.filePath, file.mimeType);
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      return uploadWithRetry(file, attempt + 1);
    }
    throw new Error(`Failed to upload file after ${MAX_RETRIES} attempts: ${file.fileName}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Complaint Lifecycle Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /complaints/register
 * Step 1 — Registers a new complaint with media file uploads to S3.
 */
const registerComplaint = async (req, res) => {
  try {
    const { regNo, name, uniqueCode, remarks } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one media file is required' });
    }

    const uploadData = files.map(file => {
      const ext           = path.extname(file.originalname);
      const finalFilename = `${regNo || 'no-reg'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`;
      const s3Key         = `complaints/${regNo || 'no-reg'}/${uniqueCode}/complaint-${uniqueCode}-${finalFilename}`;

      return {
        fileName:     finalFilename,
        originalName: file.originalname,
        filePath:     s3Key,
        mimeType:     file.mimetype,
        type:         isVideoFile(file.mimetype, file.originalname) ? 'video' : 'photo',
        buffer:       file.buffer,
        uploadDate:   new Date(),
      };
    });

    await Promise.all(uploadData.map(file => uploadWithRetry(file)));

    const complaintData = {
      uniqueCode,
      regNo:      regNo  || 'no-reg',
      name:       name   || 'no-name',
      remarks:    remarks || '',
      mediaFiles: uploadData.map(({ fileName, originalName, filePath, mimeType, type, uploadDate }) => ({
        fileName, originalName, filePath, mimeType, type, uploadDate,
      })),
    };

    const result = await ComplaintService.createComplaint(complaintData);

    res.status(201).json({
      success: true,
      message: 'Complaint registered successfully',
      data:    { complaint: result },
    });
  } catch (error) {
    console.error('[Complaint] registerComplaint:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to register complaint', error: error.message });
  }
};

/**
 * PUT /complaints/:complaintId/assign-mechanic
 * Step 2 — Assigns one or more mechanics to a complaint (MAINTENANCE_HEAD).
 */
const assignMechanic = async (req, res) => {
  try {
    const { complaintId }        = req.params;
    const { mechanics, assignedBy } = req.body;

    if (!mechanics || !Array.isArray(mechanics) || mechanics.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'mechanics array is required and must contain at least one mechanic',
      });
    }

    if (!assignedBy) {
      return res.status(400).json({ success: false, message: 'assignedBy is required' });
    }

    for (const mechanic of mechanics) {
      if (!mechanic.mechanicId || !mechanic.mechanicName) {
        return res.status(400).json({ success: false, message: 'Each mechanic must have mechanicId and mechanicName' });
      }
    }

    const result = await ComplaintService.assignMechanic(complaintId, mechanics, assignedBy);

    res.status(200).json({
      success: true,
      message: 'Mechanic(s) assigned successfully',
      data:    result,
    });
  } catch (error) {
    console.error('[Complaint] assignMechanic:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to assign mechanics' });
  }
};

/**
 * PUT /complaints/:complaintId/request-items
 * Step 3 — Mechanic submits a parts/items request with optional audio file.
 */
const mechanicRequestItems = async (req, res) => {
  try {
    const { complaintId }                    = req.params;
    const { requestText, audioFile, mechanicId } = req.body;

    if (!requestText && !audioFile) {
      return res.status(400).json({ success: false, message: 'Either requestText or audioFile is required' });
    }

    let audioFileData = null;
    if (audioFile) {
      const ext           = path.extname(audioFile.fileName);
      const finalFilename = `audio-${complaintId}-${Date.now()}${ext}`;
      audioFileData = {
        fileName:   finalFilename,
        filePath:   `complaint-audio/${complaintId}/${finalFilename}`,
        duration:   audioFile.duration || 0,
        fileBuffer: audioFile.fileBuffer,
        mimeType:   audioFile.mimeType,
      };
    }

    const result = await ComplaintService.mechanicRequestItems(
      complaintId,
      { requestText, audioFile: audioFileData },
      mechanicId,
    );

    res.status(200).json({
      success: true,
      message: 'Item request submitted successfully',
      data:    result.data,
    });

    if (audioFileData?.fileBuffer) {
      try {
        const buffer = Buffer.from(audioFileData.fileBuffer, 'base64');
        await uploadToS3(buffer, audioFileData.filePath, audioFileData.mimeType);
      } catch (error) {
        console.error('[Complaint] mechanicRequestItems — audio upload failed:', error);
      }
    }
  } catch (error) {
    console.error('[Complaint] mechanicRequestItems:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to submit request' });
  }
};

/**
 * PUT /complaints/:complaintId/forward-to-workshop
 * Step 4 — MAINTENANCE_HEAD forwards complaint to WORKSHOP_MANAGER, optionally with documents.
 */
const forwardToWorkshop = async (req, res) => {
  try {
    const { complaintId }                    = req.params;
    const { approvedBy, comments, documents } = req.body;

    if (!approvedBy) {
      return res.status(400).json({ success: false, message: 'approvedBy is required' });
    }

    let documentsWithUploadData = null;
    if (documents?.length > 0) {
      documentsWithUploadData = await Promise.all(
        documents.map(async (document, index) => {
          const ext           = path.extname(document.fileName);
          const finalFilename = `${approvedBy}-${Date.now()}-${index}${ext}`;
          const s3Key         = `complaints/${complaintId}/attachments/forward-to-workshop-${finalFilename}`;
          const uploadUrl     = await putObject(document.fileName, s3Key, document.mimeType);

          return {
            fileName:     finalFilename,
            originalName: document.fileName,
            filePath:     s3Key,
            fileSize:     document.size,
            mimeType:     document.mimeType,
            type:         document.mimeType?.startsWith('image/') ? 'image' : 'document',
            uploadDate:   new Date(),
            uploadUrl,
          };
        }),
      );
    }

    const result = await ComplaintService.forwardToWorkshop(complaintId, approvedBy, comments, documentsWithUploadData);

    const responseData = documentsWithUploadData
      ? {
          complaint:  result,
          uploadData: documentsWithUploadData.map(({ uploadUrl, filePath, fileName, originalName }) => ({
            uploadUrl, key: filePath, fileName, originalName,
          })),
        }
      : result;

    res.status(200).json({
      success: true,
      message: 'Request forwarded to workshop manager',
      data:    responseData,
    });
  } catch (error) {
    console.error('[Complaint] forwardToWorkshop:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to forward to workshop' });
  }
};

/**
 * PUT /complaints/:complaintId/forward-to-workshop-no-lpo
 * Step 4 (alternate) — Forwards complaint to workshop without requiring an LPO.
 */
const forwardToWorkshopWithoutLPO = async (req, res) => {
  try {
    const { complaintId }            = req.params;
    const { approvedBy, comments } = req.body;

    if (!approvedBy) {
      return res.status(400).json({ success: false, message: 'approvedBy is required' });
    }

    const result = await ComplaintService.forwardToWorkshopWithoutLPO(complaintId, approvedBy, comments);

    res.status(200).json({
      success: true,
      message: 'Request forwarded to workshop manager',
      data:    result,
    });
  } catch (error) {
    console.error('[Complaint] forwardToWorkshopWithoutLPO:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to forward to workshop' });
  }
};

/**
 * PUT /complaints/:complaintId/approve-no-lpo
 * Approves a complaint item without an LPO.
 */
const approveItemWithoutLPO = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { approvedBy }  = req.body;

    if (!approvedBy) {
      return res.status(400).json({ success: false, message: 'approvedBy is required' });
    }

    const result = await ComplaintService.approveItemWithoutLPO(complaintId, approvedBy);

    res.status(200).json({
      success: true,
      message: 'Item approved successfully',
      data:    result,
    });
  } catch (error) {
    console.error('[Complaint] approveItemWithoutLPO:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to approve item' });
  }
};

/**
 * PUT /complaints/:complaintId/create-lpo
 * Step 5 — WORKSHOP_MANAGER creates an LPO for the complaint.
 */
const createLPOForComplaint = async (req, res) => {
  try {
    const { complaintId }      = req.params;
    const { lpoData, createdBy } = req.body;

    if (!lpoData || !createdBy) {
      return res.status(400).json({ success: false, message: 'lpoData and createdBy are required' });
    }

    const result = await ComplaintService.createLPOForComplaint(complaintId, lpoData, createdBy);

    res.status(200).json({
      success: true,
      message: 'LPO created successfully',
      data:    result,
    });
  } catch (error) {
    console.error('[Complaint] createLPOForComplaint:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to create LPO' });
  }
};

/**
 * PUT /complaints/:complaintId/upload-lpo
 * Generates a pre-signed S3 URL and records the LPO (or amendment) on the complaint.
 */
const uploadLPOForComplaint = async (req, res) => {
  try {
    const { complaintId }                                          = req.params;
    const { uploadedBy, lpoRef, description, fileName, isAmendment } = req.body;

    if (!uploadedBy || !lpoRef) {
      return res.status(400).json({ success: false, message: 'uploadedBy and lpoRef are required' });
    }

    const amendmentSuffix = isAmendment ? '-amendment' : '';
    const finalFilename   = fileName || `lpo-${complaintId}${amendmentSuffix}-${Date.now()}.pdf`;
    const s3Key           = `complaint-lpos/${complaintId}/${finalFilename}`;
    const uploadUrl       = await putObject(finalFilename, s3Key, 'application/pdf');

    const lpoFileData = {
      fileName:     finalFilename,
      originalName: finalFilename,
      filePath:     s3Key,
      mimeType:     'application/pdf',
      uploadUrl,
      uploadDate:   new Date(),
    };

    const result = await ComplaintService.uploadLPOForComplaint(
      complaintId, lpoFileData, uploadedBy, lpoRef, description, isAmendment,
    );

    res.status(200).json({
      success:   true,
      message:   `Pre-signed URL generated successfully${isAmendment ? ' (Amendment)' : ''}`,
      uploadUrl,
      data:      { complaint: result, uploadData: lpoFileData },
    });
  } catch (error) {
    console.error('[Complaint] uploadLPOForComplaint:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to upload LPO' });
  }
};

/**
 * PUT /complaints/:complaintId/purchase-approval
 * Step 6 — PURCHASE_MANAGER approves or signs off on the complaint.
 */
const purchaseApproval = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const {
      approvedBy, comments, signed, authorised,
      approvedDate, approvedFrom, approvedIP, approvedBDevice, approvedLocation,
    } = req.body;

    if (!approvedBy) {
      return res.status(400).json({ success: false, message: 'approvedBy is required' });
    }

    if (signed && (!approvedDate || !approvedFrom)) {
      return res.status(400).json({ success: false, message: 'approvedDate and approvedFrom are required for signing' });
    }

    const result = await ComplaintService.purchaseApproval(complaintId, {
      approvedBy, comments,
      signed:      signed      || false,
      authorised:  authorised  || false,
      approvedDate, approvedFrom, approvedIP, approvedBDevice, approvedLocation,
    });

    res.status(200).json({
      success: true,
      message: 'Purchase approval recorded successfully',
      data:    result,
    });
  } catch (error) {
    console.error('[Complaint] purchaseApproval:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to approve purchase' });
  }
};

/**
 * PUT /complaints/:complaintId/manager-approval
 * Step 7a — Manager approves the complaint.
 */
const managerApproval = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const {
      approvedBy, comments, signed, authorised,
      approvedDate, approvedFrom, approvedIP, approvedBDevice, approvedLocation,
    } = req.body;

    if (!approvedBy) {
      return res.status(400).json({ success: false, message: 'approvedBy is required' });
    }

    const approvedCreds = {
      signed:      signed     || false,
      authorised:  authorised || false,
      approvedDate, approvedFrom, approvedIP, approvedBDevice, approvedLocation, approvedBy,
    };

    const result = await ComplaintService.managerApproval(complaintId, approvedBy, comments, approvedCreds);

    res.status(200).json({
      success: true,
      message: 'Manager approval recorded successfully',
      data:    result,
    });
  } catch (error) {
    console.error('[Complaint] managerApproval:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to get manager approval' });
  }
};

/**
 * PUT /complaints/:complaintId/ceo-approval
 * Step 7b — CEO gives final approval on the complaint.
 */
const ceoApproval = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const {
      approvedBy, comments, signed, authorised, authUser,
      approvedDate, approvedFrom, approvedIP, approvedBDevice, approvedLocation,
    } = req.body;

    if (!approvedBy) {
      return res.status(400).json({ success: false, message: 'approvedBy is required' });
    }

    const approvedCreds = {
      signed:      signed     || false,
      authorised:  authorised || false,
      approvedDate, approvedFrom, approvedIP, approvedBDevice, approvedLocation, approvedBy,
    };

    const result = await ComplaintService.ceoApproval(complaintId, approvedBy, comments, approvedCreds, authUser);

    res.status(200).json({
      success: true,
      message: 'CEO approval recorded successfully',
      data:    result,
    });
  } catch (error) {
    console.error('[Complaint] ceoApproval:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to get CEO approval' });
  }
};

/**
 * PUT /complaints/:complaintId/accounts-approval
 * Records accounts department approval on the complaint.
 */
const accountsApproval = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const {
      approvedBy, comments, signed, authorised,
      approvedDate, approvedFrom, approvedIP, approvedBDevice, approvedLocation,
    } = req.body;

    if (!approvedBy) {
      return res.status(400).json({ success: false, message: 'approvedBy is required' });
    }

    const approvedCreds = {
      signed:      signed     || false,
      authorised:  authorised || false,
      approvedDate, approvedFrom, approvedIP, approvedBDevice, approvedLocation, approvedBy,
    };

    const result = await ComplaintService.accountsApproval(complaintId, approvedBy, comments, approvedCreds);

    res.status(200).json({
      success: true,
      message: 'Accounts approval recorded successfully',
      data:    result,
    });
  } catch (error) {
    console.error('[Complaint] accountsApproval:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to record accounts approval' });
  }
};

/**
 * PUT /complaints/:complaintId/mark-items-available
 * Step 8 — Marks requested items as available for the mechanic.
 */
const markItemsAvailable = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { markedBy }    = req.body;

    if (!markedBy) {
      return res.status(400).json({ success: false, message: 'markedBy is required' });
    }

    const result = await ComplaintService.markItemsAvailable(complaintId, markedBy);

    res.status(200).json({
      success: true,
      message: 'Items marked as available successfully',
      data:    result,
    });
  } catch (error) {
    console.error('[Complaint] markItemsAvailable:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to mark items as available' });
  }
};

/**
 * PUT /complaints/:complaintId/add-solution
 * Mechanic submits solution media files; files are uploaded to S3 asynchronously.
 */
const addSolution = async (req, res) => {
  try {
    const { complaintId }                 = req.params;
    const { regNo, mechanic, files, remarks } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one solution file is required' });
    }

    const filesData = files.map(file => {
      const ext           = path.extname(file.fileName);
      const finalFilename = `${complaintId}-${Date.now()}${ext}`;
      return {
        fileName:     finalFilename,
        originalName: file.fileName,
        filePath:     `complaint-solutions/${complaintId}/${finalFilename}`,
        mimeType:     file.mimeType,
        type:         file.mimeType.startsWith('video/') ? 'video' : 'photo',
        fileBuffer:   file.fileBuffer,
        uploadDate:   new Date(),
      };
    });

    const result = await ComplaintService.addSolutionToComplaint(
      complaintId,
      filesData.map(({ fileName, originalName, filePath, mimeType, type, uploadDate }) => ({
        fileName, originalName, filePath, mimeType, type, uploadDate,
      })),
      regNo,
      mechanic,
      remarks,
    );

    res.status(200).json({
      success: true,
      message: 'Work completed successfully. Files are being uploaded.',
      data:    { complaint: result.data },
    });

    filesData.forEach(async file => {
      try {
        const buffer = Buffer.from(file.fileBuffer, 'base64');
        await uploadToS3(buffer, file.filePath, file.mimeType);
      } catch (error) {
        console.error(`[Complaint] addSolution — upload failed for ${file.fileName}:`, error);
      }
    });
  } catch (error) {
    console.error('[Complaint] addSolution:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Query Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /complaints/user/:uniqueCode
 * Returns all complaints submitted by a specific user.
 */
const getUserComplaints = async (req, res) => {
  try {
    const { uniqueCode } = req.params;
    const complaints     = await ComplaintService.getComplaintsByUser(uniqueCode);

    res.status(200).json({
      success: true,
      message: 'User complaints retrieved successfully',
      data:    complaints,
    });
  } catch (error) {
    console.error('[Complaint] getUserComplaints:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve user complaints', error: error.message });
  }
};

/**
 * GET /complaints/:id
 * Returns a single complaint by MongoDB ID.
 */
const getComplaintDetails = async (req, res) => {
  try {
    const { id }     = req.params;
    const complaint  = await ComplaintService.getComplaintById(id);

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Complaint retrieved successfully',
      data:    complaint,
    });
  } catch (error) {
    console.error('[Complaint] getComplaintDetails:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve complaint', error: error.message });
  }
};

/**
 * GET /complaints
 * Returns all complaints.
 */
const getAllComplaints = async (req, res) => {
  try {
    const complaints = await ComplaintService.getFullComplaints();

    if (!complaints) {
      return res.status(404).json({ success: false, message: 'No complaints found' });
    }

    res.status(200).json({
      success: true,
      message: 'Complaints retrieved successfully',
      data:    complaints,
    });
  } catch (error) {
    console.error('[Complaint] getAllComplaints:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve complaints', error: error.message });
  }
};

/**
 * GET /complaints/status/:status
 * Returns all complaints matching a given workflow status.
 */
const getComplaintsByStatus = async (req, res) => {
  try {
    const { status }  = req.params;
    const complaints  = await ComplaintService.getComplaintsByStatus(status);

    res.status(200).json({
      success: true,
      message: 'Complaints retrieved successfully',
      data:    complaints,
    });
  } catch (error) {
    console.error('[Complaint] getComplaintsByStatus:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve complaints by status', error: error.message });
  }
};

/**
 * POST /complaints/mechanic
 * Returns all complaints assigned to a mechanic by email.
 */
const getMechanicComplaints = async (req, res) => {
  try {
    const { email }  = req.body;
    const complaints = await ComplaintService.getComplaintsByMechanic(email);

    res.status(200).json({
      success: true,
      message: 'Mechanic complaints retrieved successfully',
      data:    complaints,
    });
  } catch (error) {
    console.error('[Complaint] getMechanicComplaints:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve mechanic complaints', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Lifecycle
  registerComplaint,
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
  addSolution,
  // Queries
  getUserComplaints,
  getComplaintDetails,
  getAllComplaints,
  getComplaintsByStatus,
  getMechanicComplaints,
};