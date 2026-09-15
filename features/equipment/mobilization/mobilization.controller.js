const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { respond } = require('#shared/response/response.respond');
const mobilizationService = require('./mobilization.service');

const getAllMobilizations = async (req, res) => {
  try {
    const data = await mobilizationService.fetchAllMobilizations();
    respond(res, { status: HTTP.OK, ok: true, data });
  } catch (error) {
    logger.error('[mobilization.controller] getAllMobilizations:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const getMobilizationHistory = async (req, res) => {
  try {
    const { equipmentId } = req.params;
    if (!equipmentId) {
      return respond(res, { status: HTTP.BAD_REQUEST, ok: false, message: 'Equipment ID is required' });
    }

    const result = await mobilizationService.getMobilizationHistory(parseInt(equipmentId, 10), req.pagination);
    respond(res, result);
  } catch (error) {
    logger.error('[mobilization.controller] getMobilizationHistory:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const getFilteredMobilizations = async (req, res) => {
  try {
    const { filterType, startDate, endDate, months, specificTime, startTime, endTime } = req.query;

    if (!filterType) {
      return respond(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message: 'filterType is required (daily, yesterday, weekly, monthly, yearly, months, custom, single)',
      });
    }
    if (filterType === 'custom' && (!startDate || !endDate)) {
      return respond(res, { status: HTTP.BAD_REQUEST, ok: false, message: 'startDate and endDate are required for custom range' });
    }
    if (filterType === 'single' && !startDate) {
      return respond(res, { status: HTTP.BAD_REQUEST, ok: false, message: 'Date is required for single date filter' });
    }
    if (filterType === 'months' && !months) {
      return respond(res, { status: HTTP.BAD_REQUEST, ok: false, message: 'months is required for months filter type' });
    }
    if (startTime && endTime && startTime > endTime) {
      return respond(res, { status: HTTP.BAD_REQUEST, ok: false, message: 'startTime must be before endTime' });
    }

    const data = await mobilizationService.fetchFilteredMobilizations(
      filterType,
      startDate,
      endDate,
      months,
      specificTime,
      startTime,
      endTime
    );

    respond(res, { status: HTTP.OK, ok: true, data, count: data.length });
  } catch (error) {
    logger.error('[mobilization.controller] getFilteredMobilizations:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const mobilizeEquipment = async (req, res) => {
  try {
    const { equipmentId, regNo, machine, month, year, time, deployType, clientCompany, site, withOperator, operators } = req.body;

    if (!equipmentId || !regNo || !machine || !month || !year || !time) {
      return respond(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message: 'Missing required fields: equipmentId, regNo, machine, month, year, time',
      });
    }
    if (deployType === 'company' && !clientCompany) {
      return respond(res, { status: HTTP.BAD_REQUEST, ok: false, message: 'clientCompany is required when deployType is company' });
    }
    if (deployType !== 'company' && !site) {
      return respond(res, { status: HTTP.BAD_REQUEST, ok: false, message: 'site is required when deployType is site' });
    }
    if (withOperator && !operators?.length) {
      return respond(res, { status: HTTP.BAD_REQUEST, ok: false, message: 'At least one operator is required when withOperator is true' });
    }

    const result = await mobilizationService.mobilizeEquipment({
      ...req.body,
      selectedDate: req.body.selectedDate || null,
      clientCompany: clientCompany || '',
      operators: operators || [],
      withOperator: withOperator || false,
      deployType: deployType || 'site',
      isOneDayMob: req.body.isOneDayMob || false,
      demobDate: req.body.demobDate || null,
      demobTime: req.body.demobTime || '',
      demobRemarks: req.body.demobRemarks || '',
      location: req.body.location || null,
      rentRate: req.body.rentRate || null,
      remarks: req.body.remarks || '',
    });
    respond(res, result);
  } catch (error) {
    logger.error('[mobilization.controller] mobilizeEquipment:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const demobilizeEquipment = async (req, res) => {
  try {
    const { equipmentId, regNo, machine, month, year, time } = req.body;

    if (!equipmentId || !regNo || !machine || !month || !year || !time) {
      return respond(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message: 'Missing required fields: equipmentId, regNo, machine, month, year, time',
      });
    }

    const result = await mobilizationService.demobilizeEquipment({
      ...req.body,
      selectedDate: req.body.selectedDate || null,
      remarks: req.body.remarks || '',
    });
    respond(res, result);
  } catch (error) {
    logger.error('[mobilization.controller] demobilizeEquipment:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const addShifts = async (req, res) => {
  try {
    const { equipmentId, regNo, operators } = req.body;

    if (!equipmentId || !regNo || !operators?.length) {
      return respond(res, { status: HTTP.BAD_REQUEST, ok: false, message: 'equipmentId, regNo, operators are required' });
    }

    const result = await mobilizationService.addShifts(req.body);
    respond(res, result);
  } catch (error) {
    logger.error('[mobilization.controller] addShifts:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const changeEquipmentStatus = async (req, res) => {
  try {
    const { equipmentId, regNo, machine, previousStatus, newStatus, month, year, time } = req.body;

    if (!equipmentId || !regNo || !machine || !previousStatus || !newStatus || !month || !year || !time) {
      return respond(res, {
        status: HTTP.BAD_REQUEST,
        ok: false,
        message: 'Missing required fields: equipmentId, regNo, machine, previousStatus, newStatus, month, year, time',
      });
    }
    if (previousStatus === newStatus) {
      return respond(res, { status: HTTP.BAD_REQUEST, ok: false, message: 'Previous status and new status cannot be the same' });
    }

    const result = await mobilizationService.changeEquipmentStatus({ ...req.body, remarks: req.body.remarks || '' });
    respond(res, result);
  } catch (error) {
    logger.error('[mobilization.controller] changeEquipmentStatus:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

module.exports = {
  getAllMobilizations,
  getMobilizationHistory,
  getFilteredMobilizations,
  mobilizeEquipment,
  demobilizeEquipment,
  addShifts,
  changeEquipmentStatus,
};
