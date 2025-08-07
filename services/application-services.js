const Application = require('../models/applications.model');
const User = require('../models/user.model');
const { createNotification } = require('../utils/notification-jobs'); // Import notification service
const PushNotificationService = require('../utils/push-notification-jobs');

// Helper function to calculate leave days between two dates
const calculateLeaveDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const timeDiff = end.getTime() - start.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both dates
};

// Helper function to get leave year boundaries (from joining anniversary to next anniversary)
const getLeaveYear = (joiningDate, currentDate = new Date()) => {
  const joining = new Date(joiningDate);
  const current = new Date(currentDate);

  // Calculate how many complete years since joining
  let yearsSinceJoining = current.getFullYear() - joining.getFullYear();

  // Create the current leave year start date (anniversary date)
  let leaveYearStart = new Date(joining);
  leaveYearStart.setFullYear(joining.getFullYear() + yearsSinceJoining);

  // If current date is before this year's anniversary, use previous year
  if (current < leaveYearStart) {
    yearsSinceJoining--;
    leaveYearStart.setFullYear(joining.getFullYear() + yearsSinceJoining);
  }

  // Leave year end is the day before next anniversary
  const leaveYearEnd = new Date(leaveYearStart);
  leaveYearEnd.setFullYear(leaveYearEnd.getFullYear() + 1);
  leaveYearEnd.setDate(leaveYearEnd.getDate() - 1);

  return {
    start: leaveYearStart,
    end: leaveYearEnd,
    yearNumber: yearsSinceJoining + 1
  };
};

// Helper function to get current month boundaries
const getCurrentMonth = (date = new Date()) => {
  const current = new Date(date);
  const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
  const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);

  return {
    start: monthStart,
    end: monthEnd
  };
};

// Helper function to get month boundaries for a specific date
const getMonthForDate = (date) => {
  const targetDate = new Date(date);
  const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
  const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

  return {
    start: monthStart,
    end: monthEnd
  };
};

// Check leave availability
const checkLeaveAvailability = async (userId, leaveType, leaveSubType, startDate, endDate = null) => {
  const user = await User.findById(userId);
  if (!user || !user.joiningDate) {
    throw new Error('User not found or joining date not set');
  }

  // Calculate leave days based on subtype
  let leaveDays;
  if (leaveSubType === 'annual') {
    leaveDays = calculateLeaveDays(startDate, endDate);
  } else {
    leaveDays = 1; // Monthly leave is always 1 day
  }

  // Only check availability for paid leave
  if (leaveType !== 'paid') {
    return {
      available: true,
      message: `${leaveType} leave does not require availability check`,
      leaveDays,
      details: {}
    };
  }

  const currentDate = new Date();
  const leaveYear = getLeaveYear(user.joiningDate, new Date(startDate));

  // Get all approved paid leave applications in current leave year
  const approvedLeaves = await Application.find({
    userId,
    type: 'leave',
    leaveType: 'paid',
    status: 'approved',
    startDate: {
      $gte: leaveYear.start,
      $lte: leaveYear.end
    }
  });

  // Calculate used leave days in current year
  const usedAnnualDays = approvedLeaves.reduce((total, leave) => {
    return total + (leave.leaveDays || 0);
  }, 0);

  // For monthly quota, check the month of the requested start date
  const requestMonth = getMonthForDate(startDate);

  // Get pending applications in the same month to avoid double booking
  const pendingLeavesInMonth = await Application.find({
    userId,
    type: 'leave',
    leaveType: 'paid',
    status: 'pending',
    startDate: {
      $gte: requestMonth.start,
      $lte: requestMonth.end
    }
  });

  const pendingDaysInMonth = pendingLeavesInMonth.reduce((total, leave) => {
    return total + (leave.leaveDays || 0);
  }, 0);

  // Calculate used monthly leave days in the requested month
  const usedMonthlyDays = approvedLeaves
    .filter(leave => {
      const leaveStart = new Date(leave.startDate);
      return leaveStart >= requestMonth.start && leaveStart <= requestMonth.end;
    })
    .reduce((total, leave) => {
      return total + (leave.leaveDays || 0);
    }, 0);

  // Available leave calculations
  const availableAnnualDays = 30 - usedAnnualDays; // 30 days per year
  const availableMonthlyDays = 1 - usedMonthlyDays - pendingDaysInMonth; // 1 day per month minus pending

  // Check if leave can be accommodated based on subtype
  let canTakeLeave = true;
  let message = '';

  if (leaveSubType === 'annual') {
    if (leaveDays > availableAnnualDays) {
      canTakeLeave = false;
      message = `Insufficient annual leave. Requested: ${leaveDays} days, Available: ${availableAnnualDays} days`;
    }
  } else { // monthly
    if (leaveDays > availableMonthlyDays) {
      canTakeLeave = false;
      message = `Monthly paid leave quota exceeded. You can only take 1 paid leave per month.`;
    }
  }

  return {
    available: canTakeLeave,
    message: canTakeLeave ? 'Leave can be approved' : message,
    leaveDays,
    details: {
      leaveYear: {
        start: leaveYear.start,
        end: leaveYear.end,
        yearNumber: leaveYear.yearNumber
      },
      annual: {
        total: 30,
        used: usedAnnualDays,
        available: availableAnnualDays
      },
      monthly: {
        total: 1,
        used: usedMonthlyDays,
        pending: pendingDaysInMonth,
        available: availableMonthlyDays,
        month: requestMonth.start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      }
    }
  };
};

// Enhanced create application with leave checking
const createApplication = async (applicationData) => {
  const { userId, type, startDate, endDate, leaveType, leaveSubType, ...data } = applicationData;

  // If it's a leave application, check availability and calculate days
  if (type === 'leave') {
    // Validate dates
    const start = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today) {
      throw new Error('Leave start date cannot be in the past');
    }

    if (leaveSubType === 'annual') {
      const end = new Date(endDate);
      if (start > end) {
        throw new Error('Leave start date must be before or equal to end date');
      }
    }

    // Check leave availability for paid leave
    if (leaveType === 'paid') {
      const availability = await checkLeaveAvailability(
        userId,
        leaveType,
        leaveSubType,
        startDate,
        endDate
      );

      if (!availability.available) {
        throw new Error(availability.message);
      }
    }

    const application = new Application({
      userId,
      type,
      startDate,
      endDate: leaveSubType === 'monthly' ? startDate : endDate,
      leaveType,
      leaveSubType,
      ...data
    });

    const user = await User.findById(userId)

    await createNotification({
      title: `Requesting ${leaveType} ${type}`,
      description: `${user.name} is requesting to ${leaveType} ${type} from ${startDate} to ${endDate} regarding the ${data.reason}`,
      priority: "high",
      sourceId: 'from applications',
      time: new Date()
    })

    await PushNotificationService.sendGeneralNotification(
      'SAD-c6e8d3', // broadcast to all users
      `Requesting ${leaveType} ${type}`, //title
      `${user.name} is requesting to ${leaveType} ${type} from ${startDate} to ${endDate} regarding the ${data.reason}`, //decription
      'high', //priority
      'normal' // type
    );
    return await application.save();
  } else {
    // For loan applications
    const application = new Application({
      userId,
      type,
      ...data
    });

    const user = await User.findOne({ _id: userId })

    await createNotification({
      title: `Requesting ${type}`,
      description: `${user.name} is requesting to ${type} for ${data.amount} for ${data.purpose}`,
      priority: "high",
      sourceId: 'from applications',
      time: new Date()
    });

    await PushNotificationService.sendGeneralNotification(
      'SAD-c6e8d3', // broadcast to all users
      `Requesting ${type}`, //title
      `${user.name} is requesting to ${type} for ${data.amount} for ${data.purpose}`, //decription
      'high', //priority
      'normal' // type
    );

    return await application.save();
  }
};

// Get all applications with filters (for admin dashboard)
const getAllApplications = async (filters = {}) => {
  const query = {};

  if (filters.type) query.type = filters.type;
  if (filters.status) query.status = filters.status;
  if (filters.leaveType) query.leaveType = filters.leaveType;
  if (filters.priority) query.priority = filters.priority;

  if (filters.dateFrom || filters.dateTo) {
    query.createdAt = {};
    if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
  }

  // Filter by start date range for leave applications
  if (filters.startDateFrom || filters.startDateTo) {
    query.startDate = {};
    if (filters.startDateFrom) query.startDate.$gte = new Date(filters.startDateFrom);
    if (filters.startDateTo) query.startDate.$lte = new Date(filters.startDateTo);
  }

  return await Application.find(query)
    .populate('userId', 'name email department position')
    .populate('approvedBy', 'name email')
    .sort({ createdAt: -1 });
};

// Change application status
const changeApplicationStatus = async (applicationId, newStatus, options = {}) => {
  const { rejectedReason, adminComments, approvedBy } = options;

  // Validate status
  if (!['approved', 'rejected', 'pending'].includes(newStatus)) {
    throw new Error('Invalid status. Must be approved, rejected, or pending');
  }

  const application = await Application.findById(applicationId);
  if (!application) {
    throw new Error('Application not found');
  }

  // Build update object
  const updateData = {
    status: newStatus
  };

  if (newStatus === 'approved') {
    updateData.approvedAt = new Date();
    if (approvedBy) updateData.approvedBy = approvedBy;
  }

  if (newStatus === 'rejected' && rejectedReason) {
    updateData.rejectedReason = rejectedReason;
  }

  if (adminComments) {
    updateData.adminComments = adminComments;
  }

  const updatedApplication = await Application.findByIdAndUpdate(
    applicationId,
    updateData,
    { new: true }
  ).populate('userId', 'name email')
    .populate('approvedBy', 'name email');

  // Send notification to user about status change
  const user = await User.findById(application.userId);
  if (user) {
    const statusMessage = newStatus === 'approved' ? 'approved' :
      newStatus === 'rejected' ? 'rejected' : 'updated';

    let notificationTitle = '';
    let notificationDescription = '';

    if (application.type === 'leave') {
      notificationTitle = `Leave Application ${statusMessage.charAt(0).toUpperCase() + statusMessage.slice(1)}`;
      notificationDescription = `Your ${application.leaveType} leave application from ${application.startDate.toLocaleDateString()} has been ${statusMessage}`;
    } else {
      notificationTitle = `Loan Application ${statusMessage.charAt(0).toUpperCase() + statusMessage.slice(1)}`;
      notificationDescription = `Your loan application for ${application.amount} has been ${statusMessage}`;
    }

    if (newStatus === 'rejected' && rejectedReason) {
      notificationDescription += `. Reason: ${rejectedReason}`;
    }

    await createNotification({
      title: notificationTitle,
      description: notificationDescription,
      priority: "medium",
      sourceId: 'from applications',
      time: new Date()
    });

    await PushNotificationService.sendGeneralNotification(
      [application.userId], // send to specific user
      notificationTitle,
      notificationDescription,
      'medium',
      'normal'
    );
  }

  return updatedApplication;
};

// Get leave summary for a user
const getLeaveBalance = async (userId) => {
  const user = await User.findById(userId);
  if (!user || !user.joiningDate) {
    throw new Error('User not found or joining date not set');
  }

  const currentDate = new Date();
  const leaveYear = getLeaveYear(user.joiningDate, currentDate);
  const currentMonth = getCurrentMonth(currentDate);

  // Get all approved paid leave applications in current leave year
  const approvedLeaves = await Application.find({
    userId,
    type: 'leave',
    leaveType: 'paid',
    status: 'approved',
    startDate: {
      $gte: leaveYear.start,
      $lte: leaveYear.end
    }
  });

  // Get pending paid leave applications in current leave year
  const pendingLeaves = await Application.find({
    userId,
    type: 'leave',
    leaveType: 'paid',
    status: 'pending',
    startDate: {
      $gte: leaveYear.start,
      $lte: leaveYear.end
    }
  });

  const usedAnnualDays = approvedLeaves.reduce((total, leave) => {
    return total + (leave.leaveDays || 0);
  }, 0);

  const pendingAnnualDays = pendingLeaves.reduce((total, leave) => {
    return total + (leave.leaveDays || 0);
  }, 0);

  const usedMonthlyDays = approvedLeaves
    .filter(leave => {
      const leaveStart = new Date(leave.startDate);
      return leaveStart >= currentMonth.start && leaveStart <= currentMonth.end;
    })
    .reduce((total, leave) => {
      return total + (leave.leaveDays || 0);
    }, 0);

  const pendingMonthlyDays = pendingLeaves
    .filter(leave => {
      const leaveStart = new Date(leave.startDate);
      return leaveStart >= currentMonth.start && leaveStart <= currentMonth.end;
    })
    .reduce((total, leave) => {
      return total + (leave.leaveDays || 0);
    }, 0);

  return {
    user: {
      id: user._id,
      joiningDate: user.joiningDate
    },
    leaveYear: {
      start: leaveYear.start,
      end: leaveYear.end,
      yearNumber: leaveYear.yearNumber
    },
    annual: {
      total: 30,
      used: usedAnnualDays,
      pending: pendingAnnualDays,
      available: 30 - usedAnnualDays - pendingAnnualDays
    },
    monthly: {
      total: 1,
      used: usedMonthlyDays,
      pending: pendingMonthlyDays,
      available: 1 - usedMonthlyDays - pendingMonthlyDays,
      month: currentMonth.start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    },
    recentLeaves: [...approvedLeaves, ...pendingLeaves]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(leave => ({
        startDate: leave.startDate,
        endDate: leave.endDate,
        days: leave.leaveDays,
        reason: leave.reason,
        status: leave.status,
        appliedAt: leave.createdAt
      }))
  };
};

// Get applications by user ID with enhanced filtering
const getApplicationsByUser = async (userId, filters = {}) => {
  const query = { userId };

  if (filters.type) query.type = filters.type;
  if (filters.status) query.status = filters.status;
  if (filters.leaveType) query.leaveType = filters.leaveType;

  if (filters.dateFrom || filters.dateTo) {
    query.createdAt = {};
    if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
  }

  return await Application.find(query)
    .populate('userId', 'name email')
    .populate('approvedBy', 'name email')
    .sort({ createdAt: -1 });
};

module.exports = {
  createApplication,
  getApplicationsByUser,
  getAllApplications,
  changeApplicationStatus,
  checkLeaveAvailability,
  getLeaveBalance,
  calculateLeaveDays // Export the function so it can be used elsewhere if needed
};