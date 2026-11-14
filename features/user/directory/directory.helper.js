const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildDirectoryFilter = (search) => {
  const baseFilter = { uniqueCode: { $nin: [null, ''] } }
  if (!search) return baseFilter

  const pattern = new RegExp(escapeRegex(search), 'i')
  return {
    ...baseFilter,
    $or: [{ name: pattern }, { email: pattern }, { uniqueCode: pattern }],
  }
}

module.exports = { buildDirectoryFilter }