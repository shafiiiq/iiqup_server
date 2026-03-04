// controllers/mechanic.controller.js
const mechanicServices = require('../services/mechanic.service.js');

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

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Mechanic] addMechanic:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /mechanic
 * Returns all mechanic records.
 */
const getMechanic = async (req, res) => {
  try {
    const result = await mechanicServices.fetchMechanic();

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Mechanic] getMechanic:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /mechanic/:id
 * Updates a mechanic by ID.
 */
const updateMechanic = async (req, res) => {
  try {
    const { id }     = req.params;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Mechanic ID is required' });
    }

    const result = await mechanicServices.mechanicUpdate(id, updateData);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Mechanic] updateMechanic:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'Mechanic ID is required' });
    }

    const result = await mechanicServices.mechanicDelete(id);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Mechanic] deleteMechanic:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
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
    const toolkitData    = req.body;

    if (!mechanicId) {
      return res.status(400).json({ success: false, message: 'Mechanic ID is required' });
    }

    const result = await mechanicServices.addToolkit(mechanicId, toolkitData);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Mechanic] addToolkit:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
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
    const overtimeData   = req.body;

    if (!mechanicId) {
      return res.status(400).json({ success: false, message: 'Mechanic ID is required' });
    }

    const result = await mechanicServices.addOvertime(mechanicId, overtimeData);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Mechanic] addOvertime:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'Mechanic ID is required' });
    }

    const mechanic = await mechanicServices.getMechanicById(mechanicId);

    if (!mechanic) {
      return res.status(404).json({ success: false, message: 'Mechanic not found' });
    }

    if (!mechanic.monthlyOvertime || mechanic.monthlyOvertime.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No overtime data found for this mechanic',
        data:    [],
      });
    }

    if (month && year) {
      const MONTHS = [
        'January', 'February', 'March',     'April',   'May',      'June',
        'July',    'August',   'September', 'October', 'November', 'December',
      ];

      const monthYear = `${MONTHS[parseInt(month) - 1]} ${year}`;
      const monthData = mechanic.monthlyOvertime.find(mo => mo.month === monthYear);

      return res.status(200).json({
        success: true,
        message: monthData
          ? `Overtime data for ${monthYear} fetched successfully`
          : `No overtime data found for ${monthYear}`,
        data: monthData || null,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Monthly overtime data fetched successfully',
      data:    mechanic.monthlyOvertime,
    });
  } catch (error) {
    console.error('[Mechanic] getMechanicMonthlyOvertime:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'Mechanic ID is required' });
    }

    const result = await mechanicServices.cleanupOldOvertimeData(mechanicId);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Mechanic] cleanupMechanicOvertimeData:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /mechanic/overtime/cleanup-all
 * Cleans up overtime data older than 2 months for all mechanics.
 */
const cleanupAllOvertimeData = async (req, res) => {
  try {
    const result = await mechanicServices.cleanupAllOldOvertimeData();

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Mechanic] cleanupAllOvertimeData:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * POST /mechanic/overtime/migrate
 * Migrates existing overtime data to the monthly structure.
 */
const migrateOvertimeData = async (req, res) => {
  try {
    const result = await mechanicServices.migrateOvertimeDataToMonthlyStructure();

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Mechanic] migrateOvertimeData:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'zktecoPin and date are required' });
    }

    const result = await mechanicServices.fetchDailyAttendance(zktecoPin, date);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Mechanic] getDailyAttendance:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'zktecoPin, year, and week are required' });
    }

    const result = await mechanicServices.fetchWeeklyAttendance(zktecoPin, year, week);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Mechanic] getWeeklyAttendance:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'zktecoPin, year, and month are required' });
    }

    const result = await mechanicServices.fetchMonthlyAttendance(zktecoPin, year, month);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Mechanic] getMonthlyAttendance:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'zktecoPin and year are required' });
    }

    const result = await mechanicServices.fetchYearlyAttendance(zktecoPin, year);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Mechanic] getYearlyAttendance:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /mechanic/:zktecoPin/attendance/range
 * Returns attendance within a date range. Query params: startDate, endDate.
 */
const getAttendanceByDateRange = async (req, res) => {
  try {
    const { zktecoPin }        = req.params;
    const { startDate, endDate } = req.query;

    if (!zktecoPin) {
      return res.status(400).json({ success: false, message: 'zktecoPin is required' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }

    const result = await mechanicServices.fetchAttendanceByDateRange(zktecoPin, startDate, endDate);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Mechanic] getAttendanceByDateRange:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /mechanic/:zktecoPin/attendance/by-months
 * Returns attendance for specific months. Query param: months (e.g. "2025-01,2025-02").
 */
const getAttendanceByMonths = async (req, res) => {
  try {
    const { zktecoPin } = req.params;
    const { months }    = req.query;

    if (!zktecoPin) {
      return res.status(400).json({ success: false, message: 'zktecoPin is required' });
    }

    if (!months) {
      return res.status(400).json({ success: false, message: 'months query parameter is required' });
    }

    const result = await mechanicServices.fetchAttendanceByMonths(zktecoPin, months);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Mechanic] getAttendanceByMonths:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /mechanic/:zktecoPin/attendance/by-years
 * Returns attendance for specific years. Query param: years (e.g. "2025,2024").
 */
const getAttendanceByYears = async (req, res) => {
  try {
    const { zktecoPin } = req.params;
    const { years }     = req.query;

    if (!zktecoPin) {
      return res.status(400).json({ success: false, message: 'zktecoPin is required' });
    }

    if (!years) {
      return res.status(400).json({ success: false, message: 'years query parameter is required' });
    }

    const result = await mechanicServices.fetchAttendanceByYears(zktecoPin, years);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Mechanic] getAttendanceByYears:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * GET /mechanic/:zktecoPin/attendance/by-weeks
 * Returns attendance for specific weeks. Query param: weeks (e.g. "2025-1,2024-52").
 */
const getAttendanceByWeeks = async (req, res) => {
  try {
    const { zktecoPin } = req.params;
    const { weeks }     = req.query;

    if (!zktecoPin) {
      return res.status(400).json({ success: false, message: 'zktecoPin is required' });
    }

    if (!weeks) {
      return res.status(400).json({ success: false, message: 'weeks query parameter is required' });
    }

    const result = await mechanicServices.fetchAttendanceByWeeks(zktecoPin, weeks);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Mechanic] getAttendanceByWeeks:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'zktecoPin is required' });
    }

    const result = await mechanicServices.fetchAllMonthsAttendance(zktecoPin);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Mechanic] getAllMonthsAttendance:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'zktecoPin is required' });
    }

    const result = await mechanicServices.fetchAllYearsAttendance(zktecoPin);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Mechanic] getAllYearsAttendance:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'zktecoPin is required' });
    }

    const result = await mechanicServices.fetchAllAttendance(zktecoPin);

    res.status(result.status).json(result);
  } catch (error) {
    console.error('[Mechanic] getAllAttendance:', error);
    res.status(error.status || 500).json({ success: false, message: error.message });
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