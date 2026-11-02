const mongoose = require('mongoose')
const { registerSignatureSource } = require('#core/signature/signature.registry')
const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')
const { USER_ROLES } = require('#features/user/staff/staff.constant')
const Maintenance = require('./maintenance.model')
const { resolveEffectiveContent } = require('./maintenance.content')
const { maintenancePdf } = require('./maintenance.pdf.registration')

const MAINTENANCE_SIGNATURE_SOURCE_KEY = 'maintenance'
const SUPERVISOR_SLOT_ID = 'supervisor'

const buildSlots = () => [
  { slotId: SUPERVISOR_SLOT_ID, label: 'Supervisor', order: 1, allowedRoles: [USER_ROLES.WORKSHOP_MANAGER] },
]

const loadMaintenance = async (documentId) => {
  if (!mongoose.Types.ObjectId.isValid(documentId)) throw new AppError('Invalid maintenance ID', HTTP.BAD_REQUEST)
  const maintenance = await Maintenance.findById(documentId)
  if (!maintenance) throw new AppError('Maintenance record not found', HTTP.NOT_FOUND)
  return maintenance
}

const applyMaintenanceSignature = async ({ document, signer, event, ipAddress, userAgent }) => {
  await Maintenance.updateOne(
    { _id: document._id },
    {
      $set: {
        supervisorSigned: true,
        supervisorSignature: {
          signedBy: signer.uniqueCode,
          signedAt: event.signedAt.toISOString(),
          ipAddress,
          userAgent,
        },
      },
    }
  )

  maintenancePdf.requestInBackground({ documentId: String(document._id), user: signer })
}

registerSignatureSource(MAINTENANCE_SIGNATURE_SOURCE_KEY, {
  loadDocument: loadMaintenance,
  getSlots: buildSlots,
  getRevision: (maintenance) => maintenance.revision || 0,
  buildCanonicalContent: resolveEffectiveContent,
  assertSignable: () => undefined,
  canViewDocument: (requester) => Boolean(requester?.id),
  isLegacySigned: (maintenance) => maintenance.supervisorSigned === true,
  onSigned: applyMaintenanceSignature,
})

module.exports = { MAINTENANCE_SIGNATURE_SOURCE_KEY }