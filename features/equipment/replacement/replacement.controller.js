const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { respond } = require('#shared/response/response.respond');
const replacementService = require('./replacement.service');

const getAllReplacements = async (req, res) => {
  try {
    const data = await replacementService.fetchAllReplacements();
    respond(res, { status: HTTP.OK, ok: true, data });
  } catch (error) {
    logger.error('[ReplacementController] getAllReplacements:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const getReplacementHistory = async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const { type } = req.query;

    if (!equipmentId) {
      return respond(res, { status: HTTP.BAD_REQUEST, ok: false, message: 'Equipment ID is required' });
    }

    const result = await replacementService.getReplacementHistory(parseInt(equipmentId, 10), req.pagination, type);
    respond(res, result);
  } catch (error) {
    logger.error('[ReplacementController] getReplacementHistory:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const getFilteredReplacements = async (req, res) => {
  try {
    const { filterType, startDate, endDate, months } = req.query;

    if (!filterType) {
      return respond(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message: 'filterType is required (daily, yesterday, weekly, monthly, yearly, months, custom)',
      });
    }
    if (filterType === 'custom' && (!startDate || !endDate)) {
      return respond(res, { status: HTTP.BAD_REQUEST, ok: false, message: 'startDate and endDate are required for custom range' });
    }
    if (filterType === 'months' && !months) {
      return respond(res, { status: HTTP.BAD_REQUEST, ok: false, message: 'months is required for months filter type' });
    }

    const data = await replacementService.fetchFilteredReplacements(filterType, startDate, endDate, months);
    respond(res, { status: HTTP.OK, ok: true, data, count: data.length });
  } catch (error) {
    logger.error('[ReplacementController] getFilteredReplacements:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const replaceOperator = async (req, res) => {
  try {
    const { equipmentId, regNo, machine, currentOperator, replacedOperator, replacedOperatorId, month, year, time, replaceAll } = req.body;

    if (!equipmentId || !regNo || !machine || !replacedOperator || !replacedOperatorId || !month || !year || !time) {
      return respond(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message: 'Missing required fields: equipmentId, regNo, machine, replacedOperator, replacedOperatorId, month, year, time',
      });
    }
    if (!replaceAll && !currentOperator) {
      return respond(res, { status: HTTP.BAD_REQUEST, ok: false, message: 'currentOperator is required when not replacing all operators' });
    }

    const result = await replacementService.replaceOperator({
      ...req.body,
      targetShiftName: req.body.targetShiftName || '',
      shiftName: req.body.shiftName || '',
      shiftStart: req.body.shiftStart || '',
      shiftEnd: req.body.shiftEnd || '',
      selectedDate: req.body.selectedDate || null,
      remarks: req.body.remarks || '',
      replaceAll: replaceAll || false,
    });
    respond(res, result);
  } catch (error) {
    logger.error('[ReplacementController] replaceOperator:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const replaceEquipment = async (req, res) => {
  try {
    const {
      equipmentId,
      regNo,
      machine,
      replacedEquipmentId,
      replacedEquipmentRegNo,
      replacedEquipmentMachine,
      month,
      year,
      time,
    } = req.body;

    if (
      !equipmentId ||
      !regNo ||
      !machine ||
      !replacedEquipmentId ||
      !replacedEquipmentRegNo ||
      !replacedEquipmentMachine ||
      !month ||
      !year ||
      !time
    ) {
      return respond(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message:
          'Missing required fields: equipmentId, regNo, machine, replacedEquipmentId, replacedEquipmentRegNo, replacedEquipmentMachine, month, year, time',
      });
    }

    const result = await replacementService.replaceEquipment({
      ...req.body,
      newSiteForReplaced: req.body.newSiteForReplaced || null,
      selectedDate: req.body.selectedDate || null,
      remarks: req.body.remarks || '',
      operator: req.body.operator || '',
      operatorId: req.body.operatorId || '',
    });
    respond(res, result);
  } catch (error) {
    logger.error('[ReplacementController] replaceEquipment:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

module.exports = {
  getAllReplacements,
  getReplacementHistory,
  getFilteredReplacements,
  replaceOperator,
  replaceEquipment,
};
