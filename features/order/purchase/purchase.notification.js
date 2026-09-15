const { notifyUsers } = require('#shared/notify/notify.user')
const { ROLE, staffMainRecipients, staffHeroRecipients } = require('./purchase.constant')

const roleScreenMap = (role, isMD) => {
  const map = {
    [ROLE.PURCHASE_MANAGER]: 'pm',
    [ROLE.MANAGER]: 'op',
    [ROLE.CEO]: isMD ? 'md' : 'ceo',
    [ROLE.MANAGING_DIRECTOR]: 'md',
    [ROLE.ACCOUNTS]: 'accounts',
  }
  return map[role] || 'purchaseorderSign'
}

const buildNextStepNotif = (role, purchaseorderRef, updated) => {
  const isMD = updated.signatures?.authorizedSignatoryTitle === 'MANAGING DIRECTOR'
  const signatoryTitle = updated.signatures?.authorizedSignatoryTitle || 'CEO'

  const map = {
    MANAGER: {
      title: `Purchase Manager Approval Needed — Purchase Order ${purchaseorderRef}`,
      description: `Manager signed Purchase Order ${purchaseorderRef}. Purchase Manager approval needed.`,
      sourceId: 'purchaseorder_approval',
      navigateTo: `/(signature)/pm/${purchaseorderRef}`,
      navigateText: 'View and Sign',
      recipients: staffHeroRecipients(),
    },
    PURCHASE_MANAGER: {
      title: `Accounts Approval Needed — Purchase Order ${purchaseorderRef}`,
      description: `Purchase Manager signed Purchase Order ${purchaseorderRef}. Accounts approval needed.`,
      sourceId: 'accounts_approval',
      navigateTo: `/(signature)/accounts/${purchaseorderRef}`,
      navigateText: 'View and Sign',
      recipients: staffHeroRecipients(),
    },
    ACCOUNTS: {
      title: `${signatoryTitle} Approval Needed — Purchase Order ${purchaseorderRef}`,
      description: `Accounts signed Purchase Order ${purchaseorderRef}. ${signatoryTitle} approval needed.`,
      sourceId: isMD ? 'md_approval' : 'ceo_approval',
      navigateTo: isMD ? `/(signature)/md/${purchaseorderRef}` : `/(signature)/ceo/${purchaseorderRef}`,
      navigateText: 'View and Sign',
      recipients: staffHeroRecipients(),
    },
    CEO: {
      title: `Purchase Order ${purchaseorderRef} Fully Signed`,
      description: `CEO signed Purchase Order ${purchaseorderRef}. All signatures complete.`,
      sourceId: 'final_approval',
      navigateTo: `/(workflow)/purchaseorder/${purchaseorderRef}`,
      navigateText: 'View Purchase Order',
      recipients: staffMainRecipients(),
    },
    MANAGING_DIRECTOR: {
      title: `Purchase Order ${purchaseorderRef} Fully Signed`,
      description: `MD signed Purchase Order ${purchaseorderRef}. All signatures complete.`,
      sourceId: 'final_approval',
      navigateTo: `/(workflow)/purchaseorder/${purchaseorderRef}`,
      navigateText: 'View Purchase Order',
      recipients: staffMainRecipients(),
    },
  }

  return map[role] || null
}

const notifyStaffMain = (data) => notifyUsers(staffMainRecipients(), { priority: 'high', ...data })

const notifyStaffHero = (data) => notifyUsers(staffHeroRecipients(), { priority: 'high', ...data })

const notifyNextStep = (role, purchaseorderRef, updated) => {
  const next = buildNextStepNotif(role, purchaseorderRef, updated)
  if (!next) return null

  return notifyUsers(next.recipients, {
    priority: 'high',
    title: next.title,
    description: next.description,
    sourceId: next.sourceId,
    navigateTo: next.navigateTo,
    navigateText: next.navigateText,
    navigteToId: purchaseorderRef,
    hasButton: true,
  })
}

module.exports = {
  roleScreenMap,
  notifyStaffMain,
  notifyStaffHero,
  notifyNextStep,
}