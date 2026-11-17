const User = require('#features/user/staff/staff.model')

const resolveSlotOwners = (slot) =>
  User.find({
    $or: [{ role: { $in: slot.allowedRoles } }, { uniqueCode: { $in: slot.allowedUniqueCodes || [] } }],
    isActive: true,
  })
    .select('name uniqueCode role')
    .sort({ createdAt: 1 })
    .lean()

module.exports = { resolveSlotOwners }