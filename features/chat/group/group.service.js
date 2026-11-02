const logger = require('#shared/logger/logger');
const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const Chat = require('../shared/chat.model');
const { CHAT_TYPES } = require('../shared/chat.constant');
const { resolveParticipants } = require('../shared/chat.participant.resolver');

const MIN_GROUP_MEMBERS = 2;
const DEFAULT_GROUP_NAME = 'New Group';

const sameId = (first, second) => String(first) === String(second);

const createGroupChat = async ({ creator, name, participants }) => {
  const requested = (participants || []).filter(Boolean);
  if (requested.length < MIN_GROUP_MEMBERS) {
    throw new AppError('At least 2 participants are required', HTTP.BAD_REQUEST);
  }

  const members = await resolveParticipants([{ uniqueCode: creator.uniqueCode }, ...requested], {
    adminCodes: [creator.uniqueCode],
  });
  if (members.length < MIN_GROUP_MEMBERS + 1) {
    throw new AppError('Could not find the selected participants', HTTP.BAD_REQUEST);
  }

  const chat = await Chat.create({
    type: CHAT_TYPES.GROUP,
    name: String(name || '').trim() || DEFAULT_GROUP_NAME,
    creatorId: creator.id,
    participants: members,
  });

  const actorName = members.find((member) => member.uniqueCode === creator.uniqueCode)?.name;
  return { chat: chat.toObject(), actorName };
};

const updateGroupChat = async (chatId, userId, updates = {}) => {
  const chat = await Chat.findOne({ _id: chatId, type: CHAT_TYPES.GROUP, 'participants.userId': userId });
  if (!chat) throw new AppError('Group not found', HTTP.NOT_FOUND);

  const actor = chat.participants.find((participant) => sameId(participant.userId, userId));
  if (!actor.isAdmin) throw new AppError('Only group admins can manage the group', HTTP.FORBIDDEN);

  const events = [];
  const findMember = (id) => chat.participants.find((participant) => sameId(participant.userId, id));

  const newName = String(updates.name || '').trim();
  if (newName && newName !== chat.name) {
    chat.name = newName;
    events.push({ event: 'renamed', targetNames: [] });
  }

  const additions = (updates.addParticipants || []).filter(
    (reference) => !chat.participants.some((participant) => participant.uniqueCode === reference?.uniqueCode)
  );
  if (additions.length > 0) {
    const added = await resolveParticipants(additions);
    if (added.length > 0) {
      chat.participants.push(...added);
      events.push({ event: 'added', targetNames: added.map((member) => member.name) });
    }
  }

  const removed = (updates.removeParticipants || [])
    .map(String)
    .filter((id) => !sameId(id, userId))
    .map(findMember)
    .filter(Boolean);
  if (removed.length > 0) {
    const removedIds = removed.map((member) => String(member.userId));
    chat.participants = chat.participants.filter((participant) => !removedIds.includes(String(participant.userId)));
    events.push({ event: 'removed', targetNames: removed.map((member) => member.name || 'a member') });
  }

  const promoted = (updates.promoteParticipants || []).map(findMember).filter((member) => member && !member.isAdmin);
  if (promoted.length > 0) {
    promoted.forEach((member) => {
      member.isAdmin = true;
    });
    events.push({ event: 'promoted', targetNames: promoted.map((member) => member.name || 'a member') });
  }

  await chat.save();
  return { chat: chat.toObject(), actorName: actor.name, events };
};

const leaveGroupChat = async (chatId, userId) => {
  const chat = await Chat.findOne({ _id: chatId, type: CHAT_TYPES.GROUP, 'participants.userId': userId });
  if (!chat) throw new AppError('Group not found', HTTP.NOT_FOUND);

  const actorName = chat.participants.find((participant) => sameId(participant.userId, userId))?.name;
  chat.participants = chat.participants.filter((participant) => !sameId(participant.userId, userId));
  if (chat.participants.length > 0 && !chat.participants.some((participant) => participant.isAdmin)) {
    chat.participants[0].isAdmin = true;
  }

  await chat.save();
  logger.info('[chat.group] member left', { chatId: String(chatId), userId: String(userId) });
  return { chat: chat.toObject(), actorName };
};

module.exports = { createGroupChat, updateGroupChat, leaveGroupChat };