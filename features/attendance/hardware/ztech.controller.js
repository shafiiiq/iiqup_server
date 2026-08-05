const logger = require('../../../shared/logger/logger');

const HTTP = require('../../../shared/constants/httpStatus.constant.js');
const { sendSuccess, sendError } = require('../../../shared/response/response.util');
const service = require('./ztech.service');

const handshake = async (req, res) => {
  try {
    res.status(HTTP.OK).send('OK');
  } catch (error) {
    logger.error('[ZKTeco] Error handling GET /iclock/cdata:', error);
    res.status(HTTP.INTERNAL_SERVER_ERROR).send('Error');
  }
};

const receiveAttendanceData = async (req, res) => {
  try {
    const attendanceData = service.extractAttendanceData(req.body);

    if (attendanceData) {
      for (const record of attendanceData) {
        await service.processAttendanceRecord(record);
      }
    }

    res.status(HTTP.OK).send('OK');
  } catch (error) {
    logger.error('[ZKTeco] Error handling POST /iclock/cdata:', error);
    res.status(HTTP.INTERNAL_SERVER_ERROR).send('Error');
  }
};

const ping = async (req, res) => {
  res.status(HTTP.OK).send('OK');
};

const getRequest = async (req, res) => {
  res.status(HTTP.OK).send('OK');
};

const deviceCmd = async (req, res) => {
  res.status(HTTP.OK).send('OK');
};

const addZktecoPin = async (req, res) => {
  try {
    const { _id, zktecoPin } = req.body;

    if (!_id || !zktecoPin) {
      return sendError(res, {
        success: false,
        message: 'Both _id and zktecoPin are required',
      });
    }

    const updatedMechanic = await service.setZktecoPin(_id, zktecoPin);

    if (!updatedMechanic) {
      return sendError(res, {
        success: false,
        message: 'Mechanic not found',
      });
    }

    sendSuccess(res, {
      success: true,
      message: 'ZKTeco PIN added successfully',
      data: updatedMechanic,
    });
  } catch (error) {
    logger.error('[ZKTeco] Error adding ZKTeco PIN:', error);
    sendError(res, {
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  handshake,
  receiveAttendanceData,
  ping,
  getRequest,
  deviceCmd,
  addZktecoPin,
};