const logger = require('../../shared/logger/logger');

const HTTP = require('../../shared/constants/httpStatus.constant.js');
const { sendSuccess, sendError } = require('../../shared/response/response.util');
// controllers/mechanic.controller.js
const mechanicServices = require('./mechanic.service');

// ─────────────────────────────────────────────────────────────────────────────
// Mechanic CRUD Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /mechanic
 * Adds a new mechanic record.
 */
const addMechanic = async (req, res) => {
  try {
    const result = await mechanicServices.insertMechanics(req.body);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] addMechanic:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * GET /mechanic
 * Returns all mechanic records.
 */
const getMechanic = async (req, res) => {
  try {
    const result = await mechanicServices.fetchMechanic();

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] getMechanic:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * PUT /mechanic/:id
 * Updates a mechanic by ID.
 */
const updateMechanic = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Mechanic ID is required' });
    }

    const result = await mechanicServices.mechanicUpdate(id, updateData);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] updateMechanic:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * DELETE /mechanic/:id
 * Deletes a mechanic by ID.
 */
const deleteMechanic = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Mechanic ID is required' });
    }

    const result = await mechanicServices.mechanicDelete(id);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] deleteMechanic:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Toolkit Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /mechanic/:mechanicId/toolkit
 * Adds a toolkit entry to a mechanic.
 */
const addToolkit = async (req, res) => {
  try {
    const { mechanicId } = req.params;
    const toolkitData = req.body;

    if (!mechanicId) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Mechanic ID is required' });
    }

    const result = await mechanicServices.addToolkit(mechanicId, toolkitData);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] addToolkit:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Overtime Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /mechanic/:mechanicId/overtime
 * Adds an overtime record to a mechanic.
 */
const addOvertime = async (req, res) => {
  try {
    const { mechanicId } = req.params;
    const overtimeData = req.body;

    if (!mechanicId) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Mechanic ID is required' });
    }

    const result = await mechanicServices.addOvertime(mechanicId, overtimeData);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] addOvertime:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * GET /mechanic/:mechanicId/overtime/monthly/:month/:year
 * Returns monthly overtime data for a mechanic, optionally filtered by month and year.
 */
const getMechanicMonthlyOvertime = async (req, res) => {
  try {
    const { mechanicId, month, year } = req.params;

    if (!mechanicId) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Mechanic ID is required' });
    }

    const mechanic = await mechanicServices.getMechanicById(mechanicId);

    if (!mechanic) {
      return res
        .status(HTTP.NOT_FOUND)
        .json({ success: false, message: 'Mechanic not found' });
    }

    if (!mechanic.monthlyOvertime || mechanic.monthlyOvertime.length === 0) {
      return sendSuccess(res, {
        success: true,
        message: 'No overtime data found for this mechanic',
        data: [],
      });
    }

    if (month && year) {
      const MONTHS = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];

      const monthYear = `${MONTHS[parseInt(month) - 1]} ${year}`;
      const monthData = mechanic.monthlyOvertime.find(
        (mo) => mo.month === monthYear
      );

      return sendSuccess(res, {
        success: true,
        message: monthData
          ? `Overtime data for ${monthYear} fetched successfully`
          : `No overtime data found for ${monthYear}`,
        data: monthData || null,
      });
    }

    sendSuccess(res, {
      success: true,
      message: 'Monthly overtime data fetched successfully',
      data: mechanic.monthlyOvertime,
    });
  } catch (error) {
    logger.error('[Mechanic] getMechanicMonthlyOvertime:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * DELETE /mechanic/:mechanicId/overtime/cleanup
 * Cleans up overtime data older than 2 months for a specific mechanic.
 */
const cleanupMechanicOvertimeData = async (req, res) => {
  try {
    const { mechanicId } = req.params;

    if (!mechanicId) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Mechanic ID is required' });
    }

    const result = await mechanicServices.cleanupOldOvertimeData(mechanicId);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] cleanupMechanicOvertimeData:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * DELETE /mechanic/overtime/cleanup-all
 * Cleans up overtime data older than 2 months for all mechanics.
 */
const cleanupAllOvertimeData = async (req, res) => {
  try {
    const result = await mechanicServices.cleanupAllOldOvertimeData();

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] cleanupAllOvertimeData:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * POST /mechanic/overtime/migrate
 * Migrates existing overtime data to the monthly structure.
 */
const migrateOvertimeData = async (req, res) => {
  try {
    const result =
      await mechanicServices.migrateOvertimeDataToMonthlyStructure();

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] migrateOvertimeData:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Attendance Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /mechanic/:zktecoPin/attendance/daily/:date
 * Returns daily attendance for a mechanic.
 */
const getDailyAttendance = async (req, res) => {
  try {
    const { zktecoPin, date } = req.params;

    if (!zktecoPin || !date) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'zktecoPin and date are required' });
    }

    const result = await mechanicServices.fetchDailyAttendance(zktecoPin, date);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] getDailyAttendance:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * GET /mechanic/:zktecoPin/attendance/weekly/:year/:week
 * Returns weekly attendance for a mechanic.
 */
const getWeeklyAttendance = async (req, res) => {
  try {
    const { zktecoPin, year, week } = req.params;

    if (!zktecoPin || !year || !week) {
      return sendError(res, {
        success: false,
        message: 'zktecoPin, year, and week are required',
      });
    }

    const result = await mechanicServices.fetchWeeklyAttendance(
      zktecoPin,
      year,
      week
    );

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] getWeeklyAttendance:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * GET /mechanic/:zktecoPin/attendance/monthly/:year/:month
 * Returns monthly attendance for a mechanic.
 */
const getMonthlyAttendance = async (req, res) => {
  try {
    const { zktecoPin, year, month } = req.params;

    if (!zktecoPin || !year || !month) {
      return sendError(res, {
        success: false,
        message: 'zktecoPin, year, and month are required',
      });
    }

    const result = await mechanicServices.fetchMonthlyAttendance(
      zktecoPin,
      year,
      month
    );

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] getMonthlyAttendance:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * GET /mechanic/:zktecoPin/attendance/yearly/:year
 * Returns yearly attendance for a mechanic.
 */
const getYearlyAttendance = async (req, res) => {
  try {
    const { zktecoPin, year } = req.params;

    if (!zktecoPin || !year) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'zktecoPin and year are required' });
    }

    const result = await mechanicServices.fetchYearlyAttendance(
      zktecoPin,
      year
    );

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] getYearlyAttendance:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * GET /mechanic/:zktecoPin/attendance/range
 * Returns attendance within a date range. Query params: startDate, endDate.
 */
const getAttendanceByDateRange = async (req, res) => {
  try {
    const { zktecoPin } = req.params;
    const { startDate, endDate } = req.query;

    if (!zktecoPin) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'zktecoPin is required' });
    }

    if (!startDate || !endDate) {
      return sendError(res, {
        success: false,
        message: 'startDate and endDate are required',
      });
    }

    const result = await mechanicServices.fetchAttendanceByDateRange(
      zktecoPin,
      startDate,
      endDate
    );

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] getAttendanceByDateRange:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * GET /mechanic/:zktecoPin/attendance/by-months
 * Returns attendance for specific months. Query param: months (e.g. "2025-01,2025-02").
 */
const getAttendanceByMonths = async (req, res) => {
  try {
    const { zktecoPin } = req.params;
    const { months } = req.query;

    if (!zktecoPin) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'zktecoPin is required' });
    }

    if (!months) {
      return sendError(res, {
        success: false,
        message: 'months query parameter is required',
      });
    }

    const result = await mechanicServices.fetchAttendanceByMonths(
      zktecoPin,
      months
    );

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] getAttendanceByMonths:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * GET /mechanic/:zktecoPin/attendance/by-years
 * Returns attendance for specific years. Query param: years (e.g. "2025,2024").
 */
const getAttendanceByYears = async (req, res) => {
  try {
    const { zktecoPin } = req.params;
    const { years } = req.query;

    if (!zktecoPin) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'zktecoPin is required' });
    }

    if (!years) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'years query parameter is required' });
    }

    const result = await mechanicServices.fetchAttendanceByYears(
      zktecoPin,
      years
    );

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] getAttendanceByYears:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * GET /mechanic/:zktecoPin/attendance/by-weeks
 * Returns attendance for specific weeks. Query param: weeks (e.g. "2025-1,2024-52").
 */
const getAttendanceByWeeks = async (req, res) => {
  try {
    const { zktecoPin } = req.params;
    const { weeks } = req.query;

    if (!zktecoPin) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'zktecoPin is required' });
    }

    if (!weeks) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'weeks query parameter is required' });
    }

    const result = await mechanicServices.fetchAttendanceByWeeks(
      zktecoPin,
      weeks
    );

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] getAttendanceByWeeks:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * GET /mechanic/:zktecoPin/attendance/all-months
 * Returns attendance grouped by all months for a mechanic.
 */
const getAllMonthsAttendance = async (req, res) => {
  try {
    const { zktecoPin } = req.params;

    if (!zktecoPin) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'zktecoPin is required' });
    }

    const result = await mechanicServices.fetchAllMonthsAttendance(zktecoPin);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] getAllMonthsAttendance:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * GET /mechanic/:zktecoPin/attendance/all-years
 * Returns attendance grouped by all years for a mechanic.
 */
const getAllYearsAttendance = async (req, res) => {
  try {
    const { zktecoPin } = req.params;

    if (!zktecoPin) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'zktecoPin is required' });
    }

    const result = await mechanicServices.fetchAllYearsAttendance(zktecoPin);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] getAllYearsAttendance:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

/**
 * GET /mechanic/:zktecoPin/attendance
 * Returns all attendance records for a mechanic.
 */
const getAllAttendance = async (req, res) => {
  try {
    const { zktecoPin } = req.params;

    if (!zktecoPin) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'zktecoPin is required' });
    }

    const result = await mechanicServices.fetchAllAttendance(zktecoPin);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] getAllAttendance:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // CRUD
  addMechanic,
  getMechanic,
  updateMechanic,
  deleteMechanic,
  // Toolkit
  addToolkit,
  // Overtime
  addOvertime,
  getMechanicMonthlyOvertime,
  cleanupMechanicOvertimeData,
  cleanupAllOvertimeData,
  migrateOvertimeData,
  // Attendance
  getDailyAttendance,
  getWeeklyAttendance,
  getMonthlyAttendance,
  getYearlyAttendance,
  getAttendanceByDateRange,
  getAttendanceByMonths,
  getAttendanceByYears,
  getAttendanceByWeeks,
  getAllMonthsAttendance,
  getAllYearsAttendance,
  getAllAttendance,
};
