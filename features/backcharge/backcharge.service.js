const HTTP = require('#shared/response/response.status')
const Backcharge = require('./backcharge.model')
const { paginate } = require('#shared/pagination/pagination')
const { createNotification } = require('#core/notification/notification.service')
const PushNotificationService = require('#core/notification/notification.push')
const wsUtils = require('#core/socket/socket.io')
const dashboardServices = require('#features/dashboard/dashboard.service')

const wrapServiceError = (serviceName, error) =>
  new Error(`[BackchargeService] ${serviceName}:${error.message}`, { cause: error })

const notify = async (notifPayload, recipient, title, description, priority = 'high') => {
  const notification = await createNotification({ ...notifPayload, recipient, time: new Date() })

  await PushNotificationService.sendGeneralNotification(
    recipient,
    title,
    description,
    priority,
    'normal',
    notification.data._id.toString()
  )
}

const buildTextLines = (...lines) => {
  const normalized = lines.filter((line) => typeof line === 'string' && line.trim() !== '').map((line) => line.trim())

  return {
    combinedText: normalized.join(' '),
    lines: normalized.map((text, index) => ({ lineNumber: index + 1, text })),
  }
}

const resolveSupplierCode = async (supplierName) => {
  const existing = await Backcharge.findOne({
    supplierName: { $regex: new RegExp(`^${supplierName.trim()}$`, 'i') },
    supplierCode: { $ne: null },
  })
    .select('supplierCode')
    .lean()

  if (existing) return existing.supplierCode

  const last = await Backcharge.findOne({ supplierCode: { $ne: null } })
    .sort({ createdAt: -1 })
    .select('supplierCode')
    .lean()

  if (last?.supplierCode) {
    const lastNumber = parseInt(last.supplierCode.split('-')[1]) || 0
    return `SUP-${String(lastNumber + 1).padStart(3, '0')}`
  }

  return 'SUP-001'
}

const resolveSupplierMail = async (supplierCode) => {
  if (!supplierCode) return null

  const record = await Backcharge.findOne({ supplierCode, supplierMail: { $ne: null, $exists: true } })
    .select('supplierMail')
    .lean()

  return record?.supplierMail || null
}

const getAllBackchargeReports = async (pagination = { page: 1, limit: 20, skip: 0 }) => {
  try {
    return await paginate(Backcharge, {}, pagination, { sort: { createdAt: -1 } })
  } catch (error) {
    throw wrapServiceError('getAllBackchargeReports', error)
  }
}

const getBackchargeById = async (id) => {
  try {
    return await Backcharge.findById(id).lean()
  } catch (error) {
    throw wrapServiceError('getBackchargeById', error)
  }
}

const getBackchargeByRefNo = async (refNo) => {
  try {
    return await Backcharge.findOne({ refNo }).lean()
  } catch (error) {
    throw wrapServiceError('getBackchargeByRefNo', error)
  }
}

const getLatestBackchargeRef = async () => {
  try {
    const latest = await Backcharge.findOne().sort({ createdAt: -1 }).select('refNo').lean()
    if (!latest?.refNo) return 140

    const newFormat = latest.refNo.match(/^ATE-BC-\d{8}-(\d+)$/)
    if (newFormat) return parseInt(newFormat[1], 10) || 140

    const legacyFormat = latest.refNo.match(/^ATE(\d+)-/)
    if (legacyFormat) return parseInt(legacyFormat[1], 10) || 140

    return 140
  } catch (error) {
    throw wrapServiceError('getLatestBackchargeRef', error)
  }
}

const searchEquipmentByPlate = async (plateNo) => {
  try {
    const results = await Backcharge.find({ plateNo: new RegExp(plateNo, 'i') })
      .select('plateNo equipmentType model supplierName contactPerson')
      .limit(10)
      .lean()

    return results.reduce((acc, cur) => {
      if (!acc.find((i) => i.plateNo === cur.plateNo)) acc.push(cur)
      return acc
    }, [])
  } catch (error) {
    throw wrapServiceError('searchEquipmentByPlate', error)
  }
}

const searchSuppliers = async (supplierName) => {
  try {
    const results = await Backcharge.find({ supplierName: new RegExp(supplierName, 'i') })
      .select('supplierName contactPerson')
      .limit(10)
      .lean()

    return results.reduce((acc, cur) => {
      if (!acc.find((i) => i.name === cur.supplierName)) acc.push({ name: cur.supplierName, contactPerson: cur.contactPerson })
      return acc
    }, [])
  } catch (error) {
    throw wrapServiceError('searchSuppliers', error)
  }
}

const searchSites = async (siteLocation) => {
  try {
    const results = await Backcharge.find({ siteLocation: new RegExp(siteLocation, 'i') })
      .select('siteLocation')
      .limit(10)
      .lean()

    return results.reduce((acc, cur) => {
      if (!acc.find((i) => i.location === cur.siteLocation)) acc.push({ location: cur.siteLocation })
      return acc
    }, [])
  } catch (error) {
    throw wrapServiceError('searchSites', error)
  }
}

const addBackcharge = async (data) => {
  try {
    const supplierCode = await resolveSupplierCode(data.supplierName)
    const supplierMail = await resolveSupplierMail(supplierCode)

    const newBackcharge = new Backcharge({
      refNo: data.refNo,
      equipmentType: data.equipmentType,
      plateNo: data.plateNo,
      model: data.model,
      supplierName: data.supplierName,
      contactPerson: data.contactPerson,
      siteLocation: data.siteLocation,
      date: data.date,
      supplierCode,
      supplierMail,
      scopeOfWork: buildTextLines(data.scopeOfWork, data.scopeLine2Text),
      workshopComments: buildTextLines(data.workshopComments, data.workSummaryLine2, data.workSummaryLine3, data.workSummaryLine4),
      sparePartsTable: data.tableRows || [],
      workDate: data.workDate || '',
      costSummary: {
        sparePartsCost: parseFloat(data.sparePartsCost) || 0,
        labourCharges: parseFloat(data.labourCharges) || 0,
        totalCost: parseFloat(data.totalCost) || 0,
        approvedDeduction: parseFloat(data.approvedDeduction) || 0,
      },
      signatures: {
        workshopManager: { signedBy: 'Firoz Khan' },
        purchaseManager: { signedBy: 'Abdul Malik' },
        operationsManager: { signedBy: 'Suresh Kanth' },
        authorizedSignatory: {
          signedBy: data.authorizedSignatoryName || 'Ahammed Kamal',
          authorizedSignatoryMode: data.authorizedSignatoryMode || 'CEO',
          authorizedSignatoryName: data.authorizedSignatoryName || 'Ahammed Kamal',
        },
      },
      status: 'draft',
    })

    dashboardServices.clearDashboardCache()
    wsUtils.dispatchDashboardUpdate('backcharge')
    return await newBackcharge.save()
  } catch (error) {
    throw wrapServiceError('addBackcharge', error)
  }
}

const updateBackcharge = async (id, updateData) => {
  try {
    if ('scopeOfWork' in updateData || 'scopeLine2Text' in updateData) {
      updateData.scopeOfWork = buildTextLines(updateData.scopeOfWork, updateData.scopeLine2Text)
      delete updateData.scopeLine2Text
    }

    if (
      'workshopComments' in updateData ||
      'workSummaryLine2' in updateData ||
      'workSummaryLine3' in updateData ||
      'workSummaryLine4' in updateData
    ) {
      updateData.workshopComments = buildTextLines(
        updateData.workshopComments,
        updateData.workSummaryLine2,
        updateData.workSummaryLine3,
        updateData.workSummaryLine4
      )
      delete updateData.workSummaryLine2
      delete updateData.workSummaryLine3
      delete updateData.workSummaryLine4
    }

    if (updateData.sparePartsCost || updateData.labourCharges || updateData.totalCost || updateData.approvedDeduction) {
      updateData.costSummary = {
        sparePartsCost: parseFloat(updateData.sparePartsCost) || 0,
        labourCharges: parseFloat(updateData.labourCharges) || 0,
        totalCost: parseFloat(updateData.totalCost) || 0,
        approvedDeduction: parseFloat(updateData.approvedDeduction) || 0,
      }
      delete updateData.sparePartsCost
      delete updateData.labourCharges
      delete updateData.totalCost
      delete updateData.approvedDeduction
    }

    if (updateData.tableRows) {
      updateData.sparePartsTable = updateData.tableRows
      delete updateData.tableRows
    }

    updateData.updatedAt = new Date()

    return await Backcharge.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
  } catch (error) {
    throw wrapServiceError('updateBackcharge', error)
  }
}

const deleteBackcharge = async (id) => {
  try {
    return await Backcharge.findByIdAndDelete(id)
  } catch (error) {
    throw wrapServiceError('deleteBackcharge', error)
  }
}

const saveSupplierEmail = async (supplierCode, email) => {
  try {
    return await Backcharge.updateMany({ supplierCode }, { $set: { supplierMail: email } })
  } catch (error) {
    throw wrapServiceError('saveSupplierEmail', error)
  }
}

const ROLE_MAP = [
  { envKey: process.env.WORKSHOP_MANAGER, field: 'workshopManager', role: 'WORKSHOP_MANAGER' },
  { envKey: process.env.PURCHASE_MANAGER, field: 'purchaseManager', role: 'PURCHASE_MANAGER' },
  { envKey: process.env.MANAGER, field: 'operationsManager', role: 'MANAGER' },
  { envKey: process.env.CEO, field: 'authorizedSignatory', role: 'CEO' },
  { envKey: process.env.MD, field: 'authorizedSignatory', role: 'MANAGING_DIRECTOR' },
]

const signBackcharge = async (refNo, signData) => {
  const {
    uniqueCode,
    signedDate,
    signedFrom,
    override = false,
    signedIP = null,
    signedDevice = null,
    signedLocation = null,
  } = signData

  const matched = ROLE_MAP.find((r) => r.envKey === uniqueCode)
  if (!matched) {
    throw {
      status: HTTP.FORBIDDEN,
      message: 'Unauthorised: your device is not recognised as an authorised signatory for backcharge documents',
    }
  }

  const backcharge = await Backcharge.findOne({ refNo })
  if (!backcharge) throw { status: HTTP.NOT_FOUND, message: `Backcharge not found: ${refNo}` }

  if (matched.field === 'authorizedSignatory') {
    const savedMode = backcharge.signatures?.authorizedSignatory?.authorizedSignatoryMode || 'CEO'
    const expectedRole = savedMode === 'MANAGING DIRECTOR' ? 'MANAGING_DIRECTOR' : 'CEO'
    if (matched.role !== expectedRole) {
      throw { status: HTTP.FORBIDDEN, message: `This document requires ${savedMode} signature, not ${matched.role}` }
    }
  }

  if (backcharge.signatures?.[matched.field]?.signed) {
    throw { status: HTTP.CONFLICT, message: `This position (${matched.role}) has already been signed` }
  }

  const chain = [
    { role: 'WORKSHOP_MANAGER', signed: backcharge.signatures?.workshopManager?.signed, order: 1 },
    { role: 'PURCHASE_MANAGER', signed: backcharge.signatures?.purchaseManager?.signed, order: 2 },
    { role: 'MANAGER', signed: backcharge.signatures?.operationsManager?.signed, order: 3 },
    {
      role: matched.role === 'MANAGING_DIRECTOR' ? 'MANAGING_DIRECTOR' : 'CEO',
      signed: backcharge.signatures?.authorizedSignatory?.signed,
      order: 4,
    },
  ]

  const myOrder = chain.find((c) => c.role === matched.role)?.order
  const unsignedAbove = chain.filter((c) => c.order < myOrder && !c.signed)

  if (unsignedAbove.length > 0 && !override) {
    return {
      status: 202,
      requireOverride: true,
      message: 'Out-of-order signing detected. Confirm override to proceed.',
      unsignedAbove: unsignedAbove.map((c) => c.role),
    }
  }

  const updated = await Backcharge.findOneAndUpdate(
    { refNo },
    {
      [`signatures.${matched.field}.signed`]: true,
      [`signatures.${matched.field}.signedBy`]: uniqueCode,
      [`signatures.${matched.field}.signedDate`]: signedDate,
      [`signatures.${matched.field}.signedFrom`]: signedFrom,
      [`signatures.${matched.field}.signedIP`]: signedIP,
      [`signatures.${matched.field}.signedDevice`]: signedDevice,
      [`signatures.${matched.field}.signedLocation`]: signedLocation,
      $push: {
        approvalTrail: {
          signedBy: uniqueCode,
          role: matched.role,
          action: override && unsignedAbove.length > 0 ? 'override_signed' : 'signed',
          signedDate: new Date(),
          comments:
            override && unsignedAbove.length > 0
              ? `Override signed by ${matched.role} — predecessors not yet signed`
              : `${matched.role} signed the backcharge document`,
        },
      },
    },
    { new: true }
  )
  if (!updated) throw { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to update backcharge record' }

  if (override && unsignedAbove.length > 0) {
    for (const above of unsignedAbove) {
      const title = `Action Required — Backcharge ${refNo} override signed`
      const description = `${matched.role} has signed backcharge ${refNo} out of order. ${above.role} signature is still required.`

      await notify({ title, description, priority: 'high', sourceId: 'backcharge_approval' }, JSON.parse(process.env.STAFF_HERO), title, description)
    }
  }

  if (!override || unsignedAbove.length === 0) {
    const signatoryMode = updated.signatures?.authorizedSignatory?.authorizedSignatoryMode || 'CEO'

    const nextStepMap = {
      WORKSHOP_MANAGER: {
        title: `Purchase Manager Approval Needed - ${refNo}`,
        description: `Workshop Manager signed backcharge ${refNo}. Purchase Manager approval needed.`,
        sourceId: 'backcharge_approval',
        recipient: JSON.parse(process.env.STAFF_HERO),
      },
      PURCHASE_MANAGER: {
        title: `Manager Approval Needed - ${refNo}`,
        description: `Purchase Manager signed backcharge ${refNo}. Manager approval needed.`,
        sourceId: 'backcharge_approval',
        recipient: JSON.parse(process.env.STAFF_HERO),
      },
      MANAGER: {
        title: `${signatoryMode} Approval Needed - ${refNo}`,
        description: `Manager signed backcharge ${refNo}. ${signatoryMode} approval needed.`,
        sourceId: signatoryMode === 'MANAGING DIRECTOR' ? 'md_approval' : 'ceo_approval',
        recipient: JSON.parse(process.env.STAFF_HERO),
      },
      CEO: {
        title: `Backcharge Signed & Ready - ${refNo}`,
        description: `CEO signed backcharge ${refNo}. All signatures complete.`,
        sourceId: 'backcharge_final',
        recipient: JSON.parse(process.env.STAFF_MAIN),
      },
      MANAGING_DIRECTOR: {
        title: `Backcharge Signed & Ready - ${refNo}`,
        description: `MD signed backcharge ${refNo}. All signatures complete.`,
        sourceId: 'backcharge_final',
        recipient: JSON.parse(process.env.STAFF_MAIN),
      },
    }

    const notifConfig = nextStepMap[matched.role]
    if (notifConfig) {
      const { recipient, title, description, sourceId } = notifConfig
      await notify({ title, description, priority: 'high', sourceId }, recipient, title, description)
    }
  }

  return {
    status: HTTP.OK,
    message: `${matched.role} signature recorded successfully`,
    data: updated,
    role: matched.role,
  }
}

const getPendingSignatures = async (uniqueCode) => {
  try {
    const roleMap = [
      { envKey: process.env.WORKSHOP_MANAGER, field: 'workshopManager', prevField: null },
      { envKey: process.env.PURCHASE_MANAGER, field: 'purchaseManager', prevField: 'workshopManager' },
      { envKey: process.env.MANAGER, field: 'operationsManager', prevField: 'purchaseManager' },
      { envKey: process.env.CEO, field: 'authorizedSignatory', prevField: 'operationsManager' },
      { envKey: process.env.MD, field: 'authorizedSignatory', prevField: 'operationsManager' },
    ]

    const matched = roleMap.find((r) => r.envKey === uniqueCode)
    if (!matched) return []

    const query = { [`signatures.${matched.field}.signed`]: { $ne: true } }
    if (matched.prevField) query[`signatures.${matched.prevField}.signed`] = true

    if (matched.envKey === process.env.CEO) {
      query['signatures.authorizedSignatory.authorizedSignatoryMode'] = { $nin: ['MANAGING DIRECTOR'] }
    }
    if (matched.envKey === process.env.MD) {
      query['signatures.authorizedSignatory.authorizedSignatoryMode'] = 'MANAGING DIRECTOR'
    }

    return await Backcharge.find(query)
      .select('refNo supplierName equipmentType plateNo date signatures')
      .sort({ createdAt: -1 })
      .lean()
  } catch (error) {
    throw wrapServiceError('getPendingSignatures', error)
  }
}

const getSignedByUser = async (uniqueCode) => {
  try {
    const roleMap = [
      { envKey: process.env.WORKSHOP_MANAGER, field: 'workshopManager' },
      { envKey: process.env.PURCHASE_MANAGER, field: 'purchaseManager' },
      { envKey: process.env.MANAGER, field: 'operationsManager' },
      { envKey: process.env.CEO, field: 'authorizedSignatory' },
      { envKey: process.env.MD, field: 'authorizedSignatory' },
    ]

    const matched = roleMap.find((r) => r.envKey === uniqueCode)
    if (!matched) return []

    return await Backcharge.find({ [`signatures.${matched.field}.signed`]: true })
      .select('refNo reportNo supplierName equipmentType plateNo date signatures')
      .sort({ createdAt: -1 })
      .lean()
  } catch (error) {
    throw wrapServiceError('getSignedByUser', error)
  }
}

module.exports = {
  getAllBackchargeReports,
  getBackchargeById,
  getBackchargeByRefNo,
  getLatestBackchargeRef,
  searchEquipmentByPlate,
  searchSuppliers,
  searchSites,
  addBackcharge,
  updateBackcharge,
  deleteBackcharge,
  saveSupplierEmail,
  signBackcharge,
  getPendingSignatures,
  getSignedByUser,
}