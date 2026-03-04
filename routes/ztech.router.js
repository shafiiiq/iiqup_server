const express  = require('express');
const router   = express.Router();
const Mechanic = require('../models/mechanic.model.js');

const controller = require('../controllers/attendance.controller.js');

// ─────────────────────────────────────────────────────────────────────────────
// ZKTeco Device Communication Routes
// ─────────────────────────────────────────────────────────────────────────────

// ── Raw body parsing for ZKTeco iclock endpoint ────────────────────────────────
router.use('/iclock/cdata', express.raw({ type: '*/*', limit: '10mb' }));
router.use('/iclock/cdata', express.urlencoded({ extended: true }));
router.use('/iclock/cdata', express.text());

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses ZKTeco tab-separated attendance data string into structured records.
 *
 * @param {string} dataString - Raw tab/newline-delimited string from device.
 * @returns {Array|null} Array of parsed attendance record objects, or null.
 */
const parseZKTecoAttendanceData = (dataString) => {
  try {
    const lines = dataString.split('\n').filter((line) => line.trim());
    const records = [];

    for (const line of lines) {
      const parts = line.split('\t');

      if (parts.length >= 4) {
        const now              = new Date();
        const currentTimestamp = now.toISOString().replace('T', ' ').substring(0, 19);

        records.push({
          pin:        parts[0],
          timestamp:  currentTimestamp,
          punchType:  parts[2],
          verifyMode: parts[3],
          workCode:   parts[4] || '0',
          state:      parts[2],
          work_code:  parts[4] || '0',
          raw:        line,
        });
      }
    }

    return records.length > 0 ? records : null;
  } catch (error) {
    console.error('[ZKTeco] Error parsing attendance data:', error);
    return null;
  }
};

/**
 * Processes a parsed ZKTeco attendance record and forwards it to the controller.
 *
 * @param {Object} record - Single parsed attendance record.
 */
const processAttendanceRecord = async (record) => {
  const now         = new Date();
  const currentTime = now.toTimeString().split(' ')[0];

  const formattedRecord = {
    id:         Date.now() + Math.random(),
    pin:        record.pin,
    emp_name:   `Employee ${record.pin}`,
    punch_time: currentTime,
    state:      record.punchType || record.state || '255',
    work_code:  record.workCode  || record.work_code || '0',
    photo:      '',
    location:   'ZKTeco Device',
  };

  await controller.sendToServer({ body: formattedRecord });
};

// ─────────────────────────────────────────────────────────────────────────────
// ZKTeco iclock Endpoints
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /iclock/cdata — device handshake ──────────────────────────────────────
router.get('/iclock/cdata', async (req, res) => {
  try {
    res.status(200).send('OK');
  } catch (error) {
    console.error('[ZKTeco] Error handling GET /iclock/cdata:', error);
    res.status(500).send('Error');
  }
});

// ── POST /iclock/cdata — attendance data push ─────────────────────────────────
router.post('/iclock/cdata', async (req, res) => {
  try {
    let attendanceData = null;

    if (req.body) {
      if (Buffer.isBuffer(req.body)) {
        const bodyString = req.body.toString();
        if (bodyString.includes('\t') || bodyString.includes('\n')) {
          attendanceData = parseZKTecoAttendanceData(bodyString);
        }
      } else if (typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        attendanceData = req.body;
      } else if (typeof req.body === 'string' && req.body.length > 0) {
        attendanceData = parseZKTecoAttendanceData(req.body);
      }
    }

    if (attendanceData) {
      for (const record of attendanceData) {
        await processAttendanceRecord(record);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[ZKTeco] Error handling POST /iclock/cdata:', error);
    res.status(500).send('Error');
  }
});

// ── GET /iclock/ping ───────────────────────────────────────────────────────────
router.get('/iclock/ping', async (req, res) => {
  res.status(200).send('OK');
});

// ── GET /iclock/getrequest ────────────────────────────────────────────────────
router.get('/iclock/getrequest', async (req, res) => {
  res.status(200).send('OK');
});

// ── POST /iclock/devicecmd ────────────────────────────────────────────────────
router.post('/iclock/devicecmd', async (req, res) => {
  res.status(200).send('OK');
});

// ─────────────────────────────────────────────────────────────────────────────
// Mechanic ZKTeco PIN
// ─────────────────────────────────────────────────────────────────────────────

router.put('/add-zkteco-pin', async (req, res) => {
  try {
    const { _id, zktecoPin } = req.body;

    if (!_id || !zktecoPin) {
      return res.status(400).json({
        success: false,
        message: 'Both _id and zktecoPin are required',
      });
    }

    const mechanic = await Mechanic.findById(_id);

    if (!mechanic) {
      return res.status(404).json({
        success: false,
        message: 'Mechanic not found',
      });
    }

    mechanic.zktecoPin        = zktecoPin;
    const updatedMechanic     = await mechanic.save();

    res.status(200).json({
      success: true,
      message: 'ZKTeco PIN added successfully',
      data:    updatedMechanic,
    });
  } catch (error) {
    console.error('[ZKTeco] Error adding ZKTeco PIN:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;