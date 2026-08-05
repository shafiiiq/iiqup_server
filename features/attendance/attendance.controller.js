const logger = require('../../shared/logger/logger');

const HTTP = require('../../shared/constants/httpStatus.constant.js');
const { sendSuccess, sendError } = require('../../shared/response/response.util');
const moment = require('moment-timezone');

const attendanceService = require('./attendance.service');
const Mechanic = require('../mechanic/mechanic.model');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a UTC time string to Qatar timezone (Asia/Qatar).
 *
 * @param {string} timeString - Time string in HH:mm:ss format (UTC).
 * @returns {string} Time string converted to Qatar timezone.
 */
const convertToQatarTime = (timeString) => {
  try {
    const today = moment().format('YYYY-MM-DD');
    const utcDateTime = moment.tz(`${today} ${timeString}`, 'UTC');
    return utcDateTime.tz('Asia/Qatar').format('HH:mm:ss');
  } catch (error) {
    logger.error(
      '[Attendance] Error converting time to Qatar timezone:',
      error
    );
    return timeString;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal — used by ZKTeco route
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Receives a raw ZKTeco attendance record, resolves the employee name,
 * converts the punch time to Qatar timezone, and persists the record.
 *
 * @param {Object} attendanceData - Raw attendance data object or { body } wrapper.
 */
const sendToServer = async (attendanceData) => {
  try {
    const data = attendanceData.body || attendanceData;
    const { pin, punch_time, state, work_code, location, id } = data;
    const parsedPin = parseInt(pin);

    const mechanic = await Mechanic.findOne({ zktecoPin: parsedPin });

    if (!mechanic && parsedPin !== 15 && parsedPin !== 1) {
      logger.info(`[Attendance] No mechanic found for PIN: ${parsedPin}`);
      return;
    }

    const qatarTime = convertToQatarTime(punch_time);

    // ── Resolve employee name ──────────────────────────────────────────────────
    let empName;
    if (parsedPin === 1) empName = process.env.SUPER_ADMIN_NAME;
    else if (parsedPin === 15) empName = process.env.WORKSHOP_MANAGER_EMP_NAME;
    else if (mechanic) empName = mechanic.name;
    else empName = `Unknown User (PIN: ${parsedPin})`;

    const newAttendance = {
      id,
      punch_time: qatarTime,
      punch_state: state,
      emp_name: empName,
      verify_type: '1',
      work_code,
      gps_location: location,
      terminal_alias: 'ZKTeco Device',
      capture: '',
      upload_time: moment().tz('Asia/Qatar').toISOString(),
      icon: '/media/images/device.png',
      location,
      photo: 'auth_files/photo/7.jpg?_=1757838507',
      pin: parsedPin,
    };

    await attendanceService.addAttendance(newAttendance);
  } catch (error) {
    logger.error('[Attendance] Error saving attendance:', error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /add-attendance
 * Creates a new attendance record manually.
 */
const storeToProcess = async (req, res) => {
  try {
    const saved = await attendanceService.addAttendance(req.body);

    if (!saved) {
      return sendSuccess(res, {
        success: true,
        message: 'Attendance record already exists',
        duplicate: true,
      });
    }

    sendSuccess(res, {
      success: true,
      message: 'Attendance record created successfully',
      data: saved,
    });
  } catch (error) {
    sendError(res, { success: false, message: error.message });
  }
};

/**
 * PUT /add-zkteco-pin
 * Adds a ZKTeco PIN to a mechanic.
 */
const addZktecoPin = async (req, res) => {
  try {
    const { _id, zktecoPin } = req.body;

    if (!_id || !zktecoPin) {
      return sendError(res, {
        success: false,
        message: 'Both _id and zktecoPin are required',
      });
    }

    const updatedMechanic = await service.setZktecoPin(_id, zktecoPin);

    if (!updatedMechanic) {
      return sendError(res, {
        success: false,
        message: 'Mechanic not found',
      });
    }

    sendSuccess(res, {
      success: true,
      message: 'ZKTeco PIN added successfully',
      data: updatedMechanic,
    });
  } catch (error) {
    logger.error('[ZKTeco] Error adding ZKTeco PIN:', error);
    sendError(res, {
      success: false,
      message: error.message,
    });
  }
};

/**
 * GET /get-live-attendance
 * Returns live attendance data with optional query filters.
 */
const getLiveAttendance = async (req, res) => {
  try {
    const attendances = await attendanceService.getLiveMecAttendance(
      null,
      req.query
    );

    sendSuccess(res, {
      success: true,
      data: attendances,
      count: attendances.length,
    });
  } catch (error) {
    sendError(res, { success: false, message: error.message });
  }
};

/**
 * GET /today-attendance
 * Returns all attendance records for today.
 */
const getTodayAttendance = async (req, res) => {
  try {
    const todayAttendance = await attendanceService.getTodayAttendance();

    sendSuccess(res, {
      success: true,
      data: todayAttendance,
      count: todayAttendance.length,
    });
  } catch (error) {
    sendError(res, { success: false, message: error.message });
  }
};

/**
 * GET /attendance-stats
 * Returns attendance statistics based on optional query filters.
 */
const getAttendanceStats = async (req, res) => {
  try {
    const stats = await attendanceService.getAttendanceStats(req.query);

    sendSuccess(res, {
      success: true,
      data: stats,
      count: stats.length,
    });
  } catch (error) {
    sendError(res, { success: false, message: error.message });
  }
};

/**
 * GET /daily-report
 * Returns a per-employee daily attendance report grouped by PIN.
 */
const getDailyReport = async (req, res) => {
  try {
    const targetDate = req.query.date || new Date().toISOString().split('T')[0];
    const attendances = await attendanceService.getLiveMecAttendance(null, {
      date: targetDate,
    });

    // ── Group by employee PIN ──────────────────────────────────────────────────
    const employeeReport = {};

    attendances.forEach((attendance) => {
      if (!employeeReport[attendance.pin]) {
        employeeReport[attendance.pin] = {
          pin: attendance.pin,
          empName: attendance.empName,
          punches: [],
          firstPunch: null,
          lastPunch: null,
        };
      }

      employeeReport[attendance.pin].punches.push({
        time: attendance.timeOnly,
        type: attendance.punchType,
        datetime: attendance.punchDateTime,
      });

      const emp = employeeReport[attendance.pin];
      if (!emp.firstPunch || attendance.punchDateTime < emp.firstPunch)
        emp.firstPunch = attendance.punchDateTime;
      if (!emp.lastPunch || attendance.punchDateTime > emp.lastPunch)
        emp.lastPunch = attendance.punchDateTime;
    });

    // ── Calculate working hours ────────────────────────────────────────────────
    Object.values(employeeReport).forEach((emp) => {
      if (emp.firstPunch && emp.lastPunch) {
        const diffMs = emp.lastPunch - emp.firstPunch;
        emp.workingHours = (diffMs / (1000 * 60 * 60)).toFixed(2);
      }
    });

    sendSuccess(res, {
      success: true,
      date: targetDate,
      data: Object.values(employeeReport),
      count: Object.keys(employeeReport).length,
    });
  } catch (error) {
    sendError(res, { success: false, message: error.message });
  }
};

/**
 * GET /employee-monthly
 * Returns monthly attendance records for a specific employee PIN.
 */
const getEmployeeMonthlyAttendance = async (req, res) => {
  try {
    const { pin, month, year } = req.query;

    if (!pin || !month || !year) {
      return sendError(res, {
        success: false,
        message: 'PIN, month, and year are required',
      });
    }

    const monthYear = `${year}-${month.toString().padStart(2, '0')}`;
    const attendances = await attendanceService.getLiveMecAttendance(null, {
      pin,
      monthYear,
    });

    sendSuccess(res, {
      success: true,
      data: attendances,
      count: attendances.length,
      employee: attendances.length > 0 ? attendances[0].empName : 'Unknown',
      month: monthYear,
    });
  } catch (error) {
    sendError(res, { success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  sendToServer,
  storeToProcess,
  addZktecoPin,
  getLiveAttendance,
  getTodayAttendance,
  getAttendanceStats,
  getDailyReport,
  getEmployeeMonthlyAttendance,
};
