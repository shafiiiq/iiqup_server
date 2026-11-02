const bcrypt = require('bcrypt')
const { AppError } = require('#shared/errors/error.http')
const HTTP = require('#shared/response/response.status')
const User = require('#features/user/staff/staff.model')
const Mechanic = require('#features/user/mechanic/mechanic.model')
const Operator = require('#features/user/operator/operator.model')
const mechanicService = require('#features/user/mechanic/mechanic.service')
const operatorService = require('#features/user/operator/operator.service')
const { generateUniqueCode } = require('#features/user/staff/staff.helper')
const { USER_ROLES } = require('#features/user/staff/staff.constant')

const PASSWORD_SALT_ROUNDS = 10
const MODEL_BY_TYPE = { mechanic: Mechanic, operator: Operator }

const hashPassword = (plainPassword) => bcrypt.hash(plainPassword, PASSWORD_SALT_ROUNDS)

const findExistingAccount = ({ accountType, email, qatarId }) =>
  accountType === 'staff' ? User.findOne({ email }) : MODEL_BY_TYPE[accountType].findOne({ qatarId })

const createStaffAccount = ({ name, email, passwordHash, designation, role }) => {
  const resolvedRole = role || USER_ROLES.GUEST_USER
  return new User({
    name,
    email,
    password: passwordHash,
    designation,
    role: resolvedRole,
    userType: 'staff',
    uniqueCode: generateUniqueCode(resolvedRole),
  }).save()
}

const createMechanicAccount = async ({ name, qatarId, designation }) => {
  const result = await mechanicService.insertMechanics({
    name,
    qatarId,
    designation,
    uniqueCode: generateUniqueCode('MECHANIC'),
    isActive: true,
  })
  return result.data
}

const createOperatorAccount = ({ name, qatarId, designation }) =>
  operatorService.createOperator({ name, qatarId, designation })

const ACCOUNT_CREATORS = {
  staff: createStaffAccount,
  mechanic: createMechanicAccount,
  operator: createOperatorAccount,
}

const createAccount = async (accountDetails) => {
  const creator = ACCOUNT_CREATORS[accountDetails.accountType]
  if (!creator) throw new AppError('Invalid account type', HTTP.BAD_REQUEST)

  if (await findExistingAccount(accountDetails)) {
    throw new AppError('An account already exists for these details', HTTP.CONFLICT)
  }

  try {
    return await creator(accountDetails)
  } catch (error) {
    if (error.name === 'ValidationError') {
      throw new AppError(Object.values(error.errors).map((fieldError) => fieldError.message).join(', '), HTTP.BAD_REQUEST)
    }
    throw error
  }
}

module.exports = { createAccount, hashPassword, findExistingAccount }