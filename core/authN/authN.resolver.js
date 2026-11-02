const staffService = require('#features/user/staff/staff.service');
const mechanicService = require('#features/user/mechanic/mechanic.service');
const operatorService = require('#features/user/operator/operator.service');

const AUTH_HANDLERS = {
  staff: staffService.verifyStaffCredentials,
  mechanic: mechanicService.verifyMechanic,
  operator: operatorService.verifyOperator,
};

const QATAR_LOGIN_HANDLERS = {
  mechanic: mechanicService.loginMechanic,
  operator: operatorService.loginOperator,
};

const resolveAuthHandler = (userType) => AUTH_HANDLERS[userType] || AUTH_HANDLERS.staff;

const isQatarIdUserType = (userType) => Object.hasOwn(QATAR_LOGIN_HANDLERS, userType);

const resolveQatarLoginHandler = (userType) => QATAR_LOGIN_HANDLERS[userType];

module.exports = { resolveAuthHandler, isQatarIdUserType, resolveQatarLoginHandler };