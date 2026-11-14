const Quotation = require('./quotation.model')

const MAX_SUGGESTIONS = 8

let cachedEntriesPromise = null

const stripMarkup = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()

const loadItemDescriptionEntries = async () => {
  const rows = await Quotation.aggregate([
    { $sort: { createdAt: -1 } },
    { $project: { items: 1 } },
    { $unwind: '$items' },
    { $match: { 'items.description': { $type: 'string', $ne: '' } } },
    {
      $group: {
        _id: { $toLower: { $trim: { input: '$items.description' } } },
        description: { $first: '$items.description' },
        image: { $max: '$items.image' },
      },
    },
    { $project: { _id: 0, description: 1, image: { $ifNull: ['$image', null] } } },
  ])

  return rows.map((row) => ({ ...row, searchKey: stripMarkup(row.description) }))
}

const getItemDescriptionEntries = () => {
  if (!cachedEntriesPromise) {
    cachedEntriesPromise = loadItemDescriptionEntries().catch((error) => {
      cachedEntriesPromise = null
      throw error
    })
  }
  return cachedEntriesPromise
}

const invalidateItemDescriptionCache = () => {
  cachedEntriesPromise = null
}

const searchItemDescriptions = async (term) => {
  const entries = await getItemDescriptionEntries()
  const searchKey = stripMarkup(term)
  if (!searchKey) return []

  return entries
    .filter((entry) => entry.searchKey.includes(searchKey))
    .slice(0, MAX_SUGGESTIONS)
    .map(({ description, image }) => ({ description, image }))
}

module.exports = { searchItemDescriptions, invalidateItemDescriptionCache }