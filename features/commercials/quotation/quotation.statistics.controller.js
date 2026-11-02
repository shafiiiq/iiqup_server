const logger = require('#shared/logger/logger')
const { sendSuccess, sendError } = require('#shared/response/response.sender')
const quotationStatistics = require('./quotation.statistics')

const VALID_GRANULARITIES = ['today', 'week', 'month', 'year', 'allYears']

const resolveGranularity = (value) => (VALID_GRANULARITIES.includes(value) ? value : 'month')

const getQuotationTotals = async (req, res) => {
  try {
    const totals = await quotationStatistics.getAllTimeTotals()
    sendSuccess(res, { success: true, message: 'Purchase Order totals retrieved successfully', data: totals })
  } catch (error) {
    logger.error('[quotation.statistics.controller] getQuotationTotals:', error)
    sendError(res, { success: false, message: error.message })
  }
}

const getQuotationSummary = async (req, res) => {
  try {
    const granularity = resolveGranularity(req.query.granularity)
    const summary = await quotationStatistics.getSummary(granularity)
    sendSuccess(res, { success: true, message: 'Purchase Order summary retrieved successfully', data: summary })
  } catch (error) {
    logger.error('[quotation.statistics.controller] getQuotationSummary:', error)
    sendError(res, { success: false, message: error.message })
  }
}

const getQuotationSeries = async (req, res) => {
  try {
    const granularity = resolveGranularity(req.query.granularity)
    const series = await quotationStatistics.getSeries(granularity)
    sendSuccess(res, { success: true, message: 'Purchase Order series retrieved successfully', data: series })
  } catch (error) {
    logger.error('[quotation.statistics.controller] getQuotationSeries:', error)
    sendError(res, { success: false, message: error.message })
  }
}

const getQuotationGrowth = async (req, res) => {
  try {
    const granularity = resolveGranularity(req.query.granularity)
    const growth = await quotationStatistics.getGrowth(granularity)
    sendSuccess(res, { success: true, message: 'Purchase Order growth retrieved successfully', data: growth })
  } catch (error) {
    logger.error('[quotation.statistics.controller] getQuotationGrowth:', error)
    sendError(res, { success: false, message: error.message })
  }
}

module.exports = {
  getQuotationTotals,
  getQuotationSummary,
  getQuotationSeries,
  getQuotationGrowth,
}