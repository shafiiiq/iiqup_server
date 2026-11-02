const Notification = require('./notification.model');
const NotificationReply = require('./notification.reply.model');
const { listAvailableTabs } = require('./notification.list.service');
const { buildTabQuery, buildUnreadQuery } = require('./notification.query.builder');
const { resolveActorByUniqueCode } = require('./notification.actor.resolver');

const PERSON_SUMMARY_LIMIT = 100;

const buildReplyPreview = (reply) => {
  if (reply.text) return reply.text;
  return (reply.attachments || []).some((attachment) => attachment.mimeType.startsWith('audio/'))
    ? 'Sent a voice message'
    : 'Sent an attachment';
};

const findLatestLike = (notification) =>
  (notification.likes || []).reduce((latest, like) => (!latest || like.likedAt > latest.likedAt ? like : latest), null);

const resolveLatestEvent = async (notification) => {
  const latestReply = await NotificationReply.findOne({ notificationId: notification._id })
    .sort({ createdAt: -1, _id: -1 })
    .lean();
  const latestLike = findLatestLike(notification);

  const candidates = [
    {
      eventType: 'notification',
      at: notification.createdAt,
      actor: notification.actor,
      text: notification.body || notification.title,
      replyId: null,
    },
  ];
  if (latestReply) {
    candidates.push({
      eventType: 'reply',
      at: latestReply.createdAt,
      actor: latestReply.author,
      text: buildReplyPreview(latestReply),
      replyId: String(latestReply._id),
    });
  }
  if (latestLike) {
    candidates.push({
      eventType: 'like',
      at: latestLike.likedAt,
      likerCode: latestLike.uniqueCode,
      text: 'liked this notification',
      replyId: null,
    });
  }

  const latest = candidates.reduce((current, candidate) => (new Date(candidate.at) > new Date(current.at) ? candidate : current));
  const actor = latest.eventType === 'like' ? await resolveActorByUniqueCode(latest.likerCode) : latest.actor;

  return {
    notificationId: String(notification._id),
    replyId: latest.replyId,
    eventType: latest.eventType,
    text: latest.text,
    actor: actor || null,
    at: latest.at,
  };
};

const listCategorySummaries = async (uniqueCode) => {
  const tabs = await listAvailableTabs(uniqueCode);
  return Promise.all(
    tabs.map(async (tab) => {
      const query = await buildTabQuery({ uniqueCode, tab: tab.tab, categoryKey: tab.categoryKey });
      const latestNotification = await Notification.findOne(query).sort({ lastActivityAt: -1, _id: -1 }).lean();
      return {
        tab,
        pendingCount: tab.pendingCount,
        latestEvent: latestNotification ? await resolveLatestEvent(latestNotification) : null,
      };
    })
  );
};

const listPersonSummaries = async (uniqueCode) => {
  const visibleNotificationIds = await Notification.distinct('_id', { audience: uniqueCode });
  const otherActorMatch = { $nin: [null, uniqueCode] };

  const [notificationGroups, unreadNotificationGroups, replyGroups, unseenReplyGroups] = await Promise.all([
    Notification.aggregate([
      { $match: { audience: uniqueCode, 'actor.uniqueCode': otherActorMatch } },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $group: {
          _id: '$actor.uniqueCode',
          notificationId: { $first: '$_id' },
          at: { $first: '$createdAt' },
          person: { $first: '$actor' },
          text: {
            $first: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$body', ''] } }, 0] }, '$body', '$title'] },
          },
        },
      },
    ]),
    Notification.aggregate([
      { $match: { ...buildUnreadQuery(uniqueCode), 'actor.uniqueCode': otherActorMatch } },
      { $group: { _id: '$actor.uniqueCode', count: { $sum: 1 } } },
    ]),
    NotificationReply.aggregate([
      { $match: { notificationId: { $in: visibleNotificationIds }, 'author.uniqueCode': { $ne: uniqueCode } } },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $group: {
          _id: '$author.uniqueCode',
          replyId: { $first: '$_id' },
          notificationId: { $first: '$notificationId' },
          at: { $first: '$createdAt' },
          person: { $first: '$author' },
          text: { $first: '$text' },
          attachments: { $first: '$attachments' },
        },
      },
    ]),
    NotificationReply.aggregate([
      {
        $match: {
          notificationId: { $in: visibleNotificationIds },
          'author.uniqueCode': { $ne: uniqueCode },
          'viewedBy.uniqueCode': { $ne: uniqueCode },
        },
      },
      { $group: { _id: '$author.uniqueCode', count: { $sum: 1 } } },
    ]),
  ]);

  const people = new Map();
  const getEntry = (personCode, person) => {
    if (!people.has(personCode)) people.set(personCode, { person, pendingCount: 0, latestEvent: null });
    return people.get(personCode);
  };
  const offerEvent = (entry, event) => {
    if (!entry.latestEvent || new Date(event.at) > new Date(entry.latestEvent.at)) entry.latestEvent = event;
  };

  notificationGroups.forEach((group) =>
    offerEvent(getEntry(group._id, group.person), {
      notificationId: String(group.notificationId),
      replyId: null,
      eventType: 'notification',
      text: group.text,
      actor: group.person,
      at: group.at,
    })
  );
  replyGroups.forEach((group) =>
    offerEvent(getEntry(group._id, group.person), {
      notificationId: String(group.notificationId),
      replyId: String(group.replyId),
      eventType: 'reply',
      text: buildReplyPreview(group),
      actor: group.person,
      at: group.at,
    })
  );
  [...unreadNotificationGroups, ...unseenReplyGroups].forEach((group) => {
    const entry = people.get(group._id);
    if (entry) entry.pendingCount += group.count;
  });

  return [...people.values()]
    .sort((first, second) => new Date(second.latestEvent.at) - new Date(first.latestEvent.at))
    .slice(0, PERSON_SUMMARY_LIMIT);
};

module.exports = { listCategorySummaries, listPersonSummaries };