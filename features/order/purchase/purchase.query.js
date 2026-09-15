const logger = require('#shared/logger/logger')
const PurchaseOrder = require('./purchase.model')
const { paginate } = require('#shared/pagination/pagination')
const { wrapServiceError } = require('./purchase.helper')

const PurchaseOrder_LIST_FIELDS =
  'purchaseorderRef date company equipments totalAmount workflowStatus pmSigned managerSigned ceoSigned accountsSigned signatures'

const getPurchaseOrders = async (pagination) => {
  try {
    return await paginate(PurchaseOrder, {}, pagination, { sort: { createdAt: -1 } })
  } catch (error) {
    throw wrapServiceError('getPurchaseOrders', error)
  }
}

const getPurchaseOrderByRef = async (refNo) => {
  try {
    const purchaseorder = await PurchaseOrder.findOne({ purchaseorderRef: refNo })
    if (!purchaseorder) throw new Error('Purchase Order not found')
    return purchaseorder
  } catch (error) {
    throw wrapServiceError('getPurchaseOrderByRef', error)
  }
}

const PENDING_SIGNATURE_RULES = () => [
  {
    envKey: process.env.MANAGER,
    query: { managerSigned: { $ne: true }, workflowStatus: { $in: ['purchaseorder_uploaded', 'purchaseorder_amended'] } },
  },
  {
    envKey: process.env.PURCHASE_MANAGER,
    query: { managerSigned: true, pmSigned: { $ne: true }, workflowStatus: { $in: ['operation_manager_approved'] } },
  },
  {
    envKey: process.env.WORKSHOP_MANAGER,
    query: { managerSigned: true, pmSigned: { $ne: true }, workflowStatus: { $in: ['operation_manager_approved'] } },
  },
  {
    envKey: process.env.ACCOUNTS,
    query: {
      managerSigned: true,
      pmSigned: true,
      accountsSigned: { $ne: true },
      workflowStatus: { $in: ['purchase_manager_approved'] },
    },
  },
  {
    envKey: process.env.CEO,
    query: {
      managerSigned: true,
      pmSigned: true,
      accountsSigned: true,
      ceoSigned: { $ne: true },
      workflowStatus: { $in: ['accounts_approved'] },
      'signatures.authorizedSignatoryTitle': { $nin: ['MANAGING DIRECTOR'] },
    },
  },
  {
    envKey: process.env.MD,
    query: {
      managerSigned: true,
      pmSigned: true,
      accountsSigned: true,
      ceoSigned: { $ne: true },
      workflowStatus: { $in: ['accounts_approved'] },
      'signatures.authorizedSignatoryTitle': 'MANAGING DIRECTOR',
    },
  },
]

const getPendingSignatures = async (uniqueCode) => {
  try {
    const matched = PENDING_SIGNATURE_RULES().find((r) => r.envKey === uniqueCode)
    if (!matched) return []

    return await PurchaseOrder.find(matched.query).select(PurchaseOrder_LIST_FIELDS).sort({ createdAt: -1 }).lean()
  } catch (error) {
    throw wrapServiceError('getPendingSignatures', error)
  }
}

const SIGNED_BY_USER_RULES = () => [
  { envKey: process.env.PURCHASE_MANAGER, query: { pmSigned: true } },
  { envKey: process.env.WORKSHOP_MANAGER, query: { pmSigned: true } },
  { envKey: process.env.MANAGER, query: { managerSigned: true } },
  {
    envKey: process.env.CEO,
    query: { ceoSigned: true, 'signatures.authorizedSignatoryTitle': { $nin: ['MANAGING DIRECTOR'] } },
  },
  { envKey: process.env.MD, query: { ceoSigned: true, 'signatures.authorizedSignatoryTitle': 'MANAGING DIRECTOR' } },
  { envKey: process.env.ACCOUNTS, query: { accountsSigned: true } },
]

const checkWhoSignedPurchaseOrder = async (uniqueCode) => {
  try {
    const matched = SIGNED_BY_USER_RULES().find((r) => r.envKey === uniqueCode)
    if (!matched) return []

    return await PurchaseOrder.find(matched.query).select(PurchaseOrder_LIST_FIELDS).sort({ createdAt: -1 }).lean()
  } catch (error) {
    throw wrapServiceError('checkWhoSignedPurchaseOrder', error)
  }
}

const getAllCompanyDetails = async () => {
  try {
    const purchaseorders = await PurchaseOrder.find({}, 'company purchaseorderRef date')
    return purchaseorders.map((purchaseorder) => ({
      purchaseorderRef: purchaseorder.purchaseorderRef,
      date: purchaseorder.date,
      vendor: purchaseorder.company.vendor,
      attention: purchaseorder.company.attention,
      designation: purchaseorder.company.designation,
    }))
  } catch (error) {
    throw wrapServiceError('getAllCompanyDetails', error)
  }
}

const getLatestPurchaseOrderRefNo = async () => {
  try {
    const latestPurchaseOrder = await PurchaseOrder.findOne({}).sort({ createdAt: -1 }).select('purchaseorderRef')
    if (!latestPurchaseOrder?.purchaseorderRef) return null

    const match = latestPurchaseOrder.purchaseorderRef.match(/^ATE(\d+)\/SP/)
    return match ? match[1] : null
  } catch (error) {
    throw wrapServiceError('getLatestPurchaseOrderRefNo', error)
  }
}

const getLatestPurchaseOrder = async () => {
  try {
    return await PurchaseOrder.findOne({}).sort({ createdAt: -1 })
  } catch (error) {
    throw wrapServiceError('getLatestPurchaseOrder', error)
  }
}

const getNextPurchaseOrderCounter = async () => {
  try {
    const latestPurchaseOrder = await PurchaseOrder.findOne({}).sort({ purchaseorderCounter: -1 }).select('purchaseorderCounter')
    return latestPurchaseOrder ? latestPurchaseOrder.purchaseorderCounter + 1 : 1
  } catch (error) {
    throw wrapServiceError('getNextPurchaseOrderCounter', error)
  }
}

const getPurchaseOrdersByDateRange = async (startDate, endDate) => {
  try {
    return await PurchaseOrder.find({ createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } }).sort({
      createdAt: -1,
    })
  } catch (error) {
    throw wrapServiceError('getPurchaseOrdersByDateRange', error)
  }
}

const getPurchaseOrdersByCompany = async (vendorName) => {
  try {
    return await PurchaseOrder.find({ 'company.vendor': { $regex: vendorName, $options: 'i' } }).sort({ createdAt: -1 })
  } catch (error) {
    throw wrapServiceError('getPurchaseOrdersByCompany', error)
  }
}

const getPurchaseOrderOfEquipment = async (regNo) => {
  try {
    const regex = new RegExp(`^${regNo}\\s*–`, 'i')
    return await PurchaseOrder.find({ equipments: { $elemMatch: { $regex: regex } } }).sort({ createdAt: -1 })
  } catch (error) {
    logger.error('[purchase.query] getPurchaseOrderOfEquipment:', error)
    throw new Error(`Error fetching PurchaseOrders by registration number: ${error.message}`)
  }
}

const getPurchaseOrderOfStocks = async () => {
  try {
    return await PurchaseOrder.find({ equipment: { $regex: /^For Stock$/i } }).sort({ createdAt: -1 })
  } catch (error) {
    throw wrapServiceError('getPurchaseOrderOfStocks', error)
  }
}

const getPurchaseOrdersOfEquipments = async () => {
  try {
    return await PurchaseOrder.find({ equipment: { $regex: /^For all equipment$/i } }).sort({ createdAt: -1 })
  } catch (error) {
    throw wrapServiceError('getPurchaseOrdersOfEquipments', error)
  }
}

module.exports = {
  getPurchaseOrders,
  getPurchaseOrderByRef,
  getPendingSignatures,
  checkWhoSignedPurchaseOrder,
  getAllCompanyDetails,
  getLatestPurchaseOrderRefNo,
  getLatestPurchaseOrder,
  getNextPurchaseOrderCounter,
  getPurchaseOrdersByDateRange,
  getPurchaseOrdersByCompany,
  getPurchaseOrderOfEquipment,
  getPurchaseOrderOfStocks,
  getPurchaseOrdersOfEquipments,
}