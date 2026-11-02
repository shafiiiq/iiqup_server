const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { respond } = require('#shared/response/response.respond');
const idleRosterService = require('./idle-roster.service');

const getLatestRoster = async (req, res) => {
  try {
    const result = await idleRosterService.fetchLatestRoster();
    respond(res, result);
  } catch (error) {
    logger.error('[idle-roster.controller] getLatestRoster:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const getRosterHistory = async (req, res) => {
  try {
    const result = await idleRosterService.fetchRosterHistory(req.pagination);
    respond(res, result);
  } catch (error) {
    logger.error('[idle-roster.controller] getRosterHistory:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const getRosterById = async (req, res) => {
  try {
    const result = await idleRosterService.fetchRosterById(req.params.id);
    respond(res, result);
  } catch (error) {
    logger.error('[idle-roster.controller] getRosterById:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const saveRosterUpdate = async (req, res) => {
  try {
    const result = await idleRosterService.saveRosterUpdate(req.body.entries);
    respond(res, result);
  } catch (error) {
    logger.error('[idle-roster.controller] saveRosterUpdate:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

module.exports = {
  getLatestRoster,
  getRosterHistory,
  getRosterById,
  saveRosterUpdate,
};