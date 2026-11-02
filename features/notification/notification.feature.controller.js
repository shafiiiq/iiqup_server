const HTTP = require('#shared/response/response.status');
const { handleNotificationRoute } = require('./notification.route.handler');
const featureService = require('./notification.feature.service');

const listFeatures = handleNotificationRoute('listAttachmentFeatures', async () => ({
  status: HTTP.OK,
  message: 'Features retrieved',
  data: featureService.listAttachmentFeatures(),
}));

const searchDocuments = handleNotificationRoute('searchAttachmentFeatureDocuments', async (req) => ({
  status: HTTP.OK,
  message: 'Documents retrieved',
  data: await featureService.searchFeatureDocuments({
    featureKey: req.params.featureKey,
    term: req.query.q,
  }),
}));

module.exports = { listFeatures, searchDocuments };