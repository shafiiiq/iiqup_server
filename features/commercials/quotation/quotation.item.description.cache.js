const Quotation = require('./quotation.model')

const DEFAULT_PAGE_SIZE = 6
const MAX_PAGE_SIZE = 50

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
  getItemDescriptionEntries().catch(() => undefined)
}

const searchItemDescriptions = async (term, offset, limit) => {
  const entries = await getItemDescriptionEntries()
  const searchKey = stripMarkup(term)
  if (!searchKey) return { items: [], hasMore: false }

  const safeOffset = Math.max(0, Number(offset) || 0)
  const safeLimit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(limit) || DEFAULT_PAGE_SIZE))
  const matches = entries.filter((entry) => entry.searchKey.includes(searchKey))

  return {
    items: matches.slice(safeOffset, safeOffset + safeLimit).map(({ description, image }) => ({ description, image })),
    hasMore: matches.length > safeOffset + safeLimit,
  }
}

module.exports = { searchItemDescriptions, invalidateItemDescriptionCache, warmItemDescriptionCache: getItemDescriptionEntries }