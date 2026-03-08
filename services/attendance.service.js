// services/attendance.service.js
const Attendance             = require('../models/attendance.model');
const moment                 = require('moment');
const PushNotificationService = require('../push/notification.push');
const { createNotification } = require('./notification.service');
require('dotenv').config();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const NOTIFICATION_RECIPIENTS = [
  process.env.MAINTENANCE_HEAD,
  process.env.WORKSHOP_MANAGER,
  process.env.SUPER_ADMIN,
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Capitalises each word in a name string.
 */
const standardizeName = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Converts a 24-hour HH:MM time string to 12-hour format (e.g. "14:30" → "2:30PM").
 */
const formatTime = (timeString) => {
  const [hours, minutes] = timeString.split(':');
  const hour24 = parseInt(hours);
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const ampm   = hour24 >= 12 ? 'PM' : 'AM';
  return `${hour12}:${minutes}${ampm}`;
};

/**
 * Returns a human-readable date label relative to today
 * (e.g. "today (5 June)", "yesterday (4 June)", "on 3 June").
 */
const formatDate = (dateString) => {
  const date      = new Date(dateString);
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayStr     = today.toISOString().split('T')[0];
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const label        = `${date.getDate()} ${MONTHS[date.getMonth()]}`;

  if (dateString === todayStr)     return `today (${label})`;
  if (dateString === yesterdayStr) return `yesterday (${label})`;
  return `on ${label}`;
};

/**
 * Returns the ISO week number for a given Date.
 */
const getWeekNumber = (date) => {
  const d      = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

// ─────────────────────────────────────────────────────────────────────────────
// Punch Type Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines whether a new punch should be IN or OUT based on its
 * chronological position among existing punches for the same employee/day.
 */
const determinePunchType = async (pin, currentDateTime) => {
  const dateOnly    = moment(currentDateTime).format('YYYY-MM-DD');
  const todayPunches = await Attendance.find({ pin, dateOnly }).sort({ punchDateTime: 1 });

  if (todayPunches.length === 0) return 'IN';

  const existingPunch = todayPunches.find(punch =>
    moment(punch.punchDateTime).isSame(moment(currentDateTime))
  );

  if (existingPunch) return existingPunch.punchType;

  let insertPosition = 0;
  for (let i = 0; i < todayPunches.length; i++) {
    if (moment(currentDateTime).isAfter(moment(todayPunches[i].punchDateTime))) {
      insertPosition = i + 1;
    } else {
      break;
    }
  }

  return insertPosition % 2 === 0 ? 'IN' : 'OUT';
};

/**
 * Re-assigns IN/OUT types to all punches for an employee on a given date
 * in strict chronological order (0=IN, 1=OUT, 2=IN, …).
 * Returns the number of records processed.
 */
const recalculatePunchTypes = async (pin, date) => {
  const dateOnly = moment(date).format('YYYY-MM-DD');
  const punches  = await Attendance.find({ pin, dateOnly }).sort({ punchDateTime: 1 });

  for (let i = 0; i < punches.length; i++) {
    const correctPunchType = i % 2 === 0 ? 'IN' : 'OUT';

    if (punches[i].punchType !== correctPunchType) {
      await Attendance.findByIdAndUpdate(punches[i]._id, { punchType: correctPunchType });
    }
  }

  return punches.length;
};

// ─────────────────────────────────────────────────────────────────────────────
// Write Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Saves a new attendance record from a ZKTeco punch event.
 * Skips duplicates (by originalId or unique index violation).
 * Fires in-app and push notifications after saving.
 * Returns the saved record, or null if it already existed.
 */
const addAttendance = async (attendanceData) => {
  try {
    const punchDateTime          = new Date();
    const [hours, minutes, seconds] = attendanceData.punch_time.split(':');
    punchDateTime.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds), 0);

    const existingRecord = await Attendance.findOne({ originalId: attendanceData.id });
    if (existingRecord) return null;

    const punchType = await determinePunchType(attendanceData.pin, punchDateTime);

    const savedAttendance = await Attendance.create({
      originalId:    attendanceData.id,
      pin:           attendanceData.pin,
      empName:       attendanceData.emp_name,
      punchTime:     attendanceData.punch_time,
      punchDateTime,
      state:         attendanceData.state,
      workCode:      attendanceData.work_code,
      photo:         attendanceData.photo || '',
      location:      attendanceData.location,
      punchType,
      dateOnly:      moment(punchDateTime).format('YYYY-MM-DD'),
      timeOnly:      attendanceData.punch_time,
      weekNumber:    getWeekNumber(punchDateTime),
      monthYear:     moment(punchDateTime).format('YYYY-MM'),
      year:          punchDateTime.getFullYear(),
    });

    await recalculatePunchTypes(attendanceData.pin, punchDateTime);

    try {
      const name        = standardizeName(savedAttendance.empName);
      const timeLabel   = formatTime(savedAttendance.timeOnly);
      const dateLabel   = formatDate(savedAttendance.dateOnly);
      const title       = `${name} Punched ${savedAttendance.punchType}`;
      const description = `${name} punched ${savedAttendance.punchType.toLowerCase()} at ${timeLabel} ${dateLabel}`;

      await createNotification({
        title,
        description,
        priority:  'low',
        sourceId:  'attendance',
        recipient: NOTIFICATION_RECIPIENTS,
        time:      new Date(),
      });

      await PushNotificationService.sendGeneralNotification(
        NOTIFICATION_RECIPIENTS,
        title,
        description,
        'low',
        'attendance',
      );
    } catch (error) {
      console.error('[AttendanceService] addAttendance — notification error:', error);
    }

    return savedAttendance;
  } catch (error) {
    if (error.code === 11000) return null;
    console.error('[AttendanceService] addAttendance:', error);
    throw error;
  }
};

/**
 * Batch re-assigns punch types for all records matching optional pin/date filters.
 * If no filters are provided, processes every employee and every date.
 */
const fixExistingPunchTypes = async (pin = null, date = null) => {
  try {
    const query        = {};
    if (pin)  query.pin = pin;
    if (date) query.dateOnly = moment(date).format('YYYY-MM-DD');

    const pins       = await Attendance.distinct('pin', query);
    let totalFixed   = 0;

    for (const employeePin of pins) {
      if (date) {
        totalFixed += await recalculatePunchTypes(employeePin, date);
      } else {
        const dates = await Attendance.distinct('dateOnly', { pin: employeePin });
        for (const dateOnly of dates) {
          totalFixed += await recalculatePunchTypes(employeePin, dateOnly);
        }
      }
    }

    return { message: `Fixed punch types for ${totalFixed} records` };
  } catch (error) {
    console.error('[AttendanceService] fixExistingPunchTypes:', error);
    throw error;
  }
};

/**
 * Marks a list of attendance records as processed and notification-sent.
 */
const markAsProcessed = async (recordIds) => {
  try {
    return await Attendance.updateMany(
      { _id: { $in: recordIds } },
      { $set: { isProcessed: true, notificationSent: true } }
    );
  } catch (error) {
    console.error('[AttendanceService] markAsProcessed:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Read Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns attendance records filtered by any combination of
 * pin, date, month, year, week, empName, or date range.
 */
const getLiveMecAttendance = async (userId, filters = {}) => {
  try {
    const query = {};

    if (filters.pin)     query.pin      = filters.pin;
    if (filters.month)   query.monthYear = filters.month;
    if (filters.year)    query.year      = parseInt(filters.year);
    if (filters.empName) query.empName   = new RegExp(filters.empName, 'i');

    if (filters.week && filters.weekYear) {
      query.weekNumber = parseInt(filters.week);
      query.year       = parseInt(filters.weekYear);
    }

    if (filters.startDate && filters.endDate) {
      query.dateOnly = { $gte: filters.startDate, $lte: filters.endDate };
    } else if (filters.date) {
      query.dateOnly = filters.date;
    }

    return await Attendance
      .find(query)
      .sort({ punchDateTime: -1 })
      .limit(parseInt(filters.limit) || 100);
  } catch (error) {
    console.error('[AttendanceService] getLiveMecAttendance:', error);
    throw error;
  }
};

/**
 * Returns aggregated working-hours statistics per employee per day.
 * Supports optional pin, month, and year filters.
 */
const getAttendanceStats = async (filters = {}) => {
  try {
    const matchStage = {};
    if (filters.pin)   matchStage.pin      = filters.pin;
    if (filters.month) matchStage.monthYear = filters.month;
    if (filters.year)  matchStage.year      = parseInt(filters.year);

    return await Attendance.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id:          { pin: '$pin', empName: '$empName', dateOnly: '$dateOnly' },
          totalPunches: { $sum: 1 },
          firstPunch:   { $min: '$punchDateTime' },
          lastPunch:    { $max: '$punchDateTime' },
          punchTypes:   { $push: '$punchType' },
        },
      },
      {
        $project: {
          pin:          '$_id.pin',
          empName:      '$_id.empName',
          date:         '$_id.dateOnly',
          totalPunches: 1,
          firstPunch:   1,
          lastPunch:    1,
          workingHours: {
            $divide: [{ $subtract: ['$lastPunch', '$firstPunch'] }, 3600000],
          },
        },
      },
      { $sort: { date: -1, pin: 1 } },
    ]);
  } catch (error) {
    console.error('[AttendanceService] getAttendanceStats:', error);
    throw error;
  }
};

/**
 * Returns all attendance records for today, sorted by most recent punch.
 */
const getTodayAttendance = async () => {
  try {
    const today = moment().format('YYYY-MM-DD');
    return await Attendance.find({ dateOnly: today }).sort({ punchDateTime: -1 });
  } catch (error) {
    console.error('[AttendanceService] getTodayAttendance:', error);
    throw error;
  }
};

/**
 * Returns all records that have not yet had a notification sent.
 */
const getUnprocessedRecords = async () => {
  try {
    return await Attendance.find({ notificationSent: false }).sort({ punchDateTime: 1 });
  } catch (error) {
    console.error('[AttendanceService] getUnprocessedRecords:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp (currently disabled)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends an attendance alert via WhatsApp to configured recipients.
 * Currently unused — kept for future re-enablement.
 */
const sendWhatsAppMessage = async (empName, punchType, time, date) => {
  try {
    const axios = require('axios');

    if (!process.env.WHATSAPP_ACCESS_TOKEN) {
      throw new Error('WHATSAPP_ACCESS_TOKEN is not set in environment variables');
    }

    if (!process.env.WHATSAPP_PHONE_NUMBER_ID) {
      throw new Error('WHATSAPP_PHONE_NUMBER_ID is not set in environment variables');
    }

    const message = `🕒 *Attendance Alert*\n\n` +
      `👤 Employee: ${empName}\n` +
      `📍 Status: Punched ${punchType}\n` +
      `⏰ Time: ${time}\n` +
      `📅 Date: ${date}`;

    const recipients = [
      process.env.WHATSAPP_NUMBER_1,
      process.env.WHATSAPP_NUMBER_2,
    ].filter(Boolean);

    if (recipients.length === 0) {
      console.warn('[AttendanceService] sendWhatsAppMessage — no recipients configured');
      return;
    }

    for (const number of recipients) {
      const cleanNumber = number.replace(/\D/g, '');

      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: 'whatsapp',
          to:   cleanNumber,
          type: 'text',
          text: { body: message },
        },
        {
          headers: {
            Authorization:  `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(`[AttendanceService] sendWhatsAppMessage — sent to ${cleanNumber}:`, response.data);
    }
  } catch (error) {
    console.error('[AttendanceService] sendWhatsAppMessage:', error.message);
    if (error.response) {
      console.error('[AttendanceService] sendWhatsAppMessage — response:', error.response.data);
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Write
  addAttendance,
  fixExistingPunchTypes,
  recalculatePunchTypes,
  markAsProcessed,
  // Read
  getLiveMecAttendance,
  getAttendanceStats,
  getTodayAttendance,
  getUnprocessedRecords,
  // WhatsApp
  sendWhatsAppMessage,
}; 