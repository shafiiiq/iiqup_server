const HTTP = require('#shared/response/response.status')
const PurchaseOrder = require('./purchase.model')
const { ROLE, roleSignConfig } = require('./purchase.constant')
const { roleScreenMap, notifyStaffHero, notifyNextStep } = require('./purchase.notification')
const { notifyUsers } = require('#shared/notify/notify.user')

const ROLE_ALIASES = {
  PURCHASE_MANAGER: ROLE.PURCHASE_MANAGER,
  PURCHASEMANAGER: ROLE.PURCHASE_MANAGER,
  PM: ROLE.PURCHASE_MANAGER,
  MANAGER: ROLE.MANAGER,
  ACCOUNTS: ROLE.ACCOUNTS,
  ACCOUNTANT: ROLE.ACCOUNTS,
  CEO: ROLE.CEO,
  MD: ROLE.MANAGING_DIRECTOR,
  MANAGING_DIRECTOR: ROLE.MANAGING_DIRECTOR,
}

const normalizeRole = (value) => {
  if (!value) return null
  const normalized = String(value).trim().toUpperCase()
  return ROLE_ALIASES[normalized] || normalized
}

const WORKFLOW_PROGRESS_BY_ROLE = {
  MANAGER: 'operation_manager_approved',
  PURCHASE_MANAGER: 'purchase_manager_approved',
  ACCOUNTS: 'accounts_approved',
  CEO: 'ceo_approved',
  MANAGING_DIRECTOR: 'md_approved',
}

const resolveSigner = (signData, config) => {
  const requestedRole = normalizeRole(signData.role)
  const matched = requestedRole ? config[requestedRole] : Object.values(config).find((r) => r.envKey === signData.uniqueCode)

  if (!matched || matched.envKey !== signData.uniqueCode) {
    throw {
      status: HTTP.FORBIDDEN,
      message: 'Unauthorised: your account is not recognised as an authorised signatory for Purchase Order documents',
    }
  }

  return matched
}

const assertRoleAllowedToSign = (matched, purchaseorder) => {
  if (purchaseorder.workflowStatus === 'purchaseorder_created') throw { status: HTTP.FORBIDDEN, message: 'PurchaseOrder_NOT_UPLOADED' }

  if (matched.role === ROLE.CEO && purchaseorder.signatures?.authorizedSignatoryTitle !== 'CEO') {
    throw { status: HTTP.FORBIDDEN, message: 'Only the designated CEO is authorised to sign this Purchase Order' }
  }

  if (matched.role === ROLE.MANAGING_DIRECTOR && purchaseorder.signatures?.authorizedSignatoryTitle !== 'MANAGING DIRECTOR') {
    throw { status: HTTP.FORBIDDEN, message: 'Only the designated Managing Director is authorised to sign this Purchase Order' }
  }

  if (purchaseorder[matched.field] === true) {
    throw { status: HTTP.CONFLICT, message: 'The authorized signatory role has already been signed' }
  }
}

const findUnsignedAbove = (purchaseorder, myOrder) => {
  const isMD = purchaseorder.signatures?.authorizedSignatoryTitle === 'MANAGING DIRECTOR'
  const authRole = isMD ? ROLE.MANAGING_DIRECTOR : ROLE.CEO

  const chain = [
    { role: ROLE.MANAGER, signed: purchaseorder.managerSigned, order: 1 },
    { role: ROLE.PURCHASE_MANAGER, signed: purchaseorder.pmSigned, order: 2 },
    { role: ROLE.ACCOUNTS, signed: purchaseorder.accountsSigned, order: 3 },
    { role: authRole, signed: purchaseorder.ceoSigned, order: 4 },
  ]

  return { unsignedAbove: chain.filter((c) => c.order < myOrder && !c.signed), isMD }
}

const buildSignatureUpdate = (matched, signData, override, unsignedAbove) => {
  const { uniqueCode, signedDate, signedFrom, signedIP, signedDevice, signedLocation } = signData
  const p = matched.detailsPrefix

  return {
    [matched.field]: true,
    [`purchaseorderDetails.${p}signed`]: true,
    [`purchaseorderDetails.${p}authorised`]: true,
    [`purchaseorderDetails.${p}approvedBy`]: uniqueCode,
    [`purchaseorderDetails.${p}approvedDate`]: signedDate,
    [`purchaseorderDetails.${p}approvedFrom`]: signedFrom,
    [`purchaseorderDetails.${p}approvedIP`]: signedIP,
    [`purchaseorderDetails.${p}approvedBDevice`]: signedDevice,
    [`purchaseorderDetails.${p}approvedLocation`]: signedLocation,
    workflowStatus: WORKFLOW_PROGRESS_BY_ROLE[matched.role],
    $push: {
      approvalTrail: {
        approvedBy: uniqueCode,
        role: matched.role,
        action: override && unsignedAbove.length > 0 ? 'override_signed' : 'signed',
        comments:
          override && unsignedAbove.length > 0
            ? `Override signed by ${matched.role} — predecessors not yet signed`
            : `Signed via mobile app by ${matched.role}`,
        approvalDate: new Date(),
      },
    },
  }
}

const notifyOverrideGaps = (unsignedAbove, matched, purchaseorderRef, isMD) =>
  Promise.all(
    unsignedAbove.map((above) =>
      notifyStaffHero({
        title: `Action Required — Purchase Order ${purchaseorderRef} override signed`,
        description: `${matched.role} has signed Purchase Order ${purchaseorderRef} out of order. ${above.role} signature is still required.`,
        sourceId: 'purchaseorder_approval',
        navigateTo: `/(signature)/${roleScreenMap(above.role, isMD)}/${purchaseorderRef}`,
        navigateText: 'View and Sign',
        navigteToId: purchaseorderRef,
        hasButton: true,
        forYou: process.env.SUPER_ADMIN,
      })
    )
  )

const notifyAllSigned = (updated, purchaseorderRef) => {
  const allSigned = updated.pmSigned && updated.managerSigned && updated.ceoSigned && updated.accountsSigned
  if (!allSigned) return null

  return notifyUsers(JSON.parse(process.env.STAFF_MAIN), {
    priority: 'high',
    title: `Purchase Order Signed & Ready — ${purchaseorderRef}`,
    description: `All 4 signatures complete on Purchase Order ${purchaseorderRef}. Items can now be procured.`,
    sourceId: 'manager_approval',
    navigateTo: `/(workflow)/purchaseorder/${purchaseorderRef}`,
    navigateText: 'View the item required',
    navigteToId: purchaseorderRef,
    hasButton: true,
  })
}

const signPurchaseOrder = async (purchaseorderRef, signData) => {
  const { override = false } = signData
  const config = roleSignConfig()
  const matched = resolveSigner(signData, config)

  const purchaseorder = await PurchaseOrder.findOne({ purchaseorderRef })
  if (!purchaseorder) throw { status: HTTP.NOT_FOUND, message: `Purchase Order not found: ${purchaseorderRef}` }

  assertRoleAllowedToSign(matched, purchaseorder)

  const { unsignedAbove, isMD } = findUnsignedAbove(purchaseorder, matched.order)

  if (unsignedAbove.length > 0 && !override) {
    return {
      status: 202,
      requireOverride: true,
      message: 'Out-of-order signing detected. Confirm override to proceed.',
      unsignedAbove: unsignedAbove.map((c) => c.role),
    }
  }

  const updateFields = buildSignatureUpdate(matched, signData, override, unsignedAbove)
  const updated = await PurchaseOrder.findOneAndUpdate({ purchaseorderRef }, updateFields, { new: true })
  if (!updated) throw { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to update Purchase Order record' }

  if (override && unsignedAbove.length > 0) {
    await notifyOverrideGaps(unsignedAbove, matched, purchaseorderRef, isMD)
  } else {
    await notifyNextStep(matched.role, purchaseorderRef, updated)
  }

  await notifyAllSigned(updated, purchaseorderRef)

  return {
    status: HTTP.OK,
    message: `${matched.role} signature recorded successfully`,
    data: updated,
    role: matched.role,
  }
}

module.exports = {
  signPurchaseOrder,
}