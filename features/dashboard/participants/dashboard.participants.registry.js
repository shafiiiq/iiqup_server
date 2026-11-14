const PurchaseOrder = require('#features/commercials/purchase/purchase.model')
const HireOrder = require('#features/commercials/hire/hire.model')
const Quotation = require('#features/commercials/quotation/quotation.model')
const Backcharge = require('#features/commercials/backcharge/backcharge.model')
const Maintenance = require('#features/fleet/maintenance/maintenance.model')
const Mobilization = require('#features/fleet/mobilization/mobilization.model')
const Replacement = require('#features/fleet/replacement/replacement.model')

const PARTICIPANT_SOURCES = [
  { model: PurchaseOrder, sourceKey: 'purchase_order' },
  { model: HireOrder, sourceKey: 'hire_order' },
  { model: Quotation, sourceKey: 'quotation' },
  { model: Backcharge, sourceKey: 'backcharge' },
  { model: Maintenance, sourceKey: 'maintenance' },
  { model: Mobilization, sourceKey: 'mobilization' },
  { model: Replacement, sourceKey: 'replacement' },
]

const normalizeCollectionName = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '')

const MODEL_BY_COLLECTION_NAME = new Map(
  PARTICIPANT_SOURCES.flatMap(({ model, sourceKey }) => [
    [normalizeCollectionName(model.collection.name), model],
    [normalizeCollectionName(sourceKey), model],
  ])
)

const resolveParticipantModel = (collectionName) =>
  MODEL_BY_COLLECTION_NAME.get(normalizeCollectionName(collectionName)) ?? null

module.exports = { resolveParticipantModel }