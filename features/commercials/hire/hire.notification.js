const { ROLE } = require('./hire.constant')

const roleScreenMap = (role, isMD) => {
  const map = {
    [ROLE.PURCHASE_MANAGER]: 'pm',
    [ROLE.MANAGER]: 'op',
    [ROLE.CEO]: isMD ? 'md' : 'ceo',
    [ROLE.MANAGING_DIRECTOR]: 'md',
    [ROLE.ACCOUNTS]: 'accounts',
  }
  return map[role] || 'hireOrderSign'
}

module.exports = { roleScreenMap }