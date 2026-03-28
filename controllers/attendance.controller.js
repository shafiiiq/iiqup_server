const moment = require('moment-timezone');

const attendanceService = require('../services/attendance.service');
const Mechanic          = require('../models/mechanic.model');

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
    const today       = moment().format('YYYY-MM-DD');
    const utcDateTime = moment.tz(`${today} ${timeString}`, 'UTC');
    return utcDateTime.tz('Asia/Qatar').format('HH:mm:ss');
  } catch (error) {
    console.error('[Attendance] Error converting time to Qatar timezone:', error);
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
    const data                                        = attendanceData.body || attendanceData;
    const { pin, punch_time, state, work_code, location, id } = data;
    const parsedPin                                   = parseInt(pin);

    const mechanic = await Mechanic.findOne({ zktecoPin: parsedPin });

    if (!mechanic && parsedPin !== 15 && parsedPin !== 1) {
      console.log(`[Attendance] No mechanic found for PIN: ${parsedPin}`);
      return;
    }

    const qatarTime = convertToQatarTime(punch_time);

    // ── Resolve employee name ──────────────────────────────────────────────────
    let empName;
    if      (parsedPin === 1)  empName = process.env.SUPER_ADMIN_NAME;
    else if (parsedPin === 15) empName = process.env.WORKSHOP_MANAGER_EMP_NAME;
    else if (mechanic)         empName = mechanic.name;
    else                       empName = `Unknown User (PIN: ${parsedPin})`;

    const newAttendance = {
      id,
      punch_time:     qatarTime,
      punch_state:    state,
      emp_name:       empName,
      verify_type:    '1',
      work_code,
      gps_location:   location,
      terminal_alias: 'ZKTeco Device',
      capture:        '',
      upload_time:    moment().tz('Asia/Qatar').toISOString(),
      icon:           '/media/images/device.png',
      location,
      photo:          'auth_files/photo/7.jpg?_=1757838507',
      pin:            parsedPin,
    };

    await attendanceService.addAttendance(newAttendance);

  } catch (error) {
    console.error('[Attendance] Error saving attendance:', error);
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
      return res.status(200).json({
        success:   true,
        message:   'Attendance record already exists',
        duplicate: true,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Attendance record created successfully',
      data:    saved,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * GET /get-live-attendance
 * Returns live attendance data with optional query filters.
 */
const getLiveAttendance = async (req, res) => {
  try {
    const attendances = await attendanceService.getLiveMecAttendance(null, req.query);

    res.status(200).json({
      success: true,
      data:    attendances,
      count:   attendances.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /today-attendance
 * Returns all attendance records for today.
 */
const getTodayAttendance = async (req, res) => {
  try {
    const todayAttendance = await attendanceService.getTodayAttendance();

    res.status(200).json({
      success: true,
      data:    todayAttendance,
      count:   todayAttendance.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /attendance-stats
 * Returns attendance statistics based on optional query filters.
 */
const getAttendanceStats = async (req, res) => {
  try {
    const stats = await attendanceService.getAttendanceStats(req.query);

    res.status(200).json({
      success: true,
      data:    stats,
      count:   stats.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /daily-report
 * Returns a per-employee daily attendance report grouped by PIN.
 */
const getDailyReport = async (req, res) => {
  try {
    const targetDate  = req.query.date || new Date().toISOString().split('T')[0];
    const attendances = await attendanceService.getLiveMecAttendance(null, { date: targetDate });

    // ── Group by employee PIN ──────────────────────────────────────────────────
    const employeeReport = {};

    attendances.forEach((attendance) => {
      if (!employeeReport[attendance.pin]) {
        employeeReport[attendance.pin] = {
          pin:        attendance.pin,
          empName:    attendance.empName,
          punches:    [],
          firstPunch: null,
          lastPunch:  null,
        };
      }

      employeeReport[attendance.pin].punches.push({
        time:     attendance.timeOnly,
        type:     attendance.punchType,
        datetime: attendance.punchDateTime,
      });

      const emp = employeeReport[attendance.pin];
      if (!emp.firstPunch || attendance.punchDateTime < emp.firstPunch) emp.firstPunch = attendance.punchDateTime;
      if (!emp.lastPunch  || attendance.punchDateTime > emp.lastPunch)  emp.lastPunch  = attendance.punchDateTime;
    });

    // ── Calculate working hours ────────────────────────────────────────────────
    Object.values(employeeReport).forEach((emp) => {
      if (emp.firstPunch && emp.lastPunch) {
        const diffMs       = emp.lastPunch - emp.firstPunch;
        emp.workingHours   = (diffMs / (1000 * 60 * 60)).toFixed(2);
      }
    });

    res.status(200).json({
      success: true,
      date:    targetDate,
      data:    Object.values(employeeReport),
      count:   Object.keys(employeeReport).length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
      return res.status(400).json({
        success: false,
        message: 'PIN, month, and year are required',
      });
    }

    const monthYear   = `${year}-${month.toString().padStart(2, '0')}`;
    const attendances = await attendanceService.getLiveMecAttendance(null, { pin, monthYear });

    res.status(200).json({
      success:  true,
      data:     attendances,
      count:    attendances.length,
      employee: attendances.length > 0 ? attendances[0].empName : 'Unknown',
      month:    monthYear,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  sendToServer,
  storeToProcess,
  getLiveAttendance,
  getTodayAttendance,
  getAttendanceStats,
  getDailyReport,
  getEmployeeMonthlyAttendance,
};