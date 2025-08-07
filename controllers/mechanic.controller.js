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
  getMechanicMonthlyOvertime
};