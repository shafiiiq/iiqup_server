const attendanceService = require('../services/attendance-service');
const liveMonitor = require('../jobs/attendance-cron-jobs');
const Mechanic = require('../models/mechanic.model'); // Add this import

// Create new attendance record (manual)
const storeToProcess = async (req, res) => {
  try {
    const savedAttendance = await attendanceService.addAttendance(req.body);

    if (!savedAttendance) {
      return res.status(200).json({
        success: true,
        message: 'Attendance record already exists',
        duplicate: true
      });
    }

    res.status(201).json({
      success: true,
      message: 'Attendance record created successfully',
      data: savedAttendance
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// data {
//   id: 4599,
//   pin: '7',
//   emp_name: 'abdul rasak',
//   punch_time: '05:20:31',
//   state: '255',
//   work_code: '0',
//   capture: '',
//   photo: 'auth_files/photo/7.jpg?_=1757838507',
//   location: 'Auto add',
//   icon: '/media/images/device.png'
// }

const sendToServer = async (attendanceData) => {
  try {
    // Handle both direct data and request object formats
    const data = attendanceData.body || attendanceData;
    const { pin, punch_time, state, work_code, location, id } = data;

    // Parse the pin to integer
    const parsedPin = parseInt(pin);

    // Find mechanic by zktecoPin
    const mechanic = await Mechanic.findOne({ zktecoPin: parsedPin });

    if (!mechanic) {
      // console.log(`No mechanic found with zktecoPin: ${parsedPin}`);
      return;
    }

    // Check for duplicate - prevent same time with same state (more realistic for attendance)
    const existingRecord = mechanic.attendance.find(att =>
      att.punch_time === punch_time && att.punch_state === state
    );

    if (existingRecord) {
      // console.log(`Duplicate attendance record skipped for ${mechanic.name} - ID: ${id}, Time: ${punch_time}`);
      return;
    }

    // Create new attendance record
    const newAttendance = {
      id: id,
      punch_time: punch_time,
      punch_state: state,
      emp_name: mechanic.name,
      verify_type: '1', // Fingerprint
      work_code: work_code,
      gps_location: location,
      terminal_alias: 'ZKTeco Device',
      capture: '',
      upload_time: new Date().toISOString(),
      icon: '/media/images/device.png',
      location: location,
      photo: 'auth_files/photo/7.jpg?_=1757838507',
      pin: parsedPin
    };

    const savedAttendance = await attendanceService.addAttendance(newAttendance);
    // console.log(savedAttendance);
    

    // Add to mechanic's attendance array
    mechanic.attendance.push(newAttendance);
    await mechanic.save();
    // console.log(`✅ Attendance saved for ${mechanic.name} at ${punch_time} - ID: ${id}, State: ${state}`);

  } catch (error) {
    console.error('Error saving attendance:', error);
  }
};

// Get live attendance data with various filters
const getLiveAttendance = async (req, res) => {
  try {
    const filters = req.query;

    const attendances = await attendanceService.getLiveMecAttendance(null, filters);

    res.status(200).json({
      success: true,
      data: attendances,
      count: attendances.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get today's attendance
const getTodayAttendance = async (req, res) => {
  try {
    const todayAttendance = await attendanceService.getTodayAttendance();

    res.status(200).json({
      success: true,
      data: todayAttendance,
      count: todayAttendance.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get attendance statistics
const getAttendanceStats = async (req, res) => {
  try {
    const filters = req.query;
    const stats = await attendanceService.getAttendanceStats(filters);

    res.status(200).json({
      success: true,
      data: stats,
      count: stats.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get employee-wise daily report
const getDailyReport = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const attendances = await attendanceService.getLiveMecAttendance(null, { date: targetDate });

    // Group by employee
    const employeeReport = {};
    attendances.forEach(attendance => {
      if (!employeeReport[attendance.pin]) {
        employeeReport[attendance.pin] = {
          pin: attendance.pin,
          empName: attendance.empName,
          punches: [],
          firstPunch: null,
          lastPunch: null
        };
      }

      employeeReport[attendance.pin].punches.push({
        time: attendance.timeOnly,
        type: attendance.punchType,
        datetime: attendance.punchDateTime
      });

      // Update first and last punch
      if (!employeeReport[attendance.pin].firstPunch ||
        attendance.punchDateTime < employeeReport[attendance.pin].firstPunch) {
        employeeReport[attendance.pin].firstPunch = attendance.punchDateTime;
      }

      if (!employeeReport[attendance.pin].lastPunch ||
        attendance.punchDateTime > employeeReport[attendance.pin].lastPunch) {
        employeeReport[attendance.pin].lastPunch = attendance.punchDateTime;
      }
    });

    // Calculate working hours
    Object.keys(employeeReport).forEach(pin => {
      const employee = employeeReport[pin];
      if (employee.firstPunch && employee.lastPunch) {
        const diffMs = employee.lastPunch - employee.firstPunch;
        employee.workingHours = (diffMs / (1000 * 60 * 60)).toFixed(2);
      }
    });

    res.status(200).json({
      success: true,
      date: targetDate,
      data: Object.values(employeeReport),
      count: Object.keys(employeeReport).length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Manual sync with external system
const manualSync = async (req, res) => {
  try {
    const syncResult = await liveMonitor.manualSync();

    res.status(200).json({
      success: syncResult.success,
      message: syncResult.success ? 'Manual sync completed' : 'Manual sync failed',
      data: syncResult
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get monitoring status
const getMonitoringStatus = async (req, res) => {
  try {
    const status = liveMonitor.getStatus();

    res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Start live monitoring
const startMonitoring = async (req, res) => {
  try {
    liveMonitor.startMonitoring();

    res.status(200).json({
      success: true,
      message: 'Live monitoring started'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Stop live monitoring
const stopMonitoring = async (req, res) => {
  try {
    liveMonitor.stopMonitoring();

    res.status(200).json({
      success: true,
      message: 'Live monitoring stopped'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get employee monthly attendance
const getEmployeeMonthlyAttendance = async (req, res) => {
  try {
    const { pin, month, year } = req.query;

    if (!pin || !month || !year) {
      return res.status(400).json({
        success: false,
        message: 'PIN, month, and year are required'
      });
    }

    const monthYear = `${year}-${month.toString().padStart(2, '0')}`;
    const attendances = await attendanceService.getLiveMecAttendance(null, {
      pin,
      monthYear
    });

    res.status(200).json({
      success: true,
      data: attendances,
      count: attendances.length,
      employee: attendances.length > 0 ? attendances[0].empName : 'Unknown',
      month: monthYear
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  storeToProcess,
  getLiveAttendance,
  getTodayAttendance,
  getAttendanceStats,
  getDailyReport,
  manualSync,
  getMonitoringStatus,
  startMonitoring,
  stopMonitoring,
  getEmployeeMonthlyAttendance,
  sendToServer
};