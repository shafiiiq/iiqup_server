const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const { getRegistryEntry } = require('#core/registry/model.registry');
const { dispatchNotificationActivityToUser } = require('#core/notification/push/push.dispatcher');
const Notification = require('./notification.model');
const NotificationCategory = require('./notification.category.model');
const { resolveActorsByUniqueCodes } = require('./notification.actor.resolver');

const unique = (codes) => [...new Set((codes || []).filter(Boolean).map(String))];

const resolveLabel = (categoryKey) => getRegistryEntry(categoryKey)?.tabLabel || categoryKey;

const ensureCategoryDoc = async (categoryKey) => {
  const existing = await NotificationCategory.findOne({ key: categoryKey }).lean();
  if (existing?.members?.length) return existing;

  const audience = await Notification.distinct('audience', { categoryKey });
  return NotificationCategory.findOneAndUpdate(
    { key: categoryKey },
    { $setOnInsert: { label: resolveLabel(categoryKey) }, $addToSet: { members: { $each: audience } } },
    { upsert: true, new: true }
  ).lean();
};

const getCategoryMemberCodes = async (categoryKey) => (await ensureCategoryDoc(categoryKey)).members || [];

const registerCategoryParticipants = async (categoryKey, codes) => {
  await ensureCategoryDoc(categoryKey);
  await NotificationCategory.updateOne({ key: categoryKey }, { $addToSet: { members: { $each: unique(codes) } } });
};

const assertParticipant = async (categoryKey, uniqueCode) => {
  const members = await getCategoryMemberCodes(categoryKey);
  if (!members.includes(uniqueCode)) throw new AppError('Only category participants can do this', HTTP.FORBIDDEN);
  return members;
};

const serializeMembers = async (codes) => {
  const actors = await resolveActorsByUniqueCodes(codes);
  const byCode = new Map(actors.map((actor) => [actor.uniqueCode, actor]));
  return codes
    .filter((code) => byCode.has(code))
    .map((code) => {
      const actor = byCode.get(code);
      return {
        id: actor.id,
        model: actor.model,
        uniqueCode: actor.uniqueCode,
        name: actor.name,
        designation: actor.designation || '',
        profilePicPath: actor.profilePicPath || '',
      };
    });
};

const broadcastChange = (codes) =>
  unique(codes).forEach((code) =>
    dispatchNotificationActivityToUser(code, {
      kind: 'notification_activity',
      notificationId: null,
      activityType: 'category',
      replyId: null,
    })
  );

const listCategoryMembers = async ({ categoryKey, requesterCode }) => {
  const members = await assertParticipant(categoryKey, requesterCode);
  return serializeMembers(members);
};

const addCategoryMembers = async ({ categoryKey, requesterCode, uniqueCodes }) => {
  await assertParticipant(categoryKey, requesterCode);

  const actors = await resolveActorsByUniqueCodes(unique(uniqueCodes));
  const codes = actors.map((actor) => actor.uniqueCode);
  if (codes.length === 0) throw new AppError('No valid people selected', HTTP.BAD_REQUEST);

  const doc = await NotificationCategory.findOneAndUpdate(
    { key: categoryKey },
    { $addToSet: { members: { $each: codes } } },
    { new: true }
  ).lean();
  await Notification.updateMany({ categoryKey }, { $addToSet: { audience: { $each: codes } } });

  broadcastChange(doc.members);
  return serializeMembers(doc.members);
};

const removeCategoryMember = async ({ categoryKey, requesterCode, uniqueCode }) => {
  const members = await assertParticipant(categoryKey, requesterCode);
  if (!members.includes(uniqueCode)) throw new AppError('Person is not a participant', HTTP.NOT_FOUND);
  if (members.length <= 1) throw new AppError('A category needs at least one participant', HTTP.CONFLICT);

  const doc = await NotificationCategory.findOneAndUpdate(
    { key: categoryKey },
    { $pull: { members: uniqueCode } },
    { new: true }
  ).lean();
  await Notification.updateMany(
    { categoryKey, 'actor.uniqueCode': { $ne: uniqueCode } },
    { $pull: { audience: uniqueCode, recipients: uniqueCode } }
  );

  broadcastChange([...doc.members, uniqueCode]);
  return serializeMembers(doc.members);
};

module.exports = {
  getCategoryMemberCodes,
  registerCategoryParticipants,
  listCategoryMembers,
  addCategoryMembers,
  removeCategoryMember,
};