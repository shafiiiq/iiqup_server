const Quotation = require('./quotation.model')
const { paginate } = require('#shared/pagination/pagination')
const { wrapServiceError } = require('./quotation.helper')

const getQuotations = async (pagination) => {
  try {
    return await paginate(Quotation, {}, pagination, {
      sort: { createdAt: -1 },
      select: '-items.image',
    })
  } catch (error) {
    throw wrapServiceError('getQuotations', error)
  }
}

const getQuotationByRef = async (refNo) => {
  try {
    const quotation = await Quotation.findOne({ quotationRef: refNo })
    if (!quotation) throw new Error('Quotation not found')
    return quotation
  } catch (error) {
    throw wrapServiceError('getQuotationByRef', error)
  }
}

const getAllCompanyDetails = async () => {
  try {
    const quotations = await Quotation.find({}, 'company quotationRef date')
    return quotations.map((q) => ({
      quotationRef: q.quotationRef,
      date: q.date,
      vendor: q.company.vendor,
      attention: q.company.attention,
      designation: q.company.designation,
    }))
  } catch (error) {
    throw wrapServiceError('getAllCompanyDetails', error)
  }
}

const getLatestQuotationRefNo = async () => {
  try {
    const latest = await Quotation.findOne({}).sort({ createdAt: -1 }).select('quotationRef')
    return latest?.quotationRef || null
  } catch (error) {
    throw wrapServiceError('getLatestQuotationRefNo', error)
  }
}

const getLatestQuotation = async () => {
  try {
    return await Quotation.findOne({}).sort({ createdAt: -1 })
  } catch (error) {
    throw wrapServiceError('getLatestQuotation', error)
  }
}

const getNextQuotationCounter = async () => {
  try {
    const latest = await Quotation.findOne({}).sort({ quotationCounter: -1 }).select('quotationCounter')
    return latest ? latest.quotationCounter + 1 : 1
  } catch (error) {
    throw wrapServiceError('getNextQuotationCounter', error)
  }
}

const getQuotationsByDateRange = async (startDate, endDate) => {
  try {
    return await Quotation.find({
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
    }).sort({ createdAt: -1 })
  } catch (error) {
    throw wrapServiceError('getQuotationsByDateRange', error)
  }
}

const getQuotationsByCompany = async (vendorName) => {
  try {
    return await Quotation.find({ 'company.vendor': { $regex: vendorName, $options: 'i' } }).sort({ createdAt: -1 })
  } catch (error) {
    throw wrapServiceError('getQuotationsByCompany', error)
  }
}

module.exports = {
  getQuotations,
  getQuotationByRef,
  getAllCompanyDetails,
  getLatestQuotationRefNo,
  getLatestQuotation,
  getNextQuotationCounter,
  getQuotationsByDateRange,
  getQuotationsByCompany,
}