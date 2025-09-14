const fuelServices = require('../services/fuels-services.js');

const getEquipmentFuelConsumption = async (req, res) => {
  try {
    const { startDate, endDate, equipmentId } = req.query;
    
    // Build filter object
    const filters = {};
    if (startDate && endDate) {
      filters.startDate = startDate;
      filters.endDate = endDate;
    }
    if (equipmentId) {
      filters.equipmentId = equipmentId;
    }

    const fuelConsumptionData = await fuelServices.getEquipmentFuelConsumption(filters);
    
    if (!fuelConsumptionData || fuelConsumptionData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No fuel consumption data found for the specified criteria',
        data: []
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Equipment fuel consumption data retrieved successfully',
      totalEquipment: fuelConsumptionData.length,
      data: fuelConsumptionData
    });

  } catch (error) {
    console.error('Error in getEquipmentFuelConsumption:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving fuel consumption data',
      error: error.message
    });
  }
};

module.exports = {
  getEquipmentFuelConsumption
};