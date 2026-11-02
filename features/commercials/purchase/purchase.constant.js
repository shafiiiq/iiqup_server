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

module.exports = {
  DEFAULT_SIGNATURES,
  DEFAULT_TERMS,
  WORKFLOW_STATUS,
}