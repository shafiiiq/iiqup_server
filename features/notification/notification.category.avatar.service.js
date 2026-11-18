const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const NotificationCategory = require('./notification.category.model');
const { getCategoryMemberCodes, broadcastChange } = require('./notification.category.members.service');

const AVATAR_KEY_PREFIX = 'notifications/categories/';

const setCategoryAvatar = async ({ categoryKey, requesterCode, filePath, mimeType }) => {
  const members = await getCategoryMemberCodes(categoryKey);
  if (!members.includes(requesterCode)) {
    throw new AppError('Only category participants can do this', HTTP.FORBIDDEN);
  }
  if (typeof filePath !== 'string' || !filePath.startsWith(AVATAR_KEY_PREFIX)) {
    throw new AppError('Invalid image', HTTP.BAD_REQUEST);
  }
  if (!String(mimeType || '').startsWith('image/')) throw new AppError('File must be an image', HTTP.BAD_REQUEST);

  await NotificationCategory.updateOne({ key: categoryKey }, { $set: { avatarPath: filePath } });
  broadcastChange(members);
  return { avatarPath: filePath };
};

module.exports = { setCategoryAvatar };