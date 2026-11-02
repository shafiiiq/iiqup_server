const { findQueuedDeliveries } = require('./notification.delivery.queue.service');
const { serializeQueuedDelivery } = require('./notification.serializer');
const { resolveActorAvatarUrl } = require('./notification.actor.avatar');

const readAvatarUrl = (actor, avatarByActorCode) => {
  if (!actor) return Promise.resolve(null);
  if (!avatarByActorCode.has(actor.uniqueCode)) {
    avatarByActorCode.set(actor.uniqueCode, resolveActorAvatarUrl(actor));
  }
  return avatarByActorCode.get(actor.uniqueCode);
};

const listQueuedDeliveryPayloads = async (uniqueCode) => {
  const deliveries = await findQueuedDeliveries(uniqueCode);
  const avatarByActorCode = new Map();
  return Promise.all(
    deliveries.map(async (delivery) =>
      serializeQueuedDelivery(delivery, await readAvatarUrl(delivery.actor, avatarByActorCode))
    )
  );
};

module.exports = { listQueuedDeliveryPayloads };