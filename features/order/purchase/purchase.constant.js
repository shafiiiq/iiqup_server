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

const buildApprovedCreds = (body) => ({
  signed: body.signed || false,
  authorised: body.authorised || false,
  approvedDate: body.approvedDate,
  approvedFrom: body.approvedFrom,
  approvedIP: body.approvedIP,
  approvedBDevice: body.approvedBDevice,
  approvedLocation: body.approvedLocation,
  approvedBy: body.approvedBy,
})

const WORKFLOW_STATUS = {
  PurchaseOrder_CREATED: 'purchaseorder_created',
  PurchaseOrder_UPLOADED: 'purchaseorder_uploaded',
  PurchaseOrder_AMENDED: 'purchaseorder_amended',
  PURCHASE_APPROVED: 'purchase_manager_approved',
  MANAGER_APPROVED: 'operation_manager_approved',
  ACCOUNTS_APPROVED: 'accounts_approved',
  CEO_APPROVED: 'ceo_approved',
  MD_APPROVED: 'md_approved',
  ITEMS_AVAILABLE: 'items_available',
}

const ROLE = {
  MANAGER: 'MANAGER',
  PURCHASE_MANAGER: 'PURCHASE_MANAGER',
  ACCOUNTS: 'ACCOUNTS',
  CEO: 'CEO',
  MANAGING_DIRECTOR: 'MANAGING_DIRECTOR',
}

const staffMainRecipients = () => JSON.parse(process.env.STAFF_MAIN)
const staffHeroRecipients = () => JSON.parse(process.env.STAFF_HERO)

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
  buildApprovedCreds,
  WORKFLOW_STATUS,
  ROLE,
  staffMainRecipients,
  staffHeroRecipients,
  roleSignConfig,
}