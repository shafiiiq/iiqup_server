const HTTP = require('#shared/response/response.status');
const { listDistributionDefinitions } = require('#core/registry/distribution.registry');
const { handleNotificationRoute } = require('./notification.route.handler');
const distributionService = require('./notification.distribution.service');

const listDistributions = handleNotificationRoute('listDistributions', async () => ({
  status: HTTP.OK,
  message: 'Distributions retrieved',
  data: listDistributionDefinitions(),
}));

const submitDistribution = handleNotificationRoute('submitDistribution', async (req) => ({
  status: HTTP.CREATED,
  message: 'Submitted',
  data: await distributionService.submitDistribution({
    distributionKey: req.params.distributionKey,
    payload: req.body,
    notificationId: req.body?.notificationId || null,
    user: req.user,
    userId: req.userId,
  }),
}));

const listFieldSuggestions = handleNotificationRoute('listFieldSuggestions', async (req) => ({
  status: HTTP.OK,
  message: 'Suggestions retrieved',
  data: await distributionService.listFieldSuggestions({
    distributionKey: req.params.distributionKey,
    fieldKey: req.params.fieldKey,
    term: req.query.q,
  }),
}));

module.exports = { listDistributions, submitDistribution, listFieldSuggestions };