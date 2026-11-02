const User = require('../staff/staff.model')
const Mechanic = require('../mechanic/mechanic.model')
const Operator = require('../operator/operator.model')

const ADMIN_USER_KINDS = {
  staff: {
    model: User,
    hiddenFields: '-_id -password -docAuthPasw -pushTokens -voipPushToken -webPushSubscription -biometricTokens -mobileSigningKeys -__v -userType -permissions -profilePic -lastExploredVersion -exploredFeatures -userType -tag -specialNotification -joiningDate -tutorialsSeen -grantAccess -signatureActivation',
  },
  mechanic: {
    model: Mechanic,
    hiddenFields: '-_id -password -pushTokens -voipPushToken -__v -tag -attendance -toolkits -monthlyOvertime -password -designation -userType -profilePic -hidden -testOnly',
  },
  operator: {
    model: Operator,
    hiddenFields: '-_id -password -pushTokens -voipPushToken -__v -qidExpiry -healthCardExpiry -licenceType -doj -workmenCompensationAdded -toolkits -equipmentNumber -profilePic -licenceExpiry -sponsorship -workingIn -passportExpiry -hired -hiredFrom -labourContractExpiry -passportNo -dob -email -userType -status -mobDate -site',
  },
}

const LIST_PROJECTION = {
  name: 1,
  email: 1,
  qatarId: 1,
  designation: 1,
  role: 1,
  userType: 1,
  uniqueCode: 1,
  isActive: 1,
  createdAt: 1,
}

module.exports = { ADMIN_USER_KINDS, LIST_PROJECTION }