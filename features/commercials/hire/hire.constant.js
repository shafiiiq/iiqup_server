const PREPARED_BY_OPTIONS = [
  { name: 'SANA SALIM', envKey: 'PREPARED_BY_SANA' },
  { name: 'SHAHEEN', envKey: 'PREPARED_BY_SHAHEEN' },
  { name: 'NAJIYA', envKey: 'PREPARED_BY_NAJIYA' },
  { name: 'SHYMA AMEENA', envKey: 'PREPARED_BY_SHYMA' },
]

const PREPARED_BY_NAMES = PREPARED_BY_OPTIONS.map((option) => option.name)

const resolvePreparedByUniqueCode = (name) => {
  const matchedOption = PREPARED_BY_OPTIONS.find((option) => option.name === name) || PREPARED_BY_OPTIONS[0]
  return process.env[matchedOption.envKey]
}

const DEFAULT_SIGNATURES = {
  operationsSupervisor: 'SALIH BASHEER',
  preparedBy: PREPARED_BY_NAMES[0],
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

const WORKFLOW_STATUS = {
  CREATED: 'hire_order_created',
  SUPERVISOR_APPROVED: 'supervisor_approved',
  PREPARED_BY_APPROVED: 'prepared_by_approved',
  MANAGER_APPROVED: 'manager_approved',
  PURCHASE_APPROVED: 'purchase_approved',
  ACCOUNTS_APPROVED: 'accounts_approved',
  CEO_APPROVED: 'ceo_approved',
  MD_APPROVED: 'md_approved',
}

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
  PREPARED_BY_OPTIONS,
  PREPARED_BY_NAMES,
  resolvePreparedByUniqueCode,
  DEFAULT_SIGNATURES,
  DEFAULT_TERMS,
  ROLE,
  WORKFLOW_STATUS,
  roleSignConfig,
}