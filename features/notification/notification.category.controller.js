const HTTP = require('#shared/response/response.status');
const { handleNotificationRoute } = require('./notification.route.handler');
const membersService = require('./notification.category.members.service');
const avatarService = require('./notification.category.avatar.service');

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

const setAvatar = handleNotificationRoute('setCategoryAvatar', async (req) => ({
  status: HTTP.OK,
  message: 'Category image updated',
  data: await avatarService.setCategoryAvatar({
    categoryKey: req.params.categoryKey,
    requesterCode: req.user.uniqueCode,
    filePath: req.body.filePath,
    mimeType: req.body.mimeType,
  }),
}));

module.exports = { listMembers, addMembers, removeMember, setAvatar };