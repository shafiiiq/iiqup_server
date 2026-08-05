// controllers/complaint.controller.js
const logger = require('../../shared/logger/logger');
const HTTP = require('../../shared/constants/httpStatus.constant.js');
const { sendSuccess, sendError } = require('../../shared/response/response.util');
const path = require('path');
const ComplaintService = require('./complaint.service');
const { putObject } = require('../../config/aws/s3.aws');
const UploadService = require('../../shared/file-handling/upload.service');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const isVideoFile = (mimeType, fileName) => {
  if (mimeType) {
    const normalized = mimeType.toLowerCase();
    if (normalized === 'video' || normalized.startsWith('video/')) return true;
  }
  if (fileName) {
    const videoExtensions = [
      '.mp4',
      '.webm',
      '.ogg',
      '.avi',
      '.mov',
      '.wmv',
      '.flv',
      '.m4v',
      '.3gp',
      '.mkv',
    ];
    return videoExtensions.includes(path.extname(fileName).toLowerCase());
  }
  return false;
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
    logger.info(
      '[Complaint] /register body keys',
      Object.keys(req.body),
      'content-type',
      req.headers['content-type']
    );
    logger.info('[Complaint] /register sessionIds count', sessionIds?.length);
    logger.info(
      '[Complaint] /register auth header present',
      !!req.headers.authorization
    );

    const { regNo, name, uniqueCode, remarks, sessionIds } = req.body;

    if (!sessionIds || sessionIds.length === 0) {
      logger.warn(
        '[Complaint] /register missing sessionIds',
        { body: req.body }
      );
      return sendError(res, {
        success: false,
        message: 'At least one media file is required',
      });
    }

    const sessions = await UploadService.getCompletedSessions({
      sessionIds,
      uploadedBy: req.userId,
      feature: 'complaint',
    });

    const complaintData = {
      uniqueCode,
      regNo: regNo || 'no-reg',
      name: name || 'no-name',
      remarks: remarks || '',
      mediaFiles: sessions.map((session) => ({
        fileName: session.fileName,
        originalName: session.originalName,
        filePath: session.s3Key,
        mimeType: session.mimeType,
        type: isVideoFile(session.mimeType, session.originalName) ? 'video' : 'photo',
        uploadDate: session.completedAt,
      })),
    };

    const result = await ComplaintService.createComplaint(complaintData);

    logger.info('registerComplaint result:', result);

    sendSuccess(res, {
      success: true,
      message: 'Complaint registered successfully',
      data: { complaint: result },
    });
  } catch (error) {
    logger.error('[Complaint] registerComplaint:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Failed to register complaint',
      error: error.message,
    });
  }
};

/**
 * PUT /complaints/:complaintId/assign-mechanic
 * Step 2 — Assigns one or more mechanics to a complaint (MAINTENANCE_HEAD).
 */
const assignMechanic = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { mechanics, assignedBy } = req.body;

    if (!mechanics || !Array.isArray(mechanics) || mechanics.length === 0) {
      return sendError(res, {
        success: false,
        message:
          'mechanics array is required and must contain at least one mechanic',
      });
    }

    if (!assignedBy) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'assignedBy is required' });
    }

    for (const mechanic of mechanics) {
      if (!mechanic.mechanicId || !mechanic.mechanicName) {
        return sendError(res, {
          success: false,
          message: 'Each mechanic must have mechanicId and mechanicName',
        });
      }
    }

    const result = await ComplaintService.assignMechanic(
      complaintId,
      mechanics,
      assignedBy
    );

    sendSuccess(res, {
      success: true,
      message: 'Mechanic(s) assigned successfully',
      data: result,
    });
  } catch (error) {
    logger.error('[Complaint] assignMechanic:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Failed to assign mechanics',
    });
  }
};

/**
 * PUT /complaints/:complaintId/request-items
 * Step 3 — Mechanic submits a parts/items request with optional audio file.
 */
const mechanicRequestItems = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { requestText, mechanicId, audioFile } = req.body;

    if (!requestText && !audioFile) {
      return sendError(res, {
        success: false,
        message: 'Either requestText or audioFile is required',
      });
    }

    const audioFileData = audioFile
      ? {
          fileName: audioFile.fileName,
          filePath: audioFile.filePath,
          mimeType: audioFile.mimeType,
          duration: audioFile.duration || 0,
        }
      : null;

    const result = await ComplaintService.mechanicRequestItems(
      complaintId,
      { requestText, audioFile: audioFileData },
      mechanicId
    );

    sendSuccess(res, {
      success: true,
      message: 'Item request submitted successfully',
      data: result.data,
    });
  } catch (error) {
    logger.error('[Complaint] mechanicRequestItems:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Failed to submit request',
    });
  }
};

/**
 * PUT /complaints/:complaintId/forward-to-workshop
 * Step 4 — MAINTENANCE_HEAD forwards complaint to WORKSHOP_MANAGER, optionally with documents.
 */
const forwardToWorkshop = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { approvedBy, comments, documents } = req.body;

    if (!approvedBy) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'approvedBy is required' });
    }

    let documentsWithUploadData = null;
    if (documents?.length > 0) {
      documentsWithUploadData = await Promise.all(
        documents.map(async (document, index) => {
          const ext = path.extname(document.fileName);
          const finalFilename = `${approvedBy}-${Date.now()}-${index}${ext}`;
          const s3Key = `complaints/${complaintId}/attachments/forward-to-workshop-${finalFilename}`;
          const uploadUrl = await putObject(
            document.fileName,
            s3Key,
            document.mimeType
          );

          return {
            fileName: finalFilename,
            originalName: document.fileName,
            filePath: s3Key,
            fileSize: document.size,
            mimeType: document.mimeType,
            type: document.mimeType?.startsWith('image/')
              ? 'image'
              : 'document',
            uploadDate: new Date(),
            uploadUrl,
          };
        })
      );
    }

    const result = await ComplaintService.forwardToWorkshop(
      complaintId,
      approvedBy,
      comments,
      documentsWithUploadData
    );

    const responseData = documentsWithUploadData
      ? {
          complaint: result,
          uploadData: documentsWithUploadData.map(
            ({ uploadUrl, filePath, fileName, originalName }) => ({
              uploadUrl,
              key: filePath,
              fileName,
              originalName,
            })
          ),
        }
      : result;

    sendSuccess(res, {
      success: true,
      message: 'Request forwarded to workshop manager',
      data: responseData,
    });
  } catch (error) {
    logger.error('[Complaint] forwardToWorkshop:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Failed to forward to workshop',
    });
  }
};

/**
 * PUT /complaints/:complaintId/forward-to-workshop-no-lpo
 * Step 4 (alternate) — Forwards complaint to workshop without requiring an LPO.
 */
const forwardToWorkshopWithoutLPO = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { approvedBy, comments } = req.body;

    if (!approvedBy) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'approvedBy is required' });
    }

    const result = await ComplaintService.forwardToWorkshopWithoutLPO(
      complaintId,
      approvedBy,
      comments
    );

    sendSuccess(res, {
      success: true,
      message: 'Request forwarded to workshop manager',
      data: result,
    });
  } catch (error) {
    logger.error('[Complaint] forwardToWorkshopWithoutLPO:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Failed to forward to workshop',
    });
  }
};

/**
 * PUT /complaints/:complaintId/approve-no-lpo
 * Approves a complaint item without an LPO.
 */
const approveItemWithoutLPO = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { approvedBy } = req.body;

    if (!approvedBy) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'approvedBy is required' });
    }

    const result = await ComplaintService.approveItemWithoutLPO(
      complaintId,
      approvedBy
    );

    sendSuccess(res, {
      success: true,
      message: 'Item approved successfully',
      data: result,
    });
  } catch (error) {
    logger.error('[Complaint] approveItemWithoutLPO:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Failed to approve item',
    });
  }
};

/**
 * PUT /complaints/:complaintId/create-lpo
 * Step 5 — WORKSHOP_MANAGER creates an LPO for the complaint.
 */
const createLPOForComplaint = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { lpoData, createdBy } = req.body;

    if (!lpoData || !createdBy) {
      return sendError(res, {
        success: false,
        message: 'lpoData and createdBy are required',
      });
    }

    const result = await ComplaintService.createLPOForComplaint(
      complaintId,
      lpoData,
      createdBy
    );

    sendSuccess(res, {
      success: true,
      message: 'LPO created successfully',
      data: result,
    });
  } catch (error) {
    logger.error('[Complaint] createLPOForComplaint:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Failed to create LPO',
    });
  }
};

/**
 * PUT /complaints/:complaintId/upload-lpo
 * Generates a pre-signed S3 URL and records the LPO (or amendment) on the complaint.
 */
const uploadLPOForComplaint = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { uploadedBy, lpoRef, description, fileName, isAmendment } = req.body;

    if (!uploadedBy || !lpoRef) {
      return sendError(res, {
        success: false,
        message: 'uploadedBy and lpoRef are required',
      });
    }

    const amendmentSuffix = isAmendment ? '-amendment' : '';
    const finalFilename =
      fileName || `lpo-${complaintId}${amendmentSuffix}-${Date.now()}.pdf`;
    const s3Key = `complaint-lpos/${complaintId}/${finalFilename}`;
    const uploadUrl = await putObject(finalFilename, s3Key, 'application/pdf');

    const lpoFileData = {
      fileName: finalFilename,
      originalName: finalFilename,
      filePath: s3Key,
      mimeType: 'application/pdf',
      uploadUrl,
      uploadDate: new Date(),
    };

    const result = await ComplaintService.uploadLPOForComplaint(
      complaintId,
      lpoFileData,
      uploadedBy,
      lpoRef,
      description,
      isAmendment
    );

    sendSuccess(res, {
      success: true,
      message: `Pre-signed URL generated successfully${isAmendment ? ' (Amendment)' : ''}`,
      uploadUrl,
      data: { complaint: result, uploadData: lpoFileData },
    });
  } catch (error) {
    logger.error('[Complaint] uploadLPOForComplaint:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Failed to upload LPO',
    });
  }
};

/**
 * POST /complaints/sign/:complaintId
 * Unified sign endpoint used by the mobile app for all LPO approval roles.
 */
const signComplaint = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const {
      uniqueCode,
      signedDate,
      signedFrom,
      role,
      signedIP,
      signedDevice,
      signedLocation,
    } = req.body;

    if (!uniqueCode || !signedDate || !signedFrom || !role) {
      return sendError(res, {
        success: false,
        message: 'uniqueCode, signedDate, signedFrom, and role are required',
      });
    }

    const normalizedRole = String(role).trim().toUpperCase();
    const allowedCodes = {
      PURCHASE_MANAGER: [process.env.PURCHASE_MANAGER],
      MANAGER: [process.env.MANAGER],
      ACCOUNTS: [process.env.ACCOUNTS],
      CEO: [process.env.CEO],
      MANAGING_DIRECTOR: [process.env.MD],
    };

    const allowed = allowedCodes[normalizedRole] || [];
    if (!allowed.includes(uniqueCode)) {
      return sendError(res, {
        success: false,
        message:
          'Unauthorised: your account is not recognised as an authorised signatory for this document',
      });
    }

    const approvedCreds = {
      signed: true,
      authorised: true,
      approvedBy: uniqueCode,
      approvedDate: signedDate,
      approvedFrom: signedFrom,
      approvedIP: signedIP,
      approvedBDevice: signedDevice,
      approvedLocation: signedLocation,
    };

    let result;
    switch (normalizedRole) {
      case 'PURCHASE_MANAGER':
        result = await ComplaintService.purchaseApproval(complaintId, {
          ...approvedCreds,
          comments: 'Signed via mobile app',
        });
        break;
      case 'MANAGER':
        result = await ComplaintService.managerApproval(
          complaintId,
          uniqueCode,
          'Signed via mobile app',
          approvedCreds
        );
        break;
      case 'CEO':
        result = await ComplaintService.ceoApproval(
          complaintId,
          uniqueCode,
          'Signed via mobile app',
          approvedCreds,
          'CEO'
        );
        break;
      case 'MANAGING_DIRECTOR':
        result = await ComplaintService.ceoApproval(
          complaintId,
          uniqueCode,
          'Signed via mobile app',
          approvedCreds,
          'MD'
        );
        break;
      case 'ACCOUNTS':
        result = await ComplaintService.accountsApproval(
          complaintId,
          uniqueCode,
          'Signed via mobile app',
          approvedCreds
        );
        break;
      default:
        return res
          .status(HTTP.FORBIDDEN)
          .json({ success: false, message: 'Unsupported role for signing' });
    }

    sendSuccess(res, {
      success: true,
      message: 'Document signed successfully',
      data: result.data || result,
    });
  } catch (error) {
    logger.error('[Complaint] signComplaint:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message || 'Signing failed' });
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
      approvedBy,
      comments,
      signed,
      authorised,
      approvedDate,
      approvedFrom,
      approvedIP,
      approvedBDevice,
      approvedLocation,
    } = req.body;

    if (!approvedBy) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'approvedBy is required' });
    }

    if (signed && (!approvedDate || !approvedFrom)) {
      return sendError(res, {
        success: false,
        message: 'approvedDate and approvedFrom are required for signing',
      });
    }

    const result = await ComplaintService.purchaseApproval(complaintId, {
      approvedBy,
      comments,
      signed: signed || false,
      authorised: authorised || false,
      approvedDate,
      approvedFrom,
      approvedIP,
      approvedBDevice,
      approvedLocation,
    });

    sendSuccess(res, {
      success: true,
      message: 'Purchase approval recorded successfully',
      data: result,
    });
  } catch (error) {
    logger.error('[Complaint] purchaseApproval:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Failed to approve purchase',
    });
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
      approvedBy,
      comments,
      signed,
      authorised,
      approvedDate,
      approvedFrom,
      approvedIP,
      approvedBDevice,
      approvedLocation,
    } = req.body;

    if (!approvedBy) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'approvedBy is required' });
    }

    const approvedCreds = {
      signed: signed || false,
      authorised: authorised || false,
      approvedDate,
      approvedFrom,
      approvedIP,
      approvedBDevice,
      approvedLocation,
      approvedBy,
    };

    const result = await ComplaintService.managerApproval(
      complaintId,
      approvedBy,
      comments,
      approvedCreds
    );

    sendSuccess(res, {
      success: true,
      message: 'Manager approval recorded successfully',
      data: result,
    });
  } catch (error) {
    logger.error('[Complaint] managerApproval:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Failed to get manager approval',
    });
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
      approvedBy,
      comments,
      signed,
      authorised,
      authUser,
      approvedDate,
      approvedFrom,
      approvedIP,
      approvedBDevice,
      approvedLocation,
    } = req.body;

    if (!approvedBy) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'approvedBy is required' });
    }

    const approvedCreds = {
      signed: signed || false,
      authorised: authorised || false,
      approvedDate,
      approvedFrom,
      approvedIP,
      approvedBDevice,
      approvedLocation,
      approvedBy,
    };

    const result = await ComplaintService.ceoApproval(
      complaintId,
      approvedBy,
      comments,
      approvedCreds,
      authUser
    );

    sendSuccess(res, {
      success: true,
      message: 'CEO approval recorded successfully',
      data: result,
    });
  } catch (error) {
    logger.error('[Complaint] ceoApproval:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Failed to get CEO approval',
    });
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
      approvedBy,
      comments,
      signed,
      authorised,
      approvedDate,
      approvedFrom,
      approvedIP,
      approvedBDevice,
      approvedLocation,
    } = req.body;

    if (!approvedBy) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'approvedBy is required' });
    }

    const approvedCreds = {
      signed: signed || false,
      authorised: authorised || false,
      approvedDate,
      approvedFrom,
      approvedIP,
      approvedBDevice,
      approvedLocation,
      approvedBy,
    };

    const result = await ComplaintService.accountsApproval(
      complaintId,
      approvedBy,
      comments,
      approvedCreds
    );

    sendSuccess(res, {
      success: true,
      message: 'Accounts approval recorded successfully',
      data: result,
    });
  } catch (error) {
    logger.error('[Complaint] accountsApproval:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Failed to record accounts approval',
    });
  }
};

/**
 * PUT /complaints/:complaintId/mark-items-available
 * Step 8 — Marks requested items as available for the mechanic.
 */
const markItemsAvailable = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { markedBy } = req.body;

    if (!markedBy) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'markedBy is required' });
    }

    const result = await ComplaintService.markItemsAvailable(
      complaintId,
      markedBy
    );

    sendSuccess(res, {
      success: true,
      message: 'Items marked as available successfully',
      data: result,
    });
  } catch (error) {
    logger.error('[Complaint] markItemsAvailable:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Failed to mark items as available',
    });
  }
};

/**
 * PUT /complaints/:complaintId/add-solution
 * Mechanic submits solution media files; files are uploaded to S3 asynchronously.
 */
const addSolution = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { regNo, mechanic, remarks, sessionIds } = req.body;

    if (!sessionIds || sessionIds.length === 0) {
      return sendError(res, {
        success: false,
        message: 'At least one solution file is required',
      });
    }

    const sessions = await UploadService.getCompletedSessions({
      sessionIds,
      uploadedBy: req.userId,
      feature: 'complaint',
    });

    const filesData = sessions.map((session) => ({
      fileName: session.fileName,
      originalName: session.originalName,
      filePath: session.s3Key,
      mimeType: session.mimeType,
      type: isVideoFile(session.mimeType, session.originalName) ? 'video' : 'photo',
      uploadDate: session.completedAt,
    }));

    const result = await ComplaintService.addSolutionToComplaint(
      complaintId,
      filesData,
      regNo,
      mechanic,
      remarks
    );

    sendSuccess(res, {
      success: true,
      message: 'Work completed successfully.',
      data: { complaint: result.data },
    });
  } catch (error) {
    logger.error('[Complaint] addSolution:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Internal server error',
    });
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
    const result = await ComplaintService.getComplaintsByUser(
      uniqueCode,
      req.pagination
    );

    sendSuccess(res, {
      success: true,
      message: 'User complaints retrieved successfully',
      data: result.data,
      pagination: result.pagination,
      count: result.data.length,
    });
  } catch (error) {
    logger.error('[Complaint] getUserComplaints:', error);
    sendError(res, {
      success: false,
      message: 'Failed to retrieve user complaints',
      error: error.message,
    });
  }
};

/**
 * GET /complaints/:id
 * Returns a single complaint by MongoDB ID.
 */
const getComplaintDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const complaint = await ComplaintService.getComplaintById(id);

    if (!complaint) {
      return res
        .status(HTTP.NOT_FOUND)
        .json({ success: false, message: 'Complaint not found' });
    }

    sendSuccess(res, {
      success: true,
      message: 'Complaint retrieved successfully',
      data: complaint,
    });
  } catch (error) {
    logger.error('[Complaint] getComplaintDetails:', error);
    sendError(res, {
      success: false,
      message: 'Failed to retrieve complaint',
      error: error.message,
    });
  }
};

/**
 * GET /complaints
 * Returns all complaints.
 */
const getAllComplaints = async (req, res) => {
  try {
    const result = await ComplaintService.getFullComplaints(req.pagination);

    if (!result?.data) {
      return res
        .status(HTTP.NOT_FOUND)
        .json({ success: false, message: 'No complaints found' });
    }

    sendSuccess(res, {
      success: true,
      message: 'Complaints retrieved successfully',
      data: result.data,
      pagination: result.pagination,
      count: result.data.length,
    });
  } catch (error) {
    logger.error('[Complaint] getAllComplaints:', error);
    sendError(res, {
      success: false,
      message: 'Failed to retrieve complaints',
      error: error.message,
    });
  }
};

/**
 * GET /complaints/status/:status
 * Returns all complaints matching a given workflow status.
 */
const getComplaintsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const result = await ComplaintService.getComplaintsByStatus(
      status,
      req.pagination
    );

    sendSuccess(res, {
      success: true,
      message: 'Complaints retrieved successfully',
      data: result.data,
      pagination: result.pagination,
      count: result.data.length,
    });
  } catch (error) {
    logger.error('[Complaint] getComplaintsByStatus:', error);
    sendError(res, {
      success: false,
      message: 'Failed to retrieve complaints by status',
      error: error.message,
    });
  }
};

/**
 * POST /complaints/mechanic-jobs
 * Returns all complaints assigned to a mechanic by email.
 */
const getMechanicComplaints = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Mechanic email is required' });
    }

    const result = await ComplaintService.getComplaintsByMechanic(
      email,
      req.pagination
    );

    sendSuccess(res, {
      success: true,
      message: 'Mechanic complaints retrieved successfully',
      data: result.data,
      pagination: result.pagination,
      count: result.data.length,
    });
  } catch (error) {
    logger.error('[Complaint] getMechanicComplaints:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Failed to retrieve mechanic complaints',
      error: error.message,
    });
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
  signComplaint,
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
