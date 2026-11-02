const HTTP = require('#shared/response/response.status');
const { handleNotificationRoute } = require('./notification.route.handler');
const calendarService = require('./notification.calendar.service');

const getCalendar = handleNotificationRoute('getCalendar', async (req) => ({
  status: HTTP.OK,
  message: 'Calendar activity retrieved',
  data: await calendarService.listMonthActivity({
    uniqueCode: req.user.uniqueCode,
    year: Number(req.query.year),
    month: Number(req.query.month),
  }),
}));

module.exports = { getCalendar };