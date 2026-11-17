const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { respond } = require('#shared/response/response.respond');
const service = require('./operator.mobilization.service');
const { announceFleetRecordActivity } = require('#features/fleet/shared/fleet.activity.notification.service');
const { FLEET_ACTIVITY_MODEL_KEY } = require('#features/fleet/shared/fleet.activity.notification.constant');
const {
  buildOperatorMobilizationMessage,
  buildOperatorDemobilizationMessage,
  buildOperatorSwapMessage,
} = require('#features/fleet/shared/fleet.activity.notification.message');

const getAllOperatorMobilizations = async (req, res) => {
  try {
    const result = await service.fetchAllOperatorMobilizations();
    respond(res, result);
  } catch (error) {
    logger.error('[operator.mobilization.controller] getAllOperatorMobilizations:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const getOperatorMobilizationHistory = async (req, res) => {
  try {
    const { operatorId } = req.params;
    if (!operatorId) {
      return respond(res, { status: HTTP.BAD_REQUEST, ok: false, message: 'Operator ID is required' });
    }

    const result = await service.getMobilizationHistory(operatorId, req.pagination);
    respond(res, result);
  } catch (error) {
    logger.error('[operator.mobilization.controller] getOperatorMobilizationHistory:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const mobilizeOperator = async (req, res) => {
  try {
    const { operatorId, deployType, site, clientCompany, regNo } = req.body;

    if (!operatorId) {
      return respond(res, { status: HTTP.BAD_REQUEST, ok: false, message: 'operatorId is required' });
    }
    if (deployType === 'company' && !clientCompany) {
      return respond(res, { status: HTTP.BAD_REQUEST, ok: false, message: 'clientCompany is required when deployType is company' });
    }
    if (deployType !== 'company' && !site && !regNo) {
      return respond(res, { status: HTTP.BAD_REQUEST, ok: false, message: 'site or regNo is required' });
    }

    const result = await service.mobilizeOperator(req.body);
    announceFleetRecordActivity({
      actorUniqueCode: req.user?.uniqueCode,
      modelKey: FLEET_ACTIVITY_MODEL_KEY.OPERATOR_MOBILIZATION,
      record: result.data?.mobilization,
      buildMessage: buildOperatorMobilizationMessage,
    });
    respond(res, result);
  } catch (error) {
    logger.error('[operator.mobilization.controller] mobilizeOperator:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const demobilizeOperator = async (req, res) => {
  try {
    const { operatorId } = req.body;
    if (!operatorId) {
      return respond(res, { status: HTTP.BAD_REQUEST, ok: false, message: 'operatorId is required' });
    }

    const result = await service.demobilizeOperator(req.body);
    announceFleetRecordActivity({
      actorUniqueCode: req.user?.uniqueCode,
      modelKey: FLEET_ACTIVITY_MODEL_KEY.OPERATOR_MOBILIZATION,
      record: result.data?.demobilization,
      buildMessage: buildOperatorDemobilizationMessage,
    });
    respond(res, result);
  } catch (error) {
    logger.error('[operator.mobilization.controller] demobilizeOperator:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const replaceOperator = async (req, res) => {
  try {
    const { currentOperatorId, newOperatorId } = req.body;
    if (!currentOperatorId || !newOperatorId) {
      return respond(res, { status: HTTP.BAD_REQUEST, ok: false, message: 'currentOperatorId and newOperatorId are required' });
    }

    const result = await service.replaceOperator(req.body);
    announceFleetRecordActivity({
      actorUniqueCode: req.user?.uniqueCode,
      modelKey: FLEET_ACTIVITY_MODEL_KEY.OPERATOR_MOBILIZATION,
      record: result.data?.replacementRecord,
      buildMessage: buildOperatorSwapMessage,
    });
    respond(res, result);
  } catch (error) {
    logger.error('[operator.mobilization.controller] replaceOperator:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

module.exports = {
  getAllOperatorMobilizations,
  getOperatorMobilizationHistory,
  mobilizeOperator,
  demobilizeOperator,
  replaceOperator,
};