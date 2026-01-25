const mechanicServices = require('../services/mechanic-service.js')

/**
 * Add a new mechanic
 */
const addMechanic = async (req, res) => {
  mechanicServices.insertMechanics(req.body)
    .then((addedUser) => {
      if (addedUser) {
        res.status(addedUser.status).json(addedUser)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

/**
 * Get all mechanics
 */
const getMechanic = async (req, res) => {
  mechanicServices.fetchMechanic()
    .then((fetchedUsers) => {
      if (fetchedUsers) {
        res.status(fetchedUsers.status).json(fetchedUsers)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get all users', error: err.message })
    })
}

/**
 * Update a mechanic by ID
 */
const updateMechanic = async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  mechanicServices.mechanicUpdate(id, updateData)
    .then((updatedUser) => {
      if (updatedUser) {
        res.status(updatedUser.status).json(updatedUser)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

/**
 * Delete a mechanic by ID
 */
const deleteMechanic = async (req, res) => {
  const { id } = req.params;

  mechanicServices.mechanicDelete(id)
    .then((response) => {
      if (response) {
        res.status(response.status).json(response)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

/**
 * Add a toolkit to a mechanic
 */
const addToolkit = async (req, res) => {
  const { mechanicId } = req.params;
  const toolkitData = req.body;

  mechanicServices.addToolkit(mechanicId, toolkitData)
    .then((response) => {
      if (response) {
        res.status(response.status).json(response)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

/**
 * Add overtime record to a mechanic
 */
const addOvertime = async (req, res) => {
  const { mechanicId } = req.params;
  const overtimeData = req.body;

  mechanicServices.addOvertime(mechanicId, overtimeData)
    .then((response) => {
      if (response) {
        res.status(response.status).json(response)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

/**
 * Clean up overtime data older than 2 months for a specific mechanic
 */
const cleanupMechanicOvertimeData = async (req, res) => {
  const { mechanicId } = req.params;

  mechanicServices.cleanupOldOvertimeData(mechanicId)
    .then((response) => {
      if (response) {
        res.status(response.status).json(response)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

/**
 * Clean up overtime data older than 2 months for all mechanics
 */
const cleanupAllOvertimeData = async (req, res) => {
  mechanicServices.cleanupAllOldOvertimeData()
    .then((response) => {
      if (response) {
        res.status(response.status).json(response)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

/**
 * Migrate existing overtime data to monthly structure
 */
const migrateOvertimeData = async (req, res) => {
  mechanicServices.migrateOvertimeDataToMonthlyStructure()
    .then((response) => {
      if (response) {
        res.status(response.status).json(response)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

/**
 * Get monthly overtime data for a mechanic
 */
const getMechanicMonthlyOvertime = async (req, res) => {
  const { mechanicId, month, year } = req.params;

  try {
    const mechanic = await mechanicServices.getMechanicById(mechanicId);

    if (!mechanic) {
      return res.status(404).json({
        status: 404,
        message: 'Mechanic not found'
      });
    }

    if (!mechanic.monthlyOvertime || mechanic.monthlyOvertime.length === 0) {
      return res.status(200).json({
        status: 200,
        message: 'No overtime data found for this mechanic',
        data: []
      });
    }

    // If month and year are provided, filter for specific month
    if (month && year) {
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      const monthName = months[parseInt(month) - 1];
      const monthYear = `${monthName} ${year}`;

      const monthData = mechanic.monthlyOvertime.find(mo => mo.month === monthYear);

      if (!monthData) {
        return res.status(200).json({
          status: 200,
          message: `No overtime data found for ${monthYear}`,
          data: null
        });
      }

      return res.status(200).json({
        status: 200,
        message: `Overtime data for ${monthYear} fetched successfully`,
        data: monthData
      });
    }

    // If no month/year specified, return all monthly data
    return res.status(200).json({
      status: 200,
      message: 'Monthly overtime data fetched successfully',
      data: mechanic.monthlyOvertime
    });

  } catch (error) {
    return res.status(error.status || 500).json({
      status: error.status || 500,
      message: error.message || 'Error fetching monthly overtime data'
    });
  }
}

/**
 * Get daily attendance for a mechanic
 */
const getDailyAttendance = async (req, res) => {
  const { zktecoPin, date } = req.params;

  mechanicServices.fetchDailyAttendance(zktecoPin, date)
    .then((response) => {
      if (response) {
        res.status(response.status).json(response)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

/**
 * Get weekly attendance for a mechanic
 */
const getWeeklyAttendance = async (req, res) => {
  const { zktecoPin, year, week } = req.params;

  mechanicServices.fetchWeeklyAttendance(zktecoPin, year, week)
    .then((response) => {
      if (response) {
        res.status(response.status).json(response)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

/**
 * Get monthly attendance for a mechanic
 */
const getMonthlyAttendance = async (req, res) => {
  const { zktecoPin, year, month } = req.params;

  mechanicServices.fetchMonthlyAttendance(zktecoPin, year, month)
    .then((response) => {
      if (response) {
        res.status(response.status).json(response)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

/**
 * Get yearly attendance for a mechanic
 */
const getYearlyAttendance = async (req, res) => {
  const { zktecoPin, year } = req.params;

  mechanicServices.fetchYearlyAttendance(zktecoPin, year)
    .then((response) => {
      if (response) {
        res.status(response.status).json(response)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

/**
 * Get attendance by date range
 */
const getAttendanceByDateRange = async (req, res) => {
  const { zktecoPin } = req.params;
  const { startDate, endDate } = req.query;

  mechanicServices.fetchAttendanceByDateRange(zktecoPin, startDate, endDate)
    .then((response) => {
      if (response) {
        res.status(response.status).json(response)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

/**
 * Get attendance by specific months
 */
const getAttendanceByMonths = async (req, res) => {
  const { zktecoPin } = req.params;
  const { months } = req.query; // Expected format: "2025-01,2025-02,2024-12"

  mechanicServices.fetchAttendanceByMonths(zktecoPin, months)
    .then((response) => {
      if (response) {
        res.status(response.status).json(response)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

/**
 * Get attendance by specific years
 */
const getAttendanceByYears = async (req, res) => {
  const { zktecoPin } = req.params;
  const { years } = req.query; // Expected format: "2025,2024,2023"

  mechanicServices.fetchAttendanceByYears(zktecoPin, years)
    .then((response) => {
      if (response) {
        res.status(response.status).json(response)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

/**
 * Get attendance by specific weeks
 */
const getAttendanceByWeeks = async (req, res) => {
  const { zktecoPin } = req.params;
  const { weeks } = req.query; // Expected format: "2025-1,2025-2,2024-52"

  mechanicServices.fetchAttendanceByWeeks(zktecoPin, weeks)
    .then((response) => {
      if (response) {
        res.status(response.status).json(response)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

/**
 * Get all months attendance
 */
const getAllMonthsAttendance = async (req, res) => {
  const { zktecoPin } = req.params;

  mechanicServices.fetchAllMonthsAttendance(zktecoPin)
    .then((response) => {
      if (response) {
        res.status(response.status).json(response)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

/**
 * Get all years attendance
 */
const getAllYearsAttendance = async (req, res) => {
  const { zktecoPin } = req.params;

  mechanicServices.fetchAllYearsAttendance(zktecoPin)
    .then((response) => {
      if (response) {
        res.status(response.status).json(response)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

/**
 * Get all attendance records
 */
const getAllAttendance = async (req, res) => {
  const { zktecoPin } = req.params;

  mechanicServices.fetchAllAttendance(zktecoPin)
    .then((response) => {
      if (response) {
        res.status(response.status).json(response)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

module.exports = {
  addMechanic,
  getMechanic,
  updateMechanic,
  deleteMechanic,
  addToolkit,
  addOvertime,
  cleanupMechanicOvertimeData,
  cleanupAllOvertimeData,
  migrateOvertimeData,
  getMechanicMonthlyOvertime,
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
  getAllAttendance
};