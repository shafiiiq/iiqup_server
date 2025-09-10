const Attendance = require('../models/attendance.model');
const moment = require('moment');

// Helper function to determine punch type based on ACTUAL punch time
const determinePunchType = async (pin, currentDateTime) => {
  const dateOnly = moment(currentDateTime).format('YYYY-MM-DD');
  
  // Get today's punches for this employee SORTED BY ACTUAL PUNCH TIME
  const todayPunches = await Attendance.find({
    pin: pin,
    dateOnly: dateOnly
  }).sort({ punchDateTime: 1 }); // Sort by actual punch time, not insertion order

  // If no punches exist, first punch is IN
  if (todayPunches.length === 0) {
    return 'IN';
  }
  
  // Check if current punch time already exists (avoid duplicates)
  const existingPunch = todayPunches.find(punch => 
    moment(punch.punchDateTime).isSame(moment(currentDateTime))
  );
  
  if (existingPunch) {
    return existingPunch.punchType; // Return existing type if duplicate
  }
  
  // Find the position where this punch should be inserted based on time
  let insertPosition = 0;
  for (let i = 0; i < todayPunches.length; i++) {
    if (moment(currentDateTime).isAfter(moment(todayPunches[i].punchDateTime))) {
      insertPosition = i + 1;
    } else {
      break;
    }
  }
  
  // Determine punch type based on position in chronological order
  // Position 0, 2, 4, ... should be IN
  // Position 1, 3, 5, ... should be OUT
  return (insertPosition % 2 === 0) ? 'IN' : 'OUT';
};

// Alternative simpler approach - determine punch type after all data is inserted
const recalculatePunchTypes = async (pin, date) => {
  const dateOnly = moment(date).format('YYYY-MM-DD');
  
  // Get all punches for this employee on this date, sorted by actual time
  const punches = await Attendance.find({
    pin: pin,
    dateOnly: dateOnly
  }).sort({ punchDateTime: 1 });
  
  // Update punch types in correct chronological order
  for (let i = 0; i < punches.length; i++) {
    const correctPunchType = (i % 2 === 0) ? 'IN' : 'OUT';
    
    if (punches[i].punchType !== correctPunchType) {
      await Attendance.findByIdAndUpdate(punches[i]._id, {
        punchType: correctPunchType
      });
    }
  }
  
  return punches.length;
};

// Helper function to get week number
const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

const addAttendance = async (attendanceData) => {
  try {
    // Parse the punch time and create proper DateTime
    const punchDateTime = new Date();
    const [hours, minutes, seconds] = attendanceData.punch_time.split(':');
    punchDateTime.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds), 0);

    // Check if record already exists first
    const existingRecord = await Attendance.findOne({ 
      originalId: attendanceData.id 
    });

    if (existingRecord) {
      return null; // Already exists, skip
    }

    // Determine punch type based on chronological order
    const punchType = await determinePunchType(attendanceData.pin, punchDateTime);

    // Prepare data for saving
    const attendanceRecord = {
      originalId: attendanceData.id,
      pin: attendanceData.pin,
      empName: attendanceData.emp_name,
      punchTime: attendanceData.punch_time,
      punchDateTime: punchDateTime,
      state: attendanceData.state,
      workCode: attendanceData.work_code,
      photo: attendanceData.photo || '',
      location: attendanceData.location,
      punchType: punchType,
      
      // Time tracking fields
      dateOnly: moment(punchDateTime).format('YYYY-MM-DD'),
      timeOnly: attendanceData.punch_time,
      weekNumber: getWeekNumber(punchDateTime),
      monthYear: moment(punchDateTime).format('YYYY-MM'),
      year: punchDateTime.getFullYear()
    };

    // Save new record
    const savedAttendance = await Attendance.create(attendanceRecord);
    
    // Recalculate punch types for this employee's day to ensure correctness
    await recalculatePunchTypes(attendanceData.pin, punchDateTime);
    
    return savedAttendance;

  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error, record already exists
      return null;
    }
    throw error;
  }
};

// Batch process to fix existing data
const fixExistingPunchTypes = async (pin = null, date = null) => {
  try {
    let query = {};
    
    if (pin) query.pin = pin;
    if (date) query.dateOnly = moment(date).format('YYYY-MM-DD');
    
    // Get all unique employee-date combinations
    const combinations = await Attendance.distinct('pin', query);
    
    let totalFixed = 0;
    
    for (const employeePin of combinations) {
      let dateQuery = { pin: employeePin };
      if (date) {
        dateQuery.dateOnly = moment(date).format('YYYY-MM-DD');
        const fixed = await recalculatePunchTypes(employeePin, date);
        totalFixed += fixed;
      } else {
        // Get all dates for this employee
        const dates = await Attendance.distinct('dateOnly', { pin: employeePin });
        
        for (const dateOnly of dates) {
          const fixed = await recalculatePunchTypes(employeePin, dateOnly);
          totalFixed += fixed;
        }
      }
    }
    
    return { message: `Fixed punch types for ${totalFixed} records` };
    
  } catch (error) {
    throw error;
  }
};

const getLiveMecAttendance = async (userId, filters = {}) => {
  try {
    const query = {};
    
    // Apply filters
    if (filters.pin) {
      query.pin = filters.pin;
    }
    
    if (filters.date) {
      query.dateOnly = filters.date;
    }
    
    if (filters.month) {
      query.monthYear = filters.month;
    }
    
    if (filters.year) {
      query.year = parseInt(filters.year);
    }
    
    if (filters.week && filters.weekYear) {
      query.weekNumber = parseInt(filters.week);
      query.year = parseInt(filters.weekYear);
    }
    
    if (filters.empName) {
      query.empName = new RegExp(filters.empName, 'i');
    }
    
    // Date range filter
    if (filters.startDate && filters.endDate) {
      query.dateOnly = {
        $gte: filters.startDate,
        $lte: filters.endDate
      };
    }

    const attendances = await Attendance.find(query)
      .sort({ punchDateTime: -1 })
      .limit(parseInt(filters.limit) || 100);

    return attendances;
  } catch (error) {
    throw error;
  }
};

// Get attendance statistics
const getAttendanceStats = async (filters = {}) => {
  try {
    const matchStage = {};
    
    if (filters.pin) matchStage.pin = filters.pin;
    if (filters.month) matchStage.monthYear = filters.month;
    if (filters.year) matchStage.year = parseInt(filters.year);
    
    const stats = await Attendance.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            pin: "$pin",
            empName: "$empName",
            dateOnly: "$dateOnly"
          },
          totalPunches: { $sum: 1 },
          firstPunch: { $min: "$punchDateTime" },
          lastPunch: { $max: "$punchDateTime" },
          punchTypes: { $push: "$punchType" }
        }
      },
      {
        $project: {
          pin: "$_id.pin",
          empName: "$_id.empName",
          date: "$_id.dateOnly",
          totalPunches: 1,
          firstPunch: 1,
          lastPunch: 1,
          workingHours: {
            $divide: [
              { $subtract: ["$lastPunch", "$firstPunch"] },
              3600000 // Convert to hours
            ]
          }
        }
      },
      { $sort: { date: -1, pin: 1 } }
    ]);

    return stats;
  } catch (error) {
    throw error;
  }
};

// Get today's attendance
const getTodayAttendance = async () => {
  const today = moment().format('YYYY-MM-DD');
  return await Attendance.find({ 
    dateOnly: today 
  }).sort({ punchDateTime: -1 });
};

// Get unprocessed attendance records
const getUnprocessedRecords = async () => {
  return await Attendance.find({ 
    notificationSent: false 
  }).sort({ punchDateTime: 1 });
};

// Mark records as processed
const markAsProcessed = async (recordIds) => {
  return await Attendance.updateMany(
    { _id: { $in: recordIds } },
    { 
      $set: { 
        isProcessed: true, 
        notificationSent: true 
      } 
    }
  );
};

module.exports = {
  addAttendance,
  getLiveMecAttendance,
  getAttendanceStats,
  getTodayAttendance,
  getUnprocessedRecords,
  markAsProcessed,
  fixExistingPunchTypes,
  recalculatePunchTypes
};