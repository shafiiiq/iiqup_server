const reportServices = require('../services/service-report-services.js')

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
  console.log("id ...................", id);
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
  const serviceTypesParam = req.query.serviceTypes; // Get query parameter

  // Parse serviceTypes - it comes as comma-separated string
  let serviceTypes = [];
  if (serviceTypesParam) {
    serviceTypes = serviceTypesParam.split(',').map(type => type.trim());
  }

  reportServices.fetchAllServiceHistories(regNo, serviceTypes)
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

const getDailyServices = async (req, res) => {
  reportServices.fetchServicesByPeriod('daily')
    .then((fetchedServices) => {
      if (fetchedServices) {
        res.status(fetchedServices.status).json(fetchedServices)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get daily services', error: err.message })
    })
}

const getYesterdayServices = async (req, res) => {
  reportServices.fetchServicesByPeriod('yesterday')
    .then((fetchedServices) => {
      if (fetchedServices) {
        res.status(fetchedServices.status).json(fetchedServices)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get yesterday services', error: err.message })
    })
}

const getWeeklyServices = async (req, res) => {
  reportServices.fetchServicesByPeriod('weekly')
    .then((fetchedServices) => {
      if (fetchedServices) {
        res.status(fetchedServices.status).json(fetchedServices)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get weekly services', error: err.message })
    })
}

const getMonthlyServices = async (req, res) => {
  console.log("yeahhhhhhhhhhhhhhhhh")
  reportServices.fetchServicesByPeriod('monthly')
    .then((fetchedServices) => {
      if (fetchedServices) {
        res.status(fetchedServices.status).json(fetchedServices)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get monthly services', error: err.message })
    })
}

const getYearlyServices = async (req, res) => {
  reportServices.fetchServicesByPeriod('yearly')
    .then((fetchedServices) => {
      if (fetchedServices) {
        res.status(fetchedServices.status).json(fetchedServices)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get yearly services', error: err.message })
    })
}

const getAllServicesByDateRange = async (req, res) => {
  const { startDate, endDate } = req.params;
  reportServices.fetchAllServicesByDateRange(startDate, endDate)
    .then((fetchedServices) => {
      if (fetchedServices) {
        res.status(fetchedServices.status).json(fetchedServices)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get services by date range', error: err.message })
    })
}

const getAllServicesByLastMonths = async (req, res) => {
  const { monthsCount } = req.params;
  reportServices.fetchAllServicesByLastMonths(parseInt(monthsCount))
    .then((fetchedServices) => {
      if (fetchedServices) {
        res.status(fetchedServices.status).json(fetchedServices)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get services by last months', error: err.message })
    })
}

const getServicesByTypeAndDateRange = async (req, res) => {
  const { regNo, serviceType, startDate, endDate } = req.params;
  const serviceTypesParam = req.query.serviceTypes; // Add this

  // Map service type segment to actual service type
  const serviceTypeMap = {
    'all-histories': null,
    'oil-service': 'oil',
    'maintenance-service': 'maintenance',
    'tyre-service': 'tyre',
    'battery-service': 'battery'
  };

  const actualServiceType = serviceTypeMap[serviceType];

  // Parse serviceTypes from query parameter
  let serviceTypes = [];
  if (serviceTypesParam) {
    serviceTypes = serviceTypesParam.split(',').map(type => type.trim());
  }

  reportServices.fetchServicesByTypeAndDateRange(regNo, actualServiceType, startDate, endDate, serviceTypes)
    .then((fetchedServices) => {
      if (fetchedServices) {
        res.status(fetchedServices.status).json(fetchedServices)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({
        message: 'Cannot get services by type and date range',
        error: err.message
      })
    })
}

const getServicesByTypeAndLastMonths = async (req, res) => {
  const { regNo, serviceType, monthsCount } = req.params;
  const serviceTypesParam = req.query.serviceTypes; // Add this

  // Map service type segment to actual service type
  const serviceTypeMap = {
    'all-histories': null,
    'oil-service': 'oil',
    'maintenance-service': 'maintenance',
    'tyre-service': 'tyre',
    'battery-service': 'battery'
  };

  const actualServiceType = serviceTypeMap[serviceType];

  // Parse serviceTypes from query parameter
  let serviceTypes = [];
  if (serviceTypesParam) {
    serviceTypes = serviceTypesParam.split(',').map(type => type.trim());
  }

  reportServices.fetchServicesByTypeAndLastMonths(regNo, actualServiceType, parseInt(monthsCount), serviceTypes)
    .then((fetchedServices) => {
      if (fetchedServices) {
        res.status(fetchedServices.status).json(fetchedServices)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({
        message: 'Cannot get services by type and last months',
        error: err.message
      })
    })
}

const handleSummary = async (req, res) => {
  const { type, param1, param2 } = req.params;

  switch (type) {
    case 'daily':
      return getDailyServices(req, res);
    case 'yesterday':
      return getYesterdayServices(req, res);
    case 'weekly':
      return getWeeklyServices(req, res);
    case 'monthly':
      return getMonthlyServices(req, res);
    case 'yearly':
      return getYearlyServices(req, res);
    case 'date-range':
      req.params.startDate = param1;
      req.params.endDate = param2;
      return getAllServicesByDateRange(req, res);
    case 'last-months':
      req.params.monthsCount = param1;
      return getAllServicesByLastMonths(req, res);
    default:
      return res.status(400).json({ message: 'Invalid summary type' });
  }
};

const handleHistory = async (req, res) => {
  const { regNo, type, param1, param2, param3 } = req.params;

  switch (type) {
    case 'all':
      return getAllServiceHistories(req, res);
    case 'oil':
      return getAllOilServices(req, res);
    case 'maintenance':
      return getAllMaintenanceServices(req, res);
    case 'tyre':
      return getAllTyreServices(req, res);
    case 'battery':
      return getAllBatteryServices(req, res);
    case 'date-range':
      req.params.startDate = param1;
      req.params.endDate = param2;
      return getServicesByDateRange(req, res);
    case 'last-months':
      req.params.monthsCount = param1;
      return getServicesByLastMonths(req, res);
    case 'oil-service':
    case 'maintenance-service':
    case 'tyre-service':
    case 'battery-service':
    case 'all-histories':
      req.params.serviceType = type;
      req.params.startDate = param2;
      req.params.endDate = param3;
      if (param1 === 'date-range') {
        return getServicesByTypeAndDateRange(req, res);
      } else if (param1 === 'last-months') {
        req.params.monthsCount = param2;
        return getServicesByTypeAndLastMonths(req, res);
      }
      return res.status(400).json({ message: 'Invalid history parameters' });
    default:
      return res.status(400).json({ message: 'Invalid history type' });
  }
};


module.exports = {
  addServiceReport,
  getServiceReport,
  getAllServiceHistories,
  getAllOilServices,
  getAllMaintenanceServices,
  getAllTyreServices,
  getAllBatteryServices,
  getServicesByDateRange,
  getServicesByLastMonths,
  getServiceReportWithId,
  updateServiceReportWithId,
  removeServiceReportWithId,
  getDailyServices,
  getYesterdayServices,
  getWeeklyServices,
  getMonthlyServices,
  getYearlyServices,
  getAllServicesByDateRange,
  getAllServicesByLastMonths,
  getServicesByTypeAndDateRange,
  getServicesByTypeAndLastMonths,
  handleSummary,
  handleHistory
};