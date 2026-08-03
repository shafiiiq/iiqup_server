const express = require('express');
const router = express.Router();
const controller = require('./ztech.controller');

router.use('/iclock/cdata', express.raw({ type: '*/*', limit: '10mb' }));
router.use('/iclock/cdata', express.urlencoded({ extended: true }));
router.use('/iclock/cdata', express.text());

router.get('/iclock/cdata', controller.handshake);
router.post('/iclock/cdata', controller.receiveAttendanceData);
router.get('/iclock/ping', controller.ping);
router.get('/iclock/getrequest', controller.getRequest);
router.post('/iclock/devicecmd', controller.deviceCmd);
router.put('/add-zkteco-pin', controller.addZktecoPin);

module.exports = router;