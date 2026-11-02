const buildTaskEntry = ({ kind, document, reference, party, amount, amendmentCount, signers }) => ({
  id: String(document._id),
  kind,
  reference,
  party,
  amount,
  amendmentCount,
  createdAt: document.createdAt,
  updatedAt: document.updatedAt,
  signers,
})

module.exports = { buildTaskEntry }