const resolvePendingSlots = ({ document, slots, signedSlotId, isSlotSigned }) =>
  [...slots]
    .sort((firstSlot, secondSlot) => firstSlot.order - secondSlot.order)
    .filter((slot) => slot.slotId !== signedSlotId && !isSlotSigned(document, slot.slotId))

module.exports = { resolvePendingSlots }