const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { sendSuccess, sendError } = require('#shared/response/response.sender');
const ComplaintService = require('./complaint.service');
const { findCompletedComplaintSessions } = require('./complaint.session');
const { markDocumentsViewedSafely } = require('#core/document/document.view.service');
const { buildMediaFilesFromSessions } = require('./complaint.helper');
const { announceComplaintRegistered, announceComplaintRectified } = require('./complaint.notification');
const { COMPLAINT_ACTIVITY_SOURCE_KEY } = require('./complaint.constant');

const registerComplaint = async (req, res) => {
  try {
    const { regNo, name, uniqueCode, remarks, sessionIds } = req.body;

    if (!uniqueCode || !regNo) {
      return sendError(res, {
        success: false,
        message: 'uniqueCode and regNo are required',
      });
    }

    if (!String(remarks ?? '').trim()) {
      return sendError(res, {
        success: false,
        message: 'Remarks are required',
      });
    }

    const sessions = await findCompletedComplaintSessions({ sessionIds, uploadedBy: req.userId });

    const complaint = await ComplaintService.createComplaint({
      uniqueCode,
      regNo,
      name: name || '',
      remarks: remarks || '',
      mediaFiles: buildMediaFilesFromSessions(sessions),
    });

    markDocumentsViewedSafely({
      uniqueCode,
      sourceKey: COMPLAINT_ACTIVITY_SOURCE_KEY,
      documentIds: [String(complaint._id)],
    });
    announceComplaintRegistered({ complaint: complaint.toObject(), actorUniqueCode: uniqueCode });

    sendSuccess(res, {
      success: true,
      message: 'Complaint registered successfully',
      data: { complaint },
    });
  } catch (error) {
    logger.error('[complaint.controller] registerComplaint:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Failed to register complaint',
      error: error.message,
    });
  }
};

const addSolution = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { mechanic, remarks, sessionIds } = req.body;

    if (!String(remarks ?? '').trim()) {
      return sendError(res, {
        success: false,
        message: 'Remarks are required',
      });
    }

    const sessions = await findCompletedComplaintSessions({ sessionIds, uploadedBy: req.userId });

    const solutionFiles = buildMediaFilesFromSessions(sessions);

    const result = await ComplaintService.addSolutionToComplaint(complaintId, solutionFiles, mechanic, remarks);

    announceComplaintRectified({
      complaint: result.data,
      actorUniqueCode: req.user?.uniqueCode,
      remarks,
      attachments: solutionFiles,
    });

    sendSuccess(res, {
      success: true,
      message: 'Work completed successfully.',
      data: { complaint: result.data },
    });
  } catch (error) {
    logger.error('[complaint.controller] addSolution:', error);
    sendError(res, {
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

const getUserComplaints = async (req, res) => {
  try {
    const result = await ComplaintService.getComplaintsByUser(req.params.uniqueCode, req.pagination);

    sendSuccess(res, {
      success: true,
      message: 'User complaints retrieved successfully',
      data: result.data,
      pagination: result.pagination,
      count: result.data.length,
    });
  } catch (error) {
    logger.error('[complaint.controller] getUserComplaints:', error);
    sendError(res, {
      success: false,
      message: 'Failed to retrieve user complaints',
      error: error.message,
    });
  }
};

const getEquipmentComplaints = async (req, res) => {
  try {
    const result = await ComplaintService.getComplaintsByRegNo(req.params.regNo, req.pagination);

    sendSuccess(res, {
      success: true,
      message: 'Equipment complaints retrieved successfully',
      data: result.data,
      pagination: result.pagination,
      count: result.data.length,
    });
  } catch (error) {
    logger.error('[complaint.controller] getEquipmentComplaints:', error);
    sendError(res, {
      success: false,
      message: 'Failed to retrieve equipment complaints',
      error: error.message,
    });
  }
};

const getEquipmentLatestComplaints = async (req, res) => {
  try {
    const result = await ComplaintService.getEquipmentLatestComplaints(req.pagination);

    sendSuccess(res, {
      success: true,
      message: 'Equipment complaints retrieved successfully',
      data: result.data,
      pagination: result.pagination,
      count: result.data.length,
    });
  } catch (error) {
    logger.error('[complaint.controller] getEquipmentLatestComplaints:', error);
    sendError(res, {
      success: false,
      message: 'Failed to retrieve equipment complaints',
      error: error.message,
    });
  }
};

const getComplaintDetails = async (req, res) => {
  try {
    const complaint = await ComplaintService.getComplaintById(req.params.id);

    if (!complaint) {
      return res.status(HTTP.NOT_FOUND).json({ success: false, message: 'Complaint not found' });
    }

    sendSuccess(res, {
      success: true,
      message: 'Complaint retrieved successfully',
      data: complaint,
    });
  } catch (error) {
    logger.error('[complaint.controller] getComplaintDetails:', error);
    sendError(res, {
      success: false,
      message: 'Failed to retrieve complaint',
      error: error.message,
    });
  }
};

const getAllComplaints = async (req, res) => {
  try {
    const result = await ComplaintService.getFullComplaints(req.pagination);

    if (!result?.data) {
      return res.status(HTTP.NOT_FOUND).json({ success: false, message: 'No complaints found' });
    }

    sendSuccess(res, {
      success: true,
      message: 'Complaints retrieved successfully',
      data: result.data,
      pagination: result.pagination,
      count: result.data.length,
    });
  } catch (error) {
    logger.error('[complaint.controller] getAllComplaints:', error);
    sendError(res, {
      success: false,
      message: 'Failed to retrieve complaints',
      error: error.message,
    });
  }
};

module.exports = {
  registerComplaint,
  addSolution,
  getUserComplaints,
  getEquipmentComplaints,
  getEquipmentLatestComplaints,
  getComplaintDetails,
  getAllComplaints,
};