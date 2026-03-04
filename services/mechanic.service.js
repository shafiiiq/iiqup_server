const Mechanic   = require('../models/mechanic.model');
const Attendance = require('../models/attendance.model');
const {
  getMonthYearString,
  getFormattedDateString,
  isOlderThanCutoff,
  getCutoffMonthYear,
  formatValidationError,
  buildAttendanceResponse
} = require('../helpers/mechanic.helper');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Finds a mechanic by ZKTeco PIN or throws a 404.
 * @param {string} zktecoPin
 * @returns {Promise<object>}
 */
const findMechanicByPin = async (zktecoPin) => {
  const mechanic = await Mechanic.findOne({ zktecoPin: parseInt(zktecoPin) });
  if (!mechanic) throw { status: 404, message: 'Mechanic not found' };
  return mechanic;
};

// ─────────────────────────────────────────────────────────────────────────────
// Mechanic CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inserts a new mechanic with an auto-incremented userId.
 * @param {object} mechanicData
 * @returns {Promise<object>}
 */
const insertMechanics = async (mechanicData) => {
  try {
    const highest    = await Mechanic.findOne().sort({ userId: -1 }).limit(1);
    const nextUserId = highest ? highest.userId + 1 : 1;

    const savedMechanic = await new Mechanic({ ...mechanicData, userId: nextUserId }).save();

    return { status: 201, message: 'Mechanic added successfully', data: savedMechanic };
  } catch (error) {
    console.error('[MechanicService] insertMechanics:', error);
    if (error.name === 'ValidationError') throw { status: 400, message: formatValidationError(error) };
    throw { status: 500, message: error.message || 'Error adding mechanic' };
  }
};

/**
 * Fetches all mechanic records.
 * @returns {Promise<object>}
 */
const fetchMechanic = async () => {
  try {
    const mechanics = await Mechanic.find();
    return { status: 200, message: 'Mechanics fetched successfully', count: mechanics.length, data: mechanics };
  } catch (error) {
    console.error('[MechanicService] fetchMechanic:', error);
    throw { status: 500, message: error.message || 'Error fetching mechanics' };
  }
};

/**
 * Returns a single mechanic by MongoDB ID.
 * @param {string} id
 * @returns {Promise<object>}
 */
const getMechanicById = async (id) => {
  try {
    return await Mechanic.findById(id);
  } catch (error) {
    console.error('[MechanicService] getMechanicById:', error);
    throw { status: 500, message: error.message || 'Error fetching mechanic' };
  }
};

/**
 * Updates a mechanic by ID. Prevents userId from being modified.
 * @param {string} id
 * @param {object} updateData
 * @returns {Promise<object>}
 */
const mechanicUpdate = async (id, updateData) => {
  try {
    delete updateData.userId;

    const updated = await Mechanic.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true });
    if (!updated) throw { status: 404, message: 'Mechanic not found' };

    return { status: 200, message: 'Mechanic updated successfully', data: updated };
  } catch (error) {
    console.error('[MechanicService] mechanicUpdate:', error);
    if (error.name === 'ValidationError') throw { status: 400, message: formatValidationError(error) };
    if (error.status) throw error;
    throw { status: 500, message: error.message || 'Error updating mechanic' };
  }
};

/**
 * Deletes a mechanic by ID.
 * @param {string} id
 * @returns {Promise<object>}
 */
const mechanicDelete = async (id) => {
  try {
    const deleted = await Mechanic.findByIdAndDelete(id);
    if (!deleted) throw { status: 404, message: 'Mechanic not found' };

    return { status: 200, message: 'Mechanic deleted successfully' };
  } catch (error) {
    console.error('[MechanicService] mechanicDelete:', error);
    if (error.status) throw error;
    throw { status: 500, message: error.message || 'Error deleting mechanic' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Toolkit
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adds a toolkit entry to a mechanic's toolkits array.
 * @param {string} mechanicId
 * @param {object} toolkitData
 * @returns {Promise<object>}
 */
const addToolkit = async (mechanicId, toolkitData) => {
  try {
    const mechanic = await Mechanic.findById(mechanicId);
    if (!mechanic) throw { status: 404, message: 'Mechanic not found' };

    mechanic.toolkits.push(toolkitData);
    const updated = await mechanic.save();

    return { status: 201, message: 'Toolkit added successfully', data: updated };
  } catch (error) {
    console.error('[MechanicService] addToolkit:', error);
    if (error.name === 'ValidationError') throw { status: 400, message: formatValidationError(error) };
    if (error.status) throw error;
    throw { status: 500, message: error.message || 'Error adding toolkit' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Overtime
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adds or merges an overtime entry into the mechanic's monthly overtime structure.
 * @param {string} mechanicId
 * @param {object} overtimeData
 * @returns {Promise<object>}
 */
const addOvertime = async (mechanicId, overtimeData) => {
  try {
    const mechanic = await Mechanic.findById(mechanicId);
    if (!mechanic) throw { status: 404, message: 'Mechanic not found' };

    const dateToAdd = new Date(overtimeData.date);
    dateToAdd.setHours(0, 0, 0, 0);
    overtimeData.date = dateToAdd;

    const monthYear     = getMonthYearString(dateToAdd);
    const formattedDate = getFormattedDateString(dateToAdd);

    const overtimeEntry = {
      date:          dateToAdd,
      formattedDate,
      regNo:         overtimeData.regNo       || [],
      times:         overtimeData.times       || [],
      workDetails:   overtimeData.workDetails || [],
      totalTime:     0,
      formattedTime: ''
    };

    if (!mechanic.monthlyOvertime) mechanic.monthlyOvertime = [];

    let monthIndex = mechanic.monthlyOvertime.findIndex(mo => mo.month === monthYear);

    if (monthIndex === -1) {
      mechanic.monthlyOvertime.push({
        month:              monthYear,
        entries:            [overtimeEntry],
        totalMonthTime:     0,
        formattedMonthTime: '0h 0m'
      });
      monthIndex = mechanic.monthlyOvertime.length - 1;
    } else {
      const entryIndex = mechanic.monthlyOvertime[monthIndex].entries.findIndex(e => {
        const entryDate = new Date(e.date);
        entryDate.setHours(0, 0, 0, 0);
        return entryDate.getTime() === dateToAdd.getTime();
      });

      if (entryIndex !== -1) {
        const existing = mechanic.monthlyOvertime[monthIndex].entries[entryIndex];
        const path     = `monthlyOvertime.${monthIndex}.entries.${entryIndex}`;

        if (overtimeData.regNo?.length > 0) {
          overtimeData.regNo.forEach(r => { if (!existing.regNo.includes(r)) existing.regNo.push(r); });
          mechanic.markModified(`${path}.regNo`);
        }

        if (overtimeData.times?.length > 0) {
          existing.times.push(...overtimeData.times);
          mechanic.markModified(`${path}.times`);
        }

        if (overtimeData.workDetails?.length > 0) {
          existing.workDetails.push(...overtimeData.workDetails);
          mechanic.markModified(`${path}.workDetails`);
        }
      } else {
        mechanic.monthlyOvertime[monthIndex].entries.push(overtimeEntry);
      }
    }

    const updated      = await mechanic.save();
    const addedMonthly = updated.monthlyOvertime[monthIndex];

    cleanupOldOvertimeData(mechanicId);

    return { status: 201, message: 'Overtime record added successfully', data: addedMonthly };
  } catch (error) {
    console.error('[MechanicService] addOvertime:', error);
    if (error.name === 'ValidationError') throw { status: 400, message: formatValidationError(error) };
    if (error.status) throw error;
    throw { status: 500, message: error.message || 'Error adding overtime' };
  }
};

/**
 * Removes overtime entries older than 2 months for a single mechanic.
 * Runs as a background task — does not throw.
 * @param {string} mechanicId
 * @returns {Promise<object>}
 */
const cleanupOldOvertimeData = async (mechanicId) => {
  try {
    const cutoff   = getCutoffMonthYear();
    const mechanic = await Mechanic.findById(mechanicId);
    if (!mechanic) return { status: 404, message: 'Mechanic not found' };

    if (!mechanic.monthlyOvertime?.length) return { status: 200, message: 'Nothing to clean up' };

    const monthsToRemove = mechanic.monthlyOvertime
      .map(mo => mo.month)
      .filter(month => isOlderThanCutoff(month, cutoff));

    if (monthsToRemove.length > 0) {
      await Mechanic.updateOne(
        { _id: mechanicId },
        { $pull: { monthlyOvertime: { month: { $in: monthsToRemove } } } }
      );
    }

    return { status: 200, message: 'Old overtime data cleaned up', data: { mechanicId } };
  } catch (error) {
    console.error('[MechanicService] cleanupOldOvertimeData:', error);
    return { status: 500, message: 'Error cleaning up old overtime data', error: error.message };
  }
};

/**
 * Removes overtime entries older than 2 months across all mechanics.
 * @returns {Promise<object>}
 */
const cleanupAllOldOvertimeData = async () => {
  try {
    const cutoff              = getCutoffMonthYear();
    const mechanics           = await Mechanic.find({});
    let   totalCleanedRecords = 0;

    for (const mechanic of mechanics) {
      if (!mechanic.monthlyOvertime?.length) continue;

      const monthsToRemove = mechanic.monthlyOvertime
        .map(mo => mo.month)
        .filter(month => isOlderThanCutoff(month, cutoff));

      if (monthsToRemove.length > 0) {
        await Mechanic.updateOne(
          { _id: mechanic._id },
          { $pull: { monthlyOvertime: { month: { $in: monthsToRemove } } } }
        );
        totalCleanedRecords += monthsToRemove.length;
      }
    }

    return {
      status:  200,
      message: 'Old overtime data cleaned up for all mechanics',
      data:    { monthlyRecordsRemoved: totalCleanedRecords }
    };
  } catch (error) {
    console.error('[MechanicService] cleanupAllOldOvertimeData:', error);
    throw { status: 500, message: error.message || 'Error cleaning up old overtime data' };
  }
};

/**
 * No-op stub kept for backward compatibility.
 * @returns {object}
 */
const migrateOvertimeDataToMonthlyStructure = () => ({
  status:  200,
  message: 'No migration needed - system is already using monthly structure',
  data:    {}
});

// ─────────────────────────────────────────────────────────────────────────────
// Attendance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches attendance records for a mechanic on a specific date.
 * @param {string} zktecoPin
 * @param {string} date  YYYY-MM-DD
 * @returns {Promise<object>}
 */
const fetchDailyAttendance = async (zktecoPin, date) => {
  try {
    const mechanic   = await findMechanicByPin(zktecoPin);
    const attendance = await Attendance.find({ pin: zktecoPin, dateOnly: date }).sort({ punchDateTime: 1 });

    return buildAttendanceResponse(mechanic, attendance, { date });
  } catch (error) {
    console.error('[MechanicService] fetchDailyAttendance:', error);
    if (error.status) throw error;
    throw { status: 500, message: error.message || 'Error fetching daily attendance' };
  }
};

/**
 * Fetches attendance records for a mechanic in a specific week.
 * @param {string} zktecoPin
 * @param {string} year
 * @param {string} week
 * @returns {Promise<object>}
 */
const fetchWeeklyAttendance = async (zktecoPin, year, week) => {
  try {
    const mechanic   = await findMechanicByPin(zktecoPin);
    const attendance = await Attendance
      .find({ pin: zktecoPin, year: parseInt(year), weekNumber: parseInt(week) })
      .sort({ punchDateTime: 1 });

    return buildAttendanceResponse(mechanic, attendance, { year, week });
  } catch (error) {
    console.error('[MechanicService] fetchWeeklyAttendance:', error);
    if (error.status) throw error;
    throw { status: 500, message: error.message || 'Error fetching weekly attendance' };
  }
};

/**
 * Fetches attendance records for a mechanic in a specific month.
 * @param {string} zktecoPin
 * @param {string} year
 * @param {string} month  01–12
 * @returns {Promise<object>}
 */
const fetchMonthlyAttendance = async (zktecoPin, year, month) => {
  try {
    const mechanic   = await findMechanicByPin(zktecoPin);
    const monthYear  = `${year}-${month.padStart(2, '0')}`;
    const attendance = await Attendance.find({ pin: zktecoPin, monthYear }).sort({ punchDateTime: 1 });

    return buildAttendanceResponse(mechanic, attendance, { year, month });
  } catch (error) {
    console.error('[MechanicService] fetchMonthlyAttendance:', error);
    if (error.status) throw error;
    throw { status: 500, message: error.message || 'Error fetching monthly attendance' };
  }
};

/**
 * Fetches all attendance records for a mechanic in a given year.
 * @param {string} zktecoPin
 * @param {string} year
 * @returns {Promise<object>}
 */
const fetchYearlyAttendance = async (zktecoPin, year) => {
  try {
    const mechanic   = await findMechanicByPin(zktecoPin);
    const attendance = await Attendance.find({ pin: zktecoPin, year: parseInt(year) }).sort({ punchDateTime: 1 });

    return buildAttendanceResponse(mechanic, attendance, { year });
  } catch (error) {
    console.error('[MechanicService] fetchYearlyAttendance:', error);
    if (error.status) throw error;
    throw { status: 500, message: error.message || 'Error fetching yearly attendance' };
  }
};

/**
 * Fetches attendance records for a mechanic within a date range.
 * @param {string} zktecoPin
 * @param {string} startDate  YYYY-MM-DD
 * @param {string} endDate    YYYY-MM-DD
 * @returns {Promise<object>}
 */
const fetchAttendanceByDateRange = async (zktecoPin, startDate, endDate) => {
  try {
    if (!startDate || !endDate) throw { status: 400, message: 'Both startDate and endDate are required' };

    const mechanic   = await findMechanicByPin(zktecoPin);
    const attendance = await Attendance
      .find({ pin: zktecoPin, dateOnly: { $gte: startDate, $lte: endDate } })
      .sort({ punchDateTime: 1 });

    return buildAttendanceResponse(mechanic, attendance, { startDate, endDate });
  } catch (error) {
    console.error('[MechanicService] fetchAttendanceByDateRange:', error);
    if (error.status) throw error;
    throw { status: 500, message: error.message || 'Error fetching attendance by date range' };
  }
};

/**
 * Fetches attendance records for a mechanic across multiple months.
 * @param {string} zktecoPin
 * @param {string} months  Comma-separated YYYY-MM values.
 * @returns {Promise<object>}
 */
const fetchAttendanceByMonths = async (zktecoPin, months) => {
  try {
    if (!months) throw { status: 400, message: 'Months parameter is required (format: YYYY-MM,YYYY-MM)' };

    const mechanic    = await findMechanicByPin(zktecoPin);
    const monthsArray = months.split(',').map(m => m.trim());
    const attendance  = await Attendance.find({ pin: zktecoPin, monthYear: { $in: monthsArray } }).sort({ punchDateTime: 1 });

    return buildAttendanceResponse(mechanic, attendance, { months: monthsArray });
  } catch (error) {
    console.error('[MechanicService] fetchAttendanceByMonths:', error);
    if (error.status) throw error;
    throw { status: 500, message: error.message || 'Error fetching attendance by months' };
  }
};

/**
 * Fetches attendance records for a mechanic across multiple years.
 * @param {string} zktecoPin
 * @param {string} years  Comma-separated year values.
 * @returns {Promise<object>}
 */
const fetchAttendanceByYears = async (zktecoPin, years) => {
  try {
    if (!years) throw { status: 400, message: 'Years parameter is required (format: 2025,2024,2023)' };

    const mechanic   = await findMechanicByPin(zktecoPin);
    const yearsArray = years.split(',').map(y => parseInt(y.trim()));
    const attendance = await Attendance.find({ pin: zktecoPin, year: { $in: yearsArray } }).sort({ punchDateTime: 1 });

    return buildAttendanceResponse(mechanic, attendance, { years: yearsArray });
  } catch (error) {
    console.error('[MechanicService] fetchAttendanceByYears:', error);
    if (error.status) throw error;
    throw { status: 500, message: error.message || 'Error fetching attendance by years' };
  }
};

/**
 * Fetches attendance records for a mechanic across multiple weeks.
 * @param {string} zktecoPin
 * @param {string} weeks  Comma-separated YYYY-WW values.
 * @returns {Promise<object>}
 */
const fetchAttendanceByWeeks = async (zktecoPin, weeks) => {
  try {
    if (!weeks) throw { status: 400, message: 'Weeks parameter is required (format: 2025-1,2025-2)' };

    const mechanic   = await findMechanicByPin(zktecoPin);
    const weeksArray = weeks.split(',').map(w => w.trim());

    const queries = weeksArray.map(weekStr => {
      const [year, week] = weekStr.split('-');
      return { pin: zktecoPin, year: parseInt(year), weekNumber: parseInt(week) };
    });

    const attendance = await Attendance.find({ $or: queries }).sort({ punchDateTime: 1 });

    return buildAttendanceResponse(mechanic, attendance, { weeks: weeksArray });
  } catch (error) {
    console.error('[MechanicService] fetchAttendanceByWeeks:', error);
    if (error.status) throw error;
    throw { status: 500, message: error.message || 'Error fetching attendance by weeks' };
  }
};

/**
 * Fetches all attendance records grouped by month for a mechanic.
 * @param {string} zktecoPin
 * @returns {Promise<object>}
 */
const fetchAllMonthsAttendance = async (zktecoPin) => {
  try {
    const mechanic   = await findMechanicByPin(zktecoPin);
    const attendance = await Attendance.aggregate([
      { $match: { pin: zktecoPin } },
      { $sort:  { punchDateTime: 1 } },
      { $group: { _id: '$monthYear', records: { $push: '$$ROOT' }, count: { $sum: 1 } } },
      { $sort:  { _id: -1 } }
    ]);

    return {
      status: 200,
      data: {
        mechanic:    { name: mechanic.name, zktecoPin: mechanic.zktecoPin },
        months:      attendance,
        totalMonths: attendance.length
      }
    };
  } catch (error) {
    console.error('[MechanicService] fetchAllMonthsAttendance:', error);
    if (error.status) throw error;
    throw { status: 500, message: error.message || 'Error fetching all months attendance' };
  }
};

/**
 * Fetches all attendance records grouped by year for a mechanic.
 * @param {string} zktecoPin
 * @returns {Promise<object>}
 */
const fetchAllYearsAttendance = async (zktecoPin) => {
  try {
    const mechanic   = await findMechanicByPin(zktecoPin);
    const attendance = await Attendance.aggregate([
      { $match: { pin: zktecoPin } },
      { $sort:  { punchDateTime: 1 } },
      { $group: { _id: '$year', records: { $push: '$$ROOT' }, count: { $sum: 1 } } },
      { $sort:  { _id: -1 } }
    ]);

    return {
      status: 200,
      data: {
        mechanic:   { name: mechanic.name, zktecoPin: mechanic.zktecoPin },
        years:      attendance,
        totalYears: attendance.length
      }
    };
  } catch (error) {
    console.error('[MechanicService] fetchAllYearsAttendance:', error);
    if (error.status) throw error;
    throw { status: 500, message: error.message || 'Error fetching all years attendance' };
  }
};

/**
 * Fetches all attendance records for a mechanic sorted by most recent.
 * @param {string} zktecoPin
 * @returns {Promise<object>}
 */
const fetchAllAttendance = async (zktecoPin) => {
  try {
    const mechanic   = await findMechanicByPin(zktecoPin);
    const attendance = await Attendance.find({ pin: zktecoPin }).sort({ punchDateTime: -1 });

    return buildAttendanceResponse(mechanic, attendance);
  } catch (error) {
    console.error('[MechanicService] fetchAllAttendance:', error);
    if (error.status) throw error;
    throw { status: 500, message: error.message || 'Error fetching all attendance' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  insertMechanics,
  fetchMechanic,
  getMechanicById,
  mechanicUpdate,
  mechanicDelete,
  addToolkit,
  addOvertime,
  cleanupOldOvertimeData,
  cleanupAllOldOvertimeData,
  migrateOvertimeDataToMonthlyStructure,
  fetchDailyAttendance,
  fetchWeeklyAttendance,
  fetchMonthlyAttendance,
  fetchYearlyAttendance,
  fetchAttendanceByDateRange,
  fetchAttendanceByMonths,
  fetchAttendanceByYears,
  fetchAttendanceByWeeks,
  fetchAllMonthsAttendance,
  fetchAllYearsAttendance,
  fetchAllAttendance
};