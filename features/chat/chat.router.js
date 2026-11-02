const express = require('express');

const router = express.Router();

router.use(require('./list/list.router'));
router.use(require('./group/group.router'));
router.use(require('./message/message.router'));
router.use(require('./call/call.router'));

module.exports = router;