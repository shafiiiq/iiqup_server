const HTTP = require('#shared/response/response.status');
const { handleNotificationRoute } = require('./notification.route.handler');
const composeService = require('./notification.compose.service');

const composeMessage = handleNotificationRoute('composeMessage', async (req) => ({
  status: HTTP.CREATED,
  message: 'Message sent',
  data: await composeService.composeMessage({
    uniqueCode: req.user.uniqueCode,
    text: req.body.text,
    mentions: req.body.mentions,
    categoryLabel: req.body.categoryLabel,
    attachments: req.body.attachments,
    featureLinks: req.body.featureLinks,
  }),
}));

module.exports = { composeMessage };