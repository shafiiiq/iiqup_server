const { notifyUsers } = require('#shared/notify/notify.user')
const { ROLE, staffMainRecipients, staffHeroRecipients } = require('./hire.constant')

const roleScreenMap = (role, isMD) => {
  const map = {
    [ROLE.PURCHASE_MANAGER]: 'pm',
    [ROLE.MANAGER]: 'op',
    [ROLE.CEO]: isMD ? 'md' : 'ceo',
    [ROLE.MANAGING_DIRECTOR]: 'md',
    [ROLE.ACCOUNTS]: 'accounts',
  }
  return map[role] || 'hireOrderSign'
}

const buildNextStepNotif = (role, hireOrderRef, updated) => {
  const isMD = updated.signatures?.authorizedSignatoryTitle === 'MANAGING DIRECTOR'
  const signatoryTitle = updated.signatures?.authorizedSignatoryTitle || 'CEO'

  const map = {
    MANAGER: {
      title: `Purchase Manager Approval Needed — Hire Order ${hireOrderRef}`,
      description: `Manager signed Hire Order ${hireOrderRef}. Purchase Manager approval needed.`,
      sourceId: 'hire_order_approval',
      navigateTo: `/(signature)/pm/${hireOrderRef}`,
      navigateText: 'View and Sign',
      recipients: staffHeroRecipients(),
    },
    PURCHASE_MANAGER: {
      title: `Accounts Approval Needed — Hire Order ${hireOrderRef}`,
      description: `Purchase Manager signed Hire Order ${hireOrderRef}. Accounts approval needed.`,
      sourceId: 'accounts_approval',
      navigateTo: `/(signature)/accounts/${hireOrderRef}`,
      navigateText: 'View and Sign',
      recipients: staffHeroRecipients(),
    },
    ACCOUNTS: {
      title: `${signatoryTitle} Approval Needed — Hire Order ${hireOrderRef}`,
      description: `Accounts signed Hire Order ${hireOrderRef}. ${signatoryTitle} approval needed.`,
      sourceId: isMD ? 'md_approval' : 'ceo_approval',
      navigateTo: isMD ? `/(signature)/md/${hireOrderRef}` : `/(signature)/ceo/${hireOrderRef}`,
      navigateText: 'View and Sign',
      recipients: staffHeroRecipients(),
    },
    CEO: {
      title: `Hire Order ${hireOrderRef} Fully Signed`,
      description: `CEO signed Hire Order ${hireOrderRef}. All signatures complete.`,
      sourceId: 'final_approval',
      navigateTo: `/(workflow)/hire-order/${hireOrderRef}`,
      navigateText: 'View Hire Order',
      recipients: staffMainRecipients(),
    },
    MANAGING_DIRECTOR: {
      title: `Hire Order ${hireOrderRef} Fully Signed`,
      description: `MD signed Hire Order ${hireOrderRef}. All signatures complete.`,
      sourceId: 'final_approval',
      navigateTo: `/(workflow)/hire-order/${hireOrderRef}`,
      navigateText: 'View Hire Order',
      recipients: staffMainRecipients(),
    },
  }

  return map[role] || null
}

const notifyStaffMain = (data) => notifyUsers(staffMainRecipients(), { priority: 'high', ...data })
const notifyStaffHero = (data) => notifyUsers(staffHeroRecipients(), { priority: 'high', ...data })

const notifyNextStep = (role, hireOrderRef, updated) => {
  const next = buildNextStepNotif(role, hireOrderRef, updated)
  if (!next) return null

  return notifyUsers(next.recipients, {
    priority: 'high',
    title: next.title,
    description: next.description,
    sourceId: next.sourceId,
    navigateTo: next.navigateTo,
    navigateText: next.navigateText,
    navigteToId: hireOrderRef,
    hasButton: true,
  })
}

module.exports = { roleScreenMap, notifyStaffMain, notifyStaffHero, notifyNextStep }