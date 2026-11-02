const User = require('#features/user/staff/staff.model')

const resolveSlotOwners = (slot) =>
  User.find({ role: { $in: slot.allowedRoles }, isActive: true })
    .select('name uniqueCode role')
    .sort({ createdAt: 1 })
    .lean()

module.exports = { resolveSlotOwners }