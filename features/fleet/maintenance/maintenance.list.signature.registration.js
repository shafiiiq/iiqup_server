const { registerSignatureSource } = require('#core/signature/signature.registry')
const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')
const { USER_ROLES } = require('#features/user/staff/staff.constant')

const MAINTENANCE_LIST_SIGNATURE_SOURCE_KEY = 'maintenanceList'
const MAINTENANCE_LIST_DOCUMENT_ID_PREFIX = 'list-'
const SUPERVISOR_SLOT_ID = 'supervisor'

const buildSlots = () => [
  { slotId: SUPERVISOR_SLOT_ID, label: 'Supervisor', order: 1, allowedRoles: [USER_ROLES.WORKSHOP_MANAGER] },
]

const loadMaintenanceListDocument = async (documentId) => {
  if (!String(documentId).startsWith(MAINTENANCE_LIST_DOCUMENT_ID_PREFIX)) {
    throw new AppError('Invalid maintenance list document id', HTTP.BAD_REQUEST)
  }
  return { _id: String(documentId) }
}

registerSignatureSource(MAINTENANCE_LIST_SIGNATURE_SOURCE_KEY, {
  loadDocument: loadMaintenanceListDocument,
  getSlots: buildSlots,
  getRevision: () => 0,
  buildCanonicalContent: (document) => ({ documentId: document._id }),
  assertSignable: () => undefined,
  canViewDocument: (requester) => Boolean(requester?.id),
  isLegacySigned: () => false,
  onSigned: async () => undefined,
})

module.exports = { MAINTENANCE_LIST_SIGNATURE_SOURCE_KEY }