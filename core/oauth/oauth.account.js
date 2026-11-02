const User = require('#features/user/staff/staff.model')
const Mechanic = require('#features/user/mechanic/mechanic.model')
const Operator = require('#features/user/operator/operator.model')

const ACCOUNT_SOURCES = {
  staff: { type: 'staff', model: User, sessionModel: 'User' },
  mechanic: { type: 'mechanic', model: Mechanic, sessionModel: 'Mechanic' },
  operator: { type: 'operator', model: Operator, sessionModel: 'Operator' },
}

const getAccountSource = (accountType) => ACCOUNT_SOURCES[accountType] || null

const findAccountByEmail = async (email) => {
  for (const source of Object.values(ACCOUNT_SOURCES)) {
    const account = await source.model.findOne({ email })
    if (account) return { source, account }
  }
  return null
}

const findAccountById = async (accountType, accountId) => {
  const source = getAccountSource(accountType)
  if (!source) return null
  const account = await source.model.findById(accountId)
  return account ? { source, account } : null
}

module.exports = { getAccountSource, findAccountByEmail, findAccountById }