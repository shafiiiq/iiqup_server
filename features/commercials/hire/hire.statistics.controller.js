const logger = require('#shared/logger/logger')
const { sendSuccess, sendError } = require('#shared/response/response.sender')
const hireOrderStatistics = require('./hire.statistics')

const VALID_GRANULARITIES = ['today', 'week', 'month', 'year', 'allYears']

const resolveGranularity = (value) => (VALID_GRANULARITIES.includes(value) ? value : 'month')

const getHireOrderTotals = async (req, res) => {
  try {
    const totals = await hireOrderStatistics.getAllTimeTotals()
    sendSuccess(res, { success: true, message: 'Purchase Order totals retrieved successfully', data: totals })
  } catch (error) {
    logger.error('[hire.statistics.controller] getHireOrderTotals:', error)
    sendError(res, { success: false, message: error.message })
  }
}

const getHireOrderSummary = async (req, res) => {
  try {
    const granularity = resolveGranularity(req.query.granularity)
    const summary = await hireOrderStatistics.getSummary(granularity)
    sendSuccess(res, { success: true, message: 'Purchase Order summary retrieved successfully', data: summary })
  } catch (error) {
    logger.error('[hire.statistics.controller] getHireOrderSummary:', error)
    sendError(res, { success: false, message: error.message })
  }
}

const getHireOrderSeries = async (req, res) => {
  try {
    const granularity = resolveGranularity(req.query.granularity)
    const series = await hireOrderStatistics.getSeries(granularity)
    sendSuccess(res, { success: true, message: 'Purchase Order series retrieved successfully', data: series })
  } catch (error) {
    logger.error('[hire.statistics.controller] getHireOrderSeries:', error)
    sendError(res, { success: false, message: error.message })
  }
}

const getHireOrderGrowth = async (req, res) => {
  try {
    const granularity = resolveGranularity(req.query.granularity)
    const growth = await hireOrderStatistics.getGrowth(granularity)
    sendSuccess(res, { success: true, message: 'Purchase Order growth retrieved successfully', data: growth })
  } catch (error) {
    logger.error('[hire.statistics.controller] getHireOrderGrowth:', error)
    sendError(res, { success: false, message: error.message })
  }
}

module.exports = {
  getHireOrderTotals,
  getHireOrderSummary,
  getHireOrderSeries,
  getHireOrderGrowth,
}