const applicationService = require('../services/application-services');

// Create new application with leave checking
const createApplication = async (req, res) => {
  try {
    const savedApplication = await applicationService.createApplication(req.body);

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: savedApplication
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get applications by user with filters
const getApplications = async (req, res) => {
  try {
    const { userId } = req.params;
    const filters = req.query;

    const applications = await applicationService.getApplicationsByUser(userId, filters);

    res.status(200).json({
      success: true,
      data: applications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all requests (for admin/HR dashboard)
const getAllRequests = async (req, res) => {
  try {
    const filters = req.query;
    const applications = await applicationService.getAllApplications(filters);

    res.status(200).json({
      success: true,
      data: applications,
      count: applications.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Change application status (approve/reject)
const changeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectedReason, adminComments, approvedBy } = req.body;

    const updatedApplication = await applicationService.changeApplicationStatus(
      id,
      status,
      { rejectedReason, adminComments, approvedBy }
    );

    res.status(200).json({
      success: true,
      message: `Application ${status} successfully`,
      data: updatedApplication
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Check leave availability endpoint
const checkLeaveAvailability = async (req, res) => {
  try {
    const { userId, leaveType, leaveSubType, startDate, endDate } = req.body;

    const availability = await applicationService.checkLeaveAvailability(
      userId,
      leaveType,
      leaveSubType,
      startDate,
      endDate
    );

    res.status(200).json({
      success: true,
      data: availability
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get leave balance for user
const getLeaveBalance = async (req, res) => {
  try {
    const { userId } = req.params;

    const balance = await applicationService.getLeaveBalance(userId);

    res.status(200).json({
      success: true,
      data: balance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createApplication,
  getApplications,
  getAllRequests,
  changeStatus,
  checkLeaveAvailability,
  getLeaveBalance
};