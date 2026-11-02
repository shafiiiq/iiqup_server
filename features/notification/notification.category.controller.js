const HTTP = require('#shared/response/response.status');
const { handleNotificationRoute } = require('./notification.route.handler');
const membersService = require('./notification.category.members.service');

const listMembers = handleNotificationRoute('listCategoryMembers', async (req) => ({
  status: HTTP.OK,
  message: 'Participants retrieved',
  data: await membersService.listCategoryMembers({
    categoryKey: req.params.categoryKey,
    requesterCode: req.user.uniqueCode,
  }),
}));

const addMembers = handleNotificationRoute('addCategoryMembers', async (req) => ({
  status: HTTP.OK,
  message: 'Participants added',
  data: await membersService.addCategoryMembers({
    categoryKey: req.params.categoryKey,
    requesterCode: req.user.uniqueCode,
    uniqueCodes: req.body.uniqueCodes,
  }),
}));

const removeMember = handleNotificationRoute('removeCategoryMember', async (req) => ({
  status: HTTP.OK,
  message: 'Participant removed',
  data: await membersService.removeCategoryMember({
    categoryKey: req.params.categoryKey,
    requesterCode: req.user.uniqueCode,
    uniqueCode: req.params.uniqueCode,
  }),
}));

module.exports = { listMembers, addMembers, removeMember };