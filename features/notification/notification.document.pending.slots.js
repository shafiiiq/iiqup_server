const resolvePendingSlotLabels = ({ document, slots, signedSlotId, isSlotSigned }) =>
  [...slots]
    .sort((firstSlot, secondSlot) => firstSlot.order - secondSlot.order)
    .filter((slot) => slot.slotId !== signedSlotId && !isSlotSigned(document, slot.slotId))
    .map((slot) => slot.label)

module.exports = { resolvePendingSlotLabels }