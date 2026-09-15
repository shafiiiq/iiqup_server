const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status')
const { sendSuccess, sendError } = require('#shared/response/response.sender');
const {
  getMonthYearString,
  getFormattedDateString,
  isOlderThanCutoff,
  getCutoffMonthYear,
  formatValidationError,
  buildAttendanceFilter,
} = require('./mechanic.helper');
const mechanicServices = require('./mechanic.service');


const addMechanic = async (req, res) => {
  try {
    const result = await mechanicServices.insertMechanics(req.body);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] addMechanic:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

const getMechanic = async (req, res) => {
  try {
    const result = await mechanicServices.fetchMechanic();

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] getMechanic:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

const getMechanicById = async (req, res) => {
  try {
    const result = await mechanicServices.fetchMechanicById(req.params.id);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] getMechanic:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

const updateMechanic = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Mechanic ID is required' });
    }

    const result = await mechanicServices.mechanicUpdate(id, updateData);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] updateMechanic:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

const deleteMechanic = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Mechanic ID is required' });
    }

    const result = await mechanicServices.mechanicDelete(id);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] deleteMechanic:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

const addToolkit = async (req, res) => {
  try {
    const { mechanicId } = req.params;
    const toolkitData = req.body;

    if (!mechanicId) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'Mechanic ID is required' });
    }

    const result = await mechanicServices.addToolkit(mechanicId, toolkitData);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] addToolkit:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

const getAttendance = async (req, res) => {
  try {
    const { zktecoPin } = req.params;

    if (!zktecoPin) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ success: false, message: 'zktecoPin is required' });
    }

    const result = await mechanicServices.fetchAttendance(zktecoPin, req.query, req.pagination);

    console.log(result);
    

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] getAttendance:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

const getRecentActivity = async (req, res) => {
  try {
    const { limit } = req.query;

    const result = await mechanicServices.fetchRecentActivity(limit);

    sendSuccess(res, result);
  } catch (error) {
    logger.error('[Mechanic] getRecentActivity:', error);
    res
      .status(error.status || HTTP.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

module.exports = {
  addMechanic,
  getMechanic,
  getMechanicById,
  updateMechanic,
  deleteMechanic,
  addToolkit,
  getAttendance,
  getRecentActivity,
};