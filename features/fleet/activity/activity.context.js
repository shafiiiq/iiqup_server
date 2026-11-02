const logger = require('#shared/logger/logger');
const chainService = require('../chain/chain.service');
const equipmentModel = require('../equipment/equipment.model');
const OperatorModel = require('#features/user/operator/operator.model');

const fetchChainInfoSafely = async (chainId) => {
  if (!chainId) return null;

  try {
    const result = await chainService.fetchChainByChainId(chainId.toString());
    return result.ok ? result.data : null;
  } catch (error) {
    logger.warn('[activity.context] fetchChainInfoSafely failed:', error.message);
    return null;
  }
};

const fetchMobilizationContext = async (record) => ({
  chainInfo: record.action === 'demobilized' ? await fetchChainInfoSafely(record.chainId) : null,
});

const fetchReplacementContext = async (record) => {
  if (record.type !== 'equipment' || !record.replacedEquipmentId) return {};

  const replacedEquipment = await equipmentModel.findById(record.replacedEquipmentId).lean();
  return { incomingHiredFrom: replacedEquipment?.hiredFrom || '' };
};

const fetchOperatorContext = async (record) => ({
  operator: await OperatorModel.findById(record.operatorId).lean(),
});

module.exports = {
  fetchMobilizationContext,
  fetchReplacementContext,
  fetchOperatorContext,
};