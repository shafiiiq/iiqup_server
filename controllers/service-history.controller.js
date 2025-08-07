const userServices = require('../services/service-report.js')
const serviceHistoryServices = require('../services/service-history-services.js')

const addServiceHistory = async (req, res) => {
  serviceHistoryServices.insertServiceHisory(req.body)
    .then((addHistory) => {
      if (addHistory) {
        res.status(addHistory.status).json(addHistory)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

const addMaintananceHistory = async (req, res) => {
  serviceHistoryServices.insertMaintananceHisory(req.body)
    .then((addHistory) => {
      if (addHistory) {
        res.status(addHistory.status).json(addHistory)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

const getMaintananceHistory = async (req, res) => {
  const regNo = req.params.regNo;
  serviceHistoryServices.fetchMaintananceHistory (regNo)
    .then((fetchedHistory) => {
      if (fetchedHistory) {
        res.status(fetchedHistory.status).json(fetchedHistory)
      } else {
        res.status(404).json({ message: 'No service history found' })
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get service history', error: err.message })
    })
}

const getServiceHistory = async (req, res) => {
  const regNo = req.params.regNo;
  serviceHistoryServices.fetchServiceHistory(regNo)
    .then((fetchedHistory) => {
      if (fetchedHistory) {
        res.status(fetchedHistory.status).json(fetchedHistory)
      } else {
        res.status(404).json({ message: 'No service history found' })
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get service history', error: err.message })
    })
}

const getLatestFullService = async (req, res) => {
  const regNo = req.params.regNo

  serviceHistoryServices.fetchLatestFullService(regNo)
    .then((fetchedHistory) => {
      if (fetchedHistory) {
        res.status(fetchedHistory.status).json(fetchedHistory)
      } else {
        res.status(404).json({ message: 'No service history found' })
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get service history', error: err.message })
    })
}

const addNextFullService = async (req, res) => {
  serviceHistoryServices.insertFullService(req.body)
    .then((addHistory) => {
      if (addHistory) {
        res.status(addHistory.status).json(addHistory)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

const getFullServiceNotification = async (req, res) => {
  serviceHistoryServices.fetchFullServiceNotification()
    .then((fetchedHistory) => {
      if (fetchedHistory) {
        res.status(fetchedHistory.status).json(fetchedHistory)
      } else {
        res.status(404).json({ message: 'No service history found' })
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get service history', error: err.message })
    })
}

const addTyreHistory = async (req, res) => {
  serviceHistoryServices.insertTyreHisory(req.body)
    .then((addHistory) => {
      if (addHistory) {
        res.status(addHistory.status).json(addHistory)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

const getTyreHistory = async (req, res) => {
  const regNo = req.params.regNo;
  serviceHistoryServices.fetchTyreHistory(regNo)
    .then((fetchedHistory) => {
      if (fetchedHistory) {
        res.status(fetchedHistory.status).json(fetchedHistory)
      } else {
        res.status(404).json({ message: 'No service history found' })
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get service history', error: err.message })
    })
}


const addBatteryHistory = async (req, res) => { 
  serviceHistoryServices.insertBatteryHistory(req.body)
    .then((addHistory) => {
      if (addHistory) {
        res.status(addHistory.status).json(addHistory)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

const getBatteryHistory = async (req, res) => {
  const regNo = req.params.regNo;
  serviceHistoryServices.fetchBatteryHistory(regNo)
    .then((fetchedHistory) => {
      if (fetchedHistory) {
        res.status(fetchedHistory.status).json(fetchedHistory)
      } else {
        res.status(404).json({ message: 'No service history found' })
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get service history', error: err.message })
    })
}

module.exports = {
  addServiceHistory,
  getServiceHistory,
  getLatestFullService,
  addNextFullService,
  getFullServiceNotification,
  addTyreHistory,
  getTyreHistory,
  addMaintananceHistory,
  getMaintananceHistory,
  getBatteryHistory,
  addBatteryHistory
};
