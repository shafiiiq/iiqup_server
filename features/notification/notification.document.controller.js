const HTTP = require('#shared/response/response.status');
const {
  countUnseenDocuments,
  markDocumentViewed,
  markAllDocumentsViewed,
} = require('#core/document/document.view.service');
const { handleNotificationRoute } = require('./notification.route.handler');
const { syncNotificationCounts } = require('./notification.dispatcher');

const getUnseenDocuments = handleNotificationRoute('getUnseenDocuments', async (req) => ({
  status: HTTP.OK,
  message: 'Unseen documents retrieved',
  data: await countUnseenDocuments(req.user.uniqueCode),
}));

const markViewed = handleNotificationRoute('markDocumentViewed', async (req) => {
  const { uniqueCode } = req.user;
  await markDocumentViewed({ uniqueCode, sourceKey: req.params.sourceKey, documentId: req.params.documentId });
  await syncNotificationCounts(uniqueCode);
  return {
    status: HTTP.OK,
    message: 'Document marked as viewed',
    data: await countUnseenDocuments(uniqueCode),
  };
});

const markAllViewed = handleNotificationRoute('markAllDocumentsViewed', async (req) => {
  const { uniqueCode } = req.user;
  await markAllDocumentsViewed({ uniqueCode, sourceKey: req.params.sourceKey });
  await syncNotificationCounts(uniqueCode);
  return {
    status: HTTP.OK,
    message: 'Documents marked as viewed',
    data: await countUnseenDocuments(uniqueCode),
  };
});

module.exports = { getUnseenDocuments, markViewed, markAllViewed };