const DEFAULT_SIGNATURES = {
  accountsDept: 'ROSHAN SHA',
  purchasingManager: 'ABDUL MALIK',
  operationsManager: 'SURESHKANTH',
  authorizedSignatory: 'AHAMMED KAMAL',
  authorizedSignatoryTitle: 'CEO',
}

const DEFAULT_TERMS = [
  'Terms & Conditions',
  'Payment will be made within 90 days from the day of submission of invoice',
]

const ROLE = {
  MANAGER: 'MANAGER',
  PURCHASE_MANAGER: 'PURCHASE_MANAGER',
  ACCOUNTS: 'ACCOUNTS',
  CEO: 'CEO',
  MANAGING_DIRECTOR: 'MANAGING_DIRECTOR',
}

const staffMainRecipients = () => JSON.parse(process.env.STAFF_MAIN || '[]')
const staffHeroRecipients = () => JSON.parse(process.env.STAFF_HERO || '[]')

const roleSignConfig = () => ({
  [ROLE.MANAGER]: {
    envKey: process.env.MANAGER,
    field: 'managerSigned',
    detailsPrefix: 'MANAGER',
    role: ROLE.MANAGER,
    order: 1,
  },
  [ROLE.PURCHASE_MANAGER]: {
    envKey: process.env.PURCHASE_MANAGER,
    field: 'pmSigned',
    detailsPrefix: 'PMR',
    role: ROLE.PURCHASE_MANAGER,
    order: 2,
  },
  [ROLE.ACCOUNTS]: {
    envKey: process.env.ACCOUNTS,
    field: 'accountsSigned',
    detailsPrefix: 'ACCOUNTS',
    role: ROLE.ACCOUNTS,
    order: 3,
  },
  [ROLE.CEO]: {
    envKey: process.env.CEO,
    field: 'ceoSigned',
    detailsPrefix: 'CEO',
    role: ROLE.CEO,
    order: 4,
  },
  [ROLE.MANAGING_DIRECTOR]: {
    envKey: process.env.MD,
    field: 'ceoSigned',
    detailsPrefix: 'MD',
    role: ROLE.MANAGING_DIRECTOR,
    order: 4,
  },
})

module.exports = {
  DEFAULT_SIGNATURES,
  DEFAULT_TERMS,
  ROLE,
  staffMainRecipients,
  staffHeroRecipients,
  roleSignConfig,
}