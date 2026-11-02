const equipmentModel = require('#features/fleet/equipment/equipment.model');
const maintenanceModel = require('./maintenance.model');

const MAINTENANCE_RECORD_SERVICE_TYPES = ['oil', 'normal', 'major', 'battery', 'tyre'];

const buildEmptyMaintenanceRecord = () =>
  Object.fromEntries(MAINTENANCE_RECORD_SERVICE_TYPES.map((serviceType) => [serviceType, 0]));

const recalculateMaintenanceRecord = async (regNos, session = null) => {
  const uniqueRegNos = [...new Set(regNos.map((regNo) => String(regNo).trim()).filter(Boolean))];
  if (uniqueRegNos.length === 0) return;

  const aggregation = maintenanceModel.aggregate([
    { $match: { regNo: { $in: uniqueRegNos } } },
    { $group: { _id: { regNo: '$regNo', serviceType: '$serviceType' }, count: { $sum: 1 } } },
  ]);
  if (session) aggregation.session(session);
  const groupedCounts = await aggregation;

  const recordsByRegNo = new Map(uniqueRegNos.map((regNo) => [regNo, buildEmptyMaintenanceRecord()]));
  groupedCounts.forEach(({ _id, count }) => {
    const maintenanceRecord = recordsByRegNo.get(_id.regNo);
    if (maintenanceRecord && MAINTENANCE_RECORD_SERVICE_TYPES.includes(_id.serviceType)) {
      maintenanceRecord[_id.serviceType] = count;
    }
  });

  const operations = [...recordsByRegNo].map(([regNo, maintenanceRecord]) => ({
    updateOne: { filter: { regNo }, update: { $set: { maintenanceRecord } } },
  }));

  await equipmentModel.bulkWrite(operations, session ? { session } : {});
};

module.exports = { recalculateMaintenanceRecord };