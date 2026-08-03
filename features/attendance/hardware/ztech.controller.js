const service = require('./ztech.service');

const handshake = async (req, res) => {
  try {
    res.status(200).send('OK');
  } catch (error) {
    console.error('[ZKTeco] Error handling GET /iclock/cdata:', error);
    res.status(500).send('Error');
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

    res.status(200).send('OK');
  } catch (error) {
    console.error('[ZKTeco] Error handling POST /iclock/cdata:', error);
    res.status(500).send('Error');
  }
};

const ping = async (req, res) => {
  res.status(200).send('OK');
};

const getRequest = async (req, res) => {
  res.status(200).send('OK');
};

const deviceCmd = async (req, res) => {
  res.status(200).send('OK');
};

const addZktecoPin = async (req, res) => {
  try {
    const { _id, zktecoPin } = req.body;

    if (!_id || !zktecoPin) {
      return res.status(400).json({
        success: false,
        message: 'Both _id and zktecoPin are required',
      });
    }

    const updatedMechanic = await service.setZktecoPin(_id, zktecoPin);

    if (!updatedMechanic) {
      return res.status(404).json({
        success: false,
        message: 'Mechanic not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'ZKTeco PIN added successfully',
      data: updatedMechanic,
    });
  } catch (error) {
    console.error('[ZKTeco] Error adding ZKTeco PIN:', error);
    res.status(500).json({
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