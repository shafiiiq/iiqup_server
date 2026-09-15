const HireOrder = require('./hire.model')
const { paginate } = require('#shared/pagination/pagination')
const { wrapServiceError } = require('./hire.helper')

const HIRE_ORDER_LIST_FIELDS =
  'hireOrderRef date company totalAmount workflowStatus pmSigned managerSigned ceoSigned accountsSigned signatures isAmendmented'

const getHireOrders = async (pagination) => {
  try {
    return await paginate(HireOrder, {}, pagination, { sort: { createdAt: -1 } })
  } catch (error) {
    throw wrapServiceError('getHireOrders', error)
  }
}

const getHireOrderByRef = async (refNo) => {
  try {
    const hireOrder = await HireOrder.findOne({ hireOrderRef: refNo.trim() })
    if (!hireOrder) throw new Error('Hire order not found')
    return hireOrder
  } catch (error) {
    throw wrapServiceError('getHireOrderByRef', error)
  }
}

const getAllCompanyDetails = async () => {
  try {
    const hireOrders = await HireOrder.find({}, 'company hireOrderRef date')
    return hireOrders.map((h) => ({
      hireOrderRef: h.hireOrderRef,
      date: h.date,
      vendor: h.company.vendor,
      attention: h.company.attention,
      designation: h.company.designation,
    }))
  } catch (error) {
    throw wrapServiceError('getAllCompanyDetails', error)
  }
}

const getLatestHireOrderRef = async () => {
  try {
    const latest = await HireOrder.findOne({}).sort({ createdAt: -1 }).select('hireOrderRef')
    if (!latest?.hireOrderRef) return null

    const match = latest.hireOrderRef.match(/^ATE(\d+)\/HO/)
    return match ? match[1] : null
  } catch (error) {
    throw wrapServiceError('getLatestHireOrderRef', error)
  }
}

const getNextHireOrderCounter = async () => {
  try {
    const latest = await HireOrder.findOne({}).sort({ hireOrderCounter: -1 }).select('hireOrderCounter')
    return latest ? (latest.hireOrderCounter || 0) + 1 : 1
  } catch (error) {
    throw wrapServiceError('getNextHireOrderCounter', error)
  }
}

const PENDING_SIGNATURE_RULES = () => [
  { envKey: process.env.MANAGER, query: { managerSigned: { $ne: true }, workflowStatus: { $in: ['hire_order_uploaded', 'hire_order_amended'] } } },
  { envKey: process.env.PURCHASE_MANAGER, query: { managerSigned: true, pmSigned: { $ne: true }, workflowStatus: { $in: ['manager_approved'] } } },
  { envKey: process.env.WORKSHOP_MANAGER, query: { managerSigned: true, pmSigned: { $ne: true }, workflowStatus: { $in: ['manager_approved'] } } },
  {
    envKey: process.env.ACCOUNTS,
    query: { managerSigned: true, pmSigned: true, accountsSigned: { $ne: true }, workflowStatus: { $in: ['purchase_approved'] } },
  },
  {
    envKey: process.env.CEO,
    query: {
      managerSigned: true, pmSigned: true, accountsSigned: true, ceoSigned: { $ne: true },
      workflowStatus: { $in: ['accounts_approved'] },
      'signatures.authorizedSignatoryTitle': { $nin: ['MANAGING DIRECTOR'] },
    },
  },
  {
    envKey: process.env.MD,
    query: {
      managerSigned: true, pmSigned: true, accountsSigned: true, ceoSigned: { $ne: true },
      workflowStatus: { $in: ['accounts_approved'] },
      'signatures.authorizedSignatoryTitle': 'MANAGING DIRECTOR',
    },
  },
]

const getPendingSignatures = async (uniqueCode) => {
  try {
    const matched = PENDING_SIGNATURE_RULES().find((r) => r.envKey === uniqueCode)
    if (!matched) return []
    return await HireOrder.find(matched.query).select(HIRE_ORDER_LIST_FIELDS).sort({ createdAt: -1 }).lean()
  } catch (error) {
    throw wrapServiceError('getPendingSignatures', error)
  }
}

const SIGNED_BY_USER_RULES = () => [
  { envKey: process.env.PURCHASE_MANAGER, query: { pmSigned: true } },
  { envKey: process.env.WORKSHOP_MANAGER, query: { pmSigned: true } },
  { envKey: process.env.MANAGER, query: { managerSigned: true } },
  { envKey: process.env.CEO, query: { ceoSigned: true, 'signatures.authorizedSignatoryTitle': { $nin: ['MANAGING DIRECTOR'] } } },
  { envKey: process.env.MD, query: { ceoSigned: true, 'signatures.authorizedSignatoryTitle': 'MANAGING DIRECTOR' } },
  { envKey: process.env.ACCOUNTS, query: { accountsSigned: true } },
]

const getSignedByUser = async (uniqueCode) => {
  try {
    const matched = SIGNED_BY_USER_RULES().find((r) => r.envKey === uniqueCode)
    if (!matched) return []
    return await HireOrder.find(matched.query).select(HIRE_ORDER_LIST_FIELDS).sort({ createdAt: -1 }).lean()
  } catch (error) {
    throw wrapServiceError('getSignedByUser', error)
  }
}

module.exports = {
  getHireOrders,
  getHireOrderByRef,
  getAllCompanyDetails,
  getLatestHireOrderRef,
  getNextHireOrderCounter,
  getPendingSignatures,
  getSignedByUser,
}