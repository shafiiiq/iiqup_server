const DEFAULT_SIGNATURES = {
  authorizedSignatory: 'AHAMMED KAMAL',
  authorizedSignatoryTitle: 'CEO',
}

const DEFAULT_TERMS = ['Terms & Conditions']

const STATUS = { DRAFT: 'draft', SENT: 'sent' }

const SIGN_TYPES = ['authorized', 'seal']

const staffMainRecipients = () => JSON.parse(process.env.STAFF_MAIN)

module.exports = {
  DEFAULT_SIGNATURES,
  DEFAULT_TERMS,
  STATUS,
  SIGN_TYPES,
  staffMainRecipients,
}