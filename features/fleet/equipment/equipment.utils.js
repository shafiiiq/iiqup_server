const logger = require('#shared/logger/logger');
const mongoose = require('mongoose');
const equipmentModel = require('./equipment.model');
const OperatorModel = require('#features/user/operator/operator.model');
const OperatorService = require('#features/user/operator/operator.service');

const safeUpdateOperator = async (operatorId, updateData) => {
  if (!operatorId || !mongoose.Types.ObjectId.isValid(operatorId)) {
    logger.info('[Operator] Skipping operator update — invalid operatorId:', operatorId);
    return null;
  }

  try {
    return await OperatorModel.findByIdAndUpdate(
      operatorId,
      { ...updateData, updatedAt: new Date() },
      { new: true }
    );
  } catch (err) {
    logger.error('[Operator] safeUpdateOperator failed:', err.message);
    return null;
  }
};

const getOperatorsByIds = (operatorIds) =>
  OperatorModel.find({ _id: { $in: operatorIds } }).lean();

const fetchEquipmentMapByRegNo = async (regNos) => {
  const equipments = await equipmentModel.find({ regNo: { $in: regNos } }).lean();
  return Object.fromEntries(equipments.map((eq) => [eq.regNo, eq]));
};

const fetchEquipmentMapById = async (equipmentIds) => {
  const equipments = await equipmentModel.find({ _id: { $in: equipmentIds } }).lean();
  return Object.fromEntries(equipments.map((eq) => [eq._id.toString(), eq]));
};

const fetchOperatorMapByName = async (names) => {
  if (!names.length) return {};
  const operators = await OperatorService.getOperatorsByNames(names);
  return Object.fromEntries(operators.map((op) => [op.name, op]));
};

const fetchOperatorMapById = async (ids) => {
  if (!ids.length) return {};
  const operators = await getOperatorsByIds(ids);
  return Object.fromEntries(operators.map((op) => [op._id.toString(), op]));
};

const shapeOperatorDetails = (operator) => {
  if (!operator) return null;
  return {
    id: operator._id || operator.id,
    name: operator.name,
    qatarId: operator.qatarId,
    contactNo: operator.contactNo,
    profilePic: operator.profilePic,
  };
};

const shapeEquipmentDetails = (equipment = {}, fallback = {}, images = []) => ({
  id: equipment._id,
  machine: equipment.machine || fallback.machine,
  regNo: equipment.regNo || fallback.regNo,
  brand: equipment.brand,
  year: equipment.year,
  company: equipment.company,
  status: equipment.status,
  site: equipment.site?.[0] ?? equipment.site,
  images,
});

module.exports = {
  safeUpdateOperator,
  getOperatorsByIds,
  fetchEquipmentMapByRegNo,
  fetchEquipmentMapById,
  fetchOperatorMapByName,
  fetchOperatorMapById,
  shapeOperatorDetails,
  shapeEquipmentDetails,
};
