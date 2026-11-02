const logger = require('#shared/logger/logger')
const { sendSuccess, sendError } = require('#shared/response/response.sender')
const backchargeStatistics = require('./backcharge.statistics')

const VALID_GRANULARITIES = ['today', 'week', 'month', 'year', 'allYears']

const resolveGranularity = (value) => (VALID_GRANULARITIES.includes(value) ? value : 'month')

const getBackchargeTotals = async (req, res) => {
  try {
    const totals = await backchargeStatistics.getAllTimeTotals()
    sendSuccess(res, { success: true, message: 'Backcharge totals retrieved successfully', data: totals })
  } catch (error) {
    logger.error('[backcharge.statistics.controller] getBackchargeTotals:', error)
    sendError(res, { success: false, message: error.message })
  }
}

const getBackchargeSummary = async (req, res) => {
  try {
    const granularity = resolveGranularity(req.query.granularity)
    const summary = await backchargeStatistics.getSummary(granularity)
    sendSuccess(res, { success: true, message: 'Backcharge summary retrieved successfully', data: summary })
  } catch (error) {
    logger.error('[backcharge.statistics.controller] getBackchargeSummary:', error)
    sendError(res, { success: false, message: error.message })
  }
}

const getBackchargeSeries = async (req, res) => {
  try {
    const granularity = resolveGranularity(req.query.granularity)
    const series = await backchargeStatistics.getSeries(granularity)
    sendSuccess(res, { success: true, message: 'Backcharge series retrieved successfully', data: series })
  } catch (error) {
    logger.error('[backcharge.statistics.controller] getBackchargeSeries:', error)
    sendError(res, { success: false, message: error.message })
  }
}

const getBackchargeGrowth = async (req, res) => {
  try {
    const granularity = resolveGranularity(req.query.granularity)
    const growth = await backchargeStatistics.getGrowth(granularity)
    sendSuccess(res, { success: true, message: 'Backcharge growth retrieved successfully', data: growth })
  } catch (error) {
    logger.error('[backcharge.statistics.controller] getBackchargeGrowth:', error)
    sendError(res, { success: false, message: error.message })
  }
}

module.exports = {
  getBackchargeTotals,
  getBackchargeSummary,
  getBackchargeSeries,
  getBackchargeGrowth,
}