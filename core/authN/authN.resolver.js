const staffService = require('#features/user/staff/staff.service');
const mechanicService = require('#features/user/mechanic/mechanic.service');
const operatorService = require('#features/user/operator/operator.service');

const AUTH_HANDLERS = {
  staff: staffService.verifyStaffCredentials,
  mechanic: mechanicService.verifyMechanicCredentials,
  operator: operatorService.verifyOperator,
};

const resolveAuthHandler = (userType) => AUTH_HANDLERS[userType] || AUTH_HANDLERS.staff;

module.exports = { resolveAuthHandler };