const logger = require('../../../shared/logger/logger');

const HTTP = require('../../../shared/constants/httpStatus.constant.js');
const Mechanic = require('../../mechanic/mechanic.model');
const attendanceController = require('../attendance.controller');

const parseZKTecoAttendanceData = (dataString) => {
  try {
    const lines = dataString.split('\n').filter((line) => line.trim());
    const records = [];

    for (const line of lines) {
      const parts = line.split('\t');

      if (parts.length >= 4) {
        const pinStr = parts[0].trim();
        const timestamp = parts[1]
          ? parts[1].trim()
          : new Date().toISOString().replace('T', ' ').substring(0, 19);
        const workCode = parts[4] ? parts[4].trim() : '0';
        const timestampMs = Date.parse(timestamp);
        const pinNumber = parseInt(pinStr, 10) || 0;
        const stableId = Number.isFinite(timestampMs)
          ? timestampMs * 1000 + pinNumber
          : Date.now() * 1000 + pinNumber;

        records.push({
          pin: pinStr,
          timestamp,
          punchType: parts[2].trim(),
          verifyMode: parts[3].trim(),
          workCode,
          state: parts[2].trim(),
          work_code: workCode,
          raw: line,
          id: stableId,
        });
      }
    }

    return records.length > 0 ? records : null;
  } catch (error) {
    logger.error('[ZKTeco] Error parsing attendance data:', error);
    return null;
  }
};

const extractAttendanceData = (body) => {
  if (!body) return null;

  if (Buffer.isBuffer(body)) {
    const bodyString = body.toString();
    if (bodyString.includes('\t') || bodyString.includes('\n')) {
      return parseZKTecoAttendanceData(bodyString);
    }
    return null;
  }

  if (typeof body === 'object' && Object.keys(body).length > 0) {
    return body;
  }

  if (typeof body === 'string' && body.length > 0) {
    return parseZKTecoAttendanceData(body);
  }

  return null;
};

const processAttendanceRecord = async (record) => {
  const now = new Date();
  const timestampParts = record.timestamp ? record.timestamp.split(' ') : [];
  const currentTime =
    timestampParts.length > 1
      ? timestampParts[1]
      : now.toTimeString().split(' ')[0];

  const formattedRecord = {
    id: Number.isFinite(record.id) ? record.id : Date.now() * 1000,
    pin: record.pin,
    emp_name: `Employee ${record.pin}`,
    punch_time: currentTime,
    state: record.punchType || record.state || '255',
    work_code: record.workCode || record.work_code || '0',
    photo: '',
    location: 'ZKTeco Device',
  };

  await attendanceController.sendToServer({ body: formattedRecord });
};

const setZktecoPin = async (_id, zktecoPin) => {
  const mechanic = await Mechanic.findById(_id);

  if (!mechanic) {
    return null;
  }

  mechanic.zktecoPin = zktecoPin;
  return mechanic.save();
};

module.exports = {
  parseZKTecoAttendanceData,
  extractAttendanceData,
  processAttendanceRecord,
  setZktecoPin,
};