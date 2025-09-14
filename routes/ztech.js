const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const Mechanic = require('../models/mechanic.model.js');

// Middleware to capture raw body data for ZKTeco communication
router.use('/iclock/cdata', express.raw({type: '*/*', limit: '10mb'}));
router.use('/iclock/cdata', express.urlencoded({ extended: true }));
router.use('/iclock/cdata', express.text());

// Middleware to log all raw data
router.use('/iclock/cdata', (req, res, next) => {
  // console.log('=== ZKTeco Raw Data ===');
  // console.log('Method:', req.method);
  // console.log('Query:', req.query);
  // console.log('Headers:', req.headers);
  // console.log('Raw Body Type:', typeof req.body);
  // console.log('Raw Body Length:', req.body ? req.body.length : 0);
  // console.log('Raw Body:', req.body);
  
  if (req.body && Buffer.isBuffer(req.body)) {
    // console.log('Body as String:', req.body.toString());
  }
  // console.log('========================');
  next();
});

// Handle ZKTeco GET requests
router.get('/iclock/cdata', async (req, res) => {
  try {
    // console.log('ZKTeco GET request:', req.query);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling ZKTeco GET:', error);
    res.status(500).send('Error');
  }
});

// Handle ZKTeco POST requests - this is where attendance data comes
router.post('/iclock/cdata', async (req, res) => {
  try {
    // console.log('ZKTeco POST request:', req.query);
    
    // Parse attendance data if present
    let attendanceData = null;
    
    if (req.body) {
      if (Buffer.isBuffer(req.body)) {
        const bodyString = req.body.toString();
        // console.log('POST Body String:', bodyString);
        
        // Parse ZKTeco attendance data format
        if (bodyString.includes('\t') || bodyString.includes('\n')) {
          // console.log('ATTENDANCE DATA DETECTED:', bodyString);
          attendanceData = parseZKTecoAttendanceData(bodyString);
        }
      } else if (typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        // console.log('ATTENDANCE DATA RECEIVED:', req.body);
        attendanceData = req.body;
      } else if (typeof req.body === 'string' && req.body.length > 0) {
        // console.log('ATTENDANCE STRING DATA:', req.body);
        attendanceData = parseZKTecoAttendanceData(req.body);
      }
    }
    
    // Process attendance data and call controller
    if (attendanceData) {
      // console.log('PROCESSED ATTENDANCE DATA:', attendanceData);
      
      // Convert ZKTeco format to your format and call controller
      for (const record of attendanceData) {
        // Get current time instead of parsing potentially old timestamp
        const now = new Date();
        const currentTime = now.toTimeString().split(' ')[0]; // Gets HH:MM:SS format
        
        const formattedRecord = {
          id: Date.now() + Math.random(), // Ensure unique ID
          pin: record.pin,
          emp_name: `Employee ${record.pin}`,
          punch_time: currentTime, // Use current time instead of parsed timestamp
          state: record.punchType || record.state || '255',
          work_code: record.workCode || record.work_code || '0',
          photo: '',
          location: 'ZKTeco Device'
        };
        
        // console.log('FORMATTED RECORD:', formattedRecord);
        
        // Call your existing controller function
        const mockReq = { body: formattedRecord };
        const mockRes = {
          status: (code) => ({ 
            // json: (data) => console.log('Controller response:', data),
            // send: (message) => console.log('Controller response:', message)
          }),
          // json: (data) => console.log('Controller response:', data),
          // send: (message) => console.log('Controller response:', message)
        };
        
        await attendanceController.sendToServer(mockReq, mockRes);
      }
    }
    
    // Respond based on request type
    if (req.query.table === 'ATTLOG') {
      res.status(200).send('OK'); // Changed from GET STAMP=0 to OK
    } else if (req.query.table === 'OPERLOG') {
      res.status(200).send('OK');
    } else {
      res.status(200).send('OK');
    }
    
  } catch (error) {
    console.error('Error handling ZKTeco POST:', error);
    res.status(500).send('Error');
  }
});

// Enhanced function to parse ZKTeco attendance data format
function parseZKTecoAttendanceData(dataString) {
  try {
    // console.log('Parsing data string:', dataString);
    const lines = dataString.split('\n').filter(line => line.trim());
    const attendanceRecords = [];
    
    for (const line of lines) {
      // Handle both tab-separated and other formats
      const parts = line.split('\t');
      // console.log('Line parts:', parts);
      
      if (parts.length >= 4) {
        // Get current time for live data
        const now = new Date();
        const currentTimestamp = now.toISOString().replace('T', ' ').substring(0, 19);
        
        const record = {
          pin: parts[0],
          timestamp: currentTimestamp, // Use current timestamp
          punchType: parts[2],
          verifyMode: parts[3],
          workCode: parts[4] || '0',
          state: parts[2], // Add state field
          work_code: parts[4] || '0', // Add work_code field
          raw: line
        };
        attendanceRecords.push(record);
        // console.log('PARSED ATTENDANCE RECORD:', record);
      }
    }
    
    return attendanceRecords.length > 0 ? attendanceRecords : null;
  } catch (error) {
    console.error('Error parsing attendance data:', error);
    return null;
  }
}

// Handle ping requests
router.get('/iclock/ping', async (req, res) => {
  // console.log('ZKTeco ping:', req.query);
  res.status(200).send('OK');
});

// Handle getrequest
router.get('/iclock/getrequest', async (req, res) => {
  // console.log('ZKTeco getrequest:', req.query);
  res.status(200).send('OK');
});

// Additional endpoint for device information
router.post('/iclock/devicecmd', async (req, res) => {
  // console.log('ZKTeco device command:', req.query, req.body);
  res.status(200).send('OK');
});

// Add this to your mechanic routes temporarily
router.put('/add-zkteco-pin', async (req, res) => {
  try {
    const { _id, zktecoPin } = req.body;
    
    // Add validation for required fields
    if (!_id || !zktecoPin) {
      return res.status(400).json({
        success: false,
        message: 'Both _id and zktecoPin are required'
      });
    }

    // Find the mechanic first
    const mechanic = await Mechanic.findById(_id);
    
    if (!mechanic) {
      return res.status(404).json({
        success: false,
        message: 'Mechanic not found'
      });
    }

    // Update the zktecoPin
    mechanic.zktecoPin = zktecoPin;
    
    // Save the changes - await the save operation
    const updatedMechanic = await mechanic.save();

    // console.log('Updated mechanic:', updatedMechanic);

    res.status(200).json({
      success: true,
      message: 'ZKTeco PIN added successfully',
      data: updatedMechanic
    });
  } catch (error) {
    console.error('Error adding ZKTeco PIN:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;