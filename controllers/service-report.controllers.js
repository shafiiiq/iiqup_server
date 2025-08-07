const reportServices = require('../services/service-report.js')

const addServiceReport = async (req, res) => {
  reportServices.insertServiceReport(req.body)
    .then((addedUser) => {
      if (addedUser) {
        res.status(addedUser.status).json(addedUser)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

const getServiceReport = async (req, res) => {
  const paramRegNO = req.params.regNo;
  const paramDate = req.params.date;
  reportServices.fetchServiceReport(paramRegNO, paramDate)
    .then((fetchedUsers) => {
      if (fetchedUsers) {
        res.status(fetchedUsers.status).json(fetchedUsers)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get service report', error: err.message })
    })
}

const getServiceReportWithId = async (req, res) => {
  
  const id = req.params.id;
  reportServices.fetchServiceReportWith(id)
    .then((fetchedUsers) => {
      if (fetchedUsers) {
        res.status(fetchedUsers.status).json(fetchedUsers)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get service report', error: err.message })
    })
}

const updateServiceReportWithId = async (req, res) => {
  const id = req.params.id;
  reportServices.updateServiceReportWith(id, req.body)
    .then((fetchedUsers) => {
      if (fetchedUsers) {
        console.log(fetchedUsers);
        
        res.status(fetchedUsers.status).json(fetchedUsers)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot update service report', error: err.message })
    })
}

const removeServiceReportWithId = async (req, res) => {
  const id = req.params.id;
  reportServices.deleteServiceReportWith(id)
    .then((fetchedUsers) => {
      if (fetchedUsers) {
        res.status(200).json(fetchedUsers)  // Change this line
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot remove service report', error: err.message })
    })
}

const getAllServiceHistories = async (req, res) => {
  const regNo = req.params.regNo;
  reportServices.fetchAllServiceHistories(regNo)
    .then((fetchedServices) => {
      if (fetchedServices) {
        res.status(fetchedServices.status).json(fetchedServices)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get all service histories', error: err.message })
    })
}

const getAllOilServices = async (req, res) => {
  const regNo = req.params.regNo;
  reportServices.fetchServicesByType(regNo, 'oil')
    .then((fetchedServices) => {
      if (fetchedServices) {
        res.status(fetchedServices.status).json(fetchedServices)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get oil services', error: err.message })
    })
}

const getAllMaintenanceServices = async (req, res) => {
  const regNo = req.params.regNo;
  reportServices.fetchServicesByType(regNo, 'maintenance')
    .then((fetchedServices) => {
      if (fetchedServices) {
        res.status(fetchedServices.status).json(fetchedServices)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get maintenance services', error: err.message })
    })
}

const getAllTyreServices = async (req, res) => {
  const regNo = req.params.regNo;
  reportServices.fetchServicesByType(regNo, 'tyre')
    .then((fetchedServices) => {
      if (fetchedServices) {
        res.status(fetchedServices.status).json(fetchedServices)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get tyre services', error: err.message })
    })
}

const getAllBatteryServices = async (req, res) => {
  const regNo = req.params.regNo;
  reportServices.fetchServicesByType(regNo, 'battery')
    .then((fetchedServices) => {
      if (fetchedServices) {
        res.status(fetchedServices.status).json(fetchedServices)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get battery services', error: err.message })
    })
}

const getServicesByDateRange = async (req, res) => {
  const { regNo, startDate, endDate } = req.params;
  reportServices.fetchServicesByDateRange(regNo, startDate, endDate)
    .then((fetchedServices) => {
      if (fetchedServices) {
        res.status(fetchedServices.status).json(fetchedServices)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get services by date range', error: err.message })
    })
}

const getServicesByLastMonths = async (req, res) => {
  const { regNo, monthsCount } = req.params;
  reportServices.fetchServicesByLastMonths(regNo, parseInt(monthsCount))
    .then((fetchedServices) => {
      if (fetchedServices) {
        res.status(fetchedServices.status).json(fetchedServices)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get services by last months', error: err.message })
    })
}

const updateServiceReport = async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  reportServices.updateServiceReport(id, updateData)
    .then((updatedUser) => {
      if (updatedUser) {
        res.status(updatedUser.status).json(updatedUser)
      }
    })
    .catch((err) => {
      res.status(err.status).json({ error: err.message })
    })
}

const deleteServiceReport = async (req, res) => {
  const { id } = req.params;

  reportServices.deleteServiceReport(id)
    .then((response) => {
      if (response) {
        res.status(response.status).json(response)
      }
    })
    .catch((err) => {
      res.status(err.status).json({ error: err.message })
    })
}

module.exports = {
  addServiceReport,
  getServiceReport,
  updateServiceReport,
  deleteServiceReport,
  getAllServiceHistories,
  getAllOilServices,
  getAllMaintenanceServices,
  getAllTyreServices,
  getAllBatteryServices,
  getServicesByDateRange,
  getServicesByLastMonths,
  getServiceReportWithId,
  updateServiceReportWithId,
  removeServiceReportWithId
};