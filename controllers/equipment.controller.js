const userServices = require('../services/equipment-services')

const addEquipments = async (req, res) => {  
  userServices.insertEquipments(req.body)
    .then((addedUser) => {
      if (addedUser) {
        res.status(addedUser.status).json(addedUser)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ error: err.message })
    })
}

const getEquipments = async (req, res) => {
  userServices.fetchEquipments()
    .then((fetchedUsers) => {
      if (fetchedUsers) {
        res.status(fetchedUsers.status).json(fetchedUsers)
      }
    })
    .catch((err) => {
      res.status(err.status || 500).json({ message: 'Cannot get all users', error: err.message })
    })
}

const updateEquipments = async (req, res) => {
  const { regNo } = req.params;
  const updateData = req.body;

  userServices.updateEquipments(regNo, updateData)
    .then((updatedUser) => {
      if (updatedUser) {
        res.status(updatedUser.status).json(updatedUser)
      }
    })
    .catch((err) => {
      res.status(err.status).json({ error: err.message })
    })
}


const deleteEquipments= async (req, res) => {
  const { regNO } = req.params;

  userServices.deleteEquipments(regNO)
    .then((response) => {
      if (response) {
        res.status(response.status).json(response)
      }
    })
    .catch((err) => {
      res.status(err.status).json({ error: err.message })
    })
}


const updateStatus = async (req, res) => {
  const { regNo } = req.params;
  const updateData = req.body;

  userServices.changeStatus(regNo, updateData)
    .then((updatedUser) => {
      if (updatedUser) {
        res.status(updatedUser.status).json(updatedUser)
      }
    })
    .catch((err) => {
      res.status(err.status).json({ error: err.message })
    })
}


module.exports = {
  addEquipments,
  getEquipments,
  updateEquipments,
  deleteEquipments,
  updateStatus
};
