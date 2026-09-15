const logger = require('#shared/logger/logger')
const { sendSuccess, sendError } = require('#shared/response/response.sender')
const purchaseOrderStatistics = require('./purchase.statistics')

const VALID_GRANULARITIES = ['today', 'week', 'month', 'year', 'allYears']

const resolveGranularity = (value) => (VALID_GRANULARITIES.includes(value) ? value : 'month')

const getPurchaseOrderTotals = async (req, res) => {
  try {
    const totals = await purchaseOrderStatistics.getAllTimeTotals()
    sendSuccess(res, { success: true, message: 'Purchase Order totals retrieved successfully', data: totals })
  } catch (error) {
    logger.error('[purchase.statistics.controller] getPurchaseOrderTotals:', error)
    sendError(res, { success: false, message: error.message })
  }
}

const getPurchaseOrderSummary = async (req, res) => {
  try {
    const granularity = resolveGranularity(req.query.granularity)
    const summary = await purchaseOrderStatistics.getSummary(granularity)
    sendSuccess(res, { success: true, message: 'Purchase Order summary retrieved successfully', data: summary })
  } catch (error) {
    logger.error('[purchase.statistics.controller] getPurchaseOrderSummary:', error)
    sendError(res, { success: false, message: error.message })
  }
}

const getPurchaseOrderSeries = async (req, res) => {
  try {
    const granularity = resolveGranularity(req.query.granularity)
    const series = await purchaseOrderStatistics.getSeries(granularity)
    sendSuccess(res, { success: true, message: 'Purchase Order series retrieved successfully', data: series })
  } catch (error) {
    logger.error('[purchase.statistics.controller] getPurchaseOrderSeries:', error)
    sendError(res, { success: false, message: error.message })
  }
}

const getPurchaseOrderGrowth = async (req, res) => {
  try {
    const granularity = resolveGranularity(req.query.granularity)
    const growth = await purchaseOrderStatistics.getGrowth(granularity)
    sendSuccess(res, { success: true, message: 'Purchase Order growth retrieved successfully', data: growth })
  } catch (error) {
    logger.error('[purchase.statistics.controller] getPurchaseOrderGrowth:', error)
    sendError(res, { success: false, message: error.message })
  }
}

module.exports = {
  getPurchaseOrderTotals,
  getPurchaseOrderSummary,
  getPurchaseOrderSeries,
  getPurchaseOrderGrowth,
}