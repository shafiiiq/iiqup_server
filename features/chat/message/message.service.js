const mongoose = require('mongoose');
const HTTP = require('#shared/response/response.status');
const { AppError } = require('#shared/errors/error.http');
const { paginate } = require('#shared/pagination/pagination');
const Message = require('./message.model');
const Chat = require('../shared/chat.model');
const { verifyUserAccess } = require('../shared/chat.access.service');
const { recordMessage, resetUnreadCount } = require('../shared/chat.activity.service');
const { FILE_MESSAGE_TYPES, EDIT_WINDOW_MS, DELETED_MESSAGE_TEXT } = require('./message.constant');

const DEFAULT_PAGINATION = { page: 1, limit: 50, skip: 0 };
const NON_FORWARDABLE_TYPES = ['system', 'voice call'];

const toObjectId = (value) => new mongoose.Types.ObjectId(String(value));

const buildPreview = (messageType, content) => (messageType === 'text' ? content : `${messageType} message`);

const assertChangeable = (message) => {
  if (!message) throw new AppError('Message not found or not yours', HTTP.NOT_FOUND);
  if (message.isDeleted) throw new AppError('Message was deleted', HTTP.CONFLICT);
  if (Date.now() - new Date(message.createdAt).getTime() > EDIT_WINDOW_MS) {
    throw new AppError('Messages older than 1 hour cannot be changed', HTTP.FORBIDDEN);
  }
};

const getMessages = async (chatId, pagination = DEFAULT_PAGINATION, userId) => {
  const result = await paginate(Message, { chatId, deletedFor: { $ne: userId } }, pagination, {
    sort: { createdAt: -1 },
  });
  return { data: [...result.data].reverse(), pagination: result.pagination };
};

const sendMessage = async ({
  chatId,
  senderId,
  senderType,
  senderName,
  messageType = 'text',
  content,
  fileName,
  mimeType,
  fileSize,
  duration,
  replyTo,
  caption,
}) => {
  if (!(await verifyUserAccess(chatId, senderId))) throw new AppError('Access denied to this chat', HTTP.FORBIDDEN);

  const message = await Message.create({
    chatId,
    senderId,
    senderType,
    senderName,
    messageType,
    content,
    fileName,
    mimeType,
    fileSize,
    duration,
    caption,
    replyTo,
  });

  await recordMessage({ chatId, senderId, senderName, messageType, preview: buildPreview(messageType, content) });
  return message;
};

const markMessagesAsDelivered = async (messageIds, userId) => {
  const userObjectId = toObjectId(userId);
  await Message.updateMany(
    { _id: { $in: messageIds }, senderId: { $ne: userObjectId }, 'deliveredTo.userId': { $ne: userObjectId } },
    [
      {
        $set: {
          deliveredTo: {
            $concatArrays: [{ $ifNull: ['$deliveredTo', []] }, [{ userId: userObjectId, deliveredAt: new Date() }]],
          },
          status: { $cond: [{ $eq: ['$status', 'sent'] }, 'delivered', '$status'] },
        },
      },
    ]
  );
};

const markMessagesAsRead = async (chatId, messageIds, userId) => {
  const chat = await Chat.findById(chatId).select('participants').lean();
  if (!chat) throw new AppError('Chat not found', HTTP.NOT_FOUND);

  const userObjectId = toObjectId(userId);
  const requiredReads = Math.max(chat.participants.length - 1, 1);

  await Message.updateMany(
    { _id: { $in: messageIds }, chatId, senderId: { $ne: userObjectId }, 'readBy.userId': { $ne: userObjectId } },
    [
      {
        $set: {
          readBy: { $concatArrays: [{ $ifNull: ['$readBy', []] }, [{ userId: userObjectId, readAt: new Date() }]] },
        },
      },
      { $set: { status: { $cond: [{ $gte: [{ $size: '$readBy' }, requiredReads] }, 'read', '$status'] } } },
    ]
  );

  await resetUnreadCount(chatId, userId);
};

const getUnreadMessagesForUser = (chatId, userId) =>
  Message.find({ chatId, senderId: { $ne: userId }, 'readBy.userId': { $ne: userId }, deletedFor: { $ne: userId } })
    .select('_id senderId')
    .lean();

const deleteMessage = async (messageId, userId, deleteForEveryone = false) => {
  const message = await Message.findById(messageId).lean();
  if (!message) throw new AppError('Message not found', HTTP.NOT_FOUND);

  if (!deleteForEveryone) {
    if (!(await verifyUserAccess(message.chatId, userId))) throw new AppError('Access denied to this chat', HTTP.FORBIDDEN);
    await Message.updateOne({ _id: messageId }, { $addToSet: { deletedFor: userId } });
    return { chatId: String(message.chatId), message: null };
  }

  if (String(message.senderId) !== String(userId)) {
    throw new AppError('Only the sender can delete for everyone', HTTP.FORBIDDEN);
  }
  assertChangeable(message);

  const updated = await Message.findByIdAndUpdate(
    messageId,
    {
      $set: { isDeleted: true, messageType: 'system', content: DELETED_MESSAGE_TEXT },
      $unset: { caption: 1, replyTo: 1, fileName: 1, mimeType: 1 },
    },
    { new: true }
  ).lean();
  return { chatId: String(message.chatId), message: updated };
};

const editMessage = async (messageId, userId, content) => {
  const text = String(content || '').trim();
  if (!text) throw new AppError('Content is required', HTTP.BAD_REQUEST);

  const message = await Message.findOne({ _id: messageId, senderId: userId, messageType: 'text' });
  assertChangeable(message);

  message.content = text;
  message.editedAt = new Date();
  await message.save();
  return message.toObject();
};

const updateMessageCaption = async (messageId, userId, caption) => {
  const message = await Message.findOne({ _id: messageId, senderId: userId, messageType: { $in: FILE_MESSAGE_TYPES } });
  assertChangeable(message);

  message.caption = String(caption || '').trim();
  await message.save();
  return message.toObject();
};

const forwardMessage = async ({ messageId, targetChatId, sender }) => {
  const original = await Message.findById(messageId).lean();
  if (!original || original.isDeleted) throw new AppError('Message not found', HTTP.NOT_FOUND);
  if (NON_FORWARDABLE_TYPES.includes(original.messageType)) {
    throw new AppError('This message cannot be forwarded', HTTP.BAD_REQUEST);
  }

  const [canReadSource, canWriteTarget] = await Promise.all([
    verifyUserAccess(original.chatId, sender.id),
    verifyUserAccess(targetChatId, sender.id),
  ]);
  if (!canReadSource || !canWriteTarget) throw new AppError('Access denied to this chat', HTTP.FORBIDDEN);

  const forwarded = await Message.create({
    chatId: targetChatId,
    senderId: sender.id,
    senderType: sender.type,
    senderName: sender.name,
    messageType: original.messageType,
    content: original.content,
    caption: original.caption,
    fileName: original.fileName,
    mimeType: original.mimeType,
    fileSize: original.fileSize,
    duration: original.duration,
  });

  await recordMessage({
    chatId: targetChatId,
    senderId: sender.id,
    senderName: sender.name,
    messageType: forwarded.messageType,
    preview: buildPreview(forwarded.messageType, forwarded.content),
  });
  return forwarded.toObject();
};

module.exports = {
  getMessages,
  sendMessage,
  markMessagesAsDelivered,
  markMessagesAsRead,
  getUnreadMessagesForUser,
  deleteMessage,
  editMessage,
  updateMessageCaption,
  forwardMessage,
};