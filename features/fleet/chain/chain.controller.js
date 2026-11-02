const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { respond } = require('#shared/response/response.respond');
const chainService = require('./chain.service');

const getChainById = async (req, res) => {
  try {
    const result = await chainService.fetchChainByChainId(req.params.chainId);
    respond(res, result);
  } catch (error) {
    logger.error('[ChainController] getChainById:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

const getChainByRegNo = async (req, res) => {
  try {
    const result = await chainService.fetchChainByRegNo(req.params.regNo);
    respond(res, result);
  } catch (error) {
    logger.error('[ChainController] getChainByRegNo:', error);
    respond(res, { status: HTTP.INTERNAL_SERVER_ERROR, ok: false, message: error.message });
  }
};

module.exports = { getChainById, getChainByRegNo };