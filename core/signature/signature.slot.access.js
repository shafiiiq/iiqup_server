const isUserAllowedForSlot = (slot, user) =>
  slot.allowedRoles.includes(user.role) || Boolean(slot.allowedUniqueCodes?.includes(user.uniqueCode))

module.exports = { isUserAllowedForSlot }