const fuelsModel = require('../models/fuels.model.js');
const equipmentModel = require('../models/equip.model.js');

const getEquipmentFuelConsumption = async (filters = {}) => {
  try {
    // Step 1: Get all equipment with their regNo
    const allEquipment = await equipmentModel.find({}, { regNo: 1, _id: 1, equipmentName: 1, type: 1 });
    
    if (!allEquipment || allEquipment.length === 0) {
      return [];
    }

    const equipmentConsumption = [];
    
    // Step 2: For each equipment, find matching fuel transactions
    for (const equipment of allEquipment) {
      if (!equipment.regNo) continue;
      
      // Build fuel transaction query with license plate matching logic
      const fuelQuery = {
        licensePlate: { $regex: equipment.regNo, $options: 'i' }
      };

      // Add date filtering if provided
      if (filters.startDate && filters.endDate) {
        fuelQuery.transactionDate = {
          $gte: new Date(filters.startDate),
          $lte: new Date(filters.endDate)
        };
      }

      // If specific equipment is requested
      if (filters.equipmentId && equipment._id.toString() !== filters.equipmentId) {
        continue;
      }

      // Find all fuel transactions for this equipment
      const fuelTransactions = await fuelsModel.find(fuelQuery);

      if (fuelTransactions.length === 0) {
        continue; // Skip equipment with no fuel transactions
      }

      // Step 3: Calculate consumption summary for this equipment
      const consumptionSummary = calculateConsumptionSummary(fuelTransactions);
      
      // Step 4: Build equipment consumption object
      const equipmentData = {
        equipmentId: equipment._id,
        equipmentName: equipment.equipmentName || 'N/A',
        equipmentType: equipment.type || 'N/A',
        regNo: equipment.regNo,
        totalTransactions: fuelTransactions.length,
        totalLiters: consumptionSummary.totalLiters,
        totalAmount: consumptionSummary.totalAmount,
        productBreakdown: consumptionSummary.productBreakdown,
        stationBreakdown: consumptionSummary.stationBreakdown,
        monthlyBreakdown: consumptionSummary.monthlyBreakdown,
        transactions: fuelTransactions.map(transaction => ({
          stationName: transaction.stationName,
          productName: transaction.productName,
          licensePlate: transaction.licensePlate,
          transactionDate: transaction.transactionDate,
          invoiceMonth: transaction.invoiceMonth,
          unitPrice: transaction.unitPrice,
          liter: transaction.liter,
          totalAmount: transaction.totalAmount
        }))
      };

      equipmentConsumption.push(equipmentData);
    }

    // Sort by total consumption (highest first)
    equipmentConsumption.sort((a, b) => b.totalLiters - a.totalLiters);

    return equipmentConsumption;

  } catch (error) {
    console.error('Error in getEquipmentFuelConsumption service:', error);
    throw error;
  }
};

const calculateConsumptionSummary = (transactions) => {
  const summary = {
    totalLiters: 0,
    totalAmount: 0,
    productBreakdown: {},
    stationBreakdown: {},
    monthlyBreakdown: {}
  };

  transactions.forEach(transaction => {
    // Total consumption
    summary.totalLiters += transaction.liter;
    summary.totalAmount += transaction.totalAmount;

    // Product breakdown
    if (!summary.productBreakdown[transaction.productName]) {
      summary.productBreakdown[transaction.productName] = {
        liters: 0,
        amount: 0,
        count: 0
      };
    }
    summary.productBreakdown[transaction.productName].liters += transaction.liter;
    summary.productBreakdown[transaction.productName].amount += transaction.totalAmount;
    summary.productBreakdown[transaction.productName].count += 1;

    // Station breakdown
    if (!summary.stationBreakdown[transaction.stationName]) {
      summary.stationBreakdown[transaction.stationName] = {
        liters: 0,
        amount: 0,
        count: 0
      };
    }
    summary.stationBreakdown[transaction.stationName].liters += transaction.liter;
    summary.stationBreakdown[transaction.stationName].amount += transaction.totalAmount;
    summary.stationBreakdown[transaction.stationName].count += 1;

    // Monthly breakdown
    const monthKey = new Date(transaction.invoiceMonth).toISOString().substring(0, 7); // YYYY-MM format
    if (!summary.monthlyBreakdown[monthKey]) {
      summary.monthlyBreakdown[monthKey] = {
        liters: 0,
        amount: 0,
        count: 0
      };
    }
    summary.monthlyBreakdown[monthKey].liters += transaction.liter;
    summary.monthlyBreakdown[monthKey].amount += transaction.totalAmount;
    summary.monthlyBreakdown[monthKey].count += 1;
  });

  // Round totals to 2 decimal places
  summary.totalLiters = Math.round(summary.totalLiters * 100) / 100;
  summary.totalAmount = Math.round(summary.totalAmount * 100) / 100;

  return summary;
};

module.exports = {
  getEquipmentFuelConsumption
};