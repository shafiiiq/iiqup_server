// services/fuel.service.js
const fuelsModel     = require('../models/fuel.model');
const equipmentModel = require('../models/equipment.model');

/**
 * Aggregates fuel transactions into a consumption summary.
 * @param {object[]} transactions
 * @returns {object}
 */
const _calculateConsumptionSummary = (transactions) => {
  const summary = {
    totalLiters:      0,
    totalAmount:      0,
    productBreakdown: {},
    stationBreakdown: {},
    monthlyBreakdown: {}
  };

  transactions.forEach(transaction => {
    summary.totalLiters += transaction.liter;
    summary.totalAmount += transaction.totalAmount;

    // Product breakdown
    const product = summary.productBreakdown[transaction.productName] ??= { liters: 0, amount: 0, count: 0 };
    product.liters += transaction.liter;
    product.amount += transaction.totalAmount;
    product.count  += 1;

    // Station breakdown
    const station = summary.stationBreakdown[transaction.stationName] ??= { liters: 0, amount: 0, count: 0 };
    station.liters += transaction.liter;
    station.amount += transaction.totalAmount;
    station.count  += 1;

    // Monthly breakdown (YYYY-MM key)
    const monthKey = new Date(transaction.invoiceMonth).toISOString().substring(0, 7);
    const month    = summary.monthlyBreakdown[monthKey] ??= { liters: 0, amount: 0, count: 0 };
    month.liters += transaction.liter;
    month.amount += transaction.totalAmount;
    month.count  += 1;
  });

  summary.totalLiters = Math.round(summary.totalLiters * 100) / 100;
  summary.totalAmount = Math.round(summary.totalAmount * 100) / 100;

  return summary;
};

// ─────────────────────────────────────────────────────────────────────────────
// Fetch / Aggregation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns fuel consumption per equipment, optionally filtered by date range
 * or a specific equipment ID. Equipment with no fuel transactions are excluded.
 * Results are sorted by total litres consumed (highest first).
 * @param {object}      [filters={}]
 * @param {string|null} [filters.startDate]
 * @param {string|null} [filters.endDate]
 * @param {string|null} [filters.equipmentId]
 * @returns {Promise<object>}
 */
const getEquipmentFuelConsumption = async (filters = {}) => {
  try {
    const allEquipment = await equipmentModel
      .find({}, { regNo: 1, _id: 1, equipmentName: 1, type: 1 })
      .lean();

    if (!allEquipment?.length) {
      return { status: 200, ok: true, message: 'No equipment found', data: [] };
    }

    const equipmentConsumption = [];

    for (const equipment of allEquipment) {
      if (!equipment.regNo) continue;

      // Skip if caller requested a specific equipment and this is not it
      if (filters.equipmentId && equipment._id.toString() !== filters.equipmentId) continue;

      const fuelQuery = {
        licensePlate: { $regex: equipment.regNo, $options: 'i' }
      };

      if (filters.startDate && filters.endDate) {
        fuelQuery.transactionDate = {
          $gte: new Date(filters.startDate),
          $lte: new Date(filters.endDate)
        };
      }

      const fuelTransactions = await fuelsModel.find(fuelQuery).lean();
      if (!fuelTransactions.length) continue;

      const consumptionSummary = _calculateConsumptionSummary(fuelTransactions);

      equipmentConsumption.push({
        equipmentId:       equipment._id,
        equipmentName:     equipment.equipmentName || 'N/A',
        equipmentType:     equipment.type          || 'N/A',
        regNo:             equipment.regNo,
        totalTransactions: fuelTransactions.length,
        totalLiters:       consumptionSummary.totalLiters,
        totalAmount:       consumptionSummary.totalAmount,
        productBreakdown:  consumptionSummary.productBreakdown,
        stationBreakdown:  consumptionSummary.stationBreakdown,
        monthlyBreakdown:  consumptionSummary.monthlyBreakdown,
        transactions:      fuelTransactions.map(t => ({
          stationName:     t.stationName,
          productName:     t.productName,
          licensePlate:    t.licensePlate,
          transactionDate: t.transactionDate,
          invoiceMonth:    t.invoiceMonth,
          unitPrice:       t.unitPrice,
          liter:           t.liter,
          totalAmount:     t.totalAmount
        }))
      });
    }

    equipmentConsumption.sort((a, b) => b.totalLiters - a.totalLiters);

    return { status: 200, ok: true, message: 'Fuel consumption retrieved successfully', data: equipmentConsumption };

  } catch (err) {
    console.error('[FuelsService] getEquipmentFuelConsumption:', err);
    return { status: 500, ok: false, message: 'Error retrieving fuel consumption', error: err.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getEquipmentFuelConsumption
};