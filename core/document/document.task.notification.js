const DOCUMENT_TASK_UPDATE_EVENT = 'document_task_update';

const notifyDocumentTasksChanged = ({ sourceKey, documentId }) => {
  const { dispatchBroadcastWebSocketEvent } = require('#core/socket/socket.io');
  dispatchBroadcastWebSocketEvent(DOCUMENT_TASK_UPDATE_EVENT, { sourceKey, documentId });
};

module.exports = { DOCUMENT_TASK_UPDATE_EVENT, notifyDocumentTasksChanged };