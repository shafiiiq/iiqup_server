const MESSAGE_TYPES = ['text', 'system', 'image', 'video', 'audio', 'voice', 'document', 'location', 'voice call'];
const FILE_MESSAGE_TYPES = ['image', 'video', 'audio', 'voice', 'document'];
const MESSAGE_STATUSES = ['sent', 'delivered', 'read'];
const EDIT_WINDOW_MS = 60 * 60 * 1000;
const DELETED_MESSAGE_TEXT = 'This message was deleted';

module.exports = { MESSAGE_TYPES, FILE_MESSAGE_TYPES, MESSAGE_STATUSES, EDIT_WINDOW_MS, DELETED_MESSAGE_TEXT };