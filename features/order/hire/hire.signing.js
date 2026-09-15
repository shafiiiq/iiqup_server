const HTTP = require('#shared/response/response.status')
const HireOrder = require('./hire.model')
const { ROLE, roleSignConfig } = require('./hire.constant')
const { roleScreenMap, notifyStaffHero, notifyNextStep } = require('./hire.notification')
const { notifyUsers } = require('#shared/notify/notify.user')
const { staffMainRecipients } = require('./hire.constant')

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
  MANAGER: 'manager_approved',
  PURCHASE_MANAGER: 'purchase_approved',
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
      message: 'Unauthorised: your account is not recognised as an authorised signatory for hire order documents',
    }
  }

  return matched
}

const assertRoleAllowedToSign = (matched, hireOrder) => {
  if (hireOrder.workflowStatus === 'hire_order_created') {
    throw { status: HTTP.FORBIDDEN, message: 'HIRE_ORDER_NOT_UPLOADED' }
  }

  if (matched.role === ROLE.CEO && hireOrder.signatures?.authorizedSignatoryTitle !== 'CEO') {
    throw { status: HTTP.FORBIDDEN, message: 'Only the designated CEO is authorised to sign this hire order' }
  }

  if (matched.role === ROLE.MANAGING_DIRECTOR && hireOrder.signatures?.authorizedSignatoryTitle !== 'MANAGING DIRECTOR') {
    throw { status: HTTP.FORBIDDEN, message: 'Only the designated Managing Director is authorised to sign this hire order' }
  }

  if (hireOrder[matched.field] === true) {
    throw { status: HTTP.CONFLICT, message: 'The authorized signatory role has already been signed' }
  }
}

const findUnsignedAbove = (hireOrder, myOrder) => {
  const isMD = hireOrder.signatures?.authorizedSignatoryTitle === 'MANAGING DIRECTOR'
  const authRole = isMD ? ROLE.MANAGING_DIRECTOR : ROLE.CEO

  const chain = [
    { role: ROLE.MANAGER, signed: hireOrder.managerSigned, order: 1 },
    { role: ROLE.PURCHASE_MANAGER, signed: hireOrder.pmSigned, order: 2 },
    { role: ROLE.ACCOUNTS, signed: hireOrder.accountsSigned, order: 3 },
    { role: authRole, signed: hireOrder.ceoSigned, order: 4 },
  ]

  return { unsignedAbove: chain.filter((c) => c.order < myOrder && !c.signed), isMD }
}

const buildSignatureUpdate = (matched, signData, override, unsignedAbove) => {
  const { uniqueCode, signedDate, signedFrom, signedIP, signedDevice, signedLocation } = signData
  const p = matched.detailsPrefix

  return {
    [matched.field]: true,
    [`hireOrderDetails.${p}signed`]: true,
    [`hireOrderDetails.${p}authorised`]: true,
    [`hireOrderDetails.${p}approvedBy`]: uniqueCode,
    [`hireOrderDetails.${p}approvedDate`]: signedDate,
    [`hireOrderDetails.${p}approvedFrom`]: signedFrom,
    [`hireOrderDetails.${p}approvedIP`]: signedIP,
    [`hireOrderDetails.${p}approvedDevice`]: signedDevice,
    [`hireOrderDetails.${p}approvedLocation`]: signedLocation,
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

const notifyOverrideGaps = (unsignedAbove, matched, hireOrderRef, isMD) =>
  Promise.all(
    unsignedAbove.map((above) =>
      notifyStaffHero({
        title: `Action Required — Hire Order ${hireOrderRef} override signed`,
        description: `${matched.role} has signed Hire Order ${hireOrderRef} out of order. ${above.role} signature is still required.`,
        sourceId: 'hire_order_approval',
        navigateTo: `/(signature)/${roleScreenMap(above.role, isMD)}/${hireOrderRef}`,
        navigateText: 'View and Sign',
        navigteToId: hireOrderRef,
        hasButton: true,
      })
    )
  )

const notifyAllSigned = (updated, hireOrderRef) => {
  const allSigned = updated.pmSigned && updated.managerSigned && updated.ceoSigned && updated.accountsSigned
  if (!allSigned) return null

  return notifyUsers(staffMainRecipients(), {
    priority: 'high',
    title: `Hire Order Signed & Ready — ${hireOrderRef}`,
    description: `All 4 signatures complete on Hire Order ${hireOrderRef}.`,
    sourceId: 'manager_approval',
    navigateTo: `/(workflow)/hire-order/${hireOrderRef}`,
    navigateText: 'View Hire Order',
    navigteToId: hireOrderRef,
    hasButton: true,
  })
}

const signHireOrder = async (hireOrderRef, signData) => {
  const { override = false } = signData
  const config = roleSignConfig()
  const matched = resolveSigner(signData, config)

  const hireOrder = await HireOrder.findOne({ hireOrderRef: hireOrderRef.trim() })
  if (!hireOrder) throw { status: HTTP.NOT_FOUND, message: `Hire order not found: ${hireOrderRef}` }

  assertRoleAllowedToSign(matched, hireOrder)

  const { unsignedAbove, isMD } = findUnsignedAbove(hireOrder, matched.order)

  if (unsignedAbove.length > 0 && !override) {
    return {
      status: 202,
      requireOverride: true,
      message: 'Out-of-order signing detected. Confirm override to proceed.',
      unsignedAbove: unsignedAbove.map((c) => c.role),
    }
  }

  const updateFields = buildSignatureUpdate(matched, signData, override, unsignedAbove)
  const updated = await HireOrder.findOneAndUpdate({ hireOrderRef: hireOrderRef.trim() }, updateFields, { new: true })
  if (!updated) throw { status: HTTP.INTERNAL_SERVER_ERROR, message: 'Failed to update Hire Order record' }

  if (override && unsignedAbove.length > 0) {
    await notifyOverrideGaps(unsignedAbove, matched, hireOrderRef, isMD)
  } else {
    await notifyNextStep(matched.role, hireOrderRef, updated)
  }

  await notifyAllSigned(updated, hireOrderRef)

  return {
    status: HTTP.OK,
    message: `${matched.role} signature recorded successfully`,
    data: updated,
    role: matched.role,
  }
}

module.exports = { signHireOrder }