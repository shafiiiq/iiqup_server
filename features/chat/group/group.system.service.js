const logger = require('#shared/logger/logger');
const Message = require('../message/message.model');
const { recordMessage } = require('../shared/chat.activity.service');

const joinNames = (names) => {
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

const MESSAGE_BUILDERS = {
  created: ({ actor, groupName }) => `${actor} created the group${groupName ? ` “${groupName}”` : ''}`,
  renamed: ({ actor, groupName }) => `${actor} renamed the group to “${groupName}”`,
  added: ({ actor, targets }) => (targets.length ? `${actor} added ${joinNames(targets)}` : `${actor} added members`),
  removed: ({ actor, targets }) => (targets.length ? `${actor} removed ${joinNames(targets)}` : `${actor} removed a member`),
  promoted: ({ actor, targets }) =>
    targets.length ? `${actor} promoted ${joinNames(targets)} to admin` : `${actor} promoted a member to admin`,
  left: ({ actor }) => `${actor} left the group`,
};

const buildGroupSystemMessage = ({ event, actorName, targetNames = [], groupName }) => {
  const actor = actorName || 'Someone';
  const build = MESSAGE_BUILDERS[event];
  if (!build) return `${actor} updated the group`;
  return build({ actor, targets: targetNames.filter(Boolean), groupName });
};

const createGroupSystemMessage = async ({ chat, actor, event, targetNames = [] }) => {
  try {
    const content = buildGroupSystemMessage({ event, actorName: actor.name, targetNames, groupName: chat.name });
    const message = await Message.create({
      chatId: chat._id,
      senderId: actor.id,
      senderType: actor.userType || 'staff',
      senderName: actor.name || 'System',
      messageType: 'system',
      content,
    });
    await recordMessage({
      chatId: chat._id,
      senderId: actor.id,
      senderName: actor.name,
      messageType: 'system',
      preview: content,
      countUnread: false,
    });
    return message;
  } catch (error) {
    logger.error('[chat.group.system] createGroupSystemMessage:', error);
    return null;
  }
};

module.exports = { createGroupSystemMessage };